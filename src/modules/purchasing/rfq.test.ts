import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  glEntry,
  product,
  purchaseOrder,
  purchaseRequisition,
  purchaseRequisitionLine,
  purchaseRfq,
  purchaseRfqLine,
  stockMovement,
  supplier,
  supplierQuotation,
  taxRule,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createPurchaseOrder } from './createPurchaseOrder';
import {
  convertSupplierQuotationToPurchaseOrderWithin,
  createPurchaseRfq,
  createSupplierQuotation,
  PurchasingRfqError,
  transitionPurchaseRfqWithin,
} from './rfq';

async function fixture(db: DB) {
  const [widget] = await db.insert(product).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    sku: 'RFQ-WIDGET',
    name: 'RFQ Widget',
    uom: 'unit',
  }).returning({ id: product.id });
  const [first, second, uninvited] = await db.insert(supplier).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'RFQ-S1', name: 'First Fictional Supplier' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'RFQ-S2', name: 'Second Fictional Supplier' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'RFQ-S3', name: 'Uninvited Fictional Supplier' },
  ]).returning({ id: supplier.id });
  await db.insert(taxRule).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    taxRegime: 'GST',
    taxCode: 'SR',
    rate: '9.000',
    validFrom: '2024-01-01',
  });
  const [requisition] = await db.insert(purchaseRequisition).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    reqNo: 'PR-RFQ-1',
    requestedByName: 'Fictional Buyer',
    department: 'Procurement Test',
    neededByDate: '2026-09-30',
    status: 'approved',
  }).returning({ id: purchaseRequisition.id });
  await db.insert(purchaseRequisitionLine).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    requisitionId: requisition.id,
    lineNo: 1,
    productId: widget.id,
    qty: '10',
    estimatedUnitCost: '5',
  });
  return { widget, first, second, uninvited, requisition };
}

async function issuedRfq(db: DB) {
  const fx = await fixture(db);
  const rfq = await createPurchaseRfq(db, SCOPE, {
    docNo: 'RFQ-TEST-1',
    requisitionId: fx.requisition.id,
    subject: 'Widget sourcing',
    rfqDate: '2026-08-01',
    responseDueDate: '2026-08-10',
    supplierIds: [fx.first.id, fx.second.id],
    lines: [{ productId: fx.widget.id, qty: 10 }],
  });
  await db.transaction((tx) => transitionPurchaseRfqWithin(tx, SCOPE, rfq.id, 'issue'));
  const [line] = await db.select({ id: purchaseRfqLine.id }).from(purchaseRfqLine)
    .where(eq(purchaseRfqLine.rfqId, rfq.id));
  return { ...fx, rfq, line };
}

