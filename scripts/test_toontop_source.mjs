import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {DOMParser} from 'linkedom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'extensions/toontop/repository.json'))).extensions[0];
const index = JSON.parse(readFileSync(join(root, 'repository.json')));
assert(index.extensions.some(item => item.id === manifest.id && item.sha256 === manifest.sha256));
const code = readFileSync(join(root, 'extensions/toontop/dist', basename(new URL(manifest.script).pathname)), 'utf8');
assert.equal(createHash('sha256').update(code).digest('hex'), manifest.sha256);
assert.equal(manifest.imageReferer, 'https://toontop.io/');
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const invoke = new AsyncFunction('operation', 'input', 'api', 'DOMParser', code + '\nreturn JSON.stringify(await source[operation](input, api));');
const origin = 'https://toontop.io';
const image = 'https://rx.toontop.io/r/p/example/001.webp';
const book = {id: 'abc123', url: '/example', name: 'Example', isAdult: false,
  genres: [{name: 'Action'}], authors: [{name: 'Creator'}], summary: 'Summary', cover: image,
  stats: {chaptersCount: 3}, chapters: [{url: '/example/chapter-10'}]};
const entries = [10, 1.5, 1].map(number => ({url: '/example/chapter-' + number, name: 'Chapter ' + number, number}));
const html = props => '<html><title>TOONTOP</title><script>globalThis.toonScriptExecuted=true;</script>' +
  '<script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({props: {pageProps: props}}) + '</script></html>';
const search = (items = [book], ssrQuery = 'example') => html({ssrItems: items, ssrQuery});
const detail = (manga = book) => html({initialManga: manga});
const chapter = (manga = book, images = [image, image.replace('001', '002')]) => html({
  initialManga: manga, initialChapter: {url: '/example/chapter-1', images}});
const request = handler => ({request: async value => {
  const url = new URL(value);
  assert(manifest.hosts.includes(url.hostname));
  const valueOrText = await handler(url);
  const text = typeof valueOrText === 'string' ? valueOrText : JSON.stringify(valueOrText);
  return {text, json: () => JSON.parse(text)};
}});
const call = async (operation, input, handler = () => assert.fail('Unexpected network request')) =>
  JSON.parse(await invoke(operation, input, request(handler), DOMParser));
const list = (chapters = entries) => ({success: true, data: {chapters}});

assert.equal((await call('filters', {})).supportsNSFW, true);
const titles = await call('search', {query: 'a&genre=adult'}, url => {
  assert.equal(url.pathname, '/search');
  assert.equal(url.searchParams.get('q'), 'a&genre=adult');
  assert.equal(url.searchParams.size, 1);
  return search([book], 'a&genre=adult');
});
assert.deepEqual(titles, [{id: '/example', title: 'Example', author: 'Creator', synopsis: 'Summary', genre: 'Action', cover: image}]);
assert.equal((await call('search', {query: ''}, url => {
  assert.equal(url.pathname, '/latest'); return html({items: [book, book]});
})).length, 1);
assert.deepEqual(await call('search', {query: 'example'}, () => search([])), []);
await assert.rejects(call('search', {query: 'example'}, () => search([book], '')), /query was not applied/);

for (const changes of [{isAdult: true}, {isAdult: undefined}, {genres: []}, {genres: [{name: 'Smut'}]}, {isUncensored: true}, {coverCensored: true}]) {
  const item = {...book, ...changes};
  assert.deepEqual(await call('search', {query: 'example'}, () => search([item])), []);
  assert.equal((await call('search', {query: 'example', allowNSFW: 'true'}, () => search([item]))).length, 1);
  await assert.rejects(call('chapters', {mangaID: '/example'}, () => detail(item)), /content setting/);
  await assert.rejects(call('pages', {mangaID: '/example', chapterID: '/example/chapter-1'}, () => chapter(item)), /content setting/);
}
assert.deepEqual(await call('search', {query: 'example', allowNSFW: 'true'}, () => search([{...book, isDeleted: true}])), []);
let requests = [];
const chapters = await call('chapters', {mangaID: '/example'}, url => {
  requests.push(url.href);
  return url.host === 'toontop.io' ? detail() : list([...entries, entries[0]]);
});
assert.deepEqual(chapters.map(item => item.id), ['/example/chapter-1', '/example/chapter-1.5', '/example/chapter-10']);
assert(chapters.every(item => item.credit === 'ToonTop · English' && !('number' in item)));
assert.deepEqual(requests, [origin + '/example', 'https://api.toontop.io/titles/abc123/chapters']);
await assert.rejects(call('chapters', {mangaID: '/example'}, url => url.host === 'toontop.io' ? detail() : list(entries.slice(0, 1))), /incomplete/);
await assert.rejects(call('chapters', {mangaID: '/example'}, url => url.host === 'toontop.io' ? detail({...book, stats: {}}) : list([])), /No readable chapters/);
await assert.rejects(call('chapters', {mangaID: '/example'}, url => url.host === 'toontop.io' ? detail() : list([{url: '/other/chapter-1'}])), /unrelated/);
await assert.rejects(call('chapters', {mangaID: '/example'}, url => url.host === 'toontop.io' ? detail() : '<title>Just a moment...</title>'), /invalid chapter data|browser check/);
await assert.rejects(call('chapters', {mangaID: '/example'}, url => url.host === 'toontop.io' ? detail() : {success: true, data: {}}), /chapter-list data/);

