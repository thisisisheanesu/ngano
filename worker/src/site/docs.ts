/**
 * The documentation page: the HTTP API, the MCP server, the canonical row, and a
 * quickstart for each SDK. The "try it" console at the top hits the real API from
 * the reader's browser, so nothing on this page is a promise about behaviour that
 * has not been exercised.
 */

import type { SiteContext } from './context';
import { page, crumbs } from './layout';
import { codeBlock, tabs, snippetTabs, installTabs, cliTabs } from './snippets';
import { esc, num } from './util';
import { regionalCount } from './languages';
import { icon } from './icons';

interface FieldMapShape {
  canonical?: Record<string, string>;
  aliases?: Record<string, string[]>;
  drop?: string[];
  unit_hints?: Record<string, { canonical?: string; multiply?: number }>;
  overrides?: Record<string, unknown>;
}

const ENDPOINTS: { path: string; summary: string; example: string }[] = [
  { path: 'GET /datasets', summary: 'Filter and page the catalogue. Returns data plus meta with page, per_page, total, total_pages and total_hours.', example: '/api/v1/datasets?country=ZW&sort=-hours' },
  { path: 'GET /datasets/{id}', summary: 'One dataset record. 404 when the id is unknown.', example: '/api/v1/datasets/fleurs-few-shot-learning-evaluation-of-universal-representations' },
  { path: 'GET /countries', summary: 'All 58 countries and territories with dataset count, hours and languages.', example: '/api/v1/countries' },
  { path: 'GET /countries/{iso2}', summary: 'One country, its datasets and its languages.', example: '/api/v1/countries/ng' },
  { path: 'GET /languages', summary: 'Every language tag in the catalogue with its ISO 639-3 code, dataset count and apportioned hours.', example: '/api/v1/languages' },
  { path: 'GET /languages/{tag}', summary: 'One language and its datasets, by BCP 47 tag, bare code or any spelling a source used.', example: '/api/v1/languages/sna' },
  { path: 'GET /stats', summary: 'Global totals and per-facet aggregates: task, licence family, access, labelling, quality, variety, domain, region.', example: '/api/v1/stats' },
  { path: 'GET /schema', summary: 'The contents of field_map.json: the canonical row, the column aliases, the unit hints and the per-repo overrides.', example: '/api/v1/schema' },
  { path: 'GET /openapi.json', summary: 'OpenAPI 3.1 description of everything above.', example: '/api/v1/openapi.json' },
  { path: 'GET /healthz', summary: 'Liveness: ok, version and the number of datasets loaded.', example: '/api/v1/healthz' },
];

const PARAMS: { name: string; accepts: string; note: string }[] = [
  { name: 'q', accepts: 'text', note: 'Free text across name, languages, countries, host and notes.' },
  { name: 'language', accepts: 'BCP 47 tag, name or alias, repeatable', note: 'Resolved to a tag before matching, so sna, Shona and chiShona all mean sna.' },
  { name: 'iso', accepts: 'ISO 639-3 code, repeatable', note: 'The bare three-letter code, which matches the language at large.' },
  { name: 'country', accepts: 'ISO 3166 alpha-2, repeatable', note: 'Country the dataset names.' },
  { name: 'region', accepts: 'name, repeatable', note: 'West Africa, East Africa, Horn of Africa, Central Africa, Southern Africa, North Africa, Island states.' },
  { name: 'task', accepts: 'ASR, TTS, ASR+TTS, Raw source, Other', note: 'What the corpus is for.' },
  { name: 'variety', accepts: 'name, repeatable', note: 'Indigenous, creole, code-switched and accented varieties.' },
  { name: 'commercial', accepts: 'Yes, Yes if purchased, No, Unstated', note: 'Commercial use as the source states it.' },
  { name: 'licence_class', accepts: 'name, repeatable', note: 'Licence family rather than the exact string.' },
  { name: 'access', accepts: 'Open, Request, Paid, Scrape required', note: 'How the files are obtained.' },
  { name: 'labelled', accepts: 'Transcribed, Unlabelled, Unstated', note: 'Whether transcripts exist.' },
  { name: 'quality', accepts: 'name, repeatable', note: 'Studio, Standard, Broadcast, Crowdsourced, Narrowband, Unstated.' },
  { name: 'domain', accepts: 'name, repeatable', note: 'Recording domain, for example read, broadcast, clinical.' },
  { name: 'host', accepts: 'name, repeatable', note: 'Who serves the files.' },
  { name: 'hf_only', accepts: 'true, false', note: 'Only records with a Hugging Face repository.' },
  { name: 'min_hours, max_hours', accepts: 'number', note: 'Bounds on the stated size.' },
  { name: 'has_hours', accepts: 'true, false', note: 'Only records that state a size at all.' },
  { name: 'sort', accepts: 'hours, name, year', note: 'Prefix with a minus for descending, for example sort=-hours.' },
  { name: 'page, per_page', accepts: 'number', note: 'One-based page, default 50 per page, maximum 200.' },
  { name: 'fields', accepts: 'comma separated', note: 'Project a subset of the record, for example fields=id,name,hours.' },
];

