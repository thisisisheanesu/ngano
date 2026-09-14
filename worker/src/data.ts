/**
 * The whole catalogue, loaded and indexed once per isolate.
 *
 * Workers reuse an isolate across many requests, so the cost of building these
 * indexes is paid on the first request and amortised over every request after it.
 * Nothing here touches the network or the filesystem: the JSON files are bundled
 * into the Worker at build time.
 *
 * Hours rule, applied everywhere without exception: a dataset whose
 * `unverified_size` flag is true contributes zero hours to every total. It still
 * counts as a dataset, it is still listed, its own `hours_num` is still returned,
 * but no aggregate anywhere adds it up.
 */

import catalogueJson from '../../data/catalogue.json';
import countriesJson from '../../data/countries.json';
import languagesJson from '../../data/languages.json';
import languageCodesJson from '../../data/language_codes.json';
import geoJson from '../../data/africa.geo.json';
import fieldMapJson from '../../data/field_map.json';
import creditsJson from '../../data/credits.json';
import snippetsJson from '../../data/snippets.json';

import type {
  Country,
  CountryStats,
  Credits,
  Dataset,
  FacetCount,
  Language,
  LanguageCodes,
  SiteContext,
  SnippetSet,
  Stats,
} from './types.js';

export const datasets = catalogueJson as unknown as Dataset[];
export const countries = countriesJson as unknown as Country[];
export const languages = languagesJson as unknown as Language[];
/** The ISO 639-3 registry. Every language key in the catalogue resolves through it. */
export const languageCodes = languageCodesJson as unknown as LanguageCodes;
export const geo = geoJson as unknown;
export const fieldMap = fieldMapJson as unknown;
export const credits = creditsJson as unknown as Credits;
/** Compile-checked SDK snippets, shared by the site and the MCP loader tool. */
export const snippets = snippetsJson as unknown as SnippetSet;

