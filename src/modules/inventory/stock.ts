// Inventory — stock issue (sales outbound). The first real CROSS-MODULE TRANSACTION:
// deduct stock_level + append stock_movement atomically, with a row lock so concurrent
// issues cannot over-sell. See docs/DATA_MODEL.md §4.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { stockLevel, stockLocationBalance, stockMovement } from '../../data/schema';
import {
  ensureDefaultBinWithin,
  resolveTrackingWithin,
  setSerialMovementStatus,
  type TrackingSelection,
} from './tracking';

/** Thrown (and rolls the transaction back) when on-hand qty < requested. */
export class InsufficientStockError extends Error {
  constructor(
    public readonly productId: number,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(`Insufficient stock for product ${productId}: have ${available}, need ${requested}`);
    this.name = 'InsufficientStockError';
  }
}

export interface IssueArgs extends TrackingSelection {
  productId: number;
  warehouseId: number;
  qty: number;
  refType?: string;
  refId?: number;
  movementGroup?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- deliberate semantic rename, not a stub: same shape as IssueArgs but reads correctly at receive-goods call sites
export interface ReceiveArgs extends IssueArgs {}

async function seedLegacyUntrackedLocation(
  exec: DB,
  scope: Scope,
  args: { productId: number; warehouseId: number; binId: number; aggregateQty: number },
) {
  const [existing] = await exec.select({ id: stockLocationBalance.id })
    .from(stockLocationBalance)
    .where(and(
      eq(stockLocationBalance.masterFn, scope.masterFn),
      eq(stockLocationBalance.companyFn, scope.companyFn),
      eq(stockLocationBalance.productId, args.productId),
      eq(stockLocationBalance.warehouseId, args.warehouseId),
    ))
    .limit(1);
  if (!existing && args.aggregateQty > 0) {
    await exec.insert(stockLocationBalance).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      productId: args.productId,
      warehouseId: args.warehouseId,
      binId: args.binId,
      trackingKey: 'none',
      qty: String(args.aggregateQty),
    }).onConflictDoNothing();
  }
}

/**
 * Core stock-issue operation, run on a caller-supplied execution context (`exec` may be a
 * db OR a transaction handle — PgTransaction extends PgDatabase, so both satisfy `DB`).
 * This is the composable unit: callers choose the transaction boundary.
 *   1. SELECT … FOR UPDATE the stock_level row (serializes concurrent issuers)
 *   2. reject (→ rollback) if insufficient
 *   3. decrement stock_level
 *   4. append a stock_movement (direction='out')
 * MUST be called inside a transaction (so a failure rolls the whole unit of work back).
 */
