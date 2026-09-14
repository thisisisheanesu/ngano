/**
 * The 404 page. It tries to be useful rather than decorative: it says what kind of
 * thing the path looked like, offers the closest matches in the catalogue, and puts
 * a search box and the four entry points in front of the reader.
 */

import type { SiteContext } from './context';
import { page } from './layout';
import { HOME_ENTRY_POINTS } from './home';
import { esc, clip, num } from './util';
import { icon } from './icons';

export function renderNotFound(ctx: SiteContext, path: string): string {
  const clean = clip(path.split('?')[0] ?? path, 120);
  const segments = clean.split('/').filter(Boolean);
  const kind = segments[0] ?? '';
  const needle = decodeSafe(segments[1] ?? '');

  const suggestions = suggest(ctx, kind, needle);

  const body = `
<section class="block" style="margin-top:20px">
  <p class="crumb"><code class="inl">404</code></p>
  <h1 class="title">That page is not here.</h1>
  <p class="lede">Nothing in the catalogue answers to <code class="inl">${esc(clean)}</code>. ${esc(explain(kind))}</p>

  <form class="form" role="search" action="/api/v1/datasets" method="get" style="max-width:520px;margin-top:20px">
    <div class="field">
      <label for="nf-q">Search the catalogue</label>
      <input id="nf-q" name="q" type="search" placeholder="A language, a country, a dataset name" autocomplete="off">
    </div>
    <div class="btnrow">
      <button class="btn pri" type="submit">${icon('search', 15)} Search</button>
      <a class="btn" href="/">Back to the overview</a>
    </div>
  </form>
</section>

${
  suggestions.length > 0
    ? `<section class="block panel">
  <h2 class="sec">Did you mean one of these?</h2>
  <div class="pills" style="margin-top:12px">${suggestions
    .map((item) => `<a class="pill" href="${esc(item.href)}">${esc(item.label)}</a>`)
    .join('')}</div>
</section>`
    : ''
}

<section class="block">
  <h2 class="sec">Where to go instead</h2>
  <div class="grid g2" style="margin-top:12px">
    ${HOME_ENTRY_POINTS.map(
      (entry) =>
        `<a class="panel" href="${esc(entry.href)}" style="display:block;color:inherit"><h3 class="sub" style="margin-bottom:6px">${esc(entry.label)}</h3><p style="margin:0;color:var(--ink-2);font-size:13.5px">${esc(entry.blurb)}</p></a>`,
    ).join('')}
  </div>
  <p class="note">The catalogue holds ${esc(num(ctx.stats.datasets))} datasets across ${esc(num(ctx.stats.countries))} countries. If you reached this page from a link on ngano rather than from outside, that is a bug worth reporting.</p>
</section>
`;

  return page(
    ctx,
    {
      title: 'Page not found',
      description: 'That page is not part of ngano. Search the catalogue of African-language speech datasets, or start again from the overview.',
      path: clean,
      noindex: true,
    },
    body,
  );
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function explain(kind: string): string {
  switch (kind) {
    case 'datasets':
      return 'Dataset pages live at /datasets/{id}, using the ngano id rather than the source name.';
    case 'countries':
      return 'Country pages live at /countries/{iso2}, using the two letter ISO 3166 code, for example /countries/zw.';
    case 'languages':
      return 'Language pages live at /languages/{tag}, using the lowercased BCP 47 tag, for example /languages/sna for Shona or /languages/eng-ng for Nigerian English. Any spelling a source used works too.';
    case 'api':
      return 'The API lives under /api/v1. The endpoint list is on the docs page.';
    default:
      return 'It may have been a typo, or a page that never existed.';
  }
}

interface Suggestion {
  href: string;
  label: string;
}

/** Cheap token overlap against ids, country codes, language tags and every alias. */
function suggest(ctx: SiteContext, kind: string, needle: string): Suggestion[] {
  const term = needle.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (term.length < 2) return [];
  const tokens = term.split(' ').filter((token) => token.length > 1);
  if (tokens.length === 0) return [];

  const score = (haystack: string): number => {
    const text = haystack.toLowerCase();
    return tokens.reduce((total, token) => total + (text.includes(token) ? token.length : 0), 0);
  };

  const candidates: { item: Suggestion; score: number }[] = [];

  if (kind !== 'countries' && kind !== 'languages') {
    for (const dataset of ctx.datasets) {
      const value = score(`${dataset.id} ${dataset.name}`);
      if (value > 0) {
        candidates.push({
          item: { href: `/datasets/${encodeURIComponent(dataset.id)}`, label: clip(dataset.name, 48) },
          score: value,
        });
      }
    }
  }
  if (kind !== 'datasets') {
    for (const language of ctx.languages) {
      const value = score(`${language.slug} ${language.iso639_3} ${language.name} ${language.aliases.join(' ')}`);
      if (value > 0) {
        candidates.push({
          item: {
            href: `/languages/${encodeURIComponent(language.slug)}`,
            label: `${language.name} (${language.tag})`,
          },
          score: value,
        });
      }
    }
    for (const country of ctx.countries) {
      const value = score(`${country.iso2} ${country.iso3} ${country.name} ${country.slug}`);
      if (value > 0) {
        candidates.push({
          item: { href: `/countries/${country.iso2.toLowerCase()}`, label: `${country.name} (country)` },
          score: value,
        });
      }
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, 8)
    .map((entry) => entry.item);
}