/** Hours a dataset contributes to any aggregate. Unverified figures contribute nothing. */
export function countableHours(d: Dataset): number {
  if (d.unverified_size) return 0;
  return d.hours_num ?? 0;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Sum of countable hours, rounded to one decimal so totals stay readable. */
export function sumHours(list: readonly Dataset[]): number {
  let total = 0;
  for (const d of list) total += countableHours(d);
  return round1(total);
}

/**
 * Commercial use is permitted, possibly after paying for it. Both `Yes` and
 * `Yes, if purchased` count, because both end in a licence you can ship on.
 * `No` and `Unstated` do not.
 */
export function isCommercialOk(d: Dataset): boolean {
  return d.commercial === 'Yes' || d.commercial === 'Yes, if purchased';
}

export function isOpen(d: Dataset): boolean {
  return d.access === 'Open';
}

interface Bucket {
  datasets: number;
  hours: number;
}

function facet(list: readonly Dataset[], pick: (d: Dataset) => readonly string[]): FacetCount[] {
  const buckets = new Map<string, Bucket>();
  for (const d of list) {
    const values = pick(d);
    if (values.length === 0) continue;
    // Hours are apportioned evenly when a dataset lands in several buckets, so a
    // facet's hours sum back to the global total instead of double counting.
    const share = countableHours(d) / values.length;
    for (const raw of values) {
      const value = raw.trim();
      if (!value) continue;
      const bucket = buckets.get(value) ?? { datasets: 0, hours: 0 };
      bucket.datasets += 1;
      bucket.hours += share;
      buckets.set(value, bucket);
    }
  }
  return [...buckets.entries()]
    .map(([value, b]) => ({ value, datasets: b.datasets, hours: round1(b.hours) }))
    .sort((a, b) => b.datasets - a.datasets || a.value.localeCompare(b.value));
}

function one(value: string | null | undefined): readonly string[] {
  const v = (value ?? '').trim();
  return v ? [v] : [];
}

export function computeStats(list: readonly Dataset[]): Stats {
  // Languages are counted per tag, so a regional variety such as eng-NG counts
  // separately from eng, and per bare code as well, which collapses the varieties.
  const languageTags = new Set<string>();
  const languageCodeSet = new Set<string>();
  const countryCodes = new Set<string>();
  let hours = 0;
  let hoursOpen = 0;
  let hoursCommercial = 0;
  let unverified = 0;

  for (const d of list) {
    for (const tag of d.language_tags) languageTags.add(tag);
    for (const code of d.language_codes) languageCodeSet.add(code);
    for (const code of d.country_codes) countryCodes.add(code);
    const h = countableHours(d);
    hours += h;
    if (isOpen(d)) hoursOpen += h;
    if (isCommercialOk(d)) hoursCommercial += h;
    if (d.unverified_size) unverified += 1;
  }

  return {
    datasets: list.length,
    languages: languageTags.size,
    language_codes: languageCodeSet.size,
    countries: countryCodes.size,
    hours: round1(hours),
    hours_open: round1(hoursOpen),
    hours_commercial: round1(hoursCommercial),
    unverified_excluded: unverified,
    by_task: facet(list, (d) => one(d.task)),
    by_commercial: facet(list, (d) => one(d.commercial)),
    by_licence_class: facet(list, (d) => one(d.licence_class)),
    by_access: facet(list, (d) => one(d.access)),
    by_labelled: facet(list, (d) => one(d.labelled)),
    by_quality: facet(list, (d) => one(d.quality)),
    by_variety: facet(list, (d) => one(d.variety)),
    by_domain: facet(list, (d) => one(d.domain)),
    by_region: facet(list, (d) => d.regions),
  };
}

/**
 * Per-country aggregates. A dataset that covers several countries splits its
 * hours evenly between them, which is the same apportioning rule the language
 * totals in `data/languages.json` use.
 */
function computeCountryStats(list: readonly Dataset[], all: readonly Country[]): Map<string, CountryStats> {
  interface Acc {
    datasets: number;
    hours: number;
    /** Language tags, kept as tags so the display names cannot drift from them. */
    languages: Set<string>;
    open: number;
    commercial: number;
  }
  const acc = new Map<string, Acc>();
  for (const c of all) {
    acc.set(c.iso2, { datasets: 0, hours: 0, languages: new Set(), open: 0, commercial: 0 });
  }
  for (const d of list) {
    const codes = d.country_codes.filter((code) => acc.has(code));
    if (codes.length === 0) continue;
    const share = countableHours(d) / codes.length;
    for (const code of codes) {
      const a = acc.get(code);
      if (!a) continue;
      a.datasets += 1;
      a.hours += share;
      for (const tag of d.language_tags) a.languages.add(tag);
      if (isOpen(d)) a.open += 1;
      if (isCommercialOk(d)) a.commercial += 1;
    }
  }
  const out = new Map<string, CountryStats>();
  for (const c of all) {
    const a = acc.get(c.iso2);
    const tags = a ? [...a.languages] : [];
    // Sorted by display name so the two arrays stay index-aligned and read well.
    tags.sort((x, y) => displayName(x).localeCompare(displayName(y)) || x.localeCompare(y));
    out.set(c.iso2, {
      ...c,
      datasets: a ? a.datasets : 0,
      hours: a ? round1(a.hours) : 0,
      languages: tags.map(displayName),
      language_tags: tags,
      open: a ? a.open : 0,
      commercial_ok: a ? a.commercial : 0,
    });
  }
  return out;
}

/** The canonical display name for a tag, falling back to the tag itself. */
function displayName(tag: string): string {
  return languageCodes.codes[tag]?.name ?? tag;
}

export const VERSION = '0.1.0';
export const DEFAULT_BASE_URL = 'https://ngano.dev';

function index<T>(list: readonly T[], key: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of list) map.set(key(item), item);
  return map;
}

export const byId: Map<string, Dataset> = index(datasets, (d) => d.id);
export const byIso2: Map<string, Country> = index(countries, (c) => c.iso2.toUpperCase());
/** Language record by slug, which is the tag lowercased: `sna`, `swh`, `eng-ng`. */
export const byLangSlug: Map<string, Language> = index(languages, (l) => l.slug);

/* -------------------------------------------------------------------------- */
/* Language tag resolution                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A three-letter ISO 639-3 code, optionally followed by a region subtag. The region
 * is an ISO 3166-1 alpha-2 code or a UN M.49 area number, which is what BCP 47 allows.
 */
