/**
 * Language identity for the site: resolving a key to a language, and rendering one.
 *
 * Every language in the catalogue is identified by a BCP 47 tag whose primary subtag
 * is an ISO 639-3 three-letter code, with an optional ISO 3166-1 region subtag for a
 * country-specific variety. `sna` is Shona, `eng-NG` is Nigerian English. The tag is
 * the identifier the SDKs and the API filter on, so it is shown beside the name
 * wherever a language appears rather than hidden behind it.
 *
 * One treatment is used everywhere: the canonical name as the link text, with the tag
 * in a monospace chip beside it. Nothing here reads the network or mutates the context.
 */

import type { Dataset, Language, LanguageCode, SiteContext } from './context';
import { esc, num } from './util';

/** Lookup tables built once per context and reused by every renderer. */
export interface LanguageIndex {
  /** Lowercased tag to the language, so `ENG-NG` and `eng-ng` both resolve. */
  byTag: Map<string, Language>;
  /** Every alias, canonical name and slugified spelling, lowercased. */
  byKey: Map<string, Language>;
  /** Bare ISO 639-3 code to every language that uses it, registry order. */
  byCode: Map<string, Language[]>;
  /** The languages whose tag carries a region subtag, in catalogue order. */
  regional: Language[];
}

const CACHE = new WeakMap<object, LanguageIndex>();

function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The registry entries the context carries, as a plain record. */
function registry(ctx: SiteContext): Record<string, LanguageCode> {
  const codes = ctx.languageCodes?.codes;
  return codes && typeof codes === 'object' ? codes : {};
}

/**
 * Build (or reuse) the language index for a context.
 *
 * `data/languages.json` carries the aggregates, so it is the primary source. The
 * registry in `data/language_codes.json` adds the source spellings that never became
 * a language record of their own, which is what makes a search for "isiZulu" land.
 */
export function languageIndex(ctx: SiteContext): LanguageIndex {
  const cached = CACHE.get(ctx as unknown as object);
  if (cached) return cached;

  const byTag = new Map<string, Language>();
  const byKey = new Map<string, Language>();
  const byCode = new Map<string, Language[]>();
  const regional: Language[] = [];

  for (const language of ctx.languages) {
    byTag.set(language.tag.toLowerCase(), language);
    const list = byCode.get(language.iso639_3);
    if (list) list.push(language);
    else byCode.set(language.iso639_3, [language]);
    if (language.region) regional.push(language);
  }

  const addKey = (key: string, language: Language): void => {
    const lower = key.trim().toLowerCase();
    if (!lower || byKey.has(lower)) return;
    byKey.set(lower, language);
    const slug = slugifyName(lower);
    if (slug && !byKey.has(slug)) byKey.set(slug, language);
  };

  for (const language of ctx.languages) {
    addKey(language.name, language);
    for (const alias of language.aliases) addKey(alias, language);
  }

  // Spellings the registry knows that a language record does not repeat.
  for (const entry of Object.values(registry(ctx))) {
    const language = byTag.get(entry.tag.toLowerCase());
    if (!language) continue;
    addKey(entry.name, language);
    for (const alias of entry.aliases) addKey(alias, language);
  }
  const nameToTag = ctx.languageCodes?.name_to_tag;
  if (nameToTag) {
    for (const [name, tag] of Object.entries(nameToTag)) {
      if (!tag) continue;
      const language = byTag.get(tag.toLowerCase());
      if (language) addKey(name, language);
    }
  }

  const index: LanguageIndex = { byTag, byKey, byCode, regional };
  CACHE.set(ctx as unknown as object, index);
  return index;
}

/** Percent decoding that never throws on a malformed key. */
function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The language a key names: a tag in any case, a bare ISO 639-3 code, a canonical
 * name or any spelling a source used. Returns null when nothing resolves, so a caller
 * can answer 404 rather than invent a page.
 */
export function resolveLanguage(ctx: SiteContext, key: string): Language | null {
  const index = languageIndex(ctx);
  for (const candidate of [key, decode(key)]) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    const byTag = index.byTag.get(lower);
    if (byTag) return byTag;
    const byKey = index.byKey.get(lower) ?? index.byKey.get(slugifyName(lower));
    if (byKey) return byKey;
  }
  return null;
}

/** The language record for a tag, or null when the tag is not in the catalogue. */
export function languageForTag(ctx: SiteContext, tag: string): Language | null {
  return languageIndex(ctx).byTag.get(tag.trim().toLowerCase()) ?? null;
}

/** The canonical display name for a tag, falling back to the tag itself. */
export function languageName(ctx: SiteContext, tag: string): string {
  const language = languageForTag(ctx, tag);
  if (language) return language.name;
  const entry = registry(ctx)[tag];
  return entry?.name ?? tag;
}

/** The page path for a language. */
export function languageHref(language: Language): string {
  return `/languages/${encodeURIComponent(language.slug)}`;
}

/** `Shona (sna)`, for prose, page titles and meta descriptions. */
export function languageLabel(ctx: SiteContext, tag: string): string {
  const language = languageForTag(ctx, tag);
  return language ? `${language.name} (${language.tag})` : tag;
}

/** ISO 639-3 scope in plain words rather than the registry letter. */
export function scopeWords(scope: string | null | undefined): string {
  switch (scope) {
    case 'I':
      return 'individual language';
    case 'M':
      return 'macrolanguage';
    case 'S':
      return 'special scope';
    default:
      return 'scope not recorded';
  }
}

