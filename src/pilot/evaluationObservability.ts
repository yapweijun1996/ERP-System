import { createHash } from 'node:crypto';

/** Versioned shape for redacted Receipt Pilot run reports. */
export const RECEIPT_PILOT_OBSERVABILITY_VERSION = 'receipt-pilot-observability-2026-09-13.v1' as const;

export type ReceiptPilotEvidenceClass =
  | 'deterministic_fixture'
  | 'model_evaluation'
  | 'demo'
  | 'production';

export type ReceiptPilotEnvironment = 'local_fixture' | 'local_ci' | 'local_provider' | 'demo' | 'production';
export type ReceiptPilotApprovalState = 'approved' | 'not_required' | 'rejected';
export type ReceiptPilotBudgetState = 'approved' | 'pending';
export type ReceiptPilotResourceKind = 'receipt' | 'pack' | 'artifact';

export interface ReceiptPilotVersions {
  readonly fixture: string;
  readonly model: string;
  readonly prompt: string;
  readonly tool: string;
}

export interface ReceiptPilotCorrelation {
  readonly run: string;
  readonly request: string;
  readonly grant: string;
  readonly approval: string | null;
  readonly tool: string;
  readonly database: string;
  readonly artifact: string | null;
}

export interface ReceiptPilotApproval {
  readonly state: ReceiptPilotApprovalState;
  readonly reference: string | null;
}

export interface ReceiptPilotResourcePostcondition {
  readonly kind: ReceiptPilotResourceKind;
  readonly identifier: string;
  readonly version: number;
  readonly state: 'verified' | 'absent';
}

export interface ReceiptPilotRunMetrics {
  readonly elapsedMs: number;
  readonly providerDurationMs: number;
  readonly p95LatencyMs: number;
  readonly providerCalls: number;
  readonly retries: number;
  readonly spentCostMicros: number;
  /** Retained reservations cover attempts whose final provider cost is unknown. */
  readonly reservedCostMicros: number;
  /** Conservative full retry cost: max(known spend, retained reservations). */
  readonly fullRetryCostMicros: number;
  readonly maxObservedConcurrency: number;
}

export interface ReceiptPilotBudget {
  readonly state: ReceiptPilotBudgetState;
  readonly owner: string;
  readonly p95LatencyMs: number | null;
  readonly maxCostMicros: number | null;
  readonly maxProviderCalls: number | null;
  readonly maxConcurrency: number | null;
  readonly reference: string | null;
}

export interface ReceiptPilotObservabilityReport {
  readonly schemaVersion: typeof RECEIPT_PILOT_OBSERVABILITY_VERSION;
  readonly evidenceClass: ReceiptPilotEvidenceClass;
  readonly environment: ReceiptPilotEnvironment;
  readonly generatedAt: string;
  readonly versions: ReceiptPilotVersions;
  readonly correlation: ReceiptPilotCorrelation;
  readonly approval: ReceiptPilotApproval;
  readonly resourcePostconditions: readonly ReceiptPilotResourcePostcondition[];
  readonly metrics: ReceiptPilotRunMetrics;
  readonly budget: ReceiptPilotBudget;
}

export interface ReceiptPilotObservabilityInput {
  readonly evidenceClass: ReceiptPilotEvidenceClass;
  readonly environment: ReceiptPilotEnvironment;
  readonly generatedAt?: string;
  readonly versions: ReceiptPilotVersions;
  readonly correlation: {
    readonly run: string;
    readonly request: string;
    readonly grant: string;
    readonly approval?: string | null;
    readonly tool: string;
    readonly database: string;
    readonly artifact?: string | null;
  };
  readonly approval: {
    readonly state: ReceiptPilotApprovalState;
    readonly reference?: string | null;
  };
  readonly resourcePostconditions: readonly (Omit<ReceiptPilotResourcePostcondition, 'identifier'> & {
    readonly identifier: string;
  })[];
  readonly metrics: Omit<ReceiptPilotRunMetrics, 'fullRetryCostMicros'>;
  readonly budget: Omit<ReceiptPilotBudget, 'reference'> & { readonly reference?: string | null };
}

