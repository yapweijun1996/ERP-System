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
      if (message.type() === 'error' && !/status of (?:401 \(Unauthorized\)|409 \(Conflict\))/.test(message.text())) browserErrors.push(message.text());
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
    let companyMutationCount = 0;
    const companyRequestListener = (request: import('playwright').Request) => {
      if (request.method() === 'POST' && /\/api\/platform\/masters\/[^/]+\/companies$/.test(request.url())) {
        companyMutationCount += 1;
        companyRequest = { url: request.url(), key: request.headers()['idempotency-key'] ?? '', body: request.postDataJSON() };
      }
    };
    page.on('request', companyRequestListener);
    await page.locator('#platformCreateCompanyAction').click();
    await waitFor(page, '.platform-entitlement-grid');
    assert(companyMutationCount === 1, 'one Company submit triggered more than one mutation');
    assert(companyRequest?.key.startsWith('platform-company-') === true, 'company idempotency key is not stable client format');

    // Completed tenant control is opt-in: no subsequent Company form, action
    // bar or Demo credential is present until the operator explicitly opens it.
    assert(await page.locator('#platformCreateCompanyForm').count() === 0, 'completed tenant control rendered a Company form by default');
    assert(await page.locator('#platformProvisionActionbar').count() === 0, 'completed tenant control rendered a provisioning action bar by default');
    assert(await page.locator('#provisionCompanyOwnerPassword').count() === 0, 'next Company Demo credentials leaked into the closed control DOM');
    assert(await page.locator('#platformOpenCompanyCreate').getAttribute('aria-expanded') === 'false', 'Company opener did not announce its closed state');
    assert(await page.locator('#platformCompanyCreatedStatus').getAttribute('role') === 'status', 'Company success status was not announced');
    page.off('request', companyRequestListener);

    await page.locator('#platformOpenCompanyCreate').click();
    await waitFor(page, '#platformCreateCompanyForm');
    assert(await page.locator('#platformOpenCompanyCreate').getAttribute('aria-expanded') === 'true', 'Company opener did not announce its open state');
    assert(await page.locator('#platformCompanyCreateHeading').evaluate((node) => node === document.activeElement), 'Company create heading did not receive focus');
    assert(await page.locator('#provisionCompanyName').inputValue() === 'Acme Malaysia', 'second Company name autofill is incorrect');
    assert(await page.locator('#provisionCompanyCountry').inputValue() === 'MY', 'second Company country autofill is incorrect');
    assert(await page.locator('#provisionCompanyOwnerName').inputValue() === 'Malaysia Owner', 'second Company owner name autofill is incorrect');
    assert(await page.locator('#provisionCompanyOwnerUsername').inputValue() === 'myowner', 'second Company owner username autofill is incorrect');
    assert(await page.locator('#provisionCompanyOwnerEmail').inputValue() === 'myowner@acme.co', 'second Company owner email autofill is incorrect');
    assert(await page.locator('#provisionCompanyOwnerPassword').inputValue() === 'demo1234', 'second Company owner password autofill is incorrect');
    assert(await page.locator('#provisionMasterAdminName').count() === 0, 'existing Master Admin fields rendered for a later Company');

    // Cancel is mutation-free, preserves the scoped in-memory draft and returns
    // keyboard focus to the opener.
    await page.locator('#provisionCompanyName').fill('Edited Acme Malaysia');
    await page.locator('#platformCancelCompanyCreate').click();
    assert(companyMutationCount === 1, 'Cancel emitted a Company mutation');
    assert(await page.locator('#platformCreateCompanyForm').count() === 0, 'Cancel did not close the Company panel');
    await page.waitForFunction(() => document.activeElement?.id === 'platformOpenCompanyCreate');
    assert(await page.locator('#platformOpenCompanyCreate').evaluate((node) => node === document.activeElement), 'Cancel did not return focus to the Company opener');
    await page.locator('#platformOpenCompanyCreate').click();
    await waitFor(page, '#platformCreateCompanyForm');
    assert(await page.locator('#provisionCompanyName').inputValue() === 'Edited Acme Malaysia', 'Cancel did not preserve the edited Company draft');

    // Company drafts are scoped by Master and next ordinal. Switching to a
    // different Master must not carry the edited Malaysia draft across, and
    // returning must restore the edit for the original Master.
    const firstMasterFn = await page.locator('#platformMasterSelect').inputValue();
    const isolationMasterFn = await page.evaluate(async () => {
      const csrf = document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith('erp_platform_csrf='))?.split('=').slice(1).join('=') ?? '';
      const response = await fetch('/api/platform/masters', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'demo-draft-isolation-master', 'x-platform-csrf-token': decodeURIComponent(csrf) },
        body: JSON.stringify({ name: 'Draft Isolation Group', loginCode: 'DRAFTISO', modules: [] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? `Draft isolation Master failed (${response.status}).`);
      return body.data.masterFn as string;
    });
    await page.evaluate(() => {
      const platform = (window as unknown as { ErpPlatformWorkspace?: { renderWorkspace?: () => Promise<void> } }).ErpPlatformWorkspace;
      return platform?.renderWorkspace?.();
    });
    await page.locator('#platformMasterSelect').selectOption(isolationMasterFn);
    await waitFor(page, '#provisionMasterAdminName');
    assert(await page.locator('#provisionCompanyName').inputValue() === 'Acme Singapore', 'Company draft leaked into a different Master');
    await page.locator('#platformMasterSelect').selectOption(firstMasterFn);
    await page.locator('#provisionMasterAdminName').waitFor({ state: 'detached', timeout: TIMEOUT });
    assert(await page.locator('#platformCreateCompanyForm').count() === 0, 'Master switch left the optional Company panel open');
    await page.locator('#platformOpenCompanyCreate').click();
    await waitFor(page, '#platformCreateCompanyForm');
    assert(await page.locator('#provisionCompanyName').inputValue() === 'Edited Acme Malaysia', 'Master-scoped Company edit was not restored');
    await page.locator('#provisionCompanyName').fill('Acme Malaysia');

    // Replaying the exact captured mutations must return the existing result,
    // proving that the stable key is safe across a refresh/double click.
    const replay = await page.evaluate(async ({ url, key, body }) => {
      const csrf = document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith('erp_platform_csrf='))?.split('=').slice(1).join('=') ?? '';
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'idempotency-key': key, 'x-platform-csrf-token': decodeURIComponent(csrf) }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }, companyRequest as { url: string; key: string; body: unknown });
    assert(replay.status === 200 && replay.body?.meta?.idempotentReplay === true, 'company idempotency replay did not return the existing result');

    // A reload returns to closed tenant control. Opening explicitly recreates
    // the same second-Company defaults without restoring submitted identity.
    await page.reload({ waitUntil: 'networkidle' });
    await waitFor(page, '.platform-entitlement-grid');
    assert(await page.locator('#platformCreateCompanyForm').count() === 0, 'reload automatically reopened the optional Company form');
    assert(await page.locator('#platformProvisionActionbar').count() === 0, 'reload restored the optional Company action bar');
    await page.locator('#platformOpenCompanyCreate').click();
    await waitFor(page, '#platformCreateCompanyForm');
    assert(await page.locator('#provisionCompanyName').inputValue() === 'Acme Malaysia', 'reload did not recreate the second Company name');
    assert(await page.locator('#provisionCompanyCountry').inputValue() === 'MY', 'reload did not recreate the second Company country');
    assert(await page.locator('#provisionCompanyOwnerName').inputValue() === 'Malaysia Owner', 'reload did not recreate the second Company owner name');
    assert(await page.locator('#provisionCompanyOwnerUsername').inputValue() === 'myowner', 'reload did not recreate the second Company owner username');
    assert(await page.locator('#provisionCompanyOwnerEmail').inputValue() === 'myowner@acme.co', 'reload did not recreate the second Company owner email');
    assert(await page.locator('#platformCreateCompanyError').textContent() === '', 'opened Company panel contained a stale error');
    assert(await page.locator('#platformCreateCompanyAction').innerText() === 'Create Company', 'optional Company action copy is incorrect');
    assert(await page.locator('.platform-stepper').count() === 0, 'completed tenant control still rendered provisioning progress');

    // The second Company can be created without typing. Success closes the
    // panel and selects the exact companyFn returned by the API.
    page.on('request', companyRequestListener);
    const secondCompanyResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/platform\/masters\/[^/]+\/companies$/.test(response.url()));
    await page.locator('#platformCreateCompanyAction').click();
    const secondCompanyBody = await (await secondCompanyResponse).json() as { data?: { companyFn?: string } };
    await page.locator('#platformCompanyCreatedStatus').waitFor({ state: 'visible', timeout: TIMEOUT });
    page.off('request', companyRequestListener);
    assert(companyMutationCount === 2, 'second Company submit did not emit exactly one additional mutation');
    assert(await page.locator('#platformCompanySelect option').count() === 2, 'second Company was not added to the selected Master');
    assert(await page.locator('#platformCompanySelect').inputValue() === secondCompanyBody.data?.companyFn, 'created Company was not selected by its returned companyFn');
    assert(await page.locator('#platformCreateCompanyForm').count() === 0, 'successful optional Company creation left the form open');
    assert(await page.locator('#platformProvisionActionbar').count() === 0, 'successful optional Company creation left the action bar open');

    // The third ordinal is generated only after the operator opens the panel.
    await page.locator('#platformOpenCompanyCreate').click();
    await waitFor(page, '#platformCreateCompanyForm');
    assert(await page.locator('#provisionCompanyName').inputValue() === 'Acme Company 3', 'third Company name autofill is incorrect');
    assert(await page.locator('#provisionCompanyCountry').inputValue() === 'SG', 'third Company country autofill is incorrect');
    assert(await page.locator('#provisionCompanyOwnerName').inputValue() === 'Company Owner 3', 'third Company owner name autofill is incorrect');
    assert(await page.locator('#provisionCompanyOwnerUsername').inputValue() === 'owner3', 'third Company owner username autofill is incorrect');
    assert(await page.locator('#provisionCompanyOwnerEmail').inputValue() === 'owner3@acme.co', 'third Company owner email autofill is incorrect');
    assert(await page.locator('#provisionCompanyOwnerPassword').inputValue() === 'demo1234', 'third Company owner password autofill is incorrect');

    // A backend uniqueness conflict must keep the panel and edited values so
    // the operator can correct them; selecting a Company then closes it.
    await page.locator('#provisionCompanyOwnerEmail').fill('owner@acme.co');
    page.on('request', companyRequestListener);
    await page.locator('#platformCreateCompanyAction').click();
    await page.locator('#platformCreateCompanyError').waitFor({ state: 'visible', timeout: TIMEOUT });
    page.off('request', companyRequestListener);
    assert(/already exists/i.test(await page.locator('#platformCreateCompanyError').innerText()), 'duplicate owner conflict did not reach the inline alert');
    assert(await page.locator('#provisionCompanyOwnerEmail').inputValue() === 'owner@acme.co', 'conflict retry did not preserve the edited email');
    assert(await page.locator('#platformCreateCompanyForm').count() === 1, 'conflict closed the Company panel');
    assert(await page.locator('#platformCompanySelect option').count() === 2, 'conflict created an extra Company');
    const firstCompanyFn = await page.locator('#platformCompanySelect option').first().getAttribute('value');
    await page.locator('#platformCompanySelect').selectOption(firstCompanyFn || '');
    assert(await page.locator('#platformCreateCompanyForm').count() === 0, 'Company selector change did not close the optional panel');

    // Reuse the authenticated Platform session in a fresh context to prove
    // that a disabled Demo flag leaves the later-Company form manual. A fresh
    // page also ensures no in-memory Demo draft can influence the assertion.
    const flagOffContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      storageState: { cookies: await context.cookies(), origins: [] },
    });
    await flagOffContext.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__ERP_PLATFORM_DEMO_AUTOFILL_OVERRIDE__ = false;
    });
    const flagOffPage = await flagOffContext.newPage();
    await flagOffPage.goto(listening.baseUrl, { waitUntil: 'domcontentloaded' });
    await waitFor(flagOffPage, '#platformOpenCompanyCreate');
    assert(await flagOffPage.locator('#platformCreateCompanyForm').count() === 0, 'flag-off control rendered the optional Company form by default');
    await flagOffPage.locator('#platformOpenCompanyCreate').click();
    await waitFor(flagOffPage, '#platformCreateCompanyForm');
    assert(await flagOffPage.locator('#provisionCompanyName').inputValue() === '', 'later Company was autofilled while Demo flag was disabled');
    assert(await flagOffPage.locator('#provisionCompanyOwnerName').inputValue() === '', 'later Company owner was autofilled while Demo flag was disabled');
    assert(await flagOffPage.locator('#provisionCompanyOwnerUsername').inputValue() === '', 'later Company username was autofilled while Demo flag was disabled');
    assert(await flagOffPage.locator('#provisionCompanyOwnerEmail').inputValue() === '', 'later Company email was autofilled while Demo flag was disabled');
    await flagOffContext.close();

    // Once a Platform principal exists, the Demo build offers a one-click
    // Platform login. It still uses the normal password endpoint and session
    // cookies; the shortcut only supplies the public sample credentials.
    await page.locator('#platformLogoutBtn').click();
    await waitFor(page, '#platformAwareLoginForm');
    assert(await page.locator('#tenantRememberDeviceRow').isVisible(), 'tenant Remember Me row is not visible in tenant realm');
    const rememberAfterPassword = await page.evaluate(() => {
      const password = document.querySelector('#realmPassword');
      const remember = document.querySelector('#tenantRememberDeviceRow');
      return Boolean(password && remember && (password.compareDocumentPosition(remember) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    assert(rememberAfterPassword, 'tenant Remember Me row is not below the password field');
    await page.locator('#realmPasswordToggle').click();
    assert(await page.locator('#realmPassword').getAttribute('type') === 'text', 'tenant password did not become visible');
    assert(await page.locator('#realmPasswordToggle').getAttribute('aria-pressed') === 'true', 'tenant password toggle did not announce visible state');
    await page.locator('#realmPasswordToggle').click();
    assert(await page.locator('#realmPassword').getAttribute('type') === 'password', 'tenant password did not become hidden');
    await page.locator('[data-realm="platform"]').click();
    await waitFor(page, '#platformDemoLoginButton');
    assert(await page.locator('#tenantRememberDeviceRow').isHidden(), 'Remember Me row is visible in Platform realm');
    await page.locator('#realmPasswordToggle').click();
    assert(await page.locator('#realmPassword').getAttribute('type') === 'text', 'Platform password did not become visible');
    await page.locator('#realmPasswordToggle').click();
    assert(await page.locator('#platformDemoLoginButton').innerText() === 'Log in as Platform Admin (Demo)', 'demo Platform login button copy is incorrect');
    await page.locator('#platformDemoLoginButton').click();
    await waitFor(page, '.platform-shell');

    // A production-like build (or a Demo build with the flag overridden off)
    // must not expose the shortcut, even when the database has a principal.
    await page.locator('#platformLogoutBtn').click();
    await waitFor(page, '#platformAwareLoginForm');
    const productionContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await productionContext.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__ERP_PLATFORM_DEMO_AUTOFILL_OVERRIDE__ = false;
    });
    const productionPage = await productionContext.newPage();
    await productionPage.goto(listening.baseUrl, { waitUntil: 'domcontentloaded' });
    await waitFor(productionPage, '#platformAwareLoginForm');
    await productionPage.locator('[data-realm="platform"]').click();
    assert(await productionPage.locator('#platformDemoLoginButton').count() === 0, 'demo Platform login button rendered while autofill was disabled');
    await productionContext.close();
    assert(browserErrors.length === 0, `platform demo autofill browser errors: ${browserErrors.join(' | ')}`);

    await context.close();
    console.log('PASS Platform workspace demo autofill E2E (isolated PGlite): opt-in Company panel, editable ordinal defaults, scoped drafts, conflicts, stable replay and flag-off behavior');
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
