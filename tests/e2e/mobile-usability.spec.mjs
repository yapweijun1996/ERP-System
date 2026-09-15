#!/usr/bin/env node
/*
 * TASK-222 mobile usability contract.
 *
 * The browser check covers the supported desktop/mobile layouts, translated
 * purchase-order workflow statuses, touch target sizing, modal focus/close
 * recovery and a half-width viewport as the repeatable browser equivalent of
 * a 200% reflow check. Physical-device evidence remains a separate release
 * activity.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.MOBILE_USABILITY_E2E_PORT || '4329';
const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = 60000;
const LOCALES = {
  en: { pending: 'Pending Approval', open: 'Open' },
  ms: { pending: 'Menunggu Kelulusan', open: 'Terbuka' },
  zh: { pending: '待审批', open: '待处理' },
  ja: { pending: '承認待ち', open: '開ける' },
  vi: { pending: 'Đang chờ phê duyệt', open: 'Mở' },
};

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

async function openApprovalDetail(page, language, viewportLabel) {
  await page.goto(`${BASE_URL}/?task222-e2e=${language}-${viewportLabel}-${Date.now()}#po-approvals`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.locator('#viewRoot[data-screen-route="po-approvals"]').waitFor({ state: 'visible', timeout: TIMEOUT });
  const pendingRow = page.locator('[data-list-table] [data-row]').first();
  await pendingRow.waitFor({ state: 'visible', timeout: TIMEOUT });
  await pendingRow.click();
  await page.locator('[data-canonical-po-approval]').waitFor({ state: 'visible', timeout: TIMEOUT });
}

async function runLocale(browser, language, expected, viewport) {
  const context = await browser.newContext({
    viewport,
    hasTouch: viewport.width <= 980,
    isMobile: viewport.width <= 980,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`[console.error] ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));

  try {
    await page.addInitScript((locale) => {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      localStorage.setItem('aria-lang', locale);
      localStorage.setItem('aria-demo-auth', JSON.stringify({
        signedIn: true,
        email: 'admin@acme.co',
        at: new Date(0).toISOString(),
      }));
    }, language);
    await openApprovalDetail(page, language, viewport.width);

    const statusFact = page.locator('.case-detail-fact').nth(3);
    const pendingStatus = await statusFact.innerText();
    assert(pendingStatus.includes(expected.pending), `${language}: pending workflow status is not localized`);
    assert(!pendingStatus.includes('pending_approval'), `${language}: raw pending_approval enum leaked into the UI`);

    const controls = await page.evaluate(() => {
      const visibleRects = (selector) => [...document.querySelectorAll(selector)]
        .filter((element) => element.getClientRects().length)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });
      const viewportMeta = document.querySelector('meta[name="viewport"]')?.content || '';
      return {
        viewportMeta,
        iconButtons: visibleRects('.topbar .iconbtn'),
        avatars: visibleRects('.topbar .avatar'),
        caseActions: visibleRects('[data-case-actions] .btn'),
        documentWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        detailRight: document.querySelector('.case-detail')?.getBoundingClientRect().right || 0,
      };
    });
    assert(!/user-scalable\s*=\s*no|maximum-scale\s*=|minimum-scale\s*=/.test(controls.viewportMeta),
      `${language}: viewport metadata still prevents user zoom`);
    assert(controls.documentScrollWidth <= controls.documentWidth + 1,
      `${language}: document overflows horizontally at ${viewport.width}px`);
    assert(controls.detailRight <= controls.documentWidth + 1,
      `${language}: case detail extends beyond the viewport`);
    if (viewport.width <= 980) {
      assert(controls.iconButtons.every((rect) => rect.width >= 44 && rect.height >= 44),
        `${language}: mobile top-bar icon target is smaller than 44px`);
      assert(controls.avatars.every((rect) => rect.width >= 44 && rect.height >= 44),
        `${language}: mobile avatar target is smaller than 44px`);
      await page.evaluate(() => window.navigate('po-approvals'));
      await page.locator('#viewRoot[data-screen-route="po-approvals"]').waitFor({ state: 'visible', timeout: TIMEOUT });
      const filterMetrics = await page.evaluate(() => ({
        chips: [...document.querySelectorAll('[data-list-filters] .chip')].filter((element) => element.getClientRects().length)
          .map((element) => element.getBoundingClientRect().height),
        rowMenu: document.querySelector('.transaction-row-menu')?.getBoundingClientRect().toJSON() || null,
        rowMenuOpacity: document.querySelector('.rowact') ? getComputedStyle(document.querySelector('.rowact')).opacity : '',
      }));
      assert(filterMetrics.chips.length > 0 && filterMetrics.chips.every((height) => height >= 44),
        `${language}: filter chip target is smaller than 44px`);
      assert(filterMetrics.rowMenu && filterMetrics.rowMenu.width >= 44 && filterMetrics.rowMenu.height >= 44,
        `${language}: row action target is smaller than 44px`);
      assert(filterMetrics.rowMenuOpacity !== '0', `${language}: row actions still rely on hover on mobile`);
      await page.locator('[data-list-table] [data-row]').first().click();
      await page.locator('[data-po-approve]').waitFor({ state: 'visible', timeout: TIMEOUT });
    } else {
      assert(controls.caseActions.every((rect) => rect.height >= 30),
        `${language}: desktop approval action unexpectedly collapsed`);
    }

    const approvalTrigger = page.locator('[data-po-approve]');
    await approvalTrigger.click();
    await page.locator('#modalEl').waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.waitForFunction(() => document.activeElement?.id === 'poApprovalNote', null, { timeout: TIMEOUT });
    const modalFocusLayout = await page.evaluate(() => {
      const modal = document.querySelector('#modalEl');
      const rect = modal?.getBoundingClientRect();
      return {
        focusedInside: Boolean(document.activeElement?.closest('#modalEl')),
        modalWithinViewport: Boolean(rect && rect.top >= 0 && rect.bottom <= innerHeight + 1),
        documentWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
      };
    });
    assert(modalFocusLayout.focusedInside, `${language}: modal focus did not enter the dialog`);
    assert(modalFocusLayout.modalWithinViewport, `${language}: focused modal is clipped by the viewport`);
    assert(modalFocusLayout.documentScrollWidth <= modalFocusLayout.documentWidth + 1,
      `${language}: modal focus introduced document overflow`);
    await page.keyboard.press('Tab');
    assert(await page.evaluate(() => Boolean(document.activeElement?.closest('#modalEl'))),
      `${language}: Tab moved focus behind the modal`);
    await page.keyboard.press('Escape');
    await page.locator('#modalEl').waitFor({ state: 'detached', timeout: TIMEOUT });
    await page.waitForFunction(() => document.activeElement?.matches('[data-po-approve]'), null, { timeout: TIMEOUT });

    await approvalTrigger.click();
    await page.locator('#poApprovalNote').fill(`TASK-222 ${language} focus verification`);
    await page.locator('[data-po-decision-confirm]').click();
    await page.locator('[data-po-receive]').waitFor({ state: 'visible', timeout: TIMEOUT });
    const openStatus = await page.locator('.case-detail-fact').nth(3).innerText();
    assert(openStatus.includes(expected.open), `${language}: open workflow status is not localized`);
    assert(!openStatus.includes('open'), `${language}: raw open enum leaked into the UI`);
    assert(browserErrors.length === 0, `${language}: browser errors detected: ${browserErrors.join(' | ')}`);
    console.log(`PASS mobile usability: ${language} ${viewport.width}px status, touch, zoom and modal focus`);
  } finally {
    await context.close();
  }
}

async function runHalfWidth(browser) {
  const context = await browser.newContext({ viewport: { width: 188, height: 812 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`[console.error] ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));
  try {
    await page.addInitScript(() => {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      localStorage.setItem('aria-demo-auth', JSON.stringify({ signedIn: true, email: 'admin@acme.co', at: new Date(0).toISOString() }));
    });
    await openApprovalDetail(page, 'en', 'half-width');
    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      route: document.querySelector('#viewRoot')?.dataset.screenRoute || '',
      detailRight: document.querySelector('.case-detail')?.getBoundingClientRect().right || 0,
    }));
    assert(layout.route === 'po-approval', 'half-width reflow did not render the approval detail route');
    assert(layout.scrollWidth <= layout.clientWidth + 1, `half-width reflow overflows ${layout.scrollWidth}>${layout.clientWidth}`);
    assert(layout.detailRight <= layout.clientWidth + 1, 'half-width case detail escapes the viewport');
    assert(browserErrors.length === 0, `half-width browser errors detected: ${browserErrors.join(' | ')}`);
    console.log('PASS mobile usability: 188px half-width reflow equivalent to 200% zoom');
  } finally {
    await context.close();
  }
}

async function runNarrowTopbarSearch(browser) {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`[console.error] ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));
  try {
    await page.addInitScript(() => {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      localStorage.setItem('aria-demo-auth', JSON.stringify({ signedIn: true, email: 'admin@acme.co', at: new Date(0).toISOString() }));
    });
    await openApprovalDetail(page, 'en', 'narrow-search');
    const metrics = await page.evaluate(() => {
      const topbar = document.querySelector('.topbar');
      const search = document.querySelector('#globalSearch');
      const icon = search?.querySelector('svg');
      const label = search?.querySelector('.search-label');
      if (!topbar || !search || !icon || !label) throw new Error('topbar search controls did not render');
      const topbarRect = topbar.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const topbarStyle = getComputedStyle(topbar);
      return {
        topbarWidth: topbarRect.width,
        topbarHeight: topbarRect.height,
        topbarClientWidth: topbar.clientWidth,
        topbarScrollWidth: topbar.scrollWidth,
        searchRect: searchRect.toJSON(),
        iconRect: iconRect.toJSON(),
        labelDisplay: getComputedStyle(label).display,
        searchLabel: search.getAttribute('aria-label') || '',
        nestedInput: Boolean(search.querySelector('input')),
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
      };
    });
    assert(metrics.searchRect.width >= 44 && metrics.searchRect.height >= 44,
      `narrow mobile: search trigger is smaller than the touch target: ${JSON.stringify(metrics)}`);
    assert(metrics.searchRect.left >= -1 && metrics.searchRect.right <= metrics.topbarWidth + 1,
      `narrow mobile: search trigger escaped the topbar: ${JSON.stringify(metrics)}`);
    assert(metrics.iconRect.width >= 18 && metrics.iconRect.height >= 18,
      `narrow mobile: search SVG icon is not visible: ${JSON.stringify(metrics)}`);
    assert(metrics.labelDisplay === 'none' && !metrics.nestedInput,
      `narrow mobile: persistent search field still occupies the topbar: ${JSON.stringify(metrics)}`);
    assert(metrics.searchLabel.includes('Search'),
      `narrow mobile: search trigger has no accessible label: ${JSON.stringify(metrics)}`);
    assert(metrics.topbarHeight <= 80,
      `narrow mobile: topbar became too tall: ${JSON.stringify(metrics)}`);
    assert(metrics.documentScrollWidth <= metrics.documentClientWidth + 1,
      `narrow mobile: document has horizontal overflow: ${JSON.stringify(metrics)}`);

    await page.locator('#globalSearch').click();
    await page.locator('#palette.show').waitFor({ state: 'visible', timeout: TIMEOUT });
    const paletteInput = await page.locator('#palInput').boundingBox();
    assert(paletteInput && paletteInput.width >= 100,
      `narrow mobile: opened search input is not usable: ${JSON.stringify(paletteInput)}`);
    await page.waitForFunction(() => document.activeElement?.id === 'palInput', null, { timeout: TIMEOUT });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const palette = document.querySelector('#palette');
      return palette?.getAttribute('aria-hidden') === 'true' && !palette.classList.contains('show');
    }, null, { timeout: TIMEOUT });
    assert(await page.evaluate(() => document.activeElement?.id === 'globalSearch'),
      'narrow mobile: closing search did not restore focus to its trigger');
    assert(browserErrors.length === 0, `narrow mobile browser errors detected: ${browserErrors.join(' | ')}`);
    console.log('PASS mobile usability: 320px compact SVG search trigger keeps the topbar thin and opens the command palette');
  } finally {
    await context.close();
  }
}

async function runMobileTableHorizontalScroll(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`[console.error] ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));
  try {
    await page.addInitScript(() => {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      localStorage.setItem('aria-demo-auth', JSON.stringify({ signedIn: true, email: 'admin@acme.co', at: new Date(0).toISOString() }));
    });
    await page.goto(`${BASE_URL}/?table-scroll-e2e=${Date.now()}#leave-approval`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.locator('#viewRoot[data-screen-route="leave-approval"]').waitFor({ state: 'visible', timeout: TIMEOUT });
    const tableScroll = page.locator('[data-horizontal-scroll]').first();
    await tableScroll.waitFor({ state: 'visible', timeout: TIMEOUT });
    const metrics = await tableScroll.evaluate((wrap) => {
      const table = wrap.querySelector('.dt');
      const list = wrap.closest('.master-detail-register-list');
      const documentRoot = document.documentElement;
      return {
        wrapClientWidth: wrap.clientWidth,
        wrapScrollWidth: wrap.scrollWidth,
        wrapOverflowX: getComputedStyle(wrap).overflowX,
        tableWidth: table?.getBoundingClientRect().width || 0,
        listClientWidth: list?.clientWidth || 0,
        listScrollWidth: list?.scrollWidth || 0,
        documentClientWidth: documentRoot.clientWidth,
        documentScrollWidth: documentRoot.scrollWidth,
      };
    });
    assert(metrics.wrapScrollWidth > metrics.wrapClientWidth + 1,
      `mobile table: dedicated wrapper has no horizontal overflow: ${JSON.stringify(metrics)}`);
    assert(metrics.tableWidth >= 760,
      `mobile table: SSOT table width collapsed: ${JSON.stringify(metrics)}`);
    assert(metrics.wrapOverflowX === 'auto' || metrics.wrapOverflowX === 'scroll',
      `mobile table: wrapper does not own horizontal scrolling: ${JSON.stringify(metrics)}`);
    assert(metrics.listScrollWidth <= metrics.listClientWidth + 1,
      `mobile table: parent list became a competing horizontal scroll host: ${JSON.stringify(metrics)}`);
    assert(metrics.documentScrollWidth <= metrics.documentClientWidth + 1,
      `mobile table: document has horizontal overflow: ${JSON.stringify(metrics)}`);

    const box = await tableScroll.boundingBox();
    assert(box, 'mobile table: scroll wrapper has no bounding box');
    const initial = await tableScroll.evaluate((wrap) => {
      wrap.scrollLeft = 0;
      return { scrollLeft: wrap.scrollLeft, firstCellLeft: wrap.querySelector('.dt-r .dt-c')?.getBoundingClientRect().left || 0 };
    });
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(30, box.height / 2));
    await page.mouse.wheel(240, 0);
    await page.waitForFunction(() => document.querySelector('[data-horizontal-scroll]')?.scrollLeft > 0, null, { timeout: TIMEOUT });
    const afterScroll = await tableScroll.evaluate((wrap) => ({
      scrollLeft: wrap.scrollLeft,
      firstCellLeft: wrap.querySelector('.dt-r .dt-c')?.getBoundingClientRect().left || 0,
    }));
    assert(afterScroll.scrollLeft > initial.scrollLeft,
      `mobile table: horizontal wheel did not move the dedicated wrapper: ${JSON.stringify({ initial, afterScroll, metrics })}`);
    assert(afterScroll.firstCellLeft < initial.firstCellLeft,
      `mobile table: row content did not move with wrapper scroll: ${JSON.stringify({ initial, afterScroll, metrics })}`);

    const touchClient = await context.newCDPSession(page);
    await tableScroll.evaluate((wrap) => { wrap.scrollLeft = 0; });
    const touchY = box.y + Math.min(24, box.height / 2);
    const touchStartX = box.x + box.width * 0.82;
    const touchEndX = box.x + box.width * 0.30;
    await touchClient.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x: touchStartX, y: touchY, radiusX: 8, radiusY: 8, force: 1 }],
    });
    for (let step = 1; step <= 8; step += 1) {
      await touchClient.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{
          id: 1,
          x: touchStartX + (touchEndX - touchStartX) * (step / 8),
          y: touchY,
          radiusX: 8,
          radiusY: 8,
          force: 1,
        }],
      });
    }
    await touchClient.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelector('[data-horizontal-scroll]')?.scrollLeft > 0, null, { timeout: TIMEOUT });
    const afterTouch = await tableScroll.evaluate((wrap) => ({
      scrollLeft: wrap.scrollLeft,
      firstCellLeft: wrap.querySelector('.dt-r .dt-c')?.getBoundingClientRect().left || 0,
    }));
    assert(afterTouch.scrollLeft > 0,
      `mobile table: touch swipe did not move the dedicated wrapper: ${JSON.stringify({ metrics, afterTouch })}`);
    assert(afterTouch.firstCellLeft < initial.firstCellLeft,
      `mobile table: touch swipe did not move row content: ${JSON.stringify({ initial, afterTouch, metrics })}`);
    assert(browserErrors.length === 0, `mobile table browser errors detected: ${browserErrors.join(' | ')}`);
    console.log('PASS mobile usability: 390px table rows scroll horizontally by wheel and touch inside the dedicated wrapper without page overflow');
  } finally {
    await context.close();
  }
}

async function main() {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [language, expected] of Object.entries(LOCALES)) {
      await runLocale(browser, language, expected, { width: 375, height: 812 });
    }
    await runLocale(browser, 'en', LOCALES.en, { width: 1280, height: 900 });
    await runNarrowTopbarSearch(browser);
    await runMobileTableHorizontalScroll(browser);
    await runHalfWidth(browser);
  } finally {
    await browser.close();
    preview.kill();
  }
  console.log('Mobile usability E2E passed: five locales, desktop/mobile touch targets, modal focus and half-width reflow.');
}

main().catch((error) => {
  console.error(`FAIL mobile usability E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
