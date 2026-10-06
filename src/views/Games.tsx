import config from '../config.json';
import {
  METACRITIC_BUCKETS, OPENCRITIC_TIERS, STEAM_REVIEWS, metacriticBucket, metacriticBucketColor, opencriticTier, steamReview,
  opencriticUrl, steamReviewColor, steamUrl,
  type Game, type GameMeta, type MetacriticData, type OpenCriticData, type Ownership, type SteamData,
} from '../games';
import { LEGACY_SYSTEM_LABELS, PLATFORM_GROUPS, SUBSCRIPTION_SERVICES, platformGroup, platformLabel } from '../model';
import type { PersonalDraft } from '../personalStore';
import { PERSONAL_RATINGS, PROGRESS_STATES, type PersonalEntry, type PersonalSummary } from '../personal';
import { Layout, Select } from './Layout';
import { PlatformIcon } from './PlatformIcon';
import { PlatformFilter } from './PlatformFilter';
import { PersonalHistory, PersonalSummaryView } from './PersonalHistory';

export type GameRow = { key: string; meta: GameMeta; purchases: Ownership[]; personal?: PersonalSummary };

/** Wraps children in an external link when there is a URL, otherwise renders them as they are. */
const ExternalLink = ({ href, children }: { href?: string | false | 0; children?: unknown }) =>
  href ? <a class="external" href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <>{children}</>;

/** Platforms left out of the games list columns and filter (the purchases themselves are kept). */
const HIDDEN = new Set<string>(config.hiddenPlatforms);

const visibleLabel = (p: Ownership): string | null => {
  const label = platformLabel(p.item);
  return HIDDEN.has(label) ? null : label;
};

/** "subscription" when every copy depends on an active subscription. */
const access = (purchases: Ownership[]): string =>
  !purchases.length ? '' : purchases.every(p => p.item.service && SUBSCRIPTION_SERVICES.includes(p.item.service)) ? 'subscription' : 'owned';

type PlatformEntry = { label: string; physical: boolean; tooltip: string };

/** One tooltip line per purchase behind an icon: date, item (and the transaction it came in) and store. */
const purchaseLine = (p: Ownership): string => {
  const label = p.tx.title || p.tx.referenceId || '';
  const via = label && label !== p.item.title ? ` (in ${label})` : '';
  const content = p.title !== p.item.title ? `${p.title} ← ` : '';
  const notes = [
    p.item.systems?.includes('PS3') && 'PS3 only, not playable on PS4/PS5',
    p.item.service === 'ps-plus' && 'PS Plus',
    p.item.physical && 'physical',
  ].filter(Boolean);
  return `${p.tx.date}  ${content}${p.item.title}${via} · ${p.tx.store}${notes.map(n => ` · ${n}`).join('')}`;
};

/** Platform labels owned, grouped (PC: steam, epic …) in PLATFORM_GROUPS order; physical if any copy is. */
const platformGroups = (purchases: Ownership[]): [string, PlatformEntry[]][] => {
  const labels = new Map<string, Ownership[]>();
  for (const p of purchases) {
    const label = visibleLabel(p);
    if (!label) continue;
    labels.set(label, [...(labels.get(label) ?? []), p]);
  }
  // PS3 copies only get their own (dimmed) icon when there is no PS4/PS5 copy to list them under.
  const playable = labels.has('playstation') ? 'playstation' : labels.has('playstation-plus') ? 'playstation-plus' : undefined;
  for (const legacy of LEGACY_SYSTEM_LABELS) {
    const list = labels.get(legacy);
    if (!list || !playable) continue;
    labels.set(playable, [...labels.get(playable)!, ...list]);
    labels.delete(legacy);
  }
  const entries = [...labels].map(([label, list]): PlatformEntry => ({
    label,
    physical: list.some(p => !!p.item.physical),
    tooltip: [label, ...list.sort((a, b) => a.tx.date.localeCompare(b.tx.date)).map(purchaseLine)].join('\n'),
  }));
  return Object.keys(PLATFORM_GROUPS)
    .map((group): [string, PlatformEntry[]] => [
      group,
      entries.filter(e => platformGroup(e.label) === group).sort((a, b) => a.label.localeCompare(b.label)),
    ])
    .filter(([, list]) => list.length > 0);
};

