import { and, asc, eq, lte } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  employee,
  leaveBalanceEntry,
  leavePolicyVersion,
  leaveType,
} from '../../data/schema';
import { fixedString, fixedUnits } from '../inventory/decimal';

export const LEAVE_BALANCE_ENTRY_TYPES = [
  'grant',
  'accrual',
  'reserve',
  'use',
  'release',
  'cancellation',
  'adjustment',
  'carry_forward',
  'expiry',
  'encashment',
] as const;
export type LeaveBalanceEntryType = typeof LEAVE_BALANCE_ENTRY_TYPES[number];

export class LeaveBalanceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'LeaveBalanceError';
  }
}

function dayUnits(value: string | number, field: string, allowNegative = false): bigint {
  let units: bigint;
  try {
    units = fixedUnits(value, 2);
  } catch {
    throw new LeaveBalanceError('invalid_days', `${field} must be a valid day value.`);
  }
  if ((!allowNegative && units <= 0n) || units % 50n !== 0n) {
    throw new LeaveBalanceError(
      'invalid_days',
      `${field} must use positive full-day or half-day increments.`,
    );
  }
  return units;
}

function signedDays(units: bigint): string {
  return fixedString(units, 2);
}

export async function projectLeaveBalance(
  exec: DB,
  scope: Scope,
  employeeId: number,
  leaveTypeId: number,
  throughDate?: string,
) {
  const conditions = [
    eq(leaveBalanceEntry.masterFn, scope.masterFn),
    eq(leaveBalanceEntry.companyFn, scope.companyFn),
    eq(leaveBalanceEntry.employeeId, employeeId),
    eq(leaveBalanceEntry.leaveTypeId, leaveTypeId),
  ];
  if (throughDate) conditions.push(lte(leaveBalanceEntry.effectiveDate, throughDate));
  const rows = await exec.select({
    balanceDelta: leaveBalanceEntry.balanceDelta,
    reservedDelta: leaveBalanceEntry.reservedDelta,
  }).from(leaveBalanceEntry)
    .where(and(...conditions))
    .orderBy(asc(leaveBalanceEntry.id));
  const balance = rows.reduce((sum, row) => sum + fixedUnits(row.balanceDelta, 2), 0n);
  const reserved = rows.reduce((sum, row) => sum + fixedUnits(row.reservedDelta, 2), 0n);
  return {
    balance: signedDays(balance),
    reserved: signedDays(reserved),
    available: signedDays(balance - reserved),
    entryCount: rows.length,
  };
}

export interface AppendLeaveBalanceEntryInput {
  employeeId: number;
  leaveTypeId: number;
  policyVersionId: number;
  entryType: LeaveBalanceEntryType;
  entryKey: string;
  balanceDelta: string | number;
  reservedDelta: string | number;
  effectiveDate: string;
  sourceType: string;
  sourceId: string;
  note?: string | null;
  createdByUserId?: number | null;
}

export async function appendLeaveBalanceEntryWithin(
  exec: DB,
  scope: Scope,
  input: AppendLeaveBalanceEntryInput,
) {
  const entryKey = input.entryKey?.trim();
  const sourceType = input.sourceType?.trim();
  const sourceId = input.sourceId?.trim();
  const note = input.note?.trim() || null;
  if (!entryKey || !sourceType || !sourceId || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    throw new LeaveBalanceError('invalid_entry', 'Entry key, source and effective date are required.');
  }
  const balanceDelta = dayUnits(input.balanceDelta, 'Balance delta', true);
  const reservedDelta = dayUnits(input.reservedDelta, 'Reserved delta', true);
  if (balanceDelta === 0n && reservedDelta === 0n) {
    throw new LeaveBalanceError('zero_entry', 'A ledger entry must change balance or reservation.');
  }
  const [existing] = await exec.select().from(leaveBalanceEntry).where(and(
    eq(leaveBalanceEntry.masterFn, scope.masterFn),
    eq(leaveBalanceEntry.companyFn, scope.companyFn),
    eq(leaveBalanceEntry.entryKey, entryKey),
  )).limit(1);
  if (existing) {
    if (
      existing.employeeId !== input.employeeId
      || existing.leaveTypeId !== input.leaveTypeId
      || existing.policyVersionId !== input.policyVersionId
      || existing.entryType !== input.entryType
      || existing.balanceDelta !== signedDays(balanceDelta)
      || existing.reservedDelta !== signedDays(reservedDelta)
      || existing.effectiveDate !== input.effectiveDate
      || existing.sourceType !== sourceType
      || existing.sourceId !== sourceId
      || existing.note !== note
      || existing.createdByUserId !== (input.createdByUserId ?? null)
    ) {
      throw new LeaveBalanceError(
        'entry_key_conflict',
        'This immutable entry key is already used by a different fact.',
      );
    }
    return { id: existing.id, replayed: true };
  }
  const [context] = await exec.select({
    policyStatus: leavePolicyVersion.status,
    policyLeaveTypeId: leavePolicyVersion.leaveTypeId,
  }).from(employee)
    .innerJoin(leavePolicyVersion, and(
      eq(leavePolicyVersion.id, input.policyVersionId),
      eq(leavePolicyVersion.masterFn, employee.masterFn),
      eq(leavePolicyVersion.companyFn, employee.companyFn),
    ))
    .where(and(
      eq(employee.id, input.employeeId),
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
    ))
    .limit(1);
  if (
    !context
    || context.policyLeaveTypeId !== input.leaveTypeId
    || context.policyStatus !== 'confirmed'
  ) {
    throw new LeaveBalanceError('ledger_context_mismatch', 'Employee, leave type and policy must share one company.');
  }
  const [row] = await exec.insert(leaveBalanceEntry).values({
    ...scope,
    ...input,
    entryKey,
    sourceType,
    sourceId,
    note,
    balanceDelta: signedDays(balanceDelta),
    reservedDelta: signedDays(reservedDelta),
  }).returning({ id: leaveBalanceEntry.id });
  return { id: row.id, replayed: false };
}

