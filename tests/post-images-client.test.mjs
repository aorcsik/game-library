import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

const KEY = `blog/${'a'.repeat(32)}.png`;

test('uploaded images join the gallery, can be inserted into the text, and can be detached', async () => {
  const { document, Event } = parseHTML(`
    <form>
      <textarea data-post-body></textarea>
      <fieldset data-image-gallery data-media-base="https://assets.example.com">
        <ul data-image-list></ul>
        <template id="image-template"><li data-image><img alt=""><code></code>
          <button type="button" data-action="insert-image"></button><button type="button" data-action="remove-image"></button></li></template>
        <input type="file" data-image-upload>
        <span data-image-status></span>
      </fieldset>
    </form>
  `);
  const body = document.querySelector('textarea');
  // linkedom has no selection API, so emulate the parts the script relies on.
  Object.assign(body, { selectionStart: 0, selectionEnd: 0, focus() {} });
  body.setRangeText = (text, start, end) => { body.value = body.value.slice(0, start) + text + body.value.slice(end); };
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { value: [{ name: 'My [shot](1).png' }] });
  const requests = [];
  const originals = { document: globalThis.document, fetch: globalThis.fetch };
  globalThis.document = document;
  globalThis.fetch = async (path, options) => {
    requests.push({ path, method: options.method });
    return Response.json({ key: KEY, url: `/media/${KEY}` }, { status: 201 });
  };

  try {
    const bundle = await build({ entryPoints: ['src/client/admin.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
    await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
    const settle = () => new Promise(resolve => setTimeout(resolve, 10));

    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    assert.deepEqual(requests, [{ path: '/media', method: 'POST' }]);
    assert.equal(body.value, '', 'uploading alone does not touch the text');
    const hidden = () => [...document.querySelectorAll('input[name="images"]')].map(el => el.value);
    assert.deepEqual(hidden(), [KEY]);
    assert.equal(document.querySelector('[data-image] img').getAttribute('src'), `https://assets.example.com/${KEY}`);

    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    assert.deepEqual(hidden(), [KEY], 'the same image is not attached twice');

    document.querySelector('[data-action="insert-image"]').dispatchEvent(new Event('click', { bubbles: true }));
    assert.equal(body.value, `![My  shot  1](/media/${KEY})\n\n`);

    document.querySelector('[data-action="remove-image"]').dispatchEvent(new Event('click', { bubbles: true }));
    assert.deepEqual(hidden(), []);
    assert.equal(body.value.includes(KEY), true, 'removing from the gallery leaves the text alone');
  } finally {
    globalThis.document = originals.document;
    globalThis.fetch = originals.fetch;
  }
});
