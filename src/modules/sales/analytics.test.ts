import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import {
  customer,
  product,
  salesCreditNote,
  salesDebitNote,
  salesOrder,
  salesOrderApproval,
  salesQuotation,
  salesReturn,
  stockLevel,
  warehouse,
} from '../../data/schema';
import { freshDb } from '../../test/helpers';
import { confirmSalesOrder } from './confirmOrder';
import { listSalesAnalyticsWithin } from './analytics';

const SCOPE = { masterFn: 'M1', companyFn: 'C-SG' };

async function seedSalesFacts() {
  const db = await freshDb();
  await seedDemo(db);
  const [buyer] = await db.select({ id: customer.id }).from(customer).where(and(
    eq(customer.masterFn, SCOPE.masterFn),
    eq(customer.companyFn, SCOPE.companyFn),
    eq(customer.code, 'CUST1'),
  ));
  const [widget] = await db.select({ id: product.id }).from(product).where(and(
    eq(product.masterFn, SCOPE.masterFn),
    eq(product.companyFn, SCOPE.companyFn),
    eq(product.sku, 'SG-WIDGET'),
  ));
  const [salesWarehouse] = await db.insert(warehouse).values({
    ...SCOPE, code: 'SALES-ANALYTICS', name: 'Sales Analytics Warehouse',
  }).returning({ id: warehouse.id });
  await db.insert(stockLevel).values({
    ...SCOPE, productId: widget.id, warehouseId: salesWarehouse.id, qty: '100',
  });
  const posting = await confirmSalesOrder(db, SCOPE, {
    docNo: 'SO-ANALYTICS-1',
    customerId: buyer.id,
    orderDate: '2024-06-12',
    currency: 'SGD',
    lines: [{
      productId: widget.id,
      warehouseId: salesWarehouse.id,
      qty: 2,
      unitPrice: 55,
      taxCode: 'SR',
    }],
  });
  const [returnRow] = await db.insert(salesReturn).values({
    ...SCOPE,
    docNo: 'RMA-ANALYTICS-1',
    deliveryId: posting.deliveryId!,
    invoiceId: posting.invoiceId,
    warehouseId: salesWarehouse.id,
    status: 'credited',
    returnDate: '2024-06-18',
    reason: 'Analytics fixture credit',
  }).returning({ id: salesReturn.id });
  await db.insert(salesCreditNote).values({
    ...SCOPE,
    docNo: 'CN-ANALYTICS-1',
    returnId: returnRow.id,
    invoiceId: posting.invoiceId,
    status: 'posted',
    noteDate: '2024-06-18',
    currency: 'SGD',
    netAmount: '10.00',
    taxAmount: '0.90',
    totalAmount: '10.90',
  });
  await db.insert(salesDebitNote).values({
    ...SCOPE,
    docNo: 'DN-ANALYTICS-1',
    invoiceId: posting.invoiceId,
    status: 'posted',
    noteDate: '2024-06-20',
    currency: 'SGD',
    reason: 'Analytics fixture surcharge',
    netAmount: '5.00',
    taxCode: 'SR',
    taxRate: '9.000',
    taxAmount: '0.45',
    totalAmount: '5.45',
  });
  await db.insert(salesQuotation).values([
    {
      ...SCOPE, docNo: 'QUO-ANALYTICS-WON', customerId: buyer.id,
      status: 'converted', quoteDate: '2024-06-01', validUntil: '2024-06-30',
      currency: 'SGD', probability: '100', netAmount: '100', taxAmount: '9',
      totalAmount: '109',
    },
    {
      ...SCOPE, docNo: 'QUO-ANALYTICS-LOST', customerId: buyer.id,
      status: 'rejected', quoteDate: '2024-06-02', validUntil: '2024-06-30',
      currency: 'SGD', probability: '0', netAmount: '50', taxAmount: '4.50',
      totalAmount: '54.50',
    },
  ]);
  return db;
}

