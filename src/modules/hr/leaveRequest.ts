// HR-lite — request leave, then approve or reject it. Mirrors the quality NCR
// disposition shape (create as pending -> one of two terminal actions) more than
// depreciation-run's single "post", since a leave request has two real outcomes.
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { LEAVE_TYPES, employee, leaveRequest } from '../../data/schema';

export class InvalidLeaveRequestStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLeaveRequestStateError';
  }
}

export interface CreateLeaveRequestInput {
  employeeId: number;
  leaveType: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string | null;
}

function inclusiveDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export async function createLeaveRequestWithin(exec: DB, scope: Scope, input: CreateLeaveRequestInput) {
  if (!LEAVE_TYPES.includes(input.leaveType as typeof LEAVE_TYPES[number])) {
    throw new InvalidLeaveRequestStateError(`leaveType must be one of: ${LEAVE_TYPES.join(', ')}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) {
    throw new InvalidLeaveRequestStateError('startDate and endDate must be YYYY-MM-DD');
  }
  if (input.endDate < input.startDate) {
    throw new InvalidLeaveRequestStateError('endDate must not be before startDate');
  }
  const [emp] = await exec.select({ id: employee.id, isActive: employee.isActive })
    .from(employee)
    .where(and(
      eq(employee.id, input.employeeId),
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
    ))
    .limit(1);
  if (!emp) throw new InvalidLeaveRequestStateError('employeeId does not refer to an employee in this company');
  if (!emp.isActive) throw new InvalidLeaveRequestStateError('cannot request leave for an inactive employee');

  const [row] = await exec.insert(leaveRequest).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    employeeId: input.employeeId,
    leaveType: input.leaveType,
    startDate: input.startDate,
    endDate: input.endDate,
    days: inclusiveDayCount(input.startDate, input.endDate).toFixed(2),
    reason: input.reason?.trim() || null,
    status: 'pending',
  }).returning({ id: leaveRequest.id });
  return { id: row.id };
}

export function createLeaveRequest(db: DB, scope: Scope, input: CreateLeaveRequestInput) {
  return db.transaction((tx) => createLeaveRequestWithin(tx, scope, input));
}

export async function decideLeaveRequestWithin(
  exec: DB,
  scope: Scope,
  leaveRequestId: number,
  decision: 'approved' | 'rejected',
  rejectionReason?: string | null,
  now = new Date(),
) {
  if (decision === 'rejected' && !rejectionReason?.trim()) {
    throw new InvalidLeaveRequestStateError('rejectionReason is required when rejecting a leave request');
  }
  const [row] = await exec.select({
    id: leaveRequest.id,
    status: leaveRequest.status,
    legacyPolicy: leaveRequest.legacyPolicy,
  })
    .from(leaveRequest)
    .where(and(
      eq(leaveRequest.id, leaveRequestId),
      eq(leaveRequest.masterFn, scope.masterFn),
      eq(leaveRequest.companyFn, scope.companyFn),
    ))
    .limit(1);
  if (!row) throw new InvalidLeaveRequestStateError('leave request not found');
  if (!row.legacyPolicy) {
    throw new InvalidLeaveRequestStateError(
      'governed leave must be decided through the versioned approval workflow',
    );
  }
  if (row.status !== 'pending') {
    throw new InvalidLeaveRequestStateError(`leave request is already ${row.status}, not pending`);
  }
  await exec.update(leaveRequest).set({
    status: decision,
    rejectionReason: decision === 'rejected' ? rejectionReason!.trim() : null,
    decidedAt: now,
    updatedAt: now,
  }).where(eq(leaveRequest.id, leaveRequestId));
  return { id: leaveRequestId, status: decision };
}

export function decideLeaveRequest(
  db: DB,
  scope: Scope,
  leaveRequestId: number,
  decision: 'approved' | 'rejected',
  rejectionReason?: string | null,
) {
  return db.transaction((tx) => decideLeaveRequestWithin(tx, scope, leaveRequestId, decision, rejectionReason));
}
