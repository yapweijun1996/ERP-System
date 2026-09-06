#!/usr/bin/env node
/*
 * First-run setup wizard layout contract.
 *
 * The wizard panel is vertically scrollable on touch layouts. Its decorative
 * header must not widen that scroll container and expose a horizontal swipe
 * area on iOS-sized viewports.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.SETUP_WIZARD_E2E_PORT || '4321';
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
  const viewports = [
    { label: 'desktop', width: 1280, height: 900 },
    { label: 'iPhone', width: 390, height: 844 },
    { label: 'small-mobile', width: 375, height: 812 },
  ];

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/?setup-wizard-e2e=${viewport.label}-${Date.now()}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await page.locator('#setupWizardView').waitFor({ state: 'visible', timeout: TIMEOUT });
        await page.locator('#wizLangSeg .wiz-language-card').first().waitFor({ state: 'visible', timeout: TIMEOUT });

        const layout = await page.evaluate(() => {
          const panel = document.querySelector('#setupWizardView .wizard-panel');
          const continueButton = document.querySelector('#wizNext');
          const cards = [...document.querySelectorAll('#wizLangSeg .wiz-language-card')];
          if (!panel || !continueButton) throw new Error('setup wizard language step did not render');
          panel.scrollLeft = 999;
          return {
            panelClientWidth: panel.clientWidth,
            panelScrollWidth: panel.scrollWidth,
            panelScrollLeft: panel.scrollLeft,
            panelOverflowX: getComputedStyle(panel).overflowX,
            cards: cards.length,
            continueVisible: Boolean(continueButton.offsetParent),
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
          };
        });

        if (viewport.width <= 980 && layout.panelScrollWidth > layout.panelClientWidth + 1) {
          throw new Error(`${viewport.label}: wizard panel horizontal overflow ${layout.panelScrollWidth}>${layout.panelClientWidth}`);
        }
        if (layout.documentScrollWidth > layout.documentClientWidth + 1) {
          throw new Error(`${viewport.label}: document horizontal overflow ${layout.documentScrollWidth}>${layout.documentClientWidth}`);
        }
        if (viewport.width <= 980 && layout.panelScrollLeft !== 0) {
          throw new Error(`${viewport.label}: wizard panel starts with horizontal scrollLeft ${layout.panelScrollLeft}`);
        }
        if (viewport.width > 980 && layout.panelOverflowX !== 'hidden') {
          throw new Error(`${viewport.label}: desktop wizard panel should clip decorative overflow`);
        }
        if (layout.cards !== 5 || !layout.continueVisible) {
          throw new Error(`${viewport.label}: language cards or Continue button regressed: ${JSON.stringify(layout)}`);
        }
        console.log(`PASS setup wizard layout E2E: ${viewport.label}`);
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
  console.error(`FAIL setup wizard layout E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
