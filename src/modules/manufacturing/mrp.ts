import Decimal from 'decimal.js';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  mrpRun,
  mrpSuggestion,
  stockLevel,
  workOrder,
  workOrderMaterial,
} from '../../data/schema';

export class MrpRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MrpRunError';
  }
}

export interface RunMrpInput {
  docNo: string;
  planningDate: string;
}

export async function runMrpWithin(tx: DB, scope: Scope, input: RunMrpInput) {
  if (!scope.masterFn || !scope.companyFn) throw new MrpRunError('Tenant scope is required');
  if (
    typeof input.docNo !== 'string'
    || !input.docNo.trim()
    || typeof input.planningDate !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.planningDate)
  ) {
    throw new MrpRunError('docNo and planningDate are required');
  }
  const [run] = await tx.insert(mrpRun).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo: input.docNo.trim(),
    status: 'running',
    planningDate: input.planningDate,
  }).returning({ id: mrpRun.id, docNo: mrpRun.docNo });

  const demandRows = await tx.select({
    productId: workOrderMaterial.productId,
    requiredQty: workOrderMaterial.requiredQty,
    issuedQty: workOrderMaterial.issuedQty,
  }).from(workOrderMaterial)
    .innerJoin(workOrder, and(
      eq(workOrder.id, workOrderMaterial.workOrderId),
      eq(workOrder.masterFn, scope.masterFn),
      eq(workOrder.companyFn, scope.companyFn),
      inArray(workOrder.status, ['planned', 'released', 'in_progress']),
      lte(workOrder.dueDate, input.planningDate),
    ))
    .where(and(
      eq(workOrderMaterial.masterFn, scope.masterFn),
      eq(workOrderMaterial.companyFn, scope.companyFn),
    ));
  const grossByProduct = new Map<number, Decimal>();
  for (const row of demandRows) {
    const remaining = Decimal.max(0, new Decimal(row.requiredQty).minus(row.issuedQty));
    grossByProduct.set(
      row.productId,
      (grossByProduct.get(row.productId) ?? new Decimal(0)).plus(remaining),
    );
  }

  const productIds = [...grossByProduct.keys()];
  let inserted = 0;
  let shortages = 0;
  if (productIds.length) {
    const stockRows = await tx.select({
      productId: stockLevel.productId,
      qty: sql<string>`coalesce(sum(${stockLevel.qty}), 0)`,
    }).from(stockLevel).where(and(
      eq(stockLevel.masterFn, scope.masterFn),
      eq(stockLevel.companyFn, scope.companyFn),
      inArray(stockLevel.productId, productIds),
    )).groupBy(stockLevel.productId);
    const onHandByProduct = new Map(
      stockRows.map((row) => [row.productId, new Decimal(row.qty)]),
    );
    const values = productIds.sort((a, b) => a - b).map((productId) => {
      const gross = grossByProduct.get(productId) ?? new Decimal(0);
      const onHand = onHandByProduct.get(productId) ?? new Decimal(0);
      const onOrder = new Decimal(0); // purchase supply is added when line-level open qty is canonical
      const net = gross.minus(onHand).minus(onOrder);
      const action = net.gt(0) ? 'purchase' : 'sufficient';
      if (action === 'purchase') shortages += 1;
      return {
        masterFn: scope.masterFn,
        companyFn: scope.companyFn,
        mrpRunId: run.id,
        productId,
        grossRequirement: gross.toDecimalPlaces(4).toFixed(4),
        onHand: onHand.toDecimalPlaces(4).toFixed(4),
        onOrder: onOrder.toFixed(4),
        netRequirement: net.toDecimalPlaces(4).toFixed(4),
        action,
        status: 'open',
      };
    });
    await tx.insert(mrpSuggestion).values(values);
    inserted = values.length;
  }
  await tx.update(mrpRun).set({
    status: 'completed',
    completedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(mrpRun.id, run.id));
  return {
    id: run.id,
    docNo: run.docNo,
    status: 'completed' as const,
    suggestionCount: inserted,
    shortageCount: shortages,
  };
}

export function runMrp(db: DB, scope: Scope, input: RunMrpInput) {
  return db.transaction((tx) => runMrpWithin(tx, scope, input));
}
