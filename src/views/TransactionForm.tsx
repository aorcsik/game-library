import { emptyItem, type ItemDraft, type TransactionDraft } from '../form';
import type { ItemLink } from '../games';
import { KINDS, PLATFORMS, SERVICES, SYSTEMS, type Transaction } from '../model';
import { Layout, Options, Select } from './Layout';

const GameLinks = ({ links }: { links: ItemLink[] }) => (
  <p class="game-links">
    Game: {links.map(({ title, resolution, explicit }, i) => (
      <>
        {i > 0 && ', '}
        {!resolution && <span class="missing">{links.length > 1 ? `${title}: ` : ''}no game</span>}
        {resolution && 'ambiguous' in resolution && <span class="missing">{title}: ambiguous ({resolution.ambiguous.join(', ')}), set a game key</span>}
        {resolution && 'key' in resolution && <a href={`/games/${resolution.key}`}>{links.length > 1 ? title : resolution.key}{explicit ? ' (explicit)' : ''}</a>}
      </>
    ))}
  </p>
);

const ItemFields = ({ item, index, links }: { item: ItemDraft; index: string; links?: ItemLink[] }) => {
  const name = (field: string): string => `items[${index}][${field}]`;
  return (
    <fieldset class="item" data-item>
      <div class="item-cover">
        {item.cover ? <img src={item.cover} alt="" data-cover-preview /> : <img alt="" data-cover-preview hidden />}
      </div>
      <div class="item-fields">
        {links && links.length > 0 && <GameLinks links={links} />}
        <div class="row">
          <label class="grow">Title<input name={name('title')} value={item.title} required maxlength={300} /></label>
          <label>Platform<Select name={name('platform')} required><Options values={PLATFORMS} selected={item.platform} empty="—" /></Select></label>
          <label>Kind<Select name={name('kind')}><Options values={KINDS} selected={item.kind || 'game'} /></Select></label>
          <label>Service<Select name={name('service')}><Options values={SERVICES} selected={item.service} empty="—" /></Select></label>
          <label>Systems<select name={name('systems')} multiple size={2}>{SYSTEMS.map(s => <option value={s} selected={item.systems.includes(s)}>{s}</option>)}</select></label>
          <label class="narrow">Price<input name={name('price')} value={item.price} placeholder="split" /></label>
        </div>
        <div class="row">
          <label class="grow">Cover URL<input name={name('cover')} value={item.cover} type="url" data-cover-input /></label>
          <label>Game key<input name={name('game')} value={item.game} placeholder="auto by title" pattern="[a-z0-9-]+" /></label>
          <label class="check"><input type="checkbox" name={name('physical')} checked={item.physical} /> physical</label>
          <label class="check"><input type="checkbox" name={name('unclaimed')} checked={item.unclaimed} /> unclaimed</label>
          <label class="check"><input type="checkbox" name={name('hidden')} checked={item.hidden} /> hidden</label>
          <button type="button" class="danger" data-action="remove-item">Remove</button>
        </div>
        <details open={!!item.contents}>
          <summary>Contents (collection / pack, one title per line)</summary>
          <textarea name={name('contents')} rows={4}>{item.contents}</textarea>
        </details>
        <details open={!!item.aliases}>
          <summary>Aliases (other titles, e.g. the store listing, one per line)</summary>
          <textarea name={name('aliases')} rows={2}>{item.aliases}</textarea>
        </details>
        <details open={!!item.notes}>
          <summary>Notes</summary>
          <textarea name={name('notes')} rows={3} maxlength={5000}>{item.notes}</textarea>
        </details>
      </div>
    </fieldset>
  );
};

type Props = {
  draft: TransactionDraft;
  action: string;
  stores: string[];
  errors?: string[];
  saved?: boolean;
  existing?: Pick<Transaction, 'date' | 'id' | 'legacy' | 'updatedAt' | 'source' | 'dateRange'>;
  links?: ItemLink[][];
};

const orderUrl = (store: string, referenceId: string, notes: string): string | undefined =>
  store === 'Fanatical' && /^[a-f0-9]{24}$/.test(referenceId)
    ? `https://www.fanatical.com/en/orders/${referenceId}` : humbleDownloadUrl(store, notes);

const humbleDownloadUrl = (store: string, notes: string): string | undefined => {
  if (store !== 'Humble Store') return undefined;
  for (const [candidate] of notes.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    try {
      const url = new URL(candidate.replace(/[.,;!?)]*$/, ''));
      if (['humblebundle.com', 'www.humblebundle.com'].includes(url.hostname) && url.pathname === '/downloads') return url.href;
    } catch {
      continue;
    }
  }
  return undefined;
};

export const TransactionForm = ({ draft, action, stores, errors = [], saved, existing, links }: Props) => (
  <Layout title={draft.title || draft.referenceId || 'New transaction'}>
    <h1>{existing ? draft.title || draft.store : 'New transaction'}</h1>
    {existing && draft.referenceId && (
      <p class="transaction-detail-reference">
        Invoice / order ID: {orderUrl(draft.store, draft.referenceId, draft.notes)
          ? <a href={orderUrl(draft.store, draft.referenceId, draft.notes)} target="_blank" rel="noopener noreferrer">{draft.referenceId}</a>
          : draft.referenceId}
      </p>
    )}
    {saved && <p class="notice">Saved.</p>}
    {existing?.dateRange && <p class="warning">Estimated date: purchased between {existing.dateRange[0]} and {existing.dateRange[1]}. Saving with a new date clears this.</p>}
    {errors.length > 0 && <ul class="errors">{errors.map(e => <li>{e}</li>)}</ul>}
    <form method="post" action={action} class="tx-form">
      <div class="row">
        <label>Date<input type="date" name="date" value={draft.date} required /></label>
        <label class="grow">Title<input name="title" value={draft.title} maxlength={300} /></label>
        <label>Invoice / order ID<input name="referenceId" value={draft.referenceId} maxlength={100} /></label>
        <label>Store<input name="store" value={draft.store} list="stores" required maxlength={100} /></label>
        <label class="narrow">Price<input name="price" value={draft.price} placeholder="unknown" /></label>
        <label class="check"><input type="checkbox" name="hidden" checked={draft.hidden} /> hidden</label>
      </div>
      <datalist id="stores">{stores.map(s => <option value={s} />)}</datalist>
      <label>Notes<textarea name="notes" rows={2}>{draft.notes}</textarea></label>

      <h2>Items <small>{draft.items.length}</small></h2>
      <div data-items data-next-index={draft.items.length}>
        {draft.items.map((item, i) => <ItemFields item={item} index={String(i)} links={links?.[i]} />)}
      </div>
      <template id="item-template"><ItemFields item={emptyItem()} index="__index__" /></template>
      <p><button type="button" data-action="add-item">Add item</button></p>

      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <a href="/transactions">Back to list</a>
      </div>
    </form>

    {existing && (
      <>
        <form method="post" action={`/transactions/${existing.date}/${existing.id}/delete`} data-confirm="Delete this transaction?" class="actions">
          <button type="submit" class="danger">Delete transaction</button>
        </form>
        <p class="meta">
          id {existing.id} · updated {existing.updatedAt}
          {existing.source && ` · imported from ${existing.source}`}
          {existing.legacy && ` · imported from ${existing.legacy.file}#${existing.legacy.index} (platform "${existing.legacy.platform}", store "${existing.legacy.store}", price "${existing.legacy.price}")`}
        </p>
      </>
    )}
  </Layout>
);
