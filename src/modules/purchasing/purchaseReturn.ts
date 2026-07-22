import { and, eq, ne, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  account,
  glEntry,
  goodsReceipt,
  purchaseOrder,
  purchaseOrderLine,
  purchaseReturn,
  purchaseReturnLine,
  supplierCreditNote,
  supplierCreditNoteLine,
  supplierInvoice,
} from '../../data/schema';
import { issueStockWithin } from '../inventory/stock';
import { supplierInvoiceOutstandingWithin } from './supplierPayable';

export class PurchaseReturnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PurchaseReturnError';
  }
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new PurchaseReturnError(`${label} is required.`);
  return normalized;
}

function positive(value: string | number, label: string) {
  let result: Decimal;
  try {
    result = new Decimal(value);
  } catch {
    throw new PurchaseReturnError(`${label} must be a valid decimal.`);
  }
  if (!result.isFinite() || result.lte(0)) {
    throw new PurchaseReturnError(`${label} must be greater than zero.`);
  }
  return result;
}

function validDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PurchaseReturnError(`${label} must use YYYY-MM-DD.`);
  }
}

async function accountId(exec: DB, scope: Scope, code: string) {
  const [row] = await exec.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.code, code),
  ));
  if (!row) throw new PurchaseReturnError(`Account ${code} is not configured.`);
  return row.id;
}

export interface CreatePurchaseReturnInput {
  docNo: string;
  goodsReceiptId: number;
  supplierInvoiceId: number;
  returnDate: string;
  reason: string;
  lines: Array<{ purchaseOrderLineId: number; qty: string | number }>;
}

