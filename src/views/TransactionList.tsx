import { isOwnedGame, itemLinks, steamReview, type GameMeta, type TitleIndex } from '../games';
import { formatPrice, itemsForPlatforms, PLATFORM_GROUPS, platformLabel, transactionDisplayTitle, type Item, type Transaction } from '../model';
import type { TransactionRef } from '../store';
import exchangeRates from '../exchange-rates.json';
import { Layout, Options, Select } from './Layout';
import { PlatformIcon, StoreLogo } from './PlatformIcon';
import { PlatformFilter } from './PlatformFilter';

type Filters = { year?: string; platforms: string[]; store?: string };
type GameLookup = { index: TitleIndex; games: Map<string, GameMeta> };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const INTENSITY_RANGES = ['0', '1', '2-3', '4-7', '8-15', '16-31', '32-63', '64+'];
const SPENDING_RANGES = ['0', '1-999', '1k-1.9k', '2k-3.9k', '4k-7.9k', '8k-15.9k', '16k-31.9k', '32k+'];
const RATE_DATES = Object.keys(exchangeRates).sort();
const RATES: Record<string, number[]> = exchangeRates;
const HUF = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 });

const addToBreakdown = (breakdowns: Map<string, Map<string, number>>, month: string, key: string, amount: number): void => {
  const values = breakdowns.get(month) ?? new Map<string, number>();
  values.set(key, (values.get(key) ?? 0) + amount);
  breakdowns.set(month, values);
};

const estimateHuf = (tx: Transaction): number | null => {
  const price = tx.price;
  if (!price) return null;
  if (price.amount === 0) return 0;
  if (price.currency === 'HUF') return price.amount;
  let low = 0;
  let high = RATE_DATES.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (RATE_DATES[middle] <= tx.date) low = middle + 1;
    else high = middle - 1;
  }
  if (high < 0) return null;
  const [eurHuf, eurUsd, eurGbp] = RATES[RATE_DATES[high]];
  if (price.currency === 'EUR') return price.amount * eurHuf;
  if (price.currency === 'USD') return price.amount * eurHuf / eurUsd;
  if (price.currency === 'GBP') return price.amount * eurHuf / eurGbp;
  return null;
};

