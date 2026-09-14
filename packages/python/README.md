# ngano

**Open catalogue and streaming loader for African-language speech datasets.**

`ngano` (Shona: folk stories, the oral tradition) catalogues 612 speech and text
corpora for African languages, and streams the 283 of them that live on Hugging
Face through one canonical row schema. One loop can read across datasets that
agree on nothing: different column names, different units, different splits.

The catalogue ships inside the package. `Catalogue()` works offline, with no
network and no Hugging Face token.

```bash
pip install ngano            # catalogue plus streaming loader
pip install "ngano[audio]"   # adds soundfile and numpy for AudioRef.decode()
pip install "ngano[all]"     # everything
```

## The catalogue

```python
from ngano import Catalogue

cat = Catalogue()                 # bundled snapshot, offline
cat = Catalogue.from_api()        # live from https://ngano.dev/api/v1

cat.datasets(language="sna", commercial=True, task="ASR")
cat.get("waxal-corpus-paper")     # also accepts a repo id: cat.get("google/fleurs")
cat.search("parliament")
cat.countries()
cat.languages()
cat.language_codes()             # the ISO 639-3 registry filters resolve through
cat.resolve_language("isiZulu")  # -> "zul"
cat.stats()
```

Every record is a `DatasetRecord` with the catalogue fields: `id, name, task,
variety, languages, languages_clean, language_tags, language_codes, iso,
countries, country_codes, regions, hours, hours_num, speakers, recording_type,
quality, labelled, domain, licence, licence_class, commercial, access, host,
url, hf_repo, year, notes, language_note, unverified_size`.

`languages` keeps each source's own spelling, `languages_clean` the canonical
display names, and `language_tags` the BCP 47 tags ngano filters on.
`language_codes` holds the bare ISO 639-3 codes behind those tags. The eleven
records whose source describes its coverage in prose, for example "~340 African
languages", carry no tags and explain themselves in `language_note`.

## Languages

A language is a BCP 47 tag whose primary subtag is an ISO 639-3 three-letter
code. An optional region subtag marks a country-specific variety, so Shona is
`sna`, Nigerian English is `eng-NG` and Mozambican Portuguese is `por-MZ`. There
are 315 tags, 27 of them regional.

Any filter, lookup or CLI flag that takes a language accepts three spellings,
resolved in this order, first match wins:

1. an exact tag, case insensitively, canonicalised to a lowercase primary
   subtag and an uppercase region, so `sna`, `SNA`, `eng-NG` and `eng-ng` all
   land on the same key;
2. a bare ISO 639-3 code that exists only as regional varieties, which resolves
   to those varieties, since there is nothing else it could mean;
3. a name from the registry aliases, case insensitively, in its plain or its
   slugified spelling, so `language="isiZulu"` still finds `zul`.

A tag always beats a name. The one collision in the catalogue is `tem`, which is
the tag of Timne and also the name of `kdh`, and the tag wins.

A bare code never widens to its regional varieties on its own. Ask for that with
`include_varieties=True`, which returns the bare tag first and then every
`<code>-*` in registry order. A value that already names a regional variety has
nothing to widen to, so `include_varieties` leaves it alone, whether it was given
as a tag or as a name. A value that resolves to nothing matches nothing, because
ngano does not guess.

```python
from ngano import resolve_language

resolve_language("SNA")                            # ["sna"]
resolve_language("isiZulu")                        # ["zul"]
resolve_language("eng", include_varieties=True)    # ["eng", "eng-NG", "eng-ZA", ...]
resolve_language("Nigerian English", include_varieties=True)   # ["eng-NG"], nothing to widen
resolve_language("Many African languages")         # []

cat.datasets(language="eng-NG")                    # Nigerian English only
cat.datasets(language="eng", include_varieties=True)
```

`cat.languages()` returns a `LanguageRecord` per tag with `tag, iso639_3,
region, name, scope, type, aliases, slug, datasets, hours, countries,
country_codes, tasks`. Hours are apportioned evenly across each record's tags
and exclude the unverified figures. `cat.language("Shona")`, `cat.language("sna")`
and `cat.language("SNA")` all return the same record.

Hours are reproduced as each source published them. Self-reported figures of
20,000 hours or more carry `unverified_size: true` and are excluded from every
total that ngano computes, in `stats()`, in `countries()` and in `languages()`.
`record.countable_hours` is the figure that may be summed.

## Filters

