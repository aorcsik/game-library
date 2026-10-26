import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { parseHTML } from 'linkedom';
import { toGameMeta } from '../src/games.ts';

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

test('manual genres persist and appear in game details, list rows and genre filters', async () => {
  const mf = new Miniflare({
    workers: [{
      config: {
        name: 'genres-test', compatibilityDate: '2026-09-27',
        manifest: {
          mainModule: 'index.js',
          modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } },
        },
        exports: { GameRefreshQueue: { type: 'durable-object', storage: 'sqlite' } },
        env: {
          REFRESH_QUEUE: { type: 'durable-object', worker: 'genres-test', exportName: 'GameRefreshQueue' },
          GAMEDB: { type: 'kv', id: 'genres-games' },
          GAMES: { type: 'kv', id: 'genres-transactions' },
          GAMESTATE: { type: 'kv', id: 'genres-state' },
          CREATORS: { type: 'kv', id: 'genres-creators' },
          LOCAL_DEV: { type: 'text', value: 'on' },
        },
      },
    }],
  });
  try {
    const games = await mf.getKVNamespace('GAMEDB');
    const game = {
      key: 'test-game', title: 'Test Game', updatedAt: '2026-01-01',
      steam: { id: 1, data: { genres: ['Action'] } },
      metacritic: { id: null, data: { genres: ['Adventure'] } },
    };
    await games.put('game:test-game', JSON.stringify(game), { metadata: toGameMeta(game) });
    const saved = await mf.dispatchFetch('http://localhost/games/test-game', {
      method: 'POST',
      headers: { Origin: 'http://localhost', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        title: game.title, steam: '1', metacritic: 'none', manualGenres: 'Puzzle, Action, Puzzle',
      }).toString(),
      redirect: 'manual',
    });
    assert.equal(saved.status, 303);
    const updated = await games.get('game:test-game', 'json');
    assert.deepEqual(updated.manualGenres, ['Puzzle', 'Action']);
    assert.deepEqual(updated.steam.data.genres, ['Action']);
    assert.deepEqual(updated.metacritic.data.genres, ['Adventure']);

    const detail = await mf.dispatchFetch('http://localhost/games/test-game');
    assert.equal(detail.status, 200);
    const detailDoc = parseHTML(await detail.text()).document;
    assert.equal(detailDoc.querySelector('textarea[name="manualGenres"]').textContent, 'Puzzle, Action');
    assert.match(detailDoc.querySelector('.game-release-genres').textContent, /Action, Adventure, Puzzle/);

    const list = await mf.dispatchFetch('http://localhost/games');
    assert.equal(list.status, 200);
    const listDoc = parseHTML(await list.text()).document;
    assert.equal(listDoc.querySelector('[data-game][data-key="test-game"]').getAttribute('data-genres'), 'Action|Adventure|Puzzle');
    assert.ok(listDoc.querySelector('.genre-filter input[name="genre"][value="Puzzle"]'));
  } finally {
    await mf.dispose();
  }
});
