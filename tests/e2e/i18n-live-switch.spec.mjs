#!/usr/bin/env node
/*
 * Live locale-switch E2E contract.
 *
 * This runs only against the built Demo PGlite app. It verifies that changing
 * language refreshes the active route in place, updates the dynamic shell and
 * retains a route-local filter without a full page navigation.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.I18N_LIVE_E2E_PORT || '4317';
const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = 60000;
const LOCALES = {
  en: 'en-SG',
  ms: 'ms-MY',
  zh: 'zh-Hans',
  ja: 'ja-JP',
  vi: 'vi-VN',
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

async function main() {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { label: 'desktop', width: 1280, height: 900 },
    { label: 'mobile', width: 375, height: 812 },
  ];

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const browserErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') browserErrors.push(`[console.error] ${message.text()}`);
      });
      page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));
      const assert = (condition, message) => {
        if (!condition) throw new Error(`${viewport.label}: ${message}`);
      };

      try {
        await page.addInitScript(() => {
          localStorage.setItem('aria-setup-wizard-complete', '1');
          localStorage.setItem('aria-lang', 'en');
          localStorage.setItem('aria-demo-auth', JSON.stringify({
            signedIn: true,
            email: 'admin@acme.co',
            at: new Date(0).toISOString(),
          }));
        });
        await page.goto(`${BASE_URL}/?i18n-live-e2e=${viewport.label}-${Date.now()}#dashboard`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await page.waitForFunction(() => window.ErpSystemData && window.navigate, { timeout: TIMEOUT });
        await page.locator('#viewRoot[data-screen-route="dashboard"] h1').waitFor({ state: 'visible', timeout: TIMEOUT });

        const navigationType = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.type);
        assert(navigationType === 'navigate', `expected an initial normal navigation, got ${navigationType}`);

        const switchLanguage = async (language) => {
          await page.locator('#langBtn').click();
          await page.locator(`#langMenu [data-lang="${language}"]`).click();
          await page.waitForFunction(({ code, locale }) => {
            const heading = document.querySelector('#viewRoot[data-screen-route="dashboard"] h1');
            return window.getLang() === code
              && document.documentElement.lang === locale
              && heading
              && heading.textContent.includes(window.t('dash.greeting'));
          }, { code: language, locale: LOCALES[language] }, { timeout: TIMEOUT });
          const currentNavigationType = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.type);
          assert(currentNavigationType === 'navigate', `language switch to ${language} reloaded the document`);
        };

        for (const language of ['ms', 'zh', 'ja', 'vi', 'en']) await switchLanguage(language);

        await page.evaluate(() => window.navigate('po-approvals'));
        await page.locator('[data-list-filter="pending"]').waitFor({ state: 'visible', timeout: TIMEOUT });
        await page.locator('[data-list-filter="pending"]').click();
        assert(await page.locator('[data-list-filter="pending"].on').count() === 1,
          'the pending purchase-order filter should be active before the second locale switch');

        await page.evaluate(() => {
          window.__i18nLiveRenderCount = 0;
          window.__i18nLiveRenderObserver?.disconnect();
          const root = document.querySelector('#viewRoot');
          window.__i18nLiveRenderObserver = new MutationObserver(() => {
            window.__i18nLiveRenderCount += 1;
          });
          window.__i18nLiveRenderObserver.observe(root, { childList: true });
        });
        await page.locator('#langBtn').click();
        await page.locator('#langMenu [data-lang="ms"]').click();
        await page.waitForFunction(() => {
          const heading = document.querySelector('#viewRoot h1');
          const pending = document.querySelector('[data-list-filter="pending"].on');
          return window.getLang() === 'ms'
            && window.__i18nLiveRenderCount > 0
            && heading
            && document.querySelector('#viewRoot[data-screen-route="po-approvals"]')
            && pending;
        }, { timeout: TIMEOUT });
        assert(await page.evaluate(() => window.location.hash) === '#po-approvals',
          'locale switch must keep the active route hash');

        await page.evaluate(() => window.navigate('new-purchase-order'));
        await page.locator('#wDate').waitFor({ state: 'visible', timeout: TIMEOUT });
        await page.locator('#wDate').fill('2026-01-15');
        await page.locator('#wSup').selectOption({ index: 1 });
        await page.locator('#wDate').focus();
        const draftState = await page.evaluate(() => ({
          date: document.querySelector('#wDate')?.value,
          supplier: document.querySelector('#wSup')?.value,
        }));
        await page.evaluate(() => {
          window.__i18nLiveRenderCount = 0;
          window.__i18nLiveRenderObserver?.disconnect();
          const root = document.querySelector('#viewRoot');
          window.__i18nLiveRenderObserver = new MutationObserver(() => {
            window.__i18nLiveRenderCount += 1;
          });
          window.__i18nLiveRenderObserver.observe(root, { childList: true });
        });
        await page.locator('#langBtn').click();
        await page.locator('#langMenu [data-lang="zh"]').click();
        await page.waitForFunction(({ date, supplier }) => {
          const root = document.querySelector('#viewRoot[data-screen-route="new-purchase-order"]');
          return window.getLang() === 'zh'
            && window.__i18nLiveRenderCount > 0
            && root
            && document.querySelector('#wDate')?.value === date
            && document.querySelector('#wSup')?.value === supplier
            && document.activeElement?.id === 'wDate';
        }, draftState, { timeout: TIMEOUT });
        assert(browserErrors.length === 0, `browser errors detected:\n${browserErrors.join('\n')}`);
        console.log(`PASS live i18n E2E: ${viewport.label}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    preview.kill();
  }
}

main().catch((error) => {
  console.error(`FAIL live i18n E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
