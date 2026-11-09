import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIndex } from '../src/games.ts';
import { joinWishlist, mergeWishlist } from '../src/wishlist.ts';

const t1 = '2026-01-01T00:00:00.000Z';
const t2 = '2026-02-01T00:00:00.000Z';
const t3 = '2026-03-01T00:00:00.000Z';
const apply = (items, changes) => {
  const byId = new Map(items.map(i => [i.id, i]));
  for (const { item } of changes) byId.set(item.id, item);
  return [...byId.values()];
};

test('wishlist keeps first/last seen, archives missing items and restores returning ones', () => {
  let items = apply([], mergeWishlist('steam', [], [{ id: '1', title: 'A' }, { id: '2', title: 'B' }], t1));
  assert.deepEqual(items.map(i => [i.id, i.firstSeen, i.lastSeen, i.archivedAt]), [['1', t1, t1, undefined], ['2', t1, t1, undefined]]);

  const changes = mergeWishlist('steam', items, [{ id: '1' }], t2);
  items = apply(items, changes);
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  assert.equal(byId['1'].title, 'A');
  assert.equal(byId['1'].lastSeen, t2);
  assert.equal(byId['2'].archivedAt, t2);
  assert.equal(byId['2'].lastSeen, t1);

  assert.deepEqual(mergeWishlist('steam', items, [{ id: '1' }], t3).map(c => c.item.id), ['1']);

  const restored = mergeWishlist('steam', items, [{ id: '1' }, { id: '2' }], t3).find(c => c.item.id === '2').item;
  assert.equal(restored.archivedAt, undefined);
  assert.equal(restored.firstSeen, t1);
  assert.equal(restored.lastSeen, t3);
});

test('other platforms are not archived by a Steam sync', () => {
  const gog = { platform: 'gog', id: 'x', title: 'G', firstSeen: t1, lastSeen: t1 };
  assert.deepEqual(mergeWishlist('steam', [gog], [], t2), []);
});

test('unmatched wishlist items need a game; matched, archived and non-game items do not', () => {
  const index = buildIndex([{ key: 'known', title: 'Known', updatedAt: t1 }]);
  const base = { platform: 'steam', firstSeen: t1, lastSeen: t1 };
  const { wished, unresolved } = joinWishlist(index, [
    { ...base, id: '1', title: 'Known' },
    { ...base, id: '2', title: 'New Game' },
    { ...base, id: '3', title: 'Old', archivedAt: t2 },
    { ...base, id: '4', title: 'Some DLC', kind: 'dlc' },
    { ...base, id: '5', title: '' },
  ]);
  assert.deepEqual([...wished.keys()], ['known']);
  assert.deepEqual(unresolved.map(u => u.item.title), ['New Game']);
});

test('titles are pending until looked up; failed lookups are retried only after a week', async () => {
  const { needsTitle } = await import('../src/wishlist.ts');
  const base = { platform: 'steam', id: '1', title: '', firstSeen: t1, lastSeen: t1 };
  assert.equal(needsTitle(base, t2), true);
  assert.equal(needsTitle({ ...base, title: 'A' }, t2), false);
  assert.equal(needsTitle({ ...base, archivedAt: t2 }, t3), false);
  assert.equal(needsTitle({ ...base, titleFailedAt: t2 }, '2026-02-03T00:00:00.000Z'), false);
  assert.equal(needsTitle({ ...base, titleFailedAt: t2 }, '2026-02-09T00:00:00.000Z'), true);
});

test('bundle contents match individual games and survive sync, archival and restoration', () => {
  const index = buildIndex([
    { key: 'incoming', title: 'Incoming', updatedAt: t1 },
    { key: 'bundle', title: 'Incoming + Incoming Forces', updatedAt: t1 },
  ]);
  const bundle = {
    platform: 'steam', id: '42', title: 'Incoming + Incoming Forces', kind: 'bundle',
    included: ['Incoming', 'Incoming Forces', 'INCOMING'], firstSeen: t1, lastSeen: t1,
  };
  const synced = mergeWishlist('steam', [bundle], [{ id: '42' }], t2)[0].item;
  assert.deepEqual(synced.included, bundle.included);
  const { wished, unresolved } = joinWishlist(index, [synced]);
  assert.deepEqual([...wished.keys()], ['incoming']);
  assert.deepEqual(wished.get('incoming'), [synced]);
  assert.deepEqual(unresolved.map(entry => entry.title), ['Incoming Forces']);
  const archived = mergeWishlist('steam', [synced], [], t3)[0].item;
  assert.deepEqual(archived.included, bundle.included);
  assert.equal(joinWishlist(index, [archived]).wished.size, 0);
  const restored = mergeWishlist('steam', [archived], [{ id: '42' }], t3)[0].item;
  assert.deepEqual(restored.included, bundle.included);
});

test('Steam sync and title lookup ignore manually created Steam entries', async () => {
  const { needsTitle } = await import('../src/wishlist.ts');
  const manual = { platform: 'steam', id: 'manual-123', source: 'manual', title: '', firstSeen: t1, lastSeen: t1, included: ['Game'] };
  assert.equal(needsTitle(manual, t2), false);
  assert.deepEqual(mergeWishlist('steam', [manual], [], t2), []);
  const synced = mergeWishlist('steam', [manual], [{ id: '42', title: 'Game' }], t2);
  assert.equal(synced.length, 1);
  assert.equal(synced[0].isNew, true);
  assert.equal(synced[0].item.id, '42');
  assert.equal(synced[0].item.store, 'Steam Store');
  assert.equal(mergeWishlist('steam', [{ ...synced[0].item, store: '' }], [{ id: '42' }], t3)[0].item.store, '');
});
