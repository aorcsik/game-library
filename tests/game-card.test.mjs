import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameEmbedKeys, parseMarkdown } from '../src/markdown.ts';
import { creatorContext, gameDescription, searchGames, toGameCard } from '../src/gameCard.ts';

test('parses a game embed only when it stands alone on its own line', () => {
  const blocks = parseMarkdown('Intro\n![game:hollow-knight]\nmore text\n\n  ![game:signalis]  \n\n> ![game:celeste]\n\ninline ![game:nope] here\n\n![game:Bad Key]\n\n![game:](x)');
  assert.deepEqual(blocks.map(block => block.type), ['paragraph', 'game', 'paragraph', 'game', 'quote', 'paragraph', 'paragraph', 'paragraph']);
  assert.equal(blocks[0].children[0].value, 'Intro');
  assert.deepEqual(gameEmbedKeys(blocks), ['hollow-knight', 'signalis', 'celeste']);
  assert.deepEqual(gameEmbedKeys(parseMarkdown('![game:a]\n\n![game:a]\n\n![game:b]')), ['a', 'b']);
});

const steamData = (overrides = {}) => ({
  title: 'Signalis', description: null, genres: [], releaseDate: null, reviewScore: 8, reviewScoreDescription: null, reviewScoreTooltip: null,
  headerImage: null, ...overrides,
});
const baseGame = { key: 'signalis', title: 'Signalis', updatedAt: '2026-01-01' };
const richGame = {
  ...baseGame, releaseDate: '2022-10-27', manualGenres: ['Horror', 'Adventure', 'Indie', 'Action', 'Extra'],
  steam: { id: 1262350, data: steamData({ description: 'A survival horror.', developers: ['Rose-engine'], publishers: ['Humble Games'] }) },
  opencritic: { id: '13085/signalis', data: { title: 'Signalis', cover: null, tier: 'Mighty', score: 87, critics: 90, releaseDate: null } },
  metacritic: { id: 'https://www.metacritic.com/game/signalis/', data: { title: 'Signalis', releaseDate: null, metacriticScore: 84, mustPlay: true, genres: [], platforms: [], publisher: null, developers: [] } },
};
const creators = [
  { key: 'rose-engine', name: 'Rose-engine', aliases: [], url: 'https://rose-engine.example' },
  { key: 'humble-games', name: 'Humble Games', aliases: [] },
];
const context = creatorContext(creators);

