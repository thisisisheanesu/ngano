# ngano

An open catalogue and streaming loader for African-language speech datasets.

`ngano` is Shona for folk stories, the oral tradition told aloud and later written down.

- 611 dataset records covering African speech corpora, bundled inside the package, so the
  catalogue works with no network and no API key.
- Rows stream straight from the Hugging Face datasets server over plain HTTP. No Python
  runtime, no `datasets` install, no local cache, no download of a whole corpus to read
  the first hundred rows.
- One unified row shape across the Python, JavaScript and Rust SDKs.
- Zero runtime dependencies. Node 18 and newer, Deno, Bun and modern browsers.

Code is MIT licensed. The catalogue data is CC-BY-4.0. Every dataset the catalogue points
at belongs to the team that collected it, and the figures are as each source published
them.

## Install

```sh
npm install @thisisisheanesu/ngano
```

## The catalogue, offline

```ts
import { Catalogue, Filter } from "@thisisisheanesu/ngano";

const cat = new Catalogue();                    // bundled snapshot, zero network

cat.datasets({ language: "sna", commercial: true, task: "ASR" });
cat.datasets(new Filter().country("ZW").hfOnly().minHours(10));
cat.get("waxal-corpus-paper");
cat.getByRepo("google/fleurs");
cat.search("parliament");

cat.countries();       // datasets, hours and languages per country
cat.languages();       // datasets, hours and countries per language tag
cat.languageCodes();   // the distinct ISO 639-3 codes, varieties collapsed
cat.stats();           // global aggregates
```

For the live catalogue, served by the ngano API:

```ts
const live = await Catalogue.fromApi();                       // https://ngano.dev/api/v1
const mirror = await Catalogue.fromApi({ baseUrl: "..." });
```

### Hours are honest

Three records in the catalogue report 20,000 hours or more on the publisher's word alone.
They are flagged `unverifiedSize` and excluded from every hours total the SDK computes, in
`stats()`, in `countries()`, in `languages()` and in the `weighted_by_hours` interleave.
They still appear in listings, with the claim intact.

## Languages are ISO 639-3

Every language in the catalogue is a BCP 47 tag whose primary subtag is an ISO 639-3
three-letter code. A region subtag marks a country-specific variety, so Shona is `sna`,
Nigerian English is `eng-NG` and Mozambican Portuguese is `por-MZ`.

`language` and `iso` are one filter, and both accept a tag, a bare code or any spelling of
a name the catalogue has ever used. Values resolve in a fixed order, first match wins:

1. an exact tag, case insensitively, canonicalised to a lower-case primary subtag and an
   upper-case region, so `sna`, `SNA`, `eng-NG` and `eng-ng` all land on the same key;
2. a bare code that exists only as regional varieties, which resolves to those varieties,
   because there is nothing else it could mean. German appears only as `deu-NA`, so `deu`
   finds it;
3. a name from the registry aliases, case insensitively, plain or slugified, which is how
   an old free-text name still works.

A tag always beats a name. The one collision in the data is `tem`, which is Timne's tag and
also a name of `kdh`: the tag wins, and Timne's own alias "Temne" still reaches it.

A bare code never widens to its varieties on its own. Ask for that with `includeVarieties`,
and the bare tag comes first followed by every `<code>-*`:

```ts
cat.resolveLanguage("isiZulu");                        // ["zul"]
cat.resolveLanguage("ENG-ng");                         // ["eng-NG"]
cat.resolveLanguage("eng");                            // ["eng"]
cat.resolveLanguage("eng", { includeVarieties: true }); // ["eng", "eng-NG", "eng-ZA", ...]
cat.resolveLanguage("Klingon");                        // []

cat.datasets({ language: "eng", includeVarieties: true });
cat.datasets(new Filter().language("Shona", "isiZulu"));
```

Input that resolves to nothing matches nothing. ngano never guesses a language.

Every dataset record carries `languageTags` (ordered BCP 47 tags), `languageCodes` (the
bare three-letter codes behind them, deduplicated) and `languagesClean` (one canonical
display name per tag). `languages` still holds the source's own spellings. Eleven records
describe their coverage in prose rather than naming languages, for example "~340 African
languages": those carry no tags and a `languageNote` saying so.

The registry itself is bundled as `language_codes.json` and reachable directly:

```ts
import { LANGUAGE_CODES, LANGUAGE_TAGS, languageName, resolveLanguage } from "@thisisisheanesu/ngano";

LANGUAGE_TAGS.length;            // 315 tags, 27 of them regional
languageName("eng-NG");          // "English (Nigeria)"
LANGUAGE_CODES.codes["sna"];     // { tag, iso639_3, region, name, scope, type, aliases, resolution }
```

