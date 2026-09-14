/**
 * Catalogue filtering: a plain options object and a chainable builder, which
 * both produce the same predicate.
 *
 * Within one field the values are ORed, across fields they are ANDed, exactly
 * as the ngano HTTP API behaves.
 *
 * @packageDocumentation
 */
import { resolveLanguages } from "./languages.js";
import type { Dataset } from "./types.js";

/**
 * Filter options accepted by {@link Catalogue.datasets} and {@link load}.
 * Every field is optional, and a field that is absent places no constraint.
 */
export interface FilterOptions {
  /** Free-text search over name, id, notes, languages, countries and host. */
  q?: string;
  /** ngano catalogue id or ids. */
  id?: string | string[];
  /**
   * Language tag, bare ISO 639-3 code or name. Every value resolves through the
   * ISO 639-3 registry to canonical tags, and a dataset matches when it carries
   * one of them. Unresolvable input matches nothing rather than everything.
   */
  language?: string | string[];
  /** The code-shaped spelling of {@link FilterOptions.language}. Same filter. */
  iso?: string | string[];
  /**
   * Widens a bare code to its regional varieties, so `eng` also matches
   * `eng-NG`. Off by default.
   */
  includeVarieties?: boolean;
  /** Country as ISO 3166-1 alpha-2 or as a name. */
  country?: string | string[];
  /** Region name, for example East Africa. */
  region?: string | string[];
  /** Task, for example ASR, TTS or ASR+TTS. */
  task?: string | string[];
  /** Language variety grouping. */
  variety?: string | string[];
  /**
   * `true` keeps only datasets whose commercial field is exactly "Yes". With
   * {@link FilterOptions.includePurchasable} it also keeps "Yes, if purchased".
   * `false` keeps only "No". A string or list matches the raw values.
   */
  commercial?: boolean | string | string[];
  /** Widens `commercial: true` to include "Yes, if purchased". */
  includePurchasable?: boolean;
  /** Licence family, for example "Attribution (CC-BY)". */
  licenceClass?: string | string[];
  /** Access route, for example Open, Request or Paid. */
  access?: string | string[];
  /** Transcription status, for example Transcribed. */
  labelled?: string | string[];
  /** Audio quality band. */
  quality?: string | string[];
  /** Recording domain. */
  domain?: string | string[];
  /** Host, for example HuggingFace. */
  host?: string | string[];
  /** Keeps only datasets with a Hugging Face repo, which are the loadable ones. */
  hfOnly?: boolean;
  /** Minimum published hours, inclusive. */
  minHours?: number;
  /** Maximum published hours, inclusive. */
  maxHours?: number;
  /** Keeps only datasets with a published hours figure. */
  hasHours?: boolean;
}

/**
 * Normalises a string for comparison: trimmed, lower case, punctuation folded.
 * Nullish input folds to an empty string, since catalogue fields are nullable.
 *
 * @param value any string, or nothing
 * @returns the comparison key
 */
export function fold(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_\-'’.()/]+/g, "");
}

/**
 * Wraps a scalar or list option into an array of comparison keys.
 *
 * @param value one value, several values, or nothing
 * @returns folded values, empty when the option was absent
 */
function keys(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : String(value).split(",");
  return list.map((entry) => fold(entry)).filter((entry) => entry.length > 0);
}

/**
 * Splits a scalar, list or comma-separated option into trimmed entries, left
 * exactly as typed. Language values are resolved rather than folded, so they
 * must not be stripped of their punctuation first.
 *
 * @param value one value, several values, or nothing
 * @returns the entries, empty when the option was absent
 */
function rawList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : String(value).split(",");
  return list.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

/**
 * True when any of the dataset's values matches any of the wanted keys.
 *
 * @param wanted folded keys from the filter
 * @param values dataset values, unfolded
 * @returns whether the field passes
 */
function anyMatch(wanted: string[], values: Array<string | null | undefined>): boolean {
  if (wanted.length === 0) return true;
  const have = new Set(values.filter((v): v is string => typeof v === "string").map(fold));
  return wanted.some((key) => have.has(key));
}

/** Commercial values that count as usable in a commercial product. */
const COMMERCIAL_YES = "Yes";
/** Commercial value for datasets that allow commercial use once bought. */
const COMMERCIAL_PURCHASABLE = "Yes, if purchased";
/** Every value the catalogue uses for commercial use. */
const COMMERCIAL_VALUES = [COMMERCIAL_YES, COMMERCIAL_PURCHASABLE, "No", "Unstated"];

/**
 * Folds commercial values without splitting "Yes, if purchased" on its comma,
 * while still accepting comma-separated lists of the other values.
 *
 * @param values raw values from the caller
 * @returns folded keys
 */
function commercialKeys(values: string[]): string[] {
  const known = new Map(COMMERCIAL_VALUES.map((value) => [fold(value), value]));
  const out: string[] = [];
  for (const value of values) {
    const whole = fold(value);
    if (known.has(whole)) out.push(whole);
    else out.push(...keys(value));
  }
  return out;
}

