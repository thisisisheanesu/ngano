/**
 * Column mapping: turns a heterogeneous Hugging Face row into ngano's unified
 * {@link Row}.
 *
 * The order is fixed and identical in the Python and Rust SDKs:
 *
 * 1. `overrides[hf_repo]` from `field_map.json`
 * 2. runtime inspection of the dataset's real columns against `aliases`,
 *    case-insensitively and ignoring underscores and hyphens
 * 3. `unit_hints` conversions, for example `duration_ms` becomes `duration_s`
 * 4. anything unmapped is preserved under `extra`
 * 5. columns listed in `drop` are discarded
 *
 * Claiming is table-driven only. Feature types reported by the datasets server
 * may confirm that the column the table claimed as `audio` really is an Audio
 * feature, but they never claim a column the table did not, so all three ngano
 * SDKs produce identical mappings from the same column list.
 *
 * An unknown schema degrades to "everything in `extra`". Nothing here throws.
 *
 * @packageDocumentation
 */
import type { AudioHandle, FetchLike, FieldMap, Row } from "./types.js";

/** Canonical fields the mapper fills, in the order they are resolved. */
export const CANONICAL_FIELDS = [
  "audio",
  "transcript",
  "language",
  "language_iso",
  "language_tag",
  "country",
  "speaker_id",
  "gender",
  "age",
  "duration_s",
  "sampling_rate",
  "domain",
  "split",
] as const;

/** One of the canonical field names the mapper fills. */
export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

/** The result of resolving one dataset's columns against the field map. */
export interface ColumnMapping {
  /** Hugging Face repo the mapping was built for. */
  repo: string;
  /** Canonical field to source column name. */
  fields: Partial<Record<CanonicalField, string>>;
  /** Canonical field to unit multiplier, from `unit_hints`. */
  scale: Partial<Record<CanonicalField, number>>;
  /** Source columns discarded because they appear in `drop`. */
  dropped: string[];
  /** Source columns kept verbatim on {@link Row.extra}. */
  extra: string[];
  /** True when the repo has a hand-checked override in `field_map.json`. */
  verified: boolean;
  /**
   * Whether the datasets server confirms the claimed audio column really is an
   * Audio feature. `null` when no feature types were available or no audio
   * column was claimed. Confirmation never changes the mapping.
   */
  audioConfirmed: boolean | null;
}

/**
 * Normalises a column name for matching: lower case, no underscores, hyphens
 * or spaces.
 *
 * @param name column name as the source spells it
 * @returns the comparison key
 */
export function normaliseColumn(name: string): string {
  return name.toLowerCase().replace(/[\s_\-.]/g, "");
}

/** A column descriptor as the datasets server reports it. */
export interface DatasetFeature {
  /** Column name. */
  name: string;
  /** Hugging Face feature descriptor, for example `{ _type: "Audio" }`. */
  type?: unknown;
}

/**
 * Detects a Hugging Face `Audio` feature, including inside `Sequence` and list
 * wrappers.
 *
 * @param type a feature descriptor
 * @returns true when the column holds audio
 */
export function isAudioFeature(type: unknown): boolean {
  if (Array.isArray(type)) return type.some(isAudioFeature);
  if (!type || typeof type !== "object") return false;
  const node = type as Record<string, unknown>;
  if (node["_type"] === "Audio") return true;
  if ("feature" in node) return isAudioFeature(node["feature"]);
  return false;
}

/**
 * Resolves a dataset's real columns against the field map.
 *
 * @param columns column names as returned by `/first-rows`, `/rows` or `/info`
 * @param repo Hugging Face repo id, used to look up overrides
 * @param fieldMap the field map document, normally the bundled one
 * @param features optional feature descriptors from the datasets server, used
 *   only to confirm the claimed audio column, never to claim a new one
 * @returns the resolved mapping, never throwing on unknown schemas
 */
