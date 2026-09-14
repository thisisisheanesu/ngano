import { describe, expect, it } from "vitest";
import { Catalogue, countableHours, normaliseDataset } from "../src/catalogue.js";
import { Filter, compileFilter } from "../src/filter.js";
import { CATALOGUE, SNAPSHOT_SIZE } from "../src/data/snapshot.js";
import { fakeFetch } from "./helpers.js";
import type { RawDataset } from "../src/types.js";

const catalogue = new Catalogue();

describe("bundled snapshot", () => {
  it("works with no network at all", () => {
    expect(SNAPSHOT_SIZE).toBe(611);
    expect(catalogue.records).toHaveLength(611);
    expect(catalogue.records[0]?.id).toBeTruthy();
  });

  it("normalises snake_case records into camelCase", () => {
    const raw = CATALOGUE.find((record) => record.hf_repo === "google/fleurs") as RawDataset;
    const dataset = normaliseDataset(raw);
    expect(dataset.hfRepo).toBe("google/fleurs");
    expect(dataset.licenceClass).toBe(raw.licence_class);
    expect(dataset.countryCodes).toEqual(raw.country_codes);
    expect(dataset.unverifiedSize).toBe(raw.unverified_size === true);
  });
});

describe("lookups", () => {
  it("finds a dataset by id", () => {
    const first = catalogue.records[0]!;
    expect(catalogue.get(first.id)?.name).toBe(first.name);
    expect(catalogue.get("no-such-dataset")).toBeUndefined();
  });

  it("finds a dataset by Hugging Face repo, case-insensitively", () => {
    expect(catalogue.getByRepo("google/fleurs")?.hfRepo).toBe("google/fleurs");
    expect(catalogue.getByRepo("GOOGLE/FLEURS")?.hfRepo).toBe("google/fleurs");
  });

  it("resolves country names and codes to alpha-2", () => {
    expect(catalogue.resolveCountry("Zimbabwe")).toBe("ZW");
    expect(catalogue.resolveCountry("zw")).toBe("ZW");
    expect(catalogue.resolveCountry("ZWE")).toBe("ZW");
    expect(catalogue.resolveCountry("Atlantis")).toBeNull();
  });
});

