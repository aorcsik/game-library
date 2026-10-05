import { SOURCES, releaseDate, type Game, type SourceName, type SourceRef } from '../games';
import { fetchMetacritic, fetchOpenCritic, fetchSteam, type ParseResult } from './parsers';

export type SourceStatus = 'fetched' | 'fresh' | 'unavailable' | 'missing' | 'error';

export type RefreshResult = {
  game: Game;
  /** Fetched data differs from what was stored (fetch timestamps alone don't count). */
  changed: boolean;
  sources: Record<SourceName, { status: SourceStatus; error?: string }>;
  /** Sources that need an id (or "none") from the user. */
  missing: SourceName[];
  /** No source provides a release date and there is no manual one. */
  needsReleaseDate: boolean;
  proposed: { metacritic?: string };
};

const DAY = 24 * 60 * 60 * 1000;

// Review counts in the tooltip change daily; alone they are not worth a remote write.
const VOLATILE: Partial<Record<SourceName, string[]>> = { steam: ['reviewScoreTooltip'] };

const significant = (name: SourceName, data: unknown): string =>
  JSON.stringify(data, (key, value) => (VOLATILE[name]?.includes(key) ? undefined : value));

const isStale = (ref: SourceRef<unknown, unknown>, maxAgeDays: number, now: number): boolean =>
  !ref.fetchedAt || now - Date.parse(ref.fetchedAt) > maxAgeDays * DAY;

type Fetcher = (id: never) => Promise<ParseResult<unknown>>;
const FETCHERS: Record<SourceName, Fetcher> = {
  // Steam first: its page proposes the Metacritic URL.
  steam: fetchSteam as Fetcher,
  opencritic: fetchOpenCritic as Fetcher,
  metacritic: fetchMetacritic as Fetcher,
};

export const refreshGame = async (original: Game, options: { maxAgeDays: number; force?: boolean }): Promise<RefreshResult> => {
  const game: Game = structuredClone(original);
  const now = Date.now();
  const fetchedAt = new Date(now).toISOString();
  const sources = {} as RefreshResult['sources'];
  const proposed: RefreshResult['proposed'] = {};
  let changed = false;

  for (const name of Object.keys(FETCHERS) as SourceName[]) {
    const ref = game[name] as SourceRef<unknown, unknown> | undefined;
    if (!ref) {
      sources[name] = { status: 'missing' };
      continue;
    }
    if (ref.id === null) {
      sources[name] = { status: 'unavailable' };
      continue;
    }
    // A "tbd" Metacritic score is retried on every run, like the legacy CLI did.
    const tbd = name === 'metacritic' && game.metacritic?.data && game.metacritic.data.metacriticScore === null;
    if (!options.force && !tbd && !isStale(ref, options.maxAgeDays, now)) {
      sources[name] = { status: 'fresh' };
      continue;
    }
    let result: ParseResult<unknown>;
    try {
      result = await FETCHERS[name](ref.id as never);
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    if (!result.ok) {
      sources[name] = { status: 'error', error: result.error };
      continue;
    }
    if (significant(name, ref.data) !== significant(name, result.data)) changed = true;
    ref.data = result.data;
    ref.fetchedAt = fetchedAt;
    sources[name] = { status: 'fetched' };
    if (name === 'steam' && result.proposedMetacriticUrl) proposed.metacritic = result.proposedMetacriticUrl;
  }

  if (game.metacritic || !proposed.metacritic) delete proposed.metacritic;
  game.updatedAt = fetchedAt;
  return {
    game,
    changed,
    sources,
    missing: SOURCES.filter(s => sources[s].status === 'missing'),
    needsReleaseDate: !releaseDate(game),
    proposed,
  };
};
