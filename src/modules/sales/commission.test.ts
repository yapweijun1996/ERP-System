import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import {
  appUser,
  customer,
  invoice,
  role,
  rolePermission,
  salesCommissionLine,
  salesCommissionRun,
  salesCommissionSource,
  salesCreditNote,
  salesDebitNote,
  salesDelivery,
  salesReturn,
  salesOrder,
  userCompanyRole,
  warehouse,
} from '../../data/schema';
import { freshDb } from '../../test/helpers';
import {
  SalesCommissionError,
  activateCommissionPlanWithin,
  approveCommissionRunWithin,
  createCommissionPlanWithin,
  createCommissionRunWithin,
  listSalespeopleWithin,
} from './commission';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

async function fixture() {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select({ id: appUser.userId }).from(appUser).where(and(
    eq(appUser.masterFn, scope.masterFn), eq(appUser.email, 'admin@acme.co'),
  ));
  const [viewer] = await db.select({ id: appUser.userId }).from(appUser).where(and(
    eq(appUser.masterFn, scope.masterFn), eq(appUser.email, 'viewer@acme.co'),
  ));
  const [buyer] = await db.select({ id: customer.id }).from(customer).where(and(
    eq(customer.masterFn, scope.masterFn), eq(customer.companyFn, scope.companyFn),
  ));
  const [wh] = await db.insert(warehouse).values({
    ...scope, code: 'WH-COMM', name: 'Commission fixture warehouse',
  }).returning({ id: warehouse.id });
  const [order] = await db.insert(salesOrder).values({
    ...scope, docNo: 'SO-COMM-1', customerId: buyer.id, salespersonUserId: admin.id,
    status: 'confirmed', orderDate: '2026-06-01', currency: 'SGD',
    netAmount: '1000.00', taxAmount: '90.00', totalAmount: '1090.00',
  }).returning({ id: salesOrder.id });
  const [inv] = await db.insert(invoice).values({
    ...scope, docNo: 'INV-COMM-1', orderId: order.id, customerId: buyer.id,
    salespersonUserId: admin.id, status: 'unpaid', invoiceDate: '2026-06-05',
    currency: 'SGD', netAmount: '1000.00', taxAmount: '90.00', totalAmount: '1090.00',
  }).returning({ id: invoice.id });
  const [delivery] = await db.insert(salesDelivery).values({
    ...scope, docNo: 'DO-COMM-1', orderId: order.id, invoiceId: inv.id,
    status: 'delivered', deliveryDate: '2026-06-05',
  }).returning({ id: salesDelivery.id });
  const [returned] = await db.insert(salesReturn).values({
    ...scope, docNo: 'RMA-COMM-1', deliveryId: delivery.id, invoiceId: inv.id,
    warehouseId: wh.id, status: 'credited', returnDate: '2026-06-12', reason: 'Fixture',
  }).returning({ id: salesReturn.id });
  await db.insert(salesCreditNote).values({
    ...scope, docNo: 'CN-COMM-1', returnId: returned.id, invoiceId: inv.id,
    status: 'posted', noteDate: '2026-06-12', currency: 'SGD',
    netAmount: '100.00', taxAmount: '9.00', totalAmount: '109.00',
  });
  await db.insert(salesDebitNote).values({
    ...scope, docNo: 'DN-COMM-1', invoiceId: inv.id, status: 'posted',
    noteDate: '2026-06-18', currency: 'SGD', reason: 'Commercial adjustment',
    netAmount: '50.00', taxCode: 'SR', taxRate: '9.000',
    taxAmount: '4.50', totalAmount: '54.50',
  });
  return { db, admin, viewer, buyer, inv };
}

