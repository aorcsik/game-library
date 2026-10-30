import { raw } from 'hono/html';
import type { Child } from 'hono/jsx';
import { BLOG_TITLE, postUrl, type Post, type PostRef } from '../blog';
import type { CreditLink, GameCard } from '../gameCard';
import { mapImages, parseMarkdown, type Block, type Inline } from '../markdown';
import { MEDIA_PATH } from '../media';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const formatDate = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
};

// The blog is public and must never link to the (authenticated) game library.
export const BlogLayout = ({ title, description, children }: { title?: string; description?: string; children?: Child }) => (
  <>
    {raw('<!DOCTYPE html>')}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ? `${title} · ${BLOG_TITLE}` : BLOG_TITLE}</title>
        {description && <meta name="description" content={description} />}
        <link rel="stylesheet" href="/assets/blog.css" />
        <script type="module" src="/assets/blog.js"></script>
      </head>
      <body>
        <header class="site-header">
          <a class="site-title" href="/">{BLOG_TITLE}</a>
        </header>
        <main>{children}</main>
        <footer class="site-footer">© {new Date().getFullYear()} {BLOG_TITLE}</footer>
      </body>
    </html>
  </>
);

const Inlines = ({ nodes }: { nodes: Inline[] }) => (
  <>
    {nodes.map(node => {
      switch (node.type) {
        case 'text': return node.value;
        case 'code': return <code>{node.value}</code>;
        case 'strong': return <strong><Inlines nodes={node.children} /></strong>;
        case 'em': return <em><Inlines nodes={node.children} /></em>;
        case 'link': return <a href={node.href} rel="noopener noreferrer"><Inlines nodes={node.children} /></a>;
        case 'image': return <img src={node.src} alt={node.alt} loading="lazy" />;
      }
    })}
  </>
);

const ExternalLink = ({ href, children }: { href?: string; children?: Child }) =>
  href ? <a class="external" href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <>{children}</>;

const Credits = ({ label, credits }: { label: string; credits: CreditLink[] }) => (
  <>
    {label}: {credits.map(({ name, href }, i) => (
      <>
        {i > 0 && ', '}
        {href ? <a href={href} target="_blank" rel="noopener noreferrer">{name}</a> : name}
      </>
    ))}
  </>
);

// Mirrors the game details header in the admin so both share the review styles (open-critic.css, metacritic.css, steam.css).
export const GameCardView = ({ card }: { card: GameCard }) => {
  const ratings = [
    card.opencritic && (
      <ExternalLink href={card.opencritic.href}>
        <div class={`open-critic-container tier-${card.opencritic.tier?.toLowerCase() ?? 'n-a'}`}>
          <span class="open-critic-logo" aria-label="OpenCritic"></span>
          <span class="open-critic-tier">{card.opencritic.tier}</span>
          <span class="open-critic-score">{card.opencritic.score}</span>
        </div>
      </ExternalLink>
    ),
    card.metacritic && (
      <ExternalLink href={card.metacritic.href}>
        <div class="metacritic-container">
          <span class="metacritic-logo" aria-label="Metacritic"></span>
          <span class={`metacritic-score ${card.metacritic.tone}${card.metacritic.mustPlay ? ' must-play' : ''}`}>{card.metacritic.score ?? 'tbd'}</span>
        </div>
      </ExternalLink>
    ),
    card.steam && (
      <ExternalLink href={card.steam.href}>
        <span class={`steam-review ${card.steam.tone}`}>
          <i class="platform-icon icon-steam" role="img" aria-label="Steam"></i>
          {card.steam.review}
        </span>
      </ExternalLink>
    ),
  ].filter(Boolean);
  return (
    <aside class="game-card" aria-label={`Game: ${card.title}`}>
      {card.cover && <img src={card.cover} alt="" loading="lazy" referrerpolicy="no-referrer" />}
      <div class="game-card-info">
        <p class="game-card-title">{card.title}</p>
        <small class="game-release-genres">{card.year && <><span title={card.release ?? 'unknown'}>{card.year}</span> &bull;</>} {card.genres.join(', ')}</small>
        {ratings.length > 0 && (
          <div class="game-rating-row">
            {ratings.map((rating, i) => <>{i > 0 && <>&bull;</>}{rating}</>)}
          </div>
        )}
        {card.description && <p class="game-card-description" data-card-description>{card.description}</p>}
        {(card.developers.length > 0 || card.publishers.length > 0) && (
          <div class="game-card-credits">
            {card.developers.length > 0 && <small class="game-release-genres"><Credits label="Developers" credits={card.developers} /></small>}
            {card.publishers.length > 0 && <small class="game-release-genres"><Credits label="Publishers" credits={card.publishers} /></small>}
          </div>
        )}
      </div>
    </aside>
  );
};

