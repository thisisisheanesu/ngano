/**
 * Credentials and sessions for the admin dashboard.
 *
 * Everything lives in KV so the password can be changed at runtime. A password baked
 * into a Worker secret would mean a redeploy to rotate it, which in practice means it
 * never gets rotated.
 *
 * The password is stored as a PBKDF2-HMAC-SHA256 hash with a per-password random salt.
 * PBKDF2 is the strongest of the three password KDFs WebCrypto exposes in Workers, and
 * the iteration count follows the OWASP guidance for SHA-256. The plaintext is never
 * written anywhere, including logs.
 */

/**
 * OWASP's floor for PBKDF2-HMAC-SHA256. Stored per record so it can be raised later.
 *
 * Workers refuses a single `deriveBits` above 100,000 iterations, so the work is done
 * as chained rounds of that size, each round's output seeding the next. The total work
 * an attacker has to repeat is the same; only the number of calls changes.
 */
const ITERATIONS = 600_000;
const MAX_ITERATIONS_PER_CALL = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

const USER_KEY = 'admin:user';
const SESSION_PREFIX = 'session:';
const ATTEMPT_PREFIX = 'attempts:';

/** Sessions last a working day, then the password is needed again. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

/** Lockout after this many failures from one address inside the window. */
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_SECONDS = 15 * 60;

export interface AdminUser {
  username: string;
  salt: string;
  hash: string;
  iterations: number;
  /** ISO timestamp of the last password change, shown on the dashboard. */
  updated: string;
}

export interface Session {
  username: string;
  /** Per-session token, required on every state-changing form. */
  csrf: string;
  created: string;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toHex(buf.buffer);
}

/** Derive the stored hash for a password and salt, in rounds Workers will accept. */
export async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  let material: Uint8Array = new TextEncoder().encode(password);
  let remaining = iterations;
  let last: ArrayBuffer | null = null;
  while (remaining > 0) {
    const round = Math.min(MAX_ITERATIONS_PER_CALL, remaining);
    const key = await crypto.subtle.importKey('raw', material as BufferSource, 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: round },
      key,
      KEY_BITS,
    );
    material = new Uint8Array(bits);
    last = bits;
    remaining -= round;
  }
  if (!last) throw new Error('derive called with zero iterations');
  return toHex(last);
}

/**
 * Compare two hex strings without leaking where they differ through timing. The lengths
 * are fixed by the KDF, so a length mismatch means a malformed record, not a guess.
 */
function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeUser(username: string, password: string): Promise<AdminUser> {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return {
    username,
    salt: toHex(salt.buffer),
    hash: await derive(password, salt, ITERATIONS),
    iterations: ITERATIONS,
    updated: new Date().toISOString(),
  };
}

export async function readUser(kv: KVNamespace): Promise<AdminUser | null> {
  return await kv.get<AdminUser>(USER_KEY, 'json');
}

export async function writeUser(kv: KVNamespace, user: AdminUser): Promise<void> {
  await kv.put(USER_KEY, JSON.stringify(user));
}

export async function checkPassword(user: AdminUser, password: string): Promise<boolean> {
  const hash = await derive(password, fromHex(user.salt), user.iterations);
  return equalHex(hash, user.hash);
}

/* ------------------------------------------------------------------ sessions */

export async function createSession(kv: KVNamespace, username: string): Promise<string> {
  const id = randomHex(32);
  const session: Session = { username, csrf: randomHex(16), created: new Date().toISOString() };
  await kv.put(SESSION_PREFIX + id, JSON.stringify(session), { expirationTtl: SESSION_TTL_SECONDS });
  return id;
}

export async function readSession(kv: KVNamespace, id: string | null): Promise<Session | null> {
  if (!id || !/^[0-9a-f]{64}$/.test(id)) return null;
  return await kv.get<Session>(SESSION_PREFIX + id, 'json');
}

export async function dropSession(kv: KVNamespace, id: string | null): Promise<void> {
  if (!id || !/^[0-9a-f]{64}$/.test(id)) return;
  await kv.delete(SESSION_PREFIX + id);
}

/**
 * Drop every session. Used when the password changes: a rotation that leaves the old
 * sessions logged in has not really rotated anything.
 */
export async function dropAllSessions(kv: KVNamespace): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: SESSION_PREFIX, cursor });
    await Promise.all(page.keys.map((k) => kv.delete(k.name)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

/* ------------------------------------------------------------------ throttling */

/**
 * Count failures per address. Not a substitute for a strong password, but it turns an
 * online guessing attack into something that takes far longer than it is worth.
 */
export async function tooManyAttempts(kv: KVNamespace, ip: string): Promise<boolean> {
  const n = await kv.get(ATTEMPT_PREFIX + ip);
  return n !== null && Number(n) >= MAX_ATTEMPTS;
}

export async function noteFailure(kv: KVNamespace, ip: string): Promise<void> {
  const key = ATTEMPT_PREFIX + ip;
  const current = Number((await kv.get(key)) ?? '0');
  await kv.put(key, String(current + 1), { expirationTtl: ATTEMPT_WINDOW_SECONDS });
}

export async function clearFailures(kv: KVNamespace, ip: string): Promise<void> {
  await kv.delete(ATTEMPT_PREFIX + ip);
}

/* ------------------------------------------------------------------ cookies */

export const COOKIE = 'ngano_admin';

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

export function setCookie(id: string): string {
  return `${COOKIE}=${id}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearCookie(): string {
  return `${COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

/** Password rules. Deliberately short: length is what matters, not character classes. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return 'Use at least 12 characters.';
  if (password.length > 200) return 'That is longer than 200 characters.';
  return null;
}
