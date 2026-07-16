#!/usr/bin/env node
// Browser smoke test (TASK-015). Serves the already-built demo bundle
// (web/dist/, from `npm run build:demo`) with `vite preview`, then drives a
// real headless browser at desktop and mobile viewports and asserts:
//   - the app boots straight to a rendered dashboard (bypassing the first-run
//     wizard and login via a pre-set localStorage flag — this is a smoke test
//     for "does the shell render", not a wizard/login flow test)
//   - zero browser console errors and zero uncaught page errors
//   - the dashboard's own content actually appears (not just "no errors")
//
// Usage: npm run build:demo && npm run smoke
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.SMOKE_PORT || '4310';
/* "localhost", not "127.0.0.1": vite preview binds only the IPv6 loopback
   ([::1]), not IPv4, so a literal 127.0.0.1 connection is refused. */
const BASE_URL = `http://localhost:${PORT}`;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
];

if (!existsSync(DIST_INDEX)) {
  console.error(`web/dist/index.html not found. Run "npm run build:demo" before "npm run smoke".`);
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

  /* Actual HTTP polling, not stdout pattern-matching — "printed the URL" and
     "actually accepting connections" are not guaranteed to be the same moment. */
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

async function checkViewport(browser, viewport) {
  const errors = [];
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });

  /* Bypass the first-run wizard and demo login — this is a shell/dashboard
     smoke test, not a wizard/login flow test (those are covered by manual
     verification in each task's own description). Setting localStorage before
     any page script runs, then navigating, lands directly on the dashboard. */
  await page.addInitScript(() => {
    try {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      localStorage.setItem('aria-demo-auth', JSON.stringify({ signedIn: true, email: 'admin@acme.co', at: new Date(0).toISOString() }));
    } catch (e) { /* ignore */ }
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });

  let dashboardVisible = false;
  try {
    await page.waitForSelector('.dashgrid', { timeout: 15000, state: 'visible' });
    dashboardVisible = true;
  } catch (e) {
    errors.push(`[content] .dashgrid (dashboard cards) never appeared: ${e.message}`);
  }

  const title = await page.title();
  if (!/Acme/i.test(title)) {
    errors.push(`[content] document.title "${title}" does not mention the seeded company (expected "Acme...")`);
  }

  await context.close();
  return { viewport: viewport.name, dashboardVisible, title, errors };
}

let previewProc;
let exitCode = 0;
try {
  console.log(`Starting vite preview on ${BASE_URL} (serving web/dist/)...`);
  previewProc = await startPreviewServer();

  const browser = await chromium.launch();
  try {
    for (const viewport of VIEWPORTS) {
      console.log(`Checking ${viewport.name} (${viewport.width}x${viewport.height})...`);
      const result = await checkViewport(browser, viewport);
      if (result.errors.length) {
        exitCode = 1;
        console.error(`FAIL [${result.viewport}] title="${result.title}" dashboardVisible=${result.dashboardVisible}`);
        for (const e of result.errors) console.error(`  ${e}`);
      } else {
        console.log(`PASS [${result.viewport}] title="${result.title}" — dashboard rendered, zero console/page errors.`);
      }
    }
  } finally {
    await browser.close();
  }
} catch (e) {
  console.error('Smoke test crashed:', e.message);
  exitCode = 1;
} finally {
  if (previewProc) previewProc.kill();
}

console.log(exitCode === 0 ? '\nSmoke test PASSED ✅' : '\nSmoke test FAILED ❌');
process.exit(exitCode);
