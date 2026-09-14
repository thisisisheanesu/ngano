/**
 * Streamable HTTP MCP server for ngano, protocol revision 2025-06-18, no auth.
 *
 * POST /mcp carries one JSON-RPC 2.0 message. The reply is plain JSON, or a single
 * SSE `message` event when the caller says it accepts text/event-stream. Notifications
 * and responses get 202 with no body, as the transport requires.
 *
 * GET /mcp opens the server-to-client SSE stream. ngano has no server-initiated
 * requests to make, so the stream carries only comment keepalives and stays open.
 * That is the simplest behaviour the transport allows and it keeps clients that
 * insist on opening the stream happy.
 */

import {
  byId,
  byLangSlug,
  countryStats,
  datasets,
  datasetsByCountry,
  datasetsByLanguage,
  languages,
  lookupLanguage,
  resolveLanguage,
  snippets,
  stats,
} from './data.js';
import { countryList, filterDatasets, parseDatasetQuery, sortDatasets, ApiFault } from './api.js';
import { cors, preflight } from './http.js';
import type { Dataset, SiteContext, SnippetKey } from './types.js';

export const PROTOCOL_VERSION = '2025-06-18';
export const SERVER_NAME = 'ngano';

/* -------------------------------------------------------------------------- */
/* JSON-RPC plumbing                                                          */
/* -------------------------------------------------------------------------- */

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type Id = string | number | null;

interface RpcRequest {
  jsonrpc: '2.0';
  id?: Id;
  method?: string;
  params?: Record<string, unknown>;
}

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

function result(id: Id, value: unknown): Record<string, unknown> {
  return { jsonrpc: '2.0', id, result: value };
}

function rpcError(id: Id, code: number, message: string, data?: unknown): Record<string, unknown> {
  const err: Record<string, unknown> = { code, message };
  if (data !== undefined) err.data = data;
  return { jsonrpc: '2.0', id, error: err };
}

/* -------------------------------------------------------------------------- */
/* Tool schemas                                                               */
/* -------------------------------------------------------------------------- */

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

const str = (description: string): Record<string, unknown> => ({ type: 'string', description });
const strArray = (description: string): Record<string, unknown> => ({
  type: 'array',
  items: { type: 'string' },
  description,
});

/**
 * The one description of the tag format, quoted in every tool that takes or returns a
 * language so an agent reading the tool list learns the rule once.
 */
const TAG_FORMAT =
  'Languages are keyed on BCP 47 tags whose primary subtag is a lowercase ISO 639-3 code, with an optional uppercase ISO 3166-1 region subtag for a country-specific variety: sna is Shona, eng-NG is Nigerian English, por-MZ is Mozambican Portuguese. A bare code never stands for one of its varieties unless include_varieties is set.';

const LANGUAGE_INPUT =
  'Accepts an ISO 639-3 code ("sna"), a full tag ("eng-NG", case insensitive), or any name the catalogue knows for it ("Shona", "Nigerian English"). All of them resolve to the canonical tag.';

const DATASET_SUMMARY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description: 'A catalogue record, trimmed to the fields an agent needs to decide whether to load it.',
  required: ['id', 'name', 'task', 'languages', 'language_tags', 'countries', 'hours_num', 'licence', 'commercial', 'access', 'hf_repo', 'unverified_size'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    task: { type: 'string' },
    variety: { type: 'string' },
    languages: { type: 'array', items: { type: 'string' }, description: 'Canonical display names.' },
    language_tags: { type: 'array', items: { type: 'string' }, description: `The same languages as tags. ${TAG_FORMAT}` },
    language_codes: { type: 'array', items: { type: 'string' }, description: 'The bare ISO 639-3 codes behind those tags.' },
    language_note: { type: 'string', description: 'Why a record carries no tags: its source describes coverage in prose.' },
    countries: { type: 'array', items: { type: 'string' } },
    country_codes: { type: 'array', items: { type: 'string' } },
    hours: { type: ['string', 'null'] },
    hours_num: { type: ['number', 'null'] },
    quality: { type: 'string' },
    labelled: { type: 'string' },
    domain: { type: 'string' },
    licence: { type: 'string' },
    licence_class: { type: 'string' },
    commercial: { type: 'string' },
    access: { type: 'string' },
    host: { type: 'string' },
    url: { type: ['string', 'null'] },
    hf_repo: { type: ['string', 'null'] },
    year: { type: ['string', 'null'] },
    unverified_size: { type: 'boolean' },
  },
};

const FILTER_PROPERTIES: Record<string, unknown> = {
  q: str('Free text search over name, languages, countries, host, licence and notes.'),
  language: strArray(`Languages to keep, OR-ed together, for example ["sna"] or ["eng-NG"]. ${LANGUAGE_INPUT}`),
  iso: strArray('ISO 639-3 codes. An alias of the code form of `language`: the two are merged and OR-ed together.'),
  include_varieties: {
    type: 'boolean',
    description:
      'Widen a bare ISO 639-3 code to every regional variety of it, so language ["eng"] also matches eng-NG and eng-ZA. Default false.',
  },
  country: strArray('ISO 3166-1 alpha-2 country codes.'),
  region: strArray('African sub-regions, for example ["Southern Africa"].'),
  task: strArray('ASR, TTS, ASR+TTS, Raw source or Other.'),
  variety: strArray('Indigenous, Accented foreign, Creole/Pidgin or Code-switch.'),
  commercial: strArray('Yes, "Yes, if purchased", No or Unstated.'),
  licence_class: strArray('Licence family, for example "Attribution (CC-BY)".'),
  access: strArray('Open, Request, Paid, Scrape required or Unclear.'),
  labelled: strArray('Transcribed, Unlabelled or Unstated.'),
  quality: strArray('Recording quality band.'),
  domain: strArray('Speech domain.'),
  host: strArray('Where the data is hosted, for example HuggingFace.'),
  hf_only: { type: 'boolean', description: 'Keep only records with a Hugging Face repository.' },
  has_hours: { type: 'boolean', description: 'Keep only records that state a size.' },
  min_hours: { type: 'number', minimum: 0, description: 'Minimum countable hours. Unverified records count as zero.' },
  max_hours: { type: 'number', minimum: 0, description: 'Maximum countable hours.' },
};