const REDACTED_IDENTIFIER = /^sha256:[a-f0-9]{64}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FORBIDDEN_KEY = /(?:master|company|tenant|secret|token|password|credential|payload|raw|content|email|phone)/i;
const EVIDENCE_CLASSES = new Set<ReceiptPilotEvidenceClass>([
  'deterministic_fixture', 'model_evaluation', 'demo', 'production',
]);
const ENVIRONMENTS = new Set<ReceiptPilotEnvironment>([
  'local_fixture', 'local_ci', 'local_provider', 'demo', 'production',
]);

function assertCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(`receipt_pilot_observability_invalid:${code}`);
}

function nonNegativeInteger(value: unknown, code: string): asserts value is number {
  assertCondition(Number.isSafeInteger(value) && (value as number) >= 0, code);
}

function positiveInteger(value: unknown, code: string): asserts value is number {
  assertCondition(Number.isSafeInteger(value) && (value as number) > 0, code);
}

function boundedString(value: unknown, code: string): asserts value is string {
  assertCondition(typeof value === 'string' && value.length > 0 && value.length <= 160, code);
}

function redacted(value: unknown, code: string): asserts value is string {
  assertCondition(typeof value === 'string' && REDACTED_IDENTIFIER.test(value), code);
}

function optionalRedacted(value: unknown, code: string): void {
  assertCondition(value === null || (typeof value === 'string' && REDACTED_IDENTIFIER.test(value)), code);
}

function walkKeys(value: unknown, path = '$'): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assertCondition(!FORBIDDEN_KEY.test(key), `forbidden_field:${path}.${key}`);
    walkKeys(child, `${path}.${key}`);
  }
}

function validateVersions(value: unknown): asserts value is ReceiptPilotVersions {
  assertCondition(value && typeof value === 'object' && !Array.isArray(value), 'versions_object');
  const versions = value as Record<string, unknown>;
  for (const key of ['fixture', 'model', 'prompt', 'tool']) {
    assertCondition(typeof versions[key] === 'string' && VERSION.test(versions[key]), `version:${key}`);
  }
  assertCondition(Object.keys(versions).every((key) => ['fixture', 'model', 'prompt', 'tool'].includes(key)), 'versions_keys');
}

function validateCorrelation(value: unknown): asserts value is ReceiptPilotCorrelation {
  assertCondition(value && typeof value === 'object' && !Array.isArray(value), 'correlation_object');
  const correlation = value as Record<string, unknown>;
  redacted(correlation.run, 'correlation_run_redaction');
  redacted(correlation.request, 'correlation_request_redaction');
  redacted(correlation.grant, 'correlation_grant_redaction');
  optionalRedacted(correlation.approval, 'correlation_approval_redaction');
  redacted(correlation.tool, 'correlation_tool_redaction');
  redacted(correlation.database, 'correlation_database_redaction');
  optionalRedacted(correlation.artifact, 'correlation_artifact_redaction');
  assertCondition(Object.keys(correlation).every((key) => [
    'run', 'request', 'grant', 'approval', 'tool', 'database', 'artifact',
  ].includes(key)), 'correlation_keys');
}

function validateApproval(value: unknown): asserts value is ReceiptPilotApproval {
  assertCondition(value && typeof value === 'object' && !Array.isArray(value), 'approval_object');
  const approval = value as Record<string, unknown>;
  assertCondition(approval.state === 'approved' || approval.state === 'not_required' || approval.state === 'rejected', 'approval_state');
  optionalRedacted(approval.reference, 'approval_reference_redaction');
  if (approval.state === 'approved') redacted(approval.reference, 'approval_reference_required');
  if (approval.state === 'not_required') assertCondition(approval.reference === null, 'approval_reference_not_required');
  assertCondition(Object.keys(approval).every((key) => ['state', 'reference'].includes(key)), 'approval_keys');
}

