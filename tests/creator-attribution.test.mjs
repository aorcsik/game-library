import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { parseHTML } from 'linkedom';

const bundle = await build({
  stdin: {
    contents: `
      import app, { GameRefreshQueue } from './src/index.tsx';
      export { GameRefreshQueue };
      export default { fetch: (request, env, ctx) => app.fetch(request, env, ctx) };
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, format: 'esm', platform: 'browser',
  jsx: 'automatic', jsxImportSource: 'hono', external: ['cloudflare:workers'],
});

const makeWorker = () => new Miniflare({
  workers: [{
    config: {
      name: 'credit-test', compatibilityDate: '2026-09-27',
      manifest: {
        mainModule: 'index.js',
        modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } },
      },
      exports: { GameRefreshQueue: { type: 'durable-object', storage: 'sqlite' } },
      env: {
        REFRESH_QUEUE: { type: 'durable-object', worker: 'credit-test', exportName: 'GameRefreshQueue' },
        GAMEDB: { type: 'kv', id: 'credit-games' },
        GAMES: { type: 'kv', id: 'credit-transactions' },
        GAMESTATE: { type: 'kv', id: 'credit-state' },
        CREATORS: { type: 'kv', id: 'credit-creators' },
        LOCAL_DEV: { type: 'text', value: 'on' },
      },
    },
  }],
});

const page = async (mf, path) => {
  const response = await mf.dispatchFetch(`http://localhost${path}`);
  assert.equal(response.status, 200, path);
  return parseHTML(await response.text()).document;
};

const save = (mf, creator, game, data) => mf.dispatchFetch(`http://localhost/creators/${creator}/games/${game}`, {
  method: 'POST', headers: { Origin: 'http://localhost', Accept: 'application/json' },
  body: new URLSearchParams(data),
});

test('miscredit overrides are sparse, preserve notes, and affect both game views', async () => {
  const mf = makeWorker();
  try {
    const games = await mf.getKVNamespace('GAMEDB');
    const creators = await mf.getKVNamespace('CREATORS');
    const game = {
      key: 'shared', title: 'Shared Game', updatedAt: '2020-01-01T00:00:00.000Z',
      steam: { id: null, data: { title: 'Shared Game', developers: ['Studio A', 'Studio B'], publishers: ['Studio A'] } },
      opencritic: { id: null, data: { title: 'Shared Game', creators: ['Critic Only'] } },
    };
    await games.put('game:shared', JSON.stringify(game), {
      metadata: { title: game.title, developers: ['Studio A', 'Studio B'], publishers: ['Studio A'] },
    });
    for (const [key, name] of [['studio-a', 'Studio A'], ['studio-b', 'Studio B'], ['critic-only', 'Critic Only']]) {
      await creators.put(`developer:${key}`, JSON.stringify({ name, aliases: [] }));
    }
    const linkKey = 'creator-game:shared:studio-a';
    const creatorPage = await page(mf, '/creators/studio-a');
    const checkbox = creatorPage.querySelector('form[data-creator-credit] input[name="credited"]');
    assert.ok(checkbox);
    assert.equal(checkbox.hasAttribute('checked'), true);
    assert.match(creatorPage.querySelector('[data-credit-note-display]').textContent, /No note/);
    assert.equal(creatorPage.querySelector('[data-credit-note-editor]').hasAttribute('hidden'), true);
    assert.equal(creatorPage.querySelector('input[name="notes"]').hasAttribute('disabled'), true);
    for (const action of ['edit', 'save', 'cancel']) {
      assert.ok(creatorPage.querySelector(`[data-action="${action}-credit-note"][aria-label]`));
    }
    assert.equal(await creators.get(linkKey), null);

    const unchecked = await save(mf, 'studio-a', 'shared', new FormData());
    assert.equal(unchecked.status, 200);
    assert.deepEqual(await creators.get(linkKey, 'json'), { miscredit: true });
    const directory = await page(mf, '/creators');
    assert.match(directory.querySelector('.creator-verification label').textContent, /2 \/ 2 distinct credits \(100%\)/);
    assert.equal(directory.querySelector('.creator-verification progress').getAttribute('value'), '2');
    assert.equal(directory.querySelector('form[action="/creators/studio-a/games/shared"] input[name="credited"]').hasAttribute('checked'), false);
    assert.equal(directory.querySelector('form[action="/creators/studio-b/games/shared"] input[name="credited"]').hasAttribute('checked'), true);

    const list = await page(mf, '/games');
    assert.equal(list.querySelector('.creator-verification'), null);
    const row = list.querySelector('[data-game][data-key="shared"]');
    const card = list.querySelector('[data-game-card][data-key="shared"]');
    assert.equal(row.querySelector('.game-creator-column').textContent.includes('Studio A'), false);
    assert.match(row.querySelector('.game-creator-column').textContent, /Studio B/);
    assert.doesNotMatch(row.getAttribute('data-search'), /studio a/);
    assert.equal(card.querySelector('.game-creators').textContent.includes('Studio A'), false);
    assert.match(card.querySelector('.game-creators').textContent, /Studio B/);

    const detail = await page(mf, '/games/shared');
    assert.equal(detail.querySelectorAll('a.creator-miscredited[href="/creators/studio-a"]').length >= 2, true);
    assert.equal(detail.querySelector('a[href="/creators/studio-b"]').classList.contains('creator-miscredited'), false);
    assert.deepEqual((await games.get('game:shared', 'json')).steam.data.developers, ['Studio A', 'Studio B']);

    const notes = new FormData();
    notes.set('notes', 'Credited in error by Steam');
    assert.equal((await save(mf, 'studio-a', 'shared', notes)).status, 200);
    assert.deepEqual(await creators.get(linkKey, 'json'), { miscredit: true, notes: 'Credited in error by Steam' });
    const notePage = await page(mf, '/creators/studio-a');
    assert.equal(notePage.querySelector('input[name="notes"]').getAttribute('value'), 'Credited in error by Steam');
    assert.match(notePage.querySelector('[data-credit-note-text]').textContent, /Credited in error by Steam/);
    assert.equal(notePage.querySelector('[data-credit-note-editor]').hasAttribute('hidden'), true);
    const exported = await mf.dispatchFetch('http://localhost/export.json');
    assert.equal((await exported.json()).creatorGameLinks[0].notes, 'Credited in error by Steam');

    const checked = new FormData();
    checked.set('credited', '1');
    assert.equal((await save(mf, 'studio-a', 'shared', checked)).status, 200);
    assert.deepEqual(await creators.get(linkKey, 'json'), { notes: 'Credited in error by Steam' });
    assert.equal((await page(mf, '/games/shared')).querySelector('a[href="/creators/studio-a"]').classList.contains('creator-miscredited'), false);
    const restored = await page(mf, '/games');
    assert.match(restored.querySelector('[data-game][data-key="shared"] .game-creator-column').textContent, /Studio A/);
    const cleared = new FormData();
    cleared.set('credited', '1');
    cleared.set('notes', '');
    assert.equal((await save(mf, 'studio-a', 'shared', cleared)).status, 200);
    assert.equal(await creators.get(linkKey), null);

    const oversized = new FormData();
    oversized.set('notes', 'x'.repeat(1001));
    assert.equal((await save(mf, 'studio-a', 'shared', oversized)).status, 422);
    assert.equal(await creators.get(linkKey), null);
    assert.equal((await save(mf, 'studio-a', 'absent', new FormData())).status, 404);
  } finally {
    await mf.dispose();
  }
});

test('creator directory lists distinct unmatched credits with games and prefilled creation links', async () => {
  const mf = makeWorker();
  try {
    const games = await mf.getKVNamespace('GAMEDB');
    const creators = await mf.getKVNamespace('CREATORS');
    await creators.put('developer:studio-a', JSON.stringify({ name: 'Studio A', aliases: ['Studio Alpha'] }));
    for (const [key, title, developers, publishers, other] of [
      ['first', 'First Game', ['Studio Alpha', 'Unknown Studio'], ['Unknown Publisher'], ['Unlisted Critic']],
      ['second', 'Second Game', ['unknown studio', 'Studio A'], ['Unknown Studio'], []],
    ]) {
      const game = {
        key, title, updatedAt: '2026-01-01',
        steam: { id: null, data: { developers, publishers } },
        opencritic: { id: null, data: { creators: other } },
      };
      await games.put(`game:${key}`, JSON.stringify(game), {
        metadata: { title, developers, publishers },
      });
    }

    const directory = await page(mf, '/creators');
    assert.match(directory.querySelector('.creator-verification label').textContent, /2 \/ 4 distinct credits \(50%\)/);
    const creatorTable = directory.querySelector('table.creator-list');
    assert.equal(creatorTable.querySelector('th[aria-sort="ascending"] [data-creator-sort="name"]').textContent.trim(), 'Creator ↑');
    assert.equal(creatorTable.querySelector('tbody[data-creator-name="Studio A"]').getAttribute('data-game-count'), '2');
    const section = directory.querySelector('details.group');
    assert.match(section.querySelector('summary').textContent, /Creator names without a record \(3\)/);
    const entries = [...section.querySelectorAll('tbody tr')];
    assert.deepEqual(entries.map(row => row.querySelector('td').textContent), [
      'Unknown Publisher', 'Unknown Studio', 'Unlisted Critic',
    ]);
    const studio = entries[1];
    assert.deepEqual([...studio.querySelectorAll('.creator-games a')].map(link => link.textContent), ['First Game', 'Second Game']);
    assert.match(studio.textContent, /Developer, Publisher/);
    assert.equal(studio.querySelector('a[href="/creators/new?name=Unknown%20Studio"]').textContent, 'Create creator');
    assert.equal(entries[2].querySelector('a[href="/creators/new?name=Unlisted%20Critic"]').textContent, 'Create creator');
    assert.equal(directory.querySelector('a[href="/creators/studio-a"]').textContent, 'Studio A');

    const draft = await page(mf, '/creators/new?name=Unknown%20Studio');
    assert.equal(draft.querySelector('input[name="name"]').getAttribute('value'), 'Unknown Studio');
    assert.match(draft.querySelector('.creator-games').textContent, /First Game/);
    const created = await mf.dispatchFetch('http://localhost/creators', {
      method: 'POST',
      headers: { Origin: 'http://localhost', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name: 'Unknown Studio' }).toString(),
      redirect: 'manual',
    });
    assert.equal(created.status, 303);
    const updated = await page(mf, '/creators');
    assert.match(updated.querySelector('details.group summary').textContent, /without a record \(2\)/);
    assert.equal(updated.querySelector('a[href="/creators/unknown-studio"]').textContent, 'Unknown Studio');
  } finally {
    await mf.dispose();
  }
});

test('deleting a creator removes its connector records before the key can be reused', async () => {
  const mf = makeWorker();
  try {
    const creators = await mf.getKVNamespace('CREATORS');
    await creators.put('developer:old', JSON.stringify({ name: 'Old Creator', aliases: [] }));
    await creators.put('creator-game:shared:old', JSON.stringify({ miscredit: true, notes: 'Not involved' }));
    const response = await mf.dispatchFetch('http://localhost/creators/old/delete', {
      method: 'POST', redirect: 'manual', headers: { Origin: 'http://localhost' },
    });
    assert.equal(response.status, 303);
    assert.equal(await creators.get('developer:old'), null);
    assert.equal(await creators.get('creator-game:shared:old'), null);
  } finally {
    await mf.dispose();
  }
});

test('deleting a game removes its attribution records before its key can be reused', async () => {
  const mf = makeWorker();
  try {
    const games = await mf.getKVNamespace('GAMEDB');
    const creators = await mf.getKVNamespace('CREATORS');
    await games.put('game:delete-me', JSON.stringify({ key: 'delete-me', title: 'Delete Me', updatedAt: '2020-01-01T00:00:00.000Z' }), {
      metadata: { title: 'Delete Me' },
    });
    await creators.put('creator-game:delete-me:studio', JSON.stringify({ miscredit: true }));
    const response = await mf.dispatchFetch('http://localhost/games/delete-me/delete', {
      method: 'POST', redirect: 'manual', headers: { Origin: 'http://localhost' },
    });
    assert.equal(response.status, 303);
    assert.equal(await creators.get('creator-game:delete-me:studio'), null);
  } finally {
    await mf.dispose();
  }
});
