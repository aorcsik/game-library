import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { toMeta, type Transaction } from '../src/model.ts';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--apply') || args.length > 1) {
  throw new Error('Usage: npm run migrate:transaction-references -- [--apply]');
}

const patterns: Record<string, RegExp> = {
  'Epic Games Store': /^F\d{16}$/,
  'Steam Store': /^\d{17,19}$/,
  'PlayStation Store': /^\d{11,15}$/,
  'Fanatical': /^[a-f0-9]{24}$/,
  'Apple App Store': /^\d{12}$/,
  'Nintendo eShop': /^\d{11}$/,
  'GOG Store': /^[a-f0-9]{12}$/,
  'Green Man Gaming': /^#ord[a-f0-9]{32}$/,
};

type KV = {
  list(options: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
  get(keys: string[], type: 'json'): Promise<Map<string, Transaction | null>>;
  put(key: string, value: string, options: { metadata: ReturnType<typeof toMeta> }): Promise<void>;
};

const proxy = await getPlatformProxy<{ GAMES: KV }>({ configPath: resolve(root, 'wrangler.jsonc') });
try {
  const kv = proxy.env.GAMES;
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: 'tx:', cursor });
    keys.push(...page.keys.map(key => key.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const matches: { key: string; tx: Transaction }[] = [];
  for (let index = 0; index < keys.length; index += 100) {
    const batch = keys.slice(index, index + 100);
    const values = await kv.get(batch, 'json');
    for (const key of batch) {
      const tx = values.get(key);
      if (!tx) throw new Error(`Transaction disappeared: ${key}`);
      if (!tx.referenceId && patterns[tx.store]?.test(tx.title)) matches.push({ key, tx });
    }
  }

  const counts = new Map<string, number>();
  for (const { tx } of matches) counts.set(tx.store, (counts.get(tx.store) ?? 0) + 1);
  console.info(`${matches.length} ID-only titles to migrate from ${keys.length} transactions:`);
  for (const [store, count] of [...counts].sort(([left], [right]) => left.localeCompare(right))) console.info(`  ${store}: ${count}`);

  if (!args.includes('--apply')) {
    console.info('Dry run. Re-run with --apply to back up local KV and migrate these records.');
  } else if (matches.length) {
    execFileSync(process.execPath, [resolve(root, 'scripts/backup-kv.ts')], { cwd: root, stdio: 'inherit' });
    for (const { key, tx } of matches) {
      const updated: Transaction = { ...tx, title: '', referenceId: tx.title };
      await kv.put(key, JSON.stringify(updated), { metadata: toMeta(updated) });
    }
    console.info(`Migrated ${matches.length} local transactions.`);
  }
} finally {
  await proxy.dispose();
}