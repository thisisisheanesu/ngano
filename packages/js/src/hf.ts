/**
 * A small client for the Hugging Face datasets server.
 *
 * The datasets server exposes parquet-backed datasets over plain HTTP, so ngano
 * can stream rows with no Python runtime, no `datasets` install and no local
 * cache. Requests are paginated at the server's cap of 100 rows, retried with
 * jittered backoff on 429 and 5xx, and abortable at any point.
 *
 * @packageDocumentation
 */
import { NganoGatedError, NganoHttpError, NganoNotFoundError } from "./errors.js";
import type { DatasetFeature } from "./mapping.js";
import type { FetchLike } from "./types.js";

/** Base URL of the public datasets server. */
export const DATASETS_SERVER = "https://datasets-server.huggingface.co";

/** The server refuses `length` above this, so pagination is capped here. */
export const MAX_PAGE_SIZE = 100;

/** Environment variables consulted for a Hugging Face token, in order. */
const TOKEN_VARS = ["HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "HUGGINGFACE_HUB_TOKEN", "HF_API_TOKEN"];

/**
 * Reads a Hugging Face token from the environment, where one is readable.
 * Works under Node, Bun and Deno, and returns null in the browser.
 *
 * @returns the first token found, or null
 */
export function tokenFromEnv(): string | null {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  for (const name of TOKEN_VARS) {
    const value = proc?.env?.[name];
    if (value) return value;
  }
  const deno = (globalThis as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno;
  if (deno?.env) {
    for (const name of TOKEN_VARS) {
      try {
        const value = deno.env.get(name);
        if (value) return value;
      } catch {
        // Deno without --allow-env. Carry on unauthenticated.
      }
    }
  }
  return null;
}

/** Options shared by every datasets server call. */
export interface HfClientOptions {
  /** Hugging Face access token. Falls back to `HF_TOKEN` in the environment. */
  hfToken?: string | null;
  /** `fetch` implementation. Defaults to the global one. */
  fetch?: FetchLike;
  /** Base URL, overridable for testing or for a mirror. */
  baseUrl?: string;
  /** Number of retries after the first attempt. Defaults to 4. */
  maxRetries?: number;
  /** First backoff delay in milliseconds. Defaults to 500. */
  retryBaseMs?: number;
  /** Ceiling on a single backoff delay in milliseconds. Defaults to 20000. */
  retryMaxMs?: number;
  /** Sleep function, injectable so tests do not wait. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Aborts in-flight requests and pending backoff. */
  signal?: AbortSignal;
}

/** One row as the datasets server returns it. */
export interface ServerRow {
  /** Index of the row inside the split. */
  rowIdx: number;
  /** The row's cells, keyed by source column name. */
  row: Record<string, unknown>;
  /** Cells the server truncated because they were too large. */
  truncatedCells: string[];
}

/** A `config`, `split` pair available for a dataset. */
export interface SplitRef {
  /** Config name, for example `sw_ke`. */
  config: string;
  /** Split name, for example `train`. */
  split: string;
}

/** Arguments for {@link DatasetsServerClient.rows}. */
export interface RowsQuery {
  /** Hugging Face repo id. */
  dataset: string;
  /** Config name. */
  config: string;
  /** Split name. */
  split: string;
  /** Row index to start at. Defaults to 0. */
  offset?: number;
  /** Maximum rows to yield. Unlimited when omitted. */
  limit?: number;
  /** Rows per request, capped at {@link MAX_PAGE_SIZE}. */
  pageSize?: number;
  /** Aborts pagination. */
  signal?: AbortSignal;
}

/**
 * Waits, resolving early and rejecting if the signal aborts.
 *
 * @param ms milliseconds to wait
 * @param signal optional abort signal
 * @returns a promise that settles after the delay
 */
export function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Builds the error thrown when a caller aborts.
 *
 * @param signal the signal that aborted
 * @returns an `AbortError`
 */
function abortError(signal?: AbortSignal): Error {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

/**
 * Combines the client-wide signal with a per-call one, without requiring
 * `AbortSignal.any`, which is not in every supported runtime.
 *
 * @param signals signals to combine, nulls ignored
 * @returns a signal that aborts when any input does, or undefined
 */
export function combineSignals(
  ...signals: Array<AbortSignal | undefined>
): { signal: AbortSignal | undefined; dispose: () => void } {
  const live = signals.filter((s): s is AbortSignal => s !== undefined);
  if (live.length === 0) return { signal: undefined, dispose: () => {} };
  if (live.length === 1) return { signal: live[0], dispose: () => {} };
  const controller = new AbortController();
  const onAbort = (event: Event): void => {
    controller.abort((event.target as AbortSignal).reason);
  };
  for (const signal of live) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    dispose: () => {
      for (const signal of live) signal.removeEventListener("abort", onAbort);
    },
  };
}

/** True for statuses worth retrying. */
const isRetryable = (status: number): boolean => status === 429 || status === 408 || status >= 500;

/**
 * Client for the Hugging Face datasets server rows API.
 */
export class DatasetsServerClient {
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly retryMaxMs: number;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly signal: AbortSignal | undefined;
  /** The resolved token, or null when running unauthenticated. */
  readonly token: string | null;

  /**
   * @param options client configuration
   */
  constructor(options: HfClientOptions = {}) {
    const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
    const fetchImpl = options.fetch ?? globalFetch;
    if (!fetchImpl) {
      throw new Error(
        "No global fetch available. Use Node 18 or newer, or pass a fetch implementation.",
      );
    }
    this.fetchImpl = fetchImpl;
    this.baseUrl = (options.baseUrl ?? DATASETS_SERVER).replace(/\/$/, "");
    this.maxRetries = options.maxRetries ?? 4;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    this.retryMaxMs = options.retryMaxMs ?? 20_000;
    this.sleep = options.sleep ?? defaultSleep;
    this.signal = options.signal;
    this.token = options.hfToken ?? tokenFromEnv();
  }

  /** Headers sent with every request, including lazy audio reads. */
  get headers(): Record<string, string> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.token) headers["authorization"] = `Bearer ${this.token}`;
    return headers;
  }

  /**
   * Performs one GET with retries, backoff and abort support.
   *
   * @param path path under the base URL, for example `/rows`
   * @param params query parameters
   * @param dataset repo id, used to describe gated errors
   * @param signal per-call abort signal
   * @returns the parsed JSON body
   */
  async request<T>(
    path: string,
    params: Record<string, string | number | undefined>,
    dataset: string,
    signal?: AbortSignal,
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    const url = `${this.baseUrl}${path}?${query.toString()}`;
    const merged = combineSignals(this.signal, signal);

    try {
      let lastError: unknown;
      for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
        if (merged.signal?.aborted) throw abortError(merged.signal);

        let response: Response;
        try {
          const init: RequestInit = { headers: this.headers };
          if (merged.signal) init.signal = merged.signal;
          response = await this.fetchImpl(url, init);
        } catch (error) {
          if (isAbort(error)) throw error;
          lastError = error;
          if (attempt === this.maxRetries) break;
          await this.backoff(attempt, undefined, merged.signal);
          continue;
        }

        if (response.ok) return (await response.json()) as T;

        const body = await safeText(response);
        if (response.status === 401 || response.status === 403 || looksGated(body)) {
          throw new NganoGatedError(dataset, response.status, this.token !== null);
        }
        if (response.status === 404) {
          throw new NganoNotFoundError(dataset, `Not found on the datasets server: ${url}. ${body.slice(0, 200)}`);
        }
        if (!isRetryable(response.status)) throw new NganoHttpError(response.status, url, body);

        lastError = new NganoHttpError(response.status, url, body);
        if (attempt === this.maxRetries) break;
        await this.backoff(attempt, response.headers.get("retry-after"), merged.signal);
      }
      throw lastError instanceof Error
        ? lastError
        : new NganoHttpError(0, url, String(lastError ?? "request failed"));
    } finally {
      merged.dispose();
    }
  }

  /**
   * Sleeps for an exponential delay with full jitter, honouring `Retry-After`.
   *
   * @param attempt zero-based attempt number
   * @param retryAfter the `Retry-After` header, if any
   * @param signal abort signal
   */
  private async backoff(
    attempt: number,
    retryAfter: string | null | undefined,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    let delay = Math.min(this.retryBaseMs * 2 ** attempt, this.retryMaxMs);
    delay = Math.random() * delay;
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const explicit = Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(retryAfter) - Date.now();
      if (Number.isFinite(explicit) && explicit > 0) {
        delay = Math.min(Math.max(explicit, delay), this.retryMaxMs);
      }
    }
    await this.sleep(Math.max(0, Math.round(delay)), signal);
  }

  /**
   * Lists the config and split pairs a dataset exposes.
   *
   * @param dataset Hugging Face repo id
   * @param signal abort signal
   * @returns every `config`, `split` pair, in server order
   */
  async splits(dataset: string, signal?: AbortSignal): Promise<SplitRef[]> {
    const body = await this.request<{ splits?: Array<{ config?: string; split?: string }> }>(
      "/splits",
      { dataset },
      dataset,
      signal,
    );
    const refs: SplitRef[] = [];
    for (const entry of body.splits ?? []) {
      if (entry.config && entry.split) refs.push({ config: entry.config, split: entry.split });
    }
    return refs;
  }

  /**
   * Reads a dataset's declared features from `/info`.
   *
   * @param dataset Hugging Face repo id
   * @param config config name
   * @param signal abort signal
   * @returns feature descriptors, empty when the server states none
   */
  async info(dataset: string, config?: string, signal?: AbortSignal): Promise<DatasetFeature[]> {
    const body = await this.request<{ dataset_info?: unknown }>(
      "/info",
      { dataset, config },
      dataset,
      signal,
    );
    return featuresFromInfo(body.dataset_info, config);
  }

  /**
   * Reads the first page of a split, which is the cheapest way to learn the
   * real column names and their feature types.
   *
   * @param dataset Hugging Face repo id
   * @param config config name
   * @param split split name
   * @param signal abort signal
   * @returns features and the first rows
   */
  async firstRows(
    dataset: string,
    config: string,
    split: string,
    signal?: AbortSignal,
  ): Promise<{ features: DatasetFeature[]; rows: ServerRow[] }> {
    const body = await this.request<RowsResponse>(
      "/first-rows",
      { dataset, config, split },
      dataset,
      signal,
    );
    return { features: normaliseFeatures(body.features), rows: normaliseRows(body.rows) };
  }

  /**
   * Streams rows from one split, paginating transparently. Exactly one page is
   * held in memory at a time, and the next page is only requested once the
   * current one has been consumed, so breaking out of the loop stops the
   * fetching immediately.
   *
   * @param query what to stream and how much
   * @yields rows in split order
   */
  async *rows(query: RowsQuery): AsyncGenerator<ServerRow, void, undefined> {
    const pageSize = Math.max(1, Math.min(query.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE));
    let offset = query.offset ?? 0;
    let yielded = 0;
    const limit = query.limit;

    for (;;) {
      if (limit !== undefined && yielded >= limit) return;
      const length = limit === undefined ? pageSize : Math.min(pageSize, limit - yielded);
      const body = await this.request<RowsResponse>(
        "/rows",
        {
          dataset: query.dataset,
          config: query.config,
          split: query.split,
          offset,
          length,
        },
        query.dataset,
        query.signal,
      );
      const rows = normaliseRows(body.rows);
      if (rows.length === 0) return;

      for (const row of rows) {
        yield row;
        yielded += 1;
        if (limit !== undefined && yielded >= limit) return;
      }

      offset += rows.length;
      const total = typeof body.num_rows_total === "number" ? body.num_rows_total : undefined;
      if (rows.length < length) return;
      if (total !== undefined && offset >= total) return;
    }
  }
}

