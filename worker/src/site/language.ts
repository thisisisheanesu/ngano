/**
 * A language page: which tag it is, how much audio exists for it, where the catalogue
 * found that audio, the spellings the sources used, and code that streams all of it.
 *
 * The page lives at `/languages/{tag}`, so Shona is `/languages/sna` and Nigerian
 * English is `/languages/eng-ng`. The renderer accepts a tag in any case and any alias
 * a source used, and answers with the page for the tag that alias resolves to.
 */

import type { SiteContext } from './context';
import { page, crumbs, bigNumber } from './layout';
import { snippetTabs, varsForLanguage } from './snippets';
import { esc, num, hours as fmtHours, plural } from './util';
import {
  datasetList,
  datasetsForLanguage,
  bySize,
  sumHours,
  countUnverified,
  isCommerciallyUsable,
  countryPills,
  facetBreakdown,
} from './components';
import {
  resolveLanguage,
  scopeWords,
  typeWords,
  homeCountryCode,
  exampleVariety,
  TAG_EXPLAINER,
} from './languages';
import { icon } from './icons';

export function renderLanguage(ctx: SiteContext, key: string): string | null {
  const language = resolveLanguage(ctx, key);
  if (!language) return null;

  const datasets = datasetsForLanguage(ctx, language).sort(bySize);
  const measured = sumHours(datasets);
  const unverified = countUnverified(datasets);
  const commercial = datasets.filter(isCommerciallyUsable);
  const transcribed = datasets.filter((d) => d.labelled === 'Transcribed');
  const loadable = datasets.filter((d) => d.hf_repo !== null);

  const regionName = language.region ? (ctx.byIso2.get(language.region)?.name ?? language.region) : null;
  const sameCode = ctx.languages.filter(
    (entry) => entry.iso639_3 === language.iso639_3 && entry.tag !== language.tag,
  );
  const aliases = language.aliases.filter((alias) => alias !== language.name);

  /*
   * The example tag in the explainer has to be plausible for the language on the page,
   * so it is built from a country this language is actually recorded in. When the
   * catalogue places it nowhere, a real variety of another language is named instead
   * rather than a pairing being invented here.
   */
  const homeCode = language.region ? null : homeCountryCode(datasets);
  const homeCountry = homeCode ? (ctx.byIso2.get(homeCode)?.name ?? homeCode) : null;
  const variety = homeCode ? null : exampleVariety(ctx);

  const body = `
${crumbs([{ href: '/', label: 'ngano' }, { label: 'Languages' }, { label: language.name }])}

<h1 class="title" style="margin-bottom:8px">${esc(language.name)} <code class="tagbig">${esc(language.tag)}</code></h1>
<p class="lede">${esc(plural(datasets.length, 'dataset in the catalogue carries', 'datasets in the catalogue carry'))} the tag <code class="inl">${esc(language.tag)}</code>. ${
    loadable.length > 0
      ? `${esc(plural(loadable.length, 'of them streams', 'of them stream'))} straight through the ngano loader.`
      : 'None of them has a repository the loader can stream, so every one has to be fetched from its source.'
  }</p>

<section class="block panel">
  <div class="bignums">
    ${bigNumber(fmtHours(language.hours), 'hours apportioned', true)}
    ${bigNumber(num(datasets.length), 'datasets')}
    ${bigNumber(num(transcribed.length), 'transcribed')}
    ${bigNumber(num(commercial.length), 'commercially usable')}
    ${bigNumber(num(loadable.length), 'loadable')}
  </div>
  <p class="note">The headline figure shares each multilingual corpus evenly across the languages it covers, because almost no source publishes a per-language split. Adding up the full stated size of every corpus that carries ${esc(language.tag)} instead gives ${esc(fmtHours(measured))} hours, which double counts anything shared with another language.${
    unverified > 0
      ? ` ${esc(plural(unverified, 'record here carries', 'records here carry'))} a self-reported size of 20,000 hours or more and is left out of both figures.`
      : ''
  }</p>
</section>

<div class="rowsplit">
  <div class="panel">
    <h2 class="sec">How this language is identified</h2>
    <dl class="kv" style="margin-top:14px">
      <dt>Tag</dt><dd><code class="inl">${esc(language.tag)}</code></dd>
      <dt>ISO 639-3</dt><dd><code class="inl">${esc(language.iso639_3)}</code></dd>
      ${
        language.region
          ? `<dt>Region</dt><dd><code class="inl">${esc(language.region)}</code> ${esc(regionName ?? '')}</dd>`
          : ''
      }
      <dt>ISO scope</dt><dd>${esc(scopeWords(language.scope))}</dd>
      <dt>ISO type</dt><dd>${esc(typeWords(language.type))}</dd>
      <dt>Page</dt><dd><code class="inl">/languages/${esc(language.slug)}</code></dd>
    </dl>
    <p class="note" style="margin-top:12px">${esc(TAG_EXPLAINER)} ${
      language.region
        ? `This page is the variety: <code class="inl" data-example-tag>${esc(language.tag)}</code> is the ${esc(language.iso639_3)} language as recorded in ${esc(regionName ?? language.region)}, which is a country-specific variety rather than a separate language. The language at large keeps the bare code <code class="inl">${esc(language.iso639_3)}</code>.`
        : homeCode
          ? `<code class="inl">${esc(language.tag)}</code> names the language at large, wherever it is spoken. A variety recorded for one country would add that country's code, so ${esc(language.name)} as recorded in ${esc(homeCountry ?? homeCode)} would be <code class="inl" data-example-tag>${esc(language.iso639_3)}-${esc(homeCode)}</code>.`
          : variety
            ? `<code class="inl">${esc(language.tag)}</code> names the language at large. No dataset in the catalogue places it in a country yet, so it has no regional variety here; a tag that does carry one is <code class="inl">${esc(variety.tag)}</code> for ${esc(variety.name)}.`
            : `<code class="inl">${esc(language.tag)}</code> names the language at large. No dataset in the catalogue places it in a country yet, so no regional variety of it is recorded.`
    }</p>
    ${
      sameCode.length > 0
        ? `<h3 class="sub" style="margin-top:18px">Varieties sharing <code class="inl">${esc(language.iso639_3)}</code></h3>
    <div class="langs">${sameCode
      .map(
        (entry) =>
          `<a class="lang" href="/languages/${esc(encodeURIComponent(entry.slug))}">${esc(entry.name)}<code class="tag">${esc(entry.tag)}</code></a>`,
      )
      .join('')}</div>`
        : ''
    }
  </div>
  <div class="panel">
    <h2 class="sec">Names the sources use</h2>
    <p class="note" style="margin:8px 0 12px">These are the spellings the catalogued sources themselves wrote, all resolved to <code class="inl">${esc(language.tag)}</code>. A search for any of them lands here.</p>
    ${
      aliases.length > 0
        ? `<div class="pills">${aliases
            .slice(0, 40)
            .map((alias) => `<span class="pill flat">${esc(alias)}</span>`)
            .join('')}</div>${
            aliases.length > 40 ? `<p class="note">and ${esc(num(aliases.length - 40))} more</p>` : ''
          }`
        : `<p class="note">Every source that covers this language spells it <strong>${esc(language.name)}</strong>, so there is no second spelling to record.</p>`
    }
  </div>
