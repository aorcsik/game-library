import type { TitleIndex } from '../games';
import { resolveTitle } from '../games';
import { isWishlistGame, needsTitle, type WishlistItem } from '../wishlist';
import type { SyncResult } from '../wishlistStore';
import { Layout } from './Layout';
import { PlatformIcon } from './PlatformIcon';

const day = (iso: string): string => iso.slice(0, 10);

export type WishlistSort = { by: 'title' | 'added'; dir: 'asc' | 'desc' };

export const parseWishlistSort = (by?: string, dir?: string): WishlistSort =>
  by === 'added' ? { by, dir: dir === 'desc' ? 'desc' : 'asc' } : { by: 'title', dir: dir === 'desc' ? 'desc' : 'asc' };

const addedDate = (item: WishlistItem): string => item.addedAt ?? day(item.firstSeen);

const sortItems = (items: WishlistItem[], { by, dir }: WishlistSort): WishlistItem[] => {
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => sign * (by === 'added'
    ? addedDate(a).localeCompare(addedDate(b)) || a.title.localeCompare(b.title)
    : a.title.localeCompare(b.title)));
};

const SortHeader = ({ by, label, sort }: { by: WishlistSort['by']; label: string; sort: WishlistSort }) => {
  const active = sort.by === by;
  const next = active && sort.dir === 'asc' ? 'desc' : 'asc';
  return (
    <th aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <a class="sort-link" href={`/wishlist?sort=${by}&dir=${next}`}>{label}{active && <span aria-hidden="true"> {sort.dir === 'asc' ? '↑' : '↓'}</span>}</a>
    </th>
  );
};

const GameCell = ({ item, index }: { item: WishlistItem; index: TitleIndex }) => {
  const resolution = item.title ? resolveTitle(index, item.title) : null;
  if (resolution && 'key' in resolution) return <a href={`/games/${resolution.key}`}>{item.title}</a>;
  return <>{item.title || <span class="meta">(title pending)</span>}</>;
};

export const WishlistPage = ({ items, index, canSync, result, error, sort = { by: 'title', dir: 'asc' } }: {
  items: WishlistItem[]; index: TitleIndex; canSync: boolean; result?: SyncResult; error?: string; sort?: WishlistSort;
}) => {
  const sorted = sortItems(items, sort);
  const active = sorted.filter(item => !item.archivedAt);
  const archived = sorted.filter(item => item.archivedAt);
  const pending = active.filter(item => needsTitle(item)).length;
  return (
    <Layout title="Wishlist">
      <h1>Wishlist <small>{active.length} active, {archived.length} archived</small></h1>
      {error && <p class="errors">{error}</p>}
      {result && <p class="meta">Synced: {result.added} added, {result.restored} restored, {result.archived} archived.</p>}
      {pending > 0 && <p class="meta" data-wishlist-pending={pending}>Fetching {pending} titles…</p>}
      <form method="post" action="/wishlist/sync" class="actions">
        <button type="submit" disabled={!canSync} title={canSync ? undefined : 'Set STEAM_API_KEY and STEAM_ID'}>Sync Steam wishlist</button>
      </form>
      <WishlistTable items={active} index={index} sort={sort} />
      {archived.length > 0 && (
        <details class="group">
          <summary>Archived ({archived.length})</summary>
          <WishlistTable items={archived} index={index} sort={sort} />
        </details>
      )}
    </Layout>
  );
};

const WishlistTable = ({ items, index, sort }: { items: WishlistItem[]; index: TitleIndex; sort: WishlistSort }) => (
  <table class="list">
    <thead><tr><SortHeader by="title" label="Title" sort={sort} /><th>Platform</th><SortHeader by="added" label="Added" sort={sort} /><th>Last seen</th><th>Archived</th></tr></thead>
    <tbody>
      {items.map(item => (
        <tr>
          <td>
            <GameCell item={item} index={index} />
            {item.url && <> <a href={item.url} rel="noopener noreferrer" target="_blank">store</a></>}
            {item.title && !isWishlistGame(item) ? <> <span class="meta">({item.kind})</span></> : null}
          </td>
          <td><PlatformIcon label={item.platform} withLabel /></td>
          <td class="date">{addedDate(item)}</td>
          <td class="date">{day(item.lastSeen)}</td>
          <td class="date">{item.archivedAt ? day(item.archivedAt) : ''}</td>
        </tr>
      ))}
    </tbody>
  </table>
);
