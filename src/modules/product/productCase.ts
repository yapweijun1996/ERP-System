import { createHash } from 'node:crypto';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  appUser, productCase, productCaseEvidence, productCaseEvent, userCompany,
} from '../../data/schema';
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

function expectedVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    reject(400, 'product_case_input_invalid', 'expectedVersion must be a positive integer.');
  }
  return value;
}

function objectInput(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(400, 'product_case_input_invalid', `A ${label} object is required.`);
  }
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !fields.includes(key))) {
    reject(400, 'product_case_input_invalid', `The ${label} contains an unsupported field.`);
  }
  return source;
}

function caseEvidenceProjection(row: typeof productCaseEvidence.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    contentDigest: row.contentDigest,
    createdAt: row.createdAt,
  };
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
    resolutionCode: row.resolutionCode,
    category: row.category,
    assignedUserId: row.assignedUserId,
    duplicateOfCaseId: row.duplicateOfCaseId,
    taskReference: row.taskReference,
    releaseRevision: row.releaseRevision,
    releasedAt: row.releasedAt,
    verifiedAt: row.verifiedAt,
    outcomePublishedAt: row.outcomePublishedAt,
    version: row.version,
    submittedByAgentId: row.submittedByAgentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function agentCaseProjection(row: typeof productCase.$inferSelect) {
  return {
    id: row.id,
    caseType: row.caseType,
    title: row.title,
    description: row.description,
    routeKey: row.routeKey,
    referenceId: row.referenceId,
    status: row.status,
    resolution: row.status === 'closed' ? row.resolution : null,
    resolutionCode: row.status === 'closed' ? row.resolutionCode : null,
    releaseRevision: row.releaseRevision,
    verifiedAt: row.verifiedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function submissionProjection(row: typeof productCase.$inferSelect) {
  return {
    id: row.id,
    caseType: row.caseType,
    title: row.title,
    description: row.description,
    routeKey: row.routeKey,
    referenceId: row.referenceId,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
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
      return { data: submissionProjection(existing), replayed: true };
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
    return { data: submissionProjection(created), replayed: false };
  });
}

export async function appendAgentProductCaseEvidence(
  db: DB,
  identity: AuthenticatedAgentIdentity,
  id: unknown,
  input: unknown,
  idempotencyKey: unknown,
  requestId: string,
) {
  const caseId = positiveId(id);
  const source = objectInput(input, ['kind', 'summary'], 'evidence');
  if (source.kind !== 'observation' && source.kind !== 'reproduction') {
    reject(400, 'product_case_evidence_invalid', 'Unsupported evidence kind.');
  }
  const kind = source.kind === 'observation' ? 'agent_observation' : 'agent_reproduction';
  const summary = boundedText(source.summary, 'summary', 1000, true)!;
  const contentDigest = digest(JSON.stringify({ kind: source.kind, summary }));
  if (typeof idempotencyKey !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
    reject(400, 'product_case_idempotency_key_invalid', 'A valid Idempotency-Key is required.');
  }
  const scope = scopeFromAgent(identity);
  const keyHash = digest(idempotencyKey);
  return withTenantTransaction(db, scope, async (tx) => {
    const grant = await resolveAgentGrantWithin(tx, scope, {
      agentPrincipalId: identity.agentPrincipalId,
      actionName: 'product_case.append_evidence',
      permissionKey: PERMISSIONS.productCasesEvidenceAppend,
      requestedFields: ['id', 'kind', 'summary', 'createdAt'],
    });
    const [caseRow] = await tx.select().from(productCase).where(and(
      eq(productCase.id, caseId),
      eq(productCase.masterFn, scope.masterFn),
      eq(productCase.companyFn, scope.companyFn),
      eq(productCase.submittedByAgentId, identity.agentPrincipalId),
    )).for('update');
    if (!caseRow) reject(404, 'product_case_not_found', 'Case not found.');
    const [prior] = await tx.select().from(productCaseEvidence).where(and(
      eq(productCaseEvidence.masterFn, scope.masterFn),
      eq(productCaseEvidence.companyFn, scope.companyFn),
      eq(productCaseEvidence.caseId, caseId),
      eq(productCaseEvidence.agentPrincipalId, identity.agentPrincipalId),
      eq(productCaseEvidence.idempotencyHash, keyHash),
    )).limit(1);
    if (prior) {
      if (prior.contentDigest !== contentDigest) {
        reject(409, 'product_case_idempotency_conflict', 'This key was used for different evidence.');
      }
      return { data: caseEvidenceProjection(prior), replayed: true };
    }
    if (caseRow.status === 'closed') {
      reject(409, 'product_case_evidence_closed', 'Reopen or submit a new case before adding evidence.');
    }
    const [created] = await tx.insert(productCaseEvidence).values({
      ...scope,
      caseId,
      kind,
      visibility: 'reporter',
      summary,
      contentDigest,
      idempotencyHash: keyHash,
      actorUserId: grant.actorUserId,
      agentPrincipalId: identity.agentPrincipalId,
    }).onConflictDoNothing().returning();
    if (!created) {
      const [existing] = await tx.select().from(productCaseEvidence).where(and(
        eq(productCaseEvidence.masterFn, scope.masterFn),
        eq(productCaseEvidence.companyFn, scope.companyFn),
        eq(productCaseEvidence.caseId, caseId),
        eq(productCaseEvidence.agentPrincipalId, identity.agentPrincipalId),
        eq(productCaseEvidence.idempotencyHash, keyHash),
      )).limit(1);
      if (!existing) reject(409, 'product_case_evidence_conflict', 'The evidence could not be reconciled.');
      if (existing.contentDigest !== contentDigest) {
        reject(409, 'product_case_idempotency_conflict', 'This key was used for different evidence.');
      }
      return { data: caseEvidenceProjection(existing), replayed: true };
    }
    await tx.insert(productCaseEvent).values({
      ...scope,
      caseId,
      eventType: 'evidence_added',
      fromStatus: caseRow.status,
      toStatus: caseRow.status,
      actorUserId: grant.actorUserId,
      agentPrincipalId: identity.agentPrincipalId,
      evidenceId: created.id,
    });
    await appendAudit(tx, {
      ...scope,
      actorUserId: grant.actorUserId,
      agentPrincipalId: identity.agentPrincipalId,
      delegatorUserId: grant.ownerUserId,
      requestId,
      entity: 'product_case',
      entityId: caseId,
      action: 'append_evidence',
      after: { evidenceId: created.id, kind: created.kind, contentDigest },
    });
    return { data: caseEvidenceProjection(created), replayed: false };
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
    const grant = await resolveAgentGrantWithin(tx, scope, {
      agentPrincipalId: identity.agentPrincipalId,
      actionName: 'product_case.read_own',
      permissionKey: PERMISSIONS.productCasesReadOwn,
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
    )).orderBy(desc(productCaseEvent.id)).limit(100);
    const evidence = await tx.select().from(productCaseEvidence).where(and(
      eq(productCaseEvidence.masterFn, scope.masterFn),
      eq(productCaseEvidence.companyFn, scope.companyFn),
      eq(productCaseEvidence.caseId, caseId),
      eq(productCaseEvidence.agentPrincipalId, identity.agentPrincipalId),
      eq(productCaseEvidence.visibility, 'reporter'),
    )).orderBy(desc(productCaseEvidence.id)).limit(100);
    const allowed = new Set(grant.fields);
    const projection = agentCaseProjection(row);
    return Object.fromEntries(Object.entries({
      ...projection,
      events: events.reverse(),
      evidence: evidence.reverse().map(caseEvidenceProjection),
    }).filter(([field]) => allowed.has(field)));
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
  if (filters.status && !['submitted', 'triaged', 'needs_info', 'accepted', 'in_progress', 'resolved', 'released', 'verified', 'closed'].includes(filters.status)) {
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
      canRelease: await hasPermission(tx, session, PERMISSIONS.productCasesRelease),
      canVerify: await hasPermission(tx, session, PERMISSIONS.productCasesVerify),
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
    )).orderBy(desc(productCaseEvent.id)).limit(100);
    const evidence = await tx.select().from(productCaseEvidence).where(and(
      eq(productCaseEvidence.masterFn, scope.masterFn),
      eq(productCaseEvidence.companyFn, scope.companyFn),
      eq(productCaseEvidence.caseId, caseId),
    )).orderBy(desc(productCaseEvidence.id)).limit(100);
    return { ...caseProjection(row), events: events.reverse(), evidence: evidence.reverse().map(caseEvidenceProjection) };
  });
}

