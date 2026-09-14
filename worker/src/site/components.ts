/**
 * Shared building blocks: badges, dataset cards, facet breakdowns, and the small
 * derivations the pages need.
 *
 * Every total computed here skips records flagged `unverified_size`. Those are
 * self-reported figures of 20,000 hours or more that nobody has confirmed, so counting
 * them would swamp the real numbers. They are still listed, and still say so.
 */

import type { Dataset, Language, SiteContext } from './context';
import { esc, num, hours as fmtHours, clip, countBy, rankCounts, uniq } from './util';
import { barRow } from './layout';
import { languageChip, languageChips, resolveLanguage } from './languages';

/* ------------------------------------------------------------------ derivation */

/** Sum of stated hours, skipping unverified self-reported figures. */
export function sumHours(datasets: readonly Dataset[]): number {
  let total = 0;
  for (const dataset of datasets) {
    if (dataset.unverified_size) continue;
    if (typeof dataset.hours_num === 'number' && Number.isFinite(dataset.hours_num)) total += dataset.hours_num;
  }
  return total;
}

/** How many records in a list carry a self-reported figure that is left out of totals. */
export function countUnverified(datasets: readonly Dataset[]): number {
  return datasets.filter((dataset) => dataset.unverified_size).length;
}

/** Every record that names this country, by ISO-3166 alpha-2 code. */
export function datasetsForCountry(ctx: SiteContext, iso2: string): Dataset[] {
  const code = iso2.toUpperCase();
  return ctx.datasets.filter((dataset) => dataset.country_codes.includes(code));
}

/** Every record that carries this language's BCP 47 tag. */
export function datasetsForLanguage(ctx: SiteContext, language: Language): Dataset[] {
  return ctx.datasets.filter((dataset) => dataset.language_tags.includes(language.tag));
}

/** The tags a record covers, or an empty list when the source names none. */
export function tagsOf(dataset: Dataset): string[] {
  return dataset.language_tags;
}

/** Sort records by size, largest first, with unsized records last and named alphabetically. */
export function bySize(a: Dataset, b: Dataset): number {
  const left = a.hours_num ?? -1;
  const right = b.hours_num ?? -1;
  if (left !== right) return right - left;
  return a.name.localeCompare(b.name);
}

/** True when a record can be used commercially without buying it. */
export function isCommerciallyUsable(dataset: Dataset): boolean {
  return dataset.commercial === 'Yes' && dataset.access === 'Open';
}

/* ------------------------------------------------------------------ badges */

const ACCESS_CLASS: Record<string, string> = {
  Open: 'b-open',
  Request: 'b-request',
  Paid: 'b-paid',
  'Scrape required': 'b-scrape',
  Unclear: 'b-unclear',
};

/** What a licence class permits, in one plain sentence. */
export function licenceMeaning(dataset: Dataset): string {
  switch (dataset.commercial) {
    case 'Yes':
      return 'The licence as recorded allows commercial use, with whatever attribution or share-alike terms it names.';
    case 'Yes, if purchased':
      return 'Commercial use is allowed once the data has been bought under the vendor’s terms.';
    case 'No':
      return 'Commercial use is not allowed. Research and evaluation only, under the terms the source sets.';
    default:
      return 'The source does not state whether commercial use is allowed. Ask the publisher before relying on it.';
  }
}

export function accessBadge(dataset: Dataset): string {
  const cls = ACCESS_CLASS[dataset.access] ?? 'b-unclear';
  return `<span class="b ${cls}">${esc(dataset.access)}</span>`;
}

export function taskBadge(dataset: Dataset): string {
  return `<span class="b b-task">${esc(dataset.task)}</span>`;
}

export function commercialBadge(dataset: Dataset): string {
  if (dataset.commercial === 'No') return '<span class="b b-no">No commercial use</span>';
  if (dataset.commercial === 'Yes') return '<span class="b b-open">Commercial OK</span>';
  if (dataset.commercial === 'Yes, if purchased') return '<span class="b b-paid">Commercial if bought</span>';
  return '<span class="b b-var">Commercial unstated</span>';
}

export function unverifiedBadge(dataset: Dataset): string {
  return dataset.unverified_size ? '<span class="b b-flag">Unverified size</span>' : '';
}

export function badgeRow(dataset: Dataset): string {
  return `<div class="badges">${taskBadge(dataset)}${accessBadge(dataset)}${commercialBadge(dataset)}${unverifiedBadge(dataset)}</div>`;
}

/* ------------------------------------------------------------------ cards */

/** The hours column of a dataset card. */
function hoursCell(dataset: Dataset): string {
  if (dataset.hours_num === null) {
    return '<div class="hours none"><div class="n">Size not stated</div></div>';
  }
  const flagged = dataset.unverified_size;
  return `<div class="hours"><div class="n">${esc(fmtHours(dataset.hours_num))}</div><div class="u">${flagged ? 'hours, unverified' : 'hours'}</div></div>`;
}

