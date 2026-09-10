import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  agentExecutionIntent,
  agentPrincipal,
  auditLog,
  appUser,
  userCompany,
  type AgentExecutionIntentStatus,
} from '../../data/schema';
import type { appendAudit } from '../../api/audit';
import { authorizeWithin } from '../../auth/authorization';
import { PERMISSIONS } from '../../auth/permissions';
import type { CompanyReceiptReadVisibility } from '../expenses/companyReceipt';
import type {
  normalizeCompanyReceiptPackFilters,
  normalizeCompanyReceiptPackKey,
  normalizeCompanyReceiptPackLocale,
  createCompanyReceiptPackFromSelectionWithin,
  readCompanyReceiptPackByKeyWithin,
  selectCompanyReceiptPackWithin,
  CompanyReceiptPackSelection,
} from '../expenses/companyReceiptPack';
import type {
  CompanyReceiptPackFilters,
  CompanyReceiptPackLineFacts,
} from '../expenses/companyReceiptPackPdf';

export const AGENT_EXECUTION_INTENT_ACTION = 'receipt_pack.create' as const;
export const AGENT_EXECUTION_INTENT_TTL_MS = 15 * 60 * 1000;

type ReceiptPackLocale = 'en' | 'ms' | 'zh' | 'ja' | 'vi';

export class AgentExecutionIntentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'AgentExecutionIntentError';
  }
}

export interface AgentReceiptPackExecutionIntentInput {
  intentKey: unknown;
  packKey: unknown;
  search?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  locale?: unknown;
  visibility: unknown;
  selectionDigest?: unknown;
  payloadDigest?: unknown;
}

export interface PrepareAgentExecutionIntentInput extends AgentReceiptPackExecutionIntentInput {
  agentPrincipalId: number;
  actorUserId: number;
  requestId: string;
}

export interface AgentExecutionIntentDecisionInput {
  intentId: number;
  expectedVersion: number;
  decisionByUserId: number;
  reason: string;
  requestId: string;
}

export interface VerifyAgentExecutionIntentInput extends AgentReceiptPackExecutionIntentInput {
  intentId: number;
  agentPrincipalId: number;
  actorUserId: number;
  requestId: string;
  requireApproved?: boolean;
}

interface ReviewedFacts {
  scope: Scope;
  actionName: typeof AGENT_EXECUTION_INTENT_ACTION;
  agentPrincipalId: number;
  actorUserId: number;
  packKey: string;
  visibility: CompanyReceiptReadVisibility;
  locale: ReceiptPackLocale;
  filters: CompanyReceiptPackFilters;
  selectionDigest: string;
  resourceVersionDigest: string;
  rows: CompanyReceiptPackLineFacts[];
  totals: CompanyReceiptPackSelection['totals'];
  rowCount: number;
  documentCount: number;
  retentionUntil: string;
}

export interface AgentExecutionIntentView {
  id: number;
  masterFn: string;
  companyFn: string;
  agentPrincipalId: number;
  actionName: typeof AGENT_EXECUTION_INTENT_ACTION;
  actorUserId: number;
  packKey: string;
  visibility: CompanyReceiptReadVisibility;
  locale: ReceiptPackLocale;
  filters: CompanyReceiptPackFilters;
  selectionDigest: string;
  resourceVersionDigest: string;
  payloadDigest: string;
  reviewedFacts: ReviewedFacts;
  status: AgentExecutionIntentStatus;
  expiresAt: Date;
  decisionByUserId: number | null;
  decisionReason: string | null;
  decidedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PreparedFacts {
  facts: ReviewedFacts;
  payloadDigest: string;
  resourceVersionDigest: string;
}

export interface AgentExecutionIntentDependencies {
  sha256(value: string): string | Promise<string>;
  appendAudit: typeof appendAudit;
  isPackError(error: unknown): boolean;
  normalizeCompanyReceiptPackFilters: typeof normalizeCompanyReceiptPackFilters;
  normalizeCompanyReceiptPackKey: typeof normalizeCompanyReceiptPackKey;
  normalizeCompanyReceiptPackLocale: typeof normalizeCompanyReceiptPackLocale;
  createCompanyReceiptPackFromSelectionWithin: typeof createCompanyReceiptPackFromSelectionWithin;
  readCompanyReceiptPackByKeyWithin: typeof readCompanyReceiptPackByKeyWithin;
  selectCompanyReceiptPackWithin: typeof selectCompanyReceiptPackWithin;
}

/** Platform bindings supply hashing, audit attribution and Pack IO; policy stays here. */
export function createAgentExecutionIntentCommands(dependencies: AgentExecutionIntentDependencies) {
  const { sha256, appendAudit, isPackError, normalizeCompanyReceiptPackFilters, normalizeCompanyReceiptPackKey, normalizeCompanyReceiptPackLocale, createCompanyReceiptPackFromSelectionWithin, readCompanyReceiptPackByKeyWithin, selectCompanyReceiptPackWithin } = dependencies;
  function fail(code: string, message: string, status = 409): never {
    throw new AgentExecutionIntentError(code, message, status);
  }

  /** Stable JSON hashing prevents JSONB key-order differences from changing an intent digest. */
  function canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }

