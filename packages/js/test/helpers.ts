/**
 * Test helpers: a scriptable fake datasets server, entirely offline.
 *
 * @packageDocumentation
 */
import { vi } from "vitest";
import type { FetchLike } from "../src/types.js";

/** A response body, either fixed or computed from the request. */
export type RouteBody =
  | Record<string, unknown>
  | unknown[]
  | ((params: URLSearchParams, url: string) => unknown);

/** A canned response for one URL pattern. */
export interface Route {
  /** Substring or regular expression the request URL must match. */
  match: string | RegExp;
  /** HTTP status, defaults to 200. */
  status?: number;
  /** JSON body, or a function of the parsed query. */
  body?: RouteBody;
  /** Plain text body, used instead of `body` for error cases. */
  text?: string;
  /** Response headers. */
  headers?: Record<string, string>;
  /** Serve this route at most this many times, then fall through. */
  times?: number;
}

/** A fake fetch plus the log of what it was asked for. */
export interface FakeFetch {
  /** The fetch implementation to pass into the SDK. */
  fetch: FetchLike;
  /** Every URL requested, in order. */
  calls: string[];
  /** Abort signals seen, in order, one per call. */
  signals: Array<AbortSignal | undefined>;
}

/**
 * Builds a fetch that answers from a route table and records every call.
 *
 * @param routes routes tried in order, first match wins
 * @returns the fake fetch and its call log
 */
export function fakeFetch(routes: Route[]): FakeFetch {
  const calls: string[] = [];
  const signals: Array<AbortSignal | undefined> = [];
  const used = new Map<Route, number>();

  const fetchImpl: FetchLike = async (input, init) => {
    const url = String(input);
    calls.push(url);
    signals.push(init?.signal ?? undefined);
    if (init?.signal?.aborted) {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      throw error;
    }

    const query = new URLSearchParams(url.includes("?") ? url.slice(url.indexOf("?") + 1) : "");
    for (const route of routes) {
      const hit =
        typeof route.match === "string" ? url.includes(route.match) : route.match.test(url);
      if (!hit) continue;
      const count = used.get(route) ?? 0;
      if (route.times !== undefined && count >= route.times) continue;
      used.set(route, count + 1);

      const status = route.status ?? 200;
      const payload = typeof route.body === "function" ? route.body(query, url) : route.body;
      const text = route.text ?? JSON.stringify(payload ?? {});
      return new Response(text, {
        status,
        headers: { "content-type": "application/json", ...(route.headers ?? {}) },
      });
    }
    return new Response(JSON.stringify({ error: "no route" }), { status: 404 });
  };

  return { fetch: vi.fn(fetchImpl) as unknown as FetchLike, calls, signals };
}

/**
 * Builds a `/splits` body.
 *
 * @param dataset repo id
 * @param pairs config and split pairs
 * @returns the response body
 */
export function splitsBody(
  dataset: string,
  pairs: Array<[string, string]>,
): Record<string, unknown> {
  return {
    splits: pairs.map(([config, split]) => ({ dataset, config, split })),
    pending: [],
    failed: [],
  };
}

/**
 * Builds a `/rows` or `/first-rows` body.
 *
 * @param rows raw row objects
 * @param options total row count and feature descriptors
 * @returns the response body
 */
export function rowsBody(
  rows: Array<Record<string, unknown>>,
  options: {
    total?: number;
    features?: Array<{ name: string; type?: unknown }>;
    offset?: number;
  } = {},
): Record<string, unknown> {
  const offset = options.offset ?? 0;
  return {
    features: (
      options.features ??
      Object.keys(rows[0] ?? {}).map((name) => ({ name, type: undefined as unknown }))
    ).map((feature, index) => ({
      feature_idx: index,
      name: feature.name,
      type: feature.type ?? { dtype: "string", _type: "Value" },
    })),
    rows: rows.map((row, index) => ({ row_idx: offset + index, row, truncated_cells: [] })),
    num_rows_total: options.total ?? rows.length,
    num_rows_per_page: 100,
    partial: false,
  };
}

/**
 * Generates numbered rows, so pagination can be checked by transcript.
 *
 * @param count how many rows
 * @param start first index
 * @param extra extra columns merged into every row
 * @returns the rows
 */
export function numberedRows(
  count: number,
  start = 0,
  extra: Record<string, unknown> = {},
): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_value, index) => ({
    sentence: `row-${start + index}`,
    audio: [{ src: `https://example.test/audio/${start + index}.wav`, type: "audio/wav" }],
    ...extra,
  }));
}

/** A sleep that records the delays asked for without waiting. */
export function recordingSleep(): {
  sleep: (ms: number) => Promise<void>;
  delays: number[];
} {
  const delays: number[] = [];
  return {
    sleep: async (ms: number): Promise<void> => {
      delays.push(ms);
    },
    delays,
  };
}
