/* Local-only browser recovery proof; no SMTP, external account or production DB. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import express from 'express';
import { chromium } from 'playwright';
import { eq } from 'drizzle-orm';
import { createApp } from '../../src/api/app';
import { freshDb } from '../../src/test/helpers';
import { seedDemo } from '../../src/data/seed';
import { appUser, platformPrincipal } from '../../src/data/schema';
import { hashPassword, verifyPassword } from '../../src/auth/password';
import { processOutboxBatch, type MailMessage } from '../../src/worker/outbox';

const db = await freshDb();
await seedDemo(db);
await db.insert(platformPrincipal).values({ principalKey: 'test-platform', displayName: 'Test Platform', passwordHash: hashPassword('test-platform-password') });
const key = Buffer.alloc(32, 23);
const host = express();
const mount = process.env.TASK193_TEST_MOUNT === '/erp' ? '/erp' : '';
const router = express.Router();
host.use(mount || '/', router);
const dist = path.resolve('web/dist');
router.use(express.static(dist));
const server = host.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const address = server.address();
assert(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}${mount}`;
router.get('/reset-password', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
router.use(createApp(db, { tokenEncryptionKey: key.toString('base64'), publicUrl: origin }));
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', () => errors.push('page_error'));
    if(width===1440){
      await page.goto(origin);
      await page.locator('#tenantRecoveryButton').waitFor();
      await page.locator('[data-realm="platform"]').click();
      assert(await page.locator('#tenantRecoveryButton').isHidden());
      await page.locator('[data-realm="tenant"]').click();
      await page.locator('#tenantRecoveryButton').click();
    }else{await page.goto(origin+'/reset-password');}
    await page.locator('#recoveryEmail').fill('admin@acme.co');
    await page.locator('#recoverySubmit').click();
    await page.waitForFunction(() => document.getElementById('recoveryStatus')?.textContent?.includes('eligible'));
    const sent: MailMessage[] = [];
    const result = await processOutboxBatch(db, { async send(message) { sent.push(message); } }, {
      tokenEncryptionKey: key, workerId: 'browser-recovery-mail-sink',
    });
    assert.equal(result.delivered, 1);
    const link = sent[0].text.match(/http:\/\/[^\s]+/)![0];
    const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token')!;
    if(width===375) await page.goto('about:blank');
    await page.goto(link);
    await page.locator('#recoveryPassword').waitFor();
    assert.equal(new URL(page.url()).hash, '');
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    assert(!storage.includes(token));
    await page.locator('#recoveryPassword').fill('browser-recovered-password');
    await page.locator('#recoveryConfirm').fill('different-password');
    await page.locator('#recoverySubmit').click();
    assert.match(await page.locator('#recoveryStatus').innerText(), /do not match/);
    await page.locator('#recoveryConfirm').fill('browser-recovered-password');
    await page.locator('#recoverySubmit').click();
    await page.waitForFunction(() => document.getElementById('recoveryStatus')?.textContent?.includes('updated'));
    const [user] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    assert(verifyPassword('browser-recovered-password', user.passwordHash));
    assert.equal(await page.locator('#recoveryPassword').inputValue(), '');
    assert(await page.locator('#recoverySubmit').isDisabled());
    assert(await page.evaluate(() => document.activeElement?.id === 'recoveryStatus'));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(tmpdir(), `erp-task193-recovery-${width}.png`) });
    await page.goto(link);
    await page.locator('#recoveryPassword').fill('replay-password');
    await page.locator('#recoveryConfirm').fill('replay-password');
    await page.locator('#recoverySubmit').click();
    await page.waitForFunction(() => document.getElementById('recoveryStatus')?.textContent?.includes('invalid'));
    assert.deepEqual(errors, []);
    await context.close();
  }
  for (const language of ['en', 'ms', 'zh', 'ja', 'vi']) {
    const pack = JSON.parse(await readFile(path.resolve(`web/public/assets/i18n/${language}.json`), 'utf8'));
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 375, height: 844 } });
      await context.addInitScript(({ language, theme }) => {
        localStorage.setItem('aria-lang', language);
        localStorage.setItem('aria-theme', theme);
      }, { language, theme });
      const page = await context.newPage();
      await page.goto(origin+'/reset-password');
      await page.locator('#recoveryEmail').waitFor();
      assert.equal(await page.locator('#authView h1').innerText(), pack['recovery.title']);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.route('**/api/auth/password-reset/actions/request', (route) => route.abort());
      await page.locator('#recoveryEmail').fill('unknown@example.test');
      await page.locator('#recoverySubmit').click();
      await page.waitForFunction((expected) => document.getElementById('recoveryStatus')?.textContent === expected, pack['recovery.failed']);
      assert(await page.locator('#recoverySubmit').isEnabled());
      await context.close();
    }
  }
  console.log('TASK-193 browser recovery passed: desktop/375px, mail link, mismatch, persistence, replay, token privacy and focus.');
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  const client = (db as unknown as { $client: { close(): Promise<void> } }).$client;
  await client.close();
}
