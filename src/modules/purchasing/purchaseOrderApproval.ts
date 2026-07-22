// Purchase-order approval is the gate between a commercial commitment and an
// executable order. A decision changes only purchase_order and its approval row:
// inventory and GL remain untouched until the existing receive/invoice commands.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  appUser,
  purchaseOrder,
  purchaseOrderApproval,
  userCompany,
} from '../../data/schema';

export class PurchaseOrderApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PurchaseOrderApprovalError';
  }
}

export interface DecidePurchaseOrderInput {
  decision: 'approve' | 'reject';
  note: string;
  actorUserId: number;
}

export async function decidePurchaseOrderWithin(
  exec: DB,
  scope: Scope,
  orderId: number,
  input: DecidePurchaseOrderInput,
  now = new Date(),
) {
  if (!Number.isSafeInteger(input.actorUserId) || input.actorUserId <= 0) {
    throw new PurchaseOrderApprovalError('actorUserId must be a positive integer');
  }
  const note = input.note?.trim();
  if (!note) throw new PurchaseOrderApprovalError('A decision note is required');
  if (note.length > 1000) {
    throw new PurchaseOrderApprovalError('The decision note must not exceed 1000 characters');
  }

  const [actor] = await exec.select({
    userId: appUser.userId,
    fullName: appUser.fullName,
    email: appUser.email,
  }).from(appUser).innerJoin(userCompany, and(
    eq(userCompany.userId, appUser.userId),
    eq(userCompany.companyFn, scope.companyFn),
  )).where(and(
    eq(appUser.userId, input.actorUserId),
    eq(appUser.masterFn, scope.masterFn),
    eq(appUser.isActive, true),
  )).limit(1);
  if (!actor) {
    throw new PurchaseOrderApprovalError('The approving user is not active in this company');
  }

  const [order] = await exec.select({
    id: purchaseOrder.id,
    docNo: purchaseOrder.docNo,
    status: purchaseOrder.status,
  }).from(purchaseOrder).where(and(
    eq(purchaseOrder.masterFn, scope.masterFn),
    eq(purchaseOrder.companyFn, scope.companyFn),
    eq(purchaseOrder.id, orderId),
  )).for('update');
  if (!order) throw new PurchaseOrderApprovalError(`Purchase order ${orderId} not found`);
  if (order.status !== 'pending_approval') {
    throw new PurchaseOrderApprovalError(
      `Purchase order ${order.docNo} is '${order.status}', not 'pending_approval'`,
    );
  }

  const [approval] = await exec.select({
    id: purchaseOrderApproval.id,
    status: purchaseOrderApproval.status,
  }).from(purchaseOrderApproval).where(and(
    eq(purchaseOrderApproval.masterFn, scope.masterFn),
    eq(purchaseOrderApproval.companyFn, scope.companyFn),
    eq(purchaseOrderApproval.orderId, order.id),
  )).for('update');
  if (!approval) {
    throw new PurchaseOrderApprovalError(`Purchase order ${order.docNo} has no approval request`);
  }
  if (approval.status !== 'pending') {
    throw new PurchaseOrderApprovalError(
      `Purchase order ${order.docNo} approval is already '${approval.status}'`,
    );
  }

  const approvalStatus = input.decision === 'approve' ? 'approved' : 'rejected';
  const orderStatus = input.decision === 'approve' ? 'open' : 'rejected';
  const decidedByName = actor.fullName?.trim() || actor.email;

  await exec.update(purchaseOrderApproval).set({
    status: approvalStatus,
    decidedAt: now,
    decidedByUserId: actor.userId,
    decidedByName,
    decisionNote: note,
    version: sql`${purchaseOrderApproval.version} + 1`,
    updatedAt: now,
  }).where(and(
    eq(purchaseOrderApproval.masterFn, scope.masterFn),
    eq(purchaseOrderApproval.companyFn, scope.companyFn),
    eq(purchaseOrderApproval.id, approval.id),
  ));

  const [updatedOrder] = await exec.update(purchaseOrder).set({
    status: orderStatus,
    version: sql`${purchaseOrder.version} + 1`,
    updatedAt: now,
  }).where(and(
    eq(purchaseOrder.masterFn, scope.masterFn),
    eq(purchaseOrder.companyFn, scope.companyFn),
    eq(purchaseOrder.id, order.id),
  )).returning({
    id: purchaseOrder.id,
    docNo: purchaseOrder.docNo,
    status: purchaseOrder.status,
    version: purchaseOrder.version,
  });

  return {
    ...updatedOrder,
    approvalId: approval.id,
    approvalStatus,
    decidedAt: now,
    decidedByUserId: actor.userId,
    decidedByName,
    decisionNote: note,
  };
}

export function decidePurchaseOrder(
  db: DB,
  scope: Scope,
  orderId: number,
  input: DecidePurchaseOrderInput,
) {
  return db.transaction((tx) => decidePurchaseOrderWithin(tx, scope, orderId, input));
}