describe("filters", () => {
  it("ANDs across fields and ORs within one", () => {
    const wanted = new Set([
      ...catalogue.resolveLanguage("Shona"),
      ...catalogue.resolveLanguage("Ndebele"),
    ]);
    const results = catalogue.datasets({ language: ["Shona", "Ndebele"], task: "ASR" });
    expect(results.length).toBeGreaterThan(0);
    for (const dataset of results) {
      expect(dataset.task).toBe("ASR");
      expect(dataset.languageTags.some((tag) => wanted.has(tag))).toBe(true);
    }
  });

  it("treats commercial true as exactly Yes", () => {
    const results = catalogue.datasets({ commercial: true });
    expect(results.length).toBe(204);
    expect(results.every((dataset) => dataset.commercial === "Yes")).toBe(true);
  });

  it("widens to purchasable datasets when asked", () => {
    const results = catalogue.datasets({ commercial: true, includePurchasable: true });
    expect(results.length).toBe(204 + 36);
    expect(
      results.every((dataset) =>
        ["Yes", "Yes, if purchased"].includes(dataset.commercial ?? ""),
      ),
    ).toBe(true);
  });

  it("treats commercial false as exactly No", () => {
    const results = catalogue.datasets({ commercial: false });
    expect(results.every((dataset) => dataset.commercial === "No")).toBe(true);
    expect(results.length).toBe(118);
  });

  it("matches the purchasable value despite the comma in it", () => {
    const results = catalogue.datasets({ commercial: "Yes, if purchased" });
    expect(results.length).toBe(36);
    expect(results.every((dataset) => dataset.commercial === "Yes, if purchased")).toBe(true);
  });

  it("matches countries by code or by name", () => {
    const byCode = catalogue.datasets({ country: "ZW" });
    const byName = catalogue.datasets({ country: "Zimbabwe" });
    expect(byCode.length).toBeGreaterThan(0);
    expect(byName.map((d) => d.id)).toEqual(byCode.map((d) => d.id));
  });

  it("filters on hours and on the presence of a repo", () => {
    const big = catalogue.datasets({ minHours: 1000, hfOnly: true });
    for (const dataset of big) {
      expect(dataset.hoursNum ?? 0).toBeGreaterThanOrEqual(1000);
      expect(dataset.hfRepo).toBeTruthy();
    }
    const withHours = catalogue.datasets({ hasHours: true });
    expect(withHours.every((dataset) => dataset.hoursNum !== null)).toBe(true);
  });

  it("accepts comma separated values in a single string", () => {
    const combined = catalogue.datasets({ task: "ASR,TTS" });
    expect(combined.every((dataset) => ["ASR", "TTS"].includes(dataset.task))).toBe(true);
    expect(combined.length).toBe(
      catalogue.datasets({ task: "ASR" }).length + catalogue.datasets({ task: "TTS" }).length,
    );
  });

  it("builds the same predicate from the Filter builder", () => {
    const built = new Filter().language("Shona").commercial(true).task("ASR").toOptions();
    const viaBuilder = catalogue.datasets(
      new Filter().language("Shona").commercial(true).task("ASR"),
    );
    const viaOptions = catalogue.datasets(built);
    expect(viaBuilder.map((d) => d.id)).toEqual(viaOptions.map((d) => d.id));
    expect(new Filter().task("ASR").match(viaBuilder[0]!)).toBe(true);
  });

  it("matches nothing for an unknown value rather than everything", () => {
    expect(compileFilter({ language: "Klingon" })(catalogue.records[0]!)).toBe(false);
  });

  it("ignores punctuation and case when matching names", () => {
    const results = catalogue.datasets({ country: "cote divoire" });
    const canonical = catalogue.datasets({ country: "CI" });
    expect(results.map((d) => d.id)).toEqual(canonical.map((d) => d.id));
  });
});

describe("aggregates", () => {
  it("excludes unverified sizes from every hours total", () => {
    const unverified = catalogue.records.filter((record) => record.unverifiedSize);
    expect(unverified.length).toBe(3);
    for (const dataset of unverified) expect(countableHours(dataset)).toBe(0);

    const stats = catalogue.stats();
    const naive = catalogue.records.reduce((sum, record) => sum + (record.hoursNum ?? 0), 0);
    expect(stats.hours).toBeLessThan(naive);
    expect(stats.unverifiedExcluded).toBe(3);

    const inflated = unverified[0]!;
    const country = catalogue.countries().find((c) => c.iso2 === inflated.countryCodes[0]);
    expect(country?.hours ?? 0).toBeLessThan(inflated.hoursNum ?? Infinity);
  });

  it("counts datasets, languages, countries and repos", () => {
    const stats = catalogue.stats();
    expect(stats.datasets).toBe(611);
    expect(stats.hfRepos).toBe(283);
    expect(stats.languages).toBeGreaterThan(100);
    expect(stats.countries).toBeGreaterThan(40);
    expect(Object.values(stats.byTask).reduce((a, b) => a + b, 0)).toBe(611);
    expect(stats.byCommercial["Yes"]).toBe(204);
  });

  it("summarises countries, joined with the reference data", () => {
    const countries = catalogue.countries();
    const zw = countries.find((country) => country.iso2 === "ZW");
    expect(zw?.name).toBe("Zimbabwe");
    expect(zw?.region).toBe("Southern Africa");
    expect(zw?.datasets).toBeGreaterThan(0);
    expect(zw?.languages).toContain("Shona");
    // Island states have no polygon in the map data.
    const cv = countries.find((country) => country.iso2 === "CV");
    if (cv) expect(cv.mapName).toBeNull();
  });

  it("summarises languages by tag, joined with the reference data", () => {
    const languages = catalogue.languages();
    const shona = languages.find((language) => language.tag === "sna");
    expect(shona?.name).toBe("Shona");
    expect(shona?.slug).toBe("sna");
    expect(shona?.iso639_3).toBe("sna");
    expect(shona?.region).toBeNull();
    expect(shona?.datasets).toBeGreaterThan(0);
    expect(shona?.countries).toContain("Zimbabwe");
  });

  it("summarises a regional variety separately from the bare tag", () => {
    const languages = catalogue.languages();
    const nigerian = languages.find((language) => language.tag === "eng-NG");
    const english = languages.find((language) => language.tag === "eng");
    expect(nigerian?.region).toBe("NG");
    expect(nigerian?.iso639_3).toBe("eng");
    expect(english?.region).toBeNull();
    expect(nigerian?.datasets).not.toBe(english?.datasets);
  });

  it("collapses varieties onto bare codes for languageCodes()", () => {
    const codes = catalogue.languageCodes();
    const tags = catalogue.languages().map((language) => language.tag);
    expect(codes).toContain("eng");
    expect(codes.some((code) => code.includes("-"))).toBe(false);
    expect(codes.length).toBeLessThan(tags.length);
    expect([...codes].sort()).toEqual(codes);
    const stats = catalogue.stats();
    expect(stats.languages).toBe(tags.length);
    expect(stats.languageCodes).toBe(codes.length);
  });

  it("applies a filter before counting", () => {
    const all = catalogue.stats();
    const asr = catalogue.stats({ task: "ASR" });
    expect(asr.datasets).toBeLessThan(all.datasets);
    expect(asr.datasets).toBe(catalogue.datasets({ task: "ASR" }).length);
  });
});