A `Filter` mirrors the query parameters of `GET /api/v1/datasets`. Values inside
one parameter are OR'd, and parameters are AND'd. Build it with keywords or
fluently, whichever reads better:

```python
from ngano import Filter

Filter(language=["sna", "nde"], country="ZW", task="ASR", commercial=True)
Filter().language("sna", "nde").country("ZW").task("ASR").commercial()
```

`commercial=True` means `commercial == "Yes"`. Add `include_purchasable=True` to
also accept `"Yes, if purchased"`:

```python
cat.datasets(commercial=True, include_purchasable=True)
```

Other parameters: `q, iso, region, variety, licence_class, access, labelled,
quality, domain, host, hf_only, min_hours, max_hours, has_hours,
include_varieties, sort`. `iso` is the code-shaped spelling of `language`, and
the two are OR'd into one set of tags rather than AND'd.
`Filter.resolved_language_tags()` shows exactly which tags a filter will match,
and `Filter.to_params()` serialises to the HTTP query string if you want to call
the API yourself.

## Streaming

```python
from ngano import load

stream = load(
    language=["Shona", "Ndebele"],
    country="ZW",
    commercial=True,
    task="ASR",
    split="train",
    streaming=True,
    hf_token=None,
    limit=None,
    interleave="round_robin",
)

print(stream.matched, "datasets matched,", stream.loadable, "can be streamed")

for row in stream:
    print(row.transcript, row.language, row.duration_s)
    if row.audio:
        print(row.audio.url, row.audio.path, row.audio.sampling_rate)
    break        # nothing further is fetched
```

Nothing is materialised. Each dataset is opened with
`datasets.load_dataset(..., streaming=True)`, and rows are mapped as they
arrive. Breaking out of the loop leaves the rest of every dataset untouched.

`stream.matched` is how many catalogue records satisfied the filter, and
`stream.loadable` is how many of those have a Hugging Face repo. Only those can
be streamed; the rest are catalogued sources you have to obtain from their host.
When the gap is large, `load()` warns once. Pass `hf_only=True` to filter them
out up front.

### Interleaving

- `round_robin` (default): one row from each dataset in turn.
- `sequential`: one dataset to exhaustion, then the next.
- `weighted_by_hours`: rows in proportion to each corpus's published hours,
  deterministic, no randomness.

`datasets.interleave_datasets` is used when the datasets share one schema, which
is what that function requires. Otherwise ngano round robins them itself. Either
way the merge is lazy.

### One repo at a time

```python
from ngano import load_dataset

for row in load_dataset("google/fleurs", config="sw_ke", limit=5):
    print(row.language_tag, row.language_iso, row.transcript)
```

A repo that is not in the catalogue still streams. `row.dataset_id`,
`row.licence` and the other catalogue fields are then `None`.

## The canonical row

Every row is a `Row` dataclass, identical across the Python, JavaScript and Rust
SDKs:

| field | type | meaning |
| --- | --- | --- |
| `audio` | `AudioRef \| None` | lazy handle, never decoded by default |
| `transcript` | `str \| None` | reference text |
| `language` | `str \| None` | language name as the source labels it, else the catalogue's canonical name |
| `language_iso` | `str \| None` | bare ISO 639-3 code, see below |
| `language_tag` | `str \| None` | BCP 47 tag, for example `sna` or `eng-NG`, see below |
| `country` | `str \| None` | ISO 3166-1 alpha-2 |
| `speaker_id` | `str \| None` | speaker id within the dataset |
| `gender` | `str \| None` | as stated by the source, never inferred |
| `age` | `str \| None` | as stated by the source, never inferred |
| `duration_s` | `float \| None` | seconds |
| `sampling_rate` | `int \| None` | Hz |
| `domain` | `str \| None` | recording domain |
| `split` | `str` | split name |
| `dataset_id` | `str \| None` | ngano catalogue id |
| `hf_repo` | `str \| None` | Hugging Face repo |
| `licence` | `str \| None` | licence from the catalogue |
| `source_url` | `str \| None` | canonical dataset URL |
| `extra` | `dict` | every column ngano did not map |

`row.to_dict()` gives a JSON-serialisable dict. Audio bytes are never included.

### How a row gets its language

`language_tag` is, in order:

1. the row's own `language_tag`, `language_iso` or `language` column, taking the
   first that resolves to exactly one tag;
2. otherwise the catalogue record's tag, but only when that record names exactly
   one language;
3. otherwise `None`.

A row from a forty language corpus is not attributed to one language just
because the record lists that language first, so a silent row of a multilingual
record has `language_tag=None`.

