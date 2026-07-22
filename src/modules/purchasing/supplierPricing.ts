import { and, eq, inArray, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  product,
  supplier,
  supplierPriceList,
  supplierPriceListLine,
} from '../../data/schema';

export class SupplierPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupplierPricingError';
  }
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new SupplierPricingError(`${label} is required.`);
  return normalized;
}

function positiveDecimal(value: string | number | undefined, label: string) {
  let result: Decimal;
  try {
    result = new Decimal(value ?? '');
  } catch {
    throw new SupplierPricingError(`${label} must be a valid decimal.`);
  }
  if (!result.isFinite() || result.lte(0)) {
    throw new SupplierPricingError(`${label} must be greater than zero.`);
  }
  return result;
}

function nonNegativeDecimal(value: string | number | undefined, label: string) {
  let result: Decimal;
  try {
    result = new Decimal(value ?? '');
  } catch {
    throw new SupplierPricingError(`${label} must be a valid decimal.`);
  }
  if (!result.isFinite() || result.isNegative()) {
    throw new SupplierPricingError(`${label} cannot be negative.`);
  }
  return result;
}

function validDate(value: string | null | undefined) {
  return value == null || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export interface SupplierPriceListLineInput {
  productId: number;
  minQty?: string | number;
  unitCost: string | number;
}

export interface CreateSupplierPriceListInput {
  code: string;
  name: string;
  supplierId: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  leadTimeDays?: number;
  paymentTerms?: string | null;
  isPreferred?: boolean;
  lines: SupplierPriceListLineInput[];
}

export async function createSupplierPriceListWithin(
  exec: DB,
  scope: Scope,
  input: CreateSupplierPriceListInput,
) {
  const code = required(input.code, 'Price-list code');
  const name = required(input.name, 'Price-list name');
  if (!Number.isSafeInteger(input.supplierId) || input.supplierId <= 0) {
    throw new SupplierPricingError('Supplier is required.');
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new SupplierPricingError('Currency must be a three-letter ISO code.');
  }
  if (
    !validDate(input.effectiveFrom)
    || !validDate(input.effectiveTo)
    || (input.effectiveTo != null && input.effectiveTo < input.effectiveFrom)
  ) {
    throw new SupplierPricingError('Price-list dates are invalid.');
  }
  const leadTimeDays = input.leadTimeDays ?? 0;
  if (!Number.isSafeInteger(leadTimeDays) || leadTimeDays < 0) {
    throw new SupplierPricingError('Lead time must be a non-negative whole number.');
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new SupplierPricingError('A supplier price list requires at least one line.');
  }
  const [vendor] = await exec.select({ id: supplier.id }).from(supplier).where(and(
    eq(supplier.masterFn, scope.masterFn),
    eq(supplier.companyFn, scope.companyFn),
    eq(supplier.id, input.supplierId),
  ));
  if (!vendor) throw new SupplierPricingError('Supplier is unavailable in this company.');

  const productIds = [...new Set(input.lines.map((line) => line.productId))];
  if (
    productIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
    || (await exec.select({ id: product.id }).from(product).where(and(
      eq(product.masterFn, scope.masterFn),
      eq(product.companyFn, scope.companyFn),
      inArray(product.id, productIds),
    ))).length !== productIds.length
  ) {
    throw new SupplierPricingError('One or more products are unavailable in this company.');
  }
  const normalizedLines = input.lines.map((line) => ({
    ...line,
    minQty: positiveDecimal(line.minQty ?? 1, 'Minimum quantity'),
    unitCost: nonNegativeDecimal(line.unitCost, 'Unit cost'),
  }));
  const tiers = new Set(
    normalizedLines.map((line) => `${line.productId}:${line.minQty.toFixed(4)}`),
  );
  if (tiers.size !== normalizedLines.length) {
    throw new SupplierPricingError('Duplicate product quantity tiers are not allowed.');
  }

  const [header] = await exec.insert(supplierPriceList).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    code,
    name,
    supplierId: input.supplierId,
    currency: input.currency,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    leadTimeDays,
    paymentTerms: input.paymentTerms?.trim() || null,
    isPreferred: Boolean(input.isPreferred),
  }).returning();
  await exec.insert(supplierPriceListLine).values(normalizedLines.map((line, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    priceListId: header.id,
    lineNo: index + 1,
    productId: line.productId,
    minQty: line.minQty.toFixed(4),
    unitCost: line.unitCost.toFixed(4),
  })));
  return header;
}

