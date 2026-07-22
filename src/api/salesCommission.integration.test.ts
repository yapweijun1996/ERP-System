import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appUser,
  auditLog,
  customer,
  invoice,
  salesCommissionRun,
  salesOrder,
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

describe('sales commission API vertical slice', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let adminUserId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select({ id: appUser.userId }).from(appUser).where(and(
      eq(appUser.masterFn, 'M1'), eq(appUser.email, 'admin@acme.co'),
    ));
    adminUserId = admin.id;
    const [buyer] = await db.select({ id: customer.id }).from(customer).where(and(
      eq(customer.masterFn, 'M1'), eq(customer.companyFn, 'C-SG'),
    ));
    const [order] = await db.insert(salesOrder).values({
      masterFn: 'M1', companyFn: 'C-SG', docNo: 'SO-COMM-API',
      customerId: buyer.id, salespersonUserId: admin.id, status: 'confirmed',
      orderDate: '2026-06-01', currency: 'SGD', netAmount: '250.00',
      taxAmount: '22.50', totalAmount: '272.50',
    }).returning({ id: salesOrder.id });
    await db.insert(invoice).values({
      masterFn: 'M1', companyFn: 'C-SG', docNo: 'INV-COMM-API',
      orderId: order.id, customerId: buyer.id, salespersonUserId: admin.id,
      status: 'unpaid', invoiceDate: '2026-06-10', currency: 'SGD',
      netAmount: '250.00', taxAmount: '22.50', totalAmount: '272.50',
    });
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

  async function login(email = 'admin@acme.co', password = 'demo1234') {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(response.status).toBe(200);
    return cookies(response);
  }

  it('creates, activates, calculates and idempotently approves an audited immutable run', async () => {
    const auth = await login();
    const headers = {
      cookie: auth.header, 'content-type': 'application/json', 'x-csrf-token': auth.csrf,
    };
    const peopleResponse = await fetch(`${baseUrl}/api/sales/salespeople?limit=100`, {
      headers: { cookie: auth.header },
    });
    expect(peopleResponse.status).toBe(200);
    expect((await peopleResponse.json()).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: adminUserId, fullName: 'Admin' }),
    ]));

    const planResponse = await fetch(`${baseUrl}/api/sales/commission-plans`, {
      method: 'POST', headers: { ...headers, 'x-request-id': 'commission-plan-create' },
      body: JSON.stringify({
        code: 'COMM-API-2026', name: 'API recognized revenue',
        salespersonUserId: adminUserId, ratePct: '3.5',
        effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31',
      }),
    });
    expect(planResponse.status).toBe(201);
    const plan = (await planResponse.json()).data;
    expect(plan).toMatchObject({ status: 'draft', ratePct: '3.500' });
    const activate = () => fetch(
      `${baseUrl}/api/sales/commission-plans/${plan.id}/actions/activate`,
      { method: 'POST', headers: { ...headers, 'idempotency-key': 'commission-plan-activate' }, body: '{}' },
    );
    expect((await activate()).status).toBe(200);
    const activateReplay = await activate();
    expect(activateReplay.status).toBe(200);
    expect(activateReplay.headers.get('idempotency-replayed')).toBe('true');

    const runResponse = await fetch(`${baseUrl}/api/sales/commission-runs`, {
      method: 'POST', headers: { ...headers, 'x-request-id': 'commission-run-create' },
      body: JSON.stringify({
        docNo: 'COMRUN-API-2026-06', periodStart: '2026-06-01',
        periodEnd: '2026-06-30', currency: 'SGD',
      }),
    });
    expect(runResponse.status).toBe(201);
    const run = (await runResponse.json()).data;
    expect(run).toMatchObject({
      status: 'draft', grossInvoiceRevenue: '250.00', eligibleRevenue: '250.00',
      commissionAmount: '8.75', lineCount: 1, sourceCount: 1, createdByName: 'Admin',
    });
    const lines = await fetch(
      `${baseUrl}/api/sales/commission-lines?limit=100&runId=${run.id}`,
      {
      headers: { cookie: auth.header },
      },
    );
    expect((await lines.json()).data).toEqual([
      expect.objectContaining({ runId: run.id, commissionAmount: '8.75' }),
    ]);
    const sources = await fetch(
      `${baseUrl}/api/sales/commission-sources?limit=100&runId=${run.id}`,
      {
      headers: { cookie: auth.header },
      },
    );
    expect((await sources.json()).data).toEqual([
      expect.objectContaining({
        runId: run.id, sourceType: 'invoice', sourceDocNo: 'INV-COMM-API',
        recognizedAmount: '250.00', commissionAmount: '8.75',
      }),
    ]);

    const viewer = await login('viewer@acme.co', 'viewer1234');
    const denied = await fetch(`${baseUrl}/api/sales/commission-runs/${run.id}/actions/approve`, {
      method: 'POST', headers: {
        cookie: viewer.header, 'content-type': 'application/json',
        'x-csrf-token': viewer.csrf, 'idempotency-key': 'viewer-cannot-approve',
      }, body: JSON.stringify({ note: 'Unauthorized' }),
    });
    expect(denied.status).toBe(403);

    const approve = () => fetch(
      `${baseUrl}/api/sales/commission-runs/${run.id}/actions/approve`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'commission-run-approve' },
        body: JSON.stringify({ note: 'Matched to the immutable June sources.' }),
      },
    );
    const approvedResponse = await approve();
    expect(approvedResponse.status).toBe(200);
    const approved = await approvedResponse.json();
    expect(approved.data).toMatchObject({
      status: 'approved', version: 2, approvedByName: 'Admin',
      approvalNote: 'Matched to the immutable June sources.',
    });
    const replay = await approve();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(await replay.json()).toEqual(approved);

    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'sales/commission-runs'),
      eq(auditLog.entityId, String(run.id)),
    ))).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'create', requestId: 'commission-run-create' }),
      expect.objectContaining({ action: 'approve' }),
    ]));
  });

  it('lets a sales reader view runs but denies creation', async () => {
    const auth = await login('viewer@acme.co', 'viewer1234');
    expect((await fetch(`${baseUrl}/api/sales/commission-runs`, {
      headers: { cookie: auth.header },
    })).status).toBe(200);
    const denied = await fetch(`${baseUrl}/api/sales/commission-runs`, {
      method: 'POST', headers: {
        cookie: auth.header, 'content-type': 'application/json', 'x-csrf-token': auth.csrf,
      }, body: JSON.stringify({
        docNo: 'COMRUN-DENIED', periodStart: '2026-06-01',
        periodEnd: '2026-06-30', currency: 'SGD',
      }),
    });
    expect(denied.status).toBe(403);
    expect(await db.select().from(salesCommissionRun)).toHaveLength(0);
  });
});