/** Raw shape of a `/rows` or `/first-rows` response. */
interface RowsResponse {
  features?: unknown;
  rows?: unknown;
  num_rows_total?: number;
  partial?: boolean;
}

/**
 * Normalises the `rows` array of a datasets server response.
 *
 * @param value raw `rows` value
 * @returns typed rows, skipping malformed entries
 */
function normaliseRows(value: unknown): ServerRow[] {
  if (!Array.isArray(value)) return [];
  const rows: ServerRow[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const row = record["row"];
    if (!row || typeof row !== "object") continue;
    rows.push({
      rowIdx: typeof record["row_idx"] === "number" ? record["row_idx"] : rows.length,
      row: row as Record<string, unknown>,
      truncatedCells: Array.isArray(record["truncated_cells"])
        ? (record["truncated_cells"] as string[])
        : [],
    });
  }
  return rows;
}

/**
 * Normalises the `features` array of a datasets server response.
 *
 * @param value raw `features` value
 * @returns feature descriptors, empty when absent
 */
export function normaliseFeatures(value: unknown): DatasetFeature[] {
  if (!Array.isArray(value)) return [];
  const features: DatasetFeature[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = record["name"];
    if (typeof name !== "string") continue;
    features.push({ name, type: record["type"] });
  }
  return features;
}

