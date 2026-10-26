import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deleteGame } from '../src/gamedb.ts';
import { applyGameForm } from '../src/gameForm.ts';
import { buildIndex, gameCover, gameDevelopers, gameGenres, gameMetaCover, gamePublishers, metacriticBucket, opencriticTier, rawCreatorCredits, releaseDate, resolveTitle, toGameMeta } from '../src/games.ts';

const game = { key: 'sample', title: 'Sample Game', updatedAt: '2026-01-01' };

test('selects release dates in manual, Metacritic, OpenCritic, Steam order for details and list metadata', () => {
  const sources = {
    ...game,
    releaseDate: '2026-04-01',
    metacritic: { id: 'sample', data: { releaseDate: '2026-03-01T00:00:00.000Z' } },
    opencritic: { id: 'sample', data: { releaseDate: '2026-02-01' } },
    steam: { id: 1, data: { releaseDate: '2026-01-01' } },
  };
  const cases = [
    [sources, '2026-04-01'],
    [{ ...sources, releaseDate: undefined }, '2026-03-01'],
    [{ ...sources, releaseDate: 'not-a-date', metacritic: undefined }, '2026-02-01'],
    [{ ...sources, releaseDate: undefined, metacritic: { id: 'sample', data: { releaseDate: null } }, opencritic: undefined }, '2026-01-01'],
    [game, undefined],
  ];
  for (const [input, expected] of cases) {
    assert.equal(releaseDate(input), expected);
    assert.equal(toGameMeta(input).release, expected);
  }
});

test('includes verified developers and publishers, but excludes OpenCritic-only creators from list metadata', () => {
  const sources = {
    ...game,
    steam: { id: 1, data: { developers: [' Studio A ', 'Studio B'], publishers: ['Publisher A'] } },
    metacritic: { id: 'https://example.com', data: { developers: ['Studio B', 'Studio C'], publisher: 'Publisher B, Publisher C', publishers: ['Publisher B', 'Publisher C'] } },
    opencritic: { id: 'sample', data: { creators: ['Studio C', ' Studio D '] } },
  };
  assert.deepEqual(gameDevelopers(sources), ['Studio A', 'Studio B', 'Studio C']);
  assert.deepEqual(gamePublishers(sources), ['Publisher A', 'Publisher B', 'Publisher C']);
  const meta = toGameMeta(sources);
  assert.deepEqual(meta.developers, ['Studio A', 'Studio B', 'Studio C']);
  assert.deepEqual(meta.publishers, ['Publisher A', 'Publisher B', 'Publisher C']);
  assert.equal(toGameMeta({ ...game, opencritic: { id: 'sample', data: { creators: ['OC Only'] } } }).developers, undefined);
  assert.equal(toGameMeta({ ...game, opencritic: { id: 'sample', data: { creators: ['OC Only'] } } }).publishers, undefined);
  assert.equal(toGameMeta(game).developers, undefined);
});

test('keeps creator metadata within the KV size limit', () => {
  const meta = toGameMeta({
    ...game,
    steam: { id: 1, data: { developers: ['A'.repeat(1100), 'Small Studio'], publishers: ['P'.repeat(1100), 'Small Publisher'] } },
  });
  assert.deepEqual(meta.developers, ['Small Studio']);
  assert.deepEqual(meta.publishers, ['Small Publisher']);
  assert.ok(new TextEncoder().encode(JSON.stringify(meta)).length <= 1024);
});

test('keeps raw role-specific credits separate from matching and shows each source', () => {
  const sources = {
    ...game,
    steam: { id: 1, data: { developers: ['Franek', 'Fáyer'], publishers: ['Panic'] } },
    metacritic: { id: 'arco', data: { developers: ['Franek and Antonio Uribe'], publisher: 'Panic Inc.' } },
    opencritic: { id: 'arco', data: { creators: ['Panic Inc.'] } },
  };
  assert.equal(rawCreatorCredits(sources), [
    'Raw creator credits',
    'Metacritic developers: Franek and Antonio Uribe',
    'Metacritic publishers: Panic Inc.',
    'Steam developers: Franek; Fáyer',
    'Steam publishers: Panic',
    'OpenCritic creators: Panic Inc.',
    'Manual developers: (none)',
    'Manual publishers: (none)',
  ].join('\n'));
  assert.deepEqual(gameDevelopers(sources), ['Franek', 'Fáyer', 'Franek and Antonio Uribe']);
  assert.equal(rawCreatorCredits(game), [
    'Raw creator credits',
    'Metacritic developers: (none)',
    'Metacritic publishers: (none)',
    'Steam developers: (none)',
    'Steam publishers: (none)',
    'OpenCritic creators: (none)',
    'Manual developers: (none)',
    'Manual publishers: (none)',
  ].join('\n'));
});

