import { gameDevelopers, gamePublishers, slugify, type Game, type GameMeta } from './games.ts';
import { splitCreatorNames, transformCreatorNames, type CreatorSourceRole } from './creatorRules.ts';

export type Creator = { name: string; aliases: string[]; aka?: string[]; url?: string; parent?: string };
export type CreatorRef = Creator & { key: string };
export type CreatorDraft = { name: string; aliases: string; aka: string; url: string; parent: string };
export type CreatorIndex = Map<string, { creator: CreatorRef; aka: boolean }>;
export type CreatorRole = 'developer' | 'publisher';
export type CreatorCredit = { name: string; key?: string };
export type GameCreatorCredits = { developers: CreatorCredit[]; publishers: CreatorCredit[]; creators: CreatorCredit[] };
export type CreatorGameLink = { miscredit?: boolean; notes?: string };
export type CreatorGameLinks = Map<string, Map<string, CreatorGameLink>>;

// Keep persisted keys stable when broadening existing developer records to creators.
export const creatorKey = (key: string): string => `developer:${key}`;
export const creatorGameLinkKey = (game: string, creator: string): string => `creator-game:${game}:${creator}`;

export const normalizeCreator = (name: string): string =>
  name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export const creatorNames = (creator: Creator): string[] => [creator.name, ...creator.aliases, ...(creator.aka ?? [])];

export const buildCreatorIndex = (creators: CreatorRef[]): CreatorIndex => {
  const index: CreatorIndex = new Map();
  for (const creator of creators) {
    const names = [
      { name: creator.name, aka: false },
      ...creator.aliases.map(name => ({ name, aka: false })),
      ...(creator.aka ?? []).map(name => ({ name, aka: true })),
    ];
    for (const { name, aka } of names) {
      const normalized = normalizeCreator(name);
      const owner = index.get(normalized);
      if (owner && owner.creator.key !== creator.key) throw new Error(`Creator name "${name}" belongs to both ${owner.creator.key} and ${creator.key}.`);
      index.set(normalized, { creator, aka });
    }
  }
  return index;
};

export const resolveCreator = (index: CreatorIndex, name: string): string | undefined =>
  index.get(normalizeCreator(name))?.creator.key;

export const expandCreatorNames = (names: string[], index: CreatorIndex, role?: CreatorSourceRole): string[] =>
  names.flatMap(name => {
    const transformed = role ? transformCreatorNames([name], role)[0] : name;
    if (resolveCreator(index, transformed) || !/(?:,|\s+(?:and|&)\s+)/i.test(name)) return [transformed];
    const parts = splitCreatorNames(name);
    const transformedParts = role ? transformCreatorNames(parts, role) : parts;
    return transformedParts.length > 1 && transformedParts.every(part => part && resolveCreator(index, part)) ? transformedParts : [transformed];
  });

export const creatorSearchNames = (names: string[], index: CreatorIndex, role?: CreatorSourceRole): string[] => {
  const transformed = role ? transformCreatorNames(names, role) : names;
  return [...new Set([
    ...names,
    ...(role ? transformed : []),
    ...expandCreatorNames(names, index, role).flatMap(name => {
      const canonical = index.get(normalizeCreator(name))?.creator.name;
      return canonical ? [canonical] : [];
    }),
  ])];
};

export const creatorLinks = (names: string[], index: CreatorIndex, role?: CreatorSourceRole): CreatorCredit[] => {
  const links: CreatorCredit[] = [];
  const positions = new Map<string, number>();
  for (const name of expandCreatorNames(names, index, role)) {
    const normalized = normalizeCreator(name);
    const match = index.get(normalized);
    const identity = match ? `creator:${match.creator.key}` : `missing:${normalized}`;
    const position = positions.get(identity);
    if (position !== undefined) {
      if (match?.aka && !index.get(normalizeCreator(links[position].name))?.aka) links[position].name = name;
    } else {
      positions.set(identity, links.length);
      links.push({ name: match && !match.aka ? match.creator.name : name, ...(match ? { key: match.creator.key } : {}) });
    }
  }
  return links;
};

export const creatorLinksForRole = (names: string[], role: CreatorSourceRole, index: CreatorIndex): CreatorCredit[] =>
  creatorLinks(names, index, role);

