import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  listPurchasePriceVarianceWithin,
  listPurchasingAnalyticsWithin,
} from './analytics';

const SCOPE = { masterFn: 'M1', companyFn: 'C-SG' };

describe('canonical purchasing analytics', () => {
  it('rebuilds the dashboard and reports from real purchasing facts', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const page = await listPurchasingAnalyticsWithin(db, SCOPE, { limit: 100 });
    const summary = page.data.find((row) => row.kind === 'summary');
    expect(summary).toMatchObject({
      kind: 'summary', supplierCount: 2, receiptCount: expect.any(Number),
      openOrderValue: expect.stringMatching(/^\d+\.\d{2}$/),
      netUnpaidAp: expect.stringMatching(/^\d+\.\d{2}$/),
    });
    expect(page.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'monthly-spend', period: expect.stringMatching(/^\d{4}-\d{2}$/) }),
      expect.objectContaining({ kind: 'order-status', status: expect.any(String) }),
      expect.objectContaining({ kind: 'invoice-status', status: expect.any(String) }),
      expect.objectContaining({ kind: 'requisition-status', status: expect.any(String) }),
    ]));
    expect(page.nextCursor).toBeNull();
  });

  it('uses a stable synthetic cursor without changing the derived facts', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const first = await listPurchasingAnalyticsWithin(db, SCOPE, { limit: 2 });
    expect(first.data).toHaveLength(2);
    expect(first.nextCursor).toBe(first.data[1].id);
    const second = await listPurchasingAnalyticsWithin(db, SCOPE, {
      cursor: first.nextCursor ?? 0, limit: 100,
    });
    expect(second.data.every((row) => row.id > (first.nextCursor ?? 0))).toBe(true);
  });

  it('reports only honest invoice-header versus PO-header variance', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const page = await listPurchasePriceVarianceWithin(db, SCOPE, { limit: 100 });
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        invoiceNo: expect.any(String), orderNo: expect.any(String),
        invoiceTotal: expect.any(String), orderTotal: expect.any(String),
        variance: expect.stringMatching(/^-?\d+\.\d{2}$/),
        matchStatus: expect.stringMatching(/^(matched|variance)$/),
      }),
    ]));
    expect(page.data.every((row) => !Object.hasOwn(row, 'lines'))).toBe(true);
  });

  it('does not leak another company into either read model', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const myScope = { masterFn: 'M1', companyFn: 'C-MY' };
    const analytics = await listPurchasingAnalyticsWithin(db, myScope, { limit: 100 });
    const summary = analytics.data.find((row) => row.kind === 'summary');
    expect(summary).toMatchObject({ supplierCount: 0, receiptCount: 0, netUnpaidAp: '0.00' });
    expect(await listPurchasePriceVarianceWithin(db, myScope, { limit: 100 }))
      .toMatchObject({ data: [], nextCursor: null });
  });
});
