import { Hono } from 'hono';
import { findPublishedPost, getPost, listPosts, publishedPosts } from './blog';
import { postGameCards } from './gameCard';
import { MEDIA_KEY_PATTERN, mediaBaseUrl } from './media';
import { BlogIndex, BlogNotFound, BlogPostPage } from './views/Blog';

// Public, unauthenticated routes. Mount before the admin auth middleware; nothing here may expose
// drafts or link into the game library.
export const blog = new Hono<{ Bindings: { POSTS: KVNamespace; GAMEDB: KVNamespace; CREATORS: KVNamespace; MEDIA: R2Bucket; MEDIA_BASE_URL?: string } }>();

const PUBLIC_CACHE = 'public, max-age=60';

blog.get('/', async c => {
  c.header('Cache-Control', PUBLIC_CACHE);
  return c.html(<BlogIndex posts={publishedPosts(await listPosts(c.env.POSTS))} />);
});

blog.get('/post/:path{\\d{4}-\\d{2}-\\d{2}-[a-z0-9-]{1,120}}', async c => {
  const ref = findPublishedPost(await listPosts(c.env.POSTS), c.req.param('path'));
  const post = ref && await getPost(c.env.POSTS, ref.id);
  if (!post?.published || !post.date) return c.html(<BlogNotFound />, 404);
  c.header('Cache-Control', PUBLIC_CACHE);
  return c.html(<BlogPostPage post={post} mediaBase={mediaBaseUrl(c.env)} games={await postGameCards(c.env, post.body)} />);
});

// Fallback for when MEDIA_BASE_URL is unset; otherwise image URLs are rewritten to the bucket's public domain.
blog.get('/media/blog/:name', async c => {
  const key = `blog/${c.req.param('name')}`;
  if (!MEDIA_KEY_PATTERN.test(key)) return c.notFound();
  const object = await c.env.MEDIA.get(key);
  if (!object) return c.notFound();
  const headers = new Headers({ 'Cache-Control': 'public, max-age=31536000, immutable', ETag: object.httpEtag });
  object.writeHttpMetadata(headers);
  if (c.req.header('If-None-Match') === object.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
});