export const creatorVerificationProgress = (games: Pick<GameMeta, 'developers' | 'publishers'>[], index: CreatorIndex): { verified: number; total: number } => {
  const distinct = new Set<string>();
  const verified = new Set<string>();
  for (const game of games) {
    for (const [names, role] of [[game.developers ?? [], 'developer'], [game.publishers ?? [], 'publisher']] as const) {
      for (const name of expandCreatorNames(names, index, role)) {
        const value = normalizeCreator(name);
        distinct.add(value);
        if (resolveCreator(index, name)) verified.add(value);
      }
    }
  }
  return { verified: verified.size, total: distinct.size };
};

export const gameCreatorCredits = (game: Game, index: CreatorIndex): GameCreatorCredits => {
  const developerNames = gameDevelopers(game);
  const publisherNames = gamePublishers(game);
  const developers = creatorLinksForRole(developerNames, 'developer', index);
  const publishers = creatorLinksForRole(publisherNames, 'publisher', index);
  const verified = new Set([...developers, ...publishers].map(({ name, key }) => key ?? normalizeCreator(name)));
  const corroborated = new Set(verified);
  for (const [names, role] of [[developerNames, 'developer'], [publisherNames, 'publisher']] as const) {
    for (const name of names) {
      for (const part of splitCreatorNames(name)) {
        const key = resolveCreator(index, transformCreatorNames([part], role)[0]);
        if (key) corroborated.add(key);
      }
    }
  }
  const openCriticNames = expandCreatorNames(game.opencritic?.data?.creators ?? [], index)
    .filter(name => !(['developer', 'publisher'] as const).some(role =>
      creatorLinksForRole([name], role, index).some(credit => corroborated.has(credit.key ?? normalizeCreator(credit.name)))));
  const creators = creatorLinks(openCriticNames, index)
    .filter(({ name, key }) => !verified.has(key ?? normalizeCreator(name)));
  return { developers, publishers, creators };
};

export const readCreatorDraft = (form: FormData): CreatorDraft => ({
  name: String(form.get('name') ?? '').trim(),
  aliases: String(form.get('aliases') ?? ''),
  aka: String(form.get('aka') ?? ''),
  url: String(form.get('url') ?? '').trim(),
  parent: String(form.get('parent') ?? '').trim(),
});

export const toCreatorDraft = (creator: Creator): CreatorDraft => ({
  name: creator.name,
  aliases: creator.aliases.join('\n'),
  aka: (creator.aka ?? []).join('\n'),
  url: creator.url ?? '',
  parent: creator.parent ?? '',
});

export const validateCreator = (draft: CreatorDraft, existing: CreatorRef[], key?: string): { creator?: Creator; errors: string[] } => {
  const errors: string[] = [];
  if (!draft.name || draft.name.length > 300 || !normalizeCreator(draft.name)) errors.push('Name is required (max 300 characters).');
  const aliases = [...new Set(draft.aliases.split(/\r?\n/).map(name => name.trim()).filter(Boolean))];
  if (aliases.length > 100 || aliases.some(name => name.length > 300 || !normalizeCreator(name))) errors.push('Aliases must be at most 100 names of up to 300 characters each.');
  const aka = [...new Set(draft.aka.split(/\r?\n/).map(name => name.trim()).filter(Boolean))];
  if (aka.length > 100 || aka.some(name => name.length > 300 || !normalizeCreator(name))) errors.push('A.k.a. names must be at most 100 names of up to 300 characters each.');
  if (draft.url) {
    try {
      const url = new URL(draft.url);
      if (!['http:', 'https:'].includes(url.protocol) || draft.url.length > 2048) errors.push('URL must be an HTTP or HTTPS URL (max 2048 characters).');
    } catch {
      errors.push('URL must be an HTTP or HTTPS URL (max 2048 characters).');
    }
  }
  const names = [draft.name, ...aliases, ...aka];
  const normalized = names.map(normalizeCreator);
  if (new Set(normalized).size !== normalized.length) errors.push('Name, aliases, and a.k.a. names must be distinct.');
  const index = buildCreatorIndex(existing.filter(creator => creator.key !== key));
  for (const name of names) {
    const owner = resolveCreator(index, name);
    if (owner) errors.push(`"${name}" already belongs to another creator (${owner}).`);
  }
  const byKey = new Map(existing.map(creator => [creator.key, creator]));
  const seen = new Set<string>();
  let parent = draft.parent;
  while (parent) {
    if (parent === key || seen.has(parent)) {
      errors.push('Parent cannot be this creator or create a cycle.');
      break;
    }
    seen.add(parent);
    const creator = byKey.get(parent);
    if (!creator) {
      errors.push(`Parent creator does not exist: ${parent}.`);
      break;
    }
    parent = creator.parent ?? '';
  }
  return errors.length ? { errors } : { creator: {
    name: draft.name, aliases, aka,
    ...(draft.url ? { url: draft.url } : {}),
    ...(draft.parent ? { parent: draft.parent } : {}),
  }, errors };
};

