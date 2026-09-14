#!/usr/bin/env node
/**
 * Stream rows from a filtered slice of the ngano catalogue into JSON Lines.
 *
 *   node stream_to_jsonl.mjs --language Yoruba --limit 500 --out yoruba.jsonl
 *   node stream_to_jsonl.mjs --country GH --split test --out ghana-test.jsonl
 *
 * Rows stream and multi-dataset loads interleave lazily, so breaking after N
 * rows genuinely stops the download rather than finishing it quietly. The
 * `audio` field stays a lazy handle, so a large manifest costs no audio
 * bandwidth. Decode later, from the url or path in each row.
 *
 * Gated repos need a Hugging Face token:
 *
 *   export HF_TOKEN="hf_..."
 *
 * Datasets whose access is Request, Paid or Scrape required are skipped. A
 * token will not help with those, someone has to ask or pay first.
 *
 * Requires: npm install ngano
 */

import { createWriteStream } from "node:fs";
import { once } from "node:events";
import process from "node:process";

import { Catalogue, load } from "ngano";

const SKIPPABLE = new Set(["Request", "Paid", "Scrape required", "Unclear"]);

function parseArgs(argv) {
  const options = { limit: 1000, split: "train", out: "rows.jsonl" };
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const value = argv[++i];
    if (key === "limit") options.limit = Number(value);
    else if (key === "split") options.split = value;
    else if (key === "out") options.out = value;
    else options[key] = value;
  }
  return options;
}

const { limit, split, out, ...filters } = parseArgs(process.argv.slice(2));

const catalogue = await Catalogue.load();
const matched = catalogue.search({ ...filters, hfOnly: true });

if (matched.length === 0) {
  console.error("nothing matched that filter on the Hub. See https://ngano.dev");
  process.exit(1);
}

const loadable = matched.filter((d) => !SKIPPABLE.has(d.access));
for (const dataset of matched.filter((d) => SKIPPABLE.has(d.access))) {
  console.error(`skipping ${dataset.id}: access is ${dataset.access}`);
}

if (loadable.length === 0) {
  console.error("every match needs a request, a purchase or a scrape");
  process.exit(1);
}

if (!process.env.HF_TOKEN) {
  console.error("HF_TOKEN is not set. Gated repos in this selection will fail.");
}

const counted = loadable.filter((d) => d.hoursNum && !d.unverifiedSize);
console.error(
  `${loadable.length} dataset(s), ` +
    `${Math.round(counted.reduce((s, d) => s + d.hoursNum, 0)).toLocaleString("en")} verified hours`,
);

const stream = createWriteStream(out, { encoding: "utf8" });
let written = 0;

for await (const row of load(loadable, { split })) {
  // Keep the lazy handle, drop any materialised bytes so the file stays small.
  const { bytes, ...audio } = row.audio ?? {};
  const line = JSON.stringify({ ...row, audio });
  if (!stream.write(line + "\n")) await once(stream, "drain");
  written += 1;
  if (written % 250 === 0) console.error(`  ${written} rows`);
  if (written >= limit) break;
}

stream.end();
await once(stream, "finish");
console.error(`wrote ${written} rows to ${out}`);
