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
      localStorage.setItem('aria-demo-auth', JSON.stringify({
        signedIn: true, email: 'admin@acme.co', at: new Date(0).toISOString(),
      }));
    });
    await page.goto(`${baseUrl}/?staff-mvp-e2e=${Date.now()}#hr-directory`, {
      waitUntil: 'domcontentloaded', timeout: 30_000,
    });
    const directory = page.locator('[data-list-route="hr-directory"]');
    await directory.waitFor({ state: 'visible', timeout: 90_000 });
    const rows = directory.locator('[data-list-table] [data-row]');
    await rows.first().waitFor({ state: 'visible', timeout: 90_000 });
    const initialCount = await rows.count();
    assert.ok(initialCount > 10, `Expected seeded Staff roster, got ${initialCount}`);
    await directory.locator('[data-staff-status-filter]').selectOption('former');
    assert.equal(await rows.count(), 0);
    assert.match(await directory.locator('[data-list-empty] h3').innerText(), /No matching employees/);
    await page.screenshot({ path: 'docs/evidence/TASK-253-staff-empty-filter.png' });
    await directory.locator('[data-staff-clear-filters]').click();
    assert.equal(await rows.count(), initialCount);
    await directory.locator('[data-staff-status-filter]').selectOption('current');
    assert.equal(await rows.count(), initialCount);
    await directory.locator('[data-staff-role-filter]').selectOption('Account Executive');
    assert.ok(await rows.count() > 0);
    await directory.locator('[data-list-filter="Sales"]').click();
    assert.equal(await directory.locator('[data-list-filter="Sales"]').getAttribute('aria-pressed'), 'true');
    await directory.locator('[data-list-search]').fill('Lena Park');
    assert.equal(await rows.count(), 1);
    await directory.locator('[data-list-search]').fill('no-such-staff-name');
    await directory.locator('[data-list-empty]').waitFor({ state: 'visible' });
    await directory.locator('[data-list-search]').fill('Lena Park');
    await rows.first().click();
    await page.locator('[data-employee-edit]').waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('[data-employee-edit]').click();
    await page.locator('#modalEl [data-master-editor-input="phone"]').fill('+65 6123 4567');
    await page.locator('#modalEl [data-master-editor-save]').click();
    await page.locator('#modalEl').waitFor({ state: 'detached', timeout: 60_000 });
    await page.locator('[data-employee-contact]').getByText('+65 6123 4567').waitFor({ state: 'visible', timeout: 60_000 });
    const savedPhone = await page.evaluate(async () => {
      const result = await window.ErpSystemData.db.query("select phone from employee where employee_no='EMP-1088'");
      return result.rows[0]?.phone;
    });
    assert.equal(savedPhone, '+65 6123 4567');
    await page.locator('[data-employee-end]').waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('[data-employee-end]').click();
    await page.locator('#employeeEmploymentReason').fill('No');
    await page.locator('[data-employee-end-confirm]').click();
    await page.getByText('Enter a reason of 3 to 500 characters.').waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('#employeeEmploymentReason').fill('Employment ended after resignation');
    await page.locator('[data-employee-end-confirm]').click();
    await page.locator('[data-employee-end]').waitFor({ state: 'detached', timeout: 90_000 });
    const persisted = await page.evaluate(async () => {
      const db = window.ErpSystemData.db;
      const employee = (await db.query("select id, is_active, user_id from employee where employee_no='EMP-1088'")).rows[0];
      const audit = (await db.query("select action, after from audit_log where entity='hr/employees' and entity_id=$1 and action='end_employment'", [String(employee.id)])).rows;
      return { employee, audit };
    });
    assert.equal(persisted.employee.is_active, false);
    assert.equal(persisted.employee.user_id, null);
    assert.equal(persisted.audit.length, 1);
    assert.match(await page.locator('[data-employee-change-history]').innerText(), /Employment ended after resignation/);

    await page.evaluate(() => navigate('hr-directory'));
    await directory.locator('[data-staff-status-filter]').waitFor({ state: 'visible', timeout: 60_000 });
    assert.equal(await directory.locator('[data-list-kpis] button').first().locator('b').innerText(), String(initialCount - 1));
    await directory.locator('[data-staff-status-filter]').selectOption('former');
    await directory.locator('[data-staff-role-filter]').selectOption('Account Executive');
    await directory.locator('[data-list-filter="Sales"]').click();
    await directory.locator('[data-list-search]').fill('Lena Park');
    assert.equal(await rows.count(), 1);
    await page.screenshot({ path: 'docs/evidence/TASK-253-staff-after-desktop.png' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await directory.waitFor({ state: 'visible', timeout: 90_000 });
    await directory.locator('[data-staff-status-filter]').selectOption('former');
    await directory.locator('[data-list-search]').fill('Lena Park');
    assert.equal(await rows.count(), 1);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => navigate('hr-directory'));
    await directory.waitFor({ state: 'visible', timeout: 60_000 });
    await page.screenshot({ path: 'docs/evidence/TASK-253-staff-after-mobile.png' });
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert.ok(width.scroll <= width.client + 1, `Mobile root overflow: ${JSON.stringify(width)}`);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, initialCount, endedId: persisted.employee.id, mobileWidth: width, errors }));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