/**
 * Builds a predicate from filter options.
 *
 * @param options the filter options
 * @returns a predicate over datasets
 */
export function compileFilter(options: FilterOptions = {}): (dataset: Dataset) => boolean {
  const ids = keys(options.id);
  // `language` and `iso` are one filter: both resolve through the registry.
  const requestedLanguages = [...rawList(options.language), ...rawList(options.iso)];
  const languageTags =
    requestedLanguages.length > 0
      ? new Set(
          resolveLanguages(requestedLanguages, {
            includeVarieties: options.includeVarieties === true,
          }).map((tag) => tag.toLowerCase()),
        )
      : null;
  const countries = keys(options.country);
  const regions = keys(options.region);
  const tasks = keys(options.task);
  const varieties = keys(options.variety);
  const licenceClasses = keys(options.licenceClass);
  const accesses = keys(options.access);
  const labelled = keys(options.labelled);
  const qualities = keys(options.quality);
  const domains = keys(options.domain);
  const hosts = keys(options.host);
  const query = options.q ? fold(options.q) : null;
  const rawQuery = options.q ? options.q.trim().toLowerCase() : null;

  let commercialValues: string[] | null = null;
  if (typeof options.commercial === "boolean") {
    commercialValues = options.commercial
      ? options.includePurchasable
        ? [COMMERCIAL_YES, COMMERCIAL_PURCHASABLE]
        : [COMMERCIAL_YES]
      : ["No"];
  } else if (options.commercial !== undefined) {
    // Not split on commas here: "Yes, if purchased" carries one of its own.
    commercialValues = Array.isArray(options.commercial)
      ? options.commercial
      : [String(options.commercial)];
  } else if (options.includePurchasable) {
    commercialValues = [COMMERCIAL_YES, COMMERCIAL_PURCHASABLE];
  }
  const commercial = commercialValues ? commercialKeys(commercialValues) : [];

  return (dataset: Dataset): boolean => {
    if (!anyMatch(ids, [dataset.id])) return false;
    if (languageTags !== null) {
      if (!dataset.languageTags.some((tag) => languageTags.has(tag.toLowerCase()))) return false;
    }
    if (!anyMatch(countries, [...dataset.countryCodes, ...dataset.countries])) return false;
    if (!anyMatch(regions, dataset.regions)) return false;
    if (!anyMatch(tasks, [dataset.task])) return false;
    if (!anyMatch(varieties, [dataset.variety])) return false;
    if (!anyMatch(commercial, [dataset.commercial])) return false;
    if (!anyMatch(licenceClasses, [dataset.licenceClass, dataset.licence])) return false;
    if (!anyMatch(accesses, [dataset.access])) return false;
    if (!anyMatch(labelled, [dataset.labelled])) return false;
    if (!anyMatch(qualities, [dataset.quality])) return false;
    if (!anyMatch(domains, [dataset.domain])) return false;
    if (!anyMatch(hosts, [dataset.host])) return false;

    if (options.hfOnly && !dataset.hfRepo) return false;
    if (options.hasHours && dataset.hoursNum === null) return false;
    if (options.minHours !== undefined) {
      if (dataset.hoursNum === null || dataset.hoursNum < options.minHours) return false;
    }
    if (options.maxHours !== undefined) {
      if (dataset.hoursNum === null || dataset.hoursNum > options.maxHours) return false;
    }

    if (query !== null && rawQuery !== null) {
      const haystack = [
        dataset.name,
        dataset.id,
        dataset.notes,
        dataset.domain,
        dataset.host,
        dataset.hfRepo,
        dataset.licence,
        ...dataset.languages,
        ...dataset.languagesClean,
        ...dataset.languageTags,
        ...dataset.countries,
        ...dataset.regions,
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ");
      if (!haystack.toLowerCase().includes(rawQuery) && !fold(haystack).includes(query)) {
        return false;
      }
    }

    return true;
  };
}

/**
 * Chainable filter builder. Every method returns the same instance, and
 * {@link Filter.toOptions} hands back a plain options object that can be passed
 * anywhere options are accepted.
 *
 * @example
 * ```ts
 * const f = new Filter().language("Shona").country("ZW").commercial(true).hfOnly();
 * catalogue.datasets(f);
 * ```
 */
export class Filter {
  private readonly options: FilterOptions = {};

  /**
   * Starts a new filter, optionally seeded from options.
   *
   * @param options initial options
   * @returns a new builder
   */
  static from(options: FilterOptions = {}): Filter {
    const filter = new Filter();
    Object.assign(filter.options, options);
    return filter;
  }

  /**
   * Free-text search.
   *
   * @param text the search text
   * @returns this builder
   */
  q(text: string): this {
    this.options.q = text;
    return this;
  }

  /**
   * Restricts to catalogue ids.
   *
   * @param values one or more ids
   * @returns this builder
   */
  id(...values: string[]): this {
    this.options.id = values;
    return this;
  }

  /**
   * Restricts to languages. Each value may be a BCP 47 tag, a bare ISO 639-3
   * code or any catalogue spelling of the name.
   *
   * @param values one or more tags, codes or names
   * @returns this builder
   */
  language(...values: string[]): this {
    this.options.language = values;
    return this;
  }

  /**
   * The code-shaped spelling of {@link Filter.language}, kept as an alias of it.
   *
   * @param values one or more ISO 639-3 codes or tags
   * @returns this builder
   */
  iso(...values: string[]): this {
    this.options.iso = values;
    return this;
  }

  /**
   * Widens a bare ISO 639-3 code to its regional varieties, so `eng` also
   * matches `eng-NG`.
   *
   * @param value whether to widen
   * @returns this builder
   */
  includeVarieties(value = true): this {
    this.options.includeVarieties = value;
    return this;
  }

  /**
   * Restricts to countries, by ISO 3166-1 alpha-2 code or name.
   *
   * @param values one or more countries
   * @returns this builder
   */
  country(...values: string[]): this {
    this.options.country = values;
    return this;
  }

  /**
   * Restricts to regions.
   *
   * @param values one or more region names
   * @returns this builder
   */
  region(...values: string[]): this {
    this.options.region = values;
    return this;
  }

  /**
   * Restricts to tasks.
   *
   * @param values for example "ASR" or "TTS"
   * @returns this builder
   */
  task(...values: string[]): this {
    this.options.task = values;
    return this;
  }

  /**
   * Restricts to language varieties.
   *
   * @param values for example "Indigenous"
   * @returns this builder
   */
  variety(...values: string[]): this {
    this.options.variety = values;
    return this;
  }

  /**
   * Restricts by commercial use. `true` means exactly "Yes".
   *
   * @param value true, false, or raw catalogue values
   * @returns this builder
   */
  commercial(value: boolean | string | string[] = true): this {
    this.options.commercial = value;
    return this;
  }

  /**
   * Widens `commercial(true)` to include "Yes, if purchased".
   *
   * @param value whether purchasable datasets are acceptable
   * @returns this builder
   */
  includePurchasable(value = true): this {
    this.options.includePurchasable = value;
    return this;
  }

  /**
   * Restricts to licence families.
   *
   * @param values for example "Attribution (CC-BY)"
   * @returns this builder
   */
  licenceClass(...values: string[]): this {
    this.options.licenceClass = values;
    return this;
  }

  /**
   * Restricts to access routes.
   *
   * @param values for example "Open"
   * @returns this builder
   */
  access(...values: string[]): this {
    this.options.access = values;
    return this;
  }

  /**
   * Restricts by transcription status.
   *
   * @param values for example "Transcribed"
   * @returns this builder
   */
  labelled(...values: string[]): this {
    this.options.labelled = values;
    return this;
  }

  /**
   * Restricts by audio quality band.
   *
   * @param values for example "Standard (16 kHz)"
   * @returns this builder
   */
  quality(...values: string[]): this {
    this.options.quality = values;
    return this;
  }

  /**
   * Restricts by recording domain.
   *
   * @param values for example "Broadcast news"
   * @returns this builder
   */
  domain(...values: string[]): this {
    this.options.domain = values;
    return this;
  }

  /**
   * Restricts by host.
   *
   * @param values for example "HuggingFace"
   * @returns this builder
   */
  host(...values: string[]): this {
    this.options.host = values;
    return this;
  }

  /**
   * Keeps only datasets that have a Hugging Face repo.
   *
   * @param value whether to apply the restriction
   * @returns this builder
   */
  hfOnly(value = true): this {
    this.options.hfOnly = value;
    return this;
  }

  /**
   * Sets a lower bound on published hours.
   *
   * @param hours minimum hours, inclusive
   * @returns this builder
   */
  minHours(hours: number): this {
    this.options.minHours = hours;
    return this;
  }

  /**
   * Sets an upper bound on published hours.
   *
   * @param hours maximum hours, inclusive
   * @returns this builder
   */
  maxHours(hours: number): this {
    this.options.maxHours = hours;
    return this;
  }

  /**
   * Keeps only datasets with a published hours figure.
   *
   * @param value whether to apply the restriction
   * @returns this builder
   */
  hasHours(value = true): this {
    this.options.hasHours = value;
    return this;
  }

  /**
   * Hands back the accumulated options.
   *
   * @returns a shallow copy of the options
   */
  toOptions(): FilterOptions {
    return { ...this.options };
  }

  /**
   * Tests one dataset against the filter.
   *
   * @param dataset the dataset to test
   * @returns whether it passes
   */
  match(dataset: Dataset): boolean {
    return compileFilter(this.options)(dataset);
  }
}

/**
 * Accepts either a {@link Filter} or a plain options object.
 */
export type FilterLike = Filter | FilterOptions;

/**
 * Reduces a filter-like value to plain options.
 *
 * @param filter a builder, options, or nothing
 * @returns plain options
 */
export function toOptions(filter?: FilterLike): FilterOptions {
  if (!filter) return {};
  return filter instanceof Filter ? filter.toOptions() : filter;
}