const HeatmapPanel = ({ id, title, counts, breakdowns, ranges, spending = false, hidden = false, lastYear, lastMonth, firstYear }: {
  id: string; title: string; counts: Map<string, number>; breakdowns: Map<string, Map<string, number>>;
  ranges: string[]; spending?: boolean; hidden?: boolean;
  firstYear: number; lastYear: number; lastMonth: number;
}) => (
  <div id={id} role="tabpanel" aria-labelledby={`${id}-tab`} hidden={hidden}>
    <div class="acquisition-heatmap" aria-label={title}>
      {Array.from({ length: lastYear - firstYear + 1 }, (_, offset) => {
        const year = firstYear + offset;
        return (
          <div class="heatmap-year">
            <span class="heatmap-year-label">{year}</span>
            <div class="heatmap-months">
              {MONTHS.slice(0, year === lastYear ? lastMonth : 12).map((name, monthIndex) => {
                const month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
                const count = counts.get(month) ?? 0;
                const level = count === 0 ? 0 : spending
                  ? count < 1000 ? 1 : Math.min(ranges.length - 1, 2 + Math.floor(Math.log2(count / 1000)))
                  : Math.min(ranges.length - 1, Math.ceil(Math.log2(count + 1)));
                const lines = [
                  `${name} ${year}`,
                  spending ? `Total: ~${HUF.format(count)} HUF` : `Total: ${count} game${count === 1 ? '' : 's'}`,
                  ...[...(breakdowns.get(month)?.entries() ?? [])].sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, amount]) => spending
                      ? `${key}: ${amount.toLocaleString(key === 'HUF' ? 'hu-HU' : 'en-US', { minimumFractionDigits: key === 'HUF' ? 0 : 2, maximumFractionDigits: 2 })}`
                      : `${key}: ${amount}`),
                ];
                return <span class={`heatmap-month level-${level}`} role="img" data-popover={lines.join('\n')} aria-label={lines.join(', ')} tabindex={0} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
    <div class="heatmap-legend" aria-label={`${title} intensity legend`}>
      <span>{spending ? 'HUF / month (estimated)' : 'Games / month'}</span>
      {ranges.map((range, level) => (
        <span class="heatmap-legend-entry"><span class={`heatmap-month level-${level}`} aria-hidden="true" />{range}</span>
      ))}
    </div>
  </div>
);

const AcquisitionHeatmap = ({ all, details, index, selectedPlatforms }: {
  all: TransactionRef[]; details: Map<string, Transaction>; index: TitleIndex; selectedPlatforms: string[];
}) => {
  if (!all.length) return null;
  const counts = new Map<string, number>();
  const platforms = new Map<string, Map<string, number>>();
  const spending = new Map<string, number>();
  const currencies = new Map<string, Map<string, number>>();
  for (const ref of all) {
    const tx = details.get(`${ref.date}/${ref.id}`);
    if (!tx) continue;
    const items = itemsForPlatforms(tx, selectedPlatforms);
    if (!items.length) continue;
    const month = ref.date.slice(0, 7);
    for (const item of items) {
      if (!isOwnedGame(tx, item)) continue;
      const count = itemLinks(index, item).length;
      counts.set(month, (counts.get(month) ?? 0) + count);
      addToBreakdown(platforms, month, item.platform, count);
    }
    const amount = estimateHuf(tx);
    if (amount !== null) {
      spending.set(month, (spending.get(month) ?? 0) + amount);
      if (tx.price?.currency && tx.price.amount > 0) addToBreakdown(currencies, month, tx.price.currency, tx.price.amount);
    }
  }
  const firstYear = Number(all[0].date.slice(0, 4));
  const lastYear = Number(all[all.length - 1].date.slice(0, 4));
  const lastMonth = Number(all[all.length - 1].date.slice(5, 7));
  const platformLabel = selectedPlatforms.length > 2
    ? ` (${selectedPlatforms.length} platforms)`
    : selectedPlatforms.length ? ` (${selectedPlatforms.join(', ')})` : '';

  return (
    <section class="heatmap-section" aria-label="Transaction history heatmap">
      <div class="heatmap-tabs" role="tablist" aria-label="Heatmap view">
        <button type="button" role="tab" id="games-heatmap-tab" aria-controls="games-heatmap" aria-selected="true" tabindex={0} data-heatmap-tab>Games{platformLabel}</button>
        <button type="button" role="tab" id="spending-heatmap-tab" aria-controls="spending-heatmap" aria-selected="false" tabindex={-1} data-heatmap-tab>Money spent{platformLabel}</button>
      </div>
      <HeatmapPanel id="games-heatmap" title="Games acquired by month" counts={counts} breakdowns={platforms} ranges={INTENSITY_RANGES} firstYear={firstYear} lastYear={lastYear} lastMonth={lastMonth} />
      <HeatmapPanel id="spending-heatmap" title="Transaction spending by month" counts={spending} breakdowns={currencies} ranges={SPENDING_RANGES} spending hidden firstYear={firstYear} lastYear={lastYear} lastMonth={lastMonth} />
    </section>
  );
};

const GameSummary = ({ meta }: { meta: GameMeta }) => {
  const parts = [
    meta.release?.slice(0, 4),
    meta.oc !== undefined && `OC ${meta.oc}${meta.tier ? ` ${meta.tier}` : ''}`,
    meta.mc !== undefined && `MC ${meta.mc}`,
    meta.steam !== undefined && `Steam: ${steamReview(meta)}`,
  ].filter(Boolean);
  return parts.length ? <span class="game-summary">{parts.join(' · ')}</span> : null;
};

/** Title linked to its game (when recognized), with ratings; collections list each included game. */
const ItemTitle = ({ item, lookup }: { item: Item; lookup: GameLookup }) => {
  const links = (item.kind ?? 'game') === 'game' ? itemLinks(lookup.index, item) : [];
  const linked = (title: string, key: string, thumb = false) => {
    const meta = lookup.games.get(key);
    return (
      <>
        {thumb && meta?.cover && <img class="mini-cover" src={meta.cover} alt="" loading="lazy" />}
        <a href={`/games/${key}`}>{title}</a>{meta && <> <GameSummary meta={meta} /></>}
      </>
    );
  };
  if (item.contents?.length) {
    return (
      <>
        {item.title}
        <ul class="contents">
          {links.map(({ title, resolution }) => (
            <li>{resolution && 'key' in resolution ? linked(title, resolution.key, true) : <span class="meta">{title}</span>}</li>
          ))}
        </ul>
      </>
    );
  }
  const resolution = links[0]?.resolution;
  return resolution && 'key' in resolution ? linked(item.title, resolution.key) : <>{item.title}</>;
};

/** The item's own cover, else the cover of the game it resolves to. */
const itemCover = (item: Item, lookup: GameLookup): string | undefined => {
  if (item.cover) return item.cover;
  if ((item.kind ?? 'game') !== 'game' || item.contents?.length) return undefined;
  const resolution = itemLinks(lookup.index, item)[0]?.resolution;
  return resolution && 'key' in resolution ? lookup.games.get(resolution.key)?.cover : undefined;
};

const searchText = (ref: TransactionRef, tx?: Transaction): string =>
  [
    ref.meta.title, ref.meta.referenceId ?? tx?.referenceId, ref.meta.store, ref.meta.platform ?? 'mixed', ref.date,
    ...(tx?.items.flatMap(item => [item.title, platformLabel(item), ...(item.contents ?? [])]) ?? []),
  ].join(' ').toLowerCase();

const flags = (item: Item): string[] =>
  [item.kind && item.kind !== 'game' && item.kind, item.physical && 'physical', item.unclaimed && 'unclaimed', item.hidden && 'hidden']
    .filter((f): f is string => !!f);

const Items = ({ tx, lookup }: { tx: Transaction; lookup: GameLookup }) => (
  <table class="items">
    <tbody>
      {tx.items.map(item => {
        const cover = itemCover(item, lookup);
        return (
          <tr class={item.unclaimed || item.hidden ? 'is-hidden' : ''}>
            <td class="thumb">{cover && <img src={cover} alt="" loading="lazy" />}</td>
            <td><ItemTitle item={item} lookup={lookup} /></td>
            <td><PlatformIcon label={platformLabel(item)} physical={item.physical} withLabel /></td>
            <td>{flags(item).map(f => <span class="badge">{f}</span>)}</td>
            <td class="num">{formatPrice(item.price)}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

export const TransactionList = ({ refs, all, filters, details, index, games }: {
  refs: TransactionRef[]; all: TransactionRef[]; filters: Filters; details: Map<string, Transaction>;
  index: TitleIndex; games: Map<string, GameMeta>;
}) => {
  const lookup: GameLookup = { index, games };
  const years = [...new Set(all.map(r => r.date.slice(0, 4)))].sort().reverse();
  const stores = [...new Set(all.map(r => r.meta.store))].sort();
  const groups = new Map<string, TransactionRef[]>();
  for (const ref of [...refs].reverse()) {
    const year = ref.date.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), ref]);
  }

  return (
    <Layout title="Transactions">
      <h1>Transactions <small>{refs.length} of {all.length}</small></h1>
      <form class="filters" method="get" action="/transactions" data-transaction-filters>
        <Select name="year" data-autosubmit><Options values={years} selected={filters.year} empty="All years" /></Select>
        <PlatformFilter labels={Object.values(PLATFORM_GROUPS).flat()} selected={filters.platforms} includeMixed apply />
        <Select name="store" data-autosubmit><Options values={stores} selected={filters.store} empty="All stores" /></Select>
        <input type="search" placeholder="Filter by text, including items…" data-filter="#transactions" autofocus />
        <button type="button" data-action="expand-all" data-target="#transactions">Expand all</button>
      </form>
      <AcquisitionHeatmap all={all} details={details} index={index} selectedPlatforms={filters.platforms} />
      <div id="transactions">
        {[...groups].map(([year, list]) => (
          <section class="group" data-group>
            <h2>{year} <small>{list.length}</small></h2>
            <table class="list transaction-list">
              <colgroup>
                <col /><col /><col /><col /><col />
              </colgroup>
              {list.map(ref => {
                const tx = details.get(`${ref.date}/${ref.id}`);
                const labels = tx ? [...new Set(tx.items.map(platformLabel))] : ref.meta.platform ? [ref.meta.platform] : [];
                const referenceId = ref.meta.referenceId ?? tx?.referenceId;
                const title = tx ? transactionDisplayTitle(tx) : ref.meta.title && ref.meta.title !== referenceId ? ref.meta.title : ref.meta.store;
                return (
                  // One tbody per transaction, so filtering hides the summary and its items together.
                  <tbody data-search={searchText(ref, tx)} data-expandable>
                    <tr class={ref.meta.hidden ? 'is-hidden' : ''}>
                      <td class="toggle">
                        {tx && <button type="button" class="expand" data-action="toggle-items" aria-expanded="false" aria-label="Show items">+</button>}
                      </td>
                      <td class="date">{ref.date}</td>
                      <td>
                        <span class="transaction-heading">
                          <StoreLogo store={ref.meta.store} />
                          <a href={`/transactions/${ref.date}/${ref.id}`}>{title}</a>
                          {ref.meta.items > 1 && <small class="transaction-item-count">({ref.meta.items})</small>}
                          {referenceId && <small class="transaction-reference">{referenceId}</small>}
                        </span>
                      </td>
                      <td class="platforms">
                        <span class="platform-group">
                          {labels.length ? labels.map(label => <PlatformIcon label={label} />) : <span class="meta">mixed</span>}
                        </span>
                      </td>
                      <td class="num">{ref.meta.price}</td>
                    </tr>
                    {tx && (
                      <tr class="items-row" data-items hidden>
                        <td></td>
                        <td colspan={4}><Items tx={tx} lookup={lookup} /></td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </table>
          </section>
        ))}
      </div>
    </Layout>
  );
};
