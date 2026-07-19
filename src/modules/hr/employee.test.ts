import { describe, it, expect } from 'vitest';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createEmployee, InvalidEmployeeStateError } from './employee';

describe('createEmployee', () => {
  it('success: registers an employee with no manager', async () => {
    const db = await freshDb();
    const res = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T1', fullName: 'Test Employee', email: 'test1@example.test',
      department: 'Operations', jobTitle: 'Director', startDate: '2024-01-01',
    });
    expect(res.id).toBeGreaterThan(0);
  });

  it('success: registers an employee reporting to an existing manager', async () => {
    const db = await freshDb();
    const manager = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T2', fullName: 'Manager', email: 'manager@example.test',
      department: 'Operations', jobTitle: 'Director', startDate: '2024-01-01',
    });
    const res = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T3', fullName: 'Report', email: 'report@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-06-01', managerId: manager.id,
    });
    expect(res.id).toBeGreaterThan(0);
  });

  it('rejects an invalid email', async () => {
    const db = await freshDb();
    await expect(createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T4', fullName: 'Bad Email', email: 'not-an-email',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01',
    })).rejects.toThrow(InvalidEmployeeStateError);
  });

  it('rejects an invalid employmentType', async () => {
    const db = await freshDb();
    await expect(createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T5', fullName: 'Bad Type', email: 'badtype@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', employmentType: 'Freelance',
    })).rejects.toThrow(InvalidEmployeeStateError);
  });

  it('rejects a managerId from outside the tenant', async () => {
    const db = await freshDb();
    await expect(createEmployee(db, SCOPE, {
      employeeNo: 'EMP-T6', fullName: 'Orphan', email: 'orphan@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', managerId: 999999,
    })).rejects.toThrow(InvalidEmployeeStateError);
  });

  it('rejects a duplicate employeeNo within the same tenant', async () => {
    const db = await freshDb();
    await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-DUP', fullName: 'First', email: 'first@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01',
    });
    await expect(createEmployee(db, SCOPE, {
      employeeNo: 'EMP-DUP', fullName: 'Second', email: 'second@example.test',
      department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01',
    })).rejects.toThrow();
  });
});
