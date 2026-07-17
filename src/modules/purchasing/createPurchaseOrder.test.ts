import { describe, it, expect } from 'vitest';
import type { DB } from '../../data/db';
import { product, supplier, taxRule } from '../../data/schema';
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
      lines: [{ productId: fx.widgetId, qty: 20, unitCost: 6, taxCode: 'SR' }],
    });

    expect(res.net).toBe(120);
    expect(res.tax).toBe(10.8);
    expect(res.total).toBe(130.8);
    expect(res.lines).toBe(1);
  });

  it('throws PostingError (not a silent wrong rate) when no tax rule covers the order date', async () => {
    const db = await freshDb();
    const fx = await seedPurchasingFixture(db);

    await expect(createPurchaseOrder(db, SCOPE, {
      docNo: 'PO-T2', supplierId: fx.supplierId, orderDate: '2020-01-01', currency: 'SGD', // before the seeded rule's validFrom
      lines: [{ productId: fx.widgetId, qty: 1, unitCost: 6, taxCode: 'SR' }],
    })).rejects.toThrow(PostingError);
  });
});
