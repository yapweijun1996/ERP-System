import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { appUser, auditLog, employee } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { createEmployeeWithin, endEmployeeEmploymentWithin, EmployeeUpdateError } from './employee';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

describe('end accountless employee employment', () => {
  it('keeps the record, hands off direct reports and records a reasoned audit', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const [source] = await db.select().from(employee).where(eq(employee.employeeNo, 'EMP-1001'));
    const target = await db.transaction(tx => createEmployeeWithin(tx, scope, {
      employeeNo: 'EMP-HANDOFF', fullName: 'Handoff Manager', email: 'handoff@example.test',
      department: 'Operations', jobTitle: 'Manager', startDate: '2026-01-01', baseSalary: '6000.00',
    }, admin.userId));
    const result = await db.transaction(tx => endEmployeeEmploymentWithin(tx, scope, source.id, {
      expectedUpdatedAt: source.updatedAt.toISOString(), reason: 'Employment ended with HR handoff',
      handoffEmployeeId: target.id, actorUserId: admin.userId, requestId: 'employee-end-handoff',
    }));
    expect(result.employee.isActive).toBe(false);
    expect(result.reportsReassigned).toBeGreaterThan(0);
    expect(await db.select().from(employee).where(and(
      eq(employee.masterFn, scope.masterFn), eq(employee.companyFn, scope.companyFn),
      eq(employee.managerId, source.id), eq(employee.isActive, true),
    ))).toHaveLength(0);
    expect(await db.select().from(employee).where(eq(employee.managerId, target.id)))
      .toHaveLength(result.reportsReassigned);
    const [audit] = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'hr/employees'), eq(auditLog.entityId, String(source.id)),
      eq(auditLog.action, 'end_employment'),
    ));
    expect(audit.after).toMatchObject({ reason: 'Employment ended with HR handoff',
      handoffEmployeeId: target.id, directReportCount: result.reportsReassigned });
  });

  it('rejects a reporting cycle, stale version and account-bearing employee', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const [source] = await db.select().from(employee).where(eq(employee.employeeNo, 'EMP-1001'));
    const [descendant] = await db.select().from(employee).where(eq(employee.employeeNo, 'EMP-1042'));
    const input = { expectedUpdatedAt: source.updatedAt.toISOString(), reason: 'Employment ended',
      handoffEmployeeId: descendant.id, actorUserId: admin.userId, requestId: 'employee-end-invalid' };
    await expect(db.transaction(tx => endEmployeeEmploymentWithin(tx, scope, source.id, input)))
      .rejects.toMatchObject({ code: 'invalid_handoff' } satisfies Partial<EmployeeUpdateError>);
    await expect(db.transaction(tx => endEmployeeEmploymentWithin(tx, scope, source.id, {
      ...input, expectedUpdatedAt: new Date(0).toISOString(),
    }))).rejects.toMatchObject({ code: 'employee_stale' });
    await expect(db.transaction(tx => endEmployeeEmploymentWithin(tx, scope, descendant.id, {
      ...input, expectedUpdatedAt: descendant.updatedAt.toISOString(), handoffEmployeeId: null,
    }))).rejects.toMatchObject({ code: 'employee_account_offboard_required' });
    const [unchanged] = await db.select().from(employee).where(eq(employee.id, source.id));
    expect(unchanged.isActive).toBe(true);
  });
});
