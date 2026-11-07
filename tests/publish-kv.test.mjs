import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..');

const fixture = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'publish-kv-test-'));
  await mkdir(join(dir, 'scripts'), { recursive: true });
  await mkdir(join(dir, 'node_modules/.bin'), { recursive: true });
  await mkdir(join(dir, 'node_modules/miniflare'), { recursive: true });
  await mkdir(join(dir, 'node_modules/json5'), { recursive: true });
  await mkdir(join(dir, '.wrangler/state/v3/kv'), { recursive: true });
  for (const script of ['publish-kv.ts', 'sync-kv.ts']) {
    await copyFile(join(root, 'scripts', script), join(dir, 'scripts', script));
  }
  await writeFile(join(dir, 'package.json'), '{"type":"module"}');
  const namespaces = [{ binding: 'GAMEDB', id: 'one' }, { binding: 'SECOND', id: 'two' }];
  for (const namespace of namespaces) {
    await mkdir(join(dir, '.wrangler/state/v3/kv', namespace.id));
  }
  await writeFile(join(dir, 'wrangler.jsonc'), JSON.stringify({
    kv_namespaces: namespaces, env: { remote: { kv_namespaces: namespaces } },
  }));
  await writeFile(join(dir, 'node_modules/json5/package.json'), '{"type":"module","exports":"./index.js"}');
  await writeFile(join(dir, 'node_modules/json5/index.js'), 'export default JSON;');
  await writeFile(join(dir, 'node_modules/miniflare/package.json'), '{"type":"module","exports":"./index.js"}');
  await writeFile(join(dir, 'node_modules/miniflare/index.js'), `
    export const convertV4MiniflareOptions = options => options;
    export class Miniflare {
      constructor(options) { this.id = options.kvNamespaces.NAMESPACE; }
      async getKVNamespace() {
        return { list: async () => ({ list_complete: true, keys: this.id === 'one'
          ? [{ name: 'keep', metadata: { title: 'Title' }, expiration: 2000000000 }, { name: 'sync:dirty' }]
          : [{ name: 'second' }] }) };
      }
      async dispose() {}
    }
  `);
  await writeFile(join(dir, 'node_modules/.bin/wrangler'), `#!${process.execPath}
    import { appendFileSync, readFileSync } from 'node:fs';
    const args = process.argv.slice(2);
    const binding = args[args.indexOf('--binding') + 1];
    if (args.includes('list')) {
      console.log(JSON.stringify(binding === 'GAMEDB'
        ? [{ name: 'keep' }, { name: 'obsolete' }, { name: 'sync:dirty' }]
        : [{ name: 'old-second' }]));
    } else if (args.includes('get')) {
      const keys = JSON.parse(readFileSync(args[args.indexOf('get') + 1], 'utf8'));
      console.log(JSON.stringify(Object.fromEntries(keys.map(key => [key, { value: 'value:' + key }]))));
    } else if (args.includes('key') && args.includes('delete')) {
      appendFileSync('operations.jsonl', JSON.stringify({ binding, operation: 'clear-dirty' }) + '\\n');
    } else {
      const operation = args.includes('put') ? 'put' : 'delete';
      const entries = JSON.parse(readFileSync(args[args.indexOf(operation) + 1], 'utf8'));
      appendFileSync('operations.jsonl', JSON.stringify({ binding, operation, entries }) + '\\n');
      if (process.env.FAIL_PUT === binding && operation === 'put') process.exit(1);
    }
  `, { mode: 0o755 });
  return dir;
};

const run = (dir, script, args = [], env = {}) => spawnSync(process.execPath, [join(dir, 'scripts', script), ...args], {
  cwd: dir, encoding: 'utf8', env: { ...process.env, ...env },
});
const operations = async dir => (await readFile(join(dir, 'operations.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);

test('publish previews and then mirrors each namespace, retaining metadata and excluding dirty markers', async () => {
  const dir = await fixture();
  try {
    const preview = run(dir, 'publish-kv.ts');
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /push GAMEDB: 1 source keys/);
    assert.match(preview.stdout, /push SECOND: 1 source keys/);
    assert.match(preview.stdout, /1 destination-only keys will be deleted/);
    await assert.rejects(readFile(join(dir, 'operations.jsonl')), { code: 'ENOENT' });

    const publish = run(dir, 'publish-kv.ts', ['--yes']);
    assert.equal(publish.status, 0, publish.stderr);
    assert.deepEqual(await operations(dir), [
      { binding: 'GAMEDB', operation: 'put', entries: [{ key: 'keep', value: 'value:keep', metadata: { title: 'Title' }, expiration: 2000000000 }] },
      { binding: 'GAMEDB', operation: 'delete', entries: ['obsolete'] },
      { binding: 'GAMEDB', operation: 'clear-dirty' },
      { binding: 'SECOND', operation: 'put', entries: [{ key: 'second', value: 'value:second' }] },
      { binding: 'SECOND', operation: 'delete', entries: ['old-second'] },
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('ordinary KV push retains destination-only keys and publish stops on a failed upload', async () => {
  const dir = await fixture();
  try {
    const push = run(dir, 'sync-kv.ts', ['push', '--binding', 'GAMEDB', '--yes']);
    assert.equal(push.status, 0, push.stderr);
    assert.deepEqual((await operations(dir)).map(entry => entry.operation), ['put']);
    await writeFile(join(dir, 'operations.jsonl'), '');
    const publish = run(dir, 'publish-kv.ts', ['--yes'], { FAIL_PUT: 'GAMEDB' });
    assert.notEqual(publish.status, 0);
    assert.deepEqual((await operations(dir)).map(entry => [entry.binding, entry.operation]), [['GAMEDB', 'put']]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('publish refuses absent local state and mismatched production bindings', async () => {
  const dir = await fixture();
  try {
    await rm(join(dir, '.wrangler/state/v3/kv'), { recursive: true });
    const missing = run(dir, 'publish-kv.ts', ['--yes']);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /No local KV state/);
    await mkdir(join(dir, '.wrangler/state/v3/kv'), { recursive: true });
    await writeFile(join(dir, 'wrangler.jsonc'), JSON.stringify({
      kv_namespaces: [{ binding: 'FIRST', id: 'one' }],
      env: { remote: { kv_namespaces: [{ binding: 'FIRST', id: 'different' }] } },
    }));
    const mismatch = run(dir, 'publish-kv.ts', ['--yes']);
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /must each match a production namespace/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('publish refuses an uninitialized namespace before mirroring', async () => {
  const dir = await fixture();
  try {
    await rm(join(dir, '.wrangler/state/v3/kv/two'), { recursive: true });
    const publish = run(dir, 'publish-kv.ts', ['--yes']);
    assert.notEqual(publish.status, 0);
    assert.match(publish.stderr, /No local KV state found for SECOND/);
    await assert.rejects(readFile(join(dir, 'operations.jsonl')), { code: 'ENOENT' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