describe('purchasing RFQ and supplier quotation chain', () => {
  it('creates a draft RFQ from an approved requisition and issues it', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const rfq = await createPurchaseRfq(db, SCOPE, {
      docNo: 'RFQ-CREATE',
      requisitionId: fx.requisition.id,
      subject: 'Production replenishment',
      rfqDate: '2026-08-01',
      responseDueDate: '2026-08-10',
      supplierIds: [fx.first.id, fx.second.id],
      lines: [{ productId: fx.widget.id, qty: 10 }],
    });

    expect(rfq).toMatchObject({ status: 'draft', version: 1, supplierCount: 2, lineCount: 1 });
    await expect(db.transaction((tx) => transitionPurchaseRfqWithin(
      tx, SCOPE, rfq.id, 'issue',
    ))).resolves.toMatchObject({ status: 'sent', version: 2 });
  });

  it('rejects unapproved, mismatched and already-sourced requisitions', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    await db.update(purchaseRequisition).set({ status: 'submitted' })
      .where(eq(purchaseRequisition.id, fx.requisition.id));
    const input = {
      docNo: 'RFQ-BAD', requisitionId: fx.requisition.id, subject: 'Bad source',
      rfqDate: '2026-08-01', responseDueDate: '2026-08-10',
      supplierIds: [fx.first.id], lines: [{ productId: fx.widget.id, qty: 10 }],
    };
    await expect(createPurchaseRfq(db, SCOPE, input)).rejects.toThrow('approved requisition');

    await db.update(purchaseRequisition).set({ status: 'approved' })
      .where(eq(purchaseRequisition.id, fx.requisition.id));
    await expect(createPurchaseRfq(db, SCOPE, {
      ...input, docNo: 'RFQ-MISMATCH', lines: [{ productId: fx.widget.id, qty: 9 }],
    })).rejects.toThrow('match the approved requisition');
    await createPurchaseRfq(db, SCOPE, { ...input, docNo: 'RFQ-FIRST' });
    await expect(createPurchaseRfq(db, SCOPE, { ...input, docNo: 'RFQ-SECOND' }))
      .rejects.toThrow('already has an RFQ');
  });

  it('accepts only invited complete responses and marks the RFQ responded', async () => {
    const db = await freshDb();
    const fx = await issuedRfq(db);
    const quote = (supplierId: number, docNo: string, unitCost: number) => ({
      docNo,
      rfqId: fx.rfq.id,
      supplierId,
      quoteDate: '2026-08-02',
      validUntil: '2026-09-15',
      currency: 'SGD',
      leadTimeDays: 7,
      paymentTerms: 'Net 30',
      lines: [{ rfqLineId: fx.line.id, unitCost, taxCode: 'SR' }],
    });

    await expect(createSupplierQuotation(db, SCOPE, quote(
      fx.uninvited.id, 'SQ-UNINVITED', 5,
    ))).rejects.toThrow('not invited');
    const first = await createSupplierQuotation(db, SCOPE, quote(fx.first.id, 'SQ-FIRST', 5));
    expect(first).toMatchObject({ status: 'received', totalAmount: '54.50', lineCount: 1 });
    await expect(createSupplierQuotation(db, SCOPE, quote(
      fx.first.id, 'SQ-DUPLICATE-RESPONSE', 4.75,
    ))).rejects.toThrow('already responded');
    let [rfq] = await db.select().from(purchaseRfq).where(eq(purchaseRfq.id, fx.rfq.id));
    expect(rfq.status).toBe('sent');

    await createSupplierQuotation(db, SCOPE, quote(fx.second.id, 'SQ-SECOND', 5.5));
    [rfq] = await db.select().from(purchaseRfq).where(eq(purchaseRfq.id, fx.rfq.id));
    expect(rfq).toMatchObject({ status: 'responded', version: 3 });
  });

  it('prevents bypassing an active requisition RFQ with a direct purchase order', async () => {
    const db = await freshDb();
    const fx = await issuedRfq(db);
    await expect(createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-BYPASS',
      supplierId: fx.first.id,
      requisitionId: fx.requisition.id,
      orderDate: '2026-08-03',
      currency: 'SGD',
      lines: [{ productId: fx.widget.id, qty: 10, unitCost: 5, taxCode: 'SR' }],
    })).rejects.toThrow('must be converted from its winning quotation');
    expect(await db.select().from(purchaseOrder)).toHaveLength(0);
  });

  it('atomically awards one quotation, rejects competitors and creates a traceable PO without stock or GL', async () => {
    const db = await freshDb();
    const fx = await issuedRfq(db);
    const makeQuote = (supplierId: number, docNo: string, unitCost: number) => createSupplierQuotation(db, SCOPE, {
      docNo, rfqId: fx.rfq.id, supplierId,
      quoteDate: '2026-08-02', validUntil: '2026-09-15', currency: 'SGD',
      leadTimeDays: 7, paymentTerms: 'Net 30',
      lines: [{ rfqLineId: fx.line.id, unitCost, taxCode: 'SR' }],
    });
    const first = await makeQuote(fx.first.id, 'SQ-WINNER', 5);
    const second = await makeQuote(fx.second.id, 'SQ-RUNNER-UP', 5.5);

    const result = await db.transaction((tx) => convertSupplierQuotationToPurchaseOrderWithin(
      tx, SCOPE, first.id, { docNo: 'PO-FROM-RFQ', orderDate: '2026-08-03' },
    ));
    expect(result).toMatchObject({
      quotationId: first.id,
      rfqId: fx.rfq.id,
      purchaseOrderNo: 'PO-FROM-RFQ',
      status: 'open',
      totalAmount: '54.50',
    });
    const [order] = await db.select().from(purchaseOrder).where(eq(purchaseOrder.id, result.purchaseOrderId));
    expect(order).toMatchObject({
      requisitionId: fx.requisition.id,
      supplierQuotationId: first.id,
      supplierId: fx.first.id,
    });
    const quotes = await db.select({ id: supplierQuotation.id, status: supplierQuotation.status })
      .from(supplierQuotation).where(eq(supplierQuotation.rfqId, fx.rfq.id));
    expect(quotes).toEqual(expect.arrayContaining([
      { id: first.id, status: 'converted' },
      { id: second.id, status: 'rejected' },
    ]));
    const [rfq] = await db.select().from(purchaseRfq).where(eq(purchaseRfq.id, fx.rfq.id));
    expect(rfq.status).toBe('awarded');
    expect(await db.select().from(stockMovement)).toHaveLength(0);
    expect(await db.select().from(glEntry)).toHaveLength(0);
    await expect(db.transaction((tx) => convertSupplierQuotationToPurchaseOrderWithin(
      tx, SCOPE, first.id, { docNo: 'PO-DUPLICATE', orderDate: '2026-08-03' },
    ))).rejects.toThrow(PurchasingRfqError);
    expect(await db.select().from(purchaseOrder)).toHaveLength(1);
  });

  it('keeps tenant scope on reads and lifecycle actions', async () => {
    const db = await freshDb();
    const fx = await issuedRfq(db);
    await expect(db.transaction((tx) => transitionPurchaseRfqWithin(
      tx, { masterFn: 'OTHER', companyFn: 'OTHER-C' }, fx.rfq.id, 'close',
    ))).rejects.toThrow('does not exist');
    const [stored] = await db.select().from(purchaseRfq).where(and(
      eq(purchaseRfq.masterFn, SCOPE.masterFn),
      eq(purchaseRfq.id, fx.rfq.id),
    ));
    expect(stored.status).toBe('sent');
  });
});
