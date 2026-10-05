import {
  CURRENCIES, KINDS, PLATFORMS, SERVICES, SYSTEMS, formatPrice, isOneOf, parsePrice,
  type Item, type Transaction,
} from './model';

/** Raw form state, so invalid input can be re-rendered as typed. */
export type ItemDraft = {
  title: string;
  platform: string;
  kind: string;
  service: string;
  systems: string[];
  price: string;
  cover: string;
  physical: boolean;
  unclaimed: boolean;
  hidden: boolean;
  game: string;
  aliases: string;
  contents: string;
};

export type TransactionDraft = {
  date: string;
  title: string;
  store: string;
  price: string;
  notes: string;
  hidden: boolean;
  items: ItemDraft[];
};

export const emptyItem = (values: Partial<ItemDraft> = {}): ItemDraft => ({
  title: '', platform: '', kind: '', service: '', systems: [], price: '', cover: '',
  physical: false, unclaimed: false, hidden: false, game: '', aliases: '', contents: '',
  ...values,
});

export const toDraft = (tx: Transaction): TransactionDraft => ({
  date: tx.date,
  title: tx.title,
  store: tx.store,
  price: formatPrice(tx.price),
  notes: tx.notes ?? '',
  hidden: !!tx.hidden,
  items: tx.items.map(item => emptyItem({
    title: item.title,
    platform: item.platform,
    kind: item.kind ?? '',
    service: item.service ?? '',
    systems: item.systems ?? [],
    price: formatPrice(item.price),
    cover: item.cover ?? '',
    physical: !!item.physical,
    unclaimed: !!item.unclaimed,
    hidden: !!item.hidden,
    game: item.game ?? '',
    aliases: (item.aliases ?? []).join('\n'),
    contents: (item.contents ?? []).join('\n'),
  })),
});

export const readDraft = (form: FormData): TransactionDraft => {
  const text = (name: string): string => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const indexes = [...form.keys()]
    .map(name => name.match(/^items\[(\d+)\]\[title\]$/)?.[1])
    .filter((i): i is string => i !== undefined)
    .map(Number)
    .sort((a, b) => a - b);

  return {
    date: text('date'),
    title: text('title'),
    store: text('store'),
    price: text('price'),
    notes: text('notes'),
    hidden: form.has('hidden'),
    items: indexes.map(i => {
      const field = (name: string): string => text(`items[${i}][${name}]`);
      return {
        title: field('title'),
        platform: field('platform'),
        kind: field('kind'),
        service: field('service'),
        systems: form.getAll(`items[${i}][systems]`).filter((v): v is string => typeof v === 'string' && v !== ''),
        price: field('price'),
        cover: field('cover'),
        physical: form.has(`items[${i}][physical]`),
        unclaimed: form.has(`items[${i}][unclaimed]`),
        hidden: form.has(`items[${i}][hidden]`),
        game: field('game'),
        aliases: field('aliases'),
        contents: field('contents'),
      };
    }),
  };
};

const isValidDate = (value: string): boolean => {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const isHttpUrl = (value: string): boolean => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const PRICE_HINT = `use e.g. "19.99 EUR" (${CURRENCIES.join(', ')}) or FREE`;

export const validateDraft = (
  draft: TransactionDraft,
  base: Pick<Transaction, 'id' | 'legacy' | 'source' | 'dateRange'> & { date?: string },
): { tx?: Transaction; errors: string[] } => {
  const errors: string[] = [];
  if (!isValidDate(draft.date)) errors.push('Date must be a valid YYYY-MM-DD date.');
  if (!draft.title || draft.title.length > 300) errors.push('Title is required (max 300 characters).');
  if (!draft.store || draft.store.length > 100) errors.push('Store is required (max 100 characters).');
  if (draft.notes.length > 5000) errors.push('Notes are too long.');
  const price = draft.price ? parsePrice(draft.price) : undefined;
  if (price === null) errors.push(`Transaction price is invalid: ${PRICE_HINT}, or leave empty if unknown.`);
  if (draft.items.length === 0) errors.push('At least one item is required.');

  const items: Item[] = draft.items.map((d, n) => {
    const label = `Item ${n + 1}`;
    if (!d.title || d.title.length > 300) errors.push(`${label}: title is required (max 300 characters).`);
    if (!isOneOf(PLATFORMS, d.platform)) errors.push(`${label}: platform is required.`);
    if (d.kind && !isOneOf(KINDS, d.kind)) errors.push(`${label}: unknown kind.`);
    if (d.service && !isOneOf(SERVICES, d.service)) errors.push(`${label}: unknown service.`);
    if (d.systems.some(s => !isOneOf(SYSTEMS, s))) errors.push(`${label}: unknown system.`);
    if (d.cover && !isHttpUrl(d.cover)) errors.push(`${label}: cover must be an http(s) URL.`);
    if (d.game && !/^[a-z0-9-]{1,120}$/.test(d.game)) errors.push(`${label}: game key must be a lowercase slug.`);
    const itemPrice = d.price ? parsePrice(d.price) : undefined;
    if (itemPrice === null) errors.push(`${label}: price is invalid, ${PRICE_HINT}.`);
    const lines = (value: string): string[] => value.split('\n').map(s => s.trim()).filter(Boolean);
    const contents = lines(d.contents);
    const aliases = lines(d.aliases);

    const item: Item = { title: d.title, platform: d.platform as Item['platform'] };
    if (d.kind && d.kind !== 'game') item.kind = d.kind as Item['kind'];
    if (d.service) item.service = d.service as Item['service'];
    if (d.systems.length) item.systems = d.systems as NonNullable<Item['systems']>;
    if (itemPrice) item.price = itemPrice;
    if (d.cover) item.cover = d.cover;
    if (d.physical) item.physical = true;
    if (d.unclaimed) item.unclaimed = true;
    if (d.hidden) item.hidden = true;
    if (aliases.length) item.aliases = aliases;
    if (d.game) item.game = d.game;
    if (contents.length) item.contents = contents;
    return item;
  });

  if (errors.length || price === null) return { errors };
  const tx: Transaction = {
    id: base.id,
    date: draft.date,
    title: draft.title,
    store: draft.store,
    items,
    updatedAt: new Date().toISOString(),
  };
  if (price) tx.price = price;
  if (draft.notes) tx.notes = draft.notes;
  if (draft.hidden) tx.hidden = true;
  if (base.dateRange && base.date === draft.date) tx.dateRange = base.dateRange;
  if (base.source) tx.source = base.source;
  if (base.legacy) tx.legacy = base.legacy;
  return { tx, errors };
};
