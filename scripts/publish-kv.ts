// Mirrors all local KV namespaces to production. Usage: npm run publish -- [--yes]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSON5 from 'json5';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--yes')) {
  throw new Error('Usage: npm run publish -- [--yes]');
}
if (!existsSync(resolve(root, '.wrangler/state/v3/kv'))) {
  throw new Error('No local KV state found; refusing to publish an empty store.');
}

type Namespace = { binding: string; id: string };
const config = JSON5.parse(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8')) as {
  kv_namespaces: Namespace[];
  env?: { remote?: { kv_namespaces?: Namespace[] } };
};
const local = config.kv_namespaces;
const remote = config.env?.remote?.kv_namespaces;
if (!Array.isArray(local) || !local.length || !Array.isArray(remote) ||
    new Set(local.map(namespace => namespace.binding)).size !== local.length ||
    local.some(namespace => !namespace.binding || !namespace.id ||
      remote.filter(target => target.binding === namespace.binding && target.id === namespace.id).length !== 1)) {
  throw new Error('Local KV namespaces must each match a production namespace in the remote Wrangler environment.');
}

for (const namespace of local) {
  if (!existsSync(resolve(root, '.wrangler/state/v3/kv', namespace.id))) {
    throw new Error(`No local KV state found for ${namespace.binding}; refusing to publish an uninitialized namespace.`);
  }
}

for (const namespace of local) {
  execFileSync(process.execPath, [
    resolve(root, 'scripts/sync-kv.ts'), 'push', '--binding', namespace.binding, '--mirror', ...args,
  ], { cwd: root, stdio: 'inherit' });
}
