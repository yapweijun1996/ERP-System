import { and, eq } from 'drizzle-orm';
import { describe, it, expect } from 'vitest';
import { appUser, leaveBalanceEntry, leaveType } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createEmployee, InvalidEmployeeStateError } from './employee';
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
});
