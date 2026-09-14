/**
 * Constants shared by the API, the OpenAPI document and the MCP tools.
 *
 * They live in their own module so `openapi.ts` can describe the API without
 * importing it, which would otherwise be a cycle.
 */

/** Fields a caller may name in `fields=`. Exactly the keys of a catalogue record. */
export const DATASET_FIELDS = [
  'id',
  'name',
  'task',
  'variety',
  'languages',
  'languages_clean',
  'language_tags',
  'language_codes',
  'language_note',
  'iso',
  'countries',
  'country_codes',
  'regions',
  'hours',
  'hours_num',
  'speakers',
  'recording_type',
  'quality',
  'labelled',
  'domain',
  'licence',
  'licence_class',
  'commercial',
  'access',
  'host',
  'url',
  'hf_repo',
  'year',
  'notes',
  'unverified_size',
] as const;

export type DatasetField = (typeof DATASET_FIELDS)[number];

export const SORT_KEYS = ['hours', 'name', 'year'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const DEFAULT_PER_PAGE = 50;
export const MAX_PER_PAGE = 200;
