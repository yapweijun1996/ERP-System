import {
  and, eq, gte, isNull, lte, or,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  employee,
  leavePolicyVersion,
  leaveRequest,
  leaveRequestRevision,
  leaveType,
  payrollLeaveSource,
} from '../../data/schema';
import { fixedString, fixedUnits } from '../inventory/decimal';
import {
  appendLeaveBalanceEntryWithin,
  projectLeaveBalance,
} from '../hr/leaveBalance';

const PAYROLL_DIVISOR_DAYS = '26.00';

export class PayrollLeaveError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'PayrollLeaveError';
  }
}

function halfDayUnits(value: string | number, label: string): bigint {
  const hundredths = fixedUnits(value, 2);
  if (hundredths <= 0n || hundredths % 50n !== 0n) {
    throw new PayrollLeaveError(
      'payroll_leave_days_invalid',
      `${label} must be a positive full or half-day value.`,
      422,
    );
  }
  return hundredths;
}

/** Exact half-up cents for monthly base salary ÷ 26 × days. */
export function payrollLeaveAmount(baseSalary: string, days: string | number): string {
  const salaryCents = fixedUnits(baseSalary, 2);
  const dayHundredths = halfDayUnits(days, 'Payroll leave days');
  const denominator = 2600n;
  const amountCents = (salaryCents * dayHundredths + denominator / 2n) / denominator;
  return fixedString(amountCents, 2);
}

interface AppendPayrollLeaveSourceInput {
  employeeId: number;
  leaveRequestId?: number | null;
  leaveRevisionNo?: number | null;
  leaveBalanceEntryId?: number | null;
  sourceType: 'unpaid_leave' | 'unpaid_leave_cancellation' | 'encashment';
  effectDirection: 'earning' | 'deduction';
  sourceKey: string;
  days: string;
  baseSalarySnapshot: string;
  amount: string;
  effectiveDate: string;
  createdByUserId?: number | null;
}

async function appendPayrollLeaveSourceWithin(
  exec: DB,
  scope: Scope,
  input: AppendPayrollLeaveSourceInput,
) {
  const [existing] = await exec.select().from(payrollLeaveSource).where(and(
    eq(payrollLeaveSource.masterFn, scope.masterFn),
    eq(payrollLeaveSource.companyFn, scope.companyFn),
    eq(payrollLeaveSource.sourceKey, input.sourceKey),
  )).limit(1);
  const normalized = {
    ...input,
    leaveRequestId: input.leaveRequestId ?? null,
    leaveRevisionNo: input.leaveRevisionNo ?? null,
    leaveBalanceEntryId: input.leaveBalanceEntryId ?? null,
    divisorDays: PAYROLL_DIVISOR_DAYS,
    createdByUserId: input.createdByUserId ?? null,
  };
  if (existing) {
    if (
      existing.employeeId !== normalized.employeeId
      || existing.leaveRequestId !== normalized.leaveRequestId
      || existing.leaveRevisionNo !== normalized.leaveRevisionNo
      || existing.leaveBalanceEntryId !== normalized.leaveBalanceEntryId
      || existing.sourceType !== normalized.sourceType
      || existing.effectDirection !== normalized.effectDirection
      || existing.days !== normalized.days
      || existing.baseSalarySnapshot !== normalized.baseSalarySnapshot
      || existing.divisorDays !== normalized.divisorDays
      || existing.amount !== normalized.amount
      || existing.effectiveDate !== normalized.effectiveDate
      || existing.createdByUserId !== normalized.createdByUserId
    ) {
      throw new PayrollLeaveError(
        'payroll_leave_source_conflict',
        'This immutable Payroll source key is already used by a different fact.',
        409,
      );
    }
    return { ...existing, replayed: true };
  }
  const [created] = await exec.insert(payrollLeaveSource).values({
    ...scope,
    ...normalized,
  }).returning();
  return { ...created, replayed: false };
}

