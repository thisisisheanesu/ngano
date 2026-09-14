/**
 * A dataset page: every field of one record, laid out so a reader can decide in one
 * screen whether it is usable, then copy code that loads exactly it.
 */

import type { Dataset, SiteContext } from './context';
import { page, crumbs, bigNumber } from './layout';
import { snippetTabs, codeBlock, varsForDataset } from './snippets';
import { esc, num, hours as fmtHours, clip, oneLine } from './util';
import {
  badgeRow,
  licenceMeaning,
  datasetList,
  bySize,
  datasetsForCountry,
} from './components';
import { languageChips, languageLabel, languageForTag } from './languages';
import { icon } from './icons';

interface FieldMap {
  canonical?: Record<string, string>;
  aliases?: Record<string, string[]>;
  unit_hints?: Record<string, { canonical?: string; multiply?: number }>;
  overrides?: Record<string, Record<string, unknown>>;
}

function asFieldMap(value: unknown): FieldMap {
  return typeof value === 'object' && value !== null ? (value as FieldMap) : {};
}

const ACCESS_MEANING: Record<string, string> = {
  Open: 'The files can be downloaded directly, with no gate in front of them.',
  Request: 'The publisher gates access behind a form or an agreement. Expect a wait, and read what you sign.',
  Paid: 'The data is sold. Nothing is downloadable until it has been bought.',
  'Scrape required': 'No packaged download exists. The audio has to be collected from the source site, under that site’s terms.',
  Unclear: 'The source does not make the access route plain. Check with the publisher before planning around it.',
};

