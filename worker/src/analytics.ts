/**
 * Per-country request counts, written from the Worker itself.
 *
 * The site has no client-side analytics and is not getting any: a beacon script is one
 * more external request on a page that makes almost none, it misses every reader with
 * an ad blocker, and it cannot see the API or the MCP endpoint at all, which is most of
 * what ngano actually serves. The Worker is already in the path for every request and
 * Cloudflare hands it `request.cf.country` for free, so the count is taken there.
 *
 * What is recorded: the country Cloudflare resolved, which kind of thing was asked for,
 * the route pattern, and the status. What is not recorded, and must not be added: IP
 * addresses, user agents, referrers, session or visitor identifiers, query strings, or
 * anything else that could single out one reader. This counts traffic, it does not
 * follow people.
 */

import type { Env } from './data.js';

/**
 * What was asked for, coarse enough to be worth grouping by.
 *
 * `asset` exists so those requests can be recognised and dropped. The stylesheet and
 * the scripts are loaded by the pages that are already counted, so counting them again
 * measures nothing except how often the browser cache missed.
 */
export type Surface = 'site' | 'api' | 'mcp' | 'admin' | 'data' | 'asset';

/**
 * Collapse a path to its route pattern, so `/countries/zw` and `/countries/ng` are one
 * row rather than 58. Without this the dataset grows a column value per dataset id and
 * the country breakdown gets expensive to read for no gain.
 */
export function routeLabel(path: string): string {
  if (path === '' || path === '/') return '/';
  const patterns: [RegExp, string][] = [
    [/^\/countries\/[^/]+$/, '/countries/:iso2'],
    [/^\/languages\/[^/]+$/, '/languages/:tag'],
    [/^\/datasets\/.+$/, '/datasets/:id'],
    [/^\/data\/[^/]+$/, '/data/:file'],
    [/^\/api\/v1\/datasets\/.+$/, '/api/v1/datasets/:id'],
    [/^\/api\/v1\/countries\/[^/]+$/, '/api/v1/countries/:iso2'],
    [/^\/api\/v1\/languages\/[^/]+$/, '/api/v1/languages/:tag'],
  ];
  for (const [pattern, label] of patterns) {
    if (pattern.test(path)) return label;
  }
  return path.length > 64 ? '/other' : path;
}

/** Which part of ngano a path belongs to. */
export function surfaceOf(path: string): Surface {
  if (path === '/mcp') return 'mcp';
  if (path.startsWith('/api/v1')) return 'api';
  /* Before the site check: my own visits are not page views. */
  if (path === '/admin' || path.startsWith('/admin/')) return 'admin';
  if (path.startsWith('/data/')) return 'data';
  if (/^\/(styles\.css|site\.js|map\.js|filter\.js|favicon\.(svg|ico)|og\.svg|robots\.txt|sitemap\.xml)$/.test(path)) {
    return 'asset';
  }
  return 'site';
}

/**
 * Record one request.
 *
 * Errors are swallowed whole. A counter that can take the site down is worse than no
 * counter, and `writeDataPoint` is fire and forget by design: it returns immediately
 * and never blocks the response.
 */
export function record(
  env: Env,
  req: Request,
  path: string,
  surface: Surface,
  status: number,
): void {
  const dataset = env.ANALYTICS;
  if (!dataset) return;
  /*
   * The stylesheet, the scripts and the icons are not interesting. Every one of them is
   * pulled by a page that is already counted, so recording them inflates the totals with
   * a number that really measures cache misses, and it crowds the route breakdown with
   * rows nobody is going to act on.
   */
  if (surface === 'asset') return;
  try {
    const country = (req.cf?.country as string | undefined) ?? 'XX';
    const colo = (req.cf?.colo as string | undefined) ?? '';
    dataset.writeDataPoint({
      /*
       * The index is the sampling key. Country is the right one here: it keeps a busy
       * country's rows from crowding out a quiet one, which is exactly the comparison
       * this data exists to support.
       */
      indexes: [country],
      blobs: [country, surface, routeLabel(path), String(status), colo],
      doubles: [1],
    });
  } catch {
    /* Analytics must never break a response. */
  }
}
