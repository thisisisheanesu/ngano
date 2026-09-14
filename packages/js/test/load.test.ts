import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue.js";
import { NganoGatedError } from "../src/errors.js";
import { chooseSplits, configMatchesLanguage, load, loadDataset } from "../src/load.js";
import type { RawDataset, Row } from "../src/types.js";
import { fakeFetch, numberedRows, rowsBody, splitsBody } from "./helpers.js";

/**
 * Builds a tiny catalogue so the loader tests do not depend on the real one.
 *
 * @param overrides partial records to merge over the defaults
 * @returns a catalogue
 */
function testCatalogue(overrides: Array<Partial<RawDataset>> = []): Catalogue {
  const base: RawDataset[] = [
    {
      id: "alpha",
      name: "Alpha corpus",
      task: "ASR",
      variety: "Indigenous",
      languages: ["Shona"],
      languages_clean: ["Shona"],
      language_tags: ["sna"],
      language_codes: ["sna"],
      iso: ["sna"],
      countries: ["Zimbabwe"],
      country_codes: ["ZW"],
      regions: ["Southern Africa"],
      hours: "100",
      hours_num: 100,
      speakers: null,
      recording_type: "studio",
      quality: "Standard (16 kHz)",
      labelled: "Transcribed",
      domain: "Read speech",
      licence: "CC-BY-4.0",
      licence_class: "Attribution (CC-BY)",
      commercial: "Yes",
      access: "Open",
      host: "HuggingFace",
      url: "https://huggingface.co/datasets/test/alpha",
      hf_repo: "test/alpha",
      year: "2024",
      notes: null,
    },
    {
      id: "beta",
      name: "Beta corpus",
      task: "ASR",
      variety: "Indigenous",
      languages: ["Ndebele"],
      languages_clean: ["Northern Ndebele"],
      language_tags: ["nde"],
      language_codes: ["nde"],
      iso: ["nde"],
      countries: ["Zimbabwe"],
      country_codes: ["ZW"],
      regions: ["Southern Africa"],
      hours: "900",
      hours_num: 900,
      speakers: null,
      recording_type: "studio",
      quality: "Standard (16 kHz)",
      labelled: "Transcribed",
      domain: "Read speech",
      licence: "CC-BY-4.0",
      licence_class: "Attribution (CC-BY)",
      commercial: "Yes",
      access: "Open",
      host: "HuggingFace",
      url: "https://huggingface.co/datasets/test/beta",
      hf_repo: "test/beta",
      year: "2024",
      notes: null,
    },
  ];
  const merged = base.map((record, index) => ({ ...record, ...(overrides[index] ?? {}) }));
  return new Catalogue(merged);
}

/** Routes serving two datasets with endless pages of numbered rows. */
function twoDatasetRoutes(): Parameters<typeof fakeFetch>[0] {
  return [
    {
      match: "/splits",
      body: (params) => splitsBody(params.get("dataset") ?? "", [["default", "train"]]),
    },
    {
      match: "/first-rows",
      body: () =>
        rowsBody([{ sentence: "x", audio: null }], {
          features: [
            { name: "sentence", type: { dtype: "string", _type: "Value" } },
            { name: "audio", type: { _type: "Audio" } },
          ],
        }),
    },
    {
      match: "/rows",
      body: (params) => {
        const dataset = (params.get("dataset") ?? "").split("/")[1];
        const offset = Number(params.get("offset") ?? 0);
        const length = Number(params.get("length") ?? 100);
        const rows = numberedRows(length, offset).map((row, index) => ({
          ...row,
          sentence: `${dataset}-${offset + index}`,
        }));
        return rowsBody(rows, { total: 1000, offset });
      },
    },
  ];
}

/**
 * Collects up to `limit` transcripts from a stream.
 *
 * @param stream the stream
 * @param limit how many rows to take
 * @returns the transcripts
 */
async function take(stream: AsyncIterable<Row>, limit: number): Promise<string[]> {
  const out: string[] = [];
  for await (const row of stream) {
    out.push(row.transcript ?? "");
    if (out.length >= limit) break;
  }
  return out;
}