## Streaming rows

```ts
import { load } from "@thisisisheanesu/ngano";

for await (const row of load({
  language: ["sna", "nde"],
  country: "ZW",
  commercial: true,
  split: "train",
  hfToken: process.env.HF_TOKEN,
  limit: 1000,
})) {
  row.transcript;      // string | null
  row.language;        // string | null, as the source labels it
  row.languageTag;     // string | null, for example "sna" or "eng-NG"
  row.languageIso;     // string | null, the bare ISO 639-3 code
  row.durationS;       // number | null
  row.audio?.url;      // nothing fetched yet
  const bytes = await row.audio!.read();   // fetched now, cached after
}
```

One Hugging Face repo, catalogued or not:

```ts
import { loadDataset } from "@thisisisheanesu/ngano";

for await (const row of loadDataset("google/fleurs", { config: "sw_ke" })) {
  console.log(row.transcript, row.languageTag, row.languageIso);
}
```

### The unified row

| Field | Type | Notes |
| --- | --- | --- |
| `audio` | `AudioHandle \| null` | lazy: `url`, `path`, `samplingRate`, `contentType`, `read()`, `blob()` |
| `transcript` | `string \| null` | reference text |
| `language` | `string \| null` | as the source labels it, falling back to the catalogue's canonical name |
| `languageIso` | `string \| null` | bare ISO 639-3 code, resolved from the catalogue when the row states none |
| `languageTag` | `string \| null` | BCP 47 tag, for example `sna` or `eng-NG` |
| `country` | `string \| null` | ISO 3166-1 alpha-2 |
| `speakerId` | `string \| null` | stable within the dataset |
| `gender` | `string \| null` | as stated by the source, never inferred |
| `age` | `string \| null` | as stated by the source, never inferred |
| `durationS` | `number \| null` | seconds |
| `samplingRate` | `number \| null` | Hz |
| `domain` | `string \| null` | read, broadcast, clinical and so on |
| `split` | `string` | source split name |
| `datasetId` | `string \| null` | ngano catalogue id |
| `hfRepo` | `string` | Hugging Face repo id |
| `licence` | `string \| null` | from the catalogue |
| `sourceUrl` | `string \| null` | canonical dataset URL |
| `extra` | `Record<string, unknown>` | every column ngano did not map |

`languageTag` is read in a fixed order: a column that states a BCP 47 tag outright
(`language_tag`, `bcp47` and the rest of that alias group), then the row's code or name
column, then the catalogue record when it names exactly one language, then null. A value
that resolves to nothing, or to more than one tag, is not used.

Nothing is decoded. `row.audio.read()` hands back the encoded bytes exactly as the source
stores them, so you choose your own decoder.

### Counts before you stream

`load()` returns an async iterable that already knows what it will pull from:

```ts
const stream = load({ language: "swh", commercial: true });
stream.matched;    // catalogue records matching the filter
stream.loadable;   // how many of those have a Hugging Face repo
stream.datasets;   // the loadable records, in pull order
stream.errors;     // datasets skipped mid-stream, filled in as it runs
```

No request is made until the first `for await`.

### Interleaving

```ts
load({ country: "KE", interleave: "round_robin" });        // default, one row each in turn
load({ country: "KE", interleave: "sequential" });         // finish one dataset, then the next
load({ country: "KE", interleave: "weighted_by_hours" });  // proportional to published hours
```

Every mode is lazy. Breaking out of the loop stops all pagination still in flight, and an
`AbortSignal` does the same from the outside:

```ts
const controller = new AbortController();
for await (const row of load({ language: "wol", signal: controller.signal })) {
  if (enough(row)) controller.abort();
}
```

### Configs and splits

Most multilingual repos put one language in each config. With no `config` given, ngano
takes every config, narrowed to the ones whose name looks like a language you asked for.
The filter's values are resolved to tags first, so `sna`, `Shona` and `eng-NG` all produce
the same hints, which is how `sw_ke` and `yo_ng` style layouts work. With no `split` given, it takes
`train` where it exists. Pass `config: "all"` or `split: "all"` to widen, or name them.

### Failures

By default one dataset failing does not end the stream: the error is recorded on
`stream.errors` and the next dataset is pulled. If every dataset fails, the first error is
thrown, so a single gated repo still surfaces a `NganoGatedError` naming the repo and the
page where access is granted. Pass `onError: "throw"` to fail on the first error, or a
callback to log and continue.

