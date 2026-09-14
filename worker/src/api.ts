/**
 * The ngano JSON API, mounted at /api/v1.
 *
 * Everything is public, unauthenticated, CORS open and cacheable. Collection
 * responses carry an ETag so a repeat caller can be answered with a 304.
 *
 * The hours rule from SPEC.md holds everywhere: a dataset flagged
 * `unverified_size` counts as a dataset but contributes zero hours, including to
 * `meta.total_hours` and to the `min_hours` / `max_hours` filters.
 */

import {
  byId,
  byLangSlug,
  countableHours,
  countries,
  countryStats,
  datasets,
  datasetsByCountry,
  datasetsByLanguage,
  fieldMap,
  languageCodes,
  languages,
  lookupLanguage,
  resolveLanguages,
  snippets,
  stats,
  sumHours,
} from './data.js';
import { buildOpenApi } from './openapi.js';
import { error, etag, json, matchesEtag, notModified, preflight } from './http.js';
import type { Dataset, SiteContext } from './types.js';
import { DATASET_FIELDS, DEFAULT_PER_PAGE, MAX_PER_PAGE, SORT_KEYS } from './fields.js';
import type { DatasetField, SortKey } from './fields.js';

export { DATASET_FIELDS, DEFAULT_PER_PAGE, MAX_PER_PAGE, SORT_KEYS };
export type { DatasetField, SortKey };

const DATASET_FIELD_SET: ReadonlySet<string> = new Set<string>(DATASET_FIELDS);


/** Raised for any caller mistake. The router turns it into the documented error body. */
export class ApiFault extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiFault';
    this.code = code;
    this.status = status;
  }
}

function badRequest(message: string): ApiFault {
  return new ApiFault('invalid_parameter', message, 400);
}

/* -------------------------------------------------------------------------- */
/* Query parsing                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Repeatable parameters are OR within a parameter and AND across parameters.
 * `?task=ASR&task=TTS` and `?task=ASR,TTS` mean the same thing.
 */
function multi(params: URLSearchParams, name: string): string[] {
  const out: string[] = [];
  for (const raw of params.getAll(name)) {
    for (const part of raw.split(',')) {
      const value = part.trim();
      if (value) out.push(value);
    }
  }
  return out;
}

function lowerSet(params: URLSearchParams, name: string): Set<string> | null {
  const values = multi(params, name);
  if (values.length === 0) return null;
  return new Set(values.map((v) => v.toLowerCase()));
}

function boolParam(params: URLSearchParams, name: string): boolean | null {
  const raw = params.get(name);
  if (raw === null) return null;
  const value = raw.trim().toLowerCase();
  if (value === '' || value === 'true' || value === '1' || value === 'yes') return true;
  if (value === 'false' || value === '0' || value === 'no') return false;
  throw badRequest(`${name} must be one of true, false, 1, 0, yes, no.`);
}

function numberParam(params: URLSearchParams, name: string): number | null {
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw badRequest(`${name} must be a number.`);
  if (value < 0) throw badRequest(`${name} must not be negative.`);
  return value;
}

function intParam(params: URLSearchParams, name: string, fallback: number, min: number, max: number): number {
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') return fallback;
  if (!/^\d+$/.test(raw.trim())) throw badRequest(`${name} must be a positive whole number.`);
  const value = Number(raw);
  if (value < min || value > max) throw badRequest(`${name} must be between ${min} and ${max}.`);
  return value;
}

export interface DatasetQuery {
  q: string | null;
  /** Canonical tags the caller's `language` and `iso` values resolved to, or null. */
  language: Set<string> | null;
  /** The spellings that resolved to nothing, kept so the caller can be told. */
  language_unresolved: string[];
  include_varieties: boolean;
  country: Set<string> | null;
  region: Set<string> | null;
  task: Set<string> | null;
  variety: Set<string> | null;
  commercial: Set<string> | null;
  licence_class: Set<string> | null;
  access: Set<string> | null;
  labelled: Set<string> | null;
  quality: Set<string> | null;
  domain: Set<string> | null;
  host: Set<string> | null;
  hf_only: boolean | null;
  min_hours: number | null;
  max_hours: number | null;
  has_hours: boolean | null;
  sort: SortKey;
  desc: boolean;
  page: number;
  per_page: number;
  fields: DatasetField[] | null;
}

