import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
import { emptyItem, readDraft, toDraft, validateDraft, type TransactionDraft } from './form';
import { applyGameForm } from './gameForm';
import { fetcher } from './fetcher/api';
import { GameRefreshQueue, refreshQueue, type RefreshJob } from './fetcher/queue';
import { needsGameRefresh } from './fetcher/refresh';
import { buildCreatorIndex, creatorKey, creatorVerificationProgress, deleteCreatorGameLinks, deleteGameCreatorLinks, gameCreatorCredits, getCreator, getCreatorGameLink, getGameCreatorLinks, listCreatorGameLinks, listCreators, newCreatorKey, normalizeCreator, readCreatorDraft, saveCreator, saveCreatorGameLink, toCreatorDraft, validateCreator, type CreatorIndex, type CreatorRole } from './creators';
import { deleteGame, getGame, getGames, getTitleIndex, listGames, saveGame } from './gamedb';
import { itemLinks, joinOwnership, rawCreatorCredits, releaseDate, resolveTitle, slugify, type Game } from './games';
import { PLATFORMS, isOneOf, itemsForPlatforms, normalizeTitle, ownedKeys } from './model';
import { getAllPersonalEntries, getPersonalEntries, listPersonalSummaries, savePersonalEntries, deletePersonalEntry, validatePersonalDraft } from './personalStore';
import type { PersonalEntry } from './personal';
import {
  deleteTransaction, getAllLibraries, getAllTransactions, getTransaction, listTransactions, saveTransaction,
} from './store';
import { GameList, GamePage } from './views/Games';
import { CreatorList, CreatorPage, type CreatorGame } from './views/Creators';
import { PersonalHistory } from './views/PersonalHistory';
import { RefreshPage } from './views/Refresh';
import { TransactionForm } from './views/TransactionForm';
import { TransactionList } from './views/TransactionList';

type Env = {
  GAMES: KVNamespace;
  GAMEDB: KVNamespace;
  CREATORS: KVNamespace;
  GAMESTATE: KVNamespace;
  REFRESH_QUEUE: DurableObjectNamespace<GameRefreshQueue>;
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
  LOCAL_DEV?: string;
  /** "on" enables the local metadata fetcher (scraping endpoints). Set only in .dev.vars. */
  FETCHER?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use(secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", 'https:', 'data:'],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
}));

app.use(async (c, next) => {
  if (c.env.LOCAL_DEV === 'on') return next();
  if (!c.env.ADMIN_USER || !c.env.ADMIN_PASSWORD) {
    return c.text('ADMIN_USER / ADMIN_PASSWORD are not configured.', 503);
  }
  return basicAuth({ username: c.env.ADMIN_USER, password: c.env.ADMIN_PASSWORD })(c, next);
});

app.use(csrf());

app.use('/api/fetcher/*', async (c, next) => {
  if (c.env.FETCHER !== 'on') return c.json({ error: 'Fetcher is disabled (set FETCHER=on in .dev.vars)' }, 404);
  await next();
});
app.route('/api/fetcher', fetcher);

app.get('/api/refresh-queue-status', async c => {
  c.header('Cache-Control', 'no-store');
  return c.env.FETCHER === 'on' ? c.json(await refreshQueue(c.env).queueStatus()) : c.body(null, 204);
});

app.get('/refresh', c => c.env.FETCHER === 'on'
  ? c.html(<RefreshPage />)
  : c.text('The metadata fetcher only runs locally: set FETCHER=on in .dev.vars and use `npm run dev`.', 404));

const DATE = ':date{\\d{4}-\\d{2}-\\d{2}}';
const ID = ':id{[0-9a-z]{1,32}}';
const GAME = ':key{[a-z0-9-]{1,120}}';

const knownStores = async (kv: KVNamespace): Promise<string[]> =>
  [...new Set((await listTransactions(kv)).map(r => r.meta.store))].sort();

app.get('/', c => c.redirect('/transactions'));

