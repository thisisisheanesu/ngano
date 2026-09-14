import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue.js";
import { Filter, compileFilter } from "../src/filter.js";
import {
  LANGUAGE_TAGS,
  REGISTRY,
  canonicaliseTag,
  languageCode,
  languageName,
  primaryCode,
  resolveLanguage,
  resolveLanguages,
} from "../src/languages.js";

const catalogue = new Catalogue();

describe("the bundled registry", () => {
  it("ships every tag, keyed on itself", () => {
    expect(REGISTRY.version).toBe(1);
    expect(LANGUAGE_TAGS).toHaveLength(315);
    for (const tag of LANGUAGE_TAGS) {
      expect(REGISTRY.codes[tag]?.tag).toBe(tag);
    }
  });

  it("keys regional varieties on a lower-case code and an upper-case region", () => {
    const regional = LANGUAGE_TAGS.filter((tag) => tag.includes("-"));
    expect(regional).toHaveLength(27);
    for (const tag of regional) {
      const entry = REGISTRY.codes[tag];
      expect(tag).toBe(`${entry?.iso639_3}-${entry?.region}`);
      expect(entry?.region).toBe(entry?.region?.toUpperCase());
      expect(entry?.iso639_3).toBe(entry?.iso639_3.toLowerCase());
    }
  });
});

describe("canonicaliseTag", () => {
  it("lower-cases the primary subtag and upper-cases the region", () => {
    expect(canonicaliseTag("sna")).toBe("sna");
    expect(canonicaliseTag("SNA")).toBe("sna");
    expect(canonicaliseTag("eng-ng")).toBe("eng-NG");
    expect(canonicaliseTag("ENG-NG")).toBe("eng-NG");
    expect(canonicaliseTag("  Eng-Ng  ")).toBe("eng-NG");
  });

  it("accepts a UN M.49 area number as the region", () => {
    expect(canonicaliseTag("por-002")).toBe("por-002");
  });

  it("returns null for anything that is not tag-shaped", () => {
    expect(canonicaliseTag("Shona")).toBeNull();
    expect(canonicaliseTag("sw")).toBeNull();
    expect(canonicaliseTag("english-nigeria")).toBeNull();
    expect(canonicaliseTag("")).toBeNull();
  });
});

describe("rule a: an exact tag, case insensitively", () => {
  it("lands every casing on the same key", () => {
    for (const value of ["sna", "SNA", "Sna", " sna "]) {
      expect(resolveLanguage(value)).toEqual(["sna"]);
    }
    for (const value of ["eng-NG", "eng-ng", "ENG-NG", "Eng-Ng"]) {
      expect(resolveLanguage(value)).toEqual(["eng-NG"]);
    }
  });

  it("does not widen a bare code to its varieties by default", () => {
    expect(resolveLanguage("eng")).toEqual(["eng"]);
    expect(resolveLanguage("por")).toEqual(["por"]);
  });

  it("does not widen a variety to its siblings, even when asked", () => {
    expect(resolveLanguage("eng-NG", { includeVarieties: true })).toEqual(["eng-NG"]);
  });
});

describe("rule b: a bare code that only exists as varieties", () => {
  it("resolves to those varieties", () => {
    // German appears in the catalogue only as Namibian German.
    expect(REGISTRY.codes["deu"]).toBeUndefined();
    expect(resolveLanguage("deu")).toEqual(["deu-NA"]);
    expect(resolveLanguage("DEU")).toEqual(["deu-NA"]);
  });

  it("is the only case where a bare code widens without being asked", () => {
    for (const tag of LANGUAGE_TAGS) {
      if (tag.includes("-")) continue;
      expect(resolveLanguage(tag)).toEqual([tag]);
    }
  });
});

describe("rule c: a name from the aliases", () => {
  it("matches case insensitively, plain or slugified", () => {
    expect(resolveLanguage("Shona")).toEqual(["sna"]);
    expect(resolveLanguage("shona")).toEqual(["sna"]);
    expect(resolveLanguage("SHONA")).toEqual(["sna"]);
    expect(resolveLanguage("isiZulu")).toEqual(["zul"]);
    expect(resolveLanguage("Zulu")).toEqual(["zul"]);
    expect(resolveLanguage("English (Nigeria)")).toEqual(["eng-NG"]);
    expect(resolveLanguage("english-nigeria")).toEqual(["eng-NG"]);
  });

  it("widens a name to the varieties of its code when asked", () => {
    const widened = resolveLanguage("English", { includeVarieties: true });
    expect(widened[0]).toBe("eng");
    expect(widened).toContain("eng-NG");
    expect(widened.slice(1).every((tag) => tag.startsWith("eng-"))).toBe(true);
  });
});

