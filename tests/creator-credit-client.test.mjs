import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

test('credit notes are saved explicitly and checkbox changes do not submit draft notes', async () => {
  const { document, Event } = parseHTML(`
    <ul><li><form action="/creators/studio/games/game" data-creator-credit>
      <input name="credited" type="checkbox" value="1" checked>
      <span data-credit-note-display><small data-credit-note-text>Original note</small>
        <button type="button" data-action="edit-credit-note"></button></span>
      <span data-credit-note-editor hidden>
        <input name="notes" value="Original note" disabled>
        <button type="button" data-action="save-credit-note"></button>
        <button type="button" data-action="cancel-credit-note"></button>
      </span>
      <small data-creator-credit-status></small>
    </form></li></ul>
  `);
  const form = document.querySelector('form');
  const checkbox = form.querySelector('[name="credited"]');
  const notes = form.querySelector('[name="notes"]');
  const display = form.querySelector('[data-credit-note-display]');
  const editor = form.querySelector('[data-credit-note-editor]');
  const status = form.querySelector('[data-creator-credit-status]');
  const requests = [];
  let savedNote = 'Original note';
  let failNext = false;
  let defaultNote = 'Original note';
  let defaultChecked = true;
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalFormData = globalThis.FormData;
  const originalConsoleError = console.error;
  const errors = [];

  Object.defineProperty(checkbox, 'form', { value: form });
  Object.defineProperty(checkbox, 'defaultChecked', {
    get: () => defaultChecked, set: value => { defaultChecked = value; },
  });
  Object.defineProperty(notes, 'defaultValue', {
    get: () => defaultNote, set: value => { defaultNote = value; },
  });
  form.requestSubmit = () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  globalThis.document = document;
  console.error = (...args) => { errors.push(args); };
  globalThis.FormData = class extends originalFormData {
    constructor(source) {
      super();
      if (!source) return;
      for (const input of source.querySelectorAll('input[name]')) {
        if (!input.disabled && (input.type !== 'checkbox' || input.checked)) this.append(input.name, input.value);
      }
    }
  };
  globalThis.fetch = async (_url, options) => {
    const body = options.body;
    requests.push({ credited: body.has('credited'), notes: body.get('notes') });
    if (failNext) {
      failNext = false;
      return Response.json({ error: 'Try again' }, { status: 503 });
    }
    if (body.has('notes')) savedNote = body.get('notes').trim();
    return Response.json({ ok: true, link: savedNote ? { notes: savedNote } : {} });
  };

  try {
    const bundle = await build({
      entryPoints: ['src/client/admin.ts'], bundle: true, write: false, format: 'esm', platform: 'browser',
    });
    await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
    const click = action => form.querySelector(`[data-action="${action}-credit-note"]`)
      .dispatchEvent(new Event('click', { bubbles: true }));
    const settle = () => new Promise(resolve => setTimeout(resolve, 0));

    click('edit');
    assert.equal(display.hidden, true);
    assert.equal(editor.hidden, false);
    assert.equal(notes.disabled, false);
    notes.value = 'Unsaved draft';
    click('cancel');
    assert.equal(requests.length, 0);
    assert.equal(notes.value, 'Original note');
    assert.equal(editor.hidden, true);
    assert.equal(notes.disabled, true);

    click('edit');
    notes.value = 'Draft while unchecking';
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    assert.deepEqual(requests[0], { credited: false, notes: null });
    assert.equal(notes.value, 'Draft while unchecking');
    assert.equal(editor.hidden, false);
    assert.equal(notes.disabled, false);

    failNext = true;
    click('save');
    await settle();
    assert.deepEqual(requests[1], { credited: false, notes: 'Draft while unchecking' });
    assert.match(status.textContent, /Try again/);
    assert.equal(errors.length, 1);
    assert.equal(editor.hidden, false);
    assert.equal(notes.value, 'Draft while unchecking');

    click('save');
    await settle();
    assert.equal(savedNote, 'Draft while unchecking');
    assert.equal(editor.hidden, true);
    assert.equal(display.hidden, false);
    assert.equal(notes.disabled, true);
    assert.equal(display.querySelector('[data-credit-note-text]').textContent, savedNote);

    click('edit');
    notes.value = 'Updated with Enter';
    form.requestSubmit();
    await settle();
    assert.deepEqual(requests[3], { credited: false, notes: 'Updated with Enter' });
    assert.equal(display.querySelector('[data-credit-note-text]').textContent, 'Updated with Enter');
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    globalThis.FormData = originalFormData;
    console.error = originalConsoleError;
  }
});
