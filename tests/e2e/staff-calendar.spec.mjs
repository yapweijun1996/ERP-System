#!/usr/bin/env node
/*
 * Staff Calendar route contract.
 *
 * This is an isolated Demo-shell test. It stubs only the read adapter after
 * boot, so it verifies the HR entry point and staff filter without changing
 * production or a persistent database.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.STAFF_CALENDAR_E2E_PORT || '4316';
const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = 60000;

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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`[console.error] ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  try {
    await page.addInitScript(() => {
      localStorage.setItem('aria-setup-wizard-complete', '1');
      localStorage.setItem('aria-demo-auth', JSON.stringify({
        signedIn: true,
        email: 'admin@acme.co',
        at: new Date(0).toISOString(),
      }));
    });
    await page.goto(`${BASE_URL}/?staff-calendar-e2e=${Date.now()}#dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForFunction(() => window.ErpSystemData && window.navigate, { timeout: TIMEOUT });

    await page.evaluate(() => {
      const employee = {
        id: 42, employeeNo: 'EMP-1042', fullName: 'Marcus Silva',
        department: 'Warehouse', jobTitle: 'Warehouse Supervisor',
      };
      const row = {
        id: 'leave:104', sourceId: 104, eventKind: 'leave', employeeId: employee.id, employeeNo: employee.employeeNo,
        employeeName: employee.fullName, department: employee.department,
        jobTitle: employee.jobTitle, leaveType: 'Annual',
        startDate: '2026-01-01', endDate: '2026-12-31', days: 365,
        status: 'approved', conflict: false, conflictCount: 0, sync: null,
      };
      const appointment = {
        id: 'appointment:205', sourceId: 205, eventKind: 'appointment', employeeId: employee.id,
        employeeNo: employee.employeeNo, employeeName: employee.fullName,
        department: employee.department, jobTitle: employee.jobTitle,
        appointmentType: 'client_visit', leaveType: 'client_visit', eventTitle: 'Client site visit',
        title: 'Client site visit', description: 'Review access requirements.', location: 'Beta site',
        startAt: '2026-08-06T02:00:00.000Z', endAt: '2026-08-06T03:00:00.000Z',
        startDate: '2026-08-06', endDate: '2026-08-06', days: null,
        status: 'scheduled', recordVersion: 1, conflict: false, conflictCount: 0,
        sync: null,
      };
      let createdAppointments = 0;
      ErpSystemData.list = async (resource) => {
        const response = resource === 'hr/employees'
          ? { data: [{ ...employee, isActive: true }], meta: { nextCursor: null } }
          : { data: [{ id: row.id, employeeId: row.employeeId, leaveType: row.leaveType,
            startDate: row.startDate, endDate: row.endDate, days: row.days, status: row.status }],
          meta: { nextCursor: null } };
        return response;
      };
      ErpSystemData.staffCalendar = async () => ({
        data: { items: [row, appointment], departments: ['Warehouse'] },
        meta: { canCompany: true, canManage: true },
      });
      ErpSystemData.createStaffAppointment = async (payload) => {
        createdAppointments += 1;
        return { data: { id: 206, ...payload, recordVersion: 1 } };
      };
      navigate('staff-calendar');
      window.__staffCalendarCreatedAppointments = () => createdAppointments;
    });

    const shell = page.locator('[data-staff-calendar]');
    await shell.waitFor({ state: 'visible', timeout: TIMEOUT });
    assert(await page.locator('h1').filter({ hasText: 'Staff Calendar' }).count() === 1,
      'Staff Calendar heading must render');
    assert(await page.locator('.sales-subnav [aria-selected="true"]')
      .getByText('Staff Calendar', { exact: true }).count() === 1,
    'HR navigation must select Staff Calendar');
    assert(await page.locator('[data-calendar-staff]').count() === 1,
      'staff filter must render');
    assert(await page.getByRole('button', { name: /Marcus Silva.*Approved/ }).count() > 0,
      'leave event must render in the staff calendar');
    assert(await page.getByRole('button', { name: /Marcus Silva.*Client site visit.*Scheduled/ }).count() > 0,
      'appointment event must render alongside leave');
    assert(await page.getByRole('button', { name: 'Add appointment' }).count() === 1,
      'HR users with write access must see Add appointment');
    await page.getByRole('button', { name: 'Add appointment' }).click();
    await page.locator('[data-appointment-title]').fill('New staff appointment');
    await page.getByRole('button', { name: 'Save appointment' }).click();
    await page.waitForFunction(() => window.__staffCalendarCreatedAppointments?.() === 1, null, { timeout: TIMEOUT });
    await page.locator('[data-calendar-staff]').selectOption('42');
    assert(await page.getByRole('button', { name: /Marcus Silva.*Approved/ }).count() > 0,
      'staff filter must retain the selected employee event');

    await page.locator('button[data-calendar-view="list"]').click();
    await page.locator('[data-table-listing]').waitFor({ state: 'visible', timeout: TIMEOUT });
    assert(await page.locator('[data-table-listing-search]').count() === 1,
      'staff list must expose the shared search input');
    assert(await page.getByText('Duration', { exact: true }).count() === 1,
      'staff list must label leave duration as working days');
    await page.locator('[data-table-listing-search]').fill('not-a-real-staff');
    assert(await page.locator('[data-table-listing-empty]').count() === 1,
      'staff list must show a clear empty state for unmatched search');
    await page.locator('[data-table-listing-search]').fill('Marcus');
    assert(await page.getByText('Marcus Silva', { exact: true }).count() > 0,
      'staff list search must restore matching event rows');
    assert(browserErrors.length === 0, `browser errors detected:\n${browserErrors.join('\n')}`);
    console.log('PASS Staff Calendar E2E: mixed events, appointment create, filter and searchable list render');
  } finally {
    await context.close();
    await browser.close();
    preview.kill();
  }
}

main().catch((error) => {
  console.error(`FAIL Staff Calendar E2E: ${error.stack || error.message}`);
  process.exitCode = 1;
});
