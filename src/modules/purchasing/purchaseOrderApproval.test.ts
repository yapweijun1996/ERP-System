import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  appUser,
  company,
  currency,
  glEntry,
  master,
  product,
  purchaseOrder,
  purchaseOrderApproval,
  role,
  stockMovement,
  supplier,
  taxRule,
  userCompany,
  warehouse,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createPurchaseOrder } from './createPurchaseOrder';
import {
  decidePurchaseOrder,
  PurchaseOrderApprovalError,
} from './purchaseOrderApproval';
import { receiveGoods } from './receiveGoods';

async function seedFixture(db: DB) {
  await db.insert(master).values({ masterFn: SCOPE.masterFn, name: 'Test Master' });
  await db.insert(currency).values({ code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' });
  await db.insert(company).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    name: 'Test Company',
    country: 'SG',
    currency: 'SGD',
    taxRegime: 'GST',
  });
  const [approver] = await db.insert(appUser).values({
    masterFn: SCOPE.masterFn,
    email: 'approver@example.test',
    fullName: 'Fictional Approver',
    passwordHash: 'test-only-hash',
  }).returning({ id: appUser.userId });
  const [approverRole] = await db.insert(role).values({
    masterFn: SCOPE.masterFn,
    name: 'Approver',
  }).returning({ id: role.roleId });
  await db.insert(userCompany).values({
    userId: approver.id,
    companyFn: SCOPE.companyFn,
    roleId: approverRole.id,
  });
  const [widget] = await db.insert(product).values({
    ...SCOPE, sku: 'APPROVAL-WIDGET', name: 'Approval Widget', uom: 'unit',
  }).returning({ id: product.id });
  const [vendor] = await db.insert(supplier).values({
    ...SCOPE, code: 'APPROVAL-SUP', name: 'Approval Supplier',
  }).returning({ id: supplier.id });
  const [mainWarehouse] = await db.insert(warehouse).values({
    ...SCOPE, code: 'APPROVAL-WH', name: 'Approval Warehouse',
  }).returning({ id: warehouse.id });
  await db.insert(taxRule).values({
    ...SCOPE,
    taxRegime: 'GST', taxCode: 'SR', rate: '9.000', validFrom: '2024-01-01',
  });
  return {
    approverId: approver.id,
    approverRoleId: approverRole.id,
    productId: widget.id,
    supplierId: vendor.id,
    warehouseId: mainWarehouse.id,
  };
}

async function createPendingOrder(db: DB, fixture: Awaited<ReturnType<typeof seedFixture>>, docNo: string) {
  return createPurchaseOrder(db, SCOPE, {
    docNo,
    supplierId: fixture.supplierId,
    orderDate: '2024-06-01',
    currency: 'SGD',
    lines: [{ productId: fixture.productId, qty: 4, unitCost: '12.50', taxCode: 'SR' }],
  });
}

