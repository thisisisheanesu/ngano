/**
 * Streaming loaders.
 *
 * `load()` turns a catalogue filter into a stream of unified rows, pulled from
 * the Hugging Face datasets server one page at a time. `loadDataset()` does the
 * same for a single repo, catalogued or not.
 *
 * Nothing is buffered beyond the page in flight, and breaking out of the loop
 * aborts every request that is still open.
 *
 * @packageDocumentation
 */
import { Catalogue, countableHours, getDefaultCatalogue } from "./catalogue.js";
import { FIELD_MAP } from "./data/snapshot.js";
import { NganoError } from "./errors.js";
import { toOptions, type FilterLike, type FilterOptions } from "./filter.js";
import { DatasetsServerClient, isAbort, type SplitRef } from "./hf.js";
import { languageName, primaryCode, resolveLanguage, resolveLanguages } from "./languages.js";
import { applyMapping, buildMapping, type ColumnMapping, type DatasetFeature } from "./mapping.js";
import type { Dataset, FetchLike, FieldMap, InterleaveMode, Row } from "./types.js";

/** How a load reacts when one dataset fails. */
export type ErrorPolicy = "skip" | "throw" | ((error: unknown, source: SourceInfo) => void);

/** Identifies the dataset a stream error came from. */
export interface SourceInfo {
  /** Hugging Face repo id. */
  hfRepo: string;
  /** ngano catalogue id, when catalogued. */
  datasetId: string | null;
}

/** Options common to {@link load} and {@link loadDataset}. */
export interface StreamOptions {
  /** Config name or names. Use `"all"` for every config. */
  config?: string | string[];
  /** Split name or names. Use `"all"` for every split. Defaults to train. */
  split?: string | string[];
  /** Stop after this many rows in total. */
  limit?: number;
  /** Skip this many rows in each split before yielding. */
  offset?: number;
  /** Rows per HTTP request, capped at 100 by the datasets server. */
  pageSize?: number;
  /** Hugging Face token. Falls back to `HF_TOKEN` in the environment. */
  hfToken?: string | null;
  /** Aborts every request in flight and ends the stream. */
  signal?: AbortSignal;
  /** `fetch` implementation. Defaults to the global one. */
  fetch?: FetchLike;
  /** Datasets server base URL, overridable for testing or a mirror. */
  baseUrl?: string;
  /** Retries after the first attempt, on 429 and 5xx. Defaults to 4. */
  maxRetries?: number;
  /** First backoff delay in milliseconds. Defaults to 500. */
  retryBaseMs?: number;
  /** Sleep function, injectable so tests do not wait. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Catalogue used for metadata. Defaults to the bundled snapshot. */
  catalogue?: Catalogue;
  /** Field map used for column mapping. Defaults to the bundled one. */
  fieldMap?: FieldMap;
  /**
   * What to do when one dataset fails. `"skip"`, the default, moves on to the
   * next dataset and records the error on {@link NganoStream.errors}. If every
   * dataset fails, the first error is thrown, so a single gated repo still
   * surfaces its `NganoGatedError`.
   */
  onError?: ErrorPolicy;
}

/** Options for {@link load}: catalogue filters plus streaming options. */
export interface LoadOptions extends FilterOptions, StreamOptions {
  /** How rows from several datasets are interleaved. Defaults to round robin. */
  interleave?: InterleaveMode;
  /** Cap on how many matching datasets are streamed. Unlimited by default. */
  maxDatasets?: number;
}

/** Options for {@link loadDataset}. */
export interface LoadDatasetOptions extends StreamOptions {
  /**
   * Language recorded on rows when the dataset itself states none. A tag, a
   * bare ISO 639-3 code or a name: the tag and the code on the row are resolved
   * from it, and the name is kept as the caller wrote it.
   */
  language?: string;
  /** ISO 3166-1 alpha-2 recorded on rows when the dataset states none. */
  country?: string;
  /**
   * Narrows which configs are streamed, the way a `load()` language filter
   * does, without changing what is recorded on the rows.
   */
  iso?: string | string[];
}