export function buildMapping(
  columns: string[],
  repo: string,
  fieldMap: FieldMap,
  features?: ReadonlyArray<DatasetFeature>,
): ColumnMapping {
  const mapping: ColumnMapping = {
    repo,
    fields: {},
    scale: {},
    dropped: [],
    extra: [],
    verified: false,
    audioConfirmed: null,
  };

  /** normalised name to the first source column that carries it */
  const byNorm = new Map<string, string>();
  for (const column of columns) {
    const key = normaliseColumn(column);
    if (!byNorm.has(key)) byNorm.set(key, column);
  }

  const dropped = new Set((fieldMap.drop ?? []).map(normaliseColumn));
  const taken = new Set<string>();

  /**
   * Claims the first free column matching any of the candidate names.
   *
   * @param candidates candidate column names, in priority order
   * @param allowDropped whether columns on the drop list may be claimed
   * @returns the claimed source column, or undefined
   */
  const claim = (candidates: string[], allowDropped: boolean): string | undefined => {
    for (const candidate of candidates) {
      const key = normaliseColumn(candidate);
      const column = byNorm.get(key);
      if (column === undefined || taken.has(column)) continue;
      if (!allowDropped && dropped.has(key)) continue;
      taken.add(column);
      return column;
    }
    return undefined;
  };

  const isCanonical = (name: string): name is CanonicalField =>
    (CANONICAL_FIELDS as readonly string[]).includes(name);

  // Step 1: per-repo overrides. An override wins over everything, including the
  // drop list, but is ignored when the column it names is absent so that a
  // renamed or re-versioned dataset still loads.
  const override = fieldMap.overrides?.[repo];
  if (override) {
    for (const [field, source] of Object.entries(override)) {
      if (field === "verified") {
        mapping.verified = source === true;
        continue;
      }
      if (typeof source !== "string" || !isCanonical(field)) continue;
      if (columns.length === 0) {
        // Columns unknown, trust the hand-checked override verbatim.
        mapping.fields[field] = source;
        continue;
      }
      const column = claim([source], true);
      if (column !== undefined) mapping.fields[field] = column;
    }
  }

  // Step 2: alias matching against the real columns.
  for (const field of CANONICAL_FIELDS) {
    if (mapping.fields[field] !== undefined) continue;
    const candidates = fieldMap.aliases?.[field] ?? [];
    const column = claim([...candidates, field], false);
    if (column !== undefined) mapping.fields[field] = column;
  }

  // Step 3: unit hints, for columns that carry the right quantity in the wrong
  // unit. Only used when the canonical field is still unfilled.
  for (const [hint, spec] of Object.entries(fieldMap.unit_hints ?? {})) {
    const target = spec?.canonical;
    if (!target || !isCanonical(target)) continue;
    if (mapping.fields[target] !== undefined) continue;
    const candidates = [...(fieldMap.aliases?.[hint] ?? []), hint];
    const column = claim(candidates, false);
    if (column === undefined) continue;
    mapping.fields[target] = column;
    mapping.scale[target] = spec.multiply;
  }

  // Steps 4 and 5: keep what is left, minus the drop list.
  for (const column of columns) {
    if (taken.has(column)) continue;
    if (dropped.has(normaliseColumn(column))) mapping.dropped.push(column);
    else mapping.extra.push(column);
  }

  // Feature types confirm, they never claim. Claiming is table-driven only, so
  // that the Python, JavaScript and Rust SDKs produce identical mappings. All
  // this records is whether the column the table chose really is an Audio
  // feature, which callers can read but which changes no mapping.
  if (features && mapping.fields.audio !== undefined) {
    const claimed = mapping.fields.audio;
    const feature = features.find((entry) => entry.name === claimed);
    mapping.audioConfirmed = feature ? isAudioFeature(feature.type) : null;
  }

  return mapping;
}

/**
 * Coerces a raw cell to a string, treating empty and structured values as null.
 *
 * @param value raw cell value
 * @returns a non-empty string, or null
 */
export function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.length > 0 ? value : null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return String(value);
  return null;
}

/**
 * Coerces a raw cell to a finite number, parsing numeric strings.
 *
 * @param value raw cell value
 * @returns a finite number, or null
 */
export function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Decodes base64 in any runtime, preferring `Buffer` where it exists.
 *
 * @param input base64 text
 * @returns the decoded bytes
 */
