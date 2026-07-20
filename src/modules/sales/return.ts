import { and, eq, ne, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  account,
  glEntry,
  invoice,
  salesCreditNote,
  salesCreditNoteLine,
  salesDelivery,
  salesDeliveryLine,
  salesOrderLine,
  salesReturn,
  salesReturnLine,
} from '../../data/schema';
import { receiveStockWithin } from '../inventory/stock';

export class SalesReturnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalesReturnError';
  }
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new SalesReturnError(`${label} is required.`);
  return normalized;
}

function positive(value: string | number, label: string) {
  let result: Decimal;
  try {
    result = new Decimal(value);
  } catch {
    throw new SalesReturnError(`${label} must be a valid decimal.`);
  }
  if (!result.isFinite() || result.lte(0)) {
    throw new SalesReturnError(`${label} must be greater than zero.`);
  }
  return result;
}

async function accountId(exec: DB, scope: Scope, code: string) {
  const [row] = await exec.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.code, code),
  ));
  if (!row) throw new SalesReturnError(`Account ${code} is not configured.`);
  return row.id;
}

export interface CreateSalesReturnInput {
  docNo: string;
  deliveryId: number;
  invoiceId: number;
  warehouseId: number;
  returnDate: string;
  reason: string;
  lines: Array<{ deliveryLineId: number; qty: string | number }>;
}

export async function createSalesReturnWithin(
  exec: DB,
  scope: Scope,
  input: CreateSalesReturnInput,
) {
  const docNo = required(input.docNo, 'Return number');
  const reason = required(input.reason, 'Reason');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.returnDate)) {
    throw new SalesReturnError('returnDate must use YYYY-MM-DD.');
  }
  if (
    !Number.isSafeInteger(input.deliveryId)
    || !Number.isSafeInteger(input.invoiceId)
    || !Number.isSafeInteger(input.warehouseId)
    || !Array.isArray(input.lines)
    || input.lines.length === 0
  ) {
    throw new SalesReturnError('Delivery, invoice, warehouse and at least one line are required.');
  }
  const [delivery] = await exec.select({
    id: salesDelivery.id,
    invoiceId: salesDelivery.invoiceId,
    status: salesDelivery.status,
  }).from(salesDelivery).where(and(
    eq(salesDelivery.masterFn, scope.masterFn),
    eq(salesDelivery.companyFn, scope.companyFn),
    eq(salesDelivery.id, input.deliveryId),
  )).for('update');
  const [originalInvoice] = await exec.select({ id: invoice.id }).from(invoice).where(and(
    eq(invoice.masterFn, scope.masterFn),
    eq(invoice.companyFn, scope.companyFn),
    eq(invoice.id, input.invoiceId),
  ));
  if (
    !delivery
    || delivery.status !== 'delivered'
    || delivery.invoiceId !== input.invoiceId
    || !originalInvoice
  ) {
    throw new SalesReturnError('Return must reference a delivered document and its invoice.');
  }

  const [header] = await exec.insert(salesReturn).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    deliveryId: delivery.id,
    invoiceId: originalInvoice.id,
    warehouseId: input.warehouseId,
    returnDate: input.returnDate,
    reason,
  }).returning({ id: salesReturn.id, version: salesReturn.version });

  let netTotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  for (let index = 0; index < input.lines.length; index += 1) {
    const requested = input.lines[index];
    const qty = positive(requested.qty, 'Return quantity');
    const [source] = await exec.select({
      id: salesDeliveryLine.id,
      deliveryId: salesDeliveryLine.deliveryId,
      productId: salesDeliveryLine.productId,
      deliveredQty: salesDeliveryLine.deliveredQty,
      unitPrice: salesOrderLine.unitPrice,
      taxCode: salesOrderLine.taxCode,
      taxRate: salesOrderLine.taxRate,
    }).from(salesDeliveryLine).innerJoin(
      salesOrderLine,
      and(
        eq(salesOrderLine.masterFn, salesDeliveryLine.masterFn),
        eq(salesOrderLine.companyFn, salesDeliveryLine.companyFn),
        eq(salesOrderLine.id, salesDeliveryLine.orderLineId),
      ),
    ).where(and(
      eq(salesDeliveryLine.masterFn, scope.masterFn),
      eq(salesDeliveryLine.companyFn, scope.companyFn),
      eq(salesDeliveryLine.id, requested.deliveryLineId),
    )).for('update');
    if (!source || source.deliveryId !== delivery.id) {
      throw new SalesReturnError('Return line does not belong to the selected delivery.');
    }
    const [returned] = await exec.select({
      qty: sql<string>`coalesce(sum(${salesReturnLine.qty}), 0)`,
    }).from(salesReturnLine).innerJoin(
      salesReturn,
      and(
        eq(salesReturn.masterFn, salesReturnLine.masterFn),
        eq(salesReturn.companyFn, salesReturnLine.companyFn),
        eq(salesReturn.id, salesReturnLine.returnId),
      ),
    ).where(and(
      eq(salesReturnLine.masterFn, scope.masterFn),
      eq(salesReturnLine.companyFn, scope.companyFn),
      eq(salesReturnLine.deliveryLineId, source.id),
      ne(salesReturn.status, 'rejected'),
    ));
    if (new Decimal(returned?.qty ?? 0).plus(qty).gt(source.deliveredQty)) {
      throw new SalesReturnError('Return quantity exceeds the delivered quantity.');
    }
    const unitPrice = new Decimal(source.unitPrice);
    const rate = new Decimal(source.taxRate);
    const net = qty.mul(unitPrice).toDecimalPlaces(2);
    const tax = net.mul(rate).div(100).toDecimalPlaces(2);
    await exec.insert(salesReturnLine).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      returnId: header.id,
      lineNo: index + 1,
      deliveryLineId: source.id,
      productId: source.productId,
      qty: qty.toFixed(4),
      unitPrice: unitPrice.toFixed(4),
      netAmount: net.toFixed(2),
      taxCode: source.taxCode,
      taxRate: rate.toFixed(3),
      taxAmount: tax.toFixed(2),
    });
    netTotal = netTotal.plus(net);
    taxTotal = taxTotal.plus(tax);
  }
  return {
    id: header.id,
    docNo,
    status: 'requested',
    version: header.version,
    netAmount: netTotal.toFixed(2),
    taxAmount: taxTotal.toFixed(2),
    totalAmount: netTotal.plus(taxTotal).toFixed(2),
  };
}

