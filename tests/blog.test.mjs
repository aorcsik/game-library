import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminPosts, emptyPostDraft, findPublishedPost, postUrl, publishedPosts, toPostMeta, validatePost } from '../src/blog.ts';

const context = { id: 'aaaaaaaaaa', today: '2026-10-29', now: '2026-10-29T12:00:00.000Z' };
const draft = (overrides = {}) => ({ ...emptyPostDraft(), title: 'Hello, Wörld!', body: 'Text', ...overrides });

test('derives the slug from the title and dates a newly published post', () => {
  const { post, errors } = validatePost(draft({ published: true }), context);
  assert.deepEqual(errors, []);
  assert.equal(post.slug, 'hello-world');
  assert.equal(post.date, context.today);
});

test('keeps drafts undated unless a date is given', () => {
  assert.equal(validatePost(draft(), context).post.date, undefined);
  assert.equal(validatePost(draft({ date: '2026-01-02' }), context).post.date, '2026-01-02');
});

test('rejects invalid input', () => {
  assert.ok(validatePost(draft({ title: '' }), context).errors.length);
  assert.ok(validatePost(draft({ body: '  ' }), context).errors.length);
  assert.ok(validatePost(draft({ slug: 'Bad Slug' }), context).errors.length);
  assert.ok(validatePost(draft({ date: '2026-02-30' }), context).errors.length);
});

test('keeps metadata well under the KV limit for long titles and slugs', () => {
  const { post } = validatePost(draft({ title: '€'.repeat(120), slug: 'a'.repeat(120), published: true }), context);
  assert.ok(new TextEncoder().encode(JSON.stringify(toPostMeta(post))).length < 1024);
});

const ref = (id, slug, published, date, updatedAt = '2026-01-01') => ({ id, meta: { slug, title: slug, published, date, updatedAt } });

test('builds public URLs from the date and slug', () => {
  assert.equal(postUrl({ date: '2026-10-29', slug: 'hello' }), '/post/2026-10-29-hello');
});

test('rejects publishing a second post with the same slug on the same day', () => {
  const others = [ref('bbbbbbbbbb', 'hello-world', true, '2026-10-29')];
  const { post, errors } = validatePost(draft({ published: true }), { ...context, others });
  assert.equal(post, undefined);
  assert.match(errors[0], /already published on 2026-10-29 with the slug "hello-world"/);
  assert.match(errors[0], /\/post\/2026-10-29-hello-world/);
});

test('allows the same slug on other days, against drafts, for drafts, and for the post itself', () => {
  const published = published => ({ published });
  assert.deepEqual(validatePost(draft(published(true)), { ...context, others: [ref('bbbbbbbbbb', 'hello-world', true, '2026-10-28')] }).errors, []);
  assert.deepEqual(validatePost(draft(published(true)), { ...context, others: [ref('bbbbbbbbbb', 'hello-world', false, '2026-10-29')] }).errors, []);
  assert.deepEqual(validatePost(draft(published(true)), { ...context, others: [ref('bbbbbbbbbb', 'other', true, '2026-10-29')] }).errors, []);
  assert.deepEqual(validatePost(draft(published(false)), { ...context, others: [ref('bbbbbbbbbb', 'hello-world', true, '2026-10-29')] }).errors, []);
  assert.deepEqual(validatePost(draft(published(true)), { ...context, others: [ref('aaaaaaaaaa', 'hello-world', true, '2026-10-29')] }).errors, []);
});

test('checks the date a post will actually get, including an explicit past date', () => {
  const others = [ref('bbbbbbbbbb', 'hello-world', true, '2026-01-02')];
  assert.equal(validatePost(draft({ published: true, date: '2026-01-02' }), { ...context, others }).errors.length, 1);
});

test('finds the published post for a date-slug path', () => {
  const refs = [
    ref('1111111111', 'a', true, '2026-01-01', '2026-02-01'),
    ref('2222222222', 'a', true, '2026-01-01', '2026-01-01'),
    ref('3333333333', 'a', false, '2026-01-02'),
  ];
  assert.equal(findPublishedPost(refs, '2026-01-01-a').id, '2222222222');
  assert.equal(findPublishedPost(refs, '2026-01-02-a'), undefined);
  assert.equal(findPublishedPost(refs, '2026-01-01-b'), undefined);
});

test('lists only published, dated posts newest first for the public blog', () => {
  const refs = [ref('1', 'old', true, '2026-01-01'), ref('2', 'draft', false, '2026-05-01'), ref('3', 'new', true, '2026-03-01'), ref('4', 'undated', true, undefined, '2026-06-01')];
  assert.deepEqual(publishedPosts(refs).map(r => r.id), ['3', '1']);
  assert.deepEqual(adminPosts(refs).map(r => r.id), ['2', '4', '3', '1']);
});

test('attaches uploaded images and any the text references', () => {
  const kept = `blog/${'a'.repeat(32)}.png`;
  const used = `blog/${'b'.repeat(32)}.jpg`;
  const { post, errors } = validatePost(
    draft({ images: [kept, kept], body: `![x](https://assets.example.com/${used})` }), context);
  assert.deepEqual(errors, []);
  assert.deepEqual(post.images, [kept, used]);
  assert.ok(validatePost(draft({ images: ['blog/../etc.png'] }), context).errors.length);
  assert.ok(validatePost(draft({ images: Array.from({ length: 101 }, (_, i) => `blog/${String(i).padStart(32, '0')}.png`) }), context).errors.length);
});