export async function createPurchaseReturnWithin(
  exec: DB,
  scope: Scope,
  input: CreatePurchaseReturnInput,
) {
  const docNo = required(input.docNo, 'Return number');
  const reason = required(input.reason, 'Reason');
  validDate(input.returnDate, 'returnDate');
  if (
    !Number.isSafeInteger(input.goodsReceiptId)
    || input.goodsReceiptId <= 0
    || !Number.isSafeInteger(input.supplierInvoiceId)
    || input.supplierInvoiceId <= 0
    || !Array.isArray(input.lines)
    || input.lines.length === 0
  ) {
    throw new PurchaseReturnError(
      'Goods receipt, supplier invoice and at least one return line are required.',
    );
  }
  const sourceIds = input.lines.map((line) => line.purchaseOrderLineId);
  if (
    sourceIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
    || new Set(sourceIds).size !== sourceIds.length
  ) {
    throw new PurchaseReturnError('Each purchase-order line may appear only once.');
  }

  const [receipt] = await exec.select({
    id: goodsReceipt.id,
    orderId: goodsReceipt.orderId,
    warehouseId: goodsReceipt.warehouseId,
  }).from(goodsReceipt).where(and(
    eq(goodsReceipt.masterFn, scope.masterFn),
    eq(goodsReceipt.companyFn, scope.companyFn),
    eq(goodsReceipt.id, input.goodsReceiptId),
  )).for('update');
  const [sourceInvoice] = await exec.select({
    id: supplierInvoice.id,
    orderId: supplierInvoice.orderId,
    status: supplierInvoice.status,
  }).from(supplierInvoice).where(and(
    eq(supplierInvoice.masterFn, scope.masterFn),
    eq(supplierInvoice.companyFn, scope.companyFn),
    eq(supplierInvoice.id, input.supplierInvoiceId),
  )).for('update');
  if (
    !receipt
    || !sourceInvoice
    || sourceInvoice.orderId !== receipt.orderId
    || sourceInvoice.status !== 'unpaid'
  ) {
    throw new PurchaseReturnError(
      'Return must reference one received purchase order and its unpaid supplier invoice.',
    );
  }
  const [order] = await exec.select({ status: purchaseOrder.status }).from(purchaseOrder).where(and(
    eq(purchaseOrder.masterFn, scope.masterFn),
    eq(purchaseOrder.companyFn, scope.companyFn),
    eq(purchaseOrder.id, receipt.orderId),
  ));
  if (!order || order.status !== 'received') {
    throw new PurchaseReturnError('Only received purchase orders can be returned.');
  }

  const [header] = await exec.insert(purchaseReturn).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    goodsReceiptId: receipt.id,
    supplierInvoiceId: sourceInvoice.id,
    warehouseId: receipt.warehouseId,
    returnDate: input.returnDate,
    reason,
  }).returning({ id: purchaseReturn.id, version: purchaseReturn.version });

  let netTotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  for (let index = 0; index < input.lines.length; index += 1) {
    const requested = input.lines[index];
    const qty = positive(requested.qty, 'Return quantity');
    const [source] = await exec.select({
      id: purchaseOrderLine.id,
      orderId: purchaseOrderLine.orderId,
      productId: purchaseOrderLine.productId,
      orderedQty: purchaseOrderLine.qty,
      unitCost: purchaseOrderLine.unitCost,
      taxCode: purchaseOrderLine.taxCode,
      taxRate: purchaseOrderLine.taxRate,
    }).from(purchaseOrderLine).where(and(
      eq(purchaseOrderLine.masterFn, scope.masterFn),
      eq(purchaseOrderLine.companyFn, scope.companyFn),
      eq(purchaseOrderLine.id, requested.purchaseOrderLineId),
    )).for('update');
    if (!source || source.orderId !== receipt.orderId) {
      throw new PurchaseReturnError('Return line does not belong to the received purchase order.');
    }
    const [returned] = await exec.select({
      qty: sql<string>`coalesce(sum(${purchaseReturnLine.qty}), 0)`,
    }).from(purchaseReturnLine).innerJoin(
      purchaseReturn,
      and(
        eq(purchaseReturn.masterFn, purchaseReturnLine.masterFn),
        eq(purchaseReturn.companyFn, purchaseReturnLine.companyFn),
        eq(purchaseReturn.id, purchaseReturnLine.returnId),
      ),
    ).where(and(
      eq(purchaseReturnLine.masterFn, scope.masterFn),
      eq(purchaseReturnLine.companyFn, scope.companyFn),
      eq(purchaseReturnLine.purchaseOrderLineId, source.id),
      ne(purchaseReturn.status, 'rejected'),
    ));
    if (new Decimal(returned?.qty ?? 0).plus(qty).gt(source.orderedQty)) {
      throw new PurchaseReturnError('Return quantity exceeds the received quantity.');
    }
    const unitCost = new Decimal(source.unitCost);
    const rate = new Decimal(source.taxRate);
    const net = qty.mul(unitCost).toDecimalPlaces(2);
    const tax = net.mul(rate).div(100).toDecimalPlaces(2);
    await exec.insert(purchaseReturnLine).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      returnId: header.id,
      lineNo: index + 1,
      purchaseOrderLineId: source.id,
      productId: source.productId,
      qty: qty.toFixed(4),
      unitCost: unitCost.toFixed(4),
      netAmount: net.toFixed(2),
      taxCode: source.taxCode,
      taxRate: rate.toFixed(3),
      taxAmount: tax.toFixed(2),
    });
    netTotal = netTotal.plus(net);
    taxTotal = taxTotal.plus(tax);
  }
  const total = netTotal.plus(taxTotal);
  await exec.update(purchaseReturn).set({
    netAmount: netTotal.toFixed(2),
    taxAmount: taxTotal.toFixed(2),
    totalAmount: total.toFixed(2),
    updatedAt: sql`now()`,
  }).where(eq(purchaseReturn.id, header.id));
  return {
    id: header.id,
    docNo,
    status: 'requested',
    version: header.version,
    netAmount: netTotal.toFixed(2),
    taxAmount: taxTotal.toFixed(2),
    totalAmount: total.toFixed(2),
  };
}

export interface ShipAndCreditPurchaseReturnInput {
  creditDocNo: string;
  noteDate: string;
  tracking?: Array<{
    returnLineId: number;
    binId?: number;
    lotId?: number;
    serialId?: number;
  }>;
}