test('builds a public card with the cover, dates, genres and linked review data', () => {
  const card = toGameCard(richGame, context);
  assert.equal(card.year, '2022');
  assert.equal(card.release, '2022-10-27');
  assert.equal(card.cover, 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1262350/library_600x900.jpg');
  assert.equal(card.genres.length, 5);
  assert.equal(card.description, 'A survival horror.');
  assert.deepEqual(card.opencritic, { tier: 'Mighty', score: 87, href: 'https://opencritic.com/game/13085/signalis' });
  assert.deepEqual(card.metacritic, { score: 84, tone: 'good', mustPlay: true, href: 'https://www.metacritic.com/game/signalis/' });
  assert.deepEqual(card.steam, { review: 'Very Positive', tone: 'positive', href: 'https://store.steampowered.com/app/1262350' });
});

test('links developers and publishers only when the creator has a website', () => {
  const card = toGameCard(richGame, context);
  assert.deepEqual(card.developers, [{ name: 'Rose-engine', href: 'https://rose-engine.example' }]);
  assert.deepEqual(card.publishers, [{ name: 'Humble Games', href: undefined }]);

  const unmatched = toGameCard({ ...richGame, steam: { id: 1, data: steamData({ developers: ['Unknown Studio'] }) } }, context);
  assert.deepEqual(unmatched.developers, [{ name: 'Unknown Studio', href: undefined }]);

  const unsafe = creatorContext([{ ...creators[0], url: 'javascript:alert(1)' }, creators[1]]);
  assert.equal(toGameCard(richGame, unsafe).developers[0].href, undefined);
});

test('leaves out creators recorded as miscredits for the game', () => {
  const card = toGameCard(richGame, context, new Map([['rose-engine', { miscredit: true }]]));
  assert.deepEqual(card.developers, []);
  assert.equal(card.publishers.length, 1);
});

test('picks the description from Steam, then Metacritic, then OpenCritic, collapsed and capped', () => {
  const metacritic = (summary) => ({ id: 'x', data: { ...richGame.metacritic.data, summary } });
  const opencritic = (description) => ({ id: 'x', data: { ...richGame.opencritic.data, description } });
  assert.equal(gameDescription({ ...baseGame, steam: { id: 1, data: steamData({ description: '  Spaced \n out\ttext ' }) }, metacritic: metacritic('other') }), 'Spaced out text');
  assert.equal(gameDescription({ ...baseGame, steam: { id: 1, data: steamData({ description: '   ' }) }, metacritic: metacritic('From Metacritic') }), 'From Metacritic');
  assert.equal(gameDescription({ ...baseGame, opencritic: opencritic('From OpenCritic') }), 'From OpenCritic');
  assert.equal(gameDescription(baseGame), undefined);
  const long = gameDescription({ ...baseGame, steam: { id: 1, data: steamData({ description: 'word '.repeat(400) }) } });
  assert.ok(long.length <= 501 && long.endsWith('…'));
});

test('shows a Metacritic page without a score as tbd, and hides sources without data', () => {
  const tbd = toGameCard({ ...baseGame, metacritic: { id: 'https://www.metacritic.com/game/x/', data: { ...richGame.metacritic.data, metacriticScore: null, mustPlay: false } } }, context);
  assert.deepEqual(tbd.metacritic, { score: undefined, tone: 'tbd', mustPlay: false, href: 'https://www.metacritic.com/game/x/' });
  assert.equal(tbd.opencritic, undefined);
  assert.equal(tbd.steam, undefined);
});

test('omits missing data and never links to unsafe URLs', () => {
  assert.deepEqual({ ...toGameCard(baseGame, context) }, {
    key: 'signalis', title: 'Signalis', year: undefined, release: undefined, cover: undefined, genres: [], developers: [], publishers: [],
    description: undefined, opencritic: undefined, metacritic: undefined, steam: undefined,
  });
  const unsafe = toGameCard({ ...baseGame, coverSource: 'opencritic', opencritic: { id: 'x', data: { ...richGame.opencritic.data, cover: 'javascript:alert(1)' } },
    metacritic: { id: 'javascript:alert(1)', data: richGame.metacritic.data } }, context);
  assert.equal(unsafe.metacritic, undefined);
  assert.equal(unsafe.cover, undefined);
});

test('searches titles and keys ignoring case and accents, best matches first', () => {
  const ref = (key, title, release) => ({ key, meta: { title, release } });
  const refs = [ref('hollow-knight', 'Hollow Knight', '2017-02-24'), ref('knight-or-day', 'Knights & Days'), ref('pokemon', 'Pokémon Red'), ref('hk-silksong', 'Hollow Knight: Silksong')];
  assert.deepEqual(searchGames(refs, 'KNIGHT').map(g => g.key), ['knight-or-day', 'hollow-knight', 'hk-silksong']);
  assert.deepEqual(searchGames(refs, 'hollow kni')[0], { key: 'hollow-knight', title: 'Hollow Knight', year: '2017' });
  assert.deepEqual(searchGames(refs, 'pokemon').map(g => g.key), ['pokemon']);
  assert.deepEqual(searchGames(refs, 'zzz'), []);
  assert.deepEqual(searchGames(refs, '   '), []);
  assert.equal(searchGames(Array.from({ length: 40 }, (_, i) => ref(`g${i}`, `Game ${i}`)), 'game').length, 15);
});
