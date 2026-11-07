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
