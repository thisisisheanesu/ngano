/**
 * The `ngano` command line interface.
 *
 * Argument parsing is done here rather than with a framework, so the published
 * package keeps its promise of zero runtime dependencies.
 *
 * @packageDocumentation
 */
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { Catalogue } from "./catalogue.js";
import { NganoError } from "./errors.js";
import type { FilterOptions } from "./filter.js";
import { load } from "./load.js";
import type { Dataset, InterleaveMode, Row } from "./types.js";
import { VERSION } from "./index.js";

/** A parsed command line. */
export interface ParsedArgs {
  /** The sub-command, for example `search`. */
  command: string;
  /** Positional arguments after the sub-command. */
  positional: string[];
  /** Flags, as strings, string lists or booleans. */
  flags: Record<string, string | string[] | boolean>;
}

/**
 * Parses argv into a command, positionals and flags.
 *
 * Supports `--flag`, `--no-flag`, `--key value`, `--key=value` and repeated
 * keys, which collect into an array. Everything after `--` is positional.
 *
 * @param argv arguments after the program name
 * @returns the parsed command line
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | string[] | boolean> = {};
  const positional: string[] = [];
  let command = "";
  let rest = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i] as string;
    if (rest) {
      positional.push(token);
      continue;
    }
    if (token === "--") {
      rest = true;
      continue;
    }
    if (token.startsWith("--")) {
      let name = token.slice(2);
      let value: string | boolean | undefined;
      const eq = name.indexOf("=");
      if (eq !== -1) {
        value = name.slice(eq + 1);
        name = name.slice(0, eq);
      }
      if (value === undefined) {
        if (name.startsWith("no-")) {
          name = name.slice(3);
          value = false;
        } else {
          const next = argv[i + 1];
          if (next !== undefined && !next.startsWith("--")) {
            value = next;
            i += 1;
          } else {
            value = true;
          }
        }
      }
      const key = camel(name);
      const existing = flags[key];
      if (existing === undefined) flags[key] = value;
      else if (Array.isArray(existing)) existing.push(String(value));
      else flags[key] = [String(existing), String(value)];
      continue;
    }
    if (token.startsWith("-") && token.length > 1) {
      const short: Record<string, string> = { q: "q", l: "limit", o: "out", h: "help", v: "version" };
      const name = short[token.slice(1)] ?? token.slice(1);
      const next = argv[i + 1];
      if (name === "help" || name === "version") flags[name] = true;
      else if (next !== undefined && !next.startsWith("-")) {
        flags[name] = next;
        i += 1;
      } else flags[name] = true;
      continue;
    }
    if (command === "") command = token;
    else positional.push(token);
  }

  return { command, positional, flags };
}

/**
 * Converts a flag name to camelCase, so `--min-hours` becomes `minHours`.
 *
 * @param name the flag name as typed
 * @returns the camelCase key
 */
function camel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

/**
 * Reads a flag as a string.
 *
 * @param flags parsed flags
 * @param key flag name
 * @returns the value, or undefined
 */
function str(flags: ParsedArgs["flags"], key: string): string | undefined {
  const value = flags[key];
  if (value === undefined || typeof value === "boolean") return undefined;
  return Array.isArray(value) ? value.join(",") : value;
}

/**
 * Reads a flag as a list, splitting comma-separated values.
 *
 * @param flags parsed flags
 * @param key flag name
 * @returns the values, or undefined
 */
function list(flags: ParsedArgs["flags"], key: string): string[] | undefined {
  const value = flags[key];
  if (value === undefined || typeof value === "boolean") return undefined;
  const parts = Array.isArray(value) ? value : [value];
  return parts.flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean);
}

/**
 * Reads a flag as a number.
 *
 * @param flags parsed flags
 * @param key flag name
 * @returns the value, or undefined when absent or not a number
 */
