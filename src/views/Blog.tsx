import { raw } from 'hono/html';
import type { Child } from 'hono/jsx';
import { BLOG_TITLE, postExcerpt, postUrl, type Post, type PostRef } from '../blog';
import type { CreditLink, GameCard } from '../gameCard';
import { mapImages, parseMarkdown, type Block, type Inline } from '../markdown';
import { MEDIA_PATH } from '../media';

const BLOG_ORIGIN = 'https://ludens.aorcsik.com';
const BLOG_DESCRIPTION = 'Personal writing from aōrora ludens.';
// const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatDate = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  return `${day}∙${MONTHS_SHORT[month - 1].toLocaleLowerCase()}∙${year}`;
};

type SocialMetadata = {
  canonicalUrl?: string;
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  noindex?: boolean;
};

// The blog is public and must never link to the (authenticated) game library.
export const BlogLayout = ({ title, description, children, canonicalUrl = BLOG_ORIGIN, image, imageAlt, type = 'website', publishedTime, noindex }: {
  title?: string; description?: string; children?: Child;
} & SocialMetadata) => {
  const pageTitle = title ? `${title} · ${BLOG_TITLE}` : BLOG_TITLE;
  const pageDescription = description || BLOG_DESCRIPTION;
  const socialTitle = title || BLOG_TITLE;
  return (
  <>
    {raw('<!DOCTYPE html>')}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#faf6ef" />
        <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content={type} />
        <meta property="og:site_name" content={BLOG_TITLE} />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content={socialTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        {publishedTime && <meta property="article:published_time" content={`${publishedTime}T00:00:00Z`} />}
        {image && <>
          <meta property="og:image" content={image} />
          <meta property="og:image:secure_url" content={image} />
          <meta property="og:image:alt" content={imageAlt || socialTitle} />
          <meta name="twitter:image" content={image} />
          <meta name="twitter:image:alt" content={imageAlt || socialTitle} />
        </>}
        <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
        <meta name="twitter:title" content={socialTitle} />
        <meta name="twitter:description" content={pageDescription} />
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
};

const firstSocialImage = (source: string, mediaBase = ''): { src: string; alt: string } | undefined => {
  let found: { src: string; alt: string } | undefined;
  const visitInlines = (nodes: Inline[]): void => {
    for (const node of nodes) {
      if (node.type === 'image' && !found) {
        const src = node.src.startsWith(`${MEDIA_PATH}/`) && mediaBase
          ? mediaBase + node.src.slice(MEDIA_PATH.length)
          : node.src;
        found = { src: new URL(src, `${BLOG_ORIGIN}/`).href, alt: node.alt };
      } else if (node.type === 'strong' || node.type === 'em' || node.type === 'link') {
        visitInlines(node.children);
      }
    }
  };
  const visitBlocks = (blocks: Block[]): void => {
    for (const block of blocks) {
      if (found) return;
      if (block.type === 'heading' || block.type === 'paragraph') visitInlines(block.children);
      else if (block.type === 'list') block.items.forEach(visitInlines);
      else if (block.type === 'quote') visitBlocks(block.children);
      else if (block.type === 'youtube') found = { src: `https://i.ytimg.com/vi/${block.videoId}/hqdefault.jpg`, alt: 'YouTube video thumbnail' };
    }
  };
  visitBlocks(parseMarkdown(source));
  return found;
};

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
        case 'youtube': return (
          <div class="youtube-embed">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${block.videoId}`}
              title="YouTube video player"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerpolicy="strict-origin-when-cross-origin"
              allowfullscreen
            />
          </div>
        );
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
      <h1>{post.title.replace(/\s+/g, '∙')}</h1>
      {post.date && <p class="post-date"><time datetime={post.date}>/{formatDate(post.date)}/</time></p>}
    </header>
    <div class="post-body"><Markdown source={post.body} mediaBase={mediaBase} games={games} showMissing={showMissing} /></div>
  </article>
);

export const BlogIndex = ({ posts }: { posts: PostRef[] }) => (
  <BlogLayout description={BLOG_DESCRIPTION}>
    {posts.length === 0
      ? <p class="empty">Nothing here yet.</p>
      : (
        <ol class="post-list">
          {posts.map(({ meta }) => (
            <li><a href={postUrl(meta)}>
              <strong>{meta.title.replace(/\s+/g, '∙')}</strong>
              <time datetime={meta.date}>/{formatDate(meta.date!)}/</time>
              <span class="excerpt">{meta.excerpt}</span>
            </a></li>
          ))}
        </ol>
      )}
  </BlogLayout>
);

export const BlogPostPage = ({ post, preview = false, mediaBase, games }: { post: Post; preview?: boolean; mediaBase?: string; games?: ReadonlyMap<string, GameCard> }) => {
  const socialImage = firstSocialImage(post.body, mediaBase);
  return (
  <BlogLayout
    title={post.title}
    description={postExcerpt(post.body) || BLOG_DESCRIPTION}
    canonicalUrl={`${BLOG_ORIGIN}${postUrl(post)}`}
    image={socialImage?.src}
    imageAlt={socialImage?.alt}
    type="article"
    publishedTime={post.date}
    noindex={preview}
  >
    {preview && <p class="preview">Preview{post.published ? '' : ' — this draft is not public'}</p>}
    <PostArticle post={post} mediaBase={mediaBase} games={games} showMissing={preview} />
    <p class="back"><a href="/">← All posts</a></p>
  </BlogLayout>
  );
};

export const BlogNotFound = () => (
  <BlogLayout title="Not found" noindex>
    <p class="empty">This page could not be found.</p>
    <p class="back"><a href="/">← All posts</a></p>
  </BlogLayout>
);
