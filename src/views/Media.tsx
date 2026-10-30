import { MEDIA_PATH, type MediaItem, type MediaUsage } from '../media';
import { formatDate } from './Blog';
import { Layout } from './Layout';

const PostLinks = ({ posts }: { posts: MediaUsage[] }) => (
  <>{posts.map((post, i) => <>{i > 0 && ', '}<a href={`/posts/${post.id}`}>{post.title}</a>{!post.published && ' (draft)'}</>)}</>
);

const size = (bytes: number): string => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const MediaPage = ({ items, mediaBase = '' }: { items: MediaItem[]; mediaBase?: string }) => {
  const base = mediaBase || MEDIA_PATH;
  const unreferenced = items.filter(item => !item.usedIn.length && !item.attachedTo.length).length;
  return (
    <Layout title="Media">
      <h1>Media <small>{items.length}</small></h1>
      {items.length > 0 && <p class="meta">{unreferenced} not attached to any post. Files are never deleted from here.</p>}
      {items.length === 0 ? <p class="meta">No images uploaded yet.</p> : (
        <table class="list media-list">
          <thead><tr><th></th><th>File</th><th>Uploaded</th><th>Size</th><th>Used in</th><th>Attached, not used</th></tr></thead>
          <tbody>
            {items.map(item => (
              <tr>
                <td class="thumb"><a href={`${base}/${item.key}`} target="_blank" rel="noopener"><img src={`${base}/${item.key}`} alt="" loading="lazy" /></a></td>
                <td>{item.filename ?? '—'}<br /><code class="meta">{item.key}</code></td>
                <td class="date">{formatDate(item.uploaded.slice(0, 10))}</td>
                <td class="num">{size(item.size)}</td>
                <td>{item.usedIn.length ? <PostLinks posts={item.usedIn} /> : '—'}</td>
                <td>{item.attachedTo.length ? <PostLinks posts={item.attachedTo} /> : item.usedIn.length ? '—' : <span class="meta">unreferenced</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
};
