import { isSteamSynced, mergeWishlist, needsTitle, toWishlistMeta, wishlistKey, type FetchedWishlistItem, type WishlistItem, type WishlistMeta } from './wishlist';

const BULK_GET_LIMIT = 100;

export const getAllWishlistItems = async (kv: KVNamespace): Promise<WishlistItem[]> => {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list<WishlistMeta>({ prefix: 'wish:', cursor });
    names.push(...page.keys.map(k => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const items: WishlistItem[] = [];
  for (let i = 0; i < names.length; i += BULK_GET_LIMIT) {
    const values = await kv.get<WishlistItem>(names.slice(i, i + BULK_GET_LIMIT), 'json');
    for (const value of values.values()) if (value) items.push(value);
  }
  return items;
};

export const saveWishlistItem = (kv: KVNamespace, item: WishlistItem): Promise<void> =>
  kv.put(wishlistKey(item.platform, item.id), JSON.stringify(item), { metadata: toWishlistMeta(item) });

export const getWishlistItem = (kv: KVNamespace, platform: WishlistItem['platform'], id: string): Promise<WishlistItem | null> =>
  kv.get<WishlistItem>(wishlistKey(platform, id), 'json');

export const deleteWishlistItem = (kv: KVNamespace, platform: WishlistItem['platform'], id: string): Promise<void> =>
  kv.delete(wishlistKey(platform, id));

const STEAM_API = 'https://api.steampowered.com';
const STEAM_STORE = 'https://store.steampowered.com';

/** Raw Steam wishlist entries (app ids only); titles come from {@link fetchSteamAppInfo}. */
export const fetchSteamWishlist = async (apiKey: string, steamId: string): Promise<FetchedWishlistItem[]> => {
  const url = `${STEAM_API}/IWishlistService/GetWishlist/v1/?${new URLSearchParams({ key: apiKey, steamid: steamId })}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Steam wishlist request failed (${response.status}).`);
  const body = await response.json() as { response?: { items?: { appid: number; date_added?: number }[] } };
  return (body.response?.items ?? []).map(({ appid, date_added }) => ({
    id: String(appid),
    url: `${STEAM_STORE}/app/${appid}`,
    ...(date_added ? { addedAt: new Date(date_added * 1000).toISOString().slice(0, 10) } : {}),
  }));
};

export const fetchSteamAppInfo = async (appId: string): Promise<{ title: string; kind: string } | null> => {
  const response = await fetch(`${STEAM_STORE}/api/appdetails?${new URLSearchParams({ appids: appId, filters: 'basic' })}`);
  if (!response.ok) throw new Error(`Steam store request failed (${response.status}).`);
  const body = await response.json() as Record<string, { success?: boolean; data?: { name?: string; type?: string } } | undefined>;
  const data = body[appId]?.success ? body[appId]?.data : undefined;
  return data?.name ? { title: data.name, kind: data.type ?? 'game' } : null;
};

export type SyncResult = { added: number; restored: number; archived: number; pending: number };

/** Stores the platform's wishlist ids; titles are filled in afterwards by {@link resolveSteamTitles}. */
export const syncSteamWishlist = async (
  kv: KVNamespace, apiKey: string, steamId: string, now = new Date().toISOString(),
): Promise<SyncResult> => {
  const [fetched, existing] = await Promise.all([fetchSteamWishlist(apiKey, steamId), getAllWishlistItems(kv)]);
  const stored = new Map(existing.filter(isSteamSynced).map(item => [item.id, item]));
  const changes = mergeWishlist('steam', existing, fetched, now);
  for (const { item } of changes) await saveWishlistItem(kv, item);
  const merged = new Map([...existing, ...changes.map(c => c.item)].map(item => [`${item.platform}:${item.id}`, item]));
  return {
    added: changes.filter(c => c.isNew).length,
    restored: changes.filter(c => !c.isNew && !c.item.archivedAt && stored.get(c.item.id)?.archivedAt).length,
    archived: changes.filter(c => c.item.archivedAt && !stored.get(c.item.id)?.archivedAt).length,
    pending: [...merged.values()].filter(item => needsTitle(item, now)).length,
  };
};

/**
 * Looks up titles for up to `limit` pending Steam items (sequentially, to stay clear of store rate limits).
 * A transport error stops the batch without marking anything failed, so it is retried on the next call.
 */
export const resolveSteamTitles = async (
  kv: KVNamespace, limit = 10, now = new Date().toISOString(),
): Promise<{ resolved: number; pending: number; error?: string }> => {
  const items = (await getAllWishlistItems(kv)).filter(isSteamSynced);
  const pending = items.filter(item => needsTitle(item, now));
  let resolved = 0;
  let attempted = 0;
  let error: string | undefined;
  for (const item of pending.slice(0, limit)) {
    try {
      const info = await fetchSteamAppInfo(item.id);
      attempted++;
      if (info) {
        const updated: WishlistItem = { ...item, title: info.title, kind: info.kind };
        delete updated.titleFailedAt;
        await saveWishlistItem(kv, updated);
        resolved++;
      } else {
        await saveWishlistItem(kv, { ...item, titleFailedAt: now });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      break;
    }
  }
  return { resolved, pending: pending.length - attempted, ...(error ? { error } : {}) };
};
