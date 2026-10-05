// Shared by the worker and the Node migration script: keep it dependency-free and erasable-syntax only.

export const PLATFORMS = [
  'steam', 'epic', 'gog', 'amazon', 'origin', 'ea', 'playstation', 'xbox', 'switch', 'appstore',
  'windows', 'pearlabyss', 'legacy', 'drm-free', 'other',
] as const;
export type Platform = typeof PLATFORMS[number];

export const KINDS = ['game', 'dlc', 'soundtrack', 'media', 'demo', 'app'] as const;
export type Kind = typeof KINDS[number];

export const SERVICES = ['ps-plus', 'ea-play', 'netflix', 'apple-arcade'] as const;
export type Service = typeof SERVICES[number];

export const SYSTEMS = ['PS3', 'PS4', 'PS5', 'mobile'] as const;
export type System = typeof SYSTEMS[number];

export const CURRENCIES = ['EUR', 'HUF', 'USD', 'GBP'] as const;
export type Currency = typeof CURRENCIES[number];

/** amount 0 without currency means free. */
export type Price = { amount: number; currency?: Currency };

/** Every item is self-contained: nothing is inherited from the transaction. */
export type Item = {
  title: string;
  platform: Platform;
  /** Defaults to 'game'. */
  kind?: Kind;
  service?: Service;
  systems?: System[];
  price?: Price;
  cover?: string;
  physical?: boolean;
  /** Key received in a bundle but never redeemed. */
  unclaimed?: boolean;
  hidden?: boolean;
  /** Other titles for the same thing, e.g. how a platform store lists it. */
  aliases?: string[];
  /** Explicit game key, only needed when the title is ambiguous in the game database. */
  game?: string;
  /** Collections / packs: the individual games this item unlocks. */
  contents?: string[];
};

/** A single purchase has one item; bundles, subscriptions and giveaways have many. */
export type Transaction = {
  id: string;
  date: string;
  title: string;
  store: string;
  /** Missing when unknown. */
  price?: Price;
  /** Set when the date was estimated: the purchase happened somewhere in this range. */
  dateRange?: [string, string];
  /** Where an imported record came from, e.g. "playstation.json". */
  source?: string;
  notes?: string;
  hidden?: boolean;
  items: Item[];
  legacy?: { file: string; index: number; platform: string; store: string; price?: string };
  updatedAt: string;
};

/** Stored as KV key metadata so the list view needs no value reads (must stay < 1024 bytes). */
export type TransactionMeta = {
  title: string;
  store: string;
  /** Platform label (see platformLabel); missing when items span multiple labels. */
  platform?: string;
  price: string;
  items: number;
  hidden?: boolean;
};

export type LibraryEntry = {
  title: string;
  cover?: string;
  physical?: boolean;
  system?: System;
  service?: Service;
  productId?: string;
};

/** Snapshot of a platform's owned-games page (legacy playstation.json, switch.json, xbox.json). */
export type Library = {
  platform: Platform;
  importedAt: string;
  entries: LibraryEntry[];
  collections: Record<string, string[]>;
};

export const txKey = (date: string, id: string): string => `tx:${date}:${id}`;
export const libraryKey = (platform: Platform): string => `library:${platform}`;

export const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

export const formatPrice = (price?: Price): string => {
  if (!price) return '';
  if (price.amount === 0) return 'FREE';
  const digits = price.currency === 'HUF' && Number.isInteger(price.amount) ? 0 : 2;
  return `${price.amount.toFixed(digits)} ${price.currency ?? ''}`.trim();
};

export const parsePrice = (value: string): Price | null => {
  const text = value.trim();
  if (text === '' || text.toUpperCase() === 'FREE') return { amount: 0 };
  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*(EUR|HUF|USD|GBP|€|\$|£)$/i);
  if (!match) return null;
  const symbols: Record<string, Currency> = { '€': 'EUR', '$': 'USD', '£': 'GBP' };
  const currency = (symbols[match[2]] ?? match[2].toUpperCase()) as Currency;
  const amount = parseFloat(match[1].replace(',', '.'));
  return amount === 0 ? { amount: 0 } : { amount, currency };
};

// Symbols must go before NFKD, which would expand ™ into "TM".
export const normalizeTitle = (title: string): string =>
  title.replace(/[™®©]/g, ' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export const commonPlatform = (items: Item[]): Platform | undefined => {
  const platforms = new Set(items.map(i => i.platform));
  return platforms.size === 1 ? items[0].platform : undefined;
};

/** Display label: the platform, refined by how it was obtained (e.g. epic-mobile, playstation-plus, netflix). */
export const platformLabel = (item: Pick<Item, 'platform' | 'service' | 'systems'>): string => {
  if (item.service === 'netflix' || item.service === 'apple-arcade') return item.service;
  // PS3 titles only run on a PS3, so they stay apart from PS4/PS5 (even when claimed via PS Plus).
  if (item.platform === 'playstation' && item.systems?.includes('PS3')) return item.service === 'ps-plus' ? 'playstation-plus-ps3' : 'playstation-ps3';
  if (item.platform === 'playstation' && item.service === 'ps-plus') return 'playstation-plus';
  if (item.platform === 'epic' && item.systems?.includes('mobile')) return 'epic-mobile';
  return item.platform;
};

export const PLATFORM_GROUPS: Record<string, string[]> = {
  PC: ['steam', 'gog', 'epic', 'amazon', 'windows', 'ea', 'origin', 'drm-free', 'legacy', 'pearlabyss'],
  PlayStation: ['playstation', 'playstation-plus', 'playstation-ps3', 'playstation-plus-ps3'],
  Nintendo: ['switch'],
  Xbox: ['xbox'],
  Mobile: ['appstore', 'apple-arcade', 'netflix', 'epic-mobile'],
  Other: ['other'],
};

export const platformGroup = (label: string): string =>
  Object.entries(PLATFORM_GROUPS).find(([, labels]) => labels.includes(label))?.[0] ?? 'Other';

/** Labels only playable while the subscription is active. */
export const SUBSCRIPTION_LABELS = ['playstation-plus', 'playstation-plus-ps3', 'netflix', 'apple-arcade'];

export const SUBSCRIPTION_SERVICES: readonly Service[] = ['ps-plus', 'netflix', 'apple-arcade'];

/** Labels for hardware you can no longer play them on (shown dimmed). */
export const LEGACY_SYSTEM_LABELS = ['playstation-ps3', 'playstation-plus-ps3'];

const commonLabel = (items: Item[]): string | undefined => {
  const labels = new Set(items.map(platformLabel));
  return labels.size === 1 ? [...labels][0] : undefined;
};

/** `platform:normalized title` keys for everything a transaction covers. */
export const ownedKeys = (tx: Transaction): string[] => [
  ...(tx.items.length > 1 && commonPlatform(tx.items) ? [`${commonPlatform(tx.items)}:${normalizeTitle(tx.title)}`] : []),
  ...tx.items.flatMap(item =>
    [item.title, ...(item.aliases ?? []), ...(item.contents ?? [])].map(title => `${item.platform}:${normalizeTitle(title)}`)),
];

export const toMeta = (tx: Transaction): TransactionMeta => ({
  title: tx.title.slice(0, 300),
  store: tx.store.slice(0, 100),
  platform: commonLabel(tx.items),
  price: formatPrice(tx.price),
  items: tx.items.length,
  ...(tx.hidden ? { hidden: true } : {}),
});
