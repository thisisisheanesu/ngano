/**
 * The language directory at `/languages`: every tag the catalogue knows, with the
 * numbers behind it and a link to its own page.
 *
 * A directory, not a search box. The masthead already searches; what this page adds is
 * the whole list in one place, so a reader can see how much of the catalogue is one
 * enormous language and how much is a long tail of two-dataset entries. The table is
 * filterable client side, because 315 rows is too many to scroll with intent and too
 * few to justify pagination.
 */

import type { Language, SiteContext } from './context';
import { page, crumbs, bigNumber } from './layout';
import { esc, num, hours as fmtHours } from './util';
import { languageHref, regionalCount, codeCount, TAG_EXPLAINER } from './languages';
import { icon } from './icons';

export function renderLanguages(ctx: SiteContext): string {
  const sorted = [...ctx.languages].sort(
    (a, b) => b.hours - a.hours || b.datasets - a.datasets || a.name.localeCompare(b.name),
  );

  const withData = sorted.filter((language) => language.datasets > 0);
  const regional = regionalCount(ctx);
  const bare = codeCount(ctx);
  const singleton = withData.filter((language) => language.datasets === 1).length;

  const rows = sorted.map(row).join('');

  const body = `
${crumbs([{ href: '/', label: 'ngano' }, { label: 'Languages' }])}
<h1 class="title">Every language in the catalogue</h1>
<p class="lede">${esc(num(ctx.languages.length))} BCP 47 tags, ${esc(num(bare))} of them distinct ISO 639-3 languages and ${esc(num(regional))} regional varieties. Each one has its own page with the datasets behind it, the spellings sources used for it, and code that streams it.</p>

<div class="bignums" style="margin-bottom:24px">
  ${bigNumber(num(ctx.languages.length), 'language tags')}
  ${bigNumber(num(bare), 'distinct ISO 639-3 codes')}
  ${bigNumber(num(regional), 'regional varieties')}
  ${bigNumber(num(singleton), 'tags with a single dataset')}
</div>

<section class="block">
  <div class="callout">
    <strong>What a tag is.</strong> ${esc(TAG_EXPLAINER)}
  </div>
</section>

<section class="block">
  <div class="tablehead">
    <h2 class="sec" id="all">All ${esc(num(ctx.languages.length))} tags</h2>
    <div class="filterbox">
      <span class="ic">${icon('search', 15)}</span>
      <label class="sr" for="lang-filter">Filter the language list</label>
      <input id="lang-filter" type="search" placeholder="sna, Shona, Nigeria" autocomplete="off" data-filter="#lang-table">
    </div>
  </div>
  <p class="note" id="lang-count" style="margin:0 0 12px" data-filter-count data-total="${esc(ctx.languages.length)}">Showing all ${esc(num(ctx.languages.length))}. Hours are apportioned evenly across the languages a multilingual corpus covers, and self-reported totals of 20,000 hours or more are excluded.</p>
  <div class="tscroll">
    <table class="tbl" id="lang-table">
      <caption class="sr">Every language tag in the catalogue with its datasets, hours and countries</caption>
      <thead><tr>
        <th scope="col">Language</th>
        <th scope="col">Tag</th>
        <th scope="col">ISO 639-3</th>
        <th scope="col" class="r">Datasets</th>
        <th scope="col" class="r">Hours</th>
        <th scope="col" class="r">Countries</th>
        <th scope="col">Tasks</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</section>
`;

  return page(
    ctx,
    {
      title: 'Every language in the catalogue',
      description: `All ${num(ctx.languages.length)} language tags in the ngano catalogue, ${num(bare)} of them distinct ISO 639-3 codes, with datasets, hours and countries for each and a link to its own page.`,
      path: '/languages',
      scripts: ['/filter.js'],
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Languages',
        url: `${ctx.baseUrl}/languages`,
        numberOfItems: ctx.languages.length,
      },
    },
    body,
  );
}

/**
 * `data-find` carries everything the filter should match on, lowercased once here so
 * the browser never has to build it. Aliases are included, which is what makes typing
 * "isiZulu" or "Chishona" find the row.
 */
function row(language: Language): string {
  const countries = language.country_codes.length;
  const haystack = [language.name, language.tag, language.iso639_3, ...language.aliases, ...language.countries]
    .join(' ')
    .toLowerCase();

  return `<tr data-find="${esc(haystack)}">
<th scope="row"><a href="${esc(languageHref(language))}">${esc(language.name)}</a></th>
<td><code class="inl">${esc(language.tag)}</code></td>
<td><code class="inl">${esc(language.iso639_3)}</code></td>
<td class="r">${esc(num(language.datasets))}</td>
<td class="r">${esc(fmtHours(language.hours))}</td>
<td class="r">${esc(num(countries))}</td>
<td class="tasks">${language.tasks.map((task) => `<span class="tag">${esc(task)}</span>`).join('')}</td>
</tr>`;
}
