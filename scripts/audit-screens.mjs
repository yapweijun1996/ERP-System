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
//   - stateful transaction detail routes are opened through real fixtures
//     instead of silently redirecting because no record was selected.
//
// Usage: npm run build:demo && node scripts/audit-screens.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.AUDIT_PORT || '4311';
const BASE_URL = `http://localhost:${PORT}`;
const SETTLE_MS = 200;

const IDENTITY_MARKERS = ['northwind', 'dana reyes', 'dana.reyes@northwind.co'];
const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 800 },
  { label: 'mobile', width: 375, height: 812 },
];

if (!existsSync(DIST_INDEX)) {
  console.error(`web/dist/index.html not found. Run "npm run build:demo" before this script.`);
  process.exit(1);
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

  const routes = await page.evaluate(() => Object.keys(SCREENS).sort());
  const routeModule = await page.evaluate(() => Object.assign({}, ROUTE_MODULE));
  const screenMeta = await page.evaluate(() => JSON.parse(JSON.stringify(window.SCREEN_META || {})));
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
      return {
        text: el.innerText || '',
        previewBanner: Boolean(el.querySelector('[data-preview-banner]')),
        enabledPreviewWrites,
        layoutIssues,
        moduleShell: Boolean(el.querySelector('.sales-subnav')),
        renderError: Boolean(el.querySelector('.screen-render-error')),
      };
    }).catch(() => ({ text: '', previewBanner: false, enabledPreviewWrites: [], layoutIssues: ['render inspection failed'], moduleShell: false, renderError: true }));

    const moduleId = routeModule[route] || null;
    const canonical = meta && meta.maturity === 'canonical';
    const leaks = canonical ? findIdentityLeak(rendered.text || '') : [];

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
      missingModuleShell: !['dashboard','settings'].includes(route) && !rendered.moduleShell,
    });

    events.length = 0; // fully consumed this route's window; reset for the next
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
      console.log('Desktop/mobile layout contract passed: no page, active-tab, or standard action-bar overflow.');
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
