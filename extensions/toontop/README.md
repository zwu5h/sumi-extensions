# ToonTop · English for Sumi

Uses Sumi Source API v1. Requires a Sumi build with **manifest image-referer
support**: ToonTop's image server returns HTTP 403 without `Referer:
https://toontop.io/`. Older app builds can load metadata but cannot display images.

Once these files are published, refresh the repository in **Settings → Sources &
repositories** and install **ToonTop · English**:

```text
https://raw.githubusercontent.com/zwu5h/sumi-extensions/main/repository.json
```

An empty search shows the latest updates; a title query uses ToonTop's server-side
search. Version 1.2.1 provides the website's genres with include/exclude selection,
formats (4-Koma, Adaptation, Full Color, Oneshot, Web Comic), publication status,
type (Manga, Manhwa, Manhua), demographic, content rating, Uncensored/Raw editions,
author, minimum/maximum chapters, tag and time period. Multiple demographics can
be combined, including Shounen + Seinen and Shoujo + Josei like the site's grouped
choices. All values are sent to ToonTop before pagination, including on Load more.
Sorting includes Best Match, Latest Updated, Recently Added, Most Followed,
Highest Rating, chapter count and views (today, 7 days, 30 days, all time).
A–Z is omitted because the provider rejects the website's option.
A Sumi build with catalog pagination
offers **Load more**, fetching 24 titles per page before content filtering.
Older app builds retain the first-page array response. Refresh the repository and
install the updated source after publishing. The complete chapter list comes from the public GET endpoint rather
than the title page's truncated list of 50 chapters. Chapters use stable title and
chapter paths and sort from earliest to latest, including fractional numbers.

Current Sumi builds use the source's native content filters without a separate
NSFW switch. They pass `allowNSFW: "true"` to avoid the old adapter-level gate.
Older apps that omit the input or pass `"false"` retain their conservative content
filter for catalog, chapters and pages.

The adapter reads embedded JSON as data; it never executes website scripts or
loads advertisements. Requests use only `toontop.io`, `api.toontop.io` and
`rx.toontop.io`. Only image requests receive the manifest's website reference;
cookies, account credentials, browser sessions and challenge bypasses are not
used. A Cloudflare challenge may still prevent access from a particular network.

## Development

```sh
python3 scripts/build_web_repositories.py
node scripts/test_toontop_source.mjs
node scripts/test_toontop_source.mjs --live
python3 scripts/build_all_repositories.py --check
```

On 4 November 2026 the live check verified included Action + Fantasy, excluded
Romance, at least 100 chapters, Ongoing status and both edition flags against
the returned provider metadata. It also passed sorting, publication status, distinct
successive catalog pages, browsing, search, all 208 chapters of
*Absolute Sword Sense*, 27 ordered pages of its first chapter, its cover and the
first/last image downloads with Sumi's declared image referer. An iPhone test of
installation and rendering is still required. No comic pages are stored in this
repository. This is an unofficial adapter, without an affiliation to ToonTop.
