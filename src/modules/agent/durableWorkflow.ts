import { createHash, randomUUID } from 'node:crypto';
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  agentExecutionIntent,
  agentWorkflowRun,
  agentWorkflowStep,
  outboxEvent,
  type AgentWorkflowRunState,
  type AgentWorkflowStepState,
} from '../../data/schema';
import { isModuleEnabled } from '../../auth/moduleAccess';
import {
  resolveAgentGrantWithin,
  type ResolvedAgentGrant,
} from './agentIdentity';
import {
  executeStoredAgentReceiptPackWithin,
} from './agentExecutionIntent';
import {
  CompanyReceiptPackError,
  normalizeCompanyReceiptPackFilters,
  normalizeCompanyReceiptPackLocale,
  readCompanyReceiptPackByKeyWithin,
  renderCompanyReceiptPackWithin,
} from '../expenses/companyReceiptPack';
import { appendAudit } from '../../api/audit';
import {
  withAgentWorkerTransaction,
  withAgentWorkerTenantTransaction,
  withTenantTransaction,
} from '../../data/tenantTransaction';

export const AGENT_WORKFLOW_TOPIC = 'agent.workflow.receipt_pack.requested' as const;
export const AGENT_WORKFLOW_KEY = 'receipt_pack.create' as const;
export const AGENT_WORKFLOW_LEASE_MS = 5 * 60 * 1000;
export const AGENT_WORKFLOW_POLL_MS = 5 * 1000;
export const AGENT_WORKFLOW_MAX_ATTEMPTS = 3;

type WorkflowStepKey = 'approval' | 'execute' | 'verify';

export class AgentWorkflowError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'AgentWorkflowError';
  }
}

export interface QueueReceiptPackWorkflowInput {
  intentId: number;
  agentPrincipalId: number;
  actorUserId: number;
  triggerKey: string;
  requestId: string;
  maxAttempts?: number;
}

export interface AgentWorkflowRunActionInput {
  runId: number;
  expectedVersion: number;
  actorUserId: number;
  reason: string;
  requestId: string;
}

export interface AgentWorkflowRunView {
  id: number;
  masterFn: string;
  companyFn: string;
  workflowKey: typeof AGENT_WORKFLOW_KEY;
  agentPrincipalId: number;
  actorUserId: number;
  intentId: number;
  state: AgentWorkflowRunState;
  version: number;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  leaseExpiresAt: Date | null;
  heartbeatAt: Date | null;
  currentStepKey: WorkflowStepKey | null;
  checkpoint: Record<string, unknown>;
  resultRef: Record<string, unknown> | null;
  lastError: string | null;
  pauseRequestedAt: Date | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  steps: AgentWorkflowStepView[];
}

export interface AgentWorkflowStepView {
  id: number;
  runId: number;
  stepKey: WorkflowStepKey;
  sequenceNo: number;
  state: AgentWorkflowStepState;
  version: number;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  leaseExpiresAt: Date | null;
  heartbeatAt: Date | null;
  checkpoint: Record<string, unknown>;
  resultRef: Record<string, unknown> | null;
  lastError: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface IntentRow {
  id: number;
  masterFn: string;
  companyFn: string;
  agentPrincipalId: number;
  actorUserId: number;
  packKey: string;
  visibility: string;
  locale: string;
  filters: unknown;
  selectionDigest: string;
  resourceVersionDigest: string;
  payloadDigest: string;
  status: string;
  expiresAt: Date;
  version: number;
}

interface WorkerOptions {
  workerId?: string;
  batchSize?: number;
  leaseMs?: number;
  maxAttempts?: number;
  now?: Date;
}

export interface AgentWorkflowBatchResult {
  signalsClaimed: number;
  signalsDelivered: number;
  signalsFailed: number;
  runsClaimed: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  paused: number;
  waitingApproval: number;
  retried: number;
  deadLettered: number;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function fail(code: string, message: string, status = 409): never {
  throw new AgentWorkflowError(code, message, status);
}

function positiveId(value: unknown, field: string): number {
  const parsed = typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    fail('agent_workflow_input_invalid', `${field} must be a positive integer.`, 400);
  }
  return parsed;
}

function requestId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) {
    fail('agent_workflow_input_invalid', 'requestId is required.', 400);
  }
  return value.trim();
}

function triggerKey(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 16 || value.trim().length > 200) {
    fail('agent_workflow_trigger_invalid', 'A trigger key of 16–200 characters is required.', 400);
  }
  return value.trim();
}

function actionReason(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > 1000) {
    fail('agent_workflow_reason_invalid', 'A reason of 3–1000 characters is required.', 400);
  }
  return value.trim();
}

function maxAttempts(value: unknown): number {
  if (value == null) return AGENT_WORKFLOW_MAX_ATTEMPTS;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 10) {
    fail('agent_workflow_attempts_invalid', 'maxAttempts must be between 1 and 10.', 400);
  }
  return parsed;
}

function workflowState(value: string): AgentWorkflowRunState {
  return value as AgentWorkflowRunState;
}

function stepState(value: string): AgentWorkflowStepState {
  return value as AgentWorkflowStepState;
}

function safeErrorCode(error: unknown): string {
  if (error instanceof AgentWorkflowError) return error.code;
  if (error instanceof CompanyReceiptPackError) return error.code;
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code);
    if (/^[a-z0-9_.:-]{3,120}$/i.test(code)) return code;
  }
  return 'agent_workflow_effect_failed';
}

function retryable(error: unknown): boolean {
  if (error instanceof AgentWorkflowError) return error.status >= 500;
  if (error instanceof CompanyReceiptPackError) return error.status >= 500;
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  return code === '40001' || code === '40P01' || code === 'ETIMEDOUT';
}

