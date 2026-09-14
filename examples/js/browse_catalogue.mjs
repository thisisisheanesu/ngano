#!/usr/bin/env node
/**
 * Browse the ngano catalogue from the command line.
 *
 *   node browse_catalogue.mjs --language Swahili --access Open
 *   node browse_catalogue.mjs --region "Horn of Africa" --labelled Unlabelled
 *   node browse_catalogue.mjs --country ZW --sort -hours --limit 10
 *   node browse_catalogue.mjs --stats
 *
 * No network, no token. Every package bundles a snapshot of the catalogue, so
 * search, filter and count all run offline. The network is only touched when
 * you ask for rows, which this example never does.
 *
 * Requires: npm install @thisisisheanesu/ngano
 */

import { Catalogue } from "@thisisisheanesu/ngano";

const FLAGS = [
  "language", "iso", "country", "region", "task", "variety",
  "commercial", "licenceClass", "access", "labelled", "quality",
  "domain", "host", "sort", "q",
];

function parseArgs(argv) {
  const options = { limit: 20 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (key === "stats" || key === "hfOnly" || key === "hasHours") {
      options[key] = true;
    } else if (key === "limit" || key === "minHours" || key === "maxHours") {
      options[key] = Number(argv[++i]);
    } else if (FLAGS.includes(key)) {
      options[key] = argv[++i];
    } else {
      console.error(`unknown option --${arg.slice(2)}`);
      process.exit(2);
    }
  }
  return options;
}

function formatHours(dataset) {
  if (dataset.hoursNum === null || dataset.hoursNum === undefined) return "unstated";
  const number = dataset.hoursNum.toLocaleString("en", { maximumFractionDigits: 0 });
  return dataset.unverifiedSize ? `${number} (unverified)` : number;
}

function printStats(catalogue) {
  const all = catalogue.all();
  const verified = all.filter((d) => !d.unverifiedSize);
  const hours = verified.reduce((sum, d) => sum + (d.hoursNum ?? 0), 0);
  const languages = new Set(all.flatMap((d) => d.languagesClean));
  const countries = new Set(
    all.flatMap((d) => d.countries).filter((c) => c !== "Pan-African"),
  );

  console.log(`datasets              ${all.length}`);
  console.log(`  flagged unverified  ${all.length - verified.length} (excluded from hours)`);
  console.log(`  with a stated size  ${verified.filter((d) => d.hoursNum).length}`);
  console.log(`  on the Hub          ${all.filter((d) => d.hfRepo).length}`);
  console.log(`verified hours        ${Math.round(hours).toLocaleString("en")}`);
  console.log(`languages             ${languages.size}`);
  console.log(`countries             ${countries.size}`);

  const byTask = new Map();
  for (const dataset of all) byTask.set(dataset.task, (byTask.get(dataset.task) ?? 0) + 1);
  console.log("\nby task");
  for (const [task, count] of [...byTask].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${task.padEnd(12)} ${String(count).padStart(4)}`);
  }
}

const { limit, stats, ...query } = parseArgs(process.argv.slice(2));
const catalogue = await Catalogue.load();

if (stats) {
  printStats(catalogue);
  process.exit(0);
}

const results = catalogue.search(query);

if (results.length === 0) {
  console.error("nothing matched that filter. Try a broader one, or see https://ngano.dev");
  process.exit(1);
}

const shown = results.slice(0, limit);
const counted = results.filter((d) => d.hoursNum && !d.unverifiedSize);
const total = counted.reduce((sum, d) => sum + d.hoursNum, 0);

console.log(
  `${results.length} dataset(s), ` +
    `${Math.round(total).toLocaleString("en")} verified hours across the ${counted.length} that state a size` +
    (shown.length < results.length ? `, showing ${shown.length}` : ""),
);
console.log("");

for (const dataset of shown) {
  console.log(dataset.name);
  console.log(`  id         ${dataset.id}`);
  console.log(`  languages  ${dataset.languagesClean.join(", ") || "none indexed"}`);
  console.log(`  countries  ${dataset.countries.join(", ")}`);
  console.log(`  hours      ${formatHours(dataset)}`);
  console.log(`  task       ${dataset.task}, ${dataset.labelled.toLowerCase()}, ${dataset.quality}`);
  console.log(`  access     ${dataset.access}, ${dataset.licence}, commercial: ${dataset.commercial}`);
  console.log(`  url        ${dataset.url ?? "no stable public page, see notes"}`);
  if (dataset.hfRepo) console.log(`  hf_repo    ${dataset.hfRepo}`);
  console.log("");
}

const needWork = results.filter((d) => d.access !== "Open").length;
if (needWork > 0) {
  console.log(
    `${needWork} of these need a request form, a purchase or a scrape before you can load anything.`,
  );
}
