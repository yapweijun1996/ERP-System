import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { hashPassword } from '../auth/password';
import {
  ROLE_TEMPLATES,
  roleTemplate,
  type DataScope,
  type RoleTemplateKey,
} from '../auth/accessCatalog';
import {
  appUser,
  companyModule,
  employee,
  masterModule,
  role,
  rolePermission,
  roleResourceScope,
  userCompany,
  userCompanyRole,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';
import { listResourcePermissionContracts } from './resources';
import { ACCESS_MATRIX, type AccessMatrixEntry } from '../auth/accessMatrix';

type MatrixRole = 'company_owner' | 'employee' | 'manager' | 'hr' | 'finance';

interface RunningApi {
  baseUrl: string;
  server: Server;
}

interface AuthSession {
  role: MatrixRole;
  permissions: ReadonlySet<string>;
  header: string;
  csrf: string;
}

interface MatrixCase {
  id: string;
  path: string;
  method?: 'GET' | 'POST';
  requiredAny?: readonly string[];
  requiredAll?: readonly string[];
  allowedRoles?: readonly MatrixRole[];
  authenticated?: boolean;
  body?: Record<string, unknown>;
  idempotency?: boolean;
}

const rowScalar = (value: unknown): string | number | null =>
  typeof value === 'string' || typeof value === 'number' ? value : null;

const MATRIX_PASSWORD = 'matrix1234';

const ROLE_FIXTURES: ReadonlyArray<{
  role: Exclude<MatrixRole, 'company_owner'>;
  template?: RoleTemplateKey;
  permissions?: readonly string[];
  scopes?: Readonly<Record<string, DataScope>>;
  employeeNo: string;
}> = [
  {
    role: 'employee',
    permissions: [
      'employee.self.read',
      'employee.leave.write',
      'employee.receipts.write',
      'expenses.company_receipts.read_own',
      'employee.claims.write',
      'employee.payout.manage',
    ],
    scopes: { 'employee/*': 'self' },
    employeeNo: 'EMP-1055',
  },
  {
    role: 'manager',
    template: 'manager',
    employeeNo: 'EMP-1001',
  },
  {
    role: 'hr',
    template: 'hr',
    employeeNo: 'EMP-1095',
  },
  {
    role: 'finance',
    template: 'finance_preparer',
    employeeNo: 'EMP-1121',
  },
];

const SPECIAL_READ_CASES: readonly MatrixCase[] = [
  {
    id: 'personal-account-activity',
    path: '/api/account/activity',
    authenticated: true,
  },
  {
    id: 'hr-calendar-holidays',
    path: '/api/hr/calendar/holidays?from=2026-01-01&to=2026-12-31',
    requiredAny: ['hr.read'],
  },
  {
    id: 'hr-staff-calendar',
    path: '/api/hr/calendar/staff?from=2026-01-01&to=2026-12-31',
    requiredAny: ['hr.read'],
  },
  {
    id: 'hr-calendar-connections',
    path: '/api/hr/calendar/connections',
    requiredAny: ['hr.read'],
  },
  {
    id: 'hr-leave-approval-queue',
    path: '/api/hr/leave-approval-queue',
    requiredAny: ['hr.read'],
  },
  {
    id: 'finance-ar-aging-options',
    path: '/api/finance/reports/ar-aging/options',
    requiredAny: ['finance.read'],
  },
  {
    id: 'integration-connectors',
    path: '/api/integration/connectors',
    requiredAny: ['integration.read'],
  },
  {
    id: 'reporting-job-read',
    path: '/api/reporting/jobs/999999',
    requiredAny: ['reporting.read', 'finance.report.export'],
  },
  {
    id: 'reporting-artifact-download',
    path: '/api/reporting/artifacts/999999/download',
    requiredAny: ['reporting.read', 'finance.report.export'],
  },
  {
    id: 'admin-users',
    path: '/api/admin/users',
    requiredAny: ['admin.users.read'],
  },
  {
    id: 'admin-roles',
    path: '/api/admin/roles',
    requiredAny: ['admin.roles.read'],
  },
  {
    id: 'settings-overview',
    path: '/api/settings/overview',
    requiredAny: ['settings.read'],
  },
  {
    id: 'company-onboarding',
    path: '/api/onboarding/status',
    requiredAny: ['admin.roles.write'],
  },
  {
    id: 'my-context',
    path: '/api/my/context',
    allowedRoles: ['company_owner', 'employee', 'manager'],
  },
  {
    id: 'my-claims',
    path: '/api/my/claims',
    allowedRoles: ['company_owner', 'employee', 'manager'],
  },
  {
    id: 'my-receipts',
    path: '/api/my/receipts',
    allowedRoles: ['company_owner', 'employee', 'manager'],
  },
  {
    id: 'my-approvals',
    path: '/api/my/approvals',
    allowedRoles: ['company_owner', 'employee', 'manager'],
  },
  {
    id: 'my-team-calendar',
    path: '/api/my/team/calendar?from=2026-01-01&to=2026-12-31',
    allowedRoles: ['company_owner', 'manager'],
  },
];

const SPECIAL_WRITE_CASES: readonly MatrixCase[] = [
  {
    id: 'hr-staff-appointment-create',
    method: 'POST',
    path: '/api/hr/calendar/appointments',
    requiredAny: ['hr.write'],
    body: {},
    idempotency: true,
  },
  {
    id: 'hr-holiday-create',
    method: 'POST',
    path: '/api/hr/calendar/holidays',
    requiredAny: ['hr.write'],
    body: {},
    idempotency: true,
  },
  {
    id: 'finance-profit-loss-export',
    method: 'POST',
    path: '/api/finance/reports/profit-loss/actions/export',
    requiredAny: ['finance.report.export'],
    body: { filters: { comparison: 'not-a-real-comparison' } },
    idempotency: true,
  },
  {
    id: 'tax-evidence-snapshot-create',
    method: 'POST',
    path: '/api/tax-evidence/snapshots',
    requiredAny: ['expenses.tax_evidence.generate'],
    body: {},
    idempotency: true,
  },
  {
    id: 'integration-policy-update',
    method: 'POST',
    path: '/api/integration/document-processing-policy/actions/update',
    requiredAny: ['integration.manage'],
    body: {},
    idempotency: true,
  },
  {
    id: 'settings-policy-update',
    method: 'POST',
    path: '/api/settings/policy/1/actions/update',
    requiredAny: ['settings.manage'],
    body: {},
    idempotency: true,
  },
  {
    id: 'onboarding-stage-complete',
    method: 'POST',
    path: '/api/onboarding/stages/company/actions/complete',
    requiredAny: ['admin.roles.write'],
    body: { expectedVersion: 0 },
  },
];

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => {
    const matches = value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g);
    return Array.from(matches, (match) => `${match[1]}=${match[2]}`);
  });
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair || !pairs.some((pair) => pair.startsWith('erp_session='))) {
    throw new Error(`Missing auth cookies: ${values.join(' | ')}`);
  }
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice('erp_csrf='.length)),
  };
}

