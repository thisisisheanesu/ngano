# MCP server

ngano speaks the Model Context Protocol, so an agent can search the catalogue
and get working loader code without you writing an integration.

- Endpoint: `https://ngano.dev/mcp`
- Transport: streamable HTTP. `POST /mcp` for requests, `GET /mcp` for the SSE
  stream.
- Protocol version: `2025-06-18`
- Authentication: none. Do not send a token.

## Connecting

Most clients take a URL:

```json
{
  "mcpServers": {
    "ngano": {
      "url": "https://ngano.dev/mcp"
    }
  }
}
```

Claude Code:

```bash
claude mcp add --transport http ngano https://ngano.dev/mcp
```

The server implements `initialize`, `notifications/initialized`, `tools/list`,
`tools/call` and `ping`.

Every tool returns both `content: [{ type: "text", text: ... }]`, which is
readable prose for a model, and `structuredContent`, which validates against the
`outputSchema` declared on the tool. A client that understands structured output
should use it and ignore the text.

## Tools

### `search_datasets`

Search and filter the catalogue. Takes the same filters as
[`GET /datasets`](api.md#filters): `q`, `language`, `iso`, `country`, `region`,
`task`, `variety`, `commercial`, `licence_class`, `access`, `labelled`,
`quality`, `domain`, `host`, `hf_only`, `min_hours`, `max_hours`, `has_hours`,
`sort`, `page`, `per_page`, `fields`.

Returns the matching datasets plus the same `meta` block, including
`total_hours` over the whole filtered set with unverified records excluded.

### `get_dataset`

One dataset by `id`. Returns all 27 fields. Errors if the id is unknown rather
than returning an empty result, so an agent does not quietly proceed on nothing.

### `list_countries`

Every country with its dataset, hour and language counts.

### `get_country`

One country by alpha-2 code, plus its datasets and its languages.

### `list_languages`

Every language in the index with its dataset count, countries and hours.

### `get_language`

One language by slug, plus its datasets.

### `get_stats`

Global and per-facet aggregates. The place to ask "how much open transcribed
Hausa audio exists" and get an answer that is derived rather than recalled.

### `get_loader_snippet`

The one that earns its keep. Takes a filter, the same shape as
`search_datasets`, plus a `language` argument of `python`, `javascript` or
`rust`. Returns ready-to-run code that loads exactly that filtered set through
the ngano package for that language.

An agent can therefore go from "find me open Shona speech with transcripts" to
a runnable script in two tool calls, without inventing an API it half remembers.

## Example call

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_datasets",
    "arguments": {
      "language": "Shona",
      "access": "Open",
      "labelled": "Transcribed",
      "sort": "-hours"
    }
  }
}
```

## Notes for agent authors

- Hours in every response exclude the three records flagged `unverified_size`.
  If an agent reports a total, that is the total it should report.
- `access` is not the same as "downloadable". `Request`, `Paid` and
  `Scrape required` all mean a human has to do something first. An agent should
  say so rather than generating code that will 403.
- `licence_class` is a filter, not legal advice. An agent recommending a dataset
  for commercial training should quote the `licence` string and the `notes`, not
  just the class.
- Fields are `null` where the source states nothing. An agent should say "the
  publisher does not state a size" rather than filling the gap.
