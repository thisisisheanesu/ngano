/**
 * The OpenAPI 3.1 description of the ngano API.
 *
 * It is written by hand against the same constants the API uses, so the parameter
 * lists, the enum values and the field names cannot drift away from the code: the
 * projection enum, the sort enum and the page limits all come from `api.ts`, and the
 * facet values come from the live catalogue.
 */

import { DATASET_FIELDS, DEFAULT_PER_PAGE, MAX_PER_PAGE, SORT_KEYS } from './fields.js';
import { datasets, languages, snippets, stats, VERSION } from './data.js';

type Schema = Record<string, unknown>;

function distinct(pick: (index: number) => readonly string[]): string[] {
  const seen = new Set<string>();
  for (let i = 0; i < datasets.length; i++) {
    for (const value of pick(i)) if (value) seen.add(value);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

const TASKS = distinct((i) => [datasets[i]?.task ?? '']);
const VARIETIES = distinct((i) => [datasets[i]?.variety ?? '']);
const COMMERCIAL = distinct((i) => [datasets[i]?.commercial ?? '']);
const ACCESS = distinct((i) => [datasets[i]?.access ?? '']);
const LABELLED = distinct((i) => [datasets[i]?.labelled ?? '']);
const QUALITY = distinct((i) => [datasets[i]?.quality ?? '']);
const LICENCE_CLASS = distinct((i) => [datasets[i]?.licence_class ?? '']);
const REGIONS = distinct((i) => datasets[i]?.regions ?? []);

const nullableString: Schema = { type: ['string', 'null'] };
const stringArray: Schema = { type: 'array', items: { type: 'string' } };

/**
 * The one description of the tag format, quoted everywhere a tag appears so the
 * document cannot say two different things about it.
 */
const TAG_FORMAT = [
  'BCP 47 language tags. The primary subtag is always a lowercase ISO 639-3 three-letter code.',
  'An optional uppercase ISO 3166-1 alpha-2 region subtag marks a country-specific variety,',
  'so Nigerian English is eng-NG, Mozambican Portuguese is por-MZ and Shona at large is sna.',
  'A bare code never stands for one of its regional varieties: eng does not match eng-NG unless',
  'include_varieties is set.',
].join(' ');

const LANGUAGE_INPUT = [
  'An ISO 639-3 code (sna), a full BCP 47 tag (eng-NG), or any name the catalogue knows for that tag,',
  'for example Shona or Nigerian English. All three resolve to the same canonical tag. Tags are matched',
  'case insensitively, so SNA and eng-ng work. A tag always wins over a name where the two spellings collide.',
].join(' ');

const datasetSchema: Schema = {
  type: 'object',
  title: 'Dataset',
  description: 'One catalogue record. Figures are as published by the source, not measured by ngano.',
  required: [...DATASET_FIELDS].filter((f) => f !== 'language_note'),
  additionalProperties: false,
  properties: {
    id: { type: 'string', description: 'Stable slug identifying the record.' },
    name: { type: 'string' },
    task: { type: 'string', enum: TASKS },
    variety: { type: 'string', enum: VARIETIES },
    languages: { ...stringArray, description: 'Language names exactly as the source states them, kept for provenance.' },
    languages_clean: { ...stringArray, description: 'Canonical display names, one per entry of language_tags.' },
    language_tags: {
      ...stringArray,
      description: TAG_FORMAT,
      items: { type: 'string', pattern: '^[a-z]{3}(-[A-Z]{2}|-[0-9]{3})?$' },
    },
    language_codes: {
      ...stringArray,
      description:
        'The bare ISO 639-3 codes behind language_tags, deduplicated and in the same order. Every eng-* variety collapses to eng here.',
      items: { type: 'string', pattern: '^[a-z]{3}$' },
    },
    language_note: {
      type: 'string',
      description:
        'Present only on records whose source describes its coverage in prose, for example "~340 African languages", rather than naming individual languages. Such a record carries no language_tags.',
    },
    iso: { ...stringArray, description: 'Legacy ISO 639-3 codes as first catalogued. Prefer language_codes.' },
    countries: stringArray,
    country_codes: { ...stringArray, description: 'ISO 3166-1 alpha-2 codes.' },
    regions: { ...stringArray, description: 'African sub-regions.' },
    hours: { ...nullableString, description: 'Hours exactly as published, as a string.' },
    hours_num: { type: ['number', 'null'], description: 'Hours parsed to a number, or null when unstated.' },
    speakers: nullableString,
    recording_type: nullableString,
    quality: { type: 'string', enum: QUALITY },
    labelled: { type: 'string', enum: LABELLED },
    domain: { type: 'string' },
    licence: { type: 'string' },
    licence_class: { type: 'string', enum: LICENCE_CLASS },
    commercial: { type: 'string', enum: COMMERCIAL },
    access: { type: 'string', enum: ACCESS },
    host: { type: 'string' },
    url: nullableString,
    hf_repo: { ...nullableString, description: 'Hugging Face repository id, when the data is hosted there.' },
    year: nullableString,
    notes: nullableString,
    unverified_size: {
      type: 'boolean',
      description:
        'True for self-reported figures of 20000 hours or more. Such a record contributes zero hours to every total in this API.',
    },
  },
};

const countrySchema: Schema = {
  type: 'object',
  title: 'Country',
  required: ['name', 'iso2', 'iso3', 'map_name', 'lat', 'lon', 'region', 'slug', 'datasets', 'hours', 'languages', 'language_tags', 'open', 'commercial_ok'],
  properties: {
    name: { type: 'string' },
    iso2: { type: 'string', minLength: 2, maxLength: 2 },
    iso3: { type: 'string', minLength: 3, maxLength: 3 },
    map_name: { ...nullableString, description: 'Key into africa.geo.json, or null for island states with no polygon.' },
    lat: { type: 'number' },
    lon: { type: 'number' },
    region: { type: 'string', enum: REGIONS },
    slug: { type: 'string' },
    datasets: { type: 'integer', description: 'Number of catalogue records covering this country.' },
    hours: { type: 'number', description: 'Hours apportioned evenly across the countries of each record, unverified records excluded.' },
    languages: { ...stringArray, description: 'Canonical display names of the languages attested by those records.' },
    language_tags: { ...stringArray, description: `The same languages as tags, index aligned with languages. ${TAG_FORMAT}` },
    open: { type: 'integer', description: 'Records with access = Open.' },
    commercial_ok: { type: 'integer', description: 'Records whose licence permits commercial use, possibly after purchase.' },
  },
};

const countryDetailSchema: Schema = {
  allOf: [
    { $ref: '#/components/schemas/Country' },
    {
      type: 'object',
      required: ['datasets_list', 'languages_list'],
      properties: {
        datasets_list: { type: 'array', items: { $ref: '#/components/schemas/Dataset' } },
        languages_list: { type: 'array', items: { $ref: '#/components/schemas/Language' } },
      },
    },
  ],
};

const languageSchema: Schema = {
  type: 'object',
  title: 'Language',
  description: `One ISO 639-3 registry entry with its catalogue aggregates. ${TAG_FORMAT}`,
  required: ['tag', 'iso639_3', 'region', 'name', 'scope', 'type', 'aliases', 'slug', 'datasets', 'countries', 'country_codes', 'tasks', 'hours'],
  properties: {
    tag: { type: 'string', pattern: '^[a-z]{3}(-[A-Z]{2}|-[0-9]{3})?$', description: `The canonical key. ${TAG_FORMAT}` },
    iso639_3: { type: 'string', pattern: '^[a-z]{3}$', description: 'The primary subtag alone. Several tags can share one code.' },
    region: { ...nullableString, description: 'ISO 3166-1 alpha-2 region, or null when the tag names the language at large.' },
    name: { type: 'string', description: 'Canonical display name, for example "English (Nigeria)".' },
    scope: { type: 'string', description: 'ISO 639-3 scope: I individual, M macrolanguage, S special.' },
    type: { type: 'string', description: 'ISO 639-3 type: L living, E extinct, H historical, A ancient, C constructed, S special.' },
    aliases: { ...stringArray, description: 'Every catalogue spelling that resolves to this tag. Any of them is accepted wherever a language is asked for.' },
    slug: { type: 'string', description: 'The tag lowercased, which is the URL form: sna, swh, eng-ng.' },
    datasets: { type: 'integer' },
    countries: stringArray,
    country_codes: { ...stringArray, description: 'ISO 3166-1 alpha-2 codes for those countries.' },
    tasks: { ...stringArray, description: 'Catalogue tasks attested for this tag.' },
    hours: { type: 'number', description: 'Hours apportioned evenly across each record language_tags, unverified records excluded.' },
  },
};

const languageDetailSchema: Schema = {
  allOf: [
    { $ref: '#/components/schemas/Language' },
    {
      type: 'object',
      required: ['datasets_list', 'requested', 'resolved'],
      properties: {
        requested: { type: 'string', description: 'The path segment as the caller wrote it.' },
        resolved: { type: 'boolean', description: 'True when the caller used an alias or a different case rather than the canonical tag.' },
        datasets_list: { type: 'array', items: { $ref: '#/components/schemas/Dataset' } },
      },
    },
  ],
};

const languageAliasesSchema: Schema = {
  type: 'object',
  title: 'LanguageAliases',
  required: ['tag', 'iso639_3', 'region', 'name', 'aliases', 'resolution'],
  properties: {
    tag: { type: 'string' },
    iso639_3: { type: 'string' },
    region: nullableString,
    name: { type: 'string' },
    aliases: { ...stringArray, description: 'Every spelling that resolves to this tag.' },
    resolution: { type: 'string', description: 'How the tag was arrived at, for example iso-registry, curated or group.' },
  },
};

const facetSchema: Schema = {
  type: 'object',
  title: 'FacetCount',
  required: ['value', 'datasets', 'hours'],
  properties: {
    value: { type: 'string' },
    datasets: { type: 'integer' },
    hours: { type: 'number' },
  },
};

const facetArray: Schema = { type: 'array', items: { $ref: '#/components/schemas/FacetCount' } };

const statsSchema: Schema = {
  type: 'object',
  title: 'Stats',
  required: [
    'datasets',
    'languages',
    'language_codes',
    'countries',
    'hours',
    'hours_open',
    'hours_commercial',
    'unverified_excluded',
    'by_task',
    'by_commercial',
    'by_licence_class',
    'by_access',
    'by_labelled',
    'by_quality',
    'by_variety',
    'by_domain',
    'by_region',
  ],
  properties: {
    datasets: { type: 'integer' },
    languages: { type: 'integer', description: 'Distinct BCP 47 language tags, so a regional variety counts on its own.' },
    language_codes: { type: 'integer', description: 'Distinct ISO 639-3 codes, so every regional variety collapses into its code.' },
    countries: { type: 'integer' },
    hours: { type: 'number', description: 'Total published hours, excluding every unverified record.' },
    hours_open: { type: 'number', description: 'Of those, hours whose access is Open.' },
    hours_commercial: { type: 'number', description: 'Of those, hours whose licence permits commercial use, possibly after purchase.' },
    unverified_excluded: { type: 'integer', description: 'How many records were excluded from the hour totals.' },
    by_task: facetArray,
    by_commercial: facetArray,
    by_licence_class: facetArray,
    by_access: facetArray,
    by_labelled: facetArray,
    by_quality: facetArray,
    by_variety: facetArray,
    by_domain: facetArray,
    by_region: facetArray,
  },
};

const SNIPPET_KEYS = [
  'catalogue_filter',
  'stream_filter',
  'single_dataset',
  'language_page',
  'country_page',
  'dataset_page',
  'cli',
] as const;

const snippetSetSchema: Schema = {
  type: 'object',
  title: 'SnippetSet',
  required: ['version', 'placeholders', 'languages'],
  properties: {
    version: { type: 'integer' },
    placeholders: { ...stringArray, description: 'Every token a snippet may contain, for example {{LANGUAGE}}.' },
    languages: {
      type: 'object',
      description: 'One entry per SDK, keyed by python, javascript or rust.',
      additionalProperties: {
        type: 'object',
        required: ['language', 'install', 'package', 'shell_snippets', 'snippets'],
        properties: {
          language: { type: 'string' },
          install: { type: 'string' },
          install_audio: { ...nullableString, description: 'Install line for optional audio decoding, or null.' },
          package: { type: 'string' },
          shell_snippets: { ...stringArray, description: 'Keys whose body is a shell session rather than source.' },
          snippets: {
            type: 'object',
            description: `Snippet source keyed by one of: ${SNIPPET_KEYS.join(', ')}.`,
            additionalProperties: { type: 'string' },
          },
        },
      },
    },
  },
};

const errorSchema: Schema = {
  type: 'object',
  title: 'Error',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message', 'status'],
      properties: {
        code: { type: 'string', enum: ['invalid_parameter', 'not_found', 'method_not_allowed', 'internal_error'] },
        message: { type: 'string' },
        status: { type: 'integer' },
      },
    },
  },
};