</div>

<div class="rowsplit">
  <div class="panel">
    <h2 class="sec">Shape of the data</h2>
    <h3 class="sub" style="margin-top:12px">Task</h3>
    ${facetBreakdown(datasets, (d) => d.task, 5)}
    <h3 class="sub" style="margin-top:16px">Access</h3>
    ${facetBreakdown(datasets, (d) => d.access, 5)}
  </div>
  <div class="panel">
    <h2 class="sec">Licence and labelling</h2>
    <h3 class="sub" style="margin-top:12px">Licence family</h3>
    ${facetBreakdown(datasets, (d) => d.licence_class, 5)}
    <h3 class="sub" style="margin-top:16px">Labelling</h3>
    ${facetBreakdown(datasets, (d) => d.labelled, 4)}
  </div>
</div>

<section class="block">
  <h2 class="sec">Countries in the catalogue</h2>
  <p class="note" style="margin-bottom:12px">Countries named by the datasets that carry ${esc(language.tag)}. Pan-African corpora name many countries at once, so this is coverage as the catalogue records it rather than a map of who speaks the language.</p>
  ${countryPills(ctx, language.countries, 60)}
</section>

${
  loadable.length > 0
    ? `<section class="block">
  <h2 class="sec">Stream every ${esc(language.name)} corpus</h2>
  <p class="note" style="margin-bottom:12px">The SDKs filter on the tag, so the code below passes <code class="inl">${esc(language.tag)}</code> rather than a name that each source spells differently.</p>
  ${snippetTabs(ctx, `lang-${language.slug.replace(/[^a-z0-9-]/gi, '-')}`, 'language_page', varsForLanguage(language))}
</section>`
    : ''
}

<section class="block">
  <h2 class="sec">All ${esc(num(datasets.length))} ${datasets.length === 1 ? 'dataset' : 'datasets'}</h2>
  ${datasetList(ctx, datasets, `No dataset in the catalogue carries ${language.tag}.`)}
</section>

<p style="margin-top:26px"><a class="btn" href="/api/v1/languages/${esc(encodeURIComponent(language.slug))}">${icon('external', 14)} This language as JSON</a></p>
`;

  return page(
    ctx,
    {
      title: `${language.name} (${language.tag}): speech datasets`,
      description: `${num(datasets.length)} speech datasets tagged ${language.tag} for ${language.name}, ${fmtHours(language.hours)} hours of audio, with licences, countries, the ISO 639-3 code and ready-to-run loader code for Python, JavaScript and Rust.`,
      path: `/languages/${encodeURIComponent(language.slug)}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${language.name} (${language.tag}) speech datasets`,
        url: `${ctx.baseUrl}/languages/${encodeURIComponent(language.slug)}`,
        about: {
          '@type': 'Language',
          name: language.name,
          identifier: language.tag,
          alternateName: [language.iso639_3, ...aliases.slice(0, 5)],
        },
        isPartOf: { '@type': 'WebSite', name: 'ngano', url: ctx.baseUrl },
      },
    },
    body,
  );
}