export interface CardOptions {
  /** Hide the notes line on dense lists. */
  brief?: boolean;
}

/** One dataset in a list, linking to its own page. */
export function datasetCard(ctx: SiteContext, dataset: Dataset, options: CardOptions = {}): string {
  const tags = dataset.language_tags;
  const meta: string[] = [];
  if (tags.length > 0) {
    const shown = tags.slice(0, 4).map((tag) => languageChip(ctx, tag)).join('');
    meta.push(
      `<span class="m"><span class="lbl">Languages</span><span class="langs inline">${shown}</span>${tags.length > 4 ? ` and ${esc(num(tags.length - 4))} more` : ''}</span>`,
    );
  } else if (dataset.language_note) {
    meta.push(`<span class="m"><span class="lbl">Languages</span>${esc(clip(dataset.language_note, 120))}</span>`);
  } else if (dataset.languages.length > 0) {
    meta.push(
      `<span class="m"><span class="lbl">Languages</span>${esc(clip(dataset.languages.join(', '), 90))}</span>`,
    );
  }
  if (dataset.licence) meta.push(`<span class="m"><span class="lbl">Licence</span>${esc(dataset.licence)}</span>`);
  if (dataset.host) meta.push(`<span class="m"><span class="lbl">Host</span>${esc(dataset.host)}</span>`);
  if (dataset.year) meta.push(`<span class="m"><span class="lbl">Year</span>${esc(dataset.year)}</span>`);

  const notes =
    !options.brief && dataset.notes
      ? `<p class="notes">${esc(clip(dataset.notes, 260))}</p>`
      : '';

  return `<article class="card">
<div class="hd"><h4><a href="/datasets/${esc(encodeURIComponent(dataset.id))}">${esc(dataset.name)}</a></h4>${badgeRow(dataset)}</div>
${hoursCell(dataset)}
<div class="meta">${meta.join('')}</div>
${notes}
</article>`;
}

/** A list of dataset cards, or an honest empty state. */
export function datasetList(
  ctx: SiteContext,
  datasets: readonly Dataset[],
  emptyMessage: string,
  options: CardOptions = {},
): string {
  if (datasets.length === 0) return `<p class="note">${esc(emptyMessage)}</p>`;
  return `<div class="list">${datasets.map((dataset) => datasetCard(ctx, dataset, options)).join('')}</div>`;
}

/* ------------------------------------------------------------------ facets */

/** A ranked breakdown of a field across a set of records. */
export function facetBreakdown(
  datasets: readonly Dataset[],
  field: (dataset: Dataset) => string | null,
  limit = 8,
): string {
  const counts = rankCounts(countBy(datasets, field));
  if (counts.length === 0) return '<p class="note">Nothing recorded.</p>';
  const top = counts[0]?.count ?? 1;
  const rows = counts
    .slice(0, limit)
    .map((entry) => barRow(entry.value, num(entry.count), entry.count / top))
    .join('');
  const rest = counts.length > limit ? `<p class="note">and ${num(counts.length - limit)} more</p>` : '';
  return `<div class="brk">${rows}</div>${rest}`;
}

/**
 * Language chips linking to language pages. Keys may be tags or source spellings; each
 * resolves to its tag, which is shown beside the canonical name.
 */
export function languagePills(ctx: SiteContext, keys: readonly string[], limit = 40): string {
  return languageChips(ctx, uniq([...keys]), limit);
}

/** Hours apportioned to a language key, as `data/languages.json` records them. */
export function languageHours(ctx: SiteContext, key: string): number {
  return resolveLanguage(ctx, key)?.hours ?? 0;
}

/** Country chips linking to country pages. */
export function countryPills(ctx: SiteContext, names: readonly string[], limit = 60): string {
  const shown = uniq([...names]).slice(0, limit);
  if (shown.length === 0) return '<p class="note">No countries recorded.</p>';
  const pills = shown
    .map((name) => {
      const country = ctx.countries.find((entry) => entry.name === name || entry.iso2 === name);
      if (!country) return `<span class="pill flat">${esc(name)}</span>`;
      const stats = ctx.countryStats.get(country.iso2);
      const count = stats ? `<span class="c">${esc(num(stats.datasets))}</span>` : '';
      return `<a class="pill" href="/countries/${esc(country.iso2.toLowerCase())}">${esc(country.name)}${count}</a>`;
    })
    .join('');
  const rest = names.length > limit ? `<p class="note">and ${num(names.length - limit)} more</p>` : '';
  return `<div class="pills">${pills}</div>${rest}`;
}
