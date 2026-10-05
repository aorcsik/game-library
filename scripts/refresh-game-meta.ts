// Refreshes derived GAMEDB key metadata from stored game records without changing the records.
// Usage: node scripts/refresh-game-meta.ts
import { resolve } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { toGameMeta, type Game } from '../src/games.ts';

type KV = {
  list<T>(options?: { prefix?: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
  get(keys: string[], type: 'json'): Promise<Map<string, Game>>;
  put(key: string, value: string, options?: { metadata?: unknown }): Promise<void>;
};

const root = resolve(import.meta.dirname, '..');
const proxy = await getPlatformProxy<{ GAMEDB: KV }>({ configPath: resolve(root, 'wrangler.jsonc') });
try {
  const kv = proxy.env.GAMEDB;
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: 'game:', cursor });
    names.push(...page.keys.map(k => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  let updated = 0;
  for (let i = 0; i < names.length; i += 100) {
    const batch = names.slice(i, i + 100);
    const games = await kv.get(batch, 'json');
    for (const name of batch) {
      const game = games.get(name);
      if (!game) continue;
      await kv.put(name, JSON.stringify(game), { metadata: toGameMeta(game) });
      updated++;
    }
  }
  console.info(`Refreshed list metadata for ${updated} GAMEDB records; game records were not changed.`);
} finally {
  await proxy.dispose();
}