export function parseDatasetQuery(params: URLSearchParams): DatasetQuery {
  const q = (params.get('q') ?? '').trim();

  let sort: SortKey = 'hours';
  let desc = true;
  const rawSort = (params.get('sort') ?? '').trim();
  if (rawSort) {
    const descending = rawSort.startsWith('-');
    const key = (descending ? rawSort.slice(1) : rawSort).toLowerCase();
    if (!(SORT_KEYS as readonly string[]).includes(key)) {
      throw badRequest(`sort must be one of ${SORT_KEYS.join(', ')}, optionally prefixed with "-".`);
    }
    sort = key as SortKey;
    // Without a "-" prefix the order is ascending, which is what "sort=name" should do.
    desc = descending;
  }

  let fields: DatasetField[] | null = null;
  const rawFields = multi(params, 'fields');
  if (rawFields.length > 0) {
    const unknown = rawFields.filter((f) => !DATASET_FIELD_SET.has(f));
    if (unknown.length > 0) {
      throw badRequest(`Unknown field(s): ${unknown.join(', ')}. Valid fields: ${DATASET_FIELDS.join(', ')}.`);
    }
    const chosen = new Set<DatasetField>(['id']);
    for (const f of rawFields) chosen.add(f as DatasetField);
    fields = [...chosen];
  }

  const minHours = numberParam(params, 'min_hours');
  const maxHours = numberParam(params, 'max_hours');
  if (minHours !== null && maxHours !== null && minHours > maxHours) {
    throw badRequest('min_hours must not be greater than max_hours.');
  }

  // `language` and `iso` are the same filter: both resolve through the ISO 639-3
  // registry to canonical tags, `iso` being the code-shaped spelling of it.
  const includeVarieties = boolParam(params, 'include_varieties') ?? false;
  const requested = [...multi(params, 'language'), ...multi(params, 'iso')];
  const resolved = resolveLanguages(requested, { includeVarieties });
  const unresolved = requested.filter((value) => resolveLanguages([value], { includeVarieties }).length === 0);

  return {
    q: q || null,
    language: requested.length > 0 ? new Set(resolved.map((t) => t.toLowerCase())) : null,
    language_unresolved: unresolved,
    include_varieties: includeVarieties,
    country: lowerSet(params, 'country'),
    region: lowerSet(params, 'region'),
    task: lowerSet(params, 'task'),
    variety: lowerSet(params, 'variety'),
    commercial: lowerSet(params, 'commercial'),
    licence_class: lowerSet(params, 'licence_class'),
    access: lowerSet(params, 'access'),
    labelled: lowerSet(params, 'labelled'),
    quality: lowerSet(params, 'quality'),
    domain: lowerSet(params, 'domain'),
    host: lowerSet(params, 'host'),
    hf_only: boolParam(params, 'hf_only'),
    min_hours: minHours,
    max_hours: maxHours,
    has_hours: boolParam(params, 'has_hours'),
    sort,
    desc,
    page: intParam(params, 'page', 1, 1, 1_000_000),
    per_page: intParam(params, 'per_page', DEFAULT_PER_PAGE, 1, MAX_PER_PAGE),
    fields,
  };
}

/* -------------------------------------------------------------------------- */
/* Filtering, sorting, projection                                             */
/* -------------------------------------------------------------------------- */

/** True when any of the record's values for this field is in the wanted set. */
function anyOf(wanted: Set<string> | null, values: readonly string[]): boolean {
  if (!wanted) return true;
  for (const value of values) {
    if (wanted.has(value.toLowerCase())) return true;
  }
  return false;
}