app.get('/transactions', async c => {
  const [all, transactions, index, games] = await Promise.all([
    listTransactions(c.env.GAMES), getAllTransactions(c.env.GAMES), getTitleIndex(c.env.GAMEDB), listGames(c.env.GAMEDB),
  ]);
  const { year, store } = c.req.query();
  const platforms = c.req.queries('platform') ?? [];
  const details = new Map(transactions.map(tx => [`${tx.date}/${tx.id}`, tx]));
  const refs = all.filter(r => {
    const tx = details.get(`${r.date}/${r.id}`);
    return (!year || r.date.startsWith(year)) &&
      (!platforms.length || (tx ? itemsForPlatforms(tx, platforms).length > 0 : platforms.includes(r.meta.platform ?? 'mixed'))) &&
      (!store || r.meta.store === store);
  });
  const gameMeta = new Map(games.map(g => [g.key, g.meta]));
  return c.html(<TransactionList refs={refs} all={all} filters={{ year, platforms, store }} details={details} index={index} games={gameMeta} />);
});

app.get('/transactions/new', async c => {
  const q = c.req.query();
  const draft: TransactionDraft = {
    date: new Date().toISOString().slice(0, 10),
    title: q.title ?? '',
    referenceId: '',
    store: q.store ?? '',
    price: '',
    notes: '',
    hidden: false,
    items: [emptyItem({
      title: q.title ?? '',
      platform: q.platform ?? '',
      service: q.service ?? '',
      systems: q.system ? [q.system] : [],
      cover: q.cover ?? '',
      physical: q.physical === '1',
    })],
  };
  return c.html(<TransactionForm draft={draft} action="/transactions" stores={await knownStores(c.env.GAMES)} />);
});

app.post('/transactions', async c => {
  const draft = readDraft(await c.req.formData());
  const { tx, errors } = validateDraft(draft, { id: crypto.randomUUID().replaceAll('-', '').slice(0, 10) });
  if (!tx) {
    return c.html(<TransactionForm draft={draft} action="/transactions" stores={await knownStores(c.env.GAMES)} errors={errors} />, 422);
  }
  await saveTransaction(c.env.GAMES, tx);
  return c.redirect(`/transactions/${tx.date}/${tx.id}?saved=1`, 303);
});

app.get(`/transactions/${DATE}/${ID}`, async c => {
  const { date, id } = c.req.param();
  const tx = await getTransaction(c.env.GAMES, date, id);
  if (!tx) return c.notFound();
  const index = await getTitleIndex(c.env.GAMEDB);
  return c.html(
    <TransactionForm
      draft={toDraft(tx)}
      action={`/transactions/${date}/${id}`}
      stores={await knownStores(c.env.GAMES)}
      saved={c.req.query('saved') === '1'}
      existing={tx}
      links={tx.items.map(item => itemLinks(index, item))}
    />,
  );
});

app.post(`/transactions/${DATE}/${ID}`, async c => {
  const { date, id } = c.req.param();
  const existing = await getTransaction(c.env.GAMES, date, id);
  if (!existing) return c.notFound();
  const draft = readDraft(await c.req.formData());
  const { tx, errors } = validateDraft(draft, existing);
  if (!tx) {
    return c.html(
      <TransactionForm draft={draft} action={`/transactions/${date}/${id}`} stores={await knownStores(c.env.GAMES)} errors={errors} existing={existing} />,
      422,
    );
  }
  await saveTransaction(c.env.GAMES, tx, { date, id });
  return c.redirect(`/transactions/${tx.date}/${tx.id}?saved=1`, 303);
});

app.post(`/transactions/${DATE}/${ID}/delete`, async c => {
  const { date, id } = c.req.param();
  await deleteTransaction(c.env.GAMES, date, id);
  return c.redirect('/transactions', 303);
});

app.get('/games', async c => {
  const [games, index, transactions, personal, creators, creatorGameLinks] = await Promise.all([
    listGames(c.env.GAMEDB), getTitleIndex(c.env.GAMEDB), getAllTransactions(c.env.GAMES), listPersonalSummaries(c.env.GAMESTATE), listCreators(c.env.CREATORS), listCreatorGameLinks(c.env.CREATORS),
  ]);
  const { owned, unresolved } = joinOwnership(index, transactions);
  const rows = games
    .map(({ key, meta }) => ({ key, meta, purchases: owned.get(key) ?? [], personal: personal.get(key) }))
    .sort((a, b) => a.meta.title.localeCompare(b.meta.title));
  return c.html(<GameList rows={rows} unresolved={unresolved} creatorIndex={buildCreatorIndex(creators)} creatorGameLinks={creatorGameLinks} />);
});

