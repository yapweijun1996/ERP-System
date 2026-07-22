// Item master — create/update product master data. Deliberately does not accept an
// opening on-hand quantity: on-hand is ledger-derived (stock_level/stock_movement),
// so a new item starts at 0 and receives real stock through the existing Canonical
// stock-adjustment flow, not a raw field on this record (see docs/SPEC.md landmine
// on stock writes always being one transaction through the movement ledger).
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { product, PRODUCT_CATEGORIES } from '../../data/schema';
import { fixedUnits } from './decimal';

export class InventoryProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryProductValidationError';
  }
}

export class InventoryProductConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryProductConflictError';
  }
}

export interface ProductFields {
  sku: string;
  name: string;
  uom: string;
  category: string;
  standardCost: string | number;
  reorderPoint: string | number;
  reorderQty: string | number;
}

export type CreateProductInput = ProductFields;
export type UpdateProductInput = Omit<ProductFields, 'sku'>;

function validateFields(input: Partial<ProductFields>, requireSku: boolean) {
  if (requireSku && !input.sku?.trim()) {
    throw new InventoryProductValidationError('sku is required');
  }
  if (!input.name?.trim()) {
    throw new InventoryProductValidationError('name is required');
  }
  if (!input.uom?.trim()) {
    throw new InventoryProductValidationError('uom is required');
  }
  if (!input.category || !PRODUCT_CATEGORIES.includes(input.category as typeof PRODUCT_CATEGORIES[number])) {
    throw new InventoryProductValidationError(
      `category must be one of: ${PRODUCT_CATEGORIES.join(', ')}`,
    );
  }
  for (const [field, value] of [
    ['standardCost', input.standardCost],
    ['reorderPoint', input.reorderPoint],
    ['reorderQty', input.reorderQty],
  ] as const) {
    if (value == null || fixedUnits(value) < 0n) {
      throw new InventoryProductValidationError(`${field} must be a non-negative number`);
    }
  }
}

export async function createProductWithin(exec: DB, scope: Scope, input: CreateProductInput) {
  validateFields(input, true);
  const [row] = await exec.insert(product).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    sku: input.sku.trim(),
    name: input.name.trim(),
    uom: input.uom.trim(),
    category: input.category,
    standardCost: String(input.standardCost),
    reorderPoint: String(input.reorderPoint),
    reorderQty: String(input.reorderQty),
  }).onConflictDoNothing({
    target: [product.masterFn, product.companyFn, product.sku],
  }).returning({ id: product.id });
  if (!row) {
    throw new InventoryProductConflictError(
      `SKU ${input.sku.trim()} already exists in the active company.`,
    );
  }
  return { id: row.id };
}

export async function updateProductWithin(
  exec: DB,
  scope: Scope,
  productId: number,
  input: UpdateProductInput,
) {
  validateFields(input, false);
  const [existing] = await exec.select({ id: product.id }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    eq(product.id, productId),
  )).for('update');
  if (!existing) {
    throw new InventoryProductConflictError('Product not found in the active company.');
  }
  const [updated] = await exec.update(product).set({
    name: input.name.trim(),
    uom: input.uom.trim(),
    category: input.category,
    standardCost: String(input.standardCost),
    reorderPoint: String(input.reorderPoint),
    reorderQty: String(input.reorderQty),
    version: sql`${product.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    eq(product.id, productId),
  )).returning({ id: product.id, version: product.version });
  return { id: updated.id, version: updated.version };
}
