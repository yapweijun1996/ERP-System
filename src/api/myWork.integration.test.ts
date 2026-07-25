import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appUser,
  employee,
  employeeHierarchyScope,
  leaveRequest,
  role,
  userCompanyRole,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookies(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  return values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  )).join('; ');
}

describe('actor-owned My Work API', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing API address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  async function login(username = 'viewer', password = 'viewer1234') {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    return cookies(response);
  }

  async function linkViewer(
    employeeNo: string,
    roleNames: Array<'Employee' | 'Manager'>,
  ) {
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [subject] = await db.select().from(employee).where(and(
      eq(employee.masterFn, 'M1'),
      eq(employee.companyFn, 'C-SG'),
      eq(employee.employeeNo, employeeNo),
    ));
    await db.update(employee).set({ userId: viewer.userId }).where(eq(employee.id, subject.id));
    for (const name of roleNames) {
      const [selectedRole] = await db.select().from(role).where(and(
        eq(role.masterFn, 'M1'),
        eq(role.name, name),
      ));
      await db.insert(userCompanyRole).values({
        userId: viewer.userId,
        companyFn: 'C-SG',
        roleId: selectedRole.roleId,
      }).onConflictDoNothing();
    }
    return { viewer, subject };
  }

  it('derives its employee exclusively from the session and rejects ID tampering', async () => {
    const { subject } = await linkViewer('EMP-1042', ['Employee']);
    const cookie = await login();

    const context = await fetch(`${baseUrl}/api/my/context`, {
      headers: { cookie },
    });
    expect(context.status).toBe(200);
    const contextBody = await context.json() as {
      data: {
        employee: { id: number; employeeNo: string };
        capabilities: {
          claims: { available: boolean; reason: string };
          receipts: { available: boolean; reason: string };
          team: { available: boolean };
        };
      };
      meta: { actorDerived: boolean };
    };
    expect(contextBody.data.employee).toMatchObject({
      id: subject.id,
      employeeNo: 'EMP-1042',
    });
    expect(contextBody.meta.actorDerived).toBe(true);
    expect(contextBody.data.capabilities.team.available).toBe(false);
    expect(contextBody.data.capabilities.claims).toEqual({
      available: false,
      reason: 'not_modelled',
    });
    expect(contextBody.data.capabilities.receipts).toEqual({
      available: false,
      reason: 'not_modelled',
    });

    const ownLeave = await fetch(`${baseUrl}/api/my/leave-requests`, {
      headers: { cookie },
    });
    expect(ownLeave.status).toBe(200);
    const ownBody = await ownLeave.json() as {
      data: Array<{ reason?: string; leaveType: string }>;
      meta: { actorDerived: boolean };
    };
    expect(ownBody.data).toHaveLength(1);
    expect(ownBody.data[0]).toMatchObject({
      leaveType: 'Annual',
      reason: 'Family trip',
    });
    expect(ownBody.meta.actorDerived).toBe(true);

    const other = await db.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, 'M1'),
      eq(employee.companyFn, 'C-SG'),
      eq(employee.employeeNo, 'EMP-1055'),
    )).then((rows) => rows[0]);
    const tampered = await fetch(
      `${baseUrl}/api/my/leave-requests?employeeId=${other.id}`,
      { headers: { cookie } },
    );
    expect(tampered.status).toBe(400);
    expect((await tampered.json()).error.code).toBe('actor_identity_is_session_derived');

    const csrf = decodeURIComponent(
      cookie.match(/(?:^|;\s*)erp_csrf=([^;]+)/)?.[1] ?? '',
    );
    for (const path of [
      'leave-requests',
      'receipts/actions/upload',
      'leave-requests/1/actions/void',
    ]) {
      const mutationTamper = await fetch(`${baseUrl}/api/my/${path}`, {
        method: 'POST',
        headers: {
          cookie,
          'x-csrf-token': csrf,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ actorSelection: { employee_id: other.id } }),
      });
      expect(mutationTamper.status).toBe(400);
      expect((await mutationTamper.json()).error.code)
        .toBe('actor_identity_is_session_derived');
    }

    for (const resource of ['claims', 'receipts']) {
      const response = await fetch(`${baseUrl}/api/my/${resource}`, {
        headers: { cookie },
      });
      expect(response.status).toBe(200);
      const body = await response.json() as {
        data: unknown[];
        meta: { actorDerived: boolean; availability: string; plannedEpic: string };
      };
      expect(body.data).toEqual([]);
      expect(body.meta).toMatchObject({
        actorDerived: true,
        availability: 'not_modelled',
      });
    }
  });

  it('requires an active company-bound employee identity and a separate team permission', async () => {
    const adminCookie = await login('admin', 'demo1234');
    const missing = await fetch(`${baseUrl}/api/my/context`, {
      headers: { cookie: adminCookie },
    });
    expect(missing.status).toBe(409);
    expect((await missing.json()).error.code).toBe('employee_identity_missing');

    const { subject } = await linkViewer('EMP-1042', ['Employee']);
    const viewerCookie = await login();
    const denied = await fetch(`${baseUrl}/api/my/team/leave-requests`, {
      headers: { cookie: viewerCookie },
    });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe('permission_denied');

    await db.update(employee).set({ isActive: false }).where(eq(employee.id, subject.id));
    const inactive = await fetch(`${baseUrl}/api/my/context`, {
      headers: { cookie: viewerCookie },
    });
    expect(inactive.status).toBe(409);
    expect((await inactive.json()).error.code).toBe('employee_identity_missing');
  });

  it('limits managers to direct reports plus active authorised hierarchy scopes', async () => {
    const { viewer, subject: manager } = await linkViewer(
      'EMP-1001',
      ['Employee', 'Manager'],
    );
    const [scopeRoot] = await db.insert(employee).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      employeeNo: 'EMP-SCOPE-1',
      fullName: 'Scope Root',
      email: 'scope.root@example.com',
      department: 'Projects',
      jobTitle: 'Department Head',
      employmentType: 'Full-time',
      startDate: '2024-01-01',
      annualLeaveDays: 14,
      baseSalary: '7000.00',
    }).returning({ id: employee.id });
    const [scopeChild] = await db.insert(employee).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      employeeNo: 'EMP-SCOPE-2',
      fullName: 'Scope Child',
      email: 'scope.child@example.com',
      department: 'Projects',
      jobTitle: 'Project Lead',
      employmentType: 'Full-time',
      managerId: scopeRoot.id,
      startDate: '2024-02-01',
      annualLeaveDays: 14,
      baseSalary: '5000.00',
    }).returning({ id: employee.id });
    const [scopeLeaf] = await db.insert(employee).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      employeeNo: 'EMP-SCOPE-3',
      fullName: 'Scope Leaf',
      email: 'scope.leaf@example.com',
      department: 'Projects',
      jobTitle: 'Coordinator',
      employmentType: 'Full-time',
      managerId: scopeChild.id,
      startDate: '2024-03-01',
      annualLeaveDays: 14,
      baseSalary: '3500.00',
    }).returning({ id: employee.id });
    const [myEmployee] = await db.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, 'M1'),
      eq(employee.companyFn, 'C-MY'),
      eq(employee.employeeNo, 'EMP-2001'),
    ));
    await db.insert(leaveRequest).values([
      {
        masterFn: 'M1',
        companyFn: 'C-SG',
        employeeId: scopeLeaf.id,
        leaveType: 'Medical',
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        days: 1,
        reason: 'Private scoped reason',
        status: 'pending',
      },
      {
        masterFn: 'M1',
        companyFn: 'C-MY',
        employeeId: myEmployee.id,
        leaveType: 'Annual',
        startDate: '2026-09-02',
        endDate: '2026-09-02',
        days: 1,
        reason: 'Cross-company secret',
        status: 'pending',
      },
    ]);
    await db.insert(employeeHierarchyScope).values([
      {
        masterFn: 'M1',
        companyFn: 'C-SG',
        granteeEmployeeId: manager.id,
        scopeRootEmployeeId: scopeRoot.id,
        scopeType: 'tree',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        grantedByUserId: viewer.userId,
      },
      {
        masterFn: 'M1',
        companyFn: 'C-SG',
        granteeEmployeeId: manager.id,
        scopeRootEmployeeId: myEmployee.id,
        scopeType: 'tree',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        grantedByUserId: viewer.userId,
      },
    ]);

    const cookie = await login();
    const response = await fetch(`${baseUrl}/api/my/team/leave-requests`, {
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    const body = await response.json() as {
      data: Array<Record<string, unknown> & { employeeId: number }>;
      meta: { privacy: string };
    };
    expect(body.data.map((row) => row.employeeId)).toEqual(expect.arrayContaining([
      scopeLeaf.id,
    ]));
    expect(body.data.map((row) => row.employeeId)).not.toContain(myEmployee.id);
    expect(body.data.every((row) =>
      !Object.prototype.hasOwnProperty.call(row, 'reason')
      && !Object.prototype.hasOwnProperty.call(row, 'rejectionReason'))).toBe(true);
    expect(body.meta.privacy).toBe('reason_and_evidence_redacted');

    const context = await fetch(`${baseUrl}/api/my/context`, {
      headers: { cookie },
    });
    const contextBody = await context.json() as {
      data: { capabilities: { team: { available: boolean; employeeCount: number } } };
    };
    expect(contextBody.data.capabilities.team.available).toBe(true);
    // Four seeded direct reports plus the explicit three-person tree.
    expect(contextBody.data.capabilities.team.employeeCount).toBe(7);
  });
});
