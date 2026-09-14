# ngano

Open catalogue and streaming loader for African-language speech datasets.

`ngano` (Shona: folk stories, the oral tradition) is a catalogue of published
speech corpora for African languages, plus a loader that streams rows out of the
ones hosted on Hugging Face and maps their very different column names onto one
canonical schema.

A snapshot of the catalogue is compiled into the crate, so browsing, filtering
and statistics work with no network at all.

```toml
[dependencies]
ngano = "0.1"
```

## Browse the catalogue, offline

```rust
use ngano::{Catalogue, Filter};

let cat = Catalogue::bundled()?;

let hits = cat.datasets(&Filter::new().language("sna").commercial(true).task("ASR"));
for d in &hits {
    println!("{} ({}, {})", d.name, d.licence, d.access);
}

let one = cat.get("waxal-corpus-paper");
let stats = cat.stats();
println!("{} datasets, {:.0} counted hours", stats.datasets, stats.hours);
println!("{} countries, {} languages", cat.countries().len(), cat.languages().len());

for d in cat.search("parliament") {
    println!("{}", d.id);
}
# Ok::<(), ngano::NganoError>(())
```

## Languages

A language here is a BCP 47 tag whose primary subtag is an ISO 639-3 code, so Shona is
`sna`. A region subtag marks a country-specific variety, so Nigerian English is `eng-NG`
and Mozambican Portuguese is `por-MZ`. Of the tags in the catalogue, 27 carry a region.

`Filter::language` takes a bare code, a tag or a name, in any case, and resolves it in
this order, first match wins:

1. an exact tag, canonicalised to a lowercase primary subtag and an uppercase region, so
   `sna`, `SNA`, `eng-NG` and `eng-ng` all land on the same entry,
2. a bare code that exists only as regional varieties, which resolves to those varieties,
   because there is nothing else it could mean,
3. a name from the registry aliases, plain or slugified, so `isiZulu`, `Zulu` and
   `isizulu` all reach `zul`.

A tag always beats a name. The one collision in the data is `tem`, which is the tag for
Timne and also the name of `kdh`, and the tag wins. A spelling the registry does not know
resolves to nothing at all, so a filter written on it keeps no records rather than
guessing at what was meant.

A bare code never picks up a regional variety on its own. Ask for that with
`include_varieties`, which yields the bare tag first and then every `<code>-*`:

```rust
use ngano::{Catalogue, Filter};

let cat = Catalogue::bundled()?;

assert_eq!(cat.resolve_language("isiZulu"), vec!["zul".to_string()]);
assert_eq!(cat.resolve_language("ENG-ng"), vec!["eng-NG".to_string()]);
assert!(cat.resolve_language("Klingon").is_empty());

let english = cat.datasets(&Filter::new().language("eng"));
let english_and_varieties = cat.datasets(&Filter::new().language("eng").include_varieties(true));
assert!(english_and_varieties.len() > english.len());

let zulu = cat.language("zul").expect("Zulu is catalogued");
println!("{} ({}), {} datasets", zulu.name, zulu.tag, zulu.datasets.unwrap_or_default());
# Ok::<(), ngano::NganoError>(())
```

`Filter::iso` is the code-shaped spelling of the same filter and resolves identically.
`Catalogue::language_codes` returns the whole ISO 639-3 registry compiled into the crate:
every tag, its bare code, its canonical name and every catalogue spelling of it. Each
dataset record carries `language_tags` in order, `language_codes` with the varieties
collapsed, and, on the handful of sources that describe their coverage in prose rather
than naming languages, a `language_note` saying so.

The live catalogue is one call away, and has the same shape:

```rust,no_run
# async fn run() -> Result<(), ngano::NganoError> {
let cat = ngano::Catalogue::from_api().await?;   // https://ngano.dev/api/v1
# Ok(()) }
```

## Stream rows

