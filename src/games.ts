// Game database (GAMEDB namespace): fetched review/store data per game, joined with transactions by title.
import { normalizeTitle, type Item, type Transaction } from './model.ts';

export type OpenCriticData = {
  title: string | null;
  cover: string | null;
  tier: string | null;
  score: number | null;
  critics: number | null;
  releaseDate: string | null;
  platforms?: string[];
  creators?: string[];
  description?: string | null;
};

export type SteamData = {
  title: string | null;
  description: string | null;
  genres: string[];
  releaseDate: string | null;
  reviewScore: number | null;
  reviewScoreDescription: string | null;
  reviewScoreTooltip: string | null;
  headerImage: string | null;
  developers?: string[];
  publishers?: string[];
};

export type MetacriticData = {
  title: string | null;
  releaseDate: string | null;
  summary?: string | null;
  /** null: no score yet (legacy -1 "tbd"). */
  metacriticScore: number | null;
  mustPlay: boolean;
  genres: string[];
  platforms: string[];
  publisher: string | null;
  developers: string[];
};

/** `id: null` means checked and not available on that source; a missing source means not checked yet. */
export type SourceRef<Id, Data> = { id: Id | null; data?: Data; fetchedAt?: string };

export type Game = {
  key: string;
  title: string;
  /** Other titles transactions or stores use for this game. */
  aliases?: string[];
  /** Manual release date, used when no source provides one. */
  releaseDate?: string;
  opencritic?: SourceRef<string, OpenCriticData>;
  steam?: SourceRef<number, SteamData>;
  metacritic?: SourceRef<string, MetacriticData>;
  updatedAt: string;
};

/** KV key metadata for the list view (must stay < 1024 bytes). */
export type GameMeta = {
  title: string;
  release?: string;
  oc?: number;
  tier?: string;
  mc?: number;
  mustPlay?: boolean;
  steam?: number;
  genres?: string[];
  cover?: string;
  /** Source ids, for linking to the external pages. */
  ocId?: string;
  mcUrl?: string;
  steamId?: number;
  /** Oldest fetch among sources with an id; '' if one of them was never fetched. */
  fetched?: string;
  /** Sources not checked yet (no id and not marked unavailable). */
  todo?: SourceName[];
};

export const SOURCES = ['opencritic', 'steam', 'metacritic'] as const;
export type SourceName = typeof SOURCES[number];

export const gameKey = (key: string): string => `game:${key}`;

export const opencriticUrl = (id: string): string => `https://opencritic.com/game/${id}`;
export const steamUrl = (appId: number): string => `https://store.steampowered.com/app/${appId}`;
export const TITLE_INDEX_KEY = 'index:titles';

export const OPENCRITIC_TIERS = ['mighty', 'strong', 'fair', 'weak', 'n/a'] as const;
export const METACRITIC_BUCKETS = ['90+', '75-89', '50-74', '<50', 'tbd', 'n/a'] as const;
/** Steam's review summaries, indexed by our 1-9 review score. */
export const STEAM_REVIEWS = [
  'Overwhelmingly Positive', 'Very Positive', 'Positive', 'Mostly Positive', 'Mixed',
  'Mostly Negative', 'Negative', 'Very Negative', 'Overwhelmingly Negative', 'n/a',
] as const;

export const opencriticTier = (meta: GameMeta): string => meta.tier ?? 'n/a';

export const metacriticBucket = (meta: GameMeta): string =>
  !meta.mcUrl ? 'n/a' : meta.mc === undefined ? 'tbd' : meta.mc >= 90 ? '90+' : meta.mc >= 75 ? '75-89' : meta.mc >= 50 ? '50-74' : '<50';

export const metacriticBucketColor = (meta: GameMeta): string => {
  const bucket = metacriticBucket(meta);
  if (bucket === '90+' ||bucket === '75-89') return 'good';
  else if (bucket === '50-74') return 'mixed';
  else if (bucket === '<50') return 'bad';
  return 'tbd';
};

export const steamReview = (meta: GameMeta): string =>
  meta.steam !== undefined && meta.steam >= 1 && meta.steam <= 9 ? STEAM_REVIEWS[9 - meta.steam] : 'n/a';

export const steamReviewColor = (meta: GameMeta): string => {
  const reviewText = steamReview(meta);
  if (reviewText) {
    if (reviewText.match(/Positive/)) return 'positive';
    else if (reviewText.match(/Negative/)) return 'negative';
    else if (reviewText.match(/Mixed/)) return 'mixed';
  }
  return "n-a";
};

/** normalized title -> candidate game keys with match tier (0 title, 1 alias, 2 source title). */
export type TitleIndex = Record<string, [key: string, tier: number][]>;

