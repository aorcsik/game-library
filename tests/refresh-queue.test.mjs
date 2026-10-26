import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const bundle = await build({
  stdin: {
    contents: `
      import app, { GameRefreshQueue } from './src/index.tsx';
      export { GameRefreshQueue };
      globalThis.fetch = async () => {
        await new Promise(resolve => setTimeout(resolve, 120));
        return new Response('<app-game-overview><h1>Sample</h1></app-game-overview>');
      };
      export default { fetch: (request, env, ctx) => app.fetch(request, env, ctx) };
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, write: false, format: 'esm', platform: 'browser', external: ['cloudflare:workers'],
  jsx: 'automatic', jsxImportSource: 'hono',
});

const makeWorker = (fetcher = 'on', resourcePersistencePath) => new Miniflare({
  resourcePersistencePath,
  workers: [{
    config: {
      name: 'queue-test', compatibilityDate: '2026-09-27',
      manifest: {
        mainModule: 'index.js',
        modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } },
      },
      exports: { GameRefreshQueue: { type: 'durable-object', storage: 'sqlite' } },
      env: {
        REFRESH_QUEUE: { type: 'durable-object', worker: 'queue-test', exportName: 'GameRefreshQueue' },
        GAMEDB: { type: 'kv', id: 'queue-test-kv' },
        GAMES: { type: 'kv', id: 'queue-test-transactions' },
        GAMESTATE: { type: 'kv', id: 'queue-test-state' },
        CREATORS: { type: 'kv', id: 'queue-test-creators' },
        FETCHER: { type: 'text', value: fetcher },
        LOCAL_DEV: { type: 'text', value: 'on' },
      },
    },
  }],
});

const queueStub = async mf => {
  const ns = await mf.getDurableObjectNamespace('REFRESH_QUEUE');
  return ns.get(ns.idFromName('game-refreshes'));
};

const queueSnapshot = async stub => JSON.parse(JSON.stringify(await stub.queueStatus()));

const waitFor = async (stub, key, id) => {
  for (let i = 0; i < 100; i++) {
    const job = await stub.status(key, id);
    if (job?.state === 'done' || job?.state === 'failed') return job;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${key}: ${JSON.stringify(await stub.status(key, id))}`);
};

test('deduplicates jobs and processes distinct games sequentially', async () => {
  const mf = makeWorker();
  try {
    const kv = await mf.getKVNamespace('GAMEDB');
    const old = new Date(Date.now() - 2 * 86400000).toISOString();
    for (const key of ['first', 'second']) {
      await kv.put(`game:${key}`, JSON.stringify({
        key, title: key, updatedAt: old,
        opencritic: { id: `1/${key}`, fetchedAt: old, data: { title: key } },
      }));
    }
    const stub = await queueStub(mf);
    const first = await stub.enqueue('first', { maxAgeDays: 1 }, true, 'First game');
    const duplicate = await stub.enqueue('first', { maxAgeDays: 1 }, true, 'First game');
    assert.equal(duplicate.id, first.id);
    const second = await stub.enqueue('second', { maxAgeDays: 1 }, true, 'Second game');
    assert.notEqual(second.id, first.id);
    const active = await queueSnapshot(stub);
    assert.deepEqual(active.queued, [{ key: 'second', title: 'Second game' }]);
    assert.deepEqual(active.running, { key: 'first', title: 'First game' });
    const liveResponse = await mf.dispatchFetch('http://localhost/api/refresh-queue-status');
    assert.equal(liveResponse.status, 200);
    assert.equal(liveResponse.headers.get('Cache-Control'), 'no-store');
    assert.equal((await liveResponse.json()).queued[0].title, 'Second game');
    const page = await mf.dispatchFetch('http://localhost/refresh');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /data-refresh-queue-panel/);

    const firstResult = await waitFor(stub, 'first', first.id);
    assert.equal(firstResult.state, 'done');
    const secondResult = await waitFor(stub, 'second', second.id);
    assert.equal(secondResult.state, 'done');
    assert.deepEqual(await queueSnapshot(stub), { running: null, queued: [] });
    assert.equal((await kv.get('sync:dirty', 'json')).length, 2);

    const manual = await stub.enqueue('first', { maxAgeDays: 14, force: true }, false, 'First game');
    assert.notEqual(manual.id, first.id);
    assert.equal((await waitFor(stub, 'first', manual.id)).result.sources.opencritic.status, 'fetched');
    assert.equal((await stub.status('first', first.id)).result.key, 'first');
    assert.equal((await stub.enqueue('first', { maxAgeDays: 1 }, true, 'First game')).id, manual.id);

    const missing = await stub.enqueue('deleted', { maxAgeDays: 1 }, true, 'Deleted game');
    assert.equal((await waitFor(stub, 'deleted', missing.id)).error, 'Game not found');

    const response = await mf.dispatchFetch('http://localhost/api/fetcher/games/second/refresh?force=1', {
      method: 'POST', headers: { Origin: 'http://localhost' },
    });
    assert.equal(response.status, 202);
    const { id } = await response.json();
    await waitFor(stub, 'second', id);
    const status = await mf.dispatchFetch(`http://localhost/api/fetcher/games/second/refresh/${id}`);
    assert.equal(status.status, 200);
    assert.equal((await status.json()).result.sources.opencritic.status, 'fetched');
  } finally {
    await mf.dispose();
  }
});