const META_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['page', 'per_page', 'total', 'total_pages', 'total_hours'],
  properties: {
    page: { type: 'integer' },
    per_page: { type: 'integer' },
    total: { type: 'integer' },
    total_pages: { type: 'integer' },
    total_hours: { type: 'number' },
    language_tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'The canonical tags the language and iso filters resolved to. Absent when neither was given.',
    },
    language_unresolved: {
      type: 'array',
      items: { type: 'string' },
      description: 'Language values that matched no tag. Absent when everything resolved.',
    },
  },
};

/** Lowercased tag back to canonical spelling, so `eng-ng` reads `eng-NG`. */
function canonicalTagCase(lowerTag: string): string {
  const dash = lowerTag.indexOf('-');
  if (dash === -1) return lowerTag;
  return `${lowerTag.slice(0, dash)}-${lowerTag.slice(dash + 1).toUpperCase()}`;
}

const FACET_ARRAY: Record<string, unknown> = {
  type: 'array',
  items: {
    type: 'object',
    required: ['value', 'datasets', 'hours'],
    properties: { value: { type: 'string' }, datasets: { type: 'integer' }, hours: { type: 'number' } },
  },
};

const COUNTRY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['name', 'iso2', 'region', 'datasets', 'hours', 'languages'],
  properties: {
    name: { type: 'string' },
    iso2: { type: 'string' },
    iso3: { type: 'string' },
    region: { type: 'string' },
    slug: { type: 'string' },
    lat: { type: 'number' },
    lon: { type: 'number' },
    datasets: { type: 'integer' },
    hours: { type: 'number' },
    open: { type: 'integer' },
    commercial_ok: { type: 'integer' },
    languages: { type: 'array', items: { type: 'string' } },
  },
};

const LANGUAGE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description: `One language, keyed on its tag. ${TAG_FORMAT}`,
  required: ['tag', 'iso639_3', 'region', 'name', 'slug', 'aliases', 'datasets', 'countries', 'hours'],
  properties: {
    tag: { type: 'string', description: 'The canonical BCP 47 tag, for example sna or eng-NG.' },
    iso639_3: { type: 'string', description: 'The primary subtag alone, for example eng for eng-NG.' },
    region: { type: ['string', 'null'], description: 'ISO 3166-1 alpha-2 region, or null for the language at large.' },
    name: { type: 'string', description: 'Canonical display name.' },
    scope: { type: 'string' },
    type: { type: 'string' },
    aliases: { type: 'array', items: { type: 'string' }, description: 'Every spelling that resolves to this tag.' },
    slug: { type: 'string', description: 'The tag lowercased, which is the URL form.' },
    datasets: { type: 'integer' },
    countries: { type: 'array', items: { type: 'string' } },
    country_codes: { type: 'array', items: { type: 'string' } },
    tasks: { type: 'array', items: { type: 'string' } },
    hours: { type: 'number', description: 'Hours apportioned evenly across each record language tags.' },
  },
};

