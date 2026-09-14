import { describe, expect, it } from 'vitest';
import { checkPassword, derive, makeUser, passwordProblem, readCookie, setCookie, clearCookie } from '../src/admin/auth';

describe('admin credentials', () => {
  it('round-trips a password through the stored hash', async () => {
    const user = await makeUser('ishe', 'a-long-enough-password');
    expect(await checkPassword(user, 'a-long-enough-password')).toBe(true);
    expect(await checkPassword(user, 'a-long-enough-passworD')).toBe(false);
    expect(await checkPassword(user, '')).toBe(false);
  });

  it('never stores the password itself', async () => {
    const user = await makeUser('ishe', 'correct horse battery staple');
    const serialised = JSON.stringify(user);
    expect(serialised).not.toContain('correct horse');
    expect(user.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(user.salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('salts each password separately, so two identical passwords hash differently', async () => {
    const a = await makeUser('ishe', 'the same password here');
    const b = await makeUser('ishe', 'the same password here');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('uses an iteration count at or above the OWASP floor for PBKDF2-SHA256', async () => {
    const user = await makeUser('ishe', 'a-long-enough-password');
    expect(user.iterations).toBeGreaterThanOrEqual(600_000);
  });

  it('is deterministic for a given salt and iteration count', async () => {
    const salt = new Uint8Array(16).fill(7);
    const first = await derive('hunter2hunter2', salt, 1000);
    const second = await derive('hunter2hunter2', salt, 1000);
    expect(first).toBe(second);
  });

  it('asks for length rather than character classes', () => {
    expect(passwordProblem('short')).toMatch(/12 characters/);
    expect(passwordProblem('a'.repeat(12))).toBeNull();
    expect(passwordProblem('a'.repeat(201))).toMatch(/200/);
  });

  it('scopes the session cookie to /admin and keeps it off JavaScript', () => {
    const cookie = setCookie('a'.repeat(64));
    expect(cookie).toContain('Path=/admin');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(clearCookie()).toContain('Max-Age=0');
  });

  it('reads one cookie out of a header carrying several', () => {
    const req = new Request('https://ngano.dev/admin', {
      headers: { Cookie: 'other=1; ngano_admin=abc; third=3' },
    });
    expect(readCookie(req, 'ngano_admin')).toBe('abc');
    expect(readCookie(req, 'missing')).toBeNull();
  });
});
