#!/usr/bin/env node
/*
 * First-run setup wizard layout contract.
 *
 * The compact Language step must fit its standard portrait and split-pane
 * viewports without scrolling. Longer data-entry steps remain independently
 * scrollable; this test also protects the progress rail from horizontal
 * overflow on iOS-sized viewports.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.SETUP_WIZARD_E2E_PORT || '4321';
const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = 60000;

function assertResponsiveProgress(viewport, progress, stage) {
  if (viewport.width > 980) return;
  if (progress.stepCount !== 7) {
    throw new Error(`${viewport.label} ${stage}: expected seven setup markers, got ${progress.stepCount}`);
  }
  if (progress.scrollWidth > progress.clientWidth + 1) {
    throw new Error(`${viewport.label} ${stage}: progress rail horizontal overflow ${progress.scrollWidth}>${progress.clientWidth}`);
  }
  if (progress.lastStepRight > progress.right + 1) {
    throw new Error(`${viewport.label} ${stage}: last marker extends beyond the progress rail`);
  }
  if (progress.rowCount !== 1) {
    throw new Error(`${viewport.label} ${stage}: progress markers wrapped into ${progress.rowCount} rows`);
  }
  if (progress.currentLabelDisplay === 'none' || progress.currentLabelWidth < 1 || !progress.currentAriaLabel) {
    throw new Error(`${viewport.label} ${stage}: current progress label is not visibly and accessibly named`);
  }
}

if (!existsSync(DIST_INDEX)) {
  console.error('web/dist/index.html not found. Run "npm run build:demo" first.');
  process.exit(1);
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (async function poll() {
      while (Date.now() < deadline) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            resolve();
            return;
          }
        } catch {
          // Vite is still starting.
        }
        await new Promise((resume) => setTimeout(resume, 250));
      }
      reject(new Error(`${url} did not respond within ${timeoutMs}ms`));
    }());
  });
}

async function startPreview() {
  const viteBin = path.join(WEB_DIR, 'node_modules', '.bin', 'vite');
  if (!existsSync(viteBin)) throw new Error(`${viteBin} not found — run npm ci --prefix web first.`);
  const processHandle = spawn(viteBin, ['preview', '--port', PORT, '--strictPort'], {
    cwd: WEB_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  processHandle.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  let exited = false;
  processHandle.on('exit', () => { exited = true; });
  try {
    await waitForServer(BASE_URL, 15000);
  } catch (error) {
    processHandle.kill();
    throw exited
      ? new Error(`vite preview exited before becoming ready. stderr:\n${stderr}`)
      : error;
  }
  return processHandle;
}

async function main() {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { label: 'desktop', width: 1280, height: 900 },
    { label: 'split-pane', width: 753, height: 837 },
    { label: 'iPhone', width: 390, height: 844 },
    { label: 'small-mobile', width: 375, height: 812 },
  ];

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      const runtimeErrors = [];
      page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
      });
      try {
        await page.goto(`${BASE_URL}/?setup-wizard-e2e=${viewport.label}-${Date.now()}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await page.locator('#setupWizardView').waitFor({ state: 'visible', timeout: TIMEOUT });
        await page.locator('#wizLangSeg .wiz-language-card').first().waitFor({ state: 'visible', timeout: TIMEOUT });

        const layout = await page.evaluate(() => {
          const panel = document.querySelector('#setupWizardView .wizard-panel');
          const continueButton = document.querySelector('#wizNext');
          const cards = [...document.querySelectorAll('#wizLangSeg .wiz-language-card')];
          const stepper = document.querySelector('#setupWizardView .stepper');
          const steps = stepper ? [...stepper.querySelectorAll('.step')] : [];
          const currentStep = stepper?.querySelector('.step.current');
          const currentLabel = currentStep?.querySelector('.step-label');
          if (!panel || !continueButton || !stepper || !currentStep || !currentLabel) {
            throw new Error('setup wizard language step or progress rail did not render');
          }
          panel.scrollLeft = 999;
          panel.scrollTop = 999;
          window.scrollTo(0, 999);
          const stepperRect = stepper.getBoundingClientRect();
          const panelRect = panel.getBoundingClientRect();
          const continueRect = continueButton.getBoundingClientRect();
          return {
            panelClientWidth: panel.clientWidth,
            panelScrollWidth: panel.scrollWidth,
            panelScrollLeft: panel.scrollLeft,
            panelClientHeight: panel.clientHeight,
            panelScrollHeight: panel.scrollHeight,
            panelScrollTop: panel.scrollTop,
            panelOverflowX: getComputedStyle(panel).overflowX,
            cards: cards.length,
            smallestCardHeight: Math.min(...cards.map((card) => card.getBoundingClientRect().height)),
            widestCardScrollDelta: Math.max(...cards.map((card) => card.scrollWidth - card.clientWidth)),
            lowestCardBottom: Math.max(...cards.map((card) => card.getBoundingClientRect().bottom)),
            panelBottom: panelRect.bottom,
            continueBottom: continueRect.bottom,
            continueVisible: Boolean(continueButton.offsetParent),
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            documentClientHeight: document.documentElement.clientHeight,
            documentScrollHeight: document.documentElement.scrollHeight,
            documentScrollTop: document.scrollingElement?.scrollTop || 0,
            progress: {
              stepCount: steps.length,
              clientWidth: stepper.clientWidth,
              scrollWidth: stepper.scrollWidth,
              right: stepperRect.right,
              lastStepRight: steps.at(-1).getBoundingClientRect().right,
              rowCount: new Set(steps.map((step) => Math.round(step.getBoundingClientRect().top))).size,
              currentLabelDisplay: getComputedStyle(currentLabel).display,
              currentLabelWidth: currentLabel.getBoundingClientRect().width,
              currentAriaLabel: currentStep.getAttribute('aria-label'),
            },
          };
        });

        if (viewport.width <= 980 && layout.panelScrollWidth > layout.panelClientWidth + 1) {
          throw new Error(`${viewport.label}: wizard panel horizontal overflow ${layout.panelScrollWidth}>${layout.panelClientWidth}`);
        }
        if (layout.documentScrollWidth > layout.documentClientWidth + 1) {
          throw new Error(`${viewport.label}: document horizontal overflow ${layout.documentScrollWidth}>${layout.documentClientWidth}`);
        }
        if (viewport.width <= 980 && layout.panelScrollLeft !== 0) {
          throw new Error(`${viewport.label}: wizard panel starts with horizontal scrollLeft ${layout.panelScrollLeft}`);
        }
        if (layout.panelScrollHeight > layout.panelClientHeight + 1 || layout.panelScrollTop !== 0) {
          throw new Error(`${viewport.label}: language panel does not fit without vertical scrolling: ${layout.panelScrollHeight}>${layout.panelClientHeight}, scrollTop ${layout.panelScrollTop}`);
        }
        if (layout.documentScrollHeight > layout.documentClientHeight + 1 || layout.documentScrollTop !== 0) {
          throw new Error(`${viewport.label}: language page does not fit without document scrolling: ${layout.documentScrollHeight}>${layout.documentClientHeight}, scrollTop ${layout.documentScrollTop}`);
        }
        if (layout.lowestCardBottom > layout.panelBottom + 1 || layout.continueBottom > layout.panelBottom + 1) {
          throw new Error(`${viewport.label}: language choice or Continue button is clipped: ${JSON.stringify(layout)}`);
        }
        if (layout.smallestCardHeight < 44 || layout.widestCardScrollDelta > 1) {
          throw new Error(`${viewport.label}: language cards lost touch size or overflowed: ${JSON.stringify(layout)}`);
        }
        if (viewport.width > 980 && layout.panelOverflowX !== 'hidden') {
          throw new Error(`${viewport.label}: desktop wizard panel should clip decorative overflow`);
        }
        if (layout.cards !== 5 || !layout.continueVisible) {
          throw new Error(`${viewport.label}: language cards or Continue button regressed: ${JSON.stringify(layout)}`);
        }
        assertResponsiveProgress(viewport, layout.progress, 'language');

        if (viewport.width <= 560) {
          await page.locator('#wizLangSeg button[data-v="zh"]').click();
          const localizedLayout = await page.evaluate(() => {
            const panel = document.querySelector('#setupWizardView .wizard-panel');
            const continueButton = document.querySelector('#wizNext');
            if (!panel || !continueButton) throw new Error('localized language step did not render');
            panel.scrollTop = 999;
            window.scrollTo(0, 999);
            const panelRect = panel.getBoundingClientRect();
            const continueRect = continueButton.getBoundingClientRect();
            return {
              panelClientHeight: panel.clientHeight,
              panelScrollHeight: panel.scrollHeight,
              panelScrollTop: panel.scrollTop,
              panelBottom: panelRect.bottom,
              continueBottom: continueRect.bottom,
              documentClientHeight: document.documentElement.clientHeight,
              documentScrollHeight: document.documentElement.scrollHeight,
              documentScrollTop: document.scrollingElement?.scrollTop || 0,
              language: document.documentElement.lang,
            };
          });
          if (localizedLayout.language !== 'zh-Hans'
            || localizedLayout.panelScrollHeight > localizedLayout.panelClientHeight + 1
            || localizedLayout.panelScrollTop !== 0
            || localizedLayout.documentScrollHeight > localizedLayout.documentClientHeight + 1
            || localizedLayout.documentScrollTop !== 0
            || localizedLayout.continueBottom > localizedLayout.panelBottom + 1) {
            throw new Error(`${viewport.label}: compact Chinese language step regressed: ${JSON.stringify(localizedLayout)}`);
          }
        }

        if (viewport.width <= 980) {
          await page.locator('#wizNext').click();
          await page.locator('#wizMaster').waitFor({ state: 'visible', timeout: TIMEOUT });
          const progressed = await page.evaluate(() => {
            const stepper = document.querySelector('#setupWizardView .stepper');
            const steps = stepper ? [...stepper.querySelectorAll('.step')] : [];
            const currentStep = stepper?.querySelector('.step.current');
            const currentLabel = currentStep?.querySelector('.step-label');
            if (!stepper || !currentStep || !currentLabel) throw new Error('setup wizard progress rail did not update');
            const stepperRect = stepper.getBoundingClientRect();
            return {
              stepCount: steps.length,
              clientWidth: stepper.clientWidth,
              scrollWidth: stepper.scrollWidth,
              right: stepperRect.right,
              lastStepRight: steps.at(-1).getBoundingClientRect().right,
              rowCount: new Set(steps.map((step) => Math.round(step.getBoundingClientRect().top))).size,
              currentLabelDisplay: getComputedStyle(currentLabel).display,
              currentLabelWidth: currentLabel.getBoundingClientRect().width,
              currentAriaLabel: currentStep.getAttribute('aria-label'),
            };
          });
          assertResponsiveProgress(viewport, progressed, 'organization');
        }

        if (viewport.label === 'desktop') {
          await page.locator('#wizNext').click();
          await page.locator('#wizMaster').waitFor({ state: 'visible', timeout: TIMEOUT });
          await page.locator('#wizNext').click();
          await page.locator('#wizCompany').waitFor({ state: 'visible', timeout: TIMEOUT });
          await page.locator('#wizNext').click();
          await page.locator('#wizAdminName').waitFor({ state: 'visible', timeout: TIMEOUT });
          await page.locator('#wizNext').click();
          await page.locator('#wizModuleSeg input[data-module-key]').first().waitFor({ state: 'visible', timeout: TIMEOUT });

          const moduleState = await page.evaluate(() => {
            const inputs = [...document.querySelectorAll('#wizModuleSeg input[data-module-key]')];
            return {
              count: inputs.length,
              selected: inputs.filter((input) => input.checked).map((input) => input.dataset.moduleKey),
              hasPlannedAttendance: document.querySelector('.wiz-module-plan')?.textContent || '',
              horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            };
          });
          if (moduleState.count !== 17
            || JSON.stringify(moduleState.selected) !== JSON.stringify(['hr', 'expenses_tax'])
            || !moduleState.hasPlannedAttendance.includes('Time & attendance')
            || moduleState.horizontalOverflow > 1) {
            throw new Error(`desktop: module activation defaults or layout regressed: ${JSON.stringify(moduleState)}`);
          }

          await page.locator('#wizModuleSeg input[data-module-key="sales"]').click();
          if (!await page.locator('#wizModuleSeg input[data-module-key="finance"]').isChecked()) {
            throw new Error('desktop: selecting Sales did not select required Finance dependency');
          }
          await page.locator('#wizNext').click();
          await page.locator('#wizProvider').waitFor({ state: 'visible', timeout: TIMEOUT });
          await page.locator('#wizNext').click();
          await page.locator('#wizFinish').waitFor({ state: 'visible', timeout: TIMEOUT });
        }

        if (viewport.label === 'desktop' || viewport.label === 'small-mobile') {
          await page.evaluate(async () => {
            const adapter = window.ErpSystemData;
            const changed = await adapter.db.query(
              "update master_module set enabled=false where master_fn=$1 and module_key in ('expenses_tax','inventory') returning module_key",
              [DB.erpSystem.scope.masterFn],
            );
            if (changed.rows.length !== 2) throw new Error('Existing-Master fixture was not applied');
            await adapter.refresh();
            renderSetupWizard();
          });
          await page.locator('#wizNext').click();
          await page.locator('#wizNext').click();
          await page.locator('#wizCompany').fill('Synthetic Wizard Regression');
          await page.locator('#wizNext').click();
          await page.locator('#wizAdminUsername').fill('wizard.regression');
          await page.locator('#wizAdminEmail').fill('wizard.regression@example.test');
          await page.locator('#wizAdminPassword').fill('fixture-only-password');
          await page.locator('#wizAdminPasswordConfirm').fill('fixture-only-password');
          await page.locator('#wizNext').click();
          const restricted = await page.evaluate(() => {
            const inputs = [...document.querySelectorAll('#wizModuleSeg input[data-module-key]')];
            return {
              disabled: inputs.filter(input => input.disabled).map(input => input.dataset.moduleKey),
              selected: inputs.filter(input => input.checked).map(input => input.dataset.moduleKey),
              explanation: document.querySelector('[data-module-card="expenses_tax"]').textContent,
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            };
          });
          if (!['expenses_tax', 'inventory', 'warehouse', 'manufacturing', 'quality'].every(key => restricted.disabled.includes(key))
            || restricted.selected.includes('expenses_tax') || !restricted.selected.includes('hr')
            || !restricted.explanation.includes('Platform activation') || restricted.overflow > 1) {
            throw new Error(`${viewport.label}: existing-Master availability regressed: ${JSON.stringify(restricted)}`);
          }
          await page.locator('#wizNext').click();
          await page.locator('#wizNext').click();
          await page.locator('#wizFinish').click();
          await page.waitForFunction(() => localStorage.getItem('aria-setup-wizard-complete') === '1', null, { timeout: TIMEOUT });
        }

        if (runtimeErrors.length) {
          throw new Error(`${viewport.label}: setup wizard emitted runtime errors: ${runtimeErrors.join(' | ')}`);
        }
        console.log(`PASS setup wizard layout E2E: ${viewport.label}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    preview.kill();
  }
}

main().catch((error) => {
  console.error(`FAIL setup wizard layout E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
