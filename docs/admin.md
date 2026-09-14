# The admin dashboard

`https://ngano.dev/admin` shows the traffic the Worker counts, behind a password. It is
not linked from the public site, it is `noindex`, it is `Disallow`ed in robots.txt, and
every response is `no-store`.

## What it shows

Requests counted, countries seen, busiest country, page views, API and MCP calls; a
column chart of requests over time; breakdowns by country, surface, route and response
status; the full country table so nothing hides behind a top-25 cut; and the catalogue
totals. A range switch covers 24 hours, 7, 30 and 90 days.

The traffic numbers count requests that reached the Worker. Cloudflare answers repeats
from its edge cache without running it, so they undercount, more for assets than for the
API. See `analytics.md`.

## How the password works

Credentials live in the `ADMIN` KV namespace, not in a Worker secret, so they can be
changed from the dashboard without a redeploy. A password that needs a deploy to rotate
never gets rotated.

- PBKDF2-HMAC-SHA256, 600,000 iterations, 16-byte random salt per password, 32-byte key.
  Workers refuses a single `deriveBits` above 100,000 iterations, so the work runs as six
  chained rounds, each seeding the next. The total work an attacker repeats is the same.
- The plaintext is never stored or logged.
- Changing the password signs out **every** session, including the one doing the change.
  A rotation that leaves old sessions live has not rotated anything.
- Sessions are random 256-bit ids in KV with a 12 hour TTL, in an `HttpOnly`, `Secure`,
  `SameSite=Strict` cookie scoped to `/admin`. Forms carry a per-session CSRF token.
- Login compares the password even when the username is wrong, so the two failures take
  the same time and the response cannot be used to learn which half was right.
- Eight failures from one address inside fifteen minutes locks that address out.

## Changing it

Sign in, **Change password**, give the current one and the new one twice. Minimum twelve
characters; length is the rule, not character classes. The username can be changed on
the same form.

To reset it without signing in, overwrite the KV record directly:

```sh
# hash the new password the same way the Worker does, then
npx wrangler kv key put --namespace-id <ADMIN id> admin:user --path user.json
```

`scripts/admin_password.py` does the hashing and writes the file for you.

## Configuration

Two bindings, both in `worker/wrangler.toml` except the secret:

```toml
[[kv_namespaces]]
binding = "ADMIN"
id = "..."
```

```sh
npx wrangler secret put CF_ANALYTICS_TOKEN   # Account Analytics: Read
```

Both are optional in `Env`. With either missing the whole `/admin` subtree answers 404
rather than showing a login box it cannot check, so a fork of this repo has no admin at
all until it configures one.
