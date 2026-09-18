#!/usr/bin/env node
// Staff creation must produce an immediately usable account in the real Demo adapter.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = process.env.STAFF_ACCOUNT_E2E_PORT || '4432';
const base = `http://localhost:${port}`;
const server = spawn(path.join(root, 'web/node_modules/.bin/vite'),
  ['preview', '--port', port, '--strictPort'], { cwd: path.join(root, 'web'), stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(base)).ok) break; } catch { /* Preview startup. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await chromium.launch();
  for (const width of [1280, 445, 390, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      if (!localStorage.getItem('staff-immediate-fixture')) {
        localStorage.setItem('staff-immediate-fixture', '1');
        localStorage.setItem('aria-setup-wizard-complete', '1');
        localStorage.setItem('aria-demo-auth', JSON.stringify({ signedIn: true, email: 'admin@acme.co', at: new Date().toISOString() }));
      }
    });
    await page.goto(`${base}/#new-employee`);
    await page.locator('#neName').waitFor({ state: 'visible', timeout: 60000 });
    await page.locator('#neName').fill('Synthetic Immediate Staff');
    await page.locator('#neEmail').fill('immediate.staff@example.test');
    await page.locator('#neDept').fill('Synthetic Testing');
    await page.locator('#neTitle').fill('Test Operator');
    await page.locator('#neSalary').fill('1000');
    await page.locator('#neNext').click();
    if (await page.locator('#nePassword').count()) throw new Error('Manual password input still exists');
    if (await page.getByText('First use or 7 days', { exact: true }).count()) throw new Error('Obsolete activation expiry shown');
    await page.locator('#neNext').click();
    const onboardingLayout = await page.evaluate(() => {
      const stepper = document.querySelector('.staff-onboarding-progress .stepper');
      const steps = [...(stepper?.querySelectorAll('.step') || [])];
      const roleGrid = document.querySelector('.staff-onboarding-role-grid');
      const roleOptions = [...(roleGrid?.querySelectorAll('.staff-onboarding-role-option') || [])];
      const rects = roleOptions.map(option => option.getBoundingClientRect());
      return {
        stepCount: steps.length,
        stepRows: new Set(steps.map(step => Math.round(step.getBoundingClientRect().top))).size,
        stepOverflow: stepper ? stepper.scrollWidth - stepper.clientWidth : Number.POSITIVE_INFINITY,
        roleColumns: roleGrid ? getComputedStyle(roleGrid).gridTemplateColumns.split(/\s+/).filter(Boolean).length : 0,
        roleCount: roleOptions.length,
        roleMinHeight: rects.length ? Math.min(...rects.map(rect => rect.height)) : 0,
        roleBottom: rects.length ? Math.max(...rects.map(rect => rect.bottom)) : 0,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (onboardingLayout.stepCount !== 3
      || onboardingLayout.stepRows !== 1
      || onboardingLayout.stepOverflow > 1
      || onboardingLayout.roleCount < 1
      || onboardingLayout.roleMinHeight < 44
      || onboardingLayout.documentOverflow > 1) {
      throw new Error(`Onboarding layout regressed at ${width}px: ${JSON.stringify(onboardingLayout)}`);
    }
    if (width <= 560 && onboardingLayout.roleColumns !== 1) {
      throw new Error(`Mobile role options should be one column at ${width}px: ${JSON.stringify(onboardingLayout)}`);
    }
    await page.locator('input[name="neRole"]').first().focus();
    const focusState = await page.evaluate(() => {
      const input = document.querySelector('input[name="neRole"]:focus');
      const option = input?.closest('.staff-onboarding-role-option');
      return { focused: Boolean(input), focusRing: option ? getComputedStyle(option).boxShadow !== 'none' : false };
    });
    if (!focusState.focused || !focusState.focusRing) throw new Error(`Role focus state is not visible at ${width}px`);
    const viewer = page.locator('.check-row').filter({ hasText: 'Viewer' });
    if (await viewer.count()) await viewer.first().locator('input').check();
    else await page.locator('input[name="neRole"]').first().check();
    await page.locator('#neNext').click();
    await page.locator('[data-employee-account-reveal]').waitFor({ state: 'visible', timeout: 60000 });
    if (await page.evaluate(() => DB.user.impersonating)) throw new Error('HR was moved into employee identity before handoff');
    const account = await page.evaluate(async () => {
      const rows = await ErpSystemData.db.query(
        'select user_id,account_state,password_change_required,initial_password_expires_at from app_user where master_fn=$1 and email=$2',
        [DB.erpSystem.scope.masterFn, 'immediate.staff@example.test']);
      return rows.rows[0];
    });
    if (account.account_state !== 'active' || account.password_change_required || account.initial_password_expires_at) {
      throw new Error(`Account not immediately ready: ${JSON.stringify(account)}`);
    }
    await page.locator('[data-employee-account-reveal]').click();
    await page.locator('[data-account-copy]').click();
    await page.getByText('Password copied', { exact: true }).waitFor();
    const generatedPassword = await page.evaluate(() => navigator.clipboard.readText());
    if (!/^Aria-[A-Za-z0-9_-]{32}!$/.test(generatedPassword)) throw new Error('Generated password entropy/format contract failed');
    await page.locator('[data-account-email-generate]').click();
    await page.locator('#employeeAccountEmailTemplate:not([hidden])').waitFor();
    const template = await page.locator('#employeeAccountEmailTemplate').inputValue();
    if (!template.includes(generatedPassword) || !template.includes('Synthetic Immediate Staff')
      || !template.includes('Organization code: ACME') || !template.includes('No activation is required.')
      || !template.includes('immediate.staff@example.test')) throw new Error('Email template is incomplete');
    await page.locator('[data-account-email-copy]').click();
    await page.getByText('Email copied', { exact: true }).waitFor();
    if (await page.evaluate(() => navigator.clipboard.readText()) !== template) throw new Error('Copied email does not match preview');
    await page.waitForFunction(() => !document.querySelector('.toast'), null, {timeout:10000});
    if (await page.evaluate(() => { const r=document.querySelector('#modalEl').getBoundingClientRect(); return r.left<0 || r.right>innerWidth+1 || r.top<0 || r.bottom>innerHeight+1; })) throw new Error('Credential dialog exceeds viewport');
    await page.screenshot({path:`/tmp/erp-auto-password-handoff-${width}.png`,mask:[page.locator('#employeeAccountEmailTemplate')]});
    await page.evaluate(() => {
      window.restoreCredentialClipboard = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied by test fixture'); };
    });
    await page.locator('[data-account-copy]').click();
    await page.getByText('Unable to access or copy the credential. Check your access and clipboard permission, then try again.',{exact:true}).waitFor();
    await page.evaluate(() => { navigator.clipboard.writeText = window.restoreCredentialClipboard; delete window.restoreCredentialClipboard; });

    const persisted = await page.evaluate(async () => {
      const secrets = await ErpSystemData.db.query('select * from employee_activation_secret');
      const audit = await ErpSystemData.db.query('select * from audit_log');
      return JSON.stringify({ secrets: secrets.rows, audit: audit.rows, storage: { ...localStorage } });
    });
    if (persisted.includes(generatedPassword)) throw new Error('Plaintext credential persisted');
    await page.evaluate(() => closeModal());
    await page.locator('#employeeAccountEmailTemplate').waitFor({ state: 'detached' });
    await page.evaluate(() => signOutDemo());
    await page.locator('#loginEmail').waitFor({ state: 'visible', timeout: 60000 });
    const authFoot = await page.locator('.auth-foot').innerText();
    if (/activation/i.test(authFoot)) throw new Error('Obsolete activation copy shown on the login page');
    if (!/Account access is ready immediately|One-click access is limited to showcase personas/.test(authFoot)) {
      throw new Error('Supported account access copy is missing from the login page');
    }
    await page.locator('#loginEmail').fill('immediate.staff@example.test');
    await page.locator('#loginPassword').fill(generatedPassword);
    await page.locator('#loginForm button[type="submit"]').click();
    await page.waitForFunction(() => typeof DB !== 'undefined' && DB.user?.email === 'immediate.staff@example.test'
      && !document.body.classList.contains('auth-locked'), null, { timeout: 60000 });
    if (await page.evaluate(() => DB.user.impersonating || localStorage.getItem('aria-demo-impersonator-email'))) {
      throw new Error('Direct employee login retained administrator impersonation');
    }
    const denied = await page.evaluate(async userId => {
      const result = await ErpSystemData.db.query('select id from employee where user_id=$1',[userId]);
      try { await ErpSystemData.action('hr/employee-accounts',result.rows[0].id,'reveal-temporary-password',{}); return false; }
      catch { return true; }
    }, account.user_id);
    if (!denied) throw new Error('Employee could reveal HR credential handoff');
    await page.evaluate(() => navigate('my-receipts'));
    await page.getByRole('heading', { name: 'My Receipts', exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Take photo', exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Choose file', exact: true }).waitFor({ state: 'visible' });
    if (await page.locator('[data-receipt-camera]').count() !== 1
      || await page.locator('[data-receipt-file]').count() !== 1) {
      throw new Error('Authorized employee receipt capture controls are missing');
    }
    const receiptLayout = await page.evaluate(() => {
      const shell = document.querySelector('[data-receipt-capture="canonical"]');
      const scroller = document.querySelector('.scrollarea');
      const consent = shell?.querySelector('.receipt-capture-consent');
      const actions = [...(shell?.querySelectorAll('[data-list-toolbar-action]') || [])]
        .filter((element) => element.getClientRects().length)
        .map((element) => element.getBoundingClientRect());
      const shellStyle = shell ? getComputedStyle(shell) : null;
      return {
        shell: Boolean(shell),
        consentHeight: consent?.getBoundingClientRect().height || 0,
        actionHeights: actions.map((rect) => rect.height),
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        shellOverflow: shell ? shell.scrollWidth - shell.clientWidth : Number.POSITIVE_INFINITY,
        shellPaddingBottom: shellStyle ? parseFloat(shellStyle.paddingBottom) : 0,
        verticalScrollOwners: shell
          ? [scroller, shell, ...shell.querySelectorAll('*')].filter(Boolean).filter((element) => {
            const overflow = getComputedStyle(element).overflowY;
            return (overflow === 'auto' || overflow === 'scroll')
              && element.scrollHeight > element.clientHeight + 1;
          }).length
          : 0,
      };
    });
    if (!receiptLayout.shell || receiptLayout.documentOverflow > 1 || receiptLayout.shellOverflow > 1) {
      throw new Error(`Receipt capture shell overflows at ${width}px: ${JSON.stringify(receiptLayout)}`);
    }
    if (width <= 980 && (receiptLayout.consentHeight < 44
      || receiptLayout.actionHeights.some((height) => height < 44)
      || receiptLayout.shellPaddingBottom < 70
      || receiptLayout.verticalScrollOwners !== 1)) {
      throw new Error(`Receipt capture touch/scroll layout regressed at ${width}px: ${JSON.stringify(receiptLayout)}`);
    }
    await page.evaluate(() => {
      const scroller = document.querySelector('.scrollarea');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    const receiptBottom = await page.evaluate(() => {
      const scroller = document.querySelector('.scrollarea');
      const empty = document.querySelector('[data-receipt-capture="canonical"] [data-list-empty]');
      if (!scroller || !empty) return null;
      return {
        emptyBottom: empty.getBoundingClientRect().bottom,
        scrollAreaBottom: scroller.getBoundingClientRect().bottom,
      };
    });
    if (width <= 980 && (!receiptBottom || receiptBottom.emptyBottom > receiptBottom.scrollAreaBottom + 1)) {
      throw new Error(`Receipt empty state is hidden behind mobile navigation at ${width}px: ${JSON.stringify(receiptBottom)}`);
    }
    if (await page.locator('#activationForm').count()) throw new Error('Activation form still exists');
    if (await page.getByRole('heading', { name: 'Employee self service is unavailable' }).count()) throw new Error('Employee link missing');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error('Horizontal overflow');
    if (errors.length) throw new Error(errors.join('\n'));
    await page.screenshot({ path: `/tmp/erp-account-immediate-${width}.png`, fullPage: true });
    console.log(`PASS immediate staff creation and direct login: ${width}px`);
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
