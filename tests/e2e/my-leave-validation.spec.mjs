#!/usr/bin/env node
/*
 * My Leave form-validation E2E contract.
 *
 * This runs against the built Demo PGlite app only. The page receives an
 * isolated in-browser context and the leave adapter is stubbed after boot, so
 * it never writes to production PostgreSQL.
 *
 * Usage: npm run test:e2e:leave
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.MY_LEAVE_E2E_PORT || '4313';
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
  if (!existsSync(viteBin)) {
    throw new Error(`${viteBin} not found — run npm ci --prefix web first.`);
  }
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
    await page.goto(`${BASE_URL}/?my-leave-e2e=${Date.now()}#dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForFunction(
      () => window.ErpSystemData && window.navigate,
      { timeout: TIMEOUT },
    );

    await page.evaluate(() => {
      const company = {
        companyFn: 'C-SG', name: 'Acme Singapore', country: 'SG',
        currency: 'SGD', taxRegime: 'GST', locale: 'en',
      };
      const employee = {
        id: 42, employeeNo: 'EMP-E2E', fullName: 'My Leave E2E',
        department: 'Operations', jobTitle: 'Coordinator', annualLeaveDays: 14,
      };
      const context = {
        company,
        employee,
        leaveTypes: [{ id: 1, code: 'ANNUAL', name: 'Annual leave', paid: true, policyVersionId: 1 }],
        annualLeaveBalance: { available: '14.00' },
        capabilities: { leave: { available: true, writable: true } },
      };
      const detail = {
        id: 71, employeeId: employee.id, status: 'draft', version: 1,
        leaveType: 'Annual leave', startDate: '2026-08-21', endDate: '2026-08-22',
        days: '2.00', reason: 'asdasdsa', currentRevisionNo: 1,
        revisions: [{
          id: 711, revisionNo: 1, leaveTypeId: 1, policyVersionId: 1,
          calendarVersionId: 1, startDate: '2026-08-21', endDate: '2026-08-22',
          unit: 'full_day', days: '2.00', reason: 'asdasdsa', changeReason: null,
          evidenceRequired: false, createdAt: '2026-08-06T00:00:00Z',
        }],
        events: [], evidence: [], cancellations: [],
      };
      const calls = [];
      DB.company = company;
      DB.myWorkContext = context;
      MY_WORK_CONTEXT = context;
      ErpSystemData.my.context = async () => ({ data: context, meta: { actorDerived: true } });
      ErpSystemData.my.leaveRequests = async () => ({ data: [], meta: { actorDerived: true } });
      ErpSystemData.my.leaveApplication = async () => ({
        data: detail, meta: { actorDerived: true, privacy: 'owner_private' },
      });
      ErpSystemData.my.createLeaveDraft = async (payload) => {
        calls.push(payload);
        return { data: { id: 71, status: 'draft', version: 1 }, meta: { actorDerived: true } };
      };
      window.__myLeaveE2E = { calls };
      navigate('my-leave');
    });

    await page.locator('[data-list-primary-action]').waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.getByRole('button', { name: 'New leave', exact: true }).click();
    const modal = page.locator('#modalEl');
    await modal.locator('[data-my-leave-reason]').fill('asdasdsa');
    await modal.locator('[data-my-leave-start]').fill('2026-08-21');
    await modal.locator('[data-my-leave-end]').fill('2026-08-06');
    await modal.getByRole('button', { name: 'Save draft', exact: true }).click();

    const formError = modal.locator('[data-my-leave-form-error]');
    await formError.waitFor({ state: 'visible', timeout: 10000 });
    const errorText = (await formError.innerText()).trim();
    assert(/end date must not precede start date/i.test(errorText),
      `reversed dates showed the wrong validation message: ${errorText}`);
    assert(await page.locator('#modalEl').count() === 1, 'invalid leave form should remain open');
    assert(await page.evaluate(() => window.__myLeaveE2E.calls.length === 0),
      'invalid leave form must not call createLeaveDraft');

    await modal.locator('[data-my-leave-end]').fill('2026-08-22');
    await modal.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.waitForSelector('#modalEl', { state: 'detached', timeout: 10000 });
    const payload = await page.evaluate(() => window.__myLeaveE2E.calls[0]);
    assert(payload?.reason === 'asdasdsa', 'valid private reason was not sent to createLeaveDraft');
    assert(payload?.startDate === '2026-08-21' && payload?.endDate === '2026-08-22',
      'valid leave dates were not sent to createLeaveDraft');
    assert(browserErrors.length === 0, `browser errors detected:\n${browserErrors.join('\n')}`);
    console.log('PASS My Leave validation E2E: reversed dates show date error and valid 8-character reason saves');
  } finally {
    await context.close();
    await browser.close();
    preview.kill();
  }
}

main().catch((error) => {
  console.error(`FAIL My Leave validation E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
