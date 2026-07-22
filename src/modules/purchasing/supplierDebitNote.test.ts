import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  account, glEntry, purchaseOrder, stockMovement, supplier, supplierDebitNote,
  supplierInvoice, taxRule,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createPaymentVoucher } from '../finance/paymentVoucher';
import {
  createSupplierDebitNote, postSupplierDebitNote, SupplierDebitNoteError,
} from './supplierDebitNote';

async function fixture(db: DB, total = '109.00') {
  const [vendor] = await db.insert(supplier).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: 'SDN-SUP', name: 'Fictional Claims Supplier',
  }).returning({ id: supplier.id });
  const [order] = await db.insert(purchaseOrder).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    docNo: 'PO-SDN-1', supplierId: vendor.id, status: 'received',
    orderDate: '2026-01-01', currency: 'SGD',
    netAmount: '100.00', taxAmount: '9.00', totalAmount: total,
  }).returning({ id: purchaseOrder.id });
  const [invoice] = await db.insert(supplierInvoice).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    docNo: 'SINV-SDN-1', orderId: order.id, supplierId: vendor.id,
    status: 'unpaid', invoiceDate: '2026-01-05', currency: 'SGD',
    netAmount: '100.00', taxAmount: '9.00', totalAmount: total,
  }).returning({ id: supplierInvoice.id });
  await db.insert(account).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1000', name: 'Cash', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1200', name: 'Input tax', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '2100', name: 'AP', type: 'liability' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '5800', name: 'Purchase variance', type: 'expense' },
  ]);
  await db.insert(taxRule).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    taxRegime: 'GST', taxCode: 'SR', rate: '9', validFrom: '2024-01-01',
  });
  return { vendor, invoice };
}

describe('supplier debit note', () => {
  it('drafts a tax snapshot, then posts balanced AP without moving stock', async () => {
    const db = await freshDb();
    const { invoice } = await fixture(db);
    const draft = await createSupplierDebitNote(db, SCOPE, {
      docNo: 'SDN-1', supplierInvoiceId: invoice.id, noteDate: '2026-01-10',
      reason: 'Fictional short-supply claim', netAmount: '20', taxCode: 'SR',
    });
    expect(draft).toMatchObject({ status: 'draft', totalAmount: '21.80' });
    expect(await db.select().from(glEntry)).toHaveLength(0);

    const posted = await postSupplierDebitNote(db, SCOPE, draft.id);
    expect(posted).toMatchObject({ status: 'posted', version: 2, totalAmount: '21.80' });
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'SDN-1'));
    expect(legs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(21.8);
    expect(legs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(21.8);
    expect(await db.select().from(stockMovement)).toHaveLength(0);
  });

  it('rejects a claim above remaining payable and a duplicate post', async () => {
    const db = await freshDb();
    const { invoice } = await fixture(db);
    const first = await createSupplierDebitNote(db, SCOPE, {
      docNo: 'SDN-FIRST', supplierInvoiceId: invoice.id, noteDate: '2026-01-10',
      reason: 'Fictional recovery', netAmount: '90', taxCode: 'SR',
    });
    await postSupplierDebitNote(db, SCOPE, first.id);
    await expect(postSupplierDebitNote(db, SCOPE, first.id)).rejects.toThrow(SupplierDebitNoteError);

    const tooLarge = await createSupplierDebitNote(db, SCOPE, {
      docNo: 'SDN-TOO-LARGE', supplierInvoiceId: invoice.id, noteDate: '2026-01-11',
      reason: 'Exceeds remaining amount', netAmount: '20', taxCode: 'SR',
    });
    await expect(postSupplierDebitNote(db, SCOPE, tooLarge.id)).rejects.toThrow('exceeds the remaining payable');
    const [row] = await db.select().from(supplierDebitNote).where(eq(supplierDebitNote.id, tooLarge.id));
    expect(row.status).toBe('draft');
  });

  it('makes Payment Voucher settle only the remaining payable', async () => {
    const db = await freshDb();
    const { vendor, invoice } = await fixture(db);
    const draft = await createSupplierDebitNote(db, SCOPE, {
      docNo: 'SDN-NET', supplierInvoiceId: invoice.id, noteDate: '2026-01-10',
      reason: 'Fictional logistics recovery', netAmount: '10', taxCode: 'SR',
    });
    await postSupplierDebitNote(db, SCOPE, draft.id);
    const voucher = await createPaymentVoucher(db, SCOPE, {
      docNo: 'PV-NET', supplierId: vendor.id, paymentDate: '2026-01-12',
      supplierInvoiceIds: [invoice.id],
    });
    expect(voucher.totalAmount).toBe('98.10');
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'PV-NET'));
    expect(legs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(98.1);
    expect(legs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(98.1);
  });
});
