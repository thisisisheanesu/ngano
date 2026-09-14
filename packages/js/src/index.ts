/**
 * ngano: an open catalogue and streaming loader for African-language speech
 * datasets.
 *
 * The catalogue ships inside the package, so `new Catalogue()` works with no
 * network at all. Loading rows streams from the Hugging Face datasets server
 * over plain HTTP, with no Python runtime and no local cache.
 *
 * Code is MIT licensed. The catalogue data is CC-BY-4.0, and every dataset it
 * points at belongs to the team that collected it.
 *
 * @example
 * ```ts
 * import { Catalogue, load } from "ngano";
 *
 * const cat = new Catalogue();
 * cat.datasets({ language: "sna", commercial: true, task: "ASR" });
 *
 * for await (const row of load({ language: "sna", limit: 100 })) {
 *   console.log(row.transcript, row.durationS);
 * }
 * ```
 *
 * @packageDocumentation
 */
export { API_BASE, Catalogue, countableHours, getDefaultCatalogue, normaliseDataset } from "./catalogue.js";
export type { FromApiOptions } from "./catalogue.js";

export { NganoError, NganoGatedError, NganoHttpError, NganoNotFoundError } from "./errors.js";

export { Filter, compileFilter, fold, toOptions } from "./filter.js";
export type { FilterLike, FilterOptions } from "./filter.js";

export {
  LANGUAGE_TAGS,
  REGISTRY,
  canonicaliseTag,
  languageCode,
  languageName,
  primaryCode,
  resolveLanguage,
  resolveLanguages,
  slugifyName,
  tagByAlias,
  tagsByCode,
} from "./languages.js";
export type { ResolveOptions } from "./languages.js";

export {
  DATASETS_SERVER,
  DatasetsServerClient,
  MAX_PAGE_SIZE,
  combineSignals,
  defaultSleep,
  featuresFromInfo,
  normaliseFeatures,
  tokenFromEnv,
} from "./hf.js";
export type { HfClientOptions, RowsQuery, ServerRow, SplitRef } from "./hf.js";

export {
  CANONICAL_FIELDS,
  applyMapping,
  asNumber,
  asString,
  buildMapping,
  decodeBase64,
  isAudioFeature,
  normaliseColumn,
  parseAudioCell,
} from "./mapping.js";
export type { CanonicalField, ColumnMapping, DatasetFeature, RowContext } from "./mapping.js";

export {
  NganoLoadError,
  chooseSplits,
  configMatchesLanguage,
  load,
  loadDataset,
} from "./load.js";
export type {
  ErrorPolicy,
  LoadDatasetOptions,
  LoadOptions,
  NganoStream,
  SourceInfo,
  StreamOptions,
} from "./load.js";

export type {
  Access,
  AudioHandle,
  Commercial,
  CountrySummary,
  Dataset,
  FetchLike,
  FieldMap,
  FieldOverride,
  InterleaveMode,
  Labelled,
  Language,
  LanguageCode,
  LanguageCodes,
  LanguageSummary,
  RawCountry,
  RawDataset,
  RawLanguage,
  Row,
  Stats,
  Task,
} from "./types.js";

export {
  CATALOGUE,
  COUNTRIES,
  FIELD_MAP,
  LANGUAGES,
  LANGUAGE_CODES,
  SNAPSHOT_SIZE,
} from "./data/snapshot.js";

/** Package version, kept in step with package.json at release time. */
export const VERSION = "0.1.0";
