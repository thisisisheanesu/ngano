# Changelog

All notable changes to the `ngano` Python package are recorded here. The format
follows Keep a Changelog, and the project uses semantic versioning.

## [0.1.0] - 2026-09-13

First release.

### Added

- `Catalogue`, reading the snapshot bundled in the wheel with no network and no
  Hugging Face token, or reading live from `https://ngano.dev/api/v1` through
  `Catalogue.from_api()`. 612 dataset records, 58 countries, 315 language tags.
- `Catalogue.datasets()`, `get()`, `find()`, `search()`, `countries()`,
  `country()`, `languages()`, `language()`, `language_codes()`,
  `resolve_language()` and `stats()`. Every hours total
  excludes records flagged `unverified_size`, and `stats()` reports how many
  records and hours were excluded.
- ISO 639-3 language keying. Every language is a BCP 47 tag whose primary
  subtag is a three-letter code, with an optional region subtag for a
  country-specific variety, so Shona is `sna` and Nigerian English is `eng-NG`.
  `ngano.languages` bundles the registry as `language_codes.json` and resolves a
  filter value in one fixed order: an exact tag case insensitively, then a bare
  code that exists only as regional varieties, then a name from the registry
  aliases in its plain or slugified spelling. A tag always beats a name, a bare
  code widens to its varieties only with `include_varieties=True`, and an
  unresolvable value matches nothing rather than being guessed at.
- `LanguageCode`, `LanguageRegistry`, `resolve_language()`,
  `resolve_languages()`, `canonicalise_tag()` and `slugify_name()`, exported
  from the package root.
- `DatasetRecord.language_tags`, `.language_codes` and `.language_note`, and a
  `LanguageRecord` carrying `tag`, `iso639_3`, `region`, `scope`, `type`,
  `aliases`, `country_codes` and `tasks` alongside its counts.
- `Row.language_tag`, resolved from the row's own `language_tag`, `language_iso`
  or `language` column, taking the first that resolves to exactly one tag, and
  otherwise from the catalogue record only when that record names exactly one
  language, so a row of a multilingual corpus is never attributed to whichever
  language the record happens to list first. `Row.language_iso` is that tag's
  bare code, or the code the source stated kept verbatim when ngano cannot place
  it, and `Row.language` keeps the source's own value.
- `Filter`, mirroring the `/datasets` query parameters, buildable from keyword
  arguments or fluently, with `matches()`, `apply()` and `to_params()`.
  `commercial=True` means `"Yes"`, and `include_purchasable=True` widens it to
  `"Yes, if purchased"`. `language` and `iso` accept tags, bare codes and names
  alike and are OR'd into one set of tags, and
  `Filter.resolved_language_tags()` reports what a filter will match.
- `load()`, streaming canonical rows across every matching dataset at once, with
  `round_robin`, `sequential` and `weighted_by_hours` interleaving, a row
  `limit`, and `stream.matched` and `stream.loadable` counts. It warns once when
  far fewer matched records are streamable than matched.
- `load_dataset()`, streaming one Hugging Face repo with the same canonical rows,
  including repos that are not in the catalogue.
- `Row` and `AudioRef` dataclasses for the canonical schema shared by every ngano
  SDK. `AudioRef.read()` fetches bytes only when called, and `AudioRef.decode()`
  raises a clear error naming the `ngano[audio]` extra when soundfile is missing.
- Column mapping from `field_map.json` in the specified order: repo overrides,
  runtime alias matching that ignores case, underscores and hyphens, unit hint
  conversions, extras preserved in `Row.extra`, and the drop list discarded. An
  unrecognised schema never raises; the reason lands in
  `Row.extra["_ngano_unmapped"]`.
- Token resolution from the `hf_token` argument, then `HF_TOKEN`, then
  `HUGGING_FACE_HUB_TOKEN`, then anonymous access, and `GatedDatasetError`
  naming the repo and its access request URL instead of a raw 401.
- `ngano` command line interface built on argparse with `search`, `show`,
  `countries`, `languages`, `stats` and `load`, and `--json` on every command.
  `ngano languages` lists tags with their codes and names, `ngano show` prints a
  record's tags, and `--include-varieties` widens a bare code.
- `sync_data.py` and a hatchling build hook that copy the repository data files
  into the package at build time, with a `--check` mode for CI.
- `snippets.json`, the copy-pasteable Python examples the website and the MCP
  `get_loader_snippet` tool serve, checked in CI against the shipped API.
- Full type hints, a `py.typed` marker, and an offline pytest suite.

[0.1.0]: https://github.com/thisisisheanesu/ngano/releases/tag/python-v0.1.0
