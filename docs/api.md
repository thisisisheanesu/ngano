# HTTP API

Base URL: `https://ngano.dev/api/v1`

JSON in, JSON out. `Access-Control-Allow-Origin: *`. Cacheable. **No
authentication, no API key, no rate-limit token.** Anything that asks you for an
ngano credential is not ngano.

An OpenAPI 3.1 document is served at
[`/api/v1/openapi.json`](https://ngano.dev/api/v1/openapi.json), so you can
generate a client rather than reading this page.

## Endpoints

| Method and path | Returns |
| --- | --- |
| `GET /datasets` | filtered, paginated dataset list |
| `GET /datasets/{id}` | one dataset object, 404 if unknown |
| `GET /countries` | every country with counts |
| `GET /countries/{iso2}` | one country plus its datasets and languages |
| `GET /languages` | every language in the index |
| `GET /languages/{slug}` | one language plus its datasets |
| `GET /stats` | global and per-facet aggregates |
| `GET /schema` | the loader field map |
| `GET /openapi.json` | OpenAPI 3.1 document |
| `GET /healthz` | liveness and version |

## GET /datasets

```bash
curl "https://ngano.dev/api/v1/datasets?country=ZW&access=Open&sort=-hours&per_page=5"
```

```json
{
  "data": [ { "id": "...", "name": "...", "hours_num": 1200.0 } ],
  "meta": {
    "page": 1,
    "per_page": 5,
    "total": 23,
    "total_pages": 5,
    "total_hours": 4831.5
  }
}
```

`meta.total_hours` is the sum over the **whole filtered set**, not just the
current page, and it excludes records flagged `unverified_size`.

### Filters

All optional. A parameter may be repeated, or given a comma-separated list.
Values within one parameter are **OR**, different parameters are **AND**.

| Parameter | Type | Matches |
| --- | --- | --- |
| `q` | string | free text over name, languages, countries, notes |
| `language` | string | language name, as in `languages_clean` |
| `iso` | string | ISO 639 code from `iso` |
| `country` | alpha-2 | country code from `country_codes` |
| `region` | string | one of the seven regions |
| `task` | enum | `ASR`, `TTS`, `ASR+TTS`, `Raw source`, `Other` |
| `variety` | enum | `Indigenous`, `Accented foreign`, `Creole/Pidgin`, `Code-switch` |
| `commercial` | enum | `Yes`, `Yes, if purchased`, `No`, `Unstated` |
| `licence_class` | enum | one of the twelve licence classes |
| `access` | enum | `Open`, `Request`, `Paid`, `Scrape required`, `Unclear` |
| `labelled` | enum | `Transcribed`, `Unlabelled`, `Unstated` |
| `quality` | enum | one of the six quality bands |
| `domain` | string | domain string |
| `host` | string | host string |
| `hf_only` | bool | only records with an `hf_repo` |
| `min_hours` | number | `hours_num` at or above |
| `max_hours` | number | `hours_num` at or below |
| `has_hours` | bool | only records that state a size |

### Paging, sorting and projection

| Parameter | Default | Notes |
| --- | --- | --- |
| `page` | 1 | 1-based |
| `per_page` | 50 | maximum 200 |
| `sort` | relevance | `hours`, `name` or `year`, prefix `-` for descending |
| `fields` | all | comma-separated projection, for example `fields=id,name,hours_num` |

### Worked examples

Everything open, transcribed and commercially usable, largest first:

```bash
curl "https://ngano.dev/api/v1/datasets?access=Open&labelled=Transcribed&commercial=Yes&sort=-hours"
```

Hausa or Yoruba, on the Hub, at least 10 hours, ids and repos only:

```bash
curl "https://ngano.dev/api/v1/datasets?language=Hausa,Yoruba&hf_only=true&min_hours=10&fields=id,hf_repo"
```

Everything in the Horn of Africa that nobody has transcribed yet:

```bash
curl "https://ngano.dev/api/v1/datasets?region=Horn%20of%20Africa&labelled=Unlabelled"
```

## GET /datasets/{id}

```bash
curl https://ngano.dev/api/v1/datasets/afrispeech-200
```

Returns a single dataset object with all 27 fields, described in
[Schema](schema.md). 404 with an error body if the id is unknown.

## GET /countries and /countries/{iso2}

```bash
curl https://ngano.dev/api/v1/countries
curl https://ngano.dev/api/v1/countries/ZW
```

Each country carries `name`, `iso2`, `iso3`, `map_name`, `lat`, `lon`, `region`,
`slug`, plus `datasets`, `hours` and `languages` counts. The single-country
response adds the datasets and languages themselves.

`map_name` is null for island states that have no polygon in the simplified
GeoJSON. Use `lat` and `lon` to place them.

## GET /languages and /languages/{slug}

```bash
curl https://ngano.dev/api/v1/languages
curl https://ngano.dev/api/v1/languages/shona
```

Each language carries `name`, `slug`, `iso`, `datasets`, `countries` and `hours`.
The single-language response adds its datasets.

## GET /stats

```bash
curl https://ngano.dev/api/v1/stats
```

Global totals plus per-facet breakdowns by task, variety, access, labelling,
quality, licence class and region. These are the numbers on the site and in the
README. Hours everywhere exclude `unverified_size` records.

## GET /schema

Serves `data/field_map.json`: the canonical row, the column aliases, the unit
hints, the drop list and the per-repo overrides. This is the same document the
three SDKs use, so a client can implement its own loader against it. See
[Loading datasets](loading.md).

## GET /healthz

```json
{ "ok": true, "version": "0.1.0", "datasets": 612 }
```

Use `version` when filing a bug against the API or the MCP server.

## Errors

```json
{
  "error": {
    "code": "invalid_parameter",
    "message": "per_page must be between 1 and 200",
    "status": 400
  }
}
```

The HTTP status always matches `error.status`.

| Status | When |
| --- | --- |
| 400 | a parameter is malformed or out of range |
| 404 | an id, alpha-2 code or slug does not exist |
| 405 | wrong method on a valid path |
| 500 | a bug, please report it |

## Caching and etiquette

Responses are cacheable and served from Cloudflare's edge. Conditional requests
with `If-None-Match` are honoured.

There is no rate limit. Please do not make one necessary. If you want the whole
catalogue, fetch it once rather than paging through it every hour, or install a
package and use the bundled snapshot, which needs no network at all.
