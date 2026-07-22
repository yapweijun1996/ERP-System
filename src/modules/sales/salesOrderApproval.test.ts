import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  appUser,
  company,
  currency,
  customer,
  glEntry,
  invoice,
  master,
  product,
  role,
  salesOrder,
  salesOrderApproval,
  salesOrderLine,
  stockMovement,
  taxRule,
  userCompany,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  createSalesOrder,
  SalesOrderValidationError,
} from './createSalesOrder';
import {
  decideSalesOrder,
  SalesOrderApprovalError,
} from './salesOrderApproval';
import { confirmDraftSalesOrder } from './confirmOrder';

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
    email: 'sales.approver@example.test',
    fullName: 'Fictional Sales Approver',
    passwordHash: 'test-only-hash',
  }).returning({ id: appUser.userId });
  const [approverRole] = await db.insert(role).values({
    masterFn: SCOPE.masterFn,
    name: 'Sales Approver',
  }).returning({ id: role.roleId });
  await db.insert(userCompany).values({
    userId: approver.id,
    companyFn: SCOPE.companyFn,
    roleId: approverRole.id,
  });
  const [buyer] = await db.insert(customer).values({
    ...SCOPE,
    code: 'APPROVAL-CUSTOMER',
    name: 'Fictional Approval Customer',
  }).returning({ id: customer.id });
  const [widget] = await db.insert(product).values({
    ...SCOPE,
    sku: 'APPROVAL-WIDGET',
    name: 'Approval Widget',
    uom: 'unit',
  }).returning({ id: product.id });
  await db.insert(taxRule).values({
    ...SCOPE,
    taxRegime: 'GST',
    taxCode: 'SR',
    rate: '9.000',
    validFrom: '2024-01-01',
  });
  return {
    approverId: approver.id,
    approverRoleId: approverRole.id,
    customerId: buyer.id,
    productId: widget.id,
  };
}

async function createPendingOrder(
  db: DB,
  fixture: Awaited<ReturnType<typeof seedFixture>>,
  docNo: string,
) {
  return createSalesOrder(db, SCOPE, {
    docNo,
    customerId: fixture.customerId,
    orderDate: '2024-06-01',
    currency: 'SGD',
    approvalReason: 'Direct order entered outside an accepted quotation.',
    lines: [
      { productId: fixture.productId, qty: '3.0000', unitPrice: '10.0050', taxCode: 'SR' },
      { productId: fixture.productId, qty: '2.0000', unitPrice: '0.3350', taxCode: 'SR' },
    ],
  });
}