const TAG_PATTERN = /^([A-Za-z]{3})(?:-([A-Za-z]{2}|\d{3}))?$/;

/**
 * Put a tag into canonical case: lowercase primary subtag, uppercase region. This is
 * the BCP 47 convention and it is what `codes` is keyed on, so `ENG-ng` finds `eng-NG`.
 */
export function canonicaliseTag(value: string): string | null {
  const match = TAG_PATTERN.exec(value.trim());
  if (!match?.[1]) return null;
  const primary = match[1].toLowerCase();
  return match[2] ? `${primary}-${match[2].toUpperCase()}` : primary;
}

/** Every known tag, canonical case, in registry order. */
export const LANGUAGE_TAGS: string[] = Object.keys(languageCodes.codes);

/** Bare ISO 639-3 code to every tag that uses it, so `eng` reaches all of `eng-*`. */
export const tagsByCode: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const tag of LANGUAGE_TAGS) {
    const entry = languageCodes.codes[tag];
    if (!entry) continue;
    const list = map.get(entry.iso639_3);
    if (list) list.push(tag);
    else map.set(entry.iso639_3, [tag]);
  }
  return map;
})();

/** A catalogue spelling to the tag it resolves to. Keys are lowercased and slugified. */
export const tagByAlias: Map<string, string> = (() => {
  const map = new Map<string, string>();
  const add = (name: string, tag: string): void => {
    const lower = name.trim().toLowerCase();
    if (!lower) return;
    if (!map.has(lower)) map.set(lower, tag);
    const slug = slugifyName(lower);
    if (slug && !map.has(slug)) map.set(slug, tag);
  };
  for (const tag of LANGUAGE_TAGS) {
    const entry = languageCodes.codes[tag];
    if (!entry) continue;
    add(entry.name, tag);
    for (const alias of entry.aliases) add(alias, tag);
  }
  // The source-name index carries spellings the registry entries do not repeat.
  for (const [name, tag] of Object.entries(languageCodes.name_to_tag)) {
    if (tag && languageCodes.codes[tag]) add(name, tag);
  }
  return map;
})();

/** The same slug rule the old name-based URLs used, kept so those URLs still resolve. */
function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ResolveOptions {
  /**
   * Widen a bare ISO 639-3 code to every regional variety of it, so `eng` also
   * matches `eng-NG` and `eng-ZA`. Off by default: a bare code means the language
   * at large and must never silently pick up a country-specific variety.
   */
  includeVarieties?: boolean;
}

/**
 * Resolve one caller-supplied language to canonical tags, in this order:
 *
 * 1. an exact tag, case insensitively, so `sna`, `SNA`, `eng-NG` and `eng-ng` all work;
 * 2. a bare ISO 639-3 code that exists only as regional varieties, which resolves to
 *    those varieties, because there is nothing else it could mean;
 * 3. a name from the registry `aliases`, case insensitively, in its plain or its
 *    slugified spelling, which is how an old free-text name still works.
 *
 * A tag always wins over a name, which matters for the handful of names that are
 * themselves three letters: `tem` is the tag for Timne, while the name "Temne"
 * resolves to `kdh`.
 *
 * Returns an empty array when nothing matches. The caller decides whether that is a
 * 404 or an empty result set.
 */
export function resolveLanguage(value: string, options: ResolveOptions = {}): string[] {
  const raw = value.trim();
  if (!raw) return [];

  const tag = canonicaliseTag(raw);
  if (tag) {
    const exact = languageCodes.codes[tag];
    const varieties = tag.includes('-') ? [] : (tagsByCode.get(tag) ?? []);
    if (exact) {
      if (!options.includeVarieties || varieties.length === 0) return [tag];
      return [tag, ...varieties.filter((t) => t !== tag)];
    }
    if (varieties.length > 0) return [...varieties];
  }

  const byAlias = tagByAlias.get(raw.toLowerCase()) ?? tagByAlias.get(slugifyName(raw));
  if (!byAlias) return [];
  const entry = languageCodes.codes[byAlias];
  if (options.includeVarieties && entry && !entry.region) {
    const varieties = tagsByCode.get(entry.iso639_3) ?? [];
    if (varieties.length > 1) return [byAlias, ...varieties.filter((t) => t !== byAlias)];
  }
  return [byAlias];
}