export async function issueStockWithin(exec: DB, scope: Scope, args: IssueArgs) {
  if (!Number.isFinite(args.qty) || args.qty <= 0) {
    throw new RangeError('Stock issue quantity must be greater than zero');
  }
  const [level] = await exec
    .select({ id: stockLevel.id, qty: stockLevel.qty })
    .from(stockLevel)
    .where(and(
      eq(stockLevel.masterFn, scope.masterFn),
      eq(stockLevel.companyFn, scope.companyFn),
      eq(stockLevel.productId, args.productId),
      eq(stockLevel.warehouseId, args.warehouseId),
    ))
    .for('update'); // ← row lock: a concurrent issuer waits here until we commit

  const available = level ? Number(level.qty) : 0;
  if (!level || available < args.qty) {
    throw new InsufficientStockError(args.productId, available, args.qty); // → ROLLBACK
  }
  const tracking = await resolveTrackingWithin(exec, scope, {
    ...args,
    direction: 'out',
  });
  if (tracking.trackingType === 'none') {
    await seedLegacyUntrackedLocation(exec, scope, {
      productId: args.productId,
      warehouseId: args.warehouseId,
      binId: tracking.binId,
      aggregateQty: available,
    });
  }
  const [location] = await exec.select({
    id: stockLocationBalance.id,
    qty: stockLocationBalance.qty,
  }).from(stockLocationBalance).where(and(
    eq(stockLocationBalance.masterFn, scope.masterFn),
    eq(stockLocationBalance.companyFn, scope.companyFn),
    eq(stockLocationBalance.productId, args.productId),
    eq(stockLocationBalance.warehouseId, args.warehouseId),
    eq(stockLocationBalance.binId, tracking.binId),
    eq(stockLocationBalance.trackingKey, tracking.trackingKey),
  )).for('update');
  const locationAvailable = location ? Number(location.qty) : 0;
  if (!location || locationAvailable < args.qty) {
    throw new InsufficientStockError(args.productId, locationAvailable, args.qty);
  }

  await exec
    .update(stockLevel)
    .set({ qty: sql`${stockLevel.qty} - ${args.qty}`, updatedAt: sql`now()` })
    .where(eq(stockLevel.id, level.id));
  await exec.update(stockLocationBalance).set({
    qty: sql`${stockLocationBalance.qty} - ${args.qty}`,
    updatedAt: sql`now()`,
  }).where(eq(stockLocationBalance.id, location.id));

  const [mv] = await exec
    .insert(stockMovement)
    .values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      productId: args.productId,
      warehouseId: args.warehouseId,
      binId: tracking.binId,
      lotId: tracking.lotId,
      serialId: tracking.serialId,
      movementGroup: args.movementGroup ?? null,
      qty: String(args.qty),
      direction: 'out',
      refType: args.refType ?? null,
      refId: args.refId ?? null,
    })
    .returning({ id: stockMovement.id });
  await setSerialMovementStatus(exec, tracking.serialId, 'out');

  return {
    movementId: mv.id,
    remaining: available - args.qty,
    locationRemaining: locationAvailable - args.qty,
  };
}

/**
 * Increase stock and append the corresponding inbound movement. This is the
 * only production path for raising the stock projection; callers supply the
 * surrounding business transaction.
 */
export async function receiveStockWithin(exec: DB, scope: Scope, args: ReceiveArgs) {
  if (!Number.isFinite(args.qty) || args.qty <= 0) {
    throw new RangeError('Stock receipt quantity must be greater than zero');
  }
  await exec.insert(stockLevel)
    .values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      productId: args.productId,
      warehouseId: args.warehouseId,
      qty: '0',
    })
    .onConflictDoNothing();
  const [current] = await exec.select({ id: stockLevel.id, qty: stockLevel.qty })
    .from(stockLevel)
    .where(and(
      eq(stockLevel.masterFn, scope.masterFn),
      eq(stockLevel.companyFn, scope.companyFn),
      eq(stockLevel.productId, args.productId),
      eq(stockLevel.warehouseId, args.warehouseId),
    ))
    .for('update');
  if (!current) throw new Error('Stock projection could not be initialized');
  const tracking = await resolveTrackingWithin(exec, scope, {
    ...args,
    direction: 'in',
  });
  if (tracking.trackingType === 'none') {
    await seedLegacyUntrackedLocation(exec, scope, {
      productId: args.productId,
      warehouseId: args.warehouseId,
      binId: tracking.binId,
      aggregateQty: Number(current.qty),
    });
  }
  await exec.update(stockLevel).set({
    qty: sql`${stockLevel.qty} + ${args.qty}`,
    updatedAt: sql`now()`,
  }).where(eq(stockLevel.id, current.id));
  const [location] = await exec.insert(stockLocationBalance).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    productId: args.productId,
    warehouseId: args.warehouseId,
    binId: tracking.binId,
    trackingKey: tracking.trackingKey,
    lotId: tracking.lotId,
    serialId: tracking.serialId,
    qty: String(args.qty),
  }).onConflictDoUpdate({
    target: [
      stockLocationBalance.masterFn,
      stockLocationBalance.companyFn,
      stockLocationBalance.productId,
      stockLocationBalance.warehouseId,
      stockLocationBalance.binId,
      stockLocationBalance.trackingKey,
    ],
    set: {
      qty: sql`${stockLocationBalance.qty} + ${args.qty}`,
      updatedAt: sql`now()`,
    },
  }).returning({ qty: stockLocationBalance.qty });

  const [mv] = await exec.insert(stockMovement).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    productId: args.productId,
    warehouseId: args.warehouseId,
    binId: tracking.binId,
    lotId: tracking.lotId,
    serialId: tracking.serialId,
    movementGroup: args.movementGroup ?? null,
    qty: String(args.qty),
    direction: 'in',
    refType: args.refType ?? null,
    refId: args.refId ?? null,
  }).returning({ id: stockMovement.id });
  await setSerialMovementStatus(exec, tracking.serialId, 'in');

  return {
    movementId: mv.id,
    remaining: Number(current.qty) + args.qty,
    locationRemaining: Number(location.qty),
  };
}

