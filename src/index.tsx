import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
import { emptyItem, readDraft, toDraft, validateDraft, type TransactionDraft } from './form';
import { applyGameForm } from './gameForm';
import { fetcher } from './fetcher/api';
import { getGame, getGames, getTitleIndex, listGames, saveGame } from './gamedb';
import { itemLinks, joinOwnership, releaseDate, resolveTitle, slugify, type Game } from './games';
import { PLATFORMS, isOneOf, itemsForPlatforms, normalizeTitle, ownedKeys } from './model';
import { getAllPersonalEntries, getPersonalEntries, listPersonalSummaries, savePersonalEntries, deletePersonalEntry, validatePersonalDraft } from './personalStore';
import type { PersonalEntry } from './personal';
import {
  deleteTransaction, getAllLibraries, getAllTransactions, getTransaction, listTransactions, saveTransaction,
} from './store';
import { GameList, GamePage } from './views/Games';
import { PersonalHistory } from './views/PersonalHistory';
import { RefreshPage } from './views/Refresh';
import { TransactionForm } from './views/TransactionForm';
import { TransactionList } from './views/TransactionList';

type Env = {
  GAMES: KVNamespace;
  GAMEDB: KVNamespace;
  GAMESTATE: KVNamespace;
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
  const [games, index, transactions, personal] = await Promise.all([
    listGames(c.env.GAMEDB), getTitleIndex(c.env.GAMEDB), getAllTransactions(c.env.GAMES), listPersonalSummaries(c.env.GAMESTATE),
  ]);
  const { owned, unresolved } = joinOwnership(index, transactions);
  const rows = games
    .map(({ key, meta }) => ({ key, meta, purchases: owned.get(key) ?? [], personal: personal.get(key) }))
    .sort((a, b) => a.meta.title.localeCompare(b.meta.title));
  return c.html(<GameList rows={rows} unresolved={unresolved} />);
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
  return joinOwnership(index, transactions).owned.get(key) ?? [];
};

const gamePersonal = (env: Env, key: string): Promise<PersonalEntry[]> => getPersonalEntries(env.GAMESTATE, key);

const personalDraft = (today = new Date().toISOString().slice(0, 10)) => ({ date: today, platform: '', state: '', rating: '', note: '' });

app.get(`/games/${GAME}`, async c => {
  const key = c.req.param('key');
  const game = await getGame(c.env.GAMEDB, key);
  if (!game) return c.notFound();
  const [purchases, personalEntries] = await Promise.all([gamePurchases(c.env, key), gamePersonal(c.env, key)]);
  const editingEntry = personalEntries.find(entry => entry.id === c.req.query('editState'));
  return c.html(
    <GamePage game={game} purchases={purchases} release={releaseDate(game)} saved={c.req.query('saved') === '1'} fetcher={c.env.FETCHER === 'on'} personalEntries={personalEntries} personalSaved={c.req.query('personalSaved') === '1'} personalDraft={editingEntry ? { date: editingEntry.date, platform: editingEntry.platform, state: editingEntry.state ?? '', rating: editingEntry.rating === undefined ? '' : String(editingEntry.rating), note: editingEntry.note ?? '' } : personalDraft()} editingEntry={editingEntry} />,
  );
});

app.post(`/games/${GAME}/state`, async c => {
  const key = c.req.param('key');
  const game = await getGame(c.env.GAMEDB, key);
  if (!game) return c.notFound();
  const { entry, errors, draft } = validatePersonalDraft(await c.req.formData());
  const [purchases, personalEntries] = await Promise.all([gamePurchases(c.env, key), gamePersonal(c.env, key)]);
  if (!entry) return c.html(
    <GamePage game={game} purchases={purchases} release={releaseDate(game)} personalEntries={personalEntries} personalErrors={errors} personalDraft={draft} fetcher={c.env.FETCHER === 'on'} />,
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
    <GamePage game={game} purchases={purchases} release={releaseDate(game)} personalEntries={personalEntries} personalErrors={errors} personalDraft={draft} editingEntry={previous} fetcher={c.env.FETCHER === 'on'} />,
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
    return c.html(<GamePage game={existing} purchases={await gamePurchases(c.env, key)} release={releaseDate(existing)} errors={errors} />, 422);
  }
  await saveGame(c.env.GAMEDB, game);
  return c.redirect(`/games/${key}?saved=1`, 303);
});

app.get('/export.json', async c => {
  const [transactions, libraries, gameRefs, personalStates] = await Promise.all([
    getAllTransactions(c.env.GAMES), getAllLibraries(c.env.GAMES), listGames(c.env.GAMEDB), getAllPersonalEntries(c.env.GAMESTATE),
  ]);
  const games = [...(await getGames(c.env.GAMEDB, gameRefs.map(r => r.key))).values()];
  c.header('Content-Disposition', `attachment; filename="game-library-${new Date().toISOString().slice(0, 10)}.json"`);
  return c.json({ exportedAt: new Date().toISOString(), transactions, libraries, games, personalStates });
});

export default app;