function backoff(now: Date, attempts: number): Date {
  return new Date(now.getTime() + Math.min(60 * 60 * 1000, 2 ** Math.min(attempts, 10) * 1000));
}

function scopeOf(row: { masterFn: string; companyFn: string }): Scope {
  return { masterFn: row.masterFn, companyFn: row.companyFn };
}

function viewStep(row: typeof agentWorkflowStep.$inferSelect): AgentWorkflowStepView {
  return {
    id: row.id,
    runId: row.runId,
    stepKey: row.stepKey as WorkflowStepKey,
    sequenceNo: row.sequenceNo,
    state: stepState(row.state),
    version: row.version,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    availableAt: row.availableAt,
    lockedAt: row.lockedAt,
    lockedBy: row.lockedBy,
    leaseExpiresAt: row.leaseExpiresAt,
    heartbeatAt: row.heartbeatAt,
    checkpoint: row.checkpoint,
    resultRef: row.resultRef,
    lastError: row.lastError,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function viewRun(
  row: typeof agentWorkflowRun.$inferSelect,
  steps: readonly (typeof agentWorkflowStep.$inferSelect)[] = [],
): AgentWorkflowRunView {
  return {
    id: row.id,
    masterFn: row.masterFn,
    companyFn: row.companyFn,
    workflowKey: row.workflowKey as typeof AGENT_WORKFLOW_KEY,
    agentPrincipalId: row.agentPrincipalId,
    actorUserId: row.actorUserId,
    intentId: row.intentId,
    state: workflowState(row.state),
    version: row.version,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    availableAt: row.availableAt,
    lockedAt: row.lockedAt,
    lockedBy: row.lockedBy,
    leaseExpiresAt: row.leaseExpiresAt,
    heartbeatAt: row.heartbeatAt,
    currentStepKey: row.currentStepKey as WorkflowStepKey | null,
    checkpoint: row.checkpoint,
    resultRef: row.resultRef,
    lastError: row.lastError,
    pauseRequestedAt: row.pauseRequestedAt,
    cancelRequestedAt: row.cancelRequestedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    steps: steps.map(viewStep),
  };
}

async function readRunRow(
  exec: DB,
  scope: Scope,
  runId: number,
  lock = false,
): Promise<typeof agentWorkflowRun.$inferSelect> {
  const query = exec.select().from(agentWorkflowRun).where(and(
    eq(agentWorkflowRun.id, runId),
    eq(agentWorkflowRun.masterFn, scope.masterFn),
    eq(agentWorkflowRun.companyFn, scope.companyFn),
  )).limit(1);
  const [row] = lock ? await query.for('update') : await query;
  if (!row) fail('agent_workflow_not_found', 'The durable Agent workflow is unavailable.', 404);
  return row;
}

async function readSteps(
  exec: DB,
  scope: Scope,
  runId: number,
  lock = false,
): Promise<(typeof agentWorkflowStep.$inferSelect)[]> {
  const query = exec.select().from(agentWorkflowStep).where(and(
    eq(agentWorkflowStep.runId, runId),
    eq(agentWorkflowStep.masterFn, scope.masterFn),
    eq(agentWorkflowStep.companyFn, scope.companyFn),
  )).orderBy(asc(agentWorkflowStep.sequenceNo));
  return lock ? query.for('update') : query;
}

async function readIntent(
  exec: DB,
  scope: Scope,
  intentId: number,
  lock = false,
): Promise<typeof agentExecutionIntent.$inferSelect> {
  const query = exec.select().from(agentExecutionIntent).where(and(
    eq(agentExecutionIntent.id, intentId),
    eq(agentExecutionIntent.masterFn, scope.masterFn),
    eq(agentExecutionIntent.companyFn, scope.companyFn),
  )).limit(1);
  const [row] = lock ? await query.for('update') : await query;
  if (!row) fail('agent_workflow_intent_not_found', 'The approved execution intent is unavailable.', 404);
  return row;
}

async function assertCurrentExecutionAuthority(
  exec: DB,
  scope: Scope,
  intent: IntentRow,
  now: Date,
  requireApproved = true,
): Promise<ResolvedAgentGrant> {
  if (!(await isModuleEnabled(exec, scope.masterFn, scope.companyFn, 'expenses_tax'))) {
    fail('agent_workflow_module_disabled', 'The expenses_tax module is not enabled for this Company.', 403);
  }
  if (requireApproved && intent.status !== 'approved' && intent.status !== 'consumed') {
    fail('agent_workflow_intent_not_approved', 'The execution intent is not approved for execution.', 428);
  }
  if (requireApproved && intent.status !== 'consumed' && intent.expiresAt <= now) {
    fail('agent_workflow_intent_expired', 'The execution intent has expired and cannot execute.', 410);
  }
  return resolveAgentGrantWithin(exec, scope, {
    agentPrincipalId: intent.agentPrincipalId,
    actionName: AGENT_WORKFLOW_KEY,
    now,
  });
}

async function appendWorkflowAudit(
  exec: DB,
  scope: Scope,
  run: typeof agentWorkflowRun.$inferSelect,
  actorUserId: number,
  requestIdValue: string,
  action: string,
  after?: Record<string, unknown>,
): Promise<void> {
  await appendAudit(exec, {
    ...scope,
    actorUserId,
    agentPrincipalId: run.agentPrincipalId,
    delegatorUserId: run.actorUserId,
    requestId: requestIdValue,
    entity: 'agent_workflow_run',
    entityId: run.id,
    action,
    after,
  });
}

async function releaseRun(
  exec: DB,
  run: typeof agentWorkflowRun.$inferSelect,
  now: Date,
  patch: Partial<typeof agentWorkflowRun.$inferInsert> = {},
) {
  const lockPredicate = run.lockedBy == null
    ? isNull(agentWorkflowRun.lockedBy)
    : eq(agentWorkflowRun.lockedBy, run.lockedBy);
  await exec.update(agentWorkflowRun).set({
    lockedAt: null,
    lockedBy: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    updatedAt: now,
    ...patch,
  }).where(and(
    eq(agentWorkflowRun.id, run.id),
    eq(agentWorkflowRun.masterFn, run.masterFn),
    eq(agentWorkflowRun.companyFn, run.companyFn),
    lockPredicate,
  ));
}

async function setTerminal(
  exec: DB,
  run: typeof agentWorkflowRun.$inferSelect,
  state: 'succeeded' | 'failed' | 'cancelled',
  now: Date,
  resultRef: Record<string, unknown> | null,
  lastError: string | null,
) {
  const lockPredicate = run.lockedBy == null
    ? isNull(agentWorkflowRun.lockedBy)
    : eq(agentWorkflowRun.lockedBy, run.lockedBy);
  await exec.update(agentWorkflowRun).set({
    state,
    resultRef,
    lastError,
    completedAt: now,
    updatedAt: now,
    lockedAt: null,
    lockedBy: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
  }).where(and(
    eq(agentWorkflowRun.id, run.id),
    eq(agentWorkflowRun.masterFn, run.masterFn),
    eq(agentWorkflowRun.companyFn, run.companyFn),
    lockPredicate,
  ));
  await exec.update(agentWorkflowStep).set({
    state: sql`case when ${agentWorkflowStep.state} in ('succeeded','failed','cancelled') then ${agentWorkflowStep.state} else ${state} end`,
    completedAt: sql`case when ${agentWorkflowStep.state} in ('succeeded','failed','cancelled') then ${agentWorkflowStep.completedAt} else ${now} end`,
    lockedAt: null,
    lockedBy: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    updatedAt: now,
  }).where(and(
    eq(agentWorkflowStep.runId, run.id),
    eq(agentWorkflowStep.masterFn, run.masterFn),
    eq(agentWorkflowStep.companyFn, run.companyFn),
    sql`${agentWorkflowStep.state} not in ('succeeded','failed','cancelled')`,
  ));
}

async function markIntentExpired(
  exec: DB,
  scope: Scope,
  intent: typeof agentExecutionIntent.$inferSelect,
  now: Date,
): Promise<void> {
  if (intent.status !== 'prepared' && intent.status !== 'approved') return;
  const [updated] = await exec.update(agentExecutionIntent).set({
    status: 'expired',
    decisionReason: 'expired',
    decidedAt: now,
    version: sql`${agentExecutionIntent.version} + 1`,
    updatedAt: now,
  }).where(and(
    eq(agentExecutionIntent.id, intent.id),
    eq(agentExecutionIntent.masterFn, scope.masterFn),
    eq(agentExecutionIntent.companyFn, scope.companyFn),
    eq(agentExecutionIntent.version, intent.version),
    inArray(agentExecutionIntent.status, ['prepared', 'approved']),
  )).returning();
  if (updated) {
    await appendAudit(exec, {
      ...scope,
      actorUserId: intent.actorUserId,
      agentPrincipalId: intent.agentPrincipalId,
      delegatorUserId: intent.actorUserId,
      requestId: `agent-workflow-expiry-${intent.id}`,
      entity: 'agent_execution_intent',
      entityId: intent.id,
      action: 'expired',
      before: { status: intent.status, version: intent.version },
      after: { status: updated.status, version: updated.version },
      occurredAt: now,
    });
  }
}

/** Queue one exact approved or approval-waiting Receipt Pack workflow. */
export async function queueReceiptPackWorkflowWithin(
  exec: DB,
  scope: Scope,
  input: QueueReceiptPackWorkflowInput,
  now = new Date(),
): Promise<{ workflow: AgentWorkflowRunView; replayed: boolean }> {
  const at = new Date(now);
  const intentId = positiveId(input.intentId, 'intentId');
  const principalId = positiveId(input.agentPrincipalId, 'agentPrincipalId');
  const actorUserId = positiveId(input.actorUserId, 'actorUserId');
  const request = requestId(input.requestId);
  const rawTrigger = triggerKey(input.triggerKey);
  if (request.includes(rawTrigger)) {
    fail('agent_workflow_secret_in_request_id', 'The trigger key must not be included in a request identifier.', 400);
  }
  const intent = await readIntent(exec, scope, intentId, true);
  if (intent.agentPrincipalId !== principalId || intent.actorUserId !== actorUserId) {
    fail('agent_workflow_identity_mismatch', 'The workflow intent belongs to a different Agent identity or actor.', 403);
  }
  if (!['prepared', 'approved'].includes(intent.status)) {
    fail('agent_workflow_intent_not_queueable', 'Only a prepared or approved execution intent may be queued.', 409);
  }
  if (intent.expiresAt <= at) {
    fail('agent_workflow_intent_expired', 'The execution intent has expired and cannot be queued.', 410);
  }
  await assertCurrentExecutionAuthority(exec, scope, {
    ...intent,
    visibility: intent.visibility,
  }, at, false);
  const hash = sha256(rawTrigger);
  const state: AgentWorkflowRunState = intent.status === 'approved' ? 'queued' : 'waiting_approval';
  const configuredMaxAttempts = maxAttempts(input.maxAttempts);
  const [created] = await exec.insert(agentWorkflowRun).values({
    ...scope,
    workflowKey: AGENT_WORKFLOW_KEY,
    agentPrincipalId: principalId,
    actorUserId,
    intentId,
    triggerKeyHash: hash,
    state,
    maxAttempts: configuredMaxAttempts,
    currentStepKey: state === 'waiting_approval' ? 'approval' : 'execute',
    checkpoint: {
      intentId,
      workflowKey: AGENT_WORKFLOW_KEY,
      reviewedSelectionDigest: intent.selectionDigest,
      reviewedPayloadDigest: intent.payloadDigest,
    },
    availableAt: at,
    createdAt: at,
    updatedAt: at,
  }).onConflictDoNothing({
    target: [
      agentWorkflowRun.masterFn,
      agentWorkflowRun.companyFn,
      agentWorkflowRun.agentPrincipalId,
      agentWorkflowRun.triggerKeyHash,
    ],
  }).returning();
  if (!created) {
    const [existing] = await exec.select().from(agentWorkflowRun).where(and(
      eq(agentWorkflowRun.masterFn, scope.masterFn),
      eq(agentWorkflowRun.companyFn, scope.companyFn),
      eq(agentWorkflowRun.agentPrincipalId, principalId),
      eq(agentWorkflowRun.triggerKeyHash, hash),
    )).limit(1);
    if (!existing) fail('agent_workflow_conflict_unresolved', 'The workflow trigger was claimed concurrently but is unavailable.', 409);
    if (existing.intentId !== intentId || existing.actorUserId !== actorUserId) {
      fail('agent_workflow_trigger_conflict', 'The trigger key is already bound to different reviewed facts.', 409);
    }
    const steps = await readSteps(exec, scope, existing.id);
    return { workflow: viewRun(existing, steps), replayed: true };
  }
  const stepRows = [
    { stepKey: 'approval' as const, sequenceNo: 1, state: state === 'waiting_approval' ? 'waiting_approval' : 'succeeded', completedAt: state === 'waiting_approval' ? null : at },
    { stepKey: 'execute' as const, sequenceNo: 2, state: 'queued' as const, completedAt: null },
    { stepKey: 'verify' as const, sequenceNo: 3, state: 'queued' as const, completedAt: null },
  ];
  await exec.insert(agentWorkflowStep).values(stepRows.map((step) => ({
    ...scope,
    runId: created.id,
    stepKey: step.stepKey,
    sequenceNo: step.sequenceNo,
    effectKeyHash: sha256(`${hash}:${step.stepKey}`),
    state: step.state,
    maxAttempts: configuredMaxAttempts,
    completedAt: step.completedAt,
    checkpoint: {
      runId: created.id,
      intentId,
      stepKey: step.stepKey,
    },
    createdAt: at,
    updatedAt: at,
  })));
  await appendWorkflowAudit(exec, scope, created, actorUserId, request, 'queued', {
    workflowKey: AGENT_WORKFLOW_KEY,
    intentId,
    triggerKeyHash: hash,
    state,
    reviewedSelectionDigest: intent.selectionDigest,
    reviewedPayloadDigest: intent.payloadDigest,
  });
  await exec.insert(outboxEvent).values({
    ...scope,
    topic: AGENT_WORKFLOW_TOPIC,
    aggregateType: 'agent_workflow_run',
    aggregateId: String(created.id),
    payload: { runId: created.id, triggerKeyHash: hash },
    availableAt: at,
    createdAt: at,
  }).onConflictDoNothing();
  const steps = await readSteps(exec, scope, created.id);
  return { workflow: viewRun(created, steps), replayed: false };
}

export function queueReceiptPackWorkflow(
  db: DB,
  scope: Scope,
  input: QueueReceiptPackWorkflowInput,
  now = new Date(),
) {
  return withTenantTransaction(db, scope, (tx) => queueReceiptPackWorkflowWithin(tx, scope, input, now));
}

export async function readReceiptPackWorkflowWithin(
  exec: DB,
  scope: Scope,
  runId: number,
  actorUserId?: number,
): Promise<AgentWorkflowRunView> {
  const run = await readRunRow(exec, scope, positiveId(runId, 'runId'));
  if (actorUserId != null && run.actorUserId !== positiveId(actorUserId, 'actorUserId')) {
    fail('agent_workflow_not_found', 'The durable Agent workflow is unavailable.', 404);
  }
  return viewRun(run, await readSteps(exec, scope, run.id));
}

export function readReceiptPackWorkflow(
  db: DB,
  scope: Scope,
  runId: number,
  actorUserId?: number,
) {
  return withTenantTransaction(db, scope, (tx) => readReceiptPackWorkflowWithin(tx, scope, runId, actorUserId));
}

async function updateAction(
  exec: DB,
  scope: Scope,
  input: AgentWorkflowRunActionInput,
  action: 'pause' | 'resume' | 'cancel',
  now: Date,
): Promise<AgentWorkflowRunView> {
  const runId = positiveId(input.runId, 'runId');
  const actorUserId = positiveId(input.actorUserId, 'actorUserId');
  const expectedVersion = positiveId(input.expectedVersion, 'expectedVersion');
  const reason = actionReason(input.reason);
  const request = requestId(input.requestId);
  const run = await readRunRow(exec, scope, runId, true);
  if (run.actorUserId !== actorUserId) fail('agent_workflow_actor_mismatch', 'Only the workflow actor may control this run.', 403);
  if (run.version !== expectedVersion) fail('agent_workflow_version_conflict', 'The workflow changed; reload before retrying.', 409);
  if (run.state === 'succeeded' || run.state === 'failed' || run.state === 'cancelled') {
    return viewRun(run, await readSteps(exec, scope, run.id));
  }
  const intent = await readIntent(exec, scope, run.intentId, true);
  if (action === 'pause') {
    if (run.state === 'paused') return viewRun(run, await readSteps(exec, scope, run.id));
    const nextStep = run.currentStepKey ?? 'execute';
    await exec.update(agentWorkflowRun).set({
      state: 'paused',
      currentStepKey: nextStep,
      pauseRequestedAt: now,
      version: sql`${agentWorkflowRun.version} + 1`,
      updatedAt: now,
      lockedAt: null,
      lockedBy: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
    }).where(and(
      eq(agentWorkflowRun.id, run.id),
      eq(agentWorkflowRun.version, expectedVersion),
    ));
    await exec.update(agentWorkflowStep).set({
      state: 'paused',
      lockedAt: null,
      lockedBy: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      updatedAt: now,
    }).where(and(
      eq(agentWorkflowStep.runId, run.id),
      sql`${agentWorkflowStep.state} in ('queued','waiting_approval','running')`,
    ));
    await appendWorkflowAudit(exec, scope, run, actorUserId, request, 'paused', { reason, intentId: intent.id });
  } else if (action === 'resume') {
    if (run.state !== 'paused') fail('agent_workflow_not_paused', 'Only a paused workflow may resume.', 409);
    if (intent.status === 'prepared') {
      await exec.update(agentWorkflowRun).set({
        state: 'waiting_approval',
        currentStepKey: 'approval',
        pauseRequestedAt: null,
        version: sql`${agentWorkflowRun.version} + 1`,
        availableAt: now,
        updatedAt: now,
      }).where(and(eq(agentWorkflowRun.id, run.id), eq(agentWorkflowRun.version, expectedVersion)));
    } else if (intent.status === 'approved' || intent.status === 'consumed') {
      await exec.update(agentWorkflowRun).set({
        state: 'queued',
        currentStepKey: 'execute',
        pauseRequestedAt: null,
        version: sql`${agentWorkflowRun.version} + 1`,
        availableAt: now,
        updatedAt: now,
      }).where(and(eq(agentWorkflowRun.id, run.id), eq(agentWorkflowRun.version, expectedVersion)));
    } else if (intent.expiresAt <= now) {
      await markIntentExpired(exec, scope, intent, now);
      await setTerminal(exec, run, 'failed', now, null, 'agent_workflow_intent_expired');
    } else {
      await setTerminal(exec, run, 'cancelled', now, null, 'agent_workflow_intent_not_approved');
    }
    await appendWorkflowAudit(exec, scope, run, actorUserId, request, 'resumed', { reason, intentStatus: intent.status });
  } else {
    const filters = normalizeCompanyReceiptPackFilters(intent.filters);
    const visibility = intent.visibility === 'company' ? 'company' : 'own';
    const locale = normalizeCompanyReceiptPackLocale(intent.locale);
    const existing = ['approved', 'consumed', 'cancelled'].includes(intent.status)
      ? await readCompanyReceiptPackByKeyWithin(exec, scope, actorUserId, visibility, {
        packKey: intent.packKey,
        locale,
        filters,
      })
      : null;
    if (existing) {
      await setTerminal(exec, run, 'succeeded', now, {
        packId: existing.pack.id,
        packSourceSha256: existing.pack.sourceSha256,
        replayed: true,
      }, null);
    } else if (run.state === 'running') {
      await exec.update(agentWorkflowRun).set({
        cancelRequestedAt: now,
        version: sql`${agentWorkflowRun.version} + 1`,
        updatedAt: now,
      }).where(and(eq(agentWorkflowRun.id, run.id), eq(agentWorkflowRun.version, expectedVersion)));
    } else {
      await setTerminal(exec, run, 'cancelled', now, null, null);
    }
    await appendWorkflowAudit(exec, scope, run, actorUserId, request, 'cancel_requested', {
      reason,
      intentId: intent.id,
      reconciledPack: Boolean(existing),
    });
  }
  return readReceiptPackWorkflowWithin(exec, scope, run.id, actorUserId);
}

export function pauseReceiptPackWorkflowWithin(
  exec: DB,
  scope: Scope,
  input: AgentWorkflowRunActionInput,
  now = new Date(),
) {
  return updateAction(exec, scope, input, 'pause', now);
}

export function resumeReceiptPackWorkflowWithin(
  exec: DB,
  scope: Scope,
  input: AgentWorkflowRunActionInput,
  now = new Date(),
) {
  return updateAction(exec, scope, input, 'resume', now);
}

export function cancelReceiptPackWorkflowWithin(
  exec: DB,
  scope: Scope,
  input: AgentWorkflowRunActionInput,
  now = new Date(),
) {
  return updateAction(exec, scope, input, 'cancel', now);
}

export function pauseReceiptPackWorkflow(db: DB, scope: Scope, input: AgentWorkflowRunActionInput, now = new Date()) {
  return withTenantTransaction(db, scope, (tx) => pauseReceiptPackWorkflowWithin(tx, scope, input, now));
}

export function resumeReceiptPackWorkflow(db: DB, scope: Scope, input: AgentWorkflowRunActionInput, now = new Date()) {
  return withTenantTransaction(db, scope, (tx) => resumeReceiptPackWorkflowWithin(tx, scope, input, now));
}

export function cancelReceiptPackWorkflow(db: DB, scope: Scope, input: AgentWorkflowRunActionInput, now = new Date()) {
  return withTenantTransaction(db, scope, (tx) => cancelReceiptPackWorkflowWithin(tx, scope, input, now));
}

/** Claim explicit workflow trigger events. Delivery is separate from effect execution. */
async function claimSignals(db: DB, workerId: string, now: Date, batchSize: number, leaseMs: number) {
  return withAgentWorkerTransaction(db, async (tx) => {
    const expired = new Date(now.getTime() - leaseMs);
    const rows = await tx.select().from(outboxEvent).where(and(
      eq(outboxEvent.topic, AGENT_WORKFLOW_TOPIC),
      isNull(outboxEvent.deliveredAt),
      isNull(outboxEvent.deadLetteredAt),
      lte(outboxEvent.availableAt, now),
      or(isNull(outboxEvent.lockedAt), lt(outboxEvent.lockedAt, expired)),
    )).orderBy(asc(outboxEvent.id)).limit(batchSize).for('update', { skipLocked: true });
    if (!rows.length) return rows;
    await tx.update(outboxEvent).set({
      lockedAt: now,
      lockedBy: workerId,
      lastAttemptAt: now,
      attempts: sql`${outboxEvent.attempts} + 1`,
    }).where(inArray(outboxEvent.id, rows.map((row) => row.id)));
    return rows;
  });
}

async function finishSignal(
  db: DB,
  row: typeof outboxEvent.$inferSelect,
  workerId: string,
  now: Date,
  ok: boolean,
  maxAttempts: number,
): Promise<boolean> {
  if (ok) {
    await withAgentWorkerTransaction(db, (tx) => tx.update(outboxEvent).set({
      deliveredAt: now,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    }).where(and(eq(outboxEvent.id, row.id), eq(outboxEvent.lockedBy, workerId), isNull(outboxEvent.deliveredAt))));
    return true;
  }
  const attempt = row.attempts + 1;
  const terminal = attempt >= maxAttempts;
  await withAgentWorkerTransaction(db, (tx) => tx.update(outboxEvent).set({
    lockedAt: null,
    lockedBy: null,
    availableAt: terminal ? now : backoff(now, attempt),
    deadLetteredAt: terminal ? now : null,
    lastError: 'agent_workflow_signal_invalid',
  }).where(and(eq(outboxEvent.id, row.id), eq(outboxEvent.lockedBy, workerId), isNull(outboxEvent.deliveredAt))));
  return false;
}

/** Claim tenant runs with bounded leases. Waiting approval runs are polled without consuming attempts. */
async function claimRuns(db: DB, workerId: string, now: Date, batchSize: number, leaseMs: number) {
  return withAgentWorkerTransaction(db, async (tx) => {
    const rows = await tx.select().from(agentWorkflowRun).where(and(
      inArray(agentWorkflowRun.state, ['queued', 'waiting_approval', 'running']),
      lte(agentWorkflowRun.availableAt, now),
      lt(agentWorkflowRun.attempts, agentWorkflowRun.maxAttempts),
      or(isNull(agentWorkflowRun.leaseExpiresAt), lt(agentWorkflowRun.leaseExpiresAt, now)),
    )).orderBy(asc(agentWorkflowRun.id)).limit(batchSize).for('update', { skipLocked: true });
    if (!rows.length) return rows;
    await tx.update(agentWorkflowRun).set({
      lockedAt: now,
      lockedBy: workerId,
      leaseExpiresAt: new Date(now.getTime() + leaseMs),
      heartbeatAt: now,
      updatedAt: now,
    }).where(inArray(agentWorkflowRun.id, rows.map((row) => row.id)));
    return rows;
  });
}

async function reconcilePack(
  tx: DB,
  scope: Scope,
  run: typeof agentWorkflowRun.$inferSelect,
  intent: typeof agentExecutionIntent.$inferSelect,
  now: Date,
  request: string,
) {
  if (!['approved', 'consumed', 'cancelled'].includes(intent.status)) return null;
  const visibility = intent.visibility === 'company' ? 'company' : 'own';
  const filters = normalizeCompanyReceiptPackFilters(intent.filters);
  const locale = normalizeCompanyReceiptPackLocale(intent.locale);
  const existing = await readCompanyReceiptPackByKeyWithin(tx, scope, run.actorUserId, visibility, {
    packKey: intent.packKey,
    locale,
    filters,
  });
  if (!existing) return null;
  const rendered = await renderCompanyReceiptPackWithin(
    tx,
    scope,
    run.actorUserId,
    visibility,
    existing.pack.id,
    'view',
  );
  const resultRef = {
    packId: existing.pack.id,
    packSourceSha256: existing.pack.sourceSha256,
    artifactSha256: rendered.sha256,
    artifactByteLength: rendered.content.byteLength,
    accessPurpose: rendered.accessPurpose,
    replayed: true,
  };
  await setTerminal(tx, run, 'succeeded', now, resultRef, null);
  await appendWorkflowAudit(tx, scope, run, run.actorUserId, request, 'reconciled', resultRef);
  return resultRef;
}

async function processRun(
  db: DB,
  claimed: typeof agentWorkflowRun.$inferSelect,
  workerId: string,
  now: Date,
): Promise<'succeeded' | 'failed' | 'cancelled' | 'paused' | 'waiting_approval' | 'retried' | 'noop'> {
  const scope = scopeOf(claimed);
  return withAgentWorkerTenantTransaction(db, scope, async (tx) => {
    const run = await readRunRow(tx, scope, claimed.id, true);
    if (run.lockedBy !== workerId) return 'noop';
    const request = `agent-workflow-${run.id}-${run.attempts + 1}`;
    const intent = await readIntent(tx, scope, run.intentId, true);
    if (run.state === 'succeeded' || run.state === 'failed' || run.state === 'cancelled') {
      await releaseRun(tx, run, now);
      return run.state;
    }
    if (run.cancelRequestedAt) {
      const reconciled = await reconcilePack(tx, scope, run, intent, now, request);
      if (reconciled) return 'succeeded';
      if (run.state !== 'running') {
        await setTerminal(tx, run, 'cancelled', now, null, null);
        await appendWorkflowAudit(tx, scope, run, run.actorUserId, request, 'cancelled', { reason: 'cancel_requested' });
        return 'cancelled';
      }
      // This worker has no unbounded external side effect between the Pack
      // transaction and the checkpoint update. Once an expired lease is
      // reclaimed, absence of the immutable Pack proves cancellation is safe.
      await setTerminal(tx, run, 'cancelled', now, null, null);
      await appendWorkflowAudit(tx, scope, run, run.actorUserId, request, 'cancelled', { reason: 'cancel_requested_after_lease' });
      return 'cancelled';
    }
    if (run.pauseRequestedAt || run.state === 'paused') {
      await execUpdatePaused(tx, run, now);
      return 'paused';
    }
    if (intent.expiresAt <= now && intent.status !== 'consumed') {
      await markIntentExpired(tx, scope, intent, now);
      await setTerminal(tx, run, 'failed', now, null, 'agent_workflow_intent_expired');
      await appendWorkflowAudit(tx, scope, run, run.actorUserId, request, 'failed', { code: 'agent_workflow_intent_expired' });
      return 'failed';
    }
    if (run.state === 'waiting_approval' || intent.status === 'prepared') {
      if (intent.status === 'prepared') {
        const stepRows = await readSteps(tx, scope, run.id, true);
        const approval = stepRows.find((step) => step.stepKey === 'approval');
        if (approval) await tx.update(agentWorkflowStep).set({ state: 'waiting_approval', updatedAt: now }).where(eq(agentWorkflowStep.id, approval.id));
        await releaseRun(tx, run, now, {
          state: 'waiting_approval',
          currentStepKey: 'approval',
          availableAt: new Date(now.getTime() + AGENT_WORKFLOW_POLL_MS),
        });
        return 'waiting_approval';
      }
      if (intent.status === 'rejected' || intent.status === 'cancelled' || intent.status === 'expired') {
        await setTerminal(tx, run, 'cancelled', now, null, `agent_workflow_intent_${intent.status}`);
        return 'cancelled';
      }
      const approval = (await readSteps(tx, scope, run.id, true)).find((step) => step.stepKey === 'approval');
      if (approval) await tx.update(agentWorkflowStep).set({ state: 'succeeded', completedAt: now, updatedAt: now }).where(eq(agentWorkflowStep.id, approval.id));
      await tx.update(agentWorkflowRun).set({ state: 'queued', currentStepKey: 'execute', availableAt: now, version: sql`${agentWorkflowRun.version} + 1`, updatedAt: now }).where(eq(agentWorkflowRun.id, run.id));
    }
    const refreshed = await readRunRow(tx, scope, run.id, true);
    const latestIntent = await readIntent(tx, scope, refreshed.intentId, true);
    const reconciled = await reconcilePack(tx, scope, refreshed, latestIntent, now, request);
    if (reconciled) return 'succeeded';
    if (latestIntent.status !== 'approved' && latestIntent.status !== 'consumed') {
      await releaseRun(tx, refreshed, now, { state: 'waiting_approval', currentStepKey: 'approval', availableAt: new Date(now.getTime() + AGENT_WORKFLOW_POLL_MS) });
      return 'waiting_approval';
    }
    try {
      await assertCurrentExecutionAuthority(tx, scope, latestIntent, now);
      const nextAttempt = refreshed.attempts + 1;
      if (nextAttempt > refreshed.maxAttempts) {
        await setTerminal(tx, refreshed, 'failed', now, null, 'agent_workflow_attempts_exhausted');
        return 'failed';
      }
      const steps = await readSteps(tx, scope, refreshed.id, true);
      const executeStep = steps.find((step) => step.stepKey === 'execute');
      if (!executeStep) fail('agent_workflow_step_missing', 'The execute workflow step is unavailable.', 500);
      await tx.update(agentWorkflowRun).set({
        state: 'running',
        currentStepKey: 'execute',
        attempts: nextAttempt,
        heartbeatAt: now,
        version: sql`${agentWorkflowRun.version} + 1`,
        updatedAt: now,
      }).where(eq(agentWorkflowRun.id, refreshed.id));
      await tx.update(agentWorkflowStep).set({
        state: 'running',
        attempts: sql`${agentWorkflowStep.attempts} + 1`,
        startedAt: executeStep.startedAt ?? now,
        heartbeatAt: now,
        updatedAt: now,
      }).where(eq(agentWorkflowStep.id, executeStep.id));
      const executed = await executeStoredAgentReceiptPackWithin(tx, scope, {
        intentId: latestIntent.id,
        agentPrincipalId: latestIntent.agentPrincipalId,
        actorUserId: latestIntent.actorUserId,
        requestId: request,
      }, now);
      await appendWorkflowAudit(tx, scope, refreshed, refreshed.actorUserId, request, executed.replayed ? 'effect_replayed' : 'effect_committed', {
        intentId: executed.intent.id,
        packId: executed.pack.id,
        packSourceSha256: executed.pack.sourceSha256,
        replayed: executed.replayed,
      });
      const rendered = await renderCompanyReceiptPackWithin(
        tx,
        scope,
        refreshed.actorUserId,
        latestIntent.visibility === 'company' ? 'company' : 'own',
        executed.pack.id,
        'view',
      );
      const resultRef = {
        packId: executed.pack.id,
        packSourceSha256: executed.pack.sourceSha256,
        artifactSha256: rendered.sha256,
        artifactByteLength: rendered.content.byteLength,
        accessPurpose: rendered.accessPurpose,
        replayed: executed.replayed,
      };
      await tx.update(agentWorkflowStep).set({
        state: 'succeeded',
        resultRef: { packId: executed.pack.id, packSourceSha256: executed.pack.sourceSha256, replayed: executed.replayed },
        completedAt: now,
        lockedAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        updatedAt: now,
      }).where(eq(agentWorkflowStep.id, executeStep.id));
      const verifyStep = steps.find((step) => step.stepKey === 'verify');
      if (verifyStep) await tx.update(agentWorkflowStep).set({
        state: 'succeeded',
        resultRef,
        completedAt: now,
        lockedAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        updatedAt: now,
      }).where(eq(agentWorkflowStep.id, verifyStep.id));
      await setTerminal(tx, refreshed, 'succeeded', now, resultRef, null);
      return 'succeeded';
    } catch (error) {
      const code = safeErrorCode(error);
      const nextAttempt = refreshed.attempts + 1;
      const canRetry = retryable(error) && nextAttempt < refreshed.maxAttempts;
      const executeStep = (await readSteps(tx, scope, refreshed.id, true)).find((step) => step.stepKey === 'execute');
      if (executeStep) await tx.update(agentWorkflowStep).set({
        state: canRetry ? 'queued' : 'failed',
        lastError: code,
        completedAt: canRetry ? null : now,
        lockedAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        availableAt: canRetry ? backoff(now, nextAttempt) : now,
        updatedAt: now,
      }).where(eq(agentWorkflowStep.id, executeStep.id));
      if (canRetry) {
        await releaseRun(tx, refreshed, now, {
          state: 'queued',
          availableAt: backoff(now, nextAttempt),
          lastError: code,
          currentStepKey: 'execute',
        });
        return 'retried';
      }
      await setTerminal(tx, refreshed, 'failed', now, null, code);
      await appendWorkflowAudit(tx, scope, refreshed, refreshed.actorUserId, request, 'failed', { code, attempts: nextAttempt });
      return 'failed';
    }
  });
}

async function execUpdatePaused(tx: DB, run: typeof agentWorkflowRun.$inferSelect, now: Date) {
  await tx.update(agentWorkflowRun).set({
    state: 'paused',
    lockedAt: null,
    lockedBy: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    updatedAt: now,
  }).where(eq(agentWorkflowRun.id, run.id));
  await tx.update(agentWorkflowStep).set({
    state: sql`case when ${agentWorkflowStep.state} in ('succeeded','failed','cancelled') then ${agentWorkflowStep.state} else 'paused' end`,
    lockedAt: null,
    lockedBy: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    updatedAt: now,
  }).where(and(eq(agentWorkflowStep.runId, run.id), sql`${agentWorkflowStep.state} not in ('succeeded','failed','cancelled')`));
}

/** Process durable Receipt Pack trigger events and leased runs. */
export async function processAgentWorkflowBatch(
  db: DB,
  options: WorkerOptions = {},
): Promise<AgentWorkflowBatchResult> {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `agent-workflow-${randomUUID()}`;
  const batchSize = Math.min(Math.max(options.batchSize ?? 10, 1), 50);
  const leaseMs = options.leaseMs ?? AGENT_WORKFLOW_LEASE_MS;
  const maxAttemptValue = maxAttempts(options.maxAttempts);
  const signals = await claimSignals(db, workerId, now, batchSize, leaseMs);
  let signalsDelivered = 0;
  let signalsFailed = 0;
  for (const signal of signals) {
    const payload = signal.payload && typeof signal.payload === 'object' && !Array.isArray(signal.payload)
      ? signal.payload as Record<string, unknown>
      : null;
    const runId = payload && Number.isSafeInteger(payload.runId) ? Number(payload.runId) : NaN;
    const valid = Number.isSafeInteger(runId) && runId > 0 && signal.aggregateType === 'agent_workflow_run'
      && signal.aggregateId === String(runId);
    if (valid) {
      const [run] = await withAgentWorkerTransaction(db, (tx) => tx.select({ id: agentWorkflowRun.id }).from(agentWorkflowRun).where(eq(agentWorkflowRun.id, runId)).limit(1));
      const ok = Boolean(run);
      if (await finishSignal(db, signal, workerId, now, ok, maxAttemptValue)) signalsDelivered += 1;
      else signalsFailed += 1;
    } else {
      if (await finishSignal(db, signal, workerId, now, false, maxAttemptValue)) signalsDelivered += 1;
      else signalsFailed += 1;
    }
  }
  const runs = await claimRuns(db, workerId, now, batchSize, leaseMs);
  let succeeded = 0;
  let failed = 0;
  let cancelled = 0;
  let paused = 0;
  let waitingApproval = 0;
  let retried = 0;
  for (const run of runs) {
    const state = await processRun(db, run, workerId, now);
    if (state === 'succeeded') succeeded += 1;
    else if (state === 'failed') failed += 1;
    else if (state === 'cancelled') cancelled += 1;
    else if (state === 'paused') paused += 1;
    else if (state === 'waiting_approval') waitingApproval += 1;
    else if (state === 'retried') retried += 1;
  }
  return {
    signalsClaimed: signals.length,
    signalsDelivered,
    signalsFailed,
    runsClaimed: runs.length,
    succeeded,
    failed,
    cancelled,
    paused,
    waitingApproval,
    retried,
    deadLettered: signalsFailed,
  };
}

/** Heartbeat an owned run without extending another worker's lease. */
export async function heartbeatAgentWorkflowRunWithin(
  exec: DB,
  scope: Scope,
  runId: number,
  workerId: string,
  now = new Date(),
  leaseMs = AGENT_WORKFLOW_LEASE_MS,
): Promise<boolean> {
  const [updated] = await exec.update(agentWorkflowRun).set({
    heartbeatAt: now,
    leaseExpiresAt: new Date(now.getTime() + leaseMs),
    updatedAt: now,
  }).where(and(
    eq(agentWorkflowRun.id, positiveId(runId, 'runId')),
    eq(agentWorkflowRun.masterFn, scope.masterFn),
    eq(agentWorkflowRun.companyFn, scope.companyFn),
    eq(agentWorkflowRun.lockedBy, workerId),
    sql`${agentWorkflowRun.state} in ('queued','running','waiting_approval')`,
  )).returning({ id: agentWorkflowRun.id });
  return Boolean(updated);
}

export async function withAgentWorkflowWorkerTenant<T>(
  db: DB,
  scope: Scope,
  command: (tx: DB) => Promise<T>,
): Promise<T> {
  return withAgentWorkerTenantTransaction(db, scope, command);
}
