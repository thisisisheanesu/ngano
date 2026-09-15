import { describe, expect, it } from 'vitest';
import { call } from './helpers.js';
import { buildMime, looksLikeEmail, oneLine } from '../src/contact.js';
import type { Submission } from '../src/contact.js';

const sub = (over: Partial<Submission> = {}): Submission => ({
  name: 'Ada Lovelace',
  email: 'ada@analytical.engine',
  message: 'There is a dataset you have missed.',
  country: 'ZW',
  received: '2026-09-15T10:00:00.000Z',
  emailed: false,
  ...over,
});

describe('the contact form', () => {
  it('serves the form, uncached, with the honeypot and the timing token', async () => {
    const res = await call('/contact');
    expect(res.status).toBe(200);
    /* The HTML carries a timestamp, so a cached copy would break the timing check. */
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const html = await res.text();
    expect(html).toContain('name="website"');
    expect(html).toContain('name="started"');
  });

  it('rejects a message too short to reply to, and keeps what was typed', async () => {
    const form = new URLSearchParams({
      name: 'Ada', email: 'ada@example.com', message: 'hi', website: '',
      started: String(Date.now() - 10_000),
    });
    const res = await call('/contact', {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('too short');
    expect(html).toContain('ada@example.com');
  });

  it('rejects an address that cannot be replied to', async () => {
    const form = new URLSearchParams({
      name: 'Ada', email: 'not-an-address', message: 'A long enough message here.',
      website: '', started: String(Date.now() - 10_000),
    });
    const res = await call('/contact', {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('does not look right');
  });

  it('accepts an unusual but real address rather than guessing', () => {
    expect(looksLikeEmail('ada+ngano@sub.domain.co.zw')).toBe(true);
    expect(looksLikeEmail("o'brien@example.ie")).toBe(true);
    expect(looksLikeEmail('no-at-sign.example.com')).toBe(false);
    expect(looksLikeEmail('two@@example.com')).toBe(false);
  });

  it('never lets a value break out of a header', () => {
    expect(oneLine('Ada\r\nBcc: victim@example.com')).toBe('Ada Bcc: victim@example.com');
    const mime = buildMime('contact@ngano.dev', 'me@example.com', sub({ name: 'Ada\r\nBcc: x@y.z' }));
    const headerBlock = mime.split('\r\n\r\n')[0] as string;
    expect(headerBlock.split('\r\n').filter((l) => l.toLowerCase().startsWith('bcc:'))).toHaveLength(0);
  });

  it('builds a message that replies to the sender, not to ngano', () => {
    const mime = buildMime('contact@ngano.dev', 'me@example.com', sub());
    expect(mime).toContain('From: ngano <contact@ngano.dev>');
    expect(mime).toContain('To: <me@example.com>');
    expect(mime).toContain('Reply-To: Ada Lovelace <ada@analytical.engine>');
    expect(mime).toContain('Content-Transfer-Encoding: base64');
    const body = mime.split('\r\n\r\n')[1] as string;
    expect(atob(body)).toContain('There is a dataset you have missed.');
  });

  it('encodes a non-ASCII name instead of mangling it', () => {
    const mime = buildMime('contact@ngano.dev', 'me@example.com', sub({ name: 'Côte Ivoire' }));
    expect(mime).toMatch(/Subject: .*=\?UTF-8\?B\?/);
  });
});
