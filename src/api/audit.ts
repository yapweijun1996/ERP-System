import type { DB } from '../data/db';
import { and, desc, eq } from 'drizzle-orm';
import { appUser, auditLog } from '../data/schema';
import { currentAuditAttribution } from './auditContext';

export interface AuditEvent {
  masterFn: string;
  companyFn?: string | null;
  actorUserId?: number | null;
  platformPrincipalId?: number | null;
  requestId: string;
  entity: string;
  entityId?: string | number | null;
  action: string;
  before?: unknown;
  after?: unknown;
  occurredAt?: Date;
}

/** Append-only by contract: this module intentionally exports no update/delete API. */
export async function appendAudit(db: DB, event: AuditEvent): Promise<number> {
  const attribution = currentAuditAttribution();
  const [row] = await db.insert(auditLog).values({
    masterFn: event.masterFn,
    companyFn: event.companyFn ?? null,
    actorUserId: event.actorUserId ?? null,
    platformPrincipalId: event.platformPrincipalId ?? attribution?.platformPrincipalId ?? null,
    requestId: event.requestId,
    entity: event.entity,
    entityId: event.entityId == null ? null : String(event.entityId),
    action: event.action,
    before: event.before,
    after: event.after,
    occurredAt: event.occurredAt,
  }).returning({ id: auditLog.id });
  return row.id;
}

export async function listEntityAudit(
  db: DB,
  scope: { masterFn: string; companyFn: string },
  entity: string,
  entityId: string | number,
  limit = 50,
) {
  const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  return db.select({
    id: auditLog.id,
    action: auditLog.action,
    occurredAt: auditLog.occurredAt,
    actorUserId: auditLog.actorUserId,
    actorName: appUser.fullName,
    actorEmail: appUser.email,
    before: auditLog.before,
    after: auditLog.after,
  }).from(auditLog)
    .leftJoin(appUser, eq(appUser.userId, auditLog.actorUserId))
    .where(and(
      eq(auditLog.masterFn, scope.masterFn),
      eq(auditLog.companyFn, scope.companyFn),
      eq(auditLog.entity, entity),
      eq(auditLog.entityId, String(entityId)),
    ))
    .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
    .limit(boundedLimit);
}
