// Inventory module: products, warehouses, stock levels, stock movements.
// Every table is tenant-scoped (master_fn + company_fn). See docs/DATA_MODEL.md.
// NOTE: stock_movement is a high-volume table — in PRODUCTION it is range-partitioned by
// moved_at via a separate raw-SQL migration (drizzle-kit does not emit PARTITION BY). The
// PGlite demo uses it as a plain table. See docs/SCALABILITY.md §3.
import {
  pgTable, text, bigint, integer, numeric, date, timestamp, boolean,
  index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';

// Item master category — fixed list matches the Item Master screen's own options
// (web/public/assets/screens-inv.js's CATS const); kept as a checked enum rather
// than a free-text field for the same reason trackingType/status are, elsewhere.
export const PRODUCT_CATEGORIES = [
  'Components', 'Raw Materials', 'Finished Goods', 'Consumables', 'Packaging',
] as const;

export const product = pgTable('product', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  uom: text('uom').notNull().default('unit'),   // unit of measure
  category: text('category').notNull().default('Components'),
  standardCost: numeric('standard_cost', { precision: 18, scale: 4 }).notNull().default('0'),
  reorderPoint: numeric('reorder_point', { precision: 18, scale: 4 }).notNull().default('0'),
  reorderQty: numeric('reorder_qty', { precision: 18, scale: 4 }).notNull().default('0'),
  trackingType: text('tracking_type').notNull().default('none'), // none | lot | serial
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_product_sku').on(t.masterFn, t.companyFn, t.sku),
  index('idx_product_name').on(t.masterFn, t.companyFn, t.name),
  check('ck_product_tracking_type', sql`${t.trackingType} in ('none', 'lot', 'serial')`),
  check(
    'ck_product_category',
    sql`${t.category} in ('Components', 'Raw Materials', 'Finished Goods', 'Consumables', 'Packaging')`,
  ),
  check('ck_product_reorder_nonnegative', sql`${t.reorderPoint} >= 0 and ${t.reorderQty} >= 0`),
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

export const warehouseBin = pgTable('warehouse_bin', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull().references(() => warehouse.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_warehouse_bin_code').on(t.masterFn, t.companyFn, t.warehouseId, t.code),
  index('idx_warehouse_bin_active').on(t.masterFn, t.companyFn, t.warehouseId, t.isActive),
]);

export const inventoryLot = pgTable('inventory_lot', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  lotNo: text('lot_no').notNull(),
  manufacturedDate: date('manufactured_date'),
  expiryDate: date('expiry_date'),
  qualityStatus: text('quality_status').notNull().default('released'), // released | hold | rejected
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_inventory_lot_no').on(t.masterFn, t.companyFn, t.productId, t.lotNo),
  index('idx_inventory_lot_expiry').on(t.masterFn, t.companyFn, t.productId, t.expiryDate),
  check('ck_inventory_lot_quality', sql`${t.qualityStatus} in ('released', 'hold', 'rejected')`),
]);

export const inventorySerial = pgTable('inventory_serial', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  serialNo: text('serial_no').notNull(),
  lotId: bigint('lot_id', { mode: 'number' }).references(() => inventoryLot.id),
  status: text('status').notNull().default('registered'), // registered | available | issued | scrapped
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_inventory_serial_no').on(t.masterFn, t.companyFn, t.productId, t.serialNo),
  index('idx_inventory_serial_status').on(t.masterFn, t.companyFn, t.productId, t.status),
  check('ck_inventory_serial_status', sql`${t.status} in ('registered', 'available', 'issued', 'scrapped')`),
]);

/**
 * Bin/lot/serial-level projection. tracking_key is deterministic:
 * `none`, `lot:<id>` or `serial:<id>` and makes the uniqueness rule portable
 * across PostgreSQL and PGlite without nullable-unique ambiguity.
 */
