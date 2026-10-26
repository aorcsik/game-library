import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCreatorIndex, creatorLinks, creatorLinksForRole, creatorSearchNames, creatorVerificationProgress, gameCreatorCredits, listCreators, newCreatorKey, normalizeCreator, resolveCreator, validateCreator,
} from '../src/creators.ts';

const existing = [{ key: 'radical', name: 'Radical Entertainment', aliases: ['Radical Ent.'], aka: ['Activision Vancouver'], url: 'https://example.com' }];

test('matches canonical names and source aliases without losing Unicode names', () => {
  const index = buildCreatorIndex([...existing, { key: 'jp', name: '株式会社ゲーム', aliases: [] }]);
  assert.equal(resolveCreator(index, ' RADICAL ENT '), 'radical');
  assert.equal(resolveCreator(index, 'Radical Entertainment'), 'radical');
  assert.equal(resolveCreator(index, 'activision vancouver'), 'radical');
  assert.equal(index.get(normalizeCreator('Radical Ent.')).aka, false);
  assert.equal(index.get(normalizeCreator('Activision Vancouver')).aka, true);
  assert.deepEqual(creatorSearchNames(['Activision Vancouver'], index), ['Activision Vancouver', 'Radical Entertainment']);
  assert.equal(resolveCreator(index, '株式会社ゲーム'), 'jp');
  assert.equal(resolveCreator(index, 'Unknown'), undefined);
  assert.equal(normalizeCreator('Café Studio'), normalizeCreator('Cafe Studio'));
});

test('displays each identity once, preferring a.k.a. over canonical and alias mentions', () => {
  const index = buildCreatorIndex(existing);
  assert.deepEqual(creatorLinks(['Activision Vancouver'], index), [{ name: 'Activision Vancouver', key: 'radical' }]);
  assert.deepEqual(creatorLinks(['Radical Ent.'], index), [{ name: 'Radical Entertainment', key: 'radical' }]);
  assert.deepEqual(creatorLinks(['Activision Vancouver', 'Radical Entertainment'], index), [{ name: 'Activision Vancouver', key: 'radical' }]);
  assert.deepEqual(creatorLinks(['Radical Entertainment', 'Activision Vancouver'], index), [{ name: 'Activision Vancouver', key: 'radical' }]);
  assert.deepEqual(creatorLinks(['Radical Ent.', 'Activision Vancouver'], index), [{ name: 'Activision Vancouver', key: 'radical' }]);
  assert.deepEqual(creatorLinks(['Activision Vancouver', 'Radical Ent.'], index), [{ name: 'Activision Vancouver', key: 'radical' }]);
  assert.deepEqual(creatorLinks(['Activision Vancouver', 'Unknown', 'Radical Ent.', 'unknown'], index), [
    { name: 'Activision Vancouver', key: 'radical' },
    { name: 'Unknown' },
  ]);
  const multipleAkas = buildCreatorIndex([{ ...existing[0], aka: ['Activision Vancouver', 'Other Identity'] }]);
  assert.deepEqual(creatorLinks(['Other Identity', 'Radical Entertainment', 'Activision Vancouver'], multipleAkas), [
    { name: 'Other Identity', key: 'radical' },
  ]);
});