export const TOOLS: Tool[] = [
  {
    name: 'search_datasets',
    title: 'Search the ngano catalogue',
    description:
      `Search and filter African-language speech datasets. Filters are OR-ed within a parameter and AND-ed across parameters. Hours totals never include records flagged unverified_size. ${TAG_FORMAT} ${LANGUAGE_INPUT}`,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ...FILTER_PROPERTIES,
        sort: { type: 'string', enum: ['hours', '-hours', 'name', '-name', 'year', '-year'], description: 'Sort key, "-" for descending. Default -hours.' },
        page: { type: 'integer', minimum: 1, description: 'One-based page number. Default 1.' },
        per_page: { type: 'integer', minimum: 1, maximum: 200, description: 'Page size, maximum 200. Default 25.' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['data', 'meta'],
      properties: { data: { type: 'array', items: DATASET_SUMMARY_SCHEMA }, meta: META_SCHEMA },
    },
  },
  {
    name: 'get_dataset',
    title: 'Get one dataset',
    description: 'Fetch a single catalogue record by its ngano id, with every field including notes.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: { id: str('The ngano catalogue id, for example "google-fleurs".') },
    },
    outputSchema: { type: 'object', required: ['dataset'], properties: { dataset: DATASET_SUMMARY_SCHEMA } },
  },
  {
    name: 'list_countries',
    title: 'List African countries',
    description: 'All 58 countries in the catalogue with their dataset counts, hours and attested languages.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { q: str('Match on name, alpha-2 or alpha-3 code.'), region: strArray('African sub-regions.') },
    },
    outputSchema: {
      type: 'object',
      required: ['countries', 'total'],
      properties: { countries: { type: 'array', items: COUNTRY_SCHEMA }, total: { type: 'integer' } },
    },
  },
  {
    name: 'get_country',
    title: 'Get one country',
    description: 'One country with its datasets and the languages attested there.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['iso2'],
      properties: { iso2: str('ISO 3166-1 alpha-2 code, for example "ZW".') },
    },
    outputSchema: {
      type: 'object',
      required: ['country', 'datasets', 'languages'],
      properties: {
        country: COUNTRY_SCHEMA,
        datasets: { type: 'array', items: DATASET_SUMMARY_SCHEMA },
        languages: { type: 'array', items: LANGUAGE_SCHEMA },
      },
    },
  },
  {
    name: 'list_languages',
    title: 'List languages',
    description: `Every language in the catalogue, keyed on tag, with its dataset count and apportioned hours. ${TAG_FORMAT}`,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        q: str('Substring match on the tag, the canonical name or any alias.'),
        min_datasets: { type: 'integer', minimum: 0, description: 'Keep only languages with at least this many datasets.' },
        limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Maximum languages to return. Default 100.' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['languages', 'total'],
      properties: { languages: { type: 'array', items: LANGUAGE_SCHEMA }, total: { type: 'integer' } },
    },
  },
  {
    name: 'get_language',
    title: 'Get one language',
    description: `One language with every dataset that covers it. The result always carries the canonical tag, whichever spelling was asked for. ${LANGUAGE_INPUT}`,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['slug'],
      properties: { slug: str('An ISO 639-3 code ("sna"), a tag ("eng-NG", case insensitive) or a known name ("Shona", "Nigerian English").') },
    },
    outputSchema: {
      type: 'object',
      required: ['language', 'datasets'],
      properties: {
        language: LANGUAGE_SCHEMA,
        requested: { type: 'string', description: 'The spelling the caller gave, before resolution.' },
        datasets: { type: 'array', items: DATASET_SUMMARY_SCHEMA },
      },
    },
  },
  {
    name: 'get_stats',
    title: 'Catalogue statistics',
    description: 'Global totals and per-facet aggregates for the whole catalogue. Unverified sizes are excluded from every hour figure.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    outputSchema: {
      type: 'object',
      required: ['datasets', 'languages', 'countries', 'hours'],
      properties: {
        datasets: { type: 'integer' },
        languages: { type: 'integer', description: 'Distinct language tags.' },
        language_codes: { type: 'integer', description: 'Distinct ISO 639-3 codes, varieties collapsed.' },
        countries: { type: 'integer' },
        hours: { type: 'number' },
        hours_open: { type: 'number' },
        hours_commercial: { type: 'number' },
        unverified_excluded: { type: 'integer' },
        by_task: FACET_ARRAY,
        by_commercial: FACET_ARRAY,
        by_licence_class: FACET_ARRAY,
        by_access: FACET_ARRAY,
        by_labelled: FACET_ARRAY,
        by_quality: FACET_ARRAY,
        by_variety: FACET_ARRAY,
        by_domain: FACET_ARRAY,
        by_region: FACET_ARRAY,
      },
    },
  },
  {
    name: 'get_loader_snippet',
    title: 'Loader code for a filter',
    description:
      'Ready-to-run code for the ngano SDKs, in Python, JavaScript and Rust. The snippets come from the shipped packages and are compile checked by their own test suites, and every placeholder is filled in from the real catalogue. Pass the same filter you would pass to search_datasets.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ...FILTER_PROPERTIES,
        dataset_id: str('Show one specific catalogue record instead of a filter.'),
        language_name: str('Convenience shorthand for language: ["<value>"]. Takes a code, a tag or a name.'),
        code_language: {
          type: 'string',
          enum: ['python', 'javascript', 'rust'],
          description: 'Which SDK to show. All three are returned when this is omitted. Note that "language" filters by spoken language, not by SDK.',
        },
        languages: {
          type: 'array',
          items: { type: 'string', enum: ['python', 'javascript', 'rust'] },
          description: 'Alias for code_language, accepting several SDKs at once.',
        },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['filter', 'snippet_keys', 'tokens', 'matched_datasets', 'snippets'],
      properties: {
        filter: { type: 'object', description: 'The filter as the SDKs will receive it.' },
        snippet_keys: {
          type: 'array',
          items: { type: 'string', enum: ['catalogue_filter', 'stream_filter', 'single_dataset', 'language_page', 'country_page', 'dataset_page', 'cli'] },
          description: 'Which snippets were chosen for this question.',
        },
        tokens: {
          type: 'object',
          description: 'The values substituted into the snippets. Every one is a real catalogue value.',
          required: ['CONFIG', 'COUNTRY_ISO2', 'COUNTRY_NAME', 'DATASET_ID', 'HF_REPO', 'LANGUAGE', 'TASK'],
          properties: {
            CONFIG: { type: 'string' },
            COUNTRY_ISO2: { type: 'string' },
            COUNTRY_NAME: { type: 'string' },
            DATASET_ID: { type: 'string' },
            HF_REPO: { type: 'string' },
            LANGUAGE: { type: 'string', description: 'A BCP 47 language tag, which is what the SDKs filter on. Never a display name.' },
            TASK: { type: 'string' },
          },
        },
        matched_datasets: { type: 'integer', description: 'How many catalogue records the filter selects.' },
        matched_hours: { type: 'number', description: 'Countable hours across those records.' },
        sample_dataset_ids: { type: 'array', items: { type: 'string' } },
        snippets: {
          type: 'object',
          description: 'One entry per SDK, keyed by python, javascript or rust.',
          additionalProperties: {
            type: 'object',
            required: ['language', 'install', 'package', 'blocks'],
            properties: {
              language: { type: 'string' },
              install: { type: 'string' },
              install_audio: { type: ['string', 'null'] },
              package: { type: 'string' },
              blocks: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['key', 'shell', 'code'],
                  properties: {
                    key: { type: 'string' },
                    shell: { type: 'boolean', description: 'True when the body is a shell session rather than source.' },
                    code: { type: 'string', description: 'Runnable code with every placeholder substituted.' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
];

/* -------------------------------------------------------------------------- */
/* Tool implementations                                                       */
/* -------------------------------------------------------------------------- */

function summarise(d: Dataset): Record<string, unknown> {
  return {
    id: d.id,
    name: d.name,
    task: d.task,
    variety: d.variety,
    languages: d.languages_clean,
    language_tags: d.language_tags,
    language_codes: d.language_codes,
    ...(d.language_note ? { language_note: d.language_note } : {}),
    countries: d.countries,
    country_codes: d.country_codes,
    hours: d.hours,
    hours_num: d.hours_num,
    quality: d.quality,
    labelled: d.labelled,
    domain: d.domain,
    licence: d.licence,
    licence_class: d.licence_class,
    commercial: d.commercial,
    access: d.access,
    host: d.host,
    url: d.url,
    hf_repo: d.hf_repo,
    year: d.year,
    unverified_size: d.unverified_size,
  };
}

function argObject(args: unknown): Record<string, unknown> {
  if (args === undefined || args === null) return {};
  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new ApiFault('invalid_parameter', 'Tool arguments must be an object.', 400);
  }
  return args as Record<string, unknown>;
}

function asStringList(value: unknown, name: string): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (typeof v !== 'string') throw new ApiFault('invalid_parameter', `${name} must be a string or an array of strings.`, 400);
      return v.trim();
    }).filter(Boolean);
  }
  throw new ApiFault('invalid_parameter', `${name} must be a string or an array of strings.`, 400);
}

function asString(value: unknown, name: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ApiFault('invalid_parameter', `${name} must be a string.`, 400);
  return value;
}

function asBool(value: unknown, name: string): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'boolean') throw new ApiFault('invalid_parameter', `${name} must be a boolean.`, 400);
  return value;
}

