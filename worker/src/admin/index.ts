/**
 * Routing and request handling for /admin.
 *
 * Everything here is behind a session cookie. Nothing under /admin is cacheable, is
 * indexed, or appears in the sitemap, and the whole subtree answers 404 when the KV
 * binding or the analytics token is missing rather than half-working.
 */

import type { Env } from '../data.js';
import type { SiteContext } from '../types.js';
import {
  checkPassword,
  clearCookie,
  clearFailures,
  createSession,
  dropAllSessions,
  dropSession,
  makeUser,
  noteFailure,
  passwordProblem,
  readCookie,
  readSession,
  readUser,
  setCookie,
  tooManyAttempts,
  writeUser,
  COOKIE,
} from './auth.js';
import { fetchTraffic } from './query.js';
import { dashboardPage, loginPage, passwordPage } from './page.js';
import { assetUrl } from '../site/assets.js';

const ACCOUNT_ID = '67cb2eb6080019612e374af596f7197c';

/** Admin responses are per-session and must never be cached anywhere. */
function page(html: string, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'same-origin',
      ...extra,
    },
  });
}

function redirect(to: string, extra: Record<string, string> = {}): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: to, 'Cache-Control': 'no-store, private', ...extra },
  });
}

function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? 'unknown';
}

/**
 * The admin exists only when it is fully configured. A half-configured admin that shows
 * a login box it cannot check is worse than no admin at all.
 */
export function adminEnabled(env: Env): boolean {
  return Boolean(env.ADMIN && env.CF_ANALYTICS_TOKEN);
}

export async function handleAdmin(req: Request, env: Env, path: string, ctx: SiteContext): Promise<Response> {
  const kv = env.ADMIN as KVNamespace;
  const styleHref = assetUrl('/styles.css');
  const cookie = readCookie(req, COOKIE);
  const session = await readSession(kv, cookie);

  if (path === '/admin/login') {
    if (req.method === 'GET') {
      if (session) return redirect('/admin');
      return page(loginPage(styleHref));
    }
    if (req.method !== 'POST') return page(loginPage(styleHref), 405);

    const ip = clientIp(req);
    if (await tooManyAttempts(kv, ip)) {
      return page(loginPage(styleHref, 'Too many attempts. Wait fifteen minutes.'), 429);
    }
    const form = await req.formData();
    const username = String(form.get('username') ?? '');
    const password = String(form.get('password') ?? '');
    const user = await readUser(kv);

    /*
     * The password is verified even when the username is wrong, so a wrong username and
     * a wrong password take the same time and the response cannot be used to learn
     * which one was right.
     */
    const stored = user ?? (await makeUser('nobody', crypto.randomUUID()));
    const passwordOk = await checkPassword(stored, password);
    const ok = Boolean(user) && passwordOk && username === user?.username;

    if (!ok) {
      await noteFailure(kv, ip);
      return page(loginPage(styleHref, 'That username and password did not match.'), 401);
    }
    await clearFailures(kv, ip);
    const id = await createSession(kv, username);
    return redirect('/admin', { 'Set-Cookie': setCookie(id) });
  }

  if (!session) return redirect('/admin/login');

  if (path === '/admin/logout') {
    if (req.method !== 'POST') return redirect('/admin');
    await dropSession(kv, cookie);
    return redirect('/admin/login', { 'Set-Cookie': clearCookie() });
  }

  if (path === '/admin/password') {
    if (req.method === 'GET') return page(passwordPage(styleHref, session.csrf));
    if (req.method !== 'POST') return page(passwordPage(styleHref, session.csrf), 405);

    const form = await req.formData();
    if (String(form.get('csrf') ?? '') !== session.csrf) {
      return page(passwordPage(styleHref, session.csrf, 'That form expired. Try again.'), 403);
    }
    const user = await readUser(kv);
    if (!user) return page(passwordPage(styleHref, session.csrf, 'No admin user is configured.'), 500);

    const current = String(form.get('current') ?? '');
    const next = String(form.get('next') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    const username = String(form.get('username') ?? '').trim();

    if (!(await checkPassword(user, current))) {
      return page(passwordPage(styleHref, session.csrf, 'The current password is wrong.'), 401);
    }
    if (next !== confirm) {
      return page(passwordPage(styleHref, session.csrf, 'The two new passwords do not match.'), 400);
    }
    const problem = passwordProblem(next);
    if (problem) return page(passwordPage(styleHref, session.csrf, problem), 400);
    if (!/^[A-Za-z0-9._@-]{2,64}$/.test(username)) {
      return page(passwordPage(styleHref, session.csrf, 'Usernames are 2 to 64 letters, digits, dot, dash, underscore or at sign.'), 400);
    }

    await writeUser(kv, await makeUser(username, next));
    /* A rotation that leaves old sessions signed in has not rotated anything. */
    await dropAllSessions(kv);
    return page(
      loginPage(styleHref, 'Password changed. Every session was signed out, including this one.'),
      200,
      { 'Set-Cookie': clearCookie() },
    );
  }

  if (path === '/admin') {
    const user = await readUser(kv);
    const url = new URL(req.url);
    const requested = Number(url.searchParams.get('days') ?? '7');
    const days = [1, 7, 30, 90].includes(requested) ? requested : 7;
    const traffic = await fetchTraffic(ACCOUNT_ID, env.CF_ANALYTICS_TOKEN as string, days);
    return page(
      dashboardPage({
        traffic,
        days,
        username: session.username,
        passwordUpdated: user?.updated ?? '',
        catalogue: {
          datasets: ctx.stats.datasets,
          languages: ctx.stats.languages,
          countries: ctx.stats.countries,
        },
        csrf: session.csrf,
        styleHref,
      }),
    );
  }

  return redirect('/admin');
}
