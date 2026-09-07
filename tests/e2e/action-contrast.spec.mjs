#!/usr/bin/env node
/*
 * Filled-action contrast contract.
 *
 * The audit covers the shared primary action and the PWA install action in
 * both themes at desktop and phone widths. It measures stable normal/hover
 * states, checks the shared focus ring, and verifies disabled treatment.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.ACTION_CONTRAST_E2E_PORT || '4325';
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

function parseColor(value) {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) throw new Error(`Unsupported computed color: ${value}`);
  return match[1].split(',').map((part) => Number.parseFloat(part.trim())).slice(0, 3);
}

function linearChannel(value) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(value) {
  const [red, green, blue] = parseColor(value);
  return 0.2126 * linearChannel(red)
    + 0.7152 * linearChannel(green)
    + 0.0722 * linearChannel(blue);
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

async function measure(page, selector, label) {
  const locator = page.locator(selector);
  const read = () => locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      background: style.backgroundColor,
      opacity: style.opacity,
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      cursor: style.cursor,
    };
  });

  const normal = await read();
  await locator.hover();
  await page.waitForTimeout(250);
  const hover = await read();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(250);
  await locator.focus();
  await page.waitForTimeout(250);
  const focus = await read();
  await locator.evaluate((element) => { element.disabled = true; });
  await page.waitForTimeout(250);
  const disabled = await read();
  await locator.evaluate((element) => { element.disabled = false; });
  return { label, normal, hover, focus, disabled };
}

async function main() {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { label: 'desktop', width: 1280, height: 900 },
    { label: 'mobile', width: 375, height: 812 },
  ];
  const failures = [];

  try {
    for (const viewport of viewports) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
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
          await page.goto(`${BASE_URL}/?action-contrast-e2e=${theme}-${viewport.label}#dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await page.locator('.dashgrid').first().waitFor({ state: 'visible', timeout: TIMEOUT });
          await page.evaluate((selectedTheme) => {
            document.documentElement.dataset.theme = selectedTheme;
            document.documentElement.style.colorScheme = selectedTheme;
            const fixture = document.createElement('button');
            fixture.id = 'contrast-primary';
            fixture.className = 'btn primary';
            fixture.type = 'button';
            fixture.textContent = 'Primary action';
            fixture.style.position = 'fixed';
            fixture.style.left = '12px';
            fixture.style.top = '12px';
            fixture.style.zIndex = '999';
            document.body.append(fixture);
            const promptEvent = new Event('beforeinstallprompt', { cancelable: true });
            Object.defineProperty(promptEvent, 'prompt', { value: async () => {} });
            Object.defineProperty(promptEvent, 'userChoice', {
              value: Promise.resolve({ outcome: 'dismissed' }),
            });
            window.dispatchEvent(promptEvent);
          }, theme);
          await page.locator('#pwaToast.show [data-pwa-primary]').waitFor({ state: 'visible', timeout: 5000 });

          const tokens = await page.evaluate(() => ({
            accentText: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
            accentAction: getComputedStyle(document.documentElement).getPropertyValue('--accent-action').trim(),
            accentActionHover: getComputedStyle(document.documentElement)
              .getPropertyValue('--accent-action-hover').trim(),
          }));
          if (!tokens.accentAction || !tokens.accentActionHover || tokens.accentAction === tokens.accentText) {
            failures.push(`${theme}/${viewport.label}: action and text accent tokens are not distinct`);
          }

          const targets = [
            await measure(page, '#contrast-primary', 'btn.primary'),
            await measure(page, '#pwaToast [data-pwa-primary]', 'pwa-primary'),
          ];
          for (const target of targets) {
            for (const state of ['normal', 'hover']) {
              const ratio = contrastRatio(target[state].color, target[state].background);
              if (ratio < 4.5) {
                failures.push(`${theme}/${viewport.label}/${target.label}/${state}: contrast ${ratio.toFixed(3)}:1`);
              }
              console.log(`PASS action contrast: ${theme}/${viewport.label}/${target.label}/${state} ${ratio.toFixed(3)}:1`);
            }
            if (target.focus.outlineStyle === 'none' || Number.parseFloat(target.focus.outlineWidth) < 2) {
              failures.push(`${theme}/${viewport.label}/${target.label}/focus: visible outline missing`);
            }
            if (Number.parseFloat(target.disabled.opacity) > 0.5
                || target.disabled.cursor !== 'not-allowed') {
              failures.push(`${theme}/${viewport.label}/${target.label}/disabled: treatment drifted`);
            }
          }
          const layout = await page.evaluate(() => ({
            documentWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }));
          if (viewport.width <= 980 && layout.scrollWidth > layout.documentWidth + 1) {
            failures.push(`${theme}/${viewport.label}: horizontal overflow ${layout.scrollWidth}>${layout.documentWidth}`);
          }
          if (browserErrors.length) failures.push(`${theme}/${viewport.label}: ${browserErrors.join('; ')}`);
          console.log(`PASS action contrast states: ${theme}/${viewport.label}`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    preview.kill();
  }

  if (failures.length) {
    console.error(`FAIL action contrast E2E:\n${failures.join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log('Action contrast E2E passed: 2 themes × 2 viewports × normal/hover/focus/disabled.');
}

main().catch((error) => {
  console.error(`FAIL action contrast E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