const input = {mangaID: '/example', chapterID: '/example/chapter-1'};
assert.deepEqual(await call('pages', input, () => chapter()), [image, image.replace('001', '002')]);
// Reader metadata uses snake_case for some flags.
assert.deepEqual(await call('pages', input, () => chapter({...book, isAdult: undefined, is_adult: false})), [image, image.replace('001', '002')]);
assert.equal((await call('pages', {...input, allowNSFW: 'true'}, () => chapter({...book, isAdult: true}))).length, 2);
await assert.rejects(call('pages', {...input, chapterID: '/other/chapter-1'}), /different title/);
await assert.rejects(call('pages', {...input, chapterID: 'https://evil.org/example/chapter-1'}), /Invalid/);
await assert.rejects(call('pages', input, () => chapter({...book, url: '/other'})), /different title/);
await assert.rejects(call('pages', input, () => html({initialManga: book, initialChapter: {url: '/example/chapter-2', images: [image]}})), /different chapter/);
for (const bad of ['https://evil.org/p.jpg', 'https://rx.toontop.io.evil.org/p.jpg', 'http://rx.toontop.io/p.jpg']) {
  await assert.rejects(call('pages', input, () => chapter(book, [bad])), /outside this source/);
}
await assert.rejects(call('pages', input, () => chapter(book, [])), /No readable page list/);
await assert.rejects(call('pages', input, () => chapter(book, Array(501).fill(image))), /page limit/);
await assert.rejects(call('pages', input, () => chapter(book, [{}])), /invalid page URL/);
await assert.rejects(call('search', {query: ''}, () => '<html><title>Just a moment...</title></html>'), /browser check/);
await assert.rejects(call('search', {query: ''}, () => '<html><title>TOONTOP</title></html>'), /page data is missing/);
await assert.rejects(call('search', {query: ''}, () => '<script id="__NEXT_DATA__" type="application/json">invalid</script>'), /invalid page data/);
assert.equal(globalThis.toonScriptExecuted, undefined, 'Website JavaScript must never execute');
console.log('PASS: ToonTop generated checksum, query encoding, full chapter list, reading order, content setting, image permissions and malformed responses');

if (process.argv.includes('--live')) {
  const liveAPI = {request: async url => {
    const response = await fetch(url, {headers: {'User-Agent': 'Sumi/1.0'}, signal: AbortSignal.timeout(15000)});
    assert(response.ok, 'HTTP ' + response.status + ' for ' + new URL(url).hostname);
    const text = await response.text();
    assert(Buffer.byteLength(text) <= 4 * 1024 * 1024, 'Sumi text response limit');
    return {text, json: () => JSON.parse(text)};
  }};
  const live = async (operation, input) => JSON.parse(await invoke(operation, input, liveAPI, DOMParser));
  assert((await live('search', {query: ''})).length > 0, 'Expected a browsing catalog');
  const titles = await live('search', {query: 'Absolute Sword Sense'});
  const title = titles.find(item => item.id === '/absolute-sword-sense');
  assert(title, 'Expected the requested live title');
  const chapters = await live('chapters', {mangaID: title.id});
  assert(chapters.length > 50, 'Must include more than the 50 embedded chapters');
  assert.equal(chapters[0].id, title.id + '/chapter-1');
  const pages = await live('pages', {mangaID: title.id, chapterID: chapters[0].id});
  for (const url of [title.cover, pages[0], pages.at(-1)]) {
    assert(manifest.hosts.includes(new URL(url).hostname));
    const response = await fetch(url, {headers: {'User-Agent': 'Sumi/1.0', Referer: manifest.imageReferer}, signal: AbortSignal.timeout(15000)});
    assert(response.ok, 'Image HTTP ' + response.status);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert(bytes.byteLength > 1000 && bytes.byteLength <= 20 * 1024 * 1024);
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    assert(webp || jpeg || png, 'Expected image bytes');
  }
  console.log(`PASS LIVE: ToonTop browse → search → ${chapters.length} chapters → ${pages.length} pages → cover and first/last images, with the declared image referer and no cookies`);
}
