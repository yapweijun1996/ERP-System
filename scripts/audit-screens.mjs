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
//     rendering it (the exact bug class TASK-018 was opened for: SCREENS['pnl']
//     indexed DB.pnl[3] when the adapter only supplied 2 groups)
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
//     LEDGER_DETAIL_ONLY=1 for immutable financial account ledgers.
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
const REPORT_LAYOUTS = process.env.REPORT_LAYOUTS === '1';
const LIST_LAYOUTS = new Set(['transaction-list-v1','master-detail-register-v1','report-list-v1']);
const OPERATIONAL_WORKSPACE_LAYOUT = 'operational-workspace-v1';
const MASTER_DETAIL_EDITOR_LAYOUT = 'master-detail-editor-v1';
const CASE_DETAIL_LAYOUT = 'case-detail-v1';
const LEDGER_DETAIL_LAYOUT = 'ledger-detail-v1';
const VALID_LAYOUTS = new Set([
  ...LIST_LAYOUTS,OPERATIONAL_WORKSPACE_LAYOUT,MASTER_DETAIL_EDITOR_LAYOUT,CASE_DETAIL_LAYOUT,LEDGER_DETAIL_LAYOUT,
  'dashboard','report','document-detail','form',
  'master-detail','workspace','board','activity-feed',
]);

if ([LIST_LAYOUT_ONLY,WORKSPACE_LAYOUT_ONLY,MASTER_DETAIL_EDITOR_ONLY,CASE_DETAIL_ONLY,LEDGER_DETAIL_ONLY].filter(Boolean).length > 1) {
  throw new Error('LIST_LAYOUT_ONLY, WORKSPACE_LAYOUT_ONLY, MASTER_DETAIL_EDITOR_ONLY, CASE_DETAIL_ONLY and LEDGER_DETAIL_ONLY are mutually exclusive.');
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
  const routes = LIST_LAYOUT_ONLY
    ? allRoutes.filter((route) => LIST_LAYOUTS.has(screenMeta[route]?.layout))
    : WORKSPACE_LAYOUT_ONLY
      ? allRoutes.filter((route) => screenMeta[route]?.layout === OPERATIONAL_WORKSPACE_LAYOUT)
      : MASTER_DETAIL_EDITOR_ONLY
        ? allRoutes.filter((route) => screenMeta[route]?.layout === MASTER_DETAIL_EDITOR_LAYOUT)
        : CASE_DETAIL_ONLY
          ? allRoutes.filter((route) => screenMeta[route]?.layout === CASE_DETAIL_LAYOUT)
          : LEDGER_DETAIL_ONLY
            ? allRoutes.filter((route) => screenMeta[route]?.layout === LEDGER_DETAIL_LAYOUT)
            : allRoutes;
  if (LIST_LAYOUT_ONLY && routes.length === 0) {
    throw new Error('No SCREEN_META routes declare a shared list layout.');
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
      const listRoot = el.querySelector([
        '[data-layout="transaction-list-v1"]',
        '[data-layout="master-detail-register-v1"]',
        '[data-layout="report-list-v1"]',
      ].join(','));
      const actualListLayout = listRoot?.getAttribute('data-layout') || null;
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
            || null,
        },
        moduleShell: Boolean(el.querySelector('.sales-subnav')),
        renderError: Boolean(el.querySelector('.screen-render-error')),
      };
    }).catch(() => ({
      text: '', previewBanner: false, enabledPreviewWrites: [],
      layoutIssues: ['render inspection failed'],
      listLayout: { present: false, actualLayout: null, missingRegions: [], ordered: false, missingMasterDetailRegions: [] },
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
    const highConfidenceRegister = rendered.layoutProfile.gridTables > 0
      && !rendered.layoutProfile.documentPage
      && !rendered.layoutProfile.formSurface
      && !rendered.layoutProfile.splitSurface
      && !rendered.layoutProfile.dashboardSurface
      && !['report','master-detail','workspace',OPERATIONAL_WORKSPACE_LAYOUT,MASTER_DETAIL_EDITOR_LAYOUT,CASE_DETAIL_LAYOUT,LEDGER_DETAIL_LAYOUT].includes(meta?.layout);
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