/** Resolve several values at once, deduplicated, order preserved. */
export function resolveLanguages(values: readonly string[], options: ResolveOptions = {}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const tag of resolveLanguage(value, options)) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

/** The language record for any accepted spelling, or null. Never widens to varieties. */
export function lookupLanguage(value: string): Language | null {
  const tags = resolveLanguage(value);
  for (const tag of tags) {
    const found = byLangSlug.get(tag.toLowerCase());
    if (found) return found;
  }
  return null;
}

export const countryStats: Map<string, CountryStats> = computeCountryStats(datasets, countries);
export const stats: Stats = computeStats(datasets);

/** Datasets carrying a given language tag, lowercased, in catalogue order. */
export const datasetsByLanguage: Map<string, Dataset[]> = (() => {
  const map = new Map<string, Dataset[]>();
  for (const d of datasets) {
    for (const tag of d.language_tags) {
      const key = tag.toLowerCase();
      const list = map.get(key);
      if (list) list.push(d);
      else map.set(key, [d]);
    }
  }
  return map;
})();

/**
 * Hours apportioned per language tag, recomputed from the catalogue rather than read
 * back from `data/languages.json`. A record splits its countable hours evenly across
 * its `language_tags`, so the per-language totals sum back to the global total.
 */
export const hoursByLanguageTag: Map<string, number> = (() => {
  const map = new Map<string, number>();
  for (const d of datasets) {
    if (d.language_tags.length === 0) continue;
    const share = countableHours(d) / d.language_tags.length;
    for (const tag of d.language_tags) map.set(tag, (map.get(tag) ?? 0) + share);
  }
  for (const [tag, hours] of map) map.set(tag, round1(hours));
  return map;
})();

/** Datasets that list a given ISO-3166 alpha-2 country code, in catalogue order. */
export const datasetsByCountry: Map<string, Dataset[]> = (() => {
  const map = new Map<string, Dataset[]>();
  for (const d of datasets) {
    for (const code of d.country_codes) {
      const key = code.toUpperCase();
      const list = map.get(key);
      if (list) list.push(d);
      else map.set(key, [d]);
    }
  }
  return map;
})();

/** The context every site renderer receives. Built once, then reused by every request. */
const baseContext: SiteContext = {
  datasets,
  byId,
  countries,
  byIso2,
  languages,
  byLangSlug,
  languageCodes,
  countryStats,
  credits,
  geo,
  stats,
  fieldMap,
  snippets,
  baseUrl: DEFAULT_BASE_URL,
  version: VERSION,
};

export interface Env {
  BASE_URL?: string;
  VERSION?: string;
  /**
   * Workers Analytics Engine. Optional on purpose: `wrangler dev`, the test runner and
   * anyone who deploys their own copy without the binding all run without it, and the
   * site must not care.
   */
  ANALYTICS?: AnalyticsEngineDataset;
  /** Admin credentials and sessions. Absent on a fork, which disables /admin entirely. */
  ADMIN?: KVNamespace;
  /** Account token with Account Analytics: Read, for the dashboard's own queries. */
  CF_ANALYTICS_TOKEN?: string;
}

const contextCache = new Map<string, SiteContext>();

/**
 * The shared context, with `baseUrl` and `version` taken from the environment when
 * they are set. The result is memoised per distinct pair, so repeated requests reuse
 * one object and the heavy indexes are never rebuilt.
 */
export function getContext(env: Env | undefined, requestUrl?: string): SiteContext {
  const baseUrl = normaliseBase(env?.BASE_URL ?? (requestUrl ? originOf(requestUrl) : DEFAULT_BASE_URL));
  const version = env?.VERSION ?? VERSION;
  const key = `${baseUrl}|${version}`;
  const cached = contextCache.get(key);
  if (cached) return cached;
  const ctx: SiteContext = { ...baseContext, baseUrl, version };
  contextCache.set(key, ctx);
  return ctx;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

function normaliseBase(value: string): string {
  return value.replace(/\/+$/, '');
}
