// Sales — create an approval-gated order in one transaction. Creation is a
// commercial-document event only: it writes the order, immutable tax snapshots
// and one approval request, but never stock, invoice or GL rows. The existing
// confirmOrder command remains the sole posting boundary after approval.
import { and, eq, inArray, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { getEffectiveTaxRate } from '../../data/repo';
import {
  customer,
  product,
  salesOrder,
  salesOrderApproval,
  salesOrderLine,
} from '../../data/schema';

export class SalesOrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalesOrderValidationError';
  }
}

export interface CreateSalesOrderLineInput {
  productId: number;
  qty: string | number;
  unitPrice: string | number;
  taxCode: string;
}

export interface CreateSalesOrderInput {
  docNo: string;
  customerId: number;
  orderDate: string;
  currency: string;
  lines: CreateSalesOrderLineInput[];
  approvalReason?: string;
}

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new SalesOrderValidationError(`${label} is required.`);
  return normalized;
}

function decimal(
  value: string | number,
  label: string,
  allowZero = false,
): Decimal {
  let result: Decimal;
  try {
    result = new Decimal(value);
  } catch {
    throw new SalesOrderValidationError(`${label} must be a valid decimal.`);
  }
  if (!result.isFinite() || (allowZero ? result.isNegative() : result.lte(0))) {
    throw new SalesOrderValidationError(
      `${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'}.`,
    );
  }
  return result;
}

export async function createSalesOrderWithin(
  exec: DB,
  scope: Scope,
  input: CreateSalesOrderInput,
) {
  const docNo = required(input.docNo, 'Sales order number');
  if (!Number.isSafeInteger(input.customerId) || input.customerId <= 0) {
    throw new SalesOrderValidationError('customerId must be a positive integer.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.orderDate)) {
    throw new SalesOrderValidationError('orderDate must use YYYY-MM-DD.');
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new SalesOrderValidationError('currency must be a three-letter ISO code.');
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new SalesOrderValidationError('A sales order requires at least one line.');
  }
  const reason = (input.approvalReason || 'Direct sales order requires approval.').trim();
  if (!reason || reason.length > 1000) {
    throw new SalesOrderValidationError(
      'Approval reason is required and must not exceed 1000 characters.',
    );
  }

  const [buyer] = await exec.select({ id: customer.id }).from(customer).where(and(
    eq(customer.masterFn, scope.masterFn),
    eq(customer.companyFn, scope.companyFn),
    eq(customer.id, input.customerId),
  ));
  if (!buyer) {
    throw new SalesOrderValidationError('Customer is not available in this company.');
  }

  const productIds = [...new Set(input.lines.map((line) => line.productId))];
  if (
    productIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
    || (await exec.select({ id: product.id }).from(product).where(and(
      eq(product.masterFn, scope.masterFn),
      eq(product.companyFn, scope.companyFn),
      inArray(product.id, productIds),
    ))).length !== productIds.length
  ) {
    throw new SalesOrderValidationError(
      'One or more products are not available in this company.',
    );
  }

  const [order] = await exec.insert(salesOrder).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    customerId: buyer.id,
    status: 'pending_approval',
    orderDate: input.orderDate,
    currency: input.currency,
  }).returning({ id: salesOrder.id, version: salesOrder.version });

  const [approval] = await exec.insert(salesOrderApproval).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    orderId: order.id,
    status: 'pending',
    reason,
  }).returning({ id: salesOrderApproval.id });

  let netTotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  for (let index = 0; index < input.lines.length; index += 1) {
    const line = input.lines[index];
    const qty = decimal(line.qty, `Line ${index + 1} quantity`);
    const unitPrice = decimal(line.unitPrice, `Line ${index + 1} unit price`, true);
    const taxCode = required(line.taxCode, `Line ${index + 1} tax code`);
    const taxRule = await getEffectiveTaxRate(exec, scope, taxCode, input.orderDate);
    if (!taxRule) {
      throw new SalesOrderValidationError(
        `No tax rule for ${taxCode} on ${input.orderDate}.`,
      );
    }
    const rate = new Decimal(taxRule.rate);
    const net = qty.mul(unitPrice).toDecimalPlaces(2);
    const tax = net.mul(rate).div(100).toDecimalPlaces(2);
    await exec.insert(salesOrderLine).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      orderId: order.id,
      lineNo: index + 1,
      productId: line.productId,
      qty: qty.toFixed(4),
      unitPrice: unitPrice.toFixed(4),
      netAmount: net.toFixed(2),
      taxCode,
      taxRate: rate.toFixed(3),
      taxAmount: tax.toFixed(2),
    });
    netTotal = netTotal.plus(net);
    taxTotal = taxTotal.plus(tax);
  }

  const total = netTotal.plus(taxTotal);
  const [completed] = await exec.update(salesOrder).set({
    netAmount: netTotal.toFixed(2),
    taxAmount: taxTotal.toFixed(2),
    totalAmount: total.toFixed(2),
    updatedAt: sql`now()`,
  }).where(and(
    eq(salesOrder.masterFn, scope.masterFn),
    eq(salesOrder.companyFn, scope.companyFn),
    eq(salesOrder.id, order.id),
  )).returning({
    id: salesOrder.id,
    docNo: salesOrder.docNo,
    status: salesOrder.status,
    version: salesOrder.version,
    netAmount: salesOrder.netAmount,
    taxAmount: salesOrder.taxAmount,
    totalAmount: salesOrder.totalAmount,
  });

  return {
    ...completed,
    orderId: completed.id,
    approvalId: approval.id,
    approvalStatus: 'pending' as const,
    approvalReason: reason,
    lineCount: input.lines.length,
  };
}

export function createSalesOrder(db: DB, scope: Scope, input: CreateSalesOrderInput) {
  return db.transaction((tx) => createSalesOrderWithin(tx, scope, input));
}