async function startApi(db: DB): Promise<RunningApi> {
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP test server has no TCP address');
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopApi(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function login(baseUrl: string, username: string, password: string): Promise<{
  cookies: { header: string; csrf: string };
  body: { permissions?: string[]; role?: string };
}> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationCode: 'ACME', username, password }),
  });
  expect(response.status).toBe(200);
  const body = await response.json() as { permissions?: string[]; role?: string };
  return { cookies: responseCookies(response), body };
}

async function request(
  baseUrl: string,
  session: AuthSession,
  matrixCase: MatrixCase,
  sequence: number,
): Promise<number> {
  const method = matrixCase.method ?? 'GET';
  const headers: Record<string, string> = { cookie: session.header };
  if (method !== 'GET') {
    headers['content-type'] = 'application/json';
    headers['x-csrf-token'] = session.csrf;
    if (matrixCase.idempotency) {
      headers['idempotency-key'] = `permission-matrix-${matrixCase.id}-${session.role}-${sequence}`;
    }
  }
  const response = await fetch(`${baseUrl}${matrixCase.path}`, {
    method,
    headers,
    ...(method === 'GET' ? {} : { body: JSON.stringify(matrixCase.body ?? {}) }),
  });
  await response.arrayBuffer();
  return response.status;
}

async function requestJson(
  baseUrl: string,
  session: AuthSession,
  path: string,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: { cookie: session.header },
  });
  const text = await response.text();
  const body: unknown = (() => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return text;
    }
  })();
  return { status: response.status, body };
}

