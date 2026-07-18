// Sales — confirm order: the full cross-module flow in ONE transaction.
//   sales_order + lines → issue stock per line → invoice → balanced gl_entry.
// Any failure (e.g. a line with insufficient stock) rolls the ENTIRE chain back: no order,
// no lines, no stock movements, no invoice, no ledger postings. See docs/DATA_MODEL.md §4.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { getEffectiveTaxRate } from '../../data/repo';
import { issueStockWithin } from '../inventory/stock';
import { assertCustomerCreditWithin } from './creditControl';
import {
  account,
  glEntry,
  invoice,
  salesDelivery,
  salesDeliveryLine,
  salesOrder,
  salesOrderLine,
} from '../../data/schema';

export interface OrderLineInput {
  productId: number;
  warehouseId: number;
  qty: number;
  unitPrice: number;
  taxCode: string;
}
export interface ConfirmOrderInput {
  docNo: string;
  customerId: number;
  orderDate: string; // YYYY-MM-DD
  currency: string;
  lines: OrderLineInput[];
}
export interface ConfirmDraftOrderInput {
  salesOrderId: number;
  warehouseId: number;
}

export class PostingError extends Error {
  constructor(message: string) { super(message); this.name = 'PostingError'; }
}

export class InvalidSalesOrderStateError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidSalesOrderStateError'; }
}

const money = (n: number) => n.toFixed(2);

async function accountIdByCode(exec: DB, scope: Scope, code: string): Promise<number> {
  const [a] = await exec
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.masterFn, scope.masterFn), eq(account.companyFn, scope.companyFn), eq(account.code, code)));
  if (!a) throw new PostingError(`Account ${code} not configured`);
  return a.id;
}

interface OrderToPost {
  id: number;
  docNo: string;
  customerId: number;
  orderDate: string;
  currency: string;
  net: number;
  tax: number;
  total: number;
  version: number;
}

interface IssueLine {
  orderLineId: number;
  lineNo: number;
  productId: number;
  warehouseId: number;
  qty: number;
}

async function postOrderWithin(
  exec: DB,
  scope: Scope,
  order: OrderToPost,
  lines: IssueLine[],
  bumpVersion: boolean,
) {
  if (lines.length === 0) throw new PostingError(`Sales order ${order.docNo} has no lines`);
  await assertCustomerCreditWithin(
    exec,
    scope,
    order.customerId,
    order.currency,
    order.total,
  );
  const deliveryDocNo = `DO-${order.docNo}`;
  const [delivery] = await exec.insert(salesDelivery).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo: deliveryDocNo,
    orderId: order.id,
    status: 'draft',
    deliveryDate: order.orderDate,
  }).returning({ id: salesDelivery.id });
  await exec.insert(salesDeliveryLine).values(lines.map((line) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    deliveryId: delivery.id,
    lineNo: line.lineNo,
    orderLineId: line.orderLineId,
    productId: line.productId,
    warehouseId: line.warehouseId,
    deliveredQty: String(line.qty),
  })));
  const movementIds: number[] = [];
  // Lock stock rows in a deterministic order so concurrent orders containing
  // the same products in different line order do not create a lock cycle.
  const orderedLines = [...lines].sort((left, right) =>
    left.warehouseId - right.warehouseId || left.productId - right.productId);
  for (const line of orderedLines) {
    const issue = await issueStockWithin(exec, scope, {
      productId: line.productId,
      warehouseId: line.warehouseId,
      qty: line.qty,
      refType: 'sales_delivery',
      refId: delivery.id,
    });
    movementIds.push(issue.movementId);
  }

  await exec.update(salesOrder).set({
    status: 'confirmed',
    version: bumpVersion ? order.version + 1 : order.version,
    updatedAt: sql`now()`,
  }).where(and(
    eq(salesOrder.masterFn, scope.masterFn),
    eq(salesOrder.companyFn, scope.companyFn),
    eq(salesOrder.id, order.id),
  ));

  const invDocNo = `INV-${order.docNo}`;
  const [inv] = await exec.insert(invoice).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo: invDocNo,
    orderId: order.id,
    customerId: order.customerId,
    status: 'unpaid',
    invoiceDate: order.orderDate,
    currency: order.currency,
    netAmount: money(order.net),
    taxAmount: money(order.tax),
    totalAmount: money(order.total),
  }).returning({ id: invoice.id });

  const arId = await accountIdByCode(exec, scope, '1100');
  const revId = await accountIdByCode(exec, scope, '4000');
  const taxId = await accountIdByCode(exec, scope, '2200');
  await exec.insert(glEntry).values([
    { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: invDocNo, accountId: arId, debit: money(order.total), credit: '0', memo: 'AR' },
    { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: invDocNo, accountId: revId, debit: '0', credit: money(order.net), memo: 'Revenue' },
    { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: invDocNo, accountId: taxId, debit: '0', credit: money(order.tax), memo: 'Output tax' },
  ]);
  await exec.update(salesDelivery).set({
    invoiceId: inv.id,
    status: 'delivered',
    version: 2,
    updatedAt: sql`now()`,
  }).where(eq(salesDelivery.id, delivery.id));

  return {
    orderId: order.id,
    deliveryId: delivery.id,
    deliveryDocNo,
    invoiceId: inv.id,
    invDocNo,
    net: order.net,
    tax: order.tax,
    total: order.total,
    lines: lines.length,
    movementIds,
  };
}

/**
 * Composable core, run on a caller-supplied execution context (`exec` may be a db OR
 * a transaction handle — PgTransaction extends PgDatabase, so both satisfy `DB`, same
 * convention as inventory/stock.ts's issueStockWithin). MUST be called inside a
 * transaction so a failure rolls the whole unit of work back — callers choose the
 * transaction boundary. src/modules/crm/convertOpportunityToSalesOrder.ts composes
 * this with an opportunity-stage update in ONE transaction; confirmSalesOrder below
 * is the standalone entry point that owns its own boundary.
 */