function num(flags: ParsedArgs["flags"], key: string): number | undefined {
  const value = str(flags, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Reads a flag as a boolean, accepting `--flag`, `--no-flag` and `--flag=true`.
 *
 * @param flags parsed flags
 * @param key flag name
 * @returns the value, or undefined
 */
function bool(flags: ParsedArgs["flags"], key: string): boolean | undefined {
  const value = flags[key];
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  const text = (Array.isArray(value) ? value[0] ?? "" : value).toLowerCase();
  if (["false", "no", "0"].includes(text)) return false;
  return true;
}

/**
 * Builds catalogue filter options from parsed flags.
 *
 * @param parsed the parsed command line
 * @returns filter options
 */
export function filterFromFlags(parsed: ParsedArgs): FilterOptions {
  const { flags } = parsed;
  const options: FilterOptions = {};
  const assign = <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]): void => {
    if (value !== undefined) options[key] = value;
  };
  assign("q", str(flags, "q"));
  assign("id", list(flags, "id"));
  assign("language", list(flags, "language"));
  assign("iso", list(flags, "iso"));
  assign("country", list(flags, "country"));
  assign("region", list(flags, "region"));
  assign("task", list(flags, "task"));
  assign("variety", list(flags, "variety"));
  assign("licenceClass", list(flags, "licenceClass"));
  assign("access", list(flags, "access"));
  assign("labelled", list(flags, "labelled"));
  assign("quality", list(flags, "quality"));
  assign("domain", list(flags, "domain"));
  assign("host", list(flags, "host"));
  assign("hfOnly", bool(flags, "hfOnly"));
  assign("hasHours", bool(flags, "hasHours"));
  assign("minHours", num(flags, "minHours"));
  assign("maxHours", num(flags, "maxHours"));
  assign("includePurchasable", bool(flags, "includePurchasable"));
  assign("includeVarieties", bool(flags, "includeVarieties"));
  const commercial = flags["commercial"];
  if (commercial !== undefined) {
    const asBool = bool(flags, "commercial");
    const asText = str(flags, "commercial");
    if (typeof commercial === "boolean" || asText === undefined) options.commercial = asBool;
    else if (["true", "yes-only", "1"].includes(asText.toLowerCase())) options.commercial = true;
    else if (["false", "0"].includes(asText.toLowerCase())) options.commercial = false;
    else options.commercial = [asText];
  }
  return options;
}

/** The help text, printed for `--help` and for an unknown command. */
export const HELP = `ngano ${VERSION} - a catalogue and loader for African-language speech datasets

Usage
  ngano search <query> [filters] [--json]      search the catalogue
  ngano show <id> [--json]                     show one dataset
  ngano countries [filters] [--json]           datasets and hours by country
  ngano languages [filters] [--json]           datasets and hours by language tag
  ngano stats [filters] [--json]               aggregate counts
  ngano load [filters] [--limit N] [--out f]   stream rows as JSON lines

Filters
  --language <tag|code|name>  repeatable, or comma separated. A BCP 47 tag such
                              as sna or eng-NG, a bare ISO 639-3 code, or any
                              catalogue spelling of the name
  --iso <code>             the code-shaped spelling of --language
  --include-varieties      widen a bare code to its regional varieties, so
                           --language eng also matches eng-NG
  --country <iso2|name>    repeatable
  --region <name>          for example "East Africa"
  --task <ASR|TTS|...>     dataset task
  --variety <name>         language variety grouping
  --commercial             only "Yes"
  --include-purchasable    widen --commercial to "Yes, if purchased"
  --licence-class <name>   licence family
  --access <name>          Open, Request, Paid, Scrape required, Unclear
  --labelled <name>        Transcribed, Unlabelled, Unstated
  --quality <name>         audio quality band
  --domain <name>          recording domain
  --host <name>            for example HuggingFace
  --hf-only                only datasets with a Hugging Face repo
  --min-hours <n>          published hours, inclusive
  --max-hours <n>          published hours, inclusive
  --has-hours              only datasets with a published hours figure

Load options
  --limit <n>              stop after n rows
  --out <file>             write JSON lines to a file instead of stdout
  --split <name>           default train, "all" for every split
  --config <name>          dataset config, "all" for every config
  --interleave <mode>      round_robin (default), sequential, weighted_by_hours
  --page-size <n>          rows per request, capped at 100
  --token <hf token>       Hugging Face token, defaults to HF_TOKEN
  --max-datasets <n>       cap on how many datasets are streamed

Global
  --json                   machine readable output
  --help, --version

Hours totals exclude self-reported figures of 20,000 hours or more, which the
catalogue flags as unverified. Catalogue data is CC-BY-4.0.
`;

/**
 * Formats a dataset as one text line for the search listing.
 *
 * @param dataset the dataset
 * @returns a single line
 */
function line(dataset: Dataset): string {
  const hours = dataset.unverifiedSize
    ? `${dataset.hoursNum ?? "?"}h unverified`
    : dataset.hoursNum !== null
      ? `${dataset.hoursNum}h`
      : "hours unstated";
  const tags = dataset.languageTags.length ? dataset.languageTags : dataset.languageCodes;
  const languages = tags.slice(0, 3).join(", ");
  const more = tags.length > 3 ? ` +${tags.length - 3}` : "";
  return [
    dataset.id.padEnd(44).slice(0, 44),
    dataset.task.padEnd(10),
    hours.padEnd(16),
    `${languages}${more}`,
  ].join("  ");
}