describe("load", () => {
  it("reports matched and loadable counts before any request", () => {
    const fake = fakeFetch([]);
    const catalogue = testCatalogue([{}, { hf_repo: null }]);
    const stream = load({ catalogue, country: "ZW", fetch: fake.fetch });
    expect(stream.matched).toBe(2);
    expect(stream.loadable).toBe(1);
    expect(stream.datasets.map((d) => d.id)).toEqual(["alpha"]);
    expect(fake.calls).toHaveLength(0);
  });

  it("streams unified rows with catalogue metadata attached", async () => {
    const fake = fakeFetch(twoDatasetRoutes());
    const stream = load({
      catalogue: testCatalogue(),
      id: "alpha",
      fetch: fake.fetch,
      limit: 1,
    });
    const rows = await stream.toArray();
    expect(rows).toHaveLength(1);
    const row = rows[0] as Row;
    expect(row.transcript).toBe("alpha-0");
    expect(row.hfRepo).toBe("test/alpha");
    expect(row.datasetId).toBe("alpha");
    expect(row.licence).toBe("CC-BY-4.0");
    expect(row.language).toBe("Shona");
    expect(row.languageTag).toBe("sna");
    expect(row.languageIso).toBe("sna");
    expect(row.country).toBe("ZW");
    expect(row.split).toBe("train");
    expect(row.sourceUrl).toBe("https://huggingface.co/datasets/test/alpha");
    expect(row.audio?.url).toContain("https://example.test/audio/");
  });

  it("interleaves round robin by default", async () => {
    const fake = fakeFetch(twoDatasetRoutes());
    const rows = await take(
      load({ catalogue: testCatalogue(), fetch: fake.fetch, pageSize: 2 }),
      6,
    );
    expect(rows).toEqual([
      "alpha-0",
      "beta-0",
      "alpha-1",
      "beta-1",
      "alpha-2",
      "beta-2",
    ]);
  });

  it("interleaves sequentially when asked", async () => {
    const fake = fakeFetch(twoDatasetRoutes());
    const rows = await take(
      load({
        catalogue: testCatalogue(),
        fetch: fake.fetch,
        interleave: "sequential",
        limit: 4,
        pageSize: 2,
      }),
      4,
    );
    expect(rows).toEqual(["alpha-0", "alpha-1", "alpha-2", "alpha-3"]);
  });

  it("weights by hours, excluding unverified figures", async () => {
    const fake = fakeFetch(twoDatasetRoutes());
    // alpha 100 hours, beta 900 hours, so roughly one alpha row per nine beta rows.
    const rows = await take(
      load({
        catalogue: testCatalogue(),
        fetch: fake.fetch,
        interleave: "weighted_by_hours",
        pageSize: 2,
      }),
      20,
    );
    const alpha = rows.filter((row) => row.startsWith("alpha")).length;
    const beta = rows.filter((row) => row.startsWith("beta")).length;
    expect(alpha).toBe(2);
    expect(beta).toBe(18);
  });

  it("treats an unverified dataset as unweighted rather than dominant", async () => {
    const fake = fakeFetch(twoDatasetRoutes());
    const catalogue = testCatalogue([
      {},
      { hours_num: 194_331, unverified_size: true },
    ]);
    const rows = await take(
      load({ catalogue, fetch: fake.fetch, interleave: "weighted_by_hours", pageSize: 2 }),
      10,
    );
    // Beta claims 194k hours but the figure is unverified, so it counts as
    // zero hours and gets the floor weight instead of swamping the schedule.
    expect(rows.filter((row) => row.startsWith("alpha")).length).toBe(10);
  });

  it("stops every in-flight pagination when the consumer breaks", async () => {
    const fake = fakeFetch(twoDatasetRoutes());
    const stream = load({ catalogue: testCatalogue(), fetch: fake.fetch });
    let count = 0;
    for await (const _row of stream) {
      count += 1;
      if (count === 3) break;
    }
    const before = fake.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.calls.length).toBe(before);
    // Two splits calls, two first-rows calls, two rows pages. Nothing more.
    expect(fake.calls.filter((url) => url.includes("/rows?")).length).toBe(2);
  });

  it("aborts through an external signal", async () => {
    const fake = fakeFetch(twoDatasetRoutes());
    const controller = new AbortController();
    const stream = load({
      catalogue: testCatalogue(),
      fetch: fake.fetch,
      signal: controller.signal,
    });
    const run = async (): Promise<number> => {
      let count = 0;
      for await (const _row of stream) {
        count += 1;
        if (count === 2) controller.abort();
      }
      return count;
    };
    await expect(run()).rejects.toMatchObject({ name: "AbortError" });
  });

  it("skips a failing dataset and records the error", async () => {
    const routes = twoDatasetRoutes();
    const fake = fakeFetch([
      { match: "dataset=test%2Fbeta", status: 500, text: "boom" },
      ...routes,
    ]);
    const stream = load({ catalogue: testCatalogue(), fetch: fake.fetch, maxRetries: 0, limit: 3 });
    const rows = await stream.toArray();
    expect(rows.every((row) => row.hfRepo === "test/alpha")).toBe(true);
    expect(stream.errors).toHaveLength(1);
    expect(stream.errors[0]?.source.hfRepo).toBe("test/beta");
  });

  it("throws the gated error when the only dataset is gated", async () => {
    const fake = fakeFetch([{ match: "/splits", status: 401, text: "gated" }]);
    const stream = load({ catalogue: testCatalogue(), id: "alpha", fetch: fake.fetch });
    await expect(stream.toArray()).rejects.toBeInstanceOf(NganoGatedError);
  });

  it("throws immediately with onError set to throw", async () => {
    const fake = fakeFetch([
      { match: "dataset=test%2Falpha", status: 401, text: "gated" },
      ...twoDatasetRoutes(),
    ]);
    const stream = load({ catalogue: testCatalogue(), fetch: fake.fetch, onError: "throw" });
    await expect(stream.toArray(5)).rejects.toBeInstanceOf(NganoGatedError);
  });

  it("calls an onError callback and keeps going", async () => {
    const seen: string[] = [];
    const fake = fakeFetch([
      { match: "dataset=test%2Fbeta", status: 500, text: "boom" },
      ...twoDatasetRoutes(),
    ]);
    const stream = load({
      catalogue: testCatalogue(),
      fetch: fake.fetch,
      maxRetries: 0,
      limit: 2,
      onError: (_error, source) => seen.push(source.hfRepo),
    });
    await stream.toArray();
    expect(seen).toEqual(["test/beta"]);
  });

  it("selects the datasets to stream by language tag", async () => {
    const fake = fakeFetch(twoDatasetRoutes());
    for (const value of ["sna", "SNA", "Shona"]) {
      const stream = load({ catalogue: testCatalogue(), language: value, fetch: fake.fetch });
      expect(stream.matched, value).toBe(1);
      expect(stream.datasets[0]?.id, value).toBe("alpha");
    }
    const none = load({ catalogue: testCatalogue(), language: "eng", fetch: fake.fetch });
    expect(none.matched).toBe(0);
  });

  it("yields nothing when no dataset matches", async () => {
    const fake = fakeFetch([]);
    const stream = load({ catalogue: testCatalogue(), language: "Klingon", fetch: fake.fetch });
    expect(stream.matched).toBe(0);
    expect(await stream.toArray()).toEqual([]);
    expect(fake.calls).toHaveLength(0);
  });
});