async function provisionRoleUser(
  db: DB,
  fixture: (typeof ROLE_FIXTURES)[number],
): Promise<{ username: string; permissions: ReadonlySet<string> }> {
  const template = fixture.template ? roleTemplate(fixture.template) : undefined;
  if (fixture.template && !template) throw new Error(`Missing role template ${fixture.template}`);
  const permissions = [...(fixture.permissions ?? template?.permissions ?? [])];
  const scopes = fixture.scopes ?? template?.scopes ?? {};
  const username = `matrix_${fixture.role}`;
  const [createdRole] = await db.insert(role).values({
    masterFn: 'M1',
    companyFn: 'C-SG',
    name: `Permission Matrix ${fixture.role}`,
    sourceTemplateKey: fixture.template ?? null,
  }).returning({ id: role.roleId });
  const [createdUser] = await db.insert(appUser).values({
    masterFn: 'M1',
    username,
    email: `${username}@acme.co`,
    fullName: `Permission Matrix ${fixture.role}`,
    passwordHash: hashPassword(MATRIX_PASSWORD),
    language: 'en',
  }).returning({ id: appUser.userId });
  await db.insert(userCompany).values({
    userId: createdUser.id,
    companyFn: 'C-SG',
    roleId: createdRole.id,
  });
  await db.insert(userCompanyRole).values({
    userId: createdUser.id,
    companyFn: 'C-SG',
    roleId: createdRole.id,
  });
  await db.insert(rolePermission).values(permissions.map((permissionKey) => ({
    masterFn: 'M1',
    roleId: createdRole.id,
    permissionKey,
  })));
  const scopeRows = Object.entries(scopes).map(([resourceKey, scope]) => ({
    masterFn: 'M1',
    companyFn: 'C-SG',
    roleId: createdRole.id,
    resourceKey,
    scope,
  }));
  if (scopeRows.length) await db.insert(roleResourceScope).values(scopeRows);
  await db.update(employee).set({ userId: createdUser.id }).where(and(
    eq(employee.masterFn, 'M1'),
    eq(employee.companyFn, 'C-SG'),
    eq(employee.employeeNo, fixture.employeeNo),
  ));
  return { username, permissions: new Set(permissions) };
}

function shouldAllow(session: AuthSession, matrixCase: MatrixCase): boolean {
  if (matrixCase.allowedRoles) return matrixCase.allowedRoles.includes(session.role);
  if (matrixCase.authenticated) return true;
  const hasAll = (matrixCase.requiredAll ?? []).every((permission) =>
    session.permissions.has(permission));
  const any = matrixCase.requiredAny ?? [];
  const hasAny = any.length === 0 || any.some((permission) => session.permissions.has(permission));
  return hasAll && hasAny;
}

function assertPermissionOutcome(
  status: number,
  allowed: boolean,
  matrixCase: MatrixCase,
  role: MatrixRole,
): void {
  if (!allowed) {
    expect(status, `${matrixCase.id} should deny ${role}`).toBe(403);
    return;
  }
  expect(status, `${matrixCase.id} unexpectedly returned 401/403 for ${role}`).not.toBe(401);
  expect(status, `${matrixCase.id} unexpectedly returned 401/403 for ${role}`).not.toBe(403);
  expect(status, `${matrixCase.id} returned an internal error for ${role}`).toBeLessThan(500);
}

function matrixCaseForApi(entry: AccessMatrixEntry): MatrixCase {
  if (!entry.api) throw new Error(`Access matrix entry ${entry.id} has no API probe.`);
  return {
    id: entry.id,
    path: entry.api.listPath,
    requiredAny: entry.requiredAny,
    requiredAll: entry.requiredAll,
    authenticated: entry.authenticated,
    allowedRoles: entry.allowedRoles?.filter((role): role is MatrixRole =>
      ['company_owner', 'employee', 'manager', 'hr', 'finance'].includes(role)),
  };
}

function rowsFromProbeBody(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') return [];
  const data = (body as { data?: unknown }).data;
  if (Array.isArray(data)) {
    return data.filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === 'object' && !Array.isArray(row)));
  }
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: unknown[] }).items.filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === 'object' && !Array.isArray(row)));
  }
  return [];
}

