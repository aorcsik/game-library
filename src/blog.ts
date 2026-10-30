import { slugify } from './games.ts';
import { MEDIA_KEY_PATTERN, referencedMediaKeys } from './media.ts';

export type Post = {
  /** Stable identity (storage key and admin URL); the public URL is built from the date and slug, which may change. */
  id: string;
  slug: string;
  title: string;
  /** Markdown source. */
  body: string;
  /** Uploaded image keys kept with the post, whether or not the Markdown uses them yet. */
  images?: string[];
  published: boolean;
  /** Publication date (YYYY-MM-DD); required once published. */
  date?: string;
  updatedAt: string;
};
/** Stored as KV metadata so lists never need to load post bodies (KV metadata is limited to 1 KB). */
export type PostMeta = Pick<Post, 'slug' | 'title' | 'published' | 'date' | 'updatedAt'>;
export type PostRef = { id: string; meta: PostMeta };
export type PostDraft = { slug: string; title: string; body: string; images: string[]; published: boolean; date: string };

export const POST_ID_PATTERN = /^[0-9a-f]{10}$/;
export const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;
export const TITLE_MAX = 120;
export const BODY_MAX = 100_000;
export const IMAGES_MAX = 100;
export const BLOG_TITLE = 'aōrora ludens';

const POST_PREFIX = 'post:';
export const postKey = (id: string): string => `${POST_PREFIX}${id}`;
export const newPostId = (): string => crypto.randomUUID().replaceAll('-', '').slice(0, 10);

export const toPostMeta = ({ slug, title, published, date, updatedAt }: Post): PostMeta => ({ slug, title, published, date, updatedAt });

/** The last segment of a public post URL: `/post/<date>-<slug>`. */
export const postPath = (date: string, slug: string): string => `${date}-${slug}`;
export const postUrl = (post: { date?: string; slug: string }): string => `/post/${postPath(post.date ?? '', post.slug)}`;

export const emptyPostDraft = (): PostDraft => ({ slug: '', title: '', body: '', images: [], published: false, date: '' });

/** Attached images plus any the text references (older posts have no stored list). */
export const postImages = (post: Pick<Post, 'body' | 'images'>): string[] =>
  [...new Set([...(post.images ?? []), ...referencedMediaKeys(post.body)])];

export const toPostDraft = (post: Post): PostDraft => ({
  slug: post.slug, title: post.title, body: post.body, images: postImages(post), published: post.published, date: post.date ?? '',
});

export const readPostDraft = (form: FormData): PostDraft => {
  const text = (name: string): string => String(form.get(name) ?? '');
  return {
    slug: text('slug').trim(),
    title: text('title').trim(),
    body: text('body').replace(/\r\n?/g, '\n'),
    images: form.getAll('images').map(String),
    published: form.get('published') === 'on',
    date: text('date').trim(),
  };
};

const isIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

/**
 * New posts come from the form with a fresh `id`; edits pass the existing one. `others` are the other
 * posts' refs, used to reject a published post whose `<date>-<slug>` URL is already taken.
 * `today` and `now` are injected so validation stays pure.
 */
export const validatePost = (
  draft: PostDraft,
  options: { id: string; others?: PostRef[]; today: string; now: string },
): { post?: Post; errors: string[] } => {
  const errors: string[] = [];
  const slug = draft.slug || slugify(draft.title);
  if (!draft.title) errors.push('Title is required.');
  else if (draft.title.length > TITLE_MAX) errors.push(`Title must be at most ${TITLE_MAX} characters.`);
  if (!draft.body.trim()) errors.push('Body is required.');
  else if (draft.body.length > BODY_MAX) errors.push(`Body must be at most ${BODY_MAX} characters.`);
  if (!SLUG_PATTERN.test(slug)) errors.push('Slug may only contain lowercase letters, numbers and hyphens (max 120 characters).');
  if (draft.images.some(key => !MEDIA_KEY_PATTERN.test(key))) errors.push('Invalid image reference.');
  else if (draft.images.length > IMAGES_MAX) errors.push(`A post can have at most ${IMAGES_MAX} images.`);
  if (draft.date && !isIsoDate(draft.date)) errors.push('Date must be a valid YYYY-MM-DD date.');
  const date = draft.date || (draft.published ? options.today : undefined);
  const clash = draft.published && date
    ? options.others?.find(ref => ref.id !== options.id && ref.meta.published && ref.meta.date === date && ref.meta.slug === slug)
    : undefined;
  if (clash) {
    errors.push(`"${clash.meta.title}" is already published on ${date} with the slug "${slug}", so both would share the URL ${postUrl({ date, slug })}. Change the slug or the date.`);
  }
  if (errors.length) return { errors };
  return {
    errors,
    post: {
      id: options.id,
      slug,
      title: draft.title,
      body: draft.body,
      images: postImages(draft),
      published: draft.published,
      date,
      updatedAt: options.now,
    },
  };
};

/** Finds the published post for a `<date>-<slug>` URL segment (the oldest edit wins if a clash slipped through). */
export const findPublishedPost = (refs: PostRef[], path: string): PostRef | undefined =>
  refs
    .filter(ref => ref.meta.published && ref.meta.date && postPath(ref.meta.date, ref.meta.slug) === path)
    .sort((a, b) => a.meta.updatedAt.localeCompare(b.meta.updatedAt) || a.id.localeCompare(b.id))[0];

/** Public posts, newest first. */
export const publishedPosts = (refs: PostRef[]): PostRef[] =>
  refs
    .filter(ref => ref.meta.published && ref.meta.date)
    .sort((a, b) => b.meta.date!.localeCompare(a.meta.date!) || a.meta.slug.localeCompare(b.meta.slug) || a.id.localeCompare(b.id));

/** Drafts first, then newest by date. */
export const adminPosts = (refs: PostRef[]): PostRef[] =>
  [...refs].sort((a, b) =>
    Number(a.meta.published) - Number(b.meta.published) ||
    (b.meta.date ?? b.meta.updatedAt).localeCompare(a.meta.date ?? a.meta.updatedAt));

export const listPosts = async (kv: KVNamespace): Promise<PostRef[]> => {
  const refs: PostRef[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list<PostMeta>({ prefix: POST_PREFIX, cursor });
    for (const key of page.keys) if (key.metadata) refs.push({ id: key.name.slice(POST_PREFIX.length), meta: key.metadata });
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return refs;
};

export const getPost = (kv: KVNamespace, id: string): Promise<Post | null> =>
  kv.get<Post>(postKey(id), 'json');

export const savePost = (kv: KVNamespace, post: Post): Promise<void> =>
  kv.put(postKey(post.id), JSON.stringify(post), { metadata: toPostMeta(post) });

export const deletePost = (kv: KVNamespace, id: string): Promise<void> => kv.delete(postKey(id));
