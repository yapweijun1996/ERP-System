/* TASK-183 authenticated API-mode browser proof. By default this starts an
   isolated PGlite-backed API. When TASK183_POSTGRES_URL is explicitly set, it
   instead requires an empty disposable PostgreSQL database before migrating it;
   neither path contacts production. */
import express from 'express';
import type { Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { and, eq } from 'drizzle-orm';
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator';
import { createApp } from '../../src/api/app';
import { createPgliteDb, createPostgresDb, type DB } from '../../src/data/db';
import { guardPostgresProofDatabase } from '../../src/data/postgresProofGuard';
import { seedDemo } from '../../src/data/seed';
import { appUser, companyModule, documentScanJob, masterModule } from '../../src/data/schema';
import { withTenantTransaction } from '../../src/data/tenantTransaction';
import { uploadReceiptDocument } from '../../src/modules/documents/upload';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIST = path.join(ROOT, 'web', 'dist');
const FLAT_SCHEMA = path.join(ROOT, 'web', 'public', 'db', 'erp-system-schema.sql');
const TIMEOUT = 60_000;
const POSTGRES_URL = process.env.TASK183_POSTGRES_URL ?? null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('API browser server has no TCP address.');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function close(server: Server | undefined): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function prepareEvidence(db: DB): Promise<number> {
  const scope = { masterFn: 'M1', companyFn: 'C-SG' };
  const [viewer] = await db.select().from(appUser).where(eq(appUser.email, 'viewer@acme.co')).limit(1);
  if (!viewer) throw new Error('Seeded viewer is unavailable.');
  await db.update(masterModule).set({ enabled: true }).where(and(
    eq(masterModule.masterFn, scope.masterFn),
    eq(masterModule.moduleKey, 'expenses_tax'),
  ));
  await db.update(companyModule).set({ enabled: true }).where(and(
    eq(companyModule.masterFn, scope.masterFn),
    eq(companyModule.companyFn, scope.companyFn),
    eq(companyModule.moduleKey, 'expenses_tax'),
  ));
  const uploaded = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
    clientDraftId: 'api_browser_receipt_0001',
    fileName: 'api-browser-receipt.png',
    declaredMimeType: 'image/png',
    content: Uint8Array.from(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2Nk+M/wHwAF/gL+DKJRlwAAAABJRU5ErkJggg==',
      'base64',
    )),
  });
  await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
    status: 'clean', scanner: 'api-browser-e2e', resultCode: 'clean', completedAt: new Date(),
  }).where(and(
    eq(documentScanJob.masterFn, scope.masterFn),
    eq(documentScanJob.companyFn, scope.companyFn),
    eq(documentScanJob.versionId, uploaded.version.id),
  )));
  return uploaded.version.id;
}

async function freshBrowserApiDb(): Promise<DB> {
  if (POSTGRES_URL) {
    await guardPostgresProofDatabase(POSTGRES_URL);
    const db = await createPostgresDb(POSTGRES_URL);
    await migratePostgres(db, { migrationsFolder: path.join(ROOT, 'drizzle') });
    return db;
  }
  /* Browser rendering is not a migration rehearsal. The generated flat schema
     is the current production shape and keeps this isolated end-to-end proof
     below the terminal timeout; migration/RLS evidence remains in API suites. */
  const db = await createPgliteDb();
  await (db as unknown as { $client: { exec(sql: string): Promise<void> } }).$client.exec(
    readFileSync(FLAT_SCHEMA, 'utf8'),
  );
  return db;
}

async function closeDb(db: DB | undefined): Promise<void> {
  const client = (db as unknown as {
    $client?: { close?: () => Promise<void>; end?: () => Promise<void> };
  } | undefined)?.$client;
  if (client?.end) await client.end();
  else if (client?.close) await client.close();
}

