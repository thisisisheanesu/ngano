# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each package is versioned together at the same number and released from its own
tag: `py-v0.1.0`, `js-v0.1.0`, `rs-v0.1.0`.

## [Unreleased]

## [0.1.0] - Unreleased

First public release.

### Added

- **Catalogue** of 611 African-language speech dataset records covering 421
  languages and 57 countries, built by a country-by-country sweep of all 54
  African countries plus pan-African and accented-variety passes. 768 raw
  records were de-duplicated to 612, then trimmed to 611. See `docs/methodology.md`.
- **`data/schema.json`**, a JSON Schema 2020-12 definition of the dataset record,
  with the controlled vocabularies for `task`, `variety`, `quality`, `labelled`,
  `commercial`, `access` and `licence_class`.
- **`data/field_map.json`**, the canonical audio-row schema, column aliases,
  unit hints and per-repo overrides shared by all three loaders.
- **Python package `ngano`** for Python 3.9 to 3.13: catalogue access, search,
  and a streaming loader that yields the canonical row.
- **JavaScript package `ngano`** for Node 18, 20 and 22, ESM with bundled types,
  same catalogue and loader API as async iterables.
- **Rust crate `ngano`**, MSRV 1.74, same catalogue and loader API as iterators.
- **HTTP API** at `https://ngano.dev/api/v1`: `/datasets`, `/datasets/{id}`,
  `/countries`, `/countries/{iso2}`, `/languages`, `/languages/{slug}`, `/stats`,
  `/schema`, `/openapi.json`, `/healthz`. Public, unauthenticated, CORS open.
- **MCP server** at `https://ngano.dev/mcp`, protocol `2025-06-18`, with
  `search_datasets`, `get_dataset`, `list_countries`, `get_country`,
  `list_languages`, `get_language`, `get_stats` and `get_loader_snippet`.
- **`scripts/validate_catalogue.py`**, which validates the catalogue against the
  schema and checks id uniqueness, country resolution, derived fields, URL
  shape, controlled vocabularies and `unverified_size` consistency.
- **`scripts/stats.py`**, which regenerates every headline figure in the README.
- **`scripts/render_readme_credits.py`**, which regenerates the README credits
  section from `data/credits.json`.
- **Documentation** under `docs/`, published with MkDocs.
- **Runnable examples** under `examples/` for all three languages.

### Notes

- Three records carry `unverified_size: true` and are excluded from every hours
  total. The verified total is 110,750 hours across 238 records that state a
  size.
- 283 of 611 records are loadable from the Hugging Face Hub. The rest require a
  request form, a purchase, or a visit to a host that ngano will not scrape.

[Unreleased]: https://github.com/thisisisheanesu/ngano/compare/py-v0.1.0...HEAD
[0.1.0]: https://github.com/thisisisheanesu/ngano/releases/tag/py-v0.1.0
