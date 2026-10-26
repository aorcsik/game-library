import { DurableObject } from 'cloudflare:workers';
import { getGame } from '../gamedb.ts';
import { SOURCES } from '../games.ts';
import { claimGameRefresh, runClaimedGameRefresh } from './gameRefresh.ts';
import { needsGameRefresh, type RefreshResult } from './refresh.ts';

type Options = { maxAgeDays: number; force?: boolean };
type Summary = Omit<RefreshResult, 'game'> & { key: string; title: string; sourceIds: Record<string, string | number | null | undefined> };
export type RefreshJob = {
  id: string;
  key: string;
  title: string;
  state: 'pending' | 'running' | 'done' | 'failed';
  automatic: boolean;
  options: Options;
  order: string;
  result?: Summary;
  error?: string;
  finishedAt?: number;
};

export type RefreshQueueStatus = {
  running: { key: string; title: string } | null;
  queued: { key: string; title: string }[];
};

const jobKey = (key: string): string => `job:${key}`;
const resultKey = (id: string): string => `result:${id}`;
const RETRY_DELAY = 125_000;
const RECOVERY_DELAY = 10 * 60_000;
const AUTO_RETRY_DELAY = 5 * 60_000;
const RESULT_RETENTION = 24 * 60 * 60_000;

export const refreshQueue = (env: { REFRESH_QUEUE: DurableObjectNamespace<GameRefreshQueue> }): DurableObjectStub<GameRefreshQueue> =>
  env.REFRESH_QUEUE.get(env.REFRESH_QUEUE.idFromName('game-refreshes'));

export class GameRefreshQueue extends DurableObject<{ GAMEDB: KVNamespace; FETCHER?: string }> {
  private draining = false;

  async enqueue(key: string, options: Options, automatic: boolean, title: string): Promise<RefreshJob> {
    await this.pruneResults();
    const job = await this.ctx.storage.transaction(async storage => {
      const existing = await storage.get<RefreshJob>(jobKey(key));
      if (existing?.state === 'pending') {
        if (!automatic) {
          existing.automatic = false;
          existing.options = {
            maxAgeDays: Math.min(existing.options.maxAgeDays, options.maxAgeDays),
            force: existing.options.force || options.force,
          };
          await storage.put(jobKey(key), existing);
        }
        return existing;
      }
      if (existing?.state === 'running') return existing;
      if (automatic && existing?.finishedAt && Date.now() - existing.finishedAt < AUTO_RETRY_DELAY) return existing;
      const sequence = (await storage.get<number>('nextSequence') ?? 0) + 1;
      const order = `pending:${String(sequence).padStart(16, '0')}`;
      const created: RefreshJob = { id: crypto.randomUUID(), key, title, state: 'pending', automatic, options, order };
      await storage.put('nextSequence', sequence);
      await storage.put(jobKey(key), created);
      await storage.put(order, key);
      return created;
    });
    const alarm = await this.ctx.storage.getAlarm();
    if (job.state === 'pending' && (alarm === null || alarm > Date.now() + 1000)) {
      await this.ctx.storage.setAlarm(Date.now());
    }
    return job;
  }

  async status(key: string, id: string): Promise<RefreshJob | null> {
    const job = await this.ctx.storage.get<RefreshJob>(jobKey(key));
    if (job?.id === id) return job;
    const result = await this.ctx.storage.get<RefreshJob>(resultKey(id));
    return result?.key === key ? result : null;
  }

  async queueStatus(): Promise<RefreshQueueStatus> {
    const status: RefreshQueueStatus = { running: null, queued: [] };
    let start: string | undefined;
    while (true) {
      const pending = await this.ctx.storage.list<string>({ prefix: 'pending:', startAfter: start, limit: 100 });
      if (!pending.size) break;
      const jobs = await this.ctx.storage.get<RefreshJob>([...pending.values()].map(jobKey));
      for (const [order, key] of pending) {
        start = order;
        const job = jobs.get(jobKey(key));
        if (!job || job.order !== order) continue;
        const entry = { key, title: job.title ?? key };
        if (job.state === 'running') status.running = entry;
        else if (job.state === 'pending') status.queued.push(entry);
      }
      if (pending.size < 100) break;
    }
    return status;
  }

  async alarm(): Promise<void> {
    if (this.draining) {
      await this.ctx.storage.setAlarm(Date.now() + RECOVERY_DELAY);
      return;
    }
    this.draining = true;
    try {
      if (this.env.FETCHER !== 'on') {
        console.error('Refresh queue is paused because FETCHER is disabled.');
        await this.ctx.storage.setAlarm(Date.now() + RECOVERY_DELAY);
        return;
      }
      while (true) {
        const pending = await this.ctx.storage.list<string>({ prefix: 'pending:', limit: 1 });
        const first = pending.entries().next().value;
        if (!first) return;
        const [order, key] = first;
        const job = await this.ctx.storage.get<RefreshJob>(jobKey(key));
        if (!job || job.order !== order) {
          await this.ctx.storage.delete(order);
          continue;
        }
        const game = await getGame(this.env.GAMEDB, key);
        if (!game) {
          await this.finish(job, 'Game not found');
          continue;
        }
        if (job.automatic && !needsGameRefresh(game)) {
          await this.finish(job);
          continue;
        }
        const locked = await claimGameRefresh(this.env.GAMEDB, key, job.automatic);
        if (!locked) {
          await this.ctx.storage.setAlarm(Date.now() + RETRY_DELAY);
          return;
        }
        job.state = 'running';
        await this.ctx.storage.put(jobKey(key), job);
        await this.ctx.storage.setAlarm(Date.now() + RECOVERY_DELAY);
        try {
          const { game: saved, ...summary } = await runClaimedGameRefresh(this.env.GAMEDB, locked, job.options);
          for (const [source, status] of Object.entries(summary.sources)) {
            if (job.automatic && status.error) console.error(`Automatic refresh failed for ${key} (${source}): ${status.error}`);
          }
          job.result = {
            ...summary, key: saved.key, title: saved.title,
            sourceIds: Object.fromEntries(SOURCES.map(source => [source, saved[source]?.id])),
          };
          await this.finish(job);
        } catch (error) {
          await this.finish(job, error instanceof Error ? error.message : String(error));
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async finish(job: RefreshJob, error?: string): Promise<void> {
    job.state = error ? 'failed' : 'done';
    job.finishedAt = Date.now();
    if (error) {
      job.error = error;
      console.error(`Refresh failed for ${job.key}: ${error}`);
    }
    await this.ctx.storage.transaction(async storage => {
      await storage.put(jobKey(job.key), job);
      await storage.put(resultKey(job.id), job);
      await storage.delete(job.order);
    });
  }

  private async pruneResults(): Promise<void> {
    let start: string | undefined;
    while (true) {
      const results = await this.ctx.storage.list<RefreshJob>({ prefix: 'result:', startAfter: start, limit: 100 });
      if (!results.size) break;
      for (const [key, job] of results) {
        start = key;
        if (job.finishedAt && Date.now() - job.finishedAt > RESULT_RETENTION) await this.ctx.storage.delete(key);
      }
      if (results.size < 100) break;
    }
  }
}