const MCP_TOOLS: { name: string; summary: string }[] = [
  { name: 'search_datasets', summary: 'The /datasets filter set, as a tool call.' },
  { name: 'get_dataset', summary: 'One record by ngano id.' },
  { name: 'list_countries', summary: 'Every country with its counts.' },
  { name: 'get_country', summary: 'One country, its datasets and languages.' },
  { name: 'list_languages', summary: 'Every language tag with its code and counts.' },
  { name: 'get_language', summary: 'One language and its datasets, by tag, code or alias.' },
  { name: 'get_stats', summary: 'Global totals and per-facet aggregates.' },
  { name: 'get_loader_snippet', summary: 'Ready-to-run Python, JavaScript or Rust for the current filter.' },
];

export function renderDocs(ctx: SiteContext): string {
  const fieldMap = (typeof ctx.fieldMap === 'object' && ctx.fieldMap !== null ? ctx.fieldMap : {}) as FieldMapShape;
  const canonical = fieldMap.canonical ?? {};
  const aliases = fieldMap.aliases ?? {};
  const mcpUrl = `${ctx.baseUrl}/mcp`;
  const regional = regionalCount(ctx);
  const apiBase = `${ctx.baseUrl}/api/v1`;

  const schemaRows = Object.entries(canonical)
    .map(
      ([column, meaning]) =>
        `<tr><th scope="row"><code class="inl">${esc(column)}</code></th><td style="color:var(--ink-2)">${esc(meaning)}</td><td><code class="inl">${esc(num(aliases[column]?.length ?? 0))}</code></td></tr>`,
    )
    .join('');

  const endpointRows = ENDPOINTS.map(
    (endpoint) =>
      `<tr><th scope="row" style="white-space:nowrap"><code class="inl">${esc(endpoint.path)}</code></th><td style="color:var(--ink-2)">${esc(endpoint.summary)}</td><td><a href="${esc(endpoint.example)}"><code class="inl">try</code></a></td></tr>`,
  ).join('');

  const paramRows = PARAMS.map(
    (param) =>
      `<tr><th scope="row"><code class="inl">${esc(param.name)}</code></th><td><code class="inl">${esc(param.accepts)}</code></td><td style="color:var(--ink-2)">${esc(param.note)}</td></tr>`,
  ).join('');

  const toolRows = MCP_TOOLS.map(
    (tool) =>
      `<tr><th scope="row"><code class="inl">${esc(tool.name)}</code></th><td style="color:var(--ink-2)">${esc(tool.summary)}</td></tr>`,
  ).join('');

  const claudeDesktop = `{
  "mcpServers": {
    "ngano": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${mcpUrl}"]
    }
  }
}`;

  const claudeCode = `claude mcp add --transport http ngano ${mcpUrl}`;

  const cursor = `{
  "mcpServers": {
    "ngano": {
      "url": "${mcpUrl}"
    }
  }
}`;

  const body = `
${crumbs([{ href: '/', label: 'ngano' }, { label: 'API and SDKs' }])}

<h1 class="title" style="margin-bottom:10px">API, MCP and SDKs</h1>
<p class="lede">Everything ngano knows is public and unauthenticated. No key, no token, no sign-up, CORS open to every origin. The site you are reading is rendered from the same data the API returns.</p>

<section class="block panel" id="try">
  <h2 class="sec">Try it now</h2>
  <p class="note" style="margin-bottom:14px">This form calls the live API from your browser. Change the query string and send it.</p>
  <form class="form" id="tryit" action="${esc(apiBase)}/datasets" method="get">
    <div class="inline3">
      <div class="field">
        <label for="tryit-endpoint">Endpoint</label>
        <select id="tryit-endpoint" name="endpoint">
          ${ENDPOINTS.map((endpoint) => `<option value="${esc(endpoint.example.split('?')[0] ?? '')}">${esc(endpoint.path)}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="grid-column:span 2">
        <label for="tryit-query">Query string</label>
        <input id="tryit-query" name="query" type="text" value="country=ZW&amp;sort=-hours&amp;per_page=3" spellcheck="false">
      </div>
    </div>
    <div class="btnrow">
      <button class="btn pri" type="submit">${icon('spark', 15)} Send request</button>
      <code class="inl urlchip" id="tryit-url">${esc(apiBase)}/datasets</code>
    </div>
  </form>
  <p class="status" id="tryit-status">Not sent yet.</p>
  <div class="out"><pre class="code" id="tryit-out" style="max-height:340px">Send a request to see the response here.</pre></div>
  <noscript><p class="note">Without JavaScript this form still submits to the API and returns real JSON, but only the script applies the endpoint picker and the query box. The endpoint table below links to live examples you can open directly.</p></noscript>
</section>

<section class="block">
  <h2 class="sec">Endpoints</h2>
  <p class="note" style="margin-bottom:12px">Base <code class="inl">${esc(apiBase)}</code>. JSON only, cache friendly, no auth.</p>
  <div class="tscroll">
    <table class="tbl">
      <thead><tr><th scope="col">Endpoint</th><th scope="col">What it returns</th><th scope="col">Example</th></tr></thead>
      <tbody>${endpointRows}</tbody>
    </table>
  </div>
</section>

<section class="block panel" id="language-tags">
  <h2 class="sec">How languages are identified</h2>
  <p class="lede" style="font-size:15px">Every language in ngano is a BCP 47 tag. The primary subtag is always an ISO 639-3 three-letter code, and an optional ISO 3166-1 alpha-2 region subtag marks a country-specific variety. Shona is <code class="inl">sna</code>, Swahili is <code class="inl">swh</code>, Nigerian English is <code class="inl">eng-NG</code> and Mozambican Portuguese is <code class="inl">por-MZ</code>.</p>
  <div class="tscroll">
    <table class="tbl">
      <thead><tr><th scope="col">Part</th><th scope="col">Example</th><th scope="col">What it means</th></tr></thead>
      <tbody>
        <tr><th scope="row">Primary subtag</th><td><code class="inl">sna</code></td><td style="color:var(--ink-2)">ISO 639-3 code for the language at large. Always three letters, always lowercase.</td></tr>
        <tr><th scope="row">Region subtag</th><td><code class="inl">eng-NG</code></td><td style="color:var(--ink-2)">ISO 3166-1 alpha-2 country code, uppercase, for a variety the catalogue records separately.</td></tr>
        <tr><th scope="row">Page and API path</th><td><code class="inl">/languages/eng-ng</code></td><td style="color:var(--ink-2)">The lowercased tag. Both the site and the API accept any case, and accept a source spelling too.</td></tr>
      </tbody>
    </table>
  </div>
  <p class="note" style="margin-top:14px">${esc(num(regional))} of the ${esc(num(ctx.stats.languages))} tags carry a region subtag, over ${esc(num(ctx.stats.language_codes))} distinct ISO 639-3 codes. A regional tag is preferred over inventing a code: the audio in a Nigerian-accented English corpus is English, so it stays under <code class="inl">eng</code> and is marked <code class="inl">eng-NG</code>, which keeps it findable both as English and as the variety it is. A private-use code would hide it from both.</p>
  <p class="note">Source spellings are kept. Every name a catalogued source used is recorded as an alias of the tag it resolves to, so searching for isiZulu, Sepedi or chiShona lands on <code class="inl">zul</code>, <code class="inl">nso</code> and <code class="inl">sna</code>. A handful of sources describe their coverage in prose rather than naming languages, for example "~340 African languages"; those records carry no tags at all and say so on their page rather than guessing.</p>
</section>

<section class="block">
  <h2 class="sec">Filtering /datasets</h2>
  <p class="note" style="margin-bottom:12px">Repeatable parameters are OR within a parameter and AND across parameters. A comma separated list means the same thing as repeating the parameter.</p>
  <div class="tscroll">
    <table class="tbl">
      <thead><tr><th scope="col">Parameter</th><th scope="col">Accepts</th><th scope="col">Notes</th></tr></thead>
      <tbody>${paramRows}</tbody>
    </table>
  </div>
  <h3 class="sub" style="margin-top:20px">Errors</h3>
  ${codeBlock(`{"error": {"code": "bad_request", "message": "per_page must be between 1 and 200", "status": 400}}`, 'json')}
  <p class="note">The HTTP status always matches the status in the body.</p>
</section>

<section class="block" id="mcp">
  <h2 class="sec">MCP server</h2>
  <p class="lede" style="font-size:15px">A streamable HTTP MCP endpoint at <code class="inl">${esc(mcpUrl)}</code>, protocol version <code class="inl">2025-06-18</code>, no auth. Point any MCP client at it and your assistant can search the catalogue and write loader code against real records instead of guessing at dataset names.</p>
  ${tabs('mcpcfg', 'MCP client', [
    {
      id: 'desktop',
      label: 'Claude Desktop',
      content: `<p class="note" style="margin:12px 0">Add this to <code class="inl">claude_desktop_config.json</code>, then restart the app. The proxy is only needed because the desktop app speaks stdio.</p>${codeBlock(claudeDesktop, 'json', 'claude_desktop_config.json')}`,
    },
    {
      id: 'code',
      label: 'Claude Code',
      content: `<p class="note" style="margin:12px 0">One command, no config file.</p>${codeBlock(claudeCode, 'shell', 'Terminal')}`,
    },
    {
      id: 'cursor',
      label: 'Cursor',
      content: `<p class="note" style="margin:12px 0">Add this to <code class="inl">~/.cursor/mcp.json</code> for every project, or <code class="inl">.cursor/mcp.json</code> for one.</p>${codeBlock(cursor, 'json', '.cursor/mcp.json')}`,
    },
  ])}
  <h3 class="sub" style="margin-top:22px">Tools</h3>
  <div class="tscroll">
    <table class="tbl">
      <thead><tr><th scope="col">Tool</th><th scope="col">What it does</th></tr></thead>
      <tbody>${toolRows}</tbody>
    </table>
  </div>
  <p class="note">Every tool returns human readable text alongside <code class="inl">structuredContent</code>, and declares an <code class="inl">outputSchema</code>, so a client can use either.</p>
</section>

<section class="block" id="row">
  <h2 class="sec">The canonical row</h2>
  <p class="lede" style="font-size:15px">All three SDKs emit exactly this shape, whatever the source dataset called its columns. Anything the source had that does not map is kept under <code class="inl">extra</code> rather than dropped.</p>
  <div class="tscroll">
    <table class="tbl">
      <thead><tr><th scope="col">Column</th><th scope="col">Meaning</th><th scope="col">Aliases</th></tr></thead>
      <tbody>${schemaRows}</tbody>
    </table>
  </div>
  <h3 class="sub" style="margin-top:20px">How a column is resolved</h3>
  <ol style="color:var(--ink-2);max-width:74ch;padding-left:20px">
    <li>A pinned mapping for the repository in <code class="inl">field_map.json</code>, if one exists.</li>
    <li>Inspection of the dataset's real columns against the alias table, ignoring case, underscores and hyphens.</li>
    <li>Unit hints, so a source that publishes <code class="inl">duration_ms</code> lands in <code class="inl">duration_s</code>.</li>
    <li>Everything unmapped goes to <code class="inl">extra</code>. Nothing is silently dropped except the columns explicitly listed in <code class="inl">drop</code>.</li>
  </ol>
  <p class="note">Audio stays lazy. A row carries a handle of <code class="inl">{url, path, bytes, sampling_rate}</code> and nothing is decoded until you ask for it, which is what makes it safe to break out of a stream after the first row.</p>
  <p style="margin-top:14px"><a class="btn" href="/api/v1/schema">${icon('external', 14)} The whole schema as JSON</a></p>
</section>

<section class="block" id="sdks">
  <h2 class="sec">SDK quickstart</h2>
  <p class="lede" style="font-size:15px">Three packages, one surface, one canonical row. Everything below is generated from the packages themselves, and each package compiles or type checks its own snippets in CI, so these are not illustrations.</p>

  <h3 class="sub" style="margin-top:20px">Install and first call</h3>
  ${installTabs(ctx, 'sdk-install')}

  <h3 class="sub" style="margin-top:26px">Filter the catalogue</h3>
  <p class="note" style="margin-bottom:0">The catalogue ships inside each package, so this runs offline and needs no token.</p>
  ${snippetTabs(ctx, 'sdk-catalogue', 'catalogue_filter')}

  <h3 class="sub" style="margin-top:26px">Stream rows across everything that matched</h3>
  <p class="note" style="margin-bottom:0">Datasets are interleaved lazily, so breaking out of the loop stops the requests still in flight.</p>
  ${snippetTabs(ctx, 'sdk-stream', 'stream_filter')}

  <h3 class="sub" style="margin-top:26px">Go straight to one repository</h3>
  <p class="note" style="margin-bottom:0">Works whether or not the catalogue lists the repo.</p>
  ${snippetTabs(ctx, 'sdk-single', 'single_dataset')}
</section>

<section class="block" id="cli">
  <h2 class="sec">Command line</h2>
  <p class="lede" style="font-size:15px">Each package ships the same command set, so the catalogue is searchable from a shell without writing any code.</p>
  ${cliTabs(ctx, 'sdk-cli')}
</section>

<section class="block">
  <div class="callout">
    <strong>Rate limits and fair use.</strong>
    There are none, and there is no key to lose. The API is small, cached at the edge and served from static data, so hammering it mostly costs you latency. If you need the whole catalogue, take it in one request from <code class="inl">${esc(apiBase)}/datasets?per_page=200</code> and page, rather than fetching records one at a time.
  </div>
</section>
`;

  return page(
    ctx,
    {
      title: 'API, MCP server and SDK reference',
      description: `Reference for the ngano JSON API, the MCP server at ${mcpUrl}, the canonical audio row shared by all three SDKs, and quickstarts for Python, JavaScript and Rust. No auth, no keys, CORS open.`,
      path: '/docs',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: 'ngano API, MCP and SDK reference',
        url: `${ctx.baseUrl}/docs`,
        author: { '@type': 'Person', name: ctx.credits.author.name },
        isPartOf: { '@type': 'WebSite', name: 'ngano', url: ctx.baseUrl },
      },
    },
    body,
  );
}
