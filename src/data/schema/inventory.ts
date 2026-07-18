// Inventory module: products, warehouses, stock levels, stock movements.
// Every table is tenant-scoped (master_fn + company_fn). See docs/DATA_MODEL.md.
// NOTE: stock_movement is a high-volume table — in PRODUCTION it is range-partitioned by
// moved_at via a separate raw-SQL migration (drizzle-kit does not emit PARTITION BY). The
// PGlite demo uses it as a plain table. See docs/SCALABILITY.md §3.
import {
  pgTable, text, bigint, integer, numeric, date, timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenant, timestamps } from './_shared';

export const product = pgTable('product', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  uom: text('uom').notNull().default('unit'),   // unit of measure
  standardCost: numeric('standard_cost', { precision: 18, scale: 4 }).notNull().default('0'),
  trackingType: text('tracking_type').notNull().default('none'), // none | lot | serial
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

export const inventoryAdjustment = pgTable('inventory_adjustment', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  status: text('status').notNull().default('draft'), // draft | posted | cancelled
  version: integer('version').notNull().default(1),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull().references(() => warehouse.id),
  adjustmentDate: date('adjustment_date').notNull(),
  reason: text('reason').notNull(),
  reference: text('reference'),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_inventory_adjustment_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_inventory_adjustment_date').on(t.masterFn, t.companyFn, t.adjustmentDate, t.id),
]);

export const inventoryAdjustmentLine = pgTable('inventory_adjustment_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  adjustmentId: bigint('adjustment_id', { mode: 'number' }).notNull()
    .references(() => inventoryAdjustment.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  systemQty: numeric('system_qty', { precision: 18, scale: 4 }).notNull(),
  countedQty: numeric('counted_qty', { precision: 18, scale: 4 }).notNull(),
  varianceQty: numeric('variance_qty', { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  valueImpact: numeric('value_impact', { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_inventory_adjustment_line').on(
    t.masterFn, t.companyFn, t.adjustmentId, t.lineNo,
  ),
  index('idx_inventory_adjustment_line_product').on(
    t.masterFn, t.companyFn, t.productId, t.adjustmentId,
  ),
]);

export const stockTransfer = pgTable('stock_transfer', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  status: text('status').notNull().default('draft'), // draft | completed | cancelled
  version: integer('version').notNull().default(1),
  fromWarehouseId: bigint('from_warehouse_id', { mode: 'number' }).notNull()
    .references(() => warehouse.id),
  toWarehouseId: bigint('to_warehouse_id', { mode: 'number' }).notNull()
    .references(() => warehouse.id),
  transferDate: date('transfer_date').notNull(),
  reference: text('reference'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_stock_transfer_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_stock_transfer_date').on(t.masterFn, t.companyFn, t.transferDate, t.id),
]);

export const stockTransferLine = pgTable('stock_transfer_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  transferId: bigint('transfer_id', { mode: 'number' }).notNull().references(() => stockTransfer.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_stock_transfer_line').on(t.masterFn, t.companyFn, t.transferId, t.lineNo),
  index('idx_stock_transfer_line_product').on(t.masterFn, t.companyFn, t.productId, t.transferId),
]);