describe('purchase order approval', () => {
  it('creates every new PO pending and approval has no stock or GL effect', async () => {
    const db = await freshDb();
    const fixture = await seedFixture(db);
    const created = await createPendingOrder(db, fixture, 'PO-APP-1');

    expect(created).toMatchObject({ status: 'pending_approval', total: 54.5 });
    const [order] = await db.select().from(purchaseOrder).where(eq(purchaseOrder.id, created.orderId));
    const [approval] = await db.select().from(purchaseOrderApproval)
      .where(eq(purchaseOrderApproval.orderId, created.orderId));
    expect(order).toMatchObject({ status: 'pending_approval', version: 1 });
    expect(approval).toMatchObject({ status: 'pending', version: 1 });
    expect(await db.select().from(stockMovement)).toHaveLength(0);
    expect(await db.select().from(glEntry)).toHaveLength(0);

    await expect(receiveGoods(db, SCOPE, {
      purchaseOrderId: created.orderId,
      warehouseId: fixture.warehouseId,
      docNo: 'GR-BLOCKED',
      receivedDate: '2024-06-02',
    })).rejects.toThrow("not 'open'");
    expect(await db.select().from(stockMovement)).toHaveLength(0);
  });

  it('approves atomically with actor snapshot, then allows receipt', async () => {
    const db = await freshDb();
    const fixture = await seedFixture(db);
    const created = await createPendingOrder(db, fixture, 'PO-APP-2');
    const decision = await decidePurchaseOrder(
      db,
      SCOPE,
      created.orderId,
      { decision: 'approve', note: 'Required for the July production plan.', actorUserId: fixture.approverId },
    );
    expect(decision).toMatchObject({
      status: 'open',
      version: 2,
      approvalStatus: 'approved',
      decidedByName: 'Fictional Approver',
      decisionNote: 'Required for the July production plan.',
    });
    expect(decision.decidedAt).toBeInstanceOf(Date);
    expect(await db.select().from(stockMovement)).toHaveLength(0);
    expect(await db.select().from(glEntry)).toHaveLength(0);

    await receiveGoods(db, SCOPE, {
      purchaseOrderId: created.orderId,
      warehouseId: fixture.warehouseId,
      docNo: 'GR-APPROVED',
      receivedDate: '2024-06-03',
    });
    const [received] = await db.select({ status: purchaseOrder.status }).from(purchaseOrder)
      .where(eq(purchaseOrder.id, created.orderId));
    expect(received.status).toBe('received');
    expect(await db.select().from(stockMovement)).toHaveLength(1);
  });

  it('rejects with a reason and blocks any repeat decision or receipt', async () => {
    const db = await freshDb();
    const fixture = await seedFixture(db);
    const created = await createPendingOrder(db, fixture, 'PO-APP-3');

    await decidePurchaseOrder(db, SCOPE, created.orderId, {
      decision: 'reject',
      note: 'Supplier lead time does not meet the requirement.',
      actorUserId: fixture.approverId,
    });
    const [order] = await db.select().from(purchaseOrder).where(eq(purchaseOrder.id, created.orderId));
    const [approval] = await db.select().from(purchaseOrderApproval)
      .where(eq(purchaseOrderApproval.orderId, created.orderId));
    expect(order).toMatchObject({ status: 'rejected', version: 2 });
    expect(approval).toMatchObject({
      status: 'rejected',
      version: 2,
      decisionNote: 'Supplier lead time does not meet the requirement.',
    });
    await expect(decidePurchaseOrder(db, SCOPE, created.orderId, {
      decision: 'approve', note: 'Changed my mind.', actorUserId: fixture.approverId,
    })).rejects.toThrow(PurchaseOrderApprovalError);
    await expect(receiveGoods(db, SCOPE, {
      purchaseOrderId: created.orderId,
      warehouseId: fixture.warehouseId,
      docNo: 'GR-REJECTED',
      receivedDate: '2024-06-03',
    })).rejects.toThrow("not 'open'");
  });

  it('requires a note and an active actor assigned to the company without partial updates', async () => {
    const db = await freshDb();
    const fixture = await seedFixture(db);
    const created = await createPendingOrder(db, fixture, 'PO-APP-4');

    await expect(decidePurchaseOrder(db, SCOPE, created.orderId, {
      decision: 'approve', note: '   ', actorUserId: fixture.approverId,
    })).rejects.toThrow('decision note is required');
    await expect(decidePurchaseOrder(db, SCOPE, created.orderId, {
      decision: 'approve', note: 'Looks correct.', actorUserId: 999999,
    })).rejects.toThrow('not active in this company');
    await db.insert(company).values({
      masterFn: SCOPE.masterFn,
      companyFn: 'OTHER-C',
      name: 'Other Test Company',
      country: 'SG',
      currency: 'SGD',
      taxRegime: 'GST',
    });
    await db.insert(userCompany).values({
      userId: fixture.approverId,
      companyFn: 'OTHER-C',
      roleId: fixture.approverRoleId,
    });
    await expect(decidePurchaseOrder(db, { ...SCOPE, companyFn: 'OTHER-C' }, created.orderId, {
      decision: 'approve', note: 'Cross-company attempt.', actorUserId: fixture.approverId,
    })).rejects.toThrow('not found');

    const [order] = await db.select({ status: purchaseOrder.status }).from(purchaseOrder)
      .where(and(
        eq(purchaseOrder.masterFn, SCOPE.masterFn),
        eq(purchaseOrder.companyFn, SCOPE.companyFn),
        eq(purchaseOrder.id, created.orderId),
      ));
    const [approval] = await db.select({ status: purchaseOrderApproval.status })
      .from(purchaseOrderApproval).where(eq(purchaseOrderApproval.orderId, created.orderId));
    expect(order.status).toBe('pending_approval');
    expect(approval.status).toBe('pending');
  });
});