describe("loadDataset", () => {
  it("streams an uncatalogued repo and still fills the unified fields", async () => {
    const fake = fakeFetch([
      { match: "/splits", body: splitsBody("google/fleurs", [["sw_ke", "train"]]) },
      {
        match: "/first-rows",
        body: rowsBody([{ transcription: "habari", lang_id: "sw", audio: null }], {
          features: [
            { name: "transcription", type: { dtype: "string", _type: "Value" } },
            { name: "lang_id", type: { dtype: "string", _type: "Value" } },
            { name: "audio", type: { _type: "Audio" } },
          ],
        }),
      },
      {
        match: "/rows",
        body: rowsBody(
          [
            {
              transcription: "habari yako",
              lang_id: "sw",
              audio: [{ src: "https://example.test/x.wav", type: "audio/wav" }],
            },
          ],
          { total: 1 },
        ),
      },
    ]);
    const stream = loadDataset("google/fleurs", {
      config: "sw_ke",
      fetch: fake.fetch,
      catalogue: testCatalogue(),
    });
    const rows = await stream.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.transcript).toBe("habari yako");
    // "sw" is ISO 639-1, which the ISO 639-3 registry does not carry, so the
    // row's own value is kept and no tag is claimed for it.
    expect(rows[0]?.languageIso).toBe("sw");
    expect(rows[0]?.languageTag).toBeNull();
    expect(rows[0]?.hfRepo).toBe("google/fleurs");
    expect(rows[0]?.datasetId).toBeNull();
    expect(rows[0]?.sourceUrl).toBe("https://huggingface.co/datasets/google/fleurs");
    expect(fake.calls.some((url) => url.includes("config=sw_ke"))).toBe(true);
  });

  it("refuses an empty repo id", () => {
    expect(() => loadDataset("")).toThrow(/repo id/);
  });

  it("falls back to info when first-rows fails", async () => {
    const fake = fakeFetch([
      { match: "/splits", body: splitsBody("x/y", [["default", "train"]]) },
      { match: "/first-rows", status: 500, text: "boom" },
      {
        match: "/info",
        body: {
          dataset_info: {
            default: {
              features: { text: { dtype: "string", _type: "Value" }, waveform: { _type: "Audio" } },
            },
          },
        },
      },
      { match: "/rows", body: rowsBody([{ text: "hi", waveform: "a.wav" }], { total: 1 }) },
    ]);
    const rows = await loadDataset("x/y", {
      fetch: fake.fetch,
      maxRetries: 0,
      catalogue: testCatalogue(),
    }).toArray();
    expect(rows[0]?.transcript).toBe("hi");
    expect(rows[0]?.audio?.path).toBe("a.wav");
  });

  it("degrades to the first row's columns when discovery fails entirely", async () => {
    const fake = fakeFetch([
      { match: "/splits", body: splitsBody("x/y", [["default", "train"]]) },
      { match: "/first-rows", status: 500, text: "boom" },
      { match: "/info", status: 500, text: "boom" },
      { match: "/rows", body: rowsBody([{ sentence: "hi", mystery: 7 }], { total: 1 }) },
    ]);
    const rows = await loadDataset("x/y", {
      fetch: fake.fetch,
      maxRetries: 0,
      catalogue: testCatalogue(),
    }).toArray();
    expect(rows[0]?.transcript).toBe("hi");
    expect(rows[0]?.extra).toEqual({ mystery: 7 });
  });
});

