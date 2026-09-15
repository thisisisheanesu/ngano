import { describe, expect, it } from 'vitest';
import { checkPassword, derive, makeUser, passwordProblem, readCookie, setCookie, clearCookie } from '../src/admin/auth';

describe('admin credentials', () => {
  /*
   * One full-strength round trip, because that is the thing that must actually work.
   * The rest use `derive` at a low iteration count: they are checking shape and salting,
   * and 600k iterations per assertion costs more CPU than the test isolate will give.
   */
  it('round-trips a password through the stored hash at full strength', async () => {
    const user = await makeUser('ishe', 'a-long-enough-password');
    expect(user.iterations).toBeGreaterThanOrEqual(600_000);
    expect(await checkPassword(user, 'a-long-enough-password')).toBe(true);
    expect(await checkPassword(user, 'a-long-enough-passworD')).toBe(false);
  });

  it('never stores the password itself', async () => {
    const salt = new Uint8Array(16).fill(3);
    const hash = await derive('correct horse battery staple', salt, 1000);
    expect(hash).not.toContain('correct');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('salts each password separately, so two identical passwords hash differently', async () => {
    const a = new Uint8Array(16).fill(1);
    const b = new Uint8Array(16).fill(2);
    expect(await derive('the same password here', a, 1000)).not.toBe(
      await derive('the same password here', b, 1000),
    );
  });

  it('chains rounds, so more iterations is a different hash and not the same one', async () => {
    const salt = new Uint8Array(16).fill(9);
    /* 200k runs as two chained rounds; it must not equal one round of 100k. */
    expect(await derive('a-long-enough-password', salt, 200_000)).not.toBe(
      await derive('a-long-enough-password', salt, 100_000),
    );
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