test('normalizes Thunderful by source role in list metadata without modifying fetched values', () => {
  const sources = {
    ...game,
    steam: { data: { developers: [' Thunderful ', 'Other Studio'], publishers: ['Thunderful', 'Thunderful Games'] } },
    metacritic: { data: { developers: ['Thunderful Development'], publisher: 'Thunderful Publishing' } },
    opencritic: { data: { creators: ['Thunderful'] } },
  };
  assert.deepEqual(gameDevelopers(sources), ['Thunderful Development', 'Other Studio']);
  assert.deepEqual(gamePublishers(sources), ['Thunderful Publishing', 'Thunderful Games']);
  const meta = toGameMeta(sources);
  assert.deepEqual(meta.developers, ['Thunderful Development', 'Other Studio']);
  assert.deepEqual(meta.publishers, ['Thunderful Publishing', 'Thunderful Games']);
  assert.equal(sources.steam.data.developers[0], ' Thunderful ');
  assert.equal(sources.steam.data.publishers[0], 'Thunderful');
  assert.match(rawCreatorCredits(sources), /Steam publishers: Thunderful; Thunderful Games/);
  assert.deepEqual(gamePublishers({
    metacritic: { data: { publisher: 'Thunderful, Flyhigh Works, Super Rare Games' } },
  }), ['Thunderful Publishing, Flyhigh Works, Super Rare Games']);
});

test('saves comma-separated manual credits independently of fetched data and exposes them in list metadata', () => {
  const existing = {
    ...game,
    steam: { id: 1, data: { developers: ['Steam Studio'], publishers: ['Steam Publisher'] } },
    manualDevelopers: ['Old Studio'],
    manualPublishers: ['Old Publisher'],
  };
  const form = new FormData();
  form.set('title', game.title);
  form.set('steam', '1');
  form.set('manualDevelopers', ' Thunderful, Acme, Inc., Unknown Studio, Thunderful ');
  form.set('manualPublishers', 'Thunderful, Independent Publisher');
  const result = applyGameForm(form, existing);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.game?.manualDevelopers, ['Thunderful', 'Acme, Inc.', 'Unknown Studio']);
  assert.deepEqual(result.game?.manualPublishers, ['Thunderful', 'Independent Publisher']);
  assert.deepEqual(result.game?.steam, existing.steam);
  assert.deepEqual(gameDevelopers(result.game), ['Steam Studio', 'Thunderful Development', 'Acme, Inc.', 'Unknown Studio']);
  assert.deepEqual(gamePublishers(result.game), ['Steam Publisher', 'Thunderful Publishing', 'Independent Publisher']);
  assert.deepEqual(toGameMeta(result.game).developers, gameDevelopers(result.game));
  assert.deepEqual(toGameMeta(result.game).publishers, gamePublishers(result.game));
  assert.match(rawCreatorCredits(result.game), /Manual developers: Thunderful; Acme, Inc.; Unknown Studio/);
  assert.match(rawCreatorCredits(result.game), /Manual publishers: Thunderful; Independent Publisher/);

  form.set('manualDevelopers', '');
  form.set('manualPublishers', '');
  const cleared = applyGameForm(form, result.game).game;
  assert.equal(cleared.manualDevelopers, undefined);
  assert.equal(cleared.manualPublishers, undefined);
  assert.deepEqual(cleared.steam, existing.steam);

  form.delete('manualDevelopers');
  form.delete('manualPublishers');
  const retained = applyGameForm(form, result.game).game;
  assert.deepEqual(retained.manualDevelopers, result.game.manualDevelopers);
  assert.deepEqual(retained.manualPublishers, result.game.manualPublishers);
});

test('rejects oversized manual credits without saving a partial update', () => {
  const form = new FormData();
  form.set('title', game.title);
  form.set('manualDevelopers', 'x'.repeat(301));
  form.set('manualPublishers', Array.from({ length: 101 }, (_, index) => `Publisher ${index}`).join(', '));
  const result = applyGameForm(form, game);
  assert.equal(result.game, undefined);
  assert.equal(result.errors.length, 2);
});