/** True when the record carries any of the wanted tags. Tags are compared lowercased. */
function matchesLanguage(wanted: Set<string>, d: Dataset): boolean {
  for (const tag of d.language_tags) {
    if (wanted.has(tag.toLowerCase())) return true;
  }
  return false;
}

function haystack(d: Dataset): string {
  return [
    d.id,
    d.name,
    d.variety,
    d.domain,
    d.host,
    d.licence,
    d.notes ?? '',
    d.hf_repo ?? '',
    d.languages_clean.join(' '),
    d.languages.join(' '),
    d.countries.join(' '),
    d.language_tags.join(' '),
    d.iso.join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

export function filterDatasets(query: DatasetQuery, source: readonly Dataset[] = datasets): Dataset[] {
  const terms = query.q ? query.q.toLowerCase().split(/\s+/).filter(Boolean) : null;

  return source.filter((d) => {
    if (terms) {
      const text = haystack(d);
      // Every term must appear somewhere, so extra words narrow rather than widen.
      for (const term of terms) {
        if (!text.includes(term)) return false;
      }
    }
    if (query.language && !matchesLanguage(query.language, d)) return false;
    if (!anyOf(query.country, d.country_codes)) return false;
    if (!anyOf(query.region, d.regions)) return false;
    if (!anyOf(query.task, [d.task])) return false;
    if (!anyOf(query.variety, [d.variety])) return false;
    if (!anyOf(query.commercial, [d.commercial])) return false;
    if (!anyOf(query.licence_class, [d.licence_class])) return false;
    if (!anyOf(query.access, [d.access])) return false;
    if (!anyOf(query.labelled, [d.labelled])) return false;
    if (!anyOf(query.quality, [d.quality])) return false;
    if (!anyOf(query.domain, [d.domain])) return false;
    if (!anyOf(query.host, [d.host])) return false;
    if (query.hf_only !== null && (d.hf_repo !== null) !== query.hf_only) return false;
    if (query.has_hours !== null && (d.hours_num !== null) !== query.has_hours) return false;
    if (query.min_hours !== null && countableHours(d) < query.min_hours) return false;
    if (query.max_hours !== null && countableHours(d) > query.max_hours) return false;
    return true;
  });
}

function yearOf(d: Dataset): number | null {
  if (!d.year) return null;
  const match = /\d{4}/.exec(d.year);
  return match ? Number(match[0]) : null;
}

export function sortDatasets(list: Dataset[], sort: SortKey, desc: boolean): Dataset[] {
  const direction = desc ? -1 : 1;
  const sorted = [...list];
  sorted.sort((a, b) => {
    if (sort === 'name') {
      const cmp = a.name.localeCompare(b.name);
      return cmp !== 0 ? cmp * direction : a.id.localeCompare(b.id);
    }
    const av = sort === 'hours' ? countableHours(a) : yearOf(a);
    const bv = sort === 'hours' ? countableHours(b) : yearOf(b);
    // Missing values always sort last, whichever direction was asked for.
    if (av === null && bv === null) return a.id.localeCompare(b.id);
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av !== bv) return (av - bv) * direction;
    return a.id.localeCompare(b.id);
  });
  return sorted;
}

export function project(d: Dataset, fields: DatasetField[] | null): Record<string, unknown> {
  if (!fields) return d as unknown as Record<string, unknown>;
  const record = d as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of fields) out[field] = record[field];
  return out;
}

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  total_hours: number;
  /** Canonical tags the language filter resolved to. Absent when none was given. */
  language_tags?: string[];
  /** Language values that matched no tag. Absent when everything resolved. */
  language_unresolved?: string[];
}

export function paginate<T>(list: readonly T[], page: number, perPage: number): { items: T[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(list.length / perPage));
  const start = (page - 1) * perPage;
  return { items: list.slice(start, start + perPage), totalPages };
}

/* -------------------------------------------------------------------------- */
/* Endpoint payloads                                                          */
/* -------------------------------------------------------------------------- */

export interface DatasetListPayload {
  data: Record<string, unknown>[];
  meta: PageMeta;
}

