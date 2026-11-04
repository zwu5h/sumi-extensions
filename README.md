# Sumi extensions

Separately installable sources for the [Sumi iOS reader](https://github.com/zwu5h/sumi).

## Install

In Sumi, open **Settings → Sources & repositories**, add this repository URL and install
the language you want:

```text
https://raw.githubusercontent.com/zwu5h/sumi-extensions/main/repository.json
```

- **MangaDex · Deutsch**
- **MangaDex · English**
- **MangaKatana · English** — manga and manhwa

Use the current Sumi build with scoped subdomain permissions. These extensions use
Sumi's own source API; they are not Paperback extensions. No additional backend is
needed. Search, catalogs and images load directly from the selected provider.

If you installed these sources from the old `zwu5h/sumi` repository, remove that old
repository in Sumi before installing them from this one. Saved library titles and
reading progress remain on the device; the extension IDs are unchanged.

See [MangaDex setup](extensions/mangadex/README.md),
[MangaKatana setup](extensions/mangakatana/README.md) and the
[provider research and limitations](docs/provider-research.md).

## Development

Use Python 3 and Node.js 22 or later. Installed adapters are standalone JavaScript;
the DOM parser dependency below is only used by the development tests.

```sh
npm ci --ignore-scripts
python3 scripts/build_all_repositories.py
python3 scripts/build_all_repositories.py --check
node scripts/test_mangadex_source.mjs
node scripts/test_web_sources.mjs
# Optional real API check:
node scripts/test_mangadex_source.mjs --live
node scripts/test_web_sources.mjs --live
```

Edit the adapter template, then regenerate both indexes and content-addressed scripts.
Commit the generated files with the template. Published script URLs point exclusively
to this repository; old script versions stay available for cached indexes.