type GameCards = { games?: ReadonlyMap<string, GameCard>; showMissing?: boolean };

const Blocks = ({ blocks, games, showMissing }: { blocks: Block[] } & GameCards) => (
  <>
    {blocks.map(block => {
      switch (block.type) {
        case 'heading': {
          const Tag = `h${block.level}` as 'h2' | 'h3' | 'h4';
          return <Tag><Inlines nodes={block.children} /></Tag>;
        }
        case 'paragraph': return <p><Inlines nodes={block.children} /></p>;
        case 'quote': return <blockquote><Blocks blocks={block.children} games={games} showMissing={showMissing} /></blockquote>;
        case 'list': {
          const Tag = block.ordered ? 'ol' : 'ul';
          return <Tag>{block.items.map(item => <li><Inlines nodes={item} /></li>)}</Tag>;
        }
        case 'code': return <pre><code>{block.value}</code></pre>;
        case 'rule': return <hr />;
        case 'game': {
          const card = games?.get(block.key);
          if (card) return <GameCardView card={card} />;
          return showMissing ? <p class="preview">Unknown game: {block.key}</p> : null;
        }
      }
    })}
  </>
);

export const Markdown = ({ source, mediaBase = '', games, showMissing }: { source: string; mediaBase?: string } & GameCards) => {
  const blocks = parseMarkdown(source);
  return <Blocks games={games} showMissing={showMissing} blocks={mediaBase ? mapImages(blocks, src => src.startsWith(`${MEDIA_PATH}/`) ? mediaBase + src.slice(MEDIA_PATH.length) : src) : blocks} />;
};

export const PostArticle = ({ post, mediaBase, games, showMissing }: { post: Post; mediaBase?: string } & GameCards) => (
  <article class="post">
    <header>
      <h1>{post.title}</h1>
      {post.date && <p class="post-date"><time datetime={post.date}>{formatDate(post.date)}</time></p>}
    </header>
    <div class="post-body"><Markdown source={post.body} mediaBase={mediaBase} games={games} showMissing={showMissing} /></div>
  </article>
);

export const BlogIndex = ({ posts }: { posts: PostRef[] }) => (
  <BlogLayout>
    {posts.length === 0
      ? <p class="empty">Nothing here yet.</p>
      : (
        <ol class="post-list">
          {posts.map(({ meta }) => (
            <li>
              <a href={postUrl(meta)}>{meta.title}</a>
              <time datetime={meta.date}>{formatDate(meta.date!)}</time>
            </li>
          ))}
        </ol>
      )}
  </BlogLayout>
);

export const BlogPostPage = ({ post, preview = false, mediaBase, games }: { post: Post; preview?: boolean; mediaBase?: string; games?: ReadonlyMap<string, GameCard> }) => (
  <BlogLayout title={post.title}>
    {preview && <p class="preview">Preview{post.published ? '' : ' — this draft is not public'}</p>}
    <PostArticle post={post} mediaBase={mediaBase} games={games} showMissing={preview} />
    <p class="back"><a href="/">← All posts</a></p>
  </BlogLayout>
);

export const BlogNotFound = () => (
  <BlogLayout title="Not found">
    <p class="empty">This page could not be found.</p>
    <p class="back"><a href="/">← All posts</a></p>
  </BlogLayout>
);
