import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { getEffectiveTaxRate } from '../../data/repo';
import {
  customer,
  product,
  salesEnquiry,
  salesEnquiryLine,
  salesQuotation,
  salesQuotationLine,
} from '../../data/schema';
import { createSalesOrderWithin } from './createSalesOrder';

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

type CommercialLineType = 'stock' | 'non_stock';

interface CommercialLineIdentityInput {
  lineType?: CommercialLineType;
  productId?: number | null;
  description?: string;
  uom?: string;
}

async function prepareCommercialLineIdentities(
  exec: DB,
  scope: Scope,
  lines: CommercialLineIdentityInput[],
) {
  const normalized = lines.map((line) => ({
    lineType: line.lineType ?? (line.productId == null ? 'non_stock' : 'stock'),
    productId: line.productId ?? null,
    description: line.description,
    uom: line.uom,
  }));
  if (normalized.some((line) => !['stock', 'non_stock'].includes(line.lineType))) {
    throw new SalesQuotationError('Line type must be stock or non_stock.');
  }
  if (normalized.some((line) => line.lineType === 'stock'
    ? !Number.isSafeInteger(line.productId) || Number(line.productId) <= 0
    : line.productId != null)) {
    throw new SalesQuotationError('Stock lines require a product; non-stock lines must not use one.');
  }
  const productIds = [...new Set(normalized
    .filter((line) => line.lineType === 'stock')
    .map((line) => Number(line.productId)))];
  const products = productIds.length
    ? await exec.select({ id: product.id, name: product.name, uom: product.uom }).from(product).where(and(
      eq(product.masterFn, scope.masterFn),
      eq(product.companyFn, scope.companyFn),
      inArray(product.id, productIds),
    ))
    : [];
  if (products.length !== productIds.length) {
    throw new SalesQuotationError('One or more products are not available in this company.');
  }
  const byId = new Map(products.map((row) => [row.id, row]));
  return normalized.map((line) => {
    const item = line.lineType === 'stock' ? byId.get(Number(line.productId)) : null;
    const description = required(line.description ?? item?.name, 'Line description');
    const uom = required(line.uom ?? item?.uom ?? 'unit', 'Line unit of measure');
    if (description.length > 500) throw new SalesQuotationError('Line description must be at most 500 characters.');
    if (uom.length > 40) throw new SalesQuotationError('Line unit of measure must be at most 40 characters.');
    return { lineType: line.lineType, productId: line.productId, description, uom };
  });
}

