import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appUser,
  auditLog,
  employee,
  leaveType,
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
    return { viewer, admin, subject, annual };
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
});
