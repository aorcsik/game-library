// Snapshot local KV before `npm run dev`; content-addressed files avoid duplicate backups.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getPlatformProxy } from 'wrangler';

type Key = { name: string; metadata?: unknown; expiration?: number };
type KV = {
  list(options?: { cursor?: string }): Promise<{ keys: Key[]; list_complete: boolean; cursor?: string }>;
  get(keys: string[], type: 'text'): Promise<Map<string, string | null>>;
};
type Binding = 'GAMES' | 'GAMEDB' | 'GAMESTATE';
type Entry = { key: string; value: string; metadata?: unknown; expiration?: number };

const root = resolve(import.meta.dirname, '..');
const state = resolve(root, '.wrangler/state/v3/kv');
const backupDir = resolve(root, '.backups');
const bindings: Binding[] = ['GAMES', 'GAMEDB', 'GAMESTATE'];

if (!existsSync(state)) {
  console.info('No local KV state yet; skipping backup.');
} else {
  const proxy = await getPlatformProxy<Record<Binding, KV>>({ configPath: resolve(root, 'wrangler.jsonc') });
  try {
    const snapshot: Record<string, Entry[]> = {};
    for (const binding of bindings) {
      const kv = proxy.env[binding];
      const keys: Key[] = [];
      let cursor: string | undefined;
      do {
        const page = await kv.list({ cursor });
        keys.push(...page.keys);
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      keys.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);

      const entries: Entry[] = snapshot[binding] = [];
      for (let index = 0; index < keys.length; index += 100) {
        const batch = keys.slice(index, index + 100);
        const values = await kv.get(batch.map(key => key.name), 'text');
        for (const key of batch) {
          const value = values.get(key.name);
          if (value == null) throw new Error(`${binding}: key disappeared during backup: ${key.name}`);
          entries.push({ key: key.name, value, ...(key.metadata != null ? { metadata: key.metadata } : {}),
            ...(key.expiration !== undefined ? { expiration: key.expiration } : {}) });
        }
      }
    }

    const canonical = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(canonical);
      if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
          .map(([key, entry]) => [key, canonical(entry)]));
      }
      return value;
    };
    const dump = JSON.stringify(canonical(snapshot));
    const hash = createHash('sha256').update(dump).digest('hex');
    const file = resolve(backupDir, `kv-${hash}.json`);
    if (existsSync(file)) {
      const storedHash = createHash('sha256').update(await readFile(file)).digest('hex');
      if (storedHash !== hash) throw new Error(`Existing KV backup is corrupt: ${file}`);
      console.info(`Local KV unchanged; backup already exists: ${file}`);
    } else {
      await mkdir(backupDir, { recursive: true, mode: 0o700 });
      await writeFile(file, dump, { flag: 'wx', mode: 0o600 });
      console.info(`Backed up local KV to ${file}`);
    }
  } finally {
    await proxy.dispose();
  }
}