test('splits list-shaped credits only when every contributor has a creator identity', () => {
  const contributors = [
    { key: 'franek', name: 'Franek', aliases: [] },
    { key: 'max', name: 'Max Cahill', aliases: [] },
    { key: 'bibiki', name: 'Bibiki', aliases: [] },
    { key: 'antonio', name: 'Antonio Uribe', aliases: [], aka: ['Fáyer'] },
  ];
  const index = buildCreatorIndex(contributors);
  const combined = 'Max Cahill, Franek, Bibiki, and Antonio Uribe';
  assert.deepEqual(creatorLinks(['Franek', 'Max Cahill', 'Bibiki', 'Fáyer', combined], index), [
    { key: 'franek', name: 'Franek' },
    { key: 'max', name: 'Max Cahill' },
    { key: 'bibiki', name: 'Bibiki' },
    { key: 'antonio', name: 'Fáyer' },
  ]);
  assert.deepEqual(creatorLinks([combined], index), [
    { key: 'max', name: 'Max Cahill' },
    { key: 'franek', name: 'Franek' },
    { key: 'bibiki', name: 'Bibiki' },
    { key: 'antonio', name: 'Antonio Uribe' },
  ]);
  assert.deepEqual(creatorSearchNames(['Franek and Fáyer'], index), ['Franek and Fáyer', 'Franek', 'Antonio Uribe']);
  assert.deepEqual(creatorLinks(['Franek and Unlisted'], index), [{ name: 'Franek and Unlisted' }]);
  assert.deepEqual(creatorLinks([combined], buildCreatorIndex(contributors.slice(0, 3))), [{ name: combined }]);
  const company = 'Franek and Max Cahill';
  assert.deepEqual(creatorLinks([company], buildCreatorIndex([...contributors, { key: 'company', name: company, aliases: [] }])), [{ key: 'company', name: company }]);
  assert.deepEqual(creatorLinks(['Franek, Inc.'], index), [{ name: 'Franek, Inc.' }]);
  const publishers = buildCreatorIndex([
    { key: 'fellow-traveller', name: 'Fellow Traveller', aliases: [] },
    { key: 'limited-run-games', name: 'Limited Run Games', aliases: [] },
  ]);
  const combinedPublishers = 'Fellow Traveller, Limited Run Games';
  assert.deepEqual(creatorLinks(['Fellow Traveller', combinedPublishers], publishers), [
    { name: 'Fellow Traveller', key: 'fellow-traveller' },
    { name: 'Limited Run Games', key: 'limited-run-games' },
  ]);
  assert.deepEqual(creatorLinks([combinedPublishers], buildCreatorIndex([
    { key: 'fellow-traveller', name: 'Fellow Traveller', aliases: [] },
  ])), [{ name: combinedPublishers }]);
  assert.deepEqual(creatorLinks([combinedPublishers], buildCreatorIndex([
    { key: 'fellow-traveller', name: 'Fellow Traveller', aliases: [] },
    { key: 'limited-run-games', name: 'Limited Run Games', aliases: [] },
    { key: 'collective', name: combinedPublishers, aliases: [] },
  ])), [{ name: combinedPublishers, key: 'collective' }]);
  const companies = buildCreatorIndex([
    { key: 'acme', name: 'Acme', aliases: [] },
    { key: 'inc', name: 'Inc.', aliases: [] },
    { key: 'ltd', name: 'Ltd', aliases: [] },
    { key: 'acme-inc', name: 'Acme, Inc.', aliases: [] },
    { key: 'acme-co-ltd', name: 'Acme, Co., Ltd.', aliases: [] },
    { key: 'other', name: 'Other Studio', aliases: [] },
  ]);
  assert.deepEqual(creatorLinks(['Acme, Inc.'], companies), [{ name: 'Acme, Inc.', key: 'acme-inc' }]);
  assert.deepEqual(creatorLinks(['Acme, Ltd'], companies), [{ name: 'Acme, Ltd' }]);
  assert.deepEqual(creatorLinks(['Acme, Inc., Other Studio'], companies), [
    { name: 'Acme, Inc.', key: 'acme-inc' },
    { name: 'Other Studio', key: 'other' },
  ]);
  assert.deepEqual(creatorLinks(['Acme, Co., Ltd., Other Studio'], companies), [
    { name: 'Acme, Co., Ltd.', key: 'acme-co-ltd' },
    { name: 'Other Studio', key: 'other' },
  ]);
});

test('resolves ampersand-separated credits without splitting a named collective or incomplete match', () => {
  const people = [
    { key: 'rudolf-kremers', name: 'Rudolf Kremers', aliases: [] },
    { key: 'alex-may', name: 'Alex May', aliases: [] },
  ];
  const index = buildCreatorIndex(people);
  const combined = 'Rudolf Kremers & Alex May';
  const credits = [
    { name: 'Rudolf Kremers', key: 'rudolf-kremers' },
    { name: 'Alex May', key: 'alex-may' },
  ];
  assert.deepEqual(creatorLinks([combined], index), credits);
  assert.deepEqual(creatorLinks(['Rudolf Kremers, & Alex May'], index), credits);
  assert.deepEqual(creatorSearchNames([combined], index), [combined, ...people.map(person => person.name)]);
  assert.deepEqual(creatorVerificationProgress([{ developers: [combined] }], index), { verified: 2, total: 2 });
  assert.deepEqual(gameCreatorCredits({
    steam: { data: { developers: [combined] } },
    opencritic: { data: { creators: ['Rudolf Kremers', 'Alex May'] } },
  }, index), { developers: credits, publishers: [], creators: [] });
  assert.deepEqual(creatorLinks([combined], buildCreatorIndex(people.slice(0, 1))), [{ name: combined }]);
  assert.deepEqual(creatorLinks([combined], buildCreatorIndex([
    ...people, { key: 'collective', name: combined, aliases: [] },
  ])), [{ name: combined, key: 'collective' }]);
  assert.deepEqual(creatorLinks(['Rock & Roll'], index), [{ name: 'Rock & Roll' }]);
});

