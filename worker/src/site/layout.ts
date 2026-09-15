/**
 * The page shell: head metadata, masthead, footer.
 *
 * Every renderer in this module returns a complete document built through `page`,
 * so the head contract (charset, viewport, description, Open Graph, Twitter, canonical,
 * JSON-LD, theme bootstrap) holds on all eight page types without being restated.
 */

import type { SiteContext } from './context';
import { esc, jsonScript, oneLine, clip } from './util';
import { searchIndex } from './languages';
import { assetUrl } from './assets';
import { icon } from './icons';

export const SITE_NAME = 'ngano';
export const SITE_TAGLINE = 'A catalogue and unified loader for African-language speech datasets';

export interface PageMeta {
  /** Page title without the site suffix. */
  title: string;
  /** Meta description, also used for Open Graph and Twitter. */
  description: string;
  /** Absolute path of this page, used for the canonical link and nav highlighting. */
  path: string;
  /** Optional schema.org object rendered as JSON-LD. */
  jsonLd?: unknown;
  /** Extra markup appended to the head, for per-page preloads. */
  head?: string;
  /** Extra scripts appended at the end of the body, in source order. */
  scripts?: string[];
  /** Tell crawlers not to index this page. Used for 404. */
  noindex?: boolean;
}

/*
 * `/countries` and `/languages` are the two directories a reader actually arrives
 * looking for, so they sit in the nav rather than being reachable only by guessing a
 * URL or clicking through the map.
 */
const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Overview' },
  { href: '/map', label: 'Map' },
  { href: '/countries', label: 'Countries' },
  { href: '/languages', label: 'Languages' },
  { href: '/docs', label: 'API' },
  { href: '/credits', label: 'Credits' },
  { href: '/contact', label: 'Contact' },
];

/**
 * Every page here is a static document the Worker generates, so the honest way to kill
 * the reload is to have the next page already rendered before it is asked for, not to
 * bolt a client-side router onto markup that does not need one.
 *
 * `moderate` prerenders a same-origin link once the pointer has rested on it, which is
 * about 200ms before the click lands: enough to finish the document, and cheap enough
 * that hovering the nav does not fetch the whole site. Paired with the cross-document
 * view transition in the stylesheet, a click swaps one rendered page for another with
 * no white flash and no second paint.
 *
 * The API, the MCP endpoint and the raw data files are excluded: those are downloads
 * and JSON, and prerendering a 760KB catalogue because the pointer crossed a footer
 * link would be worse than the reload this replaces. Unsupported browsers ignore the
 * script entirely and navigate the ordinary way.
 */
const SPECULATION_RULES = `<script type="speculationrules">${JSON.stringify({
  prerender: [
    {
      where: {
        and: [
          { href_matches: '/*' },
          { not: { href_matches: '/api/*' } },
          { not: { href_matches: '/data/*' } },
          { not: { href_matches: '/mcp' } },
          { not: { selector_matches: '[rel~="external"]' } },
          { not: { selector_matches: '[download]' } },
        ],
      },
      eagerness: 'moderate',
    },
  ],
})}</script>`;

/**
 * Runs before first paint so a reader who chose a theme never sees the other one flash.
 * Kept inline and tiny on purpose: an external file would race the render.
 */
const THEME_BOOT =
  'try{var t=localStorage.getItem("ngano-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}';

function absolute(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return path === '/' ? `${base}/` : `${base}${path}`;
}

function head(ctx: SiteContext, meta: PageMeta): string {
  const canonical = absolute(ctx.baseUrl, meta.path);
  const fullTitle = meta.path === '/' ? `${SITE_NAME}: ${meta.title}` : `${meta.title} | ${SITE_NAME}`;
  const description = clip(oneLine(meta.description), 300);
  const ogImage = absolute(ctx.baseUrl, '/og.svg');

  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    meta.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow">',
    `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
    `<meta property="og:title" content="${esc(fullTitle)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta property="og:image" content="${esc(ogImage)}">`,
    `<meta property="og:locale" content="en_GB">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(fullTitle)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(ogImage)}">`,
    '<meta name="color-scheme" content="light dark">',
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F6F5FA">',
    '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#100E18">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    SPECULATION_RULES,
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">',
    `<link rel="stylesheet" href="${esc(assetUrl('/styles.css'))}">`,
    `<script>${THEME_BOOT}</script>`,
    meta.jsonLd ? `<script type="application/ld+json">${jsonScript(meta.jsonLd)}</script>` : '',
    meta.head ?? '',
  ]
    .filter(Boolean)
    .join('\n');
}

