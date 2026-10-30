import { buildCreatorIndex, gameCreatorCredits, getGameCreatorLinks, listCreators, type CreatorCredit, type CreatorGameLink, type CreatorIndex, type CreatorRef } from './creators.ts';
import { getGames, type GameRef } from './gamedb.ts';
import {
  gameMetaCover, metacriticBucketColor, opencriticUrl, steamReview, steamReviewColor, steamUrl, toGameMeta,
  type Game, type GameMeta,
} from './games.ts';
import { gameEmbedKeys, parseMarkdown, safeUrl } from './markdown.ts';
import { normalizeTitle } from './model.ts';

export const GAME_CARDS_MAX = 20;
export const GAME_SEARCH_LIMIT = 15;

/** A developer or publisher; `href` is the creator's own website, when they have one. */
export type CreditLink = { name: string; href?: string };

/** The public subset of a game: no ownership, personal state, or links into the library. */
export type GameCard = {
  key: string;
  title: string;
  year?: string;
  /** Full release date, as on the game details page. */
  release?: string;
  cover?: string;
  genres: string[];
  developers: CreditLink[];
  publishers: CreditLink[];
  /** Plain text; the view clamps it to two lines. */
  description?: string;
  opencritic?: { tier?: string; score: number; href?: string };
  /** `tone` is the score colour bucket (good, mixed, bad, tbd). */
  metacritic?: { score?: number; tone: string; mustPlay: boolean; href: string };
  steam?: { review: string; tone: string; href?: string };
};

const external = (url: string | undefined): string | undefined => (url && safeUrl(url)) || undefined;

export const DESCRIPTION_MAX = 500;

/** Prefers Steam's text, then Metacritic's summary, then OpenCritic's description. */
export const gameDescription = (game: Game): string | undefined => {
  const text = [game.steam?.data?.description, game.metacritic?.data?.summary, game.opencritic?.data?.description]
    .map(value => value?.replace(/\s+/g, ' ').trim())
    .find(Boolean);
  return text ? (text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX).trimEnd()}…` : text) : undefined;
};

/** Creators resolved once per render: the name index plus each creator's website. */
export type CreatorContext = { index: CreatorIndex; urls: ReadonlyMap<string, string | undefined> };

export const creatorContext = (creators: CreatorRef[]): CreatorContext => ({
  index: buildCreatorIndex(creators),
  urls: new Map(creators.map(creator => [creator.key, creator.url])),
});

const creditLinks = (credits: CreatorCredit[], { urls }: CreatorContext, links?: ReadonlyMap<string, CreatorGameLink>): CreditLink[] =>
  credits
    .filter(({ key }) => !key || !links?.get(key)?.miscredit)
    .map(({ name, key }) => ({ name, href: external(key ? urls.get(key) : undefined) }));

export const toGameCard = (game: Game, creators: CreatorContext, links?: ReadonlyMap<string, CreatorGameLink>): GameCard => {
  const meta = toGameMeta(game);
  const credits = gameCreatorCredits(game, creators.index);
  const metacriticHref = external(meta.mcUrl);
  return {
    key: game.key,
    title: meta.title,
    year: meta.release?.slice(0, 4),
    release: meta.release,
    cover: safeUrl(gameMetaCover(meta) ?? '', true) ?? undefined,
    genres: meta.genres ?? [],
    developers: creditLinks(credits.developers, creators, links),
    publishers: creditLinks(credits.publishers, creators, links),
    description: gameDescription(game),
    opencritic: meta.oc !== undefined
      ? { tier: meta.tier, score: meta.oc, href: meta.ocId ? external(opencriticUrl(meta.ocId)) : undefined }
      : undefined,
    metacritic: metacriticHref
      ? { score: meta.mc, tone: metacriticBucketColor(meta), mustPlay: !!meta.mustPlay, href: metacriticHref }
      : undefined,
    steam: steamReview(meta) !== 'n/a'
      ? { review: steamReview(meta), tone: steamReviewColor(meta), href: meta.steamId ? external(steamUrl(meta.steamId)) : undefined }
      : undefined,
  };
};

/** Loads the cards for every `![game:…]` embed in a post body; unknown keys are simply absent. */
export const postGameCards = async (
  env: { GAMEDB: KVNamespace; CREATORS: KVNamespace },
  body: string,
): Promise<Map<string, GameCard>> => {
  const keys = gameEmbedKeys(parseMarkdown(body)).slice(0, GAME_CARDS_MAX);
  const games = keys.length ? await getGames(env.GAMEDB, keys) : new Map<string, Game>();
  if (!games.size) return new Map();
  const creators = creatorContext(await listCreators(env.CREATORS));
  return new Map(await Promise.all([...games].map(async ([key, game]) =>
    [key, toGameCard(game, creators, await getGameCreatorLinks(env.CREATORS, key))] as const)));
};

export type GameChoice = { key: string; title: string; year?: string };

/** Case- and accent-insensitive search over titles and keys; title prefix matches come first. */
export const searchGames = (refs: GameRef[], query: string, limit = GAME_SEARCH_LIMIT): GameChoice[] => {
  const terms = normalizeTitle(query).split(' ').filter(Boolean);
  if (!terms.length) return [];
  const needle = terms.join(' ');
  return refs
    .map(({ key, meta }) => ({ key, meta, title: normalizeTitle(meta.title), key_: key.replaceAll('-', ' ') }))
    .filter(entry => terms.every(term => entry.title.includes(term) || entry.key_.includes(term)))
    .sort((a, b) => Number(b.title.startsWith(needle)) - Number(a.title.startsWith(needle)) || a.meta.title.localeCompare(b.meta.title))
    .slice(0, limit)
    .map(({ key, meta }) => ({ key, title: meta.title, year: meta.release?.slice(0, 4) }));
};