export async function createUnpaidLeavePayrollSourceWithin(
  exec: DB,
  scope: Scope,
  input: {
    requestId: number;
    actorUserId: number;
    cancellationId?: number | null;
  },
  now = new Date(),
) {
  const [source] = await exec.select({
    requestId: leaveRequest.id,
    status: leaveRequest.status,
    revisionNo: leaveRequest.currentRevisionNo,
    employeeId: leaveRequest.employeeId,
    startDate: leaveRequestRevision.startDate,
    days: leaveRequestRevision.days,
    paid: leaveType.paid,
    baseSalary: employee.baseSalary,
  }).from(leaveRequest)
    .innerJoin(leaveRequestRevision, and(
      eq(leaveRequestRevision.requestId, leaveRequest.id),
      eq(leaveRequestRevision.masterFn, leaveRequest.masterFn),
      eq(leaveRequestRevision.companyFn, leaveRequest.companyFn),
      eq(leaveRequestRevision.revisionNo, leaveRequest.currentRevisionNo),
    ))
    .innerJoin(leaveType, and(
      eq(leaveType.id, leaveRequestRevision.leaveTypeId),
      eq(leaveType.masterFn, leaveRequest.masterFn),
      eq(leaveType.companyFn, leaveRequest.companyFn),
    ))
    .innerJoin(employee, and(
      eq(employee.id, leaveRequest.employeeId),
      eq(employee.masterFn, leaveRequest.masterFn),
      eq(employee.companyFn, leaveRequest.companyFn),
    ))
    .where(and(
      eq(leaveRequest.masterFn, scope.masterFn),
      eq(leaveRequest.companyFn, scope.companyFn),
      eq(leaveRequest.id, input.requestId),
    )).limit(1);
  if (!source) {
    throw new PayrollLeaveError(
      'payroll_leave_request_missing',
      'The governed leave revision is unavailable for Payroll.',
      404,
    );
  }
  if (source.paid) return null;
  const isCancellation = Number.isInteger(input.cancellationId);
  const expectedStatus = isCancellation ? 'cancelled' : 'approved';
  if (source.status !== expectedStatus) {
    throw new PayrollLeaveError(
      'payroll_leave_state_invalid',
      `${expectedStatus} unpaid leave is required for this Payroll source.`,
      409,
    );
  }
  const sourceType = isCancellation ? 'unpaid_leave_cancellation' : 'unpaid_leave';
  const sourceKey = isCancellation
    ? `leave:${source.requestId}:revision:${source.revisionNo}:cancellation:${input.cancellationId}`
    : `leave:${source.requestId}:revision:${source.revisionNo}:unpaid`;
  const cancellationDate = now.toISOString().slice(0, 10);
  return appendPayrollLeaveSourceWithin(exec, scope, {
    employeeId: source.employeeId,
    leaveRequestId: source.requestId,
    leaveRevisionNo: source.revisionNo,
    sourceType,
    effectDirection: isCancellation ? 'earning' : 'deduction',
    sourceKey,
    days: source.days,
    baseSalarySnapshot: source.baseSalary,
    amount: payrollLeaveAmount(source.baseSalary, source.days),
    effectiveDate: isCancellation && cancellationDate > source.startDate
      ? cancellationDate
      : source.startDate,
    createdByUserId: input.actorUserId,
  });
}

export interface ApproveLeaveEncashmentInput {
  employeeId: number;
  leaveTypeId: number;
  policyVersionId: number;
  days: string | number;
  effectiveDate: string;
  eventKey: string;
  actorUserId: number;
  note?: string | null;
}

