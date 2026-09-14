/**
 * Reading the request counts back out of Workers Analytics Engine.
 *
 * There is no binding for reading, only for writing, so this goes over the SQL API with
 * an account token. The token is a Worker secret with one permission, Account Analytics
 * Read, and it never reaches the browser: the dashboard renders server side and the
 * page that comes back is HTML, not a proxied API response.
 */

const DATASET = 'ngano_requests';

export interface Row {
  key: string;
  requests: number;
}

export interface Series {
  bucket: string;
  requests: number;
}

export interface Traffic {
  countries: Row[];
  surfaces: Row[];
  routes: Row[];
  statuses: Row[];
  colos: Row[];
  overTime: Series[];
  total: number;
  /** Set when the query failed, so the page can say so rather than showing zeroes. */
  error?: string;
}

interface SqlResult {
  data?: Record<string, string | number>[];
}

/** The blob columns, in the order `src/analytics.ts` writes them. */
const COLUMN = {
  country: 'blob1',
  surface: 'blob2',
  route: 'blob3',
  status: 'blob4',
  colo: 'blob5',
} as const;

async function sql(accountId: string, token: string, query: string): Promise<SqlResult> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body: query,
  });
  if (!res.ok) throw new Error(`analytics query failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as SqlResult;
}

/*
 * Assets stopped being recorded, but the rows written before that stay in the dataset
 * for its retention window and would keep showing up in every breakdown and in the
 * totals. Analytics Engine has no delete, so they are excluded here instead. Once the
 * window has rolled past the change this clause matches nothing and costs nothing.
 */
const NOT_ASSETS = `blob2 != 'asset'`;

/*
 * Counts are SUM(_sample_interval), not COUNT(). Analytics Engine samples under load
 * and reports the rate on each row; summing the interval is the count that stays right
 * when that happens, and equals the row count when it does not.
 */
function groupBy(column: string, days: number, limit: number): string {
  return `SELECT ${column} AS key, SUM(_sample_interval) AS requests
          FROM ${DATASET}
          WHERE timestamp > NOW() - INTERVAL '${days}' DAY AND ${NOT_ASSETS}
          GROUP BY key ORDER BY requests DESC LIMIT ${limit}`;
}

function rowsOf(result: SqlResult): Row[] {
  return (result.data ?? []).map((r) => ({ key: String(r.key ?? ''), requests: Number(r.requests ?? 0) }));
}

export async function fetchTraffic(
  accountId: string,
  token: string,
  days: number,
): Promise<Traffic> {
  const empty: Traffic = {
    countries: [], surfaces: [], routes: [], statuses: [], colos: [], overTime: [], total: 0,
  };
  try {
    /* One round trip per breakdown, in parallel: six small queries beat one wide one. */
    const [countries, surfaces, routes, statuses, colos, series] = await Promise.all([
      sql(accountId, token, groupBy(COLUMN.country, days, 250)),
      sql(accountId, token, groupBy(COLUMN.surface, days, 10)),
      sql(accountId, token, groupBy(COLUMN.route, days, 40)),
      sql(accountId, token, groupBy(COLUMN.status, days, 20)),
      sql(accountId, token, groupBy(COLUMN.colo, days, 40)),
      sql(
        accountId,
        token,
        `SELECT toStartOfInterval(timestamp, INTERVAL '${days <= 2 ? 1 : 24}' HOUR) AS key,
                SUM(_sample_interval) AS requests
         FROM ${DATASET}
         WHERE timestamp > NOW() - INTERVAL '${days}' DAY AND ${NOT_ASSETS}
         GROUP BY key ORDER BY key ASC LIMIT 200`,
      ),
    ]);

    const countryRows = rowsOf(countries);
    return {
      countries: countryRows,
      surfaces: rowsOf(surfaces),
      routes: rowsOf(routes),
      statuses: rowsOf(statuses),
      colos: rowsOf(colos),
      overTime: rowsOf(series).map((r) => ({ bucket: r.key, requests: r.requests })),
      total: countryRows.reduce((sum, r) => sum + r.requests, 0),
    };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : 'Unknown error.' };
  }
}
