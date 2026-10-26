import { creatorNames, type CreatorCredit, type CreatorDraft, type CreatorGameLink, type CreatorRef, type CreatorRole } from '../creators';
import type { GameRef } from '../gamedb';
import { Layout } from './Layout';

export type CreatorGame = GameRef & { as?: string; roles: CreatorRole[]; link?: CreatorGameLink };
export type UnmatchedCreator = { name: string; games: CreatorGame[] };

export const CreatorLinks = ({ credits, links }: { credits: CreatorCredit[]; links?: ReadonlyMap<string, CreatorGameLink> }) => (
  <>
    {credits.map(({ name, key }, i) => (
      <>
        {i > 0 && ', '}
        <a class={`${key ? '' : 'creator-missing'}${key && links?.get(key)?.miscredit ? ' creator-miscredited' : ''}`}
          title={key && links?.get(key) ? [links.get(key)?.miscredit && 'Miscredited', links.get(key)?.notes].filter(Boolean).join(': ') : undefined}
          href={key ? `/creators/${key}` : `/creators/new?name=${encodeURIComponent(name)}`}>{name}</a>
      </>
    ))}
  </>
);

const CreatorGames = ({ games, creator, editableNotes = false }: { games: CreatorGame[]; creator?: string; editableNotes?: boolean }) => (
  <ul class="creator-games">
    {games.map(game => (
      <li class={game.link?.miscredit ? 'creator-game-miscredited' : ''}>
        <form method="post" action={creator ? `/creators/${creator}/games/${game.key}` : undefined} data-creator-credit={creator ? '' : undefined}>
          {creator && <input type="checkbox" name="credited" value="1" checked={!game.link?.miscredit}
            aria-label={`Correct creator credit for ${game.meta.title}`} />}
          <a href={`/games/${game.key}`}>{game.meta.title}</a>
          {game.meta.release && <span class="release-year">{game.meta.release.slice(0, 4)}</span>}
          {game.as && <small class="creator-game-as">(as {game.as})</small>}
          <small class="creator-game-role">({game.roles.length ? game.roles.map(role => role === 'developer' ? 'Developer' : 'Publisher').join(', ') : 'OpenCritic only'})</small>
          {creator && editableNotes && (
            <>
              <span class="creator-note-display" data-credit-note-display>
                <small class="creator-game-note" data-credit-note-text>{game.link?.notes || 'No note'}</small>
                <button type="button" class="creator-note-action" data-action="edit-credit-note"
                  aria-label={`Edit attribution note for ${game.meta.title}`} title="Edit note">
                  <i class="fa-solid fa-pen" aria-hidden="true"></i>
                </button>
              </span>
              <span class="creator-note-editor" data-credit-note-editor hidden>
                <input name="notes" value={game.link?.notes ?? ''} maxlength={1000} disabled
                  placeholder="Attribution note" aria-label={`Attribution note for ${game.meta.title}`} />
                <button type="button" class="creator-note-action" data-action="save-credit-note"
                  aria-label={`Save attribution note for ${game.meta.title}`} title="Save note">
                  <i class="fa-solid fa-check" aria-hidden="true"></i>
                </button>
                <button type="button" class="creator-note-action" data-action="cancel-credit-note"
                  aria-label={`Cancel editing attribution note for ${game.meta.title}`} title="Cancel">
                  <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </span>
            </>
          )}
          {!editableNotes && game.link?.notes && <small class="creator-game-note" title={game.link.notes}>Note: {game.link.notes}</small>}
          {creator && <small class="creator-credit-status" data-creator-credit-status role="status"></small>}
        </form>
      </li>
    ))}
  </ul>
);

const ParentLink = ({ parent, creators }: { parent?: string; creators: CreatorRef[] }) => {
  if (!parent) return null;
  const match = creators.find(creator => creator.key === parent);
  return match ? <a href={`/creators/${parent}`}>{match.name}</a> : <span class="creator-missing">Missing creator: {parent}</span>;
};