export function datasetList(params: URLSearchParams): DatasetListPayload {
  const query = parseDatasetQuery(params);
  const filtered = sortDatasets(filterDatasets(query), query.sort, query.desc);
  const { items, totalPages } = paginate(filtered, query.page, query.per_page);
  const meta: PageMeta = {
    page: query.page,
    per_page: query.per_page,
    total: filtered.length,
    total_pages: totalPages,
    total_hours: sumHours(filtered),
  };
  // An old free-text name still filters, and the caller is told which tag it became.
  if (query.language) meta.language_tags = [...query.language].map((t) => canonicalCase(t));
  if (query.language_unresolved.length > 0) meta.language_unresolved = query.language_unresolved;
  return { data: items.map((d) => project(d, query.fields)), meta };
}

/** Lowercased tag back to the registry's canonical spelling, so `eng-ng` reads `eng-NG`. */
function canonicalCase(lowerTag: string): string {
  const dash = lowerTag.indexOf('-');
  if (dash === -1) return lowerTag;
  return `${lowerTag.slice(0, dash)}-${lowerTag.slice(dash + 1).toUpperCase()}`;
}

export function countryList(params: URLSearchParams): unknown[] {
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const region = lowerSet(params, 'region');
  return countries
    .map((c) => countryStats.get(c.iso2))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .filter((c) => (region ? region.has(c.region.toLowerCase()) : true))
    .filter((c) =>
      q ? c.name.toLowerCase().includes(q) || c.iso2.toLowerCase() === q || c.iso3.toLowerCase() === q : true,
    );
}

export function countryDetail(iso2: string): unknown {
  const key = iso2.trim().toUpperCase();
  const country = countryStats.get(key);
  if (!country) {
    throw new ApiFault('not_found', `No country with ISO-3166 alpha-2 code "${iso2}".`, 404);
  }
  const list = datasetsByCountry.get(key) ?? [];
  return {
    ...country,
    datasets_list: list,
    languages_list: country.language_tags
      .map((tag) => byLangSlug.get(tag.toLowerCase()))
      .filter((l): l is NonNullable<typeof l> => Boolean(l)),
  };
}

/**
 * Every language, keyed on tag. `q` matches the tag, the canonical name or any alias,
 * and `iso` keeps only the tags built on the given ISO 639-3 codes, which is how a
 * caller asks for every variety of one code at once.
 */
export function languageList(params: URLSearchParams): unknown[] {
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const iso = lowerSet(params, 'iso');
  const region = lowerSet(params, 'region');
  return languages
    .filter((l) =>
      q
        ? l.name.toLowerCase().includes(q) ||
          l.slug.includes(q) ||
          l.aliases.some((alias) => alias.toLowerCase().includes(q))
        : true,
    )
    .filter((l) => (iso ? iso.has(l.iso639_3.toLowerCase()) : true))
    .filter((l) => (region ? l.region !== null && region.has(l.region.toLowerCase()) : true));
}

/**
 * One language and its datasets. The path segment may be a tag in any case, or any
 * name from that tag's `aliases`, and the response always carries the canonical tag.
 * `requested` echoes what was asked for so a caller can see the resolution happen.
 */
export function languageDetail(slug: string): unknown {
  const requested = slug.trim();
  const language = lookupLanguage(requested);
  if (!language) {
    throw new ApiFault(
      'not_found',
      `No language for "${slug}". Use an ISO 639-3 code such as sna, a BCP 47 tag such as eng-NG, or a name the catalogue knows.`,
      404,
    );
  }
  return {
    ...language,
    requested,
    /** True when the caller wrote something other than the canonical tag itself. */
    resolved: requested !== language.tag,
    datasets_list: datasetsByLanguage.get(language.slug) ?? [],
  };
}