export async function approveLeaveEncashmentWithin(
  exec: DB,
  scope: Scope,
  input: ApproveLeaveEncashmentInput,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    throw new PayrollLeaveError(
      'encashment_date_invalid',
      'Encashment effective date must use YYYY-MM-DD.',
      422,
    );
  }
  const eventKey = input.eventKey?.trim();
  if (!eventKey || eventKey.length > 160) {
    throw new PayrollLeaveError(
      'encashment_event_key_invalid',
      'A bounded encashment event key is required.',
      422,
    );
  }
  const days = halfDayUnits(input.days, 'Encashment days');
  const dayValue = fixedString(days, 2);
  const [context] = await exec.select({
    employeeId: employee.id,
    employmentType: employee.employmentType,
    baseSalary: employee.baseSalary,
    policyLeaveTypeId: leavePolicyVersion.leaveTypeId,
    encashmentAllowed: leavePolicyVersion.encashmentAllowed,
    encashmentMaxDays: leavePolicyVersion.encashmentMaxDays,
    eligibleEmploymentTypes: leavePolicyVersion.eligibleEmploymentTypes,
    paid: leaveType.paid,
  }).from(employee)
    .innerJoin(leavePolicyVersion, and(
      eq(leavePolicyVersion.id, input.policyVersionId),
      eq(leavePolicyVersion.masterFn, employee.masterFn),
      eq(leavePolicyVersion.companyFn, employee.companyFn),
      eq(leavePolicyVersion.status, 'confirmed'),
      lte(leavePolicyVersion.effectiveFrom, input.effectiveDate),
      or(
        isNull(leavePolicyVersion.effectiveTo),
        gte(leavePolicyVersion.effectiveTo, input.effectiveDate),
      ),
    ))
    .innerJoin(leaveType, and(
      eq(leaveType.id, input.leaveTypeId),
      eq(leaveType.masterFn, employee.masterFn),
      eq(leaveType.companyFn, employee.companyFn),
    ))
    .where(and(
      eq(employee.id, input.employeeId),
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.isActive, true),
    )).limit(1).for('update');
  if (!context || context.policyLeaveTypeId !== input.leaveTypeId) {
    throw new PayrollLeaveError(
      'encashment_context_invalid',
      'Employee, leave type and confirmed policy must share one active company.',
      422,
    );
  }
  const eligible = Array.isArray(context.eligibleEmploymentTypes)
    && context.eligibleEmploymentTypes.includes(context.employmentType);
  if (!context.paid || !context.encashmentAllowed || !eligible) {
    throw new PayrollLeaveError(
      'encashment_not_allowed',
      'This confirmed leave policy does not allow encashment for the employee.',
      422,
    );
  }
  if (days > fixedUnits(context.encashmentMaxDays, 2)) {
    throw new PayrollLeaveError(
      'encashment_limit_exceeded',
      `Encashment exceeds the policy maximum of ${context.encashmentMaxDays} days.`,
      422,
    );
  }
  const sourceKey = `encashment:${eventKey}`;
  const amount = payrollLeaveAmount(context.baseSalary, dayValue);
  const [existingSource] = await exec.select()
    .from(payrollLeaveSource)
    .where(and(
      eq(payrollLeaveSource.masterFn, scope.masterFn),
      eq(payrollLeaveSource.companyFn, scope.companyFn),
      eq(payrollLeaveSource.sourceKey, sourceKey),
    ))
    .limit(1);
  if (existingSource) {
    return appendPayrollLeaveSourceWithin(exec, scope, {
      employeeId: input.employeeId,
      leaveBalanceEntryId: existingSource.leaveBalanceEntryId,
      sourceType: 'encashment',
      effectDirection: 'earning',
      sourceKey,
      days: dayValue,
      baseSalarySnapshot: context.baseSalary,
      amount,
      effectiveDate: input.effectiveDate,
      createdByUserId: input.actorUserId,
    });
  }
  const projection = await projectLeaveBalance(
    exec,
    scope,
    input.employeeId,
    input.leaveTypeId,
    input.effectiveDate,
  );
  if (fixedUnits(projection.available, 2) < days) {
    throw new PayrollLeaveError(
      'encashment_balance_insufficient',
      'Available leave balance is insufficient for this encashment.',
      422,
    );
  }
  const ledger = await appendLeaveBalanceEntryWithin(exec, scope, {
    employeeId: input.employeeId,
    leaveTypeId: input.leaveTypeId,
    policyVersionId: input.policyVersionId,
    entryType: 'encashment',
    entryKey: `payroll:encashment:${eventKey}`,
    balanceDelta: fixedString(-days, 2),
    reservedDelta: '0.00',
    effectiveDate: input.effectiveDate,
    sourceType: 'leave_encashment',
    sourceId: eventKey,
    note: input.note,
    createdByUserId: input.actorUserId,
  });
  return appendPayrollLeaveSourceWithin(exec, scope, {
    employeeId: input.employeeId,
    leaveBalanceEntryId: ledger.id,
    sourceType: 'encashment',
    effectDirection: 'earning',
    sourceKey,
    days: dayValue,
    baseSalarySnapshot: context.baseSalary,
    amount,
    effectiveDate: input.effectiveDate,
    createdByUserId: input.actorUserId,
  });
}

export function approveLeaveEncashment(
  db: DB,
  scope: Scope,
  input: ApproveLeaveEncashmentInput,
) {
  return db.transaction((tx) => approveLeaveEncashmentWithin(tx, scope, input));
}