app.post('/games', async c => {
  const title = String((await c.req.formData()).get('title') ?? '').trim();
  if (!title || title.length > 300) return c.text('Title is required (max 300 characters).', 422);
  const index = await getTitleIndex(c.env.GAMEDB);
  const existing = resolveTitle(index, title);
  if (existing && 'key' in existing) return c.redirect(`/games/${existing.key}`, 303);
  const base = slugify(title) || 'game';
  let key = base;
  for (let n = 2; await getGame(c.env.GAMEDB, key); n++) key = `${base}-${n}`;
  const game: Game = { key, title, updatedAt: new Date().toISOString() };
  await saveGame(c.env.GAMEDB, game);
  return c.redirect(`/games/${key}?saved=1`, 303);
});

const gamePurchases = async (env: Env, key: string) => {
  const [index, transactions] = await Promise.all([getTitleIndex(env.GAMEDB), getAllTransactions(env.GAMES)]);
  return joinOwnership(index, transactions, true).owned.get(key) ?? [];
};

const gamePersonal = (env: Env, key: string): Promise<PersonalEntry[]> => getPersonalEntries(env.GAMESTATE, key);

const personalDraft = (today = new Date().toISOString().slice(0, 10)) => ({ date: today, platform: '', state: '', rating: '', note: '' });

app.get(`/games/${GAME}/creator-sources`, async c => {
  const game = await getGame(c.env.GAMEDB, c.req.param('key'));
  return game ? c.text(rawCreatorCredits(game)) : c.notFound();
});

app.get(`/games/${GAME}`, async c => {
  const key = c.req.param('key');
  const game = await getGame(c.env.GAMEDB, key);
  if (!game) return c.notFound();
  let autoRefresh: Pick<RefreshJob, 'id' | 'state'> | undefined;
  let autoRefreshError: string | undefined;
  if (c.env.FETCHER === 'on' && needsGameRefresh(game)) {
    try {
      const job = await refreshQueue(c.env).enqueue(key, { maxAgeDays: 1 }, true, game.title);
      autoRefresh = { id: job.id, state: job.state };
    } catch (error) {
      console.error(`Failed to enqueue automatic refresh for ${key}:`, error);
      autoRefreshError = error instanceof Error ? error.message : String(error);
    }
  }
  const [purchases, personalEntries, creators, creatorGameLinks] = await Promise.all([gamePurchases(c.env, key), gamePersonal(c.env, key), listCreators(c.env.CREATORS), getGameCreatorLinks(c.env.CREATORS, key)]);
  const editingEntry = personalEntries.find(entry => entry.id === c.req.query('editState'));
  return c.html(
    <GamePage game={game} purchases={purchases} creatorIndex={buildCreatorIndex(creators)} creatorGameLinks={creatorGameLinks} release={releaseDate(game)} saved={c.req.query('saved') === '1'} fetcher={c.env.FETCHER === 'on'} autoRefresh={autoRefresh} autoRefreshError={autoRefreshError} personalEntries={personalEntries} personalSaved={c.req.query('personalSaved') === '1'} personalDraft={editingEntry ? { date: editingEntry.date, platform: editingEntry.platform, state: editingEntry.state ?? '', rating: editingEntry.rating === undefined ? '' : String(editingEntry.rating), note: editingEntry.note ?? '' } : personalDraft()} editingEntry={editingEntry} />,
  );
});

app.post(`/games/${GAME}/state`, async c => {
  const key = c.req.param('key');
  const game = await getGame(c.env.GAMEDB, key);
  if (!game) return c.notFound();
  const { entry, errors, draft } = validatePersonalDraft(await c.req.formData());
  const [purchases, personalEntries] = await Promise.all([gamePurchases(c.env, key), gamePersonal(c.env, key)]);
  if (!entry) return c.html(
    <GamePage game={game} purchases={purchases} creatorIndex={buildCreatorIndex(await listCreators(c.env.CREATORS))} creatorGameLinks={await getGameCreatorLinks(c.env.CREATORS, key)} release={releaseDate(game)} personalEntries={personalEntries} personalErrors={errors} personalDraft={draft} fetcher={c.env.FETCHER === 'on'} />,
    422,
  );
  await savePersonalEntries(c.env.GAMESTATE, key, [...personalEntries, entry]);
  return c.redirect(`/games/${key}?personalSaved=1`, 303);
});

