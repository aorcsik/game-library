import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

test('creator table sorts whole expandable sections by name and game count', async () => {
  const { document, Event } = parseHTML(`
    <table class="creator-list" data-sort="name" data-direction="asc">
      <thead><tr>
        <th aria-sort="ascending"><button data-creator-sort="name">Creator <span data-sort-indicator>↑</span></button></th>
        <th><button data-creator-sort="games">Games <span data-sort-indicator></span></button></th>
      </tr></thead>
      <tbody data-expandable data-creator-name="Alpha" data-game-count="2"><tr><td>Alpha</td></tr><tr data-items hidden><td>Alpha games</td></tr></tbody>
      <tbody data-expandable data-creator-name="Beta" data-game-count="2"><tr><td>Beta</td></tr><tr data-items hidden><td>Beta games</td></tr></tbody>
      <tbody data-expandable data-creator-name="Zulu" data-game-count="0"><tr><td>Zulu</td></tr><tr data-items hidden><td>Zulu games</td></tr></tbody>
    </table>
  `);
  const table = document.querySelector('table.creator-list');
  const beta = table.querySelector('[data-creator-name="Beta"]');
  beta.querySelector('[data-items]').removeAttribute('hidden');
  beta.hidden = true;
  const originalDocument = globalThis.document;
  globalThis.document = document;
  try {
    const bundle = await build({ entryPoints: ['src/client/admin.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
    await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
    const order = () => [...table.querySelectorAll('tbody[data-expandable]')].map(section => section.dataset.creatorName);
    const click = sort => table.querySelector(`[data-creator-sort="${sort}"]`).dispatchEvent(new Event('click', { bubbles: true }));
    assert.deepEqual(order(), ['Alpha', 'Beta', 'Zulu']);

    click('name');
    assert.deepEqual(order(), ['Zulu', 'Beta', 'Alpha']);
    assert.equal(table.querySelector('th[aria-sort="descending"] [data-creator-sort="name"] [data-sort-indicator]').textContent, '↓');

    click('games');
    assert.deepEqual(order(), ['Alpha', 'Beta', 'Zulu']);
    assert.equal(table.querySelector('th[aria-sort="descending"] [data-creator-sort="games"] [data-sort-indicator]').textContent, '↓');
    assert.equal(table.querySelector('[data-creator-sort="name"] [data-sort-indicator]').textContent, '');

    click('games');
    assert.deepEqual(order(), ['Zulu', 'Alpha', 'Beta']);
    assert.equal(table.querySelector('th[aria-sort="ascending"] [data-creator-sort="games"] [data-sort-indicator]').textContent, '↑');
    assert.equal(beta.hidden, true);
    assert.equal(beta.querySelector('[data-items]').hasAttribute('hidden'), false);
  } finally {
    globalThis.document = originalDocument;
  }
});