type CaseRow = typeof productCase.$inferSelect;

async function lockedCase(tx: DB, scope: Scope, caseId: number): Promise<CaseRow> {
  const [row] = await tx.select().from(productCase).where(and(
    eq(productCase.id, caseId),
    eq(productCase.masterFn, scope.masterFn),
    eq(productCase.companyFn, scope.companyFn),
  )).for('update');
  if (!row) reject(404, 'product_case_not_found', 'Case not found.');
  return row;
}

function assertVersion(row: CaseRow, version: number): void {
  if (row.version !== version) reject(409, 'product_case_version_stale', 'Reload the current case.');
}

async function updateLockedCase(
  tx: DB,
  scope: Scope,
  row: CaseRow,
  changes: Partial<typeof productCase.$inferInsert>,
): Promise<CaseRow> {
  const [updated] = await tx.update(productCase).set({
    ...changes,
    version: row.version + 1,
    updatedAt: sql`now()`,
  }).where(and(
    eq(productCase.id, row.id),
    eq(productCase.masterFn, scope.masterFn),
    eq(productCase.companyFn, scope.companyFn),
    eq(productCase.version, row.version),
  )).returning();
  if (!updated) reject(409, 'product_case_version_stale', 'Reload the current case.');
  return updated;
}

async function requireAssignableHuman(tx: DB, scope: Scope, userId: number): Promise<void> {
  const [user] = await tx.select({ id: appUser.userId }).from(userCompany)
    .innerJoin(appUser, eq(appUser.userId, userCompany.userId))
    .where(and(
      eq(userCompany.userId, userId),
      eq(userCompany.companyFn, scope.companyFn),
      eq(appUser.masterFn, scope.masterFn),
      eq(appUser.identityKind, 'human'),
      eq(appUser.isActive, true),
      eq(appUser.loginEnabled, true),
      eq(appUser.accountState, 'active'),
    )).limit(1);
  if (!user) reject(400, 'product_case_assignee_invalid', 'Assignee must be an active Company user.');
}

