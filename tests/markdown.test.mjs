import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapImages, parseInline, parseMarkdown, safeUrl } from '../src/markdown.ts';
import { mapMedia, mediaBaseUrl, mediaUrl, referencedMediaKeys, sniffImage } from '../src/media.ts';

test('only allows http(s), mailto, relative and anchor URLs', () => {
  assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(safeUrl('/about'), '/about');
  assert.equal(safeUrl('#top'), '#top');
  assert.equal(safeUrl('mailto:a@example.com'), 'mailto:a@example.com');
  assert.equal(safeUrl('mailto:a@example.com', true), null);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.example', 'vbscript:x', 'JaVaScRiPt:alert(1)']) {
    assert.equal(safeUrl(url), null, url);
  }
});

test('renders unsafe link targets as plain text', () => {
  assert.deepEqual(parseInline('[x](javascript:alert)'), [{ type: 'text', value: '[x](javascript:alert)' }]);
  assert.deepEqual(parseInline('[x](https://a.example)'), [
    { type: 'link', href: 'https://a.example', children: [{ type: 'text', value: 'x' }] },
  ]);
});

test('keeps raw HTML as text so views escape it', () => {
  assert.deepEqual(parseMarkdown('<script>alert(1)</script>'), [
    { type: 'paragraph', children: [{ type: 'text', value: '<script>alert(1)</script>' }] },
  ]);
});

test('parses inline emphasis, code, and images', () => {
  assert.deepEqual(parseInline('a **b** *c* `d*e*` ![alt](https://i.example/x.png)'), [
    { type: 'text', value: 'a ' },
    { type: 'strong', children: [{ type: 'text', value: 'b' }] },
    { type: 'text', value: ' ' },
    { type: 'em', children: [{ type: 'text', value: 'c' }] },
    { type: 'text', value: ' ' },
    { type: 'code', value: 'd*e*' },
    { type: 'text', value: ' ' },
    { type: 'image', src: 'https://i.example/x.png', alt: 'alt' },
  ]);
});

test('parses blocks and shifts headings below the page title', () => {
  const blocks = parseMarkdown('# One\n\npara\nline\n\n- a\n- b\n\n1. x\n\n> quoted\n\n```\ncode **raw**\n```\n\n---\n\n###### deep');
  assert.deepEqual(blocks.map(block => block.type), ['heading', 'paragraph', 'list', 'list', 'quote', 'code', 'rule', 'heading']);
  assert.equal(blocks[0].level, 2);
  assert.equal(blocks[7].level, 4);
  assert.deepEqual(blocks[1].children, [{ type: 'text', value: 'para line' }]);
  assert.equal(blocks[3].ordered, true);
  assert.equal(blocks[5].value, 'code **raw**');
});

test('rewrites image URLs anywhere in the tree', () => {
  const blocks = parseMarkdown('> - ![a](/media/blog/x.png) [l](/media/blog/x.png)\n\n![b](https://other.example/y.png)');
  const mapped = mapImages(blocks, src => src.startsWith('/media/') ? `https://cdn.example${src.slice(6)}` : src);
  assert.equal(mapped[0].children[0].items[0][0].src, 'https://cdn.example/blog/x.png');
  assert.equal(mapped[0].children[0].items[0][2].href, '/media/blog/x.png');
  assert.equal(mapped[1].children[0].src, 'https://other.example/y.png');
});

test('identifies images by content only', () => {
  const bytes = (...values) => Uint8Array.from(values);
  const text = value => [...value].map(char => char.charCodeAt(0));
  assert.equal(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext, 'png');
  assert.equal(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.contentType, 'image/jpeg');
  assert.equal(sniffImage(bytes(...text('GIF89a')))?.ext, 'gif');
  assert.equal(sniffImage(bytes(...text('RIFF'), 0, 0, 0, 0, ...text('WEBP')))?.ext, 'webp');
  assert.equal(sniffImage(bytes(0, 0, 0, 0, ...text('ftypavif')))?.ext, 'avif');
  assert.equal(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(sniffImage(new Uint8Array()), null);
});

test('uses the media domain when configured', () => {
  assert.equal(mediaUrl('blog/a.png'), '/media/blog/a.png');
  assert.equal(mediaUrl('blog/a.png', 'https://cdn.example'), 'https://cdn.example/blog/a.png');
  assert.equal(mediaBaseUrl({ MEDIA_BASE_URL: 'https://cdn.example/' }), 'https://cdn.example');
  assert.equal(mediaBaseUrl({}), '');
});

test('maps bucket objects to the posts that use or merely hold them', () => {
  const key = n => `blog/${String(n).repeat(32)}.png`;
  const post = (id, body, images) => ({ id, title: id, published: true, body, images });
  const objects = ['1', '2', '3', '4'].map((n, i) => ({ key: key(n), size: 1, uploaded: `2026-01-0${i + 1}T00:00:00.000Z` }));
  const items = mapMedia(objects, [
    post('a', `![x](/media/${key(1)}) and ${'https://cdn.example/' + key(2)}`, [key(1), key(3)]),
    post('b', 'text', [key(3)]),
  ]);
  assert.deepEqual(items.map(item => item.key), [key(4), key(3), key(2), key(1)]);
  const byKey = Object.fromEntries(items.map(item => [item.key, item]));
  assert.deepEqual(byKey[key(1)].usedIn.map(u => u.id), ['a']);
  assert.deepEqual(byKey[key(2)].usedIn.map(u => u.id), ['a']);
  assert.deepEqual(byKey[key(3)].attachedTo.map(u => u.id), ['a', 'b']);
  assert.ok(!byKey[key(4)].usedIn.length && !byKey[key(4)].attachedTo.length);
  assert.deepEqual(referencedMediaKeys('nothing here'), []);
});
