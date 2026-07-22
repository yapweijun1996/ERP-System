import { eq } from 'drizzle-orm';
import { describe, it, expect } from 'vitest';
import type { DB } from '../../data/db';
import { product, project, purchaseOrder, purchaseRequisition, supplier, taxRule } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createPurchaseOrder } from './createPurchaseOrder';
import { PostingError } from './errors';

async function seedPurchasingFixture(db: DB) {
  const [widget] = await db.insert(product).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, sku: 'WIDGET', name: 'Widget', uom: 'unit',
  }).returning({ id: product.id });
  const [sup] = await db.insert(supplier).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'S1', name: 'Test Supplier',
  }).returning({ id: supplier.id });
  await db.insert(taxRule).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, taxRegime: 'GST', taxCode: 'SR',
    rate: '9.000', validFrom: '2024-01-01', validTo: null,
  });
  return { widgetId: widget.id, supplierId: sup.id };
}

describe('createPurchaseOrder', () => {
  it('success: creates the header and lines with a tax snapshot, and sums the totals', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);

    const res = await createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-T1', supplierId: fx.supplierId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [
        { productId: fx.widgetId, qty: 20, unitCost: 6, taxCode: 'SR' },
        { productId: fx.widgetId, qty: '7.0000', unitCost: '0.3333', taxCode: 'SR' },
      ],
    });

    expect(res.net).toBe(122.33);
    expect(res.tax).toBe(11.01);
    expect(res.total).toBe(133.34);
    expect(res.lines).toBe(2);
  });

  it('throws PostingError (not a silent wrong rate) when no tax rule covers the order date', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);

    await expect(createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-T2', supplierId: fx.supplierId, orderDate: '2020-01-01', currency: 'SGD', // before the seeded rule's validFrom
      lines: [{ productId: fx.widgetId, qty: 1, unitCost: 6, taxCode: 'SR' }],
    })).rejects.toThrow(PostingError);
  });

  it('rejects supplier and product IDs from another company before creating a header', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);
    const [foreignSupplier] = await db.insert(supplier).values({
      masterFn: SCOPE.masterFn,
      companyFn: 'C-OTHER',
      code: 'FOREIGN-S',
      name: 'Foreign Supplier',
    }).returning({ id: supplier.id });
    const [foreignProduct] = await db.insert(product).values({
      masterFn: SCOPE.masterFn,
      companyFn: 'C-OTHER',
      sku: 'FOREIGN-P',
      name: 'Foreign Product',
    }).returning({ id: product.id });

    await expect(createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-FOREIGN-S',
      supplierId: foreignSupplier.id,
      orderDate: '2024-06-01',
      currency: 'SGD',
      lines: [{ productId: fx.widgetId, qty: 1, unitCost: 6, taxCode: 'SR' }],
    })).rejects.toThrow(PostingError);
    await expect(createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-FOREIGN-P',
      supplierId: fx.supplierId,
      orderDate: '2024-06-01',
      currency: 'SGD',
      lines: [{ productId: foreignProduct.id, qty: 1, unitCost: 6, taxCode: 'SR' }],
    })).rejects.toThrow(PostingError);

    expect(await db.select().from(purchaseOrder)).toHaveLength(0);
  });

  it('links a purchase order to an approved requisition, closing the trail', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);
    const [req] = await db.insert(purchaseRequisition).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, reqNo: 'PR-LINK-1',
      requestedByName: 'Fictional Requester', department: 'Fictional Dept',
      neededByDate: '2024-06-15', status: 'approved',
    }).returning({ id: purchaseRequisition.id });

    const res = await createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-LINKED', supplierId: fx.supplierId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [{ productId: fx.widgetId, qty: 1, unitCost: 6, taxCode: 'SR' }],
      requisitionId: req.id,
    });

    const [order] = await db.select({ requisitionId: purchaseOrder.requisitionId })
      .from(purchaseOrder).where(eq(purchaseOrder.id, res.orderId));
    expect(order.requisitionId).toBe(req.id);
  });

  it('rejects linking a requisition that is not yet approved', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);
    const [req] = await db.insert(purchaseRequisition).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, reqNo: 'PR-LINK-2',
      requestedByName: 'Fictional Requester', department: 'Fictional Dept',
      neededByDate: '2024-06-15', status: 'submitted',
    }).returning({ id: purchaseRequisition.id });

    await expect(createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-UNAPPROVED', supplierId: fx.supplierId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [{ productId: fx.widgetId, qty: 1, unitCost: 6, taxCode: 'SR' }],
      requisitionId: req.id,
    })).rejects.toThrow('must be approved');
    expect(await db.select().from(purchaseOrder)).toHaveLength(0);
  });

  it('rejects converting an already-converted requisition a second time', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);
    const [req] = await db.insert(purchaseRequisition).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, reqNo: 'PR-LINK-3',
      requestedByName: 'Fictional Requester', department: 'Fictional Dept',
      neededByDate: '2024-06-15', status: 'approved',
    }).returning({ id: purchaseRequisition.id });

    await createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-FIRST', supplierId: fx.supplierId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [{ productId: fx.widgetId, qty: 1, unitCost: 6, taxCode: 'SR' }],
      requisitionId: req.id,
    });

    await expect(createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-SECOND', supplierId: fx.supplierId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [{ productId: fx.widgetId, qty: 1, unitCost: 6, taxCode: 'SR' }],
      requisitionId: req.id,
    })).rejects.toThrow('already been converted');
    expect(await db.select().from(purchaseOrder)).toHaveLength(1);
  });

  it('tags a purchase order to a project when given a real projectId', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);
    const [proj] = await db.insert(project).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, projectNo: 'PRJ-PO-1',
      name: 'Fictional Project', managerName: 'Demo PM', startDate: '2024-01-01',
    }).returning({ id: project.id });

    const res = await createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-PROJECT', supplierId: fx.supplierId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [{ productId: fx.widgetId, qty: 1, unitCost: 6, taxCode: 'SR' }],
      projectId: proj.id,
    });

    const [order] = await db.select({ projectId: purchaseOrder.projectId })
      .from(purchaseOrder).where(eq(purchaseOrder.id, res.orderId));
    expect(order.projectId).toBe(proj.id);
  });

  it('rejects an unknown projectId before creating a header', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);

    await expect(createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-BAD-PROJECT', supplierId: fx.supplierId, orderDate: '2024-06-01', currency: 'SGD',
      lines: [{ productId: fx.widgetId, qty: 1, unitCost: 6, taxCode: 'SR' }],
      projectId: 999999,
    })).rejects.toThrow(PostingError);
    expect(await db.select().from(purchaseOrder)).toHaveLength(0);
  });
});
