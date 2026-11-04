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
search. Each returns the provider's first result page (up to 24 titles before
content filtering). Catalog pagination and genre/status/sort filters are not
provided. The complete chapter list comes from the public GET endpoint rather
than the title page's truncated list of 50 chapters. Chapters use stable title and
chapter paths and sort from earliest to latest, including fractional numbers.

**Filters → Show NSFW content** defaults to off. Catalog results, chapter lists
and page lookup apply the setting. With it off, adult/uncensored/censored-cover
flags, excluded genre labels and missing content information hide a title.
The setting relies on ToonTop's metadata. Older apps without the setting remain
filtered by default.

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

On 4 November 2026 the live check passed browsing, search, all 208 chapters of
*Absolute Sword Sense*, 27 ordered pages of its first chapter, its cover and the
first/last image downloads with Sumi's declared image referer. An iPhone test of
installation and rendering is still required. No comic pages are stored in this
repository. This is an unofficial adapter, without an affiliation to ToonTop.
