#!/usr/bin/env node
/*
 * TASK-221 procurement receiving workflow.
 *
 * The audit approves the seeded purchase order, verifies the next receive
 * action on the approval detail, reviews warehouse/date/full line quantities,
 * posts the receipt, and checks that the goods-receipt register no longer
 * advertises unsupported partial receiving or QC controls.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.PURCHASING_RECEIVING_E2E_PORT || '4326';
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`[console.error] ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));

  try {
    await page.addInitScript(() => {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      localStorage.setItem('aria-demo-auth', JSON.stringify({
        signedIn: true,
        email: 'admin@acme.co',
        at: new Date(0).toISOString(),
      }));
    });
    await page.goto(`${BASE_URL}/?task221-e2e=${viewport.width}#po-approvals`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.locator('#viewRoot[data-screen-route="po-approvals"]').waitFor({ state: 'visible', timeout: TIMEOUT });
    const pendingRow = page.locator('[data-list-table] [data-row]').first();
    await pendingRow.waitFor({ state: 'visible', timeout: TIMEOUT });
    const pendingRowText = await pendingRow.innerText();
    assert(/Pending/i.test(pendingRowText), 'seeded pending purchase order was not loaded');

    await pendingRow.click();
    await page.locator('[data-po-approve]').waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.locator('[data-po-approve]').click();
    await page.locator('#poApprovalNote').fill('Approved for full receipt workflow verification.');
    await page.locator('[data-po-decision-confirm]').click();
    await page.locator('[data-po-receive]').waitFor({ state: 'visible', timeout: TIMEOUT });
    const approvalText = await page.locator('#viewRoot').innerText();
    assert(approvalText.includes('Receive goods'), 'approved PO detail does not expose the receive action');

    await page.locator('[data-po-receive]').click();
    await page.locator('[data-po-receive-warehouse]').waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.locator('[data-po-receive-date]').waitFor({ state: 'visible', timeout: TIMEOUT });
    const review = await page.evaluate(() => ({
      warehouseOptions: document.querySelectorAll('[data-po-receive-warehouse] option').length,
      date: document.querySelector('[data-po-receive-date]')?.value || '',
      quantityInputs: document.querySelectorAll('[data-po-receive-confirm] ~ input[type="number"], [data-po-receive-confirm] input[type="number"]').length,
      modalText: document.querySelector('#modalEl')?.innerText || '',
    }));
    assert(review.warehouseOptions > 0, 'receive modal does not expose a warehouse choice');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(review.date), 'receive modal does not expose a valid reviewable date');
    assert(review.quantityInputs === 0, 'receive modal exposes an unsupported editable partial quantity input');
    assert(/full purchase-order quantities|kuantiti penuh|完整数量|全数量|toàn bộ số lượng/i.test(review.modalText),
      'receive modal does not explain that the current contract posts full quantities');

    await page.locator('[data-po-receive-confirm]').click();
    await page.locator('[data-po-receive-confirm]').waitFor({ state: 'detached', timeout: TIMEOUT });
    await page.waitForFunction(
      () => document.querySelectorAll('[data-po-receive]').length === 0,
      null,
      { timeout: TIMEOUT },
    );
    await page.locator('[data-canonical-po-approval]').waitFor({ state: 'visible', timeout: TIMEOUT });
    assert(await page.locator('[data-po-receive]').count() === 0, 'receive action remains after full receipt is posted');

    await page.evaluate(() => window.navigate('goods-receipts'));
    await page.locator('[data-list-table]').waitFor({ state: 'visible', timeout: TIMEOUT });
    const registerText = await page.locator('[data-list-filters], [data-list-kpis], [data-list-table]').allTextContents();
    const registerContent = registerText.join(' ');
    assert(!/Pending QC|Open inspection|Partially received|Partial receiving/i.test(registerContent),
      'goods-receipt register still advertises unsupported partial/QC controls');

    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    if (viewport.width <= 980) {
      assert(layout.scrollWidth <= layout.documentWidth + 1,
        `mobile horizontal overflow ${layout.scrollWidth}>${layout.documentWidth}`);
    }
    assert(browserErrors.length === 0, browserErrors.join('; '));
    console.log(`PASS purchasing receiving: ${viewport.width}px approval → review → full receipt → register`);
  } finally {
    await context.close();
  }
}

async function main() {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  try {
    await runViewport(browser, { width: 1280, height: 900 });
    await runViewport(browser, { width: 375, height: 812 });
  } finally {
    await browser.close();
    preview.kill();
  }
  console.log('Purchasing receiving E2E passed: desktop and mobile full-receipt workflow.');
}

main().catch((error) => {
  console.error(`FAIL purchasing receiving E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
