// Purchasing — create a purchase order: header + lines, effective-dated tax snapshot
// per line, in ONE transaction. No stock or GL impact yet — a PO is a commitment
// document; those happen later at receiveGoods.ts (stock) and
// postSupplierInvoice.ts (GL). Mirrors confirmOrder.ts's line-processing discipline
// minus the stock-issue step. See docs/DATA_MODEL.md §4.
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { getEffectiveTaxRate } from '../../data/repo';
import {
  product,
  purchaseOrder,
  purchaseOrderLine,
  supplier,
} from '../../data/schema';
import { PostingError } from './errors';

export interface PurchaseOrderLineInput {
  productId: number;
  qty: number;
  unitCost: number;
  taxCode: string;
}
export interface CreatePurchaseOrderInput {
  docNo: string;
  supplierId: number;
  orderDate: string; // YYYY-MM-DD
  currency: string;
  lines: PurchaseOrderLineInput[];
}

const money = (n: number) => n.toFixed(2);

/** Create a purchase order. Returns a summary. Throws (and rolls back everything) if
 *  no tax rule covers a line's date. */
export async function createPurchaseOrderWithin(exec: DB, scope: Scope, input: CreatePurchaseOrderInput) {
  if (!input.lines.length) throw new PostingError('A purchase order requires at least one line');
  const [supplierRow] = await exec.select({ id: supplier.id }).from(supplier).where(and(
    eq(supplier.masterFn, scope.masterFn),
    eq(supplier.companyFn, scope.companyFn),
    eq(supplier.id, input.supplierId),
  ));
  if (!supplierRow) throw new PostingError(`Supplier ${input.supplierId} is not available in this company`);
  const productIds = [...new Set(input.lines.map((line) => line.productId))];
  const companyProducts = await exec.select({ id: product.id }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    inArray(product.id, productIds),
  ));
  if (companyProducts.length !== productIds.length) {
    throw new PostingError('One or more products are not available in this company');
  }

  const [order] = await exec.insert(purchaseOrder).values({
    masterFn: scope.masterFn, companyFn: scope.companyFn,
    docNo: input.docNo, supplierId: input.supplierId,
    status: 'open', orderDate: input.orderDate, currency: input.currency,
  }).returning({ id: purchaseOrder.id });

  let netTotal = 0;
  let taxTotal = 0;
  let lineNo = 0;
  for (const ln of input.lines) {
    lineNo += 1;
    const taxRow = await getEffectiveTaxRate(exec, scope, ln.taxCode, input.orderDate);
    if (!taxRow) throw new PostingError(`No tax rule for ${ln.taxCode} on ${input.orderDate}`);
    const rate = Number(taxRow.rate);
    const net = Math.round(ln.qty * ln.unitCost * 100) / 100;
    const tax = Math.round(net * rate) / 100;

    await exec.insert(purchaseOrderLine).values({
      masterFn: scope.masterFn, companyFn: scope.companyFn,
      orderId: order.id, lineNo,
      productId: ln.productId, qty: String(ln.qty), unitCost: String(ln.unitCost),
      netAmount: money(net), taxCode: ln.taxCode, taxRate: String(rate), taxAmount: money(tax),
    });

    netTotal += net;
    taxTotal += tax;
  }
  const grandTotal = Math.round((netTotal + taxTotal) * 100) / 100;

  await exec.update(purchaseOrder).set({
    netAmount: money(netTotal), taxAmount: money(taxTotal), totalAmount: money(grandTotal),
    updatedAt: sql`now()`,
  }).where(eq(purchaseOrder.id, order.id));

  return {
    orderId: order.id, net: netTotal, tax: taxTotal, total: grandTotal, lines: input.lines.length,
  };
}

export async function createPurchaseOrder(db: DB, scope: Scope, input: CreatePurchaseOrderInput) {
  return db.transaction((tx) => createPurchaseOrderWithin(tx, scope, input));
}
