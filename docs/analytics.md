# Traffic by country

ngano counts requests per country from inside the Worker. There is no analytics script
on the site and there is not going to be one: a beacon is an extra external request on a
page that makes almost none, every reader with a blocker is invisible to it, and it
cannot see the JSON API or the MCP endpoint at all, which is most of what ngano serves.

## What is recorded

One data point per request, written to Workers Analytics Engine:

| Field | Value |
| --- | --- |
| index | The country Cloudflare resolved, which is also the sampling key |
| blob1 | Country |
| blob2 | Surface: `site`, `api`, `mcp`, `data` or `asset` |
| blob3 | Route pattern, so `/countries/zw` and `/countries/ng` share `/countries/:iso2` |
| blob4 | Response status |
| blob5 | Cloudflare colo |
| double1 | 1 |

## What is not recorded

No IP addresses, no user agents, no referrers, no session or visitor identifiers, no
query strings, nothing that could single out one reader. This counts traffic, it does
not follow people. Anything added here should clear the same bar.

The route pattern matters for cost as well as privacy: recording raw paths would grow a
column value per dataset id, and the country breakdown this exists for would get slow
and expensive to read.

## Reading it

```sh
export CLOUDFLARE_API_TOKEN=...     # Account Analytics: Read
python3 scripts/traffic.py          # by country, last 7 days
python3 scripts/traffic.py --days 30 --by route
python3 scripts/traffic.py --by surface --json
```

Counts are `SUM(_sample_interval)` rather than row counts, because Analytics Engine
samples under load and reports the rate per row. At ngano's volume the interval is 1 and
the two agree; the query stays correct if that stops being true.

## What the number actually is

These are requests that **reached the Worker**. Pages are served with
`s-maxage=3600` and assets with `s-maxage=86400`, so Cloudflare's edge answers a
repeated request from cache without invoking the Worker at all, and that hit is not
counted here. Expect this to undercount, by more for the assets and the popular pages
than for the API.

That is the honest trade for counting server side, and it is the right trade: the
alternative is a page script that misses every reader with a blocker and cannot see the
API or MCP endpoint at all. When you want the true edge total instead, the zone's own
Traffic analytics in the dashboard counts every request including cache hits, and has a
country breakdown of its own. Use both: the dashboard for volume, this for what people
asked for.

## Setup

The binding lives in `worker/wrangler.toml`:

```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "ngano_requests"
```

Analytics Engine has to be enabled once per account before a Worker can bind it, at
**Workers and Pages, Analytics Engine** in the dashboard. Until it is, `wrangler deploy`
refuses with `code: 10089`. The binding is optional in `Env`, so a fork without it, and
`wrangler dev`, both run with the counter simply switched off.
