#!/usr/bin/env node
/*
 * HR Directory KPI navigation E2E contract.
 *
 * Runs against the built Demo PGlite app only. It verifies that the pending
 * leave KPI is an action card and opens the pending leave approval register;
 * it never targets production PostgreSQL.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.HR_KPI_E2E_PORT || '4314';
const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = 60000;

if (!existsSync(DIST_INDEX)) {
  console.error('web/dist/index.html not found. Run "npm run build:demo" first.');
  process.exit(1);
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (async function poll() {
      while (Date.now() < deadline) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            resolve();
            return;
          }
        } catch {
          // Vite is still starting.
        }
        await new Promise((resume) => setTimeout(resume, 250));
      }
      reject(new Error(`${url} did not respond within ${timeoutMs}ms`));
    }());
  });
}

async function startPreview() {
  const viteBin = path.join(WEB_DIR, 'node_modules', '.bin', 'vite');
  if (!existsSync(viteBin)) throw new Error(`${viteBin} not found — run npm ci --prefix web first.`);
  const processHandle = spawn(viteBin, ['preview', '--port', PORT, '--strictPort'], {
    cwd: WEB_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  processHandle.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  let exited = false;
  processHandle.on('exit', () => { exited = true; });
  try {
    await waitForServer(BASE_URL, 15000);
  } catch (error) {
    processHandle.kill();
    throw exited
      ? new Error(`vite preview exited before becoming ready. stderr:\n${stderr}`)
      : error;
  }
  return processHandle;
}

async function main() {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`[console.error] ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  try {
    await page.addInitScript(() => {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      localStorage.setItem('aria-demo-auth', JSON.stringify({
        signedIn: true,
        email: 'admin@acme.co',
        at: new Date(0).toISOString(),
      }));
    });
    await page.goto(`${BASE_URL}/?hr-kpi-e2e=${Date.now()}#hr-directory`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForFunction(() => window.ErpSystemData && window.navigate, { timeout: TIMEOUT });
    const pendingKpi = page.getByRole('button', { name: /Pending leave/i });
    await pendingKpi.waitFor({ state: 'visible', timeout: TIMEOUT });
    assert(await pendingKpi.isEnabled(), 'pending leave KPI must be enabled when it has a navigation action');
    await pendingKpi.click();
    await page.waitForFunction(() => window.location.hash === '#leave-approval', { timeout: 10000 });
    await page.locator('[data-list-kpis]').waitFor({ state: 'visible', timeout: TIMEOUT });
    assert(await page.locator('[data-list-kpi-filter="pending"]').count() >= 1,
      'leave approval register must expose the pending filter after KPI navigation');
    assert(browserErrors.length === 0, `browser errors detected:\n${browserErrors.join('\n')}`);
    console.log('PASS HR Directory KPI E2E: pending leave opens the pending approval register');
  } finally {
    await context.close();
    await browser.close();
    preview.kill();
  }
}

main().catch((error) => {
  console.error(`FAIL HR Directory KPI E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
