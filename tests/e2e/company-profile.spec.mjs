import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.ERP_E2E_BASE_URL ?? 'http://127.0.0.1:5174';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(`${baseUrl}/?company-profile-e2e=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('#setupWizardView').waitFor({ state: 'visible', timeout: 60_000 });
    for (const selector of ['#wizMaster', '#wizCompany', '#wizAdminName', '#wizModuleSeg', '#wizProvider', '#wizFinish']) {
      await page.locator('#wizNext').click();
      await page.locator(selector).waitFor({ state: 'visible', timeout: 60_000 });
    }
    await page.locator('#wizFinish').click();
    await page.locator('#loginEmail').waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('#loginEmail').fill('admin.acme@acme.co');
    await page.locator('#loginPassword').fill('demo1234');
    await page.locator('#loginForm button[type="submit"]').click();
    await page.locator('#globalSearch').waitFor({ state: 'visible', timeout: 60_000 });
    await page.evaluate(() => navigate('sys-settings'));
    await page.locator('[data-company-profile-edit]').waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('[data-company-profile-edit]').click();
    await page.locator('#cpLegalName').fill('Acme QA & Co');
    await page.locator('#cpRegistrationNo').fill('UEN-TEST-252');
    await page.locator('#cpTaxNo').fill('TAX-252');
    await page.locator('#cpAddressLine1').fill('10 <Test> Street');
    await page.locator('#cpCity').fill('Singapore');
    await page.locator('#cpPostalCode').fill('123456');

    await page.locator('[data-company-profile-logo]').setInputFiles({ name: 'invalid.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    assert.match(await page.locator('.cp-message').innerText(), /PNG|JPEG|WebP/);
    await page.locator('[data-company-profile-logo]').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(256 * 1024 + 1) });
    assert.match(await page.locator('.cp-message').innerText(), /256 KiB/);
    await page.locator('[data-company-profile-logo]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
    await page.locator('[data-company-profile-logo-preview] img').waitFor({ state: 'visible' });
    await page.locator('[data-company-profile-save]').click();
    await page.locator('[data-company-profile-edit]').waitFor({ state: 'visible', timeout: 90_000 });
    const view = page.locator('[data-company-profile]');
    assert.match(await view.innerText(), /Acme QA & Co/);
    assert.match(await view.innerText(), /10 <Test> Street/);
    assert.equal(await view.locator('script').count(), 0);
    assert.equal(await view.locator('img').count(), 1);

    const data = await page.evaluate(async () => {
      const overview = (await window.ErpSystemData.list('settings/overview')).data;
      const row = (await window.ErpSystemData.db.query('select registration_no, tax_no, address_line_1, version, logo_data_url from company_profile')).rows[0];
      return { profile: overview.company, row };
    });
    assert.equal(data.row.registration_no, 'UEN-TEST-252');
    assert.equal(data.row.tax_no, 'TAX-252');
    assert.equal(data.row.address_line_1, '10 <Test> Street');
    assert.equal(data.row.version, 1);
    assert.match(data.row.logo_data_url, /^data:image\/png;base64,/);
    assert.equal(data.profile.name, 'Acme QA & Co');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-company-profile-edit]').waitFor({ state: 'visible', timeout: 90_000 });
    assert.match(await page.locator('[data-company-profile]').innerText(), /UEN-TEST-252/);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => navigate('sys-settings'));
    await page.locator('[data-company-profile-edit]').waitFor({ state: 'visible', timeout: 60_000 });
    await page.screenshot({ path: 'docs/evidence/TASK-252-company-profile-after-mobile.png' });
    await page.locator('[data-company-profile-edit]').click();
    await page.screenshot({ path: 'docs/evidence/TASK-252-company-profile-edit-mobile.png' });
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert.ok(width.scroll <= width.client + 1, `Mobile overflow: ${JSON.stringify(width)}`);
    await page.locator('#cpLegalName').fill('');
    await page.locator('[data-company-profile-save]').click();
    assert.match(await page.locator('.cp-message').innerText(), /legal Company name/);
    assert.equal(await page.locator('#cpLegalName').getAttribute('aria-invalid'), 'true');
    await page.locator('#cpLegalName').fill('Acme QA & Co');
    await page.locator('[data-company-profile-remove]').click();
    await page.locator('[data-company-profile-save]').click();
    await page.locator('[data-company-profile-edit]').waitFor({ state: 'visible', timeout: 90_000 });
    const cleared = await page.evaluate(async () => (await window.ErpSystemData.db.query('select logo_data_url, version from company_profile')).rows[0]);
    assert.equal(cleared.logo_data_url, null);
    assert.equal(cleared.version, 2);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, profileVersion: cleared.version, mobileWidth: width, errors }));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
