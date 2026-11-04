const config = {
  name: 'ToonTop', origin: 'https://toontop.io',
  hosts: ['toontop.io', 'api.toontop.io', 'rx.toontop.io']
};
const toonBook = /^\/[a-z0-9][a-z0-9_-]*$/;
const toonChapter = /^\/[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9_.-]*$/;
const toonSorts = [
  ['best_match', 'Best Match'], ['latest', 'Latest Updated'], ['newest', 'Recently Added'],
  ['popular', 'Most Followed'], ['rating', 'Highest Rating'],
  ['views_today', 'Most Viewed: Today'], ['views_7days', 'Most Viewed: 7 Days'],
  ['views_30days', 'Most Viewed: 30 Days'], ['views', 'Most Viewed: All Time'],
  ['chapters', 'Most Chapters']
];
// The website lists A-Z, but its server returns no pagination for alphabetical.
const toonStatuses = ['ongoing', 'completed', 'hiatus', 'cancelled'];

// Parse only Next.js's published JSON data; never evaluate website JavaScript.
async function toonData(api, url) {
  const document = await webDocument(api, url);
  const script = document.querySelector('script#__NEXT_DATA__[type="application/json"]');
  if (!script) throw new Error('ToonTop page data is missing. The site layout may have changed.');
  let props;
  try { props = JSON.parse(script.textContent).props.pageProps; }
  catch { throw new Error('ToonTop returned invalid page data.'); }
  if (!props || props.initialError || props.chapterError) throw new Error('This ToonTop title or chapter is unavailable.');
  return props;
}
function toonNames(items) {
  return Array.isArray(items) ? [...new Set(items.map(item => String(item?.name || '').trim()).filter(Boolean))] : [];
}
function toonAllowed(manga, allowNSFW) {
  if (!manga || manga.isDeleted === true) return false;
  if (allowNSFW === 'true') return true;
  const adult = manga.isAdult ?? manga.is_adult;
  return adult === false && manga.isUncensored !== true && manga.is_uncensored !== true &&
    manga.coverCensored !== true && manga.cover_censored !== true && webAllowed(toonNames(manga.genres));
}
function toonRequireTitle(manga, mangaID, allowNSFW) {
  if (!manga || webLink(manga.url, toonBook).pathname !== mangaID) {
    throw new Error('ToonTop returned a different title.');
  }
  if (!toonAllowed(manga, allowNSFW)) {
    throw new Error('This title is hidden by the source’s content setting or has missing content information.');
  }
}
async function toonDetail(api, mangaID, allowNSFW) {
  const url = webLink(mangaID, toonBook);
  const data = await toonData(api, url.href);
  toonRequireTitle(data.initialManga, url.pathname, allowNSFW);
  return data.initialManga;
}
function toonOrder(left, right) {
  const a = left.number, b = right.number;
  if (typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b) && a !== b) return a - b;
  return left.id.localeCompare(right.id, 'en', {numeric: true});
}

