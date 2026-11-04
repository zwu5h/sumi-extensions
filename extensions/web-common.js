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
