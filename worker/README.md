# ngano worker

One Cloudflare Worker serves everything at [ngano.dev](https://ngano.dev): the site, the
JSON API at `/api/v1`, the MCP server at `/mcp`, and the raw catalogue files under `/data`.

There is no origin server, no database and no asset bucket. The data files in
`../data` are bundled into the Worker at build time and indexed once per isolate, so a
request is a lookup in memory. The Worker has zero runtime dependencies.

## Layout

| File | What it does |
| --- | --- |
| `src/index.ts` | Fetch handler and router. Site pages, `/data/*`, `robots.txt`, `sitemap.xml`, `favicon.svg`, www redirect. |
| `src/data.ts` | Loads the JSON, builds every index and aggregate at module scope, exposes `getContext(env)`. |
| `src/api.ts` | The JSON API: filtering, sorting, pagination, projection and the error shape. |
| `src/openapi.ts` | The OpenAPI 3.1 document served at `/api/v1/openapi.json`. |
| `src/mcp.ts` | Streamable HTTP MCP server, protocol `2025-06-18`, eight tools. |
| `src/http.ts` | Response helpers: `json`, `html`, `text`, `error`, `cors`, `etag`. |
| `src/fields.ts` | Constants shared by the API and the OpenAPI document. |
| `src/types.ts` | Types shared with the site renderers. |
| `src/site/` | Page renderers and the fixed-path assets they need, owned by the site half of the project. |

## Routes

| Path | Served by |
| --- | --- |
| `/`, `/map`, `/countries/:iso2`, `/datasets/:id`, `/languages/:slug`, `/credits`, `/docs` | `src/site` renderers |
| `/api/v1/*` | `src/api.ts` |
| `/mcp` (POST and GET) | `src/mcp.ts` |
| `/data/catalogue.json`, `/data/countries.json`, `/data/languages.json`, `/data/language_codes.json`, `/data/africa.geo.json`, `/data/field_map.json`, `/data/snippets.json` | raw CC-BY-4.0 downloads |
| `/styles.css`, `/site.js`, `/map.js`, `/favicon.svg`, `/og.svg` | `siteAssets` from `src/site` |
| `/robots.txt`, `/sitemap.xml` | generated from the catalogue |
| anything else | `renderNotFound`, with a 404 |

## Run it locally

```sh
npm install
cp .dev.vars.example .dev.vars   # optional, everything has a default
npm run dev                      # wrangler dev on http://localhost:8787
```

Then try it:

```sh
curl http://localhost:8787/api/v1/healthz
curl "http://localhost:8787/api/v1/datasets?language=sna&access=Open&per_page=5"
curl "http://localhost:8787/api/v1/datasets?language=eng&include_varieties=true&per_page=5"
curl "http://localhost:8787/api/v1/languages/eng-ng"
curl http://localhost:8787/api/v1/stats
curl -X POST http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

`BASE_URL` and `VERSION` are the only variables. Neither is a secret. When `BASE_URL`
is unset the Worker uses the origin of the incoming request, so local runs produce
local links in `sitemap.xml` and `openapi.json`.

## Typecheck and test

```sh
npm run typecheck    # tsc --noEmit, strict
npm test             # vitest, running inside workerd
```

The suite runs on `@cloudflare/vitest-pool-workers`, so every test drives the real
`fetch` handler inside the same runtime Cloudflare deploys. It reads
`test/wrangler.test.toml` rather than the production `wrangler.toml`, because the pool
needs the `nodejs_compat` flag for its own machinery and the deployed Worker does not
need Node APIs. No test touches the network.

`npx wrangler deploy --dry-run` is a quick way to check the bundle still builds. It
comes out around 1.3 MB, 225 KB gzipped, most of it the catalogue.

`test/__snapshots__/stats.test.ts.snap` pins the whole `/api/v1/stats` response. It
should change only when the catalogue is rebuilt or an aggregate rule deliberately
moves. Refresh it with `npx vitest run -u` and read the diff before committing.

## Deploy

```sh
npx wrangler login
npm run deploy
```

`wrangler.toml` claims two routes on the `ngano.dev` zone:

```toml
[[routes]]
pattern = "ngano.dev/*"
zone_name = "ngano.dev"

[[routes]]
pattern = "www.ngano.dev/*"
zone_name = "ngano.dev"
```

## Point ngano.dev at it

1. Add `ngano.dev` as a zone in the Cloudflare dashboard and move the nameservers at
   your registrar to the two Cloudflare gives you. Wait for the zone to go active.
2. Add two proxied DNS records. Workers routes only fire on proxied (orange cloud)
   records, and because the Worker answers every request the target never matters:
   - `A` `ngano.dev` to `192.0.2.1`, proxied
   - `CNAME` `www` to `ngano.dev`, proxied
3. Run `npm run deploy`. Wrangler creates both routes from `wrangler.toml`.
4. Under SSL/TLS set the encryption mode to Full (strict).
5. Check it:

```sh
curl -I https://ngano.dev/
curl -I https://www.ngano.dev/        # 301 to the apex
curl -s https://ngano.dev/api/v1/healthz
```

Without a custom domain, `workers_dev = true` also publishes the Worker at
`ngano.<account>.workers.dev`, which is useful for a first smoke test.

## Behaviour worth knowing

- **Unverified sizes.** A catalogue record flagged `unverified_size` is a self-reported
  figure of 20000 hours or more. It is listed in full and keeps its own `hours_num`,
  but it contributes zero hours to every aggregate: `meta.total_hours`, `/stats`, the
  per-country and per-language totals, the MCP tool output, and the `min_hours` and
  `max_hours` filters, which see it as zero.
- **Apportioning.** A dataset covering several languages or countries splits its hours
  evenly between them, so per-facet hours add back up to the global total instead of
  double counting. Per language the divisor is `language_tags.length`.
- **Language tags.** Languages are keyed on BCP 47 tags whose primary subtag is a
  lowercase ISO 639-3 code, with an optional uppercase ISO 3166-1 region subtag for a
  country-specific variety: `sna` is Shona, `eng-NG` is Nigerian English, `por-MZ` is
  Mozambican Portuguese. A language slug is the tag lowercased. Wherever a language is
  accepted you may give a bare code, a full tag in any case, or any name from that
  tag's `aliases`, which is how an old free-text name such as `Shona` still works. The
  answer always carries the canonical tag. A bare code never stands for one of its
  regional varieties unless `include_varieties=true` is passed, and a three-letter
  input is read as a tag before it is read as a name.
- **Commercial use.** `commercial_ok` and `hours_commercial` count both `Yes` and
  `Yes, if purchased`, because both end in a licence you can ship on.
- **Caching.** API responses are `public, max-age=300, s-maxage=3600`. Raw data files
  and the favicon are `public, max-age=3600, s-maxage=86400`. Collection responses and
  data files carry an ETag and answer a matching `If-None-Match` with 304.
- **CORS.** Every response allows any origin, and `OPTIONS` is answered with 204.
- **Snippets.** `data/snippets.json` is generated by `scripts/merge_snippets.py` from
  each SDK package, and every package compiles or typechecks its own snippets, so the
  code the Worker serves is known to run. The Worker never writes example code of its
  own: `get_loader_snippet` picks snippet keys and substitutes the seven `{{TOKEN}}`
  placeholders from real catalogue values, and refuses to return a snippet with a
  placeholder still in it. Served whole at `/api/v1/snippets` and `/data/snippets.json`.
  `/api/v1/schema` stays exactly what SPEC.md says it is, the contents of
  `field_map.json`, which is why the snippets got their own endpoint.
- **Errors.** Always `{"error":{"code","message","status"}}` with the matching HTTP
  status. `invalid_parameter` is 400, `not_found` is 404, `method_not_allowed` is 405.

## MCP

Point any MCP client at `https://ngano.dev/mcp`. There is no auth.

```json
{
  "mcpServers": {
    "ngano": { "type": "http", "url": "https://ngano.dev/mcp" }
  }
}
```

Tools: `search_datasets`, `get_dataset`, `list_countries`, `get_country`,
`list_languages`, `get_language`, `get_stats`, `get_loader_snippet`. Every tool declares
an `inputSchema` and an `outputSchema` and returns both a human-readable `content` block
and `structuredContent`.

`get_loader_snippet` answers with the shipped SDK snippets. A `dataset_id` selects
`dataset_page` and `single_dataset`, a lone `language` selects `language_page`, a lone
`country` selects `country_page`, anything else selects `stream_filter`, and
`catalogue_filter` plus the install line always come along. All three SDKs come back
unless the caller passes `code_language`, which is named that way because `language`
already means the spoken language on every other tool. `languages` is accepted as an
alias. The three SDKs share filter names with two exceptions in Rust: the filter method
is `access_mode` rather than `access`, because `access` collides, and
`Loader::repo("owner/name")` loads a Hugging Face repo the catalogue does not list.

POST carries one JSON-RPC message, or a batch. Send `Accept: text/event-stream` and the
reply comes back as a single SSE `message` event instead. GET with the same Accept header
opens the server-to-client stream, which ngano keeps alive with comments because it has
no server-initiated requests to make.

## Licences

Code MIT. Catalogue data CC-BY-4.0.
