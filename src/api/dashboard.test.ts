import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { account, customer, glEntry, salesOrder } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { buildDashboard } from './dashboard';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const asOf = new Date('2029-12-31T16:30:00Z');
const access = { sales: true, finance: true, inventory: true };

describe('dashboard monetary metrics', () => {
  it('uses open sales drafts, ledger cash and the company-local revenue month', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const before = await buildDashboard(db, scope.masterFn, scope.companyFn, access, asOf);
    const [buyer] = await db.select({ id: customer.id }).from(customer).where(and(
      eq(customer.masterFn, scope.masterFn), eq(customer.companyFn, scope.companyFn),
      eq(customer.code, 'CUST1'),
    ));
    const accounts = await db.select({ id: account.id, code: account.code }).from(account).where(and(
      eq(account.masterFn, scope.masterFn), eq(account.companyFn, scope.companyFn),
    ));
    const accountId = (code: string) => accounts.find((row) => row.code === code)!.id;
    await db.insert(salesOrder).values([
      { ...scope, docNo: 'SO-DASH-DRAFT', customerId: buyer.id, status: 'draft',
        orderDate: '2030-01-01', currency: 'SGD', totalAmount: '10.00' },
      { ...scope, docNo: 'SO-DASH-APPROVAL', customerId: buyer.id, status: 'pending_approval',
        orderDate: '2030-01-01', currency: 'SGD', totalAmount: '20.00' },
      { ...scope, docNo: 'SO-DASH-CONFIRMED', customerId: buyer.id, status: 'confirmed',
        orderDate: '2030-01-01', currency: 'SGD', totalAmount: '40.00' },
    ]);
    await db.insert(glEntry).values([
      { ...scope, journalRef: 'DASH-CASH', accountId: accountId('1000'),
        debit: '50.00', credit: '0', postedAt: asOf },
      { ...scope, journalRef: 'DASH-CASH', accountId: accountId('1100'),
        debit: '0', credit: '50.00', postedAt: asOf },
      { ...scope, journalRef: 'DASH-REVENUE', accountId: accountId('1100'),
        debit: '25.00', credit: '0', postedAt: new Date('2029-12-31T16:05:00Z') },
      { ...scope, journalRef: 'DASH-REVENUE', accountId: accountId('4000'),
        debit: '0', credit: '25.00', postedAt: new Date('2029-12-31T16:05:00Z') },
      { ...scope, journalRef: 'DASH-PRIOR', accountId: accountId('1100'),
        debit: '15.00', credit: '0', postedAt: new Date('2029-12-31T15:55:00Z') },
      { ...scope, journalRef: 'DASH-PRIOR', accountId: accountId('4000'),
        debit: '0', credit: '15.00', postedAt: new Date('2029-12-31T15:55:00Z') },
    ]);

    const after = await buildDashboard(db, scope.masterFn, scope.companyFn, access, asOf);
    expect(after.metrics.openOrders! - before.metrics.openOrders!).toBe(2);
    expect(after.metrics.openOrderValue! - before.metrics.openOrderValue!).toBe(30);
    expect(after.metrics.cash! - before.metrics.cash!).toBe(50);
    expect(after.metrics.mtdRevenue! - before.metrics.mtdRevenue!).toBe(25);

    const restricted = await buildDashboard(db, scope.masterFn, scope.companyFn, {
      sales: false, finance: false, inventory: false,
    }, asOf);
    expect(restricted.metrics).toMatchObject({
      openOrders: null, openOrderValue: null, openInvoices: null, arOpen: null,
      cash: null, mtdRevenue: null, productCount: null, stockAlertCount: null,
    });
    expect(restricted.stockAlerts).toEqual([]);
  });
});