export const CreatorList = ({ creators, games, unmatched, verification }: {
  creators: CreatorRef[]; games: Map<string, CreatorGame[]>; unmatched: UnmatchedCreator[];
  verification: { verified: number; total: number };
}) => (
  <Layout title="Creators">
    <h1>Creators <small>{creators.length}</small></h1>
    <div class="creator-verification">
      <label for="creator-verification">Creator verification: {verification.verified} / {verification.total} distinct credits
        {verification.total > 0 && ` (${Math.round(verification.verified / verification.total * 100)}%)`}
      </label>
      <progress id="creator-verification" value={verification.verified} max={verification.total || 1}></progress>
    </div>
    {unmatched.length > 0 && (
      <details class="group">
        <summary>Creator names without a record ({unmatched.length})</summary>
        <table class="list">
          <tbody>
            {unmatched.map(({ name, games }) => (
              <tr>
                <td>{name}</td>
                <td><CreatorGames games={games} /></td>
                <td class="num"><a href={`/creators/new?name=${encodeURIComponent(name)}`}>Create creator</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    )}
    <div class="filters">
      <input type="search" placeholder="Filter creators or games…" data-filter="#creators" />
      <a href="/creators/new">New creator</a>
      <button type="button" data-action="expand-all" data-target="#creators">Expand all</button>
    </div>
    <div id="creators">
      <table class="list creator-list" data-sort="name" data-direction="asc">
        <thead>
          <tr>
            <th></th>
            <th aria-sort="ascending"><button type="button" class="creator-sort" data-creator-sort="name">Creator <span data-sort-indicator aria-hidden="true">↑</span></button></th>
            <th>Parent</th>
            <th>Roles</th>
            <th><button type="button" class="creator-sort" data-creator-sort="games">Games <span data-sort-indicator aria-hidden="true"></span></button></th>
          </tr>
        </thead>
        {creators.map(creator => {
          const matches = games.get(creator.key) ?? [];
          const roles = [...new Set(matches.flatMap(game => game.roles))];
          return (
            <tbody data-expandable data-creator-name={creator.name} data-game-count={matches.length} data-search={[...creatorNames(creator), creators.find(parent => parent.key === creator.parent)?.name ?? '', ...matches.map(game => game.meta.title), ...roles].join(' ').toLowerCase()}>
              <tr>
                <td class="toggle"><button type="button" class="expand" data-action="toggle-items" data-item-label="games" aria-expanded="false" aria-label="Show games">+</button></td>
                <td>
                  <a href={`/creators/${creator.key}`}>{creator.name}</a>
                  {creator.url && <small>{' '}<a href={creator.url} target="_blank" rel="noopener noreferrer"><i class="fas fa-up-right-from-square"></i></a></small>}
                  {creator.aka?.length ? <small class="creator-aliases">a.k.a. {creator.aka.join(', ')}</small> : null}
                  {creator.aliases.length > 0 && <small class="creator-aliases">Aliases: {creator.aliases.join(', ')}</small>}
                </td>
                <td><ParentLink parent={creator.parent} creators={creators} /></td>
                <td>{roles.length ? roles.map(role => role === 'developer' ? 'Developer' : 'Publisher').join(', ') : '—'}</td>
                <td>{matches.length}</td>
              </tr>
              <tr class="items-row" data-items hidden>
                <td></td>
                <td colspan={4}>
                  {matches.length ? <CreatorGames games={matches} creator={creator.key} /> : <span class="meta">No games matched yet.</span>}
                </td>
              </tr>
            </tbody>
          );
        })}
      </table>
    </div>
  </Layout>
);

export const CreatorPage = ({ draft, games, creators, creator, saved = false, errors = [] }: {
  draft: CreatorDraft; games: CreatorGame[]; creators: CreatorRef[]; creator?: CreatorRef; saved?: boolean; errors?: string[];
}) => {
  const parentName = creators.find(option => option.key === draft.parent)?.name ?? (draft.parent ? `Unknown parent: ${draft.parent}` : 'No parent');
  const children = creator
    ? creators.filter(option => option.parent === creator.key).sort((a, b) => a.name.localeCompare(b.name))
    : [];
  return (
  <Layout title={creator?.name ?? 'New creator'}>
    <h1>{creator?.name ?? 'New creator'}</h1>
    {saved && <p class="notice">Saved.</p>}
    {errors.length > 0 && <ul class="errors">{errors.map(error => <li>{error}</li>)}</ul>}
    {creator?.aka?.length ? <p class="creator-aliases">a.k.a. {creator.aka.join(', ')}</p> : null}
    {creator?.parent && <p>Parent: <ParentLink parent={creator.parent} creators={creators} /></p>}
    {creator?.url && <p><a href={creator.url} target="_blank" rel="noopener noreferrer">{creator.url}</a></p>}
    {children.length > 0 && (
      <section class="creator-subsidiaries">
        <h2>Subsidiaries <small>{children.length}</small></h2>
        <ul class="creator-children">
          {children.map(child => <li><a href={`/creators/${child.key}`}>{child.name}</a></li>)}
        </ul>
      </section>
    )}
    <h2>Games <small>{games.length}</small></h2>
    {games.length ? <CreatorGames games={games} creator={creator?.key} editableNotes /> : <p class="meta">No games matched yet.</p>}
    <h2>{creator ? 'Edit' : 'Create'}</h2>
    <form method="post" action={creator ? `/creators/${creator.key}` : '/creators'} class="tx-form">
      <label>Name<input name="name" value={draft.name} required maxlength={300} /></label>
      <label>Aliases (other source names, one per line)<textarea name="aliases" rows={4}>{draft.aliases}</textarea></label>
      <label>A.k.a. (distinct names to display as written, one per line)<textarea name="aka" rows={4}>{draft.aka}</textarea></label>
      <div class="parent-field">
        <span id="parent-field-label">Parent</span>
        <details class="filter-dropdown parent-dropdown" data-parent-dropdown>
          <summary aria-labelledby="parent-field-label parent-selection"><span id="parent-selection" data-parent-selection>{parentName}</span></summary>
          <input type="search" data-filter="#parent-options" placeholder="Search creators…" aria-label="Search parent creators" />
          <div id="parent-options" class="filter-options">
            <label data-search="no parent"><input type="radio" name="parent" value="" data-parent-option data-parent-name="No parent" checked={!draft.parent} /> No parent</label>
            {creators.filter(option => option.key !== creator?.key).sort((a, b) => a.name.localeCompare(b.name))
              .map(option => (
                <label data-search={option.name.toLowerCase()}>
                  <input type="radio" name="parent" value={option.key} data-parent-option data-parent-name={option.name} checked={option.key === draft.parent} /> {option.name}
                </label>
              ))}
          </div>
        </details>
      </div>
      <label>URL<input name="url" type="url" value={draft.url} maxlength={2048} placeholder="https://…" /></label>
      <div class="actions"><button type="submit" class="primary">Save</button><a href="/creators">Back to creators</a></div>
    </form>
    {creator && (
      <form method="post" action={`/creators/${creator.key}/delete`} data-confirm={`Delete ${creator.name}? Games credited to this creator will become unmatched.`} class="actions">
        <button type="submit" class="danger">Delete creator</button>
      </form>
    )}
  </Layout>
  );
};