export async function triageProductCase(
  db: DB,
  session: SessionData,
  id: unknown,
  input: unknown,
  requestId: string,
) {
  const caseId = positiveId(id);
  const source = objectInput(input, ['expectedVersion', 'category', 'assignedUserId'], 'triage');
  const version = expectedVersion(source.expectedVersion);
  if (!['defect', 'usability', 'improvement'].includes(String(source.category))) {
    reject(400, 'product_case_category_invalid', 'A supported category is required.');
  }
  const category = source.category as string;
  const assignedUserId = source.assignedUserId == null ? null : positiveId(source.assignedUserId);
  const scope = humanScope(session);
  return withTenantTransaction(db, scope, async (tx) => {
    await requireHumanPermission(tx, session, PERMISSIONS.productCasesManage);
    const row = await lockedCase(tx, scope, caseId);
    assertVersion(row, version);
    if (!['submitted', 'triaged', 'needs_info', 'accepted'].includes(row.status)) {
      reject(409, 'product_case_transition_invalid', 'This case cannot be triaged now.');
    }
    if (assignedUserId != null) await requireAssignableHuman(tx, scope, assignedUserId);
    const updated = await updateLockedCase(tx, scope, row, {
      category,
      assignedUserId,
      status: 'triaged',
    });
    await tx.insert(productCaseEvent).values({
      ...scope, caseId, eventType: 'triaged', fromStatus: row.status,
      toStatus: 'triaged', actorUserId: session.userId,
    });
    await appendAudit(tx, {
      ...scope, actorUserId: session.userId, requestId,
      entity: 'product_case', entityId: caseId, action: 'triage',
      before: { status: row.status, version: row.version },
      after: { status: updated.status, category, assignedUserId, version: updated.version },
    });
    return caseProjection(updated);
  });
}

export async function linkProductCaseTask(
  db: DB,
  session: SessionData,
  id: unknown,
  input: unknown,
  requestId: string,
) {
  const caseId = positiveId(id);
  const source = objectInput(input, ['expectedVersion', 'taskReference'], 'task link');
  const version = expectedVersion(source.expectedVersion);
  const taskReference = boundedText(source.taskReference, 'taskReference', 160, true)!;
  if (!/^[A-Za-z][A-Za-z0-9._:-]{3,159}$/.test(taskReference)) {
    reject(400, 'product_case_task_invalid', 'Use a stable task key without a URL or secret.');
  }
  const scope = humanScope(session);
  return withTenantTransaction(db, scope, async (tx) => {
    await requireHumanPermission(tx, session, PERMISSIONS.productCasesManage);
    const row = await lockedCase(tx, scope, caseId);
    assertVersion(row, version);
    if (!['triaged', 'accepted', 'in_progress', 'resolved'].includes(row.status)) {
      reject(409, 'product_case_transition_invalid', 'Task linkage requires an active triaged case.');
    }
    const updated = await updateLockedCase(tx, scope, row, {
      taskReference, taskLinkedByUserId: session.userId,
    });
    await tx.insert(productCaseEvent).values({
      ...scope, caseId, eventType: 'task_linked', fromStatus: row.status,
      toStatus: row.status, actorUserId: session.userId, taskReference,
    });
    await appendAudit(tx, {
      ...scope, actorUserId: session.userId, requestId,
      entity: 'product_case', entityId: caseId, action: 'link_task',
      before: { taskReference: row.taskReference, version: row.version },
      after: { taskReference, version: updated.version },
    });
    return caseProjection(updated);
  });
}