app.post(`/games/${GAME}/state/:entryId{[0-9a-f]{32}}`, async c => {
  const key = c.req.param('key');
  const game = await getGame(c.env.GAMEDB, key);
  if (!game) return c.notFound();
  const entryId = c.req.param('entryId');
  const personalEntries = await gamePersonal(c.env, key);
  const previous = personalEntries.find(entry => entry.id === entryId);
  if (!previous) return c.notFound();
  const { entry, errors, draft } = validatePersonalDraft(await c.req.formData());
  const purchases = await gamePurchases(c.env, key);
  if (!entry) return c.html(
    <GamePage game={game} purchases={purchases} creatorIndex={buildCreatorIndex(await listCreators(c.env.CREATORS))} creatorGameLinks={await getGameCreatorLinks(c.env.CREATORS, key)} release={releaseDate(game)} personalEntries={personalEntries} personalErrors={errors} personalDraft={draft} editingEntry={previous} fetcher={c.env.FETCHER === 'on'} />,
    422,
  );
  await savePersonalEntries(c.env.GAMESTATE, key, personalEntries.map(item => item.id === entryId
    ? { ...entry, id: entryId, recordedAt: previous.recordedAt }
    : item));
  return c.redirect(`/games/${key}?personalSaved=1`, 303);
});

app.post(`/games/${GAME}/state/:entryId{[0-9a-f]{32}}/delete`, async c => {
  const key = c.req.param('key');
  if (!await getGame(c.env.GAMEDB, key)) return c.notFound();
  await deletePersonalEntry(c.env.GAMESTATE, key, c.req.param('entryId'));
  return c.redirect(`/games/${key}?personalSaved=1`, 303);
});

app.post(`/games/${GAME}`, async c => {
  const key = c.req.param('key');
  const existing = await getGame(c.env.GAMEDB, key);
  if (!existing) return c.notFound();
  const { game, errors } = applyGameForm(await c.req.formData(), existing);
  if (!game) {
    return c.html(<GamePage game={existing} purchases={await gamePurchases(c.env, key)} creatorIndex={buildCreatorIndex(await listCreators(c.env.CREATORS))} creatorGameLinks={await getGameCreatorLinks(c.env.CREATORS, key)} release={releaseDate(existing)} errors={errors} />, 422);
  }
  await saveGame(c.env.GAMEDB, game);
  return c.redirect(`/games/${key}?saved=1`, 303);
});

app.post(`/games/${GAME}/delete`, async c => {
  const key = c.req.param('key');
  const game = await getGame(c.env.GAMEDB, key);
  if (!game) return c.notFound();
  const [index, transactions, personalEntries] = await Promise.all([
    getTitleIndex(c.env.GAMEDB), getAllTransactions(c.env.GAMES), getPersonalEntries(c.env.GAMESTATE, key),
  ]);
  const purchases = joinOwnership(index, transactions, true).owned.get(key) ?? [];
  const explicitlyLinked = transactions.some(tx => tx.items.some(item => item.game === key));
  const errors = [
    ...(purchases.length || explicitlyLinked ? ['Remove or reassign purchases linked to this game before deleting it.'] : []),
    ...(personalEntries.length ? ['Remove or transfer personal entries before deleting this game.'] : []),
  ];
  if (errors.length) {
    return c.html(<GamePage game={game} purchases={purchases} personalEntries={personalEntries}
      creatorIndex={buildCreatorIndex(await listCreators(c.env.CREATORS))}
      creatorGameLinks={await getGameCreatorLinks(c.env.CREATORS, key)}
      release={releaseDate(game)} errors={errors} fetcher={c.env.FETCHER === 'on'} />, 409);
  }
  await deleteGame(c.env.GAMEDB, key);
  await deleteGameCreatorLinks(c.env.CREATORS, key);
  return c.redirect('/games', 303);
});

