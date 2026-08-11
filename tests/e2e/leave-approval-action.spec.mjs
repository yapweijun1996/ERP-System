#!/usr/bin/env node
/*
 * Leave Approval action E2E contract.
 *
 * Runs against the built Demo shell and stubs the leave register adapter after
 * boot. It never approves a production request; it verifies that a governed
 * row sends its versioned action payload and exposes progress while the write
 * is in flight.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.LEAVE_APPROVAL_E2E_PORT || '4315';
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
    await page.goto(`${BASE_URL}/?leave-approval-e2e=${Date.now()}#dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForFunction(() => window.ErpSystemData && window.navigate, { timeout: TIMEOUT });

    await page.evaluate(() => {
      const employee = {
        id: 10, fullName: 'Approval Employee', department: 'Operations', jobTitle: 'Director',
      };
      const row = {
        id: 77, employeeId: employee.id, status: 'pending', legacyPolicy: false, version: 3,
        leaveType: 'Annual', startDate: '2026-08-06', endDate: '2026-08-06', days: '1.00',
        reason: 'Private test reason', rejectionReason: null,
      };
      const calls = [];
      ErpSystemData.list = async (resource) => ({
        data: resource === 'hr/employees' ? [employee] : [row], meta: {},
      });
      ErpSystemData.my.approvalQueue = async () => ({
        data: [{ requestId: row.id, currentAuthority: { type: 'permission', permissionKey: 'hr.write' } }],
        meta: {},
      });
      ErpSystemData.action = async (...args) => new Promise((resolve) => {
        calls.push(args);
        window.__leaveApprovalResolve = () => {
          row.status = 'approved';
          resolve({ data: { id: row.id, status: row.status, version: 4 }, meta: {} });
        };
      });
      window.__leaveApprovalE2E = { calls, row };
      navigate('leave-approval');
    });

    const actionBar = page.locator('[data-leave-actions]');
    await actionBar.waitFor({ state: 'visible', timeout: TIMEOUT });
    await actionBar.getByRole('button', { name: 'Approve', exact: true }).click();

    const progress = actionBar.locator('.leave-action-progress');
    await progress.waitFor({ state: 'visible', timeout: 10000 });
    assert(await actionBar.getByRole('button', { name: /Approve/ }).isDisabled(),
      'approve must be disabled while the request is in flight');
    assert(await actionBar.getByRole('button', { name: /Reject/ }).isDisabled(),
      'reject must be disabled while the request is in flight');

    const call = await page.evaluate(() => window.__leaveApprovalE2E.calls[0]);
    assert(call?.[0] === 'hr/leave-requests' && call?.[2] === 'approve',
      'approve must use the HR leave resource action');
    assert(call?.[3]?.expectedVersion === 3 && call?.[3]?.reason === '',
      'governed approve must send expectedVersion and an auditable reason field');
    assert(typeof call?.[4] === 'string' && call[4].length > 0,
      'approve must send an idempotency key');

    await page.evaluate(() => window.__leaveApprovalResolve());
    await progress.waitFor({ state: 'detached', timeout: 10000 });
    assert(await page.locator('[data-leave-action-error]').count() === 0,
      'successful approval must not show the generic action error');
    assert(browserErrors.length === 0, `browser errors detected:\n${browserErrors.join('\n')}`);
    console.log('PASS Leave Approval action E2E: governed approve shows loading and sends a versioned idempotent command');
  } finally {
    await context.close();
    await browser.close();
    preview.kill();
  }
}

main().catch((error) => {
  console.error(`FAIL Leave Approval action E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
