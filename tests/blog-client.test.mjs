import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

const load = async (html, { overflow }) => {
  const { document, Event } = parseHTML(html);
  const descriptions = [...document.querySelectorAll('[data-card-description]')];
  // linkedom has no layout: a collapsed description overflows when `overflow[index]` says so.
  descriptions.forEach((el, index) => {
    Object.defineProperty(el, 'clientHeight', { value: 40 });
    Object.defineProperty(el, 'scrollHeight', { get: () => el.classList.contains('expanded') || overflow[index] ? 100 : 40 });
  });
  const observers = [];
  const originals = { document: globalThis.document, ResizeObserver: globalThis.ResizeObserver };
  globalThis.document = document;
  globalThis.ResizeObserver = class { constructor(callback) { observers.push(callback); } observe() {} };
  const bundle = await build({ entryPoints: ['src/client/blog.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}#${Math.random()}`);
  return {
    document, Event, descriptions, observers,
    restore: () => Object.assign(globalThis, originals),
  };
};

test('offers Show more only for descriptions that are cut off, and toggles them', async () => {
  const page = await load('<div><p data-card-description>Long</p><p data-card-description>Short</p></div>', { overflow: [true, false] });
  try {
    const [long, short] = page.descriptions;
    const button = el => el.nextElementSibling;
    assert.equal(button(long).hidden, false);
    assert.equal(button(long).textContent, 'Show more');
    assert.equal(button(long).getAttribute('aria-expanded'), 'false');
    assert.equal(button(short).hidden, true, 'no link when the text already fits');

    button(long).dispatchEvent(new page.Event('click', { bubbles: true }));
    assert.equal(long.classList.contains('expanded'), true);
    assert.equal(button(long).textContent, 'Show less');
    assert.equal(button(long).getAttribute('aria-expanded'), 'true');
    assert.equal(button(long).hidden, false, 'stays available while expanded');

    button(long).dispatchEvent(new page.Event('click', { bubbles: true }));
    assert.equal(long.classList.contains('expanded'), false);
    assert.equal(button(long).textContent, 'Show more');
  } finally {
    page.restore();
  }
});

test('re-checks whether the text is cut off when the available width changes', async () => {
  const overflow = [false];
  const page = await load('<p data-card-description>Text</p>', { overflow });
  try {
    const [description] = page.descriptions;
    assert.equal(description.nextElementSibling.hidden, true);
    overflow[0] = true;
    page.observers.forEach(callback => callback());
    assert.equal(description.nextElementSibling.hidden, false);
  } finally {
    page.restore();
  }
});