const Checkboxes = ({ name, label, values, checkedValues = [] }: { name: string; label: string; values: readonly string[]; checkedValues?: readonly string[] }) => (
  <details class={`filter-dropdown ${name}-filter`} data-filter-dropdown>
    <summary><span>{label}</span><small data-filter-count>All</small></summary>
    <label class="filter-select-all"><input type="checkbox" data-select-all /> Select all</label>
    <div class="filter-options">
      {values.map(v => <label data-filter-option={(v === 'not-owned' ? 'not owned' : v).toLowerCase()}><input type="checkbox" name={name} value={v} checked={checkedValues.includes(v)} /> {v === 'not-owned' ? 'Not owned' : v}</label>)}
    </div>
  </details>
);

type Choice = { value: string; label: string };

const ChoiceCheckboxes = ({ name, label, choices }: { name: string; label: string; choices: Choice[] }) => (
  <details class={`filter-dropdown ${name}-filter`} data-filter-dropdown>
    <summary><span>{label}</span><small data-filter-count>All</small></summary>
    <label class="filter-select-all"><input type="checkbox" data-select-all /> Select all</label>
    <div class="filter-options">
      {choices.map(choice => <label data-filter-option={choice.label.toLowerCase()}><input type="checkbox" name={name} value={choice.value} /> {choice.label}</label>)}
    </div>
  </details>
);

const GenreFilter = ({ genres }: { genres: string[] }) => (
  <details class="filter-dropdown genre-filter" data-filter-dropdown>
    <summary><span>Genre</span><small data-filter-count>All</small></summary>
    <label class="filter-select-all"><input type="checkbox" data-select-all /> Select all</label>
    <input type="search" data-filter-search placeholder="Search genres…" aria-label="Search genres" />
    <div class="filter-options">
      {genres.map(genre => (
        <label data-filter-option={genre.toLowerCase()}>
          <input type="checkbox" name="genre" value={genre} /> {genre}
        </label>
      ))}
    </div>
  </details>
);

const SORTS = [
  ['title', 'Title'],
  ['purchased', 'Last purchase'],
  ['release', 'Release date'],
  ['oc', 'OpenCritic'],
  ['mc', 'Metacritic'],
  ['steam', 'Steam'],
] as const;

const COLUMNS = [
  { title: 'PC', icon: 'pc', size: 6 },
  { title: 'PlayStation', icon: 'playstation', size: 3 },
  { title: 'Nintendo', icon: 'switch', size: 1 },
  { title: 'Xbox', icon: 'xbox', size: 1 },
  { title: 'Mobile', icon: 'mobile', size: 2 },
];

const columnOf = (group: string): string => (COLUMNS.some(c => c.title === group) ? group : 'PC');