```ts
import { NganoGatedError } from "@thisisisheanesu/ngano";

try {
  await load({ id: "some-gated-dataset" }).toArray(10);
} catch (error) {
  if (error instanceof NganoGatedError) {
    console.error(`Accept the terms at ${error.accessUrl}, then set HF_TOKEN.`);
  }
}
```

### Authentication

Pass `hfToken`, or set `HF_TOKEN` in the environment where one is readable. Node, Bun and
Deno are all supported, and `HUGGING_FACE_HUB_TOKEN`, `HUGGINGFACE_HUB_TOKEN` and
`HF_API_TOKEN` are read as fallbacks. In the browser there is no environment, so pass the
token explicitly, or stay on public datasets.

## Column mapping

Speech corpora agree on almost nothing. `sentence`, `text`, `transcription` and
`raw_transcription` are all the transcript. `client_id`, `speaker`, `spk_id` are all the
speaker. ngano resolves them in a fixed order, identical in all three SDKs:

1. a per-repo override from `field_map.json`, ignored when the column it names is gone
2. alias matching against the dataset's real columns, read from `/first-rows` or `/info`,
   case-insensitive and ignoring underscores, hyphens and dots
3. `unit_hints` conversions, for example `duration_ms` becomes `durationS` times 0.001
4. anything unmapped is kept verbatim under `row.extra`
5. columns in the `drop` list are discarded

Claiming is table-driven only. No SDK adds heuristics of its own beyond `field_map.json`,
so Python, JavaScript and Rust map the same column list identically. Feature types from
the datasets server are used only to confirm that the column the table claimed as audio
really is an `Audio` feature, reported on `mapping.audioConfirmed`, never to claim a column
the table did not.

An unknown schema degrades to "everything in `extra`". The mapper never throws.

```ts
import { buildMapping, FIELD_MAP } from "@thisisisheanesu/ngano";

buildMapping(["Text", "WAV_PATH"], "odd/corpus", FIELD_MAP).fields.audio;  // "WAV_PATH"
buildMapping(["Text", "blob_ref"], "odd/corpus", FIELD_MAP).extra;         // ["blob_ref"]
```

## CLI

```sh
npx @thisisisheanesu/ngano search parliament --limit 10
npx @thisisisheanesu/ngano show google/fleurs
npx @thisisisheanesu/ngano countries --language sna
npx @thisisisheanesu/ngano languages --limit 20
npx @thisisisheanesu/ngano languages --language eng --include-varieties
npx @thisisisheanesu/ngano stats --json
npx @thisisisheanesu/ngano load --language sna --commercial --limit 500 --out shona.jsonl
```

`ngano languages` lists one row per tag, with its bare ISO 639-3 code and its canonical
name. `--language` takes a tag, a code or a name, and `--include-varieties` widens a bare
code to its regional varieties.

`--json` makes every command machine readable. `ngano load` writes JSON lines, with audio
left lazy: the locators are written, never the bytes. `ngano --help` lists every filter.

## Bundled data

Five files are copied from the repository's `data/` directory into this package:
`catalogue.json`, `countries.json`, `languages.json`, `language_codes.json` and
`field_map.json`. They ship twice over: as readable JSON under `ngano/data/`, and embedded in the bundle so that
`new Catalogue()` works in a browser with no filesystem.

```sh
npm run sync-data     # refresh from <repo>/data, also run by npm run build
```

`scripts/sync-data.mjs` is the only thing that writes `data/` and `src/data/snapshot.ts`.
Neither is edited by hand, and this package never edits the repository's `data/`.

```ts
import { CATALOGUE, COUNTRIES, LANGUAGES, LANGUAGE_CODES, FIELD_MAP } from "@thisisisheanesu/ngano";
```

## Runtimes

| Runtime | Support |
| --- | --- |
| Node 18+ | ESM and CJS, plus the `ngano` bin |
| Deno | ESM, `npm:@thisisisheanesu/ngano` |
| Bun | ESM and CJS |
| Browsers | ESM, global `fetch`, no Node built-ins in the library bundle |

The library touches no Node built-in. Only the CLI does.

## Development

```sh
npm install
npm run build        # tsup, ESM plus CJS plus declarations
npm run typecheck    # tsc --noEmit
npm test             # vitest, fully offline with fetch mocked
```

Tests never touch the network. Every HTTP path is exercised against a scripted fake
datasets server, including pagination, retry with jittered backoff, abort, early break,
gated repos and the mapping table.

## Credits

Built by Isheanesu Nigel Misi. Author and project details live in `data/credits.json` and
are read at build time, never hardcoded.

Every dataset in this catalogue belongs to the teams who collected it. ngano only points
at their work and records what they published about it.