test('opening a stale game renders the queued job id and displays refreshed data on the next request', async () => {
  const mf = makeWorker();
  try {
    const kv = await mf.getKVNamespace('GAMEDB');
    await kv.put('game:automatic', JSON.stringify({
      key: 'automatic', title: 'Automatic game', updatedAt: '2020-01-01T00:00:00.000Z',
      opencritic: { id: '1/automatic', fetchedAt: '2020-01-01T00:00:00.000Z' },
    }));
    const page = await mf.dispatchFetch('http://localhost/games/automatic');
    assert.equal(page.status, 200);
    const html = await page.text();
    const id = html.match(/data-auto-refresh-id="([a-f0-9-]{36})"/)?.[1];
    assert.ok(id, 'detail page exposes its queued refresh job id');
    assert.match(html, /data-auto-refresh-state="(pending|running)"/);

    const stub = await queueStub(mf);
    assert.equal((await waitFor(stub, 'automatic', id)).state, 'done');
    const updated = await mf.dispatchFetch('http://localhost/games/automatic');
    assert.equal(updated.status, 200);
    assert.doesNotMatch(await updated.text(), /data-auto-refresh-id="[a-f0-9-]{36}"/);
    assert.ok(Date.parse((await kv.get('game:automatic', 'json')).opencritic.fetchedAt) > Date.parse('2020-01-01T00:00:00.000Z'));
  } finally {
    await mf.dispose();
  }
});

test('persists pending jobs across worker restarts and resumes them on the next alarm', async () => {
  const path = await mkdtemp(join(tmpdir(), 'game-refresh-queue-'));
  let mf = makeWorker('off', path);
  try {
    const kv = await mf.getKVNamespace('GAMEDB');
    await kv.put('game:restart', JSON.stringify({
      key: 'restart', title: 'Restart',
      opencritic: { id: '1/restart', fetchedAt: '2020-01-01T00:00:00.000Z' },
    }));
    const stub = await queueStub(mf);
    const pending = await stub.enqueue('restart', { maxAgeDays: 1 }, true, 'Restart game');
    const id = pending.id;
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal((await stub.status('restart', id)).state, 'pending');
    assert.equal((await mf.dispatchFetch('http://localhost/api/refresh-queue-status')).status, 204);
    assert.deepEqual(await queueSnapshot(stub), {
      running: null, queued: [{ key: 'restart', title: 'Restart game' }],
    });
    await mf.dispose();

    mf = makeWorker('on', path);
    const recovered = await queueStub(mf);
    assert.equal((await recovered.status('restart', id)).state, 'pending');
    assert.deepEqual((await queueSnapshot(recovered)).queued, [{ key: 'restart', title: 'Restart game' }]);
    await recovered.enqueue('missing', { maxAgeDays: 1 }, true, 'Missing game');
    assert.equal((await waitFor(recovered, 'restart', id)).state, 'done');
  } finally {
    await mf.dispose();
    await rm(path, { recursive: true, force: true });
  }
});