function queryParam(name: string, schema: Schema, description: string, explode = true): Schema {
  return { name, in: 'query', required: false, description, schema, explode, style: 'form' };
}

function repeatable(name: string, description: string, values?: readonly string[]): Schema {
  const item: Schema = values ? { type: 'string', enum: [...values] } : { type: 'string' };
  return queryParam(
    name,
    { type: 'array', items: item },
    `${description} Repeatable, and a comma-separated list is accepted too. Values are OR-ed within the parameter and AND-ed with the other filters. Matching is case insensitive.`,
  );
}

const boolSchema: Schema = { type: 'boolean' };

const datasetParams: Schema[] = [
  queryParam('q', { type: 'string' }, 'Free text search over name, id, languages, language tags, countries, host, licence and notes. Every whitespace-separated term must match.'),
  repeatable('language', `Language to filter on. ${LANGUAGE_INPUT}`),
  repeatable('iso', `ISO 639-3 code. An alias of the code form of "language": the two are merged and OR-ed together. ${TAG_FORMAT}`),
  queryParam(
    'include_varieties',
    boolSchema,
    'Widen a bare ISO 639-3 code to every regional variety of it, so language=eng also matches eng-NG and eng-ZA. Default false, which keeps a bare code meaning the language at large.',
  ),
  repeatable('country', 'ISO 3166-1 alpha-2 country code.'),
  repeatable('region', 'African sub-region.', REGIONS),
  repeatable('task', 'Dataset task.', TASKS),
  repeatable('variety', 'Language variety.', VARIETIES),
  repeatable('commercial', 'Commercial use as stated by the licence.', COMMERCIAL),
  repeatable('licence_class', 'Licence family.', LICENCE_CLASS),
  repeatable('access', 'How the data can be obtained.', ACCESS),
  repeatable('labelled', 'Whether the audio carries transcripts.', LABELLED),
  repeatable('quality', 'Recording quality band.', QUALITY),
  repeatable('domain', 'Speech domain, for example Read speech or Broadcast.'),
  repeatable('host', 'Where the data lives, for example HuggingFace.'),
  queryParam('hf_only', boolSchema, 'Keep only records with a Hugging Face repository.'),
  queryParam('has_hours', boolSchema, 'Keep only records that state a size in hours.'),
  queryParam('min_hours', { type: 'number', minimum: 0 }, 'Minimum countable hours. Unverified records count as zero, so they never satisfy a positive minimum.'),
  queryParam('max_hours', { type: 'number', minimum: 0 }, 'Maximum countable hours.'),
  queryParam(
    'sort',
    { type: 'string', enum: [...SORT_KEYS, ...SORT_KEYS.map((k) => `-${k}`)] },
    'Sort key. Prefix with "-" for descending. Records with no value sort last either way. Default is -hours.',
  ),
  queryParam('page', { type: 'integer', minimum: 1, default: 1 }, 'One-based page number.'),
  queryParam(
    'per_page',
    { type: 'integer', minimum: 1, maximum: MAX_PER_PAGE, default: DEFAULT_PER_PAGE },
    `Page size. Maximum ${MAX_PER_PAGE}.`,
  ),
  repeatable('fields', `Projection. Only the named fields are returned, and id is always included. One of: ${DATASET_FIELDS.join(', ')}.`, DATASET_FIELDS),
];

