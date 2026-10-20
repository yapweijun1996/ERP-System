import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { auditLog, employee } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookiesFrom(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair || !pairs.some((pair) => pair.startsWith('erp_session='))) {
    throw new Error(`Missing authentication cookies: ${values.join(' | ')}`);
  }
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice('erp_csrf='.length)),
  };
}

describe('employee profile update API', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('API test server has no address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  async function login(username: string, password: string) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    return cookiesFrom(response);
  }

  it('updates a tenant employee, audits before/after, and rejects stale writes', async () => {
    const admin = await login('admin', 'demo1234');
    const [subject] = await db.select().from(employee).where(and(
      eq(employee.masterFn, 'M1'), eq(employee.companyFn, 'C-SG'),
    )).limit(1);
    const read = await fetch(`${baseUrl}/api/hr/employees/${subject.id}`, {
      headers: { cookie: admin.header },
    });
    expect(read.status).toBe(200);
    const current = (await read.json()).data;
    const mutationHeaders = {
      cookie: admin.header,
      'x-csrf-token': admin.csrf,
      'content-type': 'application/json',
      'if-match': `"${current.updatedAt}"`,
    };
    const updated = await fetch(`${baseUrl}/api/hr/employees/${subject.id}`, {
      method: 'PATCH',
      headers: mutationHeaders,
      body: JSON.stringify({
        employeeNo: current.employeeNo,
        fullName: 'Updated Demo Employee',
        email: current.email,
        phone: '+65 6000 0000',
        department: current.department,
        jobTitle: current.jobTitle,
        employmentType: current.employmentType,
        managerId: current.managerId,
        startDate: current.startDate,
        annualLeaveDays: current.annualLeaveDays,
        baseSalary: String(current.baseSalary),
      }),
    });
    expect(updated.status).toBe(200);
    expect((await updated.json()).data).toMatchObject({
      id: subject.id, fullName: 'Updated Demo Employee', phone: '+65 6000 0000',
    });

    const stale = await fetch(`${baseUrl}/api/hr/employees/${subject.id}`, {
      method: 'PATCH',
      headers: mutationHeaders,
      body: JSON.stringify({
        employeeNo: current.employeeNo,
        fullName: 'Stale Write',
        email: current.email,
        department: current.department,
        jobTitle: current.jobTitle,
        employmentType: current.employmentType,
        managerId: current.managerId,
        startDate: current.startDate,
        annualLeaveDays: current.annualLeaveDays,
        baseSalary: String(current.baseSalary),
      }),
    });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe('employee_stale');

    const audits = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'hr/employees'),
      eq(auditLog.entityId, String(subject.id)),
      eq(auditLog.action, 'update'),
    ));
    expect(audits).toHaveLength(1);
    expect(audits[0].before).toMatchObject({ fullName: current.fullName });
    expect(audits[0].after).toMatchObject({ fullName: 'Updated Demo Employee' });

    const history = await fetch(`${baseUrl}/api/hr/employees/${subject.id}/history?limit=10`, {
      headers: { cookie: admin.header },
    });
    expect(history.status).toBe(200);
    expect((await history.json()).data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'update',
        before: expect.objectContaining({ fullName: current.fullName }),
        after: expect.objectContaining({ fullName: 'Updated Demo Employee' }),
      }),
    ]));
  });

  it('returns field-level validation errors for invalid profile fields', async () => {
    const admin = await login('admin', 'demo1234');
    const [subject] = await db.select().from(employee).where(and(
      eq(employee.masterFn, 'M1'), eq(employee.companyFn, 'C-SG'),
    )).limit(1);
    const response = await fetch(`${baseUrl}/api/hr/employees/${subject.id}`, {
      method: 'PATCH',
      headers: {
        cookie: admin.header,
        'x-csrf-token': admin.csrf,
        'content-type': 'application/json',
        'if-match': `"${subject.updatedAt.toISOString()}"`,
      },
      body: JSON.stringify({
        employeeNo: subject.employeeNo,
        fullName: subject.fullName,
        email: 'not-an-email',
        department: subject.department,
        jobTitle: subject.jobTitle,
        employmentType: subject.employmentType,
        managerId: subject.managerId,
        startDate: '2026-02-31',
        annualLeaveDays: subject.annualLeaveDays,
        baseSalary: String(subject.baseSalary),
      }),
    });
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatchObject({
      code: 'employee_validation_failed',
      fieldErrors: {
        email: 'Enter a valid email address.',
        startDate: 'Enter a valid start date.',
      },
    });
  });

  it('requires hr.write even when the user can read the directory', async () => {
    const viewer = await login('viewer', 'viewer1234');
    const [subject] = await db.select().from(employee).where(and(
      eq(employee.masterFn, 'M1'), eq(employee.companyFn, 'C-SG'),
    )).limit(1);
    const response = await fetch(`${baseUrl}/api/hr/employees/${subject.id}`, {
      method: 'PATCH',
      headers: {
        cookie: viewer.header,
        'x-csrf-token': viewer.csrf,
        'content-type': 'application/json',
        'if-match': `"${subject.updatedAt.toISOString()}"`,
      },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('permission_denied');
  });

  it('ends accountless employment with scoped permission, replay and audit guards', async () => {
    const admin = await login('admin', 'demo1234');
    const viewer = await login('viewer', 'viewer1234');
    const [subject] = await db.select().from(employee).where(eq(employee.employeeNo, 'EMP-1088'));
    const [accountHolder] = await db.select().from(employee).where(eq(employee.employeeNo, 'EMP-1042'));
    const [otherCompany] = await db.select().from(employee).where(eq(employee.companyFn, 'C-MY'));
    const payload = { expectedUpdatedAt: subject.updatedAt.toISOString(), reason: 'Employment ended after resignation' };
    const submit = (id: number, key: string, body: Record<string, unknown> = payload, actor = admin) => fetch(
      `${baseUrl}/api/hr/employees/${id}/actions/end-employment`, {
        method: 'POST', headers: { cookie: actor.header, 'x-csrf-token': actor.csrf,
          'content-type': 'application/json', 'idempotency-key': key },
        body: JSON.stringify(body),
      },
    );
    expect((await submit(subject.id, 'end-spoof', { ...payload, companyFn: 'C-MY' })).status).toBe(400);
    expect((await submit(subject.id, 'end-viewer', payload, viewer)).status).toBe(403);
    expect((await submit(otherCompany.id, 'end-other-company')).status).toBe(404);
    expect((await submit(accountHolder.id, 'end-account-holder', {
      ...payload, expectedUpdatedAt: accountHolder.updatedAt.toISOString(),
    })).status).toBe(409);
    const saved = await submit(subject.id, 'end-once');
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ data: { employee: { id: subject.id, isActive: false }, reportsReassigned: 0 } });
    const replay = await submit(subject.id, 'end-once');
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect((await submit(subject.id, 'end-twice')).status).toBe(409);
    const [ended] = await db.select().from(employee).where(eq(employee.id, subject.id));
    expect(ended.isActive).toBe(false);
    const audits = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'hr/employees'), eq(auditLog.entityId, String(subject.id)),
      eq(auditLog.action, 'end_employment'),
    ));
    expect(audits).toHaveLength(1);
    expect(audits[0].after).toMatchObject({ reason: payload.reason, isActive: false });
  });
});