export async function appendHumanProductCaseEvidence(
  db: DB,
  session: SessionData,
  id: unknown,
  input: unknown,
  requestId: string,
) {
  const caseId = positiveId(id);
  const source = objectInput(input, ['expectedVersion', 'summary'], 'evidence');
  const version = expectedVersion(source.expectedVersion);
  const summary = boundedText(source.summary, 'summary', 1000, true)!;
  const scope = humanScope(session);
  return withTenantTransaction(db, scope, async (tx) => {
    await requireHumanPermission(tx, session, PERMISSIONS.productCasesManage);
    const row = await lockedCase(tx, scope, caseId);
    assertVersion(row, version);
    if (!['triaged', 'accepted', 'in_progress', 'resolved'].includes(row.status)) {
      reject(409, 'product_case_evidence_invalid', 'Reproduction evidence requires an active triaged case.');
    }
    const contentDigest = digest(JSON.stringify({
      kind: 'human_reproduction', summary,
    }));
    const [evidence] = await tx.insert(productCaseEvidence).values({
      ...scope, caseId, kind: 'human_reproduction', visibility: 'internal',
      summary, contentDigest, actorUserId: session.userId,
    }).returning();
    const updated = await updateLockedCase(tx, scope, row, {});
    await tx.insert(productCaseEvent).values({
      ...scope, caseId, eventType: 'evidence_added', fromStatus: row.status,
      toStatus: row.status, actorUserId: session.userId, evidenceId: evidence.id,
    });
    await appendAudit(tx, {
      ...scope, actorUserId: session.userId, requestId,
      entity: 'product_case', entityId: caseId, action: 'append_evidence',
      after: { evidenceId: evidence.id, kind: evidence.kind, contentDigest, version: updated.version },
    });
    return { data: caseEvidenceProjection(evidence), version: updated.version };
  });
}

export interface VerifiedProductRelease {
  revision: string;
  proofDigest: string;
}

export async function preflightProductCaseRelease(
  db: DB,
  session: SessionData,
  id: unknown,
  input: unknown,
): Promise<void> {
  const caseId = positiveId(id);
  const source = objectInput(input, ['expectedVersion'], 'release');
  const version = expectedVersion(source.expectedVersion);
  const scope = humanScope(session);
  await withTenantTransaction(db, scope, async (tx) => {
    await requireHumanPermission(tx, session, PERMISSIONS.productCasesRelease);
    const [row] = await tx.select().from(productCase).where(and(
      eq(productCase.id, caseId),
      eq(productCase.masterFn, scope.masterFn),
      eq(productCase.companyFn, scope.companyFn),
    )).limit(1);
    if (!row) reject(404, 'product_case_not_found', 'Case not found.');
    assertVersion(row, version);
    if (row.status !== 'resolved' || !row.taskReference) {
      reject(409, 'product_case_release_invalid', 'A resolved case and linked task are required.');
    }
  });
}

