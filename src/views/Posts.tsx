import { BLOG_TITLE, adminPosts, type PostDraft, type PostRef } from '../blog';
import { Layout } from './Layout';
import { formatDate } from './Blog';
import { MEDIA_PATH } from '../media';

export const PostList = ({ refs }: { refs: PostRef[] }) => (
  <Layout title="Posts">
    <h1>Posts <small>{refs.length}</small></h1>
    <p class="actions"><a href="/posts/new">New post</a><a href="/">View blog</a></p>
    {refs.length === 0 ? <p class="meta">No posts yet.</p> : (
      <table class="list">
        <thead><tr><th>Title</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          {adminPosts(refs).map(({ id, meta }) => (
            <tr>
              <td><a href={`/posts/${id}`}>{meta.title}</a></td>
              <td>{meta.published ? 'Published' : 'Draft'}</td>
              <td class="date">{meta.date ? formatDate(meta.date) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </Layout>
);

const ImageItem = ({ imageKey, base }: { imageKey?: string; base: string }) => (
  <li class="image-item" data-image data-key={imageKey}>
    <img src={imageKey ? `${base}/${imageKey}` : undefined} alt="" loading="lazy" />
    <code>{imageKey?.slice('blog/'.length, 'blog/'.length + 8)}…{imageKey?.slice(-4)}</code>
    {imageKey && <input type="hidden" name="images" value={imageKey} />}
    <button type="button" data-action="insert-image">Insert</button>
    <button type="button" data-action="remove-image">Remove</button>
  </li>
);

export const PostEditor = ({ draft, id, publicUrl, mediaBase = '', saved = false, errors = [] }: {
  draft: PostDraft; id?: string; /** Public URL of the saved version, when published. */ publicUrl?: string; mediaBase?: string; saved?: boolean; errors?: string[];
}) => (
  <Layout title={id ? draft.title || 'Post' : 'New post'}>
    <h1>{id ? draft.title || 'Post' : 'New post'}</h1>
    {saved && <p class="notice">Saved.</p>}
    {errors.length > 0 && <ul class="errors">{errors.map(error => <li>{error}</li>)}</ul>}
    <form method="post" action={id ? `/posts/${id}` : '/posts'} class="tx-form">
      <label>Title<input name="title" value={draft.title} required maxlength={120} /></label>
      <label>Slug (optional, defaults to the title). The public URL is /post/&lt;date&gt;-&lt;slug&gt;, so changing the slug or date of a published post changes its URL.
        <input name="slug" value={draft.slug} maxlength={120} pattern="[a-z0-9\-]+" />
      </label>
      <label>Body (Markdown: headings, lists, quotes, code, links, images)<textarea name="body" rows={24} required maxlength={100000} data-post-body>{draft.body}</textarea></label>
      <fieldset class="game-embed" data-game-embed>
        <legend>Game card</legend>
        <p class="hint">Insert adds ![game:slug] at the cursor; the game's card appears at that spot on the post.</p>
        <label>Find a game in the library
          <input type="search" list="game-options" autocomplete="off" placeholder="Search by title…" data-game-search />
        </label>
        <datalist id="game-options" data-game-options></datalist>
        <div class="actions"><button type="button" data-action="insert-game">Insert</button><span class="meta" data-game-status role="status"></span></div>
      </fieldset>
      <fieldset class="image-gallery" data-image-gallery data-media-base={mediaBase || MEDIA_PATH}>
        <legend>Images</legend>
        <ul class="image-list" data-image-list>
          {draft.images.map(key => <ImageItem imageKey={key} base={mediaBase || MEDIA_PATH} />)}
        </ul>
        <template id="image-template"><ImageItem base="" /></template>
        <label>Upload images (PNG, JPEG, GIF, WebP, AVIF; up to 10 MB). Uploaded images stay attached to this post once saved, even if the text does not use them; Remove only detaches them, the file stays in the bucket.
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" multiple data-image-upload />
        </label>
        <span class="meta" data-image-status role="status"></span>
      </fieldset>
      <div class="row">
        <label class="check"><input type="checkbox" name="published" checked={draft.published} /> Published on {BLOG_TITLE}</label>
        <label>Date (defaults to today when published)<input name="date" type="date" value={draft.date} /></label>
      </div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        {id && <a href={`/posts/${id}/preview`} target="_blank" rel="noopener">Preview</a>}
        {publicUrl && <a href={publicUrl} target="_blank" rel="noopener">View on blog</a>}
        <a href="/posts">Back to posts</a>
      </div>
    </form>
    {id && (
      <form method="post" action={`/posts/${id}/delete`} data-confirm={`Delete ${draft.title || 'this post'}? This cannot be undone.`} class="actions">
        <button type="submit" class="danger">Delete post</button>
      </form>
    )}
  </Layout>
);
