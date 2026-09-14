# Loading datasets

The catalogue tells you what exists. The loader gets you rows.

283 of the 612 records carry an `hf_repo` and are loadable this way. The other
329 need a request form, a purchase, or a visit to a broadcaster's archive.
Filter on `hf_only` if you only want what you can load today.

## The canonical row

Every dataset yields the same row, in every language. This is the whole point:
you write your training loop once, not once per corpus.

| Field | Type | Meaning |
| --- | --- | --- |
| `audio` | handle | `{url, path, bytes, sampling_rate}`. **Lazy.** Never decoded unless you ask. |
| `transcript` | string or null | reference text |
| `language` | string or null | language name as the source labels it |
| `language_iso` | string or null | ISO 639 code where the source gives one |
| `country` | string or null | ISO 3166-1 alpha-2 |
| `speaker_id` | string or null | stable within the dataset |
| `gender` | string or null | **as stated by the source, never inferred** |
| `age` | string or null | **as stated by the source, never inferred** |
| `duration_s` | float or null | seconds |
| `sampling_rate` | int or null | Hz |
| `domain` | string or null | read, broadcast, clinical, and so on |
| `split` | string | source split name |
| `dataset_id` | string | ngano catalogue id |
| `hf_repo` | string | Hugging Face repo id |
| `licence` | string | licence from the catalogue |
| `source_url` | string | canonical URL |
| `extra` | map | everything the source shipped that did not map |

`gender` and `age` are copied, never guessed. No classifier runs over the audio
to fill them in. If a source does not state them they are `null`, and that is
the correct answer.

`audio` is a handle, not samples. Iterating a million-row dataset to count
speakers costs no audio bandwidth at all. Decode only the rows you keep.

## Streaming, always

Rows stream. Nothing materialises a whole dataset, and a multi-dataset load
interleaves lazily, so breaking after N rows genuinely stops the download.

=== "Python"

    ```python
    from ngano import Catalogue, load

    cat = Catalogue.load()
    picks = cat.search(language="Hausa", access="Open", hf_only=True)

    for row in load(picks, split="train").take(100):
        print(row.dataset_id, row.duration_s, row.transcript)
    ```

=== "JavaScript"

    ```js
    import { Catalogue, load } from "ngano";

    const cat = await Catalogue.load();
    const picks = cat.search({ language: "Hausa", access: "Open", hfOnly: true });

    let n = 0;
    for await (const row of load(picks, { split: "train" })) {
      console.log(row.datasetId, row.durationS, row.transcript);
      if (++n === 100) break;
    }
    ```

=== "Rust"

    ```rust
    use ngano::{load, Catalogue, Query};

    let cat = Catalogue::load()?;
    let picks = cat.search(&Query::new().language("Hausa").access("Open").hf_only(true));

    for row in load(&picks).split("train").rows()?.take(100) {
        let row = row?;
        println!("{} {:?}", row.dataset_id, row.duration_s);
    }
    ```

Three datasets interleaved means you get a mixed stream from the first row,
rather than all of corpus A and then all of corpus B. That matters if you are
sampling rather than training on everything.

## Tokens and gated repos

Some Hub repos are gated: you accept terms on the dataset page, then
authenticate. All three loaders read `HF_TOKEN` from the environment.

```bash
export HF_TOKEN="hf_..."
```

The token goes to `huggingface.co` and nowhere else. It is never logged and
never written to disk by ngano. A gated repo without a token fails with a clear
message naming the repo and linking its page, rather than an opaque 401.

A record with `access: Request` or `access: Paid` will not become loadable
because you set a token. Those need a human to ask or to pay first.

## How column mapping works

Hugging Face datasets do not agree on anything. One calls the text `sentence`,
another `transcription`, another `raw_transcription`. One gives duration in
milliseconds. ngano resolves this from `data/field_map.json`, which is served
live at [`/api/v1/schema`](api.md#get-schema).

The order is identical in all three SDKs:

1. **Repo override.** If `overrides[hf_repo]` exists, it wins. These are
   hand-verified for the datasets people actually use: Common Voice, FLEURS,
   XTREME-S, AfriSpeech.
2. **Runtime inspection.** The loader looks at the dataset's real columns and
   matches them against `aliases`, case-insensitively, ignoring underscores and
   hyphens. So `SpeakerID`, `speaker_id` and `speaker-id` all resolve the same.
3. **Unit hints.** A column that carries the right quantity in the wrong unit is
   converted. `duration_ms` becomes `duration_s` multiplied by 0.001.
4. **Everything else is kept.** Any column that did not map lands in `extra`.
   Nothing is silently dropped.
5. **The drop list.** Columns in `drop` are discarded: vote counts, index
   artefacts, internal ids that mean nothing outside the source.

Step 2 is why an unknown dataset still loads. A corpus published tomorrow with a
`text` column and an `audio` column works without anyone touching ngano.

### A worked example

A dataset ships these columns:

```
audio, sentence, client_id, locale, duration_ms, up_votes, dialect_notes
```

The loader produces:

| Canonical field | From | How |
| --- | --- | --- |
| `audio` | `audio` | alias |
| `transcript` | `sentence` | alias |
| `speaker_id` | `client_id` | alias |
| `language` | `locale` | alias |
| `duration_s` | `duration_ms` | unit hint, multiplied by 0.001 |
| `extra.dialect_notes` | `dialect_notes` | unmapped, preserved |
| dropped | `up_votes` | in the drop list |

`dataset_id`, `hf_repo`, `licence` and `source_url` come from the catalogue
record, not from the dataset, so every row knows where it came from and under
what terms.

## When the mapping is wrong

It happens. A source uses `text` for a speaker name, or ships transcripts in a
column ngano has never seen.

Inspect what the loader decided before you trust it:

=== "Python"

    ```python
    from ngano import Catalogue, field_map_for

    ds = Catalogue.load().get("afrispeech-200")
    print(field_map_for(ds))
    ```

=== "JavaScript"

    ```js
    import { Catalogue, fieldMapFor } from "ngano";

    const ds = (await Catalogue.load()).get("afrispeech-200");
    console.log(fieldMapFor(ds));
    ```

=== "Rust"

    ```rust
    let ds = Catalogue::load()?.get("afrispeech-200").unwrap();
    println!("{:#?}", ngano::field_map_for(ds)?);
    ```

If it is wrong, add an override to `data/field_map.json` and send a pull
request. The procedure is in [Contributing](contributing.md#adding-a-hugging-face-column-mapping).
Set `"verified": true` only if you have actually loaded the dataset and seen the
columns, because an unverified override silences the runtime inspection that
would otherwise have got it right.

## Offline use

Every package bundles a snapshot of the catalogue, so `Catalogue.load()` makes
no network call. Search, filter and count entirely offline. The network is only
touched when you ask for rows.

That also means the bundled catalogue is as old as the package. Use the
[API](api.md) if you need the live one.
