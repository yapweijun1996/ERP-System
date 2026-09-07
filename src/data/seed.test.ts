import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { employee, purchaseOrder, purchaseOrderLine } from './schema';
import { seedDemo } from './seed';
import { freshDb } from '../test/helpers';

describe('compact Demo HR starter roster', () => {
  it('seeds 18 fictional employees with company roots and reporting lines', async () => {
    const db = await freshDb();
    await seedDemo(db);

    const rows = await db.select({
      companyFn: employee.companyFn,
      employeeNo: employee.employeeNo,
      email: employee.email,
      managerId: employee.managerId,
    }).from(employee);

    expect(rows).toHaveLength(18);
    expect(rows.filter((row) => row.companyFn === 'C-SG')).toHaveLength(12);
    expect(rows.filter((row) => row.companyFn === 'C-MY')).toHaveLength(6);
    expect(rows.filter((row) => row.email.endsWith('@demo.example.test'))).toHaveLength(11);
    expect(rows.filter((row) => row.managerId === null)).toHaveLength(2);
    expect(rows).toContainEqual(expect.objectContaining({
      companyFn: 'C-SG', employeeNo: 'EMP-1095', email: 'jason.tan@demo.example.test',
    }));
    expect(rows).toContainEqual(expect.objectContaining({
      companyFn: 'C-MY', employeeNo: 'EMP-2000', email: 'amirul.rashid@demo.example.test',
    }));

    const sgEmployeeNumbers = await db.select({ employeeNo: employee.employeeNo })
      .from(employee)
      .where(and(eq(employee.masterFn, 'M1'), eq(employee.companyFn, 'C-SG')));
    expect(new Set(sgEmployeeNumbers.map((row) => row.employeeNo)).size)
      .toBe(sgEmployeeNumbers.length);
  });

  it('seeds the approval procurement path with governed GST snapshots', async () => {
    const db = await freshDb();
    await seedDemo(db);

    const scope = { masterFn: 'M1', companyFn: 'C-SG' } as const;
    const [order] = await db.select({ id: purchaseOrder.id, status: purchaseOrder.status })
      .from(purchaseOrder)
      .where(and(
        eq(purchaseOrder.masterFn, scope.masterFn),
        eq(purchaseOrder.companyFn, scope.companyFn),
        eq(purchaseOrder.docNo, 'PO-APP-2026-0001'),
      ));
    const [line] = await db.select({
      taxClassification: purchaseOrderLine.taxClassification,
      inputTaxRecoverablePct: purchaseOrderLine.inputTaxRecoverablePct,
    }).from(purchaseOrderLine).where(and(
      eq(purchaseOrderLine.masterFn, scope.masterFn),
      eq(purchaseOrderLine.companyFn, scope.companyFn),
      eq(purchaseOrderLine.orderId, order.id),
    ));
    expect(order.status).toBe('pending_approval');
    expect(line).toEqual({ taxClassification: 'gst_standard', inputTaxRecoverablePct: '100.0000' });

  });
});