`language_iso` is the bare primary subtag of `language_tag` when the row's own
value resolved, otherwise the code the source stated kept verbatim when ngano
cannot place it, so an ISO 639-1 `sw` survives as `"sw"`, otherwise the record's
code when it names one language. `language` always keeps the source's own
spelling, falling back to the canonical name of a single-language record.

## Lazy audio

```python
row.audio.url            # remote location, if the source gave one
row.audio.path           # local or archive-relative path
row.audio.sampling_rate  # Hz, as stated by the source

data = row.audio.read()        # fetches bytes only now
array, sr = row.audio.decode() # needs pip install "ngano[audio]"
```

`decode()` raises a clear `ImportError` naming the `ngano[audio]` extra when
soundfile is not installed. Building a row never reads, downloads or decodes
anything.

## Column mapping

Datasets do not agree on column names, so ngano maps them in one fixed order,
the same in every SDK:

1. `overrides[hf_repo]` from `field_map.json`, for repos that were checked by hand.
2. runtime inspection of the dataset's real columns against `aliases`, matched
   case-insensitively and ignoring underscores and hyphens, so `Client_ID`,
   `client-id` and `clientid` are the same column.
3. `unit_hints` conversions, so a `duration_ms` column of 2500 becomes
   `duration_s == 2.5`.
4. anything still unmapped is preserved in `row.extra`, never dropped silently.
5. columns in the `drop` list are discarded rather than kept as extras.

An unknown schema never raises. `transcript` and `audio` stay `None` and the
reason is recorded in `row.extra["_ngano_unmapped"]`, naming the columns that
were seen. `stream.plans` shows how each repo was mapped once it has opened.

## Authentication

ngano itself needs no credentials. A token is only used for gated Hugging Face
repos, resolved in this order: the `hf_token` argument, then `HF_TOKEN`, then
`HUGGING_FACE_HUB_TOKEN`, then anonymous access. A gated repo raises
`GatedDatasetError` naming the repo and the page where access is requested,
rather than a raw 401.

## Command line

```bash
ngano search parliament --limit 5
ngano search --language sna --task ASR --commercial --json
ngano search --language isiZulu                    # a name works too
ngano search --language eng --include-varieties    # eng plus every eng-* variety
ngano show google/fleurs
ngano countries --region "Southern Africa"
ngano languages --min-datasets 10                  # tag, code, name, counts
ngano stats --json
ngano load --language sna --hf-only --limit 20 --out rows.jsonl
ngano load --language sna --hf-only --dry-run
```

`--json` works on every command, before or after the subcommand. `--api` reads
the live API instead of the bundled snapshot. `ngano languages` lists one line
per tag, with the bare ISO 639-3 code and the canonical name, and `ngano show`
prints a record's `language_tags` and `language_codes`.

## Updating the bundled data

The wheel carries a snapshot of `catalogue.json`, `countries.json`,
`languages.json`, `language_codes.json` and `field_map.json` copied from the
repository root. The
hatchling hook in `hatch_build.py` runs the copy during `python -m build`, so a
normal build is always current. To refresh it by hand, or to check for drift in
CI:

```bash
python sync_data.py            # copy data/*.json into src/ngano/data/
python sync_data.py --check    # exit 1 if the snapshot is stale
```

## Snippets for the website

`snippets.json` holds the Python examples that ngano.dev and the MCP
`get_loader_snippet` tool serve, with `{{LANGUAGE}}`, `{{COUNTRY_ISO2}}`,
`{{COUNTRY_NAME}}`, `{{DATASET_ID}}`, `{{HF_REPO}}`, `{{CONFIG}}` and `{{TASK}}`
as the substitution tokens. Each token is described in `placeholder_docs`.
`{{LANGUAGE}}` is a BCP 47 tag such as `sna`, never a display name, because that
is what the filters take, and the website and the MCP server substitute a tag.
The test suite substitutes real values and compiles every snippet, and runs the
offline ones, so they cannot drift from this API.

## Development

```bash
pip install -e ".[dev,audio]"
pytest          # the whole suite is offline, no network, no token
mypy            # strict, on the public surface
```

## Licences and credits

Code MIT. Catalogue data CC-BY-4.0. By Isheanesu Nigel Misi.
The catalogue is a list of sources, with figures as published by each source and
unverified ones flagged. It is not a claim that every corpus is usable, legal
for your purpose, or of the quality its publisher states.
