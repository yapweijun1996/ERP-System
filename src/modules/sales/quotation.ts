import { and, eq, inArray, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { getEffectiveTaxRate } from '../../data/repo';
import {
  customer,
  product,
  salesEnquiry,
  salesOrder,
  salesOrderLine,
  salesQuotation,
  salesQuotationLine,
} from '../../data/schema';

export class SalesQuotationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalesQuotationError';
  }
}

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new SalesQuotationError(`${label} is required.`);
  return normalized;
}

function amount(value: string | number, label: string, allowZero = false): Decimal {
  let decimal: Decimal;
  try {
    decimal = new Decimal(value);
  } catch {
    throw new SalesQuotationError(`${label} must be a valid decimal.`);
  }
  if (!decimal.isFinite() || (allowZero ? decimal.isNegative() : !decimal.isPositive())) {
    throw new SalesQuotationError(`${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'}.`);
  }
  return decimal;
}

async function assertCustomer(exec: DB, scope: Scope, customerId: number) {
  const [row] = await exec.select({ id: customer.id }).from(customer).where(and(
    eq(customer.masterFn, scope.masterFn),
    eq(customer.companyFn, scope.companyFn),
    eq(customer.id, customerId),
  ));
  if (!row) throw new SalesQuotationError('Customer does not exist in this company.');
}

export interface CreateSalesEnquiryInput {
  docNo: string;
  customerId: number;
  subject: string;
  channel: string;
  estimatedValue: string | number;
  currency: string;
  ownerName: string;
  enquiryDate: string;
}

export async function createSalesEnquiryWithin(
  exec: DB,
  scope: Scope,
  input: CreateSalesEnquiryInput,
) {
  const docNo = required(input.docNo, 'Enquiry number');
  const subject = required(input.subject, 'Subject');
  const channel = required(input.channel, 'Channel');
  const ownerName = required(input.ownerName, 'Owner');
  if (!Number.isSafeInteger(input.customerId) || input.customerId <= 0) {
    throw new SalesQuotationError('customerId must be a positive integer.');
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new SalesQuotationError('currency must be a three-letter ISO code.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.enquiryDate)) {
    throw new SalesQuotationError('enquiryDate must use YYYY-MM-DD.');
  }
  const estimatedValue = amount(input.estimatedValue, 'estimatedValue', true);
  await assertCustomer(exec, scope, input.customerId);
  const [enquiry] = await exec.insert(salesEnquiry).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    customerId: input.customerId,
    subject,
    channel,
    estimatedValue: estimatedValue.toFixed(2),
    currency: input.currency,
    ownerName,
    enquiryDate: input.enquiryDate,
  }).returning({
    id: salesEnquiry.id,
    docNo: salesEnquiry.docNo,
    status: salesEnquiry.status,
    version: salesEnquiry.version,
  });
  return enquiry;
}

export interface SalesQuotationLineInput {
  productId: number;
  qty: string | number;
  unitPrice: string | number;
  taxCode: string;
}

export interface CreateSalesQuotationInput {
  docNo: string;
  customerId: number;
  enquiryId?: number | null;
  quoteDate: string;
  validUntil: string;
  currency: string;
  probability?: string | number;
  lines: SalesQuotationLineInput[];
}