test('infers developer and publisher roles per game and leaves OpenCritic-only names unassigned', () => {
  const index = buildCreatorIndex([
    ...existing,
    { key: 'publisher', name: 'Panic', aliases: ['Panic Inc.'] },
    { key: 'only-oc', name: 'OpenCritic Studio', aliases: [] },
  ]);
  const credits = gameCreatorCredits({
    steam: { data: { developers: ['Activision Vancouver', 'Radical Ent.'], publishers: ['Panic'] } },
    metacritic: { data: { developers: ['Radical Entertainment'], publisher: 'Panic Inc.' } },
    opencritic: { data: { creators: ['Panic Inc.', 'Radical Ent.', 'OpenCritic Studio', 'Unknown Studio'] } },
  }, index);
  assert.deepEqual(credits, {
    developers: [{ name: 'Activision Vancouver', key: 'radical' }],
    publishers: [{ name: 'Panic', key: 'publisher' }],
    creators: [{ name: 'OpenCritic Studio', key: 'only-oc' }, { name: 'Unknown Studio' }],
  });
  const both = gameCreatorCredits({
    steam: { data: { developers: ['Radical Entertainment'], publishers: ['Activision Vancouver'] } },
    opencritic: { data: { creators: ['Activision Vancouver'] } },
  }, index);
  assert.deepEqual(both.developers, [{ name: 'Radical Entertainment', key: 'radical' }]);
  assert.deepEqual(both.publishers, [{ name: 'Activision Vancouver', key: 'radical' }]);
  assert.deepEqual(both.creators, []);
});

test('manual credits link to the same creators and roles as fetched credits', () => {
  const index = buildCreatorIndex([
    { key: 'studio', name: 'Example Studio', aliases: ['Studio Alias'] },
    { key: 'publisher', name: 'Example Publisher', aliases: [] },
    { key: 'oc-only', name: 'OpenCritic Only', aliases: [] },
  ]);
  assert.deepEqual(gameCreatorCredits({
    manualDevelopers: ['Studio Alias', 'Unlisted Studio'],
    manualPublishers: ['Example Publisher', 'Unlisted Publisher'],
    opencritic: { data: { creators: ['Example Studio', 'Example Publisher', 'OpenCritic Only'] } },
  }, index), {
    developers: [{ name: 'Example Studio', key: 'studio' }, { name: 'Unlisted Studio' }],
    publishers: [{ name: 'Example Publisher', key: 'publisher' }, { name: 'Unlisted Publisher' }],
    creators: [{ name: 'OpenCritic Only', key: 'oc-only' }],
  });
});

test('counts distinct developer and publisher credit names once across games and roles', () => {
  const index = buildCreatorIndex([
    { key: 'franek', name: 'Franek', aliases: [] },
    { key: 'bibiki', name: 'Bibiki', aliases: [] },
    { key: 'stormteller', name: 'Stormteller Games', aliases: ['Thunderful'], aka: ['Thunderful Development'] },
    { key: 'publishing', name: 'Thunderful Publishing', aliases: [] },
  ]);
  assert.deepEqual(creatorVerificationProgress([], index), { verified: 0, total: 0 });
  assert.deepEqual(creatorVerificationProgress([
    { developers: ['Franek', 'Franek', 'Unknown Studio', 'Thunderful', 'Franek, Bibiki'],
      publishers: ['Thunderful', 'Unknown Publisher'] },
    { developers: ['FRANEK', 'Franek, Unknown Studio', 'Stormteller Games', 'Thunderful Development'], publishers: ['Thunderful'] },
    {},
  ], index), { verified: 5, total: 8 });
});

test('applies Thunderful substitutions by role before matching without rewriting OpenCritic credits', () => {
  const index = buildCreatorIndex([
    { key: 'stormteller', name: 'Stormteller Games', aliases: ['Thunderful'], aka: ['Thunderful Development'] },
    { key: 'publishing', name: 'Thunderful Publishing', aliases: [] },
    { key: 'other', name: 'Other Publisher', aliases: [] },
  ]);
  const game = {
    steam: { data: { developers: ['Thunderful'], publishers: ['Thunderful'] } },
    metacritic: { data: { developers: ['Thunderful'], publisher: 'Thunderful, Other Publisher' } },
    opencritic: { data: { creators: ['Thunderful'] } },
  };
  assert.deepEqual(gameCreatorCredits(game, index), {
    developers: [{ name: 'Thunderful Development', key: 'stormteller' }],
    publishers: [{ name: 'Thunderful Publishing', key: 'publishing' }, { name: 'Other Publisher', key: 'other' }],
    creators: [],
  });
  assert.deepEqual(creatorLinksForRole(['Thunderful'], 'publisher', index), [{ name: 'Thunderful Publishing', key: 'publishing' }]);
  assert.deepEqual(creatorLinks(['Thunderful'], index), [{ name: 'Stormteller Games', key: 'stormteller' }]);
  assert.deepEqual(creatorSearchNames(['Thunderful'], index, 'publisher'), ['Thunderful', 'Thunderful Publishing']);
  assert.deepEqual(creatorLinksForRole(['Thunderful Games'], 'developer', index), [{ name: 'Thunderful Games' }]);
  assert.deepEqual(gameCreatorCredits({ opencritic: { data: { creators: ['Thunderful'] } } }, index).creators,
    [{ name: 'Stormteller Games', key: 'stormteller' }]);
  const unresolved = gameCreatorCredits({
    metacritic: { data: { publisher: 'Unmatched Company, Thunderful' } },
    opencritic: { data: { creators: ['Thunderful'] } },
  }, index);
  assert.deepEqual(unresolved.publishers, [{ name: 'Unmatched Company, Thunderful Publishing' }]);
  assert.deepEqual(unresolved.creators, []);
  assert.deepEqual(creatorLinksForRole(['Thunderful, Inc.'], 'publisher', index), [{ name: 'Thunderful, Inc.' }]);
});

