import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

test('game search fills suggestions and Insert adds the embed at the cursor', async () => {
  const { document, Event } = parseHTML(`
    <form>
      <textarea data-post-body></textarea>
      <fieldset data-game-embed>
        <input type="search" list="game-options" data-game-search>
        <datalist id="game-options" data-game-options></datalist>
        <button type="button" data-action="insert-game"></button>
        <span data-game-status></span>
      </fieldset>
    </form>
  `);
  const body = document.querySelector('textarea');
  Object.assign(body, { selectionStart: 0, selectionEnd: 0, focus() {} });
  body.setRangeText = (text, start, end) => { body.value = body.value.slice(0, start) + text + body.value.slice(end); };
  const input = document.querySelector('[data-game-search]');
  const status = document.querySelector('[data-game-status]');
  const requests = [];
  const originals = { document: globalThis.document, fetch: globalThis.fetch };
  globalThis.document = document;
  globalThis.fetch = async path => {
    requests.push(path);
    return Response.json([
      { key: 'signalis', title: 'Signalis', year: '2022' },
      { key: 'old-signalis', title: 'Signalis', year: '2022' },
      { key: 'sigma', title: 'Sigma' },
    ]);
  };

  try {
    const bundle = await build({ entryPoints: ['src/client/admin.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
    await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
    const settle = () => new Promise(resolve => setTimeout(resolve, 300));
    const click = () => document.querySelector('[data-action="insert-game"]').dispatchEvent(new Event('click', { bubbles: true }));

    click();
    assert.match(status.textContent, /Pick a game/);
    assert.equal(body.value, '');

    input.value = 'sig';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    assert.deepEqual(requests, ['/posts/games?q=sig']);
    assert.deepEqual([...document.querySelectorAll('option')].map(option => option.value),
      ['Signalis (2022) [signalis]', 'Signalis (2022) [old-signalis]', 'Sigma']);

    input.value = 'Typed but not chosen';
    click();
    assert.equal(body.value, '');

    input.value = 'Signalis (2022) [old-signalis]';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    assert.equal(requests.length, 1, 'choosing a suggestion does not search again');
    click();
    assert.equal(body.value, '![game:old-signalis]\n\n');
    assert.equal(input.value, '');
  } finally {
    globalThis.document = originals.document;
    globalThis.fetch = originals.fetch;
  }
});
