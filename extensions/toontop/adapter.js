const config = {
  name: 'ToonTop', origin: 'https://toontop.io',
  hosts: ['toontop.io', 'api.toontop.io', 'rx.toontop.io']
};
const toonBook = /^\/[a-z0-9][a-z0-9_-]*$/;
const toonChapter = /^\/[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9_.-]*$/;

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

const source = {
  async filters() {
    return {tags: [], statuses: [], sortOrders: [], supportsNSFW: true};
  },
  async search({query, allowNSFW}, api) {
    const term = String(query || '').trim();
    const url = new URL(term ? '/search' : '/latest', config.origin);
    if (term) url.searchParams.set('q', term);
    const data = await toonData(api, url.href);
    const items = term ? data.ssrItems : data.items;
    if (!Array.isArray(items) || (term && data.ssrQuery !== term)) {
      throw new Error('ToonTop search data changed or the query was not applied.');
    }
    return webUnique(items.filter(item => toonAllowed(item, allowNSFW)).map(item => {
      const book = webLink(item.url, toonBook);
      if (!item.name) throw new Error('ToonTop returned a title without a name.');
      return {id: book.pathname, title: String(item.name),
        author: toonNames(item.authors).join(', ') || 'Author details on ToonTop',
        synopsis: String(item.summary || ''), genre: toonNames(item.genres).join(' · '),
        cover: item.cover ? webImage(item.cover) : null};
    })).slice(0, 200);
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
