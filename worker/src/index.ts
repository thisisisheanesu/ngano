/**
 * ngano on Cloudflare Workers.
 *
 * One Worker serves three things from the same origin: the site, the JSON API at
 * /api/v1 and the MCP server at /mcp. The catalogue is bundled into the Worker, so
 * every response is generated, there is no origin to reach and no asset store to
 * miss. www redirects to the apex.
 */

import { handleApi } from './api.js';
import { handleMcp } from './mcp.js';
import { CACHE_CONTROL_LONG, cors, error, etag, html, json, matchesEtag, notModified, preflight, text } from './http.js';
import { countries, datasets, fieldMap, geo, getContext, languageCodes, languages, snippets, type Env } from './data.js';
import type { SiteContext } from './types.js';
import {
  renderCountry,
  renderCredits,
  renderDataset,
  renderDocs,
  renderHome,
  renderLanguage,
  renderMap,
  renderNotFound,
  siteAssets,
} from './site/index.js';

/** The raw data files, downloadable as-is under CC-BY-4.0. */
const DATA_FILES: Record<string, unknown> = {
  'catalogue.json': datasets,
  'countries.json': countries,
  'languages.json': languages,
  'language_codes.json': languageCodes,
  'africa.geo.json': geo,
  'field_map.json': fieldMap,
  'snippets.json': snippets,
};

function redirectToApex(url: URL): Response {
  const target = new URL(url.toString());
  target.hostname = url.hostname.replace(/^www\./, '');
  return cors(new Response(null, { status: 301, headers: { Location: target.toString(), 'Cache-Control': CACHE_CONTROL_LONG } }));
}

/** Strip the trailing slash so "/docs/" and "/docs" are the same page. */
function normalisePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.replace(/\/+$/, '');
  return pathname;
}

function sitemap(ctx: SiteContext): string {
  const urls: string[] = [
    `${ctx.baseUrl}/`,
    `${ctx.baseUrl}/map`,
    `${ctx.baseUrl}/docs`,
    `${ctx.baseUrl}/credits`,
  ];
  for (const country of ctx.countries) urls.push(`${ctx.baseUrl}/countries/${country.iso2.toLowerCase()}`);
  for (const dataset of ctx.datasets) urls.push(`${ctx.baseUrl}/datasets/${encodeURIComponent(dataset.id)}`);
  for (const language of ctx.languages) urls.push(`${ctx.baseUrl}/languages/${encodeURIComponent(language.slug)}`);
  const body = urls
    .map((loc) => `  <url><loc>${loc.replace(/&/g, '&amp;')}</loc><changefreq>weekly</changefreq></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function robots(ctx: SiteContext): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    '# The catalogue is CC-BY-4.0. The JSON API and the raw files below are open,',
    '# unauthenticated and cheaper for everyone than scraping the HTML.',
    `# API:  ${ctx.baseUrl}/api/v1`,
    `# MCP:  ${ctx.baseUrl}/mcp`,
    `# Data: ${ctx.baseUrl}/data/catalogue.json`,
    '',
    `Sitemap: ${ctx.baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * Site pages. Returns null when the path is not a site page, or when it names a
 * country, dataset or language that does not exist: the three lookup renderers
 * report an unknown key by returning null rather than inventing a page.
 */
function renderSite(path: string, ctx: SiteContext): string | null {
  if (path === '' || path === '/') return renderHome(ctx);
  if (path === '/map') return renderMap(ctx);
  if (path === '/credits') return renderCredits(ctx);
  if (path === '/docs') return renderDocs(ctx);

  const country = /^\/countries\/([^/]+)$/.exec(path);
  if (country?.[1]) return renderCountry(ctx, decodeURIComponent(country[1]));

  const dataset = /^\/datasets\/(.+)$/.exec(path);
  if (dataset?.[1]) return renderDataset(ctx, decodeURIComponent(dataset[1]));

  const language = /^\/languages\/([^/]+)$/.exec(path);
  if (language?.[1]) return renderLanguage(ctx, decodeURIComponent(language[1]));

  return null;
}

export async function handleRequest(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

  if (url.hostname.startsWith('www.')) return redirectToApex(url);
  if (req.method === 'OPTIONS') return preflight();

  const ctx = getContext(env, req.url);
  const path = normalisePath(url.pathname);

  if (path === '/mcp') return handleMcp(req, ctx);
  if (path.startsWith('/api/v1')) return handleApi(req, path.slice('/api/v1'.length), ctx);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return error('method_not_allowed', `${req.method} is not allowed on ${path}.`, 405);
  }

  const dataFile = /^\/data\/([^/]+)$/.exec(path);
  if (dataFile?.[1]) {
    const payload = DATA_FILES[dataFile[1]];
    if (payload === undefined) {
      return error('not_found', `No data file named "${dataFile[1]}". Try catalogue.json, countries.json, languages.json, language_codes.json, africa.geo.json, field_map.json or snippets.json.`, 404);
    }
    const tag = etag(`${dataFile[1]}:${ctx.version}`);
    if (matchesEtag(req, tag)) return notModified(tag, CACHE_CONTROL_LONG);
    return json(payload, {
      cache: CACHE_CONTROL_LONG,
      etag: tag,
      headers: { 'Content-Disposition': `inline; filename="${dataFile[1]}"`, 'X-Licence': 'CC-BY-4.0' },
    });
  }

  if (path === '/robots.txt') return text(robots(ctx));
  if (path === '/sitemap.xml') return text(sitemap(ctx), { type: 'application/xml; charset=utf-8' });

  // Stylesheet, scripts, favicon and social card, straight from the site module.
  // They are generated strings, so they change only when the Worker is redeployed.
  const asset = siteAssets[path === '/favicon.ico' ? '/favicon.svg' : path];
  if (asset) {
    const tag = etag(`${path}:${asset.body}`);
    if (matchesEtag(req, tag)) return notModified(tag, CACHE_CONTROL_LONG);
    return cors(
      new Response(asset.body, {
        headers: { 'Content-Type': asset.contentType, 'Cache-Control': CACHE_CONTROL_LONG, ETag: tag },
      }),
    );
  }

  const page = renderSite(path, ctx);
  if (page !== null) return html(page);

  return html(renderNotFound(ctx, path), { status: 404, cache: 'no-store' });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(req, env);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unhandled error.';
      return error('internal_error', message, 500);
    }
  },
} satisfies ExportedHandler<Env>;
