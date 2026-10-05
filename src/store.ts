import { libraryKey, toMeta, txKey, type Library, type Platform, type Transaction, type TransactionMeta } from './model';

export type TransactionRef = { date: string; id: string; meta: TransactionMeta };

const BULK_GET_LIMIT = 100;

const listKeys = async <M>(kv: KVNamespace, prefix: string): Promise<{ name: string; metadata?: M }[]> => {
  const keys: { name: string; metadata?: M }[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list<M>({ prefix, cursor });
    keys.push(...page.keys.map(k => ({ name: k.name, metadata: k.metadata ?? undefined })));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
};

const parseTxKey = (key: string): { date: string; id: string } => {
  const [, date, id] = key.split(':');
  return { date, id };
};

/** Oldest first (keys sort by date). */
export const listTransactions = async (kv: KVNamespace): Promise<TransactionRef[]> =>
  (await listKeys<TransactionMeta>(kv, 'tx:'))
    .filter(k => k.metadata)
    .map(k => ({ ...parseTxKey(k.name), meta: k.metadata as TransactionMeta }));

export const getAllTransactions = async (kv: KVNamespace): Promise<Transaction[]> => {
  const names = (await listKeys(kv, 'tx:')).map(k => k.name);
  const result: Transaction[] = [];
  for (let i = 0; i < names.length; i += BULK_GET_LIMIT) {
    const values = await kv.get<Transaction>(names.slice(i, i + BULK_GET_LIMIT), 'json');
    for (const name of names.slice(i, i + BULK_GET_LIMIT)) {
      const tx = values.get(name);
      if (tx) result.push(tx);
    }
  }
  return result;
};

export const getTransaction = (kv: KVNamespace, date: string, id: string): Promise<Transaction | null> =>
  kv.get<Transaction>(txKey(date, id), 'json');

export const saveTransaction = async (kv: KVNamespace, tx: Transaction, previous?: { date: string; id: string }): Promise<void> => {
  await kv.put(txKey(tx.date, tx.id), JSON.stringify(tx), { metadata: toMeta(tx) });
  if (previous && txKey(previous.date, previous.id) !== txKey(tx.date, tx.id)) {
    await kv.delete(txKey(previous.date, previous.id));
  }
};

export const deleteTransaction = (kv: KVNamespace, date: string, id: string): Promise<void> =>
  kv.delete(txKey(date, id));

export const listLibraryPlatforms = async (kv: KVNamespace): Promise<Platform[]> =>
  (await listKeys(kv, 'library:')).map(k => k.name.slice('library:'.length) as Platform);

export const getLibrary = (kv: KVNamespace, platform: Platform): Promise<Library | null> =>
  kv.get<Library>(libraryKey(platform), 'json');

export const getAllLibraries = async (kv: KVNamespace): Promise<Library[]> => {
  const platforms = await listLibraryPlatforms(kv);
  const libraries = await Promise.all(platforms.map(p => getLibrary(kv, p)));
  return libraries.filter((l): l is Library => l !== null);
};