function asInt(value: unknown, name: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiFault('invalid_parameter', `${name} must be a number.`, 400);
  }
  return value;
}

const LIST_FILTERS = [
  'language',
  'iso',
  'country',
  'region',
  'task',
  'variety',
  'commercial',
  'licence_class',
  'access',
  'labelled',
  'quality',
  'domain',
  'host',
] as const;

/** Turn tool arguments into the same URLSearchParams the REST API parses. */
function filterParams(args: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  const q = asString(args.q, 'q');
  if (q) params.set('q', q);
  for (const key of LIST_FILTERS) {
    for (const value of asStringList(args[key], key)) params.append(key, value);
  }
  const languageName = asString(args.language_name, 'language_name');
  if (languageName) params.append('language', languageName);
  for (const key of ['hf_only', 'has_hours', 'include_varieties'] as const) {
    const value = asBool(args[key], key);
    if (value !== null) params.set(key, String(value));
  }
  for (const key of ['min_hours', 'max_hours'] as const) {
    const value = asInt(args[key], key);
    if (value !== null) params.set(key, String(value));
  }
  return params;
}

/** A plain object description of the filter, used by the snippet generator. */
export interface LoaderFilter {
  dataset_id?: string;
  language?: string[];
  include_varieties?: boolean;
  iso?: string[];
  country?: string[];
  region?: string[];
  task?: string[];
  commercial?: boolean;
  access?: string[];
  labelled?: string[];
  min_hours?: number;
  max_hours?: number;
  hf_only?: boolean;
  q?: string;
}

function buildLoaderFilter(args: Record<string, unknown>): LoaderFilter {
  const filter: LoaderFilter = {};
  const datasetId = asString(args.dataset_id, 'dataset_id');
  if (datasetId) filter.dataset_id = datasetId;

  const languageList = [...asStringList(args.language, 'language')];
  const languageName = asString(args.language_name, 'language_name');
  if (languageName) languageList.push(languageName);
  if (languageList.length > 0) filter.language = languageList;
  const includeVarieties = asBool(args.include_varieties, 'include_varieties');
  if (includeVarieties !== null) filter.include_varieties = includeVarieties;

  for (const key of ['iso', 'country', 'region', 'task', 'access', 'labelled'] as const) {
    const values = asStringList(args[key], key);
    if (values.length > 0) filter[key] = values;
  }
  const q = asString(args.q, 'q');
  if (q) filter.q = q;

  // The SDKs expose commercial use as a boolean, because that is the question a
  // caller actually asks. It maps onto the catalogue values Yes and Yes, if purchased.
  const commercial = asStringList(args.commercial, 'commercial');
  if (commercial.length > 0) {
    filter.commercial = commercial.some((v) => v.toLowerCase().startsWith('yes'));
  }
  const hfOnly = asBool(args.hf_only, 'hf_only');
  if (hfOnly !== null) filter.hf_only = hfOnly;
  const minHours = asInt(args.min_hours, 'min_hours');
  if (minHours !== null) filter.min_hours = minHours;
  const maxHours = asInt(args.max_hours, 'max_hours');
  if (maxHours !== null) filter.max_hours = maxHours;
  return filter;
}

/* -------------------------------------------------------------------------- */
/* Snippet substitution                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The snippets are not generated here. `data/snippets.json` is produced by
 * `scripts/merge_snippets.py` from each SDK package, and every package has a test
 * that compiles or typechecks its own snippets, so the code below is known to run.
 * All this module does is choose which snippets answer the question and fill in the
 * seven placeholder tokens from the real catalogue.
 */

export const SNIPPET_LANGUAGES = ['python', 'javascript', 'rust'] as const;

/** The tokens `data/snippets.json` leaves for the caller. None may survive. */
export interface SnippetTokens {
  CONFIG: string;
  COUNTRY_ISO2: string;
  COUNTRY_NAME: string;
  DATASET_ID: string;
  HF_REPO: string;
  LANGUAGE: string;
  TASK: string;
}

/**
 * A real, well-populated catalogue record used when the caller gave no dataset.
 * It has a Hugging Face repo, many languages and many countries, so a substituted
 * snippet is runnable rather than merely well formed. Chosen once per isolate.
 */
const EXEMPLAR: Dataset = (() => {
  let best: Dataset | undefined;
  let bestScore = -1;
  for (const d of datasets) {
    if (!d.hf_repo || d.unverified_size || d.access !== 'Open') continue;
    const score = d.languages_clean.length * 10 + d.country_codes.length + (d.hours_num ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  // The catalogue always has open Hugging Face records, but fall back rather than
  // let a bad data file take the whole Worker down at module scope.
  return best ?? (datasets[0] as Dataset);
})();

/**
 * The Hugging Face config name for a record.
 *
 * A config is the repo's named subset, which for African corpora is almost always
 * the language. A config name is a bare ISO 639-3 code rather than a full tag, because
 * that is what the repos themselves use, so `language_codes` is what is read, and
 * `default` is the Hugging Face name for a repo that has only one unnamed config.
 * The caller is told to check the repo's config list, because ngano does not claim
 * to know every repo's naming.
 */
function configFor(d: Dataset): string {
  return d.language_codes[0] ?? d.iso[0] ?? 'default';
}

function countryNameFor(code: string): string {
  return countryStats.get(code.toUpperCase())?.name ?? code.toUpperCase();
}

/** Resolve every token from the filter, the chosen record and the exemplar. */
export function resolveTokens(filter: LoaderFilter, record: Dataset | null): SnippetTokens {
  const source = record ?? EXEMPLAR;

  // The SDKs filter on tags, so the token is a tag, never a display name. A caller's
  // own spelling is resolved first, which is what makes a snippet copy-and-run.
  const asked = filter.language?.[0];
  const language =
    (asked ? resolveLanguage(asked, { includeVarieties: filter.include_varieties ?? false })[0] : undefined) ??
    source.language_tags[0] ??
    EXEMPLAR.language_tags[0] ??
    'swh';

  const iso2 = (filter.country?.[0] ?? source.country_codes[0] ?? EXEMPLAR.country_codes[0] ?? 'ZA').toUpperCase();

  const task = filter.task?.[0] ?? source.task;

  // A record with no Hugging Face repo cannot demonstrate a repo-level load, so the
  // exemplar stands in rather than leaving the token, or an empty string, in the code.
  const repoSource = source.hf_repo ? source : EXEMPLAR;

  return {
    CONFIG: configFor(repoSource),
    COUNTRY_ISO2: iso2,
    COUNTRY_NAME: countryNameFor(iso2),
    DATASET_ID: source.id,
    HF_REPO: repoSource.hf_repo ?? EXEMPLAR.hf_repo ?? '',
    LANGUAGE: language,
    TASK: task,
  };
}

/** Replace every `{{TOKEN}}` in a snippet. Unknown tokens are left for the check below. */
export function substitute(code: string, tokens: SnippetTokens): string {
  return code.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, name: string) => {
    const value = (tokens as unknown as Record<string, string | undefined>)[name];
    return value === undefined ? match : value;
  });
}