test('manual genres extend fetched genres in game details and list metadata without changing sources', () => {
  const existing = {
    ...game,
    steam: { id: 1, data: { genres: ['Action', 'Strategy%20Games'] } },
    metacritic: { id: 'https://www.metacritic.com/game/sample/', data: { genres: ['Action', 'Adventure'] } },
    manualGenres: ['Old genre'],
  };
  const form = new FormData();
  form.set('title', game.title);
  form.set('steam', '1');
  form.set('metacritic', existing.metacritic.id);
  form.set('manualGenres', ' Adventure, Puzzle, Puzzle, Strategy Games ');
  const result = applyGameForm(form, existing);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.game?.manualGenres, ['Adventure', 'Puzzle', 'Strategy Games']);
  assert.deepEqual(result.game?.steam, existing.steam);
  assert.deepEqual(result.game?.metacritic, existing.metacritic);
  assert.deepEqual(gameGenres(result.game), ['Action', 'Adventure', 'Puzzle', 'Strategy Games']);
  assert.deepEqual(toGameMeta(result.game).genres, gameGenres(result.game));

  form.set('manualGenres', '');
  const cleared = applyGameForm(form, result.game).game;
  assert.equal(cleared.manualGenres, undefined);
  assert.deepEqual(gameGenres(cleared), ['Action', 'Adventure', 'Strategy Games']);
  form.delete('manualGenres');
  const retained = applyGameForm(form, result.game).game;
  assert.deepEqual(retained.manualGenres, result.game.manualGenres);
});

test('rejects manual genres that exceed name or KV metadata limits', () => {
  const form = new FormData();
  form.set('title', game.title);
  form.set('manualGenres', 'x'.repeat(301));
  assert.deepEqual(applyGameForm(form, game).errors, [
    'Manual genres must have at most 100 comma-separated names of up to 300 characters each.',
  ]);
  form.set('manualGenres', Array.from({ length: 101 }, (_, i) => `Genre ${i}`).join(', '));
  assert.deepEqual(applyGameForm(form, game).errors, [
    'Manual genres must have at most 100 comma-separated names of up to 300 characters each.',
  ]);
  form.set('manualGenres', Array.from({ length: 10 }, (_, i) => `${i}${'x'.repeat(120)}`).join(', '));
  assert.deepEqual(applyGameForm(form, game).errors, [
    'Too many genres to fit in game list metadata. Remove some manual genres.',
  ]);
});

