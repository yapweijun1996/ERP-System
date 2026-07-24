import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { appUser, customer, invoice, salesOrder } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { buildArAgingReport, getArAgingOptions } from './arAging';

async function fixture() {
  const db = await freshDb();
  await seedDemo(db);
  const [actor] = await db.select({ id: appUser.userId }).from(appUser)
    .where(eq(appUser.email, 'admin@acme.co')).limit(1);
  await db.delete(invoice).where(eq(invoice.companyFn, 'C-SG'));
  let [baseCustomer] = await db.select({ id: customer.id }).from(customer)
    .where(eq(customer.companyFn, 'C-SG')).limit(1);
  if (!baseCustomer) {
    [baseCustomer] = await db.insert(customer).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      code: 'AR-BASE',
      name: 'AR Base Customer',
    }).returning({ id: customer.id });
  }
  const [order] = await db.insert(salesOrder).values({
    masterFn: 'M1',
    companyFn: 'C-SG',
    docNo: `SO-AR-FIXTURE-${Date.now()}`,
    customerId: baseCustomer.id,
    status: 'confirmed',
    orderDate: '2026-01-01',
    currency: 'SGD',
    netAmount: '100.00',
    taxAmount: '0.00',
    totalAmount: '100.00',
  }).returning({ id: salesOrder.id, customerId: salesOrder.customerId });
  return { db, actorUserId: actor.id, order };
}

function request(actorUserId: number) {
  return {
    masterFn: 'M1',
    activeCompanyFn: 'C-SG',
    actorUserId,
  };
}

