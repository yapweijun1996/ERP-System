import { describe, expect, it } from 'vitest';
import {
  NEGATIVE_RECEIPT_PILOT_CASES,
  VALID_RECEIPT_PILOT_CASES,
  evaluateReceiptPilotCase,
  validateReceiptPilotCaseSet,
  type ReceiptPilotObservedResult,
} from './evaluationCases';
import { runReceiptPilotEvaluation } from './evaluationGate';

describe('Receipt pilot frozen evaluation set and independent oracle', () => {
  it('freezes at least 30 distinct valid cases and the required dimensions', () => {
    expect(validateReceiptPilotCaseSet()).toMatchObject({
      validCount: 30,
      negativeCount: 9,
      companies: ['C-SG', 'C-MY'],
      locales: ['en', 'ms', 'zh', 'ja', 'vi'],
    });
  });

  it('accepts a result whose protected postconditions match the fixture', () => {
    const testCase = VALID_RECEIPT_PILOT_CASES.find((candidate) => candidate.id === 'P06-create-sg');
    expect(testCase).toBeDefined();
    const observed: ReceiptPilotObservedResult = {
      companyFn: 'C-SG', status: 'succeeded', receiptKeys: ['sg-ready-1'], packIds: ['pack-sg-1'],
      persistedPackCount: 1, claimedSuccess: true, postconditionsVerified: true,
    };
    expect(evaluateReceiptPilotCase(testCase!, observed)).toMatchObject({
      pass: true, securityPass: true, transactionPass: true, falseSuccess: false,
    });
  });

  it.each([
    ['wrong receipt IDs', { receiptKeys: ['sg-foreign-1'] }, 'wrong_receipt_ids'],
    ['unauthorized data', { unauthorizedReceiptKeys: ['my-ready-1'] }, 'unauthorized_data'],
    ['duplicate Pack', { packIds: ['pack-sg-1', 'pack-sg-2'], persistedPackCount: 2 }, 'duplicate_pack'],
    ['false success', { persistedPackCount: 0, packIds: [], postconditionsVerified: false }, 'false_success'],
  ])('rejects %s independently', (_label, override, failure) => {
    const testCase = VALID_RECEIPT_PILOT_CASES.find((candidate) => candidate.id === 'P06-create-sg')!;
    const observed: ReceiptPilotObservedResult = {
      companyFn: 'C-SG', status: 'succeeded', receiptKeys: ['sg-ready-1'], packIds: ['pack-sg-1'],
      persistedPackCount: 1, claimedSuccess: true, postconditionsVerified: true, ...override,
    };
    const result = evaluateReceiptPilotCase(testCase, observed);
    expect(result.pass).toBe(false);
    expect(result.failures).toContain(failure);
  });

  it('keeps the negative matrix outside the positive denominator', () => {
    expect(NEGATIVE_RECEIPT_PILOT_CASES.every((testCase) => testCase.id.startsWith('N'))).toBe(true);
    expect(new Set(NEGATIVE_RECEIPT_PILOT_CASES.map((testCase) => testCase.kind)).size).toBe(9);
  });

  it('runs the deterministic gate and rejects a deliberately broken fixture', () => {
    expect(runReceiptPilotEvaluation()).toMatchObject({
      fixtureVersion: 'receipt-pilot-fixture-2026-09-13.v1', modelVersion: 'gpt-4.1-mini',
      promptVersion: 'receipt-pilot-prompt-2026-09-13.v1', toolVersion: 'agent-actions-v1',
      validCases: 30, validPassed: 30, negativeCases: 9, negativeRejected: 9,
      deterministicSafetyFailures: 0, falseSuccessCount: 0, evidenceClass: 'deterministic_fixture',
    });
    expect(() => runReceiptPilotEvaluation({ broken: true })).toThrow('receipt_pilot_evaluation_gate_failed');
  });
});
