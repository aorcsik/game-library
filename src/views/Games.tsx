import config from '../config.json';
import { creatorLinks, creatorLinksForRole, creatorNames, creatorSearchNames, gameCreatorCredits, normalizeCreator, type CreatorCredit, type CreatorGameLink, type CreatorGameLinks, type CreatorIndex, type GameCreatorCredits } from '../creators';
import {
  METACRITIC_BUCKETS, OPENCRITIC_TIERS, STEAM_REVIEWS, metacriticBucket, metacriticBucketColor, opencriticTier, steamReview,
  automaticGameCover, gameCover, gameGenres, gameMetaCover, opencriticUrl, steamPortraitUrl, steamReviewColor, steamUrl,
  rawCreatorCredits, type Game, type GameMeta, type MetacriticData, type OpenCriticData, type Ownership, type SteamData,
} from '../games';
import { LEGACY_SYSTEM_LABELS, PLATFORM_GROUPS, SUBSCRIPTION_SERVICES, platformGroup, platformLabel, transactionDisplayTitle } from '../model';
import type { PersonalDraft } from '../personalStore';
import { PERSONAL_RATINGS, PROGRESS_STATES, type PersonalEntry, type PersonalSummary } from '../personal';
import type { RefreshJob } from '../fetcher/queue';
import { Layout, Select } from './Layout';
import { PlatformIcon, StoreLogo } from './PlatformIcon';
import { PlatformFilter } from './PlatformFilter';
import { PersonalHistory, PersonalSummaryView } from './PersonalHistory';
import { CreatorLinks } from './Creators';

export type GameRow = { key: string; meta: GameMeta; purchases: Ownership[]; personal?: PersonalSummary };

const CreatorCredits = ({ credits, source, links }: {
  credits: GameCreatorCredits; source: { key: string } | { game: Game }; links?: ReadonlyMap<string, CreatorGameLink>;
}) => (
  <>
    {credits.developers.length > 0 && <>Developers: <CreatorLinks credits={credits.developers} links={links} /></>}
    {credits.publishers.length > 0 && <>{credits.developers.length > 0 && <br />}Publishers: <CreatorLinks credits={credits.publishers} links={links} /></>}
    {credits.creators.length > 0 && <>{(credits.developers.length > 0 || credits.publishers.length > 0) && <br />}Creators: <CreatorLinks credits={credits.creators} links={links} /></>}
    {(credits.developers.length > 0 || credits.publishers.length > 0 || credits.creators.length > 0) && (
      <>
        {' '}
        <button type="button" class="creator-info" aria-label="Show raw creator credits"
          data-popover={'game' in source ? rawCreatorCredits(source.game) : 'Raw creator credits\nLoading…'}
          data-popover-url={'key' in source ? `/games/${source.key}/creator-sources` : undefined}
        ><i class="fa-solid fa-circle-info" aria-hidden="true"></i></button>
      </>
    )}
  </>
);

const listCredits = (meta: GameMeta, index: CreatorIndex, links?: ReadonlyMap<string, CreatorGameLink>): GameCreatorCredits => ({
  developers: creatorLinksForRole(meta.developers ?? [], 'developer', index).filter(credit => !credit.key || !links?.get(credit.key)?.miscredit),
  publishers: creatorLinksForRole(meta.publishers ?? [], 'publisher', index).filter(credit => !credit.key || !links?.get(credit.key)?.miscredit),
  creators: [],
});

const listCreatorSearch = (meta: GameMeta, credits: GameCreatorCredits, index: CreatorIndex, links?: ReadonlyMap<string, CreatorGameLink>): string => [
  ...([['developer', meta.developers ?? []], ['publisher', meta.publishers ?? []]] as const).flatMap(([role, names]) =>
    names.flatMap(name => creatorLinksForRole([name], role, index).some(credit => credit.key && links?.get(credit.key)?.miscredit)
      ? [] : creatorSearchNames([name], index, role))),
  ...[...credits.developers, ...credits.publishers].flatMap(({ name }) => {
    const match = index.get(normalizeCreator(name));
    return match ? creatorNames(match.creator) : [name];
  }),
].join(' ');

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
  ['firstPurchased', 'First purchase'],
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

