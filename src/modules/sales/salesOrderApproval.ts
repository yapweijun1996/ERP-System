// Sales-order approval is a stock/GL-neutral gate. A positive decision releases
// an order to `draft`; the existing confirmation command is still required to
// issue stock, deliver, invoice and post accounting entries.
import { and, eq, sql } from 'drizzle-orm';
import { authorizeWithin } from '../../auth/authorization';
import { PERMISSIONS } from '../../auth/permissionKeys';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  appUser,
  salesOrder,
  salesOrderApproval,
  userCompany,
} from '../../data/schema';

export class SalesOrderApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalesOrderApprovalError';
  }
}

export interface DecideSalesOrderInput {
  decision: 'approve' | 'reject';
  note: string;
  actorUserId: number;
}

export async function decideSalesOrderWithin(
  exec: DB,
  scope: Scope,
  orderId: number,
  input: DecideSalesOrderInput,
  now = new Date(),
) {
  if (!Number.isSafeInteger(input.actorUserId) || input.actorUserId <= 0) {
    throw new SalesOrderApprovalError('actorUserId must be a positive integer.');
  }
  const note = input.note?.trim();
  if (!note) throw new SalesOrderApprovalError('A decision note is required.');
  if (note.length > 1000) {
    throw new SalesOrderApprovalError('The decision note must not exceed 1000 characters.');
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
    throw new SalesOrderApprovalError('The approving user is not active in this company.');
  }

  const authorization = await authorizeWithin(
    exec,
    { userId: actor.userId, masterFn: scope.masterFn, companyFn: scope.companyFn },
    PERMISSIONS.salesApprove,
    { resourceKey: 'sales/orders', requireScope: false, now },
  );
  if (!authorization.allowed) {
    throw new SalesOrderApprovalError(
      'The actor is not authorized to decide this active sales order approval.',
    );
  }

  const [order] = await exec.select({
    id: salesOrder.id,
    docNo: salesOrder.docNo,
    status: salesOrder.status,
  }).from(salesOrder).where(and(
    eq(salesOrder.masterFn, scope.masterFn),
    eq(salesOrder.companyFn, scope.companyFn),
    eq(salesOrder.id, orderId),
  )).for('update');
  if (!order) throw new SalesOrderApprovalError(`Sales order ${orderId} not found.`);
  if (order.status !== 'pending_approval') {
    throw new SalesOrderApprovalError(
      `Sales order ${order.docNo} is '${order.status}', not 'pending_approval'.`,
    );
  }

  const [approval] = await exec.select({
    id: salesOrderApproval.id,
    status: salesOrderApproval.status,
  }).from(salesOrderApproval).where(and(
    eq(salesOrderApproval.masterFn, scope.masterFn),
    eq(salesOrderApproval.companyFn, scope.companyFn),
    eq(salesOrderApproval.orderId, order.id),
  )).for('update');
  if (!approval) {
    throw new SalesOrderApprovalError(`Sales order ${order.docNo} has no approval request.`);
  }
  if (approval.status !== 'pending') {
    throw new SalesOrderApprovalError(
      `Sales order ${order.docNo} approval is already '${approval.status}'.`,
    );
  }

  const approvalStatus = input.decision === 'approve' ? 'approved' : 'rejected';
  const orderStatus = input.decision === 'approve' ? 'draft' : 'rejected';
  const decidedByName = actor.fullName?.trim() || actor.email;

  await exec.update(salesOrderApproval).set({
    status: approvalStatus,
    decidedAt: now,
    decidedByUserId: actor.userId,
    decidedByName,
    decisionNote: note,
    version: sql`${salesOrderApproval.version} + 1`,
    updatedAt: now,
  }).where(and(
    eq(salesOrderApproval.masterFn, scope.masterFn),
    eq(salesOrderApproval.companyFn, scope.companyFn),
    eq(salesOrderApproval.id, approval.id),
  ));

  const [updatedOrder] = await exec.update(salesOrder).set({
    status: orderStatus,
    version: sql`${salesOrder.version} + 1`,
    updatedAt: now,
  }).where(and(
    eq(salesOrder.masterFn, scope.masterFn),
    eq(salesOrder.companyFn, scope.companyFn),
    eq(salesOrder.id, order.id),
  )).returning({
    id: salesOrder.id,
    docNo: salesOrder.docNo,
    status: salesOrder.status,
    version: salesOrder.version,
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

export function decideSalesOrder(
  db: DB,
  scope: Scope,
  orderId: number,
  input: DecideSalesOrderInput,
) {
  return db.transaction((tx) => decideSalesOrderWithin(tx, scope, orderId, input));
}