/**
 * An async iterable of rows, carrying the counts that produced it.
 */
export interface NganoStream extends AsyncIterable<Row> {
  /** How many catalogue datasets matched the filter. */
  readonly matched: number;
  /** How many of those can actually be streamed, that is, have a HF repo. */
  readonly loadable: number;
  /** The loadable datasets, in the order they will be pulled from. */
  readonly datasets: readonly Dataset[];
  /** Errors from datasets that were skipped, filled in as the stream runs. */
  readonly errors: ReadonlyArray<{ source: SourceInfo; error: unknown }>;
  /**
   * Collects rows into an array. Only for small limits, since it defeats the
   * point of streaming.
   *
   * @param limit maximum rows to collect
   * @returns the collected rows
   */
  toArray(limit?: number): Promise<Row[]>;
}

/** One catalogue dataset, ready to stream. */
interface Source {
  /** The catalogue record, or null for an uncatalogued repo. */
  dataset: Dataset | null;
  /** Hugging Face repo id. */
  repo: string;
  /** Weight used by the `weighted_by_hours` scheduler. */
  weight: number;
}

/**
 * Streams rows matching a catalogue filter.
 *
 * @param options catalogue filters plus streaming options
 * @returns an async iterable of unified rows
 *
 * @example
 * ```ts
 * for await (const row of load({ language: ["Shona", "Ndebele"], country: "ZW",
 *                                commercial: true, split: "train", limit: 1000 })) {
 *   console.log(row.transcript, row.durationS);
 * }
 * ```
 */
export function load(options: LoadOptions = {}): NganoStream {
  const catalogue = options.catalogue ?? getDefaultCatalogue();
  const filter: FilterOptions = toOptions(options as FilterLike);
  const matchedDatasets = catalogue.datasets(filter);
  let loadable = matchedDatasets.filter((dataset) => dataset.hfRepo !== null);
  if (options.maxDatasets !== undefined && options.maxDatasets > 0) {
    loadable = loadable.slice(0, options.maxDatasets);
  }
  const sources: Source[] = loadable.map((dataset) => ({
    dataset,
    repo: dataset.hfRepo as string,
    weight: Math.max(countableHours(dataset), 0.1),
  }));

  return makeStream(sources, options, catalogue, matchedDatasets.length, loadable);
}

/**
 * Streams rows from one Hugging Face dataset, whether or not it is catalogued.
 *
 * @param repo Hugging Face repo id, for example `google/fleurs`
 * @param options streaming options
 * @returns an async iterable of unified rows
 *
 * @example
 * ```ts
 * for await (const row of loadDataset("google/fleurs", { config: "sw_ke" })) {
 *   console.log(row.transcript);
 * }
 * ```
 */
export function loadDataset(repo: string, options: LoadDatasetOptions = {}): NganoStream {
  if (!repo || !repo.trim()) {
    throw new NganoLoadError("loadDataset needs a Hugging Face repo id, for example google/fleurs.");
  }
  const catalogue = options.catalogue ?? getDefaultCatalogue();
  const dataset = catalogue.getByRepo(repo) ?? null;
  const source: Source = {
    dataset,
    repo,
    weight: dataset ? Math.max(countableHours(dataset), 0.1) : 1,
  };
  const askedTag = options.language ? (resolveLanguage(options.language)[0] ?? null) : null;
  return makeStream([source], options, catalogue, 1, dataset ? [dataset] : [], {
    language: options.language ?? null,
    languageTag: askedTag,
    country: options.country ?? null,
  });
}

/** Row metadata forced by the caller, used by {@link loadDataset}. */
interface Fallbacks {
  /** Language name to record when the dataset states none. */
  language: string | null;
  /** BCP 47 tag to record when the dataset states none. */
  languageTag: string | null;
  /** ISO 3166-1 alpha-2 to record when the dataset states none. */
  country: string | null;
}

