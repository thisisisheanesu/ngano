/**
 * A country page: what exists for one country, grouped by task, with its languages,
 * its licence mix, and the languages the catalogue reaches but cannot size.
 */

import type { Dataset, SiteContext } from './context';
import { page, crumbs, bigNumber, barRow } from './layout';
import { renderLocator } from './map';
import { snippetTabs, varsForCountry } from './snippets';
import { esc, num, hours as fmtHours, plural, groupBy, rankCounts, countBy, uniq } from './util';
import {
  datasetList,
  datasetsForCountry,
  bySize,
  sumHours,
  countUnverified,
  isCommerciallyUsable,
  facetBreakdown,
} from './components';
import { languageForTag, languageHref } from './languages';
import { icon } from './icons';

const TASK_ORDER = ['ASR', 'ASR+TTS', 'TTS', 'Raw source', 'Other'];

export function renderCountry(ctx: SiteContext, iso2: string): string | null {
  const key = iso2.trim().toUpperCase();
  const country = ctx.byIso2.get(key);
  if (!country) return null;

  const stats = ctx.countryStats.get(country.iso2);
  const datasets = datasetsForCountry(ctx, country.iso2).sort(bySize);
  const hoursHere = sumHours(datasets);
  const unverified = countUnverified(datasets);
  const commercial = datasets.filter(isCommerciallyUsable);
  /*
   * Languages are held as BCP 47 tags here, never as names, so a country-specific
   * variety like `eng-NG` cannot be folded into plain English by a display string.
   */
  const languageTags = uniq([...(stats?.language_tags ?? datasets.flatMap((d) => d.language_tags))]).sort(
    (a, b) => hoursOf(ctx, b) - hoursOf(ctx, a) || nameOf(ctx, a).localeCompare(nameOf(ctx, b)),
  );

  /*
   * A language reaches this country through the catalogue but has no published size
   * behind it here: every record that covers it for this country states no hours.
   * That is a different gap from "no dataset at all" and worth naming separately.
   */
  const unsized = languageTags
    .filter((tag) => {
      const forLanguage = datasets.filter((d) => d.language_tags.includes(tag));
      return forLanguage.length > 0 && forLanguage.every((d) => d.hours_num === null);
    })
    .sort((a, b) => nameOf(ctx, a).localeCompare(nameOf(ctx, b)));

  const byTask = groupBy(datasets, (d) => d.task);
  const taskOrder = [...byTask.keys()].sort((a, b) => {
    const left = TASK_ORDER.indexOf(a);
    const right = TASK_ORDER.indexOf(b);
    return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
  });

  const licences = rankCounts(countBy(datasets, (d) => d.licence_class));
  const topLicence = licences[0]?.count ?? 1;

  const taskSections = taskOrder
    .map((task) => {
      const group = (byTask.get(task) ?? []).slice().sort(bySize);
      return `<section class="block">
<h2 class="sec">${esc(task)} <span style="font-family:var(--font-mono);font-size:12px;color:var(--muted);font-weight:400">${esc(plural(group.length, 'dataset', 'datasets'))}</span></h2>
${datasetList(ctx, group, 'Nothing recorded.')}
</section>`;
    })
    .join('');

  const body = `
${crumbs([{ href: '/', label: 'ngano' }, { href: '/map', label: 'Map' }, { label: country.name }])}

<div class="rowsplit" style="margin-bottom:26px">
  <div>
    <h1 class="title" style="margin-bottom:6px">${esc(country.name)}</h1>
    <p class="lede" style="margin-bottom:14px">${esc(country.region)} &middot; <code class="inl">${esc(country.iso2)}</code> <code class="inl">${esc(country.iso3)}</code></p>
    ${
      datasets.length === 0
        ? `<div class="callout warn"><strong>Nothing found for ${esc(country.name)}.</strong> The sweep behind ngano turned up no speech corpus recorded against this country. That is a statement about what is findable and published, not proof that no recordings exist. If you know of one, the catalogue is open to corrections through the repository.</div>`
        : `<p class="lede" style="font-size:15px">${esc(plural(datasets.length, 'dataset points', 'datasets point'))} at ${esc(country.name)}, covering ${esc(plural(languageTags.length, 'language', 'languages'))}. ${
            commercial.length > 0
              ? `${esc(plural(commercial.length, 'of them is', 'of them are'))} openly licensed for commercial use.`
              : 'None of them is both openly accessible and licensed for commercial use.'
          }</p>`
    }
  </div>
  <div style="display:flex;justify-content:flex-end">${renderLocator(ctx, country)}</div>
</div>

<section class="block panel">
  <div class="bignums">
    ${bigNumber(num(datasets.length), 'datasets')}
    ${bigNumber(fmtHours(hoursHere), 'hours of audio', true)}
    ${bigNumber(num(languageTags.length), 'languages')}
    ${bigNumber(num(datasets.filter((d) => d.access === 'Open').length), 'open access')}
    ${bigNumber(num(commercial.length), 'commercially usable')}
  </div>
  ${
    unverified > 0
      ? `<p class="note">${esc(plural(unverified, 'record here carries', 'records here carry'))} a self-reported size of 20,000 hours or more. Those figures are shown on the record but left out of the total above.</p>`
      : ''
  }
</section>

${
  languageTags.length > 0
    ? `<section class="block">
  <h2 class="sec">Languages recorded here</h2>
  <p class="note" style="margin-bottom:12px">Keyed on the BCP 47 tag the loader filters on, largest first. Hours are that language's total across the whole catalogue, not only within ${esc(country.name)}. A pan-African corpus contributes every language it carries to every country it names, so this list is wider than what was collected in ${esc(country.name)}.</p>
  ${languageTable(ctx, languageTags, datasets)}
</section>`
    : ''
}

${
  unsized.length > 0
    ? `<section class="block panel">
  <h2 class="sec">Languages with no data found</h2>
  <p class="note" style="margin-bottom:12px">These languages reach ${esc(country.name)} through the catalogue, but every record covering them here publishes no size at all. There is a pointer, and no measured audio behind it.</p>
  <div class="langs">${unsized
    .map((tag) => {
      const language = languageForTag(ctx, tag);
      return language
        ? `<a class="lang" href="${esc(languageHref(language))}">${esc(language.name)}<code class="tag">${esc(language.tag)}</code></a>`
        : `<span class="lang flat">${esc(tag)}<code class="tag">no code</code></span>`;
    })
    .join('')}</div>
</section>`
    : ''
}

${
  datasets.length > 0
    ? `<section class="block">
  <h2 class="sec">Licence mix</h2>
  <div class="grid g2">
    <div class="panel">
      <h3 class="sub">Licence family</h3>
      <div class="brk">${licences
        .slice(0, 8)
        .map((entry) => barRow(entry.value, num(entry.count), entry.count / topLicence))
        .join('')}</div>
    </div>
    <div class="panel">
      <h3 class="sub">Access route</h3>
      ${facetBreakdown(datasets, (d) => d.access, 6)}
      <h3 class="sub" style="margin-top:16px">Labelling</h3>
      ${facetBreakdown(datasets, (d) => d.labelled, 4)}
    </div>
  </div>
</section>`
    : ''
}

${taskSections}

${
  datasets.some((d) => d.hf_repo)
    ? `<section class="block">
  <h2 class="sec">Load everything for ${esc(country.name)}</h2>
  <p class="note" style="margin-bottom:12px">Streams every catalogued corpus that names ${esc(country.name)} and has a loadable repository, interleaved lazily.</p>
  ${snippetTabs(ctx, `country-${country.iso2.toLowerCase()}`, 'country_page', varsForCountry(country.iso2, country.name))}
</section>`
    : ''
}

<p style="margin-top:26px"><a class="btn" href="/api/v1/countries/${esc(country.iso2.toLowerCase())}">${icon('external', 14)} This country as JSON</a></p>
`;

  return page(
    ctx,
    {
      title: `${country.name}: speech datasets`,
      description: describeCountry(country.name, datasets, hoursHere, languageTags.length),
      path: `/countries/${country.iso2.toLowerCase()}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${country.name}: African speech datasets`,
        url: `${ctx.baseUrl}/countries/${country.iso2.toLowerCase()}`,
        about: { '@type': 'Country', name: country.name, identifier: country.iso2 },
        isPartOf: { '@type': 'WebSite', name: 'ngano', url: ctx.baseUrl },
      },
    },
    body,
  );
}

