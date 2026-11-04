# Provider research — 4 November 2026

This repository publishes adapters, not a guarantee of content rights or App Store
approval. Public availability and a successful network test alone do not establish
authorization to redistribute third-party works. This repository stores no third-party
comic pages.

| Provider | Evidence and result | Decision |
| --- | --- | --- |
| MangaDex | Published API; existing German and English adapters | Retained |
| MangaKatana | Public search/title pages and a literal page URL array; direct image response succeeds | Added English manga/manhwa adapter with content exclusions |
| ToonTop | Public Next.js page JSON, full chapter GET endpoint, image downloads require the website-origin Referer | Added English adapter; requires Sumi image-referer support; live search → 208 chapters → 27 pages and image bytes verified |
| MangaPill | Search and chapter pages work; direct image requests returned HTTP 403 | Not published as a working source |
| Comick | Official docs describe a public catalog API; direct requests from this connection returned a browser challenge | Not published as a working source |
| MangaPDF | Official docs describe a developer API; both documented API hosts returned HTTP 521 | Not published as a working source |
| comico.moe | Public metadata and chapter lists work; reading needs a session operation outside Sumi's GET-only bridge, and the schema omits required request details | Not published as a working source |
| WEBTOON | Digital-content license limits viewing/downloading to the provider's services | No scraping adapter added |
| NamiComi | Terms prohibit automated/non-human access | No scraping adapter added |

MangaKatana uses HTML rather than a documented third-party API. Compatibility does not
establish permission from the provider or underlying rights holders. Do not describe
it as a licensed or App Store approved integration.

## Mature content

MangaKatana excludes adult/explicit genre labels and fails closed on missing genres.
ToonTop uses Sumi's per-source content preference: adult/uncensored/censored-cover
flags, excluded genres and missing content metadata are hidden by default, including
when saved chapters are opened. Its explicit opt-in permits the provider's mature
catalog. Both depend on provider metadata and do not establish an age classification.
MangaDex also supports the per-source content preference.

Apple's guideline 1.1.4 prohibits overtly sexual/pornographic material. The conditional
treatment of incidental mature UGC under 1.2 is not a general permission to distribute
a pornographic catalog. Rights and service permission requirements under 5.2 also remain
applicable.

## Sources

- [Comick developer documentation](https://comick.dev/docs)
- [MangaPDF API overview](https://docs.mangapdf.org/guide/api/index.html)
- [comico.moe API documentation](https://comico.moe/docs)
- [WEBTOON terms](https://www.webtoons.com/legal/terms/)
- [NamiComi terms](https://namicomi.com/publish!/terms)
- [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/)