describe("split and config choice", () => {
  const refs = [
    { config: "sn_zw", split: "train" },
    { config: "sn_zw", split: "test" },
    { config: "sw_ke", split: "train" },
    { config: "yo_ng", split: "train" },
  ];

  it("defaults to the train split of every config", () => {
    expect(chooseSplits(refs, {}, null)).toEqual([
      { config: "sn_zw", split: "train" },
      { config: "sw_ke", split: "train" },
      { config: "yo_ng", split: "train" },
    ]);
  });

  it("honours an explicit config and split", () => {
    expect(chooseSplits(refs, { config: "sn_zw", split: "test" }, null)).toEqual([
      { config: "sn_zw", split: "test" },
    ]);
  });

  it("takes every split with split all", () => {
    expect(chooseSplits(refs, { config: "sn_zw", split: "all" }, null)).toHaveLength(2);
  });

  it("narrows configs to the requested language", () => {
    expect(chooseSplits(refs, { iso: "sw" } as never, null)).toEqual([
      { config: "sw_ke", split: "train" },
    ]);
  });

  it("keeps every config when nothing matches the language", () => {
    expect(chooseSplits(refs, { iso: "zzz" } as never, null)).toHaveLength(3);
  });

  it("narrows configs from a tag, a bare code or a name alike", () => {
    const tagged = [
      { config: "sna", split: "train" },
      { config: "swh", split: "train" },
    ];
    for (const value of ["sna", "SNA", "Shona"]) {
      expect(chooseSplits(tagged, { language: value } as never, null), value).toEqual([
        { config: "sna", split: "train" },
      ]);
    }
  });

  it("narrows a regional tag to the config named after its region", () => {
    const regional = [
      { config: "en_ng", split: "train" },
      { config: "en_za", split: "train" },
    ];
    expect(chooseSplits(regional, { language: "eng-NG" } as never, null)).toEqual([
      { config: "en_ng", split: "train" },
    ]);
  });

  it("keeps every config when the language resolves to nothing", () => {
    expect(chooseSplits(refs, { language: "Klingon" } as never, null)).toHaveLength(3);
  });

  it("matches config names against language hints", () => {
    expect(configMatchesLanguage("sw_ke", new Set(["sw"]))).toBe(true);
    expect(configMatchesLanguage("shona", new Set(["shona"]))).toBe(true);
    expect(configMatchesLanguage("yo_ng", new Set(["sw"]))).toBe(false);
  });
});