export function renderDataset(ctx: SiteContext, id: string): string | null {
  const dataset = ctx.byId.get(id) ?? ctx.byId.get(decodeURIComponent(id));
  if (!dataset) return null;

  const tags = dataset.language_tags;
  const names = dataset.languages_clean.length > 0 ? dataset.languages_clean : dataset.languages;
  const primaryTag = tags[0];
  const primaryCountry = dataset.country_codes[0];

  /*
   * The source's own spellings are worth showing only when they differ from the
   * canonical names, which is where a reader learns that this record's "isiZulu" is
   * the catalogue's Zulu.
   */
  const sourceNames = dataset.languages.filter((name) => !dataset.languages_clean.includes(name));

  const siblingsByLanguage = primaryTag ? relatedByLanguage(ctx, dataset, primaryTag) : [];
  const siblingsByCountry = primaryCountry ? relatedByCountry(ctx, dataset, primaryCountry) : [];

  const body = `
${crumbs([{ href: '/', label: 'ngano' }, { label: 'Datasets' }, { label: clip(dataset.name, 60) }])}

<h1 class="title" style="margin-bottom:10px">${esc(dataset.name)}</h1>
${badgeRow(dataset)}

${
  dataset.unverified_size
    ? `<div class="callout warn" style="margin-top:16px"><strong>This size is self-reported and is not counted anywhere on this site.</strong> The source claims ${esc(fmtHours(dataset.hours_num))} hours. Nobody has verified that figure, and a claim at that scale usually mixes raw recorded audio with aligned speech, or counts the same audio under several locales. The number is shown because the source published it, and excluded from every total on ngano for the same reason.</div>`
    : ''
}

<section class="block panel">
  <div class="bignums">
    ${bigNumber(dataset.hours_num === null ? 'not stated' : fmtHours(dataset.hours_num), dataset.unverified_size ? 'hours, self-reported' : 'hours of audio', !dataset.unverified_size)}
    ${
      tags.length === 0 && dataset.language_note
        ? bigNumber('not named', 'languages')
        : bigNumber(num(tags.length), tags.length === 1 ? 'language' : 'languages')
    }
    ${bigNumber(num(dataset.country_codes.length), 'countries named')}
    ${bigNumber(dataset.speakers ?? 'not stated', 'speakers')}
  </div>
  ${dataset.hours !== null && dataset.hours !== String(dataset.hours_num ?? '') ? `<p class="note">As the source states it: ${esc(dataset.hours)}</p>` : ''}
</section>

<div class="rowsplit">
  <div>
    <section class="block panel">
      <h2 class="sec">The record</h2>
      <dl class="kv" style="margin-top:14px">
        <dt>Task</dt><dd>${esc(dataset.task)}</dd>
        <dt>Variety</dt><dd>${esc(dataset.variety)}</dd>
        <dt>Languages</dt><dd>${languageBlock(ctx, dataset, sourceNames)}</dd>
        ${
          dataset.language_codes.length > 0
            ? `<dt>ISO 639-3</dt><dd>${dataset.language_codes.map((code) => `<code class="inl">${esc(code)}</code>`).join(' ')}</dd>`
            : ''
        }
        <dt>Countries</dt><dd>${countryLinks(ctx, dataset)}</dd>
        ${dataset.regions.length > 0 ? `<dt>Regions</dt><dd>${esc(dataset.regions.join(', '))}</dd>` : ''}
        <dt>Quality</dt><dd>${esc(dataset.quality)}</dd>
        <dt>Labelling</dt><dd>${esc(dataset.labelled)}</dd>
        <dt>Domain</dt><dd>${esc(dataset.domain)}</dd>
        ${dataset.recording_type ? `<dt>Recording</dt><dd>${esc(dataset.recording_type)}</dd>` : ''}
        <dt>Host</dt><dd>${esc(dataset.host)}</dd>
        ${dataset.year ? `<dt>Year</dt><dd>${esc(dataset.year)}</dd>` : ''}
        <dt>ngano id</dt><dd><code class="inl">${esc(dataset.id)}</code></dd>
      </dl>
    </section>

    <section class="block panel">
      <h2 class="sec">Licence and what it permits</h2>
      <dl class="kv" style="margin-top:14px">
        <dt>Licence</dt><dd>${esc(dataset.licence)}</dd>
        <dt>Family</dt><dd>${esc(dataset.licence_class)}</dd>
        <dt>Commercial</dt><dd>${esc(dataset.commercial)}</dd>
      </dl>
      <p class="note">${esc(licenceMeaning(dataset))} ngano records the licence as the source states it. That is not legal advice, and it is not a substitute for reading the licence.</p>
    </section>

    <section class="block panel">
      <h2 class="sec">Getting hold of it</h2>
      <dl class="kv" style="margin-top:14px">
        <dt>Access</dt><dd>${esc(dataset.access)}</dd>
        <dt>Host</dt><dd>${esc(dataset.host)}</dd>
        ${dataset.hf_repo ? `<dt>Repository</dt><dd><code class="inl">${esc(dataset.hf_repo)}</code></dd>` : ''}
        ${dataset.url ? `<dt>Source</dt><dd><a href="${esc(dataset.url)}" rel="nofollow noopener external">${esc(clip(dataset.url, 70))}</a></dd>` : '<dt>Source</dt><dd>No canonical link recorded.</dd>'}
      </dl>
      <p class="note">${esc(ACCESS_MEANING[dataset.access] ?? ACCESS_MEANING['Unclear'] ?? '')}</p>
    </section>

    ${
      dataset.notes
        ? `<section class="block panel">
      <h2 class="sec">Notes</h2>
      <p style="margin:12px 0 0;color:var(--ink-2)">${esc(dataset.notes)}</p>
    </section>`
        : ''
    }
  </div>

  <div>
    ${
      dataset.hf_repo
        ? `<section class="block">
      <h2 class="sec">Load this dataset</h2>
      <p class="note" style="margin-bottom:12px">Looks the record up by its ngano id, then streams it. The rows are mapped onto the canonical ngano row whatever <code class="inl">${esc(dataset.hf_repo)}</code> calls its columns.</p>
      ${snippetTabs(ctx, `ds-${slugForId(dataset.id)}`, 'dataset_page', varsForDataset(ctx, dataset))}
      <h3 class="sub" style="margin-top:22px">Or go straight to the repository</h3>
      <p class="note" style="margin-bottom:12px">Skips the catalogue entirely. Replace <code class="inl">default</code> with whichever config the repository publishes.</p>
      ${snippetTabs(ctx, `dsrepo-${slugForId(dataset.id)}`, 'single_dataset', varsForDataset(ctx, dataset))}
      ${columnTable(ctx, dataset)}
    </section>`
        : `<section class="block panel">
      <h2 class="sec">Loading this one</h2>
      <p class="note">There is no Hugging Face repository recorded for this dataset, so the ngano loader cannot stream it. ${esc(ACCESS_MEANING[dataset.access] ?? '')} Once you hold the files locally, the same canonical row shape is what the SDKs emit, so a local reader can be pointed at them.</p>
      ${dataset.url ? `<p style="margin-top:14px"><a class="btn" href="${esc(dataset.url)}" rel="nofollow noopener external">${icon('external', 14)} Go to the source</a></p>` : ''}
    </section>`
    }

    <section class="block panel">
      <h2 class="sec">This record as data</h2>
      ${codeBlock(`curl -s ${ctx.baseUrl}/api/v1/datasets/${dataset.id}`, 'shell', 'Terminal')}
      <p class="note">The same object the site is rendered from, with no key and no rate limit.</p>
    </section>
  </div>
</div>

${
  siblingsByLanguage.length > 0 && primaryTag
    ? `<section class="block">
  <h2 class="sec">More ${esc(languageLabel(ctx, primaryTag))} audio</h2>
  ${datasetList(ctx, siblingsByLanguage, 'Nothing else recorded.', { brief: true })}
</section>`
    : ''
}

${
  siblingsByCountry.length > 0 && primaryCountry
    ? `<section class="block">
  <h2 class="sec">More from ${esc(ctx.byIso2.get(primaryCountry)?.name ?? primaryCountry)}</h2>
  ${datasetList(ctx, siblingsByCountry, 'Nothing else recorded.', { brief: true })}
</section>`
    : ''
}
`;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: dataset.name,
    description: oneLine(dataset.notes ?? `${dataset.task} corpus covering ${names.join(', ')}.`),
    url: `${ctx.baseUrl}/datasets/${encodeURIComponent(dataset.id)}`,
    identifier: dataset.id,
    license: dataset.licence,
    inLanguage: tags.length > 0 ? tags : names,
    keywords: [dataset.task, dataset.domain, dataset.variety, ...tags.slice(0, 12), ...names.slice(0, 12)].filter(
      Boolean,
    ),
    isAccessibleForFree: dataset.access === 'Open',
    creator: { '@type': 'Organization', name: dataset.host },
    includedInDataCatalog: { '@type': 'DataCatalog', name: 'ngano', url: ctx.baseUrl },
  };
  if (dataset.url) jsonLd['sameAs'] = dataset.url;
  if (dataset.year) jsonLd['datePublished'] = dataset.year;
  if (dataset.hf_repo) {
    jsonLd['distribution'] = {
      '@type': 'DataDownload',
      contentUrl: `https://huggingface.co/datasets/${dataset.hf_repo}`,
      encodingFormat: 'audio/*',
    };
  }
  if (dataset.country_codes.length > 0) {
    jsonLd['spatialCoverage'] = dataset.country_codes.map((code) => ({
      '@type': 'Country',
      name: ctx.byIso2.get(code)?.name ?? code,
      identifier: code,
    }));
  }

  return page(
    ctx,
    {
      title: dataset.name,
      description: describe(dataset, names),
      path: `/datasets/${encodeURIComponent(dataset.id)}`,
      jsonLd,
    },
    body,
  );
}