test('selects Steam portrait, then OpenCritic, then Metacritic by default while respecting manual overrides', () => {
  const sources = {
    ...game,
    opencritic: { id: '1/game', data: { cover: 'https://example.com/oc.jpg' } },
    steam: { id: 42, data: { headerImage: 'https://example.com/steam.jpg' } },
    metacritic: { id: 'https://www.metacritic.com/game/game/', data: { cover: 'https://example.com/mc.jpg', mainImage: 'https://example.com/mc-main.jpg' } },
  };
  const portraitUrl = 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/42/library_600x900.jpg';
  assert.equal(gameCover(sources), portraitUrl);
  assert.equal(toGameMeta(sources).cover, undefined);
  assert.equal(gameMetaCover(toGameMeta(sources)), portraitUrl);
  assert.equal(gameMetaCover({ ...toGameMeta(sources), cover: sources.opencritic.data.cover }), portraitUrl);
  const withoutSteam = { ...sources, steam: undefined };
  assert.equal(gameCover(withoutSteam), sources.opencritic.data.cover);
  assert.equal(gameMetaCover(toGameMeta(withoutSteam)), sources.opencritic.data.cover);
  const withoutOpenCritic = { ...withoutSteam, opencritic: { id: '1/game', data: { cover: null } } };
  assert.equal(gameCover(withoutOpenCritic), sources.metacritic.data.cover);
  assert.equal(gameMetaCover(toGameMeta(withoutOpenCritic)), sources.metacritic.data.cover);
  assert.equal(gameCover({ ...withoutOpenCritic, metacritic: undefined }), undefined);

  const form = new FormData();
  form.set('title', game.title);
  form.set('opencritic', sources.opencritic.id);
  form.set('steam', String(sources.steam.id));
  form.set('metacritic', sources.metacritic.id);
  form.set('coverSource', 'metacritic');
  const selected = applyGameForm(form, sources).game;
  assert.equal(selected.coverSource, 'metacritic');
  assert.equal(gameCover(selected), sources.metacritic.data.cover);
  assert.equal(toGameMeta(selected).cover, sources.metacritic.data.cover);
  assert.equal(toGameMeta(selected).coverSource, 'metacritic');

  form.set('coverSource', 'metacriticMain');
  const selectedMain = applyGameForm(form, sources).game;
  assert.equal(selectedMain.coverSource, 'metacriticMain');
  assert.equal(gameCover(selectedMain), sources.metacritic.data.mainImage);
  assert.equal(toGameMeta(selectedMain).cover, sources.metacritic.data.mainImage);
  assert.equal(gameMetaCover(toGameMeta(selectedMain)), sources.metacritic.data.mainImage);
  form.set('coverSource', 'metacritic');

  form.delete('coverSource');
  assert.equal(applyGameForm(form, selected).game.coverSource, 'metacritic');
  form.set('coverSource', '');
  assert.equal(gameCover(applyGameForm(form, selected).game), portraitUrl);

  form.set('coverSource', 'steam');
  assert.equal(gameCover(applyGameForm(form, sources).game), sources.steam.data.headerImage);
  form.set('coverSource', 'steamPortrait');
  const portrait = applyGameForm(form, sources).game;
  assert.equal(gameCover(portrait), portraitUrl);
  assert.equal(toGameMeta(portrait).cover, undefined);
  assert.equal(gameMetaCover(toGameMeta(portrait)), gameCover(portrait));
  assert.equal(toGameMeta(portrait).coverSource, 'steamPortrait');
  assert.equal(JSON.stringify(portrait).includes('library_600x900'), false);
  assert.equal(JSON.stringify(toGameMeta(portrait)).includes('library_600x900'), false);
  const unfetched = { ...game, steam: { id: 42 }, coverSource: 'steamPortrait' };
  assert.equal(gameCover(unfetched), gameCover(portrait));
  assert.equal(gameMetaCover(toGameMeta(unfetched)), gameCover(portrait));
  form.set('steam', 'none');
  const unavailablePortrait = applyGameForm(form, sources).game;
  assert.equal(gameCover(unavailablePortrait), undefined);
  assert.equal(gameMetaCover(toGameMeta(unavailablePortrait)), undefined);
  form.set('steam', String(sources.steam.id));
  form.set('coverSource', 'opencritic');
  assert.equal(gameCover(applyGameForm(form, sources).game), sources.opencritic.data.cover);
  form.set('coverSource', 'metacritic');
  form.set('metacritic', 'none');
  const unavailable = applyGameForm(form, sources).game;
  assert.equal(gameCover(unavailable), undefined);
  assert.equal(toGameMeta(unavailable).cover, undefined);
  assert.equal(toGameMeta(unavailable).coverSource, 'metacritic');
  form.set('coverSource', 'invalid');
  assert.deepEqual(applyGameForm(form, sources).errors, ['Choose a valid cover source.']);
});

test('matches mixed-case OpenCritic tiers alongside Metacritic score filters', () => {
  const meta = { title: '[PROTOTYPE®]', tier: 'Weak', oc: 50, mc: 78, mcUrl: 'https://www.metacritic.com/game/prototype/' };
  assert.equal(opencriticTier(meta), 'weak');
  assert.equal(metacriticBucket(meta), '75-89');
  assert.equal(opencriticTier({ title: 'Unrated' }), 'n/a');
});

test('deleting a game removes its title-index entries and marks it for remote deletion', async () => {
  const canonical = { ...game, key: 'rue-valley', title: 'Rue Valley', aliases: ['Rue Valley Digital Deluxe Edition'] };
  const duplicate = { ...game, key: 'rue-valley-digital-deluxe-edition', title: 'Rue Valley', aliases: ['Rue Valley Digital Deluxe Edition'] };
  const records = new Map([
    ['index:titles', JSON.stringify(buildIndex([canonical, duplicate]))],
    ['game:rue-valley', JSON.stringify(canonical)],
    ['game:rue-valley-digital-deluxe-edition', JSON.stringify(duplicate)],
    ['sync:dirty', JSON.stringify(['previous'])],
  ]);
  const kv = {
    get: async (key, type) => {
      const value = records.get(key) ?? null;
      return type === 'json' && value ? JSON.parse(value) : value;
    },
    put: async (key, value) => { records.set(key, value); },
    delete: async key => { records.delete(key); },
  };
  await deleteGame(kv, duplicate.key);
  assert.equal(records.has('game:rue-valley-digital-deluxe-edition'), false);
  assert.equal(records.has('game:rue-valley'), true);
  const index = JSON.parse(records.get('index:titles'));
  assert.deepEqual(resolveTitle(index, 'Rue Valley'), { key: canonical.key });
  assert.deepEqual(resolveTitle(index, 'Rue Valley Digital Deluxe Edition'), { key: canonical.key });
  assert.deepEqual(JSON.parse(records.get('sync:dirty')), ['previous', duplicate.key]);
});