const creatorGames = async (env: Env, index: CreatorIndex, includeUnmatched = false): Promise<{
  matches: Map<string, CreatorGame[]>;
  unmatched: { name: string; games: CreatorGame[] }[];
  verification: { verified: number; total: number };
}> => {
  const [refs, links] = await Promise.all([listGames(env.GAMEDB), listCreatorGameLinks(env.CREATORS)]);
  const games = await getGames(env.GAMEDB, refs.map(ref => ref.key));
  const matches = new Map<string, Map<string, CreatorGame>>();
  const unmatched = new Map<string, { name: string; games: Map<string, CreatorGame> }>();
  for (const ref of refs) {
    const game = games.get(ref.key);
    if (!game) throw new Error(`Game disappeared while listing creators: ${ref.key}`);
    const credits = gameCreatorCredits(game, index);
    for (const [names, role] of [
      [credits.developers, 'developer'],
      [credits.publishers, 'publisher'],
      [credits.creators, undefined],
    ] as const) {
      for (const { key, name } of names) {
        if (!key) {
          if (!includeUnmatched) continue;
          const normalized = normalizeCreator(name);
          const entry = unmatched.get(normalized) ?? { name, games: new Map<string, CreatorGame>() };
          const previous = entry.games.get(ref.key);
          const roles: CreatorRole[] = previous?.roles ?? [];
          if (role && !roles.includes(role)) roles.push(role);
          entry.games.set(ref.key, { ...ref, roles });
          unmatched.set(normalized, entry);
          continue;
        }
        const byGame = matches.get(key) ?? new Map<string, CreatorGame>();
        const previous = byGame.get(ref.key);
        const as = index.get(normalizeCreator(name))?.aka ? name : undefined;
        const roles: CreatorRole[] = previous?.roles ?? [];
        if (role && !roles.includes(role)) roles.push(role);
        const attribution = previous?.as ?? as;
        const link = links.get(ref.key)?.get(key);
        byGame.set(ref.key, { ...ref, roles, ...(attribution ? { as: attribution } : {}), ...(link ? { link } : {}) });
        matches.set(key, byGame);
      }
    }
  }
  return {
    matches: new Map([...matches].map(([key, byGame]) => [key, [...byGame.values()]])),
    unmatched: [...unmatched.values()].map(({ name, games }) => ({ name, games: [...games.values()] }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    verification: creatorVerificationProgress(refs.map(ref => ref.meta), index),
  };
};

app.get('/creators', async c => {
  const creators = await listCreators(c.env.CREATORS);
  const { matches, unmatched, verification } = await creatorGames(c.env, buildCreatorIndex(creators), true);
  return c.html(<CreatorList creators={creators.sort((a, b) => a.name.localeCompare(b.name))} games={matches} unmatched={unmatched} verification={verification} />);
});

app.get('/creators/new', async c => {
  const name = c.req.query('name')?.trim() ?? '';
  if (name.length > 300) return c.text('Creator name must be at most 300 characters.', 422);
  const creators = await listCreators(c.env.CREATORS);
  const index = buildCreatorIndex(creators);
  const existing = index.get(normalizeCreator(name));
  if (existing) return c.redirect(`/creators/${existing.creator.key}`, 303);
  const games = name ? (await creatorGames(c.env, new Map([[normalizeCreator(name), { creator: { key: 'new', name, aliases: [] }, aka: false }]]))).matches.get('new') ?? [] : [];
  return c.html(<CreatorPage draft={{ name, aliases: '', aka: '', url: '', parent: '' }} games={games} creators={creators} />);
});

app.post('/creators', async c => {
  const draft = readCreatorDraft(await c.req.formData());
  const creators = await listCreators(c.env.CREATORS);
  const { creator, errors } = validateCreator(draft, creators);
  if (!creator) {
    const games = normalizeCreator(draft.name) ? (await creatorGames(c.env, new Map([[normalizeCreator(draft.name), { creator: { key: 'new', name: draft.name, aliases: [] }, aka: false }]]))).matches.get('new') ?? [] : [];
    return c.html(<CreatorPage draft={draft} games={games} creators={creators} errors={errors} />, 422);
  }
  const key = await newCreatorKey(c.env.CREATORS, creator.name);
  await saveCreator(c.env.CREATORS, key, creator);
  return c.redirect(`/creators/${key}?saved=1`, 303);
});

const CREATOR = ':key{[a-z0-9-]{1,120}}';
const CREDIT_GAME = ':game{[a-z0-9-]{1,120}}';

app.get(`/creators/${CREATOR}`, async c => {
  const key = c.req.param('key');
  const creator = await getCreator(c.env.CREATORS, key);
  if (!creator) return c.notFound();
  const creators = await listCreators(c.env.CREATORS);
  const games = (await creatorGames(c.env, buildCreatorIndex(creators))).matches.get(key) ?? [];
  return c.html(<CreatorPage creator={{ key, ...creator }} draft={toCreatorDraft(creator)} games={games} creators={creators} saved={c.req.query('saved') === '1'} />);
});

app.post(`/creators/${CREATOR}/games/${CREDIT_GAME}`, async c => {
  const { key, game: gameKey } = c.req.param();
  const [creator, game, creators] = await Promise.all([
    getCreator(c.env.CREATORS, key), getGame(c.env.GAMEDB, gameKey), listCreators(c.env.CREATORS),
  ]);
  if (!creator || !game) return c.notFound();
  const credits = gameCreatorCredits(game, buildCreatorIndex(creators));
  if (![...credits.developers, ...credits.publishers, ...credits.creators].some(credit => credit.key === key)) {
    return c.json({ error: 'This creator is not credited on this game.' }, 409);
  }
  const form = await c.req.formData();
  const checked = form.getAll('credited');
  const notesInput = form.get('notes');
  if (checked.length > 1 || checked.some(value => value !== '1') || notesInput !== null && typeof notesInput !== 'string') {
    return c.json({ error: 'Invalid attribution fields.' }, 422);
  }
  const previous = notesInput === null ? await getCreatorGameLink(c.env.CREATORS, gameKey, key) : null;
  const notes = notesInput === null ? previous?.notes ?? '' : notesInput.trim();
  if (notes.length > 1000) return c.json({ error: 'Attribution note must be at most 1000 characters.' }, 422);
  const link = { ...(checked.length ? {} : { miscredit: true }), ...(notes ? { notes } : {}) };
  await saveCreatorGameLink(c.env.CREATORS, gameKey, key, link);
  return c.req.header('Accept')?.includes('application/json')
    ? c.json({ ok: true, link })
    : c.redirect(`/creators/${key}?saved=1`, 303);
});

app.post(`/creators/${CREATOR}`, async c => {
  const key = c.req.param('key');
  const previous = await getCreator(c.env.CREATORS, key);
  if (!previous) return c.notFound();
  const draft = readCreatorDraft(await c.req.formData());
  const creators = await listCreators(c.env.CREATORS);
  const { creator, errors } = validateCreator(draft, creators, key);
  if (!creator) {
    const games = (await creatorGames(c.env, buildCreatorIndex(creators))).matches.get(key) ?? [];
    return c.html(<CreatorPage creator={{ key, ...previous }} draft={draft} games={games} creators={creators} errors={errors} />, 422);
  }
  await saveCreator(c.env.CREATORS, key, creator);
  return c.redirect(`/creators/${key}?saved=1`, 303);
});

app.post(`/creators/${CREATOR}/delete`, async c => {
  const key = c.req.param('key');
  const creator = await getCreator(c.env.CREATORS, key);
  if (!creator) return c.notFound();
  const creators = await listCreators(c.env.CREATORS);
  const children = creators.filter(child => child.parent === key);
  if (children.length) {
    const games = (await creatorGames(c.env, buildCreatorIndex(creators))).matches.get(key) ?? [];
    return c.html(<CreatorPage
      creator={{ key, ...creator }} draft={toCreatorDraft(creator)} games={games} creators={creators}
      errors={[`Cannot delete ${creator.name}: ${children.map(child => child.name).join(', ')} use this creator as their parent. Reassign them first.`]}
    />, 409);
  }
  await deleteCreatorGameLinks(c.env.CREATORS, key);
  await c.env.CREATORS.delete(creatorKey(key));
  return c.redirect('/creators', 303);
});

app.get('/export.json', async c => {
  const [transactions, libraries, gameRefs, personalStates, creators, links] = await Promise.all([
    getAllTransactions(c.env.GAMES), getAllLibraries(c.env.GAMES), listGames(c.env.GAMEDB), getAllPersonalEntries(c.env.GAMESTATE), listCreators(c.env.CREATORS), listCreatorGameLinks(c.env.CREATORS),
  ]);
  const games = [...(await getGames(c.env.GAMEDB, gameRefs.map(r => r.key))).values()];
  c.header('Content-Disposition', `attachment; filename="game-library-${new Date().toISOString().slice(0, 10)}.json"`);
  const creatorGameLinks = [...links].flatMap(([game, byCreator]) =>
    [...byCreator].map(([creator, link]) => ({ game, creator, ...link })));
  return c.json({ exportedAt: new Date().toISOString(), transactions, libraries, games, personalStates, creators, creatorGameLinks });
});

export default app;
export { GameRefreshQueue };
