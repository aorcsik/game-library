// Restore an exact local KV snapshot; never connects to the remote namespaces.
// Usage: npm run kv:restore -- kv-<sha256>.json [--yes]
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getLocalKvProxy } from './local-kv-proxy.ts';

type Binding = 'GAMES' | 'GAMEDB' | 'GAMESTATE' | 'CREATORS';
type Entry = { key: string; value: string; metadata?: unknown; expiration?: number };
type KV = {
  list(options?: { cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
  put(key: string, value: string, options?: { metadata?: unknown; expiration?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

const root = resolve(import.meta.dirname, '..');
const backupDir = resolve(root, '.backups');
const bindings: Binding[] = ['GAMES', 'GAMEDB', 'GAMESTATE', 'CREATORS'];
const [filename, ...flags] = process.argv.slice(2);

if (!filename) {
  console.info('Available local KV backups:');
  for (const file of (await readdir(backupDir).catch(() => [])).filter(name => /^kv-[a-f0-9]{64}\.json$/.test(name))) {
    console.info(`  ${file}`);
  }
  console.info('Usage: npm run kv:restore -- kv-<sha256>.json [--yes]');
  process.exit(0);
}
if (!/^kv-[a-f0-9]{64}\.json$/.test(filename) || flags.some(flag => flag !== '--yes') || flags.length > 1) {
  throw new Error('Usage: npm run kv:restore -- kv-<sha256>.json [--yes]');
}

const content = await readFile(resolve(backupDir, filename));
const hash = createHash('sha256').update(content).digest('hex');
if (filename !== `kv-${hash}.json`) throw new Error(`Backup checksum does not match: ${filename}`);

const parsed: unknown = JSON.parse(content.toString('utf8'));
if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
  throw new Error('Backup must contain GAMES, GAMEDB, GAMESTATE, and optionally CREATORS.');
}
const snapshot = parsed as Record<string, unknown>;
const snapshotBindings = bindings.filter(binding => binding in snapshot || binding === 'CREATORS' && 'DEVELOPERS' in snapshot);
if (!['GAMES', 'GAMEDB', 'GAMESTATE'].every(binding => binding in parsed) ||
    Object.keys(snapshot).length !== snapshotBindings.length || 'DEVELOPERS' in snapshot && 'CREATORS' in snapshot) {
  throw new Error('Backup must contain GAMES, GAMEDB, GAMESTATE, and optionally CREATORS (legacy DEVELOPERS is supported).');
}
const entries = {} as Record<Binding, Entry[]>;
for (const binding of snapshotBindings) {
  const records = snapshot[binding === 'CREATORS' && !('CREATORS' in snapshot) ? 'DEVELOPERS' : binding];
  if (!Array.isArray(records)) throw new Error(`Invalid ${binding} entries in backup.`);
  const seen = new Set<string>();
  entries[binding] = records.map((record: unknown) => {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`Invalid ${binding} entry in backup.`);
    }
    const entry = record as Record<string, unknown>;
    if (typeof entry.key !== 'string' || !entry.key || typeof entry.value !== 'string' ||
        ('expiration' in entry && (typeof entry.expiration !== 'number' || !Number.isFinite(entry.expiration))) ||
        Object.keys(entry).some(key => !['key', 'value', 'metadata', 'expiration'].includes(key)) || seen.has(entry.key)) {
      throw new Error(`Invalid or duplicate ${binding} entry in backup.`);
    }
    if (typeof entry.expiration === 'number' && entry.expiration <= Date.now() / 1000) {
      throw new Error(`${binding}: snapshot contains an expired key: ${entry.key}`);
    }
    seen.add(entry.key);
    return entry as Entry;
  });
}

if (flags.includes('--yes')) {
  console.info('Backing up current local KV before restore...');
  execFileSync(process.execPath, [resolve(root, 'scripts/backup-kv.ts')], { cwd: root, stdio: 'inherit' });
}

const { proxy, dispose } = await getLocalKvProxy<Record<Binding, KV>>();
try {
  const plans: { binding: Binding; existing: Set<string>; desired: Set<string> }[] = [];
  for (const binding of snapshotBindings) {
    const existing = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await proxy.env[binding].list({ cursor });
      page.keys.forEach(key => existing.add(key.name));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    const desired = new Set(entries[binding].map(entry => entry.key));
    plans.push({ binding, existing, desired });
    const additions = entries[binding].length - [...desired].filter(key => existing.has(key)).length;
    console.info(`${binding}: ${additions} additions, ${entries[binding].length - additions} overwrites, ${[...existing].filter(key => !desired.has(key)).length} deletions`);
  }

  if (!flags.includes('--yes')) {
    console.info('Dry run. Stop the dev server, then re-run with --yes to restore local KV.');
  } else {
    for (const { binding, existing, desired } of plans) {
      const kv = proxy.env[binding];
      for (const entry of entries[binding]) {
        await kv.put(entry.key, entry.value, {
          ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
          ...(entry.expiration !== undefined ? { expiration: entry.expiration } : {}),
        });
      }
      for (const key of existing) if (!desired.has(key)) await kv.delete(key);
      console.info(`Restored ${binding}.`);
    }
  }
} finally {
  await dispose();
}