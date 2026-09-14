/**
 * Shared type definitions for the ngano SDK.
 *
 * Two families of types live here: the raw shapes of the catalogue JSON files
 * (snake_case, exactly as published) and the public camelCase shapes the SDK
 * hands to callers.
 *
 * @packageDocumentation
 */

/** Task a dataset supports, as recorded in the catalogue. */
export type Task = "ASR" | "TTS" | "ASR+TTS" | "Raw source" | "Other";

/** Whether a dataset may be used commercially, as recorded in the catalogue. */
export type Commercial = "Yes" | "Yes, if purchased" | "No" | "Unstated";

/** Whether a dataset carries transcripts, as recorded in the catalogue. */
export type Labelled = "Transcribed" | "Unlabelled" | "Unstated";

/** How a dataset can be obtained, as recorded in the catalogue. */
export type Access = "Open" | "Request" | "Paid" | "Scrape required" | "Unclear";

/** Raw dataset record, matching `data/catalogue.json` field for field. */
export interface RawDataset {
  id: string;
  name: string;
  task: string;
  variety: string | null;
  languages: string[];
  languages_clean: string[];
  language_tags: string[];
  language_codes: string[];
  iso: string[];
  countries: string[];
  country_codes: string[];
  regions: string[];
  hours: string | null;
  hours_num: number | null;
  speakers: number | string | null;
  recording_type: string | null;
  quality: string | null;
  labelled: string | null;
  domain: string | null;
  licence: string | null;
  licence_class: string | null;
  commercial: string | null;
  access: string | null;
  host: string | null;
  url: string | null;
  hf_repo: string | null;
  year: string | null;
  notes: string | null;
  unverified_size?: boolean;
  language_note?: string;
}

/** Raw country record, matching `data/countries.json`. */
export interface RawCountry {
  name: string;
  iso2: string;
  iso3: string;
  map_name: string | null;
  lat: number;
  lon: number;
  region: string;
  slug: string;
}

/**
 * One entry of the ISO 639-3 registry in `data/language_codes.json`.
 *
 * The registry is what every language value in the SDK resolves through, so a
 * caller can pass a tag, a bare code or any catalogue spelling of a name.
 */
export interface LanguageCode {
  /** BCP 47 tag: an ISO 639-3 primary subtag, optionally plus an ISO 3166-1 region. */
  tag: string;
  /** The primary subtag on its own. Several tags can share one code. */
  iso639_3: string;
  /** ISO 3166-1 alpha-2 region, or null when the tag names the language at large. */
  region: string | null;
  /** Canonical display name, for example "English (Nigeria)". */
  name: string;
  /** ISO 639-3 scope: I individual, M macrolanguage, S special. */
  scope: string;
  /** ISO 639-3 type: L living, E extinct, H historical, A ancient, C constructed, S special. */
  type: string;
  /** Every catalogue spelling that resolves to this tag, including the canonical name. */
  aliases: string[];
  /** How the tag was arrived at, for example iso-registry, curated or group. */
  resolution: string;
}

/** The whole of `data/language_codes.json`. */
export interface LanguageCodes {
  /** Schema version of the registry document. */
  version: number;
  /** Keyed by tag. The key and {@link LanguageCode.tag} are always equal. */
  codes: Record<string, LanguageCode>;
  /** Source spelling to tag. An empty value marks a name that resolves to nothing. */
  name_to_tag: Record<string, string>;
  /** Placeholder strings some sources use instead of naming a language. */
  not_a_language: Record<string, string>;
  /** Prose descriptions of coverage, for example "11 African languages". */
  descriptive: string[];
}

/**
 * A registry entry with the catalogue aggregates for that tag, matching
 * `data/languages.json`.
 */
export interface Language {
  /** BCP 47 tag, for example `sna`, `eng-NG` or `por-MZ`. */
  tag: string;
  /** The bare ISO 639-3 code behind the tag. */
  iso639_3: string;
  /** ISO 3166-1 alpha-2 region, or null for the language at large. */
  region: string | null;
  /** Canonical display name. */
  name: string;
  /** ISO 639-3 scope. */
  scope: string;
  /** ISO 639-3 type. */
  type: string;
  /** Every catalogue spelling that resolves to this tag. */
  aliases: string[];
  /** The tag lowercased, which is its URL form: `sna`, `eng-ng`. */
  slug: string;
  /** Number of catalogue datasets covering this tag. */
  datasets: number;
  /** Hours apportioned across a record's tags, unverified figures excluded. */
  hours: number | null;
  /** Country names where this tag appears. */
  countries: string[];
  /** ISO 3166-1 alpha-2 codes for {@link Language.countries}. */
  country_codes: string[];
  /** Catalogue tasks attested for this tag, sorted. */
  tasks: string[];
}

