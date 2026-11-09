import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { parseHTML } from 'linkedom';
import { saveGame } from '../src/gamedb.ts';

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

test('wishlist bundle editing persists, links included games, and can be cleared', async () => {
  const mf = new Miniflare({
    workers: [{
      config: {
        name: 'wishlist-test', compatibilityDate: '2026-09-27',
        manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } } },
        exports: { GameRefreshQueue: { type: 'durable-object', storage: 'sqlite' } },
        env: {
          REFRESH_QUEUE: { type: 'durable-object', worker: 'wishlist-test', exportName: 'GameRefreshQueue' },
          GAMEDB: { type: 'kv', id: 'wishlist-games' },
          GAMES: { type: 'kv', id: 'wishlist-transactions' },
          GAMESTATE: { type: 'kv', id: 'wishlist-state' },
          CREATORS: { type: 'kv', id: 'wishlist-creators' },
          WISHLIST: { type: 'kv', id: 'wishlist-items' },
          LOCAL_DEV: { type: 'text', value: 'on' },
        },
      },
    }],
  });
  const post = (path, data) => mf.dispatchFetch(`http://localhost${path}`, {
    method: 'POST', headers: { Origin: 'http://localhost' }, body: new URLSearchParams(data), redirect: 'manual',
  });
  try {
    const kv = await mf.getKVNamespace('WISHLIST');
    const item = { platform: 'steam', id: '42', title: 'Incoming + Incoming Forces', kind: 'game',
      firstSeen: '2026-01-01', lastSeen: '2026-01-02', url: 'https://store.steampowered.com/app/42' };
    await kv.put('wish:steam:42', JSON.stringify(item), { metadata: { title: item.title, platform: item.platform, archived: false } });
    await kv.put('wish:steam:43', JSON.stringify({ ...item, id: '43', archivedAt: '2026-02-01' }),
      { metadata: { title: item.title, platform: item.platform, archived: true } });
    const transactions = await mf.getKVNamespace('GAMES');
    await transactions.put('tx:2026-01-01:abc', JSON.stringify({
      id: 'abc', date: '2026-01-01', title: 'Order', store: 'Fanatical', items: [], updatedAt: '2026-01-01',
    }), { metadata: { title: 'Order', store: 'Fanatical' } });
    await saveGame(await mf.getKVNamespace('GAMEDB'), { key: 'incoming', title: 'Incoming', updatedAt: '2026-01-01' });
    await kv.put('wish:steam:44', JSON.stringify({ ...item, id: '44', title: 'Incoming' }),
      { metadata: { title: 'Incoming', platform: 'steam', archived: false } });
    const defaultDetail = parseHTML(await (await mf.dispatchFetch('http://localhost/games/incoming')).text()).document;
    const defaultRow = [...defaultDetail.querySelectorAll('tr')].find(row => row.textContent.includes('Incoming'));
    assert.match(defaultRow.textContent, /Steam Store/);
    assert.ok(defaultRow.querySelector('img.store-logo[src="/assets/platforms/steam-color.svg"]'));
    await kv.delete('wish:steam:44');
    const transactionForm = parseHTML(await (await mf.dispatchFetch('http://localhost/transactions/new')).text()).document;
    assert.ok(transactionForm.querySelector('input[name="store"][required][list="stores"]'));
    assert.ok(transactionForm.querySelector('datalist#stores option[value="Fanatical"]'));

    const page = parseHTML(await (await mf.dispatchFetch('http://localhost/wishlist')).text()).document;
    assert.ok(page.querySelector('form[action="/wishlist/new"] button'));
    assert.ok(page.querySelector('a[href="/wishlist/steam/42"]'));
    assert.ok(page.querySelector('a[href="/wishlist/steam/43"]'));
    assert.equal(page.querySelector('textarea[name="included"]'), null);
    assert.match(page.querySelector('a[href="/wishlist/steam/42"]').closest('tr').textContent, /Steam Store/);
    assert.ok(page.querySelector('a[href="/wishlist/steam/42"]').closest('tr').querySelector('img.store-logo[src="/assets/platforms/steam-color.svg"]'));
    assert.ok(page.querySelector('a[href="/wishlist/steam/43"]').closest('tr').querySelector('img.store-logo[src="/assets/platforms/steam-color.svg"]'));
    const form = parseHTML(await (await mf.dispatchFetch('http://localhost/wishlist/steam/42')).text()).document;
    assert.equal(form.querySelector('form[action="/wishlist/steam/42/delete"]'), null);
    assert.equal((await post('/wishlist/steam/42/delete', {})).status, 403);
    assert.deepEqual(await kv.get('wish:steam:42', 'json'), item);
    assert.equal((await post('/wishlist/steam/999/delete', {})).status, 404);
    assert.equal((await post('/wishlist/invalid/42/delete', {})).status, 404);
    for (const name of ['title', 'platform', 'kind', 'url', 'addedAt']) {
      assert.ok(form.querySelector(`[name="${name}"]`).hasAttribute('readonly'), name);
    }
    assert.equal(form.querySelector('textarea[name="included"]').hasAttribute('readonly'), false);
    assert.equal(form.querySelector('input[name="store"]').getAttribute('value'), 'Steam Store');
    assert.equal(form.querySelector('input[name="store"]').hasAttribute('readonly'), false);
    assert.ok(form.querySelector('datalist#stores option[value="Fanatical"]'));
    const saved = await post('/wishlist/steam/42', { included: ' Incoming \r\n\n Incoming Forces \n',
      store: '  Fanatical  ', title: 'Forged', platform: 'gog', kind: 'dlc', url: 'https://example.com', addedAt: '2020-01-01', archived: 'on' });
    assert.equal(saved.status, 303);
    assert.deepEqual(await kv.get('wish:steam:42', 'json'), { ...item, store: 'Fanatical', included: ['Incoming', 'Incoming Forces'] });
    const html = parseHTML(await (await mf.dispatchFetch('http://localhost/wishlist/steam/42?saved=1')).text()).document;
    assert.match(html.querySelector('.notice').textContent, /saved/i);
    assert.equal(html.querySelector('textarea[name="included"]').textContent, 'Incoming\nIncoming Forces');
    assert.equal(html.querySelector('input[name="store"]').getAttribute('value'), 'Fanatical');
    const list = parseHTML(await (await mf.dispatchFetch('http://localhost/wishlist')).text()).document;
    assert.equal(list.querySelector('ul.contents a').getAttribute('href'), '/games/incoming');
    assert.match(list.querySelector('a[href="/wishlist/steam/42"]').closest('tr').textContent, /Fanatical/);
    assert.ok(list.querySelector('a[href="/wishlist/steam/42"]').closest('tr').querySelector('img.store-logo[src="/assets/platforms/fanatical.svg"]'));

    const games = parseHTML(await (await mf.dispatchFetch('http://localhost/games')).text()).document;
    const create = [...games.querySelectorAll('form[action="/games/new"]')].find(form =>
      form.querySelector('input[name="title"]')?.getAttribute('value') === 'Incoming Forces');
    assert.ok(create);
    assert.equal(create.querySelector('input[name="steam"]'), null);
    assert.ok(games.querySelector('[data-game][data-key="incoming"]'));
    const detail = await (await mf.dispatchFetch('http://localhost/games/incoming')).text();
    assert.match(detail, /Incoming \+ Incoming Forces/);
    const detailDoc = parseHTML(detail).document;
    const wishlistRow = [...detailDoc.querySelectorAll('tr')].find(row => row.textContent.includes('Incoming + Incoming Forces'));
    assert.match(wishlistRow.textContent, /Fanatical/);
    assert.ok(wishlistRow.querySelector('img.store-logo[src="/assets/platforms/fanatical.svg"]'));

    assert.equal((await post('/wishlist/steam/42', {})).status, 400);
    assert.equal((await post('/wishlist/steam/999', { included: '' })).status, 404);
    assert.equal((await post('/wishlist/other/42', { included: '' })).status, 404);
    assert.equal((await post('/wishlist/steam/43', { included: 'Archived Game' })).status, 303);
    assert.deepEqual((await kv.get('wish:steam:43', 'json')).included, ['Archived Game']);
    assert.equal((await post('/wishlist/steam/42', { included: ' \n ', store: '' })).status, 303);
    assert.deepEqual(await kv.get('wish:steam:42', 'json'), { ...item, store: '' });
    const clearedPage = parseHTML(await (await mf.dispatchFetch('http://localhost/wishlist')).text()).document;
    assert.doesNotMatch(clearedPage.querySelector('a[href="/wishlist/steam/42"]').closest('tr').textContent, /Steam Store/);
    assert.equal(clearedPage.querySelector('a[href="/wishlist/steam/42"]').closest('tr').querySelector('.store-logo'), null);
    assert.equal((await post('/wishlist/steam/42', { included: 'Incoming', store: 'Custom Shop' })).status, 303);
    const customList = parseHTML(await (await mf.dispatchFetch('http://localhost/wishlist')).text()).document;
    assert.ok(customList.querySelector('a[href="/wishlist/steam/42"]').closest('tr').querySelector('i.fa-cart-shopping.store-logo'));
    const customDetail = parseHTML(await (await mf.dispatchFetch('http://localhost/games/incoming')).text()).document;
    const customRow = [...customDetail.querySelectorAll('tr')].find(row => row.textContent.includes('Incoming + Incoming Forces'));
    assert.ok(customRow.querySelector('i.fa-cart-shopping.store-logo'));
    assert.equal((await post('/wishlist/steam/42', { included: '', store: '' })).status, 303);

    const newForm = parseHTML(await (await mf.dispatchFetch('http://localhost/wishlist/new')).text()).document;
    assert.equal(newForm.querySelector('form[action$="/delete"]'), null);
    assert.ok(newForm.querySelector('select[name="platform"] option[value="steam"]'));
    assert.ok(newForm.querySelector('select[name="platform"] option[value="gog"]'));
    assert.equal(newForm.querySelector('input[name="store"]').getAttribute('list'), 'stores');
    assert.ok(newForm.querySelector('datalist#stores option[value="Fanatical"]'));
    const invalid = await post('/wishlist', { title: '', platform: 'invalid', kind: 'game', url: 'javascript:alert(1)', included: 'A' });
    assert.equal(invalid.status, 422);
    const invalidHtml = await invalid.text();
    assert.match(invalidHtml, /Title is required/);
    assert.match(invalidHtml, /Platform is required/);
    assert.match(invalidHtml, /Store URL must be/);
    const longStore = await post('/wishlist/steam/42', { included: 'Kept', store: 'x'.repeat(101) });
    assert.equal(longStore.status, 422);
    const longStoreHtml = await longStore.text();
    assert.match(longStoreHtml, /Store is too long/);
    assert.match(longStoreHtml, /Fanatical/);
    assert.deepEqual(await kv.get('wish:steam:42', 'json'), { ...item, store: '' });
    const created = await post('/wishlist', { title: 'Manual Steam', platform: 'steam', kind: 'game',
      url: 'https://example.com/game', store: 'Fanatical', addedAt: '2026-03-01', included: 'Incoming\nOther' });
    assert.equal(created.status, 303);
    const location = created.headers.get('Location');
    assert.match(location, /^\/wishlist\/steam\/manual-[a-f0-9-]+\?saved=1$/);
    const id = location.match(/manual-[a-f0-9-]+/)[0];
    const manual = await kv.get(`wish:steam:${id}`, 'json');
    assert.equal(manual.source, 'manual');
    assert.equal(manual.store, 'Fanatical');
    assert.deepEqual(manual.included, ['Incoming', 'Other']);
    const manualForm = parseHTML(await (await mf.dispatchFetch(`http://localhost/wishlist/steam/${id}`)).text()).document;
    const deleteForm = manualForm.querySelector(`form[action="/wishlist/steam/${id}/delete"]`);
    assert.ok(deleteForm.querySelector('button.danger'));
    assert.equal(deleteForm.getAttribute('data-confirm'), 'Delete this wishlist entry?');
    assert.equal(manualForm.querySelector('[name="title"]').hasAttribute('readonly'), false);
    assert.ok(manualForm.querySelector('select[name="platform"]'));
    assert.equal(manualForm.querySelector('input[name="store"]').getAttribute('value'), 'Fanatical');
    const manualSteam = await post('/wishlist', { title: 'Manual Steam Single', platform: 'steam', kind: 'game', included: '' });
    assert.equal(manualSteam.status, 303);
    const steamGames = parseHTML(await (await mf.dispatchFetch('http://localhost/games')).text()).document;
    const steamCreate = [...steamGames.querySelectorAll('form[action="/games/new"]')].find(el =>
      el.querySelector('input[name="title"]')?.getAttribute('value') === 'Manual Steam Single');
    assert.ok(steamCreate);
    assert.equal(steamCreate.querySelector('input[name="steam"]'), null);
    const moved = await post(`/wishlist/steam/${id}`, { title: 'Manual GOG', platform: 'gog', kind: 'dlc',
      url: '', store: 'GOG Store', addedAt: '', included: '', archived: 'on' });
    assert.equal(moved.status, 303);
    assert.equal(moved.headers.get('Location'), `/wishlist/gog/${id}?saved=1`);
    assert.equal(await kv.get(`wish:steam:${id}`, 'json'), null);
    const updated = await kv.get(`wish:gog:${id}`, 'json');
    assert.equal(updated.title, 'Manual GOG');
    assert.equal(updated.platform, 'gog');
    assert.equal(updated.kind, 'dlc');
    assert.equal(updated.store, 'GOG Store');
    assert.ok(updated.archivedAt);
    const archivedForm = parseHTML(await (await mf.dispatchFetch(`http://localhost/wishlist/gog/${id}`)).text()).document;
    assert.ok(archivedForm.querySelector(`form[action="/wishlist/gog/${id}/delete"]`));
    assert.equal(updated.firstSeen, manual.firstSeen);
    assert.equal(updated.lastSeen, manual.lastSeen);
    assert.equal(updated.included, undefined);
    const restored = await post(`/wishlist/gog/${id}`, { title: 'Manual GOG', platform: 'gog', kind: 'game', included: '' });
    assert.equal(restored.status, 303);
    assert.equal((await kv.get(`wish:gog:${id}`, 'json')).archivedAt, undefined);
    assert.equal((await kv.get(`wish:gog:${id}`, 'json')).store, 'GOG Store');
    assert.equal((await post(`/wishlist/gog/${id}`, { title: 'Manual GOG', platform: 'gog', kind: 'game', included: '', store: '' })).status, 303);
    assert.equal((await kv.get(`wish:gog:${id}`, 'json')).store, undefined);
    const manualList = parseHTML(await (await mf.dispatchFetch('http://localhost/games')).text()).document;
    const manualGame = [...manualList.querySelectorAll('form[action="/games/new"]')].find(el =>
      el.querySelector('input[name="title"]')?.getAttribute('value') === 'Manual GOG');
    assert.ok(manualGame);
    assert.equal(manualGame.querySelector('input[name="steam"]'), null);
    const deleted = await post(`/wishlist/gog/${id}/delete`, {});
    assert.equal(deleted.status, 303);
    assert.equal(deleted.headers.get('Location'), '/wishlist');
    assert.equal(await kv.get(`wish:gog:${id}`, 'json'), null);
    assert.equal((await mf.dispatchFetch(`http://localhost/wishlist/gog/${id}`)).status, 404);
    assert.equal((await post(`/wishlist/gog/${id}/delete`, {})).status, 404);
  } finally {
    await mf.dispose();
  }
});