export const slugify = (title: string): string =>
  title.replace(/[™®©]/g, ' ').replace(/&/g, ' and ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Prefer the manual release date, then the first valid source date. */
export const releaseDate = (game: Game): string | undefined => {
  const date = [game.releaseDate, game.opencritic?.data?.releaseDate, game.steam?.data?.releaseDate, game.metacritic?.data?.releaseDate]
    .find((value): value is string => !!value && !isNaN(Date.parse(value)));
  return date ? new Date(date).toISOString().slice(0, 10) : undefined;
};

const displayGenre = (genre: string): string => {
  try {
    return decodeURIComponent(genre.replace(/\+/g, ' '));
  } catch {
    return genre;
  }
};

export const toGameMeta = (game: Game): GameMeta => {
  const meta: GameMeta = { title: game.title.slice(0, 300) };
  const release = releaseDate(game);
  if (release) meta.release = release;
  const oc = game.opencritic?.data;
  if (oc?.score != null) meta.oc = oc.score;
  if (oc?.tier) meta.tier = oc.tier;
  if (game.metacritic?.data?.metacriticScore != null) meta.mc = game.metacritic.data.metacriticScore;
  if (game.metacritic?.data?.mustPlay) meta.mustPlay = true;
  if (game.steam?.data?.reviewScore != null) meta.steam = game.steam.data.reviewScore;
  const genres = [...new Set([...(game.steam?.data?.genres ?? []), ...(game.metacritic?.data?.genres ?? [])].map(displayGenre))].filter(Boolean).sort();
  if (genres.length) meta.genres = genres;
  const cover = game.opencritic?.data?.cover ?? game.steam?.data?.headerImage;
  if (cover && cover.length <= 400) meta.cover = cover;
  if (game.opencritic?.id) meta.ocId = game.opencritic.id;
  if (game.metacritic?.id) meta.mcUrl = game.metacritic.id;
  if (game.steam?.id) meta.steamId = game.steam.id;
  const withId = SOURCES.map(s => game[s]).filter(ref => ref && ref.id !== null);
  if (withId.length) meta.fetched = withId.some(ref => !ref?.fetchedAt) ? '' : withId.map(ref => ref!.fetchedAt!).sort()[0];
  const todo = SOURCES.filter(s => !game[s]);
  if (todo.length) meta.todo = todo;
  return meta;
};

const indexTitles = (game: Game): [string, number][] => [
  [game.title, 0],
  ...(game.aliases ?? []).map((a): [string, number] => [a, 1]),
  ...[game.opencritic?.data?.title, game.steam?.data?.title, game.metacritic?.data?.title]
    .filter((t): t is string => !!t)
    .map((t): [string, number] => [t, 2]),
];

/** Replaces one game's entries in the index; pass `game: null` to remove it. */
export const updateIndex = (index: TitleIndex, key: string, game: Game | null): void => {
  for (const [title, entries] of Object.entries(index)) {
    const kept = entries.filter(([k]) => k !== key);
    if (kept.length) index[title] = kept;
    else delete index[title];
  }
  if (!game) return;
  for (const [title, tier] of indexTitles(game)) {
    const norm = normalizeTitle(title);
    if (!norm) continue;
    const entries = index[norm] ?? (index[norm] = []);
    const existing = entries.find(([k]) => k === key);
    if (!existing) entries.push([key, tier]);
    else if (tier < existing[1]) existing[1] = tier;
  }
};

export const buildIndex = (games: Game[]): TitleIndex => {
  const index: TitleIndex = {};
  for (const game of games) updateIndex(index, game.key, game);
  return index;
};

export type Resolution = { key: string } | { ambiguous: string[] } | null;

/** Best tier wins; a tie between different games is ambiguous and needs an explicit link. */
export const resolveTitle = (index: TitleIndex, title: string): Resolution => {
  const entries = index[normalizeTitle(title)];
  if (!entries?.length) return null;
  const best = Math.min(...entries.map(([, tier]) => tier));
  const keys = entries.filter(([, tier]) => tier === best).map(([k]) => k);
  return keys.length === 1 ? { key: keys[0] } : { ambiguous: keys };
};

export type ItemLink = { title: string; resolution: Resolution; explicit?: boolean };

/** Game links for an item: its contents for collections, otherwise the item itself. */
export const itemLinks = (index: TitleIndex, item: Item): ItemLink[] => {
  if (item.contents?.length) return item.contents.map(title => ({ title, resolution: resolveTitle(index, title) }));
  if (item.game) return [{ title: item.title, resolution: { key: item.game }, explicit: true }];
  let resolution = resolveTitle(index, item.title);
  for (const alias of item.aliases ?? []) {
    if (resolution && 'key' in resolution) break;
    resolution = resolveTitle(index, alias) ?? resolution;
  }
  return [{ title: item.title, resolution }];
};

/** Items that count as owning a game: games only, redeemed and not hidden. */
export const isOwnedGame = (tx: Transaction, item: Item): boolean =>
  (item.kind ?? 'game') === 'game' && !item.unclaimed && !item.hidden && !tx.hidden;

export type Ownership = { tx: Transaction; item: Item; title: string };

/** Joins transactions with the game database: owned games by key, plus titles that need a game or a link. */
export const joinOwnership = (index: TitleIndex, transactions: Transaction[]): {
  owned: Map<string, Ownership[]>;
  unresolved: (Ownership & { ambiguous?: string[] })[];
} => {
  const owned = new Map<string, Ownership[]>();
  const unresolved: (Ownership & { ambiguous?: string[] })[] = [];
  for (const tx of transactions) {
    for (const item of tx.items) {
      if (!isOwnedGame(tx, item)) continue;
      for (const { title, resolution } of itemLinks(index, item)) {
        if (resolution && 'key' in resolution) {
          const list = owned.get(resolution.key) ?? [];
          list.push({ tx, item, title });
          owned.set(resolution.key, list);
        } else {
          unresolved.push({ tx, item, title, ...(resolution ? { ambiguous: resolution.ambiguous } : {}) });
        }
      }
    }
  }
  return { owned, unresolved };
};