export const GameList = ({ rows, unresolved }: { rows: GameRow[]; unresolved: (Ownership & { ambiguous?: string[] })[] }) => {
  const owned = rows.filter(r => r.purchases.length);
  const labels = [...new Set(rows.flatMap(r => r.purchases.map(visibleLabel)))].filter((l): l is string => !!l).sort();
  const genres = [...new Set(rows.flatMap(r => r.meta.genres ?? []))].sort((a, b) => a.localeCompare(b));
  return (
    <Layout title="Games">
      <h1>Games <small>{owned.length} owned, {rows.length - owned.length} not owned, {unresolved.length} purchases without a game</small></h1>
      {unresolved.length > 0 && (
        <details class="group">
          <summary>Purchases without a game ({unresolved.length})</summary>
          <table class="list">
            <tbody>
              {unresolved.map(u => (
                <tr>
                  <td class="date">{u.tx.date}</td>
                  <td><a href={`/transactions/${u.tx.date}/${u.tx.id}`}>{u.title}</a></td>
                  <td><PlatformIcon label={platformLabel(u.item)} withLabel /></td>
                  <td>{u.ambiguous ? `ambiguous: ${u.ambiguous.join(', ')}` : ''}</td>
                  <td class="num">
                    {!u.ambiguous && (
                      <form method="post" action="/games">
                        <input type="hidden" name="title" value={u.title} />
                        <button type="submit">Create game</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <form class="game-controls" data-game-controls>
        <div class="filters">
          <input type="search" name="q" placeholder="Filter by title…" autofocus />
          <label for="sort">Sort by</label>
          <Select name="sort" id="sort">{SORTS.map(([value, label]) => <option value={value}>{label}</option>)}</Select>
          <Select name="dir">
            <option value="asc">ascending</option>
            <option value="desc">descending</option>
          </Select>
          <fieldset class="game-view-toggle" aria-label="Game view">
            <label><input type="radio" name="view" value="list" checked /> List</label>
            <label><input type="radio" name="view" value="cards" /> Cards</label>
          </fieldset>
          <ChoiceCheckboxes name="status" label="Status" choices={[{ value: 'none', label: 'No status' }, ...PROGRESS_STATES.map(s => ({ value: s.key, label: s.label }))]} />
          <ChoiceCheckboxes name="rating" label="Personal rating" choices={[{ value: 'none', label: 'No rating' }, ...PERSONAL_RATINGS.map(r => ({ value: String(r.value), label: r.label }))]} />
        </div>
        <div class="filters">
          <PlatformFilter labels={labels} />
          <Checkboxes name="access" label="Access" values={['owned', 'subscription', 'not-owned']} checkedValues={['owned', 'subscription']} />
          <Checkboxes name="tier" label="OpenCritic" values={OPENCRITIC_TIERS} />
          <Checkboxes name="mcb" label="Metacritic" values={METACRITIC_BUCKETS} />
          <Checkboxes name="steam" label="Steam reviews" values={STEAM_REVIEWS} />
          <GenreFilter genres={genres} />
        </div>
        <div class="meta" data-game-count></div>
      </form>

      <table class="list" id="games">
        <thead>
          <tr>
            <th width="60"><span class="open-critic-logo">OpenCritic</span></th>
            <th width="30"><span class="metacritic-logo">Metacritic</span></th>
            <th>Title</th>
            <th>
              <div class="state-heading">
                <span>State</span>
                <label class="state-mode" title="Switch between most recent and highest achieved state">
                  <span>Latest</span>
                  <input type="checkbox" role="switch" data-personal-state-mode aria-label="Show highest achieved state" checked />
                  <span>Peak</span>
                </label>
              </div>
            </th>
            {COLUMNS.map(c => <th class="platform-head" title={c.title} style={`--platform-head-size: ${c.size}`}><i class={`platform-icon icon-${c.icon}`} role="img" aria-label={c.title}></i></th>)}
            <th>Purchase</th>
            <th>Release</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, meta, purchases, personal }) => {
            const groups = platformGroups(purchases);
            const purchased = purchases.map(p => p.tx.date).sort().at(-1) ?? '';
            return (
              <tr
                data-game
                data-key={key}
                data-title={meta.title.toLowerCase()}
                data-search={meta.title.toLowerCase()}
                data-owned={purchases.length ? '1' : ''}
                data-groups={groups.map(([g]) => g).join(',')}
                data-labels={groups.flatMap(([, l]) => l.map(x => x.label)).join(',')}
                data-access={access(purchases) || 'not-owned'}
                data-status-peak={personal?.peak?.state ?? 'none'}
                data-status-latest={personal?.latest?.state ?? 'none'}
                data-status={personal?.peak?.state ?? 'none'}
                data-rating={personal?.rating ? String(personal.rating.rating) : 'none'}
                data-purchased={purchased}
                data-release={meta.release ?? ''}
                data-oc={meta.oc ?? ''}
                data-mc={meta.mc ?? ''}
                data-steam={meta.steam ?? ''}
                data-tier={opencriticTier(meta)}
                data-mcb={metacriticBucket(meta)}
                data-steam-review={steamReview(meta)}
                data-genres={(meta.genres ?? []).join('|')}
              >
                <td class="num">
                  {meta.oc && <ExternalLink href={meta.ocId && opencriticUrl(meta.ocId)}><div class={`open-critic-container tier-${meta.tier?.toLowerCase() ?? 'n-a'}`}>
                    <span class={`open-critic-tier`}>{meta.tier}</span>
                    <span class="open-critic-score">{meta.oc}</span>
                  </div></ExternalLink>}
                </td>
                <td class="num">
                  {meta.mcUrl && <ExternalLink href={meta.mcUrl}><div class="metacritic-container">
                    <span class={`metacritic-score ${metacriticBucketColor(meta)}${meta.mustPlay ? ' must-play' : ''}`}>{meta.mc ?? 'tbd'}</span>
                  </div></ExternalLink>}
                </td>
                <td class="game-title">
                  <a href={`/games/${key}`}>{meta.title}</a>
                  {meta.release && <span class="release-year">{meta.release.slice(0, 4)}</span>}
                  <br />
                  {meta.steamId && <ExternalLink href={steamUrl(meta.steamId)}><span class={`steam-review ${steamReviewColor(meta)}`}>{steamReview(meta)}</span></ExternalLink>}
                </td>
                <td class="personal-state-cell" data-state-mode="peak"><PersonalSummaryView summary={personal} /></td>
                {COLUMNS.map(column => (
                  <td class="platforms">
                    <span class="platform-group">
                      {groups.filter(([group]) => columnOf(group) === column.title)
                        .flatMap(([, labels]) => labels)
                        .map(l => <PlatformIcon label={l.label} physical={l.physical} tooltip={l.tooltip} />)}
                    </span>
                  </td>
                ))}
                <td class="date">{purchased}</td>
                <td class="date">{meta.release ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div id="game-cards" class="cards game-cards" hidden>
        {rows.map(({ key, meta, purchases, personal }) => {
          const cover = meta.cover ?? purchases.find(p => p.item.cover)?.item.cover;
          const platforms = platformGroups(purchases).flatMap(([, labels]) => labels);
          const scores = [meta.oc && `OC ${meta.oc}`, meta.mc && `MC ${meta.mc}`, meta.steam && `Steam ${steamReview(meta)}`].filter(Boolean).join(' · ');
          return (
            <article class="card game-card" data-game-card data-key={key}>
              <a class="game-card-cover" href={`/games/${key}`} aria-label={meta.title}>
                {cover ? <img src={cover} alt="" loading="lazy" /> : <span class="game-card-no-cover" aria-hidden="true"></span>}
              </a>
              <div class="card-body">
                <strong><a href={`/games/${key}`}>{meta.title}</a></strong>
                <span class="tags">{meta.release?.slice(0, 4) ?? 'Release unknown'}{purchases.length ? '' : ' · Not owned'}</span>
                <span class="game-card-state" data-state-mode="peak"><PersonalSummaryView summary={personal} /></span>
                <span class="game-card-platforms">
                  {platforms.map(platform => <PlatformIcon label={platform.label} physical={platform.physical} tooltip={platform.tooltip} />)}
                </span>
                {scores && <span class="tags game-card-scores">{scores}</span>}
              </div>
            </article>
          );
        })}
      </div>
    </Layout>
  );
};

const sourceId = (ref?: { id: unknown }): string => (ref === undefined ? '' : ref.id === null ? 'none' : String(ref.id));

const SourceMetadata = ({ data, fetchedAt }: { data?: OpenCriticData | SteamData | MetacriticData; fetchedAt?: string }) => (
  <details class="source-metadata">
    <summary>
      <span>{data?.title ?? 'No source title'}</span>
      <time>{data?.releaseDate ?? 'No release date'}</time>
    </summary>
    {data ? (
      <dl>
        {Object.entries(data).filter(([key]) => key !== 'title' && key !== 'releaseDate').map(([key, value]) => (
          <>
            <dt>{key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, first => first.toUpperCase())}</dt>
            <dd>{value == null ? 'Not available' : Array.isArray(value) ? value.join(', ') || 'None' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : typeof value === 'string' && /^https?:\/\//.test(value) ? <ExternalLink href={value}>{value}</ExternalLink> : String(value)}</dd>
          </>
        ))}
        <dt>Fetched at</dt>
        <dd>{fetchedAt ?? 'Not fetched yet'}</dd>
      </dl>
    ) : <p>No metadata fetched.</p>}
  </details>
);

export const GamePage = ({ game, purchases, release, errors = [], saved, fetcher, personalEntries = [], personalErrors = [], personalDraft, personalSaved, editingEntry }: {
  game: Game; purchases: Ownership[]; release?: string; errors?: string[]; saved?: boolean; fetcher?: boolean;
  personalEntries?: PersonalEntry[]; personalErrors?: string[]; personalDraft?: PersonalDraft;
  personalSaved?: boolean;
  editingEntry?: PersonalEntry;
}) => {
  const oc = game.opencritic?.data;
  const steam = game.steam?.data;
  const mc = game.metacritic?.data;
  const cover = oc?.cover ?? steam?.headerImage;
  const steamMeta: GameMeta = {
    title: game.title,
    ...(game.steam?.id ? { steamId: game.steam.id } : {}),
    ...(steam?.reviewScore != null ? { steam: steam.reviewScore } : {}),
  };
  const mcScore = mc?.metacriticScore != null && mc.metacriticScore >= 0 ? mc.metacriticScore : undefined;
  const mcMeta: GameMeta = {
    title: game.title,
    ...(game.metacritic?.id ? { mcUrl: game.metacritic.id } : {}),
    ...(mcScore !== undefined ? { mc: mcScore } : {}),
  };
  const fetched = (source: string, fetchedAt?: string): string =>
    `${source}\n${fetchedAt ? `Fetched ${fetchedAt.slice(0, 10)}` : 'Not fetched yet'}`;
  return (
    <Layout title={game.title}>
      
      {saved && <p class="notice">Saved.</p>}
      {fetcher && (
        <p class="actions">
          <button type="button" data-refresh-game={game.key}>Refresh ratings now</button>
          <span class="meta" data-refresh-status></span>
        </p>
      )}
      {errors.length > 0 && <ul class="errors">{errors.map(e => <li>{e}</li>)}</ul>}
      <div class="game-head">
        {cover && <img src={cover} alt="" />}
        <div class="game-head-info">
          <h1 class="game-detail-title"><span data-popover={game.key}>{game.title}</span> {release && <span class="release-year">{release.slice(0, 4)}</span>}</h1>
          <div class="game-rating-row">
            {oc?.score && <ExternalLink href={game.opencritic?.id ? opencriticUrl(game.opencritic.id) : undefined}>
              <div class={`open-critic-container tier-${oc.tier?.toLowerCase() ?? 'n-a'}`} data-popover={fetched('OpenCritic', game.opencritic?.fetchedAt)} tabindex={0}>
                <span class="open-critic-logo" aria-label="OpenCritic"></span>
                <span class="open-critic-tier">{oc.tier}</span>
                <span class="open-critic-score">{oc.score}</span>
              </div>
            </ExternalLink>}
            &bull;
            {game.metacritic?.id && <ExternalLink href={game.metacritic.id}>
              <div class="metacritic-container" data-popover={fetched('Metacritic', game.metacritic.fetchedAt)} tabindex={0}>
                <span class="metacritic-logo" aria-label="Metacritic"></span>
                <span class={`metacritic-score ${metacriticBucketColor(mcMeta)}${mc?.mustPlay ? ' must-play' : ''}`}>{mcScore ?? 'tbd'}</span>
              </div>
            </ExternalLink>}
            &bull;
            {game.steam?.id && <ExternalLink href={steamUrl(game.steam.id)}>
              <span class={`steam-review ${steamReviewColor(steamMeta)}`} data-popover={fetched('Steam', game.steam.fetchedAt)} tabindex={0}>
                <i class="platform-icon icon-steam" role="img" aria-label="Steam"></i>
                {steamReview(steamMeta)}
              </span>
            </ExternalLink>}
          </div>
          <small class="game-release-genres">{release ?? 'unknown'} &bull; {[...new Set([...(steam?.genres ?? []), ...(mc?.genres ?? [])])].join(', ')}</small>
          {steam?.description && <p>{steam.description}</p>}
        </div>
      </div>
      <PersonalHistory
        gameKey={game.key}
        entries={personalEntries}
        errors={personalErrors}
        saved={personalSaved}
        editingEntry={editingEntry}
        draft={personalDraft ?? { date: new Date().toISOString().slice(0, 10), platform: '', state: '', rating: '', note: '' }}
        today={new Date().toISOString().slice(0, 10)}
      />

      <h2>Purchases <small>{purchases.length}</small></h2>
      {purchases.length === 0 ? <p class="meta">Not owned (kept for statistics).</p> : (
        <table class="list">
          <tbody>
            {purchases.map(p => (
              <tr>
                <td class="date">{p.tx.date}</td>
                <td><a href={`/transactions/${p.tx.date}/${p.tx.id}`}>{p.tx.title || p.tx.referenceId}</a>{p.item.title !== (p.tx.title || p.tx.referenceId) ? ` › ${p.item.title}` : ''}{p.title !== p.item.title ? ` › ${p.title}` : ''}</td>
                <td>{p.tx.store}</td>
                <td><PlatformIcon label={platformLabel(p.item)} physical={p.item.physical} withLabel /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Edit</h2>
      <form method="post" action={`/games/${game.key}`} class="tx-form">
        <div class="row">
          <label class="grow">Title<input name="title" value={game.title} required maxlength={300} /></label>
          <label>Manual release date<input type="date" name="releaseDate" value={game.releaseDate ?? ''} /></label>
        </div>
        <div class="source-fields">
          <div>
            <label>OpenCritic id<input name="opencritic" value={sourceId(game.opencritic)} placeholder="e.g. 3245/140, or none" /></label>
            <SourceMetadata data={oc && { ...oc, platforms: oc.platforms ?? [], creators: oc.creators ?? [], description: oc.description ?? null }} fetchedAt={game.opencritic?.fetchedAt} />
          </div>
          <div>
            <label>Steam app id<input name="steam" value={sourceId(game.steam)} placeholder="e.g. 242820, or none" /></label>
            <SourceMetadata data={steam && { ...steam, developers: steam.developers ?? [], publishers: steam.publishers ?? [] }} fetchedAt={game.steam?.fetchedAt} />
          </div>
          <div>
            <label>Metacritic URL<input name="metacritic" value={sourceId(game.metacritic)} placeholder="https://www.metacritic.com/game/…, or none" /></label>
            <SourceMetadata data={mc && { ...mc, summary: mc.summary ?? null }} fetchedAt={game.metacritic?.fetchedAt} />
          </div>
        </div>
        <p class="meta">Empty: not checked yet. "none": not available on that source. Changing an id drops its fetched data.</p>
        <label>Aliases (other titles used by transactions or stores, one per line)<textarea name="aliases" rows={4}>{(game.aliases ?? []).join('\n')}</textarea></label>
        <div class="actions"><button type="submit" class="primary">Save</button><a href="/games">Back to games</a></div>
      </form>
      <p class="meta">updated {game.updatedAt}</p>
    </Layout>
  );
};