export const stockLocationBalance = pgTable('stock_location_balance', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull().references(() => warehouse.id),
  binId: bigint('bin_id', { mode: 'number' }).notNull().references(() => warehouseBin.id),
  trackingKey: text('tracking_key').notNull().default('none'),
  lotId: bigint('lot_id', { mode: 'number' }).references(() => inventoryLot.id),
  serialId: bigint('serial_id', { mode: 'number' }).references(() => inventorySerial.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull().default('0'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_stock_location_balance').on(
    t.masterFn, t.companyFn, t.productId, t.warehouseId, t.binId, t.trackingKey,
  ),
  index('idx_stock_location_tracking').on(
    t.masterFn, t.companyFn, t.productId, t.trackingKey, t.warehouseId,
  ),
  check('ck_stock_location_nonnegative', sql`${t.qty} >= 0`),
  check('ck_stock_location_tracking', sql`
    (${t.trackingKey} = 'none' and ${t.lotId} is null and ${t.serialId} is null)
    or (${t.trackingKey} like 'lot:%' and ${t.lotId} is not null and ${t.serialId} is null)
    or (${t.trackingKey} like 'serial:%' and ${t.serialId} is not null)
  `),
  check('ck_stock_location_serial_qty', sql`${t.serialId} is null or ${t.qty} in (0, 1)`),
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
  binId: bigint('bin_id', { mode: 'number' }).references(() => warehouseBin.id),
  lotId: bigint('lot_id', { mode: 'number' }).references(() => inventoryLot.id),
  serialId: bigint('serial_id', { mode: 'number' }).references(() => inventorySerial.id),
  movementGroup: text('movement_group'),
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
  check('ck_stock_movement_direction', sql`${t.direction} in ('in', 'out')`),
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

export const warehousePick = pgTable('warehouse_pick', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  docNo: text('doc_no').notNull(),
  status: text('status').notNull().default('open'), // open | in_progress | picked | cancelled
  version: integer('version').notNull().default(1),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull().references(() => warehouse.id),
  salesOrderId: bigint('sales_order_id', { mode: 'number' }),
  priority: text('priority').notNull().default('normal'),
  assignee: text('assignee'),
  pickDate: date('pick_date').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_warehouse_pick_docno').on(t.masterFn, t.companyFn, t.docNo),
  index('idx_warehouse_pick_status').on(t.masterFn, t.companyFn, t.status, t.pickDate, t.id),
  check('ck_warehouse_pick_status', sql`${t.status} in ('open', 'in_progress', 'picked', 'cancelled')`),
]);

export const warehousePickLine = pgTable('warehouse_pick_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  pickId: bigint('pick_id', { mode: 'number' }).notNull().references(() => warehousePick.id),
  lineNo: integer('line_no').notNull(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  binId: bigint('bin_id', { mode: 'number' }).notNull().references(() => warehouseBin.id),
  requiredQty: numeric('required_qty', { precision: 18, scale: 4 }).notNull(),
  pickedQty: numeric('picked_qty', { precision: 18, scale: 4 }).notNull().default('0'),
  uom: text('uom').notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_warehouse_pick_line').on(t.masterFn, t.companyFn, t.pickId, t.lineNo),
  index('idx_warehouse_pick_line_product').on(t.masterFn, t.companyFn, t.productId, t.pickId),
  check('ck_warehouse_pick_line_qty', sql`${t.requiredQty} > 0 and ${t.pickedQty} >= 0 and ${t.pickedQty} <= ${t.requiredQty}`),
]);

export const stockReservation = pgTable('stock_reservation', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  pickId: bigint('pick_id', { mode: 'number' }).notNull().references(() => warehousePick.id),
  pickLineId: bigint('pick_line_id', { mode: 'number' }).notNull().references(() => warehousePickLine.id),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => product.id),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull().references(() => warehouse.id),
  binId: bigint('bin_id', { mode: 'number' }).notNull().references(() => warehouseBin.id),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  status: text('status').notNull().default('active'), // active | consumed | released
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_stock_reservation_pick_line').on(t.masterFn, t.companyFn, t.pickLineId),
  index('idx_stock_reservation_active').on(
    t.masterFn, t.companyFn, t.productId, t.warehouseId, t.status,
  ),
  check('ck_stock_reservation_qty', sql`${t.qty} > 0`),
  check('ck_stock_reservation_status', sql`${t.status} in ('active', 'consumed', 'released')`),
]);