/** Any `{{TOKEN}}` left in the text. Must always be empty before a snippet is returned. */
export function unresolvedTokens(text: string): string[] {
  return [...new Set(text.match(/\{\{[A-Z0-9_]+\}\}/g) ?? [])];
}

/**
 * Which snippets answer the caller's question.
 *
 * A dataset id is a question about one corpus, so it gets the catalogue record page
 * and the direct repo load. A lone language or a lone country is a question about a
 * place in the catalogue, so it gets that page. Anything else is a filter, so it gets
 * the streaming loader. `catalogue_filter` always comes along, because every answer
 * benefits from showing how the same filter is run against the catalogue alone.
 */
export function selectSnippetKeys(filter: LoaderFilter): SnippetKey[] {
  if (filter.dataset_id) return ['dataset_page', 'single_dataset', 'catalogue_filter'];

  const facets = [filter.language, filter.country, filter.iso, filter.region, filter.task, filter.access, filter.labelled]
    .filter((v) => v !== undefined && v.length > 0).length;
  const scalars = [filter.commercial, filter.hf_only, filter.min_hours, filter.max_hours, filter.q].filter(
    (v) => v !== undefined,
  ).length;
  const lone = facets === 1 && scalars === 0;

  if (lone && filter.language && filter.language.length === 1) return ['language_page', 'catalogue_filter'];
  if (lone && filter.country && filter.country.length === 1) return ['country_page', 'catalogue_filter'];
  return ['stream_filter', 'catalogue_filter'];
}

export interface SnippetBlock {
  key: string;
  /** True when the body is a shell session rather than source in this language. */
  shell: boolean;
  code: string;
}

export interface RenderedPack {
  language: string;
  install: string;
  install_audio: string | null;
  package: string;
  blocks: SnippetBlock[];
}

/**
 * The real snippets for one SDK, with every token filled in. Returns null when the
 * snippet file does not carry that language, which keeps a future SDK from crashing
 * an older Worker.
 */
export function renderPack(language: string, keys: readonly SnippetKey[], tokens: SnippetTokens): RenderedPack | null {
  const pack = snippets.languages[language];
  if (!pack) return null;
  const blocks: SnippetBlock[] = [];
  for (const key of keys) {
    const template = pack.snippets[key];
    if (template === undefined) continue;
    blocks.push({ key, shell: pack.shell_snippets.includes(key), code: substitute(template, tokens) });
  }
  return {
    language: pack.language,
    install: pack.install,
    install_audio: pack.install_audio,
    package: pack.package,
    blocks,
  };
}

/** Markdown fence language for a block. Shell sessions are fenced as shell. */
function fenceFor(language: string, shell: boolean): string {
  if (shell) return 'sh';
  if (language === 'javascript') return 'javascript';
  if (language === 'rust') return 'rust';
  return 'python';
}

/* -------------------------------------------------------------------------- */
/* Tool dispatch                                                              */
/* -------------------------------------------------------------------------- */

interface ToolResult {
  text: string;
  structured: Record<string, unknown>;
}

function fmtHours(hours: number): string {
  return hours >= 1000 ? `${Math.round(hours).toLocaleString('en-GB')} hours` : `${hours} hours`;
}