```rust,no_run
use futures::TryStreamExt;
use ngano::{Filter, Interleave, Loader};

# async fn run() -> Result<(), ngano::NganoError> {
let mut stream = Loader::new()
    .filter(Filter::new().language("sna").country("ZW").commercial(true))
    .split("train")
    .hf_token(std::env::var("HF_TOKEN").ok())
    .interleave(Interleave::RoundRobin)
    .limit(Some(1000))
    .stream()
    .await?;

while let Some(row) = stream.try_next().await? {
    println!("{:?} {:?}", row.language.as_deref(), row.transcript.as_deref());

    if let Some(audio) = &row.audio {
        let bytes = audio.read().await?;   // nothing was downloaded before this line
        println!("{} bytes", bytes.len());
    }
}
# Ok(()) }
```

Rows are paged out of the Hugging Face datasets-server 100 at a time, the cap the
server enforces. Only one page per dataset is ever held in memory, `429` and `5xx`
responses are retried with jittered exponential backoff, and dropping the stream
cancels whatever is in flight. Breaking out of the loop after N rows downloads
nothing further.

### Stream one Hugging Face repo

`Loader::repo` streams a repo by its Hugging Face id, whether or not the catalogue
lists it. It is the Rust spelling of `load_dataset("google/fleurs", config="sw_ke")`
in the Python SDK.

```rust,no_run
use futures::TryStreamExt;
use ngano::Loader;

# async fn run() -> Result<(), ngano::NganoError> {
let mut stream = Loader::new()
    .repo("google/fleurs")
    .config("sw_ke")
    .split("train")
    .limit(Some(100))
    .stream()
    .await?;

while let Some(row) = stream.try_next().await? {
    println!("{:?}", row.transcript.as_deref());
}
# Ok(()) }
```

When the repo is in the catalogue, its record supplies the licence and the language,
country and domain fallbacks. When it is not, rows come back with `dataset_id: None`,
`licence: "Unstated"` and `source_url: https://huggingface.co/datasets/{repo}`, which is
what the Python and JavaScript SDKs do too. Naming a repo or a catalogue id replaces the
filter.

### Interleaving

| Mode | Behaviour |
| --- | --- |
| `Interleave::RoundRobin` | one row from each dataset in turn, the default |
| `Interleave::Sequential` | each dataset fully, then the next |
| `Interleave::WeightedByHours` | in proportion to counted hours |

## The canonical row

Every SDK, in Rust, Python and JavaScript, produces the same row:

```text
audio          lazy handle: url, path, bytes, sampling_rate. Never decoded.
transcript     Option<String>
language       Option<String>, as the source labels it, else the catalogue name
language_iso   Option<String>, the bare ISO 639-3 code
language_tag   Option<String>, the BCP 47 tag, for example sna or eng-NG
country        Option<String>, ISO 3166-1 alpha-2
speaker_id     Option<String>
gender         Option<String>, as stated by the source, never inferred
age            Option<String>, as stated by the source, never inferred
duration_s     Option<f64>
sampling_rate  Option<u32>
domain         Option<String>
split          String
dataset_id     Option<String>, the ngano catalogue id, None for an uncatalogued repo
hf_repo        String
licence        String
source_url     String
extra          BTreeMap<String, serde_json::Value>
```

Column claiming is table driven. The alias, override, unit hint and drop tables all live
in `field_map.json`, and no SDK adds heuristics of its own, so the Python, JavaScript and
Rust loaders produce identical mappings for the same columns. Columns are mapped in four
steps, in this order:

1. a per-repo override from `field_map.json`, for schemas that have been checked by hand,
2. the dataset's actual columns against the alias table, compared case-insensitively and
   ignoring underscores and hyphens, so `Client_ID`, `client-id` and `clientid` all match,
3. unit hints, for example `duration_ms` becoming `duration_s`,
4. everything still unmapped is preserved verbatim in `extra`.