describe('route → API → permission matrix', () => {
  let db: DB;
  let running: RunningApi;
  let sessions: Record<MatrixRole, AuthSession>;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    await db.update(masterModule).set({ enabled: true }).where(and(
      eq(masterModule.masterFn, 'M1'),
      eq(masterModule.moduleKey, 'expenses_tax'),
    ));
    await db.update(companyModule).set({ enabled: true }).where(and(
      eq(companyModule.masterFn, 'M1'),
      eq(companyModule.companyFn, 'C-SG'),
      eq(companyModule.moduleKey, 'expenses_tax'),
    ));
    const provisioned = await Promise.all(ROLE_FIXTURES.map((fixture) =>
      provisionRoleUser(db, fixture)));
    running = await startApi(db);

    const admin = await login(running.baseUrl, 'admin', 'demo1234');
    const adminSessionProbe: AuthSession = {
      role: 'company_owner',
      permissions: new Set(),
      header: admin.cookies.header,
      csrf: admin.cookies.csrf,
    };
    const adminSession = await requestJson(running.baseUrl, adminSessionProbe, '/api/auth/session');
    expect(adminSession.status).toBe(200);
    const adminPermissions = new Set(
      ((adminSession.body as { capabilities?: { permissions?: string[] } }).capabilities?.permissions ?? []),
    );
    const sessionEntries: Array<[MatrixRole, AuthSession]> = [[
      'company_owner',
      {
        role: 'company_owner',
        permissions: adminPermissions,
        ...admin.cookies,
      },
    ]];
    for (const [index, fixture] of ROLE_FIXTURES.entries()) {
      const auth = await login(running.baseUrl, provisioned[index].username, MATRIX_PASSWORD);
      sessionEntries.push([fixture.role, {
        role: fixture.role,
        permissions: provisioned[index].permissions,
        ...auth.cookies,
      }]);
    }
    sessions = Object.fromEntries(sessionEntries) as Record<MatrixRole, AuthSession>;
  });

  afterEach(async () => {
    await stopApi(running.server);
  });

  it('enforces read permission for every generic resource contract', async () => {
    const contracts = listResourcePermissionContracts();
    let sequence = 0;
    for (const session of Object.values(sessions)) {
      for (const contract of contracts) {
        sequence += 1;
        const matrixCase: MatrixCase = {
          id: `resource-read:${contract.resource}`,
          path: `/api/${contract.resource}`,
          requiredAny: [contract.readPermission],
        };
        const status = await request(running.baseUrl, session, matrixCase, sequence);
        assertPermissionOutcome(status, shouldAllow(session, matrixCase), matrixCase, session.role);
      }
    }
    expect(contracts.length).toBeGreaterThan(80);
  });

  it('enforces create permission for every registered generic create resource', async () => {
    const contracts = listResourcePermissionContracts().filter(
      (contract) => contract.createPermission,
    );
    let sequence = 0;
    for (const session of Object.values(sessions)) {
      for (const contract of contracts) {
        sequence += 1;
        const matrixCase: MatrixCase = {
          id: `resource-create:${contract.resource}`,
          method: 'POST',
          path: `/api/${contract.resource}`,
          requiredAny: [contract.createPermission!],
          body: {},
          idempotency: true,
        };
        const status = await request(running.baseUrl, session, matrixCase, sequence);
        assertPermissionOutcome(status, shouldAllow(session, matrixCase), matrixCase, session.role);
        if (shouldAllow(session, matrixCase)) {
          expect(status, `${matrixCase.id} probe must not create data`).toBeGreaterThanOrEqual(400);
        }
      }
    }
    expect(contracts.length).toBeGreaterThan(25);
  });

  it('enforces special route permissions and actor-derived My Work access', async () => {
    let sequence = 10000;
    for (const matrixCase of SPECIAL_READ_CASES) {
      for (const session of Object.values(sessions)) {
        sequence += 1;
        const status = await request(running.baseUrl, session, matrixCase, sequence);
        assertPermissionOutcome(status, shouldAllow(session, matrixCase), matrixCase, session.role);
      }
    }
  });

  it('keeps canonical route visibility, list access and drill-in access aligned', async () => {
    const probes = ACCESS_MATRIX.filter((entry) => entry.api);
    expect(probes.length).toBeGreaterThan(30);
    for (const entry of probes) {
      const matrixCase = matrixCaseForApi(entry);
      for (const session of Object.values(sessions)) {
        const list = await requestJson(running.baseUrl, session, entry.api!.listPath);
        const allowed = shouldAllow(session, matrixCase);
        assertPermissionOutcome(list.status, allowed, matrixCase, session.role);
        if (!allowed || !entry.api!.detailPath) continue;

        const rows = rowsFromProbeBody(list.body).filter((row) => {
          const detailWhen = entry.api!.detailWhen;
          return !detailWhen || row[detailWhen.field] === detailWhen.equals;
        });
        if (!rows.length) {
          continue;
        }
        const row = rows[0];
        const id = entry.api!.rowId?.(row) ?? rowScalar(row.id);
        if (id == null || id === '') {
          throw new Error(`${entry.id} returned a row without a stable drill-in id.`);
        }
        const detailPath = entry.api!.detailPath(id);
        const detail = await requestJson(running.baseUrl, session, detailPath);
        expect(detail.status, `${entry.id} detail unexpectedly denied for ${session.role}`).not.toBe(401);
        expect(detail.status, `${entry.id} detail unexpectedly denied for ${session.role}`).not.toBe(403);
        expect(detail.status, `${entry.id} detail returned an internal error for ${session.role}`).toBeLessThan(500);
        expect(detail.status, `${entry.id} list row cannot be drilled in for ${session.role}`).not.toBe(404);
      }
    }
  });

  it('enforces high-risk special write permissions before validation', async () => {
    let sequence = 20000;
    for (const matrixCase of SPECIAL_WRITE_CASES) {
      for (const session of Object.values(sessions)) {
        sequence += 1;
        const status = await request(running.baseUrl, session, matrixCase, sequence);
        assertPermissionOutcome(status, shouldAllow(session, matrixCase), matrixCase, session.role);
      }
    }
  });
});

// Keep the catalog import live in this contract test: an accidental removal of
// a template should fail here instead of silently shrinking the role matrix.
void ROLE_TEMPLATES;
