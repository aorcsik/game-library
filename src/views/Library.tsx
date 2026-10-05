import type { Library, LibraryEntry, Platform } from '../model';
import { Layout } from './Layout';

const DEFAULT_STORES: Partial<Record<Platform, string>> = {
  playstation: 'PlayStation Store',
  switch: 'Nintendo eShop',
  xbox: 'Xbox Store',
  steam: 'Steam Store',
};

const newTransactionUrl = (platform: Platform, entry: LibraryEntry): string => {
  const params = new URLSearchParams({ title: entry.title, platform, store: DEFAULT_STORES[platform] ?? '' });
  if (entry.cover) params.set('cover', entry.cover);
  if (entry.system) params.set('system', entry.system);
  if (entry.service) params.set('service', entry.service);
  if (entry.physical) params.set('physical', '1');
  return `/transactions/new?${params}`;
};

export const LibraryIndex = ({ libraries }: { libraries: Library[] }) => (
  <Layout title="Libraries">
    <h1>Libraries</h1>
    <p>Snapshots of platform "owned games" pages imported from the legacy JSON files.</p>
    <ul>
      {libraries.map(l => (
        <li><a href={`/library/${l.platform}`}>{l.platform}</a> — {l.entries.length} entries, {Object.keys(l.collections).length} collections</li>
      ))}
    </ul>
  </Layout>
);

export const LibraryPage = ({ library, owned }: { library: Library; owned: (title: string) => boolean }) => {
  const missing = library.entries.filter(e => !owned(e.title)).length;
  return (
    <Layout title={`${library.platform} library`}>
      <h1>{library.platform} library <small>{library.entries.length} entries, {missing} without transaction</small></h1>
      <p class="filters">
        <input type="search" placeholder="Filter by title…" data-filter="#library" />
        <label class="check"><input type="checkbox" data-toggle-class="only-missing" data-target="#library" /> only without transaction</label>
      </p>
      <div id="library" class="cards">
        {library.entries.map(entry => {
          const isOwned = owned(entry.title);
          return (
            <div class={`card ${isOwned ? 'owned' : 'missing'}`} data-search={entry.title.toLowerCase()}>
              {entry.cover && <img src={entry.cover} alt="" loading="lazy" />}
              <div class="card-body">
                <strong>{entry.title}</strong>
                <span class="tags">{[entry.system, entry.service, entry.physical && 'physical'].filter(Boolean).join(' · ')}</span>
                {!isOwned && <a href={newTransactionUrl(library.platform, entry)}>Add transaction</a>}
              </div>
            </div>
          );
        })}
      </div>
      {Object.keys(library.collections).length > 0 && (
        <>
          <h2>Collections</h2>
          <dl class="collections">
            {Object.entries(library.collections).map(([title, contents]) => (
              <>
                <dt>{title}</dt>
                <dd>{contents.join(', ')}</dd>
              </>
            ))}
          </dl>
        </>
      )}
    </Layout>
  );
};