export async function confirmSalesOrderWithin(exec: DB, scope: Scope, input: ConfirmOrderInput) {
  // 1. Header (totals filled in after lines).
  const [order] = await exec.insert(salesOrder).values({
    masterFn: scope.masterFn, companyFn: scope.companyFn,
    docNo: input.docNo, customerId: input.customerId,
    status: 'draft', orderDate: input.orderDate, currency: input.currency,
  }).returning({ id: salesOrder.id, version: salesOrder.version });

  let netTotal = 0;
  let taxTotal = 0;
  const issueLines: IssueLine[] = [];

  // 2. Lines: snapshot tax and accumulate totals. Stock is issued only after
  // every line has been persisted so this follows the same finalization path
  // as confirming an already-existing draft.
  let lineNo = 0;
  for (const ln of input.lines) {
    lineNo += 1;
    const taxRow = await getEffectiveTaxRate(exec, scope, ln.taxCode, input.orderDate);
    if (!taxRow) throw new PostingError(`No tax rule for ${ln.taxCode} on ${input.orderDate}`);
    const rate = Number(taxRow.rate);
    const net = Math.round(ln.qty * ln.unitPrice * 100) / 100;
    const tax = Math.round(net * rate) / 100;

    const [orderLine] = await exec.insert(salesOrderLine).values({
      masterFn: scope.masterFn, companyFn: scope.companyFn,
      orderId: order.id, lineNo,
      productId: ln.productId, qty: String(ln.qty), unitPrice: String(ln.unitPrice),
      netAmount: money(net), taxCode: ln.taxCode, taxRate: String(rate), taxAmount: money(tax),
    }).returning({ id: salesOrderLine.id });

    issueLines.push({
      orderLineId: orderLine.id,
      lineNo,
      productId: ln.productId,
      warehouseId: ln.warehouseId,
      qty: ln.qty,
    });

    netTotal += net;
    taxTotal += tax;
  }
  const grandTotal = Math.round((netTotal + taxTotal) * 100) / 100;

  // 3. Finalize header totals.
  await exec.update(salesOrder).set({
    netAmount: money(netTotal), taxAmount: money(taxTotal), totalAmount: money(grandTotal),
    updatedAt: sql`now()`,
  }).where(eq(salesOrder.id, order.id));

  return postOrderWithin(exec, scope, {
    id: order.id,
    docNo: input.docNo,
    customerId: input.customerId,
    orderDate: input.orderDate,
    currency: input.currency,
    net: netTotal,
    tax: taxTotal,
    total: grandTotal,
    version: order.version,
  }, issueLines, false);
}

/**
 * Confirm an existing draft order. The row lock serializes competing confirm
 * requests; the second request observes `confirmed` after the first commits and
 * cannot issue stock, create another invoice, or duplicate GL postings.
 */
export async function confirmDraftSalesOrderWithin(
  exec: DB,
  scope: Scope,
  input: ConfirmDraftOrderInput,
) {
  const [order] = await exec.select({
    id: salesOrder.id,
    docNo: salesOrder.docNo,
    customerId: salesOrder.customerId,
    status: salesOrder.status,
    version: salesOrder.version,
    orderDate: salesOrder.orderDate,
    currency: salesOrder.currency,
    netAmount: salesOrder.netAmount,
    taxAmount: salesOrder.taxAmount,
    totalAmount: salesOrder.totalAmount,
  }).from(salesOrder).where(and(
    eq(salesOrder.masterFn, scope.masterFn),
    eq(salesOrder.companyFn, scope.companyFn),
    eq(salesOrder.id, input.salesOrderId),
  )).for('update');

  if (!order) {
    throw new InvalidSalesOrderStateError(`Sales order ${input.salesOrderId} not found`);
  }
  if (order.status !== 'draft') {
    throw new InvalidSalesOrderStateError(
      `Sales order ${order.docNo} is '${order.status}', not 'draft'`,
    );
  }

  const lines = await exec.select({
    orderLineId: salesOrderLine.id,
    lineNo: salesOrderLine.lineNo,
    productId: salesOrderLine.productId,
    qty: salesOrderLine.qty,
  }).from(salesOrderLine).where(and(
    eq(salesOrderLine.masterFn, scope.masterFn),
    eq(salesOrderLine.companyFn, scope.companyFn),
    eq(salesOrderLine.orderId, order.id),
  )).orderBy(salesOrderLine.lineNo);

  return postOrderWithin(exec, scope, {
    id: order.id,
    docNo: order.docNo,
    customerId: order.customerId,
    orderDate: order.orderDate,
    currency: order.currency,
    net: Number(order.netAmount),
    tax: Number(order.taxAmount),
    total: Number(order.totalAmount),
    version: order.version,
  }, lines.map((line) => ({
    orderLineId: line.orderLineId,
    lineNo: line.lineNo,
    productId: line.productId,
    warehouseId: input.warehouseId,
    qty: Number(line.qty),
  })), true);
}

/**
 * Confirm a sales order — owns its transaction boundary. Wraps
 * {@link confirmSalesOrderWithin}. Throws (and rolls back everything) on any
 * failure — most importantly InsufficientStockError from a line that can't be fulfilled.
 */
export async function confirmSalesOrder(db: DB, scope: Scope, input: ConfirmOrderInput) {
  return db.transaction((tx) => confirmSalesOrderWithin(tx, scope, input));
}

export async function confirmDraftSalesOrder(db: DB, scope: Scope, input: ConfirmDraftOrderInput) {
  return db.transaction((tx) => confirmDraftSalesOrderWithin(tx, scope, input));
}
