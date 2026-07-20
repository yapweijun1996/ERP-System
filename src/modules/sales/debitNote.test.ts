import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  account,
  customer,
  glEntry,
  invoice,
  salesDebitNote,
  salesOrder,
  taxRule,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  createSalesDebitNote,
  postSalesDebitNote,
  SalesDebitNoteError,
} from './debitNote';

async function fixture(db: DB) {
  const [buyer] = await db.insert(customer).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'DN-CUSTOMER',
    name: 'Fictional Debit Customer',
  }).returning({ id: customer.id });
  const [order] = await db.insert(salesOrder).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    docNo: 'SO-DN-1',
    customerId: buyer.id,
    status: 'confirmed',
    orderDate: '2024-06-01',
    currency: 'SGD',
  }).returning({ id: salesOrder.id });
  const [original] = await db.insert(invoice).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    docNo: 'INV-DN-1',
    orderId: order.id,
    customerId: buyer.id,
    status: 'unpaid',
    invoiceDate: '2024-06-01',
    currency: 'SGD',
    netAmount: '100',
    taxAmount: '9',
    totalAmount: '109',
  }).returning({ id: invoice.id });
  await db.insert(account).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1100', name: 'AR', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '4000', name: 'Revenue', type: 'income' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '2200', name: 'Output tax', type: 'liability' },
  ]);
  await db.insert(taxRule).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    taxRegime: 'GST',
    taxCode: 'SR',
    rate: '9',
    validFrom: '2024-01-01',
  });
  return original;
}

describe('sales debit note', () => {
  it('creates a tax-snapshotted draft and posts balanced AR legs', async () => {
    const db = await freshDb();
    const original = await fixture(db);
    const draft = await createSalesDebitNote(db, SCOPE, {
      docNo: 'DN-1',
      invoiceId: original.id,
      noteDate: '2024-06-02',
      reason: 'Fictional expedite charge',
      netAmount: '20',
      taxCode: 'SR',
    });
    expect(draft).toMatchObject({ status: 'draft', totalAmount: '21.80' });
    const posted = await postSalesDebitNote(db, SCOPE, draft.id);
    expect(posted).toMatchObject({ status: 'posted', version: 2, totalAmount: '21.80' });
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'DN-1'));
    expect(legs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(21.8);
    expect(legs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(21.8);
  });

  it('rejects duplicate posting without creating extra GL legs', async () => {
    const db = await freshDb();
    const original = await fixture(db);
    const draft = await createSalesDebitNote(db, SCOPE, {
      docNo: 'DN-ONCE',
      invoiceId: original.id,
      noteDate: '2024-06-02',
      reason: 'Fictional handling charge',
      netAmount: '10',
      taxCode: 'SR',
    });
    await postSalesDebitNote(db, SCOPE, draft.id);
    await expect(postSalesDebitNote(db, SCOPE, draft.id)).rejects.toThrow(SalesDebitNoteError);
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'DN-ONCE'))).toHaveLength(3);
    expect(await db.select().from(salesDebitNote)).toHaveLength(1);
  });

  it('rejects a debit note against a cancelled invoice', async () => {
    const db = await freshDb();
    const original = await fixture(db);
    await db.update(invoice).set({ status: 'cancelled' }).where(eq(invoice.id, original.id));
    await expect(createSalesDebitNote(db, SCOPE, {
      docNo: 'DN-CANCELLED',
      invoiceId: original.id,
      noteDate: '2024-06-02',
      reason: 'Fictional invalid charge',
      netAmount: '10',
      taxCode: 'SR',
    })).rejects.toThrow('A cancelled invoice cannot receive a debit note.');
    expect(await db.select().from(salesDebitNote)).toHaveLength(0);
  });

  it('rejects a non-positive net amount', async () => {
    const db = await freshDb();
    const original = await fixture(db);
    await expect(createSalesDebitNote(db, SCOPE, {
      docNo: 'DN-ZERO',
      invoiceId: original.id,
      noteDate: '2024-06-02',
      reason: 'Fictional zero charge',
      netAmount: '0',
      taxCode: 'SR',
    })).rejects.toThrow('netAmount must be greater than zero.');
    expect(await db.select().from(salesDebitNote)).toHaveLength(0);
  });
});