function amount(value: string | number, label: string, allowZero = false): Decimal {
  let decimal: Decimal;
  try {
    decimal = new Decimal(value);
  } catch {
    throw new SalesQuotationError(`${label} must be a valid decimal.`);
  }
  if (!decimal.isFinite() || (allowZero ? decimal.isNegative() : decimal.lte(0))) {
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
  /** Optional for Quick Create. When omitted, the server assigns the formal
   * document number only after the row has been inserted successfully. */
  docNo?: string;
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
  const requestedDocNo = input.docNo?.trim();
  const draftDocNo = requestedDocNo || `DRAFT-${globalThis.crypto.randomUUID()}`;
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
    docNo: draftDocNo,
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
  if (requestedDocNo) return enquiry;

  // Enquiries are non-statutory documents. Their stable identity-backed number
  // is assigned in the same transaction after insert, so an unsuccessful create
  // never exposes or reserves a formal document number in the UI.
  const docNo = `ENQ-${String(enquiry.id).padStart(7, '0')}`;
  const [numbered] = await exec.update(salesEnquiry).set({
    docNo,
    updatedAt: new Date(),
  }).where(and(
    eq(salesEnquiry.id, enquiry.id),
    eq(salesEnquiry.masterFn, scope.masterFn),
    eq(salesEnquiry.companyFn, scope.companyFn),
  )).returning({
    id: salesEnquiry.id,
    docNo: salesEnquiry.docNo,
    status: salesEnquiry.status,
    version: salesEnquiry.version,
  });
  return numbered;
}

export interface SalesEnquiryLineInput {
  lineType?: CommercialLineType;
  productId?: number | null;
  description?: string;
  uom?: string;
  qty: string | number;
  estimatedUnitPrice: string | number;
}

export interface ReplaceSalesEnquiryLinesInput {
  expectedVersion: number;
  lines: SalesEnquiryLineInput[];
}

export interface SaveSalesEnquiryDraftHeaderInput {
  customerId: number;
  subject: string;
  channel: string;
  currency: string;
  ownerName: string;
  enquiryDate: string;
}

export interface SaveSalesEnquiryDraftInput {
  expectedVersion: number;
  header: SaveSalesEnquiryDraftHeaderInput;
  lines: SalesEnquiryLineInput[];
}

export async function getSalesEnquiryAggregateWithin(
  exec: DB,
  scope: Scope,
  enquiryId: number,
) {
  const [enquiry] = await exec.select().from(salesEnquiry).where(and(
    eq(salesEnquiry.masterFn, scope.masterFn),
    eq(salesEnquiry.companyFn, scope.companyFn),
    eq(salesEnquiry.id, enquiryId),
  )).limit(1);
  if (!enquiry) return null;

  const [customerRecord] = await exec.select().from(customer).where(and(
    eq(customer.masterFn, scope.masterFn),
    eq(customer.companyFn, scope.companyFn),
    eq(customer.id, enquiry.customerId),
  )).limit(1);
  const lines = await exec.select().from(salesEnquiryLine).where(and(
    eq(salesEnquiryLine.masterFn, scope.masterFn),
    eq(salesEnquiryLine.companyFn, scope.companyFn),
    eq(salesEnquiryLine.enquiryId, enquiry.id),
  )).orderBy(asc(salesEnquiryLine.lineNo));
  const quotations = await exec.select().from(salesQuotation).where(and(
    eq(salesQuotation.masterFn, scope.masterFn),
    eq(salesQuotation.companyFn, scope.companyFn),
    eq(salesQuotation.enquiryId, enquiry.id),
  )).orderBy(asc(salesQuotation.id));

  return {
    enquiry,
    customer: customerRecord ?? null,
    lines,
    quotations,
  };
}

function validateSalesEnquiryDraftHeader(input: SaveSalesEnquiryDraftHeaderInput) {
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
  return { customerId: input.customerId, subject, channel, currency: input.currency, ownerName, enquiryDate: input.enquiryDate };
}

async function saveSalesEnquiryDraftLocked(
  exec: DB,
  scope: Scope,
  enquiry: { id: number; status: string; version: number },
  lines: SalesEnquiryLineInput[],
  header?: SaveSalesEnquiryDraftHeaderInput,
) {
  if (enquiry.status !== 'new') {
    throw new SalesQuotationError('Only a new enquiry can edit its draft.');
  }
  if (!Array.isArray(lines) || lines.length > 100) {
    throw new SalesQuotationError('Enquiry lines must contain at most 100 rows.');
  }
  const normalizedHeader = header ? validateSalesEnquiryDraftHeader(header) : null;
  if (normalizedHeader) await assertCustomer(exec, scope, normalizedHeader.customerId);
  const identities = await prepareCommercialLineIdentities(exec, scope, lines);
  const prepared = lines.map((line, index) => ({
    ...identities[index],
    qty: amount(line.qty, 'Line quantity'),
    estimatedUnitPrice: amount(line.estimatedUnitPrice, 'Line estimated unit price', true),
  }));

  await exec.delete(salesEnquiryLine).where(and(
    eq(salesEnquiryLine.masterFn, scope.masterFn),
    eq(salesEnquiryLine.companyFn, scope.companyFn),
    eq(salesEnquiryLine.enquiryId, enquiry.id),
  ));
  if (prepared.length) {
    await exec.insert(salesEnquiryLine).values(prepared.map((line, index) => ({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      enquiryId: enquiry.id,
      lineNo: index + 1,
      lineType: line.lineType,
      productId: line.productId,
      description: line.description,
      uom: line.uom,
      qty: line.qty.toFixed(4),
      estimatedUnitPrice: line.estimatedUnitPrice.toFixed(4),
    })));
  }
  const estimatedValue = prepared.reduce(
    (total, line) => total.plus(line.qty.mul(line.estimatedUnitPrice)),
    new Decimal(0),
  ).toDecimalPlaces(2);
  const [updated] = await exec.update(salesEnquiry).set(normalizedHeader ? {
    ...normalizedHeader,
    estimatedValue: estimatedValue.toFixed(2),
    version: sql`${salesEnquiry.version} + 1`,
    updatedAt: sql`now()`,
  } : {
    estimatedValue: estimatedValue.toFixed(2),
    version: sql`${salesEnquiry.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(salesEnquiry.masterFn, scope.masterFn),
    eq(salesEnquiry.companyFn, scope.companyFn),
    eq(salesEnquiry.id, enquiry.id),
  )).returning();
  return { enquiry: updated, lineCount: prepared.length };
}

/** Saves the whole editable enquiry aggregate in one transaction. Header and
 * rows are intentionally one command so a failed line validation cannot leave
 * a partially updated document or stale estimated value. */
export async function saveSalesEnquiryDraftWithin(
  exec: DB,
  scope: Scope,
  enquiryId: number,
  input: SaveSalesEnquiryDraftInput,
) {
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion <= 0) {
    throw new SalesQuotationError('expectedVersion must be a positive integer.');
  }
  const [enquiry] = await exec.select({
    id: salesEnquiry.id,
    status: salesEnquiry.status,
    version: salesEnquiry.version,
  }).from(salesEnquiry).where(and(
    eq(salesEnquiry.masterFn, scope.masterFn),
    eq(salesEnquiry.companyFn, scope.companyFn),
    eq(salesEnquiry.id, enquiryId),
  )).for('update');
  if (!enquiry) throw new SalesQuotationError('Enquiry does not exist in this company.');
  if (enquiry.version !== input.expectedVersion) {
    throw new SalesQuotationError(
      `Enquiry version changed from ${input.expectedVersion} to ${enquiry.version}; reload before saving.`,
    );
  }
  return saveSalesEnquiryDraftLocked(exec, scope, enquiry, input.lines, input.header);
}

/** Atomically replaces the editable enquiry item set. A document-level command is
 * intentional here: row CRUD would expose half-saved totals and make line numbering
 * race across devices. */
export async function replaceSalesEnquiryLinesWithin(
  exec: DB,
  scope: Scope,
  enquiryId: number,
  input: ReplaceSalesEnquiryLinesInput,
) {
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion <= 0) {
    throw new SalesQuotationError('expectedVersion must be a positive integer.');
  }
  const [enquiry] = await exec.select({
    id: salesEnquiry.id,
    status: salesEnquiry.status,
    version: salesEnquiry.version,
  }).from(salesEnquiry).where(and(
    eq(salesEnquiry.masterFn, scope.masterFn),
    eq(salesEnquiry.companyFn, scope.companyFn),
    eq(salesEnquiry.id, enquiryId),
  )).for('update');
  if (!enquiry) throw new SalesQuotationError('Enquiry does not exist in this company.');
  if (enquiry.status !== 'new') {
    throw new SalesQuotationError('Only a new enquiry can edit its items.');
  }
  if (enquiry.version !== input.expectedVersion) {
    throw new SalesQuotationError(
      `Enquiry version changed from ${input.expectedVersion} to ${enquiry.version}; reload before saving.`,
    );
  }
  const result = await saveSalesEnquiryDraftLocked(exec, scope, enquiry, input.lines);
  return {
    id: result.enquiry.id,
    version: result.enquiry.version,
    estimatedValue: result.enquiry.estimatedValue,
    lineCount: result.lineCount,
  };
}

export interface SalesQuotationLineInput {
  lineType?: CommercialLineType;
  productId?: number | null;
  description?: string;
  uom?: string;
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

  const identities = await prepareCommercialLineIdentities(exec, scope, input.lines);

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
    const identity = identities[index];
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
      lineType: identity.lineType,
      productId: identity.productId,
      description: identity.description,
      uom: identity.uom,
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- deliberate semantic rename, not a stub: same shape as the Omit<> above but reads correctly at convert-enquiry call sites
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
  const canonicalLines = await exec.select({
    lineType: salesEnquiryLine.lineType,
    productId: salesEnquiryLine.productId,
    description: salesEnquiryLine.description,
    uom: salesEnquiryLine.uom,
    qty: salesEnquiryLine.qty,
    estimatedUnitPrice: salesEnquiryLine.estimatedUnitPrice,
  }).from(salesEnquiryLine).where(and(
    eq(salesEnquiryLine.masterFn, scope.masterFn),
    eq(salesEnquiryLine.companyFn, scope.companyFn),
    eq(salesEnquiryLine.enquiryId, enquiry.id),
  )).orderBy(asc(salesEnquiryLine.lineNo));
  if (canonicalLines.length && canonicalLines.length !== input.lines.length) {
    throw new SalesQuotationError(
      'Quotation lines must match the saved enquiry item count; reload before converting.',
    );
  }
  const quotationLines = canonicalLines.length
    ? canonicalLines.map((line, index) => ({
      lineType: line.lineType as CommercialLineType,
      productId: line.productId,
      description: line.description,
      uom: line.uom,
      qty: line.qty,
      // Quotation pricing and tax are commercial decisions, but the requested
      // product and quantity always come from the locked enquiry rows.
      unitPrice: input.lines[index]?.unitPrice ?? line.estimatedUnitPrice,
      taxCode: input.lines[index]?.taxCode ?? '',
    }))
    : input.lines; // Backward compatibility for pre-0076 enquiries with no item rows.
  const quotation = await createSalesQuotationWithin(exec, scope, {
    ...input,
    lines: quotationLines,
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

  const order = await createSalesOrderWithin(exec, scope, {
    docNo,
    customerId: quotation.customerId,
    orderDate: input.orderDate,
    currency: quotation.currency,
    approvalReason: `Accepted quotation ${quotation.docNo} requires order approval.`,
    lines: lines.map((line) => ({
      lineType: line.lineType as 'stock' | 'non_stock',
      productId: line.productId == null ? null : Number(line.productId),
      description: line.description,
      uom: line.uom,
      qty: line.qty,
      unitPrice: line.unitPrice,
      taxCode: line.taxCode,
    })),
  });
  await exec.update(salesQuotation).set({
    status: 'converted',
    orderId: order.orderId,
    version: sql`${salesQuotation.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(salesQuotation.id, quotation.id));
  return {
    quotationId: quotation.id,
    orderId: order.orderId,
    orderDocNo: docNo,
    orderStatus: 'pending_approval',
    version: order.version,
    approvalId: order.approvalId,
  };
}

export function createSalesEnquiry(db: DB, scope: Scope, input: CreateSalesEnquiryInput) {
  return db.transaction((tx) => createSalesEnquiryWithin(tx, scope, input));
}

export function createSalesQuotation(db: DB, scope: Scope, input: CreateSalesQuotationInput) {
  return db.transaction((tx) => createSalesQuotationWithin(tx, scope, input));
}
