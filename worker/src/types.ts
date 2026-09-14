/**
 * Shared types for the ngano Worker. Owned by the worker core; the site renderers
 * import from here. Keep this file stable: both halves of the Worker compile against it.
 */

export interface Dataset {
  id: string;
  name: string;
  task: 'ASR' | 'TTS' | 'ASR+TTS' | 'Raw source' | 'Other';
  variety: string;
  /** Language names exactly as the source spells them. Kept for provenance. */
  languages: string[];
  /** Canonical display names, one per entry of `language_tags`. */
  languages_clean: string[];
  /**
   * BCP 47 tags, ordered, one per language the record covers. The primary subtag is
   * always an ISO 639-3 three-letter code, and an optional region subtag marks a
   * country-specific variety, so Nigerian English is `eng-NG`.
   */
  language_tags: string[];
  /** The bare ISO 639-3 codes behind `language_tags`, deduplicated and order preserved. */
  language_codes: string[];
  /** Legacy ISO 639-3 codes as first catalogued. Prefer `language_codes`. */
  iso: string[];
  countries: string[];
  country_codes: string[];
  regions: string[];
  hours: string | null;
  hours_num: number | null;
  speakers: string | null;
  recording_type: string | null;
  quality: string;
  labelled: string;
  domain: string;
  licence: string;
  licence_class: string;
  commercial: 'Yes' | 'Yes, if purchased' | 'No' | 'Unstated';
  access: string;
  host: string;
  url: string | null;
  hf_repo: string | null;
  year: string | null;
  notes: string | null;
  /** Self-reported figure of 20,000+ hours. Never counted in any total. */
  unverified_size: boolean;
  /**
   * Present on the few records whose source describes its coverage in prose, for
   * example "~340 African languages", rather than naming individual languages. Such
   * a record carries no tags, and this string says so.
   */
  language_note?: string;
}

export interface Country {
  name: string;
  iso2: string;
  iso3: string;
  /** Key into africa.geo.json properties.map_name, or null for island states. */
  map_name: string | null;
  lat: number;
  lon: number;
  region: string;
  slug: string;
}

/**
 * One entry of the ISO 639-3 registry the catalogue is keyed on, from
 * `data/language_codes.json`.
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
  version: number;
  /** Keyed by tag. The key and `tag` are always equal. */
  codes: Record<string, LanguageCode>;
  /** Source spelling to tag. An empty value marks a name that resolves to nothing. */
  name_to_tag: Record<string, string>;
  /** Placeholder strings some sources use instead of naming a language. */
  not_a_language: Record<string, string>;
  /** Prose descriptions of coverage, for example "11 African languages". */
  descriptive: string[];
}

/** A registry entry with the catalogue aggregates for that tag, from `data/languages.json`. */
export interface Language {
  tag: string;
  iso639_3: string;
  region: string | null;
  name: string;
  scope: string;
  type: string;
  aliases: string[];
  /** The tag lowercased, so `sna`, `swh`, `eng-ng`. The URL form. */
  slug: string;
  datasets: number;
  /** Apportioned evenly across a record's `language_tags`, unverified records excluded. */
  hours: number;
  countries: string[];
  country_codes: string[];
  /** The catalogue tasks attested for this tag, sorted. */
  tasks: string[];
}

export interface CreditLink {
  label: string;
  handle: string;
  url: string;
  icon: string;
}

export interface Credits {
  author: { name: string; short_name: string; tagline: string; bio: string; email: string | null };
  links: CreditLink[];
  project: {
    name: string; meaning: string; domain: string; repo: string;
    code_licence: string; data_licence: string;
    citation: { type: string; title: string; year: number };
  };
  acknowledgements: string[];
}

export interface FacetCount { value: string; datasets: number; hours: number }

export interface Stats {
  datasets: number;
  /** Distinct BCP 47 language tags, so a regional variety counts on its own. */
  languages: number;
  /** Distinct ISO 639-3 codes, so every `eng-*` variety collapses into one. */
  language_codes: number;
  countries: number;
  hours: number;
  hours_open: number;
  hours_commercial: number;
  unverified_excluded: number;
  by_task: FacetCount[];
  by_commercial: FacetCount[];
  by_licence_class: FacetCount[];
  by_access: FacetCount[];
  by_labelled: FacetCount[];
  by_quality: FacetCount[];
  by_variety: FacetCount[];
  by_domain: FacetCount[];
  by_region: FacetCount[];
}

export interface CountryStats extends Country {
  datasets: number;
  hours: number;
  /** Canonical display names of the languages attested here, sorted. */
  languages: string[];
  /** The same languages as BCP 47 tags, in the same order as `languages`. */
  language_tags: string[];
  open: number;
  commercial_ok: number;
}

/** The three SDKs, as `data/snippets.json` names them. */
export type SnippetLanguage = 'python' | 'javascript' | 'rust';

/** The snippet a page or a tool asks for, as `data/snippets.json` names them. */
export type SnippetKey =
  | 'catalogue_filter'
  | 'stream_filter'
  | 'single_dataset'
  | 'language_page'
  | 'country_page'
  | 'dataset_page'
  | 'cli';

/**
 * One SDK's snippets, verified to compile or typecheck by that package's own tests.
 *
 * `language` and the `snippets` keys are widened to `string` on purpose. The narrow
 * `SnippetLanguage` and `SnippetKey` unions above say what to expect, while the
 * loose index types let a caller read the file without a cast and let a new SDK or a
 * new snippet key land in `data/snippets.json` without breaking the build.
 */
export interface SnippetPack {
  language: string;
  install: string;
  /** Extra install line for optional audio decoding, or null when the SDK needs none. */
  install_audio: string | null;
  package: string;
  /** Keys whose snippet is a shell session rather than source in this language. */
  shell_snippets: string[];
  snippets: Record<string, string>;
}

/** The contents of `data/snippets.json`, generated by `scripts/merge_snippets.py`. */
export interface SnippetSet {
  version: number;
  /** Every `{{TOKEN}}` a snippet may contain. All of them must be substituted. */
  placeholders: string[];
  languages: Record<string, SnippetPack>;
}

/** Everything a page renderer needs. Built once per isolate and reused. */
export interface SiteContext {
  datasets: Dataset[];
  byId: Map<string, Dataset>;
  countries: Country[];
  byIso2: Map<string, Country>;
  languages: Language[];
  byLangSlug: Map<string, Language>;
  /** The ISO 639-3 registry every language key in the catalogue resolves through. */
  languageCodes: LanguageCodes;
  countryStats: Map<string, CountryStats>;
  credits: Credits;
  geo: unknown;
  stats: Stats;
  fieldMap: unknown;
  /** Real, compile-checked SDK snippets. Substitute every placeholder before showing one. */
  snippets: SnippetSet;
  baseUrl: string;
  version: string;
}

export interface ApiError {
  error: { code: string; message: string; status: number };
}