describe("search", () => {
  it("ranks name matches above notes matches", () => {
    const results = catalogue.search("parliament");
    expect(results.length).toBeGreaterThan(0);
    const firstName = results[0]?.name.toLowerCase() ?? "";
    expect(firstName.includes("parliament")).toBe(true);
  });

  it("finds datasets by language and by repo", () => {
    expect(catalogue.search("Shona").length).toBeGreaterThan(0);
    expect(catalogue.search("google/fleurs")[0]?.hfRepo).toBe("google/fleurs");
  });

  it("returns everything for an empty query", () => {
    expect(catalogue.search("   ")).toHaveLength(611);
  });

  it("can be combined with a filter", () => {
    const results = catalogue.search("speech", { task: "TTS" });
    expect(results.every((dataset) => dataset.task === "TTS")).toBe(true);
  });
});

describe("fromApi", () => {
  it("pages through the HTTP API", async () => {
    const page = (n: number): Record<string, unknown> => ({
      data: [
        {
          id: `remote-${n}`,
          name: `Remote ${n}`,
          task: "ASR",
          languages: ["Shona"],
          languages_clean: ["Shona"],
          iso: ["sna"],
          countries: ["Zimbabwe"],
          country_codes: ["ZW"],
          regions: ["Southern Africa"],
          hours_num: 10,
          hf_repo: null,
        },
      ],
      meta: { page: n, per_page: 200, total: 2, total_pages: 2 },
    });
    const fake = fakeFetch([
      { match: "page=1", body: page(1) },
      { match: "page=2", body: page(2) },
    ]);
    const remote = await Catalogue.fromApi({ fetch: fake.fetch });
    expect(remote.records.map((record) => record.id)).toEqual(["remote-1", "remote-2"]);
    expect(fake.calls[0]).toContain("https://ngano.dev/api/v1/datasets?page=1&per_page=200");
    expect(remote.stats().hours).toBe(20);
  });

  it("raises a typed error when the API is unhappy", async () => {
    const fake = fakeFetch([{ match: "/datasets", status: 502, text: "bad gateway" }]);
    await expect(Catalogue.fromApi({ fetch: fake.fetch })).rejects.toMatchObject({
      name: "NganoHttpError",
      status: 502,
    });
  });
});
