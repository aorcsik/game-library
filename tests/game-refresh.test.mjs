import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimGameRefresh, runClaimedGameRefresh } from '../src/fetcher/gameRefresh.ts';
import { needsGameRefresh } from '../src/fetcher/refresh.ts';
import { applyGameForm } from '../src/gameForm.ts';
import { gameKey } from '../src/games.ts';

const key = 'sample';
const now = Date.now();
const game = {
  key, title: 'Sample', updatedAt: new Date(now - 2 * 86400000).toISOString(),
  opencritic: {
    id: '1/sample', fetchedAt: new Date(now - 86400001).toISOString(),
    data: { title: 'Sample', score: 70 },
  },
};

const fakeKv = initial => {
  const records = new Map([[gameKey(key), JSON.stringify(initial)]]);
  return {
    records,
    get: async (name, type) => {
      const value = records.get(name) ?? null;
      return type === 'json' && value ? JSON.parse(value) : value;
    },
    put: async (name, value) => { records.set(name, value); },
  };
};

test('only game sources older than a day trigger an automatic refresh', () => {
  assert.equal(needsGameRefresh(game, now), true);
  assert.equal(needsGameRefresh({ ...game, opencritic: { ...game.opencritic, fetchedAt: new Date(now - 86400000).toISOString() } }, now), false);
  assert.equal(needsGameRefresh({ ...game, opencritic: { id: null } }, now), false);
  assert.equal(needsGameRefresh({ ...game, opencritic: undefined }, now), false);
  assert.equal(needsGameRefresh({ ...game, opencritic: { id: '1/sample' } }, now), true);
  assert.equal(needsGameRefresh({ ...game, opencritic: { id: '1/sample', fetchedAt: 'invalid' } }, now), true);
});

test('stores a lock, skips overlapping claims, and merges refreshed ratings with intervening edits', async () => {
  const kv = fakeKv(game);
  const originalFetch = globalThis.fetch;
  let started;
  const fetching = new Promise(resolve => { started = resolve; });
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  try {
    globalThis.fetch = async () => {
      started();
      await pending;
      return new Response('<app-game-overview><h1>Sample</h1></app-game-overview>', { status: 200 });
    };
    const locked = await claimGameRefresh(kv, key, true, now);
    assert.ok(locked.refreshLock?.token);
    assert.equal((await kv.get(gameKey(key), 'json')).refreshLock.token, locked.refreshLock.token);
    assert.equal(await claimGameRefresh(kv, key, true, now), null);
    assert.equal(await claimGameRefresh(kv, key), null);
    const resultPromise = runClaimedGameRefresh(kv, locked, { maxAgeDays: 1 });
    await fetching;

    const form = new FormData();
    form.set('title', 'Renamed while refreshing');
    form.set('opencritic', game.opencritic.id);
    const edited = applyGameForm(form, locked).game;
    assert.equal(edited.refreshLock.token, locked.refreshLock.token);
    await kv.put(gameKey(key), JSON.stringify(edited));
    assert.equal(await claimGameRefresh(kv, key, true, now), null);

    release();
    const result = await resultPromise;
    const saved = await kv.get(gameKey(key), 'json');
    assert.equal(saved.title, 'Renamed while refreshing');
    assert.equal(saved.refreshLock, undefined);
    assert.ok(saved.opencritic.fetchedAt > game.opencritic.fetchedAt);
    assert.equal(result.changed, true);
    assert.deepEqual(await kv.get('sync:dirty', 'json'), [key]);
    assert.equal(await kv.get('index:titles', 'json'), null);
    assert.equal(await claimGameRefresh(kv, key, true, Date.now()), null);
  } finally {
    release?.();
    globalThis.fetch = originalFetch;
  }
});

test('manual refresh remains available for fresh games, but shares the same lock', async () => {
  const fresh = { ...game, opencritic: { ...game.opencritic, fetchedAt: new Date(now).toISOString() } };
  const kv = fakeKv(fresh);
  assert.equal(await claimGameRefresh(kv, key, true, now), null);
  const locked = await claimGameRefresh(kv, key, false, now);
  assert.ok(locked.refreshLock);
  assert.equal(await claimGameRefresh(kv, key), null);
  const result = await runClaimedGameRefresh(kv, locked, { maxAgeDays: 1 });
  assert.equal(result.sources.opencritic.status, 'fresh');
  assert.equal((await kv.get(gameKey(key), 'json')).refreshLock, undefined);
  assert.equal(await kv.get('sync:dirty', 'json'), null);
});

test('a source ID edited during a refresh is not overwritten by its old fetch result', async () => {
  const kv = fakeKv(game);
  const originalFetch = globalThis.fetch;
  let started;
  const fetching = new Promise(resolve => { started = resolve; });
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  try {
    globalThis.fetch = async () => {
      started();
      await pending;
      return new Response('<app-game-overview><h1>Sample</h1></app-game-overview>', { status: 200 });
    };
    const locked = await claimGameRefresh(kv, key, true, now);
    const resultPromise = runClaimedGameRefresh(kv, locked, { maxAgeDays: 1 });
    await fetching;
    const form = new FormData();
    form.set('title', game.title);
    form.set('opencritic', 'none');
    await kv.put(gameKey(key), JSON.stringify(applyGameForm(form, locked).game));
    release();
    const result = await resultPromise;
    const saved = await kv.get(gameKey(key), 'json');
    assert.equal(saved.opencritic.id, null);
    assert.equal(saved.refreshLock, undefined);
    assert.equal(result.sources.opencritic.status, 'error');
    assert.equal(result.changed, false);
  } finally {
    release?.();
    globalThis.fetch = originalFetch;
  }
});

test('an interrupted lock expires and can be replaced without dirtying a game', async () => {
  const kv = fakeKv({ ...game, refreshLock: { token: 'old', startedAt: new Date(now - 3 * 60000).toISOString() } });
  const locked = await claimGameRefresh(kv, key, true, now);
  assert.notEqual(locked.refreshLock.token, 'old');
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('network unavailable'); };
    const result = await runClaimedGameRefresh(kv, locked, { maxAgeDays: 1 });
    assert.equal(result.sources.opencritic.status, 'error');
    assert.equal((await kv.get(gameKey(key), 'json')).refreshLock, undefined);
    assert.equal(await kv.get('sync:dirty', 'json'), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
