import { createHash } from 'node:crypto';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { productCase, productCaseEvent } from '../../data/schema';
import { appendAudit } from '../../api/audit';
import type { AuthenticatedAgentIdentity } from '../../auth/agentAuthentication';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import type { SessionData } from '../../auth/session';
import { resolveAgentGrantWithin } from '../agent/agentIdentity';

type CaseStatus = typeof productCase.$inferSelect.status;

export class ProductCaseError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProductCaseError';
  }
}

function reject(status: number, code: string, message: string): never {
  throw new ProductCaseError(status, code, message);
}

function boundedText(value: unknown, field: string, max: number, required: boolean): string | null {
  if (value == null && !required) return null;
  if (typeof value !== 'string') reject(400, 'product_case_input_invalid', `${field} must be text.`);
  const normalized = value.trim();
  if ((!normalized && required) || normalized.length > max) {
    reject(400, 'product_case_input_invalid', `${field} is outside its allowed length.`);
  }
  if (/\b(?:Bearer\s+[A-Za-z0-9._~-]{16,}|sk-[A-Za-z0-9_-]{16,}|(?:password|api[_-]?key|access[_-]?token)\s*[:=]\s*\S{8,})/i.test(normalized)) {
    reject(400, 'product_case_sensitive_input', `${field} appears to contain a credential.`);
  }
  return normalized || null;
}

function positiveId(value: unknown): number {
  const id = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    reject(400, 'product_case_id_invalid', 'Case ID must be a positive integer.');
  }
  return id;
}

export interface ProductCaseSubmission {
  caseType: 'feedback' | 'ticket';
  title: string;
  description: string;
  routeKey: string | null;
  referenceId: string | null;
}

