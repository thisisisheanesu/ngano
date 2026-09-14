import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HELP, filterFromFlags, parseArgs, rowToJson, run } from "../src/cli.js";
import { fakeFetch, numberedRows, rowsBody, splitsBody } from "./helpers.js";

/**
 * Runs the CLI and captures everything it wrote.
 *
 * @param argv arguments after the program name
 * @returns the exit code and the captured output
 */
async function cli(argv: string[]): Promise<{ code: number; text: string }> {
  let text = "";
  const code = await run(argv, (chunk) => {
    text += chunk;
  });
  return { code, text };
}

describe("parseArgs", () => {
  it("parses a command, positionals and flags", () => {
    const parsed = parseArgs(["search", "parliament", "--language", "Shona", "--json"]);
    expect(parsed.command).toBe("search");
    expect(parsed.positional).toEqual(["parliament"]);
    expect(parsed.flags["language"]).toBe("Shona");
    expect(parsed.flags["json"]).toBe(true);
  });

  it("parses key=value, negations and repeats", () => {
    const parsed = parseArgs(["load", "--limit=25", "--no-hf-only", "--language", "Shona", "--language", "Ndebele"]);
    expect(parsed.flags["limit"]).toBe("25");
    expect(parsed.flags["hfOnly"]).toBe(false);
    expect(parsed.flags["language"]).toEqual(["Shona", "Ndebele"]);
  });

  it("camelCases hyphenated flags and honours the -- terminator", () => {
    const parsed = parseArgs(["stats", "--min-hours", "10", "--", "--not-a-flag"]);
    expect(parsed.flags["minHours"]).toBe("10");
    expect(parsed.positional).toEqual(["--not-a-flag"]);
  });

  it("supports short flags", () => {
    const parsed = parseArgs(["search", "-q", "shona", "-l", "5"]);
    expect(parsed.flags["q"]).toBe("shona");
    expect(parsed.flags["limit"]).toBe("5");
  });
});

describe("filterFromFlags", () => {
  it("builds filter options from the command line", () => {
    const options = filterFromFlags(
      parseArgs(["search", "--language", "Shona,Ndebele", "--commercial", "--min-hours", "5", "--hf-only"]),
    );
    expect(options.language).toEqual(["Shona", "Ndebele"]);
    expect(options.commercial).toBe(true);
    expect(options.minHours).toBe(5);
    expect(options.hfOnly).toBe(true);
  });

  it("reads an explicit commercial value", () => {
    const options = filterFromFlags(parseArgs(["search", "--commercial", "Yes, if purchased"]));
    expect(options.commercial).toEqual(["Yes, if purchased"]);
  });
});

