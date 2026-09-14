#!/usr/bin/env python3
"""Read ngano's per-country request counts out of Workers Analytics Engine.

The Worker writes one data point per request (see `worker/src/analytics.ts`). This
queries them over Cloudflare's SQL API and prints the breakdown.

    export CLOUDFLARE_API_TOKEN=...          # needs Account Analytics: Read
    python3 scripts/traffic.py               # by country, last 7 days
    python3 scripts/traffic.py --days 30
    python3 scripts/traffic.py --by route    # or: surface, colo, status
    python3 scripts/traffic.py --json

Sampling: Analytics Engine samples under load and reports the rate per row, so every
count here is the sum of `_sample_interval`, not a raw row count. At ngano's volume the
interval is 1 and the two are the same; the query is written to stay correct if that
changes.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

ACCOUNT_ID = "67cb2eb6080019612e374af596f7197c"
DATASET = "ngano_requests"

# The blob columns, in the order src/analytics.ts writes them.
COLUMNS = {
    "country": "blob1",
    "surface": "blob2",
    "route": "blob3",
    "status": "blob4",
    "colo": "blob5",
}


def query(sql: str, token: str) -> dict:
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/analytics_engine/sql"
    req = urllib.request.Request(
        url,
        data=sql.encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "text/plain"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        sys.exit(f"analytics query failed ({e.code}): {body[:400]}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=int, default=7, help="how far back to look (default 7)")
    ap.add_argument("--by", default="country", choices=sorted(COLUMNS), help="what to group by")
    ap.add_argument("--limit", type=int, default=60)
    ap.add_argument("--json", action="store_true", help="print the rows as JSON")
    args = ap.parse_args()

    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not token:
        sys.exit(
            "Set CLOUDFLARE_API_TOKEN to a token with Account Analytics: Read.\n"
            "Create one at https://dash.cloudflare.com/profile/api-tokens"
        )

    column = COLUMNS[args.by]
    sql = f"""
        SELECT {column} AS key,
               SUM(_sample_interval) AS requests
        FROM {DATASET}
        WHERE timestamp > NOW() - INTERVAL '{args.days}' DAY
        GROUP BY key
        ORDER BY requests DESC
        LIMIT {args.limit}
    """
    rows = query(sql, token).get("data", [])

    if args.json:
        print(json.dumps(rows, indent=2))
        return

    if not rows:
        print(f"No requests recorded in the last {args.days} days.")
        print("If the Worker was deployed recently, give it traffic and try again.")
        return

    total = sum(float(r["requests"]) for r in rows)
    width = max(len(str(r["key"])) for r in rows)
    print(f"ngano requests by {args.by}, last {args.days} days\n")
    for r in rows:
        n = float(r["requests"])
        share = n / total if total else 0
        bar = "#" * round(share * 34)
        print(f"  {str(r['key']):<{width}}  {int(n):>8,}  {share:6.1%}  {bar}")
    print(f"\n  {'total':<{width}}  {int(total):>8,}")


if __name__ == "__main__":
    main()
