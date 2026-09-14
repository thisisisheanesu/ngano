/**
 * The ngano catalogue: 612 African-language speech dataset records, bundled
 * with the package so that nothing here needs the network.
 *
 * @packageDocumentation
 */
import { CATALOGUE, COUNTRIES, LANGUAGES } from "./data/snapshot.js";
import { NganoHttpError } from "./errors.js";
import { compileFilter, fold, toOptions, type FilterLike } from "./filter.js";
import {
  languageName,
  primaryCode,
  resolveLanguage as resolveLanguageTags,
  type ResolveOptions,
} from "./languages.js";
import type {
  CountrySummary,
  Dataset,
  FetchLike,
  Language,
  LanguageSummary,
  RawCountry,
  RawDataset,
  Stats,
} from "./types.js";

/** Default base URL of the ngano HTTP API. */
export const API_BASE = "https://ngano.dev/api/v1";

/**
 * Converts a raw catalogue record into the camelCase public shape.
 *
 * @param raw a record from `catalogue.json` or from the HTTP API
 * @returns the public dataset object
 */
export function normaliseDataset(raw: RawDataset | Record<string, unknown>): Dataset {
  const record = raw as Record<string, unknown>;
  const str = (key: string): string | null => {
    const value = record[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  };
  const list = (key: string): string[] => {
    const value = record[key];
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  };
  const num = (key: string): number | null => {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
    return null;
  };
  const speakers = record["speakers"];

  return {
    id: str("id") ?? "",
    name: str("name") ?? "",
    task: str("task") ?? "Other",
    variety: str("variety"),
    languages: list("languages"),
    languagesClean: list("languages_clean").length ? list("languages_clean") : list("languages"),
    languageTags: list("language_tags"),
    languageCodes: list("language_codes"),
    iso: list("iso"),
    countries: list("countries"),
    countryCodes: list("country_codes"),
    regions: list("regions"),
    hours: str("hours"),
    hoursNum: num("hours_num"),
    speakers: typeof speakers === "number" || typeof speakers === "string" ? speakers : null,
    recordingType: str("recording_type"),
    quality: str("quality"),
    labelled: str("labelled"),
    domain: str("domain"),
    licence: str("licence"),
    licenceClass: str("licence_class"),
    commercial: str("commercial"),
    access: str("access"),
    host: str("host"),
    url: str("url"),
    hfRepo: str("hf_repo"),
    year: str("year"),
    notes: str("notes"),
    unverifiedSize: record["unverified_size"] === true,
    ...(str("language_note") !== null ? { languageNote: str("language_note") as string } : {}),
  };
}

/**
 * Hours that count towards a total. Self-reported figures of 20,000 hours or
 * more are excluded from every total, everywhere, per the ngano data policy.
 *
 * @param dataset a dataset
 * @returns hours to add to a total, zero when the figure is excluded
 */
export function countableHours(dataset: Dataset): number {
  if (dataset.unverifiedSize) return 0;
  return dataset.hoursNum ?? 0;
}

/** Options for {@link Catalogue.fromApi}. */
export interface FromApiOptions {
  /** API base URL. Defaults to `https://ngano.dev/api/v1`. */
  baseUrl?: string;
  /** `fetch` implementation. Defaults to the global one. */
  fetch?: FetchLike;
  /** Aborts the download. */
  signal?: AbortSignal;
  /** Page size, capped by the API at 200. */
  perPage?: number;
}

/**
 * A queryable view over ngano dataset records.
 *
 * @example
 * ```ts
 * const cat = new Catalogue();
 * cat.datasets({ language: "Shona", commercial: true, task: "ASR" });
 * cat.get("waxal-corpus-paper");
 * ```
 */
export class Catalogue {
  /** Every record in this catalogue, in source order. */
  readonly records: readonly Dataset[];
  private readonly byId: Map<string, Dataset>;
  private readonly byRepo: Map<string, Dataset>;
  private readonly countryIndex: Map<string, RawCountry>;
  private readonly languageIndex: Map<string, Language>;

  /**
   * @param records dataset records. Defaults to the bundled snapshot, which
   *   needs no network at all.
   */
  constructor(records?: ReadonlyArray<Dataset | RawDataset>) {
    const source = records ?? (CATALOGUE as RawDataset[]);
    this.records = source.map((record) =>
      "hfRepo" in record ? (record as Dataset) : normaliseDataset(record as RawDataset),
    );
    this.byId = new Map(this.records.map((record) => [record.id, record]));
    this.byRepo = new Map();
    for (const record of this.records) {
      if (record.hfRepo && !this.byRepo.has(record.hfRepo)) {
        this.byRepo.set(record.hfRepo.toLowerCase(), record);
      }
    }
    this.countryIndex = new Map();
    for (const country of COUNTRIES as RawCountry[]) {
      this.countryIndex.set(fold(country.name), country);
      this.countryIndex.set(country.iso2.toLowerCase(), country);
      this.countryIndex.set(country.iso3.toLowerCase(), country);
      if (country.map_name) this.countryIndex.set(fold(country.map_name), country);
    }
    this.languageIndex = new Map(
      (LANGUAGES as Language[]).map((language) => [language.tag.toLowerCase(), language]),
    );
  }

  /**
   * Downloads the live catalogue from the ngano HTTP API, paging until it has
   * every record. Falls back to nothing: if the API is unreachable the promise
   * rejects, and callers who want an offline catalogue should use
   * `new Catalogue()`.
   *
   * @param options API base URL, fetch implementation and abort signal
   * @returns a catalogue holding the live records
   */
  static async fromApi(options: FromApiOptions = {}): Promise<Catalogue> {
    const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
    const fetchImpl = options.fetch ?? globalFetch;
    if (!fetchImpl) {
      throw new Error(
        "No global fetch available. Use Node 18 or newer, or pass a fetch implementation.",
      );
    }
    const base = (options.baseUrl ?? API_BASE).replace(/\/$/, "");
    const perPage = Math.min(Math.max(options.perPage ?? 200, 1), 200);
    const records: RawDataset[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = `${base}/datasets?page=${page}&per_page=${perPage}`;
      const init: RequestInit = { headers: { accept: "application/json" } };
      if (options.signal) init.signal = options.signal;
      const response = await fetchImpl(url, init);
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new NganoHttpError(response.status, url, body);
      }
      const body = (await response.json()) as {
        data?: RawDataset[];
        meta?: { total_pages?: number };
      };
      records.push(...(body.data ?? []));
      totalPages = body.meta?.total_pages ?? 1;
      page += 1;
    } while (page <= totalPages);

    return new Catalogue(records);
  }

  /**
   * Filters the catalogue.
   *
   * @param filter a {@link Filter} builder or a plain options object
   * @returns matching datasets, in catalogue order
   */
  datasets(filter?: FilterLike): Dataset[] {
    const predicate = compileFilter(toOptions(filter));
    return this.records.filter(predicate);
  }

  /**
   * Looks up one dataset by its catalogue id.
   *
   * @param id ngano catalogue id
   * @returns the dataset, or undefined when the id is unknown
   */
  get(id: string): Dataset | undefined {
    return this.byId.get(id);
  }

  /**
   * Looks up one dataset by its Hugging Face repo id, case-insensitively.
   *
   * @param repo Hugging Face repo id, for example `google/fleurs`
   * @returns the dataset, or undefined when the repo is not catalogued
   */
  getByRepo(repo: string): Dataset | undefined {
    return this.byRepo.get(repo.toLowerCase());
  }

  /**
   * Resolves a country name or code to ISO 3166-1 alpha-2.
   *
   * @param value a country name, alpha-2 or alpha-3 code
   * @returns the alpha-2 code, or null when unrecognised
   */
  resolveCountry(value: string): string | null {
    const country = this.countryIndex.get(fold(value)) ?? this.countryIndex.get(value.toLowerCase());
    return country ? country.iso2 : null;
  }

  /**
   * Summarises the catalogue by country, joining the reference data in
   * `countries.json` with counts derived from the records in hand.
   *
   * @param filter optional filter applied before counting
   * @returns countries with at least one dataset, most datasets first
   */
  countries(filter?: FilterLike): CountrySummary[] {
    const records = this.datasets(filter);
    const counts = new Map<string, { datasets: number; hours: number; languages: Set<string> }>();
    for (const record of records) {
      const codes = record.countryCodes.length
        ? record.countryCodes
        : record.countries.map((name) => this.resolveCountry(name)).filter((c): c is string => !!c);
      for (const code of new Set(codes)) {
        let entry = counts.get(code);
        if (!entry) {
          entry = { datasets: 0, hours: 0, languages: new Set() };
          counts.set(code, entry);
        }
        entry.datasets += 1;
        entry.hours += countableHours(record);
        for (const language of record.languagesClean) entry.languages.add(language);
      }
    }

    const summaries: CountrySummary[] = [];
    for (const country of COUNTRIES as RawCountry[]) {
      const entry = counts.get(country.iso2);
      if (!entry) continue;
      summaries.push({
        name: country.name,
        iso2: country.iso2,
        iso3: country.iso3,
        mapName: country.map_name,
        lat: country.lat,
        lon: country.lon,
        region: country.region,
        slug: country.slug,
        datasets: entry.datasets,
        hours: round(entry.hours),
        languages: [...entry.languages].sort(),
      });
    }
    summaries.sort((a, b) => b.datasets - a.datasets || a.name.localeCompare(b.name));
    return summaries;
  }

  /**
   * Summarises the catalogue by language tag, joining `languages.json` with
   * counts derived from the records in hand. A regional variety such as
   * `eng-NG` is summarised separately from `eng`.
   *
   * @param filter optional filter applied before counting
   * @returns language tags with at least one dataset, most datasets first
   */
  languages(filter?: FilterLike): LanguageSummary[] {
    const records = this.datasets(filter);
    const counts = new Map<string, { datasets: number; hours: number; countries: Set<string> }>();
    for (const record of records) {
      for (const tag of new Set(record.languageTags)) {
        let entry = counts.get(tag);
        if (!entry) {
          entry = { datasets: 0, hours: 0, countries: new Set() };
          counts.set(tag, entry);
        }
        entry.datasets += 1;
        entry.hours += countableHours(record);
        for (const country of record.countries) entry.countries.add(country);
      }
    }

    const summaries: LanguageSummary[] = [];
    for (const [tag, entry] of counts) {
      const reference = this.languageIndex.get(tag.toLowerCase());
      summaries.push({
        tag,
        iso639_3: reference?.iso639_3 ?? primaryCode(tag),
        region: reference?.region ?? null,
        name: reference?.name ?? languageName(tag),
        slug: reference?.slug ?? tag.toLowerCase(),
        datasets: entry.datasets,
        countries: [...entry.countries].sort(),
        hours: round(entry.hours),
      });
    }
    summaries.sort((a, b) => b.datasets - a.datasets || a.name.localeCompare(b.name));
    return summaries;
  }

  /**
   * The distinct bare ISO 639-3 codes in the catalogue, with the regional
   * varieties of a code collapsed onto it, sorted.
   *
   * @param filter optional filter applied before collecting
   * @returns the codes, sorted
   */
  languageCodes(filter?: FilterLike): string[] {
    const codes = new Set<string>();
    for (const record of this.datasets(filter)) {
      for (const code of record.languageCodes) codes.add(code);
    }
    return [...codes].sort();
  }

  /**
   * Resolves a language tag, bare ISO 639-3 code or name to canonical tags.
   *
   * A tag beats a name, a bare code that only exists as regional varieties
   * resolves to those varieties, and anything unrecognised resolves to nothing
   * rather than to a guess.
   *
   * @param value a tag, a code or any catalogue spelling of a name
   * @param options whether a bare code widens to its regional varieties
   * @returns canonical tags, possibly empty
   *
   * @example
   * ```ts
   * catalogue.resolveLanguage("isiZulu");  // ["zul"]
   * catalogue.resolveLanguage("ENG-ng");   // ["eng-NG"]
   * ```
   */
  resolveLanguage(value: string, options: ResolveOptions = {}): string[] {
    return resolveLanguageTags(value, options);
  }

  /**
   * Aggregate counts. Hours exclude self-reported figures of 20,000 hours or
   * more, which the catalogue flags as unverified.
   *
   * @param filter optional filter applied before counting
   * @returns the aggregates
   */
  stats(filter?: FilterLike): Stats {
    const records = this.datasets(filter);
    const tally = (
      bucket: Record<string, number>,
      value: string | null | undefined,
    ): void => {
      const key = value && value.length > 0 ? value : "Unstated";
      bucket[key] = (bucket[key] ?? 0) + 1;
    };

    const stats: Stats = {
      datasets: records.length,
      hours: 0,
      unverifiedExcluded: 0,
      languages: 0,
      languageCodes: 0,
      countries: 0,
      hfRepos: 0,
      byTask: {},
      byAccess: {},
      byCommercial: {},
      byLicenceClass: {},
      byQuality: {},
      byLabelled: {},
      byRegion: {},
    };

    const languages = new Set<string>();
    const languageCodes = new Set<string>();
    const countries = new Set<string>();
    for (const record of records) {
      stats.hours += countableHours(record);
      if (record.unverifiedSize) stats.unverifiedExcluded += 1;
      if (record.hfRepo) stats.hfRepos += 1;
      for (const tag of record.languageTags) languages.add(tag);
      for (const code of record.languageCodes) languageCodes.add(code);
      for (const code of record.countryCodes) countries.add(code);
      tally(stats.byTask, record.task);
      tally(stats.byAccess, record.access);
      tally(stats.byCommercial, record.commercial);
      tally(stats.byLicenceClass, record.licenceClass);
      tally(stats.byQuality, record.quality);
      tally(stats.byLabelled, record.labelled);
      for (const region of new Set(record.regions)) tally(stats.byRegion, region);
    }
    stats.hours = round(stats.hours);
    stats.languages = languages.size;
    stats.languageCodes = languageCodes.size;
    stats.countries = countries.size;
    return stats;
  }

  /**
   * Free-text search over names, ids, notes, languages and countries. Name and
   * id hits rank above notes hits.
   *
   * @param query the search text
   * @param filter optional filter applied before searching
   * @returns matching datasets, best first
   */
  search(query: string, filter?: FilterLike): Dataset[] {
    const needle = query.trim().toLowerCase();
    if (needle === "") return this.datasets(filter);
    const folded = fold(query);
    const scored: Array<{ dataset: Dataset; score: number }> = [];
    for (const dataset of this.datasets(filter)) {
      const name = dataset.name.toLowerCase();
      let score = 0;
      if (name === needle || dataset.id === needle) score = 100;
      else if (name.startsWith(needle)) score = 80;
      else if (name.includes(needle) || fold(dataset.name).includes(folded)) score = 60;
      else if (dataset.id.includes(needle)) score = 55;
      else if (dataset.languageTags.some((tag) => tag.toLowerCase() === needle)) score = 45;
      else if (dataset.languages.some((language) => fold(language).includes(folded))) score = 40;
      else if (dataset.languagesClean.some((language) => fold(language).includes(folded))) score = 38;
      else if (dataset.countries.some((country) => fold(country).includes(folded))) score = 30;
      else if ((dataset.hfRepo ?? "").toLowerCase().includes(needle)) score = 25;
      else if ((dataset.notes ?? "").toLowerCase().includes(needle)) score = 20;
      else if ((dataset.domain ?? "").toLowerCase().includes(needle)) score = 15;
      if (score > 0) scored.push({ dataset, score });
    }
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        countableHours(b.dataset) - countableHours(a.dataset) ||
        a.dataset.name.localeCompare(b.dataset.name),
    );
    return scored.map((entry) => entry.dataset);
  }
}

/**
 * Rounds to one decimal place, which is as much precision as published hours
 * figures ever carry.
 *
 * @param value a number
 * @returns the rounded number
 */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** A catalogue over the bundled snapshot, created once and shared. */
let defaultCatalogue: Catalogue | null = null;

/**
 * The shared offline catalogue. Building it parses the bundled snapshot, so it
 * is done once and reused.
 *
 * @returns the shared catalogue
 */
export function getDefaultCatalogue(): Catalogue {
  defaultCatalogue ??= new Catalogue();
  return defaultCatalogue;
}
