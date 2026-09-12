import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import {
  NEGATIVE_RECEIPT_PILOT_CASES,
  RECEIPT_PILOT_EVALUATION_FIXTURE_VERSION,
  VALID_RECEIPT_PILOT_CASES,
  type ReceiptPilotEvaluationCase,
} from '../src/pilot/evaluationCases';
import { runReceiptPilotEvaluation } from '../src/pilot/evaluationGate';

const DEMO_ORIGIN = 'https://yapweijun1996.github.io/ERP-System/';
const REPORT_VERSION = 'receipt-pilot-demo-model-evaluation-2026-09-13.v1';
const DEMO_MODEL_VERSION = 'demo-auto';
const DEMO_GATEWAY_PROMPT_VERSION = 'receipt-demo-gateway-prompt-2026-09-13.v1';
const MINIMUM_SUCCESS_RATE = 0.95;

type DemoProposal = {
  readonly search: string;
  readonly provider: string;
  readonly model: string;
  readonly providerCalls: number;
};

type DemoCaseResult = {
  readonly caseId: string;
  readonly expectedSearch: string;
  readonly actualSearch: string | null;
  readonly pass: boolean;
  readonly durationMs: number;
  readonly providerCalls: number;
  readonly errorCode?: string;
};

type DemoRunResult = {
  readonly run: number;
  readonly runId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly validCaseCount: number;
  readonly passedCaseCount: number;
  readonly successRate: number;
  readonly p95LatencyMs: number;
  readonly providerCalls: number;
  readonly retries: number;
  readonly model: string;
  readonly cases: readonly DemoCaseResult[];
};

type DemoEvaluationReport = {
  readonly version: string;
  readonly evidenceClass: 'demo_model_query_only';
  readonly environment: 'demo';
  readonly generatedAt: string;
  readonly sourceRevision: string;
  readonly origin: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly fixtureVersion: string;
  readonly fixtureDigest: string;
  readonly gatewayScriptSha256: string;
  readonly validCaseCount: number;
  readonly negativeCaseCount: number;
  readonly deterministicNegativeGate: {
    readonly validCaseCount: number;
    readonly negativeCaseCount: number;
    readonly safetyFailures: number;
    readonly falseSuccesses: number;
  };
  readonly runs: readonly DemoRunResult[];
  readonly threshold: {
    readonly minimumSuccessRate: number;
    readonly requiredRuns: number;
    readonly requiredValidCasesPerRun: number;
  };
  readonly gate: 'open_supporting_evidence';
  readonly limitation: string;
};

type GatewayWindow = Window & {
  ReceiptDemoGateway?: {
    propose(payload: { message: string }): Promise<DemoProposal>;
  };
};

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function redactedId(value: string): string {
  return `sha256:${sha256(value)}`;
}

