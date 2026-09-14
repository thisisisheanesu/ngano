/**
 * The standalone map page: the interactive choropleth at full width, the headline
 * figures behind it, and a way through to the same numbers as a table.
 *
 * The per-country tables live at `/countries` rather than here, so the numbers have one
 * home and this page stays the picture.
 */

import type { SiteContext } from './context';
import { page, crumbs, bigNumber } from './layout';
import { renderMapFigure } from './map';
import { num, hours as fmtHours } from './util';
import { icon } from './icons';

export function renderMap(ctx: SiteContext): string {
  const rows = ctx.countries
    .map((country) => ({ country, stats: ctx.countryStats.get(country.iso2) }))
    .sort((a, b) => (b.stats?.hours ?? 0) - (a.stats?.hours ?? 0) || a.country.name.localeCompare(b.country.name));

  const covered = rows.filter((row) => (row.stats?.datasets ?? 0) > 0).length;
  const best = rows[0];

  const body = `
${crumbs([{ href: '/', label: 'ngano' }, { label: 'Map' }])}
<h1 class="title">Speech data across Africa</h1>
<p class="lede">Fifty-eight countries and territories, coloured by how much recorded speech the catalogue can point at. Switch the colour metric to see where the count of datasets tells a different story from the count of hours.</p>

<div class="bignums" style="margin-bottom:24px">
  ${bigNumber(num(covered), 'countries with at least one dataset')}
  ${bigNumber(num(ctx.countries.length - covered), 'with none found')}
  ${bigNumber(best ? best.country.name : 'none', 'largest by hours', true)}
  ${bigNumber(fmtHours(best?.stats?.hours ?? 0), 'hours there')}
</div>

${renderMapFigure(ctx, { id: 'full-map', metric: 'hours' })}

<div class="btnrow" style="margin-top:24px">
  <a class="btn" href="/countries">${icon('list', 15)} The same numbers as a table</a>
  <a class="btn" href="/languages">${icon('book', 15)} Browse by language</a>
</div>

<section class="block">
  <div class="callout">
    <strong>How a country gets its hours.</strong>
    A dataset counts towards every country it names, so a pan-African corpus adds its full stated size to each of them. That double counting is deliberate: the question these pages answer is what a practitioner in a given country can reach, not how to divide a global total. Self-reported figures of 20,000 hours or more are excluded everywhere.
  </div>
</section>
`;

  return page(
    ctx,
    {
      title: 'Map of African speech data',
      description: `An interactive map of speech datasets across ${num(ctx.countries.length)} African countries and territories, coloured by hours of audio, dataset count or language tags covered. Drawn from the ngano catalogue.`,
      path: '/map',
      scripts: ['/map.js'],
    },
    body,
  );
}
