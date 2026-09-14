# ngano — build contract

You are one of several agents building `ngano`, a production-ready open catalogue and data
loader for African-language speech (and later text) datasets.

Work ONLY inside the paths you are assigned.
Do not edit `SPEC.md`, `data/*.json`, or another agent's directory.

- Project name: `ngano` (Shona: folk stories, the oral tradition)
- Domain: `https://ngano.dev` (API base `https://ngano.dev/api/v1`, MCP at `https://ngano.dev/mcp`)
- Author: Isheanesu Nigel Misi. Credits come from `data/credits.json` — never hardcode handles.
- Licences: code MIT, catalogue data CC-BY-4.0.
- Everything is public and unauthenticated. No API keys, no auth, no rate-limit tokens.

## Data files (already built, read-only for you)

- `data/catalogue.json` — 612 dataset records. Fields:
  `id, name, task, variety, languages, languages_clean, iso, countries, country_codes,
   regions, hours, hours_num, speakers, recording_type, quality, labelled, domain,
   licence, licence_class, commercial, access, host, url, hf_repo, year, notes,
   unverified_size`
  - `task`: ASR | TTS | ASR+TTS | Raw source | Other
  - `commercial`: Yes | Yes, if purchased | No | Unstated
  - `labelled`: Transcribed | Unlabelled | Unstated
  - `access`: Open | Request | Paid | Scrape required | Unclear
  - `quality`: Studio (44.1–48 kHz) | Standard (16 kHz) | Broadcast | Crowdsourced / web |
    Narrowband (8 kHz) | Unstated
  - `hf_repo` is non-null for 283 records, e.g. `"google/fleurs"`.
  - `unverified_size: true` marks self-reported figures of 20,000+ hours. Exclude these
    from every hours total, everywhere, in every language.
- `data/countries.json` — 58 entries: `name, iso2, iso3, map_name, lat, lon, region, slug`
- `data/country_aliases.json` — catalogue string → canonical country name
- `data/languages.json` — 421 entries: `name, slug, iso, datasets, countries, hours`
- `data/africa.geo.json` — simplified GeoJSON, 51 polygons keyed by `properties.map_name`
  (matches `countries.json.map_name`). Island states have no polygon; use `lat`/`lon` points.
- `data/field_map.json` — canonical audio-row schema, column aliases, per-repo overrides.
- `data/credits.json` — author name, tagline, social links. May be a placeholder for now;
  read it at build/run time, never inline its values.

## Canonical unified row (all three SDKs MUST agree exactly)

    audio          lazy handle: {url, path, bytes, sampling_rate} — never decoded by default
    transcript     string | null
    language       string | null
    language_iso   string | null
    country        ISO-3166 alpha-2 string | null
    speaker_id     string | null
    gender         string | null      (as stated by the source, never inferred)
    age            string | null      (as stated by the source, never inferred)
    duration_s     float | null
    sampling_rate  int | null
    domain         string | null
    split          string
    dataset_id     ngano catalogue id
    hf_repo        string
    licence        string
    source_url     string

Mapping order, identical in all three SDKs:
1. `overrides[hf_repo]` from `field_map.json`
2. runtime inspection of the dataset's actual columns against `aliases`
   (case-insensitive, ignore underscores and hyphens when matching)
3. `unit_hints` conversions (e.g. `duration_ms` → `duration_s` × 0.001)
4. anything unmapped is preserved under an `extra` dict/map/struct, never silently dropped
5. columns in `drop` are discarded

Rows MUST stream. Never materialise a whole dataset. Multi-dataset loads interleave
lazily so a caller can `break` after N rows without downloading the rest.

## HTTP API (owned by the worker agent; SDK agents code against it)

Base `https://ngano.dev/api/v1`. JSON, CORS `*`, cache-friendly, no auth.

    GET /datasets            filters + pagination  -> {data:[...], meta:{page,per_page,total,total_pages,total_hours}}
    GET /datasets/{id}                             -> dataset object, 404 if unknown
    GET /countries                                 -> [{...country, datasets, hours, languages}]
    GET /countries/{iso2}                          -> country + its datasets + its languages
    GET /languages                                 -> [{...language}]
    GET /languages/{slug}                          -> language + its datasets
    GET /stats                                     -> global + per-facet aggregates
    GET /schema                                    -> contents of field_map.json
    GET /openapi.json                              -> OpenAPI 3.1 document
    GET /healthz                                   -> {ok:true, version, datasets}

`/datasets` query params (all optional, repeatable params are OR within a param and AND
across params, comma-separated also accepted):
`q, language, iso, country (iso2), region, task, variety, commercial, licence_class,
 access, labelled, quality, domain, host, hf_only (bool), min_hours, max_hours,
 has_hours (bool), sort (hours|name|year, prefix `-` for desc), page (1-based),
 per_page (default 50, max 200), fields (comma-separated projection)`

Errors: `{"error":{"code":"...","message":"...","status":400}}` with the matching HTTP status.

## MCP (owned by the worker agent)

Streamable HTTP MCP at `POST /mcp` (and `GET /mcp` for SSE), protocol version `2025-06-18`,
no auth. Implement `initialize`, `tools/list`, `tools/call`, `ping`, and `notifications/initialized`.
Tools: `search_datasets`, `get_dataset`, `list_countries`, `get_country`, `list_languages`,
`get_language`, `get_stats`, `get_loader_snippet` (returns ready-to-run Python/JS/Rust code
for the current filter). Every tool returns `content:[{type:"text",text:...}]` plus
`structuredContent`. Declare `outputSchema` on each tool.

## House rules

- Production quality: typed, linted, tested, documented, no TODOs, no placeholder logic,
  no stub functions that throw "not implemented".
- No em dashes in any prose you write (README, docstrings, site copy). Use commas or
  full stops. This is the author's standing preference.
- Never invent statistics. Derive every number from the data files at build or run time.
- Be honest in copy about what the data is: a catalogue of sources, with figures as
  published by each source and unverified ones flagged.
- Semver 0.1.0 for a first release across all three packages.
- Write a real test suite that runs offline, with no network calls in unit tests.
