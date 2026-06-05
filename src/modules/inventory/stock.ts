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

/**
 * Issue stock in ONE transaction:
 *   1. SELECT … FOR UPDATE the stock_level row (serializes concurrent issuers)
 *   2. reject (→ rollback) if insufficient
 *   3. decrement stock_level
 *   4. append a stock_movement (direction='out')
 * Either all of 3–4 commit, or nothing does.
 */
export async function issueStock(db: DB, scope: Scope, args: IssueArgs) {
  return db.transaction(async (tx) => {
    const [level] = await tx
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

    await tx
      .update(stockLevel)
      .set({ qty: sql`${stockLevel.qty} - ${args.qty}`, updatedAt: sql`now()` })
      .where(eq(stockLevel.id, level.id));

    const [mv] = await tx
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
  });
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

export async function setStockQty(db: DB, scope: Scope, productId: number, warehouseId: number, qty: number): Promise<void> {
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