function hoursOf(ctx: SiteContext, tag: string): number {
  return languageForTag(ctx, tag)?.hours ?? 0;
}

function nameOf(ctx: SiteContext, tag: string): string {
  return languageForTag(ctx, tag)?.name ?? tag;
}

/**
 * The languages of one country, keyed on tag and sorted by apportioned hours. The
 * count beside each is how many of this country's records carry that tag, which is a
 * different question from how many the language has across the catalogue.
 */
function languageTable(ctx: SiteContext, tags: readonly string[], here: readonly Dataset[]): string {
  const rows = tags
    .map((tag) => {
      const language = languageForTag(ctx, tag);
      const name = language?.name ?? tag;
      const link = language
        ? `<a href="${esc(languageHref(language))}">${esc(name)}</a>`
        : esc(name);
      const local = here.filter((d) => d.language_tags.includes(tag)).length;
      return `<tr>
<th scope="row" style="font-weight:600">${link}</th>
<td><code class="inl">${esc(tag)}</code></td>
<td class="r">${esc(fmtHours(language?.hours ?? 0))}</td>
<td class="r">${esc(num(local))}</td>
<td class="r">${esc(num(language?.datasets ?? local))}</td>
</tr>`;
    })
    .join('');
  return `<div class="tscroll">
<table class="tbl">
<caption class="sr">Languages recorded against this country, by hours across the catalogue</caption>
<thead><tr><th scope="col">Language</th><th scope="col">Tag</th><th scope="col" class="r">Hours</th><th scope="col" class="r">Datasets here</th><th scope="col" class="r">Datasets in all</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>`;
}

function describeCountry(name: string, datasets: readonly Dataset[], hours: number, languages: number): string {
  if (datasets.length === 0) {
    return `No speech dataset in the ngano catalogue is recorded against ${name}. The page lists what that gap means and how to report a source that fills it.`;
  }
  return `${num(datasets.length)} speech datasets recorded against ${name}, ${fmtHours(hours)} hours of audio across ${num(languages)} languages, with licences, access routes and ready-to-run loader code.`;
}
