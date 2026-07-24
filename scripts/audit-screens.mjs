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
//     MASTER_DETAIL_EDITOR_ONLY=1 for versioned master-data detail editors, or
//     CASE_DETAIL_ONLY=1 for actionable lifecycle case details, or
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
const MASTER_DETAIL_EDITOR_ONLY = process.env.MASTER_DETAIL_EDITOR_ONLY === '1';
const CASE_DETAIL_ONLY = process.env.CASE_DETAIL_ONLY === '1';
const LEDGER_DETAIL_ONLY = process.env.LEDGER_DETAIL_ONLY === '1';
const POSTING_DETAIL_ONLY = process.env.POSTING_DETAIL_ONLY === '1';
const FINANCIAL_STATEMENT_ONLY = process.env.FINANCIAL_STATEMENT_ONLY === '1';
const PAYROLL_RUN_ONLY = process.env.PAYROLL_RUN_ONLY === '1';
const REPORT_LAYOUTS = process.env.REPORT_LAYOUTS === '1';
const LIST_LAYOUTS = new Set(['transaction-list-v1','master-detail-register-v1','report-list-v1']);
const OPERATIONAL_WORKSPACE_LAYOUT = 'operational-workspace-v1';
const MASTER_DETAIL_EDITOR_LAYOUT = 'master-detail-editor-v1';
const CASE_DETAIL_LAYOUT = 'case-detail-v1';
const LEDGER_DETAIL_LAYOUT = 'ledger-detail-v1';
const POSTING_DETAIL_LAYOUT = 'posting-detail-v1';
const FINANCIAL_STATEMENT_LAYOUT = 'financial-statement-v1';
const VALID_LAYOUTS = new Set([
  ...LIST_LAYOUTS,OPERATIONAL_WORKSPACE_LAYOUT,MASTER_DETAIL_EDITOR_LAYOUT,CASE_DETAIL_LAYOUT,LEDGER_DETAIL_LAYOUT,POSTING_DETAIL_LAYOUT,FINANCIAL_STATEMENT_LAYOUT,
  'dashboard','report','document-detail','form',
  'master-detail','workspace','board','activity-feed',
]);

if ([LIST_LAYOUT_ONLY,WORKSPACE_LAYOUT_ONLY,MASTER_DETAIL_EDITOR_ONLY,CASE_DETAIL_ONLY,LEDGER_DETAIL_ONLY,POSTING_DETAIL_ONLY,FINANCIAL_STATEMENT_ONLY,PAYROLL_RUN_ONLY].filter(Boolean).length > 1) {
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
                : allRoutes;
  if (LIST_LAYOUT_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare a shared list layout.');
  }
  if (PAYROLL_RUN_ONLY && routes.length === 0) {
    throw new Error('Payroll Run screen is not registered.');
  }
  if (WORKSPACE_LAYOUT_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare an operational workspace layout.');
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
      if (masterDetailEditorRoot && masterDetailEditorRegions[2] && masterDetailEditorRegions[3]) {
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
      }
      if (caseDetailRoot && caseDetailRoot.querySelector('.docpage,.doclayout')) {
        layoutIssues.push('case detail still renders legacy document chrome');
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
          legacyDocumentChrome: Boolean(caseDetailRoot?.querySelector('.docpage,.doclayout')),
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
        renderError: Boolean(el.querySelector('.screen-render-error')),
      };
    }).catch(() => ({
      text: '', previewBanner: false, enabledPreviewWrites: [],
      layoutIssues: ['render inspection failed'],
      listLayout: { present: false, actualLayout: null, missingRegions: [], ordered: false, missingMasterDetailRegions: [] },
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
      workspaceLayout: {
        present: false, actualLayout: null, missingRegions: [], ordered: false,
        progress: null, pageheads: 0, errorRegion: false, incompleteCompletionEnabled: false,
      },
      masterDetailEditorLayout: {
        present: false, actualLayout: null, missingRegions: [], ordered: false,
        pageheads: 0, errorRegion: false, legacyDocumentChrome: false,
      },
      caseDetailLayout: {
        present: false, actualLayout: null, missingRegions: [], ordered: false,
        pageheads: 0, errorRegion: false, legacyDocumentChrome: false,
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
      }
    }
    if (rendered.listLayout.present && !LIST_LAYOUTS.has(meta?.layout)) {
      rendered.layoutIssues.push(`rendered ${rendered.listLayout.actualLayout} but declared ${meta?.layout || 'none'}`);
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
      && !['report','master-detail','workspace',OPERATIONAL_WORKSPACE_LAYOUT,MASTER_DETAIL_EDITOR_LAYOUT,CASE_DETAIL_LAYOUT,LEDGER_DETAIL_LAYOUT,POSTING_DETAIL_LAYOUT,FINANCIAL_STATEMENT_LAYOUT].includes(meta?.layout);
    if (highConfidenceRegister && !LIST_LAYOUTS.has(meta?.layout)) {
      rendered.layoutIssues.push(`list-shaped route is classified as ${meta?.layout || 'none'}`);
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
      missingPreviewBanner: Boolean(meta && meta.maturity === 'preview' && !rendered.previewBanner),
      enabledPreviewWrites: meta && meta.maturity === 'preview' ? rendered.enabledPreviewWrites : [],
      layoutIssues: rendered.layoutIssues,
      layoutProfile: rendered.layoutProfile,
      missingModuleShell: !['dashboard','settings'].includes(route) && !rendered.moduleShell,
    });

    events.length = 0; // fully consumed this route's window; reset for the next
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
          if (!start || !end) {
            issues.push('new payroll run modal is missing its period fields');
          } else {
            start.value = '2026-07-31';
            end.value = '2026-07-01';
            modal.querySelector('[data-payroll-create]')?.click();
            if (modal.querySelector('[data-payroll-create-error]')?.hidden !== false) {
              issues.push('invalid payroll period did not render the inline modal error');
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
        await new Promise((resolve) => setTimeout(resolve,250));
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
        await new Promise((resolve) => setTimeout(resolve,250));
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
          setLang(locale);
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
        setLang(originalLanguage);
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
        if (r.renderError) console.error('  [render error] standard page error state is visible');
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
