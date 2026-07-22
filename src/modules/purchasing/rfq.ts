// Purchasing sourcing chain: approved requisition/ad-hoc demand → RFQ → supplier
// responses → selected quotation → traceable draft/open purchase order. Inventory and
// GL remain untouched until the existing receive/post commands run.
import { and, eq, inArray, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { getEffectiveTaxRate } from '../../data/repo';
import {
  product,
  purchaseOrder,
  purchaseRequisition,
  purchaseRequisitionLine,
  purchaseRfq,
  purchaseRfqLine,
  purchaseRfqSupplier,
  supplier,
  supplierQuotation,
  supplierQuotationLine,
} from '../../data/schema';
import { createPurchaseOrderWithin } from './createPurchaseOrder';

export class PurchasingRfqError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PurchasingRfqError';
  }
}

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new PurchasingRfqError(`${label} is required.`);
  return normalized;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function positive(value: string | number, label: string, allowZero = false): Decimal {
  let result: Decimal;
  try {
    result = new Decimal(value);
  } catch {
    throw new PurchasingRfqError(`${label} must be a valid decimal.`);
  }
  if (!result.isFinite() || (allowZero ? result.isNegative() : result.lte(0))) {
    throw new PurchasingRfqError(`${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'}.`);
  }
  return result;
}

export interface CreatePurchaseRfqInput {
  docNo: string;
  requisitionId?: number | null;
  subject: string;
  rfqDate: string;
  responseDueDate: string;
  supplierIds: number[];
  lines: Array<{ productId: number; qty: string | number }>;
}

export async function createPurchaseRfqWithin(
  exec: DB,
  scope: Scope,
  input: CreatePurchaseRfqInput,
) {
  const docNo = required(input.docNo, 'RFQ number');
  const subject = required(input.subject, 'Subject');
  if (!validDate(input.rfqDate) || !validDate(input.responseDueDate) || input.responseDueDate < input.rfqDate) {
    throw new PurchasingRfqError('RFQ dates are invalid.');
  }
  if (!Array.isArray(input.supplierIds) || input.supplierIds.length === 0) {
    throw new PurchasingRfqError('At least one supplier must be invited.');
  }
  const supplierIds = [...new Set(input.supplierIds)];
  if (
    supplierIds.length !== input.supplierIds.length
    || supplierIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
  ) {
    throw new PurchasingRfqError('Supplier invitations must be unique positive ids.');
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new PurchasingRfqError('An RFQ requires at least one line.');
  }
  const productIds = input.lines.map((line) => line.productId);
  if (
    new Set(productIds).size !== productIds.length
    || productIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
  ) {
    throw new PurchasingRfqError('RFQ products must be unique positive ids.');
  }
  const preparedLines = input.lines.map((line) => ({
    productId: line.productId,
    qty: positive(line.qty, 'Line quantity').toFixed(4),
  }));

  const companySuppliers = await exec.select({ id: supplier.id }).from(supplier).where(and(
    eq(supplier.masterFn, scope.masterFn),
    eq(supplier.companyFn, scope.companyFn),
    inArray(supplier.id, supplierIds),
  ));
  const companyProducts = await exec.select({ id: product.id }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    inArray(product.id, productIds),
  ));
  if (companySuppliers.length !== supplierIds.length) {
    throw new PurchasingRfqError('One or more suppliers are not available in this company.');
  }
  if (companyProducts.length !== productIds.length) {
    throw new PurchasingRfqError('One or more products are not available in this company.');
  }

  let requisitionId: number | null = null;
  if (input.requisitionId != null) {
    const [requisition] = await exec.select({
      id: purchaseRequisition.id,
      status: purchaseRequisition.status,
    }).from(purchaseRequisition).where(and(
      eq(purchaseRequisition.masterFn, scope.masterFn),
      eq(purchaseRequisition.companyFn, scope.companyFn),
      eq(purchaseRequisition.id, input.requisitionId),
    )).for('update');
    if (!requisition || requisition.status !== 'approved') {
      throw new PurchasingRfqError('Only an approved requisition can feed an RFQ.');
    }
    const [alreadySourced] = await exec.select({ id: purchaseRfq.id }).from(purchaseRfq).where(and(
      eq(purchaseRfq.masterFn, scope.masterFn),
      eq(purchaseRfq.companyFn, scope.companyFn),
      eq(purchaseRfq.requisitionId, requisition.id),
    ));
    if (alreadySourced) throw new PurchasingRfqError('This requisition already has an RFQ.');
    const requisitionLines = await exec.select({
      productId: purchaseRequisitionLine.productId,
      qty: purchaseRequisitionLine.qty,
    }).from(purchaseRequisitionLine).where(and(
      eq(purchaseRequisitionLine.masterFn, scope.masterFn),
      eq(purchaseRequisitionLine.companyFn, scope.companyFn),
      eq(purchaseRequisitionLine.requisitionId, requisition.id),
    ));
    const expected = new Map(requisitionLines.map((line) => [line.productId, new Decimal(line.qty)]));
    if (
      expected.size !== preparedLines.length
      || preparedLines.some((line) => !expected.get(line.productId)?.eq(line.qty))
    ) {
      throw new PurchasingRfqError('RFQ lines must match the approved requisition exactly.');
    }
    requisitionId = requisition.id;
  }

  const [rfq] = await exec.insert(purchaseRfq).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    requisitionId,
    subject,
    rfqDate: input.rfqDate,
    responseDueDate: input.responseDueDate,
  }).returning({
    id: purchaseRfq.id,
    docNo: purchaseRfq.docNo,
    status: purchaseRfq.status,
    version: purchaseRfq.version,
  });
  await exec.insert(purchaseRfqLine).values(preparedLines.map((line, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    rfqId: rfq.id,
    lineNo: index + 1,
    productId: line.productId,
    qty: line.qty,
  })));
  await exec.insert(purchaseRfqSupplier).values(supplierIds.map((supplierId) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    rfqId: rfq.id,
    supplierId,
  })));
  return { ...rfq, supplierCount: supplierIds.length, lineCount: preparedLines.length };
}

