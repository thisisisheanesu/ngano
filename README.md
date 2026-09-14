# ngano

**A catalogue and a unified loader for African-language speech datasets.**

[![PyPI](https://img.shields.io/pypi/v/ngano?label=pypi%20ngano)](https://pypi.org/project/ngano/)
[![npm](https://img.shields.io/npm/v/ngano?label=npm%20ngano)](https://www.npmjs.com/package/ngano)
[![crates.io](https://img.shields.io/crates/v/ngano?label=crates.io%20ngano)](https://crates.io/crates/ngano)
[![CI](https://github.com/thisisisheanesu/ngano/actions/workflows/ci.yml/badge.svg)](https://github.com/thisisisheanesu/ngano/actions/workflows/ci.yml)
[![Code licence: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](LICENSE)
[![Data licence: CC BY 4.0](https://img.shields.io/badge/data-CC--BY--4.0-blue.svg)](LICENSE-DATA)

`ngano` is Shona for folk stories, the oral tradition told aloud and later written down.

Finding speech data for an African language means reading papers, chasing dead
links, emailing universities and guessing at licences. ngano does that work once
and keeps the result in one place: **611 datasets**, **421 languages**,
**57 countries**, with a public API, an MCP server, and one loader API in three
languages that streams any Hugging Face dataset in the catalogue into the same
row shape.

Everything is public and unauthenticated. No API key, no sign-up, no rate-limit token.

- Site and API: <https://ngano.dev>
- API base: `https://ngano.dev/api/v1`
- MCP endpoint: `https://ngano.dev/mcp`

## The numbers

Regenerate all of these with `python scripts/stats.py`.

| | |
| --- | --- |
| Datasets catalogued | 611 |
| Languages indexed | 421 |
| African countries covered | 57 of 58 indexed |
| Pan-African (multi-country) records | 78 |
| Verified hours of audio | 110,750 |
| Records with a stated size | 238 |
| Records loadable from the Hugging Face Hub | 283 |
| Open access | 441 |
| Open **and** transcribed | 351 |
| Commercial use permitted by the licence | 204 |
| Records excluded from hours totals as unverified | 3 |

Hours totals exclude three records whose publishers self-report 20,000 hours or
more without independent confirmation. They are still in the catalogue, flagged
with `unverified_size: true`, and every count above treats them as datasets but
not as hours.

## Install

```bash
pip install ngano                 # Python 3.9+
npm install @thisisisheanesu/ngano                 # Node 18+, also works in Deno and the browser
cargo add ngano                   # Rust, MSRV 1.74
```

The loader needs the Hugging Face Hub for datasets that live there. Install the
Python extra with `pip install "ngano[hf]"` if you want dataset streaming as
well as catalogue access.

## Quickstart

### Python

```python
from ngano import Catalogue, load

cat = Catalogue.load()                       # bundled snapshot, no network
shona = cat.search(language="Shona", access="Open", has_hours=True)
for d in shona:
    print(d.id, d.hours_num, d.licence)

rows = load(shona, split="train")            # lazy, interleaved, nothing downloaded yet
for row in rows.take(5):
    print(row.language, row.duration_s, row.transcript[:60])
```

### JavaScript and TypeScript

```js
import { Catalogue, load } from "@thisisisheanesu/ngano";

const cat = await Catalogue.load();
const shona = cat.search({ language: "Shona", access: "Open", hasHours: true });
for (const d of shona) console.log(d.id, d.hoursNum, d.licence);

let n = 0;
for await (const row of load(shona, { split: "train" })) {
  console.log(row.language, row.durationS, row.transcript?.slice(0, 60));
  if (++n === 5) break;                      // streaming, so break costs nothing
}
```

### Rust

```rust
use ngano::{Catalogue, Query, load};

fn main() -> anyhow::Result<()> {
    let cat = Catalogue::load()?;
    let shona = cat.search(&Query::new().language("Shona").access("Open").has_hours(true));
    for d in &shona { println!("{} {:?} {}", d.id, d.hours_num, d.licence); }

    for row in load(&shona).split("train").rows()?.take(5) {
        let row = row?;
        println!("{:?} {:?}", row.language, row.duration_s);
    }
    Ok(())
}
```

Gated or request-access repos need a Hugging Face token. Set `HF_TOKEN` in the
environment and all three loaders pick it up. See [examples/](examples/).

## HTTP API

Base `https://ngano.dev/api/v1`. JSON, `CORS: *`, cacheable, no auth.

| Endpoint | Returns |
| --- | --- |
| `GET /datasets` | filtered, paginated dataset list with `meta.total_hours` |
| `GET /datasets/{id}` | one dataset, 404 if unknown |
| `GET /countries` | every country with dataset, hour and language counts |
| `GET /countries/{iso2}` | one country plus its datasets and languages |
| `GET /languages` | every language in the index |
| `GET /languages/{slug}` | one language plus its datasets |
| `GET /stats` | global and per-facet aggregates |
| `GET /schema` | the field map used by all three loaders |
| `GET /openapi.json` | OpenAPI 3.1 document |
| `GET /healthz` | `{ok, version, datasets}` |

`/datasets` accepts `q, language, iso, country, region, task, variety,
commercial, licence_class, access, labelled, quality, domain, host, hf_only,
min_hours, max_hours, has_hours, sort, page, per_page, fields`. Repeated values
of one parameter are OR, different parameters are AND.

```bash
curl "https://ngano.dev/api/v1/datasets?country=ZW&access=Open&sort=-hours&per_page=5"
```

Full reference: [docs/api.md](docs/api.md).

## MCP

Streamable HTTP MCP at `POST https://ngano.dev/mcp`, protocol `2025-06-18`, no auth.

```json
{ "mcpServers": { "ngano": { "url": "https://ngano.dev/mcp" } } }
```

Tools: `search_datasets`, `get_dataset`, `list_countries`, `get_country`,
`list_languages`, `get_language`, `get_stats`, `get_loader_snippet`. Each
returns text content plus `structuredContent` against a declared `outputSchema`.
Full reference: [docs/mcp.md](docs/mcp.md).

## The canonical row

Every dataset the loader touches, from any of the three SDKs, yields the same row.

| Field | Type | Meaning |
| --- | --- | --- |
| `audio` | handle | `{url, path, bytes, sampling_rate}`, lazy, never decoded unless you ask |
| `transcript` | string or null | reference text |
| `language` | string or null | language name as the source labels it |
| `language_iso` | string or null | ISO 639 code where the source gives one |
| `country` | string or null | ISO 3166-1 alpha-2 |
| `speaker_id` | string or null | stable within the dataset |
| `gender` | string or null | as stated by the source, never inferred |
| `age` | string or null | as stated by the source, never inferred |
| `duration_s` | float or null | seconds |
| `sampling_rate` | int or null | Hz |
| `domain` | string or null | read, broadcast, clinical, and so on |
| `split` | string | source split name |
| `dataset_id` | string | ngano catalogue id |
| `hf_repo` | string | Hugging Face repo id |
| `licence` | string | licence from the catalogue |
| `source_url` | string | canonical URL |

Anything a source ships that does not map onto this list is kept under `extra`,
never dropped silently. Mapping rules and how to add one:
[docs/loading.md](docs/loading.md).

## What the catalogue covers

Hours exclude unverified records. A dataset spanning several regions is counted
in each.

| Region | Datasets | Hours | Languages |
| --- | ---: | ---: | ---: |
| West Africa | 208 | 55,251 | 322 |
| Southern Africa | 135 | 28,033 | 184 |
| East Africa | 101 | 27,493 | 86 |
| North Africa | 73 | 16,360 | 147 |
| Central Africa | 59 | 7,759 | 153 |
| Horn of Africa | 58 | 17,017 | 203 |
| Island states | 43 | 3,994 | 73 |

By task: ASR 346, Raw source 85, ASR+TTS 64, TTS 60, Other 57.
By variety: Indigenous 487, Accented foreign 64, Creole/Pidgin 37, Code-switch 24.
By access: Open 441, Request 87, Scrape required 47, Paid 37.
By labelling: Transcribed 454, Unlabelled 118, Unstated 40.

The ten most catalogued languages are Hausa (47 datasets), Amharic (44),
Lingala (44), Swahili (44), French (41), Oromo (35), Yoruba (33), Afrikaans (31),
Somali (31) and English (30). French and English appear because accented and
code-switched African varieties of them are in scope.

How the catalogue was built, and what was deliberately left out:
[docs/methodology.md](docs/methodology.md).

## Limitations

Read this before you quote a number from ngano in a paper.

- **The figures are the publishers' figures.** ngano records what each source
  states. It does not download, decode or measure the audio. Where a source
  states nothing, the field is `null` rather than an estimate.
- **373 of 611 records state no audio quality** and 252 state no licence. That
  is a fact about the field, not a gap in the catalogue.
- **Only 238 records state a size at all.** The 110,750 hour total is the sum of
  those, not the size of African speech data in the world.
- **Three records are excluded from hours totals** as self-reported at 20,000
  hours or more without confirmation. They are marked `unverified_size`.
- **283 of 611 records are loadable programmatically.** The rest live behind
  request forms, paywalls, broadcaster archives or scraping. The loader will not
  scrape anything for you.
- **Licence classes are a reading, not legal advice.** Check the source licence
  before you train on anything, especially for commercial use.
- **Language attribution follows the source.** Where a source says "Oromo" and
  means one of several varieties, ngano cannot tell you which.
- **Coverage is a snapshot.** Corrections and additions are welcome, see
  [CONTRIBUTING.md](CONTRIBUTING.md).

## Licences

- Code, in every package and this repository: **MIT**, see [LICENSE](LICENSE).
- The catalogue and the derived data files in `data/`: **CC BY 4.0**, see
  [LICENSE-DATA](LICENSE-DATA).
- The datasets themselves are **not** ngano's to license. Each one carries its
  own terms, recorded in the `licence` field. ngano points at other people's
  work, it does not redistribute it.

## Project

- [docs/](docs/) and <https://ngano.dev/docs> for the full documentation
- [CONTRIBUTING.md](CONTRIBUTING.md) to add or correct a record
- [SECURITY.md](SECURITY.md) to report a vulnerability
- [CHANGELOG.md](CHANGELOG.md) for release notes

## Credits

<!-- credits:start -->
<!-- Generated by scripts/render_readme_credits.py from data/credits.json. Do not edit by hand. -->

**Isheanesu Nigel Misi** (Ishe Misi)

_Building African language AI._

Works on speech and language models for African languages. ngano grew out of the search for training data that this catalogue documents.

| Where | Handle |
| --- | --- |
| GitHub | [thisisisheanesu](https://github.com/thisisisheanesu) |
| LinkedIn | [thisisisheanesu](https://www.linkedin.com/in/thisisisheanesu) |
| X | [thisisisheanesu](https://x.com/thisisisheanesu) |
| Hugging Face | [thisisisheanesu](https://huggingface.co/thisisisheanesu) |
| Website | [thisisisheanesu.com](https://thisisisheanesu.com) |

**ngano** is Shona for folk stories, the oral tradition told aloud and later written down.

### Acknowledgements

- Every dataset in this catalogue belongs to the teams who collected it. ngano only points at their work and records what they published about it.
- Digital Umuganda, Masakhane, Lacuna Fund, Mozilla Common Voice, SADiLaR, Makerere AI Lab, Sunbird AI, Intron Health, RobotsMali, Ghana NLP and the University of Zambia carry a disproportionate share of what exists.

### Citation

```bibtex
@software{ngano2026,
  title   = {ngano: a catalogue and unified loader for African-language speech datasets},
  author  = {Isheanesu Nigel Misi},
  year    = {2026},
  url     = {https://github.com/thisisisheanesu/ngano},
  license = {MIT}
}
```

<!-- credits:end -->