function validatePostconditions(value: unknown): asserts value is readonly ReceiptPilotResourcePostcondition[] {
  assertCondition(Array.isArray(value) && value.length > 0, 'postconditions_array');
  value.forEach((entry, index) => {
    assertCondition(entry && typeof entry === 'object' && !Array.isArray(entry), `postcondition_object:${index}`);
    const postcondition = entry as Record<string, unknown>;
    assertCondition(postcondition.kind === 'receipt' || postcondition.kind === 'pack' || postcondition.kind === 'artifact', `postcondition_kind:${index}`);
    redacted(postcondition.identifier, `postcondition_identifier:${index}`);
    positiveInteger(postcondition.version, `postcondition_version:${index}`);
    assertCondition(postcondition.state === 'verified' || postcondition.state === 'absent', `postcondition_state:${index}`);
    assertCondition(Object.keys(postcondition).every((key) => ['kind', 'identifier', 'version', 'state'].includes(key)), `postcondition_keys:${index}`);
  });
}

function validateMetrics(value: unknown): asserts value is ReceiptPilotRunMetrics {
  assertCondition(value && typeof value === 'object' && !Array.isArray(value), 'metrics_object');
  const metrics = value as Record<string, unknown>;
  for (const key of [
    'elapsedMs', 'providerDurationMs', 'p95LatencyMs', 'providerCalls', 'retries',
    'spentCostMicros', 'reservedCostMicros', 'fullRetryCostMicros', 'maxObservedConcurrency',
  ]) nonNegativeInteger(metrics[key], `metric:${key}`);
  assertCondition((metrics.retries as number) <= (metrics.providerCalls as number), 'metric_retries_exceed_calls');
  assertCondition((metrics.providerDurationMs as number) <= (metrics.elapsedMs as number), 'metric_provider_duration_exceeds_elapsed');
  assertCondition((metrics.fullRetryCostMicros as number)
    === Math.max(metrics.spentCostMicros as number, metrics.reservedCostMicros as number), 'metric_full_retry_cost');
  assertCondition((metrics.maxObservedConcurrency as number) > 0, 'metric_concurrency');
  assertCondition(Object.keys(metrics).every((key) => [
    'elapsedMs', 'providerDurationMs', 'p95LatencyMs', 'providerCalls', 'retries',
    'spentCostMicros', 'reservedCostMicros', 'fullRetryCostMicros', 'maxObservedConcurrency',
  ].includes(key)), 'metrics_keys');
}

function validateBudget(value: unknown): asserts value is ReceiptPilotBudget {
  assertCondition(value && typeof value === 'object' && !Array.isArray(value), 'budget_object');
  const budget = value as Record<string, unknown>;
  assertCondition(budget.state === 'approved' || budget.state === 'pending', 'budget_state');
  boundedString(budget.owner, 'budget_owner');
  optionalRedacted(budget.reference, 'budget_reference_redaction');
  for (const key of ['p95LatencyMs', 'maxCostMicros', 'maxProviderCalls', 'maxConcurrency']) {
    const threshold = budget[key];
    if (threshold !== null) positiveInteger(threshold, `budget:${key}`);
  }
  if (budget.state === 'approved') {
    redacted(budget.reference, 'budget_reference_required');
    for (const key of ['p95LatencyMs', 'maxCostMicros', 'maxProviderCalls', 'maxConcurrency']) {
      assertCondition(budget[key] !== null, `budget:${key}_required`);
    }
  }
  assertCondition(Object.keys(budget).every((key) => [
    'state', 'owner', 'p95LatencyMs', 'maxCostMicros', 'maxProviderCalls', 'maxConcurrency', 'reference',
  ].includes(key)), 'budget_keys');
}

