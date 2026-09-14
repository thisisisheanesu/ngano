# The catalogue record

Every record in `data/catalogue.json` has the same 27 fields. The authority is
`data/schema.json`, a JSON Schema 2020-12 document, served live at
[`/api/v1/schema`](api.md#get-schema) alongside the loader field map. This page
explains it.

`python scripts/validate_catalogue.py` checks the whole catalogue against that
schema plus the rules a schema cannot express, and exits non-zero on any
problem.

## Identity

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Permanent lowercase hyphenated slug, unique across the catalogue. Never renumbered or reused. |
| `name` | string | Title as the publisher writes it. |
| `url` | string or null | Primary source URL. Null only where no stable public page exists, and then `notes` says why. Three records are in that position. |
| `hf_repo` | string or null | `owner/name` on the Hugging Face Hub. Non-null for 283 records. Must appear inside `url` when both are set. |
| `host` | string | Where the data lives: HuggingFace, SADiLaR, OpenSLR, LDC, Zenodo, a broadcaster, a university. |
| `year` | string or null | Four-digit publication or last-release year. Null for 162 records. |

## Content

| Field | Type | Notes |
| --- | --- | --- |
| `task` | enum | `ASR`, `TTS`, `ASR+TTS`, `Raw source`, `Other`. What the data is usable for as released, not what it could become. |
| `variety` | enum | `Indigenous`, `Accented foreign`, `Creole/Pidgin`, `Code-switch`. |
| `domain` | string | Subject domain, for example `Read speech`, `Broadcast news`, `Call centre / telephony`. |
| `recording_type` | string or null | How the audio was captured, in the source's words: read, spontaneous, telephone, broadcast. |
| `labelled` | enum | `Transcribed` (454), `Unlabelled` (118), `Unstated` (40). |
| `quality` | enum | `Studio (44.1–48 kHz)`, `Standard (16 kHz)`, `Broadcast`, `Crowdsourced / web`, `Narrowband (8 kHz)`, `Unstated`. 374 records say `Unstated`, which is the correct answer for them. |

`Raw source` is a real category, not a fallback. It covers broadcaster archives,
religious audio libraries and parliamentary recordings: material that is speech
in an African language and is legitimately obtainable, but that nobody has
turned into a dataset yet.

## Language and place

| Field | Type | Notes |
| --- | --- | --- |
| `languages` | string[] | Names exactly as the source lists them. |
| `languages_clean` | string[] | Those names normalised against `data/languages.json`. A **filtered view**: a name the index does not cover is dropped rather than guessed at, so this list can be shorter than `languages`, and occasionally empty for an aggregator record that names no language of its own. |
| `iso` | string[] | ISO 639 codes the source itself states. ngano does not look codes up on a source's behalf, so this list is independent of the other two. |
| `countries` | string[] | Names matching `data/countries.json`, or the literal `Pan-African`. 78 records are Pan-African. |
| `country_codes` | string[] | **Derived.** The ISO 3166-1 alpha-2 codes of `countries`, in the same order, with `Pan-African` omitted because it has no code. |
| `regions` | string[] | **Derived** from `countries`. One of `North Africa`, `West Africa`, `Central Africa`, `East Africa`, `Horn of Africa`, `Southern Africa`, `Island states`. Empty when the only country is `Pan-African`. |

Derived means the validator recomputes them. An edit that disagrees fails CI.

## Size

| Field | Type | Notes |
| --- | --- | --- |
| `hours` | string or null | The size **verbatim**, qualifiers included, for example `65072 total (all 88 languages)`. Null for 366 records whose sources state no size. |
| `hours_num` | number or null | The number parsed out of `hours`. Null exactly when `hours` is null. |
| `speakers` | string or null | Speaker count or description as published. Null for 489 records. |
| `unverified_size` | boolean | True exactly when `hours_num` is 20,000 or more and self-reported without independent confirmation. |

`unverified_size` is the project's one editorial judgement about numbers, and it
only ever removes a figure from a total, never adds one. Three records carry it:
a 194,331 hour call-centre corpus, a 65,072 hour multilingual collection and the
44,700 hour MMS labelled set. They stay in the catalogue and stay out of every
hours total, in the API, in the site and in all three SDKs.

The verified total is **110,750 hours across 238 records**. That is the sum of
what publishers state, not a measurement, and not the size of African speech data
in the world.

## Rights

| Field | Type | Notes |
| --- | --- | --- |
| `licence` | string | Licence string as published, or `Unstated` for 252 records. |
| `licence_class` | enum | The filtering bucket: `Public domain / CC0`, `Permissive (MIT / Apache)`, `Attribution (CC-BY)`, `Attribution + ShareAlike`, `NonCommercial`, `NonCommercial + NoDerivatives`, `Research only`, `Commercial (purchase)`, `Restricted (NOODL)`, `Open (unspecified)`, `Other`, `Unstated`. |
| `commercial` | enum | `Yes` (204), `Yes, if purchased` (37), `No` (118), `Unstated` (253). According to the licence. |
| `access` | enum | `Open` (441), `Request` (87), `Scrape required` (47), `Paid` (37). |

`licence_class` and `commercial` are a reading of published terms. They are a
filter, not legal advice. Read the source licence before you use anything
commercially.

`access: Scrape required` marks material that exists publicly but that nobody has
packaged. ngano records it so you know it is there. The loaders will not fetch
it, and neither should you without checking the host's terms.

## Notes

`notes` is a non-empty string on every record. It carries the caveats: what a
figure covers, why a field is null, whether a link is to a paper rather than to
data, whether a "1,000 hours" claim counts a single speaker read a thousand
times. Read it before you trust a row.

## Example record

```json
{
  "id": "swahili-call-center-audio-dataset-single-channel",
  "name": "Swahili Call Center Audio Dataset (single channel)",
  "task": "ASR",
  "variety": "Indigenous",
  "languages": ["Swahili"],
  "languages_clean": ["Swahili"],
  "iso": ["swh"],
  "countries": ["Tanzania", "Kenya", "Uganda"],
  "country_codes": ["TZ", "KE", "UG"],
  "regions": ["East Africa"],
  "hours": "194331",
  "hours_num": 194331.0,
  "speakers": null,
  "recording_type": "telephone",
  "quality": "Narrowband (8 kHz)",
  "labelled": "Transcribed",
  "domain": "Call centre / telephony",
  "licence": "CC-BY-4.0",
  "licence_class": "Attribution (CC-BY)",
  "commercial": "Yes",
  "access": "Open",
  "host": "HuggingFace",
  "url": "https://huggingface.co/datasets/InfoBayAI/Swahili-Call-Center-Audio-Dataset-Single-Channel",
  "hf_repo": "InfoBayAI/Swahili-Call-Center-Audio-Dataset-Single-Channel",
  "year": "2024",
  "notes": "Vendor-scale 8 kHz call-centre audio claimed at 194k hrs split by locale with PII muting; the hour claim is very large and unverified, treat with caution, but it is the only telephone-domain Swahili corpus at scale.",
  "unverified_size": true
}
```

That is a real record, and a good illustration: a huge claim, flagged, kept,
explained, and excluded from every total.
