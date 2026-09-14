# ngano

**A catalogue and a unified loader for African-language speech datasets.**

`ngano` is Shona for folk stories, the oral tradition told aloud and later
written down.

Finding speech data for an African language means reading papers, chasing dead
links, emailing universities and guessing at licences. ngano does that work once
and keeps the result in one place.

| | |
| --- | --- |
| Datasets catalogued | 611 |
| Languages indexed | 421 |
| African countries covered | 57 of 58 indexed |
| Verified hours of audio | 110,750 |
| Records with a stated size | 238 |
| Loadable from the Hugging Face Hub | 283 |
| Open access | 441 |
| Open and transcribed | 351 |

Every figure on this site comes from `data/catalogue.json`. Regenerate them with
`python scripts/stats.py`.

## Three ways in

**The packages.** One loader API in Python, JavaScript and Rust. They stream, so
you can `break` after five rows without downloading a corpus.

```bash
pip install ngano
npm install ngano
cargo add ngano
```

**The API.** Public, unauthenticated, CORS open, cacheable.

```bash
curl "https://ngano.dev/api/v1/datasets?country=ZW&access=Open&sort=-hours"
```

**The MCP server.** Point an agent at it and it can search the catalogue and
write you a loader snippet.

```json
{ "mcpServers": { "ngano": { "url": "https://ngano.dev/mcp" } } }
```

## Where to go next

- [Loading datasets](loading.md), the unified row and how column mapping works
- [HTTP API](api.md), every endpoint and every filter
- [MCP](mcp.md), the eight tools and their schemas
- [Schema](schema.md), the catalogue record field by field
- [Methodology](methodology.md), how the catalogue was built and what was left out
- [Contributing](contributing.md), the evidence bar for a new record

## What ngano is not

ngano is a catalogue of sources. It is not a dataset, it does not host audio,
and it does not redistribute anything.

The figures are the publishers' figures. ngano records what each source states
and leaves a field `null` where the source is silent. It does not download,
decode or measure audio, so it cannot tell you that a stated 500 hours is really
480.

Three records self-report 20,000 hours or more with no independent confirmation.
They are flagged `unverified_size` and excluded from every hours total on this
site, in the API, and in all three packages.

328 of the 611 records are not loadable programmatically at all. They live
behind request forms, paywalls, broadcaster archives or scraping, and the loader
will not scrape anything for you.

Licence classes are a reading of published terms, not legal advice. Check the
source licence before you train on anything.

## Licences

Code is MIT. The catalogue is CC BY 4.0, attributed as:

> ngano catalogue by Isheanesu Nigel Misi, https://ngano.dev, licensed under CC BY 4.0.

The datasets themselves belong to the teams who collected them and carry their
own terms.
