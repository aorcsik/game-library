// Page parsers for OpenCritic, Steam and Metacritic (ported from the legacy CLI, linkedom instead of JSDOM).
import { parseHTML } from 'linkedom';
import { parse as parseDevalue } from 'devalue';
import type { MetacriticData, OpenCriticData, SteamData } from '../games';

export type ParseResult<T> = { ok: true; data: T; proposedMetacriticUrl?: string } | { ok: false; error: string };

/** The subset of linkedom's DOM used here (the worker tsconfig has no DOM lib). */
type El = {
  textContent: string | null;
  innerHTML: string;
  getAttribute(name: string): string | null;
  querySelector(selector: string): El | null;
  querySelectorAll(selector: string): Iterable<El>;
};

const parse = (html: string): { document: El } => ({ document: parseHTML(html).document as unknown as El });

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

const load = async (url: string, headers: Record<string, string> = {}): Promise<{ html: string; url: string } | { error: string }> => {
  const response = await fetch(url, { headers: { ...HEADERS, ...headers }, redirect: 'follow' });
  if (!response.ok) return { error: `HTTP ${response.status} for ${url}` };
  return { html: await response.text(), url: response.url };
};

const toIsoDate = (text: string | undefined): string | null => {
  if (!text) return null;
  const date = new Date(`${text} UTC`);
  return isNaN(date.getTime()) ? null : date.toISOString();
};

const text = (el: El | null | undefined): string | null => el?.textContent?.trim() || null;

const parseModernOpenCritic = (document: El, id: string): Partial<OpenCriticData> => {
  const payload = document.querySelector('#serverApp-state')?.textContent;
  if (!payload) return {};
  try {
    const state: unknown = JSON.parse(payload.replace(/&q;/g, '"').replace(/&s;/g, "'").replace(/&a;/g, '&'));
    const game = isRecord(state) ? state[`game/${id.split('/')[0]}`] : undefined;
    if (!isRecord(game)) return {};
    const box = isRecord(game.images) && isRecord(game.images.box) ? game.images.box : undefined;
    const releaseDate = typeof game.firstReleaseDate === 'string' ? new Date(game.firstReleaseDate) : null;
    return {
      title: typeof game.name === 'string' ? game.name : undefined,
      cover: typeof box?.sm === 'string' ? box.sm : typeof box?.og === 'string' ? box.og : undefined,
      tier: typeof game.tier === 'string' ? game.tier : undefined,
      score: typeof game.topCriticScore === 'number' ? game.topCriticScore >= 0 ? Math.round(game.topCriticScore) : null : undefined,
      critics: typeof game.percentRecommended === 'number' ? game.percentRecommended >= 0 ? Math.round(game.percentRecommended) : null : undefined,
      releaseDate: releaseDate && !isNaN(releaseDate.getTime()) ? releaseDate.toISOString() : undefined,
      platforms: structuredNames(game.Platforms),
      creators: structuredNames(game.Companies),
      description: typeof game.description === 'string' ? game.description.trim() || null : undefined,
    };
  } catch {
    return {};
  }
};

const parseLegacyOpenCritic = (document: El): OpenCriticData => {
  const title = text(document.querySelector('app-game-overview h1'));
  const cover = document.querySelector('.header-card picture source[media="(max-width: 991px)"]')?.getAttribute('srcset') || null;
  const tier = document.querySelector('.header-card app-score-orb .score-orb svg')?.innerHTML.match(/class="(mighty|strong|fair|weak)"/)?.[1] ?? null;
  const orbs = [...document.querySelectorAll('.header-card app-score-orb .inner-orb')];
  const scoreText = text(orbs[0]);
  const score = scoreText && /^\d+$/.test(scoreText) ? parseInt(scoreText, 10) : null;
  const criticsMatch = text(orbs[1])?.match(/(\d+)%/);
  const critics = criticsMatch ? parseInt(criticsMatch[1], 10) : null;
  const releaseMatch = document.querySelector('.platforms')?.innerHTML.match(/Release Date:<\/strong> (\w+ \d+, \d+) -/);
  const platforms = [...document.querySelectorAll('.platforms span')].map(el => text(el)?.replace(/,$/g, '').trim()).filter((value): value is string => value !== null);
  const creators = [...document.querySelectorAll('.companies span')].map(el => text(el)?.replace(/,$/g, '').trim()).filter((value): value is string => value !== null);
  return { title, cover, tier, score, critics, releaseDate: toIsoDate(releaseMatch?.[1]), platforms, creators };
};