/** Standalone stock issue — owns its transaction boundary. Wraps {@link issueStockWithin}. */
export async function issueStock(db: DB, scope: Scope, args: IssueArgs) {
  return db.transaction((tx) => issueStockWithin(tx, scope, args));
}

export async function receiveStock(db: DB, scope: Scope, args: ReceiveArgs) {
  return db.transaction((tx) => receiveStockWithin(tx, scope, args));
}

// --- small read helpers used by the demo / callers ---

export async function getStockQty(db: DB, scope: Scope, productId: number, warehouseId: number): Promise<number> {
  const [r] = await db
    .select({ qty: stockLevel.qty })
    .from(stockLevel)
    .where(and(
      eq(stockLevel.masterFn, scope.masterFn),
      eq(stockLevel.companyFn, scope.companyFn),
      eq(stockLevel.productId, productId),
      eq(stockLevel.warehouseId, warehouseId),
    ));
  return r ? Number(r.qty) : 0;
}

export async function countMovements(db: DB, scope: Scope, productId: number, warehouseId: number): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(stockMovement)
    .where(and(
      eq(stockMovement.masterFn, scope.masterFn),
      eq(stockMovement.companyFn, scope.companyFn),
      eq(stockMovement.productId, productId),
      eq(stockMovement.warehouseId, warehouseId),
    ));
  return r?.n ?? 0;
}

export async function getStockLocationQty(
  db: DB,
  scope: Scope,
  productId: number,
  warehouseId: number,
  binId: number,
  trackingKey = 'none',
): Promise<number> {
  const [row] = await db.select({ qty: stockLocationBalance.qty })
    .from(stockLocationBalance)
    .where(and(
      eq(stockLocationBalance.masterFn, scope.masterFn),
      eq(stockLocationBalance.companyFn, scope.companyFn),
      eq(stockLocationBalance.productId, productId),
      eq(stockLocationBalance.warehouseId, warehouseId),
      eq(stockLocationBalance.binId, binId),
      eq(stockLocationBalance.trackingKey, trackingKey),
    ));
  return row ? Number(row.qty) : 0;
}

/**
 * Test/demo fixture escape hatch only. Production commands must append
 * stock_movement through issueStockWithin/receiveStockWithin.
 */
export async function setStockQtyForFixture(
  db: DB,
  scope: Scope,
  productId: number,
  warehouseId: number,
  qty: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const binId = await ensureDefaultBinWithin(tx, scope, warehouseId);
    await tx.update(stockLevel)
      .set({ qty: String(qty), updatedAt: sql`now()` })
      .where(and(
        eq(stockLevel.masterFn, scope.masterFn),
        eq(stockLevel.companyFn, scope.companyFn),
        eq(stockLevel.productId, productId),
        eq(stockLevel.warehouseId, warehouseId),
      ));
    await tx.insert(stockLocationBalance).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      productId,
      warehouseId,
      binId,
      trackingKey: 'none',
      qty: String(qty),
    }).onConflictDoUpdate({
      target: [
        stockLocationBalance.masterFn,
        stockLocationBalance.companyFn,
        stockLocationBalance.productId,
        stockLocationBalance.warehouseId,
        stockLocationBalance.binId,
        stockLocationBalance.trackingKey,
      ],
      set: { qty: String(qty), updatedAt: sql`now()` },
    });
  });
}
