import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const port = process.env.DEMO_STARTUP_PORT || '4335';
const url = process.env.DEMO_STARTUP_URL || `http://127.0.0.1:${port}/`;
const root = fileURLToPath(new URL('../../', import.meta.url));
const preview = process.env.DEMO_STARTUP_URL ? null : spawn(process.execPath, [fileURLToPath(new URL('../../web/node_modules/vite/bin/vite.js', import.meta.url)), 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], { cwd: root + '/web', stdio: 'ignore' });
const engine = process.env.DEMO_STARTUP_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true, ...(process.env.DEMO_WEBKIT_EXECUTABLE ? { executablePath: process.env.DEMO_WEBKIT_EXECUTABLE } : {}) });
async function context(serviceWorkers='block') { return browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers }); }
async function ready(page) { await page.waitForFunction(() => window.ErpSystemData?.mode === 'pglite', null, { timeout: 180000 }); }
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  // Real unmodified first boot: no setup/session flags or response fixtures.
  const fresh = await context('allow');
  const page = await fresh.newPage();
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) console.log('browser', message.text()); });
  page.on('pageerror', error => console.log('pageerror', error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await ready(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('aria-setup-wizard-complete')), null);
  const entryLabels = { en: 'Open the complete sample demo', zh: '打开完整示例演示', ms: 'Buka demo contoh lengkap', ja: '完全なサンプルデモを開く', vi: 'Mở bản demo mẫu đầy đủ' };
  for (const [language, label] of Object.entries(entryLabels)) {
    await page.locator('#wizTopLang').selectOption(language);
    assert.equal(await page.locator('#wizardShowcase').innerText(), label);
  }
  await page.locator('#wizTopLang').selectOption('ja');
  await page.locator('#wizardShowcase').click();
  await page.locator('#globalSearch').waitFor({ timeout: 180000 });
  console.log('real fresh sample entry reached dashboard');
  assert.equal(await page.evaluate(() => localStorage.getItem('aria-lang')), 'ja');
  assert.equal(await page.evaluate(() => getLang()), 'ja');
  await page.evaluate(() => setLang('en'));
  assert.equal(await page.evaluate(() => DB.erpSystem.scope.companyFn), 'C-SG');
  // Disposable visitor data survives sample entry and IndexedDB reopen.
  await page.evaluate(async () => {
    await window.ErpSystemData.db.query("update company set name=$1 where master_fn='M1' and company_fn='C-SG'", ['Synthetic retained company']);
    localStorage.setItem('startup-preservation-sentinel', 'retained');
    await window.ErpSystemData.logout();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.locator('#loginShowcase').click();
  try { await page.locator('#globalSearch').waitFor({ timeout: 180000 }); }
  catch (error) {
    console.log('reload diagnostic', await page.evaluate(() => ({ mode: window.ErpSystemData?.mode, progress: window.__ERP_DEMO_PROGRESS__, text: document.body.innerText.slice(-1800) })));
    throw error;
  }
  assert.equal(await page.evaluate(() => DB.company.name), 'Synthetic retained company');
  assert.equal(await page.evaluate(() => localStorage.getItem('startup-preservation-sentinel')), 'retained');
  const denied = await page.evaluate(async () => {
    await window.ErpSystemData.logout();
    await window.ErpSystemData.db.query("update app_user set login_enabled=false where master_fn='M1' and lower(email)='admin@acme.co'");
    try { await window.ErpSystemData.openShowcase(); return false; }
    catch { return localStorage.getItem('aria-demo-auth') === null; }
  });
  assert.equal(denied, true, 'sample entry must not reactivate or authenticate a revoked persona');
  await fresh.close();
  console.log('PASS real fresh sample entry, login entry, reload and retained IndexedDB data');

  // Delay late initialization with an open DB, exercising watchdog fallback.
  const delayed = await context();
  await delayed.route('**/db/erp-system-demo-sales-credit.sql*', async route => {
    await new Promise(resolve => setTimeout(resolve, 50000));
    await route.continue();
  });
  const slow = await delayed.newPage();
  await slow.goto(url, { waitUntil: 'domcontentloaded' });
  await slow.locator('#setupWizardView').waitFor({ timeout: 90000 });
  assert.equal(await slow.evaluate(() => window.ErpSystemData.db !== null), true);
  assert.equal(await slow.locator('#wizardShowcase').isDisabled(), true);
  const blocked = await slow.evaluate(async () => {
    const results = [];
    for (const operation of [() => window.ErpSystemData.completeSetup({}), () => window.ErpSystemData.confirmOrder(1)]) {
      try { await operation(); results.push('unexpected success'); }
      catch (error) { results.push(error.message); }
    }
    return results;
  });
  assert.ok(blocked.every(message => /not ready|unavailable/.test(message)), JSON.stringify(blocked));
  await slow.locator('#wizNext').click();
  await slow.locator('#wizMaster').fill('Retained typed organization');
  await ready(slow);
  assert.equal(await slow.locator('#wizMaster').inputValue(), 'Retained typed organization');
  assert.equal(await slow.locator('#wizardShowcase').isEnabled(), true);
  await delayed.close();
  console.log('PASS delayed runtime, late recovery and retained form input');

  // Controlled runtime failure; never report this as a native device repro.
  const failed = await context();
  await failed.route('**/assets/erp-demo-runtime-impl-*.js', route => route.abort());
  const broken = await failed.newPage();
  await broken.goto(url, { waitUntil: 'domcontentloaded' });
  await broken.locator('#setupWizardView').waitFor({ timeout: 90000 });
  for (let step = 0; step < 6; step++) await broken.locator('#wizNext').click();
  assert.equal(await broken.locator('#wizFinish').isDisabled(), true);
  assert.equal(await broken.locator('#wizardShowcase').isDisabled(), true);
  assert.match(await broken.locator('#demoStartupStatus').innerText(), /has not been reset/);
  assert.equal(await broken.evaluate(() => localStorage.getItem('aria-setup-wizard-complete')), null);
  await failed.close();
  console.log('PASS failed runtime blocks writes and sample entry without resetting data');
} finally {
  await browser.close();
  preview?.kill('SIGTERM');
}
