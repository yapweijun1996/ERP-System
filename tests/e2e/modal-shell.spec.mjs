#!/usr/bin/env node
/*
 * Shared modal shell contract.
 *
 * Verifies that standard and bespoke modal entry points use one non-scrolling
 * shell with a single scrollable body at mobile and desktop viewports.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.MODAL_SHELL_E2E_PORT || '4330';
const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = 60000;

if (!existsSync(DIST_INDEX)) {
  console.error('web/dist/index.html not found. Run "npm run build:demo" first.');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function bootRoute(page, route, label) {
  await page.addInitScript(() => {
    localStorage.setItem('aria-setup-wizard-complete', '1');
    localStorage.setItem('aria-demo-auth', JSON.stringify({
      signedIn: true,
      email: 'admin@acme.co',
      at: new Date(0).toISOString(),
    }));
  });
  await page.goto(`${BASE_URL}/?modal-shell-e2e=${label}-${Date.now()}#${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.locator(`#viewRoot[data-screen-route="${route}"]`).waitFor({ state: 'visible', timeout: TIMEOUT });
}

async function waitForModalOpen(page, selector = '#modalEl', edgeToEdge = false) {
  await page.locator(`${selector}.show`).waitFor({ state: 'visible', timeout: TIMEOUT });
  await page.waitForFunction(({ modalSelector, edgeToEdge: requireEdgeToEdge }) => {
    const modal = document.querySelector(modalSelector);
    if (!modal) return false;
    if (!requireEdgeToEdge) return true;
    const rect = modal.getBoundingClientRect();
    return Math.abs(rect.top) <= 1 && Math.abs(rect.left) <= 1;
  }, { modalSelector: selector, edgeToEdge }, { timeout: TIMEOUT });
}

async function modalMetrics(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('#modalEl');
    const head = modal?.querySelector('.modal-head');
    const body = modal?.querySelector('.modal-body');
    const foot = modal?.querySelector('.modal-foot');
    const rect = (element) => element?.getBoundingClientRect().toJSON() || null;
    const modalRect = rect(modal);
    return {
      modalRect,
      headRect: rect(head),
      bodyRect: rect(body),
      footRect: rect(foot),
      modalDisplay: modal ? getComputedStyle(modal).display : '',
      modalOverflow: modal ? getComputedStyle(modal).overflow : '',
      bodyOverflowY: body ? getComputedStyle(body).overflowY : '',
      bodyScrollHeight: body?.scrollHeight || 0,
      bodyClientHeight: body?.clientHeight || 0,
      footPosition: foot ? getComputedStyle(foot).position : '',
      labelledBy: modal?.getAttribute('aria-labelledby') || '',
      labelledByExists: Boolean(modal?.getAttribute('aria-labelledby')
        && document.getElementById(modal.getAttribute('aria-labelledby'))),
      mode: modal?.dataset.mobileMode || '',
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyLocked: document.body.classList.contains('modal-open'),
    };
  });
}

function assertShell(metrics, label, mobile) {
  const { modalRect, headRect, bodyRect, footRect } = metrics;
  assert(modalRect && headRect && bodyRect && footRect, `${label}: modal shell regions are incomplete`);
  assert(metrics.modalDisplay === 'grid', `${label}: modal is not using the shared grid shell`);
  assert(metrics.modalOverflow === 'hidden', `${label}: modal is a competing scroll container`);
  assert(metrics.bodyOverflowY === 'auto' || metrics.bodyOverflowY === 'scroll',
    `${label}: modal body does not own vertical scrolling`);
  assert(metrics.footPosition === 'static', `${label}: footer is not part of the fixed grid row`);
  assert(metrics.labelledBy && metrics.labelledByExists, `${label}: dialog has no stable accessible title`);
  assert(metrics.scrollWidth <= metrics.clientWidth + 1, `${label}: document has horizontal overflow`);
  assert(metrics.bodyLocked, `${label}: modal did not lock the background surface`);
  assert(headRect.top >= modalRect.top - 1 && footRect.bottom <= modalRect.bottom + 1,
    `${label}: modal chrome escapes the shell`);
  if (mobile) {
    assert(Math.abs(modalRect.left) <= 1 && Math.abs(modalRect.top) <= 1,
      `${label}: mobile modal is not edge-to-edge: ${JSON.stringify(modalRect)}`);
    assert(Math.abs(modalRect.width - metrics.viewportWidth) <= 1,
      `${label}: mobile modal width is not viewport width: ${JSON.stringify(modalRect)}`);
    assert(Math.abs(modalRect.height - metrics.viewportHeight) <= 1,
      `${label}: mobile modal height is not visual viewport height: ${JSON.stringify(modalRect)}`);
  } else {
    assert(modalRect.width <= metrics.viewportWidth + 1 && modalRect.height <= metrics.viewportHeight + 1,
      `${label}: desktop modal exceeds viewport: ${JSON.stringify(modalRect)}`);
  }
}

async function openUserPreview(page, mobile) {
  await bootRoute(page, 'user-mgmt', mobile ? 'user-mobile' : 'user-desktop');
  const row = page.locator('[data-list-table] [data-row]').first();
  await row.waitFor({ state: 'visible', timeout: TIMEOUT });
  await row.click();
  await waitForModalOpen(page, '#modalEl', mobile);
  const metrics = await modalMetrics(page);
  assertShell(metrics, `User Management ${mobile ? 'mobile' : 'desktop'}`, mobile);
  if (mobile) {
    const buttons = await page.locator('#modalEl .modal-foot .btn').evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }));
    assert(buttons.length > 0 && buttons.every((rect) => rect.width >= 44 && rect.height >= 44),
      `User Management mobile: footer touch targets are too small: ${JSON.stringify(buttons)}`);
  }
  await page.locator('#modalEl .modal-foot .btn').first().click();
  await page.locator('#modalEl').waitFor({ state: 'detached', timeout: TIMEOUT });
  assert(await page.evaluate(() => !document.body.classList.contains('modal-open')),
    'User Management: closing the modal did not unlock the background');
}

async function openKeyboardShortcuts(page) {
  await bootRoute(page, 'user-mgmt', 'shortcuts-mobile');
  await page.keyboard.press('?');
  await waitForModalOpen(page, '#modalEl.keyboard-shortcuts-modal', true);
  const initial = await modalMetrics(page);
  assertShell(initial, 'Keyboard shortcuts mobile', true);
  assert(initial.bodyScrollHeight > initial.bodyClientHeight,
    `Keyboard shortcuts mobile: long content did not create a scrollable body: ${JSON.stringify(initial)}`);
  const before = await page.evaluate(() => {
    const modal = document.querySelector('#modalEl');
    const head = modal.querySelector('.modal-head').getBoundingClientRect();
    const foot = modal.querySelector('.modal-foot').getBoundingClientRect();
    const body = modal.querySelector('.modal-body');
    body.scrollTop = Math.floor(body.scrollHeight / 2);
    return { headTop: head.top, footBottom: foot.bottom, scrollTop: body.scrollTop };
  });
  assert(before.scrollTop > 0, `Keyboard shortcuts mobile: body did not scroll to the middle: ${JSON.stringify(before)}`);
  const middle = await page.evaluate(() => {
    const modal = document.querySelector('#modalEl');
    const head = modal.querySelector('.modal-head').getBoundingClientRect();
    const foot = modal.querySelector('.modal-foot').getBoundingClientRect();
    const body = modal.querySelector('.modal-body');
    body.scrollTop = body.scrollHeight;
    return { headTop: head.top, footBottom: foot.bottom, scrollTop: body.scrollTop };
  });
  assert(Math.abs(middle.headTop - before.headTop) <= 1 && Math.abs(middle.footBottom - before.footBottom) <= 1,
    `Keyboard shortcuts mobile: header/footer moved while body scrolled: ${JSON.stringify({ before, middle })}`);
  await page.keyboard.press('Escape');
  await page.locator('#modalEl').waitFor({ state: 'detached', timeout: TIMEOUT });
}

async function openSalesEnquiry(page) {
  await bootRoute(page, 'enquiries', 'sales-mobile');
  await page.locator('[data-list-primary-action]').click();
  await waitForModalOpen(page, '#modalEl.sales-enquiry-modal', true);
  const metrics = await modalMetrics(page);
  assertShell(metrics, 'Sales enquiry mobile', true);
  const buttons = await page.locator('#modalEl .modal-foot .btn').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  assert(buttons.length === 3 && buttons.every((rect) => rect.width >= 44 && rect.height >= 44),
    `Sales enquiry mobile: footer touch targets are incorrect: ${JSON.stringify(buttons)}`);
  await page.locator('[data-enquiry-cancel]').click();
  await page.locator('#modalEl').waitFor({ state: 'detached', timeout: TIMEOUT });
}

async function runViewport(browser, viewport, mobile) {
  const context = await browser.newContext({
    viewport,
    hasTouch: mobile,
    isMobile: mobile,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`[console.error] ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));
  try {
    await openUserPreview(page, mobile);
    if (mobile) {
      await openKeyboardShortcuts(page);
      await openSalesEnquiry(page);
    }
    assert(browserErrors.length === 0, `${viewport.width}px modal shell browser errors: ${browserErrors.join(' | ')}`);
    console.log(`PASS modal shell: ${viewport.width}x${viewport.height} ${mobile ? 'mobile' : 'desktop'}`);
  } finally {
    await context.close();
  }
}

async function main() {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  try {
    await runViewport(browser, { width: 375, height: 812 }, true);
    await runViewport(browser, { width: 1280, height: 900 }, false);
  } finally {
    await browser.close();
    preview.kill();
  }
  console.log('Modal shell E2E passed: shared scroll ownership, mobile fullscreen, desktop sizing, special modals, touch targets and close paths.');
}

main().catch((error) => {
  console.error(`FAIL modal shell E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