function sourceRevision(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function caseSearchValue(testCase: ReceiptPilotEvaluationCase): string {
  const value = testCase.input.search ?? testCase.input.receiptRef ?? '';
  return typeof value === 'string' ? value.trim() : '';
}

function caseMessage(testCase: ReceiptPilotEvaluationCase): string {
  const expectedSearch = caseSearchValue(testCase);
  const dateFrom = typeof testCase.input.dateFrom === 'string' ? testCase.input.dateFrom : '';
  const dateTo = typeof testCase.input.dateTo === 'string' ? testCase.input.dateTo : '';
  const datePhrase = dateFrom && dateTo ? ` from ${dateFrom} through ${dateTo}` : '';
  const searchPhrase = expectedSearch ? ` The receipt search term is "${expectedSearch}".` : '';
  return `For a synthetic ${testCase.action} receipt workflow, find the permitted Company Receipts${datePhrase}.${searchPhrase} Return the search term only; do not execute an action.`;
}

function p95(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

async function gatewayProposal(page: Page, message: string): Promise<DemoProposal> {
  return page.evaluate(async (input) => {
    const gateway = (window as GatewayWindow).ReceiptDemoGateway;
    if (!gateway) throw Object.assign(new Error('demo_gateway_script_missing'), { code: 'demo_gateway_script_missing' });
    return gateway.propose({ message: input });
  }, message);
}

async function evaluateRun(browser: Browser, run: number): Promise<DemoRunResult> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const startedAt = new Date().toISOString();
  const runId = redactedId(randomUUID());
  const results: DemoCaseResult[] = [];
  let model = DEMO_MODEL_VERSION;
  try {
    await page.goto(DEMO_ORIGIN, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForFunction(() => typeof (window as GatewayWindow).ReceiptDemoGateway === 'object', undefined, { timeout: 30_000 });
    for (const testCase of VALID_RECEIPT_PILOT_CASES) {
      const expectedSearch = caseSearchValue(testCase);
      const caseStartedAt = Date.now();
      try {
        const proposal = await gatewayProposal(page, caseMessage(testCase));
        const actualSearch = String(proposal.search ?? '').trim();
        model = proposal.model || model;
        results.push({
          caseId: testCase.id,
          expectedSearch,
          actualSearch,
          pass: actualSearch.toLocaleLowerCase() === expectedSearch.toLocaleLowerCase(),
          durationMs: Date.now() - caseStartedAt,
          providerCalls: Number.isSafeInteger(proposal.providerCalls) ? proposal.providerCalls : 0,
        });
      } catch (error) {
        const errorCode = error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code || 'demo_gateway_error')
          : 'demo_gateway_error';
        results.push({
          caseId: testCase.id,
          expectedSearch,
          actualSearch: null,
          pass: false,
          durationMs: Date.now() - caseStartedAt,
          providerCalls: 0,
          errorCode: /^demo_gateway_[a-z_]+$/.test(errorCode) ? errorCode : 'demo_gateway_error',
        });
      }
    }
  } finally {
    await context.close();
  }
  const endedAt = new Date().toISOString();
  const passedCaseCount = results.filter((result) => result.pass).length;
  return {
    run,
    runId,
    startedAt,
    endedAt,
    validCaseCount: results.length,
    passedCaseCount,
    successRate: results.length ? passedCaseCount / results.length : 0,
    p95LatencyMs: p95(results.map((result) => result.durationMs)),
    providerCalls: results.reduce((sum, result) => sum + result.providerCalls, 0),
    retries: 0,
    model,
    cases: results,
  };
}

async function main(): Promise<void> {
  const outputArgument = process.argv.slice(2).find((argument) => argument.startsWith('--output='));
  const outputPath = outputArgument?.slice('--output='.length)
    || path.join('/tmp', `receipt-pilot-demo-evaluation-${Date.now()}.json`);
  const gatewayScript = await readFile('web/public/assets/receipt-demo-gateway.js');
  const deterministic = runReceiptPilotEvaluation();
  const browser = await chromium.launch({ headless: true });
  const runs = await (async (): Promise<DemoRunResult[]> => {
    try {
      return await Promise.all([
      evaluateRun(browser, 1),
      evaluateRun(browser, 2),
      evaluateRun(browser, 3),
      ]);
    } finally {
      await browser.close();
    }
  })();
  const report: DemoEvaluationReport = {
    version: REPORT_VERSION,
    evidenceClass: 'demo_model_query_only',
    environment: 'demo',
    generatedAt: new Date().toISOString(),
    sourceRevision: sourceRevision(),
    origin: DEMO_ORIGIN,
    model: runs[0]?.model || DEMO_MODEL_VERSION,
    promptVersion: DEMO_GATEWAY_PROMPT_VERSION,
    fixtureVersion: RECEIPT_PILOT_EVALUATION_FIXTURE_VERSION,
    fixtureDigest: sha256(JSON.stringify(VALID_RECEIPT_PILOT_CASES)),
    gatewayScriptSha256: sha256(gatewayScript),
    validCaseCount: VALID_RECEIPT_PILOT_CASES.length,
    negativeCaseCount: NEGATIVE_RECEIPT_PILOT_CASES.length,
    deterministicNegativeGate: {
      validCaseCount: deterministic.validCount,
      negativeCaseCount: deterministic.negativeCount,
      safetyFailures: deterministic.deterministicSafetyFailures,
      falseSuccesses: deterministic.falseSuccessCount,
    },
    runs,
    threshold: {
      minimumSuccessRate: MINIMUM_SUCCESS_RATE,
      requiredRuns: 3,
      requiredValidCasesPerRun: 30,
    },
    gate: 'open_supporting_evidence',
    limitation: 'The Demo gateway proposes only a bounded receipt search term. It does not execute the frozen receipt action cases or establish server-provider, production, PostgreSQL, cost, approval or human-acceptance evidence.',
  };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  const summary = runs.map((result) => ({
    run: result.run,
    valid: result.validCaseCount,
    passed: result.passedCaseCount,
    successRate: result.successRate,
    p95LatencyMs: result.p95LatencyMs,
    providerCalls: result.providerCalls,
  }));
  process.stdout.write(`${JSON.stringify({ outputPath, summary, deterministicNegativeGate: report.deterministicNegativeGate })}\n`);
  if (runs.length !== 3 || runs.some((result) => result.validCaseCount < 30 || result.successRate < MINIMUM_SUCCESS_RATE)) {
    throw new Error('demo_model_evaluation_threshold_failed');
  }
}

await main();
