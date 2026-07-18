import type { DB } from '../data/db';
import { auditLog } from '../data/schema';

export interface AuditEvent {
  masterFn: string;
  companyFn?: string | null;
  actorUserId?: number | null;
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
  const [row] = await db.insert(auditLog).values({
    masterFn: event.masterFn,
    companyFn: event.companyFn ?? null,
    actorUserId: event.actorUserId ?? null,
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
