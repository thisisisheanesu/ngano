# Methodology

How the catalogue was built, what counts, and what was deliberately left out.

Every number on this page is reproducible with `python scripts/stats.py`.

## The question it was built to answer

If you want to train a speech model for an African language, the first job is
finding out whether any data exists at all. That answer is scattered across
papers, university pages, broadcaster archives, Hugging Face, mailing lists and
dead links. Most people give up and use whatever is on the Hub.

The catalogue exists so that search happens once.

## The sweep

The catalogue was built by systematic search rather than by collecting whatever
was convenient.

**Country by country.** All 54 African Union member states were searched in
turn, by country name, by the names of that country's major languages, and by
its ISO codes. Searching per country rather than per language is what surfaced
the broadcaster archives and university corpora that no aggregator lists.

**Pan-African passes.** Multi-country and continent-wide collections do not
appear reliably in a country search, because they are indexed under "African
languages" rather than under any one country. Separate passes covered the
multilingual corpora, the religious audio libraries, the missionary recording
archives and the large multilingual model corpora. 78 records ended up tagged
`Pan-African`.

**Accented-variety passes.** African-accented English, French, Portuguese and
Arabic are speech data for African speakers, and they are what a deployed system
actually meets. They were searched for separately and are tagged
`variety: Accented foreign`. 64 records. Code-switched speech got its own pass,
24 records, because it is almost never labelled as such by its publishers.

**58 country entries, 57 covered.** The country index carries 58 entries: the 54
AU members plus territories and dependencies that have their own speech data and
their own ISO codes. 57 of them have at least one record. The gap is real and is
not papered over.

## From 768 raw records to 611

The sweep produced **768 raw records**. De-duplication brought that to **611**, and one
vendor platform with no published corpus behind it was dropped afterwards, leaving **611**.

The 156 that went were duplicates, not rejections:

- **The same corpus under several names.** A dataset appears as its paper title,
  its OpenSLR number and its Hub repo id. One record now, with the primary
  source as `url` and the others noted.
- **Mirrors and re-uploads.** A Hub user re-uploads an OpenSLR corpus unchanged.
  The original is catalogued, the mirror is not, unless the mirror adds
  something such as transcripts the original lacked.
- **Per-language splits of one release.** A multilingual corpus published as 40
  per-language repos is one record listing 40 languages, not 40 records. The
  hours are counted once.
- **Versions of the same corpus.** Where a newer release supersedes an older one
  and contains it, the newer is catalogued. Where the older has data the newer
  dropped, both are kept, and the notes say why.

Two records were merged only when they were the same audio. Two separately
collected corpora of the same language stay separate however similar they look.

## Inclusion

A record is in scope if it is speech, in or from Africa, and obtainable in
principle.

That last clause is why `task: Raw source` exists, 85 records of it. National
broadcaster archives, religious audio libraries, parliamentary recordings:
material that is hours of real African-language speech, legitimately reachable,
that nobody has turned into a dataset. Leaving it out would have made the
catalogue tidier and less useful. It is recorded with `access: Scrape required`
where that is the honest description, 47 records. ngano will not scrape any of
it for you, and neither should you without checking the host's terms.

Out of scope: text-only corpora, for now. Speech from the African diaspora with
no African recording location. Datasets that were announced but never released,
unless a paper documents what was collected, in which case the record says so in
its notes.

## "Unstated" is an answer

The most important editorial decision in the catalogue is that **a gap is
recorded as a gap**.

- 365 of 611 records state no size. `hours` and `hours_num` are `null`.
- 374 state no audio quality. `quality` is `Unstated`.
- 252 state no licence. `licence` is `Unstated`.
- 489 state no speaker count. `speakers` is `null`.
- 162 state no year.

None of these were filled in by inference. No hours were computed from file
counts. No sample rate was assumed from a file extension. No licence was guessed
from a host's usual practice. No gender or age was inferred from audio anywhere
in this project.

This makes the catalogue look patchier than it could. That patchiness is the
finding. A field that says `Unstated` tells you to go and ask the publisher. A
field filled with a plausible guess tells you nothing and costs you a day.

`Unstated` is a controlled value, distinct from a field being absent. Every
record has all 27 fields.

## Why unverified figures are excluded

Three records self-report sizes at or above 20,000 hours with no independent
confirmation:

| Record | Claimed hours |
| --- | ---: |
| Swahili Call Center Audio Dataset (single channel) | 194,331 |
| WorldSpeech (disco-eth) | 65,072 |
| Meta MMS-lab (Massively Multilingual Speech, labelled) | 44,700 |

Together they claim 304,103 hours. The verified total across the other 609
records is 110,750 hours from the 238 that state a size.

If those three were counted, they would be 73 percent of the catalogue's hours,
and every regional and per-language total would be dominated by three
unconfirmed numbers. A chart of "hours of African speech data by region" would
be a chart of three vendor claims.

So they are flagged `unverified_size: true` and excluded from every hours total,
everywhere, in every language: the site, the API, the MCP server and all three
SDKs. They remain fully in the catalogue, because they may well be real and they
are certainly worth knowing about. They are counted as datasets, just not as
hours.

The threshold is 20,000 hours, applied to self-reported figures. It is a blunt
rule chosen so it can be applied mechanically and checked in CI, rather than
case by case by whoever is editing. `scripts/validate_catalogue.py` enforces it
in both directions: a record at or above the threshold must be flagged, and a
record below it must not be.

## What the numbers mean

**110,750 verified hours** is the sum of what 238 publishers state about their
own data. It is not a measurement. ngano does not download or decode audio.

It is also not the amount of African speech data in the world. It is the amount
that is published, documented with a size, and findable.

**611 datasets over 421 languages** does not mean 421 languages have usable
data. Most have one record, often religious audio or a word list. A handful of
languages carry most of the hours. Per-language counts are on the
[languages endpoint](api.md#get-languages-and-languagesslug) and the honest
picture there is steep.

**57 countries covered** counts a country as covered if one record names it. One
record is not coverage in any meaningful sense.

## Keeping it current

The catalogue is a snapshot. Links rot, licences change, corpora get superseded.

Corrections are the most valuable contribution this project takes, and the bar
for one is a primary source URL. See [Contributing](contributing.md). Every
change runs through `scripts/validate_catalogue.py` in CI, which enforces the id
uniqueness, the derived country and region fields, the controlled vocabularies
and the `unverified_size` rule described here.
