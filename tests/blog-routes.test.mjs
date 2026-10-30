import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { saveCreator, saveCreatorGameLink } from '../src/creators.ts';
import { saveGame } from '../src/gamedb.ts';

const bundle = await build({
  stdin: {
    contents: `
      import app, { GameRefreshQueue } from './src/index.tsx';
      export { GameRefreshQueue };
      export default { fetch: (request, env, ctx) => app.fetch(request, env, ctx) };
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, format: 'esm', platform: 'browser',
  jsx: 'automatic', jsxImportSource: 'hono', external: ['cloudflare:workers'],
});

const makeWorker = () => new Miniflare({
  workers: [{
    config: {
      name: 'blog-test', compatibilityDate: '2026-09-27',
      manifest: {
        mainModule: 'index.js',
        modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } },
      },
      exports: { GameRefreshQueue: { type: 'durable-object', storage: 'sqlite' } },
      env: {
        REFRESH_QUEUE: { type: 'durable-object', worker: 'blog-test', exportName: 'GameRefreshQueue' },
        GAMEDB: { type: 'kv', id: 'blog-games' },
        GAMES: { type: 'kv', id: 'blog-transactions' },
        GAMESTATE: { type: 'kv', id: 'blog-state' },
        CREATORS: { type: 'kv', id: 'blog-creators' },
        POSTS: { type: 'kv', id: 'blog-posts' },
        MEDIA: { type: 'r2', name: 'blog-media' },
        MEDIA_BASE_URL: { type: 'text', value: 'https://assets.example.com' },
        ADMIN_USER: { type: 'text', value: 'admin' },
        ADMIN_PASSWORD: { type: 'text', value: 'secret' },
      },
    },
  }],
});

const auth = { Authorization: `Basic ${Buffer.from('admin:secret').toString('base64')}` };
const url = path => `http://localhost${path}`;

test('only the blog is public; the library and post admin require authentication', async () => {
  const mf = makeWorker();
  try {
    for (const path of ['/', '/post/2026-01-01-missing']) {
      const response = await mf.dispatchFetch(url(path));
      assert.notEqual(response.status, 401, path);
      await response.arrayBuffer();
    }
    for (const path of ['/transactions', '/games', '/creators', '/posts', '/posts/new', '/posts/aaaaaaaaaa/preview', '/export.json']) {
      const response = await mf.dispatchFetch(url(path));
      assert.equal(response.status, 401, path);
      await response.arrayBuffer();
    }
    const create = await mf.dispatchFetch(url('/posts'), {
      method: 'POST', headers: { Origin: 'http://localhost' }, body: new URLSearchParams({ title: 'x', body: 'y' }),
    });
    assert.equal(create.status, 401);
  } finally {
    await mf.dispose();
  }
});

test('publishes posts to the public blog without drafts or library links', async () => {
  const mf = makeWorker();
  const post = (path, data) => mf.dispatchFetch(url(path), {
    method: 'POST', headers: { ...auth, Origin: 'http://localhost' }, body: new URLSearchParams(data), redirect: 'manual',
  });
  try {
    const today = new Date().toISOString().slice(0, 10);
    const created = await post('/posts', { title: 'Hello World', body: '## Hi <b>x</b> [bad](javascript:alert) [ok](https://example.com)', published: 'on' });
    assert.equal(created.status, 303);
    assert.match(created.headers.get('Location'), /^\/posts\/[0-9a-f]{10}\?saved=1$/);
    const draftSave = await post('/posts', { title: 'Secret Draft', body: 'hidden' });
    assert.equal(draftSave.status, 303);
    const draftId = draftSave.headers.get('Location').match(/\/posts\/([0-9a-f]{10})/)[1];

    // Publishing a second post with the same slug on the same day is refused, with an explanation.
    const clash = await post('/posts', { title: 'Hello World', body: 'dupe', published: 'on' });
    assert.equal(clash.status, 422);
    assert.match(await clash.text(), /already published on \d{4}-\d{2}-\d{2} with the slug &quot;hello-world&quot;/);
    // The same slug on another day, or as a draft, is fine.
    assert.equal((await post('/posts', { title: 'Hello World', body: 'older', published: 'on', date: '2020-01-01' })).status, 303);
    assert.equal((await post('/posts', { title: 'Hello World', body: 'draft' })).status, 303);

    const index = await (await mf.dispatchFetch(url('/'))).text();
    assert.match(index, /aōrora ludens/);
    assert.match(index, new RegExp(`href="/post/${today}-hello-world"`));
    assert.match(index, /href="\/post\/2020-01-01-hello-world"/);
    assert.doesNotMatch(index, /Secret Draft/);

    const article = await (await mf.dispatchFetch(url(`/post/${today}-hello-world`))).text();
    assert.match(article, /&lt;b&gt;x&lt;\/b&gt;/);
    assert.doesNotMatch(article, /href="javascript:/);
    assert.match(article, /href="https:\/\/example\.com"/);
    for (const html of [index, article]) assert.doesNotMatch(html, /href="\/(transactions|games|creators|posts|export)/);
    const older = await (await mf.dispatchFetch(url('/post/2020-01-01-hello-world'))).text();
    assert.match(older, /older/);

    for (const path of [`/post/${today}-secret-draft`, '/post/2020-01-02-hello-world']) {
      const missing = await mf.dispatchFetch(url(path));
      assert.equal(missing.status, 404, path);
      await missing.arrayBuffer();
    }
    // The old URL shape and malformed paths are not blog routes, so they fall behind authentication.
    for (const path of [`/post/${today}`, '/blog/hello-world']) {
      const response = await mf.dispatchFetch(url(path));
      assert.equal(response.status, 401, path);
      await response.arrayBuffer();
    }
    const preview = await mf.dispatchFetch(url(`/posts/${draftId}/preview`), { headers: auth });
    assert.equal(preview.status, 200);
    await preview.arrayBuffer();

    // Editing keeps the identity; moving the date changes the public URL.
    const edit = await post(`/posts/${draftId}`, { title: 'Secret Draft', body: 'now public', published: 'on', date: '2021-02-03' });
    assert.equal(edit.status, 303);
    assert.equal((await mf.dispatchFetch(url('/post/2021-02-03-secret-draft'))).status, 200);
    const stored = await (await mf.dispatchFetch(url(`/posts/${draftId}`), { headers: auth })).text();
    assert.match(stored, /href="\/post\/2021-02-03-secret-draft"/);
  } finally {
    await mf.dispose();
  }
});

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const upload = (mf, bytes, headers = auth) => {
  const boundary = 'test-boundary';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="pic.png"\r\nContent-Type: image/png\r\n\r\n`),
    Buffer.from(bytes),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return mf.dispatchFetch(url('/media'), {
    method: 'POST', body,
    headers: { ...headers, Origin: 'http://localhost', 'Content-Type': `multipart/form-data; boundary=${boundary}` },
  });
};

test('uploads images behind auth, validates content, serves them publicly, and renders on the media domain', async () => {
  const mf = makeWorker();
  try {
    const anonymous = await upload(mf, PNG, {});
    assert.equal(anonymous.status, 401);
    await anonymous.arrayBuffer();

    const fake = await upload(mf, new TextEncoder().encode('<svg onload=alert(1)>'));
    assert.equal(fake.status, 415);
    await fake.arrayBuffer();

    const created = await upload(mf, PNG);
    assert.equal(created.status, 201);
    const { url: path } = await created.json();
    assert.match(path, /^\/media\/blog\/[0-9a-f]{32}\.png$/);

    const served = await mf.dispatchFetch(url(path));
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('Content-Type'), 'image/png');
    assert.match(served.headers.get('Cache-Control'), /immutable/);
    assert.deepEqual(new Uint8Array(await served.arrayBuffer()), PNG);
    const missing = await mf.dispatchFetch(url('/media/blog/../../etc'));
    assert.notEqual(missing.status, 200);
    await missing.arrayBuffer();

    const save = await mf.dispatchFetch(url('/posts'), {
      method: 'POST', headers: { ...auth, Origin: 'http://localhost' }, redirect: 'manual',
      body: new URLSearchParams({ title: 'Pics', body: `![pic](${path})`, published: 'on' }),
    });
    assert.equal(save.status, 303);
    const article = await (await mf.dispatchFetch(url(`/post/${new Date().toISOString().slice(0, 10)}-pics`))).text();
    assert.match(article, new RegExp(`src="https://assets\\.example\\.com/blog/[0-9a-f]{32}\\.png"`));
  } finally {
    await mf.dispose();
  }
});

test('keeps uploaded-but-unused images attached to a post and maps them on the media page', async () => {
  const mf = makeWorker();
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  try {
    const keys = [];
    for (const bytes of [PNG, jpeg, Uint8Array.from([...PNG, 1])]) {
      const response = await upload(mf, bytes);
      assert.equal(response.status, 201);
      keys.push((await response.json()).key);
    }
    const [used, spare, loose] = keys;

    const body = new URLSearchParams({ title: 'Gallery', body: `![a](/media/${used})` });
    body.append('images', used);
    body.append('images', spare);
    const save = await mf.dispatchFetch(url('/posts'), {
      method: 'POST', headers: { ...auth, Origin: 'http://localhost' }, redirect: 'manual', body,
    });
    assert.equal(save.status, 303);
    const galleryUrl = save.headers.get('Location').split('?')[0];

    const editor = await (await mf.dispatchFetch(url(galleryUrl), { headers: auth })).text();
    assert.equal([...editor.matchAll(/name="images" value="([^"]+)"/g)].length, 2);
    assert.ok(editor.includes(`value="${spare}"`));

    const page = await (await mf.dispatchFetch(url('/media'), { headers: auth })).text();
    // Columns: thumb, file, uploaded, size, used in, attached but not used.
    const cells = key => page.split('<tr>').find(html => html.includes(key)).split('<td').slice(1);
    assert.match(cells(used)[4], /Gallery/);
    assert.doesNotMatch(cells(used)[5], /Gallery/);
    assert.doesNotMatch(cells(spare)[4], /Gallery/);
    assert.match(cells(spare)[5], /Gallery/);
    assert.match(cells(loose)[5], /unreferenced/);
    assert.match(cells(loose)[1], /pic\.png/);

    const anonymous = await mf.dispatchFetch(url('/media'));
    assert.equal(anonymous.status, 401);
    await anonymous.arrayBuffer();

    const bad = new URLSearchParams({ title: 'Bad', body: 'x' });
    bad.append('images', '../secret');
    const rejected = await mf.dispatchFetch(url('/posts'), { method: 'POST', headers: { ...auth, Origin: 'http://localhost' }, body: bad });
    assert.equal(rejected.status, 422);
    await rejected.arrayBuffer();
  } finally {
    await mf.dispose();
  }
});

test('embeds game cards where the markdown asks, without exposing the library', async () => {
  const mf = makeWorker();
  const today = new Date().toISOString().slice(0, 10);
  const post = (path, data) => mf.dispatchFetch(url(path), {
    method: 'POST', headers: { ...auth, Origin: 'http://localhost' }, body: new URLSearchParams(data), redirect: 'manual',
  });
  try {
    const games = await mf.getKVNamespace('GAMEDB');
    await saveGame(games, {
      key: 'signalis', title: 'Signalis', updatedAt: '2026-01-01', manualGenres: ['Horror'],
      releaseDate: '2022-10-27',
      steam: { id: 1262350, data: { title: 'Signalis', description: 'A survival horror.\nSecond line <b>kept as text</b>.', genres: [], releaseDate: null, reviewScore: 8, reviewScoreDescription: null, reviewScoreTooltip: null, headerImage: null, developers: ['Rose-engine', 'Miscredited Co'], publishers: ['Humble Games'] } },
      opencritic: { id: '13085/signalis', data: { title: 'Signalis', cover: null, tier: 'Mighty', score: 87, critics: 90, releaseDate: null } },
    });
    const creatorsKv = await mf.getKVNamespace('CREATORS');
    await saveCreator(creatorsKv, 'rose-engine', { name: 'Rose-engine', aliases: [], url: 'https://rose-engine.example' });
    await saveCreator(creatorsKv, 'humble-games', { name: 'Humble Games', aliases: [] });
    await saveCreator(creatorsKv, 'miscredited-co', { name: 'Miscredited Co', aliases: [], url: 'https://miscredited.example' });
    await saveCreatorGameLink(creatorsKv, 'signalis', 'miscredited-co', { miscredit: true });

    const anonymousSearch = await mf.dispatchFetch(url('/posts/games?q=sig'));
    assert.equal(anonymousSearch.status, 401);
    await anonymousSearch.arrayBuffer();
    const found = await (await mf.dispatchFetch(url('/posts/games?q=SIGN'), { headers: auth })).json();
    assert.deepEqual(found, [{ key: 'signalis', title: 'Signalis', year: '2022' }]);

    const body = 'Before\n\n![game:signalis]\n\nAfter\n\n![game:does-not-exist]';
    const saved = await post('/posts', { title: 'Cards', body, published: 'on' });
    assert.equal(saved.status, 303);

    const html = await (await mf.dispatchFetch(url(`/post/${today}-cards`))).text();
    assert.ok(html.indexOf('Before') < html.indexOf('game-card') && html.indexOf('game-card') < html.indexOf('After'), 'card renders in place');
    assert.match(html, /Signalis/);
    assert.match(html, /<span title="2022-10-27">2022<\/span> • Horror/);
    assert.match(html, /Developers: <a href="https:\/\/rose-engine\.example" target="_blank" rel="noopener noreferrer">Rose-engine<\/a>/);
    assert.match(html, /Publishers: Humble Games(?!<\/a>)/);
    assert.doesNotMatch(html, /Miscredited Co|miscredited\.example/);
    assert.match(html, /<p class="game-card-description" data-card-description="true">A survival horror\. Second line &lt;b&gt;kept as text&lt;\/b&gt;\.<\/p>/);
    assert.ok(html.indexOf('game-card-description') < html.indexOf('Developers:'), 'credits come after the description');
    assert.match(html, /<small class="game-release-genres">Developers: /);
    assert.match(html, /<script type="module" src="\/assets\/blog\.js"><\/script>/);
    assert.match(html, /open-critic-container tier-mighty/);
    assert.match(html, /<span class="open-critic-score">87<\/span>/);
    assert.match(html, /steam-review positive/);
    assert.match(html, /href="https:\/\/opencritic\.com\/game\/13085\/signalis"/);
    assert.match(html, /href="https:\/\/store\.steampowered\.com\/app\/1262350"/);
    assert.match(html, /library_600x900\.jpg/);
    assert.doesNotMatch(html, /Unknown game|does-not-exist/);
    assert.doesNotMatch(html, /href="\/(transactions|games|creators|posts|export)/);

    const id = saved.headers.get('Location').match(/\/posts\/([0-9a-f]{10})/)[1];
    const preview = await (await mf.dispatchFetch(url(`/posts/${id}/preview`), { headers: auth })).text();
    assert.match(preview, /Unknown game: does-not-exist/);
  } finally {
    await mf.dispose();
  }
});
