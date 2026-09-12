import {
  NEGATIVE_RECEIPT_PILOT_CASES,
  RECEIPT_PILOT_EVALUATION_FIXTURE_VERSION,
  RECEIPT_PILOT_EVALUATION_MODEL_VERSION,
  RECEIPT_PILOT_EVALUATION_PROMPT_VERSION,
  RECEIPT_PILOT_EVALUATION_TOOL_VERSION,
  VALID_RECEIPT_PILOT_CASES,
  evaluateReceiptPilotCase,
  validateReceiptPilotCaseSet,
  type ReceiptPilotEvaluationCase,
  type ReceiptPilotObservedResult,
} from './evaluationCases';

export interface ReceiptPilotGateOptions {
  readonly broken?: boolean;
}

export interface ReceiptPilotGateResult {
  readonly fixtureVersion: string;
  readonly modelVersion: string;
  readonly promptVersion: string;
  readonly toolVersion: string;
  readonly validCases: number;
  readonly validPassed: number;
  readonly negativeCases: number;
  readonly negativeRejected: number;
  readonly deterministicSafetyFailures: number;
  readonly falseSuccessCount: number;
  readonly failedCaseIds: readonly string[];
  readonly evidenceClass: 'deterministic_fixture';
}

function baselineResult(testCase: ReceiptPilotEvaluationCase): ReceiptPilotObservedResult {
  const packIds = Array.from({ length: testCase.expected.packCount }, (_, index) => `${testCase.id}-pack-${index + 1}`);
  return {
    companyFn: testCase.companyFn,
    status: testCase.expected.status,
    receiptKeys: [...testCase.expected.receiptKeys],
    packIds,
    persistedPackCount: testCase.expected.packCount,
    claimedSuccess: testCase.expected.status === 'succeeded',
    postconditionsVerified: true,
  };
}

function negativeResult(kind: string): ReceiptPilotObservedResult {
  const base: ReceiptPilotObservedResult = {
    companyFn: 'C-SG',
    status: 'succeeded',
    receiptKeys: ['sg-ready-1'],
    packIds: ['negative-pack-1'],
    persistedPackCount: 1,
    claimedSuccess: true,
    postconditionsVerified: true,
  };
  if (kind === 'wrong_receipt_id') return { ...base, receiptKeys: ['sg-foreign-1'] };
  if (kind === 'unauthorized_data') return { ...base, unauthorizedReceiptKeys: ['my-ready-1'] };
  if (kind === 'duplicate_pack') return { ...base, packIds: ['negative-pack-1', 'negative-pack-2'], persistedPackCount: 2 };
  if (kind === 'false_success') return { ...base, packIds: [], persistedPackCount: 0, postconditionsVerified: false };
  return { ...base, status: 'rejected', persistedPackCount: 0, packIds: [], claimedSuccess: false, postconditionsVerified: false };
}

/** Run the local deterministic gate over the frozen set. */
export function runReceiptPilotEvaluation(options: ReceiptPilotGateOptions = {}): ReceiptPilotGateResult {
  const summary = validateReceiptPilotCaseSet();
  const failures: string[] = [];
  let validPassed = 0;
  let falseSuccessCount = 0;
  for (const testCase of VALID_RECEIPT_PILOT_CASES) {
    const observed = options.broken && testCase.id === 'P06-create-sg'
      ? { ...baselineResult(testCase), receiptKeys: ['sg-foreign-1'] }
      : baselineResult(testCase);
    const result = evaluateReceiptPilotCase(testCase, observed);
    falseSuccessCount += Number(result.falseSuccess);
    if (result.pass) validPassed += 1;
    else failures.push(testCase.id);
  }

  const requiredNegativeKinds = new Set(['wrong_receipt_id', 'unauthorized_data', 'duplicate_pack', 'false_success']);
  const negativeResults = NEGATIVE_RECEIPT_PILOT_CASES.map((testCase) => {
    const result = evaluateReceiptPilotCase(
      VALID_RECEIPT_PILOT_CASES.find((candidate) => candidate.id === 'P06-create-sg')!,
      negativeResult(testCase.kind),
    );
    return { testCase, result };
  });
  const requiredNegativeResults = negativeResults.filter(({ testCase }) => requiredNegativeKinds.has(testCase.kind));
  const negativeRejected = negativeResults.filter(({ result }) => !result.pass).length;
  const deterministicSafetyFailures = requiredNegativeResults.filter(({ result }) => result.pass).length;
  if (summary.validCount !== 30 || validPassed !== summary.validCount || negativeRejected !== summary.negativeCount
    || deterministicSafetyFailures !== 0 || falseSuccessCount !== 0) {
    const failedNegativeIds = negativeResults.filter(({ result }) => result.pass).map(({ testCase }) => testCase.id);
    throw new Error(`receipt_pilot_evaluation_gate_failed:${[...failures, ...failedNegativeIds].join(',') || 'unknown'}`);
  }
  return {
    fixtureVersion: RECEIPT_PILOT_EVALUATION_FIXTURE_VERSION,
    modelVersion: RECEIPT_PILOT_EVALUATION_MODEL_VERSION,
    promptVersion: RECEIPT_PILOT_EVALUATION_PROMPT_VERSION,
    toolVersion: RECEIPT_PILOT_EVALUATION_TOOL_VERSION,
    validCases: summary.validCount,
    validPassed,
    negativeCases: summary.negativeCount,
    negativeRejected,
    deterministicSafetyFailures,
    falseSuccessCount,
    failedCaseIds: failures,
    evidenceClass: 'deterministic_fixture',
  };
}
