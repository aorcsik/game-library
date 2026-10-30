import type { Post } from './blog.ts';

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_PATH = '/media';

export type ImageType = { ext: string; contentType: string };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
  signature.every((value, index) => bytes[offset + index] === value);

const ascii = (text: string): number[] => [...text].map(char => char.charCodeAt(0));

/** Identifies allowed image formats from file contents; the client-supplied type and name are never trusted. SVG is excluded on purpose (it can carry scripts). */
export const sniffImage = (bytes: Uint8Array): ImageType | null => {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', contentType: 'image/png' };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return { ext: 'gif', contentType: 'image/gif' };
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return { ext: 'webp', contentType: 'image/webp' };
  if (startsWith(bytes, ascii('ftyp'), 4) && (startsWith(bytes, ascii('avif'), 8) || startsWith(bytes, ascii('avis'), 8))) {
    return { ext: 'avif', contentType: 'image/avif' };
  }
  return null;
};

export const MEDIA_KEY_PATTERN = /^blog\/[0-9a-f]{32}\.(?:png|jpg|gif|webp|avif)$/;

export const newMediaKey = (ext: string): string => `blog/${crypto.randomUUID().replaceAll('-', '')}.${ext}`;

/** Markdown references are `/media/<key>`; `base` (e.g. a public bucket domain) replaces the `/media` prefix when set. */
export const mediaUrl = (key: string, base = ''): string => `${base || MEDIA_PATH}/${key}`;

export const mediaBaseUrl = (env: { MEDIA_BASE_URL?: string }): string => (env.MEDIA_BASE_URL ?? '').replace(/\/+$/, '');

const REFERENCED_KEY = /blog\/[0-9a-f]{32}\.(?:png|jpg|gif|webp|avif)/g;

/** Image keys mentioned anywhere in the text, whether as `/media/…` or on the public media domain. */
export const referencedMediaKeys = (text: string): string[] => [...new Set(text.match(REFERENCED_KEY) ?? [])];

export type MediaObject = { key: string; size: number; uploaded: string; filename?: string };
export type MediaUsage = { id: string; title: string; published: boolean };
/** `usedIn`: the Markdown references the image. `attachedTo`: attached to the post but not (yet) used in its text. */
export type MediaItem = MediaObject & { usedIn: MediaUsage[]; attachedTo: MediaUsage[] };

export const mapMedia = (
  objects: MediaObject[],
  posts: Pick<Post, 'id' | 'title' | 'published' | 'body' | 'images'>[],
): MediaItem[] => {
  const used = new Map<string, MediaUsage[]>();
  const attached = new Map<string, MediaUsage[]>();
  const add = (map: Map<string, MediaUsage[]>, key: string, usage: MediaUsage): void => {
    map.set(key, [...(map.get(key) ?? []), usage]);
  };
  for (const { id, title, published, body, images } of posts) {
    const usage = { id, title, published };
    const referenced = new Set(referencedMediaKeys(body));
    for (const key of referenced) add(used, key, usage);
    for (const key of images ?? []) if (!referenced.has(key)) add(attached, key, usage);
  }
  return objects
    .map(object => ({ ...object, usedIn: used.get(object.key) ?? [], attachedTo: attached.get(object.key) ?? [] }))
    .sort((a, b) => b.uploaded.localeCompare(a.uploaded) || a.key.localeCompare(b.key));
};
