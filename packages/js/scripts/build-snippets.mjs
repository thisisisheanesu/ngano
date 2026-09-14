/**
 * Generates `snippets.json`, the JavaScript code samples the ngano website and
 * the MCP `get_loader_snippet` tool serve.
 *
 * Writing them here, next to the SDK, keeps them in step with the shipped API
 * rather than invented elsewhere. `test/snippets.test.ts` substitutes real
 * values into every snippet and parses the result, so a stale sample fails CI.
 *
 * Placeholder tokens the consumer substitutes:
 * `{{LANGUAGE}}`, `{{COUNTRY_ISO2}}`, `{{COUNTRY_NAME}}`, `{{DATASET_ID}}`,
 * `{{HF_REPO}}`, `{{CONFIG}}`, `{{TASK}}`.
 *
 * `{{LANGUAGE}}` is a BCP 47 language tag such as `sna` or `eng-NG`, never a
 * display name. The SDK resolves names too, but the snippets show the tag
 * because that is what the catalogue is keyed on.
 */
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const snippets = {
  catalogue_filter: `import { Catalogue } from "@thisisisheanesu/ngano";

// The catalogue ships inside the package, so this needs no network.
const cat = new Catalogue();

// Languages are BCP 47 tags: sna is Shona, eng-NG is Nigerian English. A bare
// ISO 639-3 code, or any catalogue spelling of the name, resolves to one too.
const datasets = cat.datasets({
  language: "{{LANGUAGE}}",
  country: "{{COUNTRY_ISO2}}",
  task: "{{TASK}}",
  commercial: true,
  hfOnly: true,
});

for (const dataset of datasets) {
  console.log(dataset.id, dataset.languageTags, dataset.hoursNum, dataset.licence);
}
`,

  stream_filter: `import { load } from "@thisisisheanesu/ngano";

const stream = load({
  language: "{{LANGUAGE}}",
  country: "{{COUNTRY_ISO2}}",
  commercial: true,
  split: "train",
  interleave: "round_robin",
  limit: 1000,
  hfToken: process.env.HF_TOKEN,
});

// Counts are known before the first request is made.
console.log(stream.matched + " datasets matched, " + stream.loadable + " can be streamed");

for await (const row of stream) {
  console.log(row.transcript, row.languageTag, row.durationS);
  // Audio stays lazy until you ask for the bytes.
  // const bytes = await row.audio?.read();
}

for (const failure of stream.errors) {
  console.warn("skipped " + failure.source.hfRepo);
}
`,

  single_dataset: `import { loadDataset } from "@thisisisheanesu/ngano";

let count = 0;

for await (const row of loadDataset("{{HF_REPO}}", {
  config: "{{CONFIG}}",
  split: "train",
  hfToken: process.env.HF_TOKEN,
})) {
  console.log(row.transcript, row.audio?.url);
  count += 1;
  if (count >= 100) break; // breaking stops every request in flight
}
`,

  language_page: `import { Catalogue, load } from "@thisisisheanesu/ngano";

const cat = new Catalogue();

// Languages are keyed on BCP 47 tags: sna is Shona, eng-NG is Nigerian English.
// Hours exclude self-reported figures the catalogue flags as unverified.
const summary = cat.languages().find((entry) => entry.tag === "{{LANGUAGE}}");
console.log(summary?.name, summary?.datasets, summary?.hours, summary?.countries);

// Anything a caller might type resolves to the same tag, or to nothing at all.
console.log(cat.resolveLanguage("{{LANGUAGE}}"));

const stream = load({ language: "{{LANGUAGE}}", split: "train", limit: 200 });
for await (const row of stream) {
  console.log(row.transcript, row.languageTag);
}
`,

  country_page: `import { Catalogue } from "@thisisisheanesu/ngano";

const cat = new Catalogue();

const country = cat.countries().find((entry) => entry.iso2 === "{{COUNTRY_ISO2}}");
console.log("{{COUNTRY_NAME}}", country?.datasets, country?.hours, country?.languages);

for (const dataset of cat.datasets({ country: "{{COUNTRY_ISO2}}", hfOnly: true })) {
  console.log(dataset.id, dataset.task, dataset.hfRepo);
}
`,

  dataset_page: `import { Catalogue, loadDataset } from "@thisisisheanesu/ngano";

const cat = new Catalogue();
const dataset = cat.get("{{DATASET_ID}}");

console.log(dataset?.name, dataset?.licence, dataset?.access, dataset?.hfRepo);
if (dataset?.unverifiedSize) {
  console.log("Size is self-reported and excluded from hours totals.");
}

if (dataset?.hfRepo) {
  for await (const row of loadDataset(dataset.hfRepo, { split: "train", limit: 10 })) {
    console.log(row.transcript, row.languageTag, row.durationS);
  }
}
`,

  cli: `npm install -g @thisisisheanesu/ngano

# Languages are BCP 47 tags: sna, eng-NG, por-MZ. Names resolve to them too.
ngano search --language {{LANGUAGE}} --task {{TASK}} --commercial --limit 10
ngano show {{DATASET_ID}}
ngano countries --language {{LANGUAGE}}
ngano languages --limit 20
ngano languages --language {{LANGUAGE}} --include-varieties
ngano stats --json
ngano load --language {{LANGUAGE}} --country {{COUNTRY_ISO2}} --commercial \\
  --split train --limit 500 --out rows.jsonl
`,
};

const document = {
  language: "javascript",
  install: "npm install @thisisisheanesu/ngano",
  package: "@thisisisheanesu/ngano",
  runtimes: ["node>=18", "deno", "bun", "browser"],
  placeholders: [
    "{{LANGUAGE}}",
    "{{COUNTRY_ISO2}}",
    "{{COUNTRY_NAME}}",
    "{{DATASET_ID}}",
    "{{HF_REPO}}",
    "{{CONFIG}}",
    "{{TASK}}",
  ],
  snippets,
};

writeFileSync(join(pkgRoot, "snippets.json"), `${JSON.stringify(document, null, 2)}\n`);
process.stdout.write(`ngano: wrote snippets.json (${Object.keys(snippets).length} snippets)\n`);
