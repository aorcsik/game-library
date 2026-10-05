import { TITLE_INDEX_KEY, gameKey, toGameMeta, updateIndex, type Game, type GameMeta, type TitleIndex } from './games';

export type GameRef = { key: string; meta: GameMeta };

const BULK_GET_LIMIT = 100;

export const listGames = async (kv: KVNamespace): Promise<GameRef[]> => {
  const refs: GameRef[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list<GameMeta>({ prefix: 'game:', cursor });
    for (const k of page.keys) if (k.metadata) refs.push({ key: k.name.slice('game:'.length), meta: k.metadata });
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return refs;
};

export const getGame = (kv: KVNamespace, key: string): Promise<Game | null> => kv.get<Game>(gameKey(key), 'json');

export const getGames = async (kv: KVNamespace, keys: string[]): Promise<Map<string, Game>> => {
  const result = new Map<string, Game>();
  for (let i = 0; i < keys.length; i += BULK_GET_LIMIT) {
    const batch = keys.slice(i, i + BULK_GET_LIMIT);
    const values = await kv.get<Game>(batch.map(gameKey), 'json');
    batch.forEach(key => {
      const game = values.get(gameKey(key));
      if (game) result.set(key, game);
    });
  }
  return result;
};

export const getTitleIndex = async (kv: KVNamespace): Promise<TitleIndex> =>
  (await kv.get<TitleIndex>(TITLE_INDEX_KEY, 'json')) ?? {};

/** Writes the game and keeps the shared title index in sync (single-writer admin, so no locking). */
export const saveGame = async (kv: KVNamespace, game: Game, options: { dirty?: boolean } = { dirty: true }): Promise<void> => {
  const index = await getTitleIndex(kv);
  updateIndex(index, game.key, game);
  await kv.put(gameKey(game.key), JSON.stringify(game), { metadata: toGameMeta(game) });
  await kv.put(TITLE_INDEX_KEY, JSON.stringify(index));
  if (options.dirty) await markDirty(kv, game.key);
};

export const DIRTY_KEY = 'sync:dirty';

/** Games changed since the last publish to the remote namespace (see scripts/publish-games.ts). */
export const getDirty = async (kv: KVNamespace): Promise<string[]> => (await kv.get<string[]>(DIRTY_KEY, 'json')) ?? [];

const markDirty = async (kv: KVNamespace, key: string): Promise<void> => {
  const dirty = await getDirty(kv);
  if (!dirty.includes(key)) await kv.put(DIRTY_KEY, JSON.stringify([...dirty, key]));
};
