import { resolveTitle, type TitleIndex } from './games.ts';
import { normalizeTitle } from './model.ts';

/** Platforms with a wishlist source; add e.g. 'playstation' or 'gog' together with a fetcher for it. */
export const WISHLIST_PLATFORMS = ['steam'] as const;
export type WishlistPlatform = typeof WISHLIST_PLATFORMS[number];

export type WishlistItem = {
  platform: WishlistPlatform;
  /** Platform-specific product id (Steam app id). */
  id: string;
  /** Empty until the store lookup succeeds. */
  title: string;
  /** Store kind (e.g. "game", "dlc") when the platform reports it. */
  kind?: string;
  url?: string;
  /** When the platform says it was added to the wishlist (ISO date). */
  addedAt?: string;
  firstSeen: string;
  lastSeen: string;
  /** Set when the item disappeared from the platform wishlist; cleared if it reappears. */
  archivedAt?: string;
  /** Set when the store had no title for this item; it is retried after {@link TITLE_RETRY_DAYS}. */
  titleFailedAt?: string;
};

/** Stored as KV key metadata so the list view needs no value reads. */
export type WishlistMeta = { title: string; platform: WishlistPlatform; archived: boolean };

export type FetchedWishlistItem = { id: string; title?: string; kind?: string; url?: string; addedAt?: string };

export const wishlistKey = (platform: WishlistPlatform, id: string): string => `wish:${platform}:${id}`;

export const toWishlistMeta = (item: WishlistItem): WishlistMeta =>
  ({ title: item.title, platform: item.platform, archived: !!item.archivedAt });

/** Items whose title and kind make them a candidate for a game record. */
export const isWishlistGame = (item: WishlistItem): boolean => !!item.title && (!item.kind || item.kind === 'game');

export const TITLE_RETRY_DAYS = 7;

/** Active items still waiting for a title lookup (never looked up, or a failed lookup is old enough to retry). */
export const needsTitle = (item: WishlistItem, now = new Date().toISOString()): boolean =>
  !item.title && !item.archivedAt &&
  (!item.titleFailedAt || Date.parse(now) - Date.parse(item.titleFailedAt) > TITLE_RETRY_DAYS * 86_400_000);

export type WishlistChange = { item: WishlistItem; isNew: boolean };

/**
 * Merges a fresh platform wishlist into the stored items. Items missing from `fetched` are archived, never
 * removed; archived items that reappear are restored with their original `firstSeen`. Only changed items are returned.
 */
export const mergeWishlist = (
  platform: WishlistPlatform, existing: WishlistItem[], fetched: FetchedWishlistItem[], now: string,
): WishlistChange[] => {
  const stored = new Map(existing.filter(item => item.platform === platform).map(item => [item.id, item]));
  const seen = new Set<string>();
  const changes: WishlistChange[] = [];
  for (const entry of fetched) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    const previous = stored.get(entry.id);
    const rest: Partial<WishlistItem> = { ...previous };
    delete rest.archivedAt;
    changes.push({
      isNew: !previous,
      item: {
        ...rest,
        platform,
        id: entry.id,
        title: entry.title || previous?.title || '',
        ...((entry.kind ?? previous?.kind) ? { kind: entry.kind ?? previous?.kind } : {}),
        ...((entry.url ?? previous?.url) ? { url: entry.url ?? previous?.url } : {}),
        ...((entry.addedAt ?? previous?.addedAt) ? { addedAt: entry.addedAt ?? previous?.addedAt } : {}),
        firstSeen: previous?.firstSeen ?? now,
        lastSeen: now,
      },
    });
  }
  for (const previous of stored.values()) {
    if (!seen.has(previous.id) && !previous.archivedAt) changes.push({ isNew: false, item: { ...previous, archivedAt: now } });
  }
  return changes;
};

export type WishlistOwnership = { item: WishlistItem; ambiguous?: string[] };

/** Joins active wishlist items with the game database: wishlisted games by key, plus items that need a game or a link. */
export const joinWishlist = (index: TitleIndex, items: WishlistItem[]): {
  wished: Map<string, WishlistItem[]>;
  unresolved: WishlistOwnership[];
} => {
  const wished = new Map<string, WishlistItem[]>();
  const unresolved: WishlistOwnership[] = [];
  for (const item of items) {
    if (item.archivedAt || !isWishlistGame(item)) continue;
    const resolution = resolveTitle(index, item.title);
    if (resolution && 'key' in resolution) {
      wished.set(resolution.key, [...(wished.get(resolution.key) ?? []), item]);
    } else {
      unresolved.push({ item, ...(resolution ? { ambiguous: resolution.ambiguous } : {}) });
    }
  }
  // Same title wishlisted on several platforms is one entry to create.
  const seen = new Set<string>();
  return {
    wished,
    unresolved: unresolved.filter(({ item }) => {
      const title = normalizeTitle(item.title);
      if (seen.has(title)) return false;
      seen.add(title);
      return true;
    }),
  };
};
