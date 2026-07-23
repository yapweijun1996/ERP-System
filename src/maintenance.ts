import {
  and,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
} from 'drizzle-orm';
import type { DB } from './data/db';
import {
  apiIdempotency,
  outboxEvent,
  passwordResetToken,
  reportArtifact,
  reportJob,
  userInvitation,
} from './data/schema';
import { withReportingWorkerTransaction } from './data/tenantTransaction';
import { cleanupLoginRateLimits } from './auth/rateLimit';
import { cleanupExpiredSessions } from './auth/session';

export interface CleanupResult {
  sessions: number;
  rateLimits: number;
  idempotency: number;
  invitations: number;
  passwordResets: number;
  outbox: number;
  reportArtifacts: number;
  reportJobs: number;
}

export async function runMaintenance(db: DB, now = new Date()): Promise<CleanupResult> {
  const oldRateLimit = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oldConsumedToken = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oldDeliveredOutbox = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sessions = await cleanupExpiredSessions(db, now);
  const rateLimits = await cleanupLoginRateLimits(db, oldRateLimit);
  const idempotencyRows = await db.delete(apiIdempotency)
    .where(lt(apiIdempotency.expiresAt, now))
    .returning({ id: apiIdempotency.id });
  const invitations = await db.delete(userInvitation).where(or(
    lt(userInvitation.expiresAt, oldConsumedToken),
    and(isNotNull(userInvitation.acceptedAt), lt(userInvitation.acceptedAt, oldConsumedToken)),
  )).returning({ id: userInvitation.id });
  const passwordResets = await db.delete(passwordResetToken).where(or(
    lt(passwordResetToken.expiresAt, oldConsumedToken),
    and(isNotNull(passwordResetToken.usedAt), lt(passwordResetToken.usedAt, oldConsumedToken)),
  )).returning({ id: passwordResetToken.id });
  const outbox = await db.delete(outboxEvent).where(and(
    isNotNull(outboxEvent.deliveredAt),
    lt(outboxEvent.deliveredAt, oldDeliveredOutbox),
    isNull(outboxEvent.lockedAt),
  )).returning({ id: outboxEvent.id });
  const reportCleanup = await withReportingWorkerTransaction(db, async (tx) => {
    const artifacts = await tx.delete(reportArtifact)
      .where(lt(reportArtifact.expiresAt, now))
      .returning({ id: reportArtifact.id });
    await tx.update(reportJob).set({
      status: 'expired',
      updatedAt: now,
    }).where(and(
      lt(reportJob.expiresAt, now),
      inArray(reportJob.status, ['queued', 'running', 'succeeded']),
    ));
    const jobs = await tx.delete(reportJob).where(and(
      lt(reportJob.expiresAt, oldConsumedToken),
      inArray(reportJob.status, ['failed', 'expired']),
    )).returning({ id: reportJob.id });
    return { artifacts, jobs };
  });
  return {
    sessions,
    rateLimits,
    idempotency: idempotencyRows.length,
    invitations: invitations.length,
    passwordResets: passwordResets.length,
    outbox: outbox.length,
    reportArtifacts: reportCleanup.artifacts.length,
    reportJobs: reportCleanup.jobs.length,
  };
}
