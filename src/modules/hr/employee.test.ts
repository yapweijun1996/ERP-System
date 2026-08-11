import { and, eq } from 'drizzle-orm';
import { describe, it, expect } from 'vitest';
import { appUser, documentSequence, employee, leaveBalanceEntry, leaveType } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  createEmployee,
  EmployeeUpdateError,
  InvalidEmployeeStateError,
  updateEmployee,
} from './employee';
import { projectLeaveBalance } from './leaveBalance';

describe('createEmployee', () => {
  it('success: registers an employee with no manager', async () => {
    const db = await freshDb();
    const res = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T1', fullName: 'Test Employee', email: 'test1@example.test',
      department: 'Operations', jobTitle: 'Director', startDate: '2024-01-01', baseSalary: '5000.00',
    });
    expect(res.id).toBeGreaterThan(0);
  });

  it('creates one authoritative annual-leave opening when policy is configured', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const created = await createEmployee(db, scope, {
      employeeNo: 'EMP-OPENING', fullName: 'Opening Balance',
      email: 'opening.balance@example.test', department: 'Finance', jobTitle: 'Analyst',
      startDate: '2026-07-27', annualLeaveDays: 14, baseSalary: '4500.00',
    }, admin.userId);
    expect(created.leaveBalance).toMatchObject({
      entitlement: '14.00', balance: '14.00', reserved: '0.00', available: '14.00',
      initialized: true,
    });
    const [annual] = await db.select({ id: leaveType.id }).from(leaveType).where(and(
      eq(leaveType.masterFn, scope.masterFn),
      eq(leaveType.companyFn, scope.companyFn),
      eq(leaveType.code, 'ANNUAL'),
    ));
    expect(await projectLeaveBalance(db, scope, created.id, annual.id)).toEqual({
      balance: '14.00', reserved: '0.00', available: '14.00', entryCount: 1,
    });
    expect(await db.select().from(leaveBalanceEntry).where(and(
      eq(leaveBalanceEntry.employeeId, created.id),
      eq(leaveBalanceEntry.leaveTypeId, annual.id),
    ))).toHaveLength(1);
  });

  it('success: registers an employee reporting to an existing manager', async () => {
    const db = await freshDb();
    const manager = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T2', fullName: 'Manager', email: 'manager@example.test',
      department: 'Operations', jobTitle: 'Director', startDate: '2024-01-01', baseSalary: '8000.00',
    });
    const res = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T3', fullName: 'Report', email: 'report@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-06-01', managerId: manager.id,
      baseSalary: '4000.00',
    });
    expect(res.id).toBeGreaterThan(0);
  });

  it('rejects an invalid email', async () => {
    const db = await freshDb();
    await expect(createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T4', fullName: 'Bad Email', email: 'not-an-email',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', baseSalary: '4000.00',
    })).rejects.toThrow(InvalidEmployeeStateError);
  });

  it('rejects an invalid employmentType', async () => {
    const db = await freshDb();
    await expect(createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T5', fullName: 'Bad Type', email: 'badtype@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', employmentType: 'Freelance',
      baseSalary: '4000.00',
    })).rejects.toThrow(InvalidEmployeeStateError);
  });

  it('rejects a managerId from outside the tenant', async () => {
    const db = await freshDb();
    await expect(createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T6', fullName: 'Orphan', email: 'orphan@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', managerId: 999999,
      baseSalary: '4000.00',
    })).rejects.toThrow(InvalidEmployeeStateError);
  });

  it('rejects a duplicate employeeNo within the same tenant', async () => {
    const db = await freshDb();
    await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-DUP', fullName: 'First', email: 'first@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', baseSalary: '4000.00',
    });
    await expect(createEmployee(db, SCOPE, {
      employeeNo: 'EMP-DUP', fullName: 'Second', email: 'second@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', baseSalary: '4000.00',
    })).rejects.toThrow();
  });

  it('allocates the next company employee code on system-numbered creation', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const created = await createEmployee(db, { masterFn: 'M1', companyFn: 'C-SG' }, {
      employeeNo: 'browser-preview-only', employeeNoMode: 'auto',
      fullName: 'System Numbered Staff', email: 'system.numbered@example.test',
      department: 'Operations', jobTitle: 'Coordinator', startDate: '2026-07-27',
      baseSalary: '4000.00',
    });
    expect(created.employeeNo).toBe(`EMP-${new Date().getUTCFullYear()}-0001`);
    expect(await db.select().from(employee).where(and(
      eq(employee.masterFn, 'M1'), eq(employee.companyFn, 'C-SG'),
      eq(employee.employeeNo, `EMP-${new Date().getUTCFullYear()}-0001`),
    ))).toHaveLength(1);
  });

  it('uses the company prefix and increments the configured annual sequence', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const [sequence] = await db.select().from(documentSequence).where(and(
      eq(documentSequence.masterFn, scope.masterFn),
      eq(documentSequence.companyFn, scope.companyFn),
      eq(documentSequence.documentType, 'employee'),
    ));
    await db.update(documentSequence).set({
      prefix: 'STAFF', nextNumber: 7, padding: 4, resetPolicy: 'yearly', updatedAt: new Date(),
    }).where(eq(documentSequence.id, sequence.id));
    const first = await createEmployee(db, scope, {
      employeeNo: 'ignored-preview', employeeNoMode: 'auto', fullName: 'Staff Seven',
      email: 'staff.seven@example.test', department: 'Operations', jobTitle: 'Coordinator',
      startDate: '2026-07-27', baseSalary: '4000.00',
    });
    const second = await createEmployee(db, scope, {
      employeeNo: 'ignored-preview', employeeNoMode: 'auto', fullName: 'Staff Eight',
      email: 'staff.eight@example.test', department: 'Operations', jobTitle: 'Coordinator',
      startDate: '2026-07-27', baseSalary: '4000.00',
    });
    expect(first.employeeNo).toBe(`STAFF-${new Date().getUTCFullYear()}-0007`);
    expect(second.employeeNo).toBe(`STAFF-${new Date().getUTCFullYear()}-0008`);
  });

  it('starts a yearly sequence at one when the previous period is complete', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const [sequence] = await db.select().from(documentSequence).where(and(
      eq(documentSequence.masterFn, scope.masterFn),
      eq(documentSequence.companyFn, scope.companyFn),
      eq(documentSequence.documentType, 'employee'),
    ));
    await db.update(documentSequence).set({
      prefix: 'STAFF', nextNumber: 99, resetPolicy: 'yearly',
      updatedAt: new Date(`${new Date().getUTCFullYear() - 1}-12-31T00:00:00Z`),
    }).where(eq(documentSequence.id, sequence.id));
    const created = await createEmployee(db, scope, {
      employeeNo: 'ignored-preview', employeeNoMode: 'auto', fullName: 'New Annual Start',
      email: 'new.annual.start@example.test', department: 'Operations', jobTitle: 'Coordinator',
      startDate: '2026-07-27', baseSalary: '4000.00',
    });
    expect(created.employeeNo).toBe(`STAFF-${new Date().getUTCFullYear()}-0001`);
  });

  it('rejects a zero baseSalary', async () => {
    const db = await freshDb();
    await expect(createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T7', fullName: 'Zero Salary', email: 'zerosalary@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', baseSalary: '0.00',
    })).rejects.toThrow(InvalidEmployeeStateError);
  });

  it('rejects a negative baseSalary', async () => {
    const db = await freshDb();
    await expect(createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T8', fullName: 'Negative Salary', email: 'negsalary@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', baseSalary: '-100.00',
    })).rejects.toThrow(InvalidEmployeeStateError);
  });

  it('updates the profile within the tenant and preserves the concurrency token', async () => {
    const db = await freshDb();
    const created = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-UPD-1', fullName: 'Before Name', email: 'before@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', baseSalary: '4000.00',
    });
    const [before] = await db.select().from(employee).where(eq(employee.id, created.id));
    const result = await updateEmployee(db, SCOPE, created.id, {
      employeeNo: before.employeeNo,
      fullName: 'After Name', email: 'after@example.test', phone: '+60 12-345 6789',
      department: 'Finance', jobTitle: 'Senior Analyst', employmentType: 'Full-time',
      managerId: null, startDate: '2024-02-01', annualLeaveDays: before.annualLeaveDays,
      baseSalary: '4500.00', expectedUpdatedAt: before.updatedAt,
    });
    expect(result.employee).toMatchObject({
      id: created.id, fullName: 'After Name', email: 'after@example.test',
      phone: '+60 12-345 6789', department: 'Finance', jobTitle: 'Senior Analyst',
      baseSalary: '4500.00',
    });
    expect(result.employee.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    await expect(updateEmployee(db, SCOPE, created.id, {
      employeeNo: result.employee.employeeNo,
      fullName: 'Stale Name', email: result.employee.email, phone: result.employee.phone,
      department: result.employee.department, jobTitle: result.employee.jobTitle,
      employmentType: result.employee.employmentType, managerId: result.employee.managerId,
      startDate: result.employee.startDate, annualLeaveDays: result.employee.annualLeaveDays,
      baseSalary: result.employee.baseSalary, expectedUpdatedAt: before.updatedAt,
    })).rejects.toMatchObject({ code: 'employee_stale' } satisfies Partial<EmployeeUpdateError>);
  });

  it('does not allow a system employee code to be changed after creation', async () => {
    const db = await freshDb();
    const created = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-IMMUTABLE', fullName: 'Immutable Code', email: 'immutable@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', baseSalary: '4000.00',
    });
    const [before] = await db.select().from(employee).where(eq(employee.id, created.id));
    await expect(updateEmployee(db, SCOPE, created.id, {
      employeeNo: 'EMP-CHANGED', fullName: before.fullName, email: before.email,
      phone: before.phone, department: before.department, jobTitle: before.jobTitle,
      employmentType: before.employmentType, managerId: before.managerId,
      startDate: before.startDate, annualLeaveDays: before.annualLeaveDays,
      baseSalary: before.baseSalary, expectedUpdatedAt: before.updatedAt,
    })).rejects.toMatchObject({
      code: 'employee_no_immutable',
      fieldErrors: { employeeNo: 'Employee number is system-generated and cannot be changed.' },
    } satisfies Partial<EmployeeUpdateError>);
  });

  it('records an annual entitlement change as an immutable adjustment', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const created = await createEmployee(db, { masterFn: 'M1', companyFn: 'C-SG' }, {
      employeeNo: 'EMP-UPD-2', fullName: 'Leave Policy Test', email: 'leave-update@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2026-01-01', annualLeaveDays: 14,
      baseSalary: '4000.00',
    }, admin.userId);
    const [before] = await db.select().from(employee).where(eq(employee.id, created.id));
    const result = await updateEmployee(db, { masterFn: 'M1', companyFn: 'C-SG' }, created.id, {
      employeeNo: before.employeeNo, fullName: before.fullName, email: before.email,
      phone: before.phone, department: before.department, jobTitle: before.jobTitle,
      employmentType: before.employmentType, managerId: before.managerId,
      startDate: before.startDate, annualLeaveDays: 16, baseSalary: before.baseSalary,
      expectedUpdatedAt: before.updatedAt, actorUserId: admin.userId, requestId: 'employee-update-test-1',
    });
    expect(result.employee.annualLeaveDays).toBe(16);
    expect(await db.select().from(leaveBalanceEntry).where(eq(
      leaveBalanceEntry.entryKey, `employee:${created.id}:annual-entitlement:employee-update-test-1`,
    ))).toHaveLength(1);
    const [annualType] = await db.select({ id: leaveType.id }).from(leaveType).where(and(
      eq(leaveType.masterFn, 'M1'), eq(leaveType.companyFn, 'C-SG'), eq(leaveType.code, 'ANNUAL'),
    ));
    const annual = await projectLeaveBalance(db, { masterFn: 'M1', companyFn: 'C-SG' }, created.id, annualType.id);
    expect(annual.balance).toBe('16.00');
  });

  it('rejects a reporting-line cycle', async () => {
    const db = await freshDb();
    const first = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-UPD-3A', fullName: 'First Manager', email: 'first-manager@example.test',
      department: 'Operations', jobTitle: 'Manager', startDate: '2024-01-01', baseSalary: '5000.00',
    });
    const second = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-UPD-3B', fullName: 'Second Manager', email: 'second-manager@example.test',
      department: 'Operations', jobTitle: 'Manager', managerId: first.id,
      startDate: '2024-01-01', baseSalary: '5000.00',
    });
    const [row] = await db.select().from(employee).where(eq(employee.id, first.id));
    await expect(updateEmployee(db, SCOPE, first.id, {
      employeeNo: row.employeeNo, fullName: row.fullName, email: row.email,
      phone: row.phone, department: row.department, jobTitle: row.jobTitle,
      employmentType: row.employmentType, managerId: second.id, startDate: row.startDate,
      annualLeaveDays: row.annualLeaveDays, baseSalary: row.baseSalary,
      expectedUpdatedAt: row.updatedAt,
    })).rejects.toThrow('reporting cycle');
  });
});