/**
 * Wires the sources, the scheduler and the client into an iterable.
 *
 * @param sources datasets to stream
 * @param options streaming options
 * @param catalogue catalogue used for metadata
 * @param matched number of catalogue matches before the HF repo requirement
 * @param datasets the loadable datasets, for {@link NganoStream.datasets}
 * @param fallbacks row metadata forced by the caller
 * @returns the stream
 */
function makeStream(
  sources: Source[],
  options: StreamOptions & { interleave?: InterleaveMode },
  catalogue: Catalogue,
  matched: number,
  datasets: readonly Dataset[],
  fallbacks: Fallbacks = { language: null, languageTag: null, country: null },
): NganoStream {
  const errors: Array<{ source: SourceInfo; error: unknown }> = [];

  const stream: NganoStream = {
    matched,
    loadable: sources.length,
    datasets,
    errors,
    [Symbol.asyncIterator](): AsyncIterator<Row> {
      return iterate(sources, options, catalogue, errors, fallbacks)[Symbol.asyncIterator]();
    },
    async toArray(limit?: number): Promise<Row[]> {
      const rows: Row[] = [];
      for await (const row of stream) {
        rows.push(row);
        if (limit !== undefined && rows.length >= limit) break;
      }
      return rows;
    },
  };
  return stream;
}

/**
 * The scheduler. Owns one abort controller for the whole load, so that leaving
 * the loop early tears down every child iterator and every request in flight.
 *
 * @param sources datasets to stream
 * @param options streaming options
 * @param catalogue catalogue used for metadata
 * @param errors array that skipped-dataset errors are pushed onto
 * @param fallbacks row metadata forced by the caller
 * @yields unified rows
 */
async function* iterate(
  sources: Source[],
  options: StreamOptions & { interleave?: InterleaveMode },
  catalogue: Catalogue,
  errors: Array<{ source: SourceInfo; error: unknown }>,
  fallbacks: Fallbacks,
): AsyncGenerator<Row, void, undefined> {
  if (sources.length === 0) return;

  const controller = new AbortController();
  const onOuterAbort = (): void => controller.abort(options.signal?.reason);
  if (options.signal) {
    if (options.signal.aborted) controller.abort(options.signal.reason);
    else options.signal.addEventListener("abort", onOuterAbort, { once: true });
  }

  const client = new DatasetsServerClient({
    hfToken: options.hfToken ?? null,
    fetch: options.fetch,
    baseUrl: options.baseUrl,
    maxRetries: options.maxRetries,
    retryBaseMs: options.retryBaseMs,
    sleep: options.sleep,
    signal: controller.signal,
  });

  const fieldMap = options.fieldMap ?? (FIELD_MAP as FieldMap);
  const policy = options.onError ?? "skip";
  const mode: InterleaveMode = options.interleave ?? "round_robin";
  const limit = options.limit;

  interface Lane {
    source: Source;
    iterator: AsyncIterator<Row>;
    done: boolean;
    weight: number;
    credit: number;
  }

  const lanes: Lane[] = sources.map((source) => ({
    source,
    iterator: streamSource(
      source,
      client,
      options,
      fieldMap,
      catalogue,
      fallbacks,
      controller.signal,
    )[Symbol.asyncIterator](),
    done: false,
    weight: source.weight,
    credit: 0,
  }));

  let yielded = 0;
  let liveSources = lanes.length;

  /**
   * Throws as soon as the caller aborts, so buffered rows are not drained
   * after the fact.
   */
  const ensureLive = (): void => {
    if (!controller.signal.aborted) return;
    const reason = controller.signal.reason;
    if (reason instanceof Error) throw reason;
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    throw error;
  };

  /**
   * Pulls the next row from one lane, applying the error policy.
   *
   * @param lane the lane to pull from
   * @returns a row, or null when the lane has finished or failed
   */
  const pull = async (lane: Lane): Promise<Row | null> => {
    try {
      const result = await lane.iterator.next();
      if (result.done) {
        lane.done = true;
        return null;
      }
      return result.value;
    } catch (error) {
      lane.done = true;
      // An abort is the caller's decision, never a dataset failure to skip.
      if (isAbort(error)) throw error;
      const info: SourceInfo = {
        hfRepo: lane.source.repo,
        datasetId: lane.source.dataset?.id ?? null,
      };
      errors.push({ source: info, error });
      if (policy === "throw") throw error;
      if (typeof policy === "function") policy(error, info);
      return null;
    }
  };

  try {
    if (mode === "sequential") {
      for (const lane of lanes) {
        for (;;) {
          ensureLive();
          const row = await pull(lane);
          if (row === null) break;
          yield row;
          yielded += 1;
          if (limit !== undefined && yielded >= limit) return;
        }
      }
    } else if (mode === "weighted_by_hours") {
      const total = lanes.reduce((sum, lane) => sum + lane.weight, 0);
      while (liveSources > 0) {
        ensureLive();
        let chosen: Lane | null = null;
        for (const lane of lanes) {
          if (lane.done) continue;
          lane.credit += lane.weight;
          if (chosen === null || lane.credit > chosen.credit) chosen = lane;
        }
        if (chosen === null) break;
        chosen.credit -= total;
        const row = await pull(chosen);
        if (row === null) {
          liveSources -= 1;
          continue;
        }
        yield row;
        yielded += 1;
        if (limit !== undefined && yielded >= limit) return;
      }
    } else {
      let index = 0;
      while (liveSources > 0) {
        ensureLive();
        const lane = lanes[index % lanes.length] as Lane;
        index += 1;
        if (lane.done) continue;
        const row = await pull(lane);
        if (row === null) {
          liveSources -= 1;
          continue;
        }
        yield row;
        yielded += 1;
        if (limit !== undefined && yielded >= limit) return;
      }
    }

    if (yielded === 0 && errors.length > 0 && errors.length === sources.length) {
      throw errors[0]?.error;
    }
  } finally {
    options.signal?.removeEventListener("abort", onOuterAbort);
    controller.abort();
    await Promise.allSettled(lanes.map((lane) => lane.iterator.return?.(undefined)));
  }
}

