/* TASK-187 platform workspace layout proof. This file owns an isolated,
 * migrated PGlite database and a local API/static server; it never connects to
 * production. The assertions intentionally measure the shell rather than
 * screenshot pixels so they remain useful across browsers and themes. */
import express from 'express';
import type { Server } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../../src/api/app';
import { freshDb } from '../../src/test/helpers';
import type { DB } from '../../src/data/db';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIST = path.join(ROOT, 'web', 'dist');
const TIMEOUT = 60_000;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function platformCookies(response: Response): { header: string; csrf: string; values: Array<{ name: string; value: string }> } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_platform_(?:session|csrf))=([^;,\s]+)/g),
    (match) => ({ name: match[1], value: decodeURIComponent(match[2]) }),
  ));
  const csrf = pairs.find((pair) => pair.name === 'erp_platform_csrf');
  if (!csrf) throw new Error('Platform bootstrap did not set a CSRF cookie.');
  return { header: pairs.map((pair) => `${pair.name}=${pair.value}`).join('; '), csrf: csrf.value, values: pairs };
}

async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Platform layout server has no TCP address.');
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

async function main(): Promise<void> {
  if (!existsSync(path.join(WEB_DIST, 'index.html'))) {
    throw new Error('web/dist/index.html not found. Run npm run build first.');
  }

  let db: DB | undefined;
  let server: Server | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    db = await freshDb();
    const host = express();
    host.use(express.static(WEB_DIST));
    host.use(createApp(db));
    const listening = await listen(host);
    server = listening.server;

    browser = await chromium.launch({ headless: true });
    const bootstrapContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const bootstrapPage = await bootstrapContext.newPage();
    await bootstrapPage.goto(listening.baseUrl, { waitUntil: 'networkidle' });
    await bootstrapPage.locator('#platformBootstrapForm').waitFor({ state: 'visible', timeout: TIMEOUT });
    assert(await bootstrapPage.locator('.platform-shell').count() === 0, 'bootstrap registration unexpectedly uses the authenticated platform shell');
    await bootstrapContext.close();

    const bootstrap = await fetch(`${listening.baseUrl}/api/setup/platform-superadmin/actions/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        principalKey: 'layout-platform-admin',
        displayName: 'Layout Platform Admin',
        email: 'layout-platform@example.test',
        password: 'layout-platform-password-123',
      }),
    });
    assert(bootstrap.status === 201, `platform bootstrap failed with HTTP ${bootstrap.status}`);
    const platform = platformCookies(bootstrap);
    const platformHeaders = (mutation = false, idempotencyKey?: string): Record<string, string> => ({
      cookie: platform.header,
      ...(mutation ? { 'x-platform-csrf-token': platform.csrf, 'content-type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    });

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addCookies(platform.values.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: listening.baseUrl,
      httpOnly: cookie.name.endsWith('_session'),
      sameSite: 'Strict' as const,
    })));
    const page = await context.newPage();
    const browserErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && !/status of 401 \(Unauthorized\)/.test(message.text())) browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await page.goto(listening.baseUrl, { waitUntil: 'networkidle' });
    await page.locator('#platformCreateMasterForm').waitFor({ state: 'visible', timeout: TIMEOUT });

    async function assertShell(width: number, height: number, expectedModuleColumns: number, expectedFormColumns: number): Promise<void> {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(50);
      const metrics = await page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>('.platform-shell');
        const body = document.querySelector<HTMLElement>('.platform-shell-body');
        const header = document.querySelector<HTMLElement>('.platform-shell-header');
        const action = document.querySelector<HTMLElement>('.platform-shell-actionbar');
        const actionButton = document.querySelector<HTMLButtonElement>('#platformCreateMasterAction, #platformCreateCompanyAction');
        const form = document.querySelector<HTMLFormElement>('#platformCreateMasterForm, #platformCreateCompanyForm');
        const moduleGrid = document.querySelector<HTMLElement>('.platform-provision-module-grid');
        const formGrid = document.querySelector<HTMLElement>('.platform-master-identity');
        if (!shell || !body || !header || !action || !actionButton || !form || !moduleGrid || !formGrid) return null;
        const shellRect = shell.getBoundingClientRect();
        const actionRect = action.getBoundingClientRect();
        return {
          shellHeight: shellRect.height,
          shellBottom: shellRect.bottom,
          actionBottom: actionRect.bottom,
          overflowWidth: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          overflowHeight: document.documentElement.scrollHeight - document.documentElement.clientHeight,
          bodyOverflowY: getComputedStyle(body).overflowY,
          bodyMinHeight: getComputedStyle(body).minHeight,
          bodyScrollHeight: body.scrollHeight,
          bodyClientHeight: body.clientHeight,
          headerPosition: getComputedStyle(header).position,
          actionPosition: getComputedStyle(action).position,
          actionForm: actionButton.form?.id || '',
          formContainsAction: form.contains(actionButton),
          headingFocused: document.activeElement?.matches('.platform-shell-intro h1') || false,
          moduleColumns: getComputedStyle(moduleGrid).gridTemplateColumns.split(' ').length,
          formColumns: getComputedStyle(formGrid).gridTemplateColumns.split(' ').length,
        };
      });
      assert(metrics, `platform shell metrics missing at ${width}x${height}`);
      if (width >= 981) {
        assert(Math.abs(metrics.shellHeight - height * 0.8) <= 2, `desktop shell is ${metrics.shellHeight}px, expected ${height * 0.8}px at ${width}x${height}`);
        assert(metrics.overflowHeight <= 1 && metrics.overflowWidth <= 1, `desktop page overflowed at ${width}x${height}`);
      } else {
        assert(metrics.shellHeight > height * 0.75 && metrics.shellHeight <= height + 1, `mobile/tablet shell did not use available viewport at ${width}x${height}`);
        assert(metrics.overflowWidth <= 1, `mobile/tablet page overflowed horizontally at ${width}x${height}`);
      }
      assert(metrics.bodyOverflowY === 'auto' || metrics.bodyOverflowY === 'scroll', `workspace body is not an internal scroll region at ${width}x${height}`);
      assert(metrics.bodyMinHeight === '0px', `workspace body min-height is not zero at ${width}x${height}`);
      assert(metrics.headerPosition === 'sticky', `workspace header is not sticky at ${width}x${height}`);
      assert(metrics.actionPosition === 'sticky', `workspace action bar is not sticky at ${width}x${height}`);
      assert(metrics.actionBottom <= metrics.shellBottom + 1, `primary action is outside the shell at ${width}x${height}`);
      assert(metrics.bodyScrollHeight >= metrics.bodyClientHeight, `workspace body metrics are invalid at ${width}x${height}`);
      assert(metrics.actionForm === 'platformCreateMasterForm', `master action is not associated with the form at ${width}x${height}`);
      assert(!metrics.formContainsAction, `master action unexpectedly remains inside the form at ${width}x${height}`);
      assert(metrics.headingFocused, `workspace heading did not receive focus at ${width}x${height}`);
      assert(metrics.moduleColumns === expectedModuleColumns, `module grid has ${metrics.moduleColumns} columns at ${width}x${height}`);
      assert(metrics.formColumns === expectedFormColumns, `identity form has ${metrics.formColumns} columns at ${width}x${height}`);
    }

    await assertShell(1440, 900, 3, 2);
    await assertShell(1280, 800, 3, 2);
    await assertShell(1024, 768, 3, 2);
    await assertShell(768, 1024, 2, 2);
    await assertShell(430, 932, 1, 1);
    await assertShell(390, 844, 1, 1);
    await assertShell(375, 812, 1, 1);

    const alert = page.locator('#platformCreateMasterError');
    assert(await alert.getAttribute('role') === 'alert', 'master form error is missing role=alert');
    const tabOrder = await page.locator('form#platformCreateMasterForm input, form#platformCreateMasterForm button, #platformCreateMasterAction').count();
    assert(tabOrder >= 8, `master form keyboard surface is unexpectedly short (${tabOrder} controls)`);

    const masterResponse = await fetch(`${listening.baseUrl}/api/platform/masters`, {
      method: 'POST',
      headers: platformHeaders(true, 'layout-master-1'),
      body: JSON.stringify({
        name: 'Layout Master',
        loginCode: 'LAYOUT',
        modules: [{ moduleKey: 'expenses_tax', enabled: true, defaultCompanyAllocated: true }],
      }),
    });
    assert(masterResponse.status === 201, `layout master creation failed with HTTP ${masterResponse.status}`);
    const master = (await masterResponse.json()).data as { masterFn: string };
    const companyResponse = await fetch(`${listening.baseUrl}/api/platform/masters/${master.masterFn}/companies`, {
      method: 'POST',
      headers: platformHeaders(true, 'layout-company-1'),
      body: JSON.stringify({
        name: 'Layout Company',
        country: 'SG',
        masterAdmin: {
          name: 'Layout Master Admin', username: 'layout-master-admin',
          email: 'layout-master-admin@example.test', password: 'layout-master-admin-password',
        },
        companyOwner: {
          name: 'Layout Company Owner', username: 'layout-owner',
          email: 'layout-owner@example.test', password: 'layout-owner-password',
        },
      }),
    });
    assert(companyResponse.status === 201, `layout company creation failed with HTTP ${companyResponse.status}`);

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.platform-entitlement-grid').waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.setViewportSize({ width: 390, height: 844 });
    const completedMetrics = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.platform-shell');
      const simulation = document.querySelector<HTMLElement>('.platform-simulation-panel');
      const toolbar = document.querySelector<HTMLElement>('.platform-shell-toolbar');
      const opener = document.querySelector<HTMLElement>('#platformOpenCompanyCreate');
      const wrappers = Array.from(document.querySelectorAll<HTMLElement>('.platform-table-wrap'));
      if (!shell || !simulation || !toolbar || !opener) return null;
      return {
        shellHeight: shell.getBoundingClientRect().height,
        simulationWidth: simulation.getBoundingClientRect().width,
        shellWidth: shell.getBoundingClientRect().width,
        toolbarDisplay: getComputedStyle(toolbar).display,
        toolbarColumns: getComputedStyle(toolbar).gridTemplateColumns.split(' ').length,
        openerHeight: opener.getBoundingClientRect().height,
        createFormCount: document.querySelectorAll('#platformCreateCompanyForm').length,
        actionCount: document.querySelectorAll('.platform-shell-actionbar').length,
        demoPasswordCount: document.querySelectorAll('#provisionCompanyOwnerPassword').length,
        wrapperOverflow: wrappers.map((node) => getComputedStyle(node).overflowX),
        outerWidth: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert(completedMetrics, 'completed platform workspace metrics missing');
    assert(completedMetrics.shellHeight <= 845 && completedMetrics.shellHeight > 600, 'completed mobile shell did not fit the viewport');
    assert(completedMetrics.simulationWidth <= completedMetrics.shellWidth + 1, 'simulation card exceeded the workspace width');
    assert(completedMetrics.toolbarDisplay === 'grid' && completedMetrics.toolbarColumns === 1, 'mobile tenant selectors did not collapse into a single-column toolbar');
    assert(completedMetrics.openerHeight >= 44, 'mobile Company opener is too small for touch input');
    assert(completedMetrics.createFormCount === 0 && completedMetrics.actionCount === 0, 'completed workspace rendered optional Company creation by default');
    assert(completedMetrics.demoPasswordCount === 0, 'closed completed workspace exposed a Demo owner password');
    assert(completedMetrics.wrapperOverflow.every((value) => value === 'auto' || value === 'scroll'), 'entitlement tables lost local horizontal scrolling');
    assert(completedMetrics.outerWidth <= 1, 'completed mobile workspace overflowed horizontally');

    await page.locator('#platformOpenCompanyCreate').click();
    await page.locator('#platformCreateCompanyForm').waitFor({ state: 'visible', timeout: TIMEOUT });
    const openMetrics = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.platform-shell');
      const action = document.querySelector<HTMLElement>('.platform-shell-actionbar');
      const cancel = document.querySelector<HTMLElement>('#platformCancelCompanyCreate');
      const create = document.querySelector<HTMLButtonElement>('#platformCreateCompanyAction');
      if (!shell || !action || !cancel || !create) return null;
      return {
        actionBottom: action.getBoundingClientRect().bottom,
        shellBottom: shell.getBoundingClientRect().bottom,
        actionPosition: getComputedStyle(action).position,
        cancelHeight: cancel.getBoundingClientRect().height,
        createHeight: create.getBoundingClientRect().height,
        actionForm: create.form?.id || '',
        headingFocused: document.activeElement?.id === 'platformCompanyCreateHeading',
        outerWidth: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert(openMetrics, 'opened Company panel metrics missing');
    assert(openMetrics.actionPosition === 'sticky' && openMetrics.actionBottom <= openMetrics.shellBottom + 1, 'optional Company action bar is not contained and sticky');
    assert(openMetrics.cancelHeight >= 44 && openMetrics.createHeight >= 44, 'optional Company actions are too small for touch input');
    assert(openMetrics.actionForm === 'platformCreateCompanyForm', 'optional Company action is not associated with its form');
    assert(openMetrics.headingFocused, 'optional Company heading did not receive focus');
    assert(openMetrics.outerWidth <= 1, 'opened Company panel overflowed horizontally');
    await page.locator('#platformCancelCompanyCreate').click();
    assert(await page.locator('#platformCreateCompanyForm').count() === 0, 'Cancel did not close the optional Company panel');
    await page.waitForFunction(() => document.activeElement?.id === 'platformOpenCompanyCreate');
    assert(await page.locator('#platformOpenCompanyCreate').evaluate((node) => node === document.activeElement), 'Cancel did not restore opener focus');
    assert(browserErrors.length === 0, `platform workspace browser errors: ${browserErrors.join(' | ')}`);

    await context.close();
    console.log('PASS Platform workspace layout E2E (isolated PGlite): desktop 80vh, mobile adaptive shell, opt-in Company panel, sticky actions and entitlement layouts');
  } finally {
    await browser?.close();
    await closeServer(server);
    await closeDb(db);
  }
}

main().catch((error: unknown) => {
  console.error(`FAIL Platform workspace layout E2E: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
