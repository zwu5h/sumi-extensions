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

Use the current Sumi build with scoped subdomain permissions. These extensions use
Sumi's own source API; they are not Paperback extensions. No additional backend is
needed. Search, catalogs and images load directly from MangaDex.

If you installed these sources from the old `zwu5h/sumi` repository, remove that old
repository in Sumi before installing them from this one. Saved library titles and
reading progress remain on the device; the extension IDs are unchanged.

See [MangaDex setup, features, API terms and maintenance](extensions/mangadex/README.md).

## Development

Python 3 and Node.js 22 or later are sufficient; there are no package dependencies.

```sh
python3 scripts/build_mangadex_repository.py
python3 scripts/build_mangadex_repository.py --check
node scripts/test_mangadex_source.mjs
# Optional real API check:
node scripts/test_mangadex_source.mjs --live
```

Edit the adapter template, then regenerate both indexes and content-addressed scripts.
Commit the generated files with the template. Published script URLs point exclusively
to this repository; old script versions stay available for cached indexes.
