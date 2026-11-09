import { isOneOf, KINDS, PLATFORMS } from './model';
import { isSteamSynced, wishlistStoreName, type WishlistItem } from './wishlist';

export type WishlistDraft = {
  title: string;
  platform: string;
  kind: string;
  url: string;
  store: string;
  addedAt: string;
  included: string;
  archived: boolean;
};

export const wishlistDraft = (item?: WishlistItem): WishlistDraft => ({
  title: item?.title ?? '',
  platform: item?.platform ?? '',
  kind: item?.kind ?? 'game',
  url: item?.url ?? '',
  store: item ? wishlistStoreName(item) : '',
  addedAt: item?.addedAt ?? '',
  included: (item?.included ?? []).join('\n'),
  archived: !!item?.archivedAt,
});

export const readWishlistDraft = (form: FormData, item?: WishlistItem): WishlistDraft => {
  const text = (name: string): string => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  if (item && isSteamSynced(item)) return { ...wishlistDraft(item), store: form.has('store') ? text('store') : wishlistStoreName(item), included: text('included') };
  return {
    title: text('title'), platform: text('platform'), kind: text('kind'), url: text('url'),
    store: form.has('store') ? text('store') : item?.store ?? '',
    addedAt: text('addedAt'), included: text('included'), archived: form.has('archived'),
  };
};

export const validateWishlistDraft = (
  draft: WishlistDraft, item?: WishlistItem, now = new Date().toISOString(),
): { item?: WishlistItem; errors: string[] } => {
  const errors: string[] = [];
  const included = draft.included.split('\n').map(title => title.trim()).filter(Boolean);
  if (included.some(title => title.length > 300)) errors.push('Included game titles must be at most 300 characters.');
  if (draft.store.length > 100) errors.push('Store is too long (max 100 characters).');
  if (item && isSteamSynced(item)) {
    if (errors.length) return { errors };
    const updated = { ...item };
    if (included.length) updated.included = included;
    else delete updated.included;
    updated.store = draft.store;
    return { item: updated, errors };
  }
  if (!draft.title || draft.title.length > 300) errors.push('Title is required (max 300 characters).');
  if (!isOneOf(PLATFORMS, draft.platform)) errors.push('Platform is required.');
  if (!isOneOf(KINDS, draft.kind)) errors.push('Choose a valid kind.');
  if (draft.url) {
    try {
      if (!['http:', 'https:'].includes(new URL(draft.url).protocol)) errors.push('Store URL must be an http(s) URL.');
    } catch {
      errors.push('Store URL must be an http(s) URL.');
    }
  }
  if (draft.addedAt) {
    const date = new Date(`${draft.addedAt}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.addedAt) || isNaN(date.getTime()) || !date.toISOString().startsWith(draft.addedAt)) {
      errors.push('Added date must be a valid YYYY-MM-DD date.');
    }
  }
  if (errors.length || !isOneOf(PLATFORMS, draft.platform)) return { errors };
  const updated: WishlistItem = {
    ...item, source: 'manual', id: item?.id ?? `manual-${crypto.randomUUID()}`, platform: draft.platform,
    title: draft.title, firstSeen: item?.firstSeen ?? now, lastSeen: item?.lastSeen ?? now,
  };
  if (draft.kind !== 'game') updated.kind = draft.kind;
  else delete updated.kind;
  if (draft.url) updated.url = draft.url;
  else delete updated.url;
  if (draft.store) updated.store = draft.store;
  else delete updated.store;
  if (draft.addedAt) updated.addedAt = draft.addedAt;
  else delete updated.addedAt;
  if (included.length) updated.included = included;
  else delete updated.included;
  if (draft.archived) updated.archivedAt = item?.archivedAt ?? now;
  else delete updated.archivedAt;
  return { item: updated, errors };
};