  function positiveId(value: unknown, field: string): number {
    const id = typeof value === 'number' && Number.isSafeInteger(value)
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
    if (!Number.isSafeInteger(id) || id <= 0) {
      fail('agent_execution_intent_input_invalid', `${field} must be a positive integer.`, 400);
    }
    return id;
  }

  function requestId(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) {
      fail('agent_execution_intent_input_invalid', 'requestId is required.', 400);
    }
    return value.trim();
  }

  function intentKey(value: unknown): string {
    if (typeof value !== 'string') {
      fail('agent_execution_intent_key_invalid', 'A separately supplied execution intent key is required.', 400);
    }
    const key = value.trim();
    if (key.length < 16 || key.length > 200) {
      fail(
        'agent_execution_intent_key_invalid',
        'The execution intent key must contain 16–200 characters.',
        400,
      );
    }
    return key;
  }

  function visibility(value: unknown): CompanyReceiptReadVisibility {
    if (value !== 'own' && value !== 'company') {
      fail('agent_execution_intent_visibility_invalid', 'Receipt Pack visibility is invalid.', 400);
    }
    return value;
  }

  function digest(value: unknown, field: string): string | undefined {
    if (value == null) return undefined;
    if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
      fail('agent_execution_intent_digest_invalid', `${field} must be a lowercase SHA-256 digest.`, 400);
    }
    return value;
  }

  function decisionReason(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > 1000) {
      fail('agent_execution_intent_reason_invalid', 'A decision reason of 3–1000 characters is required.', 400);
    }
    return value.trim();
  }

  function validDate(value: Date, field: string): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      fail('agent_execution_intent_time_invalid', `${field} is invalid.`, 400);
    }
    return value;
  }

  async function activePrincipal(
    exec: DB,
    scope: Scope,
    agentPrincipalId: number,
    actorUserId: number,
  ) {
    const [row] = await exec.select().from(agentPrincipal).where(and(
      eq(agentPrincipal.id, agentPrincipalId),
      eq(agentPrincipal.masterFn, scope.masterFn),
      eq(agentPrincipal.companyFn, scope.companyFn),
    )).limit(1);
    if (!row) fail('agent_execution_intent_principal_not_found', 'Agent principal is unavailable.', 404);
    if (row.status !== 'active' || row.revokedAt != null) {
      fail('agent_execution_intent_principal_inactive', 'Agent principal is not active.', 403);
    }
    if (row.ownerUserId !== actorUserId) {
      fail(
        'agent_execution_intent_actor_mismatch',
        'The execution actor does not match the Agent accountable owner.',
        403,
      );
    }
    return row;
  }

  async function activeHumanDecisionMaker(
    exec: DB,
    scope: Scope,
    userId: number,
    intent: typeof agentExecutionIntent.$inferSelect,
  ): Promise<void> {
    const [human] = await exec.select({ userId: appUser.userId }).from(userCompany)
      .innerJoin(appUser, eq(appUser.userId, userCompany.userId))
      .where(and(
        eq(userCompany.userId, userId),
        eq(userCompany.companyFn, scope.companyFn),
        eq(appUser.masterFn, scope.masterFn),
        eq(appUser.identityKind, 'human'),
        eq(appUser.isActive, true),
        eq(appUser.loginEnabled, true),
        eq(appUser.accountState, 'active'),
      ))
      .limit(1);
    if (!human) {
      fail(
        'agent_execution_intent_human_confirmation_required',
        'Only an active human Company member may confirm, reject or cancel an Agent execution intent.',
        403,
      );
    }
    const permission = intent.visibility === 'company'
      ? PERMISSIONS.expensesCompanyReceiptsReadCompany
      : PERMISSIONS.expensesCompanyReceiptsReadOwn;
    const scopeTarget = intent.visibility === 'company'
      ? { scope: 'company' as const, targetType: 'company', targetId: scope.companyFn }
      : { scope: 'self' as const, targetType: 'employee', targetId: String(intent.actorUserId) };
    const decision = await authorizeWithin(exec, {
      userId,
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
    }, permission, {
      resourceKey: 'expenses/company_receipt_packs',
      scopeTarget,
      requireScope: true,
    });
    if (!decision.allowed) {
      fail(
        'agent_execution_intent_confirmation_denied',
        'The human confirmer does not hold the current Receipt Pack authority.',
        403,
      );
    }
  }

  function resourceVersions(rows: CompanyReceiptPackLineFacts[]) {
    return rows.map((row) => ({
      receiptId: row.receiptId,
      receiptVersion: row.receiptVersion,
      documentId: row.documentId,
      documentVersionId: row.documentVersionId,
      documentSha256: row.documentSha256,
    }));
  }

  async function reviewedFacts(
    scope: Scope,
    input: {
      agentPrincipalId: number;
      actorUserId: number;
      packKey: string;
      visibility: CompanyReceiptReadVisibility;
      locale: ReceiptPackLocale;
      selection: CompanyReceiptPackSelection;
    },
  ): Promise<PreparedFacts> {
    const versions = resourceVersions(input.selection.rows);
    const resourceVersionDigest = await sha256(canonicalJson(versions));
    const facts: ReviewedFacts = {
      scope,
      actionName: AGENT_EXECUTION_INTENT_ACTION,
      agentPrincipalId: input.agentPrincipalId,
      actorUserId: input.actorUserId,
      packKey: input.packKey,
      visibility: input.visibility,
      locale: input.locale,
      filters: input.selection.filters,
      selectionDigest: input.selection.sourceSha256,
      resourceVersionDigest,
      rows: input.selection.rows,
      totals: input.selection.totals,
      rowCount: input.selection.rowCount,
      documentCount: input.selection.documentCount,
      retentionUntil: input.selection.retentionUntil.toISOString(),
    };
    return {
      facts,
      payloadDigest: await sha256(canonicalJson(facts)),
      resourceVersionDigest,
    };
  }

  function view(row: typeof agentExecutionIntent.$inferSelect): AgentExecutionIntentView {
    return {
      id: row.id,
      masterFn: row.masterFn,
      companyFn: row.companyFn,
      agentPrincipalId: row.agentPrincipalId,
      actionName: row.actionName as typeof AGENT_EXECUTION_INTENT_ACTION,
      actorUserId: row.actorUserId,
      packKey: row.packKey,
      visibility: row.visibility as CompanyReceiptReadVisibility,
      locale: row.locale as ReceiptPackLocale,
      filters: row.filters as unknown as CompanyReceiptPackFilters,
      selectionDigest: row.selectionDigest,
      resourceVersionDigest: row.resourceVersionDigest,
      payloadDigest: row.payloadDigest,
      reviewedFacts: row.reviewedFacts as unknown as ReviewedFacts,
      status: row.status as AgentExecutionIntentStatus,
      expiresAt: row.expiresAt,
      decisionByUserId: row.decisionByUserId,
      decisionReason: row.decisionReason,
      decidedAt: row.decidedAt,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async function findIntent(
    exec: DB,
    scope: Scope,
    intentId: number,
    lock = false,
  ) {
    const query = exec.select().from(agentExecutionIntent).where(and(
      eq(agentExecutionIntent.id, intentId),
      eq(agentExecutionIntent.masterFn, scope.masterFn),
      eq(agentExecutionIntent.companyFn, scope.companyFn),
    )).limit(1);
    const [row] = lock ? await query.for('update') : await query;
    if (!row) fail('agent_execution_intent_not_found', 'Execution intent is unavailable.', 404);
    return row;
  }

  function expired(row: typeof agentExecutionIntent.$inferSelect, now: Date): boolean {
    return row.expiresAt.getTime() <= now.getTime();
  }

  function assertExpectedVersion(actual: number, expected: number): void {
    if (actual !== expected) {
      fail(
        'agent_execution_intent_version_conflict',
        'The execution intent changed in another session. Refresh before retrying.',
        409,
      );
    }
  }

  async function normalizedPreparation(
    exec: DB,
    scope: Scope,
    input: {
      agentPrincipalId: number;
      actorUserId: number;
      intentKey: unknown;
      packKey: unknown;
      search?: unknown;
      dateFrom?: unknown;
      dateTo?: unknown;
      locale?: unknown;
      visibility: unknown;
      lockRows?: boolean;
    },
    now: Date,
  ) {
    const agentPrincipalId = positiveId(input.agentPrincipalId, 'agentPrincipalId');
    const actorUserId = positiveId(input.actorUserId, 'actorUserId');
    const rawIntentKey = intentKey(input.intentKey);
    const packKey = normalizeCompanyReceiptPackKey(input.packKey);
    if (rawIntentKey === packKey) {
      fail(
        'agent_execution_intent_key_not_separate',
        'The execution intent key must be separate from the business Pack key.',
        400,
      );
    }
    const filters = normalizeCompanyReceiptPackFilters(input);
    const locale = normalizeCompanyReceiptPackLocale(input.locale);
    const readVisibility = visibility(input.visibility);
    await activePrincipal(exec, scope, agentPrincipalId, actorUserId);
    const selection = await selectCompanyReceiptPackWithin(
      exec,
      scope,
      actorUserId,
      readVisibility,
      filters,
      { lockRows: input.lockRows },
    );
    const prepared = await reviewedFacts(scope, {
      agentPrincipalId,
      actorUserId,
      packKey,
      visibility: readVisibility,
      locale,
      selection,
    });
    return {
      agentPrincipalId,
      actorUserId,
      rawIntentKey,
      intentKeyHash: await sha256(rawIntentKey),
      packKey,
      locale,
      visibility: readVisibility,
      selection,
      prepared,
      now,
    };
  }

  async function prepareAgentExecutionIntentWithin(
    exec: DB,
    scope: Scope,
    input: PrepareAgentExecutionIntentInput,
    now = new Date(),
  ) {
    const request = requestId(input.requestId);
    const prepared = await normalizedPreparation(exec, scope, input, validDate(now, 'now'));
    if (request.includes(prepared.rawIntentKey)) {
      fail(
        'agent_execution_intent_secret_in_request_id',
        'The execution intent key must not be included in a request identifier.',
        400,
      );
    }
    const expiresAt = new Date(prepared.now.getTime() + AGENT_EXECUTION_INTENT_TTL_MS);
    const values: typeof agentExecutionIntent.$inferInsert = {
      ...scope,
      agentPrincipalId: prepared.agentPrincipalId,
      actionName: AGENT_EXECUTION_INTENT_ACTION,
      actorUserId: prepared.actorUserId,
      packKey: prepared.packKey,
      visibility: prepared.visibility,
      locale: prepared.locale,
      filters: prepared.selection.filters as unknown as Record<string, string>,
      selectionDigest: prepared.selection.sourceSha256,
      resourceVersionDigest: prepared.prepared.resourceVersionDigest,
      payloadDigest: prepared.prepared.payloadDigest,
      reviewedFacts: prepared.prepared.facts as unknown as Record<string, unknown>,
      intentKeyHash: prepared.intentKeyHash,
      status: 'prepared',
      expiresAt,
      createdAt: prepared.now,
      updatedAt: prepared.now,
    };
    const [created] = await exec.insert(agentExecutionIntent).values(values).onConflictDoNothing({
      target: [
        agentExecutionIntent.masterFn,
        agentExecutionIntent.companyFn,
        agentExecutionIntent.agentPrincipalId,
        agentExecutionIntent.intentKeyHash,
      ],
    }).returning();
    if (!created) {
      const [existing] = await exec.select().from(agentExecutionIntent).where(and(
        eq(agentExecutionIntent.masterFn, scope.masterFn),
        eq(agentExecutionIntent.companyFn, scope.companyFn),
        eq(agentExecutionIntent.agentPrincipalId, prepared.agentPrincipalId),
        eq(agentExecutionIntent.intentKeyHash, prepared.intentKeyHash),
      )).limit(1);
      if (!existing) {
        return fail(
          'agent_execution_intent_conflict_unresolved',
          'The execution intent key was claimed concurrently but its record is unavailable.',
          409,
        );
      }
      if (
        existing.actorUserId !== prepared.actorUserId
        || existing.packKey !== prepared.packKey
        || existing.payloadDigest !== prepared.prepared.payloadDigest
        || existing.selectionDigest !== prepared.selection.sourceSha256
      ) {
        return fail(
          'agent_execution_intent_key_conflict',
          'This execution intent key was already used for different reviewed facts.',
          409,
        );
      }
      return { intent: view(existing), replayed: true };
    }
    await appendAudit(exec, {
      ...scope,
      actorUserId: prepared.actorUserId,
      agentPrincipalId: prepared.agentPrincipalId,
      delegatorUserId: prepared.actorUserId,
      requestId: request,
      entity: 'agent_execution_intent',
      entityId: created.id,
      action: 'prepared',
      after: {
        actionName: created.actionName,
        payloadDigest: created.payloadDigest,
        selectionDigest: created.selectionDigest,
        resourceVersionDigest: created.resourceVersionDigest,
        expiresAt: created.expiresAt,
        version: created.version,
      },
    });
    return { intent: view(created), replayed: false };
  }

  async function readAgentExecutionIntentWithin(
    exec: DB,
    scope: Scope,
    intentId: number,
  ) {
    return view(await findIntent(exec, scope, positiveId(intentId, 'intentId')));
  }

  async function decideAgentExecutionIntentWithin(
    exec: DB,
    scope: Scope,
    input: AgentExecutionIntentDecisionInput,
    decision: 'approved' | 'rejected' | 'cancelled',
    now: Date,
  ) {
    const request = requestId(input.requestId);
    const intentId = positiveId(input.intentId, 'intentId');
    const expectedVersion = positiveId(input.expectedVersion, 'expectedVersion');
    const decisionByUserId = positiveId(input.decisionByUserId, 'decisionByUserId');
    const reason = decisionReason(input.reason);
    const at = validDate(now, 'now');
    const row = await findIntent(exec, scope, intentId, true);
    await activeHumanDecisionMaker(exec, scope, decisionByUserId, row);
    assertExpectedVersion(row.version, expectedVersion);
    if (expired(row, at)) {
      fail('agent_execution_intent_expired', 'The execution intent has expired and cannot execute.', 410);
    }
    if (decision === 'approved' && row.status !== 'prepared') {
      fail('agent_execution_intent_not_preparable', 'Only a prepared intent may be approved.', 409);
    }
    if (decision === 'rejected' && row.status !== 'prepared') {
      fail('agent_execution_intent_not_preparable', 'Only a prepared intent may be rejected.', 409);
    }
    if (decision === 'cancelled' && !['prepared', 'approved'].includes(row.status)) {
      fail('agent_execution_intent_not_cancellable', 'Only a prepared or approved intent may be cancelled.', 409);
    }
    const [updated] = await exec.update(agentExecutionIntent).set({
      status: decision,
      decisionByUserId,
      decisionReason: reason,
      decidedAt: at,
      version: sql`${agentExecutionIntent.version} + 1`,
      updatedAt: at,
    }).where(and(
      eq(agentExecutionIntent.id, row.id),
      eq(agentExecutionIntent.masterFn, scope.masterFn),
      eq(agentExecutionIntent.companyFn, scope.companyFn),
      eq(agentExecutionIntent.version, row.version),
      decision === 'cancelled'
        ? sql`${agentExecutionIntent.status} in ('prepared', 'approved')`
        : eq(agentExecutionIntent.status, 'prepared'),
    )).returning();
    if (!updated) {
      fail(
        'agent_execution_intent_version_conflict',
        'The execution intent changed in another session. Refresh before retrying.',
        409,
      );
    }
    await appendAudit(exec, {
      ...scope,
      actorUserId: decisionByUserId,
      agentPrincipalId: row.agentPrincipalId,
      delegatorUserId: row.actorUserId,
      requestId: request,
      entity: 'agent_execution_intent',
      entityId: row.id,
      action: decision,
      before: {
        status: row.status,
        version: row.version,
        payloadDigest: row.payloadDigest,
      },
      after: {
        status: updated.status,
        version: updated.version,
        payloadDigest: updated.payloadDigest,
        decisionByUserId,
      },
    });
    return view(updated);
  }

  function approveAgentExecutionIntentWithin(
    exec: DB,
    scope: Scope,
    input: AgentExecutionIntentDecisionInput,
    now = new Date(),
  ) {
    return decideAgentExecutionIntentWithin(exec, scope, input, 'approved', now);
  }

  function rejectAgentExecutionIntentWithin(
    exec: DB,
    scope: Scope,
    input: AgentExecutionIntentDecisionInput,
    now = new Date(),
  ) {
    return decideAgentExecutionIntentWithin(exec, scope, input, 'rejected', now);
  }

  function cancelAgentExecutionIntentWithin(
    exec: DB,
    scope: Scope,
    input: AgentExecutionIntentDecisionInput,
    now = new Date(),
  ) {
    return decideAgentExecutionIntentWithin(exec, scope, input, 'cancelled', now);
  }

  interface VerifiedAgentExecutionIntentContext {
    requestId: string;
    at: Date;
    principalId: number;
    actorUserId: number;
    rawIntentKey: string;
    row: typeof agentExecutionIntent.$inferSelect;
    packKey: string;
    filters: CompanyReceiptPackFilters;
    locale: ReceiptPackLocale;
    visibility: CompanyReceiptReadVisibility;
  }

  interface LoadVerifiedAgentExecutionIntentOptions {
    /**
     * A committed Pack is an immutable effect. The retry path may inspect that
     * effect before enforcing the original approval window, but it must still
     * prove that the intent was the Agent execution that committed it.
     */
    allowCommittedReplay?: boolean;
  }

  async function hasCommittedAgentExecutionAudit(
    exec: DB,
    scope: Scope,
    intentId: number,
  ): Promise<boolean> {
    const [row] = await exec.select({ id: auditLog.id }).from(auditLog).where(and(
      eq(auditLog.masterFn, scope.masterFn),
      eq(auditLog.companyFn, scope.companyFn),
      eq(auditLog.entity, 'agent_execution_intent'),
      eq(auditLog.entityId, String(intentId)),
      sql`${auditLog.action} in ('executed', 'replayed')`,
    )).limit(1);
    return row != null;
  }

  async function loadVerifiedAgentExecutionIntentContext(
    exec: DB,
    scope: Scope,
    input: VerifyAgentExecutionIntentInput,
    now: Date,
    options: LoadVerifiedAgentExecutionIntentOptions = {},
  ): Promise<VerifiedAgentExecutionIntentContext> {
    const request = requestId(input.requestId);
    const at = validDate(now, 'now');
    const principalId = positiveId(input.agentPrincipalId, 'agentPrincipalId');
    const actorUserId = positiveId(input.actorUserId, 'actorUserId');
    const intentId = positiveId(input.intentId, 'intentId');
    const rawIntentKey = intentKey(input.intentKey);
    const packKey = normalizeCompanyReceiptPackKey(input.packKey);
    const filters = normalizeCompanyReceiptPackFilters(input);
    const locale = normalizeCompanyReceiptPackLocale(input.locale);
    const readVisibility = visibility(input.visibility);
    if (rawIntentKey === packKey) {
      fail(
        'agent_execution_intent_key_not_separate',
        'The execution intent key must be separate from the business Pack key.',
        400,
      );
    }
    if (request.includes(rawIntentKey)) {
      fail(
        'agent_execution_intent_secret_in_request_id',
        'The execution intent key must not be included in a request identifier.',
        400,
      );
    }
    const row = await findIntent(exec, scope, intentId, true);
    if (row.agentPrincipalId !== principalId || row.actorUserId !== actorUserId) {
      fail(
        'agent_execution_intent_identity_mismatch',
        'The execution intent is bound to a different Agent principal or actor.',
        403,
      );
    }
    await activePrincipal(exec, scope, principalId, actorUserId);
    if (await sha256(rawIntentKey) !== row.intentKeyHash) {
      fail('agent_execution_intent_key_mismatch', 'The execution intent key does not match.', 409);
    }
    if (!options.allowCommittedReplay && expired(row, at)) {
      fail('agent_execution_intent_expired', 'The execution intent has expired and cannot execute.', 410);
    }
    if (!options.allowCommittedReplay && input.requireApproved !== false && row.status !== 'approved') {
      fail('agent_execution_intent_not_approved', 'The execution intent is not approved for execution.', 428);
    }
    return {
      requestId: request,
      at,
      principalId,
      actorUserId,
      rawIntentKey,
      row,
      packKey,
      filters,
      locale,
      visibility: readVisibility,
    };
  }

  function assertSuppliedIntentDigestsMatch(
    row: typeof agentExecutionIntent.$inferSelect,
    input: VerifyAgentExecutionIntentInput,
  ): void {
    const expectedSelectionDigest = digest(input.selectionDigest, 'selectionDigest');
    const expectedPayloadDigest = digest(input.payloadDigest, 'payloadDigest');
    if (expectedSelectionDigest && expectedSelectionDigest !== row.selectionDigest) {
      fail('agent_execution_intent_digest_mismatch', 'The supplied selection digest does not match the reviewed intent.', 409);
    }
    if (expectedPayloadDigest && expectedPayloadDigest !== row.payloadDigest) {
      fail('agent_execution_intent_digest_mismatch', 'The supplied payload digest does not match the reviewed intent.', 409);
    }
  }

  async function assertReviewedSelectionMatches(
    row: typeof agentExecutionIntent.$inferSelect,
    normalized: Awaited<ReturnType<typeof normalizedPreparation>>,
    input: VerifyAgentExecutionIntentInput,
  ): Promise<void> {
    assertSuppliedIntentDigestsMatch(row, input);
    if (
      normalized.prepared.payloadDigest !== row.payloadDigest
      || normalized.selection.sourceSha256 !== row.selectionDigest
      || normalized.prepared.resourceVersionDigest !== row.resourceVersionDigest
      || await sha256(canonicalJson(row.reviewedFacts)) !== row.payloadDigest
    ) {
      fail(
        'agent_execution_intent_stale',
        'The reviewed Receipt Pack facts changed after preparation; prepare and approve a new intent.',
        409,
      );
    }
  }

  async function verifyAgentExecutionIntentWithin(
    exec: DB,
    scope: Scope,
    input: VerifyAgentExecutionIntentInput,
    now = new Date(),
  ) {
    const context = await loadVerifiedAgentExecutionIntentContext(exec, scope, input, now);
    let normalized: Awaited<ReturnType<typeof normalizedPreparation>>;
    try {
      normalized = await normalizedPreparation(exec, scope, {
        agentPrincipalId: context.principalId,
        actorUserId: context.actorUserId,
        intentKey: context.rawIntentKey,
        packKey: context.packKey,
        search: context.filters.search,
        dateFrom: context.filters.dateFrom,
        dateTo: context.filters.dateTo,
        locale: context.locale,
        visibility: context.visibility,
        lockRows: true,
      }, context.at);
    } catch (error) {
      if (isPackError(error)) {
        fail(
          'agent_execution_intent_stale',
          'The reviewed Receipt Pack facts are no longer available; prepare and approve a new intent.',
          409,
        );
      }
      throw error;
    }
    await assertReviewedSelectionMatches(context.row, normalized, input);
    return {
      intent: view(context.row),
      selection: normalized.selection,
      requestId: context.requestId,
    };
  }

  /**
   * Execute an approved Agent intent against the exact reviewed selection. A
   * committed Pack is checked first so a dropped response can replay without
   * requiring source rows to remain unchanged; a new Pack uses locked source
   * rows and is inserted from that locked selection in the same serializable
   * transaction.
   */
  async function executeAgentReceiptPackWithin(
    exec: DB,
    scope: Scope,
    input: VerifyAgentExecutionIntentInput,
    now = new Date(),
  ) {
    const context = await loadVerifiedAgentExecutionIntentContext(exec, scope, input, now, {
      allowCommittedReplay: true,
    });
    assertSuppliedIntentDigestsMatch(context.row, input);
    const replay = await readCompanyReceiptPackByKeyWithin(
      exec,
      scope,
      context.actorUserId,
      context.visibility,
      {
        packKey: context.packKey,
        locale: context.locale,
        filters: context.filters,
      },
    );
    if (replay) {
      if (!await hasCommittedAgentExecutionAudit(exec, scope, context.row.id)) {
        fail(
          'agent_execution_intent_pack_conflict',
          'The Receipt Pack key already belongs to a result outside this Agent intent.',
          409,
        );
      }
      if (!['approved', 'cancelled'].includes(context.row.status)) {
        fail('agent_execution_intent_not_approved', 'The execution intent is not approved for execution.', 428);
      }
      return {
        intent: view(context.row),
        pack: replay.pack,
        replayed: true,
        requestId: context.requestId,
      };
    }

    if (expired(context.row, context.at)) {
      fail('agent_execution_intent_expired', 'The execution intent has expired and cannot execute.', 410);
    }
    if (context.row.status !== 'approved') {
      fail('agent_execution_intent_not_approved', 'The execution intent is not approved for execution.', 428);
    }

    let normalized: Awaited<ReturnType<typeof normalizedPreparation>>;
    try {
      normalized = await normalizedPreparation(exec, scope, {
        agentPrincipalId: context.principalId,
        actorUserId: context.actorUserId,
        intentKey: context.rawIntentKey,
        packKey: context.packKey,
        search: context.filters.search,
        dateFrom: context.filters.dateFrom,
        dateTo: context.filters.dateTo,
        locale: context.locale,
        visibility: context.visibility,
        lockRows: true,
      }, context.at);
    } catch (error) {
      if (isPackError(error)) {
        fail(
          'agent_execution_intent_stale',
          'The reviewed Receipt Pack facts are no longer available; prepare and approve a new intent.',
          409,
        );
      }
      throw error;
    }
    await assertReviewedSelectionMatches(context.row, normalized, input);
    const created = await createCompanyReceiptPackFromSelectionWithin(
      exec,
      scope,
      context.actorUserId,
      context.visibility,
      {
        packKey: context.packKey,
        locale: context.locale,
        selection: normalized.selection,
      },
      context.at,
    );
    return {
      intent: view(context.row),
      pack: created.pack,
      replayed: created.replayed,
      requestId: context.requestId,
    };
  }

  return { prepareAgentExecutionIntentWithin, readAgentExecutionIntentWithin, approveAgentExecutionIntentWithin, rejectAgentExecutionIntentWithin, cancelAgentExecutionIntentWithin, verifyAgentExecutionIntentWithin, executeAgentReceiptPackWithin };
}
