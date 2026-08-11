// Employee master data — create/update the HR employee profile while keeping
// tenancy, reporting-line permissions and the append-only leave ledger intact.
import { and, asc, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  appUser,
  company,
  EMPLOYMENT_TYPES,
  documentSequence,
  employee,
  leaveBalanceEntry,
  leaveType,
} from '../../data/schema';
import { fixedString, fixedUnits } from '../inventory/decimal';
import {
  appendLeaveBalanceEntryWithin,
  initializeEmployeeAnnualLeaveOpeningWithin,
} from './leaveBalance';
import { syncManagerRoleWithin, syncManagerRolesWithin } from './managerRole';

export class InvalidEmployeeStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmployeeStateError';
  }
}

export class EmployeeUpdateError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'EmployeeUpdateError';
  }
}

export class EmployeeCreateError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'EmployeeCreateError';
  }
}

type EmployeeNumberMode = 'manual' | 'auto';
export type EmployeeNumberResetPolicy = 'never' | 'yearly' | 'monthly';

export const EMPLOYEE_NUMBER_SEQUENCE_TYPE = 'employee';
const DEFAULT_EMPLOYEE_NUMBER_PREFIX = 'EMP';
const DEFAULT_EMPLOYEE_NUMBER_PADDING = 4;
const DEFAULT_EMPLOYEE_NUMBER_RESET_POLICY: EmployeeNumberResetPolicy = 'yearly';

export interface CreateEmployeeInput {
  employeeNo: string;
  /** The staff onboarding UI uses the server-side allocator at activation. */
  employeeNoMode?: EmployeeNumberMode;
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

export interface UpdateEmployeeInput {
  employeeNo: string;
  fullName: string;
  email: string;
  phone?: string | null;
  department: string;
  jobTitle: string;
  employmentType: string;
  managerId?: number | null;
  startDate: string; // YYYY-MM-DD
  annualLeaveDays: number;
  baseSalary: string;
  expectedUpdatedAt?: string | Date | null;
  actorUserId?: number | null;
  requestId?: string;
}

function normalizeEmployeeNo(value: string): string {
  return value.trim().toUpperCase();
}

function employeeNumberPeriod(resetPolicy: EmployeeNumberResetPolicy, now: Date): string | null {
  if (resetPolicy === 'yearly') return String(now.getUTCFullYear());
  if (resetPolicy === 'monthly') {
    return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return null;
}

function formatEmployeeNumber(
  prefix: string,
  resetPolicy: EmployeeNumberResetPolicy,
  number: number,
  padding: number,
  now: Date,
): string {
  const period = employeeNumberPeriod(resetPolicy, now);
  const suffix = String(number).padStart(padding, '0');
  return period ? `${prefix}-${period}-${suffix}` : `${prefix}-${suffix}`;
}

function sameSequencePeriod(
  resetPolicy: EmployeeNumberResetPolicy,
  updatedAt: Date,
  now: Date,
): boolean {
  if (resetPolicy === 'never') return true;
  return employeeNumberPeriod(resetPolicy, updatedAt) === employeeNumberPeriod(resetPolicy, now);
}

export async function ensureEmployeeNumberSequenceWithin(exec: DB, scope: Scope) {
  const [existing] = await exec.select().from(documentSequence).where(and(
    eq(documentSequence.masterFn, scope.masterFn),
    eq(documentSequence.companyFn, scope.companyFn),
    eq(documentSequence.documentType, EMPLOYEE_NUMBER_SEQUENCE_TYPE),
  )).limit(1);
  if (existing) return existing;

  const [created] = await exec.insert(documentSequence).values({
    ...scope,
    documentType: EMPLOYEE_NUMBER_SEQUENCE_TYPE,
    prefix: DEFAULT_EMPLOYEE_NUMBER_PREFIX,
    nextNumber: 1,
    padding: DEFAULT_EMPLOYEE_NUMBER_PADDING,
    resetPolicy: DEFAULT_EMPLOYEE_NUMBER_RESET_POLICY,
  }).onConflictDoNothing().returning();
  if (created) return created;

  const [afterRace] = await exec.select().from(documentSequence).where(and(
    eq(documentSequence.masterFn, scope.masterFn),
    eq(documentSequence.companyFn, scope.companyFn),
    eq(documentSequence.documentType, EMPLOYEE_NUMBER_SEQUENCE_TYPE),
  )).limit(1);
  if (!afterRace) throw new InvalidEmployeeStateError('Employee number sequence could not be initialized');
  return afterRace;
}

/**
 * Allocate the next human-readable employee code while holding the company
 * row lock. The lock makes two concurrent activations in one company observe
 * different numbers without adding a migration or touching existing data.
 */
export async function nextEmployeeNoWithin(exec: DB, scope: Scope): Promise<string> {
  const [activeCompany] = await exec.select({ companyFn: company.companyFn })
    .from(company)
    .where(and(
      eq(company.masterFn, scope.masterFn),
      eq(company.companyFn, scope.companyFn),
    ))
    .limit(1)
    .for('update');
  if (!activeCompany) {
    throw new InvalidEmployeeStateError('The active company could not be found');
  }

  await ensureEmployeeNumberSequenceWithin(exec, scope);
  const [sequence] = await exec.select().from(documentSequence).where(and(
    eq(documentSequence.masterFn, scope.masterFn),
    eq(documentSequence.companyFn, scope.companyFn),
    eq(documentSequence.documentType, EMPLOYEE_NUMBER_SEQUENCE_TYPE),
  )).limit(1).for('update');
  if (!sequence) throw new InvalidEmployeeStateError('Employee number sequence could not be loaded');

  const resetPolicy = sequence.resetPolicy as EmployeeNumberResetPolicy;
  const now = new Date();
  const period = employeeNumberPeriod(resetPolicy, now);
  const marker = period ? `${sequence.prefix}-${period}-` : `${sequence.prefix}-`;
  const existing = await exec.select({ employeeNo: employee.employeeNo })
    .from(employee)
    .where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
    ));
  let maximum = 0;
  for (const row of existing) {
    const suffix = row.employeeNo.trim().toUpperCase().startsWith(marker.toUpperCase())
      ? row.employeeNo.trim().slice(marker.length)
      : '';
    if (/^\d+$/.test(suffix)) maximum = Math.max(maximum, Number(suffix));
  }
  const configuredNext = sameSequencePeriod(resetPolicy, sequence.updatedAt, now)
    ? sequence.nextNumber
    : 1;
  const nextNumber = Math.max(configuredNext, maximum + 1, 1);
  const employeeNo = formatEmployeeNumber(
    sequence.prefix,
    resetPolicy,
    nextNumber,
    sequence.padding,
    now,
  );
  await exec.update(documentSequence).set({
    nextNumber: nextNumber + 1,
    version: sequence.version + 1,
    updatedAt: now,
  }).where(eq(documentSequence.id, sequence.id));
  return employeeNo;
}

function isEmployeeNoUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; constraint?: unknown };
  return candidate.code === '23505' && candidate.constraint === 'uq_employee_no';
}

function parseBaseSalary(value: string): bigint {
  try {
    return fixedUnits(value, 2);
  } catch {
    throw new InvalidEmployeeStateError('baseSalary must be a valid amount');
  }
}

function normalizedAnnualLeaveDays(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new InvalidEmployeeStateError('annualLeaveDays must be a non-negative number');
  }
  return Math.round(value);
}

function employeeFieldError(field: string, message: string): EmployeeUpdateError {
  return new EmployeeUpdateError('employee_validation_failed', message, 422, { [field]: message });
}

function validateEmployeeProfile(input: UpdateEmployeeInput): number {
  const fieldErrors: Record<string, string> = {};
  if (!input.employeeNo?.trim()) fieldErrors.employeeNo = 'Employee number is required.';
  if (!input.fullName?.trim()) fieldErrors.fullName = 'Full name is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email?.trim() ?? '')) {
    fieldErrors.email = 'Enter a valid email address.';
  }
  if (!input.department?.trim()) fieldErrors.department = 'Department is required.';
  if (!input.jobTitle?.trim()) fieldErrors.jobTitle = 'Job title is required.';
  if (!EMPLOYMENT_TYPES.includes(input.employmentType as typeof EMPLOYMENT_TYPES[number])) {
    fieldErrors.employmentType = 'Choose a valid employment type.';
  }
  const [year, month, day] = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(input.startDate || '')
    ?.slice(1).map(Number) ?? [];
  const startDate = Number.isSafeInteger(year) && Number.isSafeInteger(month) && Number.isSafeInteger(day)
    ? new Date(Date.UTC(year, month - 1, day))
    : null;
  if (!startDate || startDate.getUTCFullYear() !== year || startDate.getUTCMonth() !== month - 1
    || startDate.getUTCDate() !== day) {
    fieldErrors.startDate = 'Enter a valid start date.';
  }
  let annualLeaveDays: number;
  try {
    annualLeaveDays = normalizedAnnualLeaveDays(input.annualLeaveDays);
  } catch {
    fieldErrors.annualLeaveDays = 'Annual leave must be a non-negative number.';
    annualLeaveDays = 0;
  }
  let salary: bigint;
  try {
    salary = parseBaseSalary(input.baseSalary);
  } catch {
    fieldErrors.baseSalary = 'Base salary must be a valid amount.';
    salary = 0n;
  }
  if (salary <= 0n) {
    fieldErrors.baseSalary = 'Base salary must be greater than 0.';
  }
  if (Object.keys(fieldErrors).length) {
    throw new EmployeeUpdateError(
      'employee_validation_failed',
      'Review the highlighted employee fields.',
      422,
      fieldErrors,
    );
  }
  return annualLeaveDays;
}

