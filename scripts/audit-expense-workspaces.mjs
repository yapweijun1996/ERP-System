#!/usr/bin/env node
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.EXPENSE_AUDIT_PORT || '4312';
const BASE_URL = `http://localhost:${PORT}`;
const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 800 },
  { label: 'mobile', width: 375, height: 812 },
];
const LANGUAGES = ['en', 'ms', 'zh', 'ja', 'vi'];

if (!existsSync(DIST_INDEX)) {
  throw new Error('web/dist/index.html is missing; run npm run build:demo first.');
}

async function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await fetch(BASE_URL)) return;
    } catch { /* preview is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview did not start at ${BASE_URL}.`);
}

function startPreview() {
  const vite = path.join(WEB_DIR, 'node_modules', '.bin', 'vite');
  const child = spawn(vite, ['preview', '--port', PORT, '--strictPort'], {
    cwd: WEB_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  return { child, stderr: () => stderr };
}

async function installFixtures(page) {
  await page.evaluate(() => {
    const now = '2026-07-26T08:00:00.000Z';
    const claim = {
      id: 9001,
      claimKey: 'expense-audit-9001',
      claimNo: 'EC-UI-9001',
      title: 'Regional customer workshop',
      status: 'partially_approved',
      version: 4,
      submissionKind: 'employee',
      submittedAt: now,
      updatedAt: now,
    };
    const lines = [
      {
        id: 9101,
        claimId: 9001,
        lineNo: 1,
        merchant: 'Tokyo Transit',
        transactionDate: '2026-07-18',
        purpose: 'Customer workshop airport transfer',
        categoryCode: 'TRAVEL',
        paymentSource: 'company_paid',
        originalCurrency: 'JPY',
        originalGross: '12000.0000',
        allocations: [
          { mode: 'percentage', dimensionType: 'department', dimensionKey: 'SALES', percentage: '60.0000' },
          { mode: 'percentage', dimensionType: 'project', dimensionKey: 'APAC-LAUNCH', percentage: '40.0000' },
        ],
        policy: {
          originalCurrency: 'JPY',
          functionalCurrency: 'SGD',
          policyFxRate: '0.00910000',
          baseExpense: '99.0000',
          baseInputTax: '9.0000',
          baseGross: '108.0000',
          fxMethod: 'actual_bank_allowed',
          bankChargeOverride: {
            actualBaseGross: '109.50',
            actualFxRate: '0.00912500',
            verifiedAt: now,
          },
        },
        control: {
          duplicateRiskScore: 82,
          duplicateRiskLevel: 'high',
          budgetAction: 'extra_approval',
          budgetBreached: true,
          remainingAfter: '-15.0000',
          duplicateOverride: { overriddenAt: now },
          signals: [{ signalType: 'business_key', riskPoints: 82 }],
        },
        approval: { status: 'approved' },
        posting: {
          journalRef: 'EXP:EC-UI-9001:L1:V4',
          functionalCurrency: 'SGD',
          baseGross: '109.50',
          legs: [
            { legType: 'expense', debit: '100.38', credit: '0.00' },
            { legType: 'input_tax', debit: '9.12', credit: '0.00' },
            { legType: 'credit', debit: '0.00', credit: '109.50' },
          ],
        },
      },
      {
        id: 9102,
        claimId: 9001,
        lineNo: 2,
        merchant: 'Workshop Supplies',
        transactionDate: '2026-07-19',
        purpose: 'Workshop materials',
        categoryCode: 'OFFICE',
        paymentSource: 'employee_paid',
        originalCurrency: 'SGD',
        originalGross: '38.00',
        allocations: [
          { mode: 'amount', dimensionType: 'cost_center', dimensionKey: 'SG-SALES', amountOriginal: '38.00' },
        ],
        policy: {
          originalCurrency: 'SGD',
          functionalCurrency: 'SGD',
          policyFxRate: '1.00000000',
          baseExpense: '38.0000',
          baseInputTax: '0.0000',
          baseGross: '38.0000',
          fxMethod: 'table_rate',
          bankChargeOverride: null,
        },
        control: {
          duplicateRiskScore: 0,
          duplicateRiskLevel: 'none',
          budgetAction: 'warn',
          budgetBreached: false,
          remainingAfter: '962.0000',
          duplicateOverride: null,
          signals: [],
        },
        approval: { status: 'returned' },
        posting: null,
        postingFailure: 'Accounting period July 2026 is locked.',
      },
    ];
    const expenseApproval = {
      approvalKind: 'expense',
      approval: {
        id: 9201,
        currentStepNo: 2,
        stepLabel: 'Finance review',
        submittedAt: now,
      },
      link: { id: 9301 },
      line: lines[0],
      claim,
      assessment: lines[0].control,
      snapshot: lines[0].policy,
      claimant: {
        employeeNo: 'EMP-1042',
        fullName: 'Marcus Silva',
        department: 'Sales',
        jobTitle: 'Account Executive',
      },
      allocations: lines[0].allocations,
      duplicateSignals: [{ signalType: 'business_key', riskPoints: 82 }],
      duplicateOverride: null,
      bankChargeOverride: lines[0].policy.bankChargeOverride,
    };
    const my = window.ErpSystemData.my;
    my.claims = async () => ({ data: [{ ...claim, lines }], meta: { actorDerived: true } });
    my.claim = async () => ({
      data: { claim, lines, events: [], revisions: [] },
      meta: { actorDerived: true, privacy: 'owner_only_duplicate_evidence_redacted' },
    });
    my.receipts = async () => ({
      data: [],
      meta: { actorDerived: true, scanning: 'fail_closed' },
    });
    my.approvals = async () => ({ data: [] });
    my.expenseApprovals = async () => ({ data: [expenseApproval], meta: { actorDerived: true } });
    my.expenseApprovalAction = async () => {
      throw new Error('Accounting period July 2026 is locked.');
    };
    my.expenseDuplicateOverride = async () => ({ data: { replayed: false } });
  });
}

async function waitForLayout(page, selector) {
  await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(120);
}

async function assertNoPageOverflow(page, label) {
  const result = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    view: document.querySelector('#viewRoot')?.scrollWidth
      - document.querySelector('#viewRoot')?.clientWidth,
  }));
  if (result.document > 1 || result.view > 1) {
    throw new Error(`${label} has page overflow: ${JSON.stringify(result)}`);
  }
}

async function auditViewport(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`[console] ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`[page] ${error.message}`));
  await page.addInitScript(() => {
    localStorage.setItem('aria-setup-wizard-complete', '1');
    localStorage.setItem('aria-demo-auth', JSON.stringify({
      signedIn: true,
      email: 'admin@acme.co',
      at: new Date(0).toISOString(),
    }));
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.dashgrid', { state: 'visible', timeout: 60000 });
  await installFixtures(page);

  for (const language of LANGUAGES) {
    await page.evaluate((code) => { setLang(code); }, language);

    await page.evaluate(() => navigate('my-claims'));
    await waitForLayout(page, '[data-layout="transaction-list-v1"][data-expense-claims="canonical"]');
    if (await page.locator('[data-list-table] [data-row]').count() !== 1) {
      throw new Error(`${viewport.label}/${language}: My Claims fixture row missing.`);
    }
    await assertNoPageOverflow(page, `${viewport.label}/${language}/my-claims`);

    await page.evaluate(() => navigate('expense-claim', { claimId: 9001 }));
    await waitForLayout(page, '[data-layout="case-detail-v1"][data-case-route="expense-claim"]');
    const detailContracts = await page.evaluate(() => ({
      owner: document.querySelector('[data-expense-owner-only="true"]') !== null,
      fx: document.querySelectorAll('[data-expense-fx]').length,
      duplicate: document.querySelectorAll('[data-expense-duplicate]').length,
      allocation: document.querySelectorAll('[data-expense-allocation]').length,
      budget: document.querySelectorAll('[data-expense-budget]').length,
      posting: document.querySelectorAll('[data-expense-posting]').length,
      failure: document.querySelectorAll('[data-expense-posting-failure]').length,
      leaked: /other\.employee|signalHashSecret|matchedLineId/i.test(
        document.querySelector('#viewRoot')?.textContent || '',
      ),
    }));
    if (!detailContracts.owner || detailContracts.fx < 2 || detailContracts.duplicate < 2
      || detailContracts.allocation < 2 || detailContracts.budget < 2
      || detailContracts.posting < 1 || detailContracts.failure < 1 || detailContracts.leaked) {
      throw new Error(
        `${viewport.label}/${language}: expense detail contract failed ${JSON.stringify(detailContracts)}`,
      );
    }
    await assertNoPageOverflow(page, `${viewport.label}/${language}/expense-claim`);

    await page.evaluate(() => navigate('my-receipts'));
    await waitForLayout(page, '[data-layout="transaction-list-v1"][data-receipt-capture="canonical"]');
    await assertNoPageOverflow(page, `${viewport.label}/${language}/my-receipts`);

    await page.evaluate(() => navigate('my-approvals'));
    await waitForLayout(page, '[data-layout="master-detail-register-v1"][data-list-route="my-approvals"]');
    if (!await page.locator('[data-expense-approval-detail]').count()) {
      await page.locator('[data-list-table] [data-row]').first().click();
      await waitForLayout(page, '[data-expense-approval-detail]');
    }
    if (await page.locator('[data-expense-approval-detail] input, [data-expense-approval-detail] textarea').count()) {
      throw new Error(`${viewport.label}/${language}: approver can edit employee expense facts.`);
    }
    await page.locator('[data-expense-approval-action="approve"]').click();
    await waitForLayout(page, '[data-expense-posting-failure]');
    await assertNoPageOverflow(page, `${viewport.label}/${language}/my-approvals`);
  }
  if (errors.length) throw new Error(`${viewport.label}: ${errors.join('\n')}`);
  await context.close();
  process.stdout.write(`PASS [${viewport.label}] five-language expense SSOT, privacy and failure states.\n`);
}

const preview = startPreview();
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  for (const viewport of VIEWPORTS) await auditViewport(browser, viewport);
  process.stdout.write('Expense workspace audit PASSED ✅\n');
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n${preview.stderr()}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  preview.child.kill();
}