export function decodeBase64(input: string): Uint8Array {
  const globalBuffer = (globalThis as { Buffer?: { from(s: string, e: string): Uint8Array } }).Buffer;
  if (globalBuffer) return new Uint8Array(globalBuffer.from(input, "base64"));
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The shapes an audio cell arrives in, before a handle is built. */
interface AudioParts {
  url: string | null;
  path: string | null;
  samplingRate: number | null;
  contentType: string | null;
  bytes: Uint8Array | null;
}

const DATASETS_SERVER = "https://datasets-server.huggingface.co";

/**
 * Reads whatever the datasets server put in an audio cell. It may be a list of
 * `{src, type}` entries, a `{path, bytes, sampling_rate}` object, or a bare
 * path string.
 *
 * @param value raw cell value
 * @returns the parts of an audio handle, all nullable
 */
export function parseAudioCell(value: unknown): AudioParts {
  const parts: AudioParts = {
    url: null,
    path: null,
    samplingRate: null,
    contentType: null,
    bytes: null,
  };
  if (value === null || value === undefined) return parts;

  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) parts.url = value;
    else if (value.startsWith("/")) parts.url = `${DATASETS_SERVER}${value}`;
    else parts.path = value;
    return parts;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const item = parseAudioCell(entry);
      parts.url ??= item.url;
      parts.path ??= item.path;
      parts.samplingRate ??= item.samplingRate;
      parts.contentType ??= item.contentType;
      parts.bytes ??= item.bytes;
    }
    return parts;
  }

  if (typeof value === "object") {
    const cell = value as Record<string, unknown>;
    const src = asString(cell["src"] ?? cell["url"]);
    if (src) {
      if (/^https?:\/\//i.test(src)) parts.url = src;
      else if (src.startsWith("/")) parts.url = `${DATASETS_SERVER}${src}`;
      else parts.path = src;
    }
    parts.path ??= asString(cell["path"] ?? cell["filename"] ?? cell["file"]);
    parts.contentType = asString(cell["type"] ?? cell["mime_type"]);
    parts.samplingRate = asNumber(cell["sampling_rate"] ?? cell["samplingRate"] ?? cell["sr"]);
    const bytes = cell["bytes"];
    if (typeof bytes === "string" && bytes.length > 0) {
      try {
        parts.bytes = decodeBase64(bytes);
      } catch {
        parts.bytes = null;
      }
    } else if (bytes instanceof Uint8Array) {
      parts.bytes = bytes;
    } else if (Array.isArray(bytes)) {
      parts.bytes = Uint8Array.from(bytes as number[]);
    }
  }

  return parts;
}

/**
 * The bare ISO 639-3 code of a BCP 47 tag, which is its primary subtag.
 *
 * @param tag a tag such as `sna` or `eng-NG`
 * @returns the three-letter code
 */
function primarySubtag(tag: string): string {
  const dash = tag.indexOf("-");
  return (dash === -1 ? tag : tag.slice(0, dash)).toLowerCase();
}

/** Everything the mapper needs that does not come from the row itself. */
export interface RowContext {
  /** Hugging Face repo id. */
  hfRepo: string;
  /** Split name the row came from. */
  split: string;
  /** ngano catalogue id, when the repo is catalogued. */
  datasetId: string | null;
  /** Licence string from the catalogue. */
  licence: string | null;
  /** Canonical dataset URL. */
  sourceUrl: string | null;
  /** Country fallback, ISO 3166-1 alpha-2, used when the row has none. */
  country: string | null;
  /** Language name fallback, used when the row states none. */
  language: string | null;
  /** BCP 47 tag fallback from the catalogue record, used when the row resolves to none. */
  languageTag: string | null;
  /** Bare ISO 639-3 fallback from the catalogue record, used when the row states none. */
  languageIso: string | null;
  /** `fetch` used for lazy audio reads. */
  fetchImpl: FetchLike;
  /** Headers sent with lazy audio reads, for example an HF bearer token. */
  headers: Record<string, string>;
  /** Resolves a country name or code to ISO 3166-1 alpha-2. */
  resolveCountry?: (value: string) => string | null;
  /**
   * Resolves a language tag, code or name to one canonical BCP 47 tag, or null
   * when it resolves to nothing or to more than one tag.
   */
  resolveLanguageTag?: (value: string) => string | null;
}

/**
 * Builds the lazy audio handle. No request is made here.
 *
 * @param parts parsed audio cell
 * @param context row context carrying `fetch` and auth headers
 * @returns a handle, or null when there is nothing to point at
 */
