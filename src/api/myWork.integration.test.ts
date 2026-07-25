import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  account,
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
import { configureExpensePolicyVersion } from '../modules/expenses/policy';

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
    await db.update(employee).set({ userId: null }).where(and(
      eq(employee.masterFn, 'M1'),
      eq(employee.companyFn, 'C-SG'),
      eq(employee.userId, viewer.userId),
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
        company: {
          companyFn: string;
          name: string;
          country: string;
          currency: string;
          taxRegime: string;
          locale: string;
        };
        employee: { id: number; employeeNo: string };
        capabilities: {
          claims: { available: boolean; writable: boolean };
          receipts: { available: boolean; writable: boolean };
          team: { available: boolean };
        };
      };
      meta: { actorDerived: boolean };
    };
    expect(contextBody.data.employee).toMatchObject({
      id: subject.id,
      employeeNo: 'EMP-1042',
    });
    expect(contextBody.data.company).toMatchObject({
      companyFn: 'C-SG',
      name: 'Acme Singapore',
      country: 'SG',
      currency: 'SGD',
    });
    expect(contextBody.meta.actorDerived).toBe(true);
    expect(contextBody.data.capabilities.team.available).toBe(false);
    expect(contextBody.data.capabilities.claims).toEqual({
      available: true,
      writable: true,
    });
    expect(contextBody.data.capabilities.receipts)
      .toEqual({ available: true, writable: true });

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
      'claims',
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

    const claims = await fetch(`${baseUrl}/api/my/claims`, { headers: { cookie } });
    expect(claims.status).toBe(200);
    expect(await claims.json()).toMatchObject({
      data: [],
      meta: { actorDerived: true, availability: 'canonical' },
    });

    const uploadHeaders = {
      cookie,
      'x-csrf-token': csrf,
      'content-type': 'image/jpeg',
      'x-erp-file-name': encodeURIComponent('taxi-receipt.jpg'),
      'x-erp-draft-id': 'draft_api_001',
      'x-erp-auto-submit-authorized': 'true',
    };
    const jpeg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    ]);
    const uploaded = await fetch(`${baseUrl}/api/my/receipts/actions/upload`, {
      method: 'POST',
      headers: uploadHeaders,
      body: jpeg,
    });
    expect(uploaded.status).toBe(201);
    expect(await uploaded.json()).toMatchObject({
      data: {
        originalFileName: 'taxi-receipt.jpg',
        mimeType: 'image/jpeg',
        pageCount: 1,
        storageBackend: 'database',
        scanStatus: 'queued',
        extractionStatus: null,
        autoSubmitAuthorized: true,
      },
      meta: { actorDerived: true, replayed: false, scanning: 'fail_closed' },
    });
    const replayedUpload = await fetch(`${baseUrl}/api/my/receipts/actions/upload`, {
      method: 'POST',
      headers: uploadHeaders,
      body: jpeg,
    });
    expect(replayedUpload.status).toBe(200);
    expect(await replayedUpload.json()).toMatchObject({
      meta: { actorDerived: true, replayed: true },
    });
    const receiptList = await fetch(`${baseUrl}/api/my/receipts`, {
      headers: { cookie },
    });
    expect(receiptList.status).toBe(200);
    expect(await receiptList.json()).toMatchObject({
      data: [{
        originalFileName: 'taxi-receipt.jpg',
        pageCount: 1,
        scanStatus: 'queued',
        extractionStatus: null,
        autoSubmitAuthorized: true,
      }],
      meta: { actorDerived: true, availability: 'capture', scanning: 'fail_closed' },
    });

    const spoofed = await fetch(`${baseUrl}/api/my/receipts/actions/upload`, {
      method: 'POST',
      headers: {
        ...uploadHeaders,
        'x-erp-file-name': encodeURIComponent('taxi-receipt.pdf'),
        'x-erp-draft-id': 'draft_api_002',
      },
      body: jpeg,
    });
    expect(spoofed.status).toBe(422);
    expect((await spoofed.json()).error.code).toBe('receipt_type_mismatch');

    const invalidAuthorization = await fetch(`${baseUrl}/api/my/receipts/actions/upload`, {
      method: 'POST',
      headers: {
        ...uploadHeaders,
        'x-erp-draft-id': 'draft_api_003',
        'x-erp-auto-submit-authorized': 'yes',
      },
      body: jpeg,
    });
    expect(invalidAuthorization.status).toBe(400);
    expect((await invalidAuthorization.json()).error.code)
      .toBe('receipt_auto_submit_authorization_invalid');
  });

  it('creates, replaces, submits and lists only the session employee expense claim', async () => {
    const { viewer } = await linkViewer('EMP-1042', ['Employee']);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const accounts = await db.select().from(account).where(and(
      eq(account.masterFn, 'M1'),
      eq(account.companyFn, 'C-SG'),
    ));
    const accountId = (code: string) => {
      const row = accounts.find((candidate) => candidate.code === code);
      if (!row) throw new Error(`Missing account ${code}`);
      return row.id;
    };
    await configureExpensePolicyVersion(
      db,
      { masterFn: 'M1', companyFn: 'C-SG' },
      admin.userId,
      {
        categoryCode: 'TRAVEL',
        categoryName: 'Business travel',
        policyKey: 'travel-api-claim',
        policyName: 'Travel API claim policy',
        versionNo: 1,
        validFrom: '2026-01-01',
        evidenceRequired: false,
        taxTreatment: 'exempt',
        employeePaidAllowed: true,
        companyPaidAllowed: false,
        expenseAccountId: accountId('5800'),
        employeePayableAccountId: accountId('2100'),
        companyPaidClearingAccountId: accountId('1000'),
        fxMethod: 'table_rate',
      },
    );
    const cookie = await login();
    const csrf = decodeURIComponent(
      cookie.match(/(?:^|;\s*)erp_csrf=([^;]+)/)?.[1] ?? '',
    );
    const jsonHeaders = (idempotencyKey: string) => ({
      cookie,
      'x-csrf-token': csrf,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    });
    const created = await fetch(`${baseUrl}/api/my/claims`, {
      method: 'POST',
      headers: jsonHeaders('claim-api-create-0001'),
      body: JSON.stringify({
        claimKey: 'claim-api-0001',
        claimNo: 'EC-API-0001',
        title: 'API travel claim',
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as {
      data: { claim: { id: number; ownerUserId: number; version: number } };
    };
    expect(createdBody.data.claim.ownerUserId).toBe(viewer.userId);

    const replaced = await fetch(
      `${baseUrl}/api/my/claims/${createdBody.data.claim.id}/actions/replace-lines`,
      {
        method: 'POST',
        headers: jsonHeaders('claim-api-lines-0001'),
        body: JSON.stringify({
          expectedVersion: createdBody.data.claim.version,
          lines: [{
            merchant: 'API Taxi',
            transactionDate: '2026-07-20',
            purpose: 'Customer visit',
            categoryCode: 'TRAVEL',
            paymentSource: 'employee_paid',
            originalCurrency: 'SGD',
            originalNet: '25.00',
            originalTax: '0',
            originalGross: '25.00',
            allocationMode: 'percentage',
            allocations: [{
              dimensionType: 'department',
              dimensionKey: 'SALES',
              percentage: '100',
            }],
          }],
        }),
      },
    );
    expect(replaced.status).toBe(200);
    const replacedBody = await replaced.json() as {
      data: { claim: { version: number } };
    };

    const submitted = await fetch(
      `${baseUrl}/api/my/claims/${createdBody.data.claim.id}/actions/submit`,
      {
        method: 'POST',
        headers: jsonHeaders('claim-api-submit-0001'),
        body: JSON.stringify({ expectedVersion: replacedBody.data.claim.version }),
      },
    );
    expect(submitted.status).toBe(200);
    expect(await submitted.json()).toMatchObject({
      data: {
        claim: {
          ownerUserId: viewer.userId,
          status: 'submitted',
          submissionKind: 'employee',
        },
      },
      meta: { actorDerived: true },
    });

    const list = await fetch(`${baseUrl}/api/my/claims`, { headers: { cookie } });
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({
      data: [{
        claimNo: 'EC-API-0001',
        ownerUserId: viewer.userId,
        status: 'submitted',
        lines: [{
          merchant: 'API Taxi',
          allocations: [{
            dimensionType: 'department',
            dimensionKey: 'SALES',
            amountOriginal: '25.0000',
          }],
        }],
      }],
      meta: { actorDerived: true, availability: 'canonical' },
    });
  });

  it('lets an Employee-only account boot My Work without dashboard access', async () => {
    const { viewer } = await linkViewer('EMP-1042', ['Employee']);
    const [employeeRole] = await db.select().from(role).where(and(
      eq(role.masterFn, 'M1'),
      eq(role.name, 'Employee'),
    ));
    await db.delete(userCompanyRole).where(and(
      eq(userCompanyRole.userId, viewer.userId),
      eq(userCompanyRole.companyFn, 'C-SG'),
    ));
    await db.insert(userCompanyRole).values({
      userId: viewer.userId,
      companyFn: 'C-SG',
      roleId: employeeRole.roleId,
    });

    const cookie = await login();
    const dashboard = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { cookie },
    });
    expect(dashboard.status).toBe(403);
    expect((await dashboard.json()).error.code).toBe('permission_denied');

    const context = await fetch(`${baseUrl}/api/my/context`, {
      headers: { cookie },
    });
    expect(context.status).toBe(200);
    const body = await context.json() as {
      data: {
        employee: { employeeNo: string };
        capabilities: { team: { available: boolean } };
      };
    };
    expect(body.data.employee.employeeNo).toBe('EMP-1042');
    expect(body.data.capabilities.team.available).toBe(false);
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
        days: '1.00',
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
        days: '1.00',
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

    const directCalendar = await fetch(
      `${baseUrl}/api/my/team/calendar?from=2026-09-01&to=2026-09-30&scope=direct`,
      { headers: { cookie } },
    );
    expect(directCalendar.status).toBe(200);
    const directCalendarBody = await directCalendar.json() as {
      data: { items: Array<{ employeeId: number }> };
      meta: { scope: string; canExpand: boolean };
    };
    expect(directCalendarBody.data.items.map((item) => item.employeeId))
      .not.toContain(scopeLeaf.id);
    expect(directCalendarBody.meta).toMatchObject({
      scope: 'direct',
      canExpand: true,
    });

    const expandedCalendar = await fetch(
      `${baseUrl}/api/my/team/calendar?from=2026-09-01&to=2026-09-30&scope=expanded&department=Projects`,
      { headers: { cookie } },
    );
    expect(expandedCalendar.status).toBe(200);
    const expandedCalendarBody = await expandedCalendar.json() as {
      data: { items: Array<Record<string, unknown> & { employeeId: number }> };
      meta: { privacy: string; scope: string };
    };
    expect(expandedCalendarBody.data.items.map((item) => item.employeeId))
      .toContain(scopeLeaf.id);
    expect(expandedCalendarBody.data.items.every((item) =>
      !Object.prototype.hasOwnProperty.call(item, 'reason'))).toBe(true);
    expect(expandedCalendarBody.meta).toMatchObject({
      privacy: 'reason_and_evidence_redacted',
      scope: 'expanded',
    });

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
