import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { transform } from "esbuild";
import { Catalogue } from "../src/catalogue.js";

/** The snippets document the website and the MCP tool serve for JavaScript. */
interface SnippetsDocument {
  language: string;
  install: string;
  placeholders: string[];
  snippets: Record<string, string>;
}

const document = JSON.parse(
  readFileSync(join(__dirname, "..", "snippets.json"), "utf8"),
) as SnippetsDocument;

/* Read the published name rather than hard-coding it, so a rename moves in one place. */
const PACKAGE_NAME = (
  JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as { name: string }
).name;

/** The placeholder tokens the consumer substitutes, and real values for them. */
const VALUES: Record<string, string> = {
  // A BCP 47 tag, never a display name: the catalogue is keyed on tags.
  "{{LANGUAGE}}": "sna",
  "{{COUNTRY_ISO2}}": "ZW",
  "{{COUNTRY_NAME}}": "Zimbabwe",
  "{{DATASET_ID}}": "fleurs-few-shot-learning-evaluation-of-universal-representations",
  "{{HF_REPO}}": "google/fleurs",
  "{{CONFIG}}": "sn_zw",
  "{{TASK}}": "ASR",
};

/**
 * Substitutes every placeholder with a real value.
 *
 * @param source snippet source
 * @returns the substituted source
 */
function substitute(source: string): string {
  let out = source;
  for (const [token, value] of Object.entries(VALUES)) {
    out = out.split(token).join(value);
  }
  return out;
}

describe("snippets.json", () => {
  it("declares the shape the website and MCP tool expect", () => {
    expect(document.language).toBe("javascript");
    expect(document.install).toBe(`npm install ${PACKAGE_NAME}`);
    expect(Object.keys(document.snippets).sort()).toEqual([
      "catalogue_filter",
      "cli",
      "country_page",
      "dataset_page",
      "language_page",
      "single_dataset",
      "stream_filter",
    ]);
    expect(document.placeholders).toEqual(Object.keys(VALUES));
  });

  it("uses only the agreed placeholder tokens", () => {
    for (const [name, source] of Object.entries(document.snippets)) {
      const found = source.match(/\{\{[A-Z_0-9]+\}\}/g) ?? [];
      for (const token of found) {
        expect(document.placeholders, `${name} uses ${token}`).toContain(token);
      }
    }
  });

  it("parses every JavaScript snippet after substitution", async () => {
    for (const [name, source] of Object.entries(document.snippets)) {
      if (name === "cli") continue;
      const code = substitute(source);
      // esbuild parses as an ES module, which `new Function` cannot do because
      // the snippets use top-level import and top-level await.
      await expect(
        transform(code, { loader: "ts", format: "esm", sourcefile: `${name}.mjs` }),
        `${name} must parse`,
      ).resolves.toBeTruthy();
    }
  });

  it("parses the expression bodies with new Function as well", async () => {
    for (const [name, source] of Object.entries(document.snippets)) {
      if (name === "cli") continue;
      // Strip the imports, wrap the rest in an async function body, and let the
      // engine itself parse it. A syntax error throws here.
      const body = substitute(source)
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("import "))
        .join("\n");
      expect(() => new Function(`return async () => {\n${body}\n};`), `${name}`).not.toThrow();
    }
  });

  it("only names APIs the package actually exports", async () => {
    const exported = new Set(Object.keys(await import("../src/index.js")));
    for (const [name, source] of Object.entries(document.snippets)) {
      if (name === "cli") continue;
      const imports = source.match(new RegExp(`import \\{([^}]+)\\} from "${PACKAGE_NAME}"`));
      expect(imports, `${name} must import from ${PACKAGE_NAME}`).not.toBeNull();
      for (const symbol of (imports?.[1] ?? "").split(",")) {
        const trimmed = symbol.trim();
        if (trimmed) expect(exported, `${name} imports ${trimmed}`).toContain(trimmed);
      }
    }
  });

  it("shows the stream counts and a bounded loop in stream_filter", () => {
    const source = document.snippets["stream_filter"] as string;
    expect(source).toContain("stream.matched");
    expect(source).toContain("stream.loadable");
    expect(source).toContain("for await (const row of stream)");
    expect(source).toMatch(/limit: \d+/);
  });

  it("uses values that exist in the real catalogue", () => {
    const cat = new Catalogue();
    expect(cat.get(VALUES["{{DATASET_ID}}"] as string)).toBeDefined();
    expect(cat.getByRepo(VALUES["{{HF_REPO}}"] as string)).toBeDefined();
    expect(cat.countries().some((c) => c.iso2 === VALUES["{{COUNTRY_ISO2}}"])).toBe(true);
    expect(cat.languages().some((l) => l.tag === VALUES["{{LANGUAGE}}"])).toBe(true);
  });

  it("uses {{LANGUAGE}} as a tag rather than a display name", () => {
    const cat = new Catalogue();
    const tag = VALUES["{{LANGUAGE}}"] as string;
    expect(cat.resolveLanguage(tag)).toEqual([tag]);
    // Every snippet that names a language names it the same way, and the value
    // substituted in is a tag the catalogue actually carries.
    for (const [name, source] of Object.entries(document.snippets)) {
      if (!source.includes("{{LANGUAGE}}")) continue;
      expect(source, `${name} must not label the placeholder a name`).not.toMatch(
        /name === "\{\{LANGUAGE\}\}"/,
      );
    }
    const page = substitute(document.snippets["language_page"] as string);
    expect(page).toContain(`entry.tag === "${tag}"`);
    expect(cat.datasets({ language: tag }).length).toBeGreaterThan(0);
  });

  it("keeps the CLI snippet to real commands and flags", () => {
    const source = substitute(document.snippets["cli"] as string);
    const commands = source
      .split("\n")
      .filter((line) => line.startsWith("ngano "))
      .map((line) => line.split(" ")[1]);
    for (const command of commands) {
      expect(["search", "show", "countries", "languages", "stats", "load"]).toContain(command);
    }
    expect(source).toContain("--out rows.jsonl");
    expect(source).toContain("--include-varieties");
    // The tag goes in bare, with no quotes, because a tag never has a space.
    expect(source).toContain(`--language ${VALUES["{{LANGUAGE}}"]}`);
  });
});