describe('canonical sales analytics', () => {
  it('rebuilds revenue, customer, salesperson and lifecycle facts with exact adjustments', async () => {
    const db = await seedSalesFacts();
    const page = await listSalesAnalyticsWithin(db, SCOPE, { limit: 100 });
    expect(page.nextCursor).toBeNull();
    expect(page.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'summary', recognizedRevenue: '105.00', grossInvoiceRevenue: '110.00',
        postedCreditRevenue: '10.00', postedDebitRevenue: '5.00',
        openReceivables: '114.45', invoiceCount: 1,
      }),
      expect.objectContaining({
        kind: 'monthly-revenue', period: '2024-06', recognizedRevenue: '105.00',
      }),
      expect.objectContaining({
        kind: 'customer-revenue', customerCode: 'CUST1', customerName: 'Beta Pte Ltd',
        ownerName: 'Admin', recognizedRevenue: '105.00', billedTotal: '114.45',
      }),
      expect.objectContaining({
        kind: 'salesperson-revenue', salesperson: 'Admin', customerCount: 1,
        invoiceCount: 1, recognizedRevenue: '105.00',
      }),
      expect.objectContaining({ kind: 'quotation-status', status: 'converted', count: 1 }),
      expect.objectContaining({ kind: 'quotation-status', status: 'rejected', count: 1 }),
      expect.objectContaining({ kind: 'order-status', status: 'confirmed', count: 1 }),
      expect.objectContaining({ kind: 'invoice-status', status: 'unpaid', count: 1 }),
      expect.objectContaining({ kind: 'delivery-status', status: 'delivered', count: 1 }),
    ]));
  });

  it('uses a stable bounded cursor across heterogeneous derived rows', async () => {
    const db = await seedSalesFacts();
    const first = await listSalesAnalyticsWithin(db, SCOPE, { limit: 3 });
    expect(first.data).toHaveLength(3);
    expect(first.nextCursor).toBe(first.data[2].id);
    const second = await listSalesAnalyticsWithin(db, SCOPE, {
      cursor: first.nextCursor ?? 0,
      limit: 100,
    });
    expect(second.data.length).toBeGreaterThan(0);
    expect(second.data.every((row) => row.id > (first.nextCursor ?? 0))).toBe(true);
  });

  it('reports an approved draft by its effective approval state', async () => {
    const db = await seedSalesFacts();
    const [buyer] = await db.select({ id: customer.id }).from(customer).where(and(
      eq(customer.masterFn, SCOPE.masterFn),
      eq(customer.companyFn, SCOPE.companyFn),
      eq(customer.code, 'CUST1'),
    ));
    const [order] = await db.insert(salesOrder).values({
      ...SCOPE, docNo: 'SO-ANALYTICS-APPROVED', customerId: buyer.id,
      status: 'draft', orderDate: '2024-06-21', currency: 'SGD',
      netAmount: '100.00', taxAmount: '9.00', totalAmount: '109.00',
    }).returning({ id: salesOrder.id });
    await db.insert(salesOrderApproval).values({
      ...SCOPE, orderId: order.id, status: 'approved',
      reason: 'Analytics effective-status fixture',
      decidedAt: new Date('2024-06-21T09:00:00Z'),
      decidedByName: 'Approver', decisionNote: 'Approved for analytics proof',
    });
    const page = await listSalesAnalyticsWithin(db, SCOPE, { limit: 100 });
    expect(page.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'order-status', status: 'approved', count: 1, value: '109.00' }),
    ]));
  });

  it('returns an honest empty company summary without leaking another company', async () => {
    const db = await seedSalesFacts();
    const page = await listSalesAnalyticsWithin(db, { masterFn: 'M1', companyFn: 'C-MY' }, {
      limit: 100,
    });
    expect(page.data).toEqual([
      expect.objectContaining({
        kind: 'summary', recognizedRevenue: '0.00', invoiceCount: 0,
        openOrderCount: 0, openReceivables: '0.00',
      }),
    ]);
    expect(page.data.some((row) => row.kind === 'customer-revenue')).toBe(false);
  });
});
