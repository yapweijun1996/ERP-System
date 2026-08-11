#!/usr/bin/env node
// Screen audit (TASK-018). Serves the built demo bundle (web/dist/, from
// `npm run build:demo`) with `vite preview`, boots straight to the dashboard
// (same localStorage bypass as scripts/smoke.mjs), then drives the app's own
// global `navigate(route)` router across every route currently registered in
// the global `SCREENS` map — not a static list, the live one, read from the
// page itself via `Object.keys(SCREENS)`, so this stays correct as screens
// are added/removed without needing to hand-maintain a route list here.
//
// For each route this asserts:
//   - no console.error / uncaught pageerror / synchronous throw while
//     rendering it (the exact stale data / partial route failure class
//     TASK-018 was opened to prevent)
//   - the rendered text never contains a leftover identity marker from the
//     original Aria/Northwind prototype template (data-core.js's pre-adapter
//     defaults: "Northwind Manufacturing" / "Dana Reyes" / "dana.reyes@northwind.co")
//     on a route whose live SCREEN_META entry marks it canonical.
//   - every route has route-level SCREEN_META, Preview routes render the
//     visible Sample Data banner, active module tabs stay visible on mobile,
//     and standard action bars do not overflow.
//   - routes declaring a page-level layout contract render every required
//     region in canonical order. Set LIST_LAYOUT_ONLY=1 to audit only those
//     routes while migrating legacy screens in bounded batches, or
//     WORKSPACE_LAYOUT_ONLY=1 for operational workspaces, or
//     CALENDAR_WORKSPACE_ONLY=1 for team calendar workspaces, or
//     MASTER_DETAIL_EDITOR_ONLY=1 for versioned master-data detail editors, or
//     CASE_DETAIL_ONLY=1 for actionable lifecycle case details, or
//     DOCUMENT_DETAIL_ONLY=1 for legacy-compatible business documents, or
//     LEDGER_DETAIL_ONLY=1 for immutable financial account ledgers, or
//     POSTING_DETAIL_ONLY=1 for immutable balanced accounting postings.
//   - stateful transaction detail routes are opened through real fixtures
//     instead of silently redirecting because no record was selected.
//
// Usage: npm run build:demo && node scripts/audit-screens.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.AUDIT_PORT || '4311';
const BASE_URL = `http://localhost:${PORT}`;
const SETTLE_MS = 200;
const LIST_LAYOUT_ONLY = process.env.LIST_LAYOUT_ONLY === '1';
const WORKSPACE_LAYOUT_ONLY = process.env.WORKSPACE_LAYOUT_ONLY === '1';
const CALENDAR_WORKSPACE_ONLY = process.env.CALENDAR_WORKSPACE_ONLY === '1';
const MASTER_DETAIL_EDITOR_ONLY = process.env.MASTER_DETAIL_EDITOR_ONLY === '1';
const CASE_DETAIL_ONLY = process.env.CASE_DETAIL_ONLY === '1';
const LEDGER_DETAIL_ONLY = process.env.LEDGER_DETAIL_ONLY === '1';
const POSTING_DETAIL_ONLY = process.env.POSTING_DETAIL_ONLY === '1';
const FINANCIAL_STATEMENT_ONLY = process.env.FINANCIAL_STATEMENT_ONLY === '1';
const PAYROLL_RUN_ONLY = process.env.PAYROLL_RUN_ONLY === '1';
const REPORT_LAYOUTS = process.env.REPORT_LAYOUTS === '1';
const DOCUMENT_DETAIL_ONLY = process.env.DOCUMENT_DETAIL_ONLY === '1';
const LIST_LAYOUTS = new Set(['transaction-list-v1','master-detail-register-v1','report-list-v1']);
const OPERATIONAL_WORKSPACE_LAYOUT = 'operational-workspace-v1';
const CALENDAR_WORKSPACE_LAYOUT = 'calendar-workspace-v1';
const MASTER_DETAIL_EDITOR_LAYOUT = 'master-detail-editor-v1';
const CASE_DETAIL_LAYOUT = 'case-detail-v1';
const LEDGER_DETAIL_LAYOUT = 'ledger-detail-v1';
const POSTING_DETAIL_LAYOUT = 'posting-detail-v1';
const FINANCIAL_STATEMENT_LAYOUT = 'financial-statement-v1';
const VALID_LAYOUTS = new Set([
  ...LIST_LAYOUTS,OPERATIONAL_WORKSPACE_LAYOUT,CALENDAR_WORKSPACE_LAYOUT,MASTER_DETAIL_EDITOR_LAYOUT,CASE_DETAIL_LAYOUT,LEDGER_DETAIL_LAYOUT,POSTING_DETAIL_LAYOUT,FINANCIAL_STATEMENT_LAYOUT,
  'dashboard','report','document-detail','form',
  'master-detail','workspace','board','activity-feed',
]);

if ([LIST_LAYOUT_ONLY,WORKSPACE_LAYOUT_ONLY,CALENDAR_WORKSPACE_ONLY,MASTER_DETAIL_EDITOR_ONLY,CASE_DETAIL_ONLY,LEDGER_DETAIL_ONLY,POSTING_DETAIL_ONLY,FINANCIAL_STATEMENT_ONLY,PAYROLL_RUN_ONLY,DOCUMENT_DETAIL_ONLY].filter(Boolean).length > 1) {
  throw new Error('Layout-only audit switches are mutually exclusive.');
}

const IDENTITY_MARKERS = ['northwind', 'dana reyes', 'dana.reyes@northwind.co'];
const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 800 },
  { label: 'mobile', width: 375, height: 812 },
].filter((viewport) => !process.env.AUDIT_VIEWPORT || process.env.AUDIT_VIEWPORT === viewport.label);

if (!existsSync(DIST_INDEX)) {
  console.error(`web/dist/index.html not found. Run "npm run build:demo" before this script.`);
  process.exit(1);
}

const assetDir = path.join(WEB_DIR, 'public', 'assets');
const legacyListFactoryHits = readdirSync(assetDir)
  .filter((name) => name.endsWith('.js'))
  .flatMap((name) => {
    const source = readFileSync(path.join(assetDir, name), 'utf8');
    return ['makeSalesList','makePurList','rowMenuBtn']
      .filter((token) => new RegExp(`\\b${token}\\b`).test(source))
      .map((token) => `${name}:${token}`);
  });
if (legacyListFactoryHits.length) {
  throw new Error(`Obsolete page-level list factories remain: ${legacyListFactoryHits.join(', ')}`);
}

const projectScreenSource = readFileSync(path.join(assetDir, 'screens-project.js'), 'utf8');
const timesheetScreenSource = projectScreenSource.split("SCREENS['timesheet'] =")[1] || '';
const obsoleteTimesheetChrome = ['<div class="toolbar">','docpage','statgrid','<table class="lines"']
  .filter((token) => timesheetScreenSource.includes(token));
if (obsoleteTimesheetChrome.length) {
  throw new Error(`Timesheet still rebuilds page-level list chrome: ${obsoleteTimesheetChrome.join(', ')}`);
}

const hrScreenSource = readFileSync(path.join(assetDir, 'screens-hr.js'), 'utf8');
const myWorkRoutes = ['my-leave','my-claims','expense-claim','my-receipts','team-calendar','my-approvals'];
const missingMyWorkRoutes = myWorkRoutes.filter((route) =>
  !hrScreenSource.includes(`SCREENS['${route}']`));
if (missingMyWorkRoutes.length) {
  throw new Error(`My Work shell routes are missing: ${missingMyWorkRoutes.join(', ')}`);
}
if (!hrScreenSource.includes('data-my-work-shell')
    || !hrScreenSource.includes('transactionListPage(root')
    || !hrScreenSource.includes('calendarWorkspacePage(root')
    || !hrScreenSource.includes('reason_and_evidence_redacted')) {
  throw new Error('My Work shell does not declare its SSOT list or privacy contract.');
}
const expenseClaimListSource = (hrScreenSource.split("SCREENS['my-claims']=")[1] || '')
  .split("SCREENS['expense-claim']=")[0];
const expenseClaimDetailSource = (hrScreenSource.split("SCREENS['expense-claim']=")[1] || '')
  .split('function receiptCaptureCopy')[0];
const expenseApprovalSource = (hrScreenSource.split("SCREENS['my-approvals']=")[1] || '')
  .split('/* ---------------- EMPLOYEE DIRECTORY')[0];
const missingExpenseContracts = [
  ['My Claims transaction-list SSOT', expenseClaimListSource, 'transactionListPage(root'],
  ['expense claim case-detail SSOT', expenseClaimDetailSource, 'caseDetailPage(root'],
  ['expense owner privacy marker', expenseClaimDetailSource, 'data-expense-owner-only'],
  ['expense FX state', expenseClaimDetailSource, 'data-expense-fx'],
  ['expense duplicate state', expenseClaimDetailSource, 'data-expense-duplicate'],
  ['expense allocation state', expenseClaimDetailSource, 'data-expense-allocation'],
  ['expense budget state', expenseClaimDetailSource, 'data-expense-budget'],
  ['expense posting failure state', expenseClaimDetailSource, 'data-expense-posting-failure'],
  ['expense approval read-only marker', expenseApprovalSource, 'data-expense-read-only'],
  ['expense return action', expenseApprovalSource, 'data-expense-approval-action="return"'],
].filter(([,source,token]) => !source.includes(token)).map(([label]) => label);
if (missingExpenseContracts.length) {
  throw new Error(`Expense SSOT contracts are missing: ${missingExpenseContracts.join(', ')}`);
}
const leaveApplicationScreenSource = (hrScreenSource.split("SCREENS['leave-application']=")[1] || '')
  .split("SCREENS['my-claims']")[0];
if (!leaveApplicationScreenSource.includes('caseDetailPage(root')) {
  throw new Error('Leave Application does not render through caseDetailPage().');
}
const obsoleteLeaveApplicationChrome = [
  'docwrap','docpage','dochead','position:sticky','data-my-leave-delete',
].filter((token) => leaveApplicationScreenSource.includes(token));
if (obsoleteLeaveApplicationChrome.length) {
  throw new Error(
    `Leave Application rebuilds legacy chrome or physical-delete affordances: ${obsoleteLeaveApplicationChrome.join(', ')}`,
  );
}
if (!hrScreenSource.includes("leaveAction(application.id,name")
    || !hrScreenSource.includes("confirmMyLeaveAction(application,'void')")) {
  throw new Error('Leave Application does not expose the governed Void-delete workflow.');
}
const receiptDraftSource = readFileSync(path.join(assetDir, 'receipt-drafts.js'), 'utf8');
const receiptCaptureContracts = [
  "SCREENS['my-receipts']",
  "data-receipt-capture','canonical'",
  'data-offline-draft-warning',
  'adapter.uploadReceipt(draft)',
  'draftStore.putFile(file,{autoSubmitAuthorized:authorized})',
  'data-receipt-auto-authorize',
  "inboxStatus==='review_required'",
  "inboxStatus==='submitted'",
  'window.ErpReceiptDrafts.transformImage',
  'receiptProcessingState(item)',
  "scanStatus==='infected'",
  "scanStatus==='unavailable'",
  "scanStatus!=='clean'",
].filter((token) => !hrScreenSource.includes(token));
if (receiptCaptureContracts.length) {
  throw new Error(
    `My Receipts is missing secure capture contracts: ${receiptCaptureContracts.join(', ')}`,
  );
}
const myReceiptsScreenSource = (hrScreenSource.split("SCREENS['my-receipts']=")[1] || '')
  .split("SCREENS['team-calendar']")[0];
const prematureReceiptActions = [
  'data-receipt-preview',
  'data-receipt-export',
  'data-receipt-submit',
].filter((token) => myReceiptsScreenSource.includes(token));
if (prematureReceiptActions.length) {
  throw new Error(
    `Quarantined My Receipts exposes blocked actions: ${prematureReceiptActions.join(', ')}`,
  );
}
const receiptGovernanceContracts = [
  "row.item.recordStatus==='draft'",
  "['submitted','approved'].includes(row.item.recordStatus)",
  'data-receipt-delete-stored',
  'adapter.deleteStoredReceipt',
  'data-receipt-void-stored',
  'adapter.voidStoredReceipt',
  "item.recordStatus==='voided'",
].filter((token) => !myReceiptsScreenSource.includes(token)
  && !hrScreenSource.includes(token));
if (receiptGovernanceContracts.length) {
  throw new Error(
    `My Receipts is missing state-governed deletion/Void contracts: ${receiptGovernanceContracts.join(', ')}`,
  );
}
const offlineReceiptContracts = [
  "var DB_NAME='aria-receipt-drafts-v1'",
  'var MAX_BYTES=20*1024*1024',
  'indexedDB.open',
  'createImageBitmap',
  'canvas.toBlob',
  'confirmAndClearBeforeLogout',
].filter((token) => !receiptDraftSource.includes(token));
if (offlineReceiptContracts.length) {
  throw new Error(
    `Offline receipt drafts are missing required safeguards: ${offlineReceiptContracts.join(', ')}`,
  );
}
const i18nPackDir = path.join(assetDir, 'i18n');
const missingMyWorkLocales = ['en','ms','zh','ja','vi'].filter((locale) => {
  const packPath = path.join(i18nPackDir, `${locale}.json`);
  if (!existsSync(packPath)) return true;
  const pack = JSON.parse(readFileSync(packPath, 'utf8'));
  return typeof pack['myWork.nav.teamCalendar'] !== 'string';
});
if (missingMyWorkLocales.length) {
  throw new Error(`My Work navigation translations are missing: ${missingMyWorkLocales.join(', ')}`);
}
const employeeScreenSource = (hrScreenSource.split("SCREENS['employee'] =")[1] || '')
  .split('/* ---- shared payroll data prep')[0];
const obsoleteEmployeeChrome = [
  '<div class="content full"',
  'docwrap',
  'docpage',
  'dochead',
  'doclayout',
  'readonly',
  'position:sticky',
  'master-detail-editor-action-note',
  'data-employee-back',
].filter((token) => employeeScreenSource.includes(token));
if (obsoleteEmployeeChrome.length) {
  throw new Error(`Employee still rebuilds legacy document chrome: ${obsoleteEmployeeChrome.join(', ')}`);
}

const assetScreenSource = readFileSync(path.join(assetDir, 'screens-asset.js'), 'utf8');
const assetDetailScreenSource = (assetScreenSource.split("SCREENS['asset-detail'] =")[1] || '')
  .split("SCREENS['depreciation'] =")[0];
const obsoleteAssetDetailChrome = [
  '<div class="content full"',
  'docwrap',
  'docpage',
  'dochead',
  'doclayout',
  'class="summary"',
  'class="sumcard"',
  '<table class="lines"',
  'readonly',
].filter((token) => assetDetailScreenSource.includes(token));
if (!assetDetailScreenSource.includes('masterDetailEditorPage(root')) {
  throw new Error('Asset Detail does not render through masterDetailEditorPage().');
}
if (obsoleteAssetDetailChrome.length) {
  throw new Error(`Asset Detail still rebuilds legacy document chrome: ${obsoleteAssetDetailChrome.join(', ')}`);
}
const depreciationScreenSource = assetScreenSource.split("SCREENS['depreciation'] =")[1] || '';
const obsoleteDepreciationChrome = [
  'class="report"',
  'report-params',
  'report-result',
  'report-toolbar',
  '<div class="dt-page"',
  'readonly',
].filter((token) => depreciationScreenSource.includes(token));
if (!depreciationScreenSource.includes('masterDetailRegisterPage(root')) {
  throw new Error('Depreciation does not render through masterDetailRegisterPage().');
}
if (obsoleteDepreciationChrome.length) {
  throw new Error(`Depreciation still rebuilds legacy report chrome: ${obsoleteDepreciationChrome.join(', ')}`);
}

const serviceScreenSource = readFileSync(path.join(assetDir, 'screens-service.js'), 'utf8');
const serviceContractScreenSource = serviceScreenSource.split("SCREENS['service-contract'] =")[1] || '';
const obsoleteServiceContractChrome = [
  'docwrap','docpage','dochead','doclayout','position:sticky',
].filter((token) => serviceContractScreenSource.includes(token));
if (!serviceContractScreenSource.includes('masterDetailEditorPage(root')) {
  throw new Error('Service Contract does not render through masterDetailEditorPage().');
}
if (obsoleteServiceContractChrome.length) {
  throw new Error(`Service Contract still rebuilds legacy document chrome: ${obsoleteServiceContractChrome.join(', ')}`);
}

const fakeListOpenTokens = [
  ['screens-admin.js',"onOpen:()=>navigate('role-permission')"],
  ['screens-purchasing-lists.js',"toast('Opening '+p.no"],
  ['screens-sales-list.js','toast(`Opening ${s.no}`'],
  ['screens-inv.js',"toast('Drill into"],
];
const fakeListOpenHits = fakeListOpenTokens.filter(([name,token])=>
  readFileSync(path.join(assetDir,name),'utf8').includes(token));
if (fakeListOpenHits.length) {
  throw new Error(`Placeholder list-row open behaviour remains: ${fakeListOpenHits.map(([name])=>name).join(', ')}`);
}

const serviceOrderScreenSource = (serviceScreenSource.split("SCREENS['service-order'] =")[1] || '')
  .split('function assignTicketForm')[0];
const obsoleteServiceOrderChrome = [
  '<div class="content full"',
  'docwrap',
  'docpage',
  'dochead',
  'appr-layout',
  'class="stepper"',
  'class="dt"',
  'sumcard',
  'position:sticky',
].filter((token) => serviceOrderScreenSource.includes(token));
if (obsoleteServiceOrderChrome.length) {
  throw new Error(`Service Order still rebuilds legacy case chrome: ${obsoleteServiceOrderChrome.join(', ')}`);
}

const purchasingControlSource = readFileSync(path.join(assetDir, 'screens-purchasing-control.js'), 'utf8');
const poApprovalScreenSource = (purchasingControlSource.split("SCREENS['po-approval']=")[1] || '')
  .split('/* ---------------- SUPPLIER PRICE LISTS')[0];
const obsoletePoApprovalChrome = [
  '<div class="content full"',
  'docwrap',
  'docpage',
  'dochead',
  'docmeta',
  'appr-layout',
  'sumcard',
  'data-po-back',
  'position:sticky',
].filter((token) => poApprovalScreenSource.includes(token));
if (!poApprovalScreenSource.includes('caseDetailPage(root')) {
  throw new Error('PO Approval does not render through caseDetailPage().');
}
if (obsoletePoApprovalChrome.length) {
  throw new Error(`PO Approval still rebuilds legacy case chrome: ${obsoletePoApprovalChrome.join(', ')}`);
}

const purchasingDetailsSource = readFileSync(path.join(assetDir, 'screens-purchasing-details.js'), 'utf8');
const goodsReceiptScreenSource = (purchasingDetailsSource.split("SCREENS['goods-receipt']=")[1] || '')
  .split("SCREENS['supplier-invoice']=")[0];
const obsoleteGoodsReceiptChrome = [
  '<div class="content full"',
  'docwrap',
  'docpage',
  'dochead',
  'docmeta',
  'doclayout',
  'sumcard',
  'class="summary"',
  'data-receipt-back',
  'position:sticky',
].filter((token) => goodsReceiptScreenSource.includes(token));
if (!goodsReceiptScreenSource.includes('postingDetailPage(root')) {
  throw new Error('Goods Receipt does not render through postingDetailPage().');
}
if (obsoleteGoodsReceiptChrome.length) {
  throw new Error(`Goods Receipt still rebuilds legacy posting chrome: ${obsoleteGoodsReceiptChrome.join(', ')}`);
}

const warehouseScreenSource = readFileSync(path.join(assetDir, 'screens-warehouse.js'), 'utf8');
const obsoleteWorkspaceChrome = ['pick-layout','pick-main','pick-side','pick-tools','progressbig']
  .filter((token) => warehouseScreenSource.includes(token));
if (obsoleteWorkspaceChrome.length) {
  throw new Error(`Warehouse Picking still rebuilds page-level workspace chrome: ${obsoleteWorkspaceChrome.join(', ')}`);
}

const qualityScreenSource = readFileSync(path.join(assetDir, 'screens-qc-canonical.js'), 'utf8');
const ncrScreenSource = qualityScreenSource.split("SCREENS['ncr']=")[1] || '';
const obsoleteNcrChrome = ['docwrap','docpage','dochead','doclayout','set-savebar']
  .filter((token) => ncrScreenSource.includes(token));
if (obsoleteNcrChrome.length) {
  throw new Error(`NCR still rebuilds legacy document chrome: ${obsoleteNcrChrome.join(', ')}`);
}

const financeScreenSource = readFileSync(path.join(assetDir, 'screens-fin2.js'), 'utf8');
const accountLedgerScreenSource = (financeScreenSource.split("SCREENS['account-ledger'] =")[1] || '')
  .split('/* ---------------- CANONICAL BANK RECONCILIATION')[0];
const obsoleteAccountLedgerChrome = ['docwrap','docpage','dochead','docmeta']
  .filter((token) => accountLedgerScreenSource.includes(token));
if (obsoleteAccountLedgerChrome.length) {
  throw new Error(`Account Ledger still rebuilds legacy document chrome: ${obsoleteAccountLedgerChrome.join(', ')}`);
}
const unimplementedAccountLedgerActions = ['Export','Print']
  .filter((token) => new RegExp(`\\b${token}\\b`).test(accountLedgerScreenSource));
if (unimplementedAccountLedgerActions.length) {
  throw new Error(`Account Ledger still exposes an unimplemented action: ${unimplementedAccountLedgerActions.join(', ')}`);
}

const primaryFinanceScreenSource = readFileSync(path.join(assetDir, 'screens-fin.js'), 'utf8');
const journalEntryScreenSource = (primaryFinanceScreenSource.split("SCREENS['journal-entry'] =")[1] || '')
  .split('/* ---------------- PAYMENT VOUCHER')[0];
const obsoleteJournalChrome = ['docwrap','docpage','dochead','docmeta','doclayout','summary']
  .filter((token) => journalEntryScreenSource.includes(token));
if (obsoleteJournalChrome.length) {
  throw new Error(`Journal Entry still rebuilds legacy document chrome: ${obsoleteJournalChrome.join(', ')}`);
}
const paymentVoucherScreenSource = primaryFinanceScreenSource.split("SCREENS['payment-voucher'] =")[1] || '';
const obsoletePaymentVoucherChrome = ['docwrap','docpage','dochead','docmeta','doclayout','summary']
  .filter((token) => paymentVoucherScreenSource.includes(token));
if (obsoletePaymentVoucherChrome.length) {
  throw new Error(`Payment Voucher still rebuilds legacy document chrome: ${obsoletePaymentVoucherChrome.join(', ')}`);
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (async function poll() {
      while (Date.now() < deadline) {
        try {
          const res = await fetch(url, { method: 'GET' });
          if (res) { resolve(); return; }
        } catch { /* not up yet */ }
        await new Promise((r) => setTimeout(r, 300));
      }
      reject(new Error(`${url} did not respond within ${timeoutMs}ms`));
    })();
  });
}