/**
 * Streams every chosen config and split of one dataset, in order.
 *
 * @param source the dataset to stream
 * @param client datasets server client
 * @param options streaming options
 * @param fieldMap field map for column mapping
 * @param catalogue catalogue, used to resolve country names on rows
 * @param fallbacks row metadata forced by the caller
 * @param signal abort signal owned by the scheduler
 * @yields unified rows
 */
async function* streamSource(
  source: Source,
  client: DatasetsServerClient,
  options: StreamOptions,
  fieldMap: FieldMap,
  catalogue: Catalogue,
  fallbacks: Fallbacks,
  signal: AbortSignal,
): AsyncGenerator<Row, void, undefined> {
  const refs = await client.splits(source.repo, signal);
  const chosen = chooseSplits(refs, options, source.dataset);
  if (chosen.length === 0) return;

  const mappings = new Map<string, ColumnMapping>();
  const dataset = source.dataset;
  // A record covering one language can label its rows; one covering several
  // cannot, because the row itself is what says which of them it is.
  const soleTag =
    fallbacks.languageTag ??
    (dataset && dataset.languageTags.length === 1 ? (dataset.languageTags[0] as string) : null);
  const language =
    fallbacks.language ??
    (dataset && dataset.languagesClean.length === 1
      ? (dataset.languagesClean[0] as string)
      : soleTag
        ? languageName(soleTag)
        : null);
  const languageIso = soleTag ? primaryCode(soleTag) : null;
  const country =
    fallbacks.country ??
    (dataset && dataset.countryCodes.length === 1 ? (dataset.countryCodes[0] as string) : null);
  const fetchImpl = options.fetch ?? ((globalThis as { fetch?: FetchLike }).fetch as FetchLike);

  for (const ref of chosen) {
    const cacheKey = `${ref.config}::${ref.split}`;
    let mapping = mappings.get(cacheKey);
    if (!mapping) {
      mapping = await resolveMapping(client, source.repo, ref, fieldMap, signal);
      mappings.set(cacheKey, mapping);
    }

    const context = {
      hfRepo: source.repo,
      split: ref.split,
      datasetId: dataset?.id ?? null,
      licence: dataset?.licence ?? null,
      sourceUrl: dataset?.url ?? `https://huggingface.co/datasets/${source.repo}`,
      country,
      language,
      languageTag: soleTag,
      languageIso,
      fetchImpl,
      headers: client.headers,
      resolveCountry: (value: string): string | null => catalogue.resolveCountry(value),
      // Exactly one tag or nothing: a row value that could mean several
      // languages is not the source telling us which one this row is.
      resolveLanguageTag: (value: string): string | null => {
        const tags = resolveLanguage(value);
        return tags.length === 1 ? (tags[0] as string) : null;
      },
    };

    const query: Parameters<DatasetsServerClient["rows"]>[0] = {
      dataset: source.repo,
      config: ref.config,
      split: ref.split,
      signal,
    };
    if (options.offset !== undefined) query.offset = options.offset;
    if (options.limit !== undefined) query.limit = options.limit;
    if (options.pageSize !== undefined) query.pageSize = options.pageSize;

    let rebuilt = false;
    for await (const serverRow of client.rows(query)) {
      if (!rebuilt && Object.keys(mapping.fields).length === 0 && mapping.extra.length === 0) {
        // Discovery gave nothing, so map against the first real row's columns.
        mapping = buildMapping(Object.keys(serverRow.row), source.repo, fieldMap);
        mappings.set(cacheKey, mapping);
        rebuilt = true;
      }
      yield applyMapping(serverRow.row, mapping, context);
    }
  }
}

