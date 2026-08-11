import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appUser,
  auditLog,
  employee,
  leaveType,
  role,
  rolePermission,
  roleResourceScope,
  userCompany,
  userCompanyRole,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='))?.slice('erp_csrf='.length);
  if (!csrf) throw new Error('Missing CSRF cookie');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrf) };
}

describe('governed leave application API', () => {
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
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  });

  async function login(username: string, password: string) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    return responseCookies(response);
  }

  function writeHeaders(auth: { header: string; csrf: string }, key?: string) {
    return {
      cookie: auth.header,
      'x-csrf-token': auth.csrf,
      'content-type': 'application/json',
      ...(key ? { 'idempotency-key': key } : {}),
    };
  }

  async function identityFixture() {
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const [subject] = await db.select().from(employee).where(and(
      eq(employee.masterFn, 'M1'),
      eq(employee.companyFn, 'C-SG'),
      eq(employee.userId, viewer.userId),
    ));
    const [annual] = await db.select().from(leaveType).where(and(
      eq(leaveType.masterFn, 'M1'),
      eq(leaveType.companyFn, 'C-SG'),
      eq(leaveType.code, 'ANNUAL'),
    ));
    const [managerEmployee] = await db.select().from(employee).where(eq(
      employee.id,
      subject.managerId!,
    ));
    const managerUsername = 'approval.manager';
    const [managerUser] = await db.insert(appUser).values({
      masterFn: 'M1',
      username: managerUsername,
      email: 'approval.manager@acme.co',
      fullName: managerEmployee.fullName,
      passwordHash: viewer.passwordHash,
    }).returning({ id: appUser.userId });
    const roles = await db.select().from(role).where(eq(role.masterFn, 'M1'));
    const managerRole = roles.find((item) => item.name === 'Manager')!;
    const [hrApprovalRole] = await db.insert(role).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      name: 'HR Approval Test Role',
      isSuperadmin: false,
      sourceTemplateKey: 'hr',
    }).returning({ roleId: role.roleId });
    await db.insert(rolePermission).values({
      masterFn: 'M1',
      roleId: hrApprovalRole.roleId,
      permissionKey: 'hr.write',
    });
    await db.insert(roleResourceScope).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      roleId: hrApprovalRole.roleId,
      resourceKey: 'hr/*',
      scope: 'company',
    });
    await db.insert(userCompany).values({
      userId: managerUser.id,
      companyFn: 'C-SG',
      roleId: managerRole.roleId,
    });
    await db.insert(userCompanyRole).values([
      {
        userId: managerUser.id,
        companyFn: 'C-SG',
        roleId: managerRole.roleId,
        validFrom: new Date('2026-01-01T00:00:00Z'),
      },
      {
        userId: managerUser.id,
        companyFn: 'C-SG',
        roleId: hrApprovalRole.roleId,
        validFrom: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    await db.update(employee).set({ userId: managerUser.id }).where(eq(
      employee.id,
      managerEmployee.id,
    ));
    return { viewer, admin, subject, annual, managerUsername };
  }

  it('enforces CSRF, idempotency, actor ownership and optimistic versions', async () => {
    const data = await identityFixture();
    const auth = await login('viewer', 'viewer1234');
    const payload = {
      leaveTypeId: data.annual.id,
      startDate: '2026-08-17',
      endDate: '2026-08-18',
      unit: 'full_day',
      reason: 'Family appointment',
    };

    const noCsrf = await fetch(`${baseUrl}/api/my/leave-requests`, {
      method: 'POST',
      headers: {
        cookie: auth.header,
        'content-type': 'application/json',
        'idempotency-key': 'leave-create-no-csrf',
      },
      body: JSON.stringify(payload),
    });
    expect(noCsrf.status).toBe(403);

    const noKey = await fetch(`${baseUrl}/api/my/leave-requests`, {
      method: 'POST',
      headers: writeHeaders(auth),
      body: JSON.stringify(payload),
    });
    expect(noKey.status).toBe(428);

    const create = await fetch(`${baseUrl}/api/my/leave-requests`, {
      method: 'POST',
      headers: writeHeaders(auth, 'leave-create-1'),
      body: JSON.stringify(payload),
    });
    expect(create.status).toBe(201);
    const created = await create.json() as {
      data: { id: number; status: string; version: number };
    };
    expect(created.data).toMatchObject({ status: 'draft', version: 1 });

    const replay = await fetch(`${baseUrl}/api/my/leave-requests`, {
      method: 'POST',
      headers: writeHeaders(auth, 'leave-create-1'),
      body: JSON.stringify(payload),
    });
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect((await replay.json()).data.id).toBe(created.data.id);

    const stale = await fetch(
      `${baseUrl}/api/my/leave-requests/${created.data.id}/actions/submit`,
      {
        method: 'POST',
        headers: writeHeaders(auth, 'leave-submit-stale'),
        body: JSON.stringify({ expectedVersion: 9 }),
      },
    );
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe('leave_version_conflict');

    const submitted = await fetch(
      `${baseUrl}/api/my/leave-requests/${created.data.id}/actions/submit`,
      {
        method: 'POST',
        headers: writeHeaders(auth, 'leave-submit-1'),
        body: JSON.stringify({ expectedVersion: 1 }),
      },
    );
    expect(submitted.status).toBe(200);
    const pending = await submitted.json() as { data: { version: number; status: string } };
    expect(pending.data).toMatchObject({ version: 2, status: 'pending' });

    const detail = await fetch(`${baseUrl}/api/my/leave-requests/${created.data.id}`, {
      headers: { cookie: auth.header },
    });
    expect(detail.status).toBe(200);
    const detailBody = await detail.json() as {
      data: { reason: string; revisions: unknown[]; events: unknown[] };
    };
    expect(detailBody.data.reason).toBe('Family appointment');
    expect(detailBody.data.revisions).toHaveLength(1);
    expect(detailBody.data.events).toHaveLength(2);

    const withdrawn = await fetch(
      `${baseUrl}/api/my/leave-requests/${created.data.id}/actions/withdraw`,
      {
        method: 'POST',
        headers: writeHeaders(auth, 'leave-withdraw-1'),
        body: JSON.stringify({
          expectedVersion: pending.data.version,
          reason: 'Appointment rescheduled',
        }),
      },
    );
    expect(withdrawn.status).toBe(200);
    const withdrawnBody = await withdrawn.json() as {
      data: { status: string; version: number };
    };
    expect(withdrawnBody.data.status).toBe('withdrawn');

    const voided = await fetch(
      `${baseUrl}/api/my/leave-requests/${created.data.id}/actions/void`,
      {
        method: 'POST',
        headers: writeHeaders(auth, 'leave-owner-void-1'),
        body: JSON.stringify({
          expectedVersion: withdrawnBody.data.version,
          reason: 'Application is no longer required',
        }),
      },
    );
    expect(voided.status).toBe(200);
    expect((await voided.json()).data.status).toBe('voided');

    const otherEmployee = await db.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, 'M1'),
      eq(employee.companyFn, 'C-SG'),
      eq(employee.employeeNo, 'EMP-1055'),
    )).then((rows) => rows[0]);
    const tampered = await fetch(`${baseUrl}/api/my/leave-requests`, {
      method: 'POST',
      headers: writeHeaders(auth, 'leave-tamper'),
      body: JSON.stringify({ ...payload, employeeId: otherEmployee.id }),
    });
    expect(tampered.status).toBe(400);
    expect((await tampered.json()).error.code).toBe('actor_identity_is_session_derived');
  });

  it('supports audited HR on-behalf draft creation and governed approval', async () => {
    const data = await identityFixture();
    const employeeAuth = await login('viewer', 'viewer1234');
    const adminAuth = await login('admin', 'demo1234');

    const create = await fetch(`${baseUrl}/api/my/leave-requests`, {
      method: 'POST',
      headers: writeHeaders(employeeAuth, 'leave-approve-create'),
      body: JSON.stringify({
        leaveTypeId: data.annual.id,
        startDate: '2026-09-07',
        endDate: '2026-09-08',
        unit: 'full_day',
        reason: 'Family commitment',
      }),
    });
    const draft = await create.json() as { data: { id: number; version: number } };
    const submit = await fetch(
      `${baseUrl}/api/my/leave-requests/${draft.data.id}/actions/submit`,
      {
        method: 'POST',
        headers: writeHeaders(employeeAuth, 'leave-approve-submit'),
        body: JSON.stringify({ expectedVersion: draft.data.version }),
      },
    );
    const pending = await submit.json() as { data: { version: number } };

    const approvalQueue = await fetch(`${baseUrl}/api/hr/leave-approval-queue`, {
      headers: { cookie: adminAuth.header },
    });
    expect(approvalQueue.status).toBe(200);
    const queueBody = await approvalQueue.json() as {
      data: Array<Record<string, unknown>>;
      meta: { actionableOnly: boolean };
    };
    expect(queueBody.meta).toMatchObject({ actionableOnly: true });
    expect(queueBody.data.find((row) => row.requestId === draft.data.id)).toMatchObject({
      currentAuthority: { type: 'permission', permissionKey: 'hr.write' },
      privacy: 'reason_and_evidence_redacted',
    });

    const approve = await fetch(
      `${baseUrl}/api/hr/leave-applications/${draft.data.id}/actions/approve`,
      {
        method: 'POST',
        headers: writeHeaders(adminAuth, 'hr-leave-approve'),
        body: JSON.stringify({ expectedVersion: pending.data.version }),
      },
    );
    expect(approve.status).toBe(200);
    expect((await approve.json()).data.status).toBe('approved');

    const onBehalf = await fetch(`${baseUrl}/api/hr/leave-applications`, {
      method: 'POST',
      headers: writeHeaders(adminAuth, 'hr-leave-on-behalf'),
      body: JSON.stringify({
        employeeId: data.subject.id,
        leaveTypeId: data.annual.id,
        startDate: '2026-10-05',
        endDate: '2026-10-05',
        unit: 'half_day_pm',
        reason: 'Recorded by HR at employee request',
      }),
    });
    expect(onBehalf.status).toBe(201);
    expect((await onBehalf.json()).data.status).toBe('draft');

    const audit = await db.select().from(auditLog).where(and(
      eq(auditLog.masterFn, 'M1'),
      eq(auditLog.companyFn, 'C-SG'),
      eq(auditLog.entity, 'leave_application'),
    ));
    expect(audit.map((entry) => entry.action)).toEqual(expect.arrayContaining([
      'approve',
      'create_on_behalf',
    ]));
  });

  it('keeps an existing direct-manager approval bound to the current step authority', async () => {
    const data = await identityFixture();
    const employeeAuth = await login('viewer', 'viewer1234');
    const adminAuth = await login('admin', 'demo1234');
    const managerAuth = await login(data.managerUsername, 'viewer1234');
    const create = await fetch(`${baseUrl}/api/my/leave-requests`, {
      method: 'POST',
      headers: writeHeaders(employeeAuth, 'strict-current-step-create'),
      body: JSON.stringify({
        leaveTypeId: data.annual.id,
        startDate: '2026-10-05',
        endDate: '2026-10-12',
        unit: 'full_day',
        reason: 'Existing manager approval takeover',
      }),
    });
    expect(create.status).toBe(201);
    const draft = await create.json() as { data: { id: number; version: number } };
    const submit = await fetch(
      `${baseUrl}/api/my/leave-requests/${draft.data.id}/actions/submit`,
      {
        method: 'POST',
        headers: writeHeaders(employeeAuth, 'strict-current-step-submit'),
        body: JSON.stringify({ expectedVersion: draft.data.version }),
      },
    );
    expect(submit.status).toBe(200);
    const pending = await submit.json() as { data: { version: number } };

    const approvalQueue = await fetch(`${baseUrl}/api/hr/leave-approval-queue`, {
      headers: { cookie: adminAuth.header },
    });
    expect(approvalQueue.status).toBe(200);
    const queueBody = await approvalQueue.json() as {
      data: Array<Record<string, unknown>>;
    };
    expect(queueBody.data.find((row) => row.requestId === draft.data.id)).toBeUndefined();

    const firstApprove = await fetch(
      `${baseUrl}/api/hr/leave-applications/${draft.data.id}/actions/approve`,
      {
        method: 'POST',
        headers: writeHeaders(adminAuth, 'strict-current-step-admin-deny'),
        body: JSON.stringify({ expectedVersion: pending.data.version }),
      },
    );
    expect(firstApprove.status).toBe(403);

    const managerApprove = await fetch(
      `${baseUrl}/api/hr/leave-applications/${draft.data.id}/actions/approve`,
      {
        method: 'POST',
        headers: writeHeaders(managerAuth, 'strict-current-step-manager-approve'),
        body: JSON.stringify({ expectedVersion: pending.data.version }),
      },
    );
    expect(managerApprove.status).toBe(200);
    const managerStep = await managerApprove.json() as {
      data: { status: string; version: number };
    };
    expect(managerStep.data).toMatchObject({ status: 'pending', version: 3 });

    const secondApprove = await fetch(
      `${baseUrl}/api/hr/leave-applications/${draft.data.id}/actions/approve`,
      {
        method: 'POST',
        headers: writeHeaders(adminAuth, 'strict-current-step-admin-approve'),
        body: JSON.stringify({ expectedVersion: managerStep.data.version }),
      },
    );
    expect(secondApprove.status).toBe(200);
    expect((await secondApprove.json()).data.status).toBe('approved');
  });

  it('bridges the legacy HR leave register action to governed approval', async () => {
    const data = await identityFixture();
    const employeeAuth = await login('viewer', 'viewer1234');
    const managerAuth = await login(data.managerUsername, 'viewer1234');
    const create = await fetch(`${baseUrl}/api/my/leave-requests`, {
      method: 'POST',
      headers: writeHeaders(employeeAuth, 'register-bridge-create'),
      body: JSON.stringify({
        leaveTypeId: data.annual.id,
        startDate: '2026-11-02',
        endDate: '2026-11-02',
        unit: 'full_day',
        reason: 'Register bridge test',
      }),
    });
    expect(create.status).toBe(201);
    const draft = await create.json() as { data: { id: number; version: number } };
    const submit = await fetch(
      `${baseUrl}/api/my/leave-requests/${draft.data.id}/actions/submit`,
      {
        method: 'POST',
        headers: writeHeaders(employeeAuth, 'register-bridge-submit'),
        body: JSON.stringify({ expectedVersion: draft.data.version }),
      },
    );
    expect(submit.status).toBe(200);
    const pending = await submit.json() as { data: { version: number } };

    const missingVersion = await fetch(
      `${baseUrl}/api/hr/leave-requests/${draft.data.id}/actions/approve`,
      {
        method: 'POST',
        headers: writeHeaders(managerAuth, 'register-bridge-missing-version'),
        body: JSON.stringify({}),
      },
    );
    expect(missingVersion.status).toBe(428);
    expect((await missingVersion.json()).error.code).toBe('expected_version_required');

    const approve = await fetch(
      `${baseUrl}/api/hr/leave-requests/${draft.data.id}/actions/approve`,
      {
        method: 'POST',
        headers: writeHeaders(managerAuth, 'register-bridge-approve'),
        body: JSON.stringify({ expectedVersion: pending.data.version }),
      },
    );
    expect(approve.status).toBe(200);
    expect((await approve.json()).data.status).toBe('approved');
  });

  it('exposes privacy-redacted policy steps through My Approvals and completes them in order', async () => {
    const data = await identityFixture();
    const employeeAuth = await login('viewer', 'viewer1234');
    const managerAuth = await login(data.managerUsername, 'viewer1234');
    const create = await fetch(`${baseUrl}/api/my/leave-requests`, {
      method: 'POST',
      headers: writeHeaders(employeeAuth, 'policy-leave-create'),
      body: JSON.stringify({
        leaveTypeId: data.annual.id,
        startDate: '2026-10-05',
        endDate: '2026-10-12',
        unit: 'full_day',
        reason: 'Private family circumstances',
      }),
    });
    const draft = await create.json() as { data: { id: number; version: number } };
    const submit = await fetch(
      `${baseUrl}/api/my/leave-requests/${draft.data.id}/actions/submit`,
      {
        method: 'POST',
        headers: writeHeaders(employeeAuth, 'policy-leave-submit'),
        body: JSON.stringify({ expectedVersion: draft.data.version }),
      },
    );
    const pending = await submit.json() as {
      data: {
        version: number;
        approval: { policyCode: string; stepCount: number };
      };
    };
    expect(pending.data.approval).toMatchObject({
      policyCode: 'LEAVE-LONG',
      stepCount: 2,
    });

    const employeeQueue = await fetch(`${baseUrl}/api/my/approvals`, {
      headers: { cookie: employeeAuth.header },
    });
    expect(employeeQueue.status).toBe(200);
    expect((await employeeQueue.json()).data).toEqual([]);

    const managerQueue = await fetch(`${baseUrl}/api/my/approvals`, {
      headers: { cookie: managerAuth.header },
    });
    expect(managerQueue.status).toBe(200);
    const managerRows = (await managerQueue.json()).data as Array<Record<string, unknown>>;
    const assigned = managerRows.find((row) => row.requestId === draft.data.id);
    expect(assigned).toMatchObject({
      employeeName: data.subject.fullName,
      currentStepNo: 1,
      stepLabel: 'Direct manager approval',
      privacy: 'reason_and_evidence_redacted',
    });
    expect(assigned).not.toHaveProperty('reason');

    const first = await fetch(
      `${baseUrl}/api/my/approvals/${draft.data.id}/actions/approve`,
      {
        method: 'POST',
        headers: writeHeaders(managerAuth, 'policy-leave-step-1'),
        body: JSON.stringify({
          expectedVersion: pending.data.version,
          reason: 'Manager coverage confirmed',
        }),
      },
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json() as {
      data: { version: number; status: string; approval: { currentStepNo: number } };
    };
    expect(firstBody.data).toMatchObject({
      status: 'pending',
      approval: { currentStepNo: 2 },
    });

    const second = await fetch(
      `${baseUrl}/api/my/approvals/${draft.data.id}/actions/approve`,
      {
        method: 'POST',
        headers: writeHeaders(managerAuth, 'policy-leave-step-2'),
        body: JSON.stringify({
          expectedVersion: firstBody.data.version,
          reason: 'HR governance confirmed',
        }),
      },
    );
    expect(second.status).toBe(200);
    expect((await second.json()).data.status).toBe('approved');
  });
});
