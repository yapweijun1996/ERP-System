#!/usr/bin/env node
/*
 * Login surface layout and accessibility contract.
 *
 * The auth shell must keep its long persona action inside the viewport and
 * remain reachable on short mobile viewports where the keyboard can reduce
 * the available visual height.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.LOGIN_LAYOUT_E2E_PORT || '4332';
const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = 60000;

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
  if (!existsSync(DIST_INDEX)) {
    console.error('web/dist/index.html not found. Run "npm run build:demo" first.');
    process.exit(1);
  }

  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { label: 'desktop', width: 1280, height: 800 },
    { label: 'iPhone', width: 390, height: 844 },
    { label: 'mobile', width: 375, height: 812 },
    { label: 'short-mobile', width: 375, height: 667 },
  ];

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
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
        await page.addInitScript(() => {
          localStorage.setItem('aria-setup-wizard-complete', '1');
          localStorage.removeItem('aria-demo-auth');
        });
        await page.goto(`${BASE_URL}/?login-layout-e2e=${viewport.label}-${Date.now()}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await page.locator('#loginForm').waitFor({ state: 'visible', timeout: TIMEOUT });
        await page.locator('#loginPassword').waitFor({ state: 'visible', timeout: TIMEOUT });
        await page.evaluate(() => {
          const copy = document.querySelector('#demoLoginBtn span:last-child');
          if (copy) copy.textContent = 'Continue as Avery Tan · Company Owner';
        });

        const layout = await page.evaluate(() => {
          const root = document.documentElement;
          const panel = document.querySelector('#authView .auth-panel');
          const auth = document.querySelector('#authView');
          const buttons = [...document.querySelectorAll('#loginForm > button')];
          const panelRect = panel?.getBoundingClientRect();
          return {
            clientWidth: root.clientWidth,
            documentWidth: root.scrollWidth,
            bodyOverflowY: getComputedStyle(document.body).overflowY,
            authHeight: auth?.getBoundingClientRect().height || 0,
            panel: panelRect ? {
              left: panelRect.left,
              right: panelRect.right,
              top: panelRect.top,
              bottom: panelRect.bottom,
            } : null,
            buttonsInsidePanel: buttons.every((button) => {
              const rect = button.getBoundingClientRect();
              return rect.left >= (panelRect?.left || 0) - 1 && rect.right <= (panelRect?.right || 0) + 1;
            }),
            buttonTextFits: buttons.every((button) => button.scrollWidth <= button.clientWidth + 1),
            labels: ['loginEmail', 'loginPassword'].map((id) => Boolean(document.querySelector(`label[for="${id}"]`))),
          };
        });
        assert(layout.documentWidth <= layout.clientWidth + 1,
          `${viewport.label}: login page horizontal overflow ${layout.documentWidth}>${layout.clientWidth}`);
        assert(layout.panel && layout.panel.left >= -1 && layout.panel.right <= layout.clientWidth + 1,
          `${viewport.label}: auth panel escapes the viewport: ${JSON.stringify(layout.panel)}`);
        assert(layout.buttonsInsidePanel, `${viewport.label}: login action extends outside the auth panel`);
        assert(layout.buttonTextFits, `${viewport.label}: long login action text is clipped inside its button`);
        assert(layout.bodyOverflowY === 'auto', `${viewport.label}: auth shell is not vertically scrollable when needed`);
        assert(layout.labels.every(Boolean), `${viewport.label}: login inputs are missing semantic labels`);

        const showPassword = page.getByRole('button', { name: 'Show password', exact: true });
        await showPassword.click();
        assert(await page.locator('#loginPassword').getAttribute('type') === 'text', `${viewport.label}: show password did not reveal input`);
        assert(await page.locator('#loginPasswordToggle').getAttribute('aria-pressed') === 'true', `${viewport.label}: show password state is not announced`);
        assert(await page.getByRole('button', { name: 'Hide password', exact: true }).count() === 1, `${viewport.label}: hide password label is missing`);
        await page.getByRole('button', { name: 'Hide password', exact: true }).click();
        assert(await page.locator('#loginPassword').getAttribute('type') === 'password', `${viewport.label}: hide password did not restore input`);

        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        assert((await page.locator('#loginError').textContent()).includes('account password'), `${viewport.label}: empty password feedback is missing`);
        assert(await page.evaluate(() => document.activeElement?.id) === 'loginPassword', `${viewport.label}: empty password feedback did not restore focus`);

        if (viewport.label === 'short-mobile') {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const footer = await page.locator('.auth-foot').boundingBox();
          assert(footer && footer.y + footer.height <= viewport.height + 1,
            `${viewport.label}: footer is not reachable after scrolling: ${JSON.stringify(footer)}`);
        }

        assert(browserErrors.length === 0, `${viewport.label}: browser errors: ${browserErrors.join(' | ')}`);
        console.log(`PASS login layout E2E: ${viewport.label}`);
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
  console.error(`FAIL login layout E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