describe("a tag always beats a name", () => {
  it("resolves the tem collision to Timne, not to Tem", () => {
    // `tem` is Timne's tag, and "Tem" is also the name of kdh.
    expect(REGISTRY.codes["tem"]?.name).toBe("Timne");
    expect(REGISTRY.codes["kdh"]?.name).toBe("Tem");
    expect(REGISTRY.name_to_tag["Tem"]).toBe("kdh");

    expect(resolveLanguage("tem")).toEqual(["tem"]);
    expect(resolveLanguage("Tem")).toEqual(["tem"]);
    expect(resolveLanguage("TEM")).toEqual(["tem"]);
    // Timne's own alias still reaches it, and kdh keeps its other spellings.
    expect(resolveLanguage("Temne")).toEqual(["tem"]);
    expect(resolveLanguage("kdh")).toEqual(["kdh"]);
  });

  it("prefers the tag for every three-letter name in the registry", () => {
    for (const [name, tag] of Object.entries(REGISTRY.name_to_tag)) {
      const canonical = canonicaliseTag(name);
      if (!canonical || !REGISTRY.codes[canonical] || canonical === tag) continue;
      expect(resolveLanguage(name)).toEqual([canonical]);
    }
  });
});

describe("includeVarieties", () => {
  it("yields the bare tag first, then the varieties in registry document order", () => {
    const tags = resolveLanguage("eng", { includeVarieties: true });
    const inRegistry = LANGUAGE_TAGS.filter((tag) => tag === "eng" || tag.startsWith("eng-"));
    expect(tags).toEqual(["eng", ...inRegistry.filter((tag) => tag !== "eng")]);
    expect(tags[0]).toBe("eng");
    expect(new Set(tags).size).toBe(tags.length);
    // The registry does not list the bare tag first, so this is a real reorder.
    expect(inRegistry[0]).not.toBe("eng");
  });

  it("widens a name the same way it widens the code", () => {
    expect(resolveLanguage("English", { includeVarieties: true })).toEqual(
      resolveLanguage("eng", { includeVarieties: true }),
    );
  });

  it("does not widen a name that resolves to a regional tag", () => {
    expect(resolveLanguage("English (Nigeria)", { includeVarieties: true })).toEqual(["eng-NG"]);
    expect(resolveLanguage("english-nigeria", { includeVarieties: true })).toEqual(["eng-NG"]);
  });

  it("changes nothing for a code with no varieties", () => {
    expect(resolveLanguage("sna", { includeVarieties: true })).toEqual(["sna"]);
  });
});

describe("unresolvable input", () => {
  it("yields no matches rather than a guess", () => {
    for (const value of ["Klingon", "zzz", "zzz-ZZ", "", "   ", "multiple", "various"]) {
      expect(resolveLanguage(value)).toEqual([]);
    }
  });

  it("never invents a tag outside the registry", () => {
    const known = new Set(LANGUAGE_TAGS);
    for (const value of ["sna", "Shona", "eng-ng", "deu", "Temne", "isiZulu"]) {
      for (const tag of resolveLanguage(value)) expect(known.has(tag)).toBe(true);
    }
  });
});

describe("resolveLanguages", () => {
  it("deduplicates while preserving order", () => {
    expect(resolveLanguages(["Shona", "sna", "SNA", "isiZulu"])).toEqual(["sna", "zul"]);
  });

  it("drops what does not resolve and keeps what does", () => {
    expect(resolveLanguages(["Klingon", "sna"])).toEqual(["sna"]);
    expect(resolveLanguages(["Klingon"])).toEqual([]);
  });
});

describe("registry helpers", () => {
  it("reads the bare code off a tag", () => {
    expect(primaryCode("sna")).toBe("sna");
    expect(primaryCode("eng-NG")).toBe("eng");
  });

  it("names a tag, falling back to the tag itself", () => {
    expect(languageName("sna")).toBe("Shona");
    expect(languageName("eng-NG")).toBe("English (Nigeria)");
    expect(languageName("zzz")).toBe("zzz");
    expect(languageCode("ENG-ng")?.tag).toBe("eng-NG");
    expect(languageCode("zzz")).toBeUndefined();
  });
});

