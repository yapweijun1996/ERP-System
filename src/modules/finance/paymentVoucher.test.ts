import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  account, accountingPeriod, glEntry, paymentVoucher, purchaseOrder, supplier, supplierInvoice,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createPaymentVoucher, PaymentVoucherError } from './paymentVoucher';

async function fixture(db: DB) {
  const [sup] = await db.insert(supplier).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'PV-SUPPLIER', name: 'Fictional Payee',
  }).returning({ id: supplier.id });
  await db.insert(account).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1000', name: 'Cash', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '2100', name: 'AP', type: 'liability' },
  ]);
  await db.insert(accountingPeriod).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, fiscalYear: 2026, periodNo: 1,
    label: 'January 2026', startDate: '2026-01-01', endDate: '2026-01-31', status: 'open',
  });
  return sup;
}

async function unpaidInvoice(db: DB, supplierId: number, docNo: string, total: string) {
  const [po] = await db.insert(purchaseOrder).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, docNo: `PO-${docNo}`,
    supplierId, status: 'received', orderDate: '2026-01-01', currency: 'SGD',
    netAmount: total, taxAmount: '0', totalAmount: total,
  }).returning({ id: purchaseOrder.id });
  const [invoice] = await db.insert(supplierInvoice).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, docNo, orderId: po.id, supplierId,
    status: 'unpaid', invoiceDate: '2026-01-05', currency: 'SGD',
    netAmount: total, taxAmount: '0', totalAmount: total,
  }).returning({ id: supplierInvoice.id });
  return invoice;
}

describe('payment voucher', () => {
  it('settles multiple invoices in one balanced posting and flips them to paid', async () => {
    const db = await freshDb();
    const sup = await fixture(db);
    const inv1 = await unpaidInvoice(db, sup.id, 'SINV-PV-1', '100.00');
    const inv2 = await unpaidInvoice(db, sup.id, 'SINV-PV-2', '250.00');

    const voucher = await createPaymentVoucher(db, SCOPE, {
      docNo: 'PV-1', supplierId: sup.id, paymentDate: '2026-01-10',
      supplierInvoiceIds: [inv1.id, inv2.id],
    });
    expect(voucher).toMatchObject({ docNo: 'PV-1', totalAmount: '350.00', lines: 2 });

    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'PV-1'));
    expect(legs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(350);
    expect(legs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(350);

    const invoices = await db.select({ status: supplierInvoice.status }).from(supplierInvoice)
      .where(eq(supplierInvoice.supplierId, sup.id));
    expect(invoices.every((row) => row.status === 'paid')).toBe(true);
  });

  it('rejects an invoice that belongs to a different supplier, with no partial posting', async () => {
    const db = await freshDb();
    const sup = await fixture(db);
    const [otherSup] = await db.insert(supplier).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'PV-OTHER', name: 'Other Payee',
    }).returning({ id: supplier.id });
    const mine = await unpaidInvoice(db, sup.id, 'SINV-PV-MINE', '100.00');
    const theirs = await unpaidInvoice(db, otherSup.id, 'SINV-PV-THEIRS', '50.00');

    await expect(createPaymentVoucher(db, SCOPE, {
      docNo: 'PV-CROSS', supplierId: sup.id, paymentDate: '2026-01-10',
      supplierInvoiceIds: [mine.id, theirs.id],
    })).rejects.toThrow(PaymentVoucherError);
    const [mineRow] = await db.select({ status: supplierInvoice.status }).from(supplierInvoice).where(eq(supplierInvoice.id, mine.id));
    expect(mineRow.status).toBe('unpaid');
  });

  it('rejects an already-paid invoice', async () => {
    const db = await freshDb();
    const sup = await fixture(db);
    const inv = await unpaidInvoice(db, sup.id, 'SINV-PV-PAID', '100.00');
    await createPaymentVoucher(db, SCOPE, {
      docNo: 'PV-FIRST', supplierId: sup.id, paymentDate: '2026-01-10', supplierInvoiceIds: [inv.id],
    });
    await expect(createPaymentVoucher(db, SCOPE, {
      docNo: 'PV-SECOND', supplierId: sup.id, paymentDate: '2026-01-11', supplierInvoiceIds: [inv.id],
    })).rejects.toThrow("is 'paid', not unpaid");
  });

  it('rejects a locked posting period and rolls back every settlement effect', async () => {
    const db = await freshDb();
    const sup = await fixture(db);
    const inv = await unpaidInvoice(db, sup.id, 'SINV-PV-LOCKED', '100.00');
    await db.insert(accountingPeriod).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, fiscalYear: 2026, periodNo: 5,
      label: 'May 2026', startDate: '2026-05-01', endDate: '2026-05-31', status: 'locked',
    });

    await expect(createPaymentVoucher(db, SCOPE, {
      docNo: 'PV-LOCKED', supplierId: sup.id, paymentDate: '2026-05-31',
      supplierInvoiceIds: [inv.id],
    })).rejects.toThrow('Accounting period May 2026 is locked.');
    expect(await db.select().from(paymentVoucher).where(eq(paymentVoucher.docNo, 'PV-LOCKED')))
      .toHaveLength(0);
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'PV-LOCKED')))
      .toHaveLength(0);
    const [invoice] = await db.select({ status: supplierInvoice.status })
      .from(supplierInvoice).where(eq(supplierInvoice.id, inv.id));
    expect(invoice.status).toBe('unpaid');
  });
});