describe('canonical AR aging', () => {
  it('uses the fixed due-date policy and exact boundary buckets', async () => {
    const { db, actorUserId, order } = await fixture();
    await db.insert(invoice).values([
      ['AR-0', '2026-06-24', '10.00', 'unpaid'],
      ['AR-1', '2026-06-23', '11.00', 'unpaid'],
      ['AR-30', '2026-05-25', '12.00', 'unpaid'],
      ['AR-31', '2026-05-24', '13.00', 'unpaid'],
      ['AR-60', '2026-04-25', '14.00', 'unpaid'],
      ['AR-61', '2026-04-24', '15.00', 'unpaid'],
      ['AR-90', '2026-03-26', '16.00', 'unpaid'],
      ['AR-91', '2026-03-25', '17.00', 'unpaid'],
      ['AR-FUTURE', '2026-07-25', '900.00', 'unpaid'],
      ['AR-PAID', '2026-01-01', '800.00', 'paid'],
      ['AR-CANCELLED', '2026-01-01', '700.00', 'cancelled'],
    ].map(([docNo, invoiceDate, totalAmount, status]) => ({
      masterFn: 'M1',
      companyFn: 'C-SG',
      docNo,
      orderId: order.id,
      customerId: order.customerId,
      status,
      invoiceDate,
      currency: 'SGD',
      netAmount: totalAmount,
      taxAmount: '0.00',
      totalAmount,
    })));

    const report = await buildArAgingReport(
      db,
      request(actorUserId),
      new Date('2026-07-24T12:00:00.000Z'),
    );
    expect(report.data.rows).toHaveLength(1);
    expect(report.data.rows[0]).toMatchObject({
      notDue: '10.00',
      days1To30: '23.00',
      days31To60: '27.00',
      days61To90: '31.00',
      days90Plus: '17.00',
      overdue: '98.00',
      total: '108.00',
    });
    expect(report.data.metrics).toEqual({
      totalReceivables: '108.00',
      overdue: '98.00',
      overduePercent: '90.7',
      customerCount: 1,
    });
    expect(report.meta).toMatchObject({
      nextCursor: null,
      totalCount: 1,
      source: 'unpaid_sales_invoices',
      balanceBasis: 'unpaid_invoice_total',
    });
  });

  it('filters customers and pages in overdue, total and customer order', async () => {
    const { db, actorUserId } = await fixture();
    const createdCustomers = await db.insert(customer).values([1, 2, 3].map((number) => ({
      masterFn: 'M1',
      companyFn: 'C-SG',
      code: `PAGE-${number}`,
      name: `Paging Customer ${number}`,
    }))).returning({ id: customer.id, code: customer.code });
    for (const [index, customerRow] of createdCustomers.entries()) {
      const [order] = await db.insert(salesOrder).values({
        masterFn: 'M1',
        companyFn: 'C-SG',
        docNo: `SO-PAGE-${index + 1}`,
        customerId: customerRow.id,
        status: 'confirmed',
        orderDate: '2026-01-01',
        currency: 'SGD',
        netAmount: '10.00',
        taxAmount: '0.00',
        totalAmount: '10.00',
      }).returning({ id: salesOrder.id });
      await db.insert(invoice).values({
        masterFn: 'M1',
        companyFn: 'C-SG',
        docNo: `INV-PAGE-${index + 1}`,
        orderId: order.id,
        customerId: customerRow.id,
        status: 'unpaid',
        invoiceDate: index === 2 ? '2026-06-24' : '2026-01-01',
        currency: 'SGD',
        netAmount: String(30 - index * 10),
        taxAmount: '0.00',
        totalAmount: String(30 - index * 10),
      });
    }
    const first = await buildArAgingReport(
      db,
      { ...request(actorUserId), limit: 2 },
      new Date('2026-07-24T12:00:00.000Z'),
    );
    expect(first.data.rows.map((row) => row.customerCode)).toEqual(['PAGE-1', 'PAGE-2']);
    expect(first.meta.nextCursor).toEqual(expect.any(String));
    expect(first.data.totals.total).toBe('60.00');
    const second = await buildArAgingReport(
      db,
      { ...request(actorUserId), limit: 2, cursor: first.meta.nextCursor! },
      new Date('2026-07-24T12:00:00.000Z'),
    );
    expect(second.data.rows.map((row) => row.customerCode)).toEqual(['PAGE-3']);
    expect(second.meta.nextCursor).toBeNull();
    const filtered = await buildArAgingReport(db, {
      ...request(actorUserId),
      customerId: createdCustomers[1].id,
    }, new Date('2026-07-24T12:00:00.000Z'));
    expect(filtered.data.rows.map((row) => row.customerCode)).toEqual(['PAGE-2']);
    expect(filtered.data.totals.total).toBe('20.00');
  });

  it('returns server-owned options and rejects mixed receivable currencies', async () => {
    const { db, actorUserId, order } = await fixture();
    const options = await getArAgingOptions(
      db,
      request(actorUserId),
      new Date('2026-07-24T12:00:00.000Z'),
    );
    expect(options).toMatchObject({
      asOf: '2026-07-24',
      currency: 'SGD',
      bucketPolicy: { dueDays: 30 },
    });
    await db.insert(invoice).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      docNo: 'AR-USD',
      orderId: order.id,
      customerId: order.customerId,
      status: 'unpaid',
      invoiceDate: '2026-01-01',
      currency: 'USD',
      netAmount: '10.00',
      taxAmount: '0.00',
      totalAmount: '10.00',
    });
    await expect(buildArAgingReport(db, request(actorUserId)))
      .rejects.toMatchObject({
        code: 'UNSUPPORTED_RECEIVABLE_CURRENCY',
      });
  });

  it('rejects invalid limits and opaque cursors', async () => {
    const { db, actorUserId } = await fixture();
    await expect(buildArAgingReport(db, { ...request(actorUserId), limit: 101 }))
      .rejects.toMatchObject({ code: 'invalid_report_query' });
    await expect(buildArAgingReport(db, { ...request(actorUserId), cursor: 'not-a-cursor' }))
      .rejects.toMatchObject({ code: 'invalid_report_query' });
  });
});