const toonOptions = values => values.map(id => ({id, name: id[0].toUpperCase() + id.slice(1)}));
const toonGroups = [
  {id: 'type', name: 'Type', options: toonOptions(['manga', 'manhwa', 'manhua'])},
  {id: 'content_rating', name: 'Content rating', options: toonOptions(['safe', 'suggestive', 'erotica', 'pornographic'])},
  {id: 'demographic', name: 'Demographic', multiple: true, options: toonOptions(['shounen', 'shoujo', 'seinen', 'josei'])},
  {id: 'format', name: 'Formats', multiple: true, options: [
    {id: '4-koma', name: '4-Koma'}, {id: 'adaptation', name: 'Adaptation'},
    {id: 'full-color', name: 'Full Color'}, {id: 'oneshot', name: 'Oneshot'}, {id: 'web-comic', name: 'Web Comic'}
  ]},
  {id: 'min_ch', name: 'Minimum chapters', options: []},
  {id: 'max_ch', name: 'Maximum chapters', options: []},
  {id: 'author', name: 'Author', options: []},
  {id: 'tag', name: 'Tag', options: []},
  {id: 'window', name: 'Time period', options: [{id: 'today', name: 'Today'}, {id: 'week', name: 'This week'}, {id: 'month', name: 'This month'}]},
  {id: 'uncensored', name: 'Edition: Uncensored', options: [{id: 'true', name: 'Uncensored'}]},
  {id: 'raw', name: 'Edition: Raw', options: [{id: 'true', name: 'Raw'}]}
];
const source = {
  async filters(_, api) {
    const response = await api.request('https://api.toontop.io/genres');
    const result = response.json();
    if (result.success !== true || !Array.isArray(result.data?.items)) throw new Error('ToonTop genre list changed.');
    if (!result.data.items.length || result.data.items.some(item => typeof item.slug !== 'string' || !/^[a-z0-9-]+$/.test(item.slug) || typeof item.name !== 'string' || !item.name.trim())) {
      throw new Error('ToonTop returned invalid genres.');
    }
    return {tags: result.data.items.map(item => ({id: item.slug, name: item.name})),
      supportsExcludedTags: true, tagModes: ['AND'], groups: toonGroups, statuses: toonStatuses.map(id => ({id, name: id[0].toUpperCase() + id.slice(1)})),
      sortOrders: toonSorts.map(([id, name]) => ({id, name})), supportsNSFW: true};
  },
  async search({query, allowNSFW, sort = '', status = '', tags = '[]', excludedTags = '[]', filters = '{}', page}, api) {
    const term = String(query || '').trim();
    if (sort && !toonSorts.some(([id]) => id === sort)) throw new Error('Invalid ToonTop sort order.');
    if (status && !toonStatuses.includes(status)) throw new Error('Invalid ToonTop publication status.');
    const number = page === undefined ? 1 : Number(page);
    if (!Number.isSafeInteger(number) || number < 1 || number > 10000) throw new Error('Invalid ToonTop catalog page.');
    const url = new URL('/search', config.origin);
    if (term) url.searchParams.set('q', term);
    if (sort !== 'best_match' && (sort || !term)) url.searchParams.set('sort', sort || 'latest');
    if (status) url.searchParams.set('status', status);
    for (const [key, raw] of [['genres', tags], ['exclude', excludedTags]]) {
      const values = JSON.parse(raw);
      if (!Array.isArray(values) || values.length > 500 || values.some(v => typeof v !== 'string' || !/^[a-z0-9-]+$/.test(v))) throw new Error('Invalid ToonTop genres.');
      if (values.length) url.searchParams.set(key, [...new Set(values)].join(','));
    }
    const extra = JSON.parse(filters);
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) throw new Error('Invalid ToonTop filters.');
    for (const [key, values] of Object.entries(extra)) {
      const group = toonGroups.find(group => group.id === key);
      if (!group || !Array.isArray(values) || (!group.multiple && values.length > 1) || values.some(v => typeof v !== 'string' || v.length > 300 || (group.options.length && !group.options.some(option => option.id === v)))) throw new Error('Invalid ToonTop filter.');
      if (['min_ch', 'max_ch'].includes(key) && values.some(v => !/^[0-9]{1,6}$/.test(v))) throw new Error('Invalid ToonTop chapter count.');
      if (values.length) url.searchParams.set(key, values.join(','));
    }
    if (number > 1) url.searchParams.set('page', String(number));
    const data = await toonData(api, url.href);
    const items = data.ssrItems;
    if (!Array.isArray(items) || (term && data.ssrQuery !== term)) {
      throw new Error('ToonTop search data changed or the query was not applied.');
    }
    const titles = webUnique(items.filter(item => toonAllowed(item, allowNSFW)).map(item => {
      const book = webLink(item.url, toonBook);
      if (!item.name) throw new Error('ToonTop returned a title without a name.');
      return {id: book.pathname, title: String(item.name),
        author: toonNames(item.authors).join(', ') || 'Author details on ToonTop',
        synopsis: String(item.summary || ''), genre: toonNames(item.genres).join(' · '),
        cover: item.cover ? webImage(item.cover) : null};
    })).slice(0, 200);
    // Keep the array contract for apps predating paginated catalogs.
    if (page === undefined) return titles;
    const pagination = data.ssrPagination;
    if (!pagination || pagination.page !== number || typeof pagination.has_next !== 'boolean') {
      throw new Error('ToonTop returned invalid catalog pagination.');
    }
    return {titles, nextPage: pagination.has_next ? String(number + 1) : null};
  },
  async chapters({mangaID, allowNSFW}, api) {
    const manga = await toonDetail(api, mangaID, allowNSFW);
    if (typeof manga.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(manga.id)) {
      throw new Error('ToonTop returned an invalid title identifier.');
    }
    // The title page embeds only the latest 50 chapters; this GET returns the full list.
    const response = await api.request('https://api.toontop.io/titles/' + encodeURIComponent(manga.id) + '/chapters');
    let result;
    try { result = response.json(); } catch { throw new Error('ToonTop returned invalid chapter data or requires a browser check.'); }
    if (result.success !== true || !Array.isArray(result.data?.chapters)) {
      throw new Error('ToonTop chapter-list data changed.');
    }
    const chapters = webUnique(result.data.chapters.map(item => {
      const chapter = webLink(item.url, toonChapter);
      if (!chapter.pathname.startsWith(mangaID + '/')) throw new Error('ToonTop returned an unrelated chapter.');
      return {id: chapter.pathname, title: String(item.name || 'Chapter'), number: item.number,
        credit: toonNames(item.group ? [item.group] : []).join(', ') || 'ToonTop · English'};
    }));
    const count = manga.stats?.chaptersCount;
    if (Number.isInteger(count) && count > chapters.length) {
      throw new Error('ToonTop returned an incomplete chapter list. Please retry later.');
    }
    return webChapterLimit(chapters).sort(toonOrder).map(({number, ...chapter}) => chapter);
  },
  async pages({mangaID, chapterID, allowNSFW}, api) {
    const book = webLink(mangaID, toonBook);
    const chapter = webLink(chapterID, toonChapter);
    if (!chapter.pathname.startsWith(book.pathname + '/')) throw new Error('This chapter belongs to a different title.');
    const data = await toonData(api, chapter.href);
    toonRequireTitle(data.initialManga, book.pathname, allowNSFW);
    const item = data.initialChapter;
    if (!item || webLink(item.url, toonChapter).pathname !== chapter.pathname) {
      throw new Error('ToonTop returned a different chapter.');
    }
    if (!Array.isArray(item.images)) throw new Error('ToonTop page-list data changed.');
    return webPageLimit(item.images.map(value => {
      if (typeof value !== 'string') throw new Error('ToonTop returned an invalid page URL.');
      return webImage(value);
    }));
  }
};