async function main(): Promise<void> {
  if (!existsSync(path.join(WEB_DIST, 'index.html'))) {
    throw new Error('web/dist/index.html not found. Run npm run build first.');
  }
  const pgConcurrencyWarnings: string[] = [];
  const capturePgConcurrencyWarning = (warning: Error) => {
    if (/Calling client\.query\(\) when the client is already executing a query/.test(warning.message)) {
      pgConcurrencyWarnings.push(warning.message);
    }
  };
  process.on('warning', capturePgConcurrencyWarning);
  let db: DB | undefined;
  let server: Server | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    db = await freshBrowserApiDb();
    await seedDemo(db);
    const evidenceVersionId = await prepareEvidence(db);
    const host = express();
    /* Static assets must precede the API app because createApp intentionally
       owns its 404 response; hash routing needs only this same-origin root. */
    host.use(express.static(WEB_DIST));
    host.use(createApp(db));
    const listening = await listen(host);
    server = listening.server;

    const browserErrors: string[] = [];
    const receiptPackResponses: string[] = [];
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      if (/status of 401 \(Unauthorized\)/.test(message.text())) {
        /* API-mode startup probes independent tenant and Platform realms
           before a user signs in. This is expected authentication state. */
        return;
      }
      browserErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.url().includes('/api/company-receipts/packs')) {
        receiptPackResponses.push(`${response.request().method()} ${response.status()} ${response.url()}`);
      }
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await page.goto(`${listening.baseUrl}/#dashboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    try {
      await page.locator('#platformAwareLoginForm').waitFor({ timeout: 15_000 });
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n`
        + `Page: ${await page.locator('body').innerText()}\n`
        + `Browser: ${browserErrors.join(' | ')}`);
    }
    await page.locator('#tenantOrganizationCode').fill('ACME');
    await page.locator('#tenantUsername').fill('viewer');
    await page.locator('#realmPassword').fill('viewer1234');
    const dashboard = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET'
        && response.status() === 200
        && url.pathname === '/api/dashboard';
    }, { timeout: TIMEOUT });
    await page.locator('#platformAwareLoginForm button[type="submit"]').click();
    await page.waitForFunction(() => typeof DB !== 'undefined'
      && DB.user && DB.user.email === 'viewer@acme.co'
      && window.ErpSystemData && window.ErpSystemData.mode === 'api', { timeout: TIMEOUT });
    await dashboard;
    // pg emits deprecations through the process warning event. Give that event
    // a turn before asserting so this reusable browser journey catches a future
    // same-client Promise.all regression before pg@9 turns it into an error.
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert(pgConcurrencyWarnings.length === 0,
      `Dashboard issued concurrent pg client queries: ${pgConcurrencyWarnings.join(' | ')}`);

    await page.evaluate(() => navigate('company-receipts'));
    await page.locator('[data-company-receipt-register="canonical"]').waitFor({ timeout: TIMEOUT });
    await page.locator('[data-company-receipt-confirm]').click();
    await page.locator(`[data-company-receipt-evidence="${evidenceVersionId}"]`).click();
    await page.locator('[data-company-receipt-confirm-form]').waitFor({ timeout: TIMEOUT });
    await page.locator('[data-receipt-confirm-date]').fill('2026-08-12');
    await page.locator('[data-receipt-confirm-merchant]').fill('API Browser Merchant');
    await page.locator('[data-receipt-confirm-number]').fill('API-BROWSER-1');
    await page.locator('[data-receipt-confirm-amount]').fill('31.2500');
    await page.locator('[data-receipt-confirm-currency]').fill('SGD');
    await page.locator('[data-receipt-confirm-purpose]').fill('Authenticated browser confirmation');
    await page.locator('[data-receipt-confirm-save]').click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.dt-body .dt-r'))
      .some((row) => row.textContent?.includes('API Browser Merchant')), { timeout: TIMEOUT });

    await page.locator('[data-receipt-search]').fill('API Browser Merchant');
    const searched = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET'
        && response.status() === 200
        && url.pathname === '/api/company-receipts'
        && url.searchParams.get('search') === 'API Browser Merchant';
    }, { timeout: TIMEOUT });
    await page.locator('[data-company-receipt-filters] button.primary').click();
    await searched;
    await page.waitForFunction(() => document.querySelector('.dt-body')?.textContent?.includes('API Browser Merchant'),
      { timeout: TIMEOUT });
    assert((await page.locator('.dt-body').innerText()).includes('API Browser Merchant'),
      'authenticated API browser search did not return the persisted receipt');
    await page.locator('[data-receipt-preset]').selectOption('custom');
    await page.locator('[data-receipt-from]').fill('2026-08-12');
    await page.locator('[data-receipt-to]').fill('2026-08-12');
    const ranged = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET'
        && response.status() === 200
        && url.pathname === '/api/company-receipts'
        && url.searchParams.get('dateFrom') === '2026-08-12'
        && url.searchParams.get('dateTo') === '2026-08-12';
    }, { timeout: TIMEOUT });
    await page.locator('[data-company-receipt-filters] button.primary').click();
    await ranged;
    await page.waitForFunction(() => document.querySelector('.dt-body')?.textContent?.includes('API Browser Merchant'),
      { timeout: TIMEOUT });

    const preview = page.waitForResponse((response) => response.url().includes('/api/company-receipts/packs/')
      && response.url().includes('action=view') && response.status() === 200, { timeout: TIMEOUT });
    await page.locator('[data-receipt-pack-preview]').click();
    try {
      await preview;
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n`
        + `Register: ${await page.locator('[data-company-receipt-register="canonical"]').innerText()}\n`
        + `Pack responses: ${receiptPackResponses.join(' | ')}\n`
        + `Browser: ${browserErrors.join(' | ')}`);
    }
    const previewFrame = page.locator('.company-receipt-pack-frame iframe');
    await previewFrame.waitFor({ state: 'attached', timeout: TIMEOUT });
    assert(await previewFrame.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0;
    }), 'authenticated API browser PDF preview did not occupy visible layout space');
    await page.locator('#modalEl .modal-foot button').click();
    const download = page.waitForResponse((response) => response.url().includes('/api/company-receipts/packs/')
      && response.url().includes('action=download') && response.status() === 200, { timeout: TIMEOUT });
    await page.locator('[data-receipt-pack-pdf]').click();
    await download;
    await page.evaluate(() => { window.open = () => ({}) as Window; });
    const print = page.waitForResponse((response) => response.url().includes('/api/company-receipts/packs/')
      && response.url().includes('action=print') && response.status() === 200, { timeout: TIMEOUT });
    await page.locator('[data-receipt-pack-print]').click();
    await print;

    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'authenticated API desktop page overflowed horizontally');
    await page.setViewportSize({ width: 375, height: 844 });
    await page.evaluate(() => navigate('company-receipts'));
    await page.locator('[data-company-receipt-register="canonical"]').waitFor({ timeout: TIMEOUT });
    assert(await page.locator('.dt-head').evaluate((node) => getComputedStyle(node).display) === 'none',
      'authenticated API mobile register did not render cards');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'authenticated API mobile page overflowed horizontally');
    assert(browserErrors.length === 0, `browser errors: ${browserErrors.join(' | ')}`);
    await context.close();
    console.log(`PASS Company Receipts API E2E (${POSTGRES_URL ? 'PostgreSQL' : 'PGlite'}): authenticated confirmation, refresh/search/range, Preview/PDF/Print and responsive bounds`);
  } finally {
    process.off('warning', capturePgConcurrencyWarning);
    await browser?.close();
    await close(server);
    await closeDb(db);
  }
}

main().catch((error: unknown) => {
  console.error(`FAIL Company Receipts API E2E: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