function makeAudioHandle(parts: AudioParts, context: RowContext): AudioHandle | null {
  if (!parts.url && !parts.path && !parts.bytes) return null;
  let cached: Uint8Array | null = parts.bytes;

  const handle: AudioHandle = {
    url: parts.url,
    path: parts.path,
    samplingRate: parts.samplingRate,
    contentType: parts.contentType,
    bytes: parts.bytes,
    async read(options): Promise<Uint8Array> {
      if (cached) return cached;
      if (!parts.url) {
        throw new Error(
          `No audio URL for ${parts.path ?? "this row"} in ${context.hfRepo}. ` +
            "The source exposed a path only, so the bytes have to be fetched from the repo directly.",
        );
      }
      const init: RequestInit = { headers: context.headers };
      if (options?.signal) init.signal = options.signal;
      const response = await context.fetchImpl(parts.url, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching audio ${parts.url}`);
      }
      cached = new Uint8Array(await response.arrayBuffer());
      return cached;
    },
    async blob(options): Promise<Blob> {
      const bytes = await handle.read(options);
      const type = parts.contentType ?? "application/octet-stream";
      return new Blob([bytes as unknown as BlobPart], { type });
    },
  };
  return handle;
}

/**
 * Applies a mapping to one raw row.
 *
 * @param raw the row object from the datasets server
 * @param mapping mapping built by {@link buildMapping}
 * @param context per-dataset context
 * @returns the unified row
 */
export function applyMapping(
  raw: Record<string, unknown>,
  mapping: ColumnMapping,
  context: RowContext,
): Row {
  const pick = (field: CanonicalField): unknown => {
    const column = mapping.fields[field];
    if (column === undefined) return undefined;
    return raw[column];
  };

  const scaled = (field: CanonicalField): number | null => {
    const value = asNumber(pick(field));
    if (value === null) return null;
    const factor = mapping.scale[field];
    return factor === undefined ? value : value * factor;
  };

  const audioParts = parseAudioCell(pick("audio"));
  const audio = makeAudioHandle(audioParts, context);

  const rowCountry = asString(pick("country"));
  let country = context.country;
  if (rowCountry) {
    const resolved = context.resolveCountry?.(rowCountry) ?? null;
    if (resolved) country = resolved;
    else if (/^[A-Za-z]{2}$/.test(rowCountry)) country = rowCountry.toUpperCase();
  }

  // Language: the source's own value is kept, and the tag is what the registry
  // makes of it. A column that states a BCP 47 tag outright is read first,
  // because that is the source saying so rather than ngano inferring it. Then
  // the row's code and name columns, and last the catalogue record, which is
  // where the dataset's own tags come from.
  const rowLanguage = asString(pick("language"));
  const rowIso = asString(pick("language_iso"));
  const rowTag = asString(pick("language_tag"));
  let languageTag: string | null = null;
  for (const candidate of [rowTag, rowIso, rowLanguage]) {
    if (!candidate) continue;
    const resolved = context.resolveLanguageTag?.(candidate) ?? null;
    if (resolved) {
      languageTag = resolved;
      break;
    }
  }
  languageTag ??= context.languageTag;

  let languageIso: string | null;
  if (rowIso !== null) {
    const fromRow = context.resolveLanguageTag?.(rowIso) ?? null;
    languageIso = fromRow ? primarySubtag(fromRow) : rowIso;
  } else {
    languageIso = languageTag ? primarySubtag(languageTag) : context.languageIso;
  }

  const extra: Record<string, unknown> = {};
  for (const column of mapping.extra) {
    if (column in raw) extra[column] = raw[column];
  }

  const samplingRate = asNumber(pick("sampling_rate")) ?? audio?.samplingRate ?? null;

  return {
    audio,
    transcript: asString(pick("transcript")),
    language: rowLanguage ?? context.language,
    languageIso,
    languageTag,
    country,
    speakerId: asString(pick("speaker_id")),
    gender: asString(pick("gender")),
    age: asString(pick("age")),
    durationS: scaled("duration_s"),
    samplingRate,
    domain: asString(pick("domain")),
    split: asString(pick("split")) ?? context.split,
    datasetId: context.datasetId,
    hfRepo: context.hfRepo,
    licence: context.licence,
    sourceUrl: context.sourceUrl,
    extra,
  };
}
