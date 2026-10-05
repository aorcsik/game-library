// Copies one KV namespace between the local Wrangler store and production.
// Usage: npm run kv:push -- --binding GAMES [--yes] (or kv:pull)
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
const readValue = (key: string): string =>
  execFileSync(wrangler, ['kv', 'key', 'get', key, source, '--binding', binding, '--config', resolve(root, 'wrangler.jsonc')], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  }).toString('utf8');

const list = (location: string): Key[] => JSON.parse(run(['key', 'list', location])) as Key[];
const sourceKeys = list(source).filter(key => key.name !== 'sync:dirty');
const destinationKeys = new Set(list(destination).map(key => key.name));
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
      const file = join(directory, 'batch.json');
      await writeFile(file, JSON.stringify(batch), { mode: 0o600 });
      run(['bulk', 'put', file, destination], false);
      copied += batch.length;
      console.info(`Copied ${copied}/${sourceKeys.length} keys`);
      batch = [];
      bytes = 2;
    };

    for (const key of sourceKeys) {
      const value = readValue(key.name);
      const entry: Entry = { key: key.name, value };
      if (key.metadata !== undefined) entry.metadata = key.metadata;
      if (key.expiration !== undefined) entry.expiration = key.expiration;
      const size = Buffer.byteLength(JSON.stringify(entry)) + 1;
      if (batch.length && (batch.length >= 1000 || bytes + size > 40 * 1024 * 1024)) await upload();
      batch.push(entry);
      bytes += size;
    }
    await upload();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}