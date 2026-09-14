/**
 * The credits page. Everything on it comes from `ctx.credits`; no handle, URL or
 * licence string is written into this file.
 *
 * A link whose handle is the literal string PLACEHOLDER has not been filled in yet,
 * so it is left out entirely rather than rendered as a link that goes nowhere. The
 * same guard covers any URL that still carries the placeholder.
 */

import type { CreditLink, SiteContext } from './context';
import { page, crumbs } from './layout';
import { codeBlock } from './snippets';
import { esc, num } from './util';
import { icon, hasIcon, GENERIC_LINK_ICON } from './icons';

const PLACEHOLDER = 'PLACEHOLDER';

/** True when a credits link is still a placeholder and must not be rendered. */
export function isPlaceholderLink(link: CreditLink): boolean {
  return link.handle === PLACEHOLDER || link.url.includes(PLACEHOLDER) || link.url.trim() === '';
}

function usableUrl(url: string): boolean {
  return url.trim() !== '' && !url.includes(PLACEHOLDER);
}

export function renderCredits(ctx: SiteContext): string {
  const { author, links, project, acknowledgements } = ctx.credits;
  const visible = links.filter((link) => !isPlaceholderLink(link));

  const citationYear = project.citation.year;
  const citationTitle = project.citation.title;
  const homeUrl = usableUrl(project.domain) ? project.domain : ctx.baseUrl;

  const bibtex = `@software{${bibKey(author.name, citationYear)},
  author  = {${author.name}},
  title   = {${citationTitle}},
  year    = {${citationYear}},
  version = {${ctx.version}},
  url     = {${homeUrl}},
  note    = {Catalogue data licensed ${project.data_licence}; code licensed ${project.code_licence}}
}`;

  const citationCff = `cff-version: 1.2.0
message: "If you use ngano, please cite it as below."
type: ${project.citation.type}
title: "${citationTitle}"
version: "${ctx.version}"
date-released: "${citationYear}"
url: "${homeUrl}"
license: ${project.code_licence}
authors:
  - name: "${author.name}"`;

  const body = `
${crumbs([{ href: '/', label: 'ngano' }, { label: 'Credits' }])}

<h1 class="title" style="margin-bottom:10px">${esc(author.name)}</h1>
<p class="lede">${esc(author.tagline)}</p>
<p class="lede" style="font-size:15px">${esc(author.bio)}</p>

${
  visible.length > 0
    ? `<section class="block">
  <h2 class="sec">Elsewhere</h2>
  <p class="note" style="margin-bottom:14px">Every link here opens in the same tab and carries no tracking parameters.</p>
  <div class="sociallist">
    ${visible.map(socialButton).join('')}
  </div>
</section>`
    : `<section class="block">
  <div class="callout"><strong>No public profiles are listed yet.</strong> The credits file carries placeholders where the handles will go, and ngano leaves a placeholder out rather than rendering a link that goes nowhere.</div>
</section>`
}

${author.email ? `<p><a class="btn" href="mailto:${esc(author.email)}">${icon('mail', 15)} ${esc(author.email)}</a></p>` : ''}

<section class="block panel">
  <h2 class="sec">What ngano means</h2>
  <p style="color:var(--ink-2);margin:12px 0 0;max-width:70ch">${esc(project.meaning)}</p>
  <p class="note">The name was chosen for what the catalogue is: a record of speech, gathered from the people who told it. The datasets underneath belong to the teams who collected them, and ngano only points at their work.</p>
</section>

<section class="block panel">
  <h2 class="sec">Licences</h2>
  <dl class="kv" style="margin-top:14px">
    <dt>Catalogue data</dt><dd>${esc(project.data_licence)}. Reuse it, including commercially, with attribution.</dd>
    <dt>Code</dt><dd>${esc(project.code_licence)}. The Worker, the site and all three SDKs.</dd>
    <dt>The datasets</dt><dd>Each one keeps the licence its publisher set. ngano rehosts nothing and relicenses nothing.</dd>
    ${usableUrl(project.repo) ? `<dt>Repository</dt><dd><a href="${esc(project.repo)}" rel="noopener external">${esc(project.repo)}</a></dd>` : ''}
  </dl>
</section>

<section class="block">
  <h2 class="sec">Citing ngano</h2>
  <p class="note" style="margin-bottom:14px">If the catalogue saved you a week of searching, a citation is the whole payment.</p>
  <div class="grid g2" style="align-items:stretch">
    ${codeBlock(bibtex, 'text', 'BibTeX', { wrap: true })}
    ${codeBlock(citationCff, 'text', 'CITATION.cff', { wrap: true })}
  </div>
</section>

<section class="block panel">
  <h2 class="sec">Acknowledgements</h2>
  ${
    acknowledgements.length > 0
      ? `<div style="display:grid;gap:14px;margin-top:14px;max-width:76ch">${acknowledgements
          .map((line) => `<p style="margin:0;color:var(--ink-2)">${esc(line)}</p>`)
          .join('')}</div>`
      : '<p class="note">None recorded.</p>'
  }
  <p class="note">The catalogue currently records ${esc(num(ctx.stats.datasets))} datasets across ${esc(num(ctx.stats.languages))} language tags and ${esc(num(ctx.stats.countries))} countries. Every one of those rows is somebody else's fieldwork.</p>
</section>
`;

  return page(
    ctx,
    {
      title: 'Credits, licences and citation',
      description: `ngano is built and maintained by ${author.name}. Catalogue data is licensed ${project.data_licence} and the code ${project.code_licence}. This page carries the citation blocks and the acknowledgements.`,
      path: '/credits',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'Credits',
        url: `${ctx.baseUrl}/credits`,
        mainEntity: {
          '@type': 'Person',
          name: author.name,
          description: author.bio,
          ...(visible.length > 0 ? { sameAs: visible.map((link) => link.url) } : {}),
        },
      },
    },
    body,
  );
}

function socialButton(link: CreditLink): string {
  const glyph = hasIcon(link.icon) ? link.icon : GENERIC_LINK_ICON;
  return `<a class="social" href="${esc(link.url)}" rel="me noopener external">${icon(glyph, 17)}<span>${esc(link.label)}</span><span class="h">${esc(link.handle)}</span></a>`;
}

function bibKey(name: string, year: number): string {
  const surname = name.trim().split(/\s+/).pop() ?? 'ngano';
  return `${surname.replace(/[^A-Za-z0-9]/g, '').toLowerCase()}${year}ngano`;
}
