// Shared source helpers. Bundled into each script; never loads scripts from a website.
let webLastRequestAt = 0;
const excludedGenres = new Set(['adult', 'ecchi', 'erotica', 'hentai', 'smut', 'mature', 'shota', 'lolicon', 'shotacon', 'loli', 'sexual violence', 'sexual-violence']);

function webText(node) { return (node?.textContent || '').replace(/\s+/g, ' ').trim(); }
function webGenres(nodes) { return [...new Set([...nodes].map(webText).filter(Boolean))]; }
function webAllowed(genres) {
  return genres.length > 0 && !genres.some(genre => excludedGenres.has(genre.toLowerCase()));
}
function webLink(value, pattern) {
  const url = new URL(value, config.origin);
  if (url.origin !== config.origin || url.username || url.password || url.search || url.hash || !pattern.test(url.pathname)) {
    throw new Error('Invalid ' + config.name + ' title or chapter link.');
  }
  return url;
}
function webImage(value) {
  if (!value || value === '#') throw new Error(config.name + ' did not provide an image URL.');
  const url = new URL(value, config.origin);
  const allowed = config.hosts.some(host => host.startsWith('*.')
    ? url.hostname.endsWith('.' + host.slice(2)) : url.hostname === host);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowed) {
    throw new Error(config.name + ' returned an image outside this source’s permissions.');
  }
  return url.href;
}
async function webDocument(api, url) {
  const wait = 600 - (Date.now() - webLastRequestAt);
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  webLastRequestAt = Date.now();
  const response = await api.request(url);
  if (typeof response.text !== 'string' || !response.text.includes('<')) {
    throw new Error(config.name + ' returned an unexpected response.');
  }
  const document = new DOMParser().parseFromString(response.text, 'text/html');
  if (/just a moment|access denied|attention required/i.test(webText(document.querySelector('title')))) {
    throw new Error(config.name + ' requires a browser check. This source cannot complete it.');
  }
  return document;
}
function webUnique(items) { return [...new Map(items.map(item => [item.id, item])).values()]; }
function webChapterLimit(items) {
  if (!items.length) throw new Error('No readable chapters found. The site layout may have changed.');
  if (items.length > 10000) throw new Error('This title exceeds Sumi’s chapter limit.');
  return items;
}
function webPageLimit(pages) {
  if (!pages.length || pages.length > 500) throw new Error('No readable page list found, or the chapter exceeds Sumi’s page limit.');
  return pages;
}

const config = {
  name: 'MangaKatana', origin: 'https://mangakatana.com',
  hosts: ['mangakatana.com', '*.mangakatana.com']
};
const katanaBook = /^\/manga\/[a-z0-9-]+\.\d+$/;
const katanaChapter = /^\/manga\/[a-z0-9-]+\.\d+\/c\d+(?:\.\d+)*$/;

async function katanaDetail(api, mangaID) {
  const url = webLink(mangaID, katanaBook);
  const document = await webDocument(api, url.href);
  const genres = webGenres(document.querySelectorAll('#single_book .genres a'));
  if (!document.querySelector('#single_book h1') || !webAllowed(genres)) {
    throw new Error('This title has missing genre information or is excluded by this source’s content filter.');
  }
  return document;
}

const source = {
  async search({query}, api) {
    const url = new URL(config.origin);
    const term = String(query || '').trim();
    if (term) { url.searchParams.set('search', term); url.searchParams.set('search_by', 'book_name'); }
    const document = await webDocument(api, url.href);
    // A search with one match can redirect straight to the title page.
    if (document.querySelector('#single_book')) {
      const genres = webGenres(document.querySelectorAll('#single_book .genres a'));
      if (!webAllowed(genres)) return [];
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ||
        document.querySelector('meta[property="og:url"]')?.getAttribute('content');
      if (!canonical) throw new Error('MangaKatana did not provide a canonical title link.');
      const book = webLink(canonical, katanaBook);
      const title = webText(document.querySelector('#single_book h1'));
      if (!title) throw new Error('MangaKatana title layout changed.');
      const authors = webGenres(document.querySelectorAll('#single_book .authors a'));
      const image = document.querySelector('#single_book .cover img');
      return [{id: book.pathname, title, author: authors.join(', ') || 'Author details on MangaKatana',
        synopsis: webText(document.querySelector('#single_book .summary p')),
        genre: genres.join(' · '), cover: image ? webImage(image.getAttribute('src')) : null}];
    }
    if (!document.querySelector('#book_list')) throw new Error('MangaKatana search layout changed.');
    const results = [];
    for (const card of document.querySelectorAll('#book_list .item')) {
      const link = card.querySelector('h3.title a');
      const image = card.querySelector('.wrap_img img');
      const genres = webGenres(card.querySelectorAll('.genres a'));
      if (!link || !webText(link) || !webAllowed(genres)) continue;
      const url = webLink(link.getAttribute('href'), katanaBook);
      results.push({id: url.pathname, title: webText(link), author: 'Author details on MangaKatana',
        synopsis: webText(card.querySelector('.summary')), genre: genres.join(' · '),
        cover: image ? webImage(image.getAttribute('data-src') || image.getAttribute('src')) : null});
    }
    return webUnique(results).slice(0, 50);
  },
  async chapters({mangaID}, api) {
    const document = await katanaDetail(api, mangaID);
    const items = [...document.querySelectorAll('#single_book .chapters a[href]')]
      .filter(link => /\/c\d+(?:\.\d+)*$/.test(new URL(link.getAttribute('href'), config.origin).pathname))
      .map(link => {
        const url = webLink(link.getAttribute('href'), katanaChapter);
        if (!url.pathname.startsWith(mangaID + '/c')) throw new Error('MangaKatana returned an unrelated chapter.');
        return {id: url.pathname, title: webText(link) || 'Chapter', credit: 'MangaKatana · English'};
      });
    return webChapterLimit(webUnique(items).sort((a, b) => {
      const left = a.id.split('/c').at(-1).split('.').map(Number);
      const right = b.id.split('/c').at(-1).split('.').map(Number);
      for (let index = 0; index < Math.max(left.length, right.length); index++) {
        const difference = (left[index] || 0) - (right[index] || 0);
        if (difference) return difference;
      }
      return 0;
    }));
  },
  async pages({mangaID, chapterID}, api) {
    webLink(mangaID, katanaBook);
    const chapter = webLink(chapterID, katanaChapter);
    if (!chapter.pathname.startsWith(mangaID + '/c')) throw new Error('This chapter belongs to a different title.');
    await katanaDetail(api, mangaID);
    const document = await webDocument(api, chapter.href);
    // Read the provider's published URL array as data. Website scripts are never executed.
    const arrays = [...document.querySelectorAll('script')].map(script => script.textContent)
      .map(text => text.match(/\bvar\s+thzq\s*=\s*\[([\s\S]*?)\]\s*;/)).filter(Boolean);
    if (arrays.length !== 1) throw new Error('MangaKatana page-list layout changed.');
    const value = arrays[0][1];
    const quotedURL = /'(https:\/\/[^'\\\r\n]+)'|"(https:\/\/[^"\\\r\n]+)"/g;
    const matches = [...value.matchAll(quotedURL)];
    if (value.replace(quotedURL, '').replace(/[\s,]/g, '') !== '') throw new Error('MangaKatana returned an unsupported page-list format.');
    return webPageLimit(matches.map(match => webImage(match[1] || match[2])));
  }
};
