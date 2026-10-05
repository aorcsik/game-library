// Pushes games changed locally (by the fetcher or admin edits) from the local GAMEDB replica to the remote namespace.
// Usage: node scripts/publish-games.ts [--yes]   (dry run without --yes)
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { TITLE_INDEX_KEY, gameKey, toGameMeta, type Game } from '../src/games.ts';

type KV = {
  get(key: string, type: 'json'): Promise<unknown>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

const DIRTY_KEY = 'sync:dirty';
const root = resolve(import.meta.dirname, '..');
const confirmed = process.argv.includes('--yes');

const proxy = await getPlatformProxy<{ GAMEDB: KV }>({ configPath: resolve(root, 'wrangler.jsonc') });
try {
  const kv = proxy.env.GAMEDB;
  const dirty = ((await kv.get(DIRTY_KEY, 'json')) ?? []) as string[];
  if (!dirty.length) {
    console.info('Nothing to publish.');
  } else {
    const bulk: { key: string; value: string; metadata?: unknown }[] = [];
    for (const key of dirty) {
      const game = (await kv.get(gameKey(key), 'json')) as Game | null;
      if (game) bulk.push({ key: gameKey(key), value: JSON.stringify(game), metadata: toGameMeta(game) });
    }
    const index = await kv.get(TITLE_INDEX_KEY);
    if (index) bulk.push({ key: TITLE_INDEX_KEY, value: index });

    console.info(`${dirty.length} changed games (+ title index) = ${bulk.length} remote KV writes:`);
    console.info(`  ${dirty.slice(0, 30).join(', ')}${dirty.length > 30 ? ', …' : ''}`);
    if (!confirmed) {
      console.info('\nDry run. Re-run with --yes to write to the remote GAMEDB namespace.');
    } else {
      const file = resolve(root, '.migration/publish-games.json');
      await mkdir(resolve(root, '.migration'), { recursive: true });
      await writeFile(file, JSON.stringify(bulk));
      execFileSync('npx', ['wrangler', 'kv', 'bulk', 'put', file, '--binding', 'GAMEDB', '--remote'], { cwd: root, stdio: 'inherit' });
      await kv.put(DIRTY_KEY, '[]');
      console.info('Published; local dirty list cleared.');
    }
  }
} finally {
  await proxy.dispose();
}