function callTool(name: string, rawArgs: unknown, ctx: SiteContext): ToolResult {
  const args = argObject(rawArgs);

  switch (name) {
    case 'search_datasets': {
      const params = filterParams(args);
      const sort = asString(args.sort, 'sort');
      if (sort) params.set('sort', sort);
      const page = asInt(args.page, 'page');
      if (page !== null) params.set('page', String(page));
      const perPage = asInt(args.per_page, 'per_page');
      params.set('per_page', String(perPage ?? 25));
      const query = parseDatasetQuery(params);
      const matched = sortDatasets(filterDatasets(query), query.sort, query.desc);
      const start = (query.page - 1) * query.per_page;
      const pageItems = matched.slice(start, start + query.per_page);
      let hours = 0;
      for (const d of matched) hours += d.unverified_size ? 0 : (d.hours_num ?? 0);
      hours = Math.round(hours * 10) / 10;
      const meta: Record<string, unknown> = {
        page: query.page,
        per_page: query.per_page,
        total: matched.length,
        total_pages: Math.max(1, Math.ceil(matched.length / query.per_page)),
        total_hours: hours,
      };
      // Whatever spelling the caller used, the reply says which tags it became.
      if (query.language) meta.language_tags = [...query.language].map(canonicalTagCase);
      if (query.language_unresolved.length > 0) meta.language_unresolved = query.language_unresolved;
      const lines = pageItems.map(
        (d) =>
          `- ${d.name} (${d.id}): ${d.task}, ${d.languages_clean.slice(0, 4).join(', ')}${d.languages_clean.length > 4 ? ' and more' : ''}, ${
            d.hours_num === null ? 'size unstated' : `${d.hours_num} h${d.unverified_size ? ' (unverified, not counted)' : ''}`
          }, ${d.licence}, access ${d.access}${d.hf_repo ? `, hf: ${d.hf_repo}` : ''}`,
      );
      const header =
        matched.length === 0
          ? 'No datasets match that filter.'
          : `${matched.length} dataset${matched.length === 1 ? '' : 's'} match, ${fmtHours(hours)} in total (unverified sizes excluded). Page ${meta.page} of ${meta.total_pages}:`;
      return {
        text: [header, ...lines].join('\n'),
        structured: { data: pageItems.map(summarise), meta },
      };
    }

    case 'get_dataset': {
      const id = asString(args.id, 'id');
      if (!id) throw new ApiFault('invalid_parameter', 'get_dataset requires an id.', 400);
      const dataset = byId.get(id);
      if (!dataset) throw new ApiFault('not_found', `No dataset with id "${id}".`, 404);
      const text = [
        `${dataset.name} (${dataset.id})`,
        `Task: ${dataset.task}. Variety: ${dataset.variety}. Quality: ${dataset.quality}. Labels: ${dataset.labelled}.`,
        `Languages: ${dataset.languages_clean.join(', ')}`,
        `Countries: ${dataset.countries.join(', ')}`,
        `Size: ${dataset.hours_num === null ? 'unstated' : `${dataset.hours_num} hours`}${dataset.unverified_size ? ' (self-reported and unverified, excluded from every ngano total)' : ''}`,
        `Licence: ${dataset.licence} (${dataset.licence_class}). Commercial use: ${dataset.commercial}. Access: ${dataset.access}.`,
        `Host: ${dataset.host}${dataset.hf_repo ? ` (${dataset.hf_repo})` : ''}${dataset.url ? ` ${dataset.url}` : ''}`,
        dataset.notes ? `Notes: ${dataset.notes}` : '',
        `Catalogue page: ${ctx.baseUrl}/datasets/${dataset.id}`,
      ]
        .filter(Boolean)
        .join('\n');
      return { text, structured: { dataset: summarise(dataset) } };
    }

    case 'list_countries': {
      const params = new URLSearchParams();
      const q = asString(args.q, 'q');
      if (q) params.set('q', q);
      for (const value of asStringList(args.region, 'region')) params.append('region', value);
      const list = countryList(params) as Array<Record<string, unknown>>;
      const text = [
        `${list.length} countr${list.length === 1 ? 'y' : 'ies'}:`,
        ...list.map((c) => `- ${String(c.name)} (${String(c.iso2)}), ${String(c.datasets)} datasets, ${String(c.hours)} hours, ${(c.languages as string[]).length} languages`),
      ].join('\n');
      return { text, structured: { countries: list as unknown as Record<string, unknown>[], total: list.length } };
    }

    case 'get_country': {
      const iso2 = asString(args.iso2, 'iso2');
      if (!iso2) throw new ApiFault('invalid_parameter', 'get_country requires an iso2 code.', 400);
      const key = iso2.trim().toUpperCase();
      const country = countryStats.get(key);
      if (!country) throw new ApiFault('not_found', `No country with ISO-3166 alpha-2 code "${iso2}".`, 404);
      const list = datasetsByCountry.get(key) ?? [];
      const langs = country.language_tags
        .map((tag) => byLangSlug.get(tag.toLowerCase()))
        .filter((l): l is NonNullable<typeof l> => Boolean(l));
      const text = [
        `${country.name} (${country.iso2}), ${country.region}.`,
        `${country.datasets} datasets, ${fmtHours(country.hours)} apportioned to this country, ${country.languages.length} languages attested.`,
        `${country.open} are openly accessible and ${country.commercial_ok} permit commercial use.`,
        `Languages: ${country.languages.slice(0, 25).join(', ')}${country.languages.length > 25 ? ' and more' : ''}`,
        `Country page: ${ctx.baseUrl}/countries/${country.iso2.toLowerCase()}`,
      ].join('\n');
      return {
        text,
        structured: {
          country: { ...country },
          datasets: list.map(summarise),
          languages: langs.map((l) => ({ ...l })),
        },
      };
    }

    case 'list_languages': {
      const q = (asString(args.q, 'q') ?? '').trim().toLowerCase();
      const minDatasets = asInt(args.min_datasets, 'min_datasets') ?? 0;
      const limit = asInt(args.limit, 'limit') ?? 100;
      const matched = languages
        .filter((l) =>
          q
            ? l.name.toLowerCase().includes(q) ||
              l.slug.includes(q) ||
              l.aliases.some((alias) => alias.toLowerCase().includes(q))
            : true,
        )
        .filter((l) => l.datasets >= minDatasets)
        .slice()
        .sort((a, b) => b.datasets - a.datasets || b.hours - a.hours || a.name.localeCompare(b.name));
      const shown = matched.slice(0, limit);
      const text = [
        `${matched.length} language${matched.length === 1 ? '' : 's'} match, showing ${shown.length}:`,
        ...shown.map((l) => `- ${l.tag}: ${l.name}, ${l.datasets} datasets, ${l.hours} hours, ${l.countries.length} countries`),
      ].join('\n');
      return { text, structured: { languages: shown.map((l) => ({ ...l })), total: matched.length } };
    }

    case 'get_language': {
      const slug = asString(args.slug, 'slug');
      if (!slug) throw new ApiFault('invalid_parameter', 'get_language requires a slug.', 400);
      const language = lookupLanguage(slug.trim());
      if (!language) {
        throw new ApiFault(
          'not_found',
          `No language for "${slug}". Give an ISO 639-3 code such as sna, a tag such as eng-NG, or a name the catalogue knows.`,
          404,
        );
      }
      const list = datasetsByLanguage.get(language.slug) ?? [];
      const region = language.region ? `, region ${language.region}` : '';
      const text = [
        `${language.name}: tag ${language.tag}, ISO 639-3 ${language.iso639_3}${region}.`,
        `Also known as: ${language.aliases.join(', ')}.`,
        `${language.datasets} datasets, ${fmtHours(language.hours)} apportioned to this language, spoken across ${language.countries.length} catalogued countries.`,
        `Top sources: ${list
          .slice()
          .sort((a, b) => (b.unverified_size ? 0 : (b.hours_num ?? 0)) - (a.unverified_size ? 0 : (a.hours_num ?? 0)))
          .slice(0, 5)
          .map((d) => d.name)
          .join('; ')}`,
        `Language page: ${ctx.baseUrl}/languages/${language.slug}`,
      ].join('\n');
      return {
        text,
        structured: { language: { ...language }, requested: slug.trim(), datasets: list.map(summarise) },
      };
    }

    case 'get_stats': {
      const text = [
        `ngano catalogues ${stats.datasets} speech datasets covering ${stats.languages} language tags (${stats.language_codes} distinct ISO 639-3 codes) across ${stats.countries} countries.`,
        `${fmtHours(stats.hours)} in total, of which ${fmtHours(stats.hours_open)} are openly accessible and ${fmtHours(stats.hours_commercial)} permit commercial use.`,
        `${stats.unverified_excluded} records carry self-reported sizes of 20000 hours or more and are excluded from every hour figure above.`,
        `By task: ${stats.by_task.map((f) => `${f.value} ${f.datasets}`).join(', ')}.`,
        `By access: ${stats.by_access.map((f) => `${f.value} ${f.datasets}`).join(', ')}.`,
        `By region: ${stats.by_region.map((f) => `${f.value} ${f.datasets}`).join(', ')}.`,
      ].join('\n');
      return { text, structured: { ...stats } as unknown as Record<string, unknown> };
    }

    case 'get_loader_snippet': {
      // `code_language` names an SDK. The spoken-language filter keeps the name
      // `language`, the same as every other tool and the REST API, so the two can
      // never be confused. `languages` is accepted as an alias for `code_language`.
      const requested = [
        ...asStringList(args.code_language, 'code_language'),
        ...asStringList(args.languages, 'languages'),
      ].map((v) => v.toLowerCase());
      for (const target of requested) {
        if (!(SNIPPET_LANGUAGES as readonly string[]).includes(target)) {
          throw new ApiFault(
            'invalid_parameter',
            `Unknown SDK "${target}". Use python, javascript or rust. To filter by spoken language use "language".`,
            400,
          );
        }
      }
      const targets: string[] = requested.length > 0 ? [...new Set(requested)] : [...SNIPPET_LANGUAGES];

      const filter = buildLoaderFilter(args);

      // Report what the filter actually selects, so the caller knows whether the
      // snippet will stream a handful of rows or several thousand hours of audio.
      const datasetId = filter.dataset_id;
      let matched: Dataset[];
      let record: Dataset | null = null;
      if (datasetId) {
        const one = byId.get(datasetId);
        if (!one) throw new ApiFault('not_found', `No dataset with id "${datasetId}".`, 404);
        record = one;
        matched = [one];
      } else {
        const query = parseDatasetQuery(filterParams(args));
        matched = filterDatasets(query);
        // Substitute from a matched record where there is one, so the dataset id and
        // repo in the code are ones the caller's own filter actually selects.
        record = matched.find((d) => d.hf_repo !== null) ?? matched[0] ?? null;
      }
      let hours = 0;
      for (const d of matched) hours += d.unverified_size ? 0 : (d.hours_num ?? 0);
      hours = Math.round(hours * 10) / 10;

      const keys = selectSnippetKeys(filter);
      const tokens = resolveTokens(filter, record);

      const packs: Record<string, RenderedPack> = {};
      for (const target of targets) {
        const pack = renderPack(target, keys, tokens);
        if (pack) packs[target] = pack;
      }

      // Nothing leaves this tool with a placeholder still in it. A missed token would
      // be code the caller cannot run, which is worse than an error they can see.
      for (const pack of Object.values(packs)) {
        for (const block of pack.blocks) {
          const left = unresolvedTokens(block.code);
          if (left.length > 0) {
            throw new ApiFault(
              'internal_error',
              `Snippet "${block.key}" for ${pack.language} still contains ${left.join(', ')}.`,
              500,
            );
          }
        }
      }

      const parts = [
        datasetId
          ? `Loader code for ${record?.name ?? datasetId} (${fmtHours(hours)}${record?.unverified_size ? ', self-reported and not counted' : ''}).`
          : `This filter selects ${matched.length} dataset${matched.length === 1 ? '' : 's'} (${fmtHours(hours)}, unverified sizes excluded).`,
        'Rows stream lazily in all three SDKs, so you can break out after N rows without downloading the rest.',
        `The code below comes from the shipped packages and is compile checked by their own test suites. Placeholders are filled in from the catalogue: language ${tokens.LANGUAGE}, country ${tokens.COUNTRY_NAME} (${tokens.COUNTRY_ISO2}), task ${tokens.TASK}, dataset ${tokens.DATASET_ID}, repo ${tokens.HF_REPO}, config ${tokens.CONFIG}. Check the repo on Hugging Face for its real config names.`,
        '',
      ];
      for (const target of targets) {
        const pack = packs[target];
        if (!pack) continue;
        parts.push(`## ${target}`, '', `Install: \`${pack.install}\``);
        if (pack.install_audio) parts.push(`With audio decoding: \`${pack.install_audio}\``);
        parts.push('');
        for (const block of pack.blocks) {
          parts.push(`${block.key}:`, '```' + fenceFor(target, block.shell), block.code, '```', '');
        }
      }

      return {
        text: parts.join('\n').trimEnd(),
        structured: {
          filter: filter as unknown as Record<string, unknown>,
          snippet_keys: keys,
          tokens: tokens as unknown as Record<string, unknown>,
          matched_datasets: matched.length,
          matched_hours: hours,
          sample_dataset_ids: matched.slice(0, 10).map((d) => d.id),
          snippets: packs as unknown as Record<string, unknown>,
        },
      };
    }

    default:
      throw new ApiFault('not_found', `Unknown tool "${name}".`, 404);
  }
}

