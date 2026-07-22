import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  account,
  glEntry,
  product,
  purchaseOrderLine,
  purchaseReturn,
  purchaseReturnLine,
  stockMovement,
  supplier,
  supplierCreditNote,
  supplierCreditNoteLine,
  supplierInvoice,
  taxRule,
  warehouse,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { markPurchaseOrderApprovedForFixture } from '../../test/purchasing';
import { getStockQty, issueStock } from '../inventory/stock';
import { createPurchaseOrder } from './createPurchaseOrder';
import { postSupplierInvoice } from './postSupplierInvoice';
import {
  createPurchaseReturn,
  PurchaseReturnError,
  rejectPurchaseReturnWithin,
  shipAndCreditPurchaseReturn,
} from './purchaseReturn';
import { receiveGoods } from './receiveGoods';

async function fixture(db: DB, suffix = '1') {
  const [item] = await db.insert(product).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    sku: `PUR-RETURN-${suffix}`,
    name: `Purchase return item ${suffix}`,
  }).returning({ id: product.id });
  const [location] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: `PUR-WH-${suffix}`,
    name: `Purchase return warehouse ${suffix}`,
  }).returning({ id: warehouse.id });
  const [vendor] = await db.insert(supplier).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: `PUR-SUP-${suffix}`,
    name: `Fictional Supplier ${suffix}`,
  }).returning({ id: supplier.id });
  await db.insert(taxRule).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    taxRegime: 'GST',
    taxCode: 'SR',
    rate: '9.000',
    validFrom: '2024-01-01',
  }).onConflictDoNothing();
  await db.insert(account).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1400', name: 'Inventory', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1200', name: 'Input Tax', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '2100', name: 'Accounts Payable', type: 'liability' },
  ]).onConflictDoNothing();
  const order = await createPurchaseOrder(db, SCOPE, {
    docNo: `PO-RETURN-${suffix}`,
    supplierId: vendor.id,
    orderDate: '2024-06-01',
    currency: 'SGD',
    lines: [{ productId: item.id, qty: 20, unitCost: '6.125', taxCode: 'SR' }],
  });
  await markPurchaseOrderApprovedForFixture(db, SCOPE, order.orderId);
  const receipt = await receiveGoods(db, SCOPE, {
    purchaseOrderId: order.orderId,
    warehouseId: location.id,
    docNo: `GR-RETURN-${suffix}`,
    receivedDate: '2024-06-03',
  });
  const posted = await postSupplierInvoice(db, SCOPE, {
    purchaseOrderId: order.orderId,
    docNo: `SI-RETURN-${suffix}`,
    invoiceDate: '2024-06-04',
  });
  const [line] = await db.select({ id: purchaseOrderLine.id }).from(purchaseOrderLine)
    .where(eq(purchaseOrderLine.orderId, order.orderId));
  return {
    itemId: item.id,
    warehouseId: location.id,
    orderId: order.orderId,
    orderLineId: line.id,
    receiptId: receipt.receiptId,
    invoiceId: posted.invoiceId,
  };
}

