// Copies one KV namespace between the local Wrangler store and production.
// Usage: npm run kv:push -- --binding GAMES [--yes] (or kv:pull)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import JSON5 from 'json5';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

type Binding = 'GAMES' | 'GAMEDB' | 'GAMESTATE';
type Key = { name: string; metadata?: unknown; expiration?: number };
type Entry = { key: string; value: string; metadata?: unknown; expiration?: number };

const root = resolve(import.meta.dirname, '..');
const wrangler = resolve(root, 'node_modules/.bin/wrangler');
const [direction, ...args] = process.argv.slice(2);
const bindingIndex = args.indexOf('--binding');
const binding = args[bindingIndex + 1];
const confirmed = args.includes('--yes');
const supported: Binding[] = ['GAMES', 'GAMEDB', 'GAMESTATE'];

if ((direction !== 'push' && direction !== 'pull') || !supported.includes(binding as Binding) ||
    args.some((arg, index) => arg !== '--yes' && arg !== '--binding' && index !== bindingIndex + 1) ||
    args.filter(arg => arg === '--binding').length !== 1 || args.filter(arg => arg === '--yes').length > 1) {
  throw new Error('Usage: npm run kv:push|kv:pull -- --binding GAMES|GAMEDB|GAMESTATE [--yes]');
}

const source = direction === 'push' ? '--local' : '--remote';
const destination = direction === 'push' ? '--remote' : '--local';
const run = (command: string[], output = true): string =>
  execFileSync(wrangler, ['kv', ...command, '--binding', binding, '--config', resolve(root, 'wrangler.jsonc')], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: output ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  }) ?? '';

const listLocal = async (): Promise<Key[]> => {
  const configPath = resolve(root, 'wrangler.jsonc');
  const config = JSON5.parse(readFileSync(configPath, 'utf8')) as { kv_namespaces: { binding: string; id: string }[] };
  const namespaceId = config.kv_namespaces.find(namespace => namespace.binding === binding)?.id;
  if (!namespaceId) throw new Error(`Missing namespace ID for ${binding}`);
  const miniflare = new Miniflare(convertV4MiniflareOptions({
    script: 'addEventListener("fetch", (event) => event.respondWith(new Response(null, { status: 404 })))',
    resourcePersistencePath: resolve(root, '.wrangler/state/v3'),
    kvNamespaces: { NAMESPACE: namespaceId },
  }));
  try {
    const namespace = await miniflare.getKVNamespace('NAMESPACE');
    const keys: Key[] = [];
    let cursor: string | undefined;
    do {
      const page = await namespace.list({ cursor });
      keys.push(...page.keys);
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return keys;
  } finally {
    await miniflare.dispose();
  }
};
const list = (location: string): Promise<Key[]> =>
  location === '--local' ? listLocal() : Promise.resolve(JSON.parse(run(['key', 'list', location])) as Key[]);
const sourceKeys = (await list(source)).filter(key => key.name !== 'sync:dirty');
const destinationKeys = new Set((await list(destination)).map(key => key.name));
const additions = sourceKeys.filter(key => !destinationKeys.has(key.name)).length;
const existing = sourceKeys.length - additions;

console.info(`${direction} ${binding}: ${sourceKeys.length} source keys -> ${destination}`);
console.info(`${additions} new keys, ${existing} existing keys will be overwritten; destination-only keys are retained.`);
if (!confirmed) {
  console.info('Dry run. Re-run with --yes to copy values and metadata.');
} else {
  const directory = await mkdtemp(join(tmpdir(), 'game-library-kv-'));
  try {
    let batch: Entry[] = [];
    let bytes = 2;
    let copied = 0;
    const upload = async (): Promise<void> => {
      if (!batch.length) return;
      const file = join(directory, 'upload.json');
      await writeFile(file, JSON.stringify(batch), { mode: 0o600 });
      run(['bulk', 'put', file, destination], false);
      copied += batch.length;
      console.info(`Copied ${copied}/${sourceKeys.length} keys`);
      batch = [];
      bytes = 2;
    };

    for (let offset = 0; offset < sourceKeys.length; offset += 100) {
      const keys = sourceKeys.slice(offset, offset + 100);
      const file = join(directory, 'keys.json');
      await writeFile(file, JSON.stringify(keys.map(key => key.name)), { mode: 0o600 });
      const values = JSON.parse(run(['bulk', 'get', file, source])) as Record<string, { value: string | null }>;
      for (const key of keys) {
        const value = values[key.name]?.value;
        if (value === undefined || value === null) throw new Error(`Missing source value for ${key.name}`);
        const entry: Entry = { key: key.name, value };
        if (key.metadata !== undefined) entry.metadata = key.metadata;
        if (key.expiration !== undefined) entry.expiration = key.expiration;
        const size = Buffer.byteLength(JSON.stringify(entry)) + 1;
        if (batch.length && (batch.length >= 1000 || bytes + size > 40 * 1024 * 1024)) await upload();
        batch.push(entry);
        bytes += size;
      }
    }
    await upload();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}