describe("filtering on tags", () => {
  it("finds the same datasets for a tag, a code and every spelling of the name", () => {
    const byTag = catalogue.datasets({ language: "sna" }).map((d) => d.id);
    expect(byTag.length).toBeGreaterThan(0);
    for (const value of ["SNA", " sna ", "Shona", "shona"]) {
      expect(catalogue.datasets({ language: value }).map((d) => d.id)).toEqual(byTag);
    }
    expect(catalogue.datasets({ iso: "sna" }).map((d) => d.id)).toEqual(byTag);
  });

  it("keeps back-compat with the old free-text names", () => {
    const byName = catalogue.datasets({ language: "isiZulu" }).map((d) => d.id);
    expect(byName.length).toBeGreaterThan(0);
    expect(catalogue.datasets({ language: "zul" }).map((d) => d.id)).toEqual(byName);
    for (const dataset of catalogue.datasets({ language: "isiZulu" })) {
      expect(dataset.languageTags).toContain("zul");
    }
  });

  it("keeps a bare code apart from its regional varieties", () => {
    const bare = catalogue.datasets({ language: "eng" }).map((d) => d.id);
    const nigerian = catalogue.datasets({ language: "eng-NG" }).map((d) => d.id);
    expect(bare.length).toBeGreaterThan(0);
    expect(nigerian.length).toBeGreaterThan(0);
    expect(bare).not.toEqual(nigerian);
    // A record may carry both tags, but the bare filter never pulls in a record
    // that carries only the variety.
    for (const dataset of catalogue.datasets({ language: "eng" })) {
      expect(dataset.languageTags).toContain("eng");
    }
    const varietyOnly = catalogue
      .datasets({ language: "eng-NG" })
      .filter((dataset) => !dataset.languageTags.includes("eng"));
    expect(varietyOnly.length).toBeGreaterThan(0);
    for (const dataset of varietyOnly) expect(bare).not.toContain(dataset.id);

    const widened = catalogue.datasets({ language: "eng", includeVarieties: true }).map((d) => d.id);
    for (const id of [...bare, ...nigerian]) expect(widened).toContain(id);
  });

  it("resolves eng-ng and ENG-NG to the same datasets", () => {
    const canonical = catalogue.datasets({ language: "eng-NG" }).map((d) => d.id);
    expect(catalogue.datasets({ language: "eng-ng" }).map((d) => d.id)).toEqual(canonical);
    expect(catalogue.datasets({ language: "ENG-NG" }).map((d) => d.id)).toEqual(canonical);
  });

  it("matches nothing at all for an unresolvable language", () => {
    expect(catalogue.datasets({ language: "Klingon" })).toHaveLength(0);
    expect(compileFilter({ language: "Klingon" })(catalogue.records[0]!)).toBe(false);
    // An unresolvable value must not quietly widen the result set either.
    expect(catalogue.datasets({ language: ["Klingon", "sna"] }).map((d) => d.id)).toEqual(
      catalogue.datasets({ language: "sna" }).map((d) => d.id),
    );
  });

  it("ORs several languages within the one field", () => {
    const shona = catalogue.datasets({ language: "sna" }).map((d) => d.id);
    const zulu = catalogue.datasets({ language: "zul" }).map((d) => d.id);
    const both = catalogue.datasets({ language: ["sna", "zul"] }).map((d) => d.id);
    expect(new Set(both)).toEqual(new Set([...shona, ...zulu]));
  });

  it("takes the same values through the Filter builder", () => {
    const built = catalogue.datasets(new Filter().language("Shona").task("ASR"));
    const plain = catalogue.datasets({ language: "sna", task: "ASR" });
    expect(built.map((d) => d.id)).toEqual(plain.map((d) => d.id));

    const widened = catalogue.datasets(new Filter().language("eng").includeVarieties());
    expect(widened.length).toBeGreaterThan(catalogue.datasets({ language: "eng" }).length);
  });

  it("accepts comma-separated tags in a single string", () => {
    const combined = catalogue.datasets({ language: "sna,zul" }).map((d) => d.id);
    const listed = catalogue.datasets({ language: ["sna", "zul"] }).map((d) => d.id);
    expect(combined).toEqual(listed);
  });
});

describe("records that name no language", () => {
  it("carry a languageNote and no tags", () => {
    const noted = catalogue.records.filter((record) => record.languageNote !== undefined);
    expect(noted).toHaveLength(11);
    for (const record of noted) {
      expect(record.languageTags).toHaveLength(0);
      expect(record.languageCodes).toHaveLength(0);
      expect(record.languageNote).toBeTruthy();
      expect(record.languages.length).toBeGreaterThan(0);
    }
    const grn = catalogue.get("global-recordings-network-grn-audio-library");
    expect(grn?.languageNote).toContain("ISO 639-3");
  });

  it("are never returned by a language filter", () => {
    const noted = new Set(
      catalogue.records.filter((r) => r.languageNote !== undefined).map((r) => r.id),
    );
    for (const tag of ["sna", "eng", "zul"]) {
      for (const dataset of catalogue.datasets({ language: tag })) {
        expect(noted.has(dataset.id)).toBe(false);
      }
    }
  });
});

describe("Catalogue.resolveLanguage", () => {
  it("exposes the same resolver the filters use", () => {
    expect(catalogue.resolveLanguage("isiZulu")).toEqual(["zul"]);
    expect(catalogue.resolveLanguage("ENG-ng")).toEqual(["eng-NG"]);
    expect(catalogue.resolveLanguage("Klingon")).toEqual([]);
    expect(catalogue.resolveLanguage("eng", { includeVarieties: true })).toEqual(
      resolveLanguage("eng", { includeVarieties: true }),
    );
  });
});