describe('sales commission', () => {
  it('calculates immutable invoice/credit/debit sources against the snapshotted owner', async () => {
    const { db, admin, viewer, buyer } = await fixture();
    const plan = await createCommissionPlanWithin(db, scope, {
      code: 'COMM-ADMIN-2026', name: 'Admin recognized revenue',
      salespersonUserId: admin.id, ratePct: '5',
      effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31',
    });
    await activateCommissionPlanWithin(db, scope, plan.id);

    // Customer reassignment after invoicing must not move historical revenue.
    await db.update(customer).set({ ownerUserId: viewer.id }).where(eq(customer.id, buyer.id));
    const run = await createCommissionRunWithin(db, scope, {
      docNo: 'COMRUN-2026-06', periodStart: '2026-06-01', periodEnd: '2026-06-30',
      currency: 'SGD',
    }, admin.id);
    expect(run).toMatchObject({
      status: 'draft', grossInvoiceRevenue: '1000.00', creditRevenue: '100.00',
      debitRevenue: '50.00', eligibleRevenue: '950.00', commissionAmount: '47.50',
      lineCount: 1, sourceCount: 3, createdByName: 'Admin',
    });
    expect(await db.select().from(salesCommissionLine)
      .where(eq(salesCommissionLine.runId, run.id))).toEqual([
      expect.objectContaining({
        salespersonUserId: admin.id, salespersonName: 'Admin', ratePct: '5.000',
        eligibleRevenue: '950.00', commissionAmount: '47.50', sourceCount: 3,
      }),
    ]);
    const sources = await db.select().from(salesCommissionSource)
      .where(eq(salesCommissionSource.runId, run.id));
    expect(sources.map((row) => [
      row.sourceType, row.recognizedAmount, row.commissionAmount,
    ])).toEqual([
      ['invoice', '1000.00', '50.00'],
      ['credit_note', '-100.00', '-5.00'],
      ['debit_note', '50.00', '2.50'],
    ]);
  });

  it('rejects overlapping plans/runs and incomplete attribution', async () => {
    const { db, admin } = await fixture();
    const first = await createCommissionPlanWithin(db, scope, {
      code: 'COMM-1', name: 'First', salespersonUserId: admin.id, ratePct: '2.5',
      effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31',
    });
    await activateCommissionPlanWithin(db, scope, first.id);
    const second = await createCommissionPlanWithin(db, scope, {
      code: 'COMM-2', name: 'Overlap', salespersonUserId: admin.id, ratePct: '3',
      effectiveFrom: '2026-06-01', effectiveTo: null,
    });
    await expect(activateCommissionPlanWithin(db, scope, second.id))
      .rejects.toThrow(/overlaps/i);
    await createCommissionRunWithin(db, scope, {
      docNo: 'COMRUN-1', periodStart: '2026-06-01', periodEnd: '2026-06-30',
      currency: 'SGD',
    }, admin.id);
    await expect(createCommissionRunWithin(db, scope, {
      docNo: 'COMRUN-2', periodStart: '2026-06-15', periodEnd: '2026-07-15',
      currency: 'SGD',
    }, admin.id)).rejects.toThrow(/overlaps this period/i);

    const other = await fixture();
    await expect(createCommissionRunWithin(other.db, scope, {
      docNo: 'COMRUN-NO-PLAN', periodStart: '2026-06-01', periodEnd: '2026-06-30',
      currency: 'SGD',
    }, other.admin.id)).rejects.toThrow(/no snapshotted salesperson or active/i);
  });

  it('approves once with an actor/note snapshot and leaves detail facts unchanged', async () => {
    const { db, admin } = await fixture();
    const plan = await createCommissionPlanWithin(db, scope, {
      code: 'COMM-APPROVE', name: 'Approval fixture', salespersonUserId: admin.id,
      ratePct: '4', effectiveFrom: '2026-01-01', effectiveTo: null,
    });
    await activateCommissionPlanWithin(db, scope, plan.id);
    const run = await createCommissionRunWithin(db, scope, {
      docNo: 'COMRUN-APPROVE', periodStart: '2026-06-01', periodEnd: '2026-06-30',
      currency: 'SGD',
    }, admin.id);
    const before = await db.select().from(salesCommissionSource)
      .where(eq(salesCommissionSource.runId, run.id));
    const approved = await approveCommissionRunWithin(db, scope, run.id, {
      note: 'Reviewed against June source documents.', actorUserId: admin.id,
    });
    expect(approved).toMatchObject({
      status: 'approved', version: 2, approvedByUserId: admin.id,
      approvedByName: 'Admin', approvalNote: 'Reviewed against June source documents.',
    });
    expect(approved.approvedAt).toBeInstanceOf(Date);
    expect(await db.select().from(salesCommissionSource)
      .where(eq(salesCommissionSource.runId, run.id))).toEqual(before);
    await expect(approveCommissionRunWithin(db, scope, run.id, {
      note: 'Again', actorUserId: admin.id,
    })).rejects.toBeInstanceOf(SalesCommissionError);
  });

  it('requires sales.commission.approve before a direct domain approval', async () => {
    const { db, admin, viewer } = await fixture();
    const [viewerRole] = await db.select({ id: role.roleId }).from(role).where(and(
      eq(role.masterFn, scope.masterFn),
      eq(role.name, 'Viewer'),
    ));
    await db.insert(rolePermission).values({
      masterFn: scope.masterFn,
      roleId: viewerRole.id,
      permissionKey: 'sales.commission.approve',
    });
    const [assignment] = await db.select({ id: userCompanyRole.assignmentId })
      .from(userCompanyRole)
      .where(and(
        eq(userCompanyRole.userId, viewer.id),
        eq(userCompanyRole.companyFn, scope.companyFn),
        eq(userCompanyRole.roleId, viewerRole.id),
      ));
    expect(assignment).toBeTruthy();

    const plan = await createCommissionPlanWithin(db, scope, {
      code: 'COMM-PERMISSION', name: 'Permission fixture', salespersonUserId: admin.id,
      ratePct: '4', effectiveFrom: '2026-01-01', effectiveTo: null,
    });
    await activateCommissionPlanWithin(db, scope, plan.id);
    const run = await createCommissionRunWithin(db, scope, {
      docNo: 'COMRUN-PERMISSION', periodStart: '2026-06-01', periodEnd: '2026-06-30',
      currency: 'SGD',
    }, admin.id);
    await db.delete(rolePermission).where(and(
      eq(rolePermission.roleId, viewerRole.id),
      eq(rolePermission.permissionKey, 'sales.commission.approve'),
    ));

    await expect(approveCommissionRunWithin(db, scope, run.id, {
      note: 'Viewer must not approve after grant removal.', actorUserId: viewer.id,
    })).rejects.toThrow('not authorized');
    const [unchanged] = await db.select({ status: salesCommissionRun.status })
      .from(salesCommissionRun)
      .where(eq(salesCommissionRun.id, run.id));
    expect(unchanged.status).toBe('draft');
  });

  it('lists only active company-assigned salespeople and rejects cross-company assignment', async () => {
    const { db, admin, viewer } = await fixture();
    expect((await listSalespeopleWithin(db, scope, { limit: 1 })).data)
      .toEqual([expect.objectContaining({ id: admin.id, fullName: 'Admin' })]);
    const page = await listSalespeopleWithin(db, scope, { cursor: admin.id, limit: 10 });
    expect(page.data).toEqual([expect.objectContaining({ id: viewer.id })]);
    await expect(createCommissionPlanWithin(db, { masterFn: 'M1', companyFn: 'C-MY' }, {
      code: 'COMM-CROSS', name: 'Cross company', salespersonUserId: viewer.id,
      ratePct: '5', effectiveFrom: '2026-01-01', effectiveTo: null,
    })).rejects.toThrow(/not active or assigned/i);
  });
});