async function startPreviewServer() {
  const viteBin = path.join(WEB_DIR, 'node_modules', '.bin', 'vite');
  if (!existsSync(viteBin)) {
    throw new Error(`${viteBin} not found — run "npm ci --prefix web" first.`);
  }
  const proc = spawn(
    viteBin, ['preview', '--port', PORT, '--strictPort'],
    { cwd: WEB_DIR, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stderrOutput = '';
  proc.stderr.on('data', (buf) => { stderrOutput += buf.toString(); });
  let exitedEarly = false;
  proc.on('exit', () => { exitedEarly = true; });

  try {
    await waitForServer(BASE_URL, 15000);
  } catch (e) {
    proc.kill();
    throw exitedEarly
      ? new Error(`vite preview exited before becoming ready. stderr:\n${stderrOutput}`)
      : e;
  }
  return proc;
}

function findIdentityLeak(text) {
  const lower = text.toLowerCase();
  return IDENTITY_MARKERS.filter((marker) => lower.includes(marker));
}

async function auditRoutes(browser, viewport) {
  // Accumulates errors for whichever route is currently being tested; the
  // loop below clears it after consuming each route's window, so listeners
  // don't need to be attached/detached per iteration.
  const events = []; // {kind, message}
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') events.push({ kind: 'console.error', message: msg.text() });
    if (msg.type() === 'warning' && [
      'Missing i18n key st.— ',
      'Missing i18n key route.sales-order ',
      'Missing i18n key route.sales-return ',
    ].some((prefix)=>msg.text().startsWith(prefix))) {
      events.push({ kind: 'console.error', message: `console.warn: ${msg.text()}` });
    }
  });
  page.on('pageerror', (err) => {
    events.push({ kind: 'pageerror', message: err.message });
  });

  await page.addInitScript(() => {
    try {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      localStorage.setItem('aria-demo-auth', JSON.stringify({ signedIn: true, email: 'admin@acme.co', at: new Date(0).toISOString() }));
    } catch { /* ignore */ }
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
  // The PGlite WASM cold start can outlive network-idle on a constrained CI
  // runner. Keep this locator alive across service-worker navigation and allow
  // more than the adapter's bounded 20s fallback watchdog.
  await page.waitForSelector('.dashgrid', { timeout: 45000, state: 'visible' });

  const asyncRenderIssues = await page.evaluate(async () => {
    const issues = [];
    const dashboardScreen = SCREENS.dashboard;
    const stockScreen = SCREENS['stock-on-hand'];
    const purchasingScreen = SCREENS['purchasing-home'];
    try {
      SCREENS['purchasing-home'] = () => new Promise((resolve) => {
        setTimeout(() => resolve('<div data-async-contract="purchasing">loaded purchasing</div>'), 20);
      });
      const purchasingNavigation = navigate('purchasing-home');
      const purchasingLoadingTitle = document.querySelector('#viewRoot h1')?.textContent?.trim();
      if (purchasingLoadingTitle !== t('nav.purchasing')) {
        issues.push(`Purchasing async loader title drifted: ${purchasingLoadingTitle || 'missing'}`);
      }
      await purchasingNavigation;

      SCREENS.dashboard = () => new Promise((resolve) => {
        setTimeout(() => resolve('<div data-async-contract="slow">stale dashboard</div>'), 80);
      });
      SCREENS['stock-on-hand'] = () => new Promise((resolve) => {
        setTimeout(() => resolve('<div data-async-contract="fast">current inventory</div>'), 10);
      });

      const slowNavigation = navigate('dashboard');
      if (!document.querySelector('#viewRoot .screen-loading')) {
        issues.push('async screen did not render the standard loading skeleton');
      }
      const fastNavigation = navigate('stock-on-hand');
      await Promise.all([slowNavigation, fastNavigation]);
      if (!document.querySelector('#viewRoot [data-async-contract="fast"]')) {
        issues.push('latest async screen result was not committed');
      }
      if (document.querySelector('#viewRoot [data-async-contract="slow"]')) {
        issues.push('stale async screen result replaced the current route');
      }

      SCREENS.dashboard = () => Promise.reject(new Error('contract failure'));
      await navigate('dashboard');
      const errorRoot = document.querySelector('#viewRoot .screen-render-error');
      if (!errorRoot) issues.push('rejected async screen did not render the standard error state');
      if (!/No sample data was substituted/i.test(document.querySelector('#viewRoot')?.innerText || '')) {
        issues.push('async error state does not disclose that sample fallback is disabled');
      }
    } finally {
      SCREENS.dashboard = dashboardScreen;
      SCREENS['stock-on-hand'] = stockScreen;
      SCREENS['purchasing-home'] = purchasingScreen;
      await navigate('dashboard');
    }
    return issues;
  });
  if (asyncRenderIssues.length) {
    throw new Error(`Async SCREENS contract failed: ${asyncRenderIssues.join(' | ')}`);
  }

  const allRoutes = await page.evaluate(() => Object.keys(SCREENS).sort());
  const routeModule = await page.evaluate(() => Object.assign({}, ROUTE_MODULE));
  const screenMeta = await page.evaluate(() => JSON.parse(JSON.stringify(window.SCREEN_META || {})));
  const missingLayoutMeta = allRoutes.filter((route) => !screenMeta[route]?.layout);
  const invalidLayoutMeta = allRoutes.filter((route) => !VALID_LAYOUTS.has(screenMeta[route]?.layout));
  if (missingLayoutMeta.length || invalidLayoutMeta.length) {
    throw new Error([
      missingLayoutMeta.length ? `Routes without an explicit layout: ${missingLayoutMeta.join(', ')}` : '',
      invalidLayoutMeta.length ? `Routes with an invalid layout: ${invalidLayoutMeta.join(', ')}` : '',
    ].filter(Boolean).join(' | '));
  }
  const routes = PAYROLL_RUN_ONLY
    ? allRoutes.filter((route) => route === 'payroll-run')
    : LIST_LAYOUT_ONLY
    ? allRoutes.filter((route) => LIST_LAYOUTS.has(screenMeta[route]?.layout))
    : WORKSPACE_LAYOUT_ONLY
      ? allRoutes.filter((route) => screenMeta[route]?.layout === OPERATIONAL_WORKSPACE_LAYOUT)
      : CALENDAR_WORKSPACE_ONLY
        ? allRoutes.filter((route) => screenMeta[route]?.layout === CALENDAR_WORKSPACE_LAYOUT)
      : MASTER_DETAIL_EDITOR_ONLY
        ? allRoutes.filter((route) => screenMeta[route]?.layout === MASTER_DETAIL_EDITOR_LAYOUT)
        : CASE_DETAIL_ONLY
          ? allRoutes.filter((route) => screenMeta[route]?.layout === CASE_DETAIL_LAYOUT)
          : LEDGER_DETAIL_ONLY
            ? allRoutes.filter((route) => screenMeta[route]?.layout === LEDGER_DETAIL_LAYOUT)
            : POSTING_DETAIL_ONLY
              ? allRoutes.filter((route) => screenMeta[route]?.layout === POSTING_DETAIL_LAYOUT)
              : FINANCIAL_STATEMENT_ONLY
                ? allRoutes.filter((route) => screenMeta[route]?.layout === FINANCIAL_STATEMENT_LAYOUT)
                : DOCUMENT_DETAIL_ONLY
                  ? allRoutes.filter((route) => screenMeta[route]?.layout === 'document-detail')
                : allRoutes;
  if (DOCUMENT_DETAIL_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare a document-detail layout.');
  }
  if (LIST_LAYOUT_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare a shared list layout.');
  }
  if (PAYROLL_RUN_ONLY && routes.length === 0) {
    throw new Error('Payroll Run screen is not registered.');
  }
  if (WORKSPACE_LAYOUT_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare an operational workspace layout.');
  }
  if (CALENDAR_WORKSPACE_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare a calendar workspace layout.');
  }
  if (MASTER_DETAIL_EDITOR_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare a master-detail editor layout.');
  }
  if (CASE_DETAIL_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare a case detail layout.');
  }
  if (LEDGER_DETAIL_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare a ledger detail layout.');
  }
  if (POSTING_DETAIL_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare a posting detail layout.');
  }
  if (FINANCIAL_STATEMENT_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare a financial statement layout.');
  }
  const missingAdapterMethods = await page.evaluate(() => {
    const required = ['list','get','create','update','action','refresh','session','switchCompany'];
    if (!window.ErpSystemData) return ['ErpSystemData'];
    return required.filter((name) => typeof window.ErpSystemData[name] !== 'function');
  });
  if (missingAdapterMethods.length) {
    throw new Error(`ErpSystemData contract missing: ${missingAdapterMethods.join(', ')}`);
  }
  console.log(`[${viewport.label}] Found ${routes.length} routes registered in SCREENS.`);

  const results = [];

  for (const route of routes) {
    const meta = screenMeta[route] || null;
    const throwMessage = await page.evaluate(async ({ r, fixture }) => {
      try {
        if (fixture === 'sales-enquiry') {
          if (!DB.enquiries || !DB.enquiries[0]) throw new Error('sales-enquiry fixture has no record');
          openTxn('enquiry', DB.enquiries[0]);
        } else if (fixture === 'purchasing-rfq') {
          if (!DB.rfqs || !DB.rfqs[0]) throw new Error('purchasing-rfq fixture has no record');
          openPurTxn('rfq', DB.rfqs[0]);
        } else {
          await navigate(r);
        }
        return null;
      } catch (e) {
        return e && e.message ? e.message : String(e);
      }
    }, { r: route, fixture: meta && meta.fixture });

    await page.waitForTimeout(SETTLE_MS);

    const rendered = await page.evaluate(() => {
      const el = document.getElementById('viewRoot');
      if (!el) return { text: '', previewBanner: false, enabledPreviewWrites: [], layoutIssues: ['viewRoot missing'], moduleShell: false, renderError: true };
      const nav = el.querySelector('.sales-subnav');
      const active = nav && nav.querySelector('[aria-selected="true"]');
      const navRect = nav && nav.getBoundingClientRect();
      const activeRect = active && active.getBoundingClientRect();
      const enabledPreviewWrites = [...el.querySelectorAll('button')].filter((button) => {
        if (button.disabled) return false;
        if (button.closest('.crumb,.sales-subnav,.tabs,.filterchips,.seg,.viewsel')) return false;
        return /\b(new|create|save|post|approve|reject|delete|edit|receive|convert|issue|release|adjust|transfer|reconcile|import|upload|invite|add|run payroll|start|complete|dispose|record payment)\b/i
          .test((button.textContent || '').replace(/\s+/g, ' ').trim());
      }).map((button) => (button.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
      const layoutIssues = [];
      if (document.documentElement.scrollWidth > window.innerWidth + 1) {
        layoutIssues.push(`page overflow ${document.documentElement.scrollWidth}>${window.innerWidth}`);
      }
      if (nav && active && (activeRect.left < navRect.left - 1 || activeRect.right > navRect.right + 1)) {
        layoutIssues.push('active subnav is outside the visible strip');
      }
      [...el.querySelectorAll('.set-savebar,.responsive-actionbar,.bulkbar')].forEach((bar) => {
        if (bar.offsetParent !== null && bar.scrollWidth > bar.clientWidth + 1) {
          layoutIssues.push(`${bar.className} overflow ${bar.scrollWidth}>${bar.clientWidth}`);
        }
      });
      const isDocumentDetail=window.SCREEN_META?.[CURRENT_ROUTE]?.layout==='document-detail';
      if (isDocumentDetail) {
        const documentPage=el.querySelector('.docpage,.payslip-page,[data-supplier-detail]');
        const legacyTitles=[...el.querySelectorAll('.dh-row1 .dt:not(h1)')];
        if (!el.querySelector('h1')) {
          layoutIssues.push('document detail is missing a semantic H1');
        }
        if (legacyTitles.length) {
          layoutIssues.push(`document detail uses ${legacyTitles.length} non-semantic title element(s)`);
        }
        [...el.querySelectorAll('table.lines')].forEach((table,index)=>{
          const parent=table.parentElement;
          const style=parent?getComputedStyle(parent):null;
          if (!style||!['auto','scroll'].includes(style.overflowX)) {
            layoutIssues.push(`document detail table ${index+1} is missing a bounded horizontal scroll container`);
          }
        });
        if (documentPage&&window.innerWidth>1180) {
          const available=el.querySelector('.master')?.clientWidth||window.innerWidth;
          const expected=Math.min(1280,Math.max(0,available-48));
          const width=documentPage.getBoundingClientRect().width;
          if (width+2<expected) {
            layoutIssues.push(`document detail wastes desktop width (${Math.round(width)}<${Math.round(expected)})`);
          }
        }
        const pageRect=documentPage?.getBoundingClientRect();
        [...el.querySelectorAll('.docwrap + .set-savebar,.docwrap + .responsive-actionbar')].forEach((bar)=>{
          const rect=bar.getBoundingClientRect();
          if (pageRect&&window.innerWidth>980&&rect.width>pageRect.width+2) {
            layoutIssues.push(`document action bar is wider than its document (${Math.round(rect.width)}>${Math.round(pageRect.width)})`);
          }
        });
      }
      const avatarNodes = [
        ...document.querySelectorAll('#avatarBtn,.acct-head .av'),
        ...el.querySelectorAll('.kc-av,.pav,.pmini,.cav,.set-avatar'),
      ];
      avatarNodes.forEach((avatar) => {
        const media=avatar.querySelector('img,svg');
        if (!media) {
          const value=(avatar.textContent||'').trim().slice(0,24);
          layoutIssues.push(`profile avatar is missing image/SVG fallback${value?`: ${value}`:''}`);
        }
        const image=avatar.querySelector('img');
        if (image && !avatar.querySelector('svg.profile-avatar-fallback')) {
          layoutIssues.push('profile image is missing its SVG error fallback');
        }
      });
      const listRoot = el.querySelector([
        '[data-layout="transaction-list-v1"]',
        '[data-layout="master-detail-register-v1"]',
        '[data-layout="report-list-v1"]',
      ].join(','));
      const actualListLayout = listRoot?.getAttribute('data-layout') || null;
      const listRows = [...(listRoot?.querySelectorAll('[data-list-table] .dt-body .dt-r[data-row]')||[])];
      const interactiveListRows = listRows.filter((row)=>row.dataset.rowInteraction!=='none');
      const staticListRows = listRows.filter((row)=>row.dataset.rowInteraction==='none');
      const invalidInteractiveRows = interactiveListRows.filter((row)=>{
        const style=getComputedStyle(row);
        return !['open','select'].includes(row.dataset.rowInteraction)
          || row.tabIndex!==0
          || !row.getAttribute('aria-label')
          || !row.classList.contains('is-interactive')
          || style.cursor!=='pointer';
      }).map((row)=>row.dataset.row);
      const invalidStaticRows = staticListRows.filter((row)=>{
        const style=getComputedStyle(row);
        return row.hasAttribute('tabindex')
          || row.hasAttribute('aria-label')
          || row.classList.contains('is-interactive')
          || row.classList.contains('sel')
          || style.cursor==='pointer';
      }).map((row)=>row.dataset.row);
      const timesheetRoot = el.querySelector('[data-layout="transaction-list-v1"][data-list-route="timesheet"]');
      const listRegions = listRoot ? [
        listRoot.querySelector('[data-list-kpis]'),
        listRoot.querySelector('[data-list-toolbar]'),
        listRoot.querySelector('[data-list-table]'),
        listRoot.querySelector('[data-list-pagination]'),
      ] : [];
      const masterDetailRegions = actualListLayout === 'master-detail-register-v1' ? [
        listRoot.querySelector('[data-master-detail-workspace]'),
        listRoot.querySelector('[data-master-detail-panel]'),
      ] : [];
      const listRegionOrder = listRegions.length === 4
        && listRegions.every(Boolean)
        && listRegions.every((node, index) => index === 0
          || Boolean(listRegions[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
      const workspaceRoot = el.querySelector('[data-layout="operational-workspace-v1"]');
      const workspaceRegions = workspaceRoot ? [
        workspaceRoot.querySelector('[data-workspace-progress]'),
        workspaceRoot.querySelector('[data-workspace-main]'),
        workspaceRoot.querySelector('[data-workspace-context]'),
        workspaceRoot.querySelector('[data-workspace-actions]'),
      ] : [];
      const workspaceRegionOrder = workspaceRegions.length === 4
        && workspaceRegions.every(Boolean)
        && workspaceRegions.every((node, index) => index === 0
          || Boolean(workspaceRegions[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
      const workspaceProgress = workspaceRegions[0]
        ? Number(workspaceRegions[0].getAttribute('data-progress-value'))
        : null;
      if (workspaceRoot && (!Number.isFinite(workspaceProgress) || workspaceProgress < 0 || workspaceProgress > 100)) {
        layoutIssues.push(`operational workspace progress is invalid: ${workspaceProgress}`);
      }
      if (workspaceRoot && workspaceRegions[3] && workspaceRegions[3].offsetParent !== null
          && workspaceRegions[3].scrollWidth > workspaceRegions[3].clientWidth + 1) {
        layoutIssues.push(`operational workspace actions overflow ${workspaceRegions[3].scrollWidth}>${workspaceRegions[3].clientWidth}`);
      }
      if (workspaceRoot && window.innerWidth <= 980 && workspaceRegions[1] && workspaceRegions[2]) {
        const mainRect = workspaceRegions[1].getBoundingClientRect();
        const contextRect = workspaceRegions[2].getBoundingClientRect();
        if (contextRect.top < mainRect.bottom - 1) {
          layoutIssues.push('operational workspace context does not follow the main work area on mobile');
        }
      }
      const calendarRoot = el.querySelector('[data-layout="calendar-workspace-v1"]');
      const calendarRegions = calendarRoot ? [
        calendarRoot.querySelector('[data-calendar-header]'),
        calendarRoot.querySelector('[data-calendar-filters]'),
        calendarRoot.querySelector('[data-calendar-surface]'),
        calendarRoot.querySelector('[data-calendar-detail]'),
        calendarRoot.querySelector('[data-calendar-error]'),
        calendarRoot.querySelector('[data-calendar-actions]'),
      ] : [];
      const calendarRegionOrder = calendarRegions.length === 6
        && calendarRegions.every(Boolean)
        && calendarRegions.every((node,index)=>index === 0
          || Boolean(calendarRegions[index - 1].compareDocumentPosition(node)
            & Node.DOCUMENT_POSITION_FOLLOWING));
      if (calendarRoot && calendarRegions[5] && calendarRegions[5].offsetParent !== null
          && calendarRegions[5].scrollWidth > calendarRegions[5].clientWidth + 1) {
        layoutIssues.push(`calendar workspace actions overflow ${calendarRegions[5].scrollWidth}>${calendarRegions[5].clientWidth}`);
      }
      const masterDetailEditorRoot = el.querySelector('[data-layout="master-detail-editor-v1"]');
      const masterDetailEditorRegions = masterDetailEditorRoot ? [
        masterDetailEditorRoot.querySelector('[data-master-detail-overview]'),
        masterDetailEditorRoot.querySelector('[data-master-detail-error]'),
        masterDetailEditorRoot.querySelector('[data-master-detail-main]'),
        masterDetailEditorRoot.querySelector('[data-master-detail-context]'),
        masterDetailEditorRoot.querySelector('[data-master-detail-actions]'),
      ] : [];
      const masterDetailEditorOrder = masterDetailEditorRegions.length === 5
        && masterDetailEditorRegions.every(Boolean)
        && masterDetailEditorRegions.every((node,index)=>index === 0
          || Boolean(masterDetailEditorRegions[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
      const masterDetailEditorPageActions = el.querySelector('[data-master-detail-page-actions]');
      if (masterDetailEditorPageActions && masterDetailEditorPageActions.offsetParent !== null
          && masterDetailEditorPageActions.scrollWidth > masterDetailEditorPageActions.clientWidth + 1) {
        layoutIssues.push(
          `master-detail editor page actions overflow ${masterDetailEditorPageActions.scrollWidth}>${masterDetailEditorPageActions.clientWidth}`,
        );
      }
      if (masterDetailEditorRoot && masterDetailEditorRegions[4]
          && masterDetailEditorRegions[4].offsetParent !== null
          && masterDetailEditorRegions[4].scrollWidth > masterDetailEditorRegions[4].clientWidth + 1) {
        layoutIssues.push(`master-detail editor actions overflow ${masterDetailEditorRegions[4].scrollWidth}>${masterDetailEditorRegions[4].clientWidth}`);
      }
      if (masterDetailEditorRoot && masterDetailEditorRegions[2] && masterDetailEditorRegions[3]
          && masterDetailEditorRegions[3].offsetParent !== null) {
        const mainRect = masterDetailEditorRegions[2].getBoundingClientRect();
        const contextRect = masterDetailEditorRegions[3].getBoundingClientRect();
        if (window.innerWidth <= 980 && contextRect.top < mainRect.bottom - 1) {
          layoutIssues.push('master-detail editor context does not follow the main area on mobile');
        }
        if (window.innerWidth > 980 && contextRect.left < mainRect.right - 1) {
          layoutIssues.push('master-detail editor main and context are not separate desktop columns');
        }
      }
      if (masterDetailEditorRoot && masterDetailEditorRoot.querySelector('.docpage,.doclayout')) {
        layoutIssues.push('master-detail editor still renders legacy document chrome');
      }
      [...(masterDetailEditorRoot?.querySelectorAll('table.lines')||[])].forEach((table)=>{
        if (!table.closest('.master-detail-editor-table-scroll')) {
          layoutIssues.push('master-detail editor table is missing its bounded scroll container');
        }
      });
      const caseDetailRoot = el.querySelector('[data-layout="case-detail-v1"]');
      const caseDetailRegions = caseDetailRoot ? [
        caseDetailRoot.querySelector('[data-case-overview]'),
        caseDetailRoot.querySelector('[data-case-error]'),
        caseDetailRoot.querySelector('[data-case-main]'),
        caseDetailRoot.querySelector('[data-case-context]'),
        caseDetailRoot.querySelector('[data-case-actions]'),
      ] : [];
      const caseDetailOrder = caseDetailRegions.length === 5
        && caseDetailRegions.every(Boolean)
        && caseDetailRegions.every((node,index)=>index === 0
          || Boolean(caseDetailRegions[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (caseDetailRoot && caseDetailRegions[4]
          && caseDetailRegions[4].offsetParent !== null
          && caseDetailRegions[4].scrollWidth > caseDetailRegions[4].clientWidth + 1) {
        layoutIssues.push(`case detail actions overflow ${caseDetailRegions[4].scrollWidth}>${caseDetailRegions[4].clientWidth}`);
      }
      if (caseDetailRoot && caseDetailRegions[2] && caseDetailRegions[3]) {
        const mainRect = caseDetailRegions[2].getBoundingClientRect();
        const contextRect = caseDetailRegions[3].getBoundingClientRect();
        if (window.innerWidth <= 980 && contextRect.top < mainRect.bottom - 1) {
          layoutIssues.push('case detail context does not follow the main area on mobile');
        }
        if (window.innerWidth > 980 && contextRect.left < mainRect.right - 1) {
          layoutIssues.push('case detail main and context are not separate desktop columns');
        }
        const actions = caseDetailRegions[4];
        if (window.innerWidth <= 560 && actions?.offsetParent !== null) {
          const actionRect = actions.getBoundingClientRect();
          if (actionRect.top < Math.max(mainRect.bottom,contextRect.bottom) - 1) {
            layoutIssues.push('case detail actions obscure review content on mobile');
          }
        }
      }
      if (caseDetailRoot && caseDetailRoot.querySelector('.docwrap,.docpage,.dochead,.docmeta,.doclayout,.appr-layout,.stepper')) {
        layoutIssues.push('case detail still renders legacy document chrome');
      }
      const serviceOrderRoot = caseDetailRoot?.getAttribute('data-case-route') === 'service-order'
        ? caseDetailRoot
        : null;
      const serviceOrderOverflow = serviceOrderRoot
        ? [
            serviceOrderRoot,
            serviceOrderRoot.querySelector('[data-case-overview]'),
            serviceOrderRoot.querySelector('[data-case-lifecycle]'),
            serviceOrderRoot.querySelector('.case-detail-facts'),
            serviceOrderRoot.querySelector('[data-case-main]'),
            serviceOrderRoot.querySelector('[data-case-context]'),
            serviceOrderRoot.querySelector('[data-case-actions]'),
          ].filter((node)=>node&&node.offsetParent!==null&&node.scrollWidth>node.clientWidth+1)
            .map((node)=>`${node.className||node.tagName} ${node.scrollWidth}>${node.clientWidth}`)
        : [];
      if (serviceOrderOverflow.length) {
        layoutIssues.push(`Service Order internal overflow: ${serviceOrderOverflow.join(', ')}`);
      }
      const poApprovalRoot = caseDetailRoot?.getAttribute('data-case-route') === 'po-approval'
        ? caseDetailRoot
        : null;
      const poApprovalOverflow = poApprovalRoot
        ? [
            poApprovalRoot,
            poApprovalRoot.querySelector('[data-case-overview]'),
            poApprovalRoot.querySelector('.case-detail-facts'),
            poApprovalRoot.querySelector('[data-case-main]'),
            poApprovalRoot.querySelector('[data-case-context]'),
            poApprovalRoot.querySelector('[data-case-actions]'),
          ].filter((node)=>node&&node.offsetParent!==null&&node.scrollWidth>node.clientWidth+1)
            .map((node)=>`${node.className||node.tagName} ${node.scrollWidth}>${node.clientWidth}`)
        : [];
      if (poApprovalOverflow.length) {
        layoutIssues.push(`PO Approval internal overflow: ${poApprovalOverflow.join(', ')}`);
      }
      const ledgerDetailRoot = el.querySelector('[data-layout="ledger-detail-v1"]');
      const ledgerDetailRegions = ledgerDetailRoot ? [
        ledgerDetailRoot.querySelector('[data-ledger-overview]'),
        ledgerDetailRoot.querySelector('[data-ledger-error]'),
        ledgerDetailRoot.querySelector('[data-ledger-toolbar]'),
        ledgerDetailRoot.querySelector('[data-ledger-table]'),
        ledgerDetailRoot.querySelector('[data-ledger-footer]'),
      ] : [];
      const ledgerDetailOrder = ledgerDetailRegions.length === 5
        && ledgerDetailRegions.every(Boolean)
        && ledgerDetailRegions.every((node,index)=>index === 0
          || Boolean(ledgerDetailRegions[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
      const ledgerTableStyle = ledgerDetailRegions[3] ? getComputedStyle(ledgerDetailRegions[3]) : null;
      const ledgerTableBounded = Boolean(
        ledgerDetailRegions[3]
        && ledgerTableStyle
        && ['auto','scroll'].includes(ledgerTableStyle.overflowX)
      );
      if (ledgerDetailRoot && ledgerDetailRegions[2]
          && ledgerDetailRegions[2].offsetParent !== null
          && ledgerDetailRegions[2].scrollWidth > ledgerDetailRegions[2].clientWidth + 1) {
        layoutIssues.push(`ledger detail toolbar overflow ${ledgerDetailRegions[2].scrollWidth}>${ledgerDetailRegions[2].clientWidth}`);
      }
      if (ledgerDetailRoot && ledgerDetailRegions[4]
          && ledgerDetailRegions[4].offsetParent !== null
          && ledgerDetailRegions[4].scrollWidth > ledgerDetailRegions[4].clientWidth + 1) {
        layoutIssues.push(`ledger detail footer overflow ${ledgerDetailRegions[4].scrollWidth}>${ledgerDetailRegions[4].clientWidth}`);
      }
      if (ledgerDetailRoot && !ledgerTableBounded) {
        layoutIssues.push('ledger detail table is missing its bounded scroll container');
      }
      if (ledgerDetailRoot && ledgerDetailRoot.querySelector('.docwrap,.docpage,.dochead,.docmeta')) {
        layoutIssues.push('ledger detail still renders legacy document chrome');
      }
      const ledgerUnhandledActions = ledgerDetailRoot
        ? [...ledgerDetailRoot.querySelectorAll('button')].filter((button) => /\b(export|print)\b/i.test(button.textContent || ''))
        : [];
      if (ledgerUnhandledActions.length) {
        layoutIssues.push('ledger detail exposes Export or Print without an implementation');
      }
      const postingDetailRoot = el.querySelector('[data-layout="posting-detail-v1"]');
      const postingDetailRegions = postingDetailRoot ? [
        postingDetailRoot.querySelector('[data-posting-overview]'),
        postingDetailRoot.querySelector('[data-posting-error]'),
        postingDetailRoot.querySelector('[data-posting-main]'),
        postingDetailRoot.querySelector('[data-posting-context]'),
        postingDetailRoot.querySelector('[data-posting-actions]'),
      ] : [];
      const postingDetailOrder = postingDetailRegions.length === 5
        && postingDetailRegions.every(Boolean)
        && postingDetailRegions.every((node,index)=>index === 0
          || Boolean(postingDetailRegions[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (postingDetailRoot && postingDetailRegions[4]
          && postingDetailRegions[4].offsetParent !== null
          && postingDetailRegions[4].scrollWidth > postingDetailRegions[4].clientWidth + 1) {
        layoutIssues.push(`posting detail actions overflow ${postingDetailRegions[4].scrollWidth}>${postingDetailRegions[4].clientWidth}`);
      }
      if (postingDetailRoot && postingDetailRegions[2] && postingDetailRegions[3]) {
        const mainRect = postingDetailRegions[2].getBoundingClientRect();
        const contextRect = postingDetailRegions[3].getBoundingClientRect();
        if (window.innerWidth <= 980 && postingDetailRegions[3].offsetParent !== null && contextRect.top < mainRect.bottom - 1) {
          layoutIssues.push('posting detail context does not follow the main area on mobile');
        }
        if (window.innerWidth > 980 && postingDetailRegions[3].offsetParent !== null && contextRect.left < mainRect.right - 1) {
          layoutIssues.push('posting detail main and context are not separate desktop columns');
        }
        const actions = postingDetailRegions[4];
        if (window.innerWidth <= 560 && actions?.offsetParent !== null
            && postingDetailRegions[3].offsetParent !== null) {
          const actionRect = actions.getBoundingClientRect();
          if (actionRect.top < Math.max(mainRect.bottom,contextRect.bottom) - 1) {
            layoutIssues.push('posting detail actions obscure accounting context on mobile');
          }
        }
      }
      if (postingDetailRoot && postingDetailRoot.querySelector('.docwrap,.docpage,.dochead,.docmeta,.doclayout,.summary')) {
        layoutIssues.push('posting detail still renders legacy document chrome');
      }
      const postingLinesScroll = postingDetailRoot?.querySelector('.posting-lines-scroll');
      const postingLinesStyle = postingLinesScroll ? getComputedStyle(postingLinesScroll) : null;
      const postingLinesBounded = Boolean(
        postingLinesScroll
        && postingLinesStyle
        && ['auto','scroll'].includes(postingLinesStyle.overflowX)
      );
      if (postingDetailRoot?.querySelector('[data-posting-lines]') && !postingLinesBounded) {
        layoutIssues.push('posting lines table is missing its bounded scroll container');
      }
      const goodsReceiptRoot = postingDetailRoot?.getAttribute('data-posting-route') === 'goods-receipt'
        ? postingDetailRoot
        : null;
      const goodsReceiptOverflow = goodsReceiptRoot
        ? [
            goodsReceiptRoot,
            goodsReceiptRoot.querySelector('[data-posting-overview]'),
            goodsReceiptRoot.querySelector('.posting-detail-facts'),
            goodsReceiptRoot.querySelector('[data-posting-main]'),
            goodsReceiptRoot.querySelector('[data-posting-context]'),
            goodsReceiptRoot.querySelector('[data-posting-actions]'),
          ].filter((node)=>node&&node.offsetParent!==null&&node.scrollWidth>node.clientWidth+1)
            .map((node)=>`${node.className||node.tagName} ${node.scrollWidth}>${node.clientWidth}`)
        : [];
      if (goodsReceiptOverflow.length) {
        layoutIssues.push(`Goods Receipt internal overflow: ${goodsReceiptOverflow.join(', ')}`);
      }
      const financialStatementRoot = el.querySelector('[data-layout="financial-statement-v1"]');
      const financialStatementRegions = financialStatementRoot ? [
        financialStatementRoot.querySelector('[data-financial-summary]'),
        financialStatementRoot.querySelector('[data-financial-filters]'),
        financialStatementRoot.querySelector('[data-financial-error]'),
        financialStatementRoot.querySelector('[data-financial-statement]'),
        financialStatementRoot.querySelector('[data-financial-actions]'),
        financialStatementRoot.querySelector('[data-financial-export-status]'),
      ] : [];
      const financialStatementOrder = financialStatementRegions.length === 6
        && financialStatementRegions.every(Boolean)
        && financialStatementRegions.every((node,index)=>index === 0
          || Boolean(financialStatementRegions[index - 1].compareDocumentPosition(node)
            & Node.DOCUMENT_POSITION_FOLLOWING));
      const financialTable = financialStatementRoot?.querySelector('.financial-statement-body');
      const financialTableStyle = financialTable ? getComputedStyle(financialTable) : null;
      const financialTableBounded = Boolean(
        financialTable && financialTableStyle
        && ['auto','scroll'].includes(financialTableStyle.overflowX)
      );
      if (financialStatementRoot && financialStatementRoot.querySelector('.report,.report-params,.report-result')) {
        layoutIssues.push('financial statement still renders legacy report chrome');
      }
      if (financialStatementRoot && !financialTableBounded) {
        layoutIssues.push('financial statement table is missing bounded horizontal scrolling');
      }
      if (financialStatementRoot && /cash|actual reference|reference equals actual/i.test(financialStatementRoot.innerText || '')) {
        layoutIssues.push('financial statement exposes a fake Cash or Actual-as-Budget control');
      }
      return {
        text: el.innerText || '',
        previewBanner: Boolean(el.querySelector('[data-preview-banner]')),
        enabledPreviewWrites,
        layoutIssues,
        listLayout: {
          present: Boolean(listRoot),
          actualLayout: actualListLayout,
          rowCount:listRows.length,
          interactiveRows:interactiveListRows.length,
          staticRows:staticListRows.length,
          invalidInteractiveRows,
          invalidStaticRows,
          missingRegions: listRoot
            ? ['kpis','toolbar','table','pagination'].filter((_, index) => !listRegions[index])
            : [],
          ordered: listRegionOrder,
          missingMasterDetailRegions: actualListLayout === 'master-detail-register-v1'
              ? ['workspace','detail-panel'].filter((_,index)=>!masterDetailRegions[index])
              : [],
        },
        timesheetLayout: {
          pageheads: el.querySelectorAll('.pagehead').length,
          canonicalMarker: timesheetRoot?.getAttribute('data-canonical-timesheet') === 'true',
          kpis: timesheetRoot?.querySelectorAll('[data-list-kpis] .so-kpi').length || 0,
          weekButtons: timesheetRoot?.querySelectorAll('[data-ts-week-controls] button').length || 0,
          weekLabels: timesheetRoot?.querySelectorAll('[data-ts-week-label]').length || 0,
          primaryActions: el.querySelectorAll('[data-list-primary-action]').length,
          semanticTables: el.querySelectorAll('table.lines').length,
          legacyChrome: Boolean(el.querySelector('.docpage,.statgrid')),
          unsupportedActions: [...el.querySelectorAll('button')]
            .map((button) => (button.textContent || '').replace(/\s+/g,' ').trim())
            .filter((label) => /\b(capacity|copy last week|submit for approval|payroll|export)\b/i.test(label)),
        },
        employeeLayout: {
          canonicalMarker: masterDetailEditorRoot?.getAttribute('data-canonical-employee') === 'true',
          avatar: Boolean(masterDetailEditorRoot?.querySelector('.master-detail-editor-avatar .profile-avatar')),
          factCount: masterDetailEditorRoot?.querySelectorAll('[data-master-detail-overview] .master-detail-editor-fact').length || 0,
          contactFacts: masterDetailEditorRoot?.querySelectorAll('[data-employee-contact] .master-detail-editor-fact').length || 0,
          readonlyInputs: masterDetailEditorRoot?.querySelectorAll('input[readonly]').length || 0,
          leaveBalance: Boolean(masterDetailEditorRoot?.querySelector('[data-employee-leave-balance]')),
          controlledLeaveTable: [...(masterDetailEditorRoot?.querySelectorAll('[data-employee-leave-history] table.lines') || [])]
            .every((table) => Boolean(table.closest('.master-detail-editor-table-scroll'))),
          headerStatuses: masterDetailEditorPageActions?.querySelectorAll('.cap').length || 0,
          headerReviewActions: masterDetailEditorPageActions?.querySelectorAll('[data-employee-review]').length || 0,
          footerActions: masterDetailEditorRegions[4]?.querySelectorAll('button').length || 0,
          footerHidden: Boolean(masterDetailEditorRegions[4]?.hasAttribute('hidden')),
          backActions: el.querySelectorAll('[data-employee-back]').length,
          legacyChrome: Boolean(masterDetailEditorRoot?.querySelector('.docwrap,.docpage,.dochead,.doclayout,.summary,.sumcard')),
        },
        serviceContractLayout: {
          canonicalMarker: masterDetailEditorRoot?.getAttribute('data-canonical-service-contract') === 'true',
          factCount: masterDetailEditorRoot?.querySelectorAll('[data-master-detail-overview] .master-detail-editor-fact').length || 0,
          customerActions: masterDetailEditorPageActions?.querySelectorAll('[data-service-contract-customer]').length || 0,
          commercialTerms: Boolean(masterDetailEditorRoot?.querySelector('[data-service-contract-commercial]')),
          renewalContext: Boolean(masterDetailEditorRoot?.querySelector('[data-service-contract-renewal]')),
          footerActions: masterDetailEditorRegions[4]?.querySelectorAll('button').length || 0,
          footerHidden: Boolean(masterDetailEditorRegions[4]?.hasAttribute('hidden')),
        },
        arAgingLayout: {
          pageheads: el.querySelectorAll('.pagehead').length,
          legacyReportChrome: Boolean(listRoot?.querySelector('.report,.report-params,.report-result')),
          nativeSelects: listRoot?.querySelectorAll('select').length || 0,
          comboboxes: listRoot?.querySelectorAll('input[role="combobox"]').length || 0,
          exportActions: [...(listRoot?.querySelectorAll('button') || [])]
            .filter((button) => /\b(excel|export|print)\b/i.test(button.textContent || '')).length,
          runActions: [...(listRoot?.querySelectorAll('button') || [])]
            .filter((button) => /\b(run report|jalankan laporan|运行报表|レポート実行|chạy báo cáo)\b/i
              .test(button.textContent || '')).length,
          customerToast: /customer detail/i.test(listRoot?.textContent || ''),
        },
        leaveApprovalLayout: {
          pageheads: el.querySelectorAll('.pagehead').length,
          legacyChrome: Boolean(el.querySelector('#lvContent,#lvDetail,.approvebar,[data-lv],[data-f]')),
          exportActions: [...el.querySelectorAll('button')]
            .filter((button) => /\b(export|excel|print)\b/i.test(button.textContent || '')).length,
          detailPresent: Boolean(el.querySelector('[data-master-detail-panel]')),
          detailOpen: Boolean(el.querySelector('[data-master-detail-panel].open')),
          visibleRows: el.querySelectorAll('[data-list-table] .dt-r[data-row]').length,
          pendingActions: el.querySelectorAll('[data-leave-action]:not([disabled])').length,
        },
        payrollRunLayout: {
          pageheads: el.querySelectorAll('.pagehead').length,
          legacyChrome: Boolean(el.querySelector('.report,.report-params,.report-result,#runPicker')),
          nativeSelects: el.querySelectorAll('[data-list-route="payroll-run"] select').length,
          detailPresent: Boolean(el.querySelector('[data-list-route="payroll-run"] [data-master-detail-panel]')),
          detailOpen: Boolean(el.querySelector('[data-list-route="payroll-run"] [data-master-detail-panel].open')),
          visibleRows: el.querySelectorAll('[data-list-route="payroll-run"] [data-list-table] .dt-r[data-row]').length,
          postActions: el.querySelectorAll('[data-payroll-action="post"]:not([disabled])').length,
          payrollLines: el.querySelectorAll('[data-payroll-line]').length,
          controlledLines: [...el.querySelectorAll('[data-list-route="payroll-run"] table.lines')]
            .every((table) => Boolean(table.closest('.payroll-lines-scroll'))),
        },
        workspaceLayout: {
          present: Boolean(workspaceRoot),
          actualLayout: workspaceRoot?.getAttribute('data-layout') || null,
          missingRegions: workspaceRoot
            ? ['progress','main','context','actions'].filter((_,index)=>!workspaceRegions[index])
            : [],
          ordered: workspaceRegionOrder,
          progress: workspaceProgress,
          pageheads: el.querySelectorAll('.pagehead').length,
          errorRegion: Boolean(workspaceRoot?.querySelector('[data-workspace-error]')),
          incompleteCompletionEnabled: Boolean(
            workspaceProgress < 100
            && workspaceRoot?.querySelector('[data-complete-pick]:not([disabled])')
          ),
        },
        calendarWorkspaceLayout: {
          present: Boolean(calendarRoot),
          actualLayout: calendarRoot?.getAttribute('data-layout') || null,
          missingRegions: calendarRoot
            ? ['header','filters','surface','detail','error','actions']
              .filter((_,index)=>!calendarRegions[index])
            : [],
          ordered: calendarRegionOrder,
          pageheads: el.querySelectorAll('.pagehead').length,
          viewButtons: calendarRoot?.querySelectorAll('[data-calendar-view]').length || 0,
          privacy: calendarRoot?.getAttribute('data-my-work-privacy') || null,
        },
        masterDetailEditorLayout: {
          present: Boolean(masterDetailEditorRoot),
          actualLayout: masterDetailEditorRoot?.getAttribute('data-layout') || null,
          missingRegions: masterDetailEditorRoot
            ? ['overview','error','main','context','actions'].filter((_,index)=>!masterDetailEditorRegions[index])
            : [],
          ordered: masterDetailEditorOrder,
          pageheads: el.querySelectorAll('.pagehead').length,
          errorRegion: Boolean(masterDetailEditorRoot?.querySelector('[data-master-detail-error]')),
          legacyDocumentChrome: Boolean(masterDetailEditorRoot?.querySelector('.docpage,.doclayout')),
        },
        caseDetailLayout: {
          present: Boolean(caseDetailRoot),
          actualLayout: caseDetailRoot?.getAttribute('data-layout') || null,
          missingRegions: caseDetailRoot
            ? ['overview','error','main','context','actions'].filter((_,index)=>!caseDetailRegions[index])
            : [],
          ordered: caseDetailOrder,
          pageheads: el.querySelectorAll('.pagehead').length,
          errorRegion: Boolean(caseDetailRoot?.querySelector('[data-case-error]')),
          legacyDocumentChrome: Boolean(caseDetailRoot?.querySelector('.docwrap,.docpage,.dochead,.docmeta,.doclayout,.appr-layout,.stepper')),
        },
        serviceOrderLayout: {
          canonicalMarker: serviceOrderRoot?.getAttribute('data-canonical-service-order') === 'true',
          h1s: el.querySelectorAll('.pagehead h1').length,
          lifecycleSteps: serviceOrderRoot?.querySelectorAll('[data-case-lifecycle-step]').length || 0,
          lifecycleCurrent: serviceOrderRoot?.querySelectorAll('[data-case-lifecycle-step][aria-current="step"]').length || 0,
          factCount: serviceOrderRoot?.querySelectorAll('.case-detail-fact').length || 0,
          customerActions: serviceOrderRoot?.querySelectorAll('[data-service-customer]').length || 0,
          diagnosis: Boolean(serviceOrderRoot?.querySelector('[data-service-diagnosis]')),
          sla: Boolean(serviceOrderRoot?.querySelector('[data-service-sla]')),
          contract: Boolean(serviceOrderRoot?.querySelector('[data-service-contract]')),
          actionsHidden: Boolean(serviceOrderRoot?.querySelector('[data-case-actions][hidden]')),
          actionButtons: serviceOrderRoot?.querySelectorAll('[data-case-actions] button').length || 0,
          internalOverflow: serviceOrderOverflow,
        },
        poApprovalLayout: {
          canonicalMarker: poApprovalRoot?.getAttribute('data-canonical-po-approval') === 'true',
          h1s: el.querySelectorAll('.pagehead h1').length,
          factCount: poApprovalRoot?.querySelectorAll('.case-detail-fact').length || 0,
          lines: Boolean(poApprovalRoot?.querySelector('[data-po-lines]')),
          controlledLines: Boolean(poApprovalRoot?.querySelector('[data-po-lines] .master-detail-editor-table-scroll')),
          totals: Boolean(poApprovalRoot?.querySelector('[data-po-totals]')),
          decision: Boolean(poApprovalRoot?.querySelector('[data-po-decision]')),
          actionsHidden: Boolean(poApprovalRoot?.querySelector('[data-case-actions][hidden]')),
          approveActions: poApprovalRoot?.querySelectorAll('[data-po-approve]').length || 0,
          rejectActions: poApprovalRoot?.querySelectorAll('[data-po-reject]').length || 0,
          backActions: poApprovalRoot?.querySelectorAll('[data-po-back]').length || 0,
          internalOverflow: poApprovalOverflow,
        },
        ledgerDetailLayout: {
          present: Boolean(ledgerDetailRoot),
          actualLayout: ledgerDetailRoot?.getAttribute('data-layout') || null,
          missingRegions: ledgerDetailRoot
            ? ['overview','error','toolbar','table','footer'].filter((_,index)=>!ledgerDetailRegions[index])
            : [],
          ordered: ledgerDetailOrder,
          pageheads: el.querySelectorAll('.pagehead').length,
          errorRegion: Boolean(ledgerDetailRoot?.querySelector('[data-ledger-error]')),
          legacyDocumentChrome: Boolean(ledgerDetailRoot?.querySelector('.docwrap,.docpage,.dochead,.docmeta')),
          openingRow: Boolean(ledgerDetailRoot?.querySelector('[data-ledger-opening]')),
          rowCount: ledgerDetailRoot?.querySelectorAll('[data-ledger-row]').length || 0,
          runningBalance: Boolean(ledgerDetailRoot?.querySelector('[data-ledger-row] td:last-child')),
          controlledTable: ledgerTableBounded,
          unhandledActions: ledgerUnhandledActions.map((button) => (button.textContent || '').trim()),
        },
        postingDetailLayout: {
          present: Boolean(postingDetailRoot),
          actualLayout: postingDetailRoot?.getAttribute('data-layout') || null,
          missingRegions: postingDetailRoot
            ? ['overview','error','main','context','actions'].filter((_,index)=>!postingDetailRegions[index])
            : [],
          ordered: postingDetailOrder,
          pageheads: el.querySelectorAll('.pagehead').length,
          errorRegion: Boolean(postingDetailRoot?.querySelector('[data-posting-error]')),
          legacyDocumentChrome: Boolean(postingDetailRoot?.querySelector('.docwrap,.docpage,.dochead,.docmeta,.doclayout,.summary')),
          emptyState: Boolean(postingDetailRoot?.querySelector('[data-posting-empty]')),
          errorVisible: Boolean(postingDetailRoot?.querySelector('[data-posting-error]:not([hidden])')),
          lines: Boolean(postingDetailRoot?.querySelector('[data-posting-lines]')),
          totals: Boolean(postingDetailRoot?.querySelector('[data-posting-totals]')),
          balance: Boolean(postingDetailRoot?.querySelector('[data-posting-balance]')),
          audit: Boolean(postingDetailRoot?.querySelector('[data-posting-audit]')),
          controlledTable: postingLinesBounded,
        },
        goodsReceiptLayout: {
          canonicalMarker: goodsReceiptRoot?.getAttribute('data-canonical-goods-receipt') === 'true',
          h1s: el.querySelectorAll('.pagehead h1').length,
          factCount: goodsReceiptRoot?.querySelectorAll('.posting-detail-fact').length || 0,
          lines: Boolean(goodsReceiptRoot?.querySelector('[data-goods-receipt-lines]')),
          trace: Boolean(goodsReceiptRoot?.querySelector('[data-goods-receipt-trace]')),
          effect: Boolean(goodsReceiptRoot?.querySelector('[data-goods-receipt-effect]')),
          immutable: Boolean(goodsReceiptRoot?.querySelector('[data-goods-receipt-immutability]')),
          headerStockActions: el.querySelectorAll('[data-posting-header-action]').length,
          footerHidden: Boolean(goodsReceiptRoot?.querySelector('[data-posting-actions][hidden]')),
          footerActions: goodsReceiptRoot?.querySelectorAll('[data-posting-actions] button').length || 0,
          backActions: goodsReceiptRoot?.querySelectorAll('[data-receipt-back]').length || 0,
          internalOverflow: goodsReceiptOverflow,
        },
        financialStatementLayout: {
          present: Boolean(financialStatementRoot),
          actualLayout: financialStatementRoot?.getAttribute('data-layout') || null,
          missingRegions: financialStatementRoot
            ? ['summary','filters','error','statement','actions','export-status']
              .filter((_,index)=>!financialStatementRegions[index])
            : [],
          ordered: financialStatementOrder,
          pageheads: el.querySelectorAll('.pagehead').length,
          errorRegion: Boolean(financialStatementRoot?.querySelector('[data-financial-error]')),
          controlledTable: financialTableBounded,
          legacyReportChrome: Boolean(financialStatementRoot?.querySelector('.report,.report-params,.report-result')),
          runHandler: Boolean(financialStatementRoot?.querySelector('[data-financial-run]')),
          exportActions: financialStatementRoot?.querySelectorAll('[data-financial-action]').length || 0,
          comboboxes: financialStatementRoot?.querySelectorAll('[data-financial-filters] input[role="combobox"]').length || 0,
          nativeSelects: financialStatementRoot?.querySelectorAll('[data-financial-filters] select').length || 0,
        },
        layoutProfile: {
          heading: el.querySelector('h1')?.textContent?.trim() || '',
          gridTables: el.querySelectorAll('.dt-page').length,
          semanticTables: el.querySelectorAll('table.lines').length,
          visibleRows: [...el.querySelectorAll('.dt-body .dt-r,table.lines tbody tr')]
            .filter((row) => row.getClientRects().length > 0).length,
          salesBody: Boolean(el.querySelector('.sales-body')),
          documentPage: Boolean(el.querySelector('.docpage,.doclayout')),
          formSurface: Boolean(el.querySelector('form,.formgrid,.set-grid,.wizard-card')),
          splitSurface: Boolean(el.querySelector('.split,.so-split,.doclayout,.master-detail,[data-master-detail-workspace]')),
          dashboardSurface: Boolean(el.querySelector('.dashgrid,.db-grid,.sb-grid,.analytics-status-grid')),
          actualLayout: actualListLayout
            || workspaceRoot?.getAttribute('data-layout')
            || masterDetailEditorRoot?.getAttribute('data-layout')
            || caseDetailRoot?.getAttribute('data-layout')
            || ledgerDetailRoot?.getAttribute('data-layout')
            || postingDetailRoot?.getAttribute('data-layout')
            || financialStatementRoot?.getAttribute('data-layout')
            || null,
        },
        moduleShell: Boolean(el.querySelector('.sales-subnav')),
        renderErrorMessage: el.dataset.screenRenderError || null,
        renderError: Boolean(el.querySelector('.screen-render-error')),
      };
    }).catch(() => ({
      text: '', previewBanner: false, enabledPreviewWrites: [],
      layoutIssues: ['render inspection failed'],
      listLayout: {
        present: false, actualLayout: null, rowCount: 0, interactiveRows: 0, staticRows: 0,
        invalidInteractiveRows: [], invalidStaticRows: [],
        missingRegions: [], ordered: false, missingMasterDetailRegions: [],
      },
      timesheetLayout: {
        pageheads: 0, canonicalMarker: false, kpis: 0, weekButtons: 0, weekLabels: 0,
        primaryActions: 0, semanticTables: 0, legacyChrome: false, unsupportedActions: [],
      },
      employeeLayout: {
        canonicalMarker: false, avatar: false, factCount: 0, contactFacts: 0,
        readonlyInputs: 0, leaveBalance: false, controlledLeaveTable: false,
        headerStatuses: 0, headerReviewActions: 0, footerActions: 0,
        footerHidden: false, backActions: 0, legacyChrome: false,
      },
      serviceContractLayout: {
        canonicalMarker: false, factCount: 0, customerActions: 0,
        commercialTerms: false, renewalContext: false, footerActions: 0, footerHidden: false,
      },
      workspaceLayout: {
        present: false, actualLayout: null, missingRegions: [], ordered: false,
        progress: null, pageheads: 0, errorRegion: false, incompleteCompletionEnabled: false,
      },
      calendarWorkspaceLayout: {
        present: false, actualLayout: null, missingRegions: [], ordered: false,
        pageheads: 0, viewButtons: 0, privacy: null,
      },
      masterDetailEditorLayout: {
        present: false, actualLayout: null, missingRegions: [], ordered: false,
        pageheads: 0, errorRegion: false, legacyDocumentChrome: false,
      },
      caseDetailLayout: {
        present: false, actualLayout: null, missingRegions: [], ordered: false,
        pageheads: 0, errorRegion: false, legacyDocumentChrome: false,
      },
      serviceOrderLayout: {
        canonicalMarker: false, h1s: 0, lifecycleSteps: 0, lifecycleCurrent: 0,
        factCount: 0, customerActions: 0, diagnosis: false, sla: false, contract: false,
        actionsHidden: false, actionButtons: 0, internalOverflow: [],
      },
      ledgerDetailLayout: {
        present: false, actualLayout: null, missingRegions: [], ordered: false,
        pageheads: 0, errorRegion: false, legacyDocumentChrome: false,
        openingRow: false, rowCount: 0, runningBalance: false, controlledTable: false, unhandledActions: [],
      },
      postingDetailLayout: {
        present: false, actualLayout: null, missingRegions: [], ordered: false,
        pageheads: 0, errorRegion: false, legacyDocumentChrome: false,
        emptyState: false, errorVisible: false,
        lines: false, totals: false, balance: false, audit: false, controlledTable: false,
      },
      financialStatementLayout: {
        present: false, actualLayout: null, missingRegions: [], ordered: false,
        pageheads: 0, errorRegion: false, controlledTable: false,
        legacyReportChrome: false, runHandler: false, exportActions: 0,
      },
      payrollRunLayout: {
        pageheads: 0, legacyChrome: false, nativeSelects: 0,
        detailPresent: false, detailOpen: false, visibleRows: 0,
        postActions: 0, payrollLines: 0, controlledLines: false,
      },
      layoutProfile: {
        heading: '', gridTables: 0, semanticTables: 0, visibleRows: 0,
        salesBody: false, documentPage: false, formSurface: false,
        splitSurface: false, dashboardSurface: false, actualLayout: null,
      },
      moduleShell: false, renderError: true,
    }));

    const moduleId = routeModule[route] || null;
    const canonical = meta && meta.maturity === 'canonical';
    const leaks = canonical ? findIdentityLeak(rendered.text || '') : [];
    if (LIST_LAYOUTS.has(meta?.layout)) {
      if (!rendered.listLayout.present) {
        rendered.layoutIssues.push(`${meta.layout} root missing`);
      } else {
        if (rendered.listLayout.actualLayout !== meta.layout) {
          rendered.layoutIssues.push(`rendered ${rendered.listLayout.actualLayout} but declared ${meta.layout}`);
        }
        if (rendered.listLayout.missingRegions.length) {
          rendered.layoutIssues.push(`${meta.layout} regions missing: ${rendered.listLayout.missingRegions.join(', ')}`);
        }
        if (!rendered.listLayout.ordered) {
          rendered.layoutIssues.push(`${meta.layout} regions are outside canonical order`);
        }
        if (meta.layout === 'master-detail-register-v1' && rendered.listLayout.missingMasterDetailRegions.length) {
          rendered.layoutIssues.push(`master-detail-register-v1 regions missing: ${rendered.listLayout.missingMasterDetailRegions.join(', ')}`);
        }
        if (rendered.listLayout.invalidInteractiveRows.length) {
          rendered.layoutIssues.push(
            `interactive list rows violate focus/name/cursor contract: ${rendered.listLayout.invalidInteractiveRows.join(', ')}`,
          );
        }
        if (rendered.listLayout.invalidStaticRows.length) {
          rendered.layoutIssues.push(
            `static list rows expose false interaction affordances: ${rendered.listLayout.invalidStaticRows.join(', ')}`,
          );
        }
        if (meta.layout === 'transaction-list-v1'
            && rendered.listLayout.rowCount > 0
            && rendered.listLayout.staticRows > 0) {
          rendered.layoutIssues.push(
            `transaction-list-v1 leaves ${rendered.listLayout.staticRows}/${rendered.listLayout.rowCount} records without a details action`,
          );
        }
      }
    }
    if (rendered.listLayout.present && !LIST_LAYOUTS.has(meta?.layout)) {
      rendered.layoutIssues.push(`rendered ${rendered.listLayout.actualLayout} but declared ${meta?.layout || 'none'}`);
    }
    if (meta?.layout === CALENDAR_WORKSPACE_LAYOUT) {
      if (!rendered.calendarWorkspaceLayout.present) {
        rendered.layoutIssues.push('calendar-workspace-v1 root missing');
      } else {
        if (rendered.calendarWorkspaceLayout.missingRegions.length) {
          rendered.layoutIssues.push(
            `calendar-workspace-v1 regions missing: ${rendered.calendarWorkspaceLayout.missingRegions.join(', ')}`,
          );
        }
        if (!rendered.calendarWorkspaceLayout.ordered) {
          rendered.layoutIssues.push('calendar-workspace-v1 regions are outside canonical order');
        }
        if (rendered.calendarWorkspaceLayout.viewButtons !== 3) {
          rendered.layoutIssues.push(
            `calendar-workspace-v1 expected 3 view controls, found ${rendered.calendarWorkspaceLayout.viewButtons}`,
          );
        }
        if (rendered.calendarWorkspaceLayout.privacy !== 'reason_and_evidence_redacted') {
          rendered.layoutIssues.push('calendar-workspace-v1 privacy marker is missing');
        }
      }
    }
    if (route === 'timesheet') {
      if (rendered.timesheetLayout.pageheads !== 1) {
        rendered.layoutIssues.push(`Timesheet rendered ${rendered.timesheetLayout.pageheads} module page headers`);
      }
      if (!rendered.timesheetLayout.canonicalMarker) {
        rendered.layoutIssues.push('Timesheet canonical compatibility marker missing');
      }
      if (rendered.timesheetLayout.kpis !== 3) {
        rendered.layoutIssues.push(`Timesheet expected 3 KPI cards, found ${rendered.timesheetLayout.kpis}`);
      }
      if (rendered.timesheetLayout.weekButtons !== 3 || rendered.timesheetLayout.weekLabels !== 1) {
        rendered.layoutIssues.push(
          `Timesheet week navigation expected 3 buttons and 1 label, found ${rendered.timesheetLayout.weekButtons} and ${rendered.timesheetLayout.weekLabels}`,
        );
      }
      if (rendered.timesheetLayout.primaryActions !== 1) {
        rendered.layoutIssues.push(`Timesheet expected 1 primary action, found ${rendered.timesheetLayout.primaryActions}`);
      }
      if (rendered.timesheetLayout.semanticTables || rendered.timesheetLayout.legacyChrome) {
        rendered.layoutIssues.push('Timesheet contains legacy document/list chrome');
      }
      if (rendered.timesheetLayout.unsupportedActions.length) {
        rendered.layoutIssues.push(`Timesheet exposes unsupported actions: ${rendered.timesheetLayout.unsupportedActions.join(', ')}`);
      }
    }
    if (route === 'ar-aging') {
      if (rendered.arAgingLayout.pageheads !== 1) {
        rendered.layoutIssues.push(`AR Aging rendered ${rendered.arAgingLayout.pageheads} module page headers`);
      }
      if (rendered.arAgingLayout.legacyReportChrome) {
        rendered.layoutIssues.push('AR Aging contains legacy report chrome');
      }
      if (rendered.arAgingLayout.nativeSelects) {
        rendered.layoutIssues.push(`AR Aging contains ${rendered.arAgingLayout.nativeSelects} native select filters`);
      }
      if (rendered.arAgingLayout.comboboxes !== 1) {
        rendered.layoutIssues.push(`AR Aging expected 1 customer combobox, found ${rendered.arAgingLayout.comboboxes}`);
      }
      if (rendered.arAgingLayout.exportActions) {
        rendered.layoutIssues.push('AR Aging exposes an unsupported Export, Excel or Print action');
      }
      if (rendered.arAgingLayout.runActions !== 1) {
        rendered.layoutIssues.push(`AR Aging expected 1 real Run report action, found ${rendered.arAgingLayout.runActions}`);
      }
      if (rendered.arAgingLayout.customerToast) {
        rendered.layoutIssues.push('AR Aging still exposes the placeholder customer detail toast');
      }
    }
    if (route === 'leave-approval') {
      if (rendered.leaveApprovalLayout.pageheads !== 1) {
        rendered.layoutIssues.push(`Leave Approval rendered ${rendered.leaveApprovalLayout.pageheads} module page headers`);
      }
      if (rendered.leaveApprovalLayout.legacyChrome) {
        rendered.layoutIssues.push('Leave Approval still renders legacy master-detail chrome');
      }
      if (rendered.leaveApprovalLayout.exportActions) {
        rendered.layoutIssues.push('Leave Approval exposes an unsupported Export, Excel or Print action');
      }
      if (!rendered.leaveApprovalLayout.detailPresent) {
        rendered.layoutIssues.push('Leave Approval detail panel contract is missing');
      }
      if (viewport.width <= 980
          && rendered.leaveApprovalLayout.visibleRows
          && rendered.leaveApprovalLayout.detailOpen) {
        rendered.layoutIssues.push('Leave Approval opens its mobile detail drawer before a row is selected');
      }
      if (viewport.width > 980
          && rendered.leaveApprovalLayout.visibleRows
          && !rendered.leaveApprovalLayout.detailOpen) {
        rendered.layoutIssues.push('Leave Approval did not select the first visible desktop request');
      }
      if (viewport.width > 980
          && rendered.leaveApprovalLayout.detailOpen
          && rendered.leaveApprovalLayout.pendingActions !== 2) {
        rendered.layoutIssues.push(`Leave Approval expected 2 pending disposition actions, found ${rendered.leaveApprovalLayout.pendingActions}`);
      }
    }
    if (route === 'payroll-run') {
      if (rendered.payrollRunLayout.pageheads !== 1) {
        rendered.layoutIssues.push(`Payroll Run rendered ${rendered.payrollRunLayout.pageheads} module page headers`);
      }
      if (rendered.payrollRunLayout.legacyChrome) {
        rendered.layoutIssues.push('Payroll Run still renders legacy report chrome');
      }
      if (rendered.payrollRunLayout.nativeSelects) {
        rendered.layoutIssues.push(`Payroll Run contains ${rendered.payrollRunLayout.nativeSelects} native run selectors`);
      }
      if (!rendered.payrollRunLayout.detailPresent) {
        rendered.layoutIssues.push('Payroll Run detail panel contract is missing');
      }
      if (rendered.payrollRunLayout.payrollLines && !rendered.payrollRunLayout.controlledLines) {
        rendered.layoutIssues.push('Payroll Run employee lines are missing bounded horizontal scrolling');
      }
      if (viewport.width <= 980
          && rendered.payrollRunLayout.visibleRows
          && rendered.payrollRunLayout.detailOpen) {
        rendered.layoutIssues.push('Payroll Run opens its mobile detail drawer before a row is selected');
      }
      if (viewport.width > 980
          && rendered.payrollRunLayout.visibleRows
          && !rendered.payrollRunLayout.detailOpen) {
        rendered.layoutIssues.push('Payroll Run did not select the newest desktop run');
      }
      const createDefaults = await page.evaluate(() => {
        const button = document.querySelector('[data-list-primary-action]');
        if (!(button instanceof HTMLButtonElement)) return { opened:false };
        button.click();
        const defaults = payrollPeriodDefaults();
        const result = {
          opened:Boolean(document.querySelector('#modalEl')),
          docNo:document.querySelector('#prDocNo')?.value || '',
          start:document.querySelector('#prStart')?.value || '',
          end:document.querySelector('#prEnd')?.value || '',
          payDate:document.querySelector('#prPayDate')?.value || '',
          closeLabel:document.querySelector('#modalEl .iconbtn.x')?.getAttribute('aria-label') || '',
          expected:defaults,
          translatedClose:typeof t === 'function' ? t('common.close') : 'Close',
        };
        closeModal();
        return result;
      });
      if (!createDefaults.opened) {
        rendered.layoutIssues.push('Payroll Run create dialog did not open');
      } else {
        if (createDefaults.start !== createDefaults.expected.start
            || createDefaults.end !== createDefaults.expected.end
            || createDefaults.payDate !== createDefaults.expected.payDate) {
          rendered.layoutIssues.push('Payroll Run create dates do not match the selected fiscal period');
        }
        if (!createDefaults.docNo.startsWith(`PAY-${createDefaults.expected.year}-`)) {
          rendered.layoutIssues.push('Payroll Run number does not use the selected fiscal period year');
        }
        if (createDefaults.closeLabel !== createDefaults.translatedClose) {
          rendered.layoutIssues.push('Payroll Run dialog close label is not localized');
        }
      }
    }
    if (route === 'payslip') {
      const payslipContract = await page.evaluate(() => {
        const copy=hrCopy();
        const text=document.querySelector('#viewRoot')?.textContent||'';
        const page=document.querySelector('.payslip-page');
        const layout=document.querySelector('.payslip-layout');
        const summary=document.querySelector('.payslip-summary');
        const related=document.querySelector('.payslip-related');
        const relatedList=related?.querySelector('.minilist');
        const actionbar=document.querySelector('.payslip-actionbar');
        const overflow=[page,layout,summary,related,actionbar]
          .filter((node)=>node&&node.offsetParent!==null&&node.scrollWidth>node.clientWidth+1)
          .map((node)=>`${node.className||node.tagName} ${node.scrollWidth}>${node.clientWidth}`);
        return {
          isDraft:text.includes(copy('statusDraft')),
          hasDisbursed:text.includes(copy('netPayDisbursed')),
          hasPending:text.includes(copy('netPayPending')),
          hasScheduled:text.includes(copy('scheduledFor').replace('{date}','').split(';')[0].trim()),
          hasStructure:Boolean(page&&layout&&summary&&related&&actionbar),
          pageWidth:page?.getBoundingClientRect().width||0,
          layoutColumns:layout?getComputedStyle(layout).gridTemplateColumns:'',
          summaryColumns:summary?getComputedStyle(summary).gridTemplateColumns:'',
          relatedColumns:relatedList?getComputedStyle(relatedList).gridTemplateColumns:'',
          overflow,
        };
      });
      if (payslipContract.isDraft && (payslipContract.hasDisbursed || !payslipContract.hasPending || !payslipContract.hasScheduled)) {
        rendered.layoutIssues.push('Draft payslip presents net pay as disbursed instead of scheduled and unpaid');
      }
      if (!payslipContract.hasStructure) {
        rendered.layoutIssues.push('Payslip is missing its responsive document, related-data or action regions');
      }
      if (payslipContract.overflow.length) {
        rendered.layoutIssues.push(`Payslip internal overflow: ${payslipContract.overflow.join(', ')}`);
      }
      if (viewport.width > 980 && payslipContract.pageWidth < 1000) {
        rendered.layoutIssues.push(`Payslip wastes the desktop canvas (${Math.round(payslipContract.pageWidth)}px wide)`);
      }
      if (viewport.width > 980 && payslipContract.layoutColumns.split(' ').filter(Boolean).length < 2) {
        rendered.layoutIssues.push('Payslip desktop detail and summary are not separate columns');
      }
      if (viewport.width <= 620 && payslipContract.summaryColumns.split(' ').filter(Boolean).length !== 1) {
        rendered.layoutIssues.push('Payslip mobile summary does not collapse to one column');
      }
      if (viewport.width <= 620 && payslipContract.relatedColumns.split(' ').filter(Boolean).length !== 1) {
        rendered.layoutIssues.push('Payslip mobile related records do not collapse to one column');
      }
    }
    if (route === 'hr-directory') {
      const employeeSearch = page.locator('[data-list-search]');
      if (await employeeSearch.count() !== 1) {
        rendered.layoutIssues.push('Employee directory has no accessible employee search');
      } else {
        const employeeNo = await page.locator('[data-list-table] .dt-r[data-row] .cellsub small').first().textContent();
        if (employeeNo?.trim()) {
          await employeeSearch.fill(employeeNo.trim());
          await page.waitForTimeout(40);
          const resultCount = await page.locator('[data-list-table] .dt-r[data-row]').count();
          const focused = await page.evaluate(() => document.activeElement?.matches('[data-list-search]'));
          if (resultCount !== 1 || !focused) {
            rendered.layoutIssues.push(`Employee search returned ${resultCount} rows or lost keyboard focus`);
          }
        }
        await page.locator('[data-list-search]').fill('__no_matching_employee__');
        await page.waitForTimeout(40);
        if (await page.locator('[data-list-empty]').count() !== 1) {
          rendered.layoutIssues.push('Employee search has no governed no-results state');
        }
      }
    }
    if (route === 'dashboard' && viewport.width > 980) {
      const arAgingCard = page.locator('#viewRoot button.wcard[data-route="ar-aging"]');
      if (await arAgingCard.count() !== 1) {
        rendered.layoutIssues.push('Dashboard AR aging card is missing or does not target ar-aging');
      } else {
        await arAgingCard.click();
        await page.waitForFunction(() => CURRENT_ROUTE === 'ar-aging',null,{timeout:5000}).catch(()=>{});
        if (await page.evaluate(() => CURRENT_ROUTE) !== 'ar-aging') {
          rendered.layoutIssues.push('Dashboard AR aging card did not navigate to ar-aging');
        }
        await page.evaluate(() => navigate('dashboard'));
        await page.waitForSelector('.dashgrid',{timeout:5000});
      }
      await page.locator('#ctxCompany').click();
      await page.locator('[data-co="C-MY"]').click();
      await page.waitForFunction(() => {
        const company=document.querySelector('#ctxCompany')?.textContent||'';
        const period=document.querySelector('#ctxPeriod')?.textContent||'';
        return company.includes('Acme Malaysia') && period.includes('MYR');
      },null,{timeout:5000}).catch(()=>{});
      const malaysiaContext = await page.evaluate(() => ({
        company:document.querySelector('#ctxCompany')?.textContent||'',
        period:document.querySelector('#ctxPeriod')?.textContent||'',
      }));
      if (!malaysiaContext.company.includes('Acme Malaysia') || !malaysiaContext.period.includes('MYR')) {
        rendered.layoutIssues.push(`Malaysia company switch left a stale fiscal context: ${malaysiaContext.period.trim()}`);
      }
      await page.locator('#ctxCompany').click();
      await page.locator('[data-co="C-SG"]').click();
      await page.waitForFunction(() => {
        const company=document.querySelector('#ctxCompany')?.textContent||'';
        const period=document.querySelector('#ctxPeriod')?.textContent||'';
        return company.includes('Acme Singapore') && period.includes('SGD');
      },null,{timeout:5000}).catch(()=>{});
      const singaporeContext = await page.evaluate(() => ({
        company:document.querySelector('#ctxCompany')?.textContent||'',
        period:document.querySelector('#ctxPeriod')?.textContent||'',
      }));
      if (!singaporeContext.company.includes('Acme Singapore') || !singaporeContext.period.includes('SGD')) {
        rendered.layoutIssues.push(`Singapore company switch left a stale fiscal context: ${singaporeContext.period.trim()}`);
      }
      await page.evaluate(() => window.ErpSystemDemo.switchUser('sales@acme.co'));
      await page.reload({waitUntil:'networkidle',timeout:30000});
      await page.waitForFunction(() => typeof DB!=='undefined' && DB.user?.email==='sales@acme.co',null,{timeout:15000});
      await page.waitForSelector('#sidebar .nav[data-mod="home"]',{timeout:5000});
      await page.waitForSelector('.dash',{timeout:5000});
      const salesShell = await page.evaluate(() => ({
        sidebar:[...document.querySelectorAll('#sidebar .nav[data-mod]')].map(node=>node.dataset.mod),
        quickCreate:[...document.querySelectorAll('#qcMenu [data-route]')].map(node=>node.dataset.route),
        companies:[...document.querySelectorAll('#companyMenu [data-co]')].map(node=>node.dataset.co),
        masterControl:document.querySelectorAll('#companyMenu [data-co-action="master"]').length,
        dashboardRoutes:[...document.querySelectorAll('#viewRoot .wcard[data-route]')].map(node=>node.dataset.route),
        approvalQueue:document.querySelectorAll('#viewRoot .minilist').length,
        headerKpis:document.querySelectorAll('#viewRoot .headright .kfig').length,
      }));
      // Every linked staff persona also receives the system-managed Employee
      // base role, so Sales must retain My Work without gaining unrelated
      // company operations or finance controls.
      if (JSON.stringify(salesShell.sidebar)!==JSON.stringify(['home','sales','crm','mywork'])
          || JSON.stringify(salesShell.quickCreate)!==JSON.stringify(['new-sales-order'])
          || JSON.stringify(salesShell.companies)!==JSON.stringify(['C-SG'])
          || salesShell.masterControl!==0
          || salesShell.dashboardRoutes.some(routeName=>routeName!=='sales-orders')
          || salesShell.approvalQueue!==0
          || salesShell.headerKpis!==2) {
        rendered.layoutIssues.push(`Sales permission-aware shell leaked unavailable controls or data: ${JSON.stringify(salesShell)}`);
      }
      await page.evaluate(() => navigate('new-journal-entry'));
      await page.waitForSelector('[data-access-denied="403"]',{timeout:5000});
      const deniedCreate = await page.evaluate(() => ({
        form:document.querySelectorAll('[data-manual-journal="canonical"]').length,
        text:document.querySelector('#viewRoot')?.textContent||'',
      }));
      if (deniedCreate.form || !deniedCreate.text.includes('403') || !deniedCreate.text.includes('No records were loaded')) {
        rendered.layoutIssues.push('Sales direct-create denial exposed the manual-journal composer or lacked governed 403 copy');
      }
      await page.evaluate(() => navigate('dashboard'));
      await page.waitForSelector('.dash',{timeout:5000});
      await page.evaluate(() => navigate('purchasing-home'));
      await page.waitForSelector('[data-access-denied="403"]',{timeout:5000});
      const deniedRoute = await page.evaluate(() => ({
        rows:document.querySelectorAll('#viewRoot [data-row]').length,
        subnav:document.querySelectorAll('#viewRoot .sales-subnav').length,
        text:document.querySelector('#viewRoot')?.textContent||'',
        nav:document.querySelector('#sidebar')?.textContent||'',
      }));
      if (deniedRoute.rows || deniedRoute.subnav || deniedRoute.nav.includes('Purchasing')
          || !deniedRoute.text.includes('403') || !deniedRoute.text.includes('No records were loaded')) {
        rendered.layoutIssues.push('Sales permission denial leaked purchasing UI/data or lacked governed 403 copy');
      }
      await page.evaluate(() => window.ErpSystemDemo.switchUser('admin@acme.co'));
      await page.reload({waitUntil:'networkidle',timeout:30000});
      await page.waitForFunction(() => typeof DB!=='undefined' && DB.user?.email==='admin@acme.co',null,{timeout:15000});
      await page.evaluate(() => navigate('dashboard'));
      await page.waitForSelector('.dashgrid',{timeout:5000});
    }
    if (meta?.layout === OPERATIONAL_WORKSPACE_LAYOUT) {
      if (!rendered.workspaceLayout.present) {
        rendered.layoutIssues.push(`${OPERATIONAL_WORKSPACE_LAYOUT} root missing`);
      } else {
        if (rendered.workspaceLayout.actualLayout !== meta.layout) {
          rendered.layoutIssues.push(`rendered ${rendered.workspaceLayout.actualLayout} but declared ${meta.layout}`);
        }
        if (rendered.workspaceLayout.missingRegions.length) {
          rendered.layoutIssues.push(`${OPERATIONAL_WORKSPACE_LAYOUT} regions missing: ${rendered.workspaceLayout.missingRegions.join(', ')}`);
        }
        if (!rendered.workspaceLayout.ordered) {
          rendered.layoutIssues.push(`${OPERATIONAL_WORKSPACE_LAYOUT} regions are outside canonical order`);
        }
        if (rendered.workspaceLayout.pageheads !== 1) {
          rendered.layoutIssues.push(`${OPERATIONAL_WORKSPACE_LAYOUT} rendered ${rendered.workspaceLayout.pageheads} module page headers`);
        }
        if (!rendered.workspaceLayout.errorRegion) {
          rendered.layoutIssues.push(`${OPERATIONAL_WORKSPACE_LAYOUT} error region missing`);
        }
        if (rendered.workspaceLayout.incompleteCompletionEnabled) {
          rendered.layoutIssues.push(`${OPERATIONAL_WORKSPACE_LAYOUT} enabled completion before 100% progress`);
        }
      }
    }
    if (rendered.workspaceLayout.present && meta?.layout !== OPERATIONAL_WORKSPACE_LAYOUT) {
      rendered.layoutIssues.push(`rendered ${rendered.workspaceLayout.actualLayout} but declared ${meta?.layout || 'none'}`);
    }
    if (meta?.layout === MASTER_DETAIL_EDITOR_LAYOUT) {
      if (!rendered.masterDetailEditorLayout.present) {
        rendered.layoutIssues.push(`${MASTER_DETAIL_EDITOR_LAYOUT} root missing`);
      } else {
        if (rendered.masterDetailEditorLayout.actualLayout !== meta.layout) {
          rendered.layoutIssues.push(`rendered ${rendered.masterDetailEditorLayout.actualLayout} but declared ${meta.layout}`);
        }
        if (rendered.masterDetailEditorLayout.missingRegions.length) {
          rendered.layoutIssues.push(`${MASTER_DETAIL_EDITOR_LAYOUT} regions missing: ${rendered.masterDetailEditorLayout.missingRegions.join(', ')}`);
        }
        if (!rendered.masterDetailEditorLayout.ordered) {
          rendered.layoutIssues.push(`${MASTER_DETAIL_EDITOR_LAYOUT} regions are outside canonical order`);
        }
        if (rendered.masterDetailEditorLayout.pageheads !== 1) {
          rendered.layoutIssues.push(`${MASTER_DETAIL_EDITOR_LAYOUT} rendered ${rendered.masterDetailEditorLayout.pageheads} module page headers`);
        }
        if (!rendered.masterDetailEditorLayout.errorRegion) {
          rendered.layoutIssues.push(`${MASTER_DETAIL_EDITOR_LAYOUT} error region missing`);
        }
        if (rendered.masterDetailEditorLayout.legacyDocumentChrome) {
          rendered.layoutIssues.push(`${MASTER_DETAIL_EDITOR_LAYOUT} contains legacy document chrome`);
        }
      }
    }
    if (rendered.masterDetailEditorLayout.present && meta?.layout !== MASTER_DETAIL_EDITOR_LAYOUT) {
      rendered.layoutIssues.push(`rendered ${rendered.masterDetailEditorLayout.actualLayout} but declared ${meta?.layout || 'none'}`);
    }
    if (route === 'new-employee') {
      const onboarding = await page.evaluate(() => {
        const next = document.querySelector('#neNext');
        if (!(next instanceof HTMLButtonElement)) return { present:false };
        const before = {
          dots:document.querySelectorAll('.staff-onboarding-progress .sdot').length,
          connectors:document.querySelectorAll('.staff-onboarding-progress .stepline').length,
          managerSearch:Boolean(document.querySelector('#neManager[role="combobox"]')),
          saveContext:Boolean(document.querySelector('.staff-onboarding-save-context b + small')),
        };
        next.click();
        return {
          present:true,
          ...before,
          invalidFields:document.querySelectorAll('[aria-invalid="true"]').length,
          bannerVisible:Boolean(document.querySelector('[data-staff-onboarding-error]:not([hidden])')),
          firstInvalidFocused:document.activeElement?.id === 'neName',
        };
      });
      if (!onboarding.present) rendered.layoutIssues.push('Staff onboarding primary action is missing');
      if (onboarding.dots !== 3 || onboarding.connectors !== 2) {
        rendered.layoutIssues.push(`Staff onboarding progress expected 3 steps and 2 connectors, found ${onboarding.dots} and ${onboarding.connectors}`);
      }
      if (!onboarding.managerSearch) rendered.layoutIssues.push('Staff onboarding manager selector is not searchable');
      if (!onboarding.saveContext) rendered.layoutIssues.push('Staff onboarding save context is not separated into two lines');
      if (onboarding.invalidFields !== 5 || !onboarding.bannerVisible || !onboarding.firstInvalidFocused) {
        rendered.layoutIssues.push('Staff onboarding required-field feedback is incomplete or does not focus the first invalid field');
      }
    }
    if (route === 'employee') {
      if (!rendered.employeeLayout.canonicalMarker) {
        rendered.layoutIssues.push('Employee canonical compatibility marker missing');
      }
      if (!rendered.employeeLayout.avatar) {
        rendered.layoutIssues.push('Employee overview avatar missing');
      }
      if (rendered.employeeLayout.factCount !== 4) {
        rendered.layoutIssues.push(`Employee expected 4 overview facts, found ${rendered.employeeLayout.factCount}`);
      }
      if (rendered.employeeLayout.contactFacts !== 2) {
        rendered.layoutIssues.push(`Employee expected 2 contact facts, found ${rendered.employeeLayout.contactFacts}`);
      }
      if (rendered.employeeLayout.readonlyInputs) {
        rendered.layoutIssues.push('Employee contact details still use read-only input controls');
      }
      if (!rendered.employeeLayout.leaveBalance) {
        rendered.layoutIssues.push('Employee leave balance context missing');
      }
      if (!rendered.employeeLayout.controlledLeaveTable) {
        rendered.layoutIssues.push('Employee leave history table is missing bounded horizontal scrolling');
      }
      if (rendered.employeeLayout.headerStatuses !== 1 || rendered.employeeLayout.headerReviewActions !== 1) {
        rendered.layoutIssues.push(
          `Employee expected one header status and one Review action, found ${rendered.employeeLayout.headerStatuses} and ${rendered.employeeLayout.headerReviewActions}`,
        );
      }
      if (!rendered.employeeLayout.footerHidden || rendered.employeeLayout.footerActions) {
        rendered.layoutIssues.push(
          `Employee footer actions must remain hidden and empty, found hidden=${rendered.employeeLayout.footerHidden} buttons=${rendered.employeeLayout.footerActions}`,
        );
      }
      if (rendered.employeeLayout.backActions) {
        rendered.layoutIssues.push(`Employee contains ${rendered.employeeLayout.backActions} redundant Back actions`);
      }
      if (rendered.employeeLayout.legacyChrome) {
        rendered.layoutIssues.push('Employee contains legacy or duplicated detail chrome');
      }
    }
    if (route === 'service-contract') {
      if (!rendered.serviceContractLayout.canonicalMarker) {
        rendered.layoutIssues.push('Service Contract canonical compatibility marker missing');
      }
      if (!rendered.serviceContractLayout.footerHidden || rendered.serviceContractLayout.footerActions) {
        rendered.layoutIssues.push(
          `Service Contract footer actions must remain hidden and empty, found hidden=${rendered.serviceContractLayout.footerHidden} buttons=${rendered.serviceContractLayout.footerActions}`,
        );
      }
    }
    if (meta?.layout === CASE_DETAIL_LAYOUT) {
      if (!rendered.caseDetailLayout.present) {
        rendered.layoutIssues.push(`${CASE_DETAIL_LAYOUT} root missing`);
      } else {
        if (rendered.caseDetailLayout.actualLayout !== meta.layout) {
          rendered.layoutIssues.push(`rendered ${rendered.caseDetailLayout.actualLayout} but declared ${meta.layout}`);
        }
        if (rendered.caseDetailLayout.missingRegions.length) {
          rendered.layoutIssues.push(`${CASE_DETAIL_LAYOUT} regions missing: ${rendered.caseDetailLayout.missingRegions.join(', ')}`);
        }
        if (!rendered.caseDetailLayout.ordered) {
          rendered.layoutIssues.push(`${CASE_DETAIL_LAYOUT} regions are outside canonical order`);
        }
        if (rendered.caseDetailLayout.pageheads !== 1) {
          rendered.layoutIssues.push(`${CASE_DETAIL_LAYOUT} rendered ${rendered.caseDetailLayout.pageheads} module page headers`);
        }
        if (!rendered.caseDetailLayout.errorRegion) {
          rendered.layoutIssues.push(`${CASE_DETAIL_LAYOUT} error region missing`);
        }
        if (rendered.caseDetailLayout.legacyDocumentChrome) {
          rendered.layoutIssues.push(`${CASE_DETAIL_LAYOUT} contains legacy document chrome`);
        }
      }
    }
    if (rendered.caseDetailLayout.present && meta?.layout !== CASE_DETAIL_LAYOUT) {
      rendered.layoutIssues.push(`rendered ${rendered.caseDetailLayout.actualLayout} but declared ${meta?.layout || 'none'}`);
    }
    if (route === 'service-order') {
      if (!rendered.serviceOrderLayout.canonicalMarker) {
        rendered.layoutIssues.push('Service Order canonical marker missing');
      }
      if (rendered.serviceOrderLayout.h1s !== 1) {
        rendered.layoutIssues.push(`Service Order expected one semantic page heading, found ${rendered.serviceOrderLayout.h1s}`);
      }
      if (rendered.serviceOrderLayout.lifecycleSteps !== 3
          || rendered.serviceOrderLayout.lifecycleCurrent !== 1) {
        rendered.layoutIssues.push(
          `Service Order lifecycle expected 3 steps and 1 current step, found ${rendered.serviceOrderLayout.lifecycleSteps} and ${rendered.serviceOrderLayout.lifecycleCurrent}`,
        );
      }
      if (rendered.serviceOrderLayout.factCount !== 4) {
        rendered.layoutIssues.push(`Service Order expected 4 overview facts, found ${rendered.serviceOrderLayout.factCount}`);
      }
      if (rendered.serviceOrderLayout.customerActions !== 1) {
        rendered.layoutIssues.push(`Service Order expected 1 Customer 360 action, found ${rendered.serviceOrderLayout.customerActions}`);
      }
      if (!rendered.serviceOrderLayout.diagnosis
          || !rendered.serviceOrderLayout.sla
          || !rendered.serviceOrderLayout.contract) {
        rendered.layoutIssues.push('Service Order is missing diagnosis, SLA or related-contract content');
      }
      if (rendered.serviceOrderLayout.internalOverflow.length) {
        rendered.layoutIssues.push(`Service Order contains internal overflow: ${rendered.serviceOrderLayout.internalOverflow.join(', ')}`);
      }
    }
    if (route === 'po-approval') {
      if (!rendered.poApprovalLayout.canonicalMarker) {
        rendered.layoutIssues.push('PO Approval canonical marker missing');
      }
      if (rendered.poApprovalLayout.h1s !== 1) {
        rendered.layoutIssues.push(`PO Approval expected one semantic page heading, found ${rendered.poApprovalLayout.h1s}`);
      }
      if (rendered.poApprovalLayout.factCount !== 4) {
        rendered.layoutIssues.push(`PO Approval expected 4 overview facts, found ${rendered.poApprovalLayout.factCount}`);
      }
      if (!rendered.poApprovalLayout.lines
          || !rendered.poApprovalLayout.controlledLines
          || !rendered.poApprovalLayout.totals
          || !rendered.poApprovalLayout.decision) {
        rendered.layoutIssues.push('PO Approval is missing controlled lines, totals or decision context');
      }
      if (rendered.poApprovalLayout.backActions) {
        rendered.layoutIssues.push('PO Approval contains a redundant Back action');
      }
      if (rendered.poApprovalLayout.internalOverflow.length) {
        rendered.layoutIssues.push(`PO Approval contains internal overflow: ${rendered.poApprovalLayout.internalOverflow.join(', ')}`);
      }
    }
    if (meta?.layout === LEDGER_DETAIL_LAYOUT) {
      if (!rendered.ledgerDetailLayout.present) {
        rendered.layoutIssues.push(`${LEDGER_DETAIL_LAYOUT} root missing`);
      } else {
        if (rendered.ledgerDetailLayout.actualLayout !== meta.layout) {
          rendered.layoutIssues.push(`rendered ${rendered.ledgerDetailLayout.actualLayout} but declared ${meta.layout}`);
        }
        if (rendered.ledgerDetailLayout.missingRegions.length) {
          rendered.layoutIssues.push(`${LEDGER_DETAIL_LAYOUT} regions missing: ${rendered.ledgerDetailLayout.missingRegions.join(', ')}`);
        }
        if (!rendered.ledgerDetailLayout.ordered) {
          rendered.layoutIssues.push(`${LEDGER_DETAIL_LAYOUT} regions are outside canonical order`);
        }
        if (rendered.ledgerDetailLayout.pageheads !== 1) {
          rendered.layoutIssues.push(`${LEDGER_DETAIL_LAYOUT} rendered ${rendered.ledgerDetailLayout.pageheads} module page headers`);
        }
        if (!rendered.ledgerDetailLayout.errorRegion) {
          rendered.layoutIssues.push(`${LEDGER_DETAIL_LAYOUT} error region missing`);
        }
        if (rendered.ledgerDetailLayout.legacyDocumentChrome) {
          rendered.layoutIssues.push(`${LEDGER_DETAIL_LAYOUT} contains legacy document chrome`);
        }
        if (!rendered.ledgerDetailLayout.openingRow) {
          rendered.layoutIssues.push(`${LEDGER_DETAIL_LAYOUT} opening balance row missing`);
        }
        if (rendered.ledgerDetailLayout.rowCount > 0 && !rendered.ledgerDetailLayout.runningBalance) {
          rendered.layoutIssues.push(`${LEDGER_DETAIL_LAYOUT} running balance cells missing`);
        }
        if (!rendered.ledgerDetailLayout.controlledTable) {
          rendered.layoutIssues.push(`${LEDGER_DETAIL_LAYOUT} table lacks controlled horizontal scrolling`);
        }
        if (rendered.ledgerDetailLayout.unhandledActions.length) {
          rendered.layoutIssues.push(`${LEDGER_DETAIL_LAYOUT} contains unimplemented actions: ${rendered.ledgerDetailLayout.unhandledActions.join(', ')}`);
        }
      }
    }
    if (rendered.ledgerDetailLayout.present && meta?.layout !== LEDGER_DETAIL_LAYOUT) {
      rendered.layoutIssues.push(`rendered ${rendered.ledgerDetailLayout.actualLayout} but declared ${meta?.layout || 'none'}`);
    }
    if (meta?.layout === POSTING_DETAIL_LAYOUT) {
      if (!rendered.postingDetailLayout.present) {
        rendered.layoutIssues.push(`${POSTING_DETAIL_LAYOUT} root missing`);
      } else {
        if (rendered.postingDetailLayout.actualLayout !== meta.layout) {
          rendered.layoutIssues.push(`rendered ${rendered.postingDetailLayout.actualLayout} but declared ${meta.layout}`);
        }
        if (rendered.postingDetailLayout.missingRegions.length) {
          rendered.layoutIssues.push(`${POSTING_DETAIL_LAYOUT} regions missing: ${rendered.postingDetailLayout.missingRegions.join(', ')}`);
        }
        if (!rendered.postingDetailLayout.ordered) {
          rendered.layoutIssues.push(`${POSTING_DETAIL_LAYOUT} regions are outside canonical order`);
        }
        if (rendered.postingDetailLayout.pageheads !== 1) {
          rendered.layoutIssues.push(`${POSTING_DETAIL_LAYOUT} rendered ${rendered.postingDetailLayout.pageheads} module page headers`);
        }
        if (!rendered.postingDetailLayout.errorRegion) {
          rendered.layoutIssues.push(`${POSTING_DETAIL_LAYOUT} error region missing`);
        }
        if (rendered.postingDetailLayout.legacyDocumentChrome) {
          rendered.layoutIssues.push(`${POSTING_DETAIL_LAYOUT} contains legacy document chrome`);
        }
        if (!rendered.postingDetailLayout.emptyState && !rendered.postingDetailLayout.errorVisible) {
          if (!rendered.postingDetailLayout.lines
              || !rendered.postingDetailLayout.totals
              || !rendered.postingDetailLayout.balance
              || !rendered.postingDetailLayout.audit) {
            rendered.layoutIssues.push(`${POSTING_DETAIL_LAYOUT} is missing lines, totals, balance or audit content`);
          }
          if (!rendered.postingDetailLayout.controlledTable) {
            rendered.layoutIssues.push(`${POSTING_DETAIL_LAYOUT} lines table lacks controlled horizontal scrolling`);
          }
        }
      }
    }
    if (rendered.postingDetailLayout.present && meta?.layout !== POSTING_DETAIL_LAYOUT) {
      rendered.layoutIssues.push(`rendered ${rendered.postingDetailLayout.actualLayout} but declared ${meta?.layout || 'none'}`);
    }
    if (route === 'goods-receipt') {
      if (!rendered.goodsReceiptLayout.canonicalMarker) {
        rendered.layoutIssues.push('Goods Receipt canonical marker missing');
      }
      if (rendered.goodsReceiptLayout.h1s !== 1) {
        rendered.layoutIssues.push(`Goods Receipt expected one semantic page heading, found ${rendered.goodsReceiptLayout.h1s}`);
      }
      if (rendered.goodsReceiptLayout.factCount !== 4) {
        rendered.layoutIssues.push(`Goods Receipt expected 4 overview facts, found ${rendered.goodsReceiptLayout.factCount}`);
      }
      if (!rendered.goodsReceiptLayout.lines
          || !rendered.goodsReceiptLayout.trace
          || !rendered.goodsReceiptLayout.effect
          || !rendered.goodsReceiptLayout.immutable) {
        rendered.layoutIssues.push('Goods Receipt is missing lines, inventory trace, stock effect or immutability context');
      }
      if (rendered.goodsReceiptLayout.headerStockActions !== 1) {
        rendered.layoutIssues.push(`Goods Receipt expected one header stock action, found ${rendered.goodsReceiptLayout.headerStockActions}`);
      }
      if (!rendered.goodsReceiptLayout.footerHidden || rendered.goodsReceiptLayout.footerActions) {
        rendered.layoutIssues.push(
          `Goods Receipt footer actions must remain hidden and empty, found hidden=${rendered.goodsReceiptLayout.footerHidden} buttons=${rendered.goodsReceiptLayout.footerActions}`,
        );
      }
      if (rendered.goodsReceiptLayout.backActions) {
        rendered.layoutIssues.push('Goods Receipt contains a redundant Back action');
      }
      if (rendered.goodsReceiptLayout.internalOverflow.length) {
        rendered.layoutIssues.push(`Goods Receipt contains internal overflow: ${rendered.goodsReceiptLayout.internalOverflow.join(', ')}`);
      }
    }
    if (meta?.layout === FINANCIAL_STATEMENT_LAYOUT) {
      if (!rendered.financialStatementLayout.present) {
        rendered.layoutIssues.push(`${FINANCIAL_STATEMENT_LAYOUT} root missing`);
      } else {
        if (rendered.financialStatementLayout.actualLayout !== meta.layout) {
          rendered.layoutIssues.push(`rendered ${rendered.financialStatementLayout.actualLayout} but declared ${meta.layout}`);
        }
        if (rendered.financialStatementLayout.missingRegions.length) {
          rendered.layoutIssues.push(`${FINANCIAL_STATEMENT_LAYOUT} regions missing: ${rendered.financialStatementLayout.missingRegions.join(', ')}`);
        }
        if (!rendered.financialStatementLayout.ordered) {
          rendered.layoutIssues.push(`${FINANCIAL_STATEMENT_LAYOUT} regions are outside canonical order`);
        }
        if (rendered.financialStatementLayout.pageheads !== 1) {
          rendered.layoutIssues.push(`${FINANCIAL_STATEMENT_LAYOUT} rendered ${rendered.financialStatementLayout.pageheads} module page headers`);
        }
        if (!rendered.financialStatementLayout.errorRegion) {
          rendered.layoutIssues.push(`${FINANCIAL_STATEMENT_LAYOUT} error region missing`);
        }
        if (!rendered.financialStatementLayout.controlledTable) {
          rendered.layoutIssues.push(`${FINANCIAL_STATEMENT_LAYOUT} lacks controlled statement scrolling`);
        }
        if (rendered.financialStatementLayout.legacyReportChrome) {
          rendered.layoutIssues.push(`${FINANCIAL_STATEMENT_LAYOUT} contains legacy report chrome`);
        }
        if (!rendered.financialStatementLayout.runHandler) {
          rendered.layoutIssues.push(`${FINANCIAL_STATEMENT_LAYOUT} Run report control missing`);
        }
        if (rendered.financialStatementLayout.comboboxes !== 4) {
          rendered.layoutIssues.push(`${FINANCIAL_STATEMENT_LAYOUT} expected 4 SSOT combobox filters, found ${rendered.financialStatementLayout.comboboxes}`);
        }
        if (rendered.financialStatementLayout.nativeSelects) {
          rendered.layoutIssues.push(`${FINANCIAL_STATEMENT_LAYOUT} contains ${rendered.financialStatementLayout.nativeSelects} native select filters`);
        }
      }
    }
    if (rendered.financialStatementLayout.present && meta?.layout !== FINANCIAL_STATEMENT_LAYOUT) {
      rendered.layoutIssues.push(`rendered ${rendered.financialStatementLayout.actualLayout} but declared ${meta?.layout || 'none'}`);
    }
    const highConfidenceRegister = rendered.layoutProfile.gridTables > 0
      && !rendered.layoutProfile.documentPage
      && !rendered.layoutProfile.formSurface
      && !rendered.layoutProfile.splitSurface
      && !rendered.layoutProfile.dashboardSurface
      && !['report','document-detail','master-detail','workspace',OPERATIONAL_WORKSPACE_LAYOUT,MASTER_DETAIL_EDITOR_LAYOUT,CASE_DETAIL_LAYOUT,LEDGER_DETAIL_LAYOUT,POSTING_DETAIL_LAYOUT,FINANCIAL_STATEMENT_LAYOUT].includes(meta?.layout);
    if (highConfidenceRegister && !LIST_LAYOUTS.has(meta?.layout)) {
      rendered.layoutIssues.push(`list-shaped route is classified as ${meta?.layout || 'none'}`);
    }

    if (meta?.layout === 'transaction-list-v1' && rendered.listLayout.rowCount > 0) {
      await page.evaluate((originalRoute) => navigate(originalRoute),route);
      const listSelector=`[data-layout="transaction-list-v1"][data-list-route="${route}"]`;
      await page.waitForSelector(listSelector,{state:'visible',timeout:5000});
      const row=page.locator(`${listSelector} [data-list-table] .dt-body .dt-r[data-row]`).first();
      const rowPresent=await row.count()===1;
      const beforeParams=rowPresent
        ?await page.evaluate(()=>JSON.stringify(CURRENT_ROUTE_PARAMS||{}))
        :'{}';
      if (rowPresent) {
        await row.click();
        await page.waitForFunction(({originalRoute,params,listSelector})=>{
          const modal=Boolean(document.querySelector('#modalEl'));
          const navigated=(CURRENT_ROUTE!==originalRoute||JSON.stringify(CURRENT_ROUTE_PARAMS||{})!==params)
            && !document.querySelector(listSelector)
            && !document.querySelector('#viewRoot .screen-loading');
          const inPageDetail=Boolean(document.querySelector(
            '[data-master-detail-panel].open,[data-layout="document-detail"],[data-layout="case-detail-v1"],[data-layout="ledger-detail-v1"],[data-layout="posting-detail-v1"]',
          ));
          return modal||navigated||inPageDetail;
        },{originalRoute:route,params:beforeParams,listSelector},{timeout:5000}).catch(()=>{});
      }
      const detailProbe = await page.evaluate((originalRoute) => {
        const modal=document.querySelector('#modalEl');
        const navigated=CURRENT_ROUTE!==originalRoute;
        const inPageDetail=Boolean(document.querySelector(
          '[data-master-detail-panel].open,[data-layout="document-detail"],[data-layout="case-detail-v1"],[data-layout="ledger-detail-v1"],[data-layout="posting-detail-v1"]',
        ));
        return {
          opened:Boolean(modal)||navigated||inPageDetail,
          outcome:modal?(modal.querySelector('[data-record-preview]')?'record-preview':'modal'):(navigated?'navigation':(inPageDetail?'in-page-detail':'none')),
        };
      },route);
      if (!rowPresent || !detailProbe.opened) {
        rendered.layoutIssues.push('first transaction record did not open a detail view');
      }
      await page.evaluate((originalRoute) => {
        if (document.querySelector('#modalEl')) closeModal();
        navigate(originalRoute);
      },route);
      try {
        await page.waitForSelector(listSelector,{state:'visible',timeout:5000});
      } catch {
        // A slow native detail request may finish after the first restore.
        // Re-issue the list navigation only after that response has settled.
        await page.waitForTimeout(SETTLE_MS);
        await page.evaluate((originalRoute)=>navigate(originalRoute),route);
        await page.waitForSelector(listSelector,{state:'visible',timeout:5000});
      }
    }

    results.push({
      route,
      viewport: viewport.label,
      moduleId,
      meta,
      threwSync: throwMessage,
      consoleErrors: events.filter((e) => e.kind === 'console.error').map((e) => e.message),
      pageErrors: events.filter((e) => e.kind === 'pageerror').map((e) => e.message),
      identityLeaks: leaks,
      missingMeta: !meta,
      renderError: rendered.renderError,
      renderErrorMessage: rendered.renderErrorMessage,
      missingPreviewBanner: Boolean(meta && meta.maturity === 'preview' && !rendered.previewBanner),
      enabledPreviewWrites: meta && meta.maturity === 'preview' ? rendered.enabledPreviewWrites : [],
      layoutIssues: rendered.layoutIssues,
      layoutProfile: rendered.layoutProfile,
      missingModuleShell: !['dashboard','settings'].includes(route) && !rendered.moduleShell,
    });

    events.length = 0; // fully consumed this route's window; reset for the next
  }

  if (routes.includes('my-leave')) {
    const myWorkIssues = await page.evaluate(async () => {
      const issues = [];
      const originalLanguage = getLang();
      const originalContext = MY_WORK_CONTEXT;
      const originalDbContext = DB.myWorkContext;
      const originalMethods = {
        context:ErpSystemData.my.context,
        leaveRequests:ErpSystemData.my.leaveRequests,
        leaveApplication:ErpSystemData.my.leaveApplication,
        createLeaveDraft:ErpSystemData.my.createLeaveDraft,
        leaveAction:ErpSystemData.my.leaveAction,
        claims:ErpSystemData.my.claims,
        receipts:ErpSystemData.my.receipts,
        teamLeaveRequests:ErpSystemData.my.teamLeaveRequests,
        teamCalendar:ErpSystemData.my.teamCalendar,
        approvals:ErpSystemData.my.approvals,
        expenseApprovals:ErpSystemData.my.expenseApprovals,
        approvalAction:ErpSystemData.my.approvalAction,
        approvalDelegations:ErpSystemData.my.approvalDelegations,
        approvalDelegationCandidates:ErpSystemData.my.approvalDelegationCandidates,
        createApprovalDelegation:ErpSystemData.my.createApprovalDelegation,
        revokeApprovalDelegation:ErpSystemData.my.revokeApprovalDelegation,
      };
      const employee = {
        id:42,employeeNo:'EMP-AUDIT',fullName:'My Work Auditor',
        department:'Operations',jobTitle:'Coordinator',annualLeaveDays:14,
      };
      const company = {
        companyFn:'C-SG',name:'Acme Singapore',country:'SG',
        currency:'SGD',taxRegime:'GST',locale:'en',
      };
      const selfLeave = [{
        id:71,leaveType:'Annual',startDate:'2026-08-03',endDate:'2026-08-04',
        days:2,reason:'Actor-owned reason',status:'draft',version:1,
        revisionNo:1,unit:'full_day',legacyPolicy:false,
      }];
      const leaveDetail = {
        ...selfLeave[0],employeeId:employee.id,currentRevisionNo:1,
        revisions:[{
          id:711,revisionNo:1,leaveTypeId:1,policyVersionId:1,calendarVersionId:1,
          startDate:'2026-08-03',endDate:'2026-08-04',unit:'full_day',days:'2.00',
          reason:'Actor-owned reason',changeReason:null,evidenceRequired:false,
          createdAt:'2026-07-25T08:00:00Z',
        }],
        events:[{
          id:712,eventType:'created_draft',fromStatus:null,toStatus:'draft',
          reason:null,occurredAt:'2026-07-25T08:00:00Z',
        }],
        evidence:[],cancellations:[],
      };
      const teamLeave = [{
        id:72,employeeId:43,employeeNo:'EMP-TEAM',employeeName:'Team Member',
        department:'Operations',jobTitle:'Coordinator',leaveType:'Medical',
        startDate:'2026-07-27',endDate:'2026-07-27',days:1,status:'pending',
        version:2,revisionNo:1,legacyPolicy:false,conflict:false,conflictCount:0,
        privacy:'reason_and_evidence_redacted',sync:null,
      }];
      const approvalRows = [{
        requestId:72,requestVersion:2,employeeId:43,employeeNo:'EMP-TEAM',
        employeeName:'Team Member',department:'Operations',jobTitle:'Supervisor',
        leaveType:'Annual leave',startDate:'2026-08-05',endDate:'2026-08-06',
        days:'2.00',currentStepNo:1,stepLabel:'Direct manager approval',
        stepActivatedAt:'2026-07-25T08:00:00Z',
        stepDueAt:'2026-07-27T08:00:00Z',
        privacy:'reason_and_evidence_redacted',
        capacity:{action:'warn',breached:true,minimumStaff:1,remainingStaff:0},
      }];
      const setContext = (team,writable=false) => {
        MY_WORK_CONTEXT={
          company,employee,
          leaveTypes:[{id:1,code:'ANNUAL',name:'Annual leave',paid:true,policyVersionId:1}],
          capabilities:{
            leave:{available:true,writable},
            claims:{available:false,reason:'not_modelled'},
            receipts:{available:false,reason:'not_modelled'},
            team:{available:team,employeeCount:team?1:0},
          },
        };
        DB.myWorkContext=MY_WORK_CONTEXT;
        ErpSystemData.my.context=async()=>({data:MY_WORK_CONTEXT,meta:{actorDerived:true}});
      };
      try {
        ErpSystemData.my.leaveRequests=async()=>({data:selfLeave,meta:{actorDerived:true}});
        ErpSystemData.my.leaveApplication=async()=>({
          data:leaveDetail,meta:{actorDerived:true,privacy:'owner_private'},
        });
        ErpSystemData.my.createLeaveDraft=async()=>({
          data:{id:71,status:'draft',version:1},meta:{actorDerived:true},
        });
        ErpSystemData.my.leaveAction=async()=>({
          data:{id:71,status:'draft',version:2},meta:{actorDerived:true},
        });
        ErpSystemData.my.claims=async()=>({data:[],meta:{availability:'not_modelled',plannedEpic:'EPIC-055'}});
        ErpSystemData.my.receipts=async()=>({data:[],meta:{availability:'not_modelled',plannedEpic:'EPIC-054'}});
        ErpSystemData.my.teamLeaveRequests=async()=>({
          data:teamLeave,meta:{privacy:'reason_and_evidence_redacted'},
        });
        ErpSystemData.my.teamCalendar=async()=>({
          data:{items:teamLeave,departments:['Operations'],from:'2026-07-01',to:'2026-07-31'},
          meta:{
            privacy:'reason_and_evidence_redacted',scope:'direct',
            canExpand:true,directReportCount:1,
          },
        });
        ErpSystemData.my.approvals=async()=>({
          data:approvalRows,meta:{privacy:'reason_and_evidence_redacted'},
        });
        ErpSystemData.my.approvalAction=async()=>({
          data:{requestId:72,status:'approved',version:3},
        });
        ErpSystemData.my.approvalDelegations=async()=>({data:[]});
        ErpSystemData.my.approvalDelegationCandidates=async()=>({data:[]});
        ErpSystemData.my.createApprovalDelegation=async()=>({data:{id:1}});
        ErpSystemData.my.revokeApprovalDelegation=async()=>({data:{id:1}});

        setContext(false);
        renderSidebar();
        syncTeamCalendarEntry();
        if (!document.querySelector('#calendarBtn')?.hidden) {
          issues.push('employee without team capability can see the global calendar entry');
        }
        await navigate('team-calendar');
        if (!document.querySelector('#viewRoot [data-access-denied="403"]')) {
          issues.push('employee without team capability did not receive a fail-closed calendar route');
        }
        const expectedTitles = {
          en:'My Leave',ms:'Cuti Saya',zh:'我的请假',ja:'自分の休暇',vi:'Nghỉ phép của tôi',
        };
        for (const [locale,title] of Object.entries(expectedTitles)) {
          await setLang(locale);
          await navigate('my-leave');
          const heading=document.querySelector('#viewRoot h1')?.textContent?.trim()||'';
          if (heading!==title) issues.push(`${locale} My Leave heading rendered as ${heading||'missing'}`);
          const root=document.querySelector('#viewRoot [data-my-work-shell="true"]');
          if (!root || root.getAttribute('data-my-work-view')!=='my-leave') {
            issues.push(`${locale} My Leave SSOT marker missing`);
          }
          if (!root?.textContent.includes('Actor-owned reason')) {
            issues.push(`${locale} actor-owned leave row missing`);
          }
        }
        const employeeTabs=document.querySelectorAll('#viewRoot .sales-subnav .ssub').length;
        if (employeeTabs!==4) {
          issues.push(`employee capability navigation exposed ${employeeTabs} tabs instead of 4`);
        }

        setContext(false,true);
        await navigate('my-leave');
        if (!document.querySelector('#viewRoot [data-list-primary-action]')) {
          issues.push('writable My Leave does not expose its create action');
        }
        const governedRow=document.querySelector('#viewRoot [data-list-table] [data-row="71"]');
        if (governedRow?.dataset.rowInteraction!=='open') {
          issues.push('governed My Leave row is not a real open interaction');
        }
        await navigate('leave-application',{requestId:71});
        const leaveCase=document.querySelector(
          '#viewRoot [data-layout="case-detail-v1"][data-case-route="leave-application"]',
        );
        if (!leaveCase) {
          issues.push('governed Leave Application left case-detail-v1');
        } else {
          const required=['[data-case-overview]','[data-case-error]','[data-case-main]',
            '[data-case-context]','[data-case-actions]'];
          if (required.some((selector)=>!leaveCase.querySelector(selector))) {
            issues.push('governed Leave Application is missing a standard Case region');
          }
          if (!leaveCase.querySelector('[data-my-leave-amend]')
              || !leaveCase.querySelector('[data-my-leave-submit]')
              || !leaveCase.querySelector('[data-my-leave-void]')) {
            issues.push('Draft Leave Application is missing amend, submit or Void actions');
          }
          if (leaveCase.querySelector('[data-my-leave-delete]')) {
            issues.push('Leave Application exposes destructive physical delete');
          }
        }

        setContext(true);
        renderSidebar();
        syncTeamCalendarEntry();
        const calendarEntry=document.querySelector('#calendarBtn');
        if (!calendarEntry || calendarEntry.hidden) {
          issues.push('manager capability did not expose the global calendar entry');
        } else {
          calendarEntry.click();
          await new Promise((resolve)=>setTimeout(resolve,50));
          if (!document.querySelector('#viewRoot [data-layout="calendar-workspace-v1"]')) {
            issues.push('global calendar entry did not open the canonical calendar workspace');
          }
        }
        await navigate('team-calendar');
        const managerRoot=document.querySelector('#viewRoot [data-my-work-shell="true"]');
        const managerTabs=document.querySelectorAll('#viewRoot .sales-subnav .ssub').length;
        if (managerTabs!==6) {
          issues.push(`manager capability navigation exposed ${managerTabs} tabs instead of 6`);
        }
        if (managerRoot?.getAttribute('data-my-work-privacy')!=='reason_and_evidence_redacted') {
          issues.push('team route privacy marker missing');
        }
        if (!managerRoot?.textContent.includes('Team Member')
            || managerRoot?.textContent.includes('Actor-owned reason')) {
          issues.push('team route did not keep actor reasons outside the manager view');
        }
        await navigate('my-approvals');
        const approvalRoot=document.querySelector(
          '#viewRoot [data-layout="master-detail-register-v1"][data-list-route="my-approvals"]',
        );
        const approvalRow=approvalRoot?.querySelector('[data-list-table] .dt-r[data-row]');
        if (!approvalRoot) {
          issues.push('My Approvals left master-detail-register-v1');
        }
        if (!approvalRow
            || approvalRoot.querySelectorAll('[data-list-table] .dt-r[data-row]').length!==1) {
          issues.push('pending team approval row missing');
        }
        approvalRow?.click();
        await new Promise((resolve)=>setTimeout(resolve,50));
        const decisionButtons=[...document.querySelectorAll(
          '#viewRoot [data-approval-action="approve"],#viewRoot [data-approval-action="reject"]',
        )];
        if (decisionButtons.length!==2 || decisionButtons.some((button)=>button.disabled)) {
          issues.push('governed approval decision actions are missing or disabled');
        }

        const unlinkedRoutes=['my-leave','my-claims','my-receipts','team-calendar','my-approvals'];
        let contextCalls=0;
        let downstreamCalls=0;
        const missingIdentity=()=>{
          const error=new Error('The signed-in account is not linked to an active employee in this company.');
          error.code='employee_identity_missing';
          error.status=409;
          return error;
        };
        ErpSystemData.my.context=async()=>{contextCalls+=1;throw missingIdentity();};
        for(const method of ['leaveRequests','claims','receipts','teamCalendar','approvals','expenseApprovals']){
          ErpSystemData.my[method]=async()=>{
            downstreamCalls+=1;
            throw new Error(`unlinked route called ${method} after identity rejection`);
          };
        }
        for(const [index,route] of unlinkedRoutes.entries()){
          await navigate(route);
          const emptyRoot=document.querySelector(
            `#viewRoot [data-my-work-shell="true"][data-my-work-view="${route}"]`,
          );
          if(!emptyRoot) issues.push(`${route} lost its no-active-employee empty state`);
          if(contextCalls!==index+1){
            issues.push(`${route} resolved unlinked identity ${contextCalls-index} times`);
          }
          if(downstreamCalls!==0){
            issues.push(`${route} made ${downstreamCalls} downstream request(s) after identity rejection`);
          }
        }
      } finally {
        Object.assign(ErpSystemData.my,originalMethods);
        MY_WORK_CONTEXT=originalContext;
        DB.myWorkContext=originalDbContext;
        await setLang(originalLanguage);
        renderSidebar();
        await navigate('dashboard');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'my-leave');
    if (result) {
      result.layoutIssues.push(...myWorkIssues.map((issue)=>`My Work smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind === 'console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind === 'pageerror').map((event)=>event.message));
    }
    events.length = 0;
  }

  if (routes.includes('service-contracts')) {
    const listInteractionIssues = await page.evaluate(async () => {
      const issues = [];
      const settle = () => new Promise((resolve)=>setTimeout(resolve,250));
      await navigate('service-contracts');
      let row=document.querySelector('#viewRoot [data-list-route="service-contracts"] .dt-r[data-row]');
      if (!row) {
        issues.push('Service Contracts has no row for interaction proof');
      } else {
        const expectedId=Number(row.dataset.row);
        if (row.dataset.rowInteraction!=='open'||row.tabIndex!==0||!row.getAttribute('aria-label')) {
          issues.push('Service Contract row lacks explicit open/focus/name metadata');
        }
        const checkbox=row.querySelector('[data-rowcheck]');
        checkbox?.click();
        await settle();
        if (CURRENT_ROUTE!=='service-contracts') {
          issues.push('row checkbox bubbled into the detail action');
        }
        row.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
        await settle();
        if (CURRENT_ROUTE!=='service-contract'||Number(CURRENT_ROUTE_PARAMS?.contractId)!==expectedId) {
          issues.push('Enter did not open the selected Service Contract');
        }
        await navigate('service-contracts');
        row=document.querySelector('#viewRoot [data-list-route="service-contracts"] .dt-r[data-row]');
        row?.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
        await settle();
        if (CURRENT_ROUTE!=='service-contract'||Number(CURRENT_ROUTE_PARAMS?.contractId)!==expectedId) {
          issues.push('Space did not open the selected Service Contract');
        }
      }

      await navigate('user-mgmt');
      const previewRow=document.querySelector('#viewRoot [data-list-route="user-mgmt"] .dt-r[data-row]');
      if (!previewRow) {
        issues.push('User Management has no row for record-preview proof');
      } else {
        previewRow.click();
        await settle();
        if (CURRENT_ROUTE!=='user-mgmt') issues.push('User record preview unexpectedly navigated');
        if (!document.querySelector('#modalEl [data-record-preview]')) {
          issues.push('User row did not open the shared record preview');
        }
        if (previewRow.dataset.rowInteraction!=='open'||previewRow.tabIndex!==0
            ||!previewRow.getAttribute('aria-label')||getComputedStyle(previewRow).cursor!=='pointer') {
          issues.push('User row is missing the accessible record-preview affordance');
        }
        closeModal();
      }
      return issues;
    });
    const result = results.find((row)=>row.route==='service-contracts');
    if (result) {
      result.layoutIssues.push(...listInteractionIssues.map((issue)=>`List interaction smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind==='console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind==='pageerror').map((event)=>event.message));
    }
    events.length=0;
  }

  if (routes.includes('timesheet')) {
    const timesheetIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const originalSession = adapter.session;
      const expectedTitles = {
        en:'Timesheet',
        ms:'Lembaran masa',
        zh:'工时表',
        ja:'タイムシート',
        vi:'Bảng chấm công',
      };
      const projects = [{
        id:901,projectNo:'PRJ-TS-901',name:'Timesheet SSOT Proof',status:'open',
      }];
      const activeEntry = {
        id:9101,projectId:901,workDate:'2026-07-23',task:'SSOT active proof',
        hours:'2.50',status:'active',version:1,voidReason:null,
      };
      const voidedEntry = {
        id:9102,projectId:901,workDate:'2026-07-24',task:'SSOT void proof',
        hours:'1.25',status:'voided',version:2,voidReason:'Audit correction',
      };
      const issues = [];
      const root = () => document.querySelector(
        '#viewRoot [data-layout="transaction-list-v1"][data-list-route="timesheet"]',
      );
      const waitFor = async (predicate) => {
        for (let attempt = 0; attempt < 50; attempt += 1) {
          if (predicate()) return true;
          await new Promise((resolve) => setTimeout(resolve,20));
        }
        return false;
      };
      const stub = ({entries=[],projectRows=projects,error=null}) => {
        adapter.list = async (resource,query) => {
          if (resource === 'project/time-entries') {
            if (error) throw error;
            return entries;
          }
          if (resource === 'project/projects') return projectRows;
          return originalList.call(adapter,resource,query);
        };
        adapter.session = async () => ({fullName:'Timesheet Auditor'});
      };

      try {
        for (const [locale,title] of Object.entries(expectedTitles)) {
          window.getLang = () => locale;
          stub({entries:[]});
          await navigate('timesheet',{weekStart:'2026-07-20'});
          await waitFor(() => root()?.querySelectorAll('[data-list-kpis] .so-kpi').length === 3);
          if (!root()) issues.push(`${locale} transaction-list root missing`);
          if (document.querySelector('#viewRoot h1')?.textContent?.trim() !== title) {
            issues.push(`${locale} title did not translate`);
          }
          if (!root()?.querySelector('[data-list-empty]')) {
            issues.push(`${locale} empty state missing`);
          }
          if (root()?.querySelectorAll('[data-ts-week-controls] button').length !== 3) {
            issues.push(`${locale} week controls missing`);
          }
        }

        window.getLang = () => 'en';
        let releaseLoading;
        const loadingGate = new Promise((resolve) => { releaseLoading=resolve; });
        adapter.list = async (resource,query) => {
          if (resource === 'project/time-entries' || resource === 'project/projects') {
            await loadingGate;
            return resource === 'project/projects' ? projects : [];
          }
          return originalList.call(adapter,resource,query);
        };
        adapter.session = async () => ({fullName:'Timesheet Auditor'});
        await navigate('timesheet',{weekStart:'2026-07-20'});
        if (!root()?.querySelector('[data-list-empty]')) {
          issues.push('loading state is outside the transaction-list contract');
        }
        if (root()?.getAttribute('data-canonical-timesheet') === 'true') {
          issues.push('loading state exposed the ready-only canonical compatibility marker');
        }
        releaseLoading();
        await waitFor(() => root()?.querySelectorAll('[data-list-kpis] .so-kpi').length === 3);

        stub({error:new Error('Timesheet audit load failure')});
        await navigate('timesheet',{weekStart:'2026-07-20'});
        await waitFor(() => root()?.querySelector('[data-list-empty] h3')?.textContent?.includes('could not be loaded'));
        if (!root()?.querySelector('[data-list-toolbar-action]')) {
          issues.push('error state retry action missing');
        }
        if (!document.querySelector('#viewRoot [data-list-primary-action][disabled]')) {
          issues.push('error state left Log time enabled');
        }

        stub({entries:[activeEntry,voidedEntry]});
        await navigate('timesheet',{weekStart:'2026-07-20'});
        await waitFor(() => root()?.querySelectorAll('[data-list-table] .dt-r[data-row]').length === 2);
        const kpiText = root()?.querySelector('[data-list-kpis]')?.textContent || '';
        if (!kpiText.includes('2.50 h')) issues.push('active hours KPI is not active-only');
        if (document.querySelector('#viewRoot .countchip')?.textContent?.trim() !== '1') {
          issues.push('header count is not active-only');
        }
        if (root()?.querySelectorAll('.transaction-row-menu').length !== 1) {
          issues.push('active/voided row action boundary is incorrect');
        }
        if (root()?.querySelector('table.lines,.docpage,.statgrid')) {
          issues.push('populated state contains legacy Timesheet chrome');
        }
        const unsupported = [...(root()?.querySelectorAll('button') || [])]
          .map((button) => (button.textContent || '').replace(/\s+/g,' ').trim())
          .filter((label) => /\b(capacity|copy last week|submit for approval|payroll|export)\b/i.test(label));
        if (unsupported.length) issues.push(`unsupported actions remain: ${unsupported.join(', ')}`);
      } finally {
        window.getLang = originalGetLang;
        adapter.list = originalList;
        adapter.session = originalSession;
        closeModal();
        closeAllPops();
        await navigate('dashboard');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'timesheet');
    if (result && timesheetIssues.length) {
      result.layoutIssues.push(...timesheetIssues.map((issue) => `Timesheet smoke: ${issue}`));
    }
  }

  if (routes.includes('leave-approval')) {
    const leaveIssues = await page.evaluate(async ({ mobile }) => {
      const originalGetLang = window.getLang;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const originalAction = adapter.action;
      const expected = {
        en:'Leave Approval',
        ms:'Kelulusan Cuti',
        zh:'请假审批',
        ja:'休暇承認',
        vi:'Phê duyệt nghỉ phép',
      };
      const issues = [];
      const leaveRoot = () => document.querySelector('#viewRoot [data-layout="master-detail-register-v1"][data-list-route="leave-approval"]');
      const row = () => leaveRoot()?.querySelector('[data-list-table] .dt-r[data-row]');
      try {
        for (const [locale,title] of Object.entries(expected)) {
          window.getLang = () => locale;
          await navigate('leave-approval');
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (!heading.startsWith(title)) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          if (!leaveRoot()) issues.push(`${locale} master-detail register root missing`);
        }

        window.getLang = () => 'en';
        await navigate('leave-approval');
        if (mobile && row()) {
          if (leaveRoot()?.querySelector('[data-master-detail-panel].open')) {
            issues.push('mobile detail drawer opened before row selection');
          }
          row().click();
          if (!leaveRoot()?.querySelector('[data-master-detail-panel].open')) {
            issues.push('mobile row selection did not open the detail drawer');
          }
          leaveRoot()?.querySelector('[data-master-detail-close]')?.click();
          if (leaveRoot()?.querySelector('[data-master-detail-panel].open')) {
            issues.push('mobile detail close did not return to the queue');
          }
          row()?.click();
        }

        const approve = leaveRoot()?.querySelector('[data-leave-action="approve"]');
        if (!approve) {
          issues.push('pending request is missing the Approve action');
        } else {
          adapter.action = async () => { throw new Error('leave action audit failure'); };
          approve.click();
          await new Promise((resolve) => setTimeout(resolve, 20));
          if (!leaveRoot()?.querySelector('[data-leave-action-error]')) {
            issues.push('failed leave action did not render the inline detail error');
          }
          if (leaveRoot()?.querySelectorAll('[data-leave-action]:not([disabled])').length !== 2) {
            issues.push('failed leave action did not re-enable both disposition actions');
          }
          adapter.action = originalAction;
        }

        adapter.list = async (resource,query) => resource === 'hr/leave-requests'
          ? {data:[],meta:{nextCursor:null}}
          : originalList.call(adapter,resource,query);
        await navigate('leave-approval');
        if (!leaveRoot()?.querySelector('[data-list-empty]')) {
          issues.push('leave-request empty state missing');
        }
        if (!leaveRoot()?.querySelector('[data-master-detail-panel].is-empty')) {
          issues.push('leave-request empty state left the detail contract open');
        }

        adapter.list = async (resource,query) => resource === 'hr/employees'
          ? {data:[],meta:{nextCursor:null}}
          : originalList.call(adapter,resource,query);
        await navigate('leave-approval');
        if (mobile) row()?.click();
        if (!leaveRoot()) issues.push('missing employee relation left the shared register shell');
        if (leaveRoot()?.querySelector('[data-master-detail-panel].open')
            && !leaveRoot()?.querySelector('[data-master-detail-panel] svg.profile-avatar-fallback')) {
          issues.push('missing employee relation did not render the SVG avatar fallback');
        }
      } finally {
        adapter.list = originalList;
        adapter.action = originalAction;
        window.getLang = originalGetLang;
        await navigate('leave-approval');
      }
      return issues;
    }, { mobile: viewport.width <= 980 });
    const result = results.find((row) => row.route === 'leave-approval');
    if (result) {
      result.layoutIssues.push(...leaveIssues.map((issue) => `Leave Approval smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event) => event.kind === 'console.error').map((event) => event.message));
      result.pageErrors.push(...events.filter((event) => event.kind === 'pageerror').map((event) => event.message));
    }
    events.length = 0;
  }

  if (routes.includes('payroll-run')) {
    const payrollIssues = await page.evaluate(async ({ mobile }) => {
      const originalGetLang = window.getLang;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const originalAction = adapter.action;
      const expected = {
        en:'Payroll Run',
        ms:'Larian Gaji',
        zh:'薪资运行',
        ja:'給与計算',
        vi:'Đợt Tính Lương',
      };
      const issues = [];
      const payrollRoot = () => document.querySelector('#viewRoot [data-layout="master-detail-register-v1"][data-list-route="payroll-run"]');
      const row = () => payrollRoot()?.querySelector('[data-list-table] .dt-r[data-row]');
      try {
        const originalRuns = await originalList.call(adapter,'payroll/runs',{limit:100});
        const draftRuns = (originalRuns.data || []).map((run,index) => index === 0
          ? {...run,status:'draft'}
          : run);
        adapter.list = async (resource,query) => resource === 'payroll/runs'
          ? {data:draftRuns,meta:{...(originalRuns.meta || {}),nextCursor:null}}
          : originalList.call(adapter,resource,query);

        for (const [locale,title] of Object.entries(expected)) {
          window.getLang = () => locale;
          await navigate('payroll-run');
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (!heading.startsWith(title)) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          if (!payrollRoot()) issues.push(`${locale} master-detail register root missing`);
        }

        window.getLang = () => 'en';
        await navigate('payroll-run');
        if (mobile && row()) {
          if (payrollRoot()?.querySelector('[data-master-detail-panel].open')) {
            issues.push('mobile detail drawer opened before run selection');
          }
          row().click();
          if (!payrollRoot()?.querySelector('[data-master-detail-panel].open')) {
            issues.push('mobile run selection did not open the detail drawer');
          }
          payrollRoot()?.querySelector('[data-master-detail-close]')?.click();
          if (payrollRoot()?.querySelector('[data-master-detail-panel].open')) {
            issues.push('mobile detail close did not return to the register');
          }
          row()?.click();
        }

        const post = payrollRoot()?.querySelector('[data-payroll-action="post"]');
        if (draftRuns.length && !post) {
          issues.push('draft payroll run is missing the Post action');
        } else if (post) {
          adapter.action = async () => { throw new Error('payroll post audit failure'); };
          post.click();
          const confirm = document.querySelector('#modalEl [data-payroll-post-confirm]');
          if (!confirm) {
            issues.push('payroll post confirmation modal did not open');
          } else {
            confirm.click();
            await new Promise((resolve) => setTimeout(resolve,20));
            if (!payrollRoot()?.querySelector('[data-payroll-action-error]')) {
              issues.push('failed payroll post did not render the inline detail error');
            }
            if (!payrollRoot()?.querySelector('[data-payroll-action="post"]:not([disabled])')) {
              issues.push('failed payroll post did not re-enable the action');
            }
            await new Promise((resolve) => setTimeout(resolve,220));
          }
          adapter.action = originalAction;
        }

        adapter.list = async (resource,query) => resource === 'payroll/runs'
          ? {data:[],meta:{nextCursor:null}}
          : resource === 'payroll/run-lines'
            ? {data:[],meta:{nextCursor:null}}
            : originalList.call(adapter,resource,query);
        await navigate('payroll-run');
        if (!payrollRoot()?.querySelector('[data-list-empty]')) {
          issues.push('payroll-run empty state missing');
        }
        if (!payrollRoot()?.querySelector('[data-master-detail-panel].is-empty')) {
          issues.push('payroll-run empty state left the detail contract open');
        }
        payrollRoot()?.closest('.master')?.querySelector('[data-list-primary-action]')?.click();
        const modal = document.querySelector('#modalEl');
        if (!modal) {
          issues.push('new payroll run modal did not open');
        } else {
          const start = modal.querySelector('#prStart');
          const end = modal.querySelector('#prEnd');
          const payDate = modal.querySelector('#prPayDate');
          const create = modal.querySelector('[data-payroll-create]');
          const error = modal.querySelector('[data-payroll-create-error]');
          const defaults = payrollPeriodDefaults();
          const expectedStart = defaults.start;
          const expectedEnd = defaults.end;
          const expectedPayDate = defaults.payDate;
          const modalRect = modal.getBoundingClientRect();
          const createRect = create?.getBoundingClientRect();
          if (!start || !end || !payDate || !create || !error) {
            issues.push('new payroll run modal is missing its period fields');
          } else {
            if (start.value !== expectedStart || end.value !== expectedEnd || payDate.value !== expectedPayDate) {
              issues.push(`new payroll run defaults do not follow the active fiscal period: ${start.value}/${end.value}/${payDate.value}`);
            }
            if (!error.hidden || getComputedStyle(error).display !== 'none') {
              issues.push('new payroll run modal exposes its empty error before validation');
            }
            if (modalRect.left < 8 || modalRect.right > innerWidth - 8
                || modal.scrollWidth > modal.clientWidth + 1) {
              issues.push(`new payroll run modal exceeds the ${innerWidth}px viewport`);
            }
            if (!createRect || createRect.left < 8 || createRect.right > innerWidth - 8) {
              issues.push('new payroll run primary action is outside the clickable viewport');
            }
            start.value = '2026-07-31';
            end.value = '2026-07-01';
            create.click();
            if (error.hidden !== false || getComputedStyle(error).display === 'none'
                || !error.textContent.trim()) {
              issues.push('invalid payroll period did not render the inline modal error');
            }
            const errorRect = error.getBoundingClientRect();
            const formRect = modal.querySelector('.payroll-run-form')?.getBoundingClientRect();
            if (!formRect || Math.abs(errorRect.left - formRect.left) > 1
                || Math.abs(errorRect.right - formRect.right) > 1) {
              issues.push('payroll modal error does not align with the form fields');
            }
          }
          closeModal();
        }
      } finally {
        adapter.list = originalList;
        adapter.action = originalAction;
        window.getLang = originalGetLang;
        closeModal();
        await navigate('payroll-run');
      }
      return issues;
    }, { mobile: viewport.width <= 980 });
    const result = results.find((row) => row.route === 'payroll-run');
    if (result) {
      result.layoutIssues.push(...payrollIssues.map((issue) => `Payroll Run smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event) => event.kind === 'console.error').map((event) => event.message));
      result.pageErrors.push(...events.filter((event) => event.kind === 'pageerror').map((event) => event.message));
    }
    events.length = 0;
  }

  if (routes.includes('asset-detail')) {
    const assetDetailIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const expected = {
        en:'Asset profile',
        ms:'Profil aset',
        zh:'资产档案',
        ja:'資産プロフィール',
        vi:'Hồ sơ tài sản',
      };
      const assets = [{
        id:9801,assetNo:'FA-9801',name:'Audit Delivery Van',category:'Vehicles',
        location:'Audit Yard',acquisitionDate:'2024-06-15',cost:'68000.00',
        residualValue:'8000.00',usefulLifeYears:5,accumulatedDepreciation:'1000.00',
        method:'straight_line',status:'in_use',version:2,
      },{
        id:9802,assetNo:'FA-9802',name:'Audit CNC',category:'Plant & Machinery',
        location:null,acquisitionDate:'2025-01-10',cost:'120000.00',
        residualValue:'12000.00',usefulLifeYears:10,accumulatedDepreciation:'0.00',
        method:'straight_line',status:'idle',version:1,
      }];
      const runs = [{
        id:9811,docNo:'DEP-9811',runDate:'2026-07-25',status:'posted',
        totalAmount:'1000.00',version:2,postedAt:'2026-07-25T04:00:00.000Z',
      },{
        id:9812,docNo:'DEP-9812',runDate:'2026-08-25',status:'draft',
        totalAmount:'1000.00',version:1,postedAt:null,
      }];
      const postedLine = {
        id:9821,runId:9811,lineNo:1,assetId:9801,
        openingNbv:'68000.00',depreciationAmount:'1000.00',closingNbv:'67000.00',
      };
      const draftLine = {
        id:9822,runId:9812,lineNo:1,assetId:9801,
        openingNbv:'67000.00',depreciationAmount:'1000.00',closingNbv:'66000.00',
      };
      let assetRows=assets;
      let runRows=runs;
      let lineRows=[postedLine,draftLine];
      const issues = [];
      const assetRoot = () => document.querySelector(
        '#viewRoot [data-layout="master-detail-editor-v1"][data-master-detail-route="asset-detail"]',
      );
      const installStub = () => {
        adapter.list = async (resource,query) => {
          if (resource === 'assets/assets') return {data:assetRows,meta:{nextCursor:null}};
          if (resource === 'assets/depreciation-runs') return {data:runRows,meta:{nextCursor:null}};
          if (resource === 'assets/depreciation-run-lines') return {data:lineRows,meta:{nextCursor:null}};
          return originalList.call(adapter,resource,query);
        };
      };
      try {
        installStub();
        for (const [locale,title] of Object.entries(expected)) {
          window.getLang = () => locale;
          await navigate('asset-detail',{assetId:9801});
          const root = assetRoot();
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (heading !== title) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          if (!root) issues.push(`${locale} master-detail editor root missing`);
          if (root?.getAttribute('data-canonical-asset-detail') !== 'true') {
            issues.push(`${locale} canonical marker missing`);
          }
          if (root?.querySelectorAll('[data-master-detail-overview] .master-detail-editor-fact').length !== 4) {
            issues.push(`${locale} expected four overview facts`);
          }
        }

        window.getLang = () => 'en';
        await navigate('asset-detail',{assetId:9801});
        let root = assetRoot();
        if (document.querySelectorAll('#viewRoot h1').length !== 1) {
          issues.push('asset detail does not render exactly one page heading');
        }
        if (root?.querySelector('.docwrap,.docpage,.dochead,.doclayout,.summary,.sumcard,input[readonly]')) {
          issues.push('legacy document chrome or read-only fake controls remain');
        }
        if (root?.querySelectorAll('[data-asset-depreciation-history] .dt-r[data-row]').length !== 1) {
          issues.push('posted depreciation history is missing or includes an unposted run');
        }
        if (!root?.querySelector('[data-asset-book-value]')
            || !root?.textContent.includes('S$67,000.00')
            || !root?.querySelector('[data-asset-depreciation-progress]')) {
          issues.push('book value or depreciation progress context is incomplete');
        }
        const actions = root?.querySelector('[data-master-detail-actions]');
        if (!actions?.hasAttribute('hidden') || actions?.querySelectorAll('button').length) {
          issues.push('read-only asset detail exposes a populated footer action region');
        }

        await navigate('asset-detail',{assetId:9802});
        root = assetRoot();
        if (!root?.querySelector('[data-asset-depreciation-empty]')) {
          issues.push('asset with no posted depreciation lacks the local empty state');
        }
        const alternateStatus = document.querySelector('#viewRoot [data-master-detail-page-actions] .cap');
        if (!root?.textContent.includes('Audit CNC') || alternateStatus?.textContent?.trim() !== 'Idle') {
          issues.push('alternate asset identity or status did not refresh');
        }

        await navigate('asset-detail',{assetId:999999});
        if (!assetRoot()?.querySelector('[data-master-detail-empty]')) {
          issues.push('unknown asset id does not render the standard empty state');
        }

        assetRows=[];
        runRows=[];
        lineRows=[];
        await navigate('asset-detail');
        if (!assetRoot()?.querySelector('[data-master-detail-empty]')) {
          issues.push('no-asset state left the shared editor shell');
        }
      } finally {
        adapter.list = originalList;
        window.getLang = originalGetLang;
        await navigate('asset-detail');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'asset-detail');
    if (result) {
      result.layoutIssues.push(...assetDetailIssues.map((issue) => `Asset Detail state smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event) => event.kind === 'console.error').map((event) => event.message));
      result.pageErrors.push(...events.filter((event) => event.kind === 'pageerror').map((event) => event.message));
    }
    events.length = 0;
  }

  if (routes.includes('depreciation')) {
    const depreciationIssues = await page.evaluate(async ({ mobile }) => {
      const originalGetLang = window.getLang;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const originalCreate = adapter.create;
      const originalAction = adapter.action;
      const expected = {
        en:'Depreciation Run',
        ms:'Larian Susut Nilai',
        zh:'折旧运算',
        ja:'減価償却実行',
        vi:'Đợt Chạy Khấu Hao',
      };
      const assets = [{
        id:801,assetNo:'FA-801',name:'Audit CNC',category:'Plant & Machinery',
        location:'Plant 1',acquisitionDate:'2025-01-01',cost:'120000.00',
        residualValue:'12000.00',usefulLifeYears:5,accumulatedDepreciation:'1800.00',
        method:'straight_line',status:'in_use',version:1,
      },{
        id:802,assetNo:'FA-802',name:'Audit Van',category:'Vehicles',
        location:'HQ',acquisitionDate:'2025-02-01',cost:'60000.00',
        residualValue:'6000.00',usefulLifeYears:5,accumulatedDepreciation:'900.00',
        method:'straight_line',status:'in_use',version:1,
      }];
      const draft = {
        id:903,docNo:'DEP-0903',runDate:'2026-07-25',status:'draft',
        totalAmount:'2700.00',version:1,postedAt:null,
      };
      const posted = {
        id:902,docNo:'DEP-0902',runDate:'2026-06-30',status:'posted',
        totalAmount:'2700.00',version:2,postedAt:'2026-06-30T04:00:00.000Z',
      };
      const cancelled = {
        id:901,docNo:'DEP-0901',runDate:'2026-05-31',status:'cancelled',
        totalAmount:'2700.00',version:2,postedAt:null,
      };
      const linesFor = (runId) => [{
        id:runId*10+1,runId,lineNo:1,assetId:801,
        openingNbv:'118200.00',depreciationAmount:'1800.00',closingNbv:'116400.00',
      },{
        id:runId*10+2,runId,lineNo:2,assetId:802,
        openingNbv:'59100.00',depreciationAmount:'900.00',closingNbv:'58200.00',
      }];
      let runRows=[draft,posted,cancelled];
      let lineRows=runRows.flatMap((run)=>linesFor(run.id));
      const issues = [];
      const depRoot = () => document.querySelector(
        '#viewRoot [data-layout="master-detail-register-v1"][data-list-route="depreciation"]',
      );
      const rows = () => [...(depRoot()?.querySelectorAll('[data-list-table] .dt-r[data-row]') || [])];
      const activeModal = () => {
        const modals = document.querySelectorAll('body > #modalEl');
        return modals[modals.length - 1] || null;
      };
      const installListStub = () => {
        adapter.list = async (resource,query) => {
          if (resource === 'assets/assets') return {data:assets,meta:{nextCursor:null}};
          if (resource === 'assets/depreciation-runs') return {data:runRows,meta:{nextCursor:null}};
          if (resource === 'assets/depreciation-run-lines') return {data:lineRows,meta:{nextCursor:null}};
          return originalList.call(adapter,resource,query);
        };
      };
      const wait = (ms=30) => new Promise((resolve)=>setTimeout(resolve,ms));
      try {
        installListStub();
        for (const [locale,title] of Object.entries(expected)) {
          window.getLang = () => locale;
          await navigate('depreciation');
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (heading !== title) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          if (!depRoot()) issues.push(`${locale} master-detail register root missing`);
          if (depRoot()?.getAttribute('data-canonical-depreciation') !== 'true') {
            issues.push(`${locale} canonical marker missing`);
          }
        }

        window.getLang = () => 'en';
        await navigate('depreciation');
        const primary = document.querySelector('#viewRoot [data-list-primary-action]');
        if (rows().length !== 3) issues.push('mixed depreciation history did not render all runs');
        if (!primary?.disabled || !primary?.title.includes('pending')) {
          issues.push('an existing draft did not disable and explain the new-run action');
        }
        if (depRoot()?.querySelector('.report,.report-params,.report-result,.report-toolbar,input[readonly]')) {
          issues.push('legacy report chrome or read-only fake controls remain');
        }
        if (rows().some((row)=>row.dataset.rowInteraction!=='select'||row.getAttribute('tabindex')!=='0')) {
          issues.push('depreciation history rows do not use the select interaction contract');
        }

        if (mobile && rows()[0]) {
          if (depRoot()?.querySelector('[data-master-detail-panel].open')) {
            issues.push('mobile depreciation detail opened before row selection');
          }
          rows()[0].click();
          if (!depRoot()?.querySelector('[data-master-detail-panel].open')) {
            issues.push('mobile depreciation row did not open the detail drawer');
          }
          depRoot()?.querySelector('[data-master-detail-close]')?.click();
          if (depRoot()?.querySelector('[data-master-detail-panel].open')) {
            issues.push('mobile depreciation detail did not close');
          }
          rows()[0]?.click();
        }

        const post = depRoot()?.querySelector('[data-depreciation-post]');
        if (!post) {
          issues.push('draft depreciation run is missing Post to GL');
        } else {
          adapter.action = async () => { throw new Error('depreciation post audit failure'); };
          post.click();
          const confirm = activeModal()?.querySelector('[data-depreciation-post-confirm]');
          if (!confirm) {
            issues.push('depreciation post confirmation modal did not open');
          } else {
            confirm.click();
            await wait();
            const error = activeModal()?.querySelector('[data-depreciation-post-error]');
            if (!error || error.hidden || !error.textContent.includes('audit failure')) {
              issues.push('failed depreciation post did not remain recoverable in the modal');
            }
            if (confirm.disabled) issues.push('failed depreciation post did not re-enable confirmation');
          }
          closeModal();
          await wait(220);
          adapter.action = originalAction;
        }

        runRows=[];
        lineRows=[];
        await navigate('depreciation');
        if (!depRoot()?.querySelector('[data-list-empty]')
            || !depRoot()?.querySelector('[data-master-detail-panel].is-empty')) {
          issues.push('empty depreciation register left the shared empty/detail contract');
        }
        const emptyPrimary = document.querySelector('#viewRoot [data-list-primary-action]');
        if (!emptyPrimary || emptyPrimary.disabled) {
          issues.push('empty depreciation register did not enable Run depreciation');
        } else {
          emptyPrimary.click();
          const modal = activeModal();
          const create = modal?.querySelector('[data-depreciation-create]');
          const date = modal?.querySelector('#depRunDate');
          const facts = modal?.querySelector('.depreciation-run-modal-facts');
          const error = modal?.querySelector('[data-depreciation-create-error]');
          const now = new Date();
          const expectedDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
          const modalRect = modal?.getBoundingClientRect();
          if (!modal || !create || !date || !facts || !error) {
            issues.push('new depreciation run modal is incomplete');
          } else {
            if (facts.querySelector('input') || modal.querySelectorAll('input').length !== 1) {
              issues.push('run number or method still renders as a fake form control');
            }
            if (date.value !== expectedDate) {
              issues.push(`depreciation run date is not local calendar date: ${date.value}`);
            }
            if (!error.hidden || getComputedStyle(error).display !== 'none') {
              issues.push('new depreciation modal exposes an empty error');
            }
            if (modalRect.left < 8 || modalRect.right > innerWidth - 8
                || modal.scrollWidth > modal.clientWidth + 1) {
              issues.push(`new depreciation modal exceeds the ${innerWidth}px viewport`);
            }

            adapter.create = async () => { throw new Error('No assets have remaining depreciable value to run'); };
            create.click();
            await wait();
            if (error.hidden || !error.textContent.includes('No assets') || create.disabled) {
              issues.push('failed depreciation create is not recoverable in the modal');
            }

            adapter.create = async () => {
              runRows=[draft];
              lineRows=linesFor(draft.id);
              return {data:draft,meta:{}};
            };
            create.click();
            await wait(100);
            if (rows().length !== 1
                || !document.querySelector('#viewRoot [data-list-primary-action][disabled]')) {
              issues.push('successful depreciation create did not refresh the draft register');
            }
          }
        }

        if (mobile && rows()[0] && !depRoot()?.querySelector('[data-master-detail-panel].open')) {
          rows()[0].click();
        }
        adapter.action = async () => {
          runRows=[{...draft,status:'posted',version:2,postedAt:'2026-07-25T04:00:00.000Z'}];
          return {data:runRows[0],meta:{}};
        };
        depRoot()?.querySelector('[data-depreciation-post]')?.click();
        activeModal()?.querySelector('[data-depreciation-post-confirm]')?.click();
        await wait(100);
        if (!depRoot()?.querySelector('[data-depreciation-gl]')
            || document.querySelector('#viewRoot [data-list-primary-action]')?.disabled) {
          issues.push('successful depreciation post did not refresh status and actions');
        }

        runRows=[cancelled];
        lineRows=linesFor(cancelled.id);
        adapter.action=originalAction;
        await navigate('depreciation');
        if (mobile) rows()[0]?.click();
        if (depRoot()?.querySelector('[data-depreciation-actions]')
            || !depRoot()?.textContent.includes('Cancelled')) {
          issues.push('cancelled depreciation run is not read-only or lacks its status');
        }
      } finally {
        adapter.list = originalList;
        adapter.create = originalCreate;
        adapter.action = originalAction;
        window.getLang = originalGetLang;
        closeModal();
        await navigate('depreciation');
      }
      return issues;
    }, { mobile: viewport.width <= 980 });
    const result = results.find((row) => row.route === 'depreciation');
    if (result) {
      result.layoutIssues.push(...depreciationIssues.map((issue) => `Depreciation smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event) => event.kind === 'console.error').map((event) => event.message));
      result.pageErrors.push(...events.filter((event) => event.kind === 'pageerror').map((event) => event.message));
    }
    events.length = 0;
  }

  if (routes.includes('picking')) {
    const localeIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const expected = {
        en: 'Warehouse picking',
        ms: 'Pungutan gudang',
        zh: '仓库拣货',
        ja: '倉庫ピッキング',
        vi: 'Soạn hàng kho',
      };
      const issues = [];
      try {
        for (const [locale,title] of Object.entries(expected)) {
          window.getLang = () => locale;
          await navigate('picking');
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (!heading.startsWith(title)) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          if (!document.querySelector('#viewRoot [data-layout="operational-workspace-v1"]')) {
            issues.push(`${locale} operational workspace root missing`);
          }
        }
      } finally {
        window.getLang = originalGetLang;
        await navigate('picking');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'picking');
    if (result) {
      result.layoutIssues.push(...localeIssues.map((issue) => `locale smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event) => event.kind === 'console.error').map((event) => event.message));
      result.pageErrors.push(...events.filter((event) => event.kind === 'pageerror').map((event) => event.message));
    }
    events.length = 0;
  }

  if (routes.includes('bom')) {
    const bomIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const expected = {
        en:'Bill of materials',
        ms:'Bil bahan',
        zh:'物料清单',
        ja:'部品表',
        vi:'Định mức nguyên vật liệu',
      };
      const issues = [];
      try {
        for (const [locale,title] of Object.entries(expected)) {
          window.getLang = () => locale;
          await navigate('bom');
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (!heading.startsWith(title)) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          if (!document.querySelector('#viewRoot [data-layout="master-detail-editor-v1"]')) {
            issues.push(`${locale} master-detail editor root missing`);
          }
        }
        window.getLang = () => 'en';
        adapter.list = async (resource,query) => resource === 'manufacturing/bom-components'
          ? {data:[],meta:{nextCursor:null}}
          : originalList.call(adapter,resource,query);
        await navigate('bom');
        if (!document.querySelector('#viewRoot [data-master-detail-components-empty]')) {
          issues.push('component-empty state missing');
        }
        adapter.list = async (resource,query) => ['manufacturing/routings','manufacturing/routing-operations'].includes(resource)
          ? {data:[],meta:{nextCursor:null}}
          : originalList.call(adapter,resource,query);
        await navigate('bom');
        if (!document.querySelector('#viewRoot [data-master-detail-routing-empty]')) {
          issues.push('routing-empty state missing');
        }
        adapter.list = async (resource,query) => ['manufacturing/boms','manufacturing/bom-versions'].includes(resource)
          ? {data:[],meta:{nextCursor:null}}
          : originalList.call(adapter,resource,query);
        await navigate('bom');
        if (!document.querySelector('#viewRoot [data-master-detail-empty]')) {
          issues.push('BOM-empty state missing');
        }
        if (!document.querySelector('#viewRoot [data-layout="master-detail-editor-v1"]')) {
          issues.push('BOM-empty state left the shared editor shell');
        }
      } finally {
        adapter.list = originalList;
        window.getLang = originalGetLang;
        await navigate('bom');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'bom');
    if (result) {
      result.layoutIssues.push(...bomIssues.map((issue)=>`BOM state smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind === 'console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind === 'pageerror').map((event)=>event.message));
    }
    events.length = 0;
  }

  if (routes.includes('employee')) {
    const employeeIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const employees = [
        {
          id:9901,employeeNo:'EMP-9901',fullName:'Top Employee',email:'top@example.test',
          phone:'',jobTitle:'Managing Director',department:'Management',employmentType:'Full-time',
          startDate:'2019-02-01',managerId:null,annualLeaveDays:20,isActive:true,photoUrl:'',
        },
        {
          id:9902,employeeNo:'EMP-9902',fullName:'Audited Employee',email:'employee@example.test',
          phone:'+65 6000 9902',jobTitle:'Operations Lead',department:'Operations',employmentType:'Full-time',
          startDate:'2022-04-11',managerId:9901,annualLeaveDays:20,isActive:true,
          photoUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%230b72e7"/%3E%3C/svg%3E',
        },
      ];
      const leaveRequests = [
        {id:9911,employeeId:9902,leaveType:'Annual',startDate:'2026-06-01',endDate:'2026-06-02',days:2,status:'pending'},
        {id:9912,employeeId:9902,leaveType:'Annual',startDate:'2026-05-01',endDate:'2026-05-02',days:2,status:'approved'},
        {id:9913,employeeId:9902,leaveType:'Medical',startDate:'2026-04-01',endDate:'2026-04-01',days:1,status:'rejected'},
      ];
      const expected = {
        en:{title:'Employee profile',active:'Active',review:'Review leave',statuses:['Pending','Approved','Rejected']},
        ms:{title:'Profil pekerja',active:'Aktif',review:'Semak cuti',statuses:['Belum diputuskan','Diluluskan','Ditolak']},
        zh:{title:'员工档案',active:'在职',review:'审批请假',statuses:['待审批','已批准','已拒绝']},
        ja:{title:'従業員プロフィール',active:'在籍',review:'休暇を確認',statuses:['承認待ち','承認済み','却下']},
        vi:{title:'Hồ sơ nhân viên',active:'Đang làm việc',review:'Xem xét nghỉ phép',statuses:['Chờ duyệt','Đã duyệt','Đã từ chối']},
      };
      const issues = [];
      const stub = (employeeRows=employees,leaveRows=leaveRequests) => {
        adapter.list = async (resource,query) => {
          if (resource === 'hr/employees') return {data:employeeRows,meta:{nextCursor:null}};
          if (resource === 'hr/leave-requests') return {data:leaveRows,meta:{nextCursor:null}};
          return originalList.call(adapter,resource,query);
        };
      };
      try {
        stub();
        for (const [locale,copy] of Object.entries(expected)) {
          window.getLang = () => locale;
          await navigate('employee',{employeeId:9902});
          const root = document.querySelector('#viewRoot [data-layout="master-detail-editor-v1"]');
          const pageActions = document.querySelector('#viewRoot [data-master-detail-page-actions]');
          const footer = root?.querySelector('[data-master-detail-actions]');
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          const text = root?.textContent || '';
          if (!heading.startsWith(copy.title)) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          if (!root) issues.push(`${locale} master-detail editor root missing`);
          if (root?.querySelectorAll('[data-master-detail-overview] .master-detail-editor-fact').length !== 4) {
            issues.push(`${locale} expected four overview facts`);
          }
          if (root?.querySelectorAll('[data-employee-contact] input[readonly]').length) {
            issues.push(`${locale} contact facts use read-only inputs`);
          }
          if (root?.querySelectorAll('[data-employee-leave-row]').length !== 3) {
            issues.push(`${locale} expected three leave-history rows`);
          }
          if (pageActions?.querySelectorAll('.cap').length !== 1
              || !pageActions?.textContent.includes(copy.active)) {
            issues.push(`${locale} active status missing from page header`);
          }
          const review = pageActions?.querySelector('[data-employee-review]')?.textContent?.trim() || '';
          if (review !== copy.review) issues.push(`${locale} Review leave rendered as ${review || 'missing'}`);
          if (!footer?.hasAttribute('hidden') || footer?.querySelectorAll('button').length) {
            issues.push(`${locale} Employee footer actions are visible or populated`);
          }
          if (document.querySelector('#viewRoot [data-employee-back]')) {
            issues.push(`${locale} redundant Back action remains`);
          }
          copy.statuses.forEach((status) => {
            if (!text.includes(status)) issues.push(`${locale} leave status missing: ${status}`);
          });
        }

        window.getLang = () => 'en';
        await navigate('employee',{employeeId:9901});
        const topRoot = document.querySelector('#viewRoot [data-layout="master-detail-editor-v1"]');
        if (!topRoot?.textContent.includes('— (top of reporting line)')) {
          issues.push('top-level employee manager fallback missing');
        }
        if (!topRoot?.querySelector('.master-detail-editor-avatar .profile-avatar-fallback:not([hidden])')) {
          issues.push('employee avatar fallback missing');
        }
        if (!topRoot?.querySelector('[data-employee-leave-empty]')) {
          issues.push('no-leave state missing for top-level employee');
        }

        stub(employees,[]);
        await navigate('employee',{employeeId:9902});
        if (!document.querySelector('#viewRoot [data-employee-leave-empty]')) {
          issues.push('employee leave-history empty state missing');
        }

        stub([],[]);
        await navigate('employee');
        if (!document.querySelector('#viewRoot [data-master-detail-empty]')) {
          issues.push('employee-empty state missing');
        }
        if (!document.querySelector('#viewRoot [data-layout="master-detail-editor-v1"][data-canonical-employee="true"]')) {
          issues.push('employee-empty state left the canonical shared editor shell');
        }
        if (document.querySelector('#viewRoot [data-master-detail-page-actions]')) {
          issues.push('employee-empty state exposes page actions');
        }
        const emptyFooter = document.querySelector('#viewRoot [data-master-detail-actions]');
        if (!emptyFooter?.hasAttribute('hidden') || emptyFooter?.querySelectorAll('button').length) {
          issues.push('employee-empty footer actions are visible or populated');
        }
      } finally {
        adapter.list = originalList;
        window.getLang = originalGetLang;
        await navigate('employee');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'employee');
    if (result) {
      result.layoutIssues.push(...employeeIssues.map((issue)=>`Employee state smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind === 'console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind === 'pageerror').map((event)=>event.message));
    }
    events.length = 0;
  }

  if (routes.includes('service-contract')) {
    const serviceContractIssues = await page.evaluate(async () => {
      const originalGetLang=window.getLang;
      const adapter=window.ErpSystemData;
      const originalGet=adapter.get;
      const expectedTitles={
        en:'Service contract',
        ms:'Kontrak servis',
        zh:'服务合约',
        ja:'サービス契約',
        vi:'Hợp đồng dịch vụ',
      };
      const customer={id:9911,code:'CUST-9911',name:'Contract Audit Customer'};
      const baseContract={
        id:9921,contractNo:'SC-2099-9921',customerId:customer.id,plan:'Gold',
        slaResponseHours:4,assetsCovered:6,startDate:'2026-01-01',
        expiryDate:'2027-12-31',annualValue:'48000.00',
      };
      const isoAfter=(days)=>{
        const date=new Date();
        date.setHours(0,0,0,0);
        date.setDate(date.getDate()+days);
        return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      };
      let contract={...baseContract,expiryDate:isoAfter(120)};
      let customerMissing=false;
      let unknownContract=false;
      let readFailure=false;
      const installGetStub=()=>{
        adapter.get=async (resource,id)=>{
          if (readFailure&&resource==='service/contracts') throw new Error('service contract audit failure');
          if ((unknownContract&&resource==='service/contracts')||customerMissing&&resource==='sales/customers') {
            throw new Error(`ERP resource not found: ${resource}/${id}`);
          }
          if (resource==='service/contracts') return {data:contract,meta:{}};
          if (resource==='sales/customers') return {data:customer,meta:{}};
          return originalGet.call(adapter,resource,id);
        };
      };
      const root=()=>document.querySelector(
        '#viewRoot [data-layout="master-detail-editor-v1"][data-master-detail-route="service-contract"]',
      );
      const issues=[];
      try {
        installGetStub();
        for (const [locale,title] of Object.entries(expectedTitles)) {
          window.getLang=()=>locale;
          await navigate('service-contract',{contractId:contract.id});
          const heading=document.querySelector('#viewRoot h1')?.textContent?.trim()||'';
          if (heading!==title) issues.push(`${locale} heading rendered as ${heading||'missing'}`);
          if (root()?.querySelectorAll('[data-master-detail-overview] .master-detail-editor-fact').length!==4) {
            issues.push(`${locale} expected four overview facts`);
          }
        }

        window.getLang=()=> 'en';
        contract={...baseContract,expiryDate:isoAfter(120)};
        await navigate('service-contract',{contractId:contract.id});
        let detail=root();
        if (!detail?.querySelector('[data-service-contract-commercial]')
            ||!detail?.querySelector('[data-service-contract-renewal]')) {
          issues.push('active contract commercial or renewal context missing');
        }
        const customerAction=document.querySelector('#viewRoot [data-service-contract-customer]');
        if (Number(customerAction?.dataset.serviceContractCustomer)!==customer.id) {
          issues.push('Customer 360 is not bound to the contract customer');
        }
        customerAction?.click();
        await new Promise((resolve)=>setTimeout(resolve,250));
        if (CURRENT_ROUTE!=='crm-customer'||Number(CURRENT_ROUTE_PARAMS?.customerId)!==customer.id) {
          issues.push('Customer 360 did not open the contract customer');
        }

        contract={...baseContract,slaResponseHours:null,assetsCovered:0,expiryDate:isoAfter(30)};
        await navigate('service-contract',{contractId:contract.id});
        detail=root();
        const facts=[...(detail?.querySelectorAll('[data-master-detail-overview] .master-detail-editor-fact b')||[])]
          .map((node)=>node.textContent.trim());
        if (!facts.includes('—')||!facts.includes('0')) {
          issues.push('no-SLA or zero-asset contract facts are not preserved');
        }
        if (!document.querySelector('#viewRoot [data-master-detail-page-actions]')?.textContent.includes('Expiring')) {
          issues.push('expiring contract status missing');
        }

        contract={...baseContract,expiryDate:isoAfter(-10)};
        await navigate('service-contract',{contractId:contract.id});
        if (!document.querySelector('#viewRoot [data-master-detail-page-actions]')?.textContent.includes('Expired')) {
          issues.push('expired contract status missing');
        }

        customerMissing=true;
        contract={...baseContract,expiryDate:isoAfter(120)};
        await navigate('service-contract',{contractId:contract.id});
        if (!root()?.textContent.includes('Customer unavailable')) {
          issues.push('missing-customer fallback absent');
        }
        customerMissing=false;

        await navigate('service-contract');
        if (!root()?.querySelector('[data-master-detail-empty]')) {
          issues.push('missing contract id does not render the shared empty state');
        }
        unknownContract=true;
        await navigate('service-contract',{contractId:999999});
        if (!root()?.querySelector('[data-master-detail-empty]')) {
          issues.push('unknown contract id does not render the shared empty state');
        }
        unknownContract=false;

        readFailure=true;
        await navigate('service-contract',{contractId:contract.id});
        if (!document.querySelector('#viewRoot .screen-render-error .statepanel button')) {
          issues.push('contract read failure does not expose the global Retry state');
        }
        readFailure=false;

        await navigate('service-contract',{contractId:contract.id});
        const footer=root()?.querySelector('[data-master-detail-actions]');
        if (!footer?.hasAttribute('hidden')||footer?.querySelectorAll('button').length) {
          issues.push('read-only Service Contract footer actions are visible or populated');
        }
      } finally {
        adapter.get=originalGet;
        window.getLang=originalGetLang;
        await navigate('service-contract');
      }
      return issues;
    });
    const result=results.find((row)=>row.route==='service-contract');
    if (result) {
      result.layoutIssues.push(...serviceContractIssues.map((issue)=>`Service Contract state smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind==='console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind==='pageerror').map((event)=>event.message));
    }
    events.length=0;
  }

  if (routes.includes('ncr')) {
    const ncrIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const expected = {
        en:'Non-conformance',
        ms:'Ketidakpatuhan',
        zh:'不合格报告',
        ja:'不適合',
        vi:'Không phù hợp',
      };
      const issues = [];
      try {
        for (const [locale,title] of Object.entries(expected)) {
          window.getLang = () => locale;
          await navigate('ncr');
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (!heading.startsWith(title)) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          if (!document.querySelector('#viewRoot [data-layout="case-detail-v1"]')) {
            issues.push(`${locale} case detail root missing`);
          }
        }
        window.getLang = () => 'en';
        adapter.list = async (resource,query) => {
          const response = await originalList.call(adapter,resource,query);
          if (resource !== 'quality/ncrs') return response;
          return {
            ...response,
            data:(response.data||[]).map((row,index)=>index===0
              ? {...row,status:'open',disposition:'quarantine'}
              : row),
          };
        };
        window.ACTIVE_QUALITY_NCR_ID=0;
        await navigate('ncr');
        const release=document.querySelector('#viewRoot [data-dispose-ncr="release"].primary');
        const reject=document.querySelector('#viewRoot [data-dispose-ncr="reject"].danger');
        if (!release||!reject) issues.push('open NCR is missing primary Release or danger Reject action');

        adapter.list = async (resource,query) => resource === 'quality/corrective-actions'
          ? {data:[],meta:{nextCursor:null}}
          : originalList.call(adapter,resource,query);
        await navigate('ncr');
        if (!document.querySelector('#viewRoot [data-case-corrective-empty]')) {
          issues.push('corrective-action empty state missing');
        }

        adapter.list = async (resource,query) => {
          const response = await originalList.call(adapter,resource,query);
          if (resource !== 'quality/ncrs') return response;
          return {
            ...response,
            data:(response.data||[]).map((row,index)=>index===0
              ? {...row,status:'closed',disposition:'release'}
              : row),
          };
        };
        window.ACTIVE_QUALITY_NCR_ID=0;
        await navigate('ncr');
        if (document.querySelector('#viewRoot [data-dispose-ncr]:not([disabled])')) {
          issues.push('closed NCR exposes an enabled disposition action');
        }
        if (!document.querySelector('#viewRoot [data-case-actions][hidden]')) {
          issues.push('closed NCR does not preserve the hidden action contract');
        }

        adapter.list = async (resource,query) => ['quality/inspections','inventory/products'].includes(resource)
          ? {data:[],meta:{nextCursor:null}}
          : originalList.call(adapter,resource,query);
        await navigate('ncr');
        if (!document.querySelector('#viewRoot [data-layout="case-detail-v1"]')) {
          issues.push('missing related records left the shared case detail shell');
        }

        adapter.list = async (resource,query) => resource === 'quality/ncrs'
          ? {data:[],meta:{nextCursor:null}}
          : originalList.call(adapter,resource,query);
        await navigate('ncr');
        if (!document.querySelector('#viewRoot [data-case-empty]')) {
          issues.push('NCR empty state missing');
        }
        if (!document.querySelector('#viewRoot [data-layout="case-detail-v1"]')) {
          issues.push('NCR empty state left the shared case detail shell');
        }
      } finally {
        adapter.list = originalList;
        window.getLang = originalGetLang;
        window.ACTIVE_QUALITY_NCR_ID=0;
        await navigate('ncr');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'ncr');
    if (result) {
      result.layoutIssues.push(...ncrIssues.map((issue)=>`NCR state smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind === 'console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind === 'pageerror').map((event)=>event.message));
    }
    events.length = 0;
  }

  if (routes.includes('service-order')) {
    const serviceOrderIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const originalAction = adapter.action;
      const expectedTitles = {
        en:'Service Order',
        ms:'Pesanan Servis',
        zh:'服务工单',
        ja:'サービスオーダー',
        vi:'Lệnh dịch vụ',
      };
      const customer = {
        id:9901,code:'CUST-9901',name:'Service Audit Customer',
        industry:'Manufacturing',createdAt:'2025-01-01',
      };
      const contract = {
        id:9901,contractNo:'SC-2099-9901',customerId:customer.id,plan:'Gold',
        slaResponseHours:4,assetsCovered:2,startDate:'2026-01-01',
        expiryDate:'2027-12-31',annualValue:'12000.00',
      };
      const ticket = {
        id:9901,ticketNo:'SVC-2099-9901',customerId:customer.id,contractId:contract.id,
        assetDescription:'Audit Conveyor',serialNo:'AUD-9901',
        issue:'Audit sensor failure',diagnosis:null,priority:'High',coverage:'contract',
        status:'open',technicianName:null,openedAt:'2026-07-24T01:00:00.000Z',resolvedAt:null,
      };
      const issues = [];
      let tickets = [ticket];
      let contracts = [contract];
      let customers = [customer];
      const serviceRoot = () => document.querySelector(
        '#viewRoot [data-layout="case-detail-v1"][data-case-route="service-order"]',
      );
      const installListStub = () => {
        adapter.list = async (resource,query) => {
          if (resource === 'service/tickets') return {data:tickets,meta:{nextCursor:null}};
          if (resource === 'service/contracts') return {data:contracts,meta:{nextCursor:null}};
          if (resource === 'sales/customers') return {data:customers,meta:{nextCursor:null}};
          return originalList.call(adapter,resource,query);
        };
      };
      try {
        installListStub();
        for (const [locale,title] of Object.entries(expectedTitles)) {
          window.getLang = () => locale;
          await navigate('service-order',{ticketId:ticket.id});
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (heading !== title) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          const root = serviceRoot();
          if (!root?.querySelector('[data-case-lifecycle]')) {
            issues.push(`${locale} lifecycle missing`);
          }
          if (root?.querySelectorAll('[data-case-lifecycle-step][aria-current="step"]').length !== 1) {
            issues.push(`${locale} lifecycle current state is not unique`);
          }
        }

        window.getLang = () => 'en';
        await navigate('service-order',{ticketId:ticket.id});
        let root = serviceRoot();
        if (root?.querySelectorAll('[data-case-actions] button').length !== 2) {
          issues.push('open ticket does not expose Assign and Resolve actions');
        }
        if (!root?.querySelector('[data-service-sla] .indicator')) {
          issues.push('contract ticket SLA indicator missing');
        }
        if (!root?.querySelector('[data-service-contract] .minilist')) {
          issues.push('related contract missing');
        }
        if (root?.querySelector('[data-case-lifecycle-step][aria-current="step"]')?.dataset.caseLifecycleStep !== 'open') {
          issues.push('open lifecycle state is not current');
        }

        const customerAction = root?.querySelector('[data-service-customer]');
        if (Number(customerAction?.dataset.serviceCustomer) !== customer.id) {
          issues.push('Customer 360 is not bound to the current ticket customer id');
        }
        customerAction?.click();
        await new Promise((resolve) => setTimeout(resolve,500));
        if (CURRENT_ROUTE !== 'crm-customer'
            || Number(CURRENT_ROUTE_PARAMS?.customerId) !== customer.id) {
          issues.push('Customer 360 did not open the current ticket customer');
        }

        tickets = [{...ticket,contractId:null,coverage:'in_warranty',status:'in_progress',technicianName:'Audit Tech'}];
        contracts = [];
        await navigate('service-order',{ticketId:ticket.id});
        root = serviceRoot();
        if (root?.querySelectorAll('[data-case-actions] button').length !== 1
            || !root?.querySelector('[data-act="resolve"]')) {
          issues.push('in-progress ticket does not expose only Resolve');
        }
        if (!root?.querySelector('[data-service-diagnosis-empty]')) {
          issues.push('missing-diagnosis state absent');
        }
        if (!root?.querySelector('[data-service-sla] .service-order-context-empty')
            || !root?.querySelector('[data-service-contract] .service-order-context-empty')) {
          issues.push('no-SLA or no-contract state absent');
        }

        tickets = [{
          ...ticket,contractId:null,coverage:'out_of_warranty',status:'closed',
          technicianName:'Audit Tech',diagnosis:'Replaced the audit sensor.',
          resolvedAt:'2026-07-24T03:00:00.000Z',
        }];
        await navigate('service-order',{ticketId:ticket.id});
        root = serviceRoot();
        const closedActions = root?.querySelector('[data-case-actions]');
        if (!closedActions?.hasAttribute('hidden') || closedActions?.querySelectorAll('button').length) {
          issues.push('closed ticket action region is visible or populated');
        }
        if (root?.querySelector('[data-case-lifecycle-step][aria-current="step"]')?.dataset.caseLifecycleStep !== 'closed') {
          issues.push('closed lifecycle state is not current');
        }
        if (!root?.textContent.includes('Replaced the audit sensor.')) {
          issues.push('closed ticket diagnosis missing');
        }

        tickets = [];
        await navigate('service-order');
        root = serviceRoot();
        if (!root?.querySelector('[data-case-empty]')
            || root?.getAttribute('data-canonical-service-order') !== 'true') {
          issues.push('no-ticket state left the canonical case shell');
        }

        tickets = [ticket];
        contracts = [contract];
        await navigate('service-order',{ticketId:999999});
        if (!serviceRoot()?.querySelector('[data-case-empty]')) {
          issues.push('invalid ticket id does not render the case empty state');
        }

        await navigate('service-order',{ticketId:ticket.id});
        root = serviceRoot();
        root?.querySelector('[data-act="assign"]')?.click();
        document.querySelector('#modalEl [data-save]')?.click();
        if (document.activeElement?.id !== 'afTech') {
          issues.push('Assign does not require and focus the technician name');
        }
        closeModal();
        root?.querySelector('[data-act="resolve"]')?.click();
        document.querySelector('#modalEl [data-save]')?.click();
        if (document.activeElement?.id !== 'rfDiagnosis') {
          issues.push('Resolve does not require and focus the diagnosis');
        }
        closeModal();

        const actionCalls = [];
        adapter.action = async (resource,id,action,payload,idempotencyKey) => {
          actionCalls.push({resource,id,action,payload,idempotencyKey});
          if (action === 'assign') {
            tickets = tickets.map((row)=>row.id===id
              ? {...row,status:'in_progress',technicianName:payload.technicianName}
              : row);
          }
          if (action === 'resolve') {
            tickets = tickets.map((row)=>row.id===id
              ? {...row,status:'closed',diagnosis:payload.diagnosis,resolvedAt:'2026-07-24T04:00:00.000Z'}
              : row);
          }
          return {data:tickets.find((row)=>row.id===id)};
        };
        await navigate('service-order',{ticketId:ticket.id});
        serviceRoot()?.querySelector('[data-act="assign"]')?.click();
        const techInput = document.querySelector('#afTech');
        if (techInput) techInput.value = 'Assigned Audit Tech';
        document.querySelector('#modalEl [data-save]')?.click();
        await new Promise((resolve) => setTimeout(resolve,250));
        root = serviceRoot();
        if (actionCalls[0]?.action !== 'assign'
            || !root?.textContent.includes('Assigned Audit Tech')
            || root?.querySelectorAll('[data-case-actions] button').length !== 1) {
          issues.push('successful Assign did not refresh technician, status and actions');
        }

        root?.querySelector('[data-act="resolve"]')?.click();
        const diagnosisInput = document.querySelector('#rfDiagnosis');
        if (diagnosisInput) diagnosisInput.value = 'Resolved by audit.';
        document.querySelector('#modalEl [data-save]')?.click();
        await new Promise((resolve) => setTimeout(resolve,500));
        root = serviceRoot();
        if (!actionCalls.some((call)=>call.action === 'resolve')
            || !root?.textContent.includes('Resolved by audit.')
            || !root?.querySelector('[data-case-actions][hidden]')) {
          issues.push('successful Resolve did not refresh diagnosis, lifecycle and actions');
        }

        tickets = [{...ticket,status:'in_progress',technicianName:'Audit Tech'}];
        adapter.action = async () => { throw new Error('service action audit failure'); };
        await navigate('service-order',{ticketId:ticket.id});
        serviceRoot()?.querySelector('[data-act="resolve"]')?.click();
        const failedInput = document.querySelector('#rfDiagnosis');
        if (failedInput) failedInput.value = 'Will fail';
        document.querySelector('#modalEl [data-save]')?.click();
        await new Promise((resolve) => setTimeout(resolve,100));
        const failedSave = document.querySelector('#modalEl [data-save]');
        if (!failedSave || failedSave.disabled) {
          issues.push('failed Resolve did not remain recoverable in the modal');
        }
        closeModal();
      } finally {
        adapter.list = originalList;
        adapter.action = originalAction;
        window.getLang = originalGetLang;
        await navigate('service-order');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'service-order');
    if (result) {
      result.layoutIssues.push(...serviceOrderIssues.map((issue)=>`Service Order state smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind === 'console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind === 'pageerror').map((event)=>event.message));
    }
    events.length = 0;
  }

  if (routes.includes('po-approval')) {
    const poApprovalIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const originalPrepare = window.prepareCanonicalPurchasingData;
      const adapter = window.ErpSystemData;
      const originalAction = adapter.action;
      const originalApprovals = DB.purchaseOrderApprovals;
      const expectedTitles = {
        en:'Purchase order approval',
        ms:'Kelulusan pesanan belian',
        zh:'采购订单审批',
        ja:'購買発注の承認',
        vi:'Phê duyệt đơn mua hàng',
      };
      const fixture = {
        id:9901,version:1,orderId:9901,no:'PO-AUDIT-9901',
        orderDate:'2026-07-25',currency:'SGD',
        supplierId:9901,supplier:'Audit Supplier Pte Ltd',supplierCode:'AUD-SUPP',
        net:100,tax:9,total:109,status:'pending',orderStatus:'pending_approval',
        submittedAt:'2026-07-25 · 09:00',decidedAt:null,decidedByName:null,decisionNote:null,
        lines:[{
          id:9901,lineNo:1,productId:9901,sku:'AUD-ITEM',
          name:'Audit Item',uom:'unit',qty:2,unitCost:50,net:100,
          taxCode:'SR',taxRate:9,tax:9,
        }],
      };
      const issues = [];
      const approvalRoot = () => document.querySelector(
        '#viewRoot [data-layout="case-detail-v1"][data-case-route="po-approval"]',
      );
      try {
        window.prepareCanonicalPurchasingData = async () => {};
        DB.purchaseOrderApprovals = [fixture];
        for (const [locale,title] of Object.entries(expectedTitles)) {
          window.getLang = () => locale;
          await navigate('po-approval',{purchaseOrderId:fixture.orderId});
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (heading !== title) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
        }

        window.getLang = () => 'en';
        await navigate('po-approval',{purchaseOrderId:fixture.orderId});
        let root = approvalRoot();
        if (root?.querySelectorAll('[data-case-actions] button').length !== 2
            || !root?.querySelector('[data-po-approve]')
            || !root?.querySelector('[data-po-reject]')) {
          issues.push('pending approval does not expose exactly Approve and Reject');
        }
        if (root?.querySelector('[data-po-back]')) {
          issues.push('pending approval exposes a redundant Back action');
        }
        if (!root?.querySelector('[data-po-lines] .master-detail-editor-table-scroll')
            || !root?.querySelector('[data-po-totals]')
            || !root?.querySelector('[data-po-decision]')) {
          issues.push('pending approval is missing controlled lines, totals or decision context');
        }

        root?.querySelector('[data-po-approve]')?.click();
        document.querySelector('#modalEl [data-po-decision-confirm]')?.click();
        if (document.activeElement?.id !== 'poApprovalNote') {
          issues.push('Approve does not require and focus an auditable note');
        }
        closeModal();

        const actionCalls = [];
        adapter.action = async (resource,id,action,payload,idempotencyKey) => {
          actionCalls.push({resource,id,action,payload,idempotencyKey});
          DB.purchaseOrderApprovals = DB.purchaseOrderApprovals.map((request)=>request.id===fixture.id
            ? {
                ...request,status:action==='approve'?'approved':'rejected',
                orderStatus:action==='approve'?'open':'rejected',
                decidedAt:'2026-07-25 · 10:00',decidedByName:'Audit Approver',
                decisionNote:payload.note,version:request.version+1,
              }
            : request);
          return {data:DB.purchaseOrderApprovals[0]};
        };
        await navigate('po-approval',{purchaseOrderId:fixture.orderId});
        approvalRoot()?.querySelector('[data-po-approve]')?.click();
        const note = document.querySelector('#poApprovalNote');
        if (note) note.value = 'Approved by the PO approval audit.';
        document.querySelector('#modalEl [data-po-decision-confirm]')?.click();
        await new Promise((resolve) => setTimeout(resolve,300));
        root = approvalRoot();
        if (actionCalls[0]?.resource !== 'purchasing/purchase-orders'
            || actionCalls[0]?.id !== fixture.orderId
            || actionCalls[0]?.action !== 'approve'
            || actionCalls[0]?.payload?.note !== 'Approved by the PO approval audit.'
            || !String(actionCalls[0]?.idempotencyKey||'').includes(`v${fixture.version}-approve`)) {
          issues.push('Approve did not preserve the canonical action contract');
        }
        if (!root?.querySelector('[data-case-actions][hidden]')
            || root?.querySelectorAll('[data-case-actions] button').length
            || !root?.textContent.includes('Audit Approver')
            || !root?.textContent.includes('Approved by the PO approval audit.')) {
          issues.push('approved state did not refresh the decision record and hide actions');
        }

        DB.purchaseOrderApprovals = [{...fixture,status:'rejected',orderStatus:'rejected',
          decidedAt:'2026-07-25 · 11:00',decidedByName:'Audit Rejector',
          decisionNote:'Rejected by audit.'}];
        await navigate('po-approval',{purchaseOrderId:fixture.orderId});
        root = approvalRoot();
        if (!root?.querySelector('[data-case-actions][hidden]')
            || root?.querySelectorAll('[data-case-actions] button').length
            || !root?.textContent.includes('Rejected by audit.')) {
          issues.push('rejected state is not read-only or is missing its audit record');
        }

        DB.purchaseOrderApprovals = [{...fixture,lines:[]}];
        await navigate('po-approval',{purchaseOrderId:fixture.orderId});
        if (!approvalRoot()?.querySelector('[data-po-lines] .case-detail-inline-empty')) {
          issues.push('no-lines state does not use the local standard empty state');
        }

        DB.purchaseOrderApprovals = [fixture];
        await navigate('po-approval',{purchaseOrderId:999999});
        if (!approvalRoot()?.querySelector('[data-case-empty]')) {
          issues.push('unknown purchase order id does not render the case empty state');
        }

        DB.purchaseOrderApprovals = [];
        await navigate('po-approval');
        root = approvalRoot();
        if (!root?.querySelector('[data-case-empty]')
            || root?.getAttribute('data-canonical-po-approval') !== 'true') {
          issues.push('no-approval state left the canonical case shell');
        }

        DB.purchaseOrderApprovals = [fixture];
        adapter.action = async () => { throw new Error('PO approval audit failure'); };
        await navigate('po-approval',{purchaseOrderId:fixture.orderId});
        approvalRoot()?.querySelector('[data-po-reject]')?.click();
        const failedNote = document.querySelector('#poApprovalNote');
        if (failedNote) failedNote.value = 'This rejection will fail.';
        document.querySelector('#modalEl [data-po-decision-confirm]')?.click();
        await new Promise((resolve) => setTimeout(resolve,100));
        const failedConfirm = document.querySelector('#modalEl [data-po-decision-confirm]');
        if (!failedConfirm || failedConfirm.disabled) {
          issues.push('failed Reject did not remain recoverable in the modal');
        }
        closeModal();
      } finally {
        adapter.action = originalAction;
        window.prepareCanonicalPurchasingData = originalPrepare;
        window.getLang = originalGetLang;
        DB.purchaseOrderApprovals = originalApprovals;
        await navigate('po-approval');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'po-approval');
    if (result) {
      result.layoutIssues.push(...poApprovalIssues.map((issue)=>`PO Approval state smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind === 'console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind === 'pageerror').map((event)=>event.message));
    }
    events.length = 0;
  }

  if (routes.includes('account-ledger')) {
    const ledgerIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const originalNavigate = window.navigate;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const expectedBack = {
        en:'Back to General Ledger',
        ms:'Kembali ke Lejar Am',
        zh:'返回总账',
        ja:'総勘定元帳に戻る',
        vi:'Quay lại Sổ Cái',
      };
      const issues = [];
      const ledgerRoot = () => document.querySelector('#viewRoot [data-layout="ledger-detail-v1"]');
      try {
        for (const [locale,backLabel] of Object.entries(expectedBack)) {
          window.getLang = () => locale;
          await navigate('account-ledger');
          const root = ledgerRoot();
          if (!root) {
            issues.push(`${locale} ledger detail root missing`);
            continue;
          }
          const back = [...root.querySelectorAll('button')]
            .find((button) => button.textContent?.trim() === backLabel);
          if (!back) issues.push(`${locale} Back action missing or untranslated`);
          if (!root.querySelector('[data-ledger-opening]')) issues.push(`${locale} opening balance row missing`);
          if (!root.querySelector('[data-ledger-footer]')) issues.push(`${locale} closing totals missing`);
        }

        window.getLang = () => 'en';
        await navigate('account-ledger');
        const defaultRoot = ledgerRoot();
        if (!defaultRoot) {
          issues.push('default account did not render the ledger shell');
        } else {
          const firstRow = defaultRoot.querySelector('[data-ledger-row]');
          if (firstRow) {
            let captured = null;
            window.navigate = async (route,params) => { captured={route,params}; };
            firstRow.click();
            window.navigate = originalNavigate;
            if (captured?.route !== 'journal-entry' || captured?.params?.no !== firstRow.querySelector('b')?.textContent?.trim()) {
              issues.push('journal row did not navigate to its Journal Entry');
            }
          }
          if (defaultRoot.querySelector('[data-ledger-opening][data-ledger-row], [data-ledger-footer] [data-ledger-row]')) {
            issues.push('opening or totals row is incorrectly interactive');
          }
          if ([...defaultRoot.querySelectorAll('button')].some((button) => /\b(export|print)\b/i.test(button.textContent || ''))) {
            issues.push('unimplemented Export or Print action is visible');
          }
        }

        window.navigate = originalNavigate;
        const defaultCode = ledgerRoot()?.getAttribute('data-ledger-account') || '';
        const otherCode = Object.keys(DB.acctLedgerDocs || {}).find((code) => code !== defaultCode);
        if (otherCode) {
          await SCREENS['account-ledger'](document.getElementById('viewRoot'),{code:otherCode});
          if (ledgerRoot()?.getAttribute('data-ledger-account') !== otherCode) {
            issues.push(`requested account ${otherCode} did not render`);
          }
        }

        adapter.list = async (resource,query) => resource === 'finance/gl-entries'
          ? {data:[],meta:{nextCursor:null}}
          : originalList.call(adapter,resource,query);
        await navigate('account-ledger');
        if (!ledgerRoot()?.querySelector('[data-ledger-empty]')) issues.push('zero-entry empty state missing');
        if (!ledgerRoot()?.querySelector('[data-ledger-opening]') || !ledgerRoot()?.querySelector('[data-ledger-footer]')) {
          issues.push('zero-entry state lost opening or closing summaries');
        }

        adapter.list = async (resource,query) => resource === 'finance/accounts'
          ? {data:[],meta:{nextCursor:null}}
          : originalList.call(adapter,resource,query);
        await navigate('account-ledger');
        if (!ledgerRoot()?.querySelector('[data-ledger-empty]')) issues.push('no-account empty state missing');
        if (!ledgerRoot()) issues.push('no-account state left the shared ledger shell');

        adapter.list = async (resource,query) => {
          if (resource === 'finance/accounts') throw new Error('ledger audit failure');
          return originalList.call(adapter,resource,query);
        };
        await navigate('account-ledger');
        const errorRoot = ledgerRoot();
        if (!errorRoot?.querySelector('[data-ledger-error]:not([hidden])')) {
          issues.push('read failure did not render the standard error state');
        }
        adapter.list = originalList;
        errorRoot?.querySelector('[data-ledger-retry]')?.click();
        for (let attempt=0; attempt<20; attempt+=1) {
          await new Promise((resolve) => setTimeout(resolve,100));
          if (ledgerRoot()&&!ledgerRoot()?.querySelector('[data-ledger-error]:not([hidden])')) break;
        }
        if (!ledgerRoot() || ledgerRoot()?.querySelector('[data-ledger-error]:not([hidden])')) {
          issues.push('Retry did not recover the Account Ledger');
        }
      } finally {
        adapter.list = originalList;
        window.navigate = originalNavigate;
        window.getLang = originalGetLang;
        await navigate('account-ledger');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'account-ledger');
    if (result) {
      result.layoutIssues.push(...ledgerIssues.map((issue)=>`Ledger state smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind === 'console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind === 'pageerror').map((event)=>event.message));
    }
    events.length = 0;
  }

  if (routes.includes('journal-entry')) {
    const postingIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const expectedTitles = {
        en:'Journal Entry',
        ms:'Catatan Jurnal',
        zh:'会计凭证',
        ja:'仕訳伝票',
        vi:'Bút toán nhật ký',
      };
      const issues = [];
      const postingRoot = () => document.querySelector('#viewRoot [data-layout="posting-detail-v1"]');
      try {
        for (const [locale,title] of Object.entries(expectedTitles)) {
          window.getLang = () => locale;
          await navigate('journal-entry');
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (!heading.startsWith(title)) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          const root = postingRoot();
          if (!root) {
            issues.push(`${locale} posting detail root missing`);
            continue;
          }
          if (!root.querySelector('[data-posting-lines]')) issues.push(`${locale} journal lines missing`);
          if (!root.querySelector('[data-posting-balance]')) issues.push(`${locale} balance context missing`);
        }

        window.getLang = () => 'en';
        await navigate('journal-entry');
        const defaultRoot = postingRoot();
        if (!defaultRoot?.querySelector('[data-posting-totals]')) issues.push('journal totals missing');
        if (!defaultRoot?.querySelector('[data-posting-audit]')) issues.push('journal audit trail missing');
        if (!defaultRoot?.textContent?.includes('Dr = Cr')) issues.push('balanced journal indicator missing');
        if (defaultRoot?.querySelector('.docwrap,.docpage,.dochead,.docmeta,.doclayout,.summary')) {
          issues.push('legacy journal document chrome remains');
        }

        const defaultNo = defaultRoot?.getAttribute('data-posting-code') || '';
        const otherNo = Object.keys(DB.journalDocs || {}).find((no) => no !== defaultNo);
        if (otherNo) {
          await SCREENS['journal-entry'](document.getElementById('viewRoot'),{no:otherNo});
          if (postingRoot()?.getAttribute('data-posting-code') !== otherNo) {
            issues.push(`requested journal ${otherNo} did not render`);
          }
        }

        adapter.list = async (resource,query) => ['finance/gl-entries','finance/journals'].includes(resource)
          ? {data:[],meta:{nextCursor:null}}
          : originalList.call(adapter,resource,query);
        await navigate('journal-entry');
        if (!postingRoot()?.querySelector('[data-posting-empty]')) issues.push('no-journal empty state missing');
        if (!postingRoot()) issues.push('no-journal state left the shared posting shell');

        adapter.list = async (resource,query) => {
          if (resource === 'finance/accounts') throw new Error('posting audit failure');
          return originalList.call(adapter,resource,query);
        };
        await navigate('journal-entry');
        const errorRoot = postingRoot();
        if (!errorRoot?.querySelector('[data-posting-error]:not([hidden])')) {
          issues.push('read failure did not render the standard posting error state');
        }
        adapter.list = originalList;
        errorRoot?.querySelector('[data-posting-retry]')?.click();
        for (let attempt=0; attempt<20; attempt+=1) {
          await new Promise((resolve) => setTimeout(resolve,100));
          if (postingRoot()&&!postingRoot()?.querySelector('[data-posting-error]:not([hidden])')) break;
        }
        if (!postingRoot() || postingRoot()?.querySelector('[data-posting-error]:not([hidden])')) {
          issues.push('Retry did not recover the Journal Entry');
        }
      } finally {
        adapter.list = originalList;
        window.getLang = originalGetLang;
        await navigate('journal-entry');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'journal-entry');
    if (result) {
      result.layoutIssues.push(...postingIssues.map((issue)=>`Posting state smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind === 'console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind === 'pageerror').map((event)=>event.message));
    }
    events.length = 0;
  }

  if (routes.includes('payment-voucher')) {
    const voucherIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const originalNavigate = window.navigate;
      const adapter = window.ErpSystemData;
      const originalList = adapter.list;
      const expectedTitles = {
        en:'Payment Voucher',
        ms:'Baucar Bayaran',
        zh:'付款凭证',
        ja:'支払伝票',
        vi:'Phiếu chi',
      };
      const issues = [];
      const postingRoot = () => document.querySelector('#viewRoot [data-layout="posting-detail-v1"]');
      try {
        for (const [locale,title] of Object.entries(expectedTitles)) {
          window.getLang = () => locale;
          await navigate('payment-voucher');
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (!heading.startsWith(title)) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          const root = postingRoot();
          if (!root) {
            issues.push(`${locale} posting detail root missing`);
            continue;
          }
          if (!root.querySelector('[data-posting-empty]')) issues.push(`${locale} voucher empty state missing`);
          if (!document.querySelector('#viewRoot [data-posting-header-action]')) issues.push(`${locale} header New voucher action missing`);
          if (!root.querySelector('[data-posting-empty-action]')) issues.push(`${locale} empty-state New voucher action missing`);
          if (root.querySelector('[data-posting-overview]:not([hidden])')) issues.push(`${locale} empty overview is visible`);
        }

        window.getLang = () => 'en';
        await navigate('payment-voucher');
        const emptyRoot = postingRoot();
        if (emptyRoot?.querySelector('.docwrap,.docpage,.dochead,.docmeta,.doclayout,.summary')) {
          issues.push('legacy payment voucher document chrome remains');
        }
        const createButton = emptyRoot?.querySelector('[data-posting-empty-action]');
        if (createButton) {
          let captured = null;
          window.navigate = async (route,params) => { captured={route,params}; };
          createButton.click();
          window.navigate = originalNavigate;
          if (captured?.route !== 'new-payment-voucher') issues.push('New voucher action does not open the create flow');
        } else {
          issues.push('empty voucher state has no primary action');
        }

        const supplierId = DB.suppliers?.[0]?.id || 1;
        const invoiceId = DB.supplierInvoices?.[0]?.id || 1;
        const vouchers = [
          {id:901,docNo:'PV-AUDIT-901',paymentDate:'2026-07-23',bankRef:'BANK-901',supplierId,totalAmount:'125.00'},
          {id:902,docNo:'PV-AUDIT-902',paymentDate:'2026-07-22',bankRef:null,supplierId,totalAmount:'75.00'},
        ];
        adapter.list = async (resource,query) => {
          if (resource === 'finance/payment-vouchers') return {data:vouchers,meta:{nextCursor:null}};
          if (resource === 'finance/payment-voucher-lines') return {
            data:[
              {id:1,paymentVoucherId:901,supplierInvoiceId:invoiceId,amount:'125.00'},
              {id:2,paymentVoucherId:902,supplierInvoiceId:invoiceId,amount:'75.00'},
            ],
            meta:{nextCursor:null},
          };
          return originalList.call(adapter,resource,query);
        };
        await navigate('payment-voucher');
        const detailRoot = postingRoot();
        if (!detailRoot?.querySelector('[data-posting-lines]')) issues.push('voucher detail lines missing');
        if (!detailRoot?.querySelector('[data-posting-totals]')) issues.push('voucher detail totals missing');
        if (!detailRoot?.querySelector('[data-posting-balance]')) issues.push('voucher posting balance missing');
        if (!detailRoot?.querySelector('[data-posting-audit]')) issues.push('voucher audit trail missing');
        await SCREENS['payment-voucher'](document.getElementById('viewRoot'),{voucherId:902});
        if (postingRoot()?.getAttribute('data-posting-code') !== 'PV-AUDIT-902') {
          issues.push('requested payment voucher did not render');
        }

        adapter.list = async (resource,query) => {
          if (resource === 'finance/payment-vouchers') throw new Error('voucher audit failure');
          return originalList.call(adapter,resource,query);
        };
        await navigate('payment-voucher');
        const errorRoot = postingRoot();
        if (!errorRoot?.querySelector('[data-posting-error]:not([hidden])')) {
          issues.push('voucher read failure did not render the standard error state');
        }
        adapter.list = originalList;
        errorRoot?.querySelector('[data-posting-retry]')?.click();
        for (let attempt=0; attempt<20; attempt+=1) {
          await new Promise((resolve) => setTimeout(resolve,100));
          if (postingRoot()&&!postingRoot()?.querySelector('[data-posting-error]:not([hidden])')) break;
        }
        if (!postingRoot() || postingRoot()?.querySelector('[data-posting-error]:not([hidden])')) {
          issues.push('Retry did not recover Payment Voucher');
        }
      } finally {
        adapter.list = originalList;
        window.navigate = originalNavigate;
        window.getLang = originalGetLang;
        await navigate('payment-voucher');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'payment-voucher');
    if (result) {
      result.layoutIssues.push(...voucherIssues.map((issue)=>`Payment voucher smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind === 'console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind === 'pageerror').map((event)=>event.message));
    }
    events.length = 0;
  }

  if (routes.includes('goods-receipt')) {
    const goodsReceiptIssues = await page.evaluate(async () => {
      const originalGetLang = window.getLang;
      const originalNavigate = window.navigate;
      const originalPrepare = window.prepareCanonicalPurchasingData;
      const originalListPage = window.listPage;
      const originalReceipts = DB.goodsReceipts;
      const originalOrders = DB.purchaseOrders;
      const originalLines = DB.purchaseOrderLines;
      const expectedTitles = {
        en:'Goods Receipt',
        ms:'Penerimaan Barang',
        zh:'收货单',
        ja:'入荷伝票',
        vi:'Phiếu nhận hàng',
      };
      const receipt = {
        id:9901,no:'GR-AUDIT-9901',date:'2026-07-25',po:'PO-AUDIT-9901',
        orderId:9901,warehouseId:9901,supplier:'Audit Supplier Pte Ltd',
        code:'AUD-SUPP',warehouse:'WH-AUDIT',lines:1,recvPct:100,
        qc:'Not modeled',status:'Posted',
      };
      const order = {
        id:9901,docNo:'PO-AUDIT-9901',currency:'SGD',supplierId:9901,
      };
      const line = {
        id:9901,orderId:9901,lineNo:1,productId:9901,
        sku:'AUD-ITEM',name:'Audit Item',uom:'unit',qty:20,
        unitCost:6,net:120,taxCode:'SR',taxRate:9,tax:10.8,
      };
      const movement = {
        id:9901,productId:9901,direction:'in',qty:'20.0000',
        refType:'goods_receipt',refId:9901,movementGroup:'goods_receipt #9901',
      };
      const issues = [];
      let movements = [movement];
      const postingRoot = () => document.querySelector(
        '#viewRoot [data-layout="posting-detail-v1"][data-posting-route="goods-receipt"]',
      );
      try {
        window.prepareCanonicalPurchasingData = async () => {};
        window.listPage = async (resource) => resource === 'inventory/stock-movements'
          ? {data:movements,meta:{nextCursor:null}}
          : originalListPage(resource);
        DB.goodsReceipts = [receipt];
        DB.purchaseOrders = [order];
        DB.purchaseOrderLines = [line];

        for (const [locale,title] of Object.entries(expectedTitles)) {
          window.getLang = () => locale;
          await navigate('goods-receipt',{receiptId:receipt.id});
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (heading !== title) issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          const root = postingRoot();
          if (!root?.querySelector('[data-goods-receipt-lines]')
              || !root?.querySelector('[data-goods-receipt-trace]')
              || !root?.querySelector('[data-goods-receipt-effect]')) {
            issues.push(`${locale} receipt evidence regions missing`);
          }
        }

        window.getLang = () => 'en';
        await navigate('goods-receipt',{receiptId:receipt.id});
        let root = postingRoot();
        if (root?.getAttribute('data-canonical-goods-receipt') !== 'true') {
          issues.push('canonical Goods Receipt marker missing');
        }
        if (root?.querySelectorAll('.posting-detail-fact').length !== 4) {
          issues.push('Goods Receipt does not expose four posting facts');
        }
        if (!root?.querySelector('[data-posting-actions][hidden]')
            || root?.querySelectorAll('[data-posting-actions] button').length) {
          issues.push('posted receipt footer action region is visible or populated');
        }
        if (root?.querySelector('[data-receipt-back]')) {
          issues.push('posted receipt exposes a redundant Back action');
        }
        if (!root?.querySelector('[data-posting-lines] .posting-lines-scroll')
            || !root?.querySelector('[data-posting-totals]')
            || !root?.querySelector('[data-posting-audit] .posting-lines-scroll')
            || !root?.textContent.includes('20')) {
          issues.push('receipt lines, totals or inventory trace are incomplete');
        }

        const headerAction = document.querySelector('#viewRoot [data-posting-header-action]');
        let captured = null;
        window.navigate = async (route,params) => { captured={route,params}; };
        headerAction?.click();
        window.navigate = originalNavigate;
        if (captured?.route !== 'stock-movement') {
          issues.push('View stock movements does not open the stock movement register');
        }

        movements = [];
        await navigate('goods-receipt',{receiptId:receipt.id});
        if (!postingRoot()?.querySelector('[data-goods-receipt-trace] .posting-inline-empty')) {
          issues.push('no-movement state does not use the local standard empty state');
        }

        movements = [movement];
        await navigate('goods-receipt',{receiptId:999999});
        root = postingRoot();
        if (!root?.querySelector('[data-posting-empty]')
            || root?.getAttribute('data-canonical-goods-receipt') !== 'true') {
          issues.push('unknown receipt id left the canonical posting empty state');
        }

        DB.goodsReceipts = [];
        await navigate('goods-receipt');
        if (!postingRoot()?.querySelector('[data-posting-empty]')) {
          issues.push('no-receipt state does not use the standard posting empty state');
        }

        DB.goodsReceipts = [receipt];
        window.listPage = async (resource) => {
          if (resource === 'inventory/stock-movements') throw new Error('goods receipt audit failure');
          return originalListPage(resource);
        };
        await navigate('goods-receipt',{receiptId:receipt.id});
        const errorRoot = postingRoot();
        if (!errorRoot?.querySelector('[data-posting-error]:not([hidden])')) {
          issues.push('read failure did not render the standard posting error state');
        }
        window.listPage = async (resource) => resource === 'inventory/stock-movements'
          ? {data:[movement],meta:{nextCursor:null}}
          : originalListPage(resource);
        errorRoot?.querySelector('[data-posting-retry]')?.click();
        for (let attempt=0; attempt<20; attempt+=1) {
          await new Promise((resolve) => setTimeout(resolve,100));
          if (postingRoot()&&!postingRoot()?.querySelector('[data-posting-error]:not([hidden])')) break;
        }
        if (!postingRoot() || postingRoot()?.querySelector('[data-posting-error]:not([hidden])')) {
          issues.push('Retry did not recover the Goods Receipt');
        }
      } finally {
        window.navigate = originalNavigate;
        window.getLang = originalGetLang;
        window.prepareCanonicalPurchasingData = originalPrepare;
        window.listPage = originalListPage;
        DB.goodsReceipts = originalReceipts;
        DB.purchaseOrders = originalOrders;
        DB.purchaseOrderLines = originalLines;
        await navigate('goods-receipt');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'goods-receipt');
    if (result) {
      result.layoutIssues.push(...goodsReceiptIssues.map((issue)=>`Goods Receipt smoke: ${issue}`));
      result.consoleErrors.push(...events.filter((event)=>event.kind === 'console.error').map((event)=>event.message));
      result.pageErrors.push(...events.filter((event)=>event.kind === 'pageerror').map((event)=>event.message));
    }
    events.length = 0;
  }

  if (routes.includes('pnl')) {
    const financialIssues = await page.evaluate(async () => {
      const originalLanguage = getLang();
      const expectedTitles = {
        en: 'Profit & Loss',
        ms: 'Untung & Rugi',
        zh: '损益表',
        ja: '損益計算書',
        vi: 'Báo cáo lãi lỗ',
      };
      const issues = [];
      try {
        for (const [locale, title] of Object.entries(expectedTitles)) {
          await setLang(locale);
          await navigate('pnl');
          const heading = document.querySelector('#viewRoot h1')?.textContent?.trim() || '';
          if (!heading.startsWith(title)) {
            issues.push(`${locale} heading rendered as ${heading || 'missing'}`);
          }
          const root = document.querySelector(
            '#viewRoot [data-layout="financial-statement-v1"]',
          );
          if (!root) {
            issues.push(`${locale} financial statement root missing`);
            continue;
          }
          if (!root.querySelector('[data-financial-run]')) {
            issues.push(`${locale} Run report action missing`);
          }
          if (root.textContent.includes('Cash') || root.textContent.includes('Actual reference')) {
            issues.push(`${locale} contains a legacy fake report option`);
          }
        }
      } finally {
        await setLang(originalLanguage);
        await navigate('pnl');
      }
      return issues;
    });
    const result = results.find((row) => row.route === 'pnl');
    if (result) {
      result.layoutIssues.push(
        ...financialIssues.map((issue) => `Financial statement smoke: ${issue}`),
      );
      result.consoleErrors.push(
        ...events.filter((event) => event.kind === 'console.error').map((event) => event.message),
      );
      result.pageErrors.push(
        ...events.filter((event) => event.kind === 'pageerror').map((event) => event.message),
      );
    }
    events.length = 0;
  }

  // Responsive shells must also reveal the active section when an already-open
  // desktop page is resized (for example, device rotation or a split window).
  // A fresh mobile navigation alone cannot catch this lifecycle regression.
  if (viewport.label === 'desktop') {
    await page.evaluate(async () => navigate('supplier-invoice'));
    await page.waitForTimeout(SETTLE_MS);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(SETTLE_MS);
    const activeVisibleAfterResize = await page.evaluate(() => {
      const nav = document.querySelector('#viewRoot .sales-subnav');
      const active = nav && nav.querySelector('[aria-selected="true"]');
      if (!nav || !active) return false;
      const navRect = nav.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      return activeRect.left >= navRect.left - 1 && activeRect.right <= navRect.right + 1;
    });
    if (!activeVisibleAfterResize) {
      const result = results.find((row) => row.route === 'supplier-invoice');
      if (result) result.layoutIssues.push('active subnav is outside the visible strip after desktop-to-mobile resize');
    }
  }

  await context.close();
  return results;
}

let previewProc;
let exitCode = 0;
try {
  console.log(`Starting vite preview on ${BASE_URL} (serving web/dist/)...`);
  previewProc = await startPreviewServer();

  const browser = await chromium.launch();
  try {
    const batches = [];
    for (const viewport of VIEWPORTS) batches.push(await auditRoutes(browser, viewport));
    const results = batches.flat();
    const routeCount = batches[0] ? batches[0].length : 0;
    const desktopMeta = batches[0] || [];
    const canonicalCount = desktopMeta.filter((r) => r.meta && r.meta.maturity === 'canonical').length;
    const previewCount = desktopMeta.filter((r) => r.meta && r.meta.maturity === 'preview').length;

    const failed = results.filter((r) => r.threwSync || r.renderError || r.consoleErrors.length || r.pageErrors.length || r.missingMeta);
    const leaked = results.filter((r) => r.identityLeaks.length);
    const previewContractFailed = results.filter((r) => r.missingPreviewBanner || r.enabledPreviewWrites.length);
    const layoutFailed = results.filter((r) => r.layoutIssues.length);
    const shellFailed = results.filter((r) => r.missingModuleShell);

    if (REPORT_LAYOUTS) {
      console.log('\nRoute layout profile (desktop):');
      for (const row of desktopMeta) {
        const p = row.layoutProfile;
        console.log([
          row.route, row.moduleId || '-', JSON.stringify(p.heading),
          `grid=${p.gridTables}`, `lines=${p.semanticTables}`, `rows=${p.visibleRows}`,
          `salesBody=${Number(p.salesBody)}`, `doc=${Number(p.documentPage)}`,
          `form=${Number(p.formSurface)}`, `split=${Number(p.splitSurface)}`,
          `dash=${Number(p.dashboardSurface)}`, `actual=${p.actualLayout || '-'}`,
          `declared=${row.meta?.layout || '-'}`,
        ].join('\t'));
      }
    }

    if (failed.length) {
      exitCode = 1;
      console.error(`\n${failed.length}/${results.length} routes errored:\n`);
      for (const r of failed) {
        console.error(`FAIL [${r.viewport}:${r.route}]`);
        if (r.missingMeta) console.error('  [metadata] SCREEN_META entry missing');
        if (r.threwSync) console.error(`  [sync throw] ${r.threwSync}`);
        if (r.renderError) {
          console.error('  [render error] standard page error state is visible');
          console.error(`  [render error detail] ${String(r.renderErrorMessage || r.text || '').slice(0, 500).replace(/\s+/g, ' ')}`);
        }
        for (const m of r.consoleErrors) console.error(`  [console.error] ${m}`);
        for (const m of r.pageErrors) console.error(`  [pageerror] ${m}`);
      }
    } else {
      console.log(`All ${routeCount} routes rendered at desktop + mobile without console/page errors.`);
    }

    if (leaked.length) {
      exitCode = 1;
      console.error(`\n${leaked.length} route(s) leaked prototype identity markers:\n`);
      for (const r of leaked) console.error(`LEAK [${r.viewport}:${r.route}] matched: ${r.identityLeaks.join(', ')}`);
    } else {
      console.log('No leftover Northwind/Dana Reyes identity markers found on canonical routes.');
    }

    if (previewContractFailed.length) {
      exitCode = 1;
      console.error(`\n${previewContractFailed.length} Preview contract failure(s):\n`);
      for (const r of previewContractFailed) {
        console.error(`PREVIEW [${r.viewport}:${r.route}]`);
        if (r.missingPreviewBanner) console.error('  visible Preview · Sample Data banner missing');
        if (r.enabledPreviewWrites.length) console.error(`  enabled write actions: ${r.enabledPreviewWrites.join(' | ')}`);
      }
    } else {
      console.log(`Route maturity contract passed: ${canonicalCount} canonical, ${previewCount} preview.`);
    }

    if (layoutFailed.length) {
      exitCode = 1;
      console.error(`\n${layoutFailed.length} layout failure(s):\n`);
      for (const r of layoutFailed) console.error(`LAYOUT [${r.viewport}:${r.route}] ${r.layoutIssues.join(' | ')}`);
    } else {
      console.log('Desktop/mobile layout contract passed: no page, active-tab, standard action-bar or declared page-contract failures.');
    }

    if (shellFailed.length) {
      exitCode = 1;
      console.error(`\n${shellFailed.length} module shell failure(s):\n`);
      for (const r of shellFailed) console.error(`SHELL [${r.viewport}:${r.route}] shared module shell/subnav missing`);
    } else {
      console.log('Shared module shell contract passed on every business route.');
    }
  } finally {
    await browser.close();
  }
} catch (e) {
  console.error('Screen audit crashed:', e.message);
  exitCode = 1;
} finally {
  if (previewProc) previewProc.kill();
}

console.log(exitCode === 0 ? '\nScreen audit PASSED ✅' : '\nScreen audit FAILED ❌');
process.exit(exitCode);