export async function createSalesQuotationWithin(
  exec: DB,
  scope: Scope,
  input: CreateSalesQuotationInput,
) {
  const docNo = required(input.docNo, 'Quotation number');
  if (!Number.isSafeInteger(input.customerId) || input.customerId <= 0) {
    throw new SalesQuotationError('customerId must be a positive integer.');
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.quoteDate)
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.validUntil)
    || input.validUntil < input.quoteDate
  ) {
    throw new SalesQuotationError('Quotation dates are invalid.');
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new SalesQuotationError('currency must be a three-letter ISO code.');
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new SalesQuotationError('A quotation requires at least one line.');
  }
  const probability = amount(input.probability ?? 50, 'probability', true);
  if (probability.gt(100)) throw new SalesQuotationError('probability cannot exceed 100.');
  await assertCustomer(exec, scope, input.customerId);

  if (input.enquiryId != null) {
    const [enquiry] = await exec.select({
      customerId: salesEnquiry.customerId,
      status: salesEnquiry.status,
    }).from(salesEnquiry).where(and(
      eq(salesEnquiry.masterFn, scope.masterFn),
      eq(salesEnquiry.companyFn, scope.companyFn),
      eq(salesEnquiry.id, input.enquiryId),
    ));
    if (!enquiry || enquiry.customerId !== input.customerId || enquiry.status !== 'new') {
      throw new SalesQuotationError('Enquiry is not available for this quotation.');
    }
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
    throw new SalesQuotationError('One or more products are not available in this company.');
  }

  const [quotation] = await exec.insert(salesQuotation).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    customerId: input.customerId,
    enquiryId: input.enquiryId ?? null,
    quoteDate: input.quoteDate,
    validUntil: input.validUntil,
    currency: input.currency,
    probability: probability.toFixed(2),
  }).returning({ id: salesQuotation.id });

  let netTotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  for (let index = 0; index < input.lines.length; index += 1) {
    const line = input.lines[index];
    const qty = amount(line.qty, 'Line quantity');
    const unitPrice = amount(line.unitPrice, 'Line unit price', true);
    const taxCode = required(line.taxCode, 'Tax code');
    const taxRule = await getEffectiveTaxRate(exec, scope, taxCode, input.quoteDate);
    if (!taxRule) throw new SalesQuotationError(`No tax rule for ${taxCode} on ${input.quoteDate}.`);
    const rate = new Decimal(taxRule.rate);
    const net = qty.mul(unitPrice).toDecimalPlaces(2);
    const tax = net.mul(rate).div(100).toDecimalPlaces(2);
    await exec.insert(salesQuotationLine).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      quotationId: quotation.id,
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
  const [completed] = await exec.update(salesQuotation).set({
    netAmount: netTotal.toFixed(2),
    taxAmount: taxTotal.toFixed(2),
    totalAmount: total.toFixed(2),
    updatedAt: sql`now()`,
  }).where(eq(salesQuotation.id, quotation.id)).returning({
    id: salesQuotation.id,
    docNo: salesQuotation.docNo,
    status: salesQuotation.status,
    version: salesQuotation.version,
    totalAmount: salesQuotation.totalAmount,
  });
  return { ...completed, lineCount: input.lines.length };
}

export interface ConvertEnquiryInput extends Omit<CreateSalesQuotationInput, 'customerId' | 'enquiryId'> {}

