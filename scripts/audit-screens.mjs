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
//     on a route belonging to a module docs/STATUS.md documents as canonical.
//     Module ownership is read live from app.js's own ROUTE_MODULE map (not
//     hand-duplicated here), so this stays correct as routes move between
//     modules. MOCK_MODULE_IDS below is the one list that needs updating —
//     when a module in it gains real schema/adapter wiring, drop its id here
//     in the same change that updates docs/STATUS.md.
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

/* Module ids (app.js's ROUTE_MODULE values) docs/STATUS.md's "What renders but
   is mock-only" list documents as having no schema yet: Purchasing, CRM,
   Manufacturing, Quality, Warehouse (advanced), HR/Payroll, Projects, Service,
   Fixed Assets, Reporting/BI, Integration, Admin. */
const MOCK_MODULE_IDS = new Set([
  'purchasing', 'crm', 'manufacturing', 'quality', 'warehouse',
  'hr', 'project', 'service', 'asset', 'bi', 'integration', 'admin',
  // 'workflow' is app.js's sidebar "Approvals" entry — app.js's own
  // ROUTE_MODULE build order (DB.nav processed before SUBROUTES) assigns it
  // to po-approval specifically, which is the same mock purchasing content
  // as 'purchasing', just reached through a second sidebar entry point.
  'workflow',
]);

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
        } catch (e) { /* not up yet */ }
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

async function auditRoutes(browser) {
  // Accumulates errors for whichever route is currently being tested; the
  // loop below clears it after consuming each route's window, so listeners
  // don't need to be attached/detached per iteration.
  const events = []; // {kind, message}
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
    } catch (e) { /* ignore */ }
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForSelector('.dashgrid', { timeout: 15000, state: 'visible' });

  const routes = await page.evaluate(() => Object.keys(SCREENS).sort());
  const routeModule = await page.evaluate(() => Object.assign({}, ROUTE_MODULE));
  console.log(`Found ${routes.length} routes registered in SCREENS.\n`);

  const results = [];

  for (const route of routes) {
    const throwMessage = await page.evaluate((r) => {
      try {
        navigate(r);
        return null;
      } catch (e) {
        return e && e.message ? e.message : String(e);
      }
    }, route);

    await page.waitForTimeout(SETTLE_MS);

    const text = await page.evaluate(() => {
      const el = document.getElementById('viewRoot');
      return el ? el.innerText : '';
    }).catch(() => '');

    const moduleId = routeModule[route] || null;
    const exempt = moduleId != null && MOCK_MODULE_IDS.has(moduleId);
    const leaks = exempt ? [] : findIdentityLeak(text || '');

    results.push({
      route,
      moduleId,
      threwSync: throwMessage,
      consoleErrors: events.filter((e) => e.kind === 'console.error').map((e) => e.message),
      pageErrors: events.filter((e) => e.kind === 'pageerror').map((e) => e.message),
      identityLeaks: leaks,
    });

    events.length = 0; // fully consumed this route's window; reset for the next
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
    const results = await auditRoutes(browser);

    const failed = results.filter((r) => r.threwSync || r.consoleErrors.length || r.pageErrors.length);
    const leaked = results.filter((r) => r.identityLeaks.length);

    if (failed.length) {
      exitCode = 1;
      console.error(`\n${failed.length}/${results.length} routes errored:\n`);
      for (const r of failed) {
        console.error(`FAIL [${r.route}]`);
        if (r.threwSync) console.error(`  [sync throw] ${r.threwSync}`);
        for (const m of r.consoleErrors) console.error(`  [console.error] ${m}`);
        for (const m of r.pageErrors) console.error(`  [pageerror] ${m}`);
      }
    } else {
      console.log(`All ${results.length} routes rendered without console/page errors.`);
    }

    if (leaked.length) {
      exitCode = 1;
      console.error(`\n${leaked.length} route(s) leaked prototype identity markers:\n`);
      for (const r of leaked) console.error(`LEAK [${r.route}] matched: ${r.identityLeaks.join(', ')}`);
    } else {
      console.log('No leftover Northwind/Dana Reyes identity markers found on any route.');
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
