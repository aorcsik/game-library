// A deliberately small, safe Markdown subset. It parses to a tree (never to HTML strings), so the
// views escape every text node and only allowlisted URL schemes can become links or images.

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong' | 'em'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'image'; src: string; alt: string };

export type Block =
  | { type: 'heading'; level: 2 | 3 | 4; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'quote'; children: Block[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'code'; value: string }
  | { type: 'rule' }
  /** `![game:<key>]` on its own line: a card for a game from the library. */
  | { type: 'game'; key: string }
  /** `![youtube:<video ID or URL>]` on its own line: an embedded YouTube video. */
  | { type: 'youtube'; videoId: string };

/** Returns the URL when it is http(s), mailto (links only), site-relative, or an anchor; otherwise null. */
export const safeUrl = (url: string, image = false): string | null => {
  if (/^(\/(?!\/)|#)/.test(url)) return url;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' || (!image && protocol === 'mailto:') ? url : null;
  } catch {
    return null;
  }
};

const INLINE = /`([^`]+)`|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*/g;

export const parseInline = (text: string): Inline[] => {
  const result: Inline[] = [];
  let last = 0;
  const pushText = (value: string) => value && result.push({ type: 'text', value });
  for (const match of text.matchAll(INLINE)) {
    pushText(text.slice(last, match.index));
    last = match.index + match[0].length;
    const [, code, alt, src, label, href, strong, em] = match;
    if (code !== undefined) result.push({ type: 'code', value: code });
    else if (src !== undefined) {
      const safe = safeUrl(src, true);
      if (safe) result.push({ type: 'image', src: safe, alt });
      else pushText(match[0]);
    } else if (href !== undefined) {
      const safe = safeUrl(href);
      if (safe) result.push({ type: 'link', href: safe, children: parseInline(label) });
      else pushText(match[0]);
    } else if (strong !== undefined) result.push({ type: 'strong', children: parseInline(strong) });
    else result.push({ type: 'em', children: parseInline(em) });
  }
  pushText(text.slice(last));
  return result;
};

const FENCE = /^```/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^(-{3,}|\*{3,})$/;
const GAME_EMBED = /^!\[game:([a-z0-9-]{1,120})\]$/;
const YOUTUBE_EMBED = /^!\[youtube:([^\]]+)\]$/;
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export const parseYoutubeVideoId = (input: string): string | null => {
  const value = input.trim();
  if (YOUTUBE_VIDEO_ID.test(value)) return value;

  const normalized = /^(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(value) ? `https://${value}` : value;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const parts = url.pathname.split('/').filter(Boolean);
      return parts.length === 1 && YOUTUBE_VIDEO_ID.test(parts[0]) ? parts[0] : null;
    }

    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) return null;
    if (url.pathname === '/watch') {
      const videoId = url.searchParams.get('v');
      return videoId && YOUTUBE_VIDEO_ID.test(videoId) ? videoId : null;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length === 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0]) && YOUTUBE_VIDEO_ID.test(parts[1])
      ? parts[1]
      : null;
  } catch {
    return null;
  }
};

const startsBlock = (line: string): boolean =>
  FENCE.test(line) || HEADING.test(line) || BULLET.test(line) || NUMBERED.test(line) || QUOTE.test(line) || RULE.test(line) || GAME_EMBED.test(line.trim()) || YOUTUBE_EMBED.test(line.trim());

export const parseMarkdown = (source: string): Block[] => {
  const lines = source.replace(/\r\n?/g, '\n').split('\n').map(line => line.trimEnd());
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (FENCE.test(line)) {
      const code: string[] = [];
      for (i++; i < lines.length && !FENCE.test(lines[i]); i++) code.push(lines[i]);
      i++;
      blocks.push({ type: 'code', value: code.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      // The post title is the page's h1, so body headings start at h2.
      blocks.push({ type: 'heading', level: Math.min(heading[1].length + 1, 4) as 2 | 3 | 4, children: parseInline(heading[2]) });
      i++;
      continue;
    }

    if (RULE.test(line)) { blocks.push({ type: 'rule' }); i++; continue; }

    const embed = GAME_EMBED.exec(line.trim());
    if (embed) { blocks.push({ type: 'game', key: embed[1] }); i++; continue; }

    const youtube = YOUTUBE_EMBED.exec(line.trim());
    const videoId = youtube && parseYoutubeVideoId(youtube[1]);
    if (videoId) { blocks.push({ type: 'youtube', videoId }); i++; continue; }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      for (; i < lines.length && QUOTE.test(lines[i]); i++) quoted.push(QUOTE.exec(lines[i])![1]);
      blocks.push({ type: 'quote', children: parseMarkdown(quoted.join('\n')) });
      continue;
    }

    const list = BULLET.test(line) ? BULLET : NUMBERED.test(line) ? NUMBERED : null;
    if (list) {
      const items: Inline[][] = [];
      for (; i < lines.length && list.test(lines[i]); i++) items.push(parseInline(list.exec(lines[i])![1]));
      blocks.push({ type: 'list', ordered: list === NUMBERED, items });
      continue;
    }

    const paragraph = [line];
    for (i++; i < lines.length && lines[i].trim() && !startsBlock(lines[i]); i++) paragraph.push(lines[i]);
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ')) });
  }
  return blocks;
};

const mapInlines = (nodes: Inline[], rewrite: (src: string) => string): Inline[] => nodes.map(node => {
  switch (node.type) {
    case 'image': return { ...node, src: rewrite(node.src) };
    case 'strong': case 'em': case 'link': return { ...node, children: mapInlines(node.children, rewrite) };
    default: return node;
  }
});

/** Rewrites every image URL in the tree, e.g. to move `/media/…` onto a CDN domain. */
export const mapImages = (blocks: Block[], rewrite: (src: string) => string): Block[] => blocks.map(block => {
  switch (block.type) {
    case 'heading': case 'paragraph': return { ...block, children: mapInlines(block.children, rewrite) };
    case 'quote': return { ...block, children: mapImages(block.children, rewrite) };
    case 'list': return { ...block, items: block.items.map(item => mapInlines(item, rewrite)) };
    default: return block;
  }
});

/** Game keys embedded anywhere in the tree, in order of first appearance. */
export const gameEmbedKeys = (blocks: Block[]): string[] => {
  const keys = new Set<string>();
  const visit = (list: Block[]): void => {
    for (const block of list) {
      if (block.type === 'game') keys.add(block.key);
      else if (block.type === 'quote') visit(block.children);
    }
  };
  visit(blocks);
  return [...keys];
};