/* -------------------------------------------------------------------------- */
/* JSON-RPC dispatch                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Handle one JSON-RPC message. Returns null for anything that takes no reply,
 * which is what notifications and client responses are.
 */
export function handleRpc(message: unknown, ctx: SiteContext): Record<string, unknown> | null {
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    return rpcError(null, INVALID_REQUEST, 'A JSON-RPC message must be an object.');
  }
  const msg = message as RpcRequest;
  const id: Id = msg.id === undefined ? null : msg.id;
  const hasId = msg.id !== undefined && msg.id !== null;

  if (msg.jsonrpc !== '2.0') {
    return rpcError(id, INVALID_REQUEST, 'Expected jsonrpc: "2.0".');
  }
  if (typeof msg.method !== 'string') {
    // A response from the client, not a request. Nothing to answer.
    return null;
  }

  const params = (msg.params ?? {}) as Record<string, unknown>;

  try {
    switch (msg.method) {
      case 'initialize': {
        return result(id, {
          // ngano speaks exactly one revision. A client that asked for another one
          // sees this and can decide whether to continue or disconnect.
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, title: 'ngano catalogue', version: ctx.version },
          instructions: [
            'ngano is an open catalogue of African-language speech datasets.',
            'Use search_datasets to find corpora, get_dataset for the full record, and',
            'get_loader_snippet to turn any filter into runnable Python, JavaScript or Rust.',
            'Hour totals never include records flagged unverified_size, which are self-reported',
            'figures of 20000 hours or more. Say so when you quote a total.',
          ].join(' '),
        });
      }

      case 'notifications/initialized':
      case 'notifications/cancelled':
        return null;

      case 'ping':
        return result(id, {});

      case 'tools/list':
        return result(id, { tools: TOOLS });

      case 'tools/call': {
        const name = params.name;
        if (typeof name !== 'string') {
          return rpcError(id, INVALID_PARAMS, 'tools/call requires a string "name".');
        }
        if (!TOOLS.some((t) => t.name === name)) {
          return rpcError(id, INVALID_PARAMS, `Unknown tool "${name}".`);
        }
        try {
          const out = callTool(name, params.arguments, ctx);
          return result(id, {
            content: [{ type: 'text', text: out.text }],
            structuredContent: out.structured,
            isError: false,
          });
        } catch (err) {
          // Tool failures are reported inside the result, not as protocol errors,
          // so the model can see what went wrong and try again.
          const message = err instanceof Error ? err.message : 'The tool call failed.';
          return result(id, { content: [{ type: 'text', text: message }], isError: true });
        }
      }

      default:
        if (!hasId) return null;
        return rpcError(id, METHOD_NOT_FOUND, `Unknown method "${msg.method}".`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error.';
    return rpcError(id, INTERNAL_ERROR, message);
  }
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

function wantsSse(req: Request): boolean {
  const accept = req.headers.get('Accept') ?? '';
  return accept.includes('text/event-stream');
}

function sseHeaders(): Headers {
  return new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'MCP-Protocol-Version': PROTOCOL_VERSION,
  });
}

