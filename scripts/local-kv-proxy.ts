import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import JSON5 from 'json5';
import { getPlatformProxy } from 'wrangler';

const root = resolve(import.meta.dirname, '..');

export const getLocalKvProxy = async <Env>() => {
  const config = JSON5.parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8')) as {
    compatibility_date: string;
    kv_namespaces: { binding: string; id: string }[];
  };
  if (!config.compatibility_date || !Array.isArray(config.kv_namespaces) || !config.kv_namespaces.length) {
    throw new Error('Wrangler config must define a compatibility date and local KV namespaces.');
  }
  const directory = await mkdtemp(join(tmpdir(), 'game-library-kv-proxy-'));
  try {
    const configPath = join(directory, 'wrangler.json');
    await writeFile(configPath, JSON.stringify({
      name: 'game-library-kv-proxy',
      compatibility_date: config.compatibility_date,
      kv_namespaces: config.kv_namespaces,
    }));
    const proxy = await getPlatformProxy<Env>({
      configPath,
      persist: { path: resolve(root, '.wrangler/state/v3') },
      envFiles: [],
      remoteBindings: false,
    });
    return {
      proxy,
      dispose: async () => {
        try {
          await proxy.dispose();
        } finally {
          await rm(directory, { recursive: true });
        }
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true });
    throw error;
  }
};