/**
 * Former name of {@link Language}, kept so existing imports keep compiling.
 */
export type RawLanguage = Language;

/** Per-repo column overrides from `field_map.json`. */
export type FieldOverride = Record<string, string | boolean>;

/** Contents of `data/field_map.json`. */
export interface FieldMap {
  version: number;
  canonical: Record<string, string>;
  aliases: Record<string, string[]>;
  drop: string[];
  unit_hints: Record<string, { canonical: string; multiply: number }>;
  overrides: Record<string, FieldOverride>;
}

/**
 * A dataset as the SDK exposes it. Field names are camelCase; the values are
 * unchanged from the catalogue.
 */
export interface Dataset {
  /** Stable ngano catalogue id, for example `google-fleurs`. */
  id: string;
  /** Dataset name as its publisher writes it. */
  name: string;
  /** ASR, TTS, ASR+TTS, Raw source or Other. */
  task: string;
  /** Language variety grouping, for example Indigenous or Colonial. */
  variety: string | null;
  /** Language names exactly as the source lists them. */
  languages: string[];
  /** Canonical display names, one per entry of {@link Dataset.languageTags}. */
  languagesClean: string[];
  /**
   * BCP 47 tags, ordered, one per language the record covers. The primary
   * subtag is always an ISO 639-3 three-letter code, and an optional region
   * subtag marks a country-specific variety, so Nigerian English is `eng-NG`.
   */
  languageTags: string[];
  /** The bare ISO 639-3 codes behind the tags, deduplicated, order preserved. */
  languageCodes: string[];
  /** ISO 639-3 codes as first catalogued. Prefer {@link Dataset.languageCodes}. */
  iso: string[];
  /** Country names covered by the dataset. */
  countries: string[];
  /** ISO 3166-1 alpha-2 codes for {@link Dataset.countries}. */
  countryCodes: string[];
  /** Region names, for example East Africa. */
  regions: string[];
  /** Hours as published, free text. */
  hours: string | null;
  /** Hours as a number, as published. See {@link Dataset.unverifiedSize}. */
  hoursNum: number | null;
  /** Speaker count as published. */
  speakers: number | string | null;
  /** Recording type, for example studio, telephone or broadcast. */
  recordingType: string | null;
  /** Audio quality band. */
  quality: string | null;
  /** Transcribed, Unlabelled or Unstated. */
  labelled: string | null;
  /** Recording domain, for example Broadcast news. */
  domain: string | null;
  /** Licence string as published. */
  licence: string | null;
  /** Licence family, for example Attribution (CC-BY). */
  licenceClass: string | null;
  /** Yes, "Yes, if purchased", No or Unstated. */
  commercial: string | null;
  /** Open, Request, Paid, Scrape required or Unclear. */
  access: string | null;
  /** Where the dataset is hosted, for example HuggingFace. */
  host: string | null;
  /** Canonical URL for the dataset. */
  url: string | null;
  /** Hugging Face repo id, or null when the dataset is hosted elsewhere. */
  hfRepo: string | null;
  /** Publication year as published. */
  year: string | null;
  /** Catalogue notes, including caveats about the figures. */
  notes: string | null;
  /**
   * True when the published size is a self-reported figure of 20,000 hours or
   * more. Such figures are excluded from every hours total the SDK computes.
   */
  unverifiedSize: boolean;
  /**
   * Present on the few records whose source describes its coverage in prose,
   * for example "~340 African languages", rather than naming languages. Such a
   * record carries no tags, and this string says so.
   */
  languageNote?: string;
}

/** A country with counts derived from the catalogue in hand. */
export interface CountrySummary {
  /** Country name. */
  name: string;
  /** ISO 3166-1 alpha-2 code. */
  iso2: string;
  /** ISO 3166-1 alpha-3 code. */
  iso3: string;
  /** Name used by the map polygons in `africa.geo.json`, null for island states. */
  mapName: string | null;
  /** Latitude of a representative point. */
  lat: number;
  /** Longitude of a representative point. */
  lon: number;
  /** Region name, for example West Africa. */
  region: string;
  /** URL-safe slug. */
  slug: string;
  /** Number of catalogue datasets covering this country. */
  datasets: number;
  /** Total hours, excluding unverified figures. */
  hours: number;
  /** Distinct language names covering this country. */
  languages: string[];
}

/** One language tag with counts derived from the catalogue in hand. */
export interface LanguageSummary {
  /** BCP 47 tag, for example `sna` or `eng-NG`. */
  tag: string;
  /** The bare ISO 639-3 code behind the tag. */
  iso639_3: string;
  /** ISO 3166-1 alpha-2 region, or null for the language at large. */
  region: string | null;
  /** Canonical display name. */
  name: string;
  /** URL-safe slug, which is the tag lowercased. */
  slug: string;
  /** Number of catalogue datasets covering this tag. */
  datasets: number;
  /** Country names where this tag appears in the catalogue. */
  countries: string[];
  /** Total hours, excluding unverified figures. */
  hours: number;
}