/** Hash a bounded correlation or resource identifier before it is persisted. */
export function redactReceiptPilotIdentifier(value: string): string {
  boundedString(value, 'identifier');
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

/** Build a report while ensuring raw correlation/resource IDs never enter it. */
export function createReceiptPilotObservabilityReport(
  input: ReceiptPilotObservabilityInput,
): ReceiptPilotObservabilityReport {
  const report: ReceiptPilotObservabilityReport = {
    schemaVersion: RECEIPT_PILOT_OBSERVABILITY_VERSION,
    evidenceClass: input.evidenceClass,
    environment: input.environment,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    versions: input.versions,
    correlation: {
      run: redactReceiptPilotIdentifier(input.correlation.run),
      request: redactReceiptPilotIdentifier(input.correlation.request),
      grant: redactReceiptPilotIdentifier(input.correlation.grant),
      approval: input.correlation.approval == null ? null : redactReceiptPilotIdentifier(input.correlation.approval),
      tool: redactReceiptPilotIdentifier(input.correlation.tool),
      database: redactReceiptPilotIdentifier(input.correlation.database),
      artifact: input.correlation.artifact == null ? null : redactReceiptPilotIdentifier(input.correlation.artifact),
    },
    approval: {
      state: input.approval.state,
      reference: input.approval.reference == null ? null : redactReceiptPilotIdentifier(input.approval.reference),
    },
    resourcePostconditions: input.resourcePostconditions.map((postcondition) => ({
      ...postcondition,
      identifier: redactReceiptPilotIdentifier(postcondition.identifier),
    })),
    metrics: {
      ...input.metrics,
      fullRetryCostMicros: Math.max(input.metrics.spentCostMicros, input.metrics.reservedCostMicros),
    },
    budget: {
      ...input.budget,
      reference: input.budget.reference == null ? null : redactReceiptPilotIdentifier(input.budget.reference),
    },
  };
  validateReceiptPilotObservabilityReport(report);
  return report;
}

export interface ReceiptPilotObservabilityValidation {
  readonly budgetReady: boolean;
  readonly withinBudget: boolean;
}

/** Validate the persisted report shape and return release-budget readiness. */
export function validateReceiptPilotObservabilityReport(
  value: unknown,
): ReceiptPilotObservabilityValidation {
  assertCondition(value && typeof value === 'object' && !Array.isArray(value), 'report_object');
  const report = value as Record<string, unknown>;
  assertCondition(report.schemaVersion === RECEIPT_PILOT_OBSERVABILITY_VERSION, 'schema_version');
  assertCondition(EVIDENCE_CLASSES.has(report.evidenceClass as ReceiptPilotEvidenceClass), 'evidence_class');
  assertCondition(ENVIRONMENTS.has(report.environment as ReceiptPilotEnvironment), 'environment');
  assertCondition(typeof report.generatedAt === 'string' && !Number.isNaN(Date.parse(report.generatedAt)), 'generated_at');
  validateVersions(report.versions);
  validateCorrelation(report.correlation);
  validateApproval(report.approval);
  validatePostconditions(report.resourcePostconditions);
  validateMetrics(report.metrics);
  validateBudget(report.budget);
  walkKeys(value);
  assertCondition(Object.keys(report).every((key) => [
    'schemaVersion', 'evidenceClass', 'environment', 'generatedAt', 'versions', 'correlation',
    'approval', 'resourcePostconditions', 'metrics', 'budget',
  ].includes(key)), 'report_keys');

  const budget = report.budget as ReceiptPilotBudget;
  const metrics = report.metrics as ReceiptPilotRunMetrics;
  const budgetReady = budget.state === 'approved';
  const withinBudget = budgetReady
    && metrics.p95LatencyMs <= budget.p95LatencyMs!
    && metrics.fullRetryCostMicros <= budget.maxCostMicros!
    && metrics.providerCalls <= budget.maxProviderCalls!
    && metrics.maxObservedConcurrency <= budget.maxConcurrency!;
  return { budgetReady, withinBudget };
}

/** Enforce the operational gate; pending owner approval remains an explicit block. */
export function assertReceiptPilotObservabilityGate(
  value: unknown,
): ReceiptPilotObservabilityValidation {
  const validation = validateReceiptPilotObservabilityReport(value);
  if (!validation.budgetReady) throw new Error('receipt_pilot_observability_gate_failed:approved_budget_required');
  if (!validation.withinBudget) throw new Error('receipt_pilot_observability_gate_failed:budget_exceeded');
  return validation;
}