/**
 * Learns a dataset's real column names, preferring `/first-rows` because it
 * reports feature types as well as names, and falling back to `/info`.
 *
 * @param client datasets server client
 * @param repo Hugging Face repo id
 * @param ref the config and split to inspect
 * @param fieldMap field map for column mapping
 * @param signal abort signal
 * @returns the resolved mapping, degrading to an empty one on failure
 */
async function resolveMapping(
  client: DatasetsServerClient,
  repo: string,
  ref: SplitRef,
  fieldMap: FieldMap,
  signal: AbortSignal,
): Promise<ColumnMapping> {
  let features: DatasetFeature[] = [];
  try {
    const first = await client.firstRows(repo, ref.config, ref.split, signal);
    features = first.features;
    if (features.length === 0 && first.rows.length > 0) {
      features = Object.keys(first.rows[0]?.row ?? {}).map((name) => ({ name }));
    }
  } catch (error) {
    if (isFatal(error)) throw error;
    try {
      features = await client.info(repo, ref.config, signal);
    } catch (infoError) {
      if (isFatal(infoError)) throw infoError;
      features = [];
    }
  }
  return buildMapping(
    features.map((feature) => feature.name),
    repo,
    fieldMap,
    features,
  );
}

/**
 * Errors that must not be swallowed during discovery: aborts and gated repos.
 *
 * @param error the thrown value
 * @returns whether the error should propagate
 */
function isFatal(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = (error as { name?: unknown }).name;
  return name === "AbortError" || name === "NganoGatedError";
}

/**
 * Picks which config and split pairs to stream.
 *
 * With no `config`, every config is eligible, except that a language filter
 * narrows to configs whose name looks like one of the requested languages. The
 * filter's values are resolved to tags first, so `sna`, `Shona` and `eng-NG`
 * all produce the same hints, which is how per-language repos such as Common
 * Voice and FLEURS are laid out.
 * With no `split`, `train` is used where it exists, otherwise every split of
 * the config.
 *
 * @param refs every config and split the server reports
 * @param options streaming options, possibly carrying a language filter
 * @param dataset the catalogue record, used for ISO hints
 * @returns the pairs to stream, in server order
 */