describe("catalogue commands", () => {
  it("prints help and exits non-zero with no command", async () => {
    const { code, text } = await cli([]);
    expect(code).toBe(1);
    expect(text).toBe(HELP);
  });

  it("prints help for --help", async () => {
    const { code, text } = await cli(["--help"]);
    expect(code).toBe(0);
    expect(text).toContain("ngano search");
  });

  it("searches and reports the count", async () => {
    const { code, text } = await cli(["search", "parliament", "--limit", "3"]);
    expect(code).toBe(0);
    expect(text).toMatch(/^\d+ datasets\n/);
    expect(text.trim().split("\n")).toHaveLength(4);
  });

  it("searches as JSON", async () => {
    const { text } = await cli(["search", "shona", "--json", "--limit", "1"]);
    const parsed = JSON.parse(text) as { count: number; data: Array<{ id: string }> };
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]?.id).toBeTruthy();
  });

  it("shows one dataset by id and by repo", async () => {
    const byRepo = await cli(["show", "google/fleurs", "--json"]);
    expect(byRepo.code).toBe(0);
    const dataset = JSON.parse(byRepo.text) as { id: string; hfRepo: string };
    expect(dataset.hfRepo).toBe("google/fleurs");
    const byId = await cli(["show", dataset.id]);
    expect(byId.code).toBe(0);
    expect(byId.text).toContain("google/fleurs");
  });

  it("reports an unknown dataset", async () => {
    const { code, text } = await cli(["show", "nope"]);
    expect(code).toBe(1);
    expect(text).toContain("Unknown dataset");
  });

  it("needs an id for show", async () => {
    const { code } = await cli(["show"]);
    expect(code).toBe(2);
  });

  it("lists countries and languages", async () => {
    const countries = await cli(["countries", "--json"]);
    const parsed = JSON.parse(countries.text) as Array<{ iso2: string; hours: number }>;
    expect(parsed.some((country) => country.iso2 === "ZW")).toBe(true);

    const languages = await cli(["languages", "--limit", "3"]);
    expect(languages.text.trim().split("\n")).toHaveLength(3);
  });

  it("lists language tags with their codes and names", async () => {
    const { code, text } = await cli(["languages", "--language", "eng-NG"]);
    expect(code).toBe(0);
    const lines = text.trim().split("\n");
    expect(lines[0]).toMatch(/^eng-NG\s+eng\s+English \(Nigeria\)/);

    const json = await cli(["languages", "--language", "sna", "--json"]);
    const parsed = JSON.parse(json.text) as Array<{
      tag: string;
      iso639_3: string;
      name: string;
      slug: string;
      region: string | null;
    }>;
    const shona = parsed.find((entry) => entry.tag === "sna");
    expect(shona).toMatchObject({ iso639_3: "sna", name: "Shona", slug: "sna", region: null });
  });

  it("takes a tag, a code or a name for --language", async () => {
    const byTag = await cli(["search", "--language", "sna", "--json"]);
    const count = (text: string): number => (JSON.parse(text) as { count: number }).count;
    expect(count(byTag.text)).toBeGreaterThan(0);
    for (const value of ["SNA", "Shona", "shona"]) {
      const other = await cli(["search", "--language", value, "--json"]);
      expect(count(other.text), value).toBe(count(byTag.text));
    }
    const unknown = await cli(["search", "--language", "Klingon", "--json"]);
    expect(count(unknown.text)).toBe(0);
  });

  it("widens a bare code with --include-varieties", async () => {
    const count = (text: string): number => (JSON.parse(text) as { count: number }).count;
    const bare = await cli(["search", "--language", "eng", "--json"]);
    const widened = await cli(["search", "--language", "eng", "--include-varieties", "--json"]);
    expect(count(widened.text)).toBeGreaterThan(count(bare.text));

    const off = await cli(["search", "--language", "eng", "--no-include-varieties", "--json"]);
    expect(count(off.text)).toBe(count(bare.text));
  });

  it("shows a dataset's tags and codes", async () => {
    const { text } = await cli(["show", "google/fleurs"]);
    expect(text).toMatch(/^tags\s+\S/m);
    expect(text).toMatch(/^codes\s+\S/m);
  });

  it("shows the language note on a record that names no language", async () => {
    const { code, text } = await cli(["show", "global-recordings-network-grn-audio-library"]);
    expect(code).toBe(0);
    expect(text).toMatch(/^tags\s+none/m);
    expect(text).toContain("ISO 639-3");
  });

  it("prints stats, excluding unverified hours", async () => {
    const { text } = await cli(["stats", "--json"]);
    const stats = JSON.parse(text) as { datasets: number; hours: number; unverifiedExcluded: number };
    expect(stats.datasets).toBe(611);
    expect(stats.unverifiedExcluded).toBe(3);
    expect(stats.hours).toBeGreaterThan(0);

    const plain = await cli(["stats"]);
    expect(plain.text).toContain("excluding 3 unverified");
  });

  it("rejects an unknown command", async () => {
    const { code, text } = await cli(["frobnicate"]);
    expect(code).toBe(2);
    expect(text).toContain("Unknown command");
  });

  it("prints the version", async () => {
    const { code, text } = await cli(["--version"]);
    expect(code).toBe(0);
    expect(text.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("load command", () => {
  const original = globalThis.fetch;

  beforeEach(() => {
    const fake = fakeFetch([
      {
        match: "/splits",
        body: (params) => splitsBody(params.get("dataset") ?? "", [["default", "train"]]),
      },
      {
        match: "/first-rows",
        body: rowsBody([{ sentence: "x", audio: null }], {
          features: [
            { name: "sentence", type: { dtype: "string", _type: "Value" } },
            { name: "audio", type: { _type: "Audio" } },
          ],
        }),
      },
      {
        match: "/rows",
        body: (params) => {
          const offset = Number(params.get("offset") ?? 0);
          return rowsBody(numberedRows(Number(params.get("length") ?? 100), offset), {
            total: 10_000,
            offset,
          });
        },
      },
    ]);
    globalThis.fetch = fake.fetch as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = original;
    vi.restoreAllMocks();
  });

  it("writes JSON lines to stdout, with audio left lazy", async () => {
    const { code, text } = await cli(["load", "--id", "fleurs-few-shot-learning-evaluation-of-universal-representations", "--limit", "2"]);
    expect(code).toBe(0);
    const lines = text.trim().split("\n");
    expect(lines).toHaveLength(2);
    const row = JSON.parse(lines[0] as string) as Record<string, unknown>;
    expect(row["transcript"]).toBe("row-0");
    expect(row["hfRepo"]).toBe("google/fleurs");
    expect(row["audio"]).toMatchObject({ url: expect.stringContaining("https://") });
    expect(Object.keys(row["audio"] as object)).toEqual([
      "url",
      "path",
      "samplingRate",
      "contentType",
    ]);
  });

  it("writes to a file with --out", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ngano-cli-"));
    const target = join(dir, "rows.jsonl");
    try {
      const { code, text } = await cli(["load", "--id", "fleurs-few-shot-learning-evaluation-of-universal-representations", "--limit", "3", "--out", target]);
      expect(code).toBe(0);
      expect(text).toContain("wrote 3 rows");
      const written = await readFile(target, "utf8");
      expect(written.trim().split("\n")).toHaveLength(3);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses an unknown interleave mode", async () => {
    const { code, text } = await cli(["load", "--interleave", "random"]);
    expect(code).toBe(2);
    expect(text).toContain("Unknown interleave mode");
  });

  it("says so when nothing matching can be loaded", async () => {
    const { code, text } = await cli(["load", "--language", "Klingon"]);
    expect(code).toBe(1);
    expect(text).toContain("No loadable datasets");
  });
});

describe("rowToJson", () => {
  it("keeps audio locators and drops the lazy methods", () => {
    const json = rowToJson({
      audio: {
        url: "https://example.test/a.wav",
        path: null,
        samplingRate: 16000,
        contentType: "audio/wav",
        bytes: null,
        read: async () => new Uint8Array(),
        blob: async () => new Blob([]),
      },
      transcript: "hi",
      language: null,
      languageIso: null,
      languageTag: null,
      country: null,
      speakerId: null,
      gender: null,
      age: null,
      durationS: null,
      samplingRate: 16000,
      domain: null,
      split: "train",
      datasetId: null,
      hfRepo: "a/b",
      licence: null,
      sourceUrl: null,
      extra: {},
    });
    expect(JSON.stringify(json)).toContain("a.wav");
    expect((json["audio"] as Record<string, unknown>)["read"]).toBeUndefined();
  });
});
