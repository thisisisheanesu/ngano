/**
 * The overview page: what ngano is, the headline figures, the map, three ways in,
 * and the install snippet for each SDK.
 */

import type { SiteContext } from './context';
import { page, bigNumber, barRow, barRowRich, SITE_TAGLINE } from './layout';
import { renderMapFigure } from './map';
import { installTabs, snippetTabs, DEFAULT_VARS } from './snippets';
import { esc, num, hours as fmtHours, plural } from './util';
import { isCommerciallyUsable, sumHours } from './components';
import { languageChip, languageName, regionalCount } from './languages';
import { icon } from './icons';

export function renderHome(ctx: SiteContext): string {
  const { stats } = ctx;

  const commercial = ctx.datasets.filter(isCommerciallyUsable);
  const commercialHours = sumHours(commercial);

  const emptyCountries = ctx.countries
    .filter((country) => (ctx.countryStats.get(country.iso2)?.datasets ?? 0) === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const thinCountries = ctx.countries
    .map((country) => ({ country, stats: ctx.countryStats.get(country.iso2) }))
    .filter((entry) => (entry.stats?.datasets ?? 0) > 0 && (entry.stats?.hours ?? 0) < 10)
    .sort((a, b) => (a.stats?.hours ?? 0) - (b.stats?.hours ?? 0))
    .slice(0, 12);

  const topLanguages = [...ctx.languages].sort((a, b) => b.hours - a.hours).slice(0, 12);
  const topHours = topLanguages[0]?.hours ?? 1;
  const regional = regionalCount(ctx);
  const exampleLanguage = languageName(ctx, DEFAULT_VARS.LANGUAGE);

  const withHours = ctx.datasets.filter((d) => d.hours_num !== null && !d.unverified_size).length;
  const hfCount = ctx.datasets.filter((d) => d.hf_repo !== null).length;

  /*
   * Two objects, not one. WebSite is what a general crawler reads; DataCatalog is what
   * a dataset-aware one reads, and it is the thing that lets the 611 Dataset records on
   * the individual pages be understood as one collection rather than as strays. Google
   * Dataset Search and anything modelled on it key off exactly this pair.
   */
  const catalogueLd = {
    '@context': 'https://schema.org',
    '@type': 'DataCatalog',
    name: 'ngano',
    alternateName: SITE_TAGLINE,
    url: ctx.baseUrl,
    description: `An open catalogue of ${stats.datasets} African-language speech datasets covering ${stats.languages} language tags across ${stats.countries} countries, with ${Math.round(stats.hours)} verified hours of audio.`,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    inLanguage: 'en',
    keywords: [
      'African languages',
      'speech datasets',
      'automatic speech recognition',
      'text to speech',
      'low-resource languages',
      'speech corpus',
    ],
    creator: { '@type': 'Person', name: ctx.credits.author.name },
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${ctx.baseUrl}/data/catalogue.json`,
        name: 'The whole catalogue as one JSON file',
      },
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${ctx.baseUrl}/api/v1/datasets`,
        name: 'JSON API, filterable and paged',
      },
    ],
    measurementTechnique: 'Sources are catalogued as published; nothing is rehosted.',
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ngano',
    alternateName: SITE_TAGLINE,
    url: ctx.baseUrl,
    description: `A catalogue of ${stats.datasets} African-language speech datasets covering ${stats.languages} language tags across ${stats.countries} countries, with a unified loader for Python, JavaScript and Rust.`,
    inLanguage: 'en',
    license: `https://creativecommons.org/licenses/by/4.0/`,
    creator: { '@type': 'Person', name: ctx.credits.author.name },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${ctx.baseUrl}/api/v1/datasets?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };

  const body = `
<section class="block" style="margin-top:8px">
  <h1 class="title">African speech datasets, gathered in one place.</h1>
  <p class="lede">ngano is a catalogue of ${esc(num(stats.datasets))} speech corpora covering ${esc(num(stats.languages))} language tags in ${esc(num(stats.countries))} countries, and a loader that streams any of them into the same row shape from Python, JavaScript or Rust. It is a catalogue of sources, not a mirror: nothing here is rehosted, and every figure is the one the source published.</p>
  <p class="note" style="margin:0 0 18px">ngano is in beta. Records are still being added and corrected, and corpora appear and move faster than any survey keeps up with, so read this as the best account so far rather than a finished one. <a href="/credits">Corrections are welcome.</a></p>
  <div class="btnrow">
    <a class="btn pri" href="#install">Start loading data ${icon('arrow', 15)}</a>
    <a class="btn" href="/map">${icon('map', 15)} Browse the map</a>
    <a class="btn" href="/docs">${icon('book', 15)} API and MCP</a>
  </div>
</section>

<section class="block panel" aria-labelledby="numbers">
  <h2 class="sec" id="numbers">The catalogue in numbers</h2>
  <p class="note" style="margin:0 0 16px">Every figure here is derived from the catalogue at request time. Nothing is rounded up and nothing is estimated, but the catalogue itself is still growing.</p>
  <div class="bignums">
    ${bigNumber(num(stats.datasets), 'datasets catalogued')}
    ${bigNumber(fmtHours(stats.hours), 'hours of audio', true)}
    ${bigNumber(num(stats.languages), 'language tags')}
    ${bigNumber(num(regional), 'of them regional varieties')}
    ${bigNumber(num(stats.countries), 'countries')}
    ${bigNumber(fmtHours(stats.hours_open), 'hours openly licensed')}
    ${bigNumber(num(hfCount), 'loadable from Hugging Face')}
  </div>
</section>

<section class="block">
  <div class="callout">
    <strong>What these numbers are, and are not.</strong>
    A language here is a BCP 47 tag whose primary subtag is an ISO 639-3 code, so <code class="inl">sna</code> is Shona. ${esc(num(regional))} of the ${esc(num(stats.languages))} tags carry a region subtag as well, which marks a country-specific or accented variety of English, French, Portuguese, Spanish, German, Afrikaans or Arabic rather than a distinct language. Counting only the bare codes leaves ${esc(num(stats.language_codes))} languages. Hours are as published by each source, and sources count differently: some report raw recorded audio, some report aligned and transcribed speech. ${esc(num(stats.datasets - withHours))} of the ${esc(num(stats.datasets))} records state no size at all, so they add nothing to the total. ${esc(plural(stats.unverified_excluded, 'record carries', 'records carry'))} a self-reported figure of 20,000 hours or more that nobody has verified; those are flagged wherever they appear and excluded from every total on this site. Licences are recorded as the source states them, and a licence string is not legal advice.
  </div>
</section>

<section class="block" aria-labelledby="map-heading">
  ${renderMapFigure(ctx, { id: 'home-map', heading: 'Where the data is', metric: 'hours' })}
</section>

<section class="block">
  <h2 class="sec">Three ways in</h2>
  <p class="note" style="margin-bottom:16px">The catalogue is most useful when you are looking for something specific: the biggest pool for a language, the places with nothing at all, or the subset you are allowed to ship.</p>
  <div class="grid g3">

    <div class="panel">
      <h3 class="sub">Biggest languages by hours</h3>
      <div class="brk">
        ${topLanguages
          .map((language) =>
            barRowRich(
              languageChip(ctx, language.tag),
              `${fmtHours(language.hours)} h`,
              topHours > 0 ? language.hours / topHours : 0,
            ),
          )
          .join('')}
      </div>
      <p class="note">Hours are shared evenly across the languages a multilingual corpus covers, because almost no source publishes a per-language split.</p>
    </div>

    <div class="panel">
      <h3 class="sub">Countries with nothing found</h3>
      ${
        emptyCountries.length === 0
          ? '<p class="note">Every country in the catalogue has at least one dataset recorded against it.</p>'
          : `<div class="pills">${emptyCountries
              .map(
                (country) =>
                  `<a class="pill" href="/countries/${esc(country.iso2.toLowerCase())}">${esc(country.name)}</a>`,
              )
              .join('')}</div>
      <p class="note">${esc(plural(emptyCountries.length, 'country has', 'countries have'))} no dataset in the catalogue at all. That is a statement about the search behind ngano, not proof that nothing exists.</p>`
      }
      ${
        thinCountries.length > 0
          ? `<h3 class="sub" style="margin-top:18px">Under ten hours</h3>
      <div class="pills">${thinCountries
        .map(
          (entry) =>
            `<a class="pill" href="/countries/${esc(entry.country.iso2.toLowerCase())}">${esc(entry.country.name)}<span class="c">${esc(fmtHours(entry.stats?.hours ?? 0))} h</span></a>`,
        )
        .join('')}</div>
      <p class="note">These have at least one dataset recorded against them and under ten hours of audio behind it. Several publish no size at all, which is why they show zero.</p>`
          : ''
      }
    </div>

    <div class="panel">
      <h3 class="sub">Commercially usable today</h3>
      <div class="bignums" style="grid-template-columns:1fr 1fr">
        ${bigNumber(num(commercial.length), 'datasets', true)}
        ${bigNumber(fmtHours(commercialHours), 'hours')}
      </div>
      <p class="note">Records whose licence permits commercial use and whose access route is open, so no purchase and no request form stands in the way. ${esc(num(ctx.datasets.filter((d) => d.commercial === 'Unstated').length))} further records leave commercial use unstated, which is not the same as permission.</p>
      <p style="margin-top:14px"><a class="btn" href="/api/v1/datasets?commercial=Yes&amp;access=Open&amp;sort=-hours">Open the filtered list ${icon('external', 14)}</a></p>
    </div>

  </div>
</section>

<section class="block" id="install">
  <h2 class="sec">Load any of it in three lines</h2>
  <p class="lede" style="font-size:15px">One install, one call, the same row in every language. Rows stream, so you can break after the first one without downloading the rest of a corpus.</p>
  ${installTabs(ctx, 'install')}
  <h3 class="sub" style="margin-top:26px">Filter the catalogue, then stream what matched</h3>
  ${snippetTabs(ctx, 'home-catalogue', 'catalogue_filter')}
  <p class="note">Every snippet on this site is generated from the packages themselves and compiled by their own test suites, then filled in with the record you are looking at. This one is filtered to ${esc(exampleLanguage)}, tag <code class="inl">${esc(DEFAULT_VARS.LANGUAGE)}</code>, in ${esc(DEFAULT_VARS.COUNTRY_NAME)} as an example. Every filter takes the tag, never a name, because sources spell the same language several ways.</p>
  <p class="note">Each row arrives as <code class="inl">audio, transcript, language, language_iso, country, speaker_id, gender, age, duration_s, sampling_rate, domain, split, dataset_id, hf_repo, licence, source_url</code>, with anything the source had that does not map kept under <code class="inl">extra</code>. The full schema is on the <a href="/docs">docs page</a>.</p>
</section>

<section class="block panel">
  <h2 class="sec">Where the records come from</h2>
  <p class="note" style="margin-bottom:14px">A country-by-country sweep, plus passes over pan-African corpora and over African-accented, creole and code-switched varieties. Records are de-duplicated by URL and by name.</p>
  <div class="grid g2">
    <div>
      <h3 class="sub">By task</h3>
      <div class="brk">${facets(ctx.stats.by_task)}</div>
    </div>
    <div>
      <h3 class="sub">By access route</h3>
      <div class="brk">${facets(ctx.stats.by_access)}</div>
    </div>
    <div>
      <h3 class="sub">By licence family</h3>
      <div class="brk">${facets(ctx.stats.by_licence_class, 7)}</div>
    </div>
    <div>
      <h3 class="sub">By region</h3>
      <div class="brk">${facets(ctx.stats.by_region, 8)}</div>
    </div>
  </div>
</section>
`;

  return page(
    ctx,
    {
      title: SITE_TAGLINE,
      description: `A catalogue of ${num(stats.datasets)} African-language speech datasets covering ${num(stats.languages)} ISO 639-3 language tags and ${num(stats.countries)} countries, with a unified loader for Python, JavaScript and Rust, a free JSON API and an MCP server.`,
      path: '/',
      jsonLd: [jsonLd, catalogueLd],
      scripts: ['/map.js'],
    },
    body,
  );
}

function facets(entries: readonly { value: string; datasets: number }[], limit = 6): string {
  const top = entries[0]?.datasets ?? 1;
  return entries
    .slice(0, limit)
    .map((entry) => barRow(entry.value, num(entry.datasets), top > 0 ? entry.datasets / top : 0))
    .join('');
}

/** Named export used by the sitemap of entry points on the 404 page. */
export const HOME_ENTRY_POINTS: { href: string; label: string; blurb: string }[] = [
  { href: '/', label: 'Overview', blurb: 'Headline figures, the map and the install snippets.' },
  { href: '/map', label: 'Map of Africa', blurb: 'Hours, datasets and languages per country.' },
  { href: '/docs', label: 'API and SDKs', blurb: 'Endpoints, the MCP server and the row schema.' },
  { href: '/credits', label: 'Credits', blurb: 'Author, licences and how to cite ngano.' },
];
