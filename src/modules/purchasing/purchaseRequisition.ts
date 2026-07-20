// Purchase requisitions — internal purchase requests, upstream of the purchase order
// chain. createPurchaseRequisitionWithin always starts 'submitted' (mirrors
// createServiceTicketWithin's always-starts-open shape); decidePurchaseRequisitionWithin
// mirrors modules/hr/leaveRequest.ts's decide-state-machine shape exactly. Converting an
// approved requisition to a real purchase order is modules/purchasing/
// createPurchaseOrder.ts's job (it accepts an optional requisitionId), not this file's —
// a requisition never creates a PO itself.
import { and, eq, inArray, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  product, purchaseRequisition, purchaseRequisitionLine,
  PURCHASE_REQUISITION_PRIORITIES,
} from '../../data/schema';

export class PurchaseRequisitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PurchaseRequisitionError';
  }
}

export interface PurchaseRequisitionLineInput {
  productId: number;
  qty: number;
  estimatedUnitCost: number;
}
export interface CreatePurchaseRequisitionInput {
  reqNo: string;
  requestedByName: string;
  department: string;
  neededByDate: string; // YYYY-MM-DD
  priority?: string;
  justification?: string | null;
  lines: PurchaseRequisitionLineInput[];
}

export async function createPurchaseRequisitionWithin(
  exec: DB,
  scope: Scope,
  input: CreatePurchaseRequisitionInput,
) {
  if (!input.reqNo?.trim()) throw new PurchaseRequisitionError('reqNo is required');
  if (!input.requestedByName?.trim()) throw new PurchaseRequisitionError('requestedByName is required');
  if (!input.department?.trim()) throw new PurchaseRequisitionError('department is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.neededByDate)) {
    throw new PurchaseRequisitionError('neededByDate must be YYYY-MM-DD');
  }
  const priority = input.priority ?? 'Stock';
  if (!PURCHASE_REQUISITION_PRIORITIES.includes(priority as typeof PURCHASE_REQUISITION_PRIORITIES[number])) {
    throw new PurchaseRequisitionError(`priority must be one of: ${PURCHASE_REQUISITION_PRIORITIES.join(', ')}`);
  }
  if (!input.lines.length) throw new PurchaseRequisitionError('A purchase requisition requires at least one line');

  const productIds = [...new Set(input.lines.map((line) => line.productId))];
  const companyProducts = await exec.select({ id: product.id }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    inArray(product.id, productIds),
  ));
  if (companyProducts.length !== productIds.length) {
    throw new PurchaseRequisitionError('One or more products are not available in this company');
  }

  let estimatedValue = new Decimal(0);
  const preparedLines = input.lines.map((line) => {
    if (!Number.isFinite(line.qty) || line.qty <= 0) {
      throw new PurchaseRequisitionError('Each line qty must be greater than zero');
    }
    if (!Number.isFinite(line.estimatedUnitCost) || line.estimatedUnitCost < 0) {
      throw new PurchaseRequisitionError('Each line estimatedUnitCost must be non-negative');
    }
    const lineValue = new Decimal(line.qty).mul(line.estimatedUnitCost);
    estimatedValue = estimatedValue.plus(lineValue);
    return line;
  });

  const [req] = await exec.insert(purchaseRequisition).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    reqNo: input.reqNo.trim(),
    requestedByName: input.requestedByName.trim(),
    department: input.department.trim(),
    neededByDate: input.neededByDate,
    priority,
    justification: input.justification?.trim() || null,
    status: 'submitted',
    estimatedValue: estimatedValue.toFixed(2),
  }).returning({ id: purchaseRequisition.id, reqNo: purchaseRequisition.reqNo, status: purchaseRequisition.status });

  await exec.insert(purchaseRequisitionLine).values(preparedLines.map((line, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    requisitionId: req.id,
    lineNo: index + 1,
    productId: line.productId,
    qty: String(line.qty),
    estimatedUnitCost: String(line.estimatedUnitCost),
  })));

  return req;
}

export async function decidePurchaseRequisitionWithin(
  exec: DB,
  scope: Scope,
  requisitionId: number,
  decision: 'approved' | 'rejected',
  rejectionReason?: string | null,
) {
  if (decision === 'rejected' && !rejectionReason?.trim()) {
    throw new PurchaseRequisitionError('rejectionReason is required to reject a requisition');
  }
  const [req] = await exec.select().from(purchaseRequisition).where(and(
    eq(purchaseRequisition.masterFn, scope.masterFn),
    eq(purchaseRequisition.companyFn, scope.companyFn),
    eq(purchaseRequisition.id, requisitionId),
  )).for('update');
  if (!req) throw new PurchaseRequisitionError(`Purchase requisition ${requisitionId} not found`);
  if (req.status !== 'submitted') {
    throw new PurchaseRequisitionError(`Requisition ${req.reqNo} is '${req.status}', not 'submitted' — cannot decide it again`);
  }

  const [updated] = await exec.update(purchaseRequisition).set({
    status: decision,
    rejectionReason: decision === 'rejected' ? rejectionReason!.trim() : null,
    decidedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(purchaseRequisition.masterFn, scope.masterFn),
    eq(purchaseRequisition.companyFn, scope.companyFn),
    eq(purchaseRequisition.id, req.id),
  )).returning({
    id: purchaseRequisition.id,
    reqNo: purchaseRequisition.reqNo,
    status: purchaseRequisition.status,
    rejectionReason: purchaseRequisition.rejectionReason,
    decidedAt: purchaseRequisition.decidedAt,
  });
  return updated;
}

export function createPurchaseRequisition(db: DB, scope: Scope, input: CreatePurchaseRequisitionInput) {
  return db.transaction((tx) => createPurchaseRequisitionWithin(tx, scope, input));
}

export function decidePurchaseRequisition(
  db: DB,
  scope: Scope,
  requisitionId: number,
  decision: 'approved' | 'rejected',
  rejectionReason?: string | null,
) {
  return db.transaction((tx) => decidePurchaseRequisitionWithin(tx, scope, requisitionId, decision, rejectionReason));
}
