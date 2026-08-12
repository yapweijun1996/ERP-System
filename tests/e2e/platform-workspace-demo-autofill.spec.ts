/* TASK-187/TASK-192 platform demo quick-setup proof. The test owns an isolated
 * PGlite database and never connects to production. The build for this test is
 * explicitly compiled with VITE_PLATFORM_DEMO_AUTOFILL=true. */
import express from 'express';
import type { Server } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { createApp } from '../../src/api/app';
import { freshDb } from '../../src/test/helpers';
import type { DB } from '../../src/data/db';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIST = path.join(ROOT, 'web', 'dist');
const TIMEOUT = 60_000;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Demo autofill server has no TCP address.');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function closeDb(db: DB | undefined): Promise<void> {
  const client = (db as unknown as {
    $client?: { close?: () => Promise<void>; end?: () => Promise<void> };
  } | undefined)?.$client;
  if (client?.end) await client.end();
  else if (client?.close) await client.close();
}

async function waitFor(page: Page, selector: string): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible', timeout: TIMEOUT });
}

async function main(): Promise<void> {
  if (!existsSync(path.join(WEB_DIST, 'index.html'))) {
    throw new Error('web/dist/index.html not found. Run the demo-autofill build first.');
  }

  let db: DB | undefined;
  let server: Server | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const browserErrors: string[] = [];
  try {
    db = await freshDb();
    const host = express();
    host.use(express.static(WEB_DIST));
    host.use(createApp(db));
    const listening = await listen(host);
    server = listening.server;
    browser = await chromium.launch({ headless: true });

    // The same compiled bundle must be able to turn the feature off without a
    // rebuild, which protects a real-customer deployment from demo credentials.
    const offContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await offContext.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__ERP_PLATFORM_DEMO_AUTOFILL_OVERRIDE__ = false;
    });
    const offPage = await offContext.newPage();
    await offPage.goto(listening.baseUrl, { waitUntil: 'networkidle' });
    await waitFor(offPage, '#platformBootstrapForm');
    assert(await offPage.locator('#platformDemoBanner').count() === 0, 'demo banner rendered while autofill override was false');
    assert(await offPage.locator('#bootstrapPrincipalKey').inputValue() === '', 'bootstrap principal was filled while autofill was false');
    await offContext.close();

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error' && !/status of 401 \(Unauthorized\)/.test(message.text())) browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await page.goto(listening.baseUrl, { waitUntil: 'networkidle' });
    await waitFor(page, '#platformBootstrapForm');
    assert(await page.locator('#platformDemoBanner').isVisible(), 'demo banner is missing from bootstrap');
    assert(/1\s*Platform Superadmin/.test(await page.locator('.platform-step.current').innerText()), 'bootstrap stepper is not on step 1');
    assert(await page.locator('button[type="submit"]').innerText() === 'Next: Create Platform Superadmin', 'bootstrap button copy is incorrect');
    assert(await page.locator('#bootstrapPrincipalKey').inputValue() === 'platform-admin', 'bootstrap principal autofill is incorrect');
    assert(await page.locator('#bootstrapDisplayName').inputValue() === 'Platform Admin', 'bootstrap display-name autofill is incorrect');
    assert(await page.locator('#bootstrapEmail').inputValue() === 'platform-admin@acme.co', 'bootstrap email autofill is incorrect');
    assert(await page.locator('#bootstrapPassword').inputValue() === 'demo-platform-1234', 'bootstrap password autofill is incorrect');
    const bootstrapPassword = await page.locator('#bootstrapPassword').inputValue();
    assert(bootstrapPassword.length >= 12, 'bootstrap demo password does not satisfy the platform minimum');

    // A rerender must preserve a user edit instead of replacing it with demo data.
    await page.locator('#bootstrapDisplayName').fill('Edited Platform Admin');
    await page.evaluate(() => {
      const platform = (window as unknown as { ErpPlatformWorkspace?: { renderBootstrap?: () => void } }).ErpPlatformWorkspace;
      platform?.renderBootstrap?.();
    });
    assert(await page.locator('#bootstrapDisplayName').inputValue() === 'Edited Platform Admin', 'bootstrap user edit was lost on rerender');
    await page.locator('#bootstrapDisplayName').fill('Platform Admin');

    const dismiss = page.locator('#platformDemoBannerDismiss');
    await dismiss.click();
    assert(await page.locator('#platformDemoBanner').count() === 0, 'demo banner did not dismiss');
    await page.locator('#platformBootstrapForm button[type="submit"]').click();
    await waitFor(page, '#platformCreateMasterForm');

    assert(/2\s*Master/.test(await page.locator('.platform-step.current').innerText()), 'master stepper is not on step 2');
    assert(await page.locator('#provisionMasterName').inputValue() === 'Acme Group', 'master name autofill is incorrect');
    assert(await page.locator('#provisionMasterLoginCode').inputValue() === 'ACME', 'master login-code autofill is incorrect');
    assert(await page.locator('#platformCreateMasterAction').innerText() === 'Next: Create Master', 'master button copy is incorrect');
    assert(await page.locator('[data-provision-module]:checked').count() > 0, 'commercial module defaults were not checked');
    assert(await page.locator('[data-provision-module="expenses_tax"]').isChecked() === false, 'expenses_tax default unexpectedly enabled');

    await page.locator('#provisionMasterName').fill('Edited Acme Group');
    await page.evaluate(() => {
      const platform = (window as unknown as { ErpPlatformWorkspace?: { renderWorkspace?: () => void } }).ErpPlatformWorkspace;
      platform?.renderWorkspace?.();
    });
    await waitFor(page, '#platformCreateMasterForm');
    assert(await page.locator('#provisionMasterName').inputValue() === 'Edited Acme Group', 'master user edit was lost on rerender');
    await page.locator('#provisionMasterName').fill('Acme Group');

    let masterRequest: { url: string; key: string; body: unknown } | undefined;
    const masterRequestListener = (request: import('playwright').Request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/platform/masters')) {
        masterRequest = { url: request.url(), key: request.headers()['idempotency-key'] ?? '', body: request.postDataJSON() };
      }
    };
    page.on('request', masterRequestListener);
    await page.locator('#platformCreateMasterAction').click();
    await waitFor(page, '#platformCreateCompanyForm');
    page.off('request', masterRequestListener);
    assert(masterRequest?.key.startsWith('platform-master-') === true, 'master idempotency key is not stable client format');

    assert(/3\s*Company & administrators/.test(await page.locator('.platform-step.current').innerText()), 'company stepper is not on step 3');
    assert(await page.locator('#provisionCompanyName').inputValue() === 'Acme Singapore', 'company name autofill is incorrect');
    assert(await page.locator('#provisionCompanyCountry').inputValue() === 'SG', 'company country autofill is incorrect');
    assert(await page.locator('#provisionMasterAdminUsername').inputValue() === 'masteradmin', 'Master Admin username autofill is incorrect');
    assert(await page.locator('#provisionMasterAdminPassword').inputValue() === 'demo1234', 'Master Admin password autofill is incorrect');
    assert(await page.locator('#provisionCompanyOwnerUsername').inputValue() === 'owner', 'Company Owner username autofill is incorrect');
    assert(await page.locator('#provisionCompanyOwnerPassword').inputValue() === 'demo1234', 'Company Owner password autofill is incorrect');
    assert(await page.locator('#platformCreateCompanyAction').innerText() === 'Finish: Create Company', 'company button copy is incorrect');

    await page.locator('#provisionCompanyName').fill('Edited Acme Singapore');
    await page.evaluate(() => {
      const platform = (window as unknown as { ErpPlatformWorkspace?: { renderWorkspace?: () => void } }).ErpPlatformWorkspace;
      platform?.renderWorkspace?.();
    });
    await waitFor(page, '#platformCreateCompanyForm');
    assert(await page.locator('#provisionCompanyName').inputValue() === 'Edited Acme Singapore', 'company user edit was lost on rerender');
    await page.locator('#provisionCompanyName').fill('Acme Singapore');

    let companyRequest: { url: string; key: string; body: unknown } | undefined;
    const companyRequestListener = (request: import('playwright').Request) => {
      if (request.method() === 'POST' && /\/api\/platform\/masters\/[^/]+\/companies$/.test(request.url())) {
        companyRequest = { url: request.url(), key: request.headers()['idempotency-key'] ?? '', body: request.postDataJSON() };
      }
    };
    page.on('request', companyRequestListener);
    await page.locator('#platformCreateCompanyAction').click();
    await waitFor(page, '.platform-entitlement-grid');
    page.off('request', companyRequestListener);
    assert(companyRequest?.key.startsWith('platform-company-') === true, 'company idempotency key is not stable client format');

    // Replaying the exact captured mutations must return the existing result,
    // proving that the stable key is safe across a refresh/double click.
    const replay = await page.evaluate(async ({ url, key, body }) => {
      const csrf = document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith('erp_platform_csrf='))?.split('=').slice(1).join('=') ?? '';
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'idempotency-key': key, 'x-platform-csrf-token': decodeURIComponent(csrf) }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }, companyRequest as { url: string; key: string; body: unknown });
    assert(replay.status === 200 && replay.body?.meta?.idempotentReplay === true, 'company idempotency replay did not return the existing result');

    // A database that already has a Company must not inject sample values into
    // the subsequent “create another company” form.
    await page.reload({ waitUntil: 'networkidle' });
    await waitFor(page, '.platform-entitlement-grid');
    const companyForm = page.locator('#platformCreateCompanyForm');
    assert(await companyForm.count() === 1, 'existing-master company creation form disappeared');
    assert(await page.locator('#provisionCompanyName').inputValue() === '', 'existing Company caused demo data to overwrite a new form');
    assert(await page.locator('.platform-step.complete').count() === 3, 'completed provisioning stepper did not mark all steps complete');
    assert(browserErrors.length === 0, `platform demo autofill browser errors: ${browserErrors.join(' | ')}`);

    await context.close();
    console.log('PASS Platform workspace demo autofill E2E (isolated PGlite): flag off, bootstrap defaults, editable rerenders, Next flow, stable idempotency replay, and existing-company safety');
  } finally {
    await browser?.close();
    await closeServer(server);
    await closeDb(db);
  }
}

main().catch((error: unknown) => {
  console.error(`FAIL Platform workspace demo autofill E2E: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
