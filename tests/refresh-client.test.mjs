import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { initGameRefreshButton } from '../src/client/refresh.ts';

const result = status => ({
  changed: status === 'fetched',
  sources: {
    steam: { status: 'fresh' },
    opencritic: { status, ...(status === 'error' ? { error: 'Source unavailable' } : {}) },
    metacritic: { status: 'missing' },
  },
  proposed: {},
});

const runPage = async (initialState, replies) => {
  const original = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    sessionStorage: globalThis.sessionStorage,
    location: globalThis.location,
    setTimeout: globalThis.setTimeout,
  };
  const { document } = parseHTML(
    `<button data-refresh-game="automatic">Refresh</button><span data-refresh-status data-auto-refresh-id="job-id" data-auto-refresh-state="${initialState}"></span>`,
  );
  const saved = new Map();
  let reloads = 0;
  let requests = 0;
  try {
    globalThis.document = document;
    globalThis.fetch = async () => {
      const reply = replies[requests++];
      if (!reply) throw new Error('Unexpected refresh status request');
      return Response.json(reply);
    };
    globalThis.sessionStorage = {
      getItem: key => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: key => saved.delete(key),
    };
    globalThis.location = { reload: () => { reloads++; } };
    globalThis.setTimeout = callback => { queueMicrotask(callback); return 0; };
    const button = document.querySelector('button');
    initGameRefreshButton(button);
    await new Promise(resolve => original.setTimeout(resolve, 20));
    return {
      buttonDisabled: button.disabled,
      message: document.querySelector('[data-refresh-status]').textContent,
      savedMessage: saved.get('refresh-status'),
      reloads,
      requests,
    };
  } finally {
    Object.assign(globalThis, original);
  }
};

test('automatic refresh polls and reloads once when new ratings arrive', async () => {
  const page = await runPage('pending', [
    { state: 'pending' },
    { state: 'running' },
    { state: 'done', result: result('fetched') },
  ]);
  assert.equal(page.requests, 3);
  assert.equal(page.reloads, 1);
  assert.match(page.savedMessage, /^Updated\./);
});

test('source errors conclude on the page without reloading', async () => {
  const page = await runPage('running', [{ state: 'done', result: result('error') }]);
  assert.equal(page.reloads, 0);
  assert.equal(page.buttonDisabled, false);
  assert.match(page.message, /Refresh finished with errors.*Source unavailable/);
});

test('completed jobs on a reopened stale page do not cause another reload', async () => {
  const page = await runPage('done', [{ state: 'done', result: result('fetched') }]);
  assert.equal(page.reloads, 0);
  assert.match(page.message, /^Updated\./);
});

test('failed queue jobs report their error and allow retry', async () => {
  const page = await runPage('pending', [{ state: 'failed', error: 'Game not found' }]);
  assert.equal(page.reloads, 0);
  assert.equal(page.buttonDisabled, false);
  assert.match(page.message, /Automatic refresh failed: Game not found/);
});
