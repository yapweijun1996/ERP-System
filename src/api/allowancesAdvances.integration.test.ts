import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  account,
  appUser,
  auditLog,
  employee,
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

describe('allowance and cash-advance API', () => {
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

  async function login(username: 'admin' | 'viewer', password: string) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    const cookie = cookies(response);
    return {
      cookie,
      csrf: decodeURIComponent(
        cookie.match(/(?:^|;\s*)erp_csrf=([^;]+)/)?.[1] ?? '',
      ),
    };
  }

  function jsonHeaders(auth: { cookie: string; csrf: string }) {
    return {
      cookie: auth.cookie,
      'x-csrf-token': auth.csrf,
      'content-type': 'application/json',
    };
  }

  it('enforces roles and exposes one audited calculation-to-settlement flow', async () => {
    const adminAuth = await login('admin', 'demo1234');
    const viewerAuth = await login('viewer', 'viewer1234');
    const denied = await fetch(`${baseUrl}/api/expense-settlements/allowance-policies/versions`, {
      method: 'POST',
      headers: jsonHeaders(viewerAuth),
      body: JSON.stringify({
        policyKey: 'api-mileage',
        versionNo: 1,
        allowanceType: 'mileage',
        unit: 'km',
        rate: '1',
        currency: 'SGD',
        effectiveFrom: '2026-01-01',
      }),
    });
    expect(denied.status).toBe(403);

    const configured = await fetch(
      `${baseUrl}/api/expense-settlements/allowance-policies/versions`,
      {
        method: 'POST',
        headers: jsonHeaders(adminAuth),
        body: JSON.stringify({
          policyKey: 'api-mileage',
          versionNo: 1,
          allowanceType: 'mileage',
          unit: 'km',
          rate: '1',
          currency: 'SGD',
          effectiveFrom: '2026-01-01',
        }),
      },
    );
    expect(configured.status).toBe(201);

    const calculated = await fetch(
      `${baseUrl}/api/expense-settlements/allowances/calculations`,
      {
        method: 'POST',
        headers: jsonHeaders(viewerAuth),
        body: JSON.stringify({
          calculationKey: 'api-mileage-calc-0001',
          allowanceType: 'mileage',
          serviceDate: '2026-07-25',
          units: '30',
        }),
      },
    );
    expect(calculated.status).toBe(201);
    const calculationBody = await calculated.json() as {
      data: { calculation: { id: number; amount: string; receiptRequired: boolean } };
    };
    expect(calculationBody.data.calculation).toMatchObject({
      amount: '30.0000',
      receiptRequired: false,
    });
    const approved = await fetch(
      `${baseUrl}/api/expense-settlements/allowances/calculations/${calculationBody.data.calculation.id}/actions/approve`,
      {
        method: 'POST',
        headers: jsonHeaders(adminAuth),
        body: '{}',
      },
    );
    expect(approved.status).toBe(200);

    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [viewerEmployee] = await db.select().from(employee).where(and(
      eq(employee.masterFn, 'M1'),
      eq(employee.companyFn, 'C-SG'),
      eq(employee.userId, viewer.userId),
    ));
    const accounts = await db.select().from(account).where(and(
      eq(account.masterFn, 'M1'),
      eq(account.companyFn, 'C-SG'),
    ));
    const accountId = (code: string) => accounts.find((row) => row.code === code)!.id;
    const issued = await fetch(`${baseUrl}/api/expense-settlements/cash-advances`, {
      method: 'POST',
      headers: jsonHeaders(adminAuth),
      body: JSON.stringify({
        advanceKey: 'api-advance-key-0001',
        advanceNo: 'API-CA-0001',
        employeeId: viewerEmployee.id,
        currency: 'SGD',
        issuedAmount: '100',
        issuedDate: '2026-07-25',
        purpose: 'API employee travel float',
        advanceReceivableAccountId: accountId('1100'),
        employeePayableAccountId: accountId('2100'),
        bankAccountId: accountId('1000'),
      }),
    });
    expect(issued.status).toBe(201);
    const issueBody = await issued.json() as { data: { advance: { id: number } } };

    const closed = await fetch(
      `${baseUrl}/api/expense-settlements/cash-advances/${issueBody.data.advance.id}/actions/close`,
      {
        method: 'POST',
        headers: jsonHeaders(adminAuth),
        body: JSON.stringify({
          sources: [{
            sourceType: 'allowance',
            sourceId: calculationBody.data.calculation.id,
          }],
          employeeRepaidAmount: '70',
          reason: 'API Finance reconciliation completed.',
        }),
      },
    );
    expect(closed.status).toBe(200);
    expect(await closed.json()).toMatchObject({
      data: {
        advance: { status: 'closed', employeeRepaidAmount: '70.00' },
        reconciliation: {
          approvedExpenseTotal: '30.00',
          requiredRepayment: '70.00',
          employeePayableDifference: '0.00',
        },
      },
    });
    const queue = await fetch(`${baseUrl}/api/expense-settlements/queue`, {
      headers: { cookie: adminAuth.cookie },
    });
    expect(queue.status).toBe(200);
    expect(await queue.json()).toMatchObject({
      data: {
        allowances: [{ status: 'applied' }],
        advances: [{ status: 'closed' }],
      },
    });

    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const audits = await db.select().from(auditLog)
      .where(eq(auditLog.actorUserId, admin.userId));
    expect(audits.map((row) => `${row.entity}:${row.action}`)).toEqual(
      expect.arrayContaining([
        'expense_allowance_policy_version:configure',
        'expense_allowance_calculation:approve',
        'cash_advance:issue',
        'cash_advance:close',
      ]),
    );
  });
});