async function validateManagerChange(
  exec: DB,
  scope: Scope,
  employeeId: number,
  managerId: number | null,
) {
  if (managerId == null) return;
  let currentId: number | null = managerId;
  const visited = new Set<number>();
  while (currentId != null) {
    if (currentId === employeeId) {
      throw new InvalidEmployeeStateError('managerId cannot create a reporting cycle');
    }
    if (visited.has(currentId)) {
      throw new InvalidEmployeeStateError('The reporting line already contains a cycle');
    }
    visited.add(currentId);
    const [manager] = await exec.select({
      id: employee.id,
      managerId: employee.managerId,
      isActive: employee.isActive,
    }).from(employee).where(and(
      eq(employee.id, currentId),
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
    )).limit(1);
    if (!manager) {
      throw new InvalidEmployeeStateError('managerId does not refer to an employee in this company');
    }
    if (!manager.isActive) {
      throw new InvalidEmployeeStateError('managerId must refer to an active employee');
    }
    currentId = manager.managerId ?? null;
  }
}

function timestampMatches(actual: Date, expected: string | Date): boolean {
  const value = expected instanceof Date ? expected : new Date(expected);
  return !Number.isNaN(value.getTime()) && actual.getTime() === value.getTime();
}

async function annualLeaveEntry(
  exec: DB,
  scope: Scope,
  employeeId: number,
) {
  const [entry] = await exec.select({
    leaveTypeId: leaveBalanceEntry.leaveTypeId,
    policyVersionId: leaveBalanceEntry.policyVersionId,
  }).from(leaveBalanceEntry)
    .innerJoin(leaveType, eq(leaveType.id, leaveBalanceEntry.leaveTypeId))
    .where(and(
      eq(leaveBalanceEntry.employeeId, employeeId),
      eq(leaveBalanceEntry.masterFn, scope.masterFn),
      eq(leaveBalanceEntry.companyFn, scope.companyFn),
      eq(leaveType.masterFn, scope.masterFn),
      eq(leaveType.companyFn, scope.companyFn),
      eq(leaveType.code, 'ANNUAL'),
    ))
    .orderBy(asc(leaveBalanceEntry.id))
    .limit(1);
  return entry ?? null;
}

export async function createEmployeeWithin(
  exec: DB,
  scope: Scope,
  input: CreateEmployeeInput,
  actorUserId: number | null = null,
) {
  const isAutoNumbered = input.employeeNoMode === 'auto';
  const suppliedEmployeeNo = normalizeEmployeeNo(input.employeeNo ?? '');
  if (!isAutoNumbered && !suppliedEmployeeNo) {
    throw new InvalidEmployeeStateError('employeeNo is required');
  }
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

  const employeeNo = isAutoNumbered
    ? await nextEmployeeNoWithin(exec, scope)
    : suppliedEmployeeNo;
  const [duplicate] = await exec.select({ id: employee.id }).from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    sql`upper(${employee.employeeNo}) = ${employeeNo}`,
  )).limit(1);
  if (duplicate) {
    throw new EmployeeCreateError(
      'employee_no_conflict',
      'Employee number is already used in this company.',
      409,
      { employeeNo: 'Employee number is already used in this company.' },
    );
  }

  let row: { id: number } | undefined;
  try {
    [row] = await exec.insert(employee).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      employeeNo,
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
  } catch (error) {
    if (isEmployeeNoUniqueViolation(error)) {
      throw new EmployeeCreateError(
        'employee_no_conflict',
        'Employee number is already used in this company.',
        409,
        { employeeNo: 'Employee number is already used in this company.' },
      );
    }
    throw error;
  }
  if (!row) throw new InvalidEmployeeStateError('Employee could not be created');
  if (input.managerId != null) {
    await syncManagerRoleWithin(exec, scope, input.managerId);
  }
  const leaveBalance = await initializeEmployeeAnnualLeaveOpeningWithin(
    exec, scope, row.id, actorUserId,
  );
  return { id: row.id, employeeNo, leaveBalance };
}