/** ISO 639-3 type in plain words. */
export function typeWords(type: string | null | undefined): string {
  switch (type) {
    case 'L':
      return 'living';
    case 'E':
      return 'extinct';
    case 'H':
      return 'historical';
    case 'A':
      return 'ancient';
    case 'C':
      return 'constructed';
    case 'S':
      return 'special';
    default:
      return 'type not recorded';
  }
}

export interface ChipOptions {
  /** Append the apportioned hours, for lists where size is the point. */
  hours?: string;
  /** Render without a link, for the language the reader is already looking at. */
  static?: boolean;
}

/**
 * One language, as the name with its tag in a monospace chip. Used on dataset pages,
 * country pages, the home page and the map, so the identifier travels with the name.
 */
export function languageChip(ctx: SiteContext, key: string, options: ChipOptions = {}): string {
  const language = resolveLanguage(ctx, key);
  const extra = options.hours ? `<span class="c">${esc(options.hours)}</span>` : '';
  if (!language) {
    return `<span class="lang flat">${esc(key)}<code class="tag">no code</code></span>`;
  }
  const inner = `${esc(language.name)}<code class="tag">${esc(language.tag)}</code>${extra}`;
  if (options.static) return `<span class="lang">${inner}</span>`;
  return `<a class="lang" href="${esc(languageHref(language))}">${inner}</a>`;
}

/**
 * A row of language chips with an honest overflow note. Keys may be tags or the
 * spellings a source used; anything that does not resolve is shown as written.
 */
export function languageChips(ctx: SiteContext, keys: readonly string[], limit = 40): string {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const key of keys) {
    const language = resolveLanguage(ctx, key);
    const id = language ? language.tag : key.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(key);
  }
  if (unique.length === 0) return '<p class="note">No languages recorded.</p>';
  const chips = unique
    .slice(0, limit)
    .map((key) => languageChip(ctx, key))
    .join('');
  const rest = unique.length > limit ? `<p class="note">and ${esc(num(unique.length - limit))} more</p>` : '';
  return `<div class="langs">${chips}</div>${rest}`;
}

/** How many catalogue languages are regional or accented varieties of another. */
export function regionalCount(ctx: SiteContext): number {
  return languageIndex(ctx).regional.length;
}

/** The distinct ISO 639-3 codes behind the catalogue's tags. */
export function codeCount(ctx: SiteContext): number {
  return languageIndex(ctx).byCode.size;
}

/**
 * The compact index the masthead search uses: tag, canonical name and every other
 * spelling, joined by a pipe. Kept small on purpose, because it travels with every
 * page so that a search for `sna`, `Shona` or `chiShona` answers without a round trip.
 */
export function searchIndex(ctx: SiteContext): [string, string, string][] {
  return ctx.languages.map((language) => {
    const aliases = language.aliases.filter((alias) => alias.toLowerCase() !== language.name.toLowerCase());
    return [language.tag, language.name, aliases.join('|')];
  });
}

/** A record naming more languages than this says nothing about where any one is spoken. */
const SPECIFIC_LANGUAGES = 3;
/** The same for countries: a pan-African sweep names them all. */
const SPECIFIC_COUNTRIES = 3;

/**
 * The country this language is most strongly tied to in the catalogue, as an ISO 3166
 * alpha-2 code, or null when no record ties it to one.
 *
 * Only records specific enough to carry the information count: a Shona corpus recorded
 * in Zimbabwe places Shona in Zimbabwe, while a pan-African corpus listing Shona among
 * ninety languages and forty countries places it nowhere. When nothing specific exists
 * the answer is null, and the caller names a real variety of another language instead
 * of inventing a pairing.
 */
export function homeCountryCode(datasets: readonly Dataset[]): string | null {
  const weights = new Map<string, number>();
  for (const dataset of datasets) {
    const tags = dataset.language_tags.length;
    const codes = dataset.country_codes;
    // Only records specific enough to mean something: a corpus covering dozens of
    // languages in dozens of countries says nothing about where one of them is spoken.
    if (codes.length === 0 || tags > SPECIFIC_LANGUAGES || codes.length > SPECIFIC_COUNTRIES) continue;
    const share = 1 / (Math.max(1, tags) * codes.length);
    for (const code of codes) weights.set(code, (weights.get(code) ?? 0) + share);
  }
  let best: string | null = null;
  let bestWeight = 0;
  for (const [code, weight] of weights) {
    if (weight > bestWeight || (weight === bestWeight && best !== null && code < best)) {
      best = code;
      bestWeight = weight;
    }
  }
  return best;
}

/**
 * A real regional variety to point at when a language has no country of its own to
 * illustrate with. The most catalogued one, so the example is never obscure.
 */
export function exampleVariety(ctx: SiteContext): Language | null {
  const regional = [...languageIndex(ctx).regional].sort(
    (a, b) => b.datasets - a.datasets || a.tag.localeCompare(b.tag),
  );
  return regional[0] ?? null;
}

/**
 * The sentence that explains what a tag is. Used on the docs page and on every
 * language page, so a reader meets the same explanation wherever they arrive.
 */
export const TAG_EXPLAINER =
  'A language tag is an ISO 639-3 three-letter code, optionally followed by an ISO 3166-1 region subtag when the catalogue holds a country-specific variety.';
