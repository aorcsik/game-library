import { KINDS, PLATFORMS } from '../model';
import { isSteamSynced, type WishlistItem } from '../wishlist';
import type { WishlistDraft } from '../wishlistForm';
import { Layout, Options, Select } from './Layout';
import { StoreField } from './StoreField';

export const WishlistForm = ({ item, draft, action, stores, errors = [], saved }: {
  item?: WishlistItem; draft: WishlistDraft; action: string; stores: string[]; errors?: string[]; saved?: boolean;
}) => {
  const synced = !!item && isSteamSynced(item);
  return (
    <Layout title={item ? item.title || 'Edit wishlist entry' : 'New wishlist entry'}>
      <h1>{item ? 'Edit wishlist entry' : 'New wishlist entry'}</h1>
      {saved && <p class="notice">Saved.</p>}
      {errors.length > 0 && <ul class="errors">{errors.map(error => <li>{error}</li>)}</ul>}
      {synced && <p class="meta">Steam sync manages the read-only fields. Store and included games are kept when syncing.</p>}
      <form method="post" action={action} class="tx-form">
        <div class="row">
          <label class="grow">Title<input name="title" value={draft.title} required={!synced} maxlength={300} readonly={synced} /></label>
          {synced
            ? <label>Platform<input name="platform" value={draft.platform} readonly /></label>
            : <label>Platform<Select name="platform" required><Options values={PLATFORMS} selected={draft.platform} empty="—" /></Select></label>}
          {synced
            ? <label>Kind<input name="kind" value={draft.kind} readonly /></label>
            : <label>Kind<Select name="kind" required><Options values={KINDS} selected={draft.kind} /></Select></label>}
          <StoreField value={draft.store} stores={stores} />
          <label>Added<input type="date" name="addedAt" value={draft.addedAt} readonly={synced} /></label>
        </div>
        <label>Store URL<input type="url" name="url" value={draft.url} readonly={synced} /></label>
        <label>Included games (one title per line)<textarea name="included" rows={4}>{draft.included}</textarea></label>
        {!synced && <label class="check"><input type="checkbox" name="archived" checked={draft.archived} /> archived</label>}
        {item && <p class="meta">id {item.id} · first seen {item.firstSeen} · last seen {item.lastSeen}{item.archivedAt && ` · archived ${item.archivedAt}`}</p>}
        <div class="actions">
          <button type="submit" class="primary">Save</button>
          <a href="/wishlist">Back to wishlist</a>
        </div>
      </form>
      {item?.source === 'manual' && (
        <form method="post" action={`${action}/delete`} data-confirm="Delete this wishlist entry?" class="actions">
          <button type="submit" class="danger">Delete wishlist entry</button>
        </form>
      )}
    </Layout>
  );
};
