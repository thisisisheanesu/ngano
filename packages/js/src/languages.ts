/**
 * Language tag resolution.
 *
 * The catalogue is keyed on BCP 47 tags whose primary subtag is always an
 * ISO 639-3 three-letter code, with an optional ISO 3166-1 region subtag for a
 * country-specific variety. Shona is `sna`, Nigerian English is `eng-NG` and
 * Mozambican Portuguese is `por-MZ`.
 *
 * Everything a caller can type for a language, a tag, a bare code or any
 * spelling the catalogue has ever used, resolves through here. The rules are
 * the same ones the ngano Worker and the Python SDK apply, in the same order,
 * so a filter written against one of them behaves identically against the
 * others.
 *
 * @packageDocumentation
 */
import { LANGUAGE_CODES } from "./data/snapshot.js";
import type { LanguageCode, LanguageCodes } from "./types.js";

/** The bundled ISO 639-3 registry, exactly as `data/language_codes.json` ships it. */
export const REGISTRY: LanguageCodes = LANGUAGE_CODES as LanguageCodes;

/**
 * A three-letter ISO 639-3 code, optionally followed by a region subtag. The
 * region is an ISO 3166-1 alpha-2 code or a UN M.49 area number, which is what
 * BCP 47 allows.
 */
const TAG_PATTERN = /^([A-Za-z]{3})(?:-([A-Za-z]{2}|\d{3}))?$/;

/**
 * Puts a tag into canonical case: lower-case primary subtag, upper-case region.
 * That is the BCP 47 convention and it is what the registry is keyed on, so
 * `ENG-ng`, `eng-NG` and `Eng-Ng` all find `eng-NG`.
 *
 * @param value a tag as the caller typed it
 * @returns the canonical tag, or null when the value is not tag-shaped
 */
export function canonicaliseTag(value: string): string | null {
  const match = TAG_PATTERN.exec(value.trim());
  if (!match?.[1]) return null;
  const primary = match[1].toLowerCase();
  return match[2] ? `${primary}-${match[2].toUpperCase()}` : primary;
}

/** Every known tag, in canonical case, in registry order. */
export const LANGUAGE_TAGS: string[] = Object.keys(REGISTRY.codes);

/**
 * The bare ISO 639-3 code of a tag, which is its primary subtag.
 *
 * @param tag a BCP 47 tag
 * @returns the three-letter code
 */
export function primaryCode(tag: string): string {
  const dash = tag.indexOf("-");
  return (dash === -1 ? tag : tag.slice(0, dash)).toLowerCase();
}

/** Bare ISO 639-3 code to every tag that uses it, so `eng` reaches all of `eng-*`. */
export const tagsByCode: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const tag of LANGUAGE_TAGS) {
    const entry = REGISTRY.codes[tag];
    if (!entry) continue;
    const list = map.get(entry.iso639_3);
    if (list) list.push(tag);
    else map.set(entry.iso639_3, [tag]);
  }
  return map;
})();

/**
 * The slug rule the old name-based URLs used, kept so those URLs still resolve.
 *
 * @param value a language name
 * @returns the slug form
 */
export function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A catalogue spelling to the tag it resolves to. Keys are lower-cased and slugified. */
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
    const entry = REGISTRY.codes[tag];
    if (!entry) continue;
    add(entry.name, tag);
    for (const alias of entry.aliases) add(alias, tag);
  }
  // The source-name index carries spellings the registry entries do not repeat.
  for (const [name, tag] of Object.entries(REGISTRY.name_to_tag)) {
    if (tag && REGISTRY.codes[tag]) add(name, tag);
  }
  return map;
})();

/** Options shared by every resolver here. */
export interface ResolveOptions {
  /**
   * Widens a bare ISO 639-3 code to every regional variety of it, so `eng` also
   * matches `eng-NG` and `eng-ZA`. Off by default: a bare code means the
   * language at large and must never silently pick up a country-specific
   * variety.
   */
  includeVarieties?: boolean;
}

/**
 * Resolves one caller-supplied language to canonical tags, first match wins:
 *
 * 1. an exact tag, case insensitively, so `sna`, `SNA`, `eng-NG` and `eng-ng`
 *    all land on the same key;
 * 2. a bare ISO 639-3 code that exists only as regional varieties, which
 *    resolves to those varieties because there is nothing else it could mean;
 * 3. a name from the registry aliases, case insensitively, in its plain or its
 *    slugified spelling, which is how an old free-text name still works.
 *
 * A tag always beats a name. The one collision is `tem`, which is Timne's tag
 * and also a name of `kdh`: the tag wins, and "Temne" still resolves to `tem`.
 *
 * Unresolvable input yields an empty array, never a guess.
 *
 * @param value a tag, a bare code or a language name
 * @param options whether a bare code widens to its varieties
 * @returns canonical tags, in order, possibly empty
 *
 * @example
 * ```ts
 * resolveLanguage("SNA");                                  // ["sna"]
 * resolveLanguage("isiZulu");                              // ["zul"]
 * resolveLanguage("eng", { includeVarieties: true });      // ["eng", "eng-NG", ...]
 * ```
 */
export function resolveLanguage(value: string, options: ResolveOptions = {}): string[] {
  const raw = value.trim();
  if (!raw) return [];

  const tag = canonicaliseTag(raw);
  if (tag) {
    const exact = REGISTRY.codes[tag];
    const varieties = tag.includes("-") ? [] : (tagsByCode.get(tag) ?? []);
    if (exact) {
      if (!options.includeVarieties || varieties.length === 0) return [tag];
      return [tag, ...varieties.filter((other) => other !== tag)];
    }
    // A bare code with no tag of its own can only mean its varieties.
    if (varieties.length > 0) return [...varieties];
  }

  const byAlias = tagByAlias.get(raw.toLowerCase()) ?? tagByAlias.get(slugifyName(raw));
  if (!byAlias) return [];
  const entry = REGISTRY.codes[byAlias];
  if (options.includeVarieties && entry && !entry.region) {
    const varieties = tagsByCode.get(entry.iso639_3) ?? [];
    if (varieties.length > 1) return [byAlias, ...varieties.filter((other) => other !== byAlias)];
  }
  return [byAlias];
}

/**
 * Resolves several values at once, deduplicated, order preserved.
 *
 * @param values tags, bare codes or names
 * @param options whether a bare code widens to its varieties
 * @returns canonical tags, deduplicated
 */
export function resolveLanguages(
  values: readonly string[],
  options: ResolveOptions = {},
): string[] {
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

/**
 * The registry entry for a tag.
 *
 * @param tag a tag in any case
 * @returns the entry, or undefined when the tag is unknown
 */
export function languageCode(tag: string): LanguageCode | undefined {
  const canonical = canonicaliseTag(tag);
  return canonical ? REGISTRY.codes[canonical] : undefined;
}

/**
 * The canonical display name for a tag, falling back to the tag itself.
 *
 * @param tag a tag in any case
 * @returns a name fit to print
 */
export function languageName(tag: string): string {
  return languageCode(tag)?.name ?? tag;
}
