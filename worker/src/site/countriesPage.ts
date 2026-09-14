/**
 * The country directory at `/countries`: all 58 countries and territories, grouped by
 * region, with the numbers behind each and a link to its own page.
 *
 * `/map` answers "where is the data" as a picture. This answers the same question as a
 * list you can filter and read straight down, including the countries the map colours
 * as empty, which are the interesting ones.
 */

import type { CountryStats, SiteContext } from './context';
import { page, crumbs, bigNumber } from './layout';
import { esc, num, hours as fmtHours, groupBy } from './util';
import { icon } from './icons';

export function renderCountries(ctx: SiteContext): string {
  const rows = ctx.countries
    .map((country) => ({ country, stats: ctx.countryStats.get(country.iso2) }))
    .sort((a, b) => (b.stats?.hours ?? 0) - (a.stats?.hours ?? 0) || a.country.name.localeCompare(b.country.name));

  const covered = rows.filter((entry) => (entry.stats?.datasets ?? 0) > 0).length;
  const empty = rows.length - covered;
  const thin = rows.filter(
    (entry) => (entry.stats?.datasets ?? 0) > 0 && (entry.stats?.hours ?? 0) < 10,
  ).length;

  const byRegion = groupBy(rows, (entry) => entry.country.region);
  const regionOrder = [...byRegion.keys()].sort((a, b) => {
    const left = sumRegion(byRegion.get(a) ?? []);
    const right = sumRegion(byRegion.get(b) ?? []);
    return right - left || a.localeCompare(b);
  });

  const tables = regionOrder
    .map((region) => {
      const entries = byRegion.get(region) ?? [];
      return `<section class="block panel">
<h2 class="sec">${esc(region)}</h2>
<p class="note" style="margin:0 0 12px">${esc(num(entries.length))} countries and territories, ${esc(fmtHours(sumRegion(entries)))} hours recorded.</p>
<div class="tscroll">
<table class="tbl">
<caption class="sr">Datasets and hours per country in ${esc(region)}</caption>
<thead><tr>
<th scope="col">Country</th>
<th scope="col">ISO</th>
<th scope="col" class="r">Hours</th>
<th scope="col" class="r">Datasets</th>
<th scope="col" class="r">Language tags</th>
<th scope="col" class="r">Open access</th>
<th scope="col" class="r">Commercial</th>
</tr></thead>
<tbody>${entries.map((entry) => row(entry.country.iso2, entry.country.name, entry.stats)).join('')}</tbody>
</table>
</div>
</section>`;
    })
    .join('');

  const body = `
${crumbs([{ href: '/', label: 'ngano' }, { label: 'Countries' }])}
<h1 class="title">Every country in the catalogue</h1>
<p class="lede">${esc(num(rows.length))} countries and territories, each with its own page listing the datasets recorded against it, the languages they cover and the licences they carry. ${esc(num(empty))} of them have nothing found at all, which is the number worth looking at.</p>

<div class="bignums" style="margin-bottom:24px">
  ${bigNumber(num(rows.length), 'countries and territories')}
  ${bigNumber(num(covered), 'with at least one dataset')}
  ${bigNumber(num(empty), 'with none found')}
  ${bigNumber(num(thin), 'with under ten hours')}
</div>

<div class="btnrow" style="margin-bottom:24px">
  <a class="btn" href="/map">${icon('map', 15)} See it as a map</a>
  <a class="btn" href="/languages">${icon('book', 15)} Browse by language</a>
</div>

<section class="block">
  <div class="callout">
    <strong>How a country gets its hours.</strong>
    A dataset counts towards every country it names, so a pan-African corpus adds its full stated size to each of them. That double counting is deliberate: the question these pages answer is what a practitioner in a given country can reach, not how to divide a global total. Self-reported figures of 20,000 hours or more are excluded everywhere.
  </div>
</section>

${tables}
`;

  return page(
    ctx,
    {
      title: 'Every country in the catalogue',
      description: `All ${num(rows.length)} African countries and territories in the ngano catalogue, grouped by region, with datasets, hours, languages and licences for each and a link to its own page.`,
      path: '/countries',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Countries',
        url: `${ctx.baseUrl}/countries`,
        numberOfItems: rows.length,
      },
    },
    body,
  );
}

function row(iso2: string, name: string, stats: CountryStats | undefined): string {
  const languages = stats?.language_tags.length ?? 0;
  return `<tr>
<th scope="row"><a href="/countries/${esc(iso2.toLowerCase())}">${esc(name)}</a></th>
<td><code class="inl">${esc(iso2)}</code></td>
<td class="r">${esc(fmtHours(stats?.hours ?? 0))}</td>
<td class="r">${esc(num(stats?.datasets ?? 0))}</td>
<td class="r">${esc(num(languages))}</td>
<td class="r">${esc(num(stats?.open ?? 0))}</td>
<td class="r">${esc(num(stats?.commercial_ok ?? 0))}</td>
</tr>`;
}

function sumRegion(entries: readonly { stats: CountryStats | undefined }[]): number {
  return entries.reduce((total, entry) => total + (entry.stats?.hours ?? 0), 0);
}
