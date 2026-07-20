import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  account,
  customer,
  glEntry,
  product,
  salesCreditNote,
  salesDeliveryLine,
  salesReturn,
  salesReturnLine,
  stockLevel,
  stockMovement,
  taxRule,
  warehouse,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { getStockQty, setStockQtyForFixture } from '../inventory/stock';
import { confirmSalesOrder } from './confirmOrder';
import {
  createSalesReturn,
  receiveAndCreditSalesReturn,
  SalesReturnError,
} from './return';

async function fixture(db: DB) {
  const [item] = await db.insert(product).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    sku: 'RETURN-ITEM',
    name: 'Return item',
  }).returning({ id: product.id });
  const [location] = await db.insert(warehouse).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'RETURN-WH',
    name: 'Return warehouse',
  }).returning({ id: warehouse.id });
  await db.insert(stockLevel).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    productId: item.id,
    warehouseId: location.id,
    qty: '0',
  });
  await setStockQtyForFixture(db, SCOPE, item.id, location.id, 10);
  const [buyer] = await db.insert(customer).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'RETURN-CUSTOMER',
    name: 'Fictional Return Customer',
  }).returning({ id: customer.id });
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
    rate: '9.000',
    validFrom: '2024-01-01',
  });
  const posted = await confirmSalesOrder(db, SCOPE, {
    docNo: 'SO-RETURN-1',
    customerId: buyer.id,
    orderDate: '2024-06-01',
    currency: 'SGD',
    lines: [{
      productId: item.id,
      warehouseId: location.id,
      qty: 5,
      unitPrice: 10,
      taxCode: 'SR',
    }],
  });
  const [deliveryLine] = await db.select({ id: salesDeliveryLine.id })
    .from(salesDeliveryLine)
    .where(eq(salesDeliveryLine.deliveryId, posted.deliveryId));
  return { item, location, posted, deliveryLine };
}

describe('sales return and credit note', () => {
  it('receives returned stock and posts a balanced AR credit in one transaction', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    const created = await createSalesReturn(db, SCOPE, {
      docNo: 'RMA-1',
      deliveryId: fx.posted.deliveryId,
      invoiceId: fx.posted.invoiceId,
      warehouseId: fx.location.id,
      returnDate: '2024-06-02',
      reason: 'Fictional transit damage',
      lines: [{ deliveryLineId: fx.deliveryLine.id, qty: '2' }],
    });
    expect(created).toMatchObject({
      status: 'requested',
      netAmount: '20.00',
      taxAmount: '1.80',
      totalAmount: '21.80',
    });
    expect(await getStockQty(db, SCOPE, fx.item.id, fx.location.id)).toBe(5);

    const credited = await receiveAndCreditSalesReturn(db, SCOPE, created.id, {
      creditDocNo: 'CN-RMA-1',
      noteDate: '2024-06-02',
    });
    expect(credited).toMatchObject({ status: 'credited', totalAmount: '21.80' });
    expect(await getStockQty(db, SCOPE, fx.item.id, fx.location.id)).toBe(7);
    expect(await db.select().from(stockMovement).where(and(
      eq(stockMovement.refType, 'sales_return'),
      eq(stockMovement.refId, created.id),
    ))).toHaveLength(1);
    expect(await db.select().from(salesCreditNote)
      .where(eq(salesCreditNote.returnId, created.id)))
      .toMatchObject([{ status: 'posted', totalAmount: '21.80' }]);
    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'CN-RMA-1'));
    expect(legs.reduce((sum, row) => sum + Number(row.debit), 0)).toBe(21.8);
    expect(legs.reduce((sum, row) => sum + Number(row.credit), 0)).toBe(21.8);
  });

  it('prevents cumulative over-return and rolls the second request back', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    await createSalesReturn(db, SCOPE, {
      docNo: 'RMA-LIMIT-1',
      deliveryId: fx.posted.deliveryId,
      invoiceId: fx.posted.invoiceId,
      warehouseId: fx.location.id,
      returnDate: '2024-06-02',
      reason: 'First return',
      lines: [{ deliveryLineId: fx.deliveryLine.id, qty: '4' }],
    });
    await expect(createSalesReturn(db, SCOPE, {
      docNo: 'RMA-LIMIT-2',
      deliveryId: fx.posted.deliveryId,
      invoiceId: fx.posted.invoiceId,
      warehouseId: fx.location.id,
      returnDate: '2024-06-03',
      reason: 'Exceeds delivered quantity',
      lines: [{ deliveryLineId: fx.deliveryLine.id, qty: '2' }],
    })).rejects.toThrow(SalesReturnError);
    expect(await db.select().from(salesReturn)).toHaveLength(1);
    expect(await db.select().from(salesReturnLine)).toHaveLength(1);
  });

  it('rejects a zero return quantity', async () => {
    const db = await freshDb();
    const fx = await fixture(db);
    await expect(createSalesReturn(db, SCOPE, {
      docNo: 'RMA-ZERO',
      deliveryId: fx.posted.deliveryId,
      invoiceId: fx.posted.invoiceId,
      warehouseId: fx.location.id,
      returnDate: '2024-06-02',
      reason: 'Zero quantity',
      lines: [{ deliveryLineId: fx.deliveryLine.id, qty: '0' }],
    })).rejects.toThrow('must be greater than zero');
  });
});
