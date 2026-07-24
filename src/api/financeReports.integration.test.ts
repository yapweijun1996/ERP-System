import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='))?.slice('erp_csrf='.length);
  if (!csrf) throw new Error('Missing CSRF cookie.');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrf) };
}

describe('finance reporting API', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let auth: { header: string; csrf: string };

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@acme.co', password: 'demo1234' }),
    });
    auth = cookies(response);
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  });

  it('serves options and a canonical period P&L without client-side GL loading', async () => {
    const options = await fetch(`${baseUrl}/api/finance/reports/profit-loss/options`, {
      headers: { cookie: auth.header },
    });
    expect(options.status).toBe(200);
    const optionBody = await options.json();
    expect(optionBody.data.companies).toHaveLength(2);
    expect(optionBody.data.accountingBasis).toBe('accrual');
    const report = await fetch(
      `${baseUrl}/api/finance/reports/profit-loss?comparison=budget&presentationCurrency=SGD&companyFns=C-SG`,
      { headers: { cookie: auth.header } },
    );
    expect(report.status).toBe(200);
    expect(await report.json()).toMatchObject({
      data: {
        presentationCurrency: 'SGD',
        comparison: 'budget',
        period: { periodNo: 6 },
      },
      meta: { source: 'posted_gl', accountingBasis: 'accrual' },
    });
  });

  it('serves canonical AR aging options and bounded opaque pages', async () => {
    const options = await fetch(`${baseUrl}/api/finance/reports/ar-aging/options`, {
      headers: { cookie: auth.header },
    });
    expect(options.status).toBe(200);
    expect(await options.json()).toMatchObject({
      data: {
        currency: 'SGD',
        bucketPolicy: { dueDays: 30 },
        customers: expect.any(Array),
      },
      meta: {},
    });
    const report = await fetch(`${baseUrl}/api/finance/reports/ar-aging?limit=1`, {
      headers: { cookie: auth.header },
    });
    expect(report.status).toBe(200);
    expect(await report.json()).toMatchObject({
      data: {
        currency: 'SGD',
        metrics: { customerCount: expect.any(Number) },
        rows: expect.any(Array),
      },
      meta: {
        totalCount: expect.any(Number),
        source: 'unpaid_sales_invoices',
        balanceBasis: 'unpaid_invoice_total',
      },
    });
    for (const query of ['limit=101', 'cursor=not-a-cursor', 'customerId=invalid']) {
      const invalid = await fetch(`${baseUrl}/api/finance/reports/ar-aging?${query}`, {
        headers: { cookie: auth.header },
      });
      expect(invalid.status).toBe(400);
    }
  });

  it('requires CSRF and idempotency for budget approval and export', async () => {
    const noCsrf = await fetch(`${baseUrl}/api/finance/budgets`, {
      method: 'POST',
      headers: { cookie: auth.header, 'content-type': 'application/json' },
      body: JSON.stringify({ fiscalYear: 2027, name: 'Blocked', currency: 'SGD' }),
    });
    expect(noCsrf.status).toBe(403);
    const created = await fetch(`${baseUrl}/api/finance/budgets`, {
      method: 'POST',
      headers: {
        cookie: auth.header,
        'content-type': 'application/json',
        'x-csrf-token': auth.csrf,
      },
      body: JSON.stringify({ fiscalYear: 2027, name: 'Fictional API budget', currency: 'SGD' }),
    });
    expect(created.status).toBe(201);
    const budget = (await created.json()).data;
    const missingKey = await fetch(`${baseUrl}/api/finance/budgets/${budget.id}/actions/import`, {
      method: 'POST',
      headers: {
        cookie: auth.header,
        'content-type': 'application/json',
        'x-csrf-token': auth.csrf,
      },
      body: JSON.stringify({ rows: [{ accountCode: '4000', periodNo: 1, amount: '100.00' }] }),
    });
    expect(missingKey.status).toBe(428);
    const exportResponse = await fetch(`${baseUrl}/api/finance/reports/profit-loss/actions/export`, {
      method: 'POST',
      headers: {
        cookie: auth.header,
        'content-type': 'application/json',
        'x-csrf-token': auth.csrf,
        'idempotency-key': 'pnl-export-api-test',
      },
      body: JSON.stringify({
        format: 'xlsx',
        locale: 'en',
        filters: {
          companyFns: ['C-SG'],
          presentationCurrency: 'SGD',
          comparison: 'budget',
        },
      }),
    });
    expect(exportResponse.status).toBe(202);
    const replay = await fetch(`${baseUrl}/api/finance/reports/profit-loss/actions/export`, {
      method: 'POST',
      headers: {
        cookie: auth.header,
        'content-type': 'application/json',
        'x-csrf-token': auth.csrf,
        'idempotency-key': 'pnl-export-api-test',
      },
      body: JSON.stringify({
        format: 'xlsx',
        locale: 'en',
        filters: {
          companyFns: ['C-SG'],
          presentationCurrency: 'SGD',
          comparison: 'budget',
        },
      }),
    });
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect((await replay.json()).data.id).toBe((await exportResponse.json()).data.id);
  });
});