/** Every spelling that resolves to a tag, as its own small document. */
export function languageAliases(slug: string): unknown {
  const language = lookupLanguage(slug.trim());
  if (!language) {
    throw new ApiFault('not_found', `No language for "${slug}".`, 404);
  }
  const entry = languageCodes.codes[language.tag];
  return {
    tag: language.tag,
    iso639_3: language.iso639_3,
    region: language.region,
    name: language.name,
    aliases: entry ? entry.aliases : language.aliases,
    resolution: entry ? entry.resolution : 'curated',
  };
}

export function datasetDetail(id: string): Dataset {
  const dataset = byId.get(id);
  if (!dataset) {
    throw new ApiFault('not_found', `No dataset with id "${id}".`, 404);
  }
  return dataset;
}

/* -------------------------------------------------------------------------- */
/* Routing                                                                    */
/* -------------------------------------------------------------------------- */

const COLLECTION_PATHS = new Set(['/datasets', '/countries', '/languages', '/stats', '/schema', '/snippets']);

/**
 * Handle a request whose path begins with /api/v1. `rest` is the path after that
 * prefix, always starting with a slash and never with a trailing one.
 */
export function handleApi(req: Request, rest: string, ctx: SiteContext): Response {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return error('method_not_allowed', `${req.method} is not allowed on the ngano API. Use GET.`, 405);
  }

  const url = new URL(req.url);
  const params = url.searchParams;

  try {
    const payload = route(rest, params, ctx);
    if (payload === undefined) {
      return error('not_found', `No API route for "${rest}". See /api/v1/openapi.json.`, 404);
    }
    const body = JSON.stringify(payload);
    if (COLLECTION_PATHS.has(rest) || rest === '/openapi.json') {
      const tag = etag(body);
      if (matchesEtag(req, tag)) return notModified(tag);
      return json(payload, { etag: tag });
    }
    return json(payload);
  } catch (err) {
    if (err instanceof ApiFault) return error(err.code, err.message, err.status);
    throw err;
  }
}

function route(rest: string, params: URLSearchParams, ctx: SiteContext): unknown {
  switch (rest) {
    case '':
    case '/':
      return {
        name: 'ngano',
        version: ctx.version,
        description: 'Open catalogue of African-language speech datasets.',
        endpoints: [
          '/api/v1/datasets',
          '/api/v1/datasets/{id}',
          '/api/v1/countries',
          '/api/v1/countries/{iso2}',
          '/api/v1/languages',
          '/api/v1/languages/{slug}',
          '/api/v1/stats',
          '/api/v1/schema',
          '/api/v1/snippets',
          '/api/v1/openapi.json',
          '/api/v1/healthz',
        ],
        docs: `${ctx.baseUrl}/docs`,
        openapi: `${ctx.baseUrl}/api/v1/openapi.json`,
        mcp: `${ctx.baseUrl}/mcp`,
      };
    case '/datasets':
      return datasetList(params);
    case '/countries':
      return countryList(params);
    case '/languages':
      return languageList(params);
    case '/stats':
      return stats;
    case '/schema':
      return fieldMap;
    case '/snippets':
      // Kept separate from /schema, which SPEC.md defines as the contents of
      // field_map.json alone. Mixing a second file into it would break that promise.
      return snippets;
    case '/openapi.json':
      return buildOpenApi(ctx.baseUrl);
    case '/healthz':
      return { ok: true, version: ctx.version, datasets: datasets.length };
    default:
      break;
  }

  const datasetMatch = /^\/datasets\/(.+)$/.exec(rest);
  if (datasetMatch?.[1]) return datasetDetail(decodeURIComponent(datasetMatch[1]));

  const countryMatch = /^\/countries\/([^/]+)$/.exec(rest);
  if (countryMatch?.[1]) return countryDetail(decodeURIComponent(countryMatch[1]));

  const aliasMatch = /^\/languages\/([^/]+)\/aliases$/.exec(rest);
  if (aliasMatch?.[1]) return languageAliases(decodeURIComponent(aliasMatch[1]));

  const languageMatch = /^\/languages\/([^/]+)$/.exec(rest);
  if (languageMatch?.[1]) return languageDetail(decodeURIComponent(languageMatch[1]));

  return undefined;
}
