// Inventory module: products, warehouses, stock levels, stock movements.
// Every table is tenant-scoped (master_fn + company_fn). See docs/DATA_MODEL.md.
// NOTE: stock_movement is a high-volume table — in PRODUCTION it is range-partitioned by
// moved_at via a separate raw-SQL migration (drizzle-kit does not emit PARTITION BY). The
// PGlite demo uses it as a plain table. See docs/SCALABILITY.md §3.
import {
  pgTable, text, bigint, numeric, timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenant, timestamps } from './_shared';

export const product = pgTable('product', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  uom: text('uom').notNull().default('unit'),   // unit of measure
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_product_sku').on(t.masterFn, t.companyFn, t.sku),
  index('idx_product_name').on(t.masterFn, t.companyFn, t.name),
]);

export const warehouse = pgTable('warehouse', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  code: text('code').notNull(),
  name: text('name').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_warehouse_code').on(t.masterFn, t.companyFn, t.code),
]);

/** Current on-hand quantity per product per warehouse (one row each). */
export const stockLevel = pgTable('stock_level', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull().references(() => warehouse.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_stock_level').on(t.masterFn, t.companyFn, t.productId, t.warehouseId),
]);

/** Append-only ledger of stock in/out. High-volume; partitioned in production. */
export const stockMovement = pgTable('stock_movement', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull().references(() => warehouse.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  direction: text('direction').notNull(),     // 'in' | 'out'
  movedAt: timestamp('moved_at', { withTimezone: true }).notNull().defaultNow(),
  refType: text('ref_type'),                  // e.g. 'sales_order', 'purchase_order'
  refId: bigint('ref_id', { mode: 'number' }),
  ...timestamps,
}, (t) => [
  // Keyset-friendly, tenant-leading (docs/SCALABILITY.md §2).
  index('idx_movement_tenant_moved').on(t.masterFn, t.companyFn, t.movedAt, t.id),
  index('idx_movement_product').on(t.masterFn, t.companyFn, t.productId, t.movedAt),
]);
