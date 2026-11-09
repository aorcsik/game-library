import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundled = await build({
  entryPoints: ['src/wishlistStore.ts'], bundle: true, write: false, format: 'esm', platform: 'node',
});
const { syncSteamWishlist, resolveSteamTitles } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

test('Steam sync and title resolution preserve manual entries and synced bundle edits', async () => {
  const manual = { platform: 'steam', id: 'manual-123', source: 'manual', title: 'Manual', included: ['Manual game'],
    firstSeen: '2026-01-01', lastSeen: '2026-01-01' };
  const synced = { platform: 'steam', id: '42', title: 'Bundle', store: 'Fanatical', included: ['Game A', 'Game B'],
    firstSeen: '2026-01-01', lastSeen: '2026-01-01' };
  const pending = { platform: 'steam', id: '43', title: '', included: ['Game C'],
    firstSeen: '2026-01-01', lastSeen: '2026-01-01' };
  const records = new Map([
    ['wish:steam:manual-123', JSON.stringify(manual)],
    ['wish:steam:42', JSON.stringify(synced)],
    ['wish:steam:43', JSON.stringify(pending)],
  ]);
  const kv = {
    async list() { return { keys: [...records.keys()].map(name => ({ name })), list_complete: true }; },
    async get(keys) { return new Map(keys.map(key => [key, records.has(key) ? JSON.parse(records.get(key)) : null])); },
    async put(key, value) { records.set(key, value); },
  };
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    if (String(url).includes('GetWishlist')) {
      return Response.json({ response: { items: [{ appid: 42 }, { appid: 43 }] } });
    }
    return Response.json({ 43: { success: true, data: { name: 'Resolved bundle', type: 'game' } } });
  };
  try {
    const result = await syncSteamWishlist(kv, 'key', 'id', '2026-02-01T00:00:00.000Z');
    assert.deepEqual(result, { added: 0, restored: 0, archived: 0, pending: 1 });
    assert.deepEqual(JSON.parse(records.get('wish:steam:manual-123')), manual);
    assert.deepEqual(JSON.parse(records.get('wish:steam:42')).included, synced.included);
    assert.equal(JSON.parse(records.get('wish:steam:42')).store, 'Fanatical');
    assert.equal(JSON.parse(records.get('wish:steam:43')).store, 'Steam Store');
    assert.deepEqual(await resolveSteamTitles(kv, 10, '2026-02-01T00:00:00.000Z'), { resolved: 1, pending: 0 });
    const resolved = JSON.parse(records.get('wish:steam:43'));
    assert.equal(resolved.title, 'Resolved bundle');
    assert.deepEqual(resolved.included, pending.included);
    assert.equal(resolved.store, 'Steam Store');
    assert.equal(calls.length, 2);
    assert.match(calls[1], /appids=43/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