/** Aggregate counts over a catalogue. */
export interface Stats {
  /** Number of dataset records. */
  datasets: number;
  /** Total hours, excluding unverified figures. */
  hours: number;
  /** Number of records whose size is self-reported and excluded from hours. */
  unverifiedExcluded: number;
  /** Number of distinct language tags. Varieties count separately. */
  languages: number;
  /** Number of distinct ISO 639-3 codes, with varieties collapsed. */
  languageCodes: number;
  /** Number of distinct countries. */
  countries: number;
  /** Number of records with a Hugging Face repo, which are the loadable ones. */
  hfRepos: number;
  /** Record counts by task. */
  byTask: Record<string, number>;
  /** Record counts by access route. */
  byAccess: Record<string, number>;
  /** Record counts by commercial-use value. */
  byCommercial: Record<string, number>;
  /** Record counts by licence family. */
  byLicenceClass: Record<string, number>;
  /** Record counts by audio quality band. */
  byQuality: Record<string, number>;
  /** Record counts by transcription status. */
  byLabelled: Record<string, number>;
  /** Record counts by region. A dataset can count towards several regions. */
  byRegion: Record<string, number>;
}

/**
 * A lazy handle on one utterance's audio. Nothing is fetched until
 * {@link AudioHandle.read} or {@link AudioHandle.blob} is called.
 */
export interface AudioHandle {
  /** Direct URL to the audio, when the source exposes one. */
  url: string | null;
  /** Path inside the dataset repo or archive, when the source exposes one. */
  path: string | null;
  /** Sampling rate in Hz, when the source states one. */
  samplingRate: number | null;
  /** Media type, for example `audio/wav`, when the source states one. */
  contentType: string | null;
  /** Bytes already present in the row, if the source inlined them. */
  bytes: Uint8Array | null;
  /**
   * Fetches the audio bytes, or returns the inlined bytes when the row already
   * carried them. The result is cached for the lifetime of the handle.
   *
   * @param options optional abort signal
   * @returns the raw encoded audio bytes, undecoded
   */
  read(options?: { signal?: AbortSignal }): Promise<Uint8Array>;
  /**
   * Same as {@link AudioHandle.read} but wrapped in a `Blob`, which is handy in
   * browsers for `URL.createObjectURL`.
   *
   * @param options optional abort signal
   * @returns a `Blob` carrying the encoded audio
   */
  blob(options?: { signal?: AbortSignal }): Promise<Blob>;
}

/**
 * One utterance in ngano's unified schema. Every loader in every ngano SDK
 * yields this same shape.
 */
export interface Row {
  /** Lazy audio handle, or null when the row carries no audio column. */
  audio: AudioHandle | null;
  /** Reference text for the utterance. */
  transcript: string | null;
  /**
   * Language name as the source labels it, falling back to the catalogue's
   * canonical name when the source row states none.
   */
  language: string | null;
  /** Bare ISO 639-3 code, resolved from the catalogue when the row states none. */
  languageIso: string | null;
  /**
   * BCP 47 tag for the row, for example `sna` or `eng-NG`. Resolved from the
   * row's own language value where it names one the registry knows, otherwise
   * from the catalogue record. Null when nothing resolves.
   */
  languageTag: string | null;
  /** ISO 3166-1 alpha-2 country code, from the row or the catalogue entry. */
  country: string | null;
  /** Stable speaker identifier within the dataset. */
  speakerId: string | null;
  /** Speaker gender as stated by the source. Never inferred. */
  gender: string | null;
  /** Speaker age or age band as stated by the source. Never inferred. */
  age: string | null;
  /** Utterance duration in seconds. */
  durationS: number | null;
  /** Sampling rate in Hz. */
  samplingRate: number | null;
  /** Recording domain, for example read, broadcast or clinical. */
  domain: string | null;
  /** Source split name, for example `train`. */
  split: string;
  /** ngano catalogue id, or null when the repo is not in the catalogue. */
  datasetId: string | null;
  /** Hugging Face repo id the row came from. */
  hfRepo: string;
  /** Licence string from the catalogue. */
  licence: string | null;
  /** Canonical URL for the dataset. */
  sourceUrl: string | null;
  /** Every column that was not mapped and not dropped, under its source name. */
  extra: Record<string, unknown>;
}

/** How rows from several datasets are interleaved. */
export type InterleaveMode = "round_robin" | "sequential" | "weighted_by_hours";

/** A `fetch` implementation. Defaults to the global one. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
