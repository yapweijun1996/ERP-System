#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'web', 'dist');
const DIST_SW = path.join(DIST, 'sw.js');
const DIST_PWA = path.join(DIST, 'assets', 'pwa.js');

if (!existsSync(DIST_SW) || !existsSync(DIST_PWA)) {
  console.error('PWA audit requires a current Demo build. Run "npm run build:demo" first.');
  process.exit(1);
}

const baseWorkerSource = await readFile(DIST_SW, 'utf8');
const versionMatch = baseWorkerSource.match(/const CACHE_VERSION = '([^']+)'/);
if (!versionMatch) throw new Error('Unable to read CACHE_VERSION from web/dist/sw.js');

const fixtureHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>PWA update audit</title></head>
<body><main id="fixture">PWA update audit</main>
<script src="/assets/pwa.js?v=20260729-update-state-v1"></script></body></html>`;

let servedWorkerSource = withVersion(`${versionMatch[1]}-audit-a`);

function withVersion(version) {
  return baseWorkerSource
    .replace(/const CACHE_VERSION = '[^']+';/, `const CACHE_VERSION = '${version}';`)
    .replace(/const staticUrls = \[[\s\S]*?\];/, "const staticUrls = ['./', './index.html', './assets/pwa.js'];")
    .replace('await precacheBundledRuntime(cache);', '/* The lifecycle audit uses a minimal shell; full offline precache is covered by smoke. */');
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  return ({
    '.css': 'text/css; charset=utf-8',
    '.data': 'application/octet-stream',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.wasm': 'application/wasm',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
  })[ext] || 'application/octet-stream';
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(fixtureHtml);
      return;
    }
    if (url.pathname === '/sw.js') {
      response.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store, must-revalidate',
        'Service-Worker-Allowed': '/',
      });
      response.end(servedWorkerSource);
      return;
    }

    const requestedPath = path.resolve(DIST, `.${decodeURIComponent(url.pathname)}`);
    if (!requestedPath.startsWith(`${DIST}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const bytes = await readFile(requestedPath);
    response.writeHead(200, {
      'Content-Type': contentType(requestedPath),
      'Cache-Control': 'no-store',
    });
    response.end(bytes);
  } catch (error) {
    response.writeHead(error?.code === 'ENOENT' ? 404 : 500).end('Unavailable');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
if (!address || typeof address === 'string') throw new Error('PWA audit server did not bind a TCP port');
const baseUrl = `http://127.0.0.1:${address.port}`;

let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`[console] ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`[page] ${error.message}`));

  console.log('Installing the baseline service worker...');
  await page.goto(`${baseUrl}/?source=legacy-marker#dashboard`, { waitUntil: 'load' });
  await page.evaluate(async () => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil:'load' });
  }
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout:15000 });
  await page.waitForFunction(() => !location.search.includes('source='));
  if (await page.locator('#pwaToast.show').count()) {
    throw new Error('Initial service-worker install incorrectly displayed an update prompt');
  }

  const versionB = `${versionMatch[1]}-audit-b`;
  console.log(`Deferring ${versionB}...`);
  servedWorkerSource = withVersion(versionB);
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await page.waitForSelector('#pwaToast.show [data-pwa-primary]', { state:'visible', timeout:15000 });
  const firstPromptCount = await page.locator('#pwaToast.show').count();
  if (firstPromptCount !== 1) throw new Error(`Expected one update prompt, found ${firstPromptCount}`);

  await page.locator('#pwaToast [data-pwa-secondary]').click();
  await page.waitForSelector('#pwaToast.show', { state:'hidden' });
  await page.reload({ waitUntil:'load' });
  await page.waitForTimeout(1800);
  if (await page.locator('#pwaToast.show').count()) {
    throw new Error('The same deferred worker version prompted again after reload');
  }

  const versionC = `${versionMatch[1]}-audit-c`;
  console.log(`Applying ${versionC}...`);
  servedWorkerSource = withVersion(versionC);
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await page.waitForSelector('#pwaToast.show [data-pwa-primary]', { state:'visible', timeout:15000 });

  await Promise.all([
    page.waitForNavigation({ waitUntil:'load', timeout:15000 }),
    page.locator('#pwaToast [data-pwa-primary]').click(),
  ]);
  await page.waitForFunction(() => !document.querySelector('#pwaToast.show'));

  const finalState = await page.evaluate(async () => {
    const version = await new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 3000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data?.version || null);
      };
      navigator.serviceWorker.controller?.postMessage({ type:'GET_VERSION' }, [channel.port2]);
    });
    return {
      version,
      legacyFingerprint: localStorage.getItem('erp-system-source-fingerprint'),
      dismissedVersion: sessionStorage.getItem('erp-system-dismissed-pwa-update'),
      sourceMarker: new URL(location.href).searchParams.get('source'),
    };
  });

  if (finalState.version !== versionC) {
    throw new Error(`Expected active worker ${versionC}, got ${finalState.version || 'none'}`);
  }
  if (finalState.legacyFingerprint || finalState.dismissedVersion || finalState.sourceMarker) {
    throw new Error(`Update cleanup is incomplete: ${JSON.stringify(finalState)}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));

  await context.close();
  console.log(`PWA update audit PASSED ✅ (${versionB} deferred once; ${versionC} activated once)`);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
