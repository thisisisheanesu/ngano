/**
 * The contact form.
 *
 * A message goes two places: to the inbox through Cloudflare Email Routing, and into KV.
 * The KV copy is the one that matters. Email delivery can fail for reasons that have
 * nothing to do with the sender, and a contact form that loses a message because a
 * mail server was slow is worse than no contact form, so the stored copy is written
 * first and the send is allowed to fail without failing the submission.
 *
 * There is no captcha. The site loads no third-party script and this is not the place
 * to start: a hidden field bots fill in, a minimum time on the page, and a per-address
 * rate limit stop the volume that a small site actually sees. If that stops being true,
 * Turnstile is the upgrade, and it is Cloudflare's own so it stays on-brand.
 */

import type { Env } from './data.js';

/** Bots fill every field they find. A person never sees this one. */
const HONEYPOT = 'website';

/** A form submitted faster than this was not typed by a person. */
const MIN_SECONDS_ON_PAGE = 3;

/** Per address, per hour. Generous for a person, useless for a flood. */
const MAX_PER_HOUR = 5;
const RATE_PREFIX = 'contact-rate:';
const MESSAGE_PREFIX = 'contact:';

/** Messages are kept for a year, which is far longer than it takes to reply. */
const MESSAGE_TTL_SECONDS = 365 * 24 * 60 * 60;

export interface Submission {
  name: string;
  email: string;
  message: string;
  country: string;
  received: string;
  /** Whether the copy to the inbox went out. False means the KV copy is the only one. */
  emailed: boolean;
}

export type Outcome =
  | { ok: true; emailed: boolean }
  | { ok: false; problem: string; status: number };

const LIMITS = { name: 120, email: 200, message: 5000 };

/**
 * Deliberately loose. The only thing this address is used for is a Reply-To, so the
 * cost of rejecting a real but unusual address is higher than the cost of accepting a
 * malformed one that simply never gets replied to.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(value) && value.length <= LIMITS.email;
}

/** Strip anything that could inject a header if a value ever reaches one. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * RFC 2047 encoded word, so a name with an accent in it survives the Subject header
 * instead of arriving as mojibake.
 */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${base64(value)}?=`;
}

/**
 * A minimal RFC 5322 message. Hand-rolled rather than pulled from a package: the format
 * needed here is a handful of headers and a base64 body, and a dependency inside the
 * Worker would be more code than this, not less.
 */
function buildMime(from: string, to: string, sub: Submission): string {
  const subject = encodeHeader(`ngano contact: ${oneLine(sub.name)}`);
  const headers = [
    `From: ngano <${from}>`,
    `To: <${to}>`,
    `Reply-To: ${encodeHeader(oneLine(sub.name))} <${oneLine(sub.email)}>`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@ngano.dev>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ];
  const body = [
    `From:     ${sub.name}`,
    `Email:    ${sub.email}`,
    `Country:  ${sub.country}`,
    `Received: ${sub.received}`,
    '',
    sub.message,
    '',
    '--',
    'Sent by the contact form at https://ngano.dev/contact',
    'Reply to this email and it goes to the sender.',
  ].join('\n');
  return `${headers.join('\r\n')}\r\n\r\n${base64(body)}`;
}

async function overRateLimit(kv: KVNamespace, key: string): Promise<boolean> {
  const seen = Number((await kv.get(RATE_PREFIX + key)) ?? '0');
  return seen >= MAX_PER_HOUR;
}

async function noteSubmission(kv: KVNamespace, key: string): Promise<void> {
  const current = Number((await kv.get(RATE_PREFIX + key)) ?? '0');
  await kv.put(RATE_PREFIX + key, String(current + 1), { expirationTtl: 60 * 60 });
}

export async function submit(env: Env, req: Request, form: FormData): Promise<Outcome> {
  /*
   * The honeypot and the timing check come first and both answer as though the message
   * went through. Telling a bot exactly which check caught it is free tuning advice.
   */
  if (String(form.get(HONEYPOT) ?? '') !== '') return { ok: true, emailed: false };
  const started = Number(form.get('started') ?? '0');
  const elapsed = (Date.now() - started) / 1000;
  if (!Number.isFinite(elapsed) || elapsed < MIN_SECONDS_ON_PAGE) {
    return { ok: true, emailed: false };
  }

  const name = oneLine(String(form.get('name') ?? '')).slice(0, LIMITS.name);
  const email = oneLine(String(form.get('email') ?? '')).slice(0, LIMITS.email);
  const message = String(form.get('message') ?? '').trim().slice(0, LIMITS.message);

  if (!name) return { ok: false, problem: 'Tell me who you are.', status: 400 };
  if (!looksLikeEmail(email)) {
    return { ok: false, problem: 'That email address does not look right.', status: 400 };
  }
  if (message.length < 10) {
    return { ok: false, problem: 'The message is too short to reply to.', status: 400 };
  }

  /*
   * Storage is required only once the message is known to be worth keeping. Checking it
   * earlier would answer a typo'd address with "not configured", which tells the sender
   * nothing they can act on.
   */
  const kv = env.ADMIN;
  if (!kv) return { ok: false, problem: 'The contact form is not configured.', status: 503 };

  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (await overRateLimit(kv, ip)) {
    return { ok: false, problem: 'That is several messages in an hour. Try again later.', status: 429 };
  }

  const sub: Submission = {
    name,
    email,
    message,
    country: (req.cf?.country as string | undefined) ?? 'XX',
    received: new Date().toISOString(),
    emailed: false,
  };

  /* Stored before it is sent, so a mail failure cannot lose the message. */
  const key = `${MESSAGE_PREFIX}${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await kv.put(key, JSON.stringify(sub), { expirationTtl: MESSAGE_TTL_SECONDS });
  await noteSubmission(kv, ip);

  let emailed = false;
  if (env.CONTACT_EMAIL && env.CONTACT_TO) {
    try {
      const { EmailMessage } = await import('cloudflare:email');
      const from = env.CONTACT_FROM ?? 'contact@ngano.dev';
      const raw = buildMime(from, env.CONTACT_TO, sub);
      await env.CONTACT_EMAIL.send(new EmailMessage(from, env.CONTACT_TO, raw));
      emailed = true;
    } catch {
      /* The KV copy stands. The dashboard shows it either way. */
    }
  }

  if (emailed) {
    sub.emailed = true;
    await kv.put(key, JSON.stringify(sub), { expirationTtl: MESSAGE_TTL_SECONDS });
  }
  return { ok: true, emailed };
}

/** Recent messages, newest first. The key carries the timestamp, so the sort is free. */
export async function recentMessages(kv: KVNamespace, limit = 20): Promise<Submission[]> {
  const page = await kv.list({ prefix: MESSAGE_PREFIX, limit: 200 });
  const keys = page.keys.map((k) => k.name).sort().reverse().slice(0, limit);
  const out: Submission[] = [];
  for (const key of keys) {
    const value = await kv.get<Submission>(key, 'json');
    if (value) out.push(value);
  }
  return out;
}

export { HONEYPOT, MIN_SECONDS_ON_PAGE, looksLikeEmail, oneLine, buildMime };