The language fields settle in one pass. A `language_tag` column the source states itself
wins; failing that the row's own code settles the tag, then the row's own language, each
when it resolves to exactly one; failing that the catalogue record does, when it names
exactly one language. The code is tried before the language because a code is unambiguous
where a name is not.
`language_iso` is then the bare ISO 639-3 code of that tag, or the code the row states
itself when nothing resolved, or the record's single bare code. `language` keeps whatever
the source said, falling back to the record's canonical name. A stated value the registry
does not recognise is kept verbatim rather than dropped or guessed at.

Columns on the `drop` list, such as `up_votes` and `__index_level_0__`, are discarded
rather than kept. An unrecognised schema is never an error: unmatched fields are `None`
and the row still carries its dataset provenance.

You can inspect the mapping without streaming anything:

```rust
use ngano::FieldMap;

let fm = FieldMap::bundled()?;
let columns = ["sentence".to_string(), "client_id".to_string(), "locale".to_string()];
let map = fm.resolve(Some("mozilla-foundation/common_voice_17_0"), &columns);

assert_eq!(map.column("transcript"), Some("sentence"));
assert_eq!(map.column("speaker_id"), Some("client_id"));
assert_eq!(map.column("language"), Some("locale"));
# Ok::<(), ngano::NganoError>(())
```

## Hours figures

Some sources self-report totals of 20,000 hours or more. Those records carry
`unverified_size`, and they are left out of every hours aggregate this crate computes.
The catalogue is a record of what each source publishes, not an independent audit.

## Gated datasets

A dataset behind terms you have not accepted returns `NganoError::Gated`, naming the
repo and the page where access is granted, rather than a bare 401:

```text
dataset mozilla-foundation/common_voice_17_0 is gated: accept its terms at
https://huggingface.co/datasets/mozilla-foundation/common_voice_17_0, then pass an HF token
```

Pass a token with `.hf_token(std::env::var("HF_TOKEN").ok())`.

## Command line

```bash
cargo install ngano --features cli

ngano search "call centre" --language swh --commercial
ngano search --language eng --include-varieties
ngano show waxal-corpus-paper
ngano countries
ngano languages
ngano languages --language eng --include-varieties
ngano stats
ngano stats --json
ngano load --language sna --split train --limit 500 --out shona.jsonl
ngano load --repo google/fleurs --config sw_ke --limit 100 --out fleurs.jsonl
```

`languages` lists one line per tag, with its bare ISO 639-3 code and its name.
`load` writes one JSON object per line, the canonical row above. Every command takes
`--json` for machine readable output, and `--api` to read the live catalogue instead of
the bundled snapshot.

## Blocking API

```rust,no_run
use ngano::{Filter, Loader};

# fn main() -> Result<(), ngano::NganoError> {
let rows = Loader::new()
    .filter(Filter::new().language("sna"))
    .limit(Some(10))
    .blocking()?
    .rows()?;

for row in rows {
    println!("{:?}", row?.transcript);
}
# Ok(()) }
```

Enable it with `features = ["blocking"]`. Each blocking wrapper owns a private
current-thread runtime, so call it from ordinary synchronous code, not from inside an
async runtime.

## Features

| Feature | Default | What it does |
| --- | --- | --- |
| `rustls` | yes | TLS through `rustls` |
| `native-tls` | no | TLS through the platform library instead |
| `blocking` | no | `BlockingLoader` and `Catalogue::from_api_blocking` |
| `cli` | no | the `ngano` binary |

The async API expects a Tokio runtime, which is what `reqwest` uses for its own timers.

## Minimum supported Rust version

1.82. Raising it is treated as a minor version bump.

## Tests

```bash
cargo test                                  # fully offline
cargo test --features blocking,cli
cargo clippy --all-targets -- -D warnings
cargo fmt --check
```

HTTP paths are exercised against a local `wiremock` server. No test reaches the network.

`snippets.json` holds the Rust examples the ngano website and the MCP `get_loader_snippet`
tool serve. `build.rs` substitutes real values into each one and the test suite compiles
them, so a snippet that drifts from the shipped API fails the build.

## Licence

Code is MIT. The catalogue data is CC-BY-4.0. Figures are reproduced as each source
publishes them, with self-reported ones flagged.