export async function convertEnquiryToQuotationWithin(
  exec: DB,
  scope: Scope,
  enquiryId: number,
  input: ConvertEnquiryInput,
) {
  const [enquiry] = await exec.select({
    id: salesEnquiry.id,
    status: salesEnquiry.status,
    customerId: salesEnquiry.customerId,
  }).from(salesEnquiry).where(and(
    eq(salesEnquiry.masterFn, scope.masterFn),
    eq(salesEnquiry.companyFn, scope.companyFn),
    eq(salesEnquiry.id, enquiryId),
  )).for('update');
  if (!enquiry || enquiry.status !== 'new') {
    throw new SalesQuotationError('Only a new enquiry can be converted to a quotation.');
  }
  const quotation = await createSalesQuotationWithin(exec, scope, {
    ...input,
    customerId: enquiry.customerId,
    enquiryId: enquiry.id,
  });
  await exec.update(salesEnquiry).set({
    status: 'quoted',
    version: sql`${salesEnquiry.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(salesEnquiry.id, enquiry.id));
  return { enquiryId: enquiry.id, quotationId: quotation.id, status: 'quoted' };
}

export async function transitionQuotationWithin(
  exec: DB,
  scope: Scope,
  quotationId: number,
  transition: 'issue' | 'accept',
) {
  const [quotation] = await exec.select({
    id: salesQuotation.id,
    docNo: salesQuotation.docNo,
    status: salesQuotation.status,
  }).from(salesQuotation).where(and(
    eq(salesQuotation.masterFn, scope.masterFn),
    eq(salesQuotation.companyFn, scope.companyFn),
    eq(salesQuotation.id, quotationId),
  )).for('update');
  if (!quotation) throw new SalesQuotationError('Quotation does not exist in this company.');
  const expected = transition === 'issue' ? 'draft' : 'sent';
  const next = transition === 'issue' ? 'sent' : 'accepted';
  if (quotation.status !== expected) {
    throw new SalesQuotationError(
      `Quotation ${quotation.docNo} is '${quotation.status}', expected '${expected}'.`,
    );
  }
  const [updated] = await exec.update(salesQuotation).set({
    status: next,
    version: sql`${salesQuotation.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(salesQuotation.id, quotation.id)).returning({
    quotationId: salesQuotation.id,
    status: salesQuotation.status,
    version: salesQuotation.version,
  });
  return updated;
}

export async function convertQuotationToOrderWithin(
  exec: DB,
  scope: Scope,
  quotationId: number,
  input: { docNo: string; orderDate: string },
) {
  const docNo = required(input.docNo, 'Sales order number');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.orderDate)) {
    throw new SalesQuotationError('orderDate must use YYYY-MM-DD.');
  }
  const [quotation] = await exec.select({
    id: salesQuotation.id,
    docNo: salesQuotation.docNo,
    status: salesQuotation.status,
    customerId: salesQuotation.customerId,
    currency: salesQuotation.currency,
    netAmount: salesQuotation.netAmount,
    taxAmount: salesQuotation.taxAmount,
    totalAmount: salesQuotation.totalAmount,
  }).from(salesQuotation).where(and(
    eq(salesQuotation.masterFn, scope.masterFn),
    eq(salesQuotation.companyFn, scope.companyFn),
    eq(salesQuotation.id, quotationId),
  )).for('update');
  if (!quotation || quotation.status !== 'accepted') {
    throw new SalesQuotationError('Only an accepted quotation can be converted to an order.');
  }
  const lines = await exec.select().from(salesQuotationLine).where(and(
    eq(salesQuotationLine.masterFn, scope.masterFn),
    eq(salesQuotationLine.companyFn, scope.companyFn),
    eq(salesQuotationLine.quotationId, quotation.id),
  )).orderBy(salesQuotationLine.lineNo);
  if (!lines.length) throw new SalesQuotationError('Quotation has no lines.');

  const [order] = await exec.insert(salesOrder).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    customerId: quotation.customerId,
    status: 'draft',
    orderDate: input.orderDate,
    currency: quotation.currency,
    netAmount: quotation.netAmount,
    taxAmount: quotation.taxAmount,
    totalAmount: quotation.totalAmount,
  }).returning({ id: salesOrder.id, version: salesOrder.version });
  await exec.insert(salesOrderLine).values(lines.map((line) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    orderId: order.id,
    lineNo: line.lineNo,
    productId: line.productId,
    qty: line.qty,
    unitPrice: line.unitPrice,
    netAmount: line.netAmount,
    taxCode: line.taxCode,
    taxRate: line.taxRate,
    taxAmount: line.taxAmount,
  })));
  await exec.update(salesQuotation).set({
    status: 'converted',
    orderId: order.id,
    version: sql`${salesQuotation.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(salesQuotation.id, quotation.id));
  return {
    quotationId: quotation.id,
    orderId: order.id,
    orderDocNo: docNo,
    orderStatus: 'draft',
    version: order.version,
  };
}

export function createSalesEnquiry(db: DB, scope: Scope, input: CreateSalesEnquiryInput) {
  return db.transaction((tx) => createSalesEnquiryWithin(tx, scope, input));
}

export function createSalesQuotation(db: DB, scope: Scope, input: CreateSalesQuotationInput) {
  return db.transaction((tx) => createSalesQuotationWithin(tx, scope, input));
}