export function appendLeaveBalanceEntry(
  db: DB,
  scope: Scope,
  input: AppendLeaveBalanceEntryInput,
) {
  return db.transaction((tx) => appendLeaveBalanceEntryWithin(tx, scope, input));
}

export async function reservePaidLeave(
  db: DB,
  scope: Scope,
  input: {
    employeeId: number;
    leaveTypeId: number;
    policyVersionId: number;
    days: string | number;
    effectiveDate: string;
    requestReference: string;
    actorUserId: number;
  },
) {
  const requested = dayUnits(input.days, 'Requested days');
  return db.transaction(async (tx) => {
    const [subject] = await tx.select({ id: employee.id }).from(employee).where(and(
      eq(employee.id, input.employeeId),
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.isActive, true),
    )).limit(1).for('update');
    if (!subject) throw new LeaveBalanceError('employee_unavailable', 'Active employee not found.');
    const [type] = await tx.select({ paid: leaveType.paid }).from(leaveType).where(and(
      eq(leaveType.id, input.leaveTypeId),
      eq(leaveType.masterFn, scope.masterFn),
      eq(leaveType.companyFn, scope.companyFn),
    )).limit(1);
    if (!type?.paid) {
      throw new LeaveBalanceError('paid_balance_not_applicable', 'This leave type does not use paid balance.');
    }
    const ledgerInput: AppendLeaveBalanceEntryInput = {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      policyVersionId: input.policyVersionId,
      entryType: 'reserve',
      entryKey: `leave:${input.requestReference}:reserve`,
      balanceDelta: '0.00',
      reservedDelta: signedDays(requested),
      effectiveDate: input.effectiveDate,
      sourceType: 'leave_request',
      sourceId: input.requestReference,
      createdByUserId: input.actorUserId,
    };
    const [existing] = await tx.select({ id: leaveBalanceEntry.id })
      .from(leaveBalanceEntry)
      .where(and(
        eq(leaveBalanceEntry.masterFn, scope.masterFn),
        eq(leaveBalanceEntry.companyFn, scope.companyFn),
        eq(leaveBalanceEntry.entryKey, ledgerInput.entryKey),
      ))
      .limit(1);
    if (existing) {
      const appended = await appendLeaveBalanceEntryWithin(tx, scope, ledgerInput);
      return {
        ...appended,
        projection: await projectLeaveBalance(
          tx, scope, input.employeeId, input.leaveTypeId, input.effectiveDate,
        ),
      };
    }
    const projection = await projectLeaveBalance(
      tx,
      scope,
      input.employeeId,
      input.leaveTypeId,
      input.effectiveDate,
    );
    const available = fixedUnits(projection.available, 2);
    if (available < requested) {
      const paid = available > 0n ? available : 0n;
      throw new LeaveBalanceError(
        'insufficient_paid_balance',
        'Paid leave balance is insufficient.',
        {
          requestedDays: signedDays(requested),
          availablePaidDays: signedDays(paid),
          suggestedUnpaidDays: signedDays(requested - paid),
        },
      );
    }
    const appended = await appendLeaveBalanceEntryWithin(tx, scope, ledgerInput);
    return {
      ...appended,
      projection: await projectLeaveBalance(
        tx,
        scope,
        input.employeeId,
        input.leaveTypeId,
        input.effectiveDate,
      ),
    };
  });
}

export async function settlePaidLeaveReservation(
  db: DB,
  scope: Scope,
  input: {
    employeeId: number;
    leaveTypeId: number;
    policyVersionId: number;
    days: string | number;
    effectiveDate: string;
    requestReference: string;
    outcome: 'use' | 'release';
    actorUserId: number;
  },
) {
  const days = dayUnits(input.days, 'Settlement days');
  return db.transaction(async (tx) => {
    await tx.select({ id: employee.id }).from(employee).where(and(
      eq(employee.id, input.employeeId),
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
    )).limit(1).for('update');
    const ledgerInput: AppendLeaveBalanceEntryInput = {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      policyVersionId: input.policyVersionId,
      entryType: input.outcome,
      entryKey: `leave:${input.requestReference}:${input.outcome}`,
      balanceDelta: input.outcome === 'use' ? signedDays(-days) : '0.00',
      reservedDelta: signedDays(-days),
      effectiveDate: input.effectiveDate,
      sourceType: 'leave_request',
      sourceId: input.requestReference,
      createdByUserId: input.actorUserId,
    };
    const [existing] = await tx.select({ id: leaveBalanceEntry.id })
      .from(leaveBalanceEntry)
      .where(and(
        eq(leaveBalanceEntry.masterFn, scope.masterFn),
        eq(leaveBalanceEntry.companyFn, scope.companyFn),
        eq(leaveBalanceEntry.entryKey, ledgerInput.entryKey),
      ))
      .limit(1);
    if (existing) return appendLeaveBalanceEntryWithin(tx, scope, ledgerInput);
    const projection = await projectLeaveBalance(
      tx, scope, input.employeeId, input.leaveTypeId, input.effectiveDate,
    );
    if (fixedUnits(projection.reserved, 2) < days) {
      throw new LeaveBalanceError('reservation_insufficient', 'Reserved balance is insufficient for this outcome.');
    }
    return appendLeaveBalanceEntryWithin(tx, scope, ledgerInput);
  });
}
