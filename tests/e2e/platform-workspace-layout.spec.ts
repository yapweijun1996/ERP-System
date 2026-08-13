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
    assert(await bootstrapPage.locator('.platform-step.current').getAttribute('aria-label') === 'Platform Superadmin', 'bootstrap progress is not on Platform Superadmin');
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
    let entitlementPatchCount = 0;
    page.on('console', (message) => {
      if (message.type() === 'error' && !/status of (401 \(Unauthorized\)|409 \(Conflict\))/.test(message.text())) browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && /\/api\/platform\/masters\/.*\/modules\//.test(request.url())) entitlementPatchCount += 1;
    });

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
        const progress = document.querySelector<HTMLElement>('.platform-shell-progress');
        const stepper = progress?.querySelector<HTMLElement>('.platform-stepper');
        const steps = Array.from(progress?.querySelectorAll<HTMLElement>('.platform-step') ?? []);
        if (!shell || !body || !header || !action || !actionButton || !form || !moduleGrid || !formGrid || !progress || !stepper) return null;
        const shellRect = shell.getBoundingClientRect();
        const actionRect = action.getBoundingClientRect();
        const intro = progress.parentElement as HTMLElement;
        const introStyle = getComputedStyle(intro);
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
          progressColumns: getComputedStyle(stepper).gridTemplateColumns.split(' ').length,
          progressRows: new Set(steps.map((step) => Math.round(step.getBoundingClientRect().top))).size,
          progressWidth: progress.getBoundingClientRect().width,
          introContentWidth: intro.getBoundingClientRect().width - parseFloat(introStyle.paddingLeft) - parseFloat(introStyle.paddingRight),
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
      assert(metrics.progressColumns === 3 && metrics.progressRows === 1, `provisioning progress did not remain in one three-column row at ${width}x${height}`);
      assert(Math.abs(metrics.progressWidth - metrics.introContentWidth) <= 2, `provisioning progress did not span the intro content width at ${width}x${height}`);
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
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#platformCreateCompanyForm').waitFor({ state: 'visible', timeout: TIMEOUT });
    assert(await page.locator('.platform-step.current').getAttribute('aria-label') === 'Company & administrators', 'Company provisioning progress is not on step 3');
    assert(await page.locator('.platform-shell-progress .platform-step').count() === 3, 'Company provisioning progress is not rendered as a full-width three-step row');
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
    const company = (await companyResponse.json()).data as { companyFn: string };

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.platform-entitlement-workspace').waitFor({ state: 'visible', timeout: TIMEOUT });
    assert(await page.locator('.platform-entitlement-workspace').count() === 1, 'completed workspace did not render one full-width entitlement workspace');
    assert(await page.locator('#platformMasterTab').getAttribute('aria-selected') === 'true', 'Master controls is not the default entitlement tab');
    assert(await page.locator('#platformCompanyPanel').isHidden(), 'inactive Company allocation panel is not hidden');

    for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]] as const) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(40);
      const metrics = await page.evaluate(() => {
        const workspace = document.querySelector<HTMLElement>('.platform-entitlement-workspace');
        const body = document.querySelector<HTMLElement>('.platform-shell-body');
        const wrapper = document.querySelector<HTMLElement>('#platformMasterPanel .platform-table-wrap');
        const row = document.querySelector<HTMLElement>('#platformMasterPanel tbody tr');
        const action = row?.querySelector<HTMLElement>('td:last-child');
        if (!workspace || !body || !wrapper || !row || !action) return null;
        return {
          workspaceWidth: workspace.getBoundingClientRect().width,
          bodyWidth: body.getBoundingClientRect().width,
          wrapperOverflow: wrapper.scrollWidth - wrapper.clientWidth,
          rowDisplay: getComputedStyle(row).display,
          actionRight: action.getBoundingClientRect().right,
          workspaceRight: workspace.getBoundingClientRect().right,
          outerWidth: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      assert(metrics, `desktop entitlement metrics missing at ${width}x${height}`);
      assert(metrics.workspaceWidth <= metrics.bodyWidth + 1, `entitlement workspace exceeded body width at ${width}x${height}`);
      assert(metrics.wrapperOverflow <= 1, `desktop entitlement table overflowed horizontally at ${width}x${height}`);
      assert(metrics.rowDisplay === 'table-row', `desktop entitlement rows are not table rows at ${width}x${height}`);
      assert(metrics.actionRight <= metrics.workspaceRight + 1, `desktop entitlement action column is clipped at ${width}x${height}`);
      assert(metrics.outerWidth <= 1, `desktop entitlement workspace overflowed the document at ${width}x${height}`);
    }

    const masterSearch = page.locator('#platformMasterPanel .platform-module-search');
    await masterSearch.fill('expenses_tax');
    assert(await page.locator('#platformMasterPanel tbody tr:not([hidden])').count() === 1, 'Master module search did not filter client-side');
    await masterSearch.fill('');
    await page.locator('#platformMasterPanel .platform-module-filter').selectOption('enabled');
    assert(await page.locator('#platformMasterPanel tbody tr:not([hidden])').count() > 0, 'Master status filter returned no enabled modules');
    await page.locator('#platformMasterPanel .platform-module-filter').selectOption('all');

    const masterRow = page.locator('#platformMasterPanel tbody tr[data-module="expenses_tax"]');
    const masterSave = masterRow.locator('.platform-save-master');
    const initialMasterVersion = Number(await masterRow.getAttribute('data-version'));
    const switchScrollBefore = await page.evaluate(() => {
      const body = document.querySelector<HTMLElement>('.platform-shell-body');
      const shell = document.querySelector<HTMLElement>('.platform-shell');
      if (!body || !shell) return null;
      window.scrollTo(0, 0);
      body.scrollTop = body.scrollHeight;
      return {
        rootScrollY: window.scrollY,
        rootOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        shellTop: shell.getBoundingClientRect().top,
      };
    });
    assert(switchScrollBefore, 'switch scroll metrics are unavailable before interaction');
    assert(switchScrollBefore.rootScrollY === 0 && switchScrollBefore.rootOverflow <= 1, 'completed workspace root already scrolls before switch interaction');
    await masterRow.locator('label.platform-switch').first().click();
    const switchScrollAfter = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.platform-shell');
      const input = document.querySelector<HTMLInputElement>('tr[data-module="expenses_tax"] .platform-master-enabled');
      if (!shell || !input) return null;
      const inputRect = input.getBoundingClientRect();
      const switchRect = input.closest<HTMLElement>('.platform-switch')?.getBoundingClientRect();
      return {
        rootScrollY: window.scrollY,
        rootOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        shellTop: shell.getBoundingClientRect().top,
        inputInsideSwitch: Boolean(switchRect && inputRect.top >= switchRect.top - 1 && inputRect.bottom <= switchRect.bottom + 1),
      };
    });
    assert(switchScrollAfter, 'switch scroll metrics are unavailable after interaction');
    assert(switchScrollAfter.rootScrollY === switchScrollBefore.rootScrollY, 'clicking a module switch scrolled the root document');
    assert(switchScrollAfter.rootOverflow <= 1, 'the hidden switch input created root document overflow');
    assert(Math.abs(switchScrollAfter.shellTop - switchScrollBefore.shellTop) <= 1, 'clicking a module switch moved the workspace shell');
    assert(switchScrollAfter.inputInsideSwitch, 'the hidden switch input is not anchored inside its visible control');
    assert(entitlementPatchCount === 0, 'changing a Master switch sent a mutation before Save');
    assert(await masterRow.getAttribute('class') === 'is-dirty', 'changed Master row is not marked dirty');
    assert(await masterSave.isEnabled(), 'changed Master row did not enable Save');
    await page.locator('.platform-shell').evaluate((node) => { (node as HTMLElement).dataset.testIdentity = 'preserved'; });
    await masterSave.click();
    await masterRow.locator('.platform-row-feedback').filter({ hasText: 'Saved' }).waitFor({ state: 'visible', timeout: TIMEOUT });
    assert(entitlementPatchCount === 1, 'Master Save did not send exactly one PATCH');
    assert(Number(await masterRow.getAttribute('data-version')) === initialMasterVersion + 1, 'Master Save did not update the row version');
    assert(await page.locator('.platform-shell').getAttribute('data-test-identity') === 'preserved', 'Master Save re-rendered the workspace shell');
    assert(await masterRow.locator('.platform-row-feedback').evaluate((node) => node === document.activeElement), 'Master Save did not move focus to the saved row status');
    assert(await masterSave.isDisabled(), 'saved Master row is still dirty');

    await masterRow.locator('label.platform-switch').first().click();
    const patchCountBeforeReset = entitlementPatchCount;
    await masterRow.locator('.platform-reset-master').click();
    assert(entitlementPatchCount === patchCountBeforeReset, 'Master Reset sent an API mutation');
    assert(await masterSave.isDisabled(), 'Master Reset did not restore the saved baseline');

    await masterRow.locator('label.platform-switch').first().click();
    page.once('dialog', async (dialog) => { assert(dialog.message() === 'You have unsaved module changes. Discard them?', 'unexpected dirty-navigation prompt'); await dialog.dismiss(); });
    await page.locator('#platformCompanyTab').click();
    assert(await page.locator('#platformMasterTab').getAttribute('aria-selected') === 'true', 'dismissed dirty-navigation prompt changed tabs');
    assert(await masterRow.getAttribute('class') === 'is-dirty', 'dismissed dirty-navigation prompt discarded the row');
    page.once('dialog', async (dialog) => { await dialog.accept(); });
    await page.locator('#platformCompanyTab').click();
    assert(await page.locator('#platformCompanyTab').getAttribute('aria-selected') === 'true', 'accepted dirty-navigation prompt did not change tabs');
    assert(await page.locator('#platformMasterPanel').isHidden(), 'inactive Master panel remains visible');
    await page.locator('#platformCompanyTab').press('ArrowLeft');
    assert(await page.locator('#platformMasterTab').getAttribute('aria-selected') === 'true', 'tab keyboard navigation did not return to Master controls');
    assert(await page.locator('#platformMasterTab').evaluate((node) => node === document.activeElement), 'tab keyboard navigation did not move focus');
    await page.locator('#platformCompanyTab').click();

    const companyRow = page.locator('#platformCompanyPanel tbody tr[data-module="expenses_tax"]');
    const companyAllocated = companyRow.locator('.platform-company-allocated');
    const staleVersion = Number(await companyRow.getAttribute('data-version'));
    const concurrent = await fetch(`${listening.baseUrl}/api/platform/masters/${master.masterFn}/companies/${company.companyFn}/modules/expenses_tax`, {
      method: 'PATCH',
      headers: platformHeaders(true),
      body: JSON.stringify({ allocated: false, expectedVersion: staleVersion }),
    });
    assert(concurrent.status === 200, `concurrent allocation update failed with HTTP ${concurrent.status}`);
    await companyRow.locator('label.platform-switch').click();
    assert(await companyRow.getAttribute('class') === 'is-dirty', 'changed Company row is not marked dirty');
    await companyRow.locator('.platform-save-company').click();
    await companyRow.locator('.platform-row-error').filter({ hasText: 'changed elsewhere' }).waitFor({ state: 'visible', timeout: TIMEOUT });
    assert(entitlementPatchCount === 2, 'stale Company Save did not send exactly one PATCH');
    assert(await companyRow.locator('.platform-reload-company').isVisible(), '409 conflict did not expose Reload row');
    assert(await companyRow.getAttribute('class') === 'is-dirty', '409 conflict discarded the user allocation');
    await companyRow.locator('.platform-reload-company').click();
    await companyRow.locator('.platform-row-feedback').filter({ hasText: 'Current server values loaded.' }).waitFor({ state: 'visible', timeout: TIMEOUT });
    assert(!(await companyAllocated.isChecked()), 'Reload row did not load the current Company allocation');
    assert(await companyRow.locator('.platform-save-company').isDisabled(), 'Reload row did not clear dirty state');

    for (const [width, height] of [[768, 1024], [430, 932], [390, 844], [375, 812]] as const) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(40);
      const metrics = await page.evaluate(() => {
        const workspace = document.querySelector<HTMLElement>('.platform-entitlement-workspace');
        const panel = document.querySelector<HTMLElement>('#platformCompanyPanel');
        const wrapper = panel?.querySelector<HTMLElement>('.platform-table-wrap');
        const row = panel?.querySelector<HTMLElement>('tbody tr');
        const controls = Array.from(panel?.querySelectorAll<HTMLElement>('button,.platform-switch') ?? []).filter((node) => node.getBoundingClientRect().height > 0);
        const tabLabels = Array.from(document.querySelectorAll<HTMLElement>('.platform-entitlement-tab > span'));
        if (!workspace || !wrapper || !row) return null;
        return {
          rowDisplay: getComputedStyle(row).display,
          wrapperOverflow: wrapper.scrollWidth - wrapper.clientWidth,
          controlHeights: controls.map((node) => ({ label: node.className, height: node.getBoundingClientRect().height })),
          tabLabelsClipped: tabLabels.some((node) => {
            const style = getComputedStyle(node);
            return style.textOverflow === 'ellipsis' || style.whiteSpace === 'nowrap';
          }),
          outerWidth: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      assert(metrics, `mobile entitlement metrics missing at ${width}x${height}`);
      assert(metrics.rowDisplay === 'grid', `entitlement rows did not become cards at ${width}x${height}`);
      assert(metrics.wrapperOverflow <= 1, `mobile entitlement cards overflowed horizontally at ${width}x${height}`);
      assert(!metrics.tabLabelsClipped, `mobile entitlement tab labels were clipped at ${width}x${height}`);
      const minControl = metrics.controlHeights.reduce((min, item) => item.height < min.height ? item : min);
      assert(minControl.height >= 44, `mobile entitlement control ${minControl.label} is ${minControl.height}px at ${width}x${height}`);
      assert(metrics.outerWidth <= 1, `mobile entitlement workspace overflowed the document at ${width}x${height}`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const completedMetrics = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.platform-shell');
      const simulation = document.querySelector<HTMLElement>('.platform-simulation-panel');
      const toolbar = document.querySelector<HTMLElement>('.platform-shell-toolbar');
      const opener = document.querySelector<HTMLElement>('#platformOpenCompanyCreate');
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
        progressCount: document.querySelectorAll('.platform-stepper').length,
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
    assert(completedMetrics.progressCount === 0, 'completed tenant control still rendered provisioning progress');
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
    console.log('PASS Platform workspace layout E2E (isolated PGlite): stage progress, completed control, desktop 80vh, mobile adaptive shell, sticky actions and entitlement layouts');
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
