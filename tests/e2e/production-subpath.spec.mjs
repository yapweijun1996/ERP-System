#!/usr/bin/env node
/*
 * API deployment subpath contract. The public Cloudflare route retains /erp,
 * while nginx rewrites it once before handling root API/static locations.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DIST = path.join(ROOT, 'web', 'dist');
const DIST_INDEX = path.join(DIST, 'index.html');

if (!existsSync(DIST_INDEX)) {
  console.error('web/dist/index.html not found. Run "npm run build" with ERP_PUBLIC_URL first.');
  process.exit(1);
}

function contentType(filePath) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.woff2': 'font/woff2',
  })[path.extname(filePath)] || 'application/octet-stream';
}

function sendJson(response, body, statusCode = 200) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-ERP-Subpath-Fixture': 'network',
  });
  response.end(JSON.stringify(body));
}

function safeStaticPath(pathname) {
  const relativePath = pathname === '/erp/' ? 'index.html' : pathname.slice('/erp/'.length);
  const resolved = path.resolve(DIST, relativePath);
  return resolved.startsWith(`${DIST}${path.sep}`) ? resolved : null;
}

const apiRequests = [];
const rootApiRequests = [];
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/erp') {
      response.writeHead(308, { location: '/erp/' });
      response.end();
      return;
    }
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      rootApiRequests.push(url.pathname);
      response.writeHead(404).end('Unexpected root API request');
      return;
    }
    if (url.pathname === '/erp/health') {
      apiRequests.push(url.pathname);
      sendJson(response, { status: 'ok', service: 'erp-system-api' });
      return;
    }
    if (url.pathname.startsWith('/erp/api/')) {
      apiRequests.push(url.pathname);
      if (url.pathname === '/erp/api/auth/session') {
        response.writeHead(204, { 'Cache-Control': 'no-store' });
        response.end();
        return;
      }
      if (url.pathname === '/erp/api/setup/status') {
        sendJson(response, { initialized: true, status: 'ready' });
        return;
      }
      sendJson(response, { error: { code: 'not_found' } }, 404);
      return;
    }
    if (!url.pathname.startsWith('/erp/')) {
      response.writeHead(404).end('Unknown mount');
      return;
    }

    const filePath = safeStaticPath(url.pathname);
    if (!filePath) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const contents = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentType(filePath) });
    response.end(contents);
  } catch (error) {
    response.writeHead(error?.code === 'ENOENT' ? 404 : 500).end('Unavailable');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Subpath fixture did not bind a TCP port');
const origin = `http://127.0.0.1:${address.port}`;

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`[page] ${error.message}`));

  await page.goto(`${origin}/erp`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.ErpSystemDataReady), null, { timeout: 15000 });
  const serviceWorkerScope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return new URL(registration.scope).pathname;
  });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 });
  const clientState = await page.evaluate(async () => {
    await window.ErpSystemDataReady;
    await window.ErpSystemData.session();
    const staleResponse = new Response(JSON.stringify({ initialized: false }), {
      headers: { 'Content-Type': 'application/json', 'X-ERP-Subpath-Fixture': 'cache' },
    });
    await (await caches.open('production-subpath-e2e')).put(
      `${window.__ERP_API_BASE__}/setup/status`,
      staleResponse,
    );
    const setupStatus = await fetch(`${window.__ERP_API_BASE__}/setup/status`, { cache: 'no-store' });
    if (!setupStatus.ok) throw new Error(`setup/status returned ${setupStatus.status}`);
    return {
      apiBase: window.__ERP_API_BASE__,
      pathname: window.location.pathname,
      setupFixture: setupStatus.headers.get('X-ERP-Subpath-Fixture'),
    };
  });

  if (clientState.apiBase !== '/erp/api'
    || clientState.pathname !== '/erp/'
    || serviceWorkerScope !== '/erp/'
    || clientState.setupFixture !== 'network') {
    throw new Error(`Subpath client or service-worker configuration regressed: ${JSON.stringify({ clientState, serviceWorkerScope })}`);
  }
  for (const expectedPath of ['/erp/health', '/erp/api/auth/session', '/erp/api/setup/status']) {
    if (apiRequests.includes(expectedPath)) continue;
    throw new Error(`Expected subpath API requests were not observed: ${JSON.stringify(apiRequests)}`);
  }
  if (rootApiRequests.length) {
    throw new Error(`Browser bypassed the public mount for API traffic: ${JSON.stringify(rootApiRequests)}`);
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join('\n')}`);
  console.log('PASS production subpath E2E: /erp static shell and API paths stay mounted');
  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
