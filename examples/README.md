# Examples

Runnable examples for all three ngano packages. Every one is a real script, not
a snippet. Each says honestly what it needs before it will work.

| Example | Language | What it does |
| --- | --- | --- |
| [`python/build_manifest.py`](python/build_manifest.py) | Python | Turns a catalogue filter into a JSON Lines training manifest |
| [`python/finetune_whisper_shona.py`](python/finetune_whisper_shona.py) | Python | Fine-tunes Whisper small on Shona speech streamed from the catalogue |
| [`js/browse_catalogue.mjs`](js/browse_catalogue.mjs) | Node | Searches and summarises the catalogue offline, no network |
| [`js/stream_to_jsonl.mjs`](js/stream_to_jsonl.mjs) | Node | Streams rows from several datasets into one JSON Lines file |
| [`rust/stream_rows.rs`](rust/stream_rows.rs) | Rust | Streams canonical rows, prints them or writes JSON Lines |

## Before you start

### The catalogue needs no network

Every package bundles a snapshot, so `Catalogue.load()` makes no HTTP request.
Searching, filtering and counting all run offline. `browse_catalogue.mjs` and
`stream_rows.rs --stats` never touch the network at all.

That also means the bundled catalogue is as old as the package you installed.
Use `https://ngano.dev/api/v1` if you need the live one.

### Rows do need a network, and sometimes a token

283 of the 612 catalogue records are on the Hugging Face Hub and can be loaded
directly. Some of those are **gated**: you accept terms on the dataset page,
then authenticate. All three loaders read `HF_TOKEN` from the environment.

```bash
export HF_TOKEN="hf_..."
```

Without one, a gated repo fails with a message naming the repo and linking its
page. Every example here warns you up front if `HF_TOKEN` is unset, rather than
failing halfway through a download.

The token is sent to `huggingface.co` and nowhere else. ngano never logs it and
never writes it to disk.

### Some datasets no token can reach

329 records have no `hf_repo` at all, and among those that do, some carry
`access: Request`, `Paid` or `Scrape required`. A token does not help there.
Someone has to fill in a form, pay, or visit an archive. Every example skips
those with a message naming the dataset and the reason, rather than generating
code that 403s.

ngano will not scrape anything for you.

## Python

```bash
pip install "ngano[hf]"

python python/build_manifest.py --language Hausa --limit 5000 --out hausa.jsonl
python python/finetune_whisper_shona.py --dry-run
```

`build_manifest.py` needs only the `hf` extra. `finetune_whisper_shona.py`
additionally needs a training stack:

```bash
pip install transformers datasets torch torchaudio accelerate evaluate jiwer
```

Run it with `--dry-run` first. It prints exactly which datasets it selected,
their hours, their licences and which are flagged unverified, then stops. That
is the output worth reading even if you never train anything.

The training run is deliberately small. A couple of thousand utterances on one
consumer GPU takes minutes and gives you a model that is clearly learning and
clearly not finished. The word error rate it reports is a sanity check, not a
result.

## JavaScript

```bash
npm install ngano

node js/browse_catalogue.mjs --stats
node js/browse_catalogue.mjs --language Swahili --access Open --limit 5
node js/stream_to_jsonl.mjs --language Yoruba --limit 500 --out yoruba.jsonl
```

Node 18 or newer. Both scripts are ESM. `browse_catalogue.mjs` is the quickest
way to see what the catalogue actually contains for a language you care about.

## Rust

`stream_rows.rs` is a Cargo example. Put it in `examples/` in your own crate:

```toml
[dependencies]
ngano = "0.1"
anyhow = "1"
serde_json = "1"
```

```bash
cargo run --example stream_rows -- --stats
cargo run --example stream_rows -- --language Amharic --limit 50
cargo run --example stream_rows -- --country ZA --split test --jsonl za-test.jsonl
```

MSRV is 1.74.

## Licences

These examples are MIT, like the rest of the code. The datasets they load are
not. Each carries its own terms, recorded in the `licence` field, and the
examples print that field so you see it before you use anything. Check the
source licence before you train a model you intend to publish, and especially
before anything commercial.
