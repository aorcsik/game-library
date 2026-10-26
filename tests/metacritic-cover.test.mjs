import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stringify } from 'devalue';
import { fetchMetacritic } from '../src/fetcher/parsers.ts';

test('extracts a game image from Metacritic rather than video or related-game artwork', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const game = {
      type: 'game-title', title: 'Sample Game', criticScoreSummary: { score: 86 },
      images: [
        { typeName: 'mainImage', bucketType: 'catalog', bucketPath: '/provider/6/main.jpg' },
        { typeName: 'cardImage', bucketType: 'catalog', bucketPath: '/provider/6/card.jpg' },
      ],
    };
    globalThis.fetch = async () => new Response(`<html><script data-nuxt-data="nuxt-app">${stringify({ game })}</script></html>`);
    const result = await fetchMetacritic('https://www.metacritic.com/game/sample-game/');
    assert.equal(result.ok, true);
    assert.equal(result.data.cover, 'https://www.metacritic.com/a/img/catalog/provider/6/card.jpg');
    assert.equal(result.data.mainImage, 'https://www.metacritic.com/a/img/catalog/provider/6/main.jpg');

    game.images = [{ typeName: 'mainImage', bucketType: 'catalog', bucketPath: '/provider/6/main.jpg' }];
    const fallback = await fetchMetacritic('https://www.metacritic.com/game/sample-game/');
    assert.equal(fallback.ok, true);
    assert.equal(fallback.data.cover, 'https://www.metacritic.com/a/img/catalog/provider/6/main.jpg');
    assert.equal(fallback.data.mainImage, fallback.data.cover);

    game.images = [
      { typeName: 'cardImage', bucketType: 'catalog', bucketPath: '/provider/../other.jpg' },
      { typeName: 'mainImage', bucketType: 'catalog', bucketPath: '/provider/6/main.jpg' },
    ];
    const invalid = await fetchMetacritic('https://www.metacritic.com/game/sample-game/');
    assert.equal(invalid.ok, true);
    assert.equal(invalid.data.cover, 'https://www.metacritic.com/a/img/catalog/provider/6/main.jpg');
    assert.equal(invalid.data.mainImage, invalid.data.cover);
    game.images = [{ typeName: 'cardImage', bucketType: 'catalog', bucketPath: '/provider/../other.jpg' }];
    const noImage = await fetchMetacritic('https://www.metacritic.com/game/sample-game/');
    assert.equal(noImage.ok, true);
    assert.equal(noImage.data.cover, null);
    assert.equal(noImage.data.mainImage, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
