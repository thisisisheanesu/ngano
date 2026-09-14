# Contributing

The most valuable contribution to ngano is not code. It is a correct dataset
record with a primary source behind it, or a correction to one that is wrong.

The full guide lives in `CONTRIBUTING.md` at the repository root. This page is
the short version plus the parts you are most likely to need.

## The evidence bar

1. **A primary source URL is required.** The dataset's own landing page, its
   paper, its Hugging Face card, its repository. Not a blog post about it, not
   an aggregator listing.
2. **Never guess hours.** If the source states no size, `hours` and `hours_num`
   are both `null`. Do not compute hours from file counts, do not average, do
   not round a "roughly" into a number.
3. **`null` beats an estimate, every time.** Same for `speakers`, `year`,
   `recording_type` and `hf_repo`.
4. **`Unstated` beats a guess** for the controlled-vocabulary fields. 374 of the
   current records say `quality: Unstated` and that is the correct answer for
   them.
5. **Self-reported sizes at or above 20,000 hours set `unverified_size: true`,**
   which keeps the record and removes it from every hours total. See
   [Methodology](methodology.md#why-unverified-figures-are-excluded).
6. **Quote, do not paraphrase, in `hours`.** It holds the size as the source
   writes it, qualifiers included.
7. **Never infer speaker attributes.** Gender, age and country are recorded only
   where the source states them.

If you cannot meet the bar, open the record anyway with the gaps left null and
an explanation in `notes`. That is still a useful contribution.

## Two routes

**Open an issue.** The dataset submission form captures every field and
validates the controlled vocabularies. The correction form needs the dataset id,
what is wrong, what it should say, and the URL that proves it. Use these if you
would rather not edit JSON.

**Open a pull request** against `data/catalogue.json`, then run:

```bash
python scripts/validate_catalogue.py
python scripts/stats.py
```

Both must pass. CI runs the validator on every pull request that touches `data/`.

Remember that `country_codes` and `regions` are derived from `countries`. The
validator recomputes them, so a hand-authored value that disagrees fails the
build. Field meanings are in [Schema](schema.md).

## Adding a Hugging Face column mapping

`data/field_map.json` is what lets one loader read hundreds of differently
shaped datasets. The resolution order is explained in
[Loading datasets](loading.md#how-column-mapping-works).

**Add an alias** when a column name is a generic synonym that would help many
datasets:

```json
"transcript": ["sentence", "text", "transcription", "your_new_alias"]
```

**Add an override** when one specific repo needs specific handling:

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
unit:

```json
"duration_ms": { "canonical": "duration_s", "multiply": 0.001 }
```

Never add a column to `drop` just because you do not need it. `drop` is for
columns that are noise for every user. Anything merely unmapped already lands in
`extra`, where a caller can reach it.

After any change to `field_map.json`, run the loader tests in all three
packages. They share fixtures, so a mapping change that breaks one breaks the
build.

## Development

Everything runs from the top-level `Makefile`.

```bash
make install    # set up all four packages
make validate   # check the catalogue and the generated README section
make test       # every test suite
make lint       # every linter
make dev        # run the Worker locally, API and MCP and site
make dev-docs   # serve this documentation with live reload
```

Per package:

```bash
cd packages/python && pip install -e ".[dev,hf]" && pytest && mypy src/ngano
cd packages/js     && npm ci && npm test && npm run typecheck
cd packages/rust   && cargo test && cargo clippy --all-targets -- -D warnings
cd worker          && npm ci && npm test && npm run typecheck
```

Python 3.9 to 3.13, Node 18 to 22, Rust stable and MSRV 1.74. Unit tests run
offline against fixtures, with no network calls.

## House rules

- Behaviour shared across the SDKs stays the same in all three. Change the
  loader in one language, change it in the other two in the same pull request,
  or explain why not.
- No em dashes in prose. Commas or full stops. This is the author's standing
  preference.
- No TODO comments, no stubbed functions, no commented-out code.
- Update `CHANGELOG.md` under Unreleased.
- Code contributions are MIT, catalogue contributions are CC BY 4.0, matching the
  repository.
