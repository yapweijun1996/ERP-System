import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { product, warehouse, supplier, taxRule, account, glEntry, supplierInvoice } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createPurchaseOrder } from './createPurchaseOrder';
import { receiveGoods } from './receiveGoods';
import { postSupplierInvoice } from './postSupplierInvoice';
import { InvalidPurchaseOrderStateError, PostingError } from './errors';

async function seedPurchasingFixture(db: DB) {
  const [widget] = await db.insert(product).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, sku: 'WIDGET', name: 'Widget', uom: 'unit',
  }).returning({ id: product.id });
  const [wh] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'WH', name: 'Main Warehouse',
  }).returning({ id: warehouse.id });
  const [sup] = await db.insert(supplier).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'S1', name: 'Test Supplier',
  }).returning({ id: supplier.id });
  await db.insert(taxRule).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, taxRegime: 'GST', taxCode: 'SR',
    rate: '9.000', validFrom: '2024-01-01', validTo: null,
  });
  await db.insert(account).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1400', name: 'Inventory', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1200', name: 'Input Tax', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '2100', name: 'Accounts Payable', type: 'liability' },
  ]);
  return { widgetId: widget.id, warehouseId: wh.id, supplierId: sup.id };
}

describe('postSupplierInvoice', () => {
  it('success: posts a balanced GL (Dr Inventory + Dr Input Tax = Cr Accounts Payable)', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);
    const po = await createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-T1', supplierId: fx.supplierId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [{ productId: fx.widgetId, qty: 20, unitCost: 6, taxCode: 'SR' }],
    });
    await receiveGoods(db, SCOPE, { purchaseOrderId: po.orderId, warehouseId: fx.warehouseId, docNo: 'GR-T1', receivedDate: '2024-06-05' });

    const res = await postSupplierInvoice(db, SCOPE, {
      purchaseOrderId: po.orderId, docNo: 'SINV-T1', invoiceDate: '2024-06-06',
    });

    expect(res.net).toBe(120);
    expect(res.tax).toBe(10.8);
    expect(res.total).toBe(130.8);

    const legs = await db.select().from(glEntry).where(and(
      eq(glEntry.masterFn, SCOPE.masterFn), eq(glEntry.companyFn, SCOPE.companyFn), eq(glEntry.journalRef, 'SINV-T1'),
    ));
    expect(legs).toHaveLength(3);
    const totalDebit = legs.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = legs.reduce((sum, l) => sum + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
    expect(totalDebit).toBeCloseTo(130.8, 2);
  });

  it('rollback: posting an invoice before the goods receipt throws and posts no GL legs', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);
    const po = await createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-T2', supplierId: fx.supplierId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [{ productId: fx.widgetId, qty: 20, unitCost: 6, taxCode: 'SR' }],
    });
    // No receiveGoods call — PO is still 'open', not 'received'.

    await expect(postSupplierInvoice(db, SCOPE, {
      purchaseOrderId: po.orderId, docNo: 'SINV-T2', invoiceDate: '2024-06-06',
    })).rejects.toThrow(InvalidPurchaseOrderStateError);

    const legs = await db.select().from(glEntry).where(and(
      eq(glEntry.masterFn, SCOPE.masterFn), eq(glEntry.companyFn, SCOPE.companyFn), eq(glEntry.journalRef, 'SINV-T2'),
    ));
    expect(legs).toHaveLength(0);
  });

  it('idempotency guard: the same received PO cannot create a second invoice or GL posting', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);
    const po = await createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-T4', supplierId: fx.supplierId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [{ productId: fx.widgetId, qty: 20, unitCost: 6, taxCode: 'SR' }],
    });
    await receiveGoods(db, SCOPE, {
      purchaseOrderId: po.orderId, warehouseId: fx.warehouseId,
      docNo: 'GR-T4', receivedDate: '2024-06-05',
    });
    await postSupplierInvoice(db, SCOPE, {
      purchaseOrderId: po.orderId, docNo: 'SINV-T4', invoiceDate: '2024-06-06',
    });

    await expect(postSupplierInvoice(db, SCOPE, {
      purchaseOrderId: po.orderId, docNo: 'SINV-T4-DUP', invoiceDate: '2024-06-06',
    })).rejects.toThrow(InvalidPurchaseOrderStateError);

    const invoices = await db.select().from(supplierInvoice).where(eq(supplierInvoice.orderId, po.orderId));
    const duplicateLegs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'SINV-T4-DUP'));
    expect(invoices).toHaveLength(1);
    expect(duplicateLegs).toHaveLength(0);
  });

  it('throws PostingError when the chart of accounts is missing a required code', async () => {
    const db = await freshDb();
    // Deliberately skip the account fixture this time.
    const [widget] = await db.insert(product).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, sku: 'WIDGET', name: 'Widget', uom: 'unit',
    }).returning({ id: product.id });
    const [wh] = await db.insert(warehouse).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'WH', name: 'Main Warehouse',
    }).returning({ id: warehouse.id });
    const [sup] = await db.insert(supplier).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'S1', name: 'Test Supplier',
    }).returning({ id: supplier.id });
    await db.insert(taxRule).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, taxRegime: 'GST', taxCode: 'SR',
      rate: '9.000', validFrom: '2024-01-01', validTo: null,
    });
    const po = await createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-T3', supplierId: sup.id, orderDate: '2024-06-01', currency: 'SGD',
      lines: [{ productId: widget.id, qty: 20, unitCost: 6, taxCode: 'SR' }],
    });
    await receiveGoods(db, SCOPE, { purchaseOrderId: po.orderId, warehouseId: wh.id, docNo: 'GR-T3', receivedDate: '2024-06-05' });

    await expect(postSupplierInvoice(db, SCOPE, {
      purchaseOrderId: po.orderId, docNo: 'SINV-T3', invoiceDate: '2024-06-06',
    })).rejects.toThrow(PostingError);
  });
});