export function chooseSplits(
  refs: SplitRef[],
  options: StreamOptions & { language?: string | string[]; iso?: string | string[] },
  dataset: Dataset | null,
): SplitRef[] {
  const wantedConfigs = normaliseList(options.config);
  const wantedSplits = normaliseList(options.split);

  const configs = [...new Set(refs.map((ref) => ref.config))];
  let eligible = configs;

  if (wantedConfigs.length > 0 && !wantedConfigs.includes("all")) {
    const wanted = new Set(wantedConfigs);
    eligible = configs.filter((config) => wanted.has(config.toLowerCase()));
    if (eligible.length === 0) return [];
  } else if (wantedConfigs.length === 0 && configs.length > 1) {
    const hints = languageHints(options, dataset);
    if (hints.size > 0) {
      const narrowed = configs.filter((config) => configMatchesLanguage(config, hints));
      if (narrowed.length > 0) eligible = narrowed;
    }
  }

  const chosen: SplitRef[] = [];
  for (const config of eligible) {
    const inConfig = refs.filter((ref) => ref.config === config);
    let splits = inConfig;
    if (wantedSplits.length > 0 && !wantedSplits.includes("all")) {
      const wanted = new Set(wantedSplits);
      splits = inConfig.filter((ref) => wanted.has(ref.split.toLowerCase()));
    } else if (wantedSplits.length === 0) {
      const train = inConfig.filter((ref) => ref.split.toLowerCase() === "train");
      if (train.length > 0) splits = train;
    }
    chosen.push(...splits);
  }
  return chosen;
}

/**
 * Folds a scalar, list or comma-separated option into lower-case entries.
 *
 * @param value the option value
 * @returns lower-case entries, empty when the option was absent
 */
function normaliseList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : String(value).split(",");
  return list.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0);
}

/**
 * Collects the config-name hints a load's language filter implies: the tags it
 * resolves to, their bare ISO 639-3 codes, their region subtags and the raw
 * spellings the caller typed, all lower-cased.
 *
 * @param options streaming options carrying the filter
 * @param dataset the catalogue record
 * @returns lower-case hints, empty when the load named no language
 */
function languageHints(
  options: { language?: string | string[]; iso?: string | string[] },
  dataset: Dataset | null,
): Set<string> {
  const asked = [...normaliseList(options.language), ...normaliseList(options.iso)];
  if (asked.length === 0) return new Set<string>();

  const hints = new Set<string>(asked);
  for (const tag of resolveLanguages(asked)) {
    hints.add(tag.toLowerCase());
    hints.add(primaryCode(tag));
    const dash = tag.indexOf("-");
    if (dash !== -1) hints.add(tag.slice(dash + 1).toLowerCase());
    hints.add(languageName(tag).toLowerCase());
  }
  if (dataset) {
    for (const iso of dataset.iso) hints.add(iso.toLowerCase());
    for (const code of dataset.languageCodes) hints.add(code.toLowerCase());
  }
  return hints;
}

/**
 * Tests a config name such as `sw_ke`, `sn`, `shona` or `yo_ng` against
 * language hints.
 *
 * @param config the config name
 * @param hints lower-case language names and ISO codes
 * @returns whether the config looks like one of the wanted languages
 */
export function configMatchesLanguage(config: string, hints: Set<string>): boolean {
  const lower = config.toLowerCase();
  const parts = new Set<string>([lower, ...lower.split(/[_\-.]/).filter(Boolean)]);
  for (const hint of hints) {
    if (parts.has(hint)) return true;
    if (hint.length >= 4 && lower.includes(hint)) return true;
  }
  return false;
}

/**
 * Raised when a stream is asked for something impossible before any request is
 * made, for example an empty repo id.
 */
export class NganoLoadError extends NganoError {
  /**
   * @param message description of the problem
   */
  constructor(message: string) {
    super(message);
    this.name = "NganoLoadError";
  }
}
