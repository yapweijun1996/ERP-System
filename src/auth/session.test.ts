import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { seedDemo } from '../data/seed';
import { appSession, appUser } from '../data/schema';
import { freshDb } from '../test/helpers';
import {
  cleanupExpiredSessions,
  createSession,
  destroySession,
  getSession,
  hashSecret,
  parseCookies,
  switchSessionCompany,
  verifyCsrfToken,
} from './session';

async function fixture() {
  const db = await freshDb();
  await seedDemo(db);
  const [user] = await db.select({ userId: appUser.userId }).from(appUser)
    .where(eq(appUser.email, 'admin@acme.co'));
  return { db, userId: user.userId };
}

describe('database session store', () => {
  it('stores only token hashes and retrieves the active session', async () => {
    const { db, userId } = await fixture();
    const created = await createSession(db, {
      userId, masterFn: 'M1', activeCompanyFn: 'C-SG',
      username: 'admin', email: 'admin@acme.co', fullName: 'Admin',
    });
    const [stored] = await db.select().from(appSession);
    expect(stored.tokenHash).toBe(hashSecret(created.sessionId));
    expect(stored.tokenHash).not.toContain(created.sessionId);
    expect(stored.csrfHash).toBe(hashSecret(created.csrfToken));
    expect(await getSession(db, created.sessionId)).toEqual({
      userId, masterFn: 'M1', activeCompanyFn: 'C-SG',
      username: 'admin', email: 'admin@acme.co', fullName: 'Admin',
      accountState: 'active', passwordChangeRequired: false,
    });
  });

  it('validates CSRF without accepting a different token', async () => {
    const { db, userId } = await fixture();
    const created = await createSession(db, {
      userId, masterFn: 'M1', activeCompanyFn: 'C-SG',
      username: 'admin', email: 'admin@acme.co', fullName: 'Admin',
    });
    expect(await verifyCsrfToken(db, created.sessionId, created.csrfToken)).toBe(true);
    expect(await verifyCsrfToken(db, created.sessionId, 'wrong')).toBe(false);
  });

  it('revokes a session instead of relying on process memory', async () => {
    const { db, userId } = await fixture();
    const created = await createSession(db, {
      userId, masterFn: 'M1', activeCompanyFn: 'C-SG',
      username: 'admin', email: 'admin@acme.co', fullName: 'Admin',
    });
    await destroySession(db, created.sessionId);
    expect(await getSession(db, created.sessionId)).toBeNull();
  });

  it('switches only to a company assigned to the same user', async () => {
    const { db, userId } = await fixture();
    const created = await createSession(db, {
      userId, masterFn: 'M1', activeCompanyFn: 'C-SG',
      username: 'admin', email: 'admin@acme.co', fullName: 'Admin',
    });
    expect((await switchSessionCompany(db, created.sessionId, 'C-MY'))?.activeCompanyFn).toBe('C-MY');
    expect(await switchSessionCompany(db, created.sessionId, 'NOT-ASSIGNED')).toBeNull();
  });

  it('refuses to create a session outside the user company assignment', async () => {
    const { db, userId } = await fixture();
    await expect(createSession(db, {
      userId, masterFn: 'M1', activeCompanyFn: 'NOT-ASSIGNED',
      username: 'admin', email: 'admin@acme.co', fullName: 'Admin',
    })).rejects.toThrow('outside the user company assignment');
  });

  it('expires idle sessions and cleans them up', async () => {
    const { db, userId } = await fixture();
    const created = await createSession(db, {
      userId, masterFn: 'M1', activeCompanyFn: 'C-SG',
      username: 'admin', email: 'admin@acme.co', fullName: 'Admin', idleTtlMs: 1,
    });
    const later = new Date(Date.now() + 10);
    expect(await getSession(db, created.sessionId, { now: later })).toBeNull();
    expect(await cleanupExpiredSessions(db, later)).toBe(1);
  });

  it('returns null for an unknown or undefined session id', async () => {
    const { db } = await fixture();
    expect(await getSession(db, 'nonexistent')).toBeNull();
    expect(await getSession(db, undefined)).toBeNull();
  });
});

describe('parseCookies', () => {
  it('parses and URL-decodes a standard cookie header', () => {
    expect(parseCookies('a=1; name=hello%20world')).toEqual({ a: '1', name: 'hello world' });
  });

  it('ignores malformed segments and accepts an empty header', () => {
    expect(parseCookies('a=1; justakey; b=2')).toEqual({ a: '1', b: '2' });
    expect(parseCookies(undefined)).toEqual({});
  });
});