export async function transitionPurchaseRfqWithin(
  exec: DB,
  scope: Scope,
  rfqId: number,
  transition: 'issue' | 'close',
) {
  const [rfq] = await exec.select({
    id: purchaseRfq.id,
    docNo: purchaseRfq.docNo,
    status: purchaseRfq.status,
  }).from(purchaseRfq).where(and(
    eq(purchaseRfq.masterFn, scope.masterFn),
    eq(purchaseRfq.companyFn, scope.companyFn),
    eq(purchaseRfq.id, rfqId),
  )).for('update');
  if (!rfq) throw new PurchasingRfqError('RFQ does not exist in this company.');
  if (transition === 'issue' && rfq.status !== 'draft') {
    throw new PurchasingRfqError(`RFQ ${rfq.docNo} is '${rfq.status}', expected 'draft'.`);
  }
  if (transition === 'close' && !['draft', 'sent', 'responded'].includes(rfq.status)) {
    throw new PurchasingRfqError(`RFQ ${rfq.docNo} cannot be closed from '${rfq.status}'.`);
  }
  const status = transition === 'issue' ? 'sent' : 'closed';
  const [updated] = await exec.update(purchaseRfq).set({
    status,
    version: sql`${purchaseRfq.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(purchaseRfq.id, rfq.id)).returning({
    id: purchaseRfq.id,
    status: purchaseRfq.status,
    version: purchaseRfq.version,
  });
  return updated;
}

export interface CreateSupplierQuotationInput {
  docNo: string;
  rfqId: number;
  supplierId: number;
  quoteDate: string;
  validUntil: string;
  currency: string;
  leadTimeDays: number;
  paymentTerms: string;
  warranty?: string | null;
  lines: Array<{ rfqLineId: number; unitCost: string | number; taxCode: string }>;
}

export async function createSupplierQuotationWithin(
  exec: DB,
  scope: Scope,
  input: CreateSupplierQuotationInput,
) {
  const docNo = required(input.docNo, 'Supplier quotation number');
  const paymentTerms = required(input.paymentTerms, 'Payment terms');
  if (!validDate(input.quoteDate) || !validDate(input.validUntil) || input.validUntil < input.quoteDate) {
    throw new PurchasingRfqError('Supplier quotation dates are invalid.');
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new PurchasingRfqError('currency must be a three-letter ISO code.');
  }
  if (!Number.isSafeInteger(input.leadTimeDays) || input.leadTimeDays < 0) {
    throw new PurchasingRfqError('leadTimeDays must be a non-negative integer.');
  }
  const [rfq] = await exec.select({ id: purchaseRfq.id, status: purchaseRfq.status }).from(purchaseRfq).where(and(
    eq(purchaseRfq.masterFn, scope.masterFn),
    eq(purchaseRfq.companyFn, scope.companyFn),
    eq(purchaseRfq.id, input.rfqId),
  )).for('update');
  if (!rfq || !['sent', 'responded'].includes(rfq.status)) {
    throw new PurchasingRfqError('Only an issued RFQ can receive supplier quotations.');
  }
  const [invitation] = await exec.select({ id: purchaseRfqSupplier.id }).from(purchaseRfqSupplier).where(and(
    eq(purchaseRfqSupplier.masterFn, scope.masterFn),
    eq(purchaseRfqSupplier.companyFn, scope.companyFn),
    eq(purchaseRfqSupplier.rfqId, rfq.id),
    eq(purchaseRfqSupplier.supplierId, input.supplierId),
  ));
  if (!invitation) throw new PurchasingRfqError('The supplier was not invited to this RFQ.');
  const [existingResponse] = await exec.select({ id: supplierQuotation.id }).from(supplierQuotation).where(and(
    eq(supplierQuotation.masterFn, scope.masterFn),
    eq(supplierQuotation.companyFn, scope.companyFn),
    eq(supplierQuotation.rfqId, rfq.id),
    eq(supplierQuotation.supplierId, input.supplierId),
  ));
  if (existingResponse) throw new PurchasingRfqError('This supplier already responded to the RFQ.');

  const rfqLines = await exec.select().from(purchaseRfqLine).where(and(
    eq(purchaseRfqLine.masterFn, scope.masterFn),
    eq(purchaseRfqLine.companyFn, scope.companyFn),
    eq(purchaseRfqLine.rfqId, rfq.id),
  )).orderBy(purchaseRfqLine.lineNo);
  if (
    input.lines.length !== rfqLines.length
    || new Set(input.lines.map((line) => line.rfqLineId)).size !== input.lines.length
  ) {
    throw new PurchasingRfqError('A supplier quotation must price every RFQ line exactly once.');
  }
  const lineById = new Map(rfqLines.map((line) => [line.id, line]));
  if (input.lines.some((line) => !lineById.has(line.rfqLineId))) {
    throw new PurchasingRfqError('One or more quotation lines do not belong to this RFQ.');
  }

  const [quote] = await exec.insert(supplierQuotation).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    rfqId: rfq.id,
    supplierId: input.supplierId,
    quoteDate: input.quoteDate,
    validUntil: input.validUntil,
    currency: input.currency,
    leadTimeDays: input.leadTimeDays,
    paymentTerms,
    warranty: input.warranty?.trim() || null,
  }).returning({ id: supplierQuotation.id });

  let netTotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  for (let index = 0; index < input.lines.length; index += 1) {
    const inputLine = input.lines[index];
    const rfqLine = lineById.get(inputLine.rfqLineId)!;
    const unitCost = positive(inputLine.unitCost, 'Line unit cost', true);
    const taxCode = required(inputLine.taxCode, 'Tax code');
    const rule = await getEffectiveTaxRate(exec, scope, taxCode, input.quoteDate);
    if (!rule) throw new PurchasingRfqError(`No tax rule for ${taxCode} on ${input.quoteDate}.`);
    const qty = new Decimal(rfqLine.qty);
    const rate = new Decimal(rule.rate);
    const net = qty.mul(unitCost).toDecimalPlaces(2);
    const tax = net.mul(rate).div(100).toDecimalPlaces(2);
    await exec.insert(supplierQuotationLine).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      quotationId: quote.id,
      rfqLineId: rfqLine.id,
      lineNo: index + 1,
      productId: rfqLine.productId,
      qty: qty.toFixed(4),
      unitCost: unitCost.toFixed(4),
      netAmount: net.toFixed(2),
      taxCode,
      taxRate: rate.toFixed(3),
      taxAmount: tax.toFixed(2),
    });
    netTotal = netTotal.plus(net);
    taxTotal = taxTotal.plus(tax);
  }
  const total = netTotal.plus(taxTotal);
  const [completed] = await exec.update(supplierQuotation).set({
    netAmount: netTotal.toFixed(2),
    taxAmount: taxTotal.toFixed(2),
    totalAmount: total.toFixed(2),
    updatedAt: sql`now()`,
  }).where(eq(supplierQuotation.id, quote.id)).returning({
    id: supplierQuotation.id,
    docNo: supplierQuotation.docNo,
    status: supplierQuotation.status,
    version: supplierQuotation.version,
    totalAmount: supplierQuotation.totalAmount,
  });

  const invitations = await exec.select({ id: purchaseRfqSupplier.id }).from(purchaseRfqSupplier).where(and(
    eq(purchaseRfqSupplier.masterFn, scope.masterFn),
    eq(purchaseRfqSupplier.companyFn, scope.companyFn),
    eq(purchaseRfqSupplier.rfqId, rfq.id),
  ));
  const responses = await exec.select({ id: supplierQuotation.id }).from(supplierQuotation).where(and(
    eq(supplierQuotation.masterFn, scope.masterFn),
    eq(supplierQuotation.companyFn, scope.companyFn),
    eq(supplierQuotation.rfqId, rfq.id),
  ));
  if (responses.length === invitations.length && rfq.status !== 'responded') {
    await exec.update(purchaseRfq).set({
      status: 'responded',
      version: sql`${purchaseRfq.version} + 1`,
      updatedAt: sql`now()`,
    }).where(eq(purchaseRfq.id, rfq.id));
  }
  return { ...completed, lineCount: input.lines.length };
}

export async function convertSupplierQuotationToPurchaseOrderWithin(
  exec: DB,
  scope: Scope,
  quotationId: number,
  input: { docNo: string; orderDate: string },
) {
  const docNo = required(input.docNo, 'Purchase order number');
  if (!validDate(input.orderDate)) throw new PurchasingRfqError('orderDate must use YYYY-MM-DD.');
  const [quote] = await exec.select().from(supplierQuotation).where(and(
    eq(supplierQuotation.masterFn, scope.masterFn),
    eq(supplierQuotation.companyFn, scope.companyFn),
    eq(supplierQuotation.id, quotationId),
  )).for('update');
  if (!quote || quote.status !== 'received') {
    throw new PurchasingRfqError('Only a received supplier quotation can be converted.');
  }
  if (quote.validUntil < input.orderDate) {
    throw new PurchasingRfqError('The supplier quotation has expired.');
  }
  const [rfq] = await exec.select().from(purchaseRfq).where(and(
    eq(purchaseRfq.masterFn, scope.masterFn),
    eq(purchaseRfq.companyFn, scope.companyFn),
    eq(purchaseRfq.id, quote.rfqId),
  )).for('update');
  if (!rfq || !['sent', 'responded'].includes(rfq.status)) {
    throw new PurchasingRfqError('The RFQ is no longer available for an award.');
  }
  const lines = await exec.select().from(supplierQuotationLine).where(and(
    eq(supplierQuotationLine.masterFn, scope.masterFn),
    eq(supplierQuotationLine.companyFn, scope.companyFn),
    eq(supplierQuotationLine.quotationId, quote.id),
  )).orderBy(supplierQuotationLine.lineNo);
  if (!lines.length) throw new PurchasingRfqError('Supplier quotation has no lines.');

  const created = await createPurchaseOrderWithin(exec, scope, {
    docNo,
    supplierId: quote.supplierId,
    requisitionId: rfq.requisitionId,
    supplierQuotationId: quote.id,
    orderDate: input.orderDate,
    currency: quote.currency,
    lines: lines.map((line) => ({
      productId: line.productId,
      qty: line.qty,
      unitCost: line.unitCost,
      taxCode: line.taxCode,
    })),
  });
  await exec.update(supplierQuotation).set({
    status: 'converted',
    version: sql`${supplierQuotation.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(supplierQuotation.id, quote.id));
  await exec.update(supplierQuotation).set({
    status: 'rejected',
    version: sql`${supplierQuotation.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(supplierQuotation.masterFn, scope.masterFn),
    eq(supplierQuotation.companyFn, scope.companyFn),
    eq(supplierQuotation.rfqId, rfq.id),
    eq(supplierQuotation.status, 'received'),
  ));
  await exec.update(purchaseRfq).set({
    status: 'awarded',
    version: sql`${purchaseRfq.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(purchaseRfq.id, rfq.id));
  const [order] = await exec.select({
    id: purchaseOrder.id,
    docNo: purchaseOrder.docNo,
    status: purchaseOrder.status,
    totalAmount: purchaseOrder.totalAmount,
  }).from(purchaseOrder).where(eq(purchaseOrder.id, created.orderId));
  return {
    quotationId: quote.id,
    rfqId: rfq.id,
    purchaseOrderId: order.id,
    purchaseOrderNo: order.docNo,
    status: order.status,
    totalAmount: order.totalAmount,
  };
}

export function createPurchaseRfq(db: DB, scope: Scope, input: CreatePurchaseRfqInput) {
  return db.transaction((tx) => createPurchaseRfqWithin(tx, scope, input));
}

export function createSupplierQuotation(db: DB, scope: Scope, input: CreateSupplierQuotationInput) {
  return db.transaction((tx) => createSupplierQuotationWithin(tx, scope, input));
}
