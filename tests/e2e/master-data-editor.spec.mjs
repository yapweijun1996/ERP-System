#!/usr/bin/env node
/*
 * Master-data editor E2E contract.
 *
 * This deliberately uses the repository's direct Playwright style instead of
 * @playwright/test: the project already owns the preview lifecycle in its
 * smoke/audit scripts and the test must run against the built Demo PGlite app.
 * It never targets the production API or production PostgreSQL.
 *
 * Usage: npm run test:e2e:master-data
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.MASTER_DATA_E2E_PORT || '4312';
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

  async function waitFor(selector, options = {}) {
    return page.waitForSelector(selector, { timeout: TIMEOUT, state: 'visible', ...options });
  }

  async function visit(route, selector) {
    // The app intentionally owns hash navigation and does not reload for a
    // bare same-document hash assignment. A unique query makes each E2E visit
    // a fresh app boot while keeping the Demo PGlite database in the context.
    await page.goto(`${BASE_URL}/?master-data-e2e=${route}-${Date.now()}#${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await waitFor(selector);
  }

  async function openEditor(label, route, rowSelector, editSelector, minimumFields) {
    await visit(route, rowSelector);
    await page.locator(rowSelector).first().click();
    await waitFor(editSelector);
    await page.locator(editSelector).first().click();
    await waitFor('#modalEl [data-master-editor-input]');
    const shell = page.locator('#modalEl.master-data-editor-modal');
    assert(await shell.count() === 1, `${label}: standard three-section modal shell is missing`);
    const shellLayout = await shell.evaluate((modal) => {
      const body = modal.querySelector('.modal-body');
      const foot = modal.querySelector('.modal-foot');
      return {
        display: getComputedStyle(modal).display,
        overflow: getComputedStyle(modal).overflow,
        bodyOverflowY: body ? getComputedStyle(body).overflowY : '',
        footPosition: foot ? getComputedStyle(foot).position : '',
      };
    });
    assert(shellLayout.display === 'grid' && shellLayout.overflow === 'hidden',
      `${label}: modal shell is not using the fixed three-section grid`);
    assert(shellLayout.bodyOverflowY === 'auto' && shellLayout.footPosition === 'static',
      `${label}: modal content/footer scrolling contract is incorrect`);
    const count = await page.locator('#modalEl [data-master-editor-input]').count();
    assert(count >= minimumFields, `${label}: expected at least ${minimumFields} shared editor fields, got ${count}`);
    assert(await page.locator('#modalEl [data-master-editor-save]').count() === 1, `${label}: shared save action is missing`);
    assert(await page.locator('#modalEl [data-master-editor-cancel]').count() === 1, `${label}: shared cancel action is missing`);
    return count;
  }

  async function assertRequiredValidation(label) {
    const field = page.locator('#modalEl [data-master-editor-input]:not([readonly]):not([disabled])').first();
    const original = await field.inputValue();
    await field.fill('');
    await page.locator('#modalEl [data-master-editor-save]').click();
    const error = page.locator('#modalEl [data-master-editor-error]:not([hidden])').first();
    await error.waitFor({ state: 'visible', timeout: 10000 });
    assert((await error.textContent()).trim().length > 0, `${label}: required-field error is empty`);
    await field.fill(original);
  }

  async function closeEditor() {
    await page.locator('#modalEl [data-master-editor-cancel]').click();
    await page.waitForSelector('#modalEl', { state: 'detached', timeout: 5000 });
  }

  try {
    await page.addInitScript(() => {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      localStorage.setItem('aria-demo-auth', JSON.stringify({
        signedIn: true,
        email: 'admin@acme.co',
        at: new Date(0).toISOString(),
      }));
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(
      () => window.ErpSystemData && ['pglite', 'demo'].includes(window.ErpSystemData.mode),
      { timeout: TIMEOUT },
    );

    const lightThemeMeta = await page.evaluate(() => ({
      color: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
      statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content'),
      scheme: document.querySelector('meta[name="color-scheme"]')?.getAttribute('content'),
    }));
    assert(lightThemeMeta.color === '#F5F5F7' && lightThemeMeta.statusBar === 'default'
      && lightThemeMeta.scheme === 'light', 'theme: light PWA status-bar metadata is incorrect');
    await page.locator('#themeBtn').click();
    const darkThemeMeta = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      color: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
      statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content'),
      scheme: document.querySelector('meta[name="color-scheme"]')?.getAttribute('content'),
    }));
    assert(darkThemeMeta.theme === 'dark' && darkThemeMeta.color === '#000000'
      && darkThemeMeta.statusBar === 'black' && darkThemeMeta.scheme === 'dark',
    'theme: dark PWA status-bar metadata is incorrect');
    await page.locator('#themeBtn').click();

    // Employee: common shell, client validation, successful update, audit/history.
    await openEditor('employee', 'hr-directory', '[data-list-table] .dt-r[data-row]', '[data-employee-edit]', 11);
    const employeeNumber = page.locator('#modalEl [data-master-editor-input="employeeNo"]');
    assert(await employeeNumber.getAttribute('readonly') !== null,
      'employee: employee number must be read-only after creation');
    await assertRequiredValidation('employee');
    await page.locator('#modalEl [data-master-editor-save]').click();
    await page.waitForSelector('#modalEl', { state: 'detached', timeout: 10000 });
    await waitFor('[data-employee-change-history]');
    assert(await page.locator('[data-employee-change-history] .employee-history-entry').count() >= 1,
      'employee: successful save did not leave a change-history entry');

    // Customer: the CRM master uses the same editor and field-error contract.
    await visit('crm-pipeline', '.kcard[data-opp]');
    await page.locator('.kcard[data-opp]').first().click();
    await waitFor('[data-customer]');
    await page.locator('[data-customer]').first().click();
    await waitFor('[data-customer-edit]');
    await page.locator('[data-customer-edit]').click();
    await waitFor('#modalEl [data-master-editor-input]');
    assert(await page.locator('#modalEl [data-master-editor-input]').count() >= 3, 'customer: shared editor fields are incomplete');
    await assertRequiredValidation('customer');
    await closeEditor();

    // Supplier: the purchasing master also uses the same shell.
    await openEditor('supplier', 'suppliers', '[data-list-table] .dt-r[data-row]', '[data-supplier-edit]', 2);
    await assertRequiredValidation('supplier');
    await closeEditor();

    // Product: validate the shell, then force a stale version to prove the
    // server/domain concurrency error remains visible inside the shared modal.
    await openEditor('product', 'item-master', '[data-list-table] .dt-r[data-row]', '[data-edit]', 7);
    await assertRequiredValidation('product');
    const staleVersion = await page.evaluate(async () => {
      const rows = (await window.ErpSystemData.list('inventory/products')).data || [];
      const row = rows[0];
      if (!row) throw new Error('product: no canonical product is available for the concurrency test');
      await window.ErpSystemData.update('inventory/products', row.id, {
        name: `${row.name} — external edit`,
        category: row.category,
        uom: row.uom,
        reorderPoint: row.reorderPoint,
        reorderQty: row.reorderQty,
        standardCost: row.standardCost,
      }, row.version);
      return row.version;
    });
    assert(staleVersion != null, 'product: could not capture the stale version');
    await page.locator('#modalEl [data-master-editor-input]').first().fill('Stale editor update');
    await page.locator('#modalEl [data-master-editor-save]').click();
    const rootError = page.locator('#modalEl [data-master-editor-root-error]:not([hidden])');
    await rootError.waitFor({ state: 'visible', timeout: 10000 });
    assert(/concurrent|changed|version|refresh|stale/i.test((await rootError.textContent()).trim()),
      'product: stale-version error did not explain that the record changed');
    await closeEditor();

    assert(browserErrors.length === 0, `browser errors detected:\n${browserErrors.join('\n')}`);
    console.log('PASS master-data editor E2E: employee, customer, supplier, product, validation, history, concurrency');
  } finally {
    await context.close();
    await browser.close();
    preview.kill();
  }
}

main().catch((error) => {
  console.error(`FAIL master-data editor E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
