import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import {
  account,
  appUser,
  auditLog,
  currency,
  documentScanJob,
  expenseBankChargeOverride,
  expenseLinePolicySnapshot,
  fxRate,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { uploadReceiptDocument } from '../modules/documents/upload';
import { createApp } from './app';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);

function responseCookies(response: Response): { cookie: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrf) throw new Error('Missing CSRF cookie');
  return { cookie: pairs.join('; '), csrf: decodeURIComponent(csrf.slice(9)) };
}

describe('expense policy API', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let viewerId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    viewerId = viewer.userId;
    await db.insert(currency).values({ code: 'USD', name: 'US Dollar', symbol: '$' });
    await db.insert(fxRate).values({
      fromCcy: 'USD',
      toCcy: 'SGD',
      rate: '1.35000000',
      validFrom: '2026-01-01',
    });
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('API did not bind');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
    }
  });

  async function login(username: 'admin' | 'viewer') {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationCode: 'ACME',
        username,
        password: username === 'admin' ? 'demo1234' : 'viewer1234',
      }),
    });
    expect(response.status).toBe(200);
    return responseCookies(response);
  }

  function headers(auth: { cookie: string; csrf: string }) {
    return {
      cookie: auth.cookie,
      'x-csrf-token': auth.csrf,
      'content-type': 'application/json',
    };
  }

  it('confirms policy, snapshots employee submission and restricts actual charge to Finance', async () => {
    const admin = await login('admin');
    const viewer = await login('viewer');
    const accounts = await db.select().from(account).where(and(
      eq(account.masterFn, scope.masterFn),
      eq(account.companyFn, scope.companyFn),
    ));
    const accountId = (code: string) => accounts.find((row) => row.code === code)!.id;
    const policy = await fetch(`${baseUrl}/api/expense-policies/versions`, {
      method: 'POST',
      headers: headers(admin),
      body: JSON.stringify({
        categoryCode: 'TRAVEL',
        categoryName: 'Business travel',
        policyKey: 'travel-api',
        policyName: 'Travel API policy',
        versionNo: 1,
        validFrom: '2026-01-01',
        taxTreatment: 'input_tax',
        taxCode: 'SR',
        inputTaxRecoverablePct: '100',
        employeePaidAllowed: true,
        companyPaidAllowed: true,
        expenseAccountId: accountId('5800'),
        inputTaxAccountId: accountId('1200'),
        employeePayableAccountId: accountId('2100'),
        companyPaidClearingAccountId: accountId('1000'),
        fxMethod: 'actual_bank_allowed',
      }),
    });
    expect(policy.status).toBe(201);

    const submitted = await fetch(`${baseUrl}/api/expense-policies/snapshots`, {
      method: 'POST',
      headers: headers(viewer),
      body: JSON.stringify({
        lineKey: 'expense-api-line-0001',
        categoryCode: 'TRAVEL',
        transactionDate: '2026-07-20',
        paymentSource: 'company_paid',
        originalCurrency: 'USD',
        originalNet: '100.00',
        originalTax: '9.00',
        originalGross: '109.00',
      }),
    });
    expect(submitted.status).toBe(201);
    const submittedBody = await submitted.json() as { data: { snapshot: { id: number } } };
    const [snapshot] = await db.select().from(expenseLinePolicySnapshot);
    expect(snapshot).toMatchObject({
      id: submittedBody.data.snapshot.id,
      ownerUserId: viewerId,
      baseGross: '147.1500',
    });

    const evidence = await uploadReceiptDocument(db, scope, { userId: viewerId }, {
      clientDraftId: 'expense_api_bank_evidence_001',
      fileName: 'bank-evidence.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
    });
    await db.update(documentScanJob).set({
      status: 'clean',
      scanner: 'api-expense-proof',
      resultCode: 'clean',
      completedAt: new Date(),
    }).where(eq(documentScanJob.versionId, evidence.version.id));
    const payload = JSON.stringify({
      actualBaseGross: '148.50',
      evidenceVersionId: evidence.version.id,
      reason: 'Finance matched the card statement.',
    });
    const denied = await fetch(
      `${baseUrl}/api/expense-policies/snapshots/${snapshot.id}/actual-bank-charge`,
      { method: 'POST', headers: headers(viewer), body: payload },
    );
    expect(denied.status).toBe(403);

    const verified = await fetch(
      `${baseUrl}/api/expense-policies/snapshots/${snapshot.id}/actual-bank-charge`,
      { method: 'POST', headers: headers(admin), body: payload },
    );
    expect(verified.status).toBe(201);
    expect(await db.select().from(expenseBankChargeOverride)).toEqual([
      expect.objectContaining({
        snapshotId: snapshot.id,
        actualBaseGross: '148.5000',
        actualFxRate: '1.36238532',
      }),
    ]);
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'expense_bank_charge_override'),
      eq(auditLog.action, 'verify'),
    ))).toHaveLength(1);
  });
});
