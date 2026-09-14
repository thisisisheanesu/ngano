/**
 * The admin pages: login, the dashboard, and changing the password.
 *
 * These reuse the site's stylesheet so they look like the rest of ngano, but not its
 * masthead: the admin is not part of the public navigation and should not advertise
 * itself there. Every page is noindex, and /admin is disallowed in robots.txt.
 *
 * Charts are single-series magnitude throughout, so they use one hue, the site accent,
 * with the value printed beside every bar. Nothing here is encoded by colour alone.
 */

import { esc, num } from '../site/util';
import { icon } from '../site/icons';
import type { Row, Series, Traffic } from './query';

const RANGES: { days: number; label: string }[] = [
  { days: 1, label: '24 hours' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

function shell(title: string, body: string, styleHref: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | ngano admin</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="${esc(styleHref)}">
<script>try{var t=localStorage.getItem("ngano-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
</head>
<body>
<main id="main" class="wrap" style="padding-block:28px 56px">
${body}
</main>
</body>
</html>
`;
}

export function loginPage(styleHref: string, message?: string): string {
  return shell(
    'Sign in',
    `<div style="max-width:380px;margin:6vh auto 0">
  <h1 class="title" style="font-size:28px;margin-bottom:6px">ngano admin</h1>
  <p class="note" style="margin-bottom:20px">Traffic for ngano.dev. Not part of the public site.</p>
  ${message ? `<div class="callout" style="margin-bottom:16px"><strong>${esc(message)}</strong></div>` : ''}
  <form class="form" method="post" action="/admin/login">
    <div class="field">
      <label for="u">Username</label>
      <input id="u" name="username" type="text" autocomplete="username" required autofocus>
    </div>
    <div class="field">
      <label for="p">Password</label>
      <input id="p" name="password" type="password" autocomplete="current-password" required>
    </div>
    <div class="btnrow" style="margin-top:6px">
      <button class="btn pri" type="submit">Sign in</button>
    </div>
  </form>
</div>`,
    styleHref,
  );
}

export function passwordPage(styleHref: string, csrf: string, message?: string, ok?: string): string {
  return shell(
    'Change password',
    `<div style="max-width:420px;margin:4vh auto 0">
  ${crumb()}
  <h1 class="title" style="font-size:26px;margin-bottom:6px">Change password</h1>
  <p class="note" style="margin-bottom:18px">At least 12 characters. Changing it signs out every session, including this one.</p>
  ${message ? `<div class="callout" style="margin-bottom:16px"><strong>${esc(message)}</strong></div>` : ''}
  ${ok ? `<div class="callout" style="margin-bottom:16px"><strong>${esc(ok)}</strong></div>` : ''}
  <form class="form" method="post" action="/admin/password">
    <input type="hidden" name="csrf" value="${esc(csrf)}">
    <div class="field">
      <label for="cu">Current password</label>
      <input id="cu" name="current" type="password" autocomplete="current-password" required>
    </div>
    <div class="field">
      <label for="n1">New password</label>
      <input id="n1" name="next" type="password" autocomplete="new-password" required minlength="12">
    </div>
    <div class="field">
      <label for="n2">New password again</label>
      <input id="n2" name="confirm" type="password" autocomplete="new-password" required minlength="12">
    </div>
    <div class="field">
      <label for="un">Username</label>
      <input id="un" name="username" type="text" autocomplete="username" required>
    </div>
    <div class="btnrow" style="margin-top:6px">
      <button class="btn pri" type="submit">Change it</button>
      <a class="btn" href="/admin">Cancel</a>
    </div>
  </form>
</div>`,
    styleHref,
  );
}

function crumb(): string {
  return `<nav class="crumbs" style="margin-bottom:14px"><a href="/admin">Dashboard</a><span>Password</span></nav>`;
}

/** A labelled bar, value always printed: identity is never carried by colour alone. */
function bar(label: string, value: number, max: number, note?: string): string {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return `<div class="brow" title="${esc(label)}: ${esc(num(value))} requests">
<div class="bl">${esc(label)}${note ? ` <span class="note" style="font-size:11.5px">${esc(note)}</span>` : ''}</div>
<div class="bv">${esc(num(value))}</div>
<div class="btrack"><i style="width:${pct.toFixed(1)}%"></i></div>
</div>`;
}

function breakdown(heading: string, rows: Row[], empty: string, label?: (key: string) => string): string {
  const max = rows.reduce((m, r) => Math.max(m, r.requests), 0);
  return `<div class="panel">
<h2 class="sub" style="margin-top:0">${esc(heading)}</h2>
${
  rows.length === 0
    ? `<p class="note">${esc(empty)}</p>`
    : `<div class="brk">${rows.map((r) => bar(label ? label(r.key) : r.key || 'unknown', r.requests, max)).join('')}</div>`
}
</div>`;
}

/**
 * Requests over time as a column chart. One series, one hue, drawn as inline SVG so the
 * page still has no external requests. The reading is the shape, so only the first and
 * last buckets are labelled rather than every column.
 */
function timeChart(series: Series[], days: number): string {
  if (series.length < 2) {
    return `<p class="note">Not enough history yet to draw a trend. Come back after a day of traffic.</p>`;
  }
  const w = 960;
  const h = 170;
  const pad = { top: 10, right: 6, bottom: 22, left: 6 };
  const max = series.reduce((m, s) => Math.max(m, s.requests), 0) || 1;
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const slot = innerW / series.length;
  const barW = Math.max(2, Math.min(28, slot - 3));

  const bars = series
    .map((s, i) => {
      const barH = Math.max(1, (s.requests / max) * innerH);
      const x = pad.left + i * slot + (slot - barW) / 2;
      const y = pad.top + innerH - barH;
      const when = new Date(s.bucket);
      const when_ = Number.isNaN(when.getTime()) ? s.bucket : when.toUTCString();
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="2" class="col"><title>${esc(when_)}: ${esc(num(s.requests))} requests</title></rect>`;
    })
    .join('');

  const first = series[0]?.bucket ?? '';
  const last = series[series.length - 1]?.bucket ?? '';
  return `<figure class="chart" style="margin:0">
<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Requests per ${days <= 2 ? 'hour' : 'day'}, ${series.length} buckets, peak ${num(max)}" preserveAspectRatio="none" style="width:100%;height:${h}px">
<line x1="${pad.left}" y1="${pad.top + innerH + 0.5}" x2="${w - pad.right}" y2="${pad.top + innerH + 0.5}" class="axis"/>
${bars}
</svg>
<figcaption class="note" style="display:flex;justify-content:space-between;margin-top:2px">
<span>${esc(shortDate(first))}</span>
<span>peak ${esc(num(max))} per ${days <= 2 ? 'hour' : 'day'}</span>
<span>${esc(shortDate(last))}</span>
</figcaption>
</figure>`;
}

/**
 * `ZW` means nothing at a glance; `Zimbabwe` does. `Intl.DisplayNames` is in the Workers
 * runtime already, so this costs no bundle and stays current, which a hand-kept list of
 * 250 country names would not. An unknown or made-up code falls back to itself.
 */
const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

export function countryName(code: string): string {
  const key = (code || '').toUpperCase();
  /* Digits allowed: Cloudflare reports T1 for traffic arriving over Tor. */
  if (!/^[A-Z0-9]{2}$/.test(key)) return 'Unknown';
  try {
    const name = REGION_NAMES?.of(key);
    return name || key;
  } catch {
    /* ICU rejects codes that are not real regions, T1 among them. Show it as it came. */
    return key;
  }
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

export interface DashboardData {
  traffic: Traffic;
  days: number;
  username: string;
  passwordUpdated: string;
  catalogue: { datasets: number; languages: number; countries: number };
  csrf: string;
  styleHref: string;
}

export function dashboardPage(d: DashboardData): string {
  const t = d.traffic;
  const ranges = RANGES.map(
    (r) =>
      `<a class="btn${r.days === d.days ? ' pri' : ''}" href="/admin?days=${r.days}">${esc(r.label)}</a>`,
  ).join('');

  const topCountry = t.countries[0];
  const on = (key: string) => t.surfaces.find((s) => s.key === key)?.requests ?? 0;
  /* Kept apart on purpose: my own admin visits are not page views, and an MCP client
     calling tools is not a person reading the site. */
  const pageRequests = on('site');
  const apiRequests = on('api');
  const mcpRequests = on('mcp');
  const adminRequests = on('admin');
  const dataRequests = on('data');
  const publicTotal = t.total - adminRequests;

  const body = `
<header style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:6px">
  <div>
    <h1 class="title" style="font-size:28px;margin-bottom:2px">ngano admin</h1>
    <p class="note" style="margin:0">Signed in as <strong>${esc(d.username)}</strong>. Password last changed ${esc(shortDate(d.passwordUpdated))}.</p>
  </div>
  <div class="btnrow">
    <a class="btn" href="https://ngano.dev/" rel="noopener">${icon('arrow', 15)} The site</a>
    <a class="btn" href="/admin/password">Change password</a>
    <form method="post" action="/admin/logout" style="display:inline">
      <input type="hidden" name="csrf" value="${esc(d.csrf)}">
      <button class="btn" type="submit">Sign out</button>
    </form>
  </div>
</header>

<div class="btnrow" style="margin:18px 0 22px">${ranges}</div>

${
  t.error
    ? `<div class="callout" style="margin-bottom:20px"><strong>The analytics query failed.</strong> ${esc(t.error)}</div>`
    : ''
}

<section class="block panel">
  <h2 class="sec">Traffic</h2>
  <p class="note" style="margin:0 0 16px">Requests that reached the Worker in the last ${esc(RANGES.find((r) => r.days === d.days)?.label ?? `${d.days} days`)}. The stylesheet, scripts and icons are not counted, and rows recorded before that changed are excluded here too. Cloudflare answers repeat requests from its edge cache without running the Worker, so a page someone revisits inside the hour is missed.</p>
  <div class="bignums">
    <div class="bn hi"><div class="v">${esc(num(publicTotal))}</div><div class="k">requests, excluding admin</div></div>
    <div class="bn"><div class="v">${esc(num(pageRequests))}</div><div class="k">page views</div></div>
    <div class="bn"><div class="v">${esc(num(apiRequests))}</div><div class="k">API calls</div></div>
    <div class="bn"><div class="v">${esc(num(mcpRequests))}</div><div class="k">MCP calls</div></div>
    <div class="bn"><div class="v">${esc(num(dataRequests))}</div><div class="k">raw data downloads</div></div>
    <div class="bn"><div class="v">${esc(num(t.countries.length))}</div><div class="k">countries</div></div>
    <div class="bn"><div class="v">${esc(topCountry ? countryName(topCountry.key) : 'none')}</div><div class="k">busiest country</div></div>
    <div class="bn"><div class="v">${esc(num(adminRequests))}</div><div class="k">your own admin visits</div></div>
  </div>
</section>

<section class="block panel">
  <h2 class="sub" style="margin-top:0">Requests over time</h2>
  ${timeChart(t.overTime, d.days)}
</section>

<section class="block">
  <div class="grid g2">
    ${breakdown('By country', t.countries.slice(0, 25), 'Nothing recorded yet.', countryName)}
    ${breakdown('What was asked for', t.surfaces, 'Nothing recorded yet.', surfaceLabel)}
  </div>
</section>

<section class="block">
  <div class="grid g2">
    ${breakdown('Most requested routes', t.routes.slice(0, 20), 'Nothing recorded yet.')}
    ${breakdown('Response status', t.statuses, 'Nothing recorded yet.')}
  </div>
</section>

<section class="block panel">
  <h2 class="sub" style="margin-top:0">Every country</h2>
  <p class="note" style="margin:0 0 12px">The full list, so nothing is hidden behind a top-25 cut.</p>
  <div class="tscroll">
    <table class="tbl">
      <caption class="sr">Requests per country</caption>
      <thead><tr><th scope="col">Country</th><th scope="col">Code</th><th scope="col" class="r">Requests</th><th scope="col" class="r">Share</th></tr></thead>
      <tbody>${
        t.countries.length === 0
          ? '<tr><td colspan="4">Nothing recorded yet.</td></tr>'
          : t.countries
              .map(
                (r) =>
                  `<tr><th scope="row">${esc(countryName(r.key))}</th><td><code class="inl">${esc(r.key || 'XX')}</code></td><td class="r">${esc(num(r.requests))}</td><td class="r">${t.total ? ((r.requests / t.total) * 100).toFixed(1) : '0.0'}%</td></tr>`,
              )
              .join('')
      }</tbody>
    </table>
  </div>
</section>

<section class="block panel">
  <h2 class="sub" style="margin-top:0">The catalogue</h2>
  <div class="bignums">
    <div class="bn"><div class="v">${esc(num(d.catalogue.datasets))}</div><div class="k">datasets</div></div>
    <div class="bn"><div class="v">${esc(num(d.catalogue.languages))}</div><div class="k">language tags</div></div>
    <div class="bn"><div class="v">${esc(num(d.catalogue.countries))}</div><div class="k">countries covered</div></div>
  </div>
</section>
`;
  return shell('Dashboard', body, d.styleHref);
}

function surfaceLabel(key: string): string {
  const labels: Record<string, string> = {
    site: 'Pages',
    api: 'JSON API',
    mcp: 'MCP server',
    admin: 'This dashboard',
    data: 'Raw data files',
    /* Not counted and filtered out of every query; kept only so an old row is legible. */
    asset: 'CSS, JS and icons',
  };
  return labels[key] ?? key;
}