export interface CreditSalesReturnInput {
  creditDocNo: string;
  noteDate: string;
  tracking?: Array<{
    returnLineId: number;
    binId?: number;
    lotId?: number;
    serialId?: number;
  }>;
}

export async function receiveAndCreditSalesReturnWithin(
  exec: DB,
  scope: Scope,
  returnId: number,
  input: CreditSalesReturnInput,
) {
  const creditDocNo = required(input.creditDocNo, 'Credit note number');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.noteDate)) {
    throw new SalesReturnError('noteDate must use YYYY-MM-DD.');
  }
  const [header] = await exec.select().from(salesReturn).where(and(
    eq(salesReturn.masterFn, scope.masterFn),
    eq(salesReturn.companyFn, scope.companyFn),
    eq(salesReturn.id, returnId),
  )).for('update');
  if (!header || header.status !== 'requested') {
    throw new SalesReturnError('Only a requested return can be received and credited.');
  }
  const [originalInvoice] = await exec.select().from(invoice).where(and(
    eq(invoice.masterFn, scope.masterFn),
    eq(invoice.companyFn, scope.companyFn),
    eq(invoice.id, header.invoiceId),
  ));
  if (!originalInvoice) throw new SalesReturnError('Original invoice is unavailable.');
  const lines = await exec.select().from(salesReturnLine).where(and(
    eq(salesReturnLine.masterFn, scope.masterFn),
    eq(salesReturnLine.companyFn, scope.companyFn),
    eq(salesReturnLine.returnId, header.id),
  )).orderBy(salesReturnLine.lineNo);
  if (!lines.length) throw new SalesReturnError('Return has no lines.');

  const net = lines.reduce((sum, line) => sum.plus(line.netAmount), new Decimal(0));
  const tax = lines.reduce((sum, line) => sum.plus(line.taxAmount), new Decimal(0));
  const total = net.plus(tax);
  const [credit] = await exec.insert(salesCreditNote).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo: creditDocNo,
    returnId: header.id,
    invoiceId: header.invoiceId,
    status: 'posted',
    noteDate: input.noteDate,
    currency: originalInvoice.currency,
    netAmount: net.toFixed(2),
    taxAmount: tax.toFixed(2),
    totalAmount: total.toFixed(2),
  }).returning({ id: salesCreditNote.id });
  const tracking = new Map((input.tracking ?? []).map((row) => [row.returnLineId, row]));
  const movementIds: number[] = [];
  for (const line of lines) {
    const selection = tracking.get(line.id);
    const movement = await receiveStockWithin(exec, scope, {
      productId: line.productId,
      warehouseId: header.warehouseId,
      qty: Number(line.qty),
      binId: selection?.binId,
      lotId: selection?.lotId,
      serialId: selection?.serialId,
      refType: 'sales_return',
      refId: header.id,
    });
    movementIds.push(movement.movementId);
  }
  await exec.insert(salesCreditNoteLine).values(lines.map((line) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    creditNoteId: credit.id,
    lineNo: line.lineNo,
    returnLineId: line.id,
    productId: line.productId,
    qty: line.qty,
    netAmount: line.netAmount,
    taxAmount: line.taxAmount,
  })));

  const revenueId = await accountId(exec, scope, '4000');
  const taxId = await accountId(exec, scope, '2200');
  const arId = await accountId(exec, scope, '1100');
  await exec.insert(glEntry).values([
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: creditDocNo,
      accountId: revenueId, debit: net.toFixed(2), credit: '0', memo: 'Sales return',
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: creditDocNo,
      accountId: taxId, debit: tax.toFixed(2), credit: '0', memo: 'Output tax reversal',
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: creditDocNo,
      accountId: arId, debit: '0', credit: total.toFixed(2), memo: 'AR credit',
    },
  ]);
  await exec.update(salesReturn).set({
    status: 'credited',
    version: sql`${salesReturn.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(salesReturn.id, header.id));
  return {
    returnId: header.id,
    creditNoteId: credit.id,
    creditDocNo,
    status: 'credited',
    netAmount: net.toFixed(2),
    taxAmount: tax.toFixed(2),
    totalAmount: total.toFixed(2),
    movementIds,
  };
}

export async function rejectSalesReturnWithin(exec: DB, scope: Scope, returnId: number) {
  const [row] = await exec.select({
    id: salesReturn.id,
    status: salesReturn.status,
  }).from(salesReturn).where(and(
    eq(salesReturn.masterFn, scope.masterFn),
    eq(salesReturn.companyFn, scope.companyFn),
    eq(salesReturn.id, returnId),
  )).for('update');
  if (!row || row.status !== 'requested') {
    throw new SalesReturnError('Only a requested return can be rejected.');
  }
  await exec.update(salesReturn).set({
    status: 'rejected',
    version: sql`${salesReturn.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(salesReturn.id, row.id));
  return { returnId: row.id, status: 'rejected' };
}

export function createSalesReturn(db: DB, scope: Scope, input: CreateSalesReturnInput) {
  return db.transaction((tx) => createSalesReturnWithin(tx, scope, input));
}

export function receiveAndCreditSalesReturn(
  db: DB,
  scope: Scope,
  returnId: number,
  input: CreditSalesReturnInput,
) {
  return db.transaction((tx) => receiveAndCreditSalesReturnWithin(tx, scope, returnId, input));
}
