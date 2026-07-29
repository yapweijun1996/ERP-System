import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  employee,
  leavePolicyVersion,
  leaveRequest,
  leaveType,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) =>
    Array.from(value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
      (match) => `${match[1]}=${match[2]}`));
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair) throw new Error('Missing CSRF cookie');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrfPair.slice(9)) };
}

describe('governed leave Payroll API vertical slice', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('HTTP server did not bind');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  });

  async function login() {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationCode: 'ACME',
        username: 'admin',
        password: 'demo1234',
      }),
    });
    expect(response.status).toBe(200);
    return cookies(response);
  }

  it('approves encashment once, traces it into one run and preserves Legacy Policy rows', async () => {
    const [worker] = await db.select({
      id: employee.id,
      baseSalary: employee.baseSalary,
    }).from(employee).where(and(
      eq(employee.masterFn, 'M1'),
      eq(employee.companyFn, 'C-SG'),
      eq(employee.employeeNo, 'EMP-1042'),
    ));
    const [annualType] = await db.select({ id: leaveType.id })
      .from(leaveType)
      .where(and(
        eq(leaveType.masterFn, 'M1'),
        eq(leaveType.companyFn, 'C-SG'),
        eq(leaveType.code, 'ANNUAL'),
      ));
    const [policy] = await db.select({ id: leavePolicyVersion.id })
      .from(leavePolicyVersion)
      .where(and(
        eq(leavePolicyVersion.masterFn, 'M1'),
        eq(leavePolicyVersion.companyFn, 'C-SG'),
        eq(leavePolicyVersion.leaveTypeId, annualType.id),
        eq(leavePolicyVersion.status, 'confirmed'),
      ));
    const [legacyBefore] = await db.select({
      id: leaveRequest.id,
      days: leaveRequest.days,
      legacyPolicy: leaveRequest.legacyPolicy,
    }).from(leaveRequest).where(and(
      eq(leaveRequest.masterFn, 'M1'),
      eq(leaveRequest.companyFn, 'C-SG'),
      eq(leaveRequest.legacyPolicy, true),
    )).limit(1);

    const auth = await login();
    const headers = {
      cookie: auth.header,
      'content-type': 'application/json',
      'x-csrf-token': auth.csrf,
    };
    const encashmentPayload = {
      employeeId: worker.id,
      leaveTypeId: annualType.id,
      policyVersionId: policy.id,
      days: '1.50',
      effectiveDate: '2026-09-15',
      eventKey: 'api-encashment-2026-09',
      note: 'Approved through the Payroll API proof.',
    };
    const approve = () => fetch(`${baseUrl}/api/payroll/leave-sources`, {
      method: 'POST',
      headers,
      body: JSON.stringify(encashmentPayload),
    });
    const approved = await approve();
    expect(approved.status).toBe(201);
    expect((await approved.clone().json()).data).toMatchObject({
      employeeId: worker.id,
      sourceType: 'encashment',
      effectDirection: 'earning',
      days: '1.50',
      baseSalarySnapshot: worker.baseSalary,
      effectiveDate: '2026-09-15',
      replayed: false,
    });
    const replay = await approve();
    expect(replay.status).toBe(201);
    expect((await replay.json()).data.replayed).toBe(true);

    const createRun = (docNo: string) => fetch(`${baseUrl}/api/payroll/runs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docNo,
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        payDate: '2026-09-28',
      }),
    });
    const firstRunResponse = await createRun('PAY-API-LEAVE-1');
    expect(firstRunResponse.status).toBe(201);
    const firstRun = (await firstRunResponse.json()).data;
    expect(firstRun.leaveSourceCount).toBe(1);

    const secondRunResponse = await createRun('PAY-API-LEAVE-2');
    expect(secondRunResponse.status).toBe(201);
    expect((await secondRunResponse.json()).data.leaveSourceCount).toBe(0);

    const sourcesResponse = await fetch(`${baseUrl}/api/payroll/leave-sources?limit=100`, {
      headers: { cookie: auth.header },
    });
    expect(sourcesResponse.status).toBe(200);
    const sources = (await sourcesResponse.json()).data;
    expect(sources.filter(
      (source: { sourceKey: string }) => source.sourceKey === 'encashment:api-encashment-2026-09',
    )).toHaveLength(1);

    const linesResponse = await fetch(`${baseUrl}/api/payroll/run-lines?limit=100&runId=${firstRun.id}`, {
      headers: { cookie: auth.header },
    });
    expect(linesResponse.status).toBe(200);
    const lines = (await linesResponse.json()).data;
    expect(lines.every((line: { runId: number }) => line.runId === firstRun.id)).toBe(true);
    const workerLine = lines.find(
      (line: { runId: number; employeeId: number }) =>
        line.runId === firstRun.id && line.employeeId === worker.id,
    );
    expect(workerLine).toMatchObject({
      baseGrossPay: worker.baseSalary,
      leaveDeductions: '0.00',
    });
    expect(Number(workerLine.leaveEarnings)).toBeGreaterThan(0);
    expect(Number(workerLine.grossPay)).toBe(
      Number(worker.baseSalary) + Number(workerLine.leaveEarnings),
    );

    const mappingsResponse = await fetch(
      `${baseUrl}/api/payroll/run-leave-sources?limit=100`,
      { headers: { cookie: auth.header } },
    );
    expect(mappingsResponse.status).toBe(200);
    const mappings = (await mappingsResponse.json()).data;
    expect(mappings.filter(
      (mapping: { runId: number }) => mapping.runId === firstRun.id,
    )).toHaveLength(1);

    const [legacyAfter] = await db.select({
      days: leaveRequest.days,
      legacyPolicy: leaveRequest.legacyPolicy,
    }).from(leaveRequest).where(eq(leaveRequest.id, legacyBefore.id));
    expect(legacyBefore.legacyPolicy).toBe(true);
    expect(legacyAfter).toEqual({
      days: legacyBefore.days,
      legacyPolicy: true,
    });
  });
});
