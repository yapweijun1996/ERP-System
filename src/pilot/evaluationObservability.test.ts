import { describe, expect, it } from 'vitest';
import {
  assertReceiptPilotObservabilityGate,
  createReceiptPilotObservabilityReport,
  redactReceiptPilotIdentifier,
  validateReceiptPilotObservabilityReport,
  type ReceiptPilotObservabilityReport,
} from './evaluationObservability';

const input = {
  evidenceClass: 'deterministic_fixture' as const,
  environment: 'local_ci' as const,
  generatedAt: '2026-09-13T12:00:00.000Z',
  versions: {
    fixture: 'receipt-pilot-fixture-2026-09-13.v1',
    model: 'gpt-4.1-mini',
    prompt: 'receipt-pilot-prompt-2026-09-13.v1',
    tool: 'agent-actions-v1',
  },
  correlation: {
    run: 'assistant-run-123', request: 'http-request-123', grant: 'grant-123',
    approval: null, tool: 'tool-call-123', database: 'database-trace-123', artifact: 'pack-artifact-123',
  },
  approval: { state: 'not_required' as const, reference: null },
  resourcePostconditions: [
    { kind: 'receipt' as const, identifier: 'receipt-1', version: 2, state: 'verified' as const },
    { kind: 'pack' as const, identifier: 'pack-1', version: 1, state: 'verified' as const },
  ],
  metrics: {
    elapsedMs: 1200, providerDurationMs: 900, p95LatencyMs: 1200, providerCalls: 3, retries: 2,
    spentCostMicros: 120, reservedCostMicros: 220, maxObservedConcurrency: 1,
  },
  budget: {
    state: 'pending' as const, owner: 'finance-platform-owner', p95LatencyMs: null,
    maxCostMicros: null, maxProviderCalls: null, maxConcurrency: null, reference: null,
  },
};

describe('Receipt pilot observability contract', () => {
  it('redacts correlations and records conservative full retry cost', () => {
    const report = createReceiptPilotObservabilityReport(input);
    expect(report.metrics.fullRetryCostMicros).toBe(220);
    expect(report.correlation.run).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(report.correlation.run).not.toContain('assistant-run-123');
    expect(report.resourcePostconditions[0].identifier).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(validateReceiptPilotObservabilityReport(report)).toEqual({ budgetReady: false, withinBudget: false });
  });

  it('rejects unredacted identifiers and forbidden sensitive fields', () => {
    const report = createReceiptPilotObservabilityReport(input) as ReceiptPilotObservabilityReport;
    expect(() => validateReceiptPilotObservabilityReport({
      ...report,
      correlation: { ...report.correlation, run: 'assistant-run-123' },
    })).toThrow('correlation_run_redaction');
    expect(() => validateReceiptPilotObservabilityReport({
      ...report,
      tenant: 'C-SG',
    })).toThrow('forbidden_field');
  });

  it('keeps the release gate closed until an owner approves numerical budgets', () => {
    const pending = createReceiptPilotObservabilityReport(input);
    expect(() => assertReceiptPilotObservabilityGate(pending))
      .toThrow('approved_budget_required');

    const approved = createReceiptPilotObservabilityReport({
      ...input,
      budget: {
        state: 'approved', owner: 'finance-platform-owner', p95LatencyMs: 1500,
        maxCostMicros: 300, maxProviderCalls: 4, maxConcurrency: 1, reference: 'budget-approval-123',
      },
    });
    expect(assertReceiptPilotObservabilityGate(approved)).toEqual({ budgetReady: true, withinBudget: true });
    expect(redactReceiptPilotIdentifier('budget-approval-123')).toBe(approved.budget.reference);
  });

  it('rejects under-reported retry cost and budget overruns', () => {
    const report = createReceiptPilotObservabilityReport(input) as ReceiptPilotObservabilityReport;
    expect(() => validateReceiptPilotObservabilityReport({
      ...report,
      metrics: { ...report.metrics, fullRetryCostMicros: 120 },
    })).toThrow('metric_full_retry_cost');

    const overBudget = createReceiptPilotObservabilityReport({
      ...input,
      metrics: { ...input.metrics, p95LatencyMs: 2000 },
      budget: {
        state: 'approved', owner: 'finance-platform-owner', p95LatencyMs: 1500,
        maxCostMicros: 300, maxProviderCalls: 4, maxConcurrency: 1, reference: 'budget-approval-123',
      },
    });
    expect(() => assertReceiptPilotObservabilityGate(overBudget)).toThrow('budget_exceeded');
  });
});