/**
 * Turns a row into a JSON-safe object. Audio stays lazy: only its locators are
 * written, never its bytes.
 *
 * @param row a unified row
 * @returns a plain object ready for `JSON.stringify`
 */
export function rowToJson(row: Row): Record<string, unknown> {
  return {
    ...row,
    audio: row.audio
      ? {
          url: row.audio.url,
          path: row.audio.path,
          samplingRate: row.audio.samplingRate,
          contentType: row.audio.contentType,
        }
      : null,
  };
}

/**
 * Runs the CLI.
 *
 * @param argv arguments after the program name
 * @param out where to write normal output, defaults to stdout
 * @returns the process exit code
 */
export async function run(
  argv: string[],
  out: (text: string) => void = (text) => process.stdout.write(text),
): Promise<number> {
  const parsed = parseArgs(argv);
  const { flags, positional } = parsed;

  if (flags["version"] === true) {
    out(`${VERSION}\n`);
    return 0;
  }
  if (parsed.command === "" || flags["help"] === true || parsed.command === "help") {
    out(HELP);
    return parsed.command === "" && flags["help"] !== true ? 1 : 0;
  }

  const json = bool(flags, "json") === true;
  const catalogue = new Catalogue();
  const filter = filterFromFlags(parsed);

  switch (parsed.command) {
    case "search": {
      const query = positional.join(" ") || str(flags, "q") || "";
      const results = query ? catalogue.search(query, filter) : catalogue.datasets(filter);
      const limit = num(flags, "limit") ?? results.length;
      const shown = results.slice(0, limit);
      if (json) {
        out(`${JSON.stringify({ count: results.length, data: shown }, null, 2)}\n`);
      } else {
        out(`${results.length} dataset${results.length === 1 ? "" : "s"}\n`);
        for (const dataset of shown) out(`${line(dataset)}\n`);
      }
      return 0;
    }

    case "show": {
      const id = positional[0];
      if (!id) {
        out("ngano show needs a dataset id.\n");
        return 2;
      }
      const dataset = catalogue.get(id) ?? catalogue.getByRepo(id);
      if (!dataset) {
        out(`Unknown dataset: ${id}\n`);
        return 1;
      }
      if (json) {
        out(`${JSON.stringify(dataset, null, 2)}\n`);
      } else {
        const rows: Array<[string, string]> = [
          ["id", dataset.id],
          ["name", dataset.name],
          ["task", dataset.task],
          ["languages", dataset.languagesClean.join(", ")],
          ["tags", dataset.languageTags.join(", ") || "none"],
          ["codes", dataset.languageCodes.join(", ") || "none"],
          ["countries", dataset.countries.join(", ")],
          ["hours", dataset.hours ?? "unstated"],
          ["speakers", String(dataset.speakers ?? "unstated")],
          ["quality", dataset.quality ?? "unstated"],
          ["labelled", dataset.labelled ?? "unstated"],
          ["licence", `${dataset.licence ?? "unstated"} (${dataset.licenceClass ?? "unclassified"})`],
          ["commercial", dataset.commercial ?? "unstated"],
          ["access", dataset.access ?? "unclear"],
          ["host", dataset.host ?? "unstated"],
          ["hf_repo", dataset.hfRepo ?? "none"],
          ["url", dataset.url ?? "none"],
          ["year", dataset.year ?? "unstated"],
        ];
        for (const [key, value] of rows) out(`${key.padEnd(12)} ${value}\n`);
        if (dataset.languageNote) out(`\n${dataset.languageNote}\n`);
        if (dataset.unverifiedSize) {
          out("\nThe published size is self-reported and excluded from hours totals.\n");
        }
        if (dataset.notes) out(`\n${dataset.notes}\n`);
      }
      return 0;
    }

    case "countries": {
      const summaries = catalogue.countries(filter);
      if (json) {
        out(`${JSON.stringify(summaries, null, 2)}\n`);
      } else {
        for (const country of summaries) {
          out(
            `${country.iso2}  ${country.name.padEnd(34).slice(0, 34)} ${String(country.datasets).padStart(4)} datasets  ${String(country.hours).padStart(10)} h\n`,
          );
        }
      }
      return 0;
    }

    case "languages": {
      const summaries = catalogue.languages(filter);
      const limit = num(flags, "limit") ?? summaries.length;
      if (json) {
        out(`${JSON.stringify(summaries.slice(0, limit), null, 2)}\n`);
      } else {
        for (const language of summaries.slice(0, limit)) {
          out(
            `${language.tag.padEnd(8)} ${language.iso639_3.padEnd(5)} ${language.name.padEnd(30).slice(0, 30)} ${String(language.datasets).padStart(4)} datasets  ${String(language.hours).padStart(10)} h\n`,
          );
        }
      }
      return 0;
    }

    case "stats": {
      const stats = catalogue.stats(filter);
      if (json) {
        out(`${JSON.stringify(stats, null, 2)}\n`);
      } else {
        out(`datasets        ${stats.datasets}\n`);
        out(`hours           ${stats.hours} (excluding ${stats.unverifiedExcluded} unverified)\n`);
        out(`languages       ${stats.languages} tags (${stats.languageCodes} ISO 639-3 codes)\n`);
        out(`countries       ${stats.countries}\n`);
        out(`on HuggingFace  ${stats.hfRepos}\n`);
        for (const [label, bucket] of [
          ["task", stats.byTask],
          ["access", stats.byAccess],
          ["commercial", stats.byCommercial],
          ["licence", stats.byLicenceClass],
        ] as Array<[string, Record<string, number>]>) {
          const parts = Object.entries(bucket)
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => `${key} ${value}`)
            .join(", ");
          out(`${label.padEnd(15)} ${parts}\n`);
        }
      }
      return 0;
    }

    case "load": {
      const interleave = (str(flags, "interleave") ?? "round_robin") as InterleaveMode;
      if (!["round_robin", "sequential", "weighted_by_hours"].includes(interleave)) {
        out(`Unknown interleave mode: ${interleave}\n`);
        return 2;
      }
      const stream = load({
        ...filter,
        interleave,
        ...(num(flags, "limit") !== undefined ? { limit: num(flags, "limit") as number } : {}),
        ...(num(flags, "pageSize") !== undefined
          ? { pageSize: num(flags, "pageSize") as number }
          : {}),
        ...(num(flags, "maxDatasets") !== undefined
          ? { maxDatasets: num(flags, "maxDatasets") as number }
          : {}),
        ...(list(flags, "split") ? { split: list(flags, "split") as string[] } : {}),
        ...(list(flags, "config") ? { config: list(flags, "config") as string[] } : {}),
        ...(str(flags, "token") ? { hfToken: str(flags, "token") as string } : {}),
        onError: "skip",
      });

      if (stream.loadable === 0) {
        out(
          `No loadable datasets. ${stream.matched} matched the filter, none of them has a Hugging Face repo.\n`,
        );
        return 1;
      }

      const target = str(flags, "out");
      const file = target ? createWriteStream(target, { encoding: "utf8" }) : null;
      /**
       * Writes one JSON line, honouring stream backpressure.
       *
       * @param text the line to write
       */
      const write = async (text: string): Promise<void> => {
        if (!file) {
          out(text);
          return;
        }
        if (!file.write(text)) await once(file, "drain");
      };

      let count = 0;
      try {
        for await (const row of stream) {
          await write(`${JSON.stringify(rowToJson(row))}\n`);
          count += 1;
        }
      } finally {
        if (file) {
          file.end();
          await once(file, "close");
        }
      }

      for (const failure of stream.errors) {
        const message = failure.error instanceof Error ? failure.error.message : String(failure.error);
        process.stderr.write(`skipped ${failure.source.hfRepo}: ${message}\n`);
      }
      if (target) out(`wrote ${count} rows to ${target}\n`);
      return count > 0 ? 0 : 1;
    }

    default:
      out(`Unknown command: ${parsed.command}\n\n`);
      out(HELP);
      return 2;
  }
}

/**
 * Entry point used by the `ngano` bin.
 *
 * @returns nothing, exits the process with the command's status
 */
async function main(): Promise<void> {
  // Piping into head or less closes stdout early. That is normal, not an error.
  process.stdout.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE") throw error;
  });
  try {
    process.exitCode = await run(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof NganoError || error instanceof Error ? error.message : String(error);
    process.stderr.write(`ngano: ${message}\n`);
    process.exitCode = 1;
  }
}

const entry = typeof process !== "undefined" ? (process.argv?.[1] ?? "") : "";
const entryName = entry.slice(entry.lastIndexOf("/") + 1);
// Only run when invoked as the bin, never when a test or app imports this file.
const isMain = entryName === "ngano" || entryName === "cli.js";

if (isMain) void main();