export const fetchOpenCritic = async (id: string): Promise<ParseResult<OpenCriticData>> => {
  const page = await load(`https://opencritic.com/game/${id}`);
  if ('error' in page) return { ok: false, error: page.error };
  const { document } = parse(page.html);
  const modern = parseModernOpenCritic(document, id);
  const legacy = parseLegacyOpenCritic(document);
  const title = modern.title || legacy.title;
  if (!title) return { ok: false, error: 'OpenCritic page has no title (layout changed?)' };
  return { ok: true, data: {
    title,
    cover: modern.cover ?? legacy.cover,
    tier: modern.tier ?? legacy.tier,
    score: modern.score ?? legacy.score,
    critics: modern.critics ?? legacy.critics,
    releaseDate: modern.releaseDate ?? legacy.releaseDate,
    platforms: modern.platforms ?? legacy.platforms,
    creators: modern.creators ?? legacy.creators,
    description: modern.description ?? null,
  } };
};

const STEAM_REVIEW_SCORES: Record<string, number> = {
  'Overwhelmingly Positive': 9,
  'Very Positive': 8,
  'Positive': 7,
  'Mostly Positive': 6,
  'Mixed': 5,
  'Mostly Negative': 4,
  'Negative': 3,
  'Very Negative': 2,
  'Overwhelmingly Negative': 1,
};

