// Inventory — stock issue (sales outbound). The first real CROSS-MODULE TRANSACTION:
// deduct stock_level + append stock_movement atomically, with a row lock so concurrent
// issues cannot over-sell. See docs/DATA_MODEL.md §4.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { stockLevel, stockMovement } from '../../data/schema';

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

export interface IssueArgs {
  productId: number;
  warehouseId: number;
  qty: number;
  refType?: string;
  refId?: number;
}

export interface ReceiveArgs extends IssueArgs {}

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

  await exec
    .update(stockLevel)
    .set({ qty: sql`${stockLevel.qty} - ${args.qty}`, updatedAt: sql`now()` })
    .where(eq(stockLevel.id, level.id));

  const [mv] = await exec
    .insert(stockMovement)
    .values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      productId: args.productId,
      warehouseId: args.warehouseId,
      qty: String(args.qty),
      direction: 'out',
      refType: args.refType ?? null,
      refId: args.refId ?? null,
    })
    .returning({ id: stockMovement.id });

  return { movementId: mv.id, remaining: available - args.qty };
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
  const [level] = await exec.insert(stockLevel)
    .values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      productId: args.productId,
      warehouseId: args.warehouseId,
      qty: String(args.qty),
    })
    .onConflictDoUpdate({
      target: [
        stockLevel.masterFn,
        stockLevel.companyFn,
        stockLevel.productId,
        stockLevel.warehouseId,
      ],
      set: { qty: sql`${stockLevel.qty} + ${args.qty}`, updatedAt: sql`now()` },
    })
    .returning({ qty: stockLevel.qty });

  const [mv] = await exec.insert(stockMovement).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    productId: args.productId,
    warehouseId: args.warehouseId,
    qty: String(args.qty),
    direction: 'in',
    refType: args.refType ?? null,
    refId: args.refId ?? null,
  }).returning({ id: stockMovement.id });

  return { movementId: mv.id, remaining: Number(level.qty) };
}

/** Standalone stock issue — owns its transaction boundary. Wraps {@link issueStockWithin}. */
export async function issueStock(db: DB, scope: Scope, args: IssueArgs) {
  return db.transaction((tx) => issueStockWithin(tx, scope, args));
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
  await db
    .update(stockLevel)
    .set({ qty: String(qty), updatedAt: sql`now()` })
    .where(and(
      eq(stockLevel.masterFn, scope.masterFn),
      eq(stockLevel.companyFn, scope.companyFn),
      eq(stockLevel.productId, productId),
      eq(stockLevel.warehouseId, warehouseId),
    ));
}
