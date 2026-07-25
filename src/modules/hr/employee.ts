// HR-lite — register a new employee. Plain insert, no line items, mirroring
// createAsset.ts's shape: nothing here needs a multi-step transaction. Deliberately
// no update function yet (create-only, matching this module's "lite" scope) and no
// link to app_user -- an HR employee record doesn't imply an ERP login.
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { EMPLOYMENT_TYPES, employee } from '../../data/schema';
import { fixedUnits } from '../inventory/decimal';
import { syncManagerRoleWithin } from './managerRole';

export class InvalidEmployeeStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmployeeStateError';
  }
}

export interface CreateEmployeeInput {
  employeeNo: string;
  fullName: string;
  email: string;
  phone?: string | null;
  department: string;
  jobTitle: string;
  employmentType?: string;
  managerId?: number | null;
  startDate: string; // YYYY-MM-DD
  annualLeaveDays?: number;
  baseSalary: string;
}

export async function createEmployeeWithin(exec: DB, scope: Scope, input: CreateEmployeeInput) {
  if (!input.employeeNo?.trim()) throw new InvalidEmployeeStateError('employeeNo is required');
  if (!input.fullName?.trim()) throw new InvalidEmployeeStateError('fullName is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email ?? '')) {
    throw new InvalidEmployeeStateError('email must be a valid address');
  }
  if (!input.department?.trim()) throw new InvalidEmployeeStateError('department is required');
  if (!input.jobTitle?.trim()) throw new InvalidEmployeeStateError('jobTitle is required');
  const employmentType = input.employmentType ?? 'Full-time';
  if (!EMPLOYMENT_TYPES.includes(employmentType as typeof EMPLOYMENT_TYPES[number])) {
    throw new InvalidEmployeeStateError(`employmentType must be one of: ${EMPLOYMENT_TYPES.join(', ')}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    throw new InvalidEmployeeStateError('startDate must be YYYY-MM-DD');
  }
  const annualLeaveDays = input.annualLeaveDays ?? 14;
  if (!Number.isFinite(annualLeaveDays) || annualLeaveDays < 0) {
    throw new InvalidEmployeeStateError('annualLeaveDays must be a non-negative number');
  }
  const baseSalaryCents = fixedUnits(input.baseSalary, 2);
  if (baseSalaryCents <= 0n) {
    throw new InvalidEmployeeStateError('baseSalary must be greater than 0');
  }
  if (input.managerId != null) {
    const [manager] = await exec.select({ id: employee.id })
      .from(employee)
      .where(and(
        eq(employee.id, input.managerId),
        eq(employee.masterFn, scope.masterFn),
        eq(employee.companyFn, scope.companyFn),
      ))
      .limit(1);
    if (!manager) throw new InvalidEmployeeStateError('managerId does not refer to an employee in this company');
  }

  const [row] = await exec.insert(employee).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    employeeNo: input.employeeNo.trim(),
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    department: input.department.trim(),
    jobTitle: input.jobTitle.trim(),
    employmentType,
    managerId: input.managerId ?? null,
    startDate: input.startDate,
    annualLeaveDays: Math.round(annualLeaveDays),
    baseSalary: String(input.baseSalary),
    isActive: true,
  }).returning({ id: employee.id });
  if (input.managerId != null) {
    await syncManagerRoleWithin(exec, scope, input.managerId);
  }
  return { id: row.id };
}

export function createEmployee(db: DB, scope: Scope, input: CreateEmployeeInput) {
  return db.transaction((tx) => createEmployeeWithin(tx, scope, input));
}
