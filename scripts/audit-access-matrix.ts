#!/usr/bin/env tsx
/**
 * Browser-side half of the authorization matrix.
 *
 * The API half lives in permissionMatrix.integration.test.ts. This audit
 * boots the actual demo bundle, reads the live SCREENS/SCREEN_META registry,
 * and evaluates routeAllowed() with every catalog role. It catches the class
 * of bug where an API is protected but a forbidden route remains visible (or
 * where a route's module metadata drifts from its nav entry).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ROLE_TEMPLATES } from '../src/auth/accessCatalog';
import { ACCESS_MATRIX, type AccessMatrixEntry } from '../src/auth/accessMatrix';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB_DIR = path.join(ROOT, 'web');
const DIST_INDEX = path.join(WEB_DIR, 'dist', 'index.html');
const PORT = process.env.ACCESS_MATRIX_AUDIT_PORT || '4317';
const BASE_URL = `http://localhost:${PORT}`;
const TIMEOUT = 60000;

type RoleFixture = {
  key: string;
  permissions: readonly string[];
};

type ScreenMeta = {
  route: string;
  module: string;
};

if (!existsSync(DIST_INDEX)) {
  throw new Error('web/dist/index.html not found. Run "npm run build:demo" first.');
}

const ROLE_FIXTURES: readonly RoleFixture[] = ROLE_TEMPLATES
  .filter((template) => !template.deprecated)
  .map((template) => ({
  key: template.key,
  permissions: template.permissions,
}));

function waitForServer(url: string, timeoutMs: number): Promise<void> {
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
  processHandle.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
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

function expectedRouteAccess(entry: AccessMatrixEntry, role: RoleFixture): boolean {
  if (entry.authenticated) return true;
  if (entry.allowedRoles && !entry.allowedRoles.includes(role.key)) return false;
  const all = (entry.requiredAll ?? []).every((permission) => role.permissions.includes(permission));
  const any = (entry.requiredAny ?? []).length === 0
    || (entry.requiredAny ?? []).some((permission) => role.permissions.includes(permission));
  return all && any;
}

async function main(): Promise<void> {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`[console.error] ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`));

  const assert = (condition: boolean, message: string): void => {
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
    await page.goto(`${BASE_URL}/?access-matrix=${Date.now()}#dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForFunction(
      () => window.ErpSystemData && window.navigate && typeof routeAllowed === 'function',
      { timeout: TIMEOUT },
    );

    const registry = await page.evaluate(() => ({
      routes: Object.keys(SCREENS),
      meta: window.SCREEN_META as Record<string, ScreenMeta>,
      routeAllowedType: typeof routeAllowed,
    }));
    assert(registry.routeAllowedType === 'function', 'routeAllowed() is not available to the browser shell.');
    const matrixRoutes = new Set(ACCESS_MATRIX.map((entry) => entry.route));
    const missingRoutes = ACCESS_MATRIX
      .filter((entry) => !registry.routes.includes(entry.route))
      .map((entry) => entry.route);
    assert(missingRoutes.length === 0, `Access matrix routes are not registered: ${missingRoutes.join(', ')}`);
    const metadataDrift = ACCESS_MATRIX
      .filter((entry) => registry.meta[entry.route]?.module !== entry.module)
      .map((entry) => `${entry.route}: expected ${entry.module}, got ${registry.meta[entry.route]?.module ?? 'missing'}`);
    assert(metadataDrift.length === 0, `Screen metadata drifted from access matrix: ${metadataDrift.join('; ')}`);

    const emptyPermissionRoutes = await page.evaluate((routes) => {
      DB.user = {
        name: 'Matrix Empty', email: 'matrix-empty@example.com', permissionKeys: [],
        is_superadmin: false,
      };
      DB.myWorkContext = null;
      MY_WORK_CONTEXT = null;
      return routes.filter((route) => routeAllowed(route));
    }, registry.routes);
    const intentionallyAuthenticated = new Set(
      ACCESS_MATRIX.filter((entry) => entry.authenticated).map((entry) => entry.route),
    );
    const unexpectedEmptyPermissionRoutes = emptyPermissionRoutes.filter(
      (route) => !intentionallyAuthenticated.has(route),
    );
    assert(unexpectedEmptyPermissionRoutes.length === 0,
      `Routes became visible without permissions: ${unexpectedEmptyPermissionRoutes.join(', ')}`);

    const browserMatrix = ACCESS_MATRIX.map((entry) => ({
      id: entry.id,
      route: entry.route,
      module: entry.module,
      requiredAny: entry.requiredAny,
      requiredAll: entry.requiredAll,
      allowedRoles: entry.allowedRoles,
      authenticated: entry.authenticated,
    }));
    for (const role of ROLE_FIXTURES) {
      const actual = await page.evaluate(async (input) => {
        DB.user = {
          name: `Matrix ${input.key}`,
          email: `matrix-${input.key}@example.com`,
          permissionKeys: [...input.permissions],
          is_superadmin: false,
          is_company_owner: input.key === 'company_owner',
        };
        DB.myWorkContext = {
          capabilities: {
            team: { available: input.key === 'company_owner' || input.key === 'superadmin' || input.key === 'manager' },
          },
        };
        MY_WORK_CONTEXT = DB.myWorkContext;
        DB.erpSystem = {
          ...(DB.erpSystem || {}),
          modules: [...new Set(input.entries.map((entry) => entry.module))]
            .filter((moduleKey) => !['home', 'mywork', 'admin', 'settings', 'account'].includes(moduleKey))
            .map((moduleKey) => ({ moduleKey, enabled: true })),
        };
        await loadModuleControl();
        return Object.fromEntries(input.entries.map((entry) => [entry.id, routeAllowed(entry.route)]));
      }, {
        key: role.key,
        permissions: role.permissions,
        entries: browserMatrix,
      });
      for (const entry of ACCESS_MATRIX) {
        const expected = expectedRouteAccess(entry, role);
        const observed = Boolean(actual[entry.id]);
        assert(observed === expected,
          `${entry.route} visibility mismatch for ${role.key}: expected ${expected}, got ${observed}`);
      }
    }

    const disabledCompanyReceipts = await page.evaluate(async () => {
      DB.user = {
        name: 'Matrix Receipt Contributor',
        email: 'matrix-receipt@example.com',
        permissionKeys: [
          'employee.self.read',
          'expenses.company_receipts.read_own',
          'expenses.company_receipts.create',
        ],
        is_superadmin: false,
      };
      DB.erpSystem = {
        ...(DB.erpSystem || {}),
        modules: [{ moduleKey: 'expenses_tax', enabled: false }],
      };
      await loadModuleControl();
      return {
        module: routeModuleId('company-receipts'),
        allowed: routeAllowed('company-receipts'),
        shown: routeShownInCommands('company-receipts'),
      };
    });
    assert(disabledCompanyReceipts.module === 'expenses_tax',
      `Company Receipts route must belong to expenses_tax, got ${disabledCompanyReceipts.module}`);
    assert(!disabledCompanyReceipts.allowed && !disabledCompanyReceipts.shown,
      'Company Receipts remains reachable or visible when expenses_tax is disabled.');

    // Ensure the route set itself is represented by the matrix. Preview-only
    // routes are still checked for fail-closed behavior above; the matrix is
    // intentionally focused on canonical production routes and action gates.
    const unmappedCanonical = Object.values(registry.meta)
      .filter((meta) => meta.maturity === 'canonical' && meta.module === 'unmapped')
      .map((meta) => meta.route);
    assert(unmappedCanonical.length === 0,
      `Canonical screens have no module mapping: ${unmappedCanonical.join(', ')}`);
    assert(matrixRoutes.size === ACCESS_MATRIX.length,
      'Access matrix contains duplicate route entries without a stable route contract.');
    assert(browserErrors.length === 0, `Browser errors detected:\n${browserErrors.join('\n')}`);
    console.log(`PASS Access Matrix UI: ${ACCESS_MATRIX.length} canonical route contracts × ${ROLE_FIXTURES.length} role templates; ${registry.routes.length} registered screens fail closed.`);
  } finally {
    await context.close();
    await browser.close();
    preview.kill();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`FAIL Access Matrix UI: ${message}`);
  process.exitCode = 1;
});
