// Local-only metadata fetcher API. Mounted only when FETCHER=on (set in .dev.vars, never in production).
import { Hono } from 'hono';
import { applyGameForm } from '../gameForm';
import { getGame, getTitleIndex, listGames, saveGame } from '../gamedb';
import { SOURCES, joinOwnership, type Game } from '../games';
import { getAllTransactions } from '../store';
import { refreshQueue, type GameRefreshQueue } from './queue';

type Env = { GAMES: KVNamespace; GAMEDB: KVNamespace; REFRESH_QUEUE: DurableObjectNamespace<GameRefreshQueue> };

export type QueueEntry = { key: string; title: string; reason: string };

const DAY = 24 * 60 * 60 * 1000;
const GAME = ':key{[a-z0-9-]{1,120}}';

const maxAge = (value: string | undefined): number => {
  const days = Number(value ?? 14);
  return Number.isFinite(days) && days >= 0 ? days : 14;
};

export const fetcher = new Hono<{ Bindings: Env }>();

fetcher.get('/queue', async c => {
  const days = maxAge(c.req.query('maxAge'));
  const scope = c.req.query('scope') === 'all' ? 'all' : 'owned';
  const cutoff = new Date(Date.now() - days * DAY).toISOString();
  const games = await listGames(c.env.GAMEDB);
  let owned: Set<string> | undefined;
  if (scope === 'owned') {
    const [index, transactions] = await Promise.all([getTitleIndex(c.env.GAMEDB), getAllTransactions(c.env.GAMES)]);
    owned = new Set(joinOwnership(index, transactions).owned.keys());
  }
  const queue: QueueEntry[] = [];
  for (const { key, meta } of games) {
    if (owned && !owned.has(key)) continue;
    const reasons: string[] = [];
    if (meta.todo?.length) reasons.push(`no ${meta.todo.join('/')} reference`);
    if (meta.fetched === '') reasons.push('never fetched');
    else if (meta.fetched && meta.fetched < cutoff) reasons.push(`fetched ${meta.fetched.slice(0, 10)}`);
    else if (!meta.fetched && !meta.todo?.length && !meta.release) reasons.push('no release date');
    if (reasons.length) queue.push({ key, title: meta.title, reason: reasons.join(', ') });
  }
  queue.sort((a, b) => a.title.localeCompare(b.title));
  return c.json({ queue, total: owned ? owned.size : games.length });
});

fetcher.post(`/games/${GAME}/refresh`, async c => {
  const key = c.req.param('key');
  const game = await getGame(c.env.GAMEDB, key);
  if (!game) return c.json({ error: 'Game not found' }, 404);
  const job = await refreshQueue(c.env).enqueue(key, { maxAgeDays: maxAge(c.req.query('maxAge')), force: c.req.query('force') === '1' }, false, game.title);
  if (job.state === 'running' && c.req.query('force') === '1' && !job.options.force) {
    return c.json({ error: 'Refresh already in progress; try again when it finishes.' }, 409);
  }
  return c.json({ id: job.id, state: job.state }, 202);
});

fetcher.get(`/games/${GAME}/refresh/:id{[a-f0-9-]{36}}`, async c => {
  const job = await refreshQueue(c.env).status(c.req.param('key'), c.req.param('id'));
  if (!job) return c.json({ error: 'Refresh job not found' }, 404);
  return c.json({ state: job.state, result: job.result, error: job.error });
});

/** Sets source ids / manual release date; unspecified fields keep their current value. */
fetcher.post(`/games/${GAME}/sources`, async c => {
  const game = await getGame(c.env.GAMEDB, c.req.param('key'));
  if (!game) return c.json({ error: 'Game not found' }, 404);
  const input = await c.req.formData();
  const form = new FormData();
  form.set('title', game.title);
  form.set('aliases', (game.aliases ?? []).join('\n'));
  form.set('releaseDate', String(input.get('releaseDate') ?? game.releaseDate ?? ''));
  for (const source of SOURCES) {
    const current = game[source] === undefined ? '' : game[source]!.id === null ? 'none' : String(game[source]!.id);
    const value = input.get(source);
    form.set(source, typeof value === 'string' ? (value.trim() || 'none') : current);
  }
  const { game: updated, errors } = applyGameForm(form, game);
  if (!updated) return c.json({ errors }, 422);
  await saveGame(c.env.GAMEDB, updated satisfies Game);
  return c.json({ ok: true });
});