/* ------------------------------------------------------------------ helpers */

function slugForId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48);
}

function describe(dataset: Dataset, languages: readonly string[]): string {
  const size =
    dataset.hours_num === null
      ? 'Size not stated'
      : dataset.unverified_size
        ? `${fmtHours(dataset.hours_num)} hours, self-reported and unverified`
        : `${fmtHours(dataset.hours_num)} hours`;
  const head = `${dataset.name}: ${dataset.task} speech data covering ${clip(languages.join(', '), 90)}. ${size}, licensed ${dataset.licence}, access ${dataset.access.toLowerCase()}.`;
  return dataset.notes ? `${head} ${clip(oneLine(dataset.notes), 150)}` : head;
}

/**
 * The languages of a record: the tags first, because they are what the loader filters
 * on, then the source's own spellings when they differ, then the prose note for the
 * handful of sources that describe their coverage instead of naming languages.
 */
function languageBlock(ctx: SiteContext, dataset: Dataset, sourceNames: readonly string[]): string {
  if (dataset.language_tags.length === 0) {
    if (dataset.language_note) {
      return `<span class="note" style="display:block">${esc(dataset.language_note)}</span>${
        dataset.languages.length > 0
          ? `<span class="note" style="display:block;margin-top:6px">As the source names them: ${esc(dataset.languages.join(', '))}</span>`
          : ''
      }`;
    }
    return dataset.languages.length > 0
      ? esc(dataset.languages.join(', '))
      : 'None recorded.';
  }
  const chips = languageChips(ctx, dataset.language_tags, 30);
  const asNamed =
    sourceNames.length > 0
      ? `<span class="note" style="display:block;margin-top:8px">As the source names them: ${esc(clip(sourceNames.join(', '), 180))}</span>`
      : '';
  return `${chips}${asNamed}`;
}