function rangesOverlap(
  leftFrom: string,
  leftTo: string | null,
  rightFrom: string,
  rightTo: string | null,
) {
  return (leftTo == null || rightFrom <= leftTo) && (rightTo == null || leftFrom <= rightTo);
}

export async function activateSupplierPriceListWithin(
  exec: DB,
  scope: Scope,
  priceListId: number,
) {
  const [row] = await exec.select().from(supplierPriceList).where(and(
    eq(supplierPriceList.masterFn, scope.masterFn),
    eq(supplierPriceList.companyFn, scope.companyFn),
    eq(supplierPriceList.id, priceListId),
  )).for('update');
  if (!row || row.status !== 'draft') {
    throw new SupplierPricingError('Only a draft supplier price list can be activated.');
  }
  // Serialize activation decisions for the same supplier. Locking only the
  // draft header would let two overlapping drafts activate concurrently after
  // both observed an empty active set.
  await exec.select({ id: supplier.id }).from(supplier).where(and(
    eq(supplier.masterFn, scope.masterFn),
    eq(supplier.companyFn, scope.companyFn),
    eq(supplier.id, row.supplierId),
  )).for('update');
  const ownLines = await exec.select({ productId: supplierPriceListLine.productId })
    .from(supplierPriceListLine).where(and(
      eq(supplierPriceListLine.masterFn, scope.masterFn),
      eq(supplierPriceListLine.companyFn, scope.companyFn),
      eq(supplierPriceListLine.priceListId, row.id),
    ));
  const ownProducts = new Set(ownLines.map((line) => line.productId));
  const activeLists = await exec.select().from(supplierPriceList).where(and(
    eq(supplierPriceList.masterFn, scope.masterFn),
    eq(supplierPriceList.companyFn, scope.companyFn),
    eq(supplierPriceList.supplierId, row.supplierId),
    eq(supplierPriceList.currency, row.currency),
    eq(supplierPriceList.status, 'active'),
  ));
  const overlapping = activeLists.filter((active) => rangesOverlap(
    row.effectiveFrom,
    row.effectiveTo,
    active.effectiveFrom,
    active.effectiveTo,
  ));
  if (overlapping.length) {
    const existingLines = await exec.select({
      priceListId: supplierPriceListLine.priceListId,
      productId: supplierPriceListLine.productId,
    }).from(supplierPriceListLine).where(and(
      eq(supplierPriceListLine.masterFn, scope.masterFn),
      eq(supplierPriceListLine.companyFn, scope.companyFn),
      inArray(supplierPriceListLine.priceListId, overlapping.map((active) => active.id)),
    ));
    if (existingLines.some((line) => ownProducts.has(line.productId))) {
      throw new SupplierPricingError(
        'An active supplier price list already covers one of these products in the same date range.',
      );
    }
  }
  if (row.isPreferred) {
    await exec.update(supplierPriceList).set({
      isPreferred: false,
      updatedAt: sql`now()`,
    }).where(and(
      eq(supplierPriceList.masterFn, scope.masterFn),
      eq(supplierPriceList.companyFn, scope.companyFn),
      eq(supplierPriceList.supplierId, row.supplierId),
      eq(supplierPriceList.currency, row.currency),
      eq(supplierPriceList.isPreferred, true),
    ));
  }
  const [active] = await exec.update(supplierPriceList).set({
    status: 'active',
    version: sql`${supplierPriceList.version} + 1`,
    updatedAt: sql`now()`,
  }).where(eq(supplierPriceList.id, row.id)).returning();
  return active;
}

export function createSupplierPriceList(db: DB, scope: Scope, input: CreateSupplierPriceListInput) {
  return db.transaction((tx) => createSupplierPriceListWithin(tx, scope, input));
}

export function activateSupplierPriceList(db: DB, scope: Scope, priceListId: number) {
  return db.transaction((tx) => activateSupplierPriceListWithin(tx, scope, priceListId));
}
