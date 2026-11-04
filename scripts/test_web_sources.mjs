import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {DOMParser} from 'linkedom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const index = JSON.parse(readFileSync(join(root, 'repository.json'), 'utf8'));
const providers = [
  {id: 'mangakatana', origin: 'https://mangakatana.com', book: '/manga/example.123',
    chapters: ['/manga/example.123/c1', '/manga/example.123/c2'],
    image: 'https://i1.mangakatana.com/token/example/0.jpg', query: 'solo login'},
];

for (const provider of providers) {
  const manifest = JSON.parse(readFileSync(join(root, 'extensions', provider.id, 'repository.json'))).extensions[0];
  assert(index.extensions.some(item => item.id === manifest.id && item.sha256 === manifest.sha256));
  const code = readFileSync(join(root, 'extensions', provider.id, 'dist', basename(new URL(manifest.script).pathname)), 'utf8');
  assert.equal(createHash('sha256').update(code).digest('hex'), manifest.sha256);
  const invoke = new AsyncFunction('operation', 'input', 'api', 'DOMParser', code + '\nreturn JSON.stringify(await source[operation](input, api));');
  const html = body => '<html><head><title>Search Manga - ' + provider.id + '</title></head><body>' + body + '</body></html>';
  function card(genre = 'Adventure', suffix = '') {
    return `<div class="item"><div class="wrap_img"><img src="${provider.image}"></div><h3 class="title"><a href="${provider.book}${suffix}">Example${suffix}</a></h3><div class="genres"><a>${genre}</a></div><div class="summary">Summary</div></div>`;
  }
  const search = html('<section id="book_list">' + card() + card('Smut', '-blocked') + '</section>');
  function detail(genre = 'Adventure', links = provider.chapters) {
    const chapters = [...links].reverse().map((href, i) => `<a href="${href}">Chapter ${links.length - i}</a>`).join('');
    return html(`<link rel="canonical" href="${provider.origin + provider.book}"><div id="single_book"><h1>Example</h1><div class="authors"><a>Creator</a></div><div class="cover"><img src="${provider.image}"></div><div class="genres"><a>${genre}</a></div><div class="chapters">${chapters}</div></div>`);
  }
  function page(image = provider.image) {
    return html(`<script>var thzq=['${image}',]; globalThis.websiteScriptExecuted = true;</script>`);
  }
  const api = handler => ({request: async value => {
    const url = new URL(value);
    assert.equal(url.origin, provider.origin);
    const text = await handler(url);
    return {text, json: () => JSON.parse(text)};
  }});
  const call = async (operation, input, handler) => JSON.parse(await invoke(operation, input, api(handler), DOMParser));
  const titles = await call('search', {query: 'a&genre=Adult'}, url => {
    assert.equal(url.searchParams.get('search'), 'a&genre=Adult');
    return search;
  });
  assert.equal(titles.length, 1);
  assert.equal(titles[0].id, provider.book);
  assert.equal(titles[0].genre, 'Adventure');
  const direct = await call('search', {query: 'exact match'}, () => detail());
  assert.equal(direct[0].id, provider.book);
  assert.equal(direct[0].author, 'Creator');
  const noGenres = await call('search', {query: ''}, () => html('<section id="book_list">' + card('') + '</section>'));
  assert.equal(noGenres.length, 0);
  const chapters = await call('chapters', {mangaID: provider.book}, () => detail());
  assert.deepEqual(chapters.map(item => item.id), provider.chapters);
  const extras = [provider.book + '/c1', provider.book + '/c1.5', provider.book + '/c1.5.1', provider.book + '/c2', provider.book + '/c10'];
  const sorted = await call('chapters', {mangaID: provider.book}, () => detail('Adventure', extras));
  assert.deepEqual(sorted.map(item => item.id), extras);
  assert(chapters.every(item => item.credit.includes(manifest.name.split(' · ')[0])));
  const pages = await call('pages', {mangaID: provider.book, chapterID: provider.chapters[0]}, url => url.pathname === provider.book ? detail() : page());
  assert.deepEqual(pages, [provider.image]);
  assert.equal(globalThis.websiteScriptExecuted, undefined, 'Website JavaScript must never run');
  await assert.rejects(call('chapters', {mangaID: provider.book}, () => detail('Adult')), /content filter/);
  await assert.rejects(call('pages', {mangaID: provider.book, chapterID: provider.chapters[0]}, url => url.pathname === provider.book ? detail() : page('https://evil.org/page.jpg')), /outside this source/);
  await assert.rejects(call('search', {query: ''}, () => '<html><title>Just a moment...</title></html>'), /browser check/);
  await assert.rejects(call('chapters', {mangaID: provider.book}, () => detail('Adventure', [])), /No readable chapters/);
  await assert.rejects(call('pages', {mangaID: provider.book, chapterID: 'https://evil.org/chapter'}, () => assert.fail('Must not request invalid links')), /Invalid/);
  {
    await assert.rejects(call('pages', {mangaID: provider.book, chapterID: provider.chapters[0]}, url => url.pathname === provider.book
      ? detail() : html(`<script>var thzq=['${provider.image}', (globalThis.websiteScriptExecuted=true)];</script>`)), /unsupported page-list/);
    assert.equal(globalThis.websiteScriptExecuted, undefined);
  }
  console.log('PASS: ' + manifest.name + ': DOM parsing, filtering, reading order, page scope, data-only parsing, image hosts and errors');

  if (process.argv.includes('--live')) {
    const liveAPI = {request: async url => {
      const result = await fetch(url, {headers: {'User-Agent': 'Sumi/1.0'}, signal: AbortSignal.timeout(20000)});
      if (!result.ok) throw new Error('HTTP ' + result.status);
      const text = await result.text(); return {text};
    }};
    const live = async (operation, input) => JSON.parse(await invoke(operation, input, liveAPI, DOMParser));
    const titles = await live('search', {query: provider.query});
    assert(titles.length > 0, 'Expected a live search result');
    const chapters = await live('chapters', {mangaID: titles[0].id});
    const pages = await live('pages', {mangaID: titles[0].id, chapterID: chapters[0].id});
    const image = await fetch(pages[0], {headers: {'User-Agent': 'Sumi/1.0'}, signal: AbortSignal.timeout(20000)});
    assert(image.ok, 'Image HTTP ' + image.status);
    const bytes = new Uint8Array(await image.arrayBuffer());
    assert(bytes.byteLength > 1000);
    // This provider may use application/octet-stream for a valid image.
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    assert(jpeg || png || webp, 'Expected decoded image-format bytes');
    console.log(`PASS LIVE: ${manifest.name}: search → ${chapters.length} chapters → ${pages.length} pages → image response`);
  }
}
