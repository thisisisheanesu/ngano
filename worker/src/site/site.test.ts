/**
 * Site renderer tests.
 *
 * Everything runs offline against fixtures copied verbatim out of the real data files.
 * The context is assembled here the same way the Worker assembles it, so the renderers
 * see the shapes they will see in production.
 */

import { describe, it, expect } from 'vitest';

import type { Country, CountryStats, Dataset, FacetCount, Language, SiteContext, Stats } from './context';
import { substitute, DEFAULT_VARS } from './snippets';
import { DATASETS, LANGUAGES, LANGUAGE_CODES, COUNTRIES, CREDITS, FIELD_MAP, GEO, SNIPPETS } from './site.fixtures';
import {
  renderHome,
  renderMap,
  renderCountries,
  renderLanguages,
  renderCountry,
  renderDataset,
  renderLanguage,
  renderCredits,
  renderDocs,
  renderNotFound,
  siteAssets,
} from './index';

/* ------------------------------------------------------------------ context */

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
]);

function facet(datasets: readonly Dataset[], key: (d: Dataset) => string): FacetCount[] {
  const map = new Map<string, FacetCount>();
  for (const dataset of datasets) {
    const value = key(dataset);
    const entry = map.get(value) ?? { value, datasets: 0, hours: 0 };
    entry.datasets += 1;
    if (!dataset.unverified_size && dataset.hours_num !== null) entry.hours += dataset.hours_num;
    map.set(value, entry);
  }
  return [...map.values()].sort((a, b) => b.datasets - a.datasets);
}

function buildContext(datasets: readonly Dataset[] = DATASETS): SiteContext {
  const countryStats = new Map<string, CountryStats>();
  for (const country of COUNTRIES as Country[]) {
    const here = datasets.filter((dataset) => dataset.country_codes.includes(country.iso2));
    const tags = [...new Set(here.flatMap((dataset) => dataset.language_tags))];
    const nameOf = (tag: string): string =>
      LANGUAGES.find((language) => language.tag === tag)?.name ?? tag;
    tags.sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || a.localeCompare(b));
    countryStats.set(country.iso2, {
      ...country,
      datasets: here.length,
      hours: here.reduce(
        (total, dataset) => total + (dataset.unverified_size ? 0 : (dataset.hours_num ?? 0)),
        0,
      ),
      languages: tags.map(nameOf),
      language_tags: tags,
      open: here.filter((dataset) => dataset.access === 'Open').length,
      commercial_ok: here.filter((dataset) => dataset.commercial === 'Yes').length,
    });
  }

  const measured = datasets.filter((dataset) => !dataset.unverified_size);
  const totalHours = measured.reduce((total, dataset) => total + (dataset.hours_num ?? 0), 0);

  const stats: Stats = {
    datasets: datasets.length,
    languages: LANGUAGES.length,
    language_codes: new Set(LANGUAGES.map((language) => language.iso639_3)).size,
    countries: COUNTRIES.length,
    hours: totalHours,
    hours_open: measured
      .filter((dataset) => dataset.access === 'Open')
      .reduce((total, dataset) => total + (dataset.hours_num ?? 0), 0),
    hours_commercial: measured
      .filter((dataset) => dataset.commercial === 'Yes')
      .reduce((total, dataset) => total + (dataset.hours_num ?? 0), 0),
    unverified_excluded: datasets.filter((dataset) => dataset.unverified_size).length,
    by_task: facet(datasets, (d) => d.task),
    by_commercial: facet(datasets, (d) => d.commercial),
    by_licence_class: facet(datasets, (d) => d.licence_class),
    by_access: facet(datasets, (d) => d.access),
    by_labelled: facet(datasets, (d) => d.labelled),
    by_quality: facet(datasets, (d) => d.quality),
    by_variety: facet(datasets, (d) => d.variety),
    by_domain: facet(datasets, (d) => d.domain),
    by_region: facet(datasets, (d) => d.regions[0] ?? 'Pan-African'),
  };

  return {
    datasets: [...datasets],
    byId: new Map(datasets.map((dataset) => [dataset.id, dataset])),
    countries: COUNTRIES,
    byIso2: new Map(COUNTRIES.map((country) => [country.iso2, country])),
    languages: LANGUAGES,
    byLangSlug: new Map(LANGUAGES.map((language) => [language.slug, language])),
    languageCodes: LANGUAGE_CODES,
    countryStats,
    credits: CREDITS,
    geo: GEO,
    stats,
    fieldMap: FIELD_MAP,
    snippets: SNIPPETS,
    baseUrl: 'https://ngano.dev',
    version: '0.1.0',
  };
}

const ctx = buildContext();

/* ------------------------------------------------------------------ helpers */

/**
 * Walk the tags and check that every non-void element is closed in order.
 * Attribute values can never contain a bare `>` because every interpolated value is
 * escaped, so a tag-level scan is sound here.
 */