describe('purchase return and supplier credit note', () => {
  it('creates a request with immutable Decimal cost and tax snapshots', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const created = await createPurchaseReturn(db, SCOPE, {
      docNo: 'PRET-1',
      goodsReceiptId: fx.receiptId,
      supplierInvoiceId: fx.invoiceId,
      returnDate: '2024-06-05',
      reason: 'Fictional packaging defect',
      lines: [{ purchaseOrderLineId: fx.orderLineId, qty: '2.5' }],
    });
    expect(created).toMatchObject({
      status: 'requested',
      netAmount: '15.31',
      taxAmount: '1.38',
      totalAmount: '16.69',
    });
    const [line] = await db.select().from(purchaseReturnLine)
      .where(eq(purchaseReturnLine.returnId, created.id));
    expect(line).toMatchObject({
      qty: '2.5000',
      unitCost: '6.1250',
      netAmount: '15.31',
      taxRate: '9.000',
      taxAmount: '1.38',
    });
  });

  it('ships stock and posts a balanced AP credit atomically', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const created = await createPurchaseReturn(db, SCOPE, {
      docNo: 'PRET-2', goodsReceiptId: fx.receiptId, supplierInvoiceId: fx.invoiceId,
      returnDate: '2024-06-05', reason: 'Fictional quality return',
      lines: [{ purchaseOrderLineId: fx.orderLineId, qty: '4' }],
    });
    expect(await getStockQty(db, SCOPE, fx.itemId, fx.warehouseId)).toBe(20);

    const credited = await shipAndCreditPurchaseReturn(db, SCOPE, created.id, {
      creditDocNo: 'SCN-2',
      noteDate: '2024-06-06',
    });
    expect(credited).toMatchObject({ status: 'credited', totalAmount: '26.71' });
    expect(await getStockQty(db, SCOPE, fx.itemId, fx.warehouseId)).toBe(16);
    expect(await db.select().from(stockMovement).where(and(
      eq(stockMovement.refType, 'purchase_return'),
      eq(stockMovement.refId, created.id),
    ))).toHaveLength(1);
    expect(await db.select().from(supplierCreditNote)
      .where(eq(supplierCreditNote.returnId, created.id)))
      .toMatchObject([{ status: 'posted', totalAmount: '26.71' }]);
    expect(await db.select().from(supplierCreditNoteLine)
      .where(eq(supplierCreditNoteLine.creditNoteId, credited.creditNoteId)))
      .toHaveLength(1);
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'SCN-2'));
    expect(legs).toHaveLength(3);
    expect(legs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(26.71);
    expect(legs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(26.71);
    const [sourceInvoice] = await db.select({ status: supplierInvoice.status })
      .from(supplierInvoice).where(eq(supplierInvoice.id, fx.invoiceId));
    expect(sourceInvoice.status).toBe('unpaid');
  });

  it('prevents cumulative over-return and rejects duplicate source lines', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    await createPurchaseReturn(db, SCOPE, {
      docNo: 'PRET-LIMIT-1', goodsReceiptId: fx.receiptId, supplierInvoiceId: fx.invoiceId,
      returnDate: '2024-06-05', reason: 'First request',
      lines: [{ purchaseOrderLineId: fx.orderLineId, qty: '18' }],
    });
    await expect(createPurchaseReturn(db, SCOPE, {
      docNo: 'PRET-LIMIT-2', goodsReceiptId: fx.receiptId, supplierInvoiceId: fx.invoiceId,
      returnDate: '2024-06-06', reason: 'Over limit',
      lines: [{ purchaseOrderLineId: fx.orderLineId, qty: '3' }],
    })).rejects.toThrow('exceeds the received quantity');
    await expect(createPurchaseReturn(db, SCOPE, {
      docNo: 'PRET-DUP', goodsReceiptId: fx.receiptId, supplierInvoiceId: fx.invoiceId,
      returnDate: '2024-06-06', reason: 'Duplicate line',
      lines: [
        { purchaseOrderLineId: fx.orderLineId, qty: '1' },
        { purchaseOrderLineId: fx.orderLineId, qty: '1' },
      ],
    })).rejects.toThrow('appear only once');
    expect(await db.select().from(purchaseReturn)).toHaveLength(1);
  });

  it('rejects a receipt and invoice from different purchase orders', async () => {
    const db = await freshDb();
    const first = await fixture(db, 'A');
    const second = await fixture(db, 'B');
    await expect(createPurchaseReturn(db, SCOPE, {
      docNo: 'PRET-MISMATCH',
      goodsReceiptId: first.receiptId,
      supplierInvoiceId: second.invoiceId,
      returnDate: '2024-06-05',
      reason: 'Mismatched source',
      lines: [{ purchaseOrderLineId: first.orderLineId, qty: '1' }],
    })).rejects.toThrow(PurchaseReturnError);
    expect(await db.select().from(purchaseReturn)).toHaveLength(0);
  });

  it('rolls back credit, GL and movement when stock is no longer available', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const created = await createPurchaseReturn(db, SCOPE, {
      docNo: 'PRET-ROLLBACK', goodsReceiptId: fx.receiptId, supplierInvoiceId: fx.invoiceId,
      returnDate: '2024-06-05', reason: 'Stock rollback proof',
      lines: [{ purchaseOrderLineId: fx.orderLineId, qty: '5' }],
    });
    await issueStock(db, SCOPE, {
      productId: fx.itemId, warehouseId: fx.warehouseId, qty: 19,
      refType: 'fixture_issue', refId: 1,
    });
    await expect(shipAndCreditPurchaseReturn(db, SCOPE, created.id, {
      creditDocNo: 'SCN-ROLLBACK', noteDate: '2024-06-06',
    })).rejects.toThrow('Insufficient stock');
    expect(await getStockQty(db, SCOPE, fx.itemId, fx.warehouseId)).toBe(1);
    expect(await db.select().from(supplierCreditNote)).toHaveLength(0);
    expect(await db.select().from(glEntry).where(eq(glEntry.journalRef, 'SCN-ROLLBACK')))
      .toHaveLength(0);
    const [returned] = await db.select({ status: purchaseReturn.status })
      .from(purchaseReturn).where(eq(purchaseReturn.id, created.id));
    expect(returned.status).toBe('requested');
  });

  it('rejects a requested return without inventory or accounting side effects', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const created = await createPurchaseReturn(db, SCOPE, {
      docNo: 'PRET-REJECT', goodsReceiptId: fx.receiptId, supplierInvoiceId: fx.invoiceId,
      returnDate: '2024-06-05', reason: 'Supplier review',
      lines: [{ purchaseOrderLineId: fx.orderLineId, qty: '2' }],
    });
    await db.transaction((tx) => rejectPurchaseReturnWithin(tx, SCOPE, created.id));
    await expect(db.transaction((tx) => rejectPurchaseReturnWithin(tx, SCOPE, created.id)))
      .rejects.toThrow('Only a requested');
    expect(await getStockQty(db, SCOPE, fx.itemId, fx.warehouseId)).toBe(20);
    expect(await db.select().from(supplierCreditNote)).toHaveLength(0);
  });
});
