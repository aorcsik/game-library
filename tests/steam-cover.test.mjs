import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchSteam } from '../src/fetcher/parsers.ts';

test('Steam crawling does not need to fetch or store generated portrait artwork', async () => {
  const originalFetch = globalThis.fetch;
  const page = '<div class="apphub_AppName">Sample Game</div><img class="game_header_image_full" src="https://example.com/header.jpg">';
  const urls = [];
  try {
    globalThis.fetch = async url => {
      urls.push(url);
      assert.equal(url, 'https://store.steampowered.com/app/42');
      const response = new Response(page, { status: 200 });
      Object.defineProperty(response, 'url', { value: url });
      return response;
    };
    const result = await fetchSteam(42);
    assert.equal(result.ok, true);
    assert.equal(result.data.headerImage, 'https://example.com/header.jpg');
    assert.equal('portraitAvailable' in result.data, false);
    assert.deepEqual(urls, ['https://store.steampowered.com/app/42']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