function unbalancedTags(html: string): string[] {
  const stack: string[] = [];
  const problems: string[] = [];
  const pattern = /<(\/)?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let match: RegExpExecArray | null = pattern.exec(html);
  while (match !== null) {
    const closing = match[1] === '/';
    const name = (match[2] ?? '').toLowerCase();
    const rest = match[3] ?? '';
    if (closing) {
      const open = stack.pop();
      if (open !== name) problems.push(`</${name}> closed <${open ?? 'nothing'}>`);
    } else if (!VOID_ELEMENTS.has(name) && !rest.trimEnd().endsWith('/')) {
      stack.push(name);
    }
    match = pattern.exec(html);
  }
  for (const open of stack.reverse()) problems.push(`<${open}> never closed`);
  return problems;
}

/** Strip highlighting spans and unescape, so assertions read the code a user copies. */
function codeText(html: string): string {
  return html
    .replace(/<\/?span[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function expectWellFormedPage(html: string, expectedTitleFragment: string): void {
  expect(html.startsWith('<!doctype html>')).toBe(true);
  expect(html).toContain('<html lang="en">');
  expect(html).toContain('<meta charset="utf-8">');
  expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
  expect(html).toMatch(/<title>[^<]+<\/title>/);
  expect(html).toContain(expectedTitleFragment);
  expect(html).toMatch(/<meta name="description" content="[^"]+">/);
  expect(html).toMatch(/<meta property="og:title" content="[^"]+">/);
  expect(html).toMatch(/<meta property="og:description" content="[^"]+">/);
  expect(html).toMatch(/<meta name="twitter:card" content="[^"]+">/);
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/ngano\.dev[^"]*">/);
  /* The stylesheet URL carries a content fingerprint, so match the path, not the whole tag. */
  expect(html).toMatch(/<link rel="stylesheet" href="\/styles\.css\?v=[a-z0-9]+">/);
  expect(html).toContain('ngano-theme');
  expect(html).toContain('<header class="mast">');
  expect(html).toContain('<footer class="foot">');
  expect(html).toContain('href="/credits"');
  expect(html).toContain('</html>');
  expect(html).not.toContain('undefined');
  expect(html).not.toContain('[object Object]');
  expect(unbalancedTags(html)).toEqual([]);
}

/* ------------------------------------------------------------------ pages */

describe('every renderer produces a well-formed document', () => {
  it('renders the home page', () => {
    const html = renderHome(ctx);
    expectWellFormedPage(html, '<title>ngano:');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"WebSite"');
    expect(html).toContain('data-map');
    expect(html).toMatch(/src="\/map\.js\?v=[a-z0-9]+"/);
  });

  it('renders the map page', () => {
    const html = renderMap(ctx);
    expectWellFormedPage(html, 'Map of African speech data');
    expect(html).toContain('<svg class="africa"');
    expect(html).toContain('viewBox="0 0 1000');
  });

  it('renders the country directory with a row per country', () => {
    const html = renderCountries(ctx);
    expectWellFormedPage(html, 'Every country in the catalogue');
    expect(html).toContain('"@type":"CollectionPage"');
    for (const country of COUNTRIES) {
      expect(html, country.iso2).toContain(`href="/countries/${country.iso2.toLowerCase()}"`);
    }
  });

  it('renders the language directory with a row per tag, and a filter', () => {
    const html = renderLanguages(ctx);
    expectWellFormedPage(html, 'Every language in the catalogue');
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).toMatch(/src="\/filter\.js\?v=[a-z0-9]+"/);
    expect(html).toContain('data-filter="#lang-table"');
    for (const language of LANGUAGES) {
      expect(html, language.tag).toContain(`href="/languages/${language.slug}"`);
    }
    /* The filter matches on aliases, which is what makes a source's own spelling work. */
    const withAlias = LANGUAGES.find((entry) => entry.aliases.length > 0);
    if (withAlias) {
      const alias = (withAlias.aliases[0] as string).toLowerCase();
      const row = new RegExp(`<tr data-find="[^"]*${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"`);
      expect(html).toMatch(row);
    }
  });

  it('prerenders internal links and leaves the API and data files alone', () => {
    const html = renderHome(ctx);
    const script = /<script type="speculationrules">([\s\S]*?)<\/script>/.exec(html);
    expect(script).not.toBeNull();
    const rules = JSON.parse((script as RegExpExecArray)[1] as string) as {
      prerender: { eagerness: string; where: { and: unknown[] } }[];
    };
    const rule = rules.prerender[0] as { eagerness: string; where: { and: unknown[] } };
    expect(rule.eagerness).toBe('moderate');
    const clauses = JSON.stringify(rule.where.and);
    /* Prerendering a 760KB catalogue on a footer hover would be worse than a reload. */
    expect(clauses).toContain('/api/*');
    expect(clauses).toContain('/data/*');
    expect(clauses).toContain('/mcp');
  });

  it('opts every page into the cross-document view transition', () => {
    const css = siteAssets['/styles.css']?.body ?? '';
    expect(css).toContain('@view-transition');
    expect(css).toContain('navigation:auto');
    /* Reduced motion gets the instant swap, never a crossfade. */
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{[\s\S]*?view-transition-old/);
  });

  it('keeps both directories in the main navigation', () => {
    const html = renderHome(ctx);
    expect(html).toContain('<a href="/countries">Countries</a>');
    expect(html).toContain('<a href="/languages">Languages</a>');
  });

  it('renders a country page for every country in the catalogue', () => {
    for (const country of COUNTRIES) {
      const html = renderCountry(ctx, country.iso2);
      expect(html, country.iso2).not.toBeNull();
      expectWellFormedPage(html as string, country.name.replace(/&/g, '&amp;'));
    }
  });

  it('renders a dataset page for every fixture record', () => {
    for (const dataset of DATASETS) {
      const html = renderDataset(ctx, dataset.id);
      expect(html, dataset.id).not.toBeNull();
      expectWellFormedPage(html as string, '<title>');
      expect(html).toContain('"@type":"Dataset"');
    }
  });

  it('renders a language page for every fixture language', () => {
    for (const language of LANGUAGES) {
      const html = renderLanguage(ctx, language.slug);
      expect(html, language.slug).not.toBeNull();
      expectWellFormedPage(html as string, '<title>');
      expect(html as string, language.slug).toContain(`<code class="tagbig">${language.tag}</code>`);
    }
  });

  it('renders the credits page', () => {
    expectWellFormedPage(renderCredits(ctx), 'Credits, licences and citation');
  });

  it('renders the docs page', () => {
    const html = renderDocs(ctx);
    expectWellFormedPage(html, 'API, MCP server and SDK reference');
    expect(html).toContain('https://ngano.dev/mcp');
    expect(codeText(html)).toContain('claude mcp add --transport http ngano');
    expect(html).toContain('claude_desktop_config.json');
    expect(html).toContain('.cursor/mcp.json');
    expect(html).toContain('id="tryit"');
  });

  it('renders the 404 page', () => {
    const html = renderNotFound(ctx, '/datasets/does-not-exist');
    expectWellFormedPage(html, 'Page not found');
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
    expect(html).toContain('role="search"');
    expect(html).toContain('href="/"');
  });
});

/* ------------------------------------------------------------------ lookups */

describe('unknown ids return null so the router can answer 404', () => {
  it('returns null for an unknown country code', () => {
    expect(renderCountry(ctx, 'XX')).toBeNull();
    expect(renderCountry(ctx, '')).toBeNull();
    expect(renderCountry(ctx, 'zimbabwe')).toBeNull();
  });

  it('returns null for an unknown dataset id', () => {
    expect(renderDataset(ctx, 'no-such-dataset')).toBeNull();
    expect(renderDataset(ctx, '')).toBeNull();
  });

  it('returns null for an unknown language tag', () => {
    expect(renderLanguage(ctx, 'no-such-language')).toBeNull();
    expect(renderLanguage(ctx, 'zzz')).toBeNull();
    expect(renderLanguage(ctx, 'eng-XX')).toBeNull();
    expect(renderLanguage(ctx, '')).toBeNull();
  });

  it('accepts a country code in any case and a slug in any case', () => {
    const first = COUNTRIES[0] as Country;
    expect(renderCountry(ctx, first.iso2.toLowerCase())).not.toBeNull();
    expect(renderCountry(ctx, ` ${first.iso2} `)).not.toBeNull();
    const language = LANGUAGES[0];
    expect(language).toBeDefined();
    expect(renderLanguage(ctx, (language?.slug ?? '').toUpperCase())).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ languages */

describe('languages are identified by their BCP 47 tag', () => {
  it('accepts a tag in any case and answers with the same page', () => {
    const lower = renderLanguage(ctx, 'sna') as string;
    expect(lower).not.toBeNull();
    expect(renderLanguage(ctx, 'SNA')).toBe(lower);
    expect(renderLanguage(ctx, ' Sna ')).toBe(lower);
  });

  it('accepts an alias and returns the page for the tag it resolves to', () => {
    const zulu = renderLanguage(ctx, 'zul') as string;
    expect(zulu).not.toBeNull();
    expect(renderLanguage(ctx, 'isiZulu')).toBe(zulu);
    expect(renderLanguage(ctx, 'Zulu')).toBe(zulu);
    expect(renderLanguage(ctx, 'Sepedi (Northern Sotho)')).toBe(renderLanguage(ctx, 'nso'));
    expect(renderLanguage(ctx, 'Nigerian English')).toBe(renderLanguage(ctx, 'eng-ng'));
  });

  it('shows the tag, the bare code and the scope in words on a language page', () => {
    const html = renderLanguage(ctx, 'sna') as string;
    expect(html).toContain('<code class="tagbig">sna</code>');
    expect(html).toContain('<dt>ISO 639-3</dt><dd><code class="inl">sna</code></dd>');
    expect(html).toContain('individual language');
    expect(html).not.toMatch(/<dt>ISO scope<\/dt><dd>[IM]<\/dd>/);
  });

  it('renders a regional variety with its region subtag and the country it names', () => {
    const html = renderLanguage(ctx, 'eng-ng');
    expect(html).not.toBeNull();
    const page = html as string;
    expectWellFormedPage(page, 'English (Nigeria)');
    expect(page).toContain('<code class="tagbig">eng-NG</code>');
    expect(page).toContain('<dt>Region</dt><dd><code class="inl">NG</code> Nigeria</dd>');
    expect(page).toContain('<dt>ISO 639-3</dt><dd><code class="inl">eng</code></dd>');
    // The plain language it is a variety of is offered as a sibling.
    expect(page).toContain('href="/languages/eng"');
    expect(page).toContain('/languages/eng-ng');
  });

  it('illustrates the tag with a country the language is actually recorded in', () => {
    const tags = new Set(LANGUAGES.map((language) => language.tag));
    for (const language of LANGUAGES) {
      const html = renderLanguage(ctx, language.slug) as string;
      const example = /<code class="inl" data-example-tag>([^<]+)<\/code>/.exec(html);
      if (language.region !== null) {
        // A variety explains the tag on the page rather than hypothesising another.
        expect(example?.[1], language.tag).toBe(language.tag);
        continue;
      }
      if (example === null) {
        // Nothing specific enough to place it, so a real variety is named instead.
        const named = /a tag that does carry one is <code class="inl">([^<]+)<\/code>/.exec(html);
        expect(named, language.tag).not.toBeNull();
        expect(tags, language.tag).toContain(named?.[1] ?? '');
        continue;
      }
      const [code, region] = (example[1] ?? '').split('-');
      expect(code, language.tag).toBe(language.iso639_3);
      expect(language.country_codes, language.tag).toContain(region);
      expect(region, language.tag).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('illustrates Shona with Zimbabwe rather than an unrelated country', () => {
    const html = renderLanguage(ctx, 'sna') as string;
    expect(html).toContain('<code class="inl" data-example-tag>sna-ZW</code>');
    expect(html).toContain('Zimbabwe');
  });

  it('lists the source spellings under a heading that says what they are', () => {
    const html = renderLanguage(ctx, 'zul') as string;
    expect(html).toContain('Names the sources use');
    expect(html).toContain('Zulu');
    const nigerian = renderLanguage(ctx, 'eng-ng') as string;
    expect(nigerian).toContain('Hausa-accented English');
  });

  it('shows the name with its code wherever a language appears', () => {
    const dataset = renderDataset(ctx, 'afrivoice-digital-umuganda-v1') as string;
    expect(dataset).toContain('<a class="lang" href="/languages/sna">Shona<code class="tag">sna</code></a>');

    const country = renderCountry(ctx, 'ZW') as string;
    expect(country).toContain('<code class="inl">sna</code>');
    expect(country).toContain('href="/languages/sna"');

    const home = renderHome(ctx);
    expect(home).toContain('<code class="tag">');
    expect(home).toContain('href="/languages/');
  });

  it('keys the country language table on tags and sorts it by hours', () => {
    const html = renderCountry(ctx, 'NG') as string;
    const rows = [...html.matchAll(/<td><code class="inl">([a-z]{3}(?:-[A-Z]{2})?)<\/code><\/td>\s*<td class="r">([^<]+)<\/td>/g)];
    expect(rows.length).toBeGreaterThan(1);
    const hours = rows.map((row) => Number((row[2] ?? '0').replace(/[^0-9.]/g, '')));
    const sorted = [...hours].sort((a, b) => b - a);
    expect(hours).toEqual(sorted);
  });

  it('explains a prose coverage note instead of showing an empty language list', () => {
    const record = DATASETS.find((dataset) => dataset.language_tags.length === 0) as Dataset;
    expect(record.language_note).toBeDefined();
    const html = renderDataset(ctx, record.id) as string;
    expect(html).toContain('no ISO 639-3 codes');
    expect(html).not.toContain('<div class="langs"></div>');
    expect(unbalancedTags(html)).toEqual([]);
  });

  it('keeps the source spellings beside the canonical names when they differ', () => {
    const record = DATASETS.find(
      (dataset) =>
        dataset.language_tags.length > 0 &&
        dataset.languages.some((name) => !dataset.languages_clean.includes(name)),
    ) as Dataset;
    const html = renderDataset(ctx, record.id) as string;
    expect(html).toContain('As the source names them');
  });

  it('counts languages as tags and says how many are regional varieties', () => {
    const regional = LANGUAGES.filter((language) => language.region !== null).length;
    expect(regional).toBeGreaterThan(0);
    const home = renderHome(ctx);
    expect(home).toContain('of them regional varieties');
    expect(home).toContain(`${regional}`);
    expect(home).toContain('language tags');
  });

  it('carries a search index that matches tag, bare code and every alias', () => {
    const html = renderHome(ctx);
    const island = /<script type="application\/json" id="lang-index">([\s\S]*?)<\/script>/.exec(html);
    expect(island).not.toBeNull();
    const payload = (island?.[1] ?? '')
      .replace(/\\u003c/g, '<')
      .replace(/\\u003e/g, '>')
      .replace(/\\u0026/g, '&');
    const rows = JSON.parse(payload) as [string, string, string][];
    expect(rows.length).toBe(LANGUAGES.length);
    const shona = rows.find((row) => row[0] === 'sna');
    expect(shona?.[1]).toBe('Shona');
    const zulu = rows.find((row) => row[0] === 'zul');
    expect(zulu?.[2]).toContain('Zulu');
    const nigerian = rows.find((row) => row[0] === 'eng-NG');
    expect(nigerian?.[2]).toContain('Nigerian English');
    // The script that reads the island splits the tag to match a bare code.
    expect(siteAssets['/site.js']?.body).toContain('lang-index');
    expect(siteAssets['/site.js']?.body).toContain('tag.split("-")[0]');
  });

  it('explains what a tag is on the docs page', () => {
    const html = renderDocs(ctx);
    expect(html).toContain('ISO 639-3');
    expect(html).toContain('ISO 3166-1');
    expect(html).toContain('eng-NG');
    expect(html).toContain('id="language-tags"');
  });
});

/* ------------------------------------------------------------------ credits */

describe('credits', () => {
  it('omits every link whose handle is the literal PLACEHOLDER', () => {
    const html = renderCredits(ctx);
    expect(html).not.toContain('PLACEHOLDER');
    for (const link of CREDITS.links) {
      if (link.handle === 'PLACEHOLDER') expect(html).not.toContain(link.url);
    }
    expect(html).toContain(CREDITS.author.name);
    expect(html).toContain(CREDITS.project.meaning);
  });

  it('renders real links with an icon and the handle when one is filled in', () => {
    const filled = buildContext();
    filled.credits = {
      ...CREDITS,
      links: [
        { label: 'GitHub', handle: 'ishemisi', url: 'https://github.com/ishemisi', icon: 'github' },
        { label: 'X', handle: 'PLACEHOLDER', url: 'https://x.com/PLACEHOLDER', icon: 'x' },
      ],
    };
    const html = renderCredits(filled);
    expect(html).toContain('https://github.com/ishemisi');
    expect(html).toContain('ishemisi');
    expect(html).not.toContain('x.com');
    expect(html).not.toContain('PLACEHOLDER');
    expect(unbalancedTags(html)).toEqual([]);
  });

  it('carries a citation block that names the author and the version', () => {
    const html = renderCredits(ctx);
    expect(html).toContain('cff-version: 1.2.0');
    expect(html).toContain('@software{');
    expect(html).toContain('0.1.0');
  });
});

/* ------------------------------------------------------------------ escaping */

describe('escaping', () => {
  const hostile: Dataset = {
    ...(DATASETS[0] as Dataset),
    id: 'hostile-record',
    name: '<script>alert("xss")</script> & "quoted" corpus',
    notes: 'Notes with <img src=x onerror=alert(1)> and an ampersand & a quote " in them.',
    host: '<b>Host</b>',
    licence: 'CC-BY-4.0 <script>',
    domain: 'General & <other>',
    speakers: '12 <script>',
    languages: ['<script>Lang</script>'],
    languages_clean: ['<script>Lang</script>'],
    language_tags: ['<script>tag</script>'],
    language_codes: ['<script>'],
    url: 'https://example.org/?a=1&b=2',
  };

  const hostileCtx = buildContext([...DATASETS, hostile]);

  it('escapes a dataset name that contains a script tag', () => {
    const html = renderDataset(hostileCtx, 'hostile-record');
    expect(html).not.toBeNull();
    const page = html as string;
    expect(page).not.toContain('<script>alert');
    expect(page).not.toContain('<img src=x');
    expect(page).not.toContain('<b>Host</b>');
    expect(page).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(page).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(unbalancedTags(page)).toEqual([]);
  });

  it('escapes hostile text everywhere it is reused', () => {
    for (const html of [
      renderHome(hostileCtx),
      renderMap(hostileCtx),
      renderNotFound(hostileCtx, '/datasets/<script>alert(1)</script>'),
    ]) {
      expect(html).not.toContain('<script>alert');
      expect(unbalancedTags(html)).toEqual([]);
    }
  });

  it('keeps hostile text out of the JSON-LD island', () => {
    const page = renderDataset(hostileCtx, 'hostile-record') as string;
    const island = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(page);
    expect(island).not.toBeNull();
    const payload = island?.[1] ?? '';
    expect(payload).not.toContain('<');
    expect(payload).not.toContain('>');
    expect(() => JSON.parse(payload.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))).not.toThrow();
  });

  it('escapes a country name that a hostile record claims', () => {
    const page = renderCountry(hostileCtx, 'ZW');
    expect(page).not.toBeNull();
    expect(page as string).not.toContain('<script>Lang');
  });
});

/* ------------------------------------------------------------------ map */

describe('the map', () => {
  const html = renderMap(ctx);

  it('draws or plots every country in the catalogue exactly once', () => {
    for (const country of COUNTRIES) {
      const href = `href="/countries/${country.iso2.toLowerCase()}"`;
      const occurrences = html.split(href).length - 1;
      expect(occurrences, country.iso2).toBeGreaterThanOrEqual(1);
    }
  });

  it('plots island states as circles because they have no polygon', () => {
    const islands = COUNTRIES.filter((country) => country.map_name === null);
    expect(islands.length).toBeGreaterThan(0);
    for (const island of islands) {
      expect(html).toContain(`<circle class="geo isl`);
      expect(html).toContain(`>${island.iso2}</text>`);
    }
  });

  it('gives every country a title element for screen readers', () => {
    const titles = html.match(/<title>[^<]*<\/title>/g) ?? [];
    // one document title, plus one per country on the map
    expect(titles.length).toBeGreaterThanOrEqual(COUNTRIES.length);
  });

  it('projects with a sane aspect ratio rather than a flat strip', () => {
    const box = /<svg class="africa" viewBox="0 0 (\d+) (\d+)"/.exec(html);
    expect(box).not.toBeNull();
    const width = Number(box?.[1]);
    const height = Number(box?.[2]);
    // Africa plus its island states spans roughly 82 degrees of longitude and a
    // comparable Mercator height, so the drawing must be close to square.
    expect(height / width).toBeGreaterThan(0.7);
    expect(height / width).toBeLessThan(1.4);
  });

  it('keeps every island label inside the drawing', () => {
    const labels = [...html.matchAll(/<text class="isllab" x="([\d.]+)" y="([\d.]+)"/g)];
    expect(labels.length).toBe(COUNTRIES.filter((country) => country.map_name === null).length);
    const box = /<svg class="africa" viewBox="0 0 (\d+) (\d+)"/.exec(html);
    const width = Number(box?.[1] ?? 0);
    const height = Number(box?.[2] ?? 0);
    for (const label of labels) {
      expect(Number(label[1])).toBeLessThanOrEqual(width);
      expect(Number(label[2])).toBeLessThanOrEqual(height);
      expect(Number(label[1])).toBeGreaterThanOrEqual(0);
    }
  });

  it('places every projected point inside the view box', () => {
    const box = /<svg class="africa" viewBox="0 0 (\d+) (\d+)"/.exec(html);
    const width = Number(box?.[1] ?? 0);
    const height = Number(box?.[2] ?? 0);
    const first = /<path class="geo b\d" d="M([\d.]+) ([\d.]+)/.exec(html);
    expect(first).not.toBeNull();
    expect(Number(first?.[1])).toBeLessThanOrEqual(width);
    expect(Number(first?.[2])).toBeLessThanOrEqual(height);
  });

  it('gives island states a touch target larger than the visible dot', () => {
    expect(html).toContain('<circle class="hit"');
  });

  it('carries a bucket per metric and a legend that names real values', () => {
    expect(html).toContain('data-b-hours=');
    expect(html).toContain('data-b-datasets=');
    expect(html).toContain('data-b-languages=');
    expect(html).toContain('data-legend="hours"');
    expect(html).toContain('data-legend="datasets"');
    expect(html).toContain('data-legend="languages"');
    expect(html).toMatch(/and up<\/span>/);
  });

  it('shows hours with no JavaScript and offers the toggle only once the script runs', () => {
    expect(html).toContain('data-metric="hours"');
    expect(html).toContain('<div class="metricbar" role="group" aria-label="Colour the map by" data-metricbar hidden>');
  });

  it('puts a locator outline on a mainland country page and a point on an island', () => {
    const mainland = renderCountry(ctx, 'ZW') as string;
    expect(mainland).toContain('<svg class="locator"');
    expect(mainland).toContain('<path class="me"');
    const island = renderCountry(ctx, 'SC') as string;
    expect(island).toContain('<svg class="locator"');
    expect(island).toContain('<circle class="me"');
  });
});

/* ------------------------------------------------------------------ honesty */

describe('honest framing', () => {
  it('flags a self-reported size and says it is excluded from totals', () => {
    const flagged = DATASETS.find((dataset) => dataset.unverified_size);
    expect(flagged).toBeDefined();
    const page = renderDataset(ctx, (flagged as Dataset).id) as string;
    expect(page).toContain('self-reported');
    expect(page).toContain('Unverified size');
    expect(page.toLowerCase()).toContain('excluded from every total');
  });

  it('never counts an unverified figure in a country total', () => {
    const flagged = DATASETS.find((dataset) => dataset.unverified_size) as Dataset;
    for (const code of flagged.country_codes) {
      const stats = ctx.countryStats.get(code);
      expect(stats?.hours ?? 0).toBeLessThan(flagged.hours_num ?? Infinity);
    }
  });

  it('says plainly when a record states no size', () => {
    const unsized = DATASETS.find((dataset) => dataset.hours_num === null);
    expect(unsized).toBeDefined();
    const page = renderDataset(ctx, (unsized as Dataset).id) as string;
    expect(page).toContain('not stated');
  });

  it('uses no em dashes anywhere in the rendered copy', () => {
    const pages = [
      renderHome(ctx),
      renderMap(ctx),
      renderCountries(ctx),
      renderLanguages(ctx),
      renderDocs(ctx),
      renderCredits(ctx),
      renderNotFound(ctx, '/nope'),
      renderCountry(ctx, 'ZW') as string,
      renderLanguage(ctx, (LANGUAGES[0]?.slug ?? '')) as string,
    ];
    for (const page of pages) {
      // The catalogue's own notes are quoted verbatim, so only the site's chrome is checked.
      const chrome = page.replace(/<p class="notes">[\s\S]*?<\/p>/g, '');
      expect(chrome).not.toContain('—');
      expect(chrome).not.toContain('&mdash;');
      expect(chrome).not.toContain('&#8212;');
    }
  });
});

/* ------------------------------------------------------------------ snippets */

describe('SDK snippets come from data/snippets.json, fully substituted', () => {
  const TOKEN = /\{\{[A-Z_]+\}\}/;

  const allPages = (): { name: string; html: string }[] => [
    { name: 'home', html: renderHome(ctx) },
    { name: 'docs', html: renderDocs(ctx) },
    { name: 'map', html: renderMap(ctx) },
    { name: 'credits', html: renderCredits(ctx) },
    ...COUNTRIES.map((country) => ({
      name: `country ${country.iso2}`,
      html: renderCountry(ctx, country.iso2) as string,
    })),
    ...DATASETS.map((dataset) => ({
      name: `dataset ${dataset.id}`,
      html: renderDataset(ctx, dataset.id) as string,
    })),
    ...LANGUAGES.map((language) => ({
      name: `language ${language.slug}`,
      html: renderLanguage(ctx, language.slug) as string,
    })),
  ];

  it('never leaves an unsubstituted token in any rendered page', () => {
    for (const { name, html } of allPages()) {
      expect(TOKEN.test(html), `${name} carries an unsubstituted token`).toBe(false);
    }
  });

  it('substitutes every placeholder the file declares', () => {
    for (const token of SNIPPETS.placeholders) {
      const bare = token.replace(/[{}]/g, '') as keyof typeof DEFAULT_VARS;
      expect(substitute(token, {})).toBe(DEFAULT_VARS[bare]);
      expect(substitute(token, { [bare]: 'supplied' })).toBe('supplied');
    }
  });

  it('fills a dataset snippet with that record id, repo, language and country', () => {
    const record = DATASETS.find((dataset) => dataset.hf_repo !== null) as Dataset;
    const text = codeText(renderDataset(ctx, record.id) as string);
    expect(text).toContain(record.id);
    expect(text).toContain(record.hf_repo as string);
    const tag = record.language_tags[0];
    if (tag) expect(text).toContain(tag);
    const html = renderDataset(ctx, record.id) as string;
    expect(TOKEN.test(html)).toBe(false);
  });

  it('fills a language snippet with that language tag, because the SDKs filter on tags', () => {
    const language = LANGUAGES.find((entry) => entry.tag === 'swh') ?? (LANGUAGES[0] as Language);
    const html = renderLanguage(ctx, language.slug) as string;
    const panel = /<div class="tabgroup"[\s\S]*?<\/div>/.exec(html);
    expect(panel).not.toBeNull();
    const code = [...html.matchAll(/<pre class="code">([\s\S]*?)<\/pre>/g)]
      .map((match) => codeText(match[1] ?? ''))
      .join('\n');
    expect(code).toContain(`"${language.tag}"`);
    expect(code).not.toContain(`"${language.name}"`);
    expect(html).toContain(language.name);
  });

  it('fills a country snippet with that ISO code and name', () => {
    const text = codeText(renderCountry(ctx, 'ZW') as string);
    expect(text).toContain('"ZW"');
    expect(text).toContain('Zimbabwe');
  });

  it('takes the install lines from the file rather than hardcoding them', () => {
    const html = renderDocs(ctx);
    for (const id of ['python', 'javascript', 'rust'] as const) {
      const entry = SNIPPETS.languages[id];
      expect(entry).toBeDefined();
      expect(codeText(html)).toContain(entry?.install as string);
      if (entry?.install_audio) expect(codeText(html)).toContain(entry.install_audio);
    }
  });

  it('labels shell transcripts as shell rather than as source', () => {
    const html = renderDocs(ctx);
    for (const id of ['python', 'javascript', 'rust'] as const) {
      const entry = SNIPPETS.languages[id];
      for (const key of entry?.shell_snippets ?? []) {
        expect(key).toBe('cli');
      }
      expect(html).toContain(`${LABELS[id]} CLI`);
    }
  });

  it('marks the SDK tab strips as remembering the reader choice', () => {
    const html = renderDocs(ctx);
    expect(html).toContain('data-tabs-remember="sdk"');
    expect(html).toContain('data-tab="rust"');
    // The MCP client picker is a different decision and is not tied to the SDK choice.
    const mcp = /<div class="tabgroup" data-tabs>\s*<div class="tabbar" role="tablist" aria-label="MCP client"/.exec(html);
    expect(mcp).not.toBeNull();
  });

  it('degrades honestly when the snippet file is absent', () => {
    const bare = buildContext();
    (bare as { snippets: unknown }).snippets = { version: 1, placeholders: [], languages: {} };
    const html = renderDocs(bare);
    expect(html).toContain('not available in this build');
    expect(unbalancedTags(html)).toEqual([]);
  });
});

const LABELS: Record<'python' | 'javascript' | 'rust', string> = {
  python: 'Python',
  javascript: 'JavaScript',
  rust: 'Rust',
};

/* ------------------------------------------------------------------ code blocks */

describe('code blocks reserve space for the copy button and scroll when long', () => {
  const pages = (): { name: string; html: string }[] => [
    { name: 'home', html: renderHome(ctx) },
    { name: 'docs', html: renderDocs(ctx) },
    { name: 'credits', html: renderCredits(ctx) },
    ...DATASETS.map((dataset) => ({
      name: `dataset ${dataset.id}`,
      html: renderDataset(ctx, dataset.id) as string,
    })),
  ];

  it('never puts the copy button inside the pre it copies', () => {
    for (const { name, html } of pages()) {
      const pres = html.match(/<pre class="code">[\s\S]*?<\/pre>/g) ?? [];
      for (const pre of pres) {
        expect(pre.includes('copybtn'), `${name} overlays a copy button on its code`).toBe(false);
      }
    }
  });

  it('gives every code block exactly one bar, one button and one pre', () => {
    for (const { name, html } of pages()) {
      const wraps = (html.match(/<div class="codewrap(?: wrapped)?">/g) ?? []).length;
      const bars = (html.match(/<div class="codebar">/g) ?? []).length;
      const buttons = (html.match(/class="copybtn"/g) ?? []).length;
      const pres = (html.match(/<pre class="code">/g) ?? []).length;
      expect(wraps, name).toBeGreaterThan(0);
      expect(bars, name).toBe(wraps);
      expect(buttons, name).toBe(wraps);
      expect(pres, name).toBe(wraps);
    }
  });

  it('puts the bar before the pre so the button can never sit over a short line', () => {
    // The single-line curl block is the case that used to collide.
    const record = DATASETS[0] as Dataset;
    const html = renderDataset(ctx, record.id) as string;
    const wrap = /<div class="codewrap">\s*<div class="codebar">[\s\S]*?<\/div>\s*<pre class="code">/.exec(html);
    expect(wrap).not.toBeNull();
    expect(codeText(html)).toContain(`curl -s https://ngano.dev/api/v1/datasets/${record.id}`);
  });

  it('labels each block so a reader knows what they are copying', () => {
    const html = renderCredits(ctx);
    expect(html).toContain('<span class="codelang">BibTeX</span>');
    expect(html).toContain('<span class="codelang">CITATION.cff</span>');
  });

  it('styles the button in flow rather than floating it over the code', () => {
    const css = siteAssets['/styles.css']?.body ?? '';
    const rule = /\.copybtn\{([^}]*)\}/.exec(css);
    expect(rule).not.toBeNull();
    expect(rule?.[1]).not.toContain('position:absolute');
    expect(css).toContain('.codebar{display:flex;');
  });

  it('lets a long line scroll instead of clipping or widening the page', () => {
    const css = siteAssets['/styles.css']?.body ?? '';
    expect(css).toMatch(/pre\.code\{[^}]*overflow-x:auto/);
    // Overflow only works if the pre may shrink inside its grid and flex ancestors.
    expect(css).toContain('.grid > *{min-width:0}');
    expect(css).toContain('.rowsplit > *{min-width:0}');
    expect(css).toMatch(/\.codewrap\{[^}]*min-width:0/);
    expect(css).toMatch(/pre\.code\{[^}]*max-width:100%/);
    // Nothing may demand more width than a 400px viewport offers.
    for (const width of css.match(/min-width:(\d+)px/g) ?? []) {
      expect(Number(width.replace(/\D/g, ''))).toBeLessThanOrEqual(360);
    }
  });

  it('keeps the masthead search placeholder short enough for the field', () => {
    const placeholder = /placeholder="([^"]*)"/.exec(renderHome(ctx));
    expect(placeholder).not.toBeNull();
    expect((placeholder?.[1] ?? '').length).toBeLessThanOrEqual(20);
  });
});

/* ------------------------------------------------------------------ assets */

describe('siteAssets', () => {
  it('serves the stylesheet and both scripts from fixed paths', () => {
    expect(Object.keys(siteAssets)).toEqual(
      expect.arrayContaining(['/styles.css', '/site.js', '/map.js', '/favicon.svg', '/og.svg']),
    );
    expect(siteAssets['/styles.css']?.contentType).toContain('text/css');
    expect(siteAssets['/site.js']?.contentType).toContain('javascript');
    expect(siteAssets['/map.js']?.contentType).toContain('javascript');
    expect(siteAssets['/favicon.svg']?.contentType).toContain('image/svg+xml');
  });

  it('keeps the CSS in one asset rather than inlining it into pages', () => {
    const css = siteAssets['/styles.css']?.body ?? '';
    expect(css.length).toBeGreaterThan(4000);
    expect(css).toContain('--accent:#C0356E');
    expect(css).toContain('prefers-color-scheme:dark');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(renderHome(ctx)).not.toContain('--accent:#C0356E');
  });

  it('defines the whole choropleth ramp in both themes', () => {
    const css = siteAssets['/styles.css']?.body ?? '';
    for (let i = 0; i <= 5; i += 1) {
      expect(css).toContain(`--c${i}:`);
      expect(css).toContain(`.b${i}{fill:var(--c${i})}`);
    }
  });
});