/**
 * Pulls feature descriptors out of an `/info` response, which nests them either
 * directly or under one entry per config.
 *
 * @param info the `dataset_info` value
 * @param config config name to prefer
 * @returns feature descriptors, empty when absent
 */
export function featuresFromInfo(info: unknown, config?: string): DatasetFeature[] {
  if (!info || typeof info !== "object") return [];
  const record = info as Record<string, unknown>;
  const direct = record["features"];
  if (direct && typeof direct === "object") return featuresFromMap(direct as Record<string, unknown>);
  const candidates = config && config in record ? [record[config]] : Object.values(record);
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const nested = (candidate as Record<string, unknown>)["features"];
    if (nested && typeof nested === "object") {
      return featuresFromMap(nested as Record<string, unknown>);
    }
  }
  return [];
}

/**
 * Converts an `/info` features object into descriptors.
 *
 * @param map column name to feature descriptor
 * @returns feature descriptors
 */
function featuresFromMap(map: Record<string, unknown>): DatasetFeature[] {
  return Object.entries(map).map(([name, type]) => ({ name, type }));
}

/**
 * Reads a response body without letting a decode failure mask the real error.
 *
 * @param response the failed response
 * @returns the body text, or an empty string
 */
async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/**
 * Detects a gate from an error body, since the server sometimes answers 404 for
 * datasets the caller cannot see.
 *
 * @param body error body text
 * @returns true when the body describes a gate
 */
function looksGated(body: string): boolean {
  const text = body.toLowerCase();
  return (
    text.includes("gated") ||
    text.includes("is private") ||
    text.includes("authenticated") ||
    text.includes("access to this dataset")
  );
}

/**
 * True when an error came from an abort rather than a transport failure.
 *
 * @param error the thrown value
 * @returns whether the error is an abort
 */
export function isAbort(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}
