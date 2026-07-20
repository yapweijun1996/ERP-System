import { and, eq, inArray, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  customer,
  product,
  salesDiscountRule,
  salesPriceList,
  salesPriceListLine,
} from '../../data/schema';

export class SalesPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalesPricingError';
  }
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new SalesPricingError(`${label} is required.`);
  return normalized;
}

function decimal(
  value: string | number | null | undefined,
  label: string,
  options: { optional?: boolean; positive?: boolean; maximum?: number } = {},
) {
  if (value == null || value === '') {
    if (options.optional) return null;
    throw new SalesPricingError(`${label} is required.`);
  }
  let result: Decimal;
  try {
    result = new Decimal(value);
  } catch {
    throw new SalesPricingError(`${label} must be a valid decimal.`);
  }
  if (!result.isFinite() || (options.positive ? result.lte(0) : result.isNegative())) {
    throw new SalesPricingError(`${label} is invalid.`);
  }
  if (options.maximum != null && result.gt(options.maximum)) {
    throw new SalesPricingError(`${label} cannot exceed ${options.maximum}.`);
  }
  return result;
}

function validDate(value: string | null | undefined) {
  return value == null || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function assertCustomer(exec: DB, scope: Scope, customerId: number | null | undefined) {
  if (customerId == null) return;
  const [row] = await exec.select({ id: customer.id }).from(customer).where(and(
    eq(customer.masterFn, scope.masterFn),
    eq(customer.companyFn, scope.companyFn),
    eq(customer.id, customerId),
  ));
  if (!row) throw new SalesPricingError('Customer is unavailable in this company.');
}

export interface PriceListLineInput {
  productId: number;
  minQty?: string | number;
  unitPrice: string | number;
  floorPrice: string | number;
}

export interface CreatePriceListInput {
  code: string;
  name: string;
  basis: 'standard' | 'customer' | 'promotion';
  customerId?: number | null;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isDefault?: boolean;
  lines: PriceListLineInput[];
}

export async function createPriceListWithin(
  exec: DB,
  scope: Scope,
  input: CreatePriceListInput,
) {
  const code = required(input.code, 'Price-list code');
  const name = required(input.name, 'Price-list name');
  if (!['standard', 'customer', 'promotion'].includes(input.basis)) {
    throw new SalesPricingError('Price-list basis is invalid.');
  }
  if (input.basis === 'customer' && !Number.isSafeInteger(input.customerId)) {
    throw new SalesPricingError('A customer price list requires a customer.');
  }
  if (input.basis !== 'customer' && input.customerId != null) {
    throw new SalesPricingError('Only a customer price list can target a customer.');
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new SalesPricingError('currency must be a three-letter ISO code.');
  }
  if (
    !validDate(input.effectiveFrom)
    || !validDate(input.effectiveTo)
    || (input.effectiveTo != null && input.effectiveTo < input.effectiveFrom)
  ) {
    throw new SalesPricingError('Price-list dates are invalid.');
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new SalesPricingError('A price list requires at least one line.');
  }
  await assertCustomer(exec, scope, input.customerId);
  const productIds = [...new Set(input.lines.map((line) => line.productId))];
  if (
    productIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
    || (await exec.select({ id: product.id }).from(product).where(and(
      eq(product.masterFn, scope.masterFn),
      eq(product.companyFn, scope.companyFn),
      inArray(product.id, productIds),
    ))).length !== productIds.length
  ) {
    throw new SalesPricingError('One or more products are unavailable in this company.');
  }
  const normalizedLines = input.lines.map((line) => {
    const minQty = decimal(line.minQty ?? 1, 'Minimum quantity', { positive: true })!;
    const unitPrice = decimal(line.unitPrice, 'Unit price')!;
    const floorPrice = decimal(line.floorPrice, 'Floor price')!;
    if (unitPrice.lt(floorPrice)) {
      throw new SalesPricingError('Unit price cannot be below the floor price.');
    }
    return { ...line, minQty, unitPrice, floorPrice };
  });
  const uniqueTiers = new Set(
    normalizedLines.map((line) => `${line.productId}:${line.minQty.toFixed(4)}`),
  );
  if (uniqueTiers.size !== normalizedLines.length) {
    throw new SalesPricingError('Duplicate product quantity tiers are not allowed.');
  }
  if (input.isDefault) {
    await exec.update(salesPriceList).set({
      isDefault: false,
      updatedAt: sql`now()`,
    }).where(and(
      eq(salesPriceList.masterFn, scope.masterFn),
      eq(salesPriceList.companyFn, scope.companyFn),
      eq(salesPriceList.currency, input.currency),
      eq(salesPriceList.isDefault, true),
    ));
  }
  const [header] = await exec.insert(salesPriceList).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    code,
    name,
    basis: input.basis,
    customerId: input.customerId ?? null,
    currency: input.currency,
    isDefault: Boolean(input.isDefault),
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
  }).returning({ id: salesPriceList.id });
  await exec.insert(salesPriceListLine).values(normalizedLines.map((line, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    priceListId: header.id,
    lineNo: index + 1,
    productId: line.productId,
    minQty: line.minQty.toFixed(4),
    unitPrice: line.unitPrice.toFixed(4),
    floorPrice: line.floorPrice.toFixed(4),
  })));
  const [created] = await exec.select().from(salesPriceList).where(eq(salesPriceList.id, header.id));
  return created;
}