export const fetchSteam = async (appId: number): Promise<ParseResult<SteamData>> => {
  // Age-gate cookies, otherwise mature games redirect to the age check page.
  const page = await load(`https://store.steampowered.com/app/${appId}`, {
    Cookie: 'birthtime=463096801; lastagecheckage=4-September-1984; wants_mature_content=1',
  });
  if ('error' in page) return { ok: false, error: page.error };
  if (!page.url.includes(`app/${appId}`)) return { ok: false, error: `Steam redirected to ${page.url} (app removed or region locked?)` };
  const { document } = parse(page.html);

  const title = text(document.querySelector('.apphub_AppName'));
  if (!title) return { ok: false, error: 'Steam page has no app name (layout changed?)' };
  const details = document.querySelector('#genresAndManufacturer');
  const genres = [...(details?.querySelectorAll('a') ?? [])]
    .map(a => a.getAttribute('href')?.match(/genre\/(.*?)\//)?.[1])
    .filter((g): g is string => !!g)
    .map(g => decodeURIComponent(g.replace(/\+/g, ' ')));
  const rating = document.querySelector('[itemprop=aggregateRating]');
  const reviewScoreDescription = text(rating?.querySelector('.game_review_summary'));

  const developers = [...(document.querySelectorAll('.dev_row') ?? [])]
    .filter((el): el is El => el.querySelector('.subtitle')?.textContent?.includes('Developer') ?? false)
    .reduce((acc, el) => {
      const devs = [...(el.querySelectorAll('a') ?? [])].map(a => a.textContent?.trim()).filter((d): d is string => !!d);
      return acc.concat(devs);
    }, [] as string[]);

  const publishers = [...(document.querySelectorAll('.dev_row') ?? [])]
    .filter((el): el is El => el.querySelector('.subtitle')?.textContent?.includes('Publisher') ?? false)
    .reduce((acc, el) => {
      const pubs = [...(el.querySelectorAll('a') ?? [])].map(a => a.textContent?.trim()).filter((p): p is string => !!p);
      return acc.concat(pubs);
    }, [] as string[]);

  const metacriticHref = document.querySelector('#game_area_metalink a')?.getAttribute('href');
  const proposedMetacriticUrl = metacriticHref
    ? metacriticHref.replace(/\?.*/, '').replace(/\/pc\//, '/').replace(/^https?:\/\/(www\.)?metacritic\.com\//, 'https://www.metacritic.com/')
    : undefined;

  return {
    ok: true,
    proposedMetacriticUrl,
    data: {
      title,
      description: text(document.querySelector('.game_description_snippet')),
      genres,
      releaseDate: toIsoDate(details?.textContent?.match(/Release Date:\s*(\d+ \w+, \d+)/)?.[1]),
      reviewScore: reviewScoreDescription ? STEAM_REVIEW_SCORES[reviewScoreDescription] ?? null : null,
      reviewScoreDescription,
      reviewScoreTooltip: rating?.getAttribute('data-tooltip-html') || null,
      headerImage: document.querySelector('.game_header_image_full')?.getAttribute('src') || null,
      developers,
      publishers,
    },
  };
};

type DataRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is DataRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

const NUXT_REVIVERS = Object.fromEntries(
  ['EmptyRef', 'EmptyShallowRef', 'Reactive', 'Ref', 'ShallowReactive', 'ShallowRef']
    .map(type => [type, (value: unknown) => value]),
);

const findGameData = (value: unknown, seen = new Set<object>()): DataRecord | undefined => {
  if (typeof value !== 'object' || value === null || seen.has(value)) return undefined;
  seen.add(value);
  if (!Array.isArray(value) && isRecord(value) && value.type === 'game-title' && typeof value.title === 'string') return value;

  const children = value instanceof Map ? value.values() : value instanceof Set ? value.values() : Object.values(value);
  for (const child of children) {
    const game = findGameData(child, seen);
    if (game) return game;
  }
  return undefined;
};

const metacriticGameData = (document: El): DataRecord | undefined => {
  const payload = document.querySelector('script[data-nuxt-data="nuxt-app"]')?.textContent;
  if (!payload) return undefined;
  try {
    return findGameData(parseDevalue(payload, NUXT_REVIVERS));
  } catch {
    return undefined;
  }
};

const structuredNames = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.map(entry => isRecord(entry) ? entry.name : entry).filter((name): name is string => typeof name === 'string' && !!name);
};

const parseModernMetacritic = (document: El) => {
  const game = metacriticGameData(document);
  const criticScore = isRecord(game?.criticScoreSummary) ? game.criticScoreSummary.score : undefined;
  const companies = isRecord(game?.production) && Array.isArray(game.production.companies) ? game.production.companies : undefined;
  const developers = companies?.filter(company => isRecord(company) && company.typeName === 'Developer')
    .map(company => isRecord(company) && typeof company.name === 'string' ? company.name : '')
    .filter(Boolean);
  const publishers = companies?.filter(company => isRecord(company) && company.typeName === 'Publisher')
    .map(company => isRecord(company) && typeof company.name === 'string' ? company.name : '')
    .filter(Boolean);
  return {
    title: typeof game?.title === 'string' ? game.title : undefined,
    scoreText: criticScore == null ? undefined : String(criticScore),
    mustPlay: typeof game?.mustPlay === 'boolean' ? game.mustPlay : undefined,
    releaseDate: typeof game?.releaseDate === 'string' ? game.releaseDate : undefined,
    summary: typeof game?.description === 'string' ? game.description.trim() || null : null,
    platforms: structuredNames(game?.platforms),
    genres: structuredNames(game?.genres),
    developers,
    publishers,
  };
};

const parseLegacyMetacritic = (document: El) => {
  let releaseDate: string | null = null;
  const platforms: string[] = [];
  const publishers: string[] = [];
  const genres: string[] = [];
  const listItems = (section: El, selector: string): string[] =>
    [...section.querySelectorAll(selector)].map(el => text(el)).filter((v): v is string => !!v);
  for (const section of document.querySelectorAll('.c-product-details__section')) {
    const label = text(section.querySelector('.c-product-details__section__label'));
    if (!releaseDate && label === 'Initial Release Date:') releaseDate = toIsoDate(section.textContent?.trim().match(/Initial Release Date:\s*(\w+ \d+, \d+)/)?.[1]);
    if (label === 'Platforms:') platforms.push(...listItems(section, '.c-product-details__section__list-item'));
    if (label === 'Publisher:') publishers.push(...listItems(section, '.c-product-details__section__list-item'));
    if (label === 'Genres:') genres.push(...listItems(section, '.c-genreList_item'));
  }
  const developers: string[] = Array.from(document.querySelectorAll('[data-testid="hero-summary-developer"] a'))
    .map(el => text(el)).filter((value): value is string => !!value);
  return {
    title: text(document.querySelector('h1')),
    scoreText: text(document.querySelector('[data-testid="global-score"]')),
    mustPlay: !!document.querySelector('[data-testid="global-score-badge"] img')?.getAttribute('src')?.includes('must-play'),
    releaseDate,
    platforms,
    publishers,
    genres,
    developers,
  };
};

export const fetchMetacritic = async (url: string): Promise<ParseResult<MetacriticData>> => {
  const page = await load(url);
  if ('error' in page) return { ok: false, error: page.error };
  const { document } = parse(page.html);
  const modern = parseModernMetacritic(document);
  const legacy = parseLegacyMetacritic(document);
  const title = modern.title ?? legacy.title;
  if (!title) return { ok: false, error: 'Metacritic page has no title (layout changed?)' };
  const scoreText = modern.scoreText ?? legacy.scoreText;
  if (scoreText === null) return { ok: false, error: 'Metacritic page has no score element' };

  return {
    ok: true,
    data: {
      title,
      summary: modern.summary,
      metacriticScore: /^\d+$/.test(scoreText) ? parseInt(scoreText, 10) : null,
      mustPlay: modern.mustPlay ?? legacy.mustPlay,
      platforms: modern.platforms ?? legacy.platforms,
      releaseDate: modern.releaseDate || legacy.releaseDate,
      developers: modern.developers ?? legacy.developers,
      publisher: modern.publishers?.join(', ') || legacy.publishers.join(', ') || null,
      genres: modern.genres ?? legacy.genres,
    },
  };
};