function countryLinks(ctx: SiteContext, dataset: Dataset): string {
  if (dataset.country_codes.length === 0) {
    return dataset.countries.length > 0 ? esc(dataset.countries.join(', ')) : 'None recorded.';
  }
  return dataset.country_codes
    .map((code) => {
      const country = ctx.byIso2.get(code);
      return country
        ? `<a href="/countries/${esc(country.iso2.toLowerCase())}">${esc(country.name)}</a>`
        : esc(code);
    })
    .join(', ');
}

function relatedByLanguage(ctx: SiteContext, dataset: Dataset, tag: string): Dataset[] {
  if (!languageForTag(ctx, tag)) return [];
  return ctx.datasets
    .filter((entry) => entry.id !== dataset.id && entry.language_tags.includes(tag))
    .sort(bySize)
    .slice(0, 6);
}

function relatedByCountry(ctx: SiteContext, dataset: Dataset, code: string): Dataset[] {
  return datasetsForCountry(ctx, code)
    .filter((entry) => entry.id !== dataset.id)
    .sort(bySize)
    .slice(0, 6);
}

/**
 * The canonical columns the loader will produce for this repo: whatever `field_map.json`
 * pins explicitly, with everything else resolved by inspecting the dataset at run time.
 */
function columnTable(ctx: SiteContext, dataset: Dataset): string {
  if (!dataset.hf_repo) return '';
  const fieldMap = asFieldMap(ctx.fieldMap);
  const canonical = fieldMap.canonical ?? {};
  const override = fieldMap.overrides?.[dataset.hf_repo];
  const aliases = fieldMap.aliases ?? {};

  const rows = Object.keys(canonical)
    .map((column) => {
      const pinned = override ? override[column] : undefined;
      const source =
        typeof pinned === 'string'
          ? `<code class="inl">${esc(pinned)}</code>`
          : column === 'dataset_id' || column === 'hf_repo' || column === 'licence' || column === 'source_url'
            ? '<span style="color:var(--muted)">from the catalogue</span>'
            : aliases[column]
              ? `<span style="color:var(--muted)">matched at run time from ${esc(num(aliases[column]?.length ?? 0))} aliases</span>`
              : '<span style="color:var(--muted)">null unless the source has it</span>';
      return `<tr><th scope="row"><code class="inl">${esc(column)}</code></th><td>${source}</td><td style="color:var(--ink-2)">${esc(canonical[column] ?? '')}</td></tr>`;
    })
    .join('');

  const verified = override && override['verified'] === true;

  return `<details class="panel" style="margin-top:14px">
<summary style="cursor:pointer;font-weight:600">Canonical columns for <code class="inl">${esc(dataset.hf_repo)}</code></summary>
<p class="note" style="margin:12px 0">${
    override
      ? `This repository has a pinned mapping in <code class="inl">field_map.json</code>${verified ? ', checked against the real columns' : ''}. Pinned columns win over guesswork; the rest are matched by inspecting the dataset when it loads.`
      : 'No pinned mapping exists for this repository, so the loader inspects the real columns when it opens the dataset and matches them against the alias table. Anything it cannot place is kept under <code class="inl">extra</code> rather than dropped.'
  }</p>
<div class="tscroll">
<table class="tbl">
<thead><tr><th scope="col">Canonical column</th><th scope="col">Source</th><th scope="col">Meaning</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
</details>`;
}