/**
 * Update the employee master record as one tenant transaction.
 *
 * `updatedAt` is the optimistic-concurrency token because this legacy table
 * predates integer record versions. A changed annual entitlement is recorded
 * as an immutable leave-ledger adjustment, so the profile and displayed leave
 * balance cannot silently diverge.
 */
export async function updateEmployeeWithin(
  exec: DB,
  scope: Scope,
  employeeId: number,
  input: UpdateEmployeeInput,
) {
  const annualLeaveDays = validateEmployeeProfile(input);
  const managerId = input.managerId ?? null;
  try {
    await validateManagerChange(exec, scope, employeeId, managerId);
  } catch (error) {
    if (error instanceof InvalidEmployeeStateError) {
      throw employeeFieldError('managerId', error.message);
    }
    throw error;
  }

  const [before] = await exec.select().from(employee).where(and(
    eq(employee.id, employeeId),
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
  )).limit(1).for('update');
  if (!before) {
    throw new EmployeeUpdateError('employee_not_found', 'Employee not found in the active company.', 404);
  }
  if (input.expectedUpdatedAt != null && !timestampMatches(before.updatedAt, input.expectedUpdatedAt)) {
    throw new EmployeeUpdateError(
      'employee_stale',
      'This employee profile changed in another session. Refresh and review the latest values before saving.',
      409,
    );
  }

  const incomingEmployeeNo = normalizeEmployeeNo(input.employeeNo);
  if (incomingEmployeeNo !== normalizeEmployeeNo(before.employeeNo)) {
    throw new EmployeeUpdateError(
      'employee_no_immutable',
      'Employee number is system-generated and cannot be changed.',
      422,
      { employeeNo: 'Employee number is system-generated and cannot be changed.' },
    );
  }

  const annualEntry = before.annualLeaveDays === annualLeaveDays
    ? null
    : await annualLeaveEntry(exec, scope, employeeId);
  const now = new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1));
  const [updated] = await exec.update(employee).set({
    employeeNo: normalizeEmployeeNo(before.employeeNo),
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    department: input.department.trim(),
    jobTitle: input.jobTitle.trim(),
    employmentType: input.employmentType,
    managerId,
    startDate: input.startDate,
    annualLeaveDays,
    baseSalary: String(input.baseSalary),
    updatedAt: now,
  }).where(and(
    eq(employee.id, employeeId),
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
  )).returning();
  if (!updated) {
    throw new EmployeeUpdateError('employee_not_found', 'Employee not found in the active company.', 404);
  }

  if (updated.userId != null && updated.fullName !== before.fullName) {
    await exec.update(appUser).set({
      fullName: updated.fullName,
      updatedAt: now,
    }).where(and(
      eq(appUser.userId, updated.userId),
      eq(appUser.masterFn, scope.masterFn),
    ));
  }

  if (before.managerId !== managerId) {
    await syncManagerRolesWithin(exec, scope, [before.managerId, managerId]);
  }

  if (before.annualLeaveDays !== annualLeaveDays) {
    const delta = fixedUnits(annualLeaveDays - before.annualLeaveDays, 2);
    if (annualEntry && delta !== 0n) {
      await appendLeaveBalanceEntryWithin(exec, scope, {
        employeeId,
        leaveTypeId: annualEntry.leaveTypeId,
        policyVersionId: annualEntry.policyVersionId,
        entryType: 'adjustment',
        entryKey: `employee:${employeeId}:annual-entitlement:${input.requestId || now.toISOString()}`,
        balanceDelta: fixedString(delta, 2),
        reservedDelta: '0.00',
        effectiveDate: now.toISOString().slice(0, 10),
        sourceType: 'employee_profile',
        sourceId: String(employeeId),
        note: `Annual leave entitlement changed from ${before.annualLeaveDays} to ${annualLeaveDays} days.`,
        createdByUserId: input.actorUserId ?? null,
      });
    } else if (!annualEntry) {
      await initializeEmployeeAnnualLeaveOpeningWithin(
        exec,
        scope,
        employeeId,
        input.actorUserId ?? null,
      );
    }
  }

  return { employee: updated, before };
}

export function updateEmployee(
  db: DB,
  scope: Scope,
  employeeId: number,
  input: UpdateEmployeeInput,
) {
  return db.transaction((tx) => updateEmployeeWithin(tx, scope, employeeId, input));
}

export function createEmployee(
  db: DB,
  scope: Scope,
  input: CreateEmployeeInput,
  actorUserId: number | null = null,
) {
  return db.transaction((tx) => createEmployeeWithin(tx, scope, input, actorUserId));
}