export const GameList = ({ rows, unresolved, creatorIndex, creatorGameLinks }: {
  rows: GameRow[]; unresolved: (Ownership & { ambiguous?: string[] })[]; creatorIndex: CreatorIndex;
  creatorGameLinks?: CreatorGameLinks;
}) => {
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
          <input type="search" name="q" placeholder="Filter by title or creator…" aria-label="Filter by title or creator" />
          <label for="sort">Sort by</label>
          <Select name="sort" id="sort">{SORTS.map(([value, label]) => <option value={value}>{label}</option>)}</Select>
          <Select name="dir">
            <option value="asc">ascending</option>
            <option value="desc">descending</option>
          </Select>
          <fieldset class="game-view-toggle" aria-label="Game view">
            <label title="List view"><input type="radio" name="view" value="list" aria-label="List view" checked /><i class="fa-solid fa-list" aria-hidden="true"></i></label>
            <label title="Cards view"><input type="radio" name="view" value="cards" aria-label="Cards view" /><i class="fa-solid fa-grid-2" aria-hidden="true"></i></label>
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
            <th class="game-creator-column">Creators</th>
            {COLUMNS.map(c => <th class="platform-head" title={c.title} style={`--platform-head-size: ${c.size}`}><i class={`platform-icon icon-${c.icon}`} role="img" aria-label={c.title}></i></th>)}
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
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, meta, purchases, personal }) => {
            const credits = listCredits(meta, creatorIndex, creatorGameLinks?.get(key));
            const groups = platformGroups(purchases);
            const purchaseDates = purchases.map(p => p.tx.date).sort();
            const purchased = purchaseDates.at(-1) ?? '';
            const firstPurchased = purchaseDates[0] ?? '';
            return (
              <tr
                data-game
                data-key={key}
                data-title={meta.title.toLowerCase()}
                data-search={`${meta.title} ${listCreatorSearch(meta, credits, creatorIndex, creatorGameLinks?.get(key))}`.toLowerCase()}
                data-owned={purchases.length ? '1' : ''}
                data-groups={groups.map(([g]) => g).join(',')}
                data-labels={groups.flatMap(([, l]) => l.map(x => x.label)).join(',')}
                data-access={access(purchases) || 'not-owned'}
                data-status-peak={personal?.peak?.state ?? 'none'}
                data-status-latest={personal?.latest?.state ?? 'none'}
                data-status={personal?.peak?.state ?? 'none'}
                data-rating={personal?.rating ? String(personal.rating.rating) : 'none'}
                data-purchased={purchased}
                data-first-purchased={firstPurchased}
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
                  {meta.release && <span class="release-year" data-popover={meta.release} tabindex={0}>{meta.release.slice(0, 4)}</span>}
                  <br />
                  {meta.steamId && <ExternalLink href={steamUrl(meta.steamId)}><span class={`steam-review ${steamReviewColor(meta)}`}>{steamReview(meta)}</span></ExternalLink>}
                </td>
                <td class="game-creator-column game-creators"><CreatorCredits credits={credits} source={{ key }} /></td>
                {COLUMNS.map(column => (
                  <td class="platforms">
                    <span class="platform-group">
                      {groups.filter(([group]) => columnOf(group) === column.title)
                        .flatMap(([, labels]) => labels)
                        .map(l => <PlatformIcon label={l.label} physical={l.physical} tooltip={l.tooltip} />)}
                    </span>
                  </td>
                ))}
                <td class="personal-state-cell" data-state-mode="peak"><PersonalSummaryView summary={personal} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div id="game-cards" class="cards game-cards" hidden>
        {rows.map(({ key, meta, purchases, personal }) => {
          const cover = gameMetaCover(meta);
          const platforms = platformGroups(purchases).flatMap(([, labels]) => labels);
          const scores = [meta.oc && `OC ${meta.oc}`, meta.mc && `MC ${meta.mc}`, meta.steam && `Steam ${steamReview(meta)}`].filter(Boolean).join(' · ');
          return (
            <article class="card game-card" data-game-card data-key={key}>
              <a class="game-card-cover" href={`/games/${key}`} aria-label={meta.title}>
                {cover ? <><img src={cover} alt="" loading="lazy" data-game-cover /><span class="game-card-no-cover" aria-hidden="true" hidden></span></> : <span class="game-card-no-cover" aria-hidden="true"></span>}
              </a>
              <div class="card-body">
                <strong><a href={`/games/${key}`}>{meta.title}</a></strong>
                {(meta.developers?.length || meta.publishers?.length) ? <span class="game-creators"><CreatorCredits credits={listCredits(meta, creatorIndex, creatorGameLinks?.get(key))} source={{ key }} /></span> : null}
                <span class="tags">{meta.release ? <span data-popover={meta.release} tabindex={0}>{meta.release.slice(0, 4)}</span> : 'Release unknown'}{purchases.length ? '' : ' · Not owned'}</span>
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

const SourceMetadata = ({ data, fetchedAt, creatorIndex, links }: {
  data?: OpenCriticData | SteamData | MetacriticData; fetchedAt?: string; creatorIndex: CreatorIndex;
  links?: ReadonlyMap<string, CreatorGameLink>;
}) => (
  <details class="source-metadata">
    <summary>
      <span>{data?.title ?? 'No source title'}</span>
      <time>{data?.releaseDate?.replace(/T.*/, '') ?? 'No release date'}</time>
    </summary>
    {data ? (
      <dl>
        {Object.entries(data).filter(([key]) => key !== 'title' && key !== 'releaseDate' && !(key === 'publisher' && 'publishers' in data && data.publishers?.length)).map(([key, value]) => (
          <>
            <dt>{key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, first => first.toUpperCase())}</dt>
            <dd>{value == null ? 'Not available' : ['developers', 'publishers', 'creators'].includes(key) && Array.isArray(value) ? value.length ? <CreatorLinks credits={key === 'creators' ? creatorLinks(value, creatorIndex) : creatorLinksForRole(value, key === 'developers' ? 'developer' : 'publisher', creatorIndex)} links={links} /> : 'None' : key === 'publisher' && typeof value === 'string' ? <CreatorLinks credits={creatorLinksForRole([value], 'publisher', creatorIndex)} links={links} /> : Array.isArray(value) ? value.join(', ') || 'None' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : typeof value === 'string' && /^https?:\/\//.test(value) ? <ExternalLink href={value}>{value}</ExternalLink> : String(value)}</dd>
          </>
        ))}
        <dt>Fetched at</dt>
        <dd>{fetchedAt ?? 'Not fetched yet'}</dd>
      </dl>
    ) : <p>No metadata fetched.</p>}
  </details>
);

export const GamePage = ({ game, purchases, creatorIndex, creatorGameLinks, release, errors = [], saved, fetcher, autoRefresh, autoRefreshError, personalEntries = [], personalErrors = [], personalDraft, personalSaved, editingEntry }: {
  game: Game; purchases: Ownership[]; release?: string; errors?: string[]; saved?: boolean; fetcher?: boolean;
  autoRefresh?: Pick<RefreshJob, 'id' | 'state'>; autoRefreshError?: string;
  creatorIndex: CreatorIndex;
  creatorGameLinks?: ReadonlyMap<string, CreatorGameLink>;
  personalEntries?: PersonalEntry[]; personalErrors?: string[]; personalDraft?: PersonalDraft;
  personalSaved?: boolean;
  editingEntry?: PersonalEntry;
}) => {
  const oc = game.opencritic?.data;
  const steam = game.steam?.data;
  const mc = game.metacritic?.data;
  const credits = gameCreatorCredits(game, creatorIndex);
  const cover = gameCover(game);
  const coverOptions = [
    { value: '', label: 'Automatic (Steam portrait, OpenCritic, Metacritic)', image: automaticGameCover(game) },
    { value: 'opencritic', label: 'OpenCritic', image: oc?.cover },
    { value: 'steam', label: 'Steam header', image: steam?.headerImage },
    { value: 'steamPortrait', label: 'Steam portrait', image: game.steam?.id ? steamPortraitUrl(game.steam.id) : undefined },
    { value: 'metacritic', label: 'Metacritic card', image: mc?.cover },
    ...(mc?.mainImage && mc.mainImage !== mc.cover || game.coverSource === 'metacriticMain'
      ? [{ value: 'metacriticMain', label: 'Metacritic main', image: mc?.mainImage }] : []),
  ];
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
          <span class="meta" data-refresh-status data-auto-refresh-id={autoRefresh?.id} data-auto-refresh-state={autoRefresh?.state}>
            {autoRefreshError ? `Automatic refresh could not be queued: ${autoRefreshError}`
              : autoRefresh?.state === 'pending' ? 'Ratings refresh queued…'
              : autoRefresh?.state === 'running' ? 'Refreshing ratings in the background…'
              : autoRefresh ? 'Checking last refresh result…'
              : game.refreshLock && 'Refreshing ratings in the background…'}
          </span>
        </p>
      )}
      {errors.length > 0 && <ul class="errors">{errors.map(e => <li>{e}</li>)}</ul>}
      <div class="game-head">
        {cover && <img src={cover} alt="" data-game-cover />}
        <div class="game-head-info">
          {game.coverSource && <p class="meta" data-missing-cover hidden>Selected cover image unavailable. Choose another source.</p>}
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
          <small class="game-release-genres">{release ?? 'unknown'} &bull; {gameGenres(game).join(', ')}</small>
          {(credits.developers.length > 0 || credits.publishers.length > 0 || credits.creators.length > 0) && <p class="game-creators"><CreatorCredits credits={credits} source={{ game }} links={creatorGameLinks} /></p>}
          {game.coverSource && !cover && <p class="meta">Selected cover unavailable. Add its source ID, refresh its metadata, or choose another source.</p>}
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
            {purchases.map(p => {
              const title = transactionDisplayTitle(p.tx);
              return (
                <tr class={p.item.unclaimed ? 'is-hidden' : ''}>
                  <td class="date">{p.tx.date}</td>
                  <td>
                    <span class="transaction-heading">
                      <StoreLogo store={p.tx.store} />
                      <span><a href={`/transactions/${p.tx.date}/${p.tx.id}`}>{title}</a>{p.item.title !== title ? ` › ${p.item.title}` : ''}{p.title !== p.item.title ? ` › ${p.title}` : ''}{p.item.unclaimed && <> <span class="badge">unclaimed</span></>}</span>
                    </span>
                  </td>
                  <td><PlatformIcon label={platformLabel(p.item)} physical={p.item.physical} withLabel /></td>
                </tr>
              );
            })}
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
            <SourceMetadata data={oc && { ...oc, platforms: oc.platforms ?? [], creators: oc.creators ?? [], description: oc.description ?? null }} fetchedAt={game.opencritic?.fetchedAt} creatorIndex={creatorIndex} links={creatorGameLinks} />
          </div>
          <div>
            <label>Steam app id<input name="steam" value={sourceId(game.steam)} placeholder="e.g. 242820, or none" /></label>
            <SourceMetadata data={steam && { ...steam, developers: steam.developers ?? [], publishers: steam.publishers ?? [] }} fetchedAt={game.steam?.fetchedAt} creatorIndex={creatorIndex} links={creatorGameLinks} />
          </div>
          <div>
            <label>Metacritic URL<input name="metacritic" value={sourceId(game.metacritic)} placeholder="https://www.metacritic.com/game/…, or none" /></label>
            <SourceMetadata data={mc && { ...mc, summary: mc.summary ?? null }} fetchedAt={game.metacritic?.fetchedAt} creatorIndex={creatorIndex} links={creatorGameLinks} />
          </div>
        </div>
        <p class="meta">Empty: not checked yet. "none": not available on that source. Changing an id drops its fetched data.</p>
        <fieldset class="cover-options">
          <legend>Cover source</legend>
          <div class="cover-choices">
            {coverOptions.map(option => (
              <label class="cover-choice">
                <input type="radio" name="coverSource" value={option.value} checked={(game.coverSource ?? '') === option.value} />
                {option.image ? <><img src={option.image} alt="" loading="lazy" data-cover-preview /><span class="cover-choice-empty" hidden>No image</span></> : <span class="cover-choice-empty">No image</span>}
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <p class="meta">Steam portrait artwork is checked when previewed; refresh Metacritic metadata to load its card and main images. An unavailable selected source will not use another image.</p>
        </fieldset>
        <label>Aliases (other titles used by transactions or stores, one per line)<textarea name="aliases" rows={4}>{(game.aliases ?? []).join('\n')}</textarea></label>
        <label>Manual developers (comma-separated)<textarea name="manualDevelopers" rows={2}>{(game.manualDevelopers ?? []).join(', ')}</textarea></label>
        <label>Manual publishers (comma-separated)<textarea name="manualPublishers" rows={2}>{(game.manualPublishers ?? []).join(', ')}</textarea></label>
        <label>Manual genres (comma-separated)<textarea name="manualGenres" rows={2}>{(game.manualGenres ?? []).join(', ')}</textarea></label>
        <div class="actions"><button type="submit" class="primary">Save</button><a href="/games">Back to games</a></div>
      </form>
      <form method="post" action={`/games/${game.key}/delete`}
        data-confirm={`Delete ${game.title} (${game.key})? This permanently removes its fetched source data and aliases. Purchases matching another game may move to that game.`}
        class="actions">
        <button type="submit" class="danger">Delete game</button>
      </form>
      <p class="meta">updated {game.updatedAt}</p>
    </Layout>
  );
};
