# MangaKatana · English

English manga and manhwa source using public pages at
[mangakatana.com](https://mangakatana.com/). Install it from the standard Sumi repository,
then search or leave the query empty to browse the home-page selection.

The adapter supports title summaries, covers, chapters in ascending reading order
and published page-image URLs. It parses the provider's literal URL array as data;
it never evaluates or executes website JavaScript. Only the declared provider domain
and its subdomains can serve images. There is no login, subscription access, CAPTCHA
solving or protection bypass.

Explicit/adult genre labels are excluded in results and checked again before reading.
Titles with missing genre information are excluded. Nonsexual genres such as horror,
seinen and josei remain available. Provider labels may be incomplete or inaccurate;
the filter does not certify suitability or publishing rights.

Results are limited to the first provider page (up to 50 titles). Search cards do not
supply author details. Optional extended filters and multi-page search are not yet
implemented. The provider can expire its image URLs; Retry in the current Sumi reader
refreshes the chapter links and retains your page.

Developers: edit adapter.js or the shared web-common.js, increment the version in
scripts/build_web_repositories.py and run scripts/build_all_repositories.py. Keep
published dist files so previously installed versions and cached indexes remain valid.
