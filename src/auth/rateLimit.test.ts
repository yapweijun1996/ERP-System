import { describe, expect, it } from 'vitest';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import {
  checkLoginRateLimit,
  clearLoginFailures,
  loginIdentifierHash,
  recordLoginFailure,
} from './rateLimit';

describe('database login rate limiter', () => {
  it('blocks after the configured number of failures and clears on success', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const id = loginIdentifierHash('ADMIN@ACME.CO ', '127.0.0.1');
    const policy = { maxAttempts: 2, windowMs: 60_000, blockMs: 120_000 };
    expect((await recordLoginFailure(db, id, policy)).blocked).toBe(false);
    expect((await recordLoginFailure(db, id, policy)).blocked).toBe(true);
    expect((await checkLoginRateLimit(db, id)).allowed).toBe(false);
    await clearLoginFailures(db, id);
    expect((await checkLoginRateLimit(db, id)).allowed).toBe(true);
  });

  it('normalizes email but includes the source IP in the identity', () => {
    expect(loginIdentifierHash(' A@B.COM ', '1.1.1.1'))
      .toBe(loginIdentifierHash('a@b.com', '1.1.1.1'));
    expect(loginIdentifierHash('a@b.com', '1.1.1.1'))
      .not.toBe(loginIdentifierHash('a@b.com', '2.2.2.2'));
  });
});