export function parseProductCaseSubmission(value: unknown): ProductCaseSubmission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(400, 'product_case_input_invalid', 'A case object is required.');
  }
  const source = value as Record<string, unknown>;
  const allowed = new Set(['caseType', 'title', 'description', 'routeKey', 'referenceId']);
  if (Object.keys(source).some((key) => !allowed.has(key))) {
    reject(400, 'product_case_input_invalid', 'The case contains an unsupported field.');
  }
  if (source.caseType !== 'feedback' && source.caseType !== 'ticket') {
    reject(400, 'product_case_input_invalid', 'caseType must be feedback or ticket.');
  }
  return {
    caseType: source.caseType,
    title: boundedText(source.title, 'title', 160, true)!,
    description: boundedText(source.description, 'description', 4000, true)!,
    routeKey: boundedText(source.routeKey, 'routeKey', 120, false),
    referenceId: boundedText(source.referenceId, 'referenceId', 128, false),
  };
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function caseProjection(row: typeof productCase.$inferSelect) {
  return {
    id: row.id,
    caseType: row.caseType,
    title: row.title,
    description: row.description,
    routeKey: row.routeKey,
    referenceId: row.referenceId,
    status: row.status,
    resolution: row.resolution,
    version: row.version,
    submittedByAgentId: row.submittedByAgentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function scopeFromAgent(identity: AuthenticatedAgentIdentity): Scope {
  return { masterFn: identity.masterFn, companyFn: identity.companyFn };
}

export async function submitAgentProductCase(
  db: DB,
  identity: AuthenticatedAgentIdentity,
  input: unknown,
  idempotencyKey: unknown,
  requestId: string,
) {
  const normalized = parseProductCaseSubmission(input);
  if (typeof idempotencyKey !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
    reject(400, 'product_case_idempotency_key_invalid', 'A valid Idempotency-Key is required.');
  }
  const scope = scopeFromAgent(identity);
  const keyHash = digest(idempotencyKey);
  const payloadDigest = digest(JSON.stringify(normalized));
  return withTenantTransaction(db, scope, async (tx) => {
    const grant = await resolveAgentGrantWithin(tx, scope, {
      agentPrincipalId: identity.agentPrincipalId,
      actionName: 'product_case.submit',
      permissionKey: PERMISSIONS.productCasesSubmit,
      requestedScope: { scope: 'company', targetType: 'none' },
      requestedFields: ['id', 'caseType', 'title', 'description', 'routeKey', 'referenceId', 'status', 'version', 'createdAt'],
    });
    const [created] = await tx.insert(productCase).values({
      ...scope,
      ...normalized,
      submittedByAgentId: identity.agentPrincipalId,
      accountableOwnerUserId: grant.ownerUserId,
      idempotencyHash: keyHash,
      payloadDigest,
    }).onConflictDoNothing().returning();
    if (!created) {
      const [existing] = await tx.select().from(productCase).where(and(
        eq(productCase.masterFn, scope.masterFn),
        eq(productCase.companyFn, scope.companyFn),
        eq(productCase.submittedByAgentId, identity.agentPrincipalId),
        eq(productCase.idempotencyHash, keyHash),
      )).limit(1);
      if (!existing) reject(409, 'product_case_conflict', 'The submission could not be reconciled.');
      if (existing.payloadDigest !== payloadDigest) {
        reject(409, 'product_case_idempotency_conflict', 'This key was used for a different case.');
      }
      return { data: caseProjection(existing), replayed: true };
    }
    await tx.insert(productCaseEvent).values({
      ...scope,
      caseId: created.id,
      eventType: 'submitted',
      toStatus: 'submitted',
      actorUserId: grant.actorUserId,
      agentPrincipalId: identity.agentPrincipalId,
    });
    await appendAudit(tx, {
      ...scope,
      actorUserId: grant.actorUserId,
      agentPrincipalId: identity.agentPrincipalId,
      delegatorUserId: grant.ownerUserId,
      requestId,
      entity: 'product_case',
      entityId: created.id,
      action: 'submit',
      after: { caseType: created.caseType, status: created.status, payloadDigest },
    });
    return { data: caseProjection(created), replayed: false };
  });
}

export async function readAgentProductCase(
  db: DB,
  identity: AuthenticatedAgentIdentity,
  id: unknown,
) {
  const caseId = positiveId(id);
  const scope = scopeFromAgent(identity);
  return withTenantTransaction(db, scope, async (tx) => {
    await resolveAgentGrantWithin(tx, scope, {
      agentPrincipalId: identity.agentPrincipalId,
      actionName: 'product_case.read_own',
      permissionKey: PERMISSIONS.productCasesReadOwn,
      requestedFields: ['id', 'caseType', 'title', 'description', 'routeKey', 'referenceId', 'status', 'resolution', 'version', 'createdAt', 'updatedAt', 'events'],
    });
    const [row] = await tx.select().from(productCase).where(and(
      eq(productCase.id, caseId),
      eq(productCase.masterFn, scope.masterFn),
      eq(productCase.companyFn, scope.companyFn),
      eq(productCase.submittedByAgentId, identity.agentPrincipalId),
    )).limit(1);
    if (!row) reject(404, 'product_case_not_found', 'Case not found.');
    const events = await tx.select({
      id: productCaseEvent.id,
      toStatus: productCaseEvent.toStatus,
      occurredAt: productCaseEvent.occurredAt,
    }).from(productCaseEvent).where(and(
      eq(productCaseEvent.masterFn, scope.masterFn),
      eq(productCaseEvent.companyFn, scope.companyFn),
      eq(productCaseEvent.caseId, caseId),
    )).orderBy(productCaseEvent.id).limit(100);
    return { ...caseProjection(row), events };
  });
}

function humanScope(session: SessionData): Scope {
  return { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
}

async function requireHumanPermission(tx: DB, session: SessionData, permission: string): Promise<void> {
  if (!await hasPermission(tx, session, permission)) {
    reject(403, 'permission_denied', 'Product case permission is required.');
  }
}

export async function listProductCases(
  db: DB,
  session: SessionData,
  filters: { caseType?: string; status?: string; afterId?: number; limit?: number } = {},
) {
  const scope = humanScope(session);
  if (filters.caseType && !['feedback', 'ticket'].includes(filters.caseType)) {
    reject(400, 'product_case_query_invalid', 'Unsupported case type.');
  }
  if (filters.status && !['submitted', 'triaged', 'in_progress', 'resolved', 'closed'].includes(filters.status)) {
    reject(400, 'product_case_query_invalid', 'Unsupported status.');
  }
  if (filters.afterId != null) positiveId(filters.afterId);
  const limit = filters.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    reject(400, 'product_case_query_invalid', 'Limit must be between 1 and 100.');
  }
  return withTenantTransaction(db, scope, async (tx) => {
    await requireHumanPermission(tx, session, PERMISSIONS.productCasesRead);
    const rows = await tx.select().from(productCase).where(and(
      eq(productCase.masterFn, scope.masterFn),
      eq(productCase.companyFn, scope.companyFn),
      filters.caseType ? eq(productCase.caseType, filters.caseType) : undefined,
      filters.status ? eq(productCase.status, filters.status) : undefined,
      filters.afterId ? lt(productCase.id, filters.afterId) : undefined,
    )).orderBy(desc(productCase.id)).limit(limit + 1);
    return {
      data: rows.slice(0, limit).map(caseProjection),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
      canManage: await hasPermission(tx, session, PERMISSIONS.productCasesManage),
    };
  });
}

export async function readProductCase(db: DB, session: SessionData, id: unknown) {
  const caseId = positiveId(id);
  const scope = humanScope(session);
  return withTenantTransaction(db, scope, async (tx) => {
    await requireHumanPermission(tx, session, PERMISSIONS.productCasesRead);
    const [row] = await tx.select().from(productCase).where(and(
      eq(productCase.id, caseId),
      eq(productCase.masterFn, scope.masterFn),
      eq(productCase.companyFn, scope.companyFn),
    )).limit(1);
    if (!row) reject(404, 'product_case_not_found', 'Case not found.');
    const events = await tx.select().from(productCaseEvent).where(and(
      eq(productCaseEvent.masterFn, scope.masterFn),
      eq(productCaseEvent.companyFn, scope.companyFn),
      eq(productCaseEvent.caseId, caseId),
    )).orderBy(productCaseEvent.id).limit(100);
    return { ...caseProjection(row), events };
  });
}

const TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  submitted: ['triaged', 'closed'],
  triaged: ['in_progress', 'closed'],
  in_progress: ['resolved', 'triaged'],
  resolved: ['closed', 'in_progress'],
  closed: ['triaged'],
};

export async function transitionProductCase(
  db: DB,
  session: SessionData,
  id: unknown,
  input: unknown,
  requestId: string,
) {
  const caseId = positiveId(id);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    reject(400, 'product_case_input_invalid', 'A transition object is required.');
  }
  const source = input as Record<string, unknown>;
  if (Object.keys(source).some((key) => !['status', 'expectedVersion', 'resolution'].includes(key))) {
    reject(400, 'product_case_input_invalid', 'The transition contains an unsupported field.');
  }
  const status = source.status;
  const expectedVersion = source.expectedVersion;
  const resolution = boundedText(source.resolution, 'resolution', 1000, false);
  if (typeof status !== 'string' || !Number.isSafeInteger(expectedVersion) || Number(expectedVersion) < 1) {
    reject(400, 'product_case_input_invalid', 'status and expectedVersion are required.');
  }
  const scope = humanScope(session);
  return withTenantTransaction(db, scope, async (tx) => {
    await requireHumanPermission(tx, session, PERMISSIONS.productCasesManage);
    const [row] = await tx.select().from(productCase).where(and(
      eq(productCase.id, caseId),
      eq(productCase.masterFn, scope.masterFn),
      eq(productCase.companyFn, scope.companyFn),
    )).for('update');
    if (!row) reject(404, 'product_case_not_found', 'Case not found.');
    if (row.version !== expectedVersion) reject(409, 'product_case_version_stale', 'Reload the current case.');
    if (!TRANSITIONS[row.status]?.includes(status)) {
      reject(409, 'product_case_transition_invalid', 'This status transition is not allowed.');
    }
    if ((status === 'resolved' || status === 'closed') && !resolution) {
      reject(400, 'product_case_resolution_required', 'A resolution is required.');
    }
    const [updated] = await tx.update(productCase).set({
      status: status as CaseStatus,
      resolution: resolution ?? (status === 'triaged' ? null : row.resolution),
      version: row.version + 1,
      updatedAt: sql`now()`,
    }).where(and(
      eq(productCase.id, caseId),
      eq(productCase.masterFn, scope.masterFn),
      eq(productCase.companyFn, scope.companyFn),
      eq(productCase.version, row.version),
    )).returning();
    if (!updated) reject(409, 'product_case_version_stale', 'Reload the current case.');
    await tx.insert(productCaseEvent).values({
      ...scope,
      caseId,
      eventType: 'transitioned',
      fromStatus: row.status,
      toStatus: status,
      actorUserId: session.userId,
      note: resolution,
    });
    await appendAudit(tx, {
      ...scope,
      actorUserId: session.userId,
      requestId,
      entity: 'product_case',
      entityId: caseId,
      action: 'transition',
      before: { status: row.status, version: row.version },
      after: { status, version: updated.version },
    });
    return caseProjection(updated);
  });
}
