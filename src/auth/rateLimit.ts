import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { DB } from '../data/db';
import { authRateLimit } from '../data/schema';

export interface LoginRateLimitPolicy {
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
}

export const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimitPolicy = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
};

export function loginIdentifierHash(email: string, ip: string): string {
  return createHash('sha256')
    .update(`${email.trim().toLowerCase()}\0${ip}`)
    .digest('hex');
}

export async function checkLoginRateLimit(
  db: DB,
  identifierHash: string,
  now = new Date(),
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const [row] = await db.select({ blockedUntil: authRateLimit.blockedUntil })
    .from(authRateLimit)
    .where(eq(authRateLimit.identifierHash, identifierHash))
    .limit(1);
  if (!row?.blockedUntil || row.blockedUntil <= now) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((row.blockedUntil.getTime() - now.getTime()) / 1000)),
  };
}

export async function recordLoginFailure(
  db: DB,
  identifierHash: string,
  policy = DEFAULT_LOGIN_RATE_LIMIT,
  now = new Date(),
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  const cutoff = new Date(now.getTime() - policy.windowMs);
  const blockedUntil = new Date(now.getTime() + policy.blockMs);
  const [row] = await db.insert(authRateLimit).values({
    identifierHash,
    attempts: 1,
    windowStartedAt: now,
    blockedUntil: policy.maxAttempts <= 1 ? blockedUntil : null,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: authRateLimit.identifierHash,
    set: {
      attempts: sql`case
        when ${authRateLimit.windowStartedAt} < ${cutoff} then 1
        else ${authRateLimit.attempts} + 1
      end`,
      windowStartedAt: sql`case
        when ${authRateLimit.windowStartedAt} < ${cutoff} then ${now}
        else ${authRateLimit.windowStartedAt}
      end`,
      blockedUntil: sql`case
        when ${authRateLimit.blockedUntil} > ${now} then ${authRateLimit.blockedUntil}
        when (case when ${authRateLimit.windowStartedAt} < ${cutoff}
          then 1 else ${authRateLimit.attempts} + 1 end) >= ${policy.maxAttempts}
          then ${blockedUntil}
        else null
      end`,
      updatedAt: now,
    },
  }).returning({
    attempts: authRateLimit.attempts,
    blockedUntil: authRateLimit.blockedUntil,
  });
  const blocked = Boolean(row.blockedUntil && row.blockedUntil > now);
  return {
    blocked,
    retryAfterSeconds: blocked
      ? Math.max(1, Math.ceil((row.blockedUntil!.getTime() - now.getTime()) / 1000))
      : 0,
  };
}

export async function clearLoginFailures(db: DB, identifierHash: string): Promise<void> {
  await db.delete(authRateLimit).where(eq(authRateLimit.identifierHash, identifierHash));
}

export async function cleanupLoginRateLimits(
  db: DB,
  olderThan: Date,
): Promise<number> {
  const rows = await db.delete(authRateLimit).where(
    sql`${authRateLimit.updatedAt} < ${olderThan}
      and (${authRateLimit.blockedUntil} is null or ${authRateLimit.blockedUntil} < ${olderThan})`,
  ).returning({ identifierHash: authRateLimit.identifierHash });
  return rows.length;
}
