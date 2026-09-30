import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.ERP_E2E_BASE_URL ?? 'http://127.0.0.1:4179';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.addInitScript(() => {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      if (!localStorage.getItem('aria-demo-auth')) {
        localStorage.setItem('aria-active-user-email', 'viewer@acme.co');
        localStorage.setItem('aria-demo-auth', JSON.stringify({
          signedIn: true, email: 'viewer@acme.co', at: new Date(0).toISOString(),
        }));
      }
    });
    await page.goto(`${baseUrl}/?leave-overlap-e2e=${Date.now()}#my-leave`, {
      waitUntil: 'domcontentloaded', timeout: 30_000,
    });
    await page.getByRole('button', { name: 'New leave', exact: true }).waitFor({ state: 'visible', timeout: 90_000 });
    assert.equal(await page.evaluate(() => window.DB?.user?.email), 'viewer@acme.co');

    async function createDraft(reason) {
      await page.getByRole('button', { name: 'New leave', exact: true }).click();
      const modal = page.locator('#modalEl');
      await modal.locator('[data-my-leave-start]').fill('2026-10-05');
      await modal.locator('[data-my-leave-end]').fill('2026-10-05');
      await modal.locator('[data-my-leave-reason]').fill(reason);
      await modal.locator('[data-my-leave-save]').click();
      await page.locator('[data-my-leave-submit]').waitFor({ state: 'visible', timeout: 60_000 });
    }

    await createDraft('Family appointment');
    const firstId = await page.evaluate(async () => {
      const db = window.ErpSystemData.db;
      const result = await db.query("select id from leave_request where reason='Family appointment' order by id desc limit 1");
      return result.rows[0]?.id;
    });
    assert.ok(firstId);
    await page.locator('[data-my-leave-submit]').click();
    await page.locator('#modalEl [data-my-leave-action-confirm]').click();
    await page.waitForFunction(async id => {
      const result = await window.ErpSystemData.db.query('select status from leave_request where id=$1', [id]);
      return result.rows[0]?.status === 'pending';
    }, firstId, { timeout: 60_000 });
    await page.evaluate(() => navigate('my-leave'));
    await page.getByRole('button', { name: 'New leave', exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
    await createDraft('Second family appointment');
    const secondId = await page.evaluate(async () => {
      const result = await window.ErpSystemData.db.query("select id from leave_request where reason='Second family appointment' order by id desc limit 1");
      return result.rows[0]?.id;
    });
    assert.ok(secondId);
    await page.locator('[data-my-leave-submit]').click();
    await page.locator('#modalEl [data-my-leave-action-confirm]').click();
    const error = page.locator('#modalEl [data-my-leave-action-error]:not([hidden])');
    await error.waitFor({ state: 'visible', timeout: 60_000 });
    assert.match(await error.innerText(), /already covers these dates/i);
    const persisted = await page.evaluate(async id => {
      const result = await window.ErpSystemData.db.query('select status from leave_request where id=$1', [id]);
      return result.rows[0]?.status;
    }, secondId);
    assert.equal(persisted, 'draft');
    await page.waitForFunction(() => !document.querySelector('#toaster .toast'), null, { timeout: 10_000 });
    await page.screenshot({ path: 'docs/evidence/TASK-254-leave-overlap-desktop.png' });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(350);
    const modalRect = await page.locator('#modalEl').evaluate(element => {
      const rect = element.getBoundingClientRect();
      const head = element.querySelector('.modal-head')?.getBoundingClientRect();
      const foot = element.querySelector('.modal-foot')?.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
        headTop: head?.top, footBottom: foot?.bottom };
    });
    assert.ok(modalRect.left >= -1 && modalRect.right <= 376
      && modalRect.top >= -1 && modalRect.bottom <= 813
      && modalRect.headTop >= -1 && modalRect.footBottom <= 813,
    `Mobile leave modal clipped: ${JSON.stringify(modalRect)}`);
    await page.screenshot({ path: 'docs/evidence/TASK-254-leave-overlap-mobile.png' });
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert.ok(width.scroll <= width.client + 1, `Mobile root overflow: ${JSON.stringify(width)}`);
    await page.evaluate(() => {
      localStorage.setItem('aria-active-user-email', 'admin@acme.co');
      localStorage.setItem('aria-demo-auth', JSON.stringify({
        signedIn: true, email: 'admin@acme.co', at: new Date().toISOString(),
      }));
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${baseUrl}/?leave-admin-e2e=${Date.now()}#leave-approval`, {
      waitUntil: 'domcontentloaded', timeout: 30_000,
    });
    await page.waitForFunction(() => window.DB?.user?.email === 'admin@acme.co'
      && document.querySelector('[data-list-route="leave-approval"]'), null, { timeout: 60_000 });
    const approvalRow = page.locator(`[data-list-route="leave-approval"] [data-row="${firstId}"]`);
    try {
      await approvalRow.waitFor({ state: 'visible', timeout: 15_000 });
    } catch (error) {
      const state = await page.evaluate(async id => ({
        route: window.CURRENT_ROUTE,
        user: window.DB?.user?.email,
        body: document.body.innerText.slice(0, 900),
        rowStatus: (await window.ErpSystemData.db.query('select status from leave_request where id=$1', [id])).rows[0],
        activeEmail: localStorage.getItem('aria-active-user-email'),
        approval: (await window.ErpSystemData.db.query('select id,status,current_step_no,subject_employee_id from approval_instance where entity_id=$1', [id])).rows,
        steps: (await window.ErpSystemData.db.query("select instance_id,status,current_authority_type,current_authority_permission_key from approval_instance_step where instance_id in (select id from approval_instance where entity_id=$1)", [id])).rows,
        rows: [...document.querySelectorAll('[data-list-route="leave-approval"] [data-row]')]
          .map(element => ({ id: element.dataset.row, text: element.innerText.slice(0, 150) })),
        queue: await window.ErpSystemData.my.approvalQueue(),
      }), firstId);
      throw new Error(`Approval row missing: ${JSON.stringify(state)}`, { cause: error });
    }
    await approvalRow.click();
    await page.locator('[data-leave-actions] [data-leave-action="approve"]').click();
    await page.waitForFunction(async id => {
      const result = await window.ErpSystemData.db.query('select status from leave_request where id=$1', [id]);
      return result.rows[0]?.status === 'approved';
    }, firstId, { timeout: 60_000 });
    const approval = await page.evaluate(async id => {
      const request = (await window.ErpSystemData.db.query('select employee_id,status from leave_request where id=$1', [id])).rows[0];
      const ledger = (await window.ErpSystemData.db.query("select entry_type from leave_balance_entry where employee_id=$1 and entry_type='use'", [request.employee_id])).rows;
      return { request, useCount: ledger.length };
    }, firstId);
    assert.equal(approval.request.status, 'approved');
    assert.ok(approval.useCount > 0, 'Approval must settle the paid leave reservation');
    await page.evaluate(() => {
      localStorage.setItem('aria-active-user-email', 'viewer@acme.co');
      localStorage.setItem('aria-demo-auth', JSON.stringify({
        signedIn: true, email: 'viewer@acme.co', at: new Date().toISOString(),
      }));
    });
    await page.goto(`${baseUrl}/?leave-viewer-e2e=${Date.now()}#my-leave`, {
      waitUntil: 'domcontentloaded', timeout: 30_000,
    });
    await page.waitForFunction(() => window.DB?.user?.email === 'viewer@acme.co'
      && document.querySelector('[data-list-route="my-leave"]'), null, { timeout: 60_000 });
    await page.evaluate(id => navigate('leave-application', { requestId: id }), firstId);
    await page.locator('[data-my-leave-events]').waitFor({ state: 'attached', timeout: 60_000 });
    const employeeHistory = await page.evaluate(() => ({
      locked: document.body.classList.contains('auth-locked'),
      route: window.CURRENT_ROUTE,
      title: document.querySelector('.pagehead h1')?.textContent,
      history: document.querySelector('[data-my-leave-events]')?.textContent,
      status: document.querySelector('[data-list-route="leave-application"]')?.textContent?.slice(0, 300),
    }));
    assert.equal(employeeHistory.locked, false, `Employee workspace locked: ${JSON.stringify(employeeHistory)}`);
    assert.match(employeeHistory.history ?? '', /Approved/, JSON.stringify(employeeHistory));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, firstId, secondId, secondStatus: persisted,
      approvedStatus: approval.request.status, useCount: approval.useCount, mobileWidth: width, errors }));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