test('rejects overlapping aliases and unsafe URLs without changing existing records', () => {
  const collision = validateCreator({ name: 'Another Studio', aliases: 'radical ent.\nAlternate', aka: 'Activision Vancouver', url: '', parent: '' }, existing);
  assert.equal(collision.creator, undefined);
  assert.match(collision.errors.join(' '), /already belongs/);
  const invalid = validateCreator({ name: 'Radical Entertainment', aliases: 'Radical Entertainment', aka: 'Radical Ent.', url: 'javascript:alert(1)', parent: '' }, existing, 'radical');
  assert.equal(invalid.creator, undefined);
  assert.match(invalid.errors.join(' '), /distinct/);
  assert.match(invalid.errors.join(' '), /HTTP or HTTPS/);
  const updated = validateCreator({ name: 'Radical Entertainment', aliases: 'Radical Ent.\nAnother name', aka: 'Activision Vancouver', url: 'https://example.com', parent: '' }, existing, 'radical');
  assert.deepEqual(updated.errors, []);
  assert.deepEqual(updated.creator?.aliases, ['Radical Ent.', 'Another name']);
  assert.deepEqual(updated.creator?.aka, ['Activision Vancouver']);
});

test('accepts existing parents and rejects missing, self, and cyclic references', () => {
  const hierarchy = [
    { key: 'root', name: 'Root', aliases: [] },
    { key: 'middle', name: 'Middle', aliases: [], parent: 'root' },
    { key: 'leaf', name: 'Leaf', aliases: [], parent: 'middle' },
  ];
  const draft = { name: 'New Studio', aliases: '', aka: '', url: '', parent: 'root' };
  assert.equal(validateCreator(draft, hierarchy).creator?.parent, 'root');
  assert.match(validateCreator({ ...draft, parent: 'missing' }, hierarchy).errors.join(' '), /does not exist/);
  assert.match(validateCreator({ ...draft, name: 'Root' }, hierarchy, 'root').errors.join(' '), /cycle/);
  assert.match(validateCreator({ ...draft, name: 'Root', parent: 'leaf' }, hierarchy, 'root').errors.join(' '), /cycle/);
  assert.equal(validateCreator({ ...draft, name: 'Leaf' }, hierarchy, 'leaf').creator?.parent, 'root');
  assert.equal(validateCreator({ ...draft, name: 'Leaf', parent: '' }, hierarchy, 'leaf').creator?.parent, undefined);
});

test('paginates existing creator records and chooses unused, routable keys', async () => {
  const records = new Map([
    ['developer:radical', { name: 'Radical Entertainment', aliases: ['Radical Ent.'] }],
    ['developer:radical-entertainment', { name: 'Other', aliases: [] }],
  ]);
  const kv = {
    list: async ({ cursor }) => cursor
      ? { keys: [{ name: 'developer:radical-entertainment' }], list_complete: true }
      : { keys: [{ name: 'developer:radical' }], list_complete: false, cursor: 'next' },
    get: async keys => Array.isArray(keys)
      ? new Map(keys.map(key => [key, records.get(key)]))
      : records.has(keys) ? JSON.stringify(records.get(keys)) : null,
  };
  assert.deepEqual(await listCreators(kv), [
    { key: 'radical', name: 'Radical Entertainment', aliases: ['Radical Ent.'] },
    { key: 'radical-entertainment', name: 'Other', aliases: [] },
  ]);
  assert.equal(await newCreatorKey(kv, 'Radical Entertainment'), 'radical-entertainment-2');
  assert.equal(await newCreatorKey(kv, 'New'), 'creator-new');
});