export async function activatePriceListWithin(exec: DB, scope: Scope, priceListId: number) {
  const [row] = await exec.select().from(salesPriceList).where(and(
    eq(salesPriceList.masterFn, scope.masterFn),
    eq(salesPriceList.companyFn, scope.companyFn),
    eq(salesPriceList.id, priceListId),
  )).for('update');
  if (!row || row.status !== 'draft') {
    throw new SalesPricingError('Only a draft price list can be activated.');
  }
  const [active] = await exec.update(salesPriceList).set({
    status: 'active',
    version: sql`${salesPriceList.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(salesPriceList.masterFn, scope.masterFn),
    eq(salesPriceList.companyFn, scope.companyFn),
    eq(salesPriceList.id, row.id),
  )).returning();
  return active;
}

export interface CreateDiscountRuleInput {
  code: string;
  name: string;
  ruleType: 'standard' | 'customer' | 'product' | 'quantity' | 'campaign';
  customerId?: number | null;
  productId?: number | null;
  minQty?: string | number | null;
  minOrderAmount?: string | number | null;
  discountPct: string | number;
  approvalThresholdPct?: string | number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export async function createDiscountRuleWithin(
  exec: DB,
  scope: Scope,
  input: CreateDiscountRuleInput,
) {
  const code = required(input.code, 'Discount-rule code');
  const name = required(input.name, 'Discount-rule name');
  if (!['standard', 'customer', 'product', 'quantity', 'campaign'].includes(input.ruleType)) {
    throw new SalesPricingError('Discount-rule type is invalid.');
  }
  if (
    !validDate(input.effectiveFrom)
    || !validDate(input.effectiveTo)
    || (input.effectiveTo != null && input.effectiveTo < input.effectiveFrom)
  ) {
    throw new SalesPricingError('Discount-rule dates are invalid.');
  }
  const discountPct = decimal(input.discountPct, 'Discount percentage', { maximum: 100 })!;
  const approval = decimal(
    input.approvalThresholdPct,
    'Approval threshold',
    { optional: true, maximum: 100 },
  );
  const minQty = decimal(input.minQty, 'Minimum quantity', { optional: true, positive: true });
  const minOrderAmount = decimal(
    input.minOrderAmount,
    'Minimum order amount',
    { optional: true },
  );
  if (input.ruleType === 'customer' && !Number.isSafeInteger(input.customerId)) {
    throw new SalesPricingError('A customer rule requires a customer.');
  }
  if (input.ruleType === 'product' && !Number.isSafeInteger(input.productId)) {
    throw new SalesPricingError('A product rule requires a product.');
  }
  if (input.ruleType === 'quantity' && minQty == null) {
    throw new SalesPricingError('A quantity rule requires a minimum quantity.');
  }
  await assertCustomer(exec, scope, input.customerId);
  if (input.productId != null) {
    const [item] = await exec.select({ id: product.id }).from(product).where(and(
      eq(product.masterFn, scope.masterFn),
      eq(product.companyFn, scope.companyFn),
      eq(product.id, input.productId),
    ));
    if (!item) throw new SalesPricingError('Product is unavailable in this company.');
  }
  const [rule] = await exec.insert(salesDiscountRule).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    code,
    name,
    ruleType: input.ruleType,
    customerId: input.customerId ?? null,
    productId: input.productId ?? null,
    minQty: minQty?.toFixed(4) ?? null,
    minOrderAmount: minOrderAmount?.toFixed(2) ?? null,
    discountPct: discountPct.toFixed(3),
    approvalThresholdPct: approval?.toFixed(3) ?? null,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
  }).returning();
  return rule;
}

export async function activateDiscountRuleWithin(exec: DB, scope: Scope, discountRuleId: number) {
  const [row] = await exec.select().from(salesDiscountRule).where(and(
    eq(salesDiscountRule.masterFn, scope.masterFn),
    eq(salesDiscountRule.companyFn, scope.companyFn),
    eq(salesDiscountRule.id, discountRuleId),
  )).for('update');
  if (!row || row.status !== 'draft') {
    throw new SalesPricingError('Only a draft discount rule can be activated.');
  }
  const [active] = await exec.update(salesDiscountRule).set({
    status: 'active',
    version: sql`${salesDiscountRule.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(salesDiscountRule.masterFn, scope.masterFn),
    eq(salesDiscountRule.companyFn, scope.companyFn),
    eq(salesDiscountRule.id, row.id),
  )).returning();
  return active;
}

export function createPriceList(db: DB, scope: Scope, input: CreatePriceListInput) {
  return db.transaction((tx) => createPriceListWithin(tx, scope, input));
}

export function activatePriceList(db: DB, scope: Scope, priceListId: number) {
  return db.transaction((tx) => activatePriceListWithin(tx, scope, priceListId));
}

export function createDiscountRule(db: DB, scope: Scope, input: CreateDiscountRuleInput) {
  return db.transaction((tx) => createDiscountRuleWithin(tx, scope, input));
}

export function activateDiscountRule(db: DB, scope: Scope, discountRuleId: number) {
  return db.transaction((tx) => activateDiscountRuleWithin(tx, scope, discountRuleId));
}