function jsonResponse(description: string, schema: Schema): Schema {
  return { description, content: { 'application/json': { schema } } };
}

const errorResponse = (description: string): Schema => jsonResponse(description, { $ref: '#/components/schemas/Error' });

/** Build the document. The base URL comes from the request so local runs are usable. */
export function buildOpenApi(baseUrl: string): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'ngano API',
      version: VERSION,
      summary: 'Open catalogue of African-language speech datasets.',
      description: [
        'ngano is an open catalogue of speech datasets for African languages. Every endpoint is public,',
        'unauthenticated and CORS open, and every response is cacheable for five minutes at the client and',
        'an hour at the edge.',
        '',
        `The catalogue currently holds ${stats.datasets} records across ${stats.languages} language tags`,
        `(${stats.language_codes} distinct ISO 639-3 codes) and ${stats.countries} countries.`,
        '',
        `Languages are keyed on BCP 47 tags. ${TAG_FORMAT}`,
        'Wherever a language is accepted you may give a code, a tag, or any name the catalogue knows for it.',
        '',
        'Hour figures are as published by each source. Records flagged',
        '`unverified_size` (self-reported figures of 20000 hours or more) are listed in full but contribute',
        'zero hours to every total in this API, including `meta.total_hours`.',
      ].join('\n'),
      license: { name: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
      contact: { name: 'ngano', url: baseUrl },
    },
    servers: [{ url: `${baseUrl}/api/v1`, description: 'ngano API v1' }],
    externalDocs: { description: 'Documentation and MCP endpoint', url: `${baseUrl}/docs` },
    tags: [
      { name: 'datasets', description: 'Catalogue records.' },
      { name: 'countries', description: 'Per-country aggregates.' },
      { name: 'languages', description: 'Per-tag aggregates, keyed on ISO 639-3 based BCP 47 tags.' },
      { name: 'meta', description: 'Statistics, schema and service health.' },
    ],
    paths: {
      '/datasets': {
        get: {
          operationId: 'listDatasets',
          tags: ['datasets'],
          summary: 'Search and page through the catalogue.',
          parameters: datasetParams,
          responses: {
            '200': jsonResponse('A page of catalogue records.', {
              type: 'object',
              required: ['data', 'meta'],
              properties: {
                data: { type: 'array', items: { $ref: '#/components/schemas/Dataset' } },
                meta: {
                  type: 'object',
                  required: ['page', 'per_page', 'total', 'total_pages', 'total_hours'],
                  properties: {
                    page: { type: 'integer' },
                    per_page: { type: 'integer' },
                    total: { type: 'integer', description: 'Records matching the filter, not just this page.' },
                    total_pages: { type: 'integer', description: 'At least 1, even when nothing matches.' },
                    total_hours: { type: 'number', description: 'Countable hours across the whole filtered set.' },
                    language_tags: { ...stringArray, description: 'The canonical tags the language and iso filters resolved to. Absent when neither was given.' },
                    language_unresolved: { ...stringArray, description: 'Language values that matched no tag. Absent when everything resolved.' },
                  },
                },
              },
            }),
            '400': errorResponse('A parameter was not understood.'),
          },
        },
      },
      '/datasets/{id}': {
        get: {
          operationId: 'getDataset',
          tags: ['datasets'],
          summary: 'One catalogue record by id.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Catalogue id.' }],
          responses: {
            '200': jsonResponse('The record.', { $ref: '#/components/schemas/Dataset' }),
            '404': errorResponse('No record with that id.'),
          },
        },
      },
      '/countries': {
        get: {
          operationId: 'listCountries',
          tags: ['countries'],
          summary: 'Every country with its aggregates.',
          parameters: [
            queryParam('q', { type: 'string' }, 'Match on country name, alpha-2 or alpha-3 code.'),
            repeatable('region', 'African sub-region.', REGIONS),
          ],
          responses: { '200': jsonResponse('All countries.', { type: 'array', items: { $ref: '#/components/schemas/Country' } }) },
        },
      },
      '/countries/{iso2}': {
        get: {
          operationId: 'getCountry',
          tags: ['countries'],
          summary: 'One country, its datasets and its languages.',
          parameters: [
            { name: 'iso2', in: 'path', required: true, schema: { type: 'string', minLength: 2, maxLength: 2 }, description: 'ISO 3166-1 alpha-2 code, case insensitive.' },
          ],
          responses: {
            '200': jsonResponse('The country.', { $ref: '#/components/schemas/CountryDetail' }),
            '404': errorResponse('No country with that code.'),
          },
        },
      },
      '/languages': {
        get: {
          operationId: 'listLanguages',
          tags: ['languages'],
          summary: 'Every language tag with its aggregates.',
          description: `${languages.length} entries, keyed on tag. ${TAG_FORMAT}`,
          parameters: [
            queryParam('q', { type: 'string' }, 'Substring match on the tag, the canonical name or any alias.'),
            repeatable('iso', 'ISO 639-3 code. Keeps every tag built on that code, varieties included.'),
            repeatable('region', 'ISO 3166-1 alpha-2 region subtag. Keeps only country-specific varieties of that region.'),
          ],
          responses: { '200': jsonResponse('All languages.', { type: 'array', items: { $ref: '#/components/schemas/Language' } }) },
        },
      },
      '/languages/{slug}': {
        get: {
          operationId: 'getLanguage',
          tags: ['languages'],
          summary: 'One language and its datasets.',
          description: `The response always carries the canonical tag, whichever spelling was asked for. ${LANGUAGE_INPUT}`,
          parameters: [
            {
              name: 'slug',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: `The tag lowercased, for example sna or eng-ng. ${LANGUAGE_INPUT}`,
            },
          ],
          responses: {
            '200': jsonResponse('The language.', { $ref: '#/components/schemas/LanguageDetail' }),
            '404': errorResponse('Nothing resolves to a tag.'),
          },
        },
      },
      '/languages/{slug}/aliases': {
        get: {
          operationId: 'getLanguageAliases',
          tags: ['languages'],
          summary: 'Every spelling that resolves to one tag.',
          description:
            'The same aliases the language object already carries, on their own for a caller that only needs the mapping. Accepts the same spellings as /languages/{slug}.',
          parameters: [
            { name: 'slug', in: 'path', required: true, schema: { type: 'string' }, description: 'The tag lowercased, a bare ISO 639-3 code, or any known name.' },
          ],
          responses: {
            '200': jsonResponse('The aliases.', { $ref: '#/components/schemas/LanguageAliases' }),
            '404': errorResponse('Nothing resolves to a tag.'),
          },
        },
      },
      '/stats': {
        get: {
          operationId: 'getStats',
          tags: ['meta'],
          summary: 'Global totals and per-facet aggregates.',
          responses: { '200': jsonResponse('Catalogue statistics.', { $ref: '#/components/schemas/Stats' }) },
        },
      },
      '/schema': {
        get: {
          operationId: 'getSchema',
          tags: ['meta'],
          summary: 'The canonical audio-row schema shared by all three SDKs.',
          description: 'The contents of field_map.json: the canonical row, the column aliases, unit hints, dropped columns and per-repo overrides.',
          responses: { '200': jsonResponse('The field map.', { type: 'object' }) },
        },
      },
      '/snippets': {
        get: {
          operationId: 'getSnippets',
          tags: ['meta'],
          summary: 'Compile-checked example code for the three ngano SDKs.',
          description: [
            'The contents of data/snippets.json. Each SDK package generates its own snippets and has a test',
            'that compiles or typechecks them, so everything served here is known to run.',
            '',
            `Snippet keys: ${SNIPPET_KEYS.join(', ')}. Placeholder tokens to substitute before showing a snippet:`,
            `${(snippets.placeholders ?? []).join(', ')}. A snippet key listed in shell_snippets is a shell session`,
            'rather than source in that language.',
            '',
            'The three SDKs share filter names, with two exceptions in Rust: the filter method is `access_mode`',
            'rather than `access`, because `access` collides, and `Loader::repo("owner/name")` loads a Hugging',
            'Face repo that the catalogue does not list. Python and JavaScript use `access`.',
          ].join('\n'),
          responses: { '200': jsonResponse('The snippet file.', { $ref: '#/components/schemas/SnippetSet' }) },
        },
      },
      '/openapi.json': {
        get: {
          operationId: 'getOpenApi',
          tags: ['meta'],
          summary: 'This document.',
          responses: { '200': jsonResponse('An OpenAPI 3.1 document.', { type: 'object' }) },
        },
      },
      '/healthz': {
        get: {
          operationId: 'getHealth',
          tags: ['meta'],
          summary: 'Liveness probe.',
          responses: {
            '200': jsonResponse('The service is up.', {
              type: 'object',
              required: ['ok', 'version', 'datasets'],
              properties: { ok: { type: 'boolean' }, version: { type: 'string' }, datasets: { type: 'integer' } },
            }),
          },
        },
      },
    },
    components: {
      schemas: {
        Dataset: datasetSchema,
        Country: countrySchema,
        CountryDetail: countryDetailSchema,
        Language: languageSchema,
        LanguageDetail: languageDetailSchema,
        LanguageAliases: languageAliasesSchema,
        FacetCount: facetSchema,
        SnippetSet: snippetSetSchema,
        Stats: statsSchema,
        Error: errorSchema,
      },
    },
  };
}
