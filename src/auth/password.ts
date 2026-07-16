// Password hashing (TASK-024). PBKDF2-HMAC-SHA256 via Node's built-in crypto — no
// new dependency, matches this project's zero-unnecessary-dependency ethos. This is
// a MINIMAL real-auth scaffold, not a hardened auth system: no rate limiting, no
// password-reset flow, no MFA. Good enough to stop storing plaintext; not a
// substitute for a real identity provider before this ever handles real user data.
//
// Stored format: "pbkdf2$<iterations>$<saltHex>$<hashHex>". Never store, log, or
// compare plaintext passwords.
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 100_000;
const KEY_LENGTH = 32; // bytes
const DIGEST = 'sha256';

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  if (!Number.isFinite(iterations) || iterations <= 0 || salt.length === 0 || expected.length === 0) return false;
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);
  return timingSafeEqual(actual, expected);
}