export async function shipAndCreditPurchaseReturnWithin(
  exec: DB,
  scope: Scope,
  returnId: number,
  input: ShipAndCreditPurchaseReturnInput,
) {
  const creditDocNo = required(input.creditDocNo, 'Supplier credit note number');
  validDate(input.noteDate, 'noteDate');
  const [header] = await exec.select().from(purchaseReturn).where(and(
    eq(purchaseReturn.masterFn, scope.masterFn),
    eq(purchaseReturn.companyFn, scope.companyFn),
    eq(purchaseReturn.id, returnId),
  )).for('update');
  if (!header || header.status !== 'requested') {
    throw new PurchaseReturnError('Only a requested purchase return can be shipped and credited.');
  }
  const [sourceInvoice] = await exec.select().from(supplierInvoice).where(and(
    eq(supplierInvoice.masterFn, scope.masterFn),
    eq(supplierInvoice.companyFn, scope.companyFn),
    eq(supplierInvoice.id, header.supplierInvoiceId),
  )).for('update');
  if (!sourceInvoice || sourceInvoice.status !== 'unpaid') {
    throw new PurchaseReturnError('The source supplier invoice must still be unpaid.');
  }
  const lines = await exec.select().from(purchaseReturnLine).where(and(
    eq(purchaseReturnLine.masterFn, scope.masterFn),
    eq(purchaseReturnLine.companyFn, scope.companyFn),
    eq(purchaseReturnLine.returnId, header.id),
  )).orderBy(purchaseReturnLine.lineNo);
  if (!lines.length) throw new PurchaseReturnError('Purchase return has no lines.');

  const net = lines.reduce((sum, line) => sum.plus(line.netAmount), new Decimal(0));
  const tax = lines.reduce((sum, line) => sum.plus(line.taxAmount), new Decimal(0));
  const total = net.plus(tax);
  const outstanding = await supplierInvoiceOutstandingWithin(exec, scope, sourceInvoice.id);
  if (!outstanding || outstanding.lte(0) || total.gt(outstanding)) {
    throw new PurchaseReturnError(`Supplier credit exceeds the remaining payable for ${sourceInvoice.docNo}.`);
  }
  const [credit] = await exec.insert(supplierCreditNote).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo: creditDocNo,
    returnId: header.id,
    supplierInvoiceId: sourceInvoice.id,
    supplierId: sourceInvoice.supplierId,
    status: 'posted',
    noteDate: input.noteDate,
    currency: sourceInvoice.currency,
    netAmount: net.toFixed(2),
    taxAmount: tax.toFixed(2),
    totalAmount: total.toFixed(2),
  }).returning({ id: supplierCreditNote.id });

  const tracking = new Map((input.tracking ?? []).map((row) => [row.returnLineId, row]));
  const movementIds: number[] = [];
  for (const line of lines) {
    const selection = tracking.get(line.id);
    const movement = await issueStockWithin(exec, scope, {
      productId: line.productId,
      warehouseId: header.warehouseId,
      qty: Number(line.qty),
      binId: selection?.binId,
      lotId: selection?.lotId,
      serialId: selection?.serialId,
      refType: 'purchase_return',
      refId: header.id,
      movementGroup: `purchase-return:${header.id}`,
    });
    movementIds.push(movement.movementId);
  }
  await exec.insert(supplierCreditNoteLine).values(lines.map((line) => ({
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

  const inventoryId = await accountId(exec, scope, '1400');
  const inputTaxId = await accountId(exec, scope, '1200');
  const payableId = await accountId(exec, scope, '2100');
  await exec.insert(glEntry).values([
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: creditDocNo,
      accountId: payableId, debit: total.toFixed(2), credit: '0', memo: 'Supplier credit',
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: creditDocNo,
      accountId: inventoryId, debit: '0', credit: net.toFixed(2), memo: 'Inventory return',
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: creditDocNo,
      accountId: inputTaxId, debit: '0', credit: tax.toFixed(2), memo: 'Input tax reversal',
    },
  ]);
  await exec.update(purchaseReturn).set({
    status: 'credited',
    version: sql`${purchaseReturn.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(purchaseReturn.id, header.id));
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

export async function rejectPurchaseReturnWithin(exec: DB, scope: Scope, returnId: number) {
  const [row] = await exec.select({
    id: purchaseReturn.id,
    status: purchaseReturn.status,
  }).from(purchaseReturn).where(and(
    eq(purchaseReturn.masterFn, scope.masterFn),
    eq(purchaseReturn.companyFn, scope.companyFn),
    eq(purchaseReturn.id, returnId),
  )).for('update');
  if (!row || row.status !== 'requested') {
    throw new PurchaseReturnError('Only a requested purchase return can be rejected.');
  }
  await exec.update(purchaseReturn).set({
    status: 'rejected',
    version: sql`${purchaseReturn.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(purchaseReturn.id, row.id));
  return { returnId: row.id, status: 'rejected' };
}

export function createPurchaseReturn(db: DB, scope: Scope, input: CreatePurchaseReturnInput) {
  return db.transaction((tx) => createPurchaseReturnWithin(tx, scope, input));
}

export function shipAndCreditPurchaseReturn(
  db: DB,
  scope: Scope,
  returnId: number,
  input: ShipAndCreditPurchaseReturnInput,
) {
  return db.transaction((tx) => shipAndCreditPurchaseReturnWithin(tx, scope, returnId, input));
}