describe('sales order creation and approval', () => {
  it('creates Decimal-taxed lines and one pending approval without stock, invoice or GL effects', async () => {
    const db = await freshDb();
    const fixture = await seedFixture(db);
    const created = await createPendingOrder(db, fixture, 'SO-APP-1');

    expect(created).toMatchObject({
      status: 'pending_approval',
      approvalStatus: 'pending',
      netAmount: '30.69',
      taxAmount: '2.76',
      totalAmount: '33.45',
      lineCount: 2,
    });
    const [order] = await db.select().from(salesOrder).where(eq(salesOrder.id, created.orderId));
    const [approval] = await db.select().from(salesOrderApproval)
      .where(eq(salesOrderApproval.orderId, created.orderId));
    const lines = await db.select().from(salesOrderLine)
      .where(eq(salesOrderLine.orderId, created.orderId));
    expect(order).toMatchObject({ status: 'pending_approval', version: 1 });
    expect(approval).toMatchObject({
      id: created.approvalId,
      status: 'pending',
      reason: 'Direct order entered outside an accepted quotation.',
      version: 1,
    });
    expect(lines).toMatchObject([
      { netAmount: '30.02', taxAmount: '2.70', taxRate: '9.000' },
      { netAmount: '0.67', taxAmount: '0.06', taxRate: '9.000' },
    ]);
    expect(await db.select().from(stockMovement)).toHaveLength(0);
    expect(await db.select().from(invoice)).toHaveLength(0);
    expect(await db.select().from(glEntry)).toHaveLength(0);

    await expect(confirmDraftSalesOrder(db, SCOPE, {
      salesOrderId: created.orderId,
      warehouseId: 1,
    })).rejects.toThrow("not 'draft'");
  });

  it('approves with an actor snapshot and releases only the document to draft', async () => {
    const db = await freshDb();
    const fixture = await seedFixture(db);
    const created = await createPendingOrder(db, fixture, 'SO-APP-2');

    const decision = await decideSalesOrder(db, SCOPE, created.orderId, {
      decision: 'approve',
      note: 'Commercial terms and available credit have been reviewed.',
      actorUserId: fixture.approverId,
    });
    expect(decision).toMatchObject({
      status: 'draft',
      version: 2,
      approvalStatus: 'approved',
      decidedByName: 'Fictional Sales Approver',
      decisionNote: 'Commercial terms and available credit have been reviewed.',
    });
    expect(decision.decidedAt).toBeInstanceOf(Date);
    const [approval] = await db.select().from(salesOrderApproval)
      .where(eq(salesOrderApproval.orderId, created.orderId));
    expect(approval).toMatchObject({ status: 'approved', version: 2 });
    expect(await db.select().from(stockMovement)).toHaveLength(0);
    expect(await db.select().from(invoice)).toHaveLength(0);
    expect(await db.select().from(glEntry)).toHaveLength(0);
  });

  it('rejects atomically and blocks repeat decisions', async () => {
    const db = await freshDb();
    const fixture = await seedFixture(db);
    const created = await createPendingOrder(db, fixture, 'SO-APP-3');

    await decideSalesOrder(db, SCOPE, created.orderId, {
      decision: 'reject',
      note: 'Price exception is not commercially acceptable.',
      actorUserId: fixture.approverId,
    });
    const [order] = await db.select().from(salesOrder).where(eq(salesOrder.id, created.orderId));
    const [approval] = await db.select().from(salesOrderApproval)
      .where(eq(salesOrderApproval.orderId, created.orderId));
    expect(order).toMatchObject({ status: 'rejected', version: 2 });
    expect(approval).toMatchObject({
      status: 'rejected',
      version: 2,
      decisionNote: 'Price exception is not commercially acceptable.',
    });
    await expect(decideSalesOrder(db, SCOPE, created.orderId, {
      decision: 'approve',
      note: 'Changed my mind.',
      actorUserId: fixture.approverId,
    })).rejects.toThrow(SalesOrderApprovalError);
  });

  it('rejects invalid tenant references, absent tax, note and actor without partial writes', async () => {
    const db = await freshDb();
    const fixture = await seedFixture(db);
    const [foreignProduct] = await db.insert(product).values({
      masterFn: SCOPE.masterFn,
      companyFn: 'C-OTHER',
      sku: 'FOREIGN-PRODUCT',
      name: 'Foreign Product',
    }).returning({ id: product.id });
    await expect(createSalesOrder(db, SCOPE, {
      docNo: 'SO-FOREIGN',
      customerId: fixture.customerId,
      orderDate: '2024-06-01',
      currency: 'SGD',
      lines: [{ productId: foreignProduct.id, qty: 1, unitPrice: 10, taxCode: 'SR' }],
    })).rejects.toThrow(SalesOrderValidationError);
    await expect(createSalesOrder(db, SCOPE, {
      docNo: 'SO-NO-TAX',
      customerId: fixture.customerId,
      orderDate: '2020-01-01',
      currency: 'SGD',
      lines: [{ productId: fixture.productId, qty: 1, unitPrice: 10, taxCode: 'SR' }],
    })).rejects.toThrow('No tax rule');
    expect(await db.select().from(salesOrder)).toHaveLength(0);
    expect(await db.select().from(salesOrderApproval)).toHaveLength(0);

    const created = await createPendingOrder(db, fixture, 'SO-APP-4');
    await expect(decideSalesOrder(db, SCOPE, created.orderId, {
      decision: 'approve',
      note: '   ',
      actorUserId: fixture.approverId,
    })).rejects.toThrow('decision note is required');
    await expect(decideSalesOrder(db, SCOPE, created.orderId, {
      decision: 'approve',
      note: 'Looks correct.',
      actorUserId: 999999,
    })).rejects.toThrow('not active in this company');
    const [order] = await db.select({ status: salesOrder.status }).from(salesOrder).where(and(
      eq(salesOrder.masterFn, SCOPE.masterFn),
      eq(salesOrder.companyFn, SCOPE.companyFn),
      eq(salesOrder.id, created.orderId),
    ));
    expect(order.status).toBe('pending_approval');
  });
});