function masthead(ctx: SiteContext, meta: PageMeta): string {
  const nav = NAV.map((item) => {
    const current = item.href === '/' ? meta.path === '/' : meta.path.startsWith(item.href);
    return `<a href="${esc(item.href)}"${current ? ' aria-current="page"' : ''}>${esc(item.label)}</a>`;
  }).join('');

  return `<header class="mast">
<div class="wrap mast-in">
<a class="brand" href="/"><span class="dot"></span><b>ngano</b><span class="beta" title="The catalogue is still being added to and corrected">beta</span><span class="sub">${esc(ctx.stats.datasets)} datasets &middot; ${esc(ctx.stats.languages)} language tags</span></a>
<div class="mast-spacer"></div>
<nav class="mainnav" aria-label="Main">${nav}</nav>
<form class="searchbox" role="search" action="/api/v1/datasets" method="get" id="site-search" autocomplete="off">
<span class="ic">${icon('search', 15)}</span>
<label class="sr" for="site-q">Search the catalogue</label>
<input id="site-q" name="q" type="search" placeholder="sna, Shona, Kenya" role="combobox" aria-expanded="false" aria-controls="site-sugg" aria-autocomplete="list">
<div class="sugg" id="site-sugg" role="listbox" aria-label="Search results" hidden></div>
</form>
<script type="application/json" id="lang-index">${jsonScript(searchIndex(ctx))}</script>
<button class="iconbtn" id="theme-toggle" type="button" aria-label="Switch between light and dark theme" title="Switch theme">
<span class="sun">${icon('sun', 16)}</span><span class="moon">${icon('moon', 16)}</span>
</button>
</div>
</header>`;
}

function footer(ctx: SiteContext): string {
  const author = esc(ctx.credits.author.name);
  const dataLicence = esc(ctx.credits.project.data_licence);
  const codeLicence = esc(ctx.credits.project.code_licence);
  return `<footer class="foot">
<div class="wrap">
<div class="cols">
<div>
<h4>Browse</h4>
<ul>
<li><a href="/">Overview</a></li>
<li><a href="/map">Map of Africa</a></li>
<li><a href="/countries">All countries</a></li>
<li><a href="/languages">All languages</a></li>
<li><a href="/docs">API and SDKs</a></li>
<li><a href="/credits">Credits and citation</a></li>
<li><a href="/contact">Contact</a></li>
</ul>
</div>
<div>
<h4>Data</h4>
<ul>
<li><a href="/api/v1/stats">Aggregate statistics</a></li>
<li><a href="/api/v1/datasets">All records as JSON</a></li>
<li><a href="/api/v1/schema">Canonical row schema</a></li>
<li><a href="/api/v1/openapi.json">OpenAPI document</a></li>
</ul>
</div>
<div>
<h4>Licences</h4>
<ul>
<li>Catalogue data: ${dataLicence}</li>
<li>Code: ${codeLicence}</li>
<li>Each dataset keeps its own licence</li>
</ul>
</div>
</div>
<p>Built and maintained by <a href="/credits">${author}</a>. ngano is a catalogue of sources, not a mirror. Hours are as published by each source. Self-reported figures of 20,000 hours or more are flagged and left out of every total.</p>
<p><span style="font-family:var(--font-mono);font-size:11.5px">v${esc(ctx.version)} &middot; beta. Records are still being added and corrected, so treat any figure as the best reading so far rather than a settled one.</span></p>
</div>
</footer>`;
}

/** Assemble a complete HTML document. */
export function page(ctx: SiteContext, meta: PageMeta, body: string): string {
  const scripts = ['/site.js', ...(meta.scripts ?? [])]
    .map((src) => `<script src="${esc(assetUrl(src))}" defer></script>`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
${head(ctx, meta)}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${masthead(ctx, meta)}
<main id="main" class="wrap">
${body}
</main>
${footer(ctx)}
${scripts}
</body>
</html>
`;
}

/** A breadcrumb trail. The last entry is rendered as plain text. */
export function crumbs(trail: { href?: string; label: string }[]): string {
  const parts = trail.map((item) =>
    item.href ? `<a href="${esc(item.href)}">${esc(item.label)}</a>` : `<span>${esc(item.label)}</span>`,
  );
  return `<nav class="crumb" aria-label="Breadcrumb">${parts.join(' <span aria-hidden="true">/</span> ')}</nav>`;
}

/** A headline number tile. */
export function bigNumber(value: string, label: string, highlight = false): string {
  return `<div class="bn${highlight ? ' hi' : ''}"><div class="v">${esc(value)}</div><div class="k">${esc(label)}</div></div>`;
}

/**
 * A bar row whose label is already markup, for rows that carry a language chip or any
 * other small element beside the name. The caller is responsible for escaping it.
 */
export function barRowRich(labelHtml: string, value: string, fraction: number): string {
  const pct = Math.max(0, Math.min(100, fraction * 100));
  return `<div class="brow"><div class="bl">${labelHtml}</div><div class="bv">${esc(value)}</div><div class="btrack"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;
}

/** A horizontal bar row for a facet breakdown. */
export function barRow(label: string, value: string, fraction: number, href?: string): string {
  const pct = Math.max(0, Math.min(100, fraction * 100));
  const name = href ? `<a href="${esc(href)}">${esc(label)}</a>` : esc(label);
  return `<div class="brow"><div class="bl">${name}</div><div class="bv">${esc(value)}</div><div class="btrack"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;
}
