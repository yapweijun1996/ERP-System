// Durable database-backed sessions. Only hashes of the bearer session and CSRF
// tokens are stored, so a database read does not reveal reusable credentials.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import type { DB } from '../data/db';
import { appSession, appUser, company, userCompany } from '../data/schema';

export const SESSION_COOKIE = 'erp_session';
export const CSRF_COOKIE = 'erp_csrf';
export const DEFAULT_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;
export const DEFAULT_IDLE_TTL_MS = 30 * 60 * 1000;

export interface SessionData {
  userId: number;
  masterFn: string;
  activeCompanyFn: string;
  username: string;
  email: string | null;
  fullName: string | null;
}

export interface NewSessionData extends SessionData {
  userAgent?: string;
  absoluteTtlMs?: number;
  idleTtlMs?: number;
}

export interface CreatedSession {
  sessionId: string;
  csrfToken: string;
  expiresAt: Date;
}

function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function secretsMatch(expectedHash: string, rawValue: string): boolean {
  const actual = Buffer.from(hashSecret(rawValue), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(db: DB, data: NewSessionData): Promise<CreatedSession> {
  const now = new Date();
  const absoluteTtlMs = data.absoluteTtlMs ?? DEFAULT_ABSOLUTE_TTL_MS;
  const idleTtlMs = Math.min(data.idleTtlMs ?? DEFAULT_IDLE_TTL_MS, absoluteTtlMs);
  const expiresAt = new Date(now.getTime() + absoluteTtlMs);
  const sessionId = newToken();
  const csrfToken = newToken();

  const [assignment] = await db.select({ companyFn: userCompany.companyFn })
    .from(userCompany)
    .innerJoin(appUser, eq(appUser.userId, userCompany.userId))
    .innerJoin(company, eq(company.companyFn, userCompany.companyFn))
    .where(and(
      eq(userCompany.userId, data.userId),
      eq(userCompany.companyFn, data.activeCompanyFn),
      eq(appUser.masterFn, data.masterFn),
      eq(company.masterFn, data.masterFn),
    ))
    .limit(1);
  if (!assignment) {
    throw new Error('Cannot create a session outside the user company assignment');
  }

  await db.insert(appSession).values({
    tokenHash: hashSecret(sessionId),
    csrfHash: hashSecret(csrfToken),
    userId: data.userId,
    masterFn: data.masterFn,
    activeCompanyFn: data.activeCompanyFn,
    expiresAt,
    idleExpiresAt: new Date(now.getTime() + idleTtlMs),
    lastSeenAt: now,
    userAgentHash: data.userAgent ? hashSecret(data.userAgent) : null,
  });

  return { sessionId, csrfToken, expiresAt };
}

export async function getSession(
  db: DB,
  sessionId: string | undefined,
  options: { touch?: boolean; idleTtlMs?: number; now?: Date } = {},
): Promise<SessionData | null> {
  if (!sessionId) return null;
  const now = options.now ?? new Date();
  const tokenHash = hashSecret(sessionId);
  const [row] = await db
    .select({
      userId: appSession.userId,
      masterFn: appSession.masterFn,
      activeCompanyFn: appSession.activeCompanyFn,
      username: appUser.username,
      email: appUser.email,
      fullName: appUser.fullName,
      expiresAt: appSession.expiresAt,
    })
    .from(appSession)
    .innerJoin(appUser, eq(appUser.userId, appSession.userId))
    .innerJoin(company, eq(company.companyFn, appSession.activeCompanyFn))
    .where(and(
      eq(appSession.tokenHash, tokenHash),
      isNull(appSession.revokedAt),
      eq(appUser.isActive, true),
      eq(appUser.masterFn, appSession.masterFn),
      eq(company.masterFn, appSession.masterFn),
      gt(appSession.expiresAt, now),
      gt(appSession.idleExpiresAt, now),
    ))
    .limit(1);
  if (!row) return null;

  if (options.touch !== false) {
    const idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    const idleExpiresAt = new Date(Math.min(
      row.expiresAt.getTime(),
      now.getTime() + idleTtlMs,
    ));
    await db.update(appSession).set({
      lastSeenAt: now,
      idleExpiresAt,
      updatedAt: now,
    }).where(eq(appSession.tokenHash, tokenHash));
  }

  return {
    userId: row.userId,
    masterFn: row.masterFn,
    activeCompanyFn: row.activeCompanyFn,
    username: row.username,
    email: row.email,
    fullName: row.fullName,
  };
}

export async function verifyCsrfToken(
  db: DB,
  sessionId: string | undefined,
  csrfToken: string | undefined,
  now = new Date(),
): Promise<boolean> {
  if (!sessionId || !csrfToken) return false;
  const [row] = await db.select({
    csrfHash: appSession.csrfHash,
  }).from(appSession).where(and(
    eq(appSession.tokenHash, hashSecret(sessionId)),
    isNull(appSession.revokedAt),
    gt(appSession.expiresAt, now),
    gt(appSession.idleExpiresAt, now),
  )).limit(1);
  return Boolean(row && secretsMatch(row.csrfHash, csrfToken));
}

export async function destroySession(db: DB, sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  const now = new Date();
  await db.update(appSession).set({ revokedAt: now, updatedAt: now })
    .where(and(eq(appSession.tokenHash, hashSecret(sessionId)), isNull(appSession.revokedAt)));
}

export async function switchSessionCompany(
  db: DB,
  sessionId: string,
  companyFn: string,
): Promise<SessionData | null> {
  const session = await getSession(db, sessionId, { touch: false });
  if (!session) return null;
  const [assignment] = await db.select({ companyFn: userCompany.companyFn })
    .from(userCompany)
    .innerJoin(company, eq(company.companyFn, userCompany.companyFn))
    .where(and(
      eq(userCompany.userId, session.userId),
      eq(userCompany.companyFn, companyFn),
      eq(company.masterFn, session.masterFn),
    ))
    .limit(1);
  if (!assignment) return null;
  await db.update(appSession).set({
    activeCompanyFn: companyFn,
    updatedAt: new Date(),
  }).where(eq(appSession.tokenHash, hashSecret(sessionId)));
  return { ...session, activeCompanyFn: companyFn };
}

export async function cleanupExpiredSessions(db: DB, now = new Date()): Promise<number> {
  const removed = await db.delete(appSession).where(or(
    lt(appSession.expiresAt, now),
    lt(appSession.idleExpiresAt, now),
  )).returning({ tokenHash: appSession.tokenHash });
  return removed.length;
}

/** Parse a raw `Cookie` request header without the cookie-parser dependency. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}
