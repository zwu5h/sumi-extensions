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
const call = async (operation, input, handler = () => ({success: true, data: {items: [{slug: 'action', name: 'Action'}, {slug: 'romance', name: 'Romance'}]}})) =>
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
  assert.equal(url.pathname, '/search'); assert.equal(url.searchParams.get('sort'), 'latest'); return search([book, book], '');
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
const filters = await call('filters', {});
assert(filters.sortOrders.some(item => item.id === 'views'));
assert(filters.sortOrders.some(item => item.id === 'newest'));
assert(filters.statuses.some(item => item.id === 'completed'));
assert(filters.supportsExcludedTags);
assert.deepEqual(filters.tagModes, ['AND']);
assert(filters.tags.some(item => item.id === 'action'));
assert.deepEqual(filters.groups.map(group => group.id), ['type', 'content_rating', 'demographic', 'format', 'min_ch', 'max_ch', 'author', 'tag', 'window', 'uncensored', 'raw']);
assert(!filters.sortOrders.some(item => item.id === 'alphabetical'), 'Do not offer the provider\'s broken alphabetical sort');
await assert.rejects(call('filters', {}, () => ({success: true, data: {items: [{slug: 'action', name: ''}]}})), /invalid genres/);
// Exercise every native field together, including edition flags, on another page.
const native = {type: ['manhwa'], content_rating: ['safe'], demographic: ['shounen', 'seinen'],
  format: ['full-color', 'web-comic'], min_ch: ['20'], max_ch: ['300'], author: ['A & B'],
  tag: ['martial arts'], window: ['week'], uncensored: ['true'], raw: ['true']};
await call('search', {filters: JSON.stringify(native), page: '2'}, url => {
  for (const [key, value] of Object.entries(native)) assert.equal(url.searchParams.get(key), value.join(','));
  assert.equal(url.searchParams.get('page'), '2');
  return html({ssrItems: [book], ssrPagination: {page: 2, has_next: false}});
});
const extra = {type: ['manhwa'], demographic: ['shounen', 'seinen'], min_ch: ['20'], author: ['A & B']};
await call('search', {query: 'example', tags: '["action"]', excludedTags: '["romance"]', filters: JSON.stringify(extra), sort: 'views_7days'}, url => {
  assert.equal(url.searchParams.get('genres'), 'action');
  assert.equal(url.searchParams.get('exclude'), 'romance');
  for (const [key, value] of Object.entries(extra)) assert.equal(url.searchParams.get(key), value.join(','));
  assert.equal(url.searchParams.get('sort'), 'views_7days');
  return search();
});
for (const filters of ['{"type":["invalid"]}', '{"min_ch":["-1"]}', '{"unknown":["true"]}', '{"raw":["false"]}', '{"window":["year"]}', '{"format":["unknown"]}', '{"content_rating":["invalid"]}']) {
  await assert.rejects(call('search', {filters}), /Invalid ToonTop/);
}

for (const {id: sort} of filters.sortOrders) {
  const result = await call('search', {query: 'example', sort, status: 'completed', page: '2'}, url => {
    assert.equal(url.searchParams.get('sort'), sort === 'best_match' ? null : sort);
    assert.equal(url.searchParams.get('status'), 'completed');
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('q'), 'example');
    return html({ssrItems: [book], ssrQuery: 'example', ssrPagination: {page: 2, has_next: true}});
  });
  assert.equal(result.titles.length, 1); assert.equal(result.nextPage, '3');
}
const hiddenPage = await call('search', {page: '1'}, () => html({ssrItems: [{...book, isAdult: true}], ssrPagination: {page: 1, has_next: true}}));
assert.deepEqual(hiddenPage, {titles: [], nextPage: '2'});
const lastPage = await call('search', {page: '2'}, () => html({ssrItems: [], ssrPagination: {page: 2, has_next: false}}));
assert.deepEqual(lastPage, {titles: [], nextPage: null});
for (const input of [{page: '0'}, {page: '1.5'}, {page: '10001'}, {sort: 'invalid'}, {status: 'invalid'}]) {
  await assert.rejects(call('search', input), /Invalid ToonTop/);
}
await assert.rejects(call('search', {page: '2'}, () => html({ssrItems: [], ssrPagination: {page: 1, has_next: true}})), /invalid catalog pagination/);
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
    const response = await fetch(url, {headers: {'User-Agent': 'Mozilla/5.0'}, signal: AbortSignal.timeout(15000)});
    assert(response.ok, 'HTTP ' + response.status + ' for ' + new URL(url).hostname);
    const text = await response.text();
    assert(Buffer.byteLength(text) <= 4 * 1024 * 1024, 'Sumi text response limit');
    return {text, json: () => JSON.parse(text)};
  }};
  const live = async (operation, input) => JSON.parse(await invoke(operation, input, liveAPI, DOMParser));
  const liveFilters = await live('filters', {});
  assert(liveFilters.tags.length > 20);
  // Verify provider metadata, not just that a filtered request returns something.
  const checked = async (input, check) => JSON.parse(await invoke('search', {page: '1', allowNSFW: 'true', ...input}, {request: async url => {
    const response = await liveAPI.request(url);
    const document = new DOMParser().parseFromString(response.text, 'text/html');
    const props = JSON.parse(document.querySelector('script#__NEXT_DATA__').textContent).props.pageProps;
    assert(props.ssrItems.length > 0);
    props.ssrItems.forEach(check);
    return response;
  }}, DOMParser));
  await checked({tags: '["action","fantasy"]', excludedTags: '["romance"]', filters: '{"min_ch":["100"]}', status: 'ongoing'}, item => {
    const genres = item.genres.map(genre => genre.slug);
    assert(genres.includes('action') && genres.includes('fantasy') && !genres.includes('romance'));
    assert(item.stats.chaptersCount >= 100 && item.status === 'ongoing');
  });
  await checked({filters: '{"uncensored":["true"]}'}, item => assert.equal(item.isUncensored, true));
  await checked({filters: '{"raw":["true"]}'}, item => assert.equal(item.isRaw, true));
  const advanced = await live('search', {tags: '["action"]', excludedTags: '["romance"]', filters: JSON.stringify({type: ['manhwa'], min_ch: ['50']}), sort: 'views_7days', page: '1'});
  assert(advanced.titles.length > 0, 'Expected results for native advanced filters');
  assert((await live('search', {query: ''})).length > 0, 'Expected a browsing catalog');
  const first = await live('search', {sort: 'views', status: 'completed', page: '1', allowNSFW: 'true'});
  assert(first.nextPage, 'Expected additional catalog pages');
  const second = await live('search', {sort: 'views', status: 'completed', page: first.nextPage, allowNSFW: 'true'});
  assert(first.titles.length > 0 && second.titles.length > 0);
  assert(second.titles.every(item => !first.titles.some(prior => prior.id === item.id)), 'Next page must contain different titles');
  const views = await live('search', {sort: 'views', page: '1'});
  const newest = await live('search', {sort: 'newest', page: '1'});
  assert.notDeepEqual(views.titles.map(item => item.id), newest.titles.map(item => item.id), 'Sort must affect the provider catalog');
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