export const newCreatorKey = async (kv: KVNamespace, name: string): Promise<string> => {
  const slug = slugify(name).slice(0, 110) || 'creator';
  const base = slug === 'new' ? 'creator-new' : slug;
  let key = base;
  for (let n = 2; await kv.get(creatorKey(key)); n++) key = `${base}-${n}`;
  return key;
};

export const getCreator = (kv: KVNamespace, key: string): Promise<Creator | null> =>
  kv.get<Creator>(creatorKey(key), 'json');

export const saveCreator = (kv: KVNamespace, key: string, creator: Creator): Promise<void> =>
  kv.put(creatorKey(key), JSON.stringify(creator));

export const listCreators = async (kv: KVNamespace): Promise<CreatorRef[]> => {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: 'developer:', cursor });
    keys.push(...page.keys.map(entry => entry.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const creators: CreatorRef[] = [];
  for (let i = 0; i < keys.length; i += 100) {
    const values = await kv.get<Creator>(keys.slice(i, i + 100), 'json');
    for (const name of keys.slice(i, i + 100)) {
      const creator = values.get(name);
      if (!creator) throw new Error(`Creator disappeared while listing: ${name}`);
      creators.push({ key: name.slice('developer:'.length), ...creator });
    }
  }
  return creators;
};

const listCreatorGameLinksWithPrefix = async (kv: KVNamespace, prefix: string): Promise<CreatorGameLinks> => {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix, cursor });
    names.push(...page.keys.map(entry => entry.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const links: CreatorGameLinks = new Map();
  for (let i = 0; i < names.length; i += 100) {
    const batch = names.slice(i, i + 100);
    const values = await kv.get<CreatorGameLink>(batch, 'json');
    for (const name of batch) {
      const link = values.get(name);
      if (!link) throw new Error(`Creator-game link disappeared while listing: ${name}`);
      const [game, creator] = name.slice('creator-game:'.length).split(':');
      if (!game || !creator) throw new Error(`Invalid creator-game link key: ${name}`);
      const byCreator = links.get(game) ?? new Map<string, CreatorGameLink>();
      byCreator.set(creator, link);
      links.set(game, byCreator);
    }
  }
  return links;
};

export const listCreatorGameLinks = (kv: KVNamespace): Promise<CreatorGameLinks> =>
  listCreatorGameLinksWithPrefix(kv, 'creator-game:');

export const getGameCreatorLinks = async (kv: KVNamespace, game: string): Promise<Map<string, CreatorGameLink>> =>
  (await listCreatorGameLinksWithPrefix(kv, `creator-game:${game}:`)).get(game) ?? new Map();

export const getCreatorGameLink = (kv: KVNamespace, game: string, creator: string): Promise<CreatorGameLink | null> =>
  kv.get<CreatorGameLink>(creatorGameLinkKey(game, creator), 'json');

export const saveCreatorGameLink = async (kv: KVNamespace, game: string, creator: string, link: CreatorGameLink): Promise<void> => {
  const key = creatorGameLinkKey(game, creator);
  if (link.miscredit || link.notes) await kv.put(key, JSON.stringify(link));
  else await kv.delete(key);
};

export const deleteGameCreatorLinks = async (kv: KVNamespace, game: string): Promise<void> => {
  for (const creator of (await getGameCreatorLinks(kv, game)).keys()) await kv.delete(creatorGameLinkKey(game, creator));
};

export const deleteCreatorGameLinks = async (kv: KVNamespace, creator: string): Promise<void> => {
  for (const [game, links] of await listCreatorGameLinks(kv)) {
    if (links.has(creator)) await kv.delete(creatorGameLinkKey(game, creator));
  }
};
