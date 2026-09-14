# Contributing to ngano

Thank you for helping. The most valuable contribution to this project is not
code, it is a correct dataset record with a primary source behind it.

By contributing you agree that your code contributions are licensed MIT and
your catalogue contributions are licensed CC BY 4.0, matching the repository.

- [Adding or correcting a dataset record](#adding-or-correcting-a-dataset-record)
- [The evidence bar](#the-evidence-bar)
- [Field meanings](#field-meanings)
- [Adding a Hugging Face column mapping](#adding-a-hugging-face-column-mapping)
- [Development setup](#development-setup)
- [Pull request checklist](#pull-request-checklist)

## Adding or correcting a dataset record

You have two routes.

**Open an issue.** Use the
[dataset submission form](https://github.com/thisisisheanesu/ngano/issues/new?template=dataset_submission.yml)
or the [correction form](https://github.com/thisisisheanesu/ngano/issues/new?template=correction.yml).
The forms ask for every field and validate the controlled vocabularies. This is
the preferred route if you are not comfortable editing JSON.

**Open a pull request.** Add or edit one object in `data/catalogue.json`, then:

```bash
python scripts/validate_catalogue.py
python scripts/stats.py
```

Both must pass before you push. `validate_catalogue.py` exits non-zero on any
problem and CI runs it on every pull request that touches `data/`.

Rules for editing `data/catalogue.json`:

- One record per dataset, one pull request per logical change.
- Keep the file's existing key order and two-space indentation.
- `id` is a lowercase hyphenated slug derived from the name, and it is
  permanent. Never renumber or reuse one.
- `country_codes` and `regions` are **derived** from `countries`. The validator
  recomputes them, so do not hand-author a value that disagrees.
- A record whose only country is `Pan-African` has an empty `country_codes` and
  an empty `regions`.
- `languages_clean` is the filtered view of `languages` that resolves against
  `data/languages.json`. If a language is not in that index yet, leave it out of
  `languages_clean` rather than inventing an entry.

## The evidence bar

This is the part that matters.

1. **A primary source URL is required.** The dataset's own landing page, its
   paper, its Hugging Face card, its repository. Not a blog post about it, not
   an aggregator listing, not a tweet. If the only evidence is secondary, say so
   in `notes` and expect the record to be marked `access: Unclear`.
2. **Never guess hours.** If the source does not state a size, `hours` and
   `hours_num` are both `null`. Do not compute hours from file counts, do not
   average, do not round up a "roughly" into a number.
3. **`null` beats an estimate, every time.** The same applies to `speakers`,
   `year`, `recording_type` and `hf_repo`. An honest gap is more useful than a
   plausible invention, because a reader can go and fill a gap.
4. **`Unstated` beats a guess** for the controlled-vocabulary fields. `quality`,
   `labelled`, `commercial` and `licence_class` all have an `Unstated` value.
   Use it. 374 of the current records say `quality: Unstated` and that is the
   correct answer for them.
5. **Self-reported sizes at or above 20,000 hours set `unverified_size: true`.**
   Those records stay in the catalogue and stay out of every hours total. The
   validator enforces this in both directions.
6. **Quote, do not paraphrase, in `hours`.** `hours` holds the size as the
   source writes it, qualifiers included, for example
   `"65072 total (all 88 languages)"`. `hours_num` holds the number parsed out of
   it.
7. **Never infer speaker attributes.** Gender, age and country are recorded only
   where the source states them. This applies to the loader as well as the
   catalogue.

If you cannot meet the bar, open the record anyway with the gaps left null and
an explanation in `notes`. That is a useful contribution.

## Field meanings

| Field | Type | What goes in it |
| --- | --- | --- |
| `id` | string | Permanent lowercase hyphenated slug, unique across the catalogue |
| `name` | string | Dataset title as the publisher writes it |
| `task` | enum | `ASR`, `TTS`, `ASR+TTS`, `Raw source`, `Other`. What the data is usable for as released |
| `variety` | enum | `Indigenous`, `Accented foreign`, `Creole/Pidgin`, `Code-switch` |
| `languages` | string[] | Language names exactly as the source lists them |
| `languages_clean` | string[] | Those names normalised against `data/languages.json`. May be shorter, never longer |
| `iso` | string[] | ISO 639 codes the source states. Do not look codes up yourself if the source gives none |
| `countries` | string[] | Names matching `data/countries.json`, or the literal `Pan-African` |
| `country_codes` | string[] | Derived: the alpha-2 codes of `countries`, in order, Pan-African omitted |
| `regions` | string[] | Derived from `countries` |
| `hours` | string or null | Size verbatim from the source, with its qualifiers |
| `hours_num` | number or null | The number parsed out of `hours` |
| `speakers` | string or null | Speaker count or description as published |
| `recording_type` | string or null | read, spontaneous, telephone, broadcast, and so on, in the source's words |
| `quality` | enum | `Studio (44.1–48 kHz)`, `Standard (16 kHz)`, `Broadcast`, `Crowdsourced / web`, `Narrowband (8 kHz)`, `Unstated`. The dash in the studio value is an en dash, copy the value rather than retyping it |
| `labelled` | enum | `Transcribed`, `Unlabelled`, `Unstated` |
| `domain` | string | Subject domain, for example `Read speech`, `Broadcast news`, `Call centre / telephony` |
| `licence` | string | Licence string as published, or `Unstated` |
| `licence_class` | enum | The bucket used for filtering, see `data/schema.json` for the twelve values |
| `commercial` | enum | `Yes`, `Yes, if purchased`, `No`, `Unstated` |
| `access` | enum | `Open`, `Request`, `Paid`, `Scrape required`, `Unclear` |
| `host` | string | Where it lives: HuggingFace, OpenSLR, SADiLaR, LDC, a broadcaster, a university |
| `url` | string or null | Primary source URL. Null only when no stable public page exists, and `notes` must say why |
| `hf_repo` | string or null | `owner/name` on the Hub. Must appear inside `url` when both are set |
| `year` | string or null | Four-digit publication or last-release year |
| `notes` | string | Caveats, what the figures mean, why a field is null. Never empty |
| `unverified_size` | boolean | True exactly when `hours_num` is 20,000 or more and self-reported |

The machine-readable version of all of this is `data/schema.json`, a JSON Schema
2020-12 document. It is the authority, this table is the explanation.

## Adding a Hugging Face column mapping

`data/field_map.json` is what lets one loader read hundreds of differently shaped
datasets. The mapping order is identical in all three SDKs:

1. `overrides[hf_repo]`, if the repo has an entry
2. runtime inspection of the dataset's real columns against `aliases`, matched
   case-insensitively and ignoring underscores and hyphens
3. `unit_hints` conversions, for example `duration_ms` into `duration_s`
4. anything still unmapped is preserved under `extra`
5. columns listed in `drop` are discarded

**Add an alias** when a column name is a generic synonym that would help many
datasets. Put it in the right `aliases` list, lowercase, and keep the list
roughly ordered from most to least common:

```json
"transcript": ["sentence", "text", "transcription", "your_new_alias"]
```

**Add an override** when a specific repo needs specific handling, for instance
because it uses a common word for an uncommon purpose:

```json
"overrides": {
  "owner/dataset-name": {
    "transcript": "orthographic_text",
    "speaker_id": "spk",
    "language": "lang",
    "audio": "audio",
    "verified": true
  }
}
```

Set `"verified": true` only if you have actually loaded the dataset and seen the
columns. An unverified override is worse than none, because it silences the
runtime inspection that would otherwise have got it right.

**Add a unit hint** when a source column carries the right quantity in the wrong
unit. Give the canonical target and the multiplier:

```json
"duration_ms": { "canonical": "duration_s", "multiply": 0.001 }
```

Never add a column to `drop` just because you do not need it. `drop` is for
columns that are noise for every user, such as `__index_level_0__`. Anything
merely unmapped already ends up in `extra`, where a caller can reach it.

After any change to `field_map.json`, run the loader tests in all three packages.
The three implementations are tested against the same fixtures, so a mapping
change that breaks one breaks the build.

## Development setup

Everything is driven from the top-level `Makefile`. `make install` sets up all
four packages, `make test` runs everything, `make validate` checks the data.

### Python (`packages/python`)

```bash
cd packages/python
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,hf]"
pytest
mypy src/ngano
ruff check .
```

Supported versions are 3.9 to 3.13. Unit tests run offline with no network
calls, against fixtures. Anything that needs the Hub is marked and skipped by
default.

### JavaScript and TypeScript (`packages/js`)

```bash
cd packages/js
npm ci
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run lint
```

Supported runtimes are Node 18, 20 and 22. The package is ESM, ships its own
types, and must stay free of Node-only APIs in the paths that run in a browser
or a Worker.

### Rust (`packages/rust`)

```bash
cd packages/rust
cargo test
cargo clippy --all-targets --all-features -- -D warnings
cargo fmt --check
```

MSRV is 1.74 and CI builds on it as well as stable. Do not raise the MSRV in a
pull request that is about something else.

### Worker (`worker`)

```bash
cd worker
npm ci
npm run dev        # wrangler dev, serves the API and MCP locally
npm test
npm run typecheck
```

`worker/.dev.vars.example` shows the local variables. Deployment is automatic
from `main` and needs no manual step.

### Docs

```bash
pip install mkdocs mkdocs-material
mkdocs serve
```

## Pull request checklist

Copy this into your pull request, it is also in the template.

- [ ] One logical change. Catalogue edits are separate from code changes.
- [ ] `python scripts/validate_catalogue.py` passes, if `data/` changed.
- [ ] Every new or corrected record cites a primary source URL.
- [ ] No guessed hours, speaker counts or years. `null` where the source is silent.
- [ ] `unverified_size` set on any self-reported figure of 20,000 hours or more.
- [ ] Controlled vocabulary values copied exactly, including the
      en dash in `Studio (44.1–48 kHz)`.
- [ ] Tests added or updated, and `make test` passes for the packages you touched.
- [ ] `make lint` passes.
- [ ] Docs updated if behaviour changed, including `docs/` and the README.
- [ ] `python scripts/render_readme_credits.py --check` passes if `data/credits.json` changed.
- [ ] `CHANGELOG.md` updated under Unreleased.
- [ ] No em dashes in prose. The author's standing preference is commas or full stops.
- [ ] No TODO comments, no stubbed functions, no commented-out code.

Behaviour that is the same in all three SDKs must stay the same in all three. If
you change the loader in one language, change it in the other two in the same
pull request, or explain why not.