export async function releaseProductCase(
  db: DB,
  session: SessionData,
  id: unknown,
  input: unknown,
  verifiedRelease: VerifiedProductRelease,
  requestId: string,
) {
  const caseId = positiveId(id);
  const source = objectInput(input, ['expectedVersion'], 'release');
  const version = expectedVersion(source.expectedVersion);
  if (!/^[a-f0-9]{40}$/.test(verifiedRelease.revision)
    || !/^[a-f0-9]{64}$/.test(verifiedRelease.proofDigest)) {
    reject(503, 'product_case_release_unavailable', 'A verified deployed release is unavailable.');
  }
  const scope = humanScope(session);
  return withTenantTransaction(db, scope, async (tx) => {
    await requireHumanPermission(tx, session, PERMISSIONS.productCasesRelease);
    const row = await lockedCase(tx, scope, caseId);
    assertVersion(row, version);
    if (row.status !== 'resolved' || !row.taskReference) {
      reject(409, 'product_case_release_invalid', 'A resolved case and linked task are required.');
    }
    const updated = await updateLockedCase(tx, scope, row, {
      status: 'released',
      releaseRevision: verifiedRelease.revision,
      releaseProofDigest: verifiedRelease.proofDigest,
      releasedByUserId: session.userId,
      releasedAt: new Date(),
      verifiedByUserId: null,
      verifiedAt: null,
    });
    await tx.insert(productCaseEvent).values({
      ...scope, caseId, eventType: 'released', fromStatus: row.status,
      toStatus: 'released', actorUserId: session.userId,
      taskReference: row.taskReference,
      releaseRevision: verifiedRelease.revision,
      releaseProofDigest: verifiedRelease.proofDigest,
    });
    await appendAudit(tx, {
      ...scope, actorUserId: session.userId, requestId,
      entity: 'product_case', entityId: caseId, action: 'record_release',
      before: { status: row.status, version: row.version },
      after: { status: updated.status, version: updated.version,
        releaseRevision: verifiedRelease.revision,
        releaseProofDigest: verifiedRelease.proofDigest },
    });
    return caseProjection(updated);
  });
}

export async function verifyProductCaseRelease(
  db: DB,
  session: SessionData,
  id: unknown,
  input: unknown,
  requestId: string,
) {
  const caseId = positiveId(id);
  const source = objectInput(input, ['expectedVersion', 'result', 'observation'], 'verification');
  const version = expectedVersion(source.expectedVersion);
  if (source.result !== 'passed' && source.result !== 'failed') {
    reject(400, 'product_case_verification_invalid', 'result must be passed or failed.');
  }
  const result = source.result;
  const observation = boundedText(source.observation, 'observation', 1000, true)!;
  const scope = humanScope(session);
  return withTenantTransaction(db, scope, async (tx) => {
    await requireHumanPermission(tx, session, PERMISSIONS.productCasesVerify);
    const row = await lockedCase(tx, scope, caseId);
    assertVersion(row, version);
    if (row.status !== 'released' || !row.releaseRevision || !row.releaseProofDigest) {
      reject(409, 'product_case_verification_invalid', 'A verified release must be recorded first.');
    }
    if (session.userId === row.releasedByUserId || session.userId === row.taskLinkedByUserId) {
      reject(403, 'product_case_self_verification_denied', 'An independent human verifier is required.');
    }
    const contentDigest = digest(JSON.stringify({
      result, observation, releaseRevision: row.releaseRevision,
      releaseProofDigest: row.releaseProofDigest,
    }));
    const [evidence] = await tx.insert(productCaseEvidence).values({
      ...scope, caseId, kind: 'post_release_verification', visibility: 'internal',
      summary: observation, contentDigest, actorUserId: session.userId,
    }).returning();
    const nextStatus = result === 'passed' ? 'verified' : 'in_progress';
    const updated = await updateLockedCase(tx, scope, row, {
      status: nextStatus,
      verifiedByUserId: result === 'passed' ? session.userId : null,
      verifiedAt: result === 'passed' ? new Date() : null,
      resolution: result === 'failed' ? null : row.resolution,
    });
    await tx.insert(productCaseEvent).values({
      ...scope, caseId, eventType: result === 'passed' ? 'verified' : 'verification_failed',
      fromStatus: row.status, toStatus: nextStatus,
      actorUserId: session.userId, evidenceId: evidence.id,
      releaseRevision: row.releaseRevision, verificationResult: result,
    });
    await appendAudit(tx, {
      ...scope, actorUserId: session.userId, requestId,
      entity: 'product_case', entityId: caseId, action: 'verify_release',
      before: { status: row.status, version: row.version },
      after: { status: nextStatus, version: updated.version, result,
        evidenceId: evidence.id, contentDigest },
    });
    return caseProjection(updated);
  });
}

const TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  submitted: ['triaged', 'needs_info', 'closed'],
  triaged: ['accepted', 'needs_info', 'in_progress', 'closed'],
  needs_info: ['triaged', 'closed'],
  accepted: ['in_progress', 'closed'],
  in_progress: ['resolved', 'triaged'],
  resolved: ['in_progress'],
  released: [],
  verified: ['closed'],
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
  const source = objectInput(input, [
    'status', 'expectedVersion', 'resolution', 'resolutionCode', 'duplicateOfCaseId',
  ], 'transition');
  const status = source.status;
  const version = expectedVersion(source.expectedVersion);
  const resolution = boundedText(source.resolution, 'resolution', 1000, false);
  const resolutionCode = source.resolutionCode == null ? null : String(source.resolutionCode);
  const duplicateOfCaseId = source.duplicateOfCaseId == null ? null : positiveId(source.duplicateOfCaseId);
  if (typeof status !== 'string') reject(400, 'product_case_input_invalid', 'status is required.');
  if (status !== 'closed' && (resolutionCode || duplicateOfCaseId)) {
    reject(400, 'product_case_input_invalid', 'Closure details are only valid when closing.');
  }
  const scope = humanScope(session);
  return withTenantTransaction(db, scope, async (tx) => {
    await requireHumanPermission(tx, session, PERMISSIONS.productCasesManage);
    const row = await lockedCase(tx, scope, caseId);
    assertVersion(row, version);
    if (!TRANSITIONS[row.status]?.includes(status)) {
      reject(409, 'product_case_transition_invalid', 'This status transition is not allowed.');
    }
    if (status === 'in_progress' && !row.category) {
      reject(409, 'product_case_triage_required', 'Classify the case before starting work.');
    }
    if (status === 'resolved' && !row.taskReference) {
      reject(409, 'product_case_task_required', 'A tracked engineering task is required.');
    }
    if ((status === 'resolved' || status === 'closed' || status === 'needs_info') && !resolution) {
      reject(400, 'product_case_resolution_required', 'A resolution is required.');
    }
    if (status === 'closed') {
      const allowedCodes = row.status === 'verified'
        ? ['fixed']
        : ['duplicate', 'not_reproducible', 'declined', 'answered'];
      if (!resolutionCode || !allowedCodes.includes(resolutionCode)) {
        reject(400, 'product_case_resolution_code_invalid', 'A closure reason code is required.');
      }
      if (resolutionCode === 'duplicate') {
        if (duplicateOfCaseId == null || duplicateOfCaseId >= caseId) {
          reject(400, 'product_case_duplicate_invalid', 'A duplicate must link an earlier case.');
        }
        const [target] = await tx.select().from(productCase).where(and(
          eq(productCase.id, duplicateOfCaseId),
          eq(productCase.masterFn, scope.masterFn),
          eq(productCase.companyFn, scope.companyFn),
        )).limit(1);
        if (!target || target.duplicateOfCaseId != null) {
          reject(404, 'product_case_duplicate_not_found', 'The original case is unavailable.');
        }
      } else if (duplicateOfCaseId != null) {
        reject(400, 'product_case_duplicate_invalid', 'Only duplicate closure accepts an original case.');
      }
    }
    const reopening = row.status === 'closed' && status === 'triaged';
    const updated = await updateLockedCase(tx, scope, row, {
      status: status as CaseStatus,
      resolution: reopening ? null : (resolution ?? row.resolution),
      resolutionCode: reopening ? null : (status === 'closed' ? resolutionCode : row.resolutionCode),
      duplicateOfCaseId: reopening ? null : (status === 'closed' ? duplicateOfCaseId : row.duplicateOfCaseId),
      outcomePublishedAt: reopening ? null : (status === 'closed' ? new Date() : row.outcomePublishedAt),
      ...(reopening ? {
        taskReference: null, taskLinkedByUserId: null,
        releaseRevision: null, releaseProofDigest: null,
        releasedByUserId: null, releasedAt: null,
        verifiedByUserId: null, verifiedAt: null,
      } : {}),
    });
    await tx.insert(productCaseEvent).values({
      ...scope,
      caseId,
      eventType: 'transitioned',
      fromStatus: row.status,
      toStatus: status,
      actorUserId: session.userId,
      note: resolution,
      resolutionCode: status === 'closed' ? resolutionCode : null,
      duplicateOfCaseId: status === 'closed' ? duplicateOfCaseId : null,
    });
    await appendAudit(tx, {
      ...scope,
      actorUserId: session.userId,
      requestId,
      entity: 'product_case',
      entityId: caseId,
      action: 'transition',
      before: { status: row.status, version: row.version },
      after: { status, version: updated.version,
        ...(status === 'closed' ? { resolutionCode, duplicateOfCaseId } : {}) },
    });
    return caseProjection(updated);
  });
}