function sseEvent(data: unknown, id?: string): string {
  const payload = JSON.stringify(data);
  return `${id ? `id: ${id}\n` : ''}event: message\ndata: ${payload}\n\n`;
}

function jsonRpcResponse(body: unknown, status = 200): Response {
  return cors(
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'MCP-Protocol-Version': PROTOCOL_VERSION,
      },
    }),
  );
}

/** The whole MCP endpoint: POST for messages, GET for the server stream. */
export async function handleMcp(req: Request, ctx: SiteContext): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight();

  if (req.method === 'GET') {
    if (!wantsSse(req)) {
      return jsonRpcResponse(
        rpcError(null, INVALID_REQUEST, 'GET /mcp opens the SSE stream. Send Accept: text/event-stream, or POST a JSON-RPC message.'),
        406,
      );
    }
    // ngano never initiates a request, so the stream stays open with comment
    // keepalives. Clients that do not need it can simply close the connection.
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`: ngano mcp ${PROTOCOL_VERSION}, endpoint ${ctx.baseUrl}/mcp\n\n`));
        timer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
            if (timer !== undefined) clearInterval(timer);
          }
        }, 15_000);
      },
      cancel() {
        if (timer !== undefined) clearInterval(timer);
      },
    });
    return cors(new Response(stream, { status: 200, headers: sseHeaders() }));
  }

  if (req.method !== 'POST') {
    return jsonRpcResponse(rpcError(null, INVALID_REQUEST, `${req.method} is not supported at /mcp.`), 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonRpcResponse(rpcError(null, PARSE_ERROR, 'The request body is not valid JSON.'), 400);
  }

  // A batch is allowed by JSON-RPC 2.0; answer every member that needs an answer.
  if (Array.isArray(body)) {
    const replies = body.map((m) => handleRpc(m, ctx)).filter((r): r is Record<string, unknown> => r !== null);
    if (replies.length === 0) return cors(new Response(null, { status: 202 }));
    if (wantsSse(req)) return sseReply(replies);
    return jsonRpcResponse(replies);
  }

  const reply = handleRpc(body, ctx);
  if (reply === null) return cors(new Response(null, { status: 202 }));
  if (wantsSse(req)) return sseReply([reply]);
  return jsonRpcResponse(reply);
}

/** One SSE `message` event per reply, then the stream closes. */
function sseReply(replies: readonly unknown[]): Response {
  const text = replies.map((reply, i) => sseEvent(reply, String(i + 1))).join('');
  return cors(new Response(text, { status: 200, headers: sseHeaders() }));
}

export { INVALID_PARAMS, METHOD_NOT_FOUND, PARSE_ERROR, INVALID_REQUEST, INTERNAL_ERROR };

/** Exported for tests and for the docs page, which lists the tools it serves. */
export const TOOL_NAMES: string[] = TOOLS.map((t) => t.name);

/** Exported so the JSON type alias is used and the module has no dead code. */
export type McpJsonValue = JsonValue;
