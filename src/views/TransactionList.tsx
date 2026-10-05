import { itemLinks, steamReview, type GameMeta, type TitleIndex } from '../games';
import { formatPrice, PLATFORM_GROUPS, platformLabel, type Item, type Transaction } from '../model';
import type { TransactionRef } from '../store';
import { Layout, Options } from './Layout';
import { PlatformIcon } from './PlatformIcon';

type Filters = { year?: string; platform?: string; store?: string };
type GameLookup = { index: TitleIndex; games: Map<string, GameMeta> };

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
    ref.meta.title, ref.meta.store, ref.meta.platform ?? 'mixed', ref.date,
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
      <form class="filters" method="get" action="/transactions">
        <select name="year" data-autosubmit><Options values={years} selected={filters.year} empty="All years" /></select>
        <select name="platform" data-autosubmit><Options values={['mixed', ...Object.values(PLATFORM_GROUPS).flat()]} selected={filters.platform} empty="All platforms" /></select>
        <select name="store" data-autosubmit><Options values={stores} selected={filters.store} empty="All stores" /></select>
        <input type="search" placeholder="Filter by text, including items…" data-filter="#transactions" autofocus />
        <button type="button" data-action="expand-all" data-target="#transactions">Expand all</button>
        <noscript><button type="submit">Apply</button></noscript>
      </form>
      <div id="transactions">
        {[...groups].map(([year, list]) => (
          <section class="group" data-group>
            <h2>{year} <small>{list.length}</small></h2>
            <table class="list">
              {list.map(ref => {
                const tx = details.get(`${ref.date}/${ref.id}`);
                return (
                  // One tbody per transaction, so filtering hides the summary and its items together.
                  <tbody data-search={searchText(ref, tx)} data-expandable>
                    <tr class={ref.meta.hidden ? 'is-hidden' : ''}>
                      <td class="toggle">
                        {tx && <button type="button" class="expand" data-action="toggle-items" aria-expanded="false" aria-label="Show items">+</button>}
                      </td>
                      <td class="date">{ref.date}</td>
                      <td><a href={`/transactions/${ref.date}/${ref.id}`}>{ref.meta.title}</a></td>
                      <td>{ref.meta.store}</td>
                      <td>{ref.meta.platform ? <PlatformIcon label={ref.meta.platform} withLabel /> : <span class="meta">mixed</span>}</td>
                      <td class="num">{ref.meta.items > 1 ? `${ref.meta.items} items` : ''}</td>
                      <td class="num">{ref.meta.price}</td>
                    </tr>
                    {tx && (
                      <tr class="items-row" data-items hidden>
                        <td></td>
                        <td colspan={6}><Items tx={tx} lookup={lookup} /></td>
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
