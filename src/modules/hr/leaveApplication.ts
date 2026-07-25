import {
  and, desc, eq,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  employee,
  leaveCancellationRequest,
  leaveEvidence,
  leaveRequest,
  leaveRequestEvent,
  leaveRequestRevision,
  leaveType,
} from '../../data/schema';
import { fixedUnits } from '../inventory/decimal';
import {
  appendLeaveBalanceEntryWithin,
  reservePaidLeaveWithin,
  settlePaidLeaveReservationWithin,
} from './leaveBalance';
import { enqueueLeaveCalendarSyncWithin } from './calendarSync';
import { createUnpaidLeavePayrollSourceWithin } from '../payroll/payrollLeave';
import {
  decideLeaveApprovalWithin,
  startLeaveApprovalWithin,
} from './leaveApproval';
import { cancelApprovalForEntityWithin } from '../approval/workflow';
import {
  calculateLeaveDuration,
  resolveLeavePolicyVersion,
  resolveWorkingCalendarVersion,
  type LeaveDurationUnit,
} from './leavePolicy';

export type GovernedLeaveStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'voided'
  | 'cancelled';

export interface LeaveApplicationActor {
  userId: number;
  employeeId?: number | null;
  canManage?: boolean;
}

export class LeaveApplicationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'LeaveApplicationError';
  }
}

export interface LeaveRevisionInput {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  unit: LeaveDurationUnit;
  reason?: string | null;
  changeReason?: string | null;
}

function cleanReason(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function requireReason(value: string | null | undefined, code: string): string {
  const reason = cleanReason(value);
  if (!reason || reason.length < 3 || reason.length > 500) {
    throw new LeaveApplicationError(code, 'A reason between 3 and 500 characters is required.');
  }
  return reason;
}

function requireExpectedVersion(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new LeaveApplicationError('expected_version_required', 'A positive expectedVersion is required.', 400);
  }
}

function assertOwnerOrManager(
  row: { employeeId: number },
  actor: LeaveApplicationActor,
): void {
  if (actor.canManage) return;
  if (!actor.employeeId || actor.employeeId !== row.employeeId) {
    throw new LeaveApplicationError(
      'leave_request_not_owned',
      'This leave application does not belong to the signed-in employee.',
      404,
    );
  }
}

async function requestForUpdate(exec: DB, scope: Scope, requestId: number) {
  const [row] = await exec.select().from(leaveRequest).where(and(
    eq(leaveRequest.id, requestId),
    eq(leaveRequest.masterFn, scope.masterFn),
    eq(leaveRequest.companyFn, scope.companyFn),
  )).limit(1).for('update');
  if (!row || row.legacyPolicy) {
    throw new LeaveApplicationError(
      'governed_leave_not_found',
      'Governed leave application not found.',
      404,
    );
  }
  return row;
}

function assertVersion(row: { version: number }, expectedVersion: number): void {
  requireExpectedVersion(expectedVersion);
  if (row.version !== expectedVersion) {
    throw new LeaveApplicationError(
      'leave_version_conflict',
      'This leave application changed after it was loaded.',
      409,
      { expectedVersion: String(expectedVersion), actualVersion: String(row.version) },
    );
  }
}

async function appendEvent(
  exec: DB,
  scope: Scope,
  input: {
    requestId: number;
    revisionNo?: number | null;
    eventType: typeof leaveRequestEvent.$inferInsert.eventType;
    fromStatus?: string | null;
    toStatus?: string | null;
    reason?: string | null;
    eventKey: string;
    actorUserId: number;
    occurredAt?: Date;
  },
) {
  await exec.insert(leaveRequestEvent).values({
    ...scope,
    requestId: input.requestId,
    revisionNo: input.revisionNo ?? null,
    eventType: input.eventType,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    reason: cleanReason(input.reason),
    eventKey: input.eventKey,
    actorUserId: input.actorUserId,
    occurredAt: input.occurredAt ?? new Date(),
  });
}

async function revisionSnapshot(
  exec: DB,
  scope: Scope,
  employeeId: number,
  input: LeaveRevisionInput,
) {
  if (!Number.isSafeInteger(input.leaveTypeId) || input.leaveTypeId <= 0) {
    throw new LeaveApplicationError('invalid_leave_type', 'Select a valid leave type.');
  }
  const [subject] = await exec.select({
    id: employee.id,
    active: employee.isActive,
    employmentType: employee.employmentType,
  }).from(employee).where(and(
    eq(employee.id, employeeId),
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
  )).limit(1);
  if (!subject?.active) {
    throw new LeaveApplicationError('employee_unavailable', 'Active employee not found.');
  }
  const [type] = await exec.select().from(leaveType).where(and(
    eq(leaveType.id, input.leaveTypeId),
    eq(leaveType.masterFn, scope.masterFn),
    eq(leaveType.companyFn, scope.companyFn),
    eq(leaveType.isActive, true),
  )).limit(1);
  if (!type) throw new LeaveApplicationError('leave_type_unavailable', 'Active leave type not found.');
  const policy = await resolveLeavePolicyVersion(exec, scope, type.id, input.startDate);
  if (!(policy.eligibleEmploymentTypes as string[]).includes(subject.employmentType)) {
    throw new LeaveApplicationError(
      'leave_policy_ineligible',
      'The employee is not eligible for this leave policy.',
    );
  }
  const startCalendar = await resolveWorkingCalendarVersion(
    exec, scope, policy.calendarId, input.startDate,
  );
  const endCalendar = await resolveWorkingCalendarVersion(
    exec, scope, policy.calendarId, input.endDate,
  );
  if (startCalendar.id !== endCalendar.id) {
    throw new LeaveApplicationError(
      'leave_crosses_calendar_version',
      'A leave application cannot cross two working-calendar versions.',
    );
  }
  const duration = await calculateLeaveDuration(exec, scope, {
    calendarId: policy.calendarId,
    startDate: input.startDate,
    endDate: input.endDate,
    unit: input.unit,
  });
  if (fixedUnits(duration.days, 2) <= 0n) {
    throw new LeaveApplicationError(
      'leave_has_no_working_days',
      'The selected range contains no chargeable working day.',
    );
  }
  const evidenceRequired = policy.evidenceAfterDays != null
    && fixedUnits(duration.days, 2) >= fixedUnits(policy.evidenceAfterDays, 2);
  return {
    type,
    policy,
    calendarVersionId: startCalendar.id,
    days: duration.days,
    unit: duration.unit,
    reason: cleanReason(input.reason),
    evidenceRequired,
  };
}

export async function createLeaveDraftWithin(
  exec: DB,
  scope: Scope,
  actor: LeaveApplicationActor,
  employeeId: number,
  input: LeaveRevisionInput,
  now = new Date(),
) {
  if (!actor.canManage && actor.employeeId !== employeeId) {
    throw new LeaveApplicationError(
      'employee_identity_mismatch',
      'Employee identity is derived from the signed-in Session.',
      403,
    );
  }
  const snapshot = await revisionSnapshot(exec, scope, employeeId, input);
  const [request] = await exec.insert(leaveRequest).values({
    ...scope,
    employeeId,
    leaveTypeId: snapshot.type.id,
    policyVersionId: snapshot.policy.id,
    calendarVersionId: snapshot.calendarVersionId,
    leaveType: snapshot.type.name,
    startDate: input.startDate,
    endDate: input.endDate,
    unit: snapshot.unit,
    days: snapshot.days,
    reason: snapshot.reason,
    status: 'draft',
    version: 1,
    currentRevisionNo: 1,
    legacyPolicy: false,
    createdByUserId: actor.userId,
    onBehalfByUserId: actor.canManage && actor.employeeId !== employeeId ? actor.userId : null,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: leaveRequest.id });
  await exec.insert(leaveRequestRevision).values({
    ...scope,
    requestId: request.id,
    revisionNo: 1,
    leaveTypeId: snapshot.type.id,
    policyVersionId: snapshot.policy.id,
    calendarVersionId: snapshot.calendarVersionId,
    startDate: input.startDate,
    endDate: input.endDate,
    unit: snapshot.unit,
    days: snapshot.days,
    reason: snapshot.reason,
    evidenceRequired: snapshot.evidenceRequired,
    createdByUserId: actor.userId,
    createdAt: now,
  });
  await appendEvent(exec, scope, {
    requestId: request.id,
    revisionNo: 1,
    eventType: 'created_draft',
    toStatus: 'draft',
    eventKey: `leave:${request.id}:created`,
    actorUserId: actor.userId,
    occurredAt: now,
  });
  return { id: request.id, status: 'draft' as const, version: 1, revisionNo: 1 };
}

export async function amendLeaveApplicationWithin(
  exec: DB,
  scope: Scope,
  actor: LeaveApplicationActor,
  requestId: number,
  expectedVersion: number,
  input: LeaveRevisionInput,
  now = new Date(),
) {
  const row = await requestForUpdate(exec, scope, requestId);
  assertOwnerOrManager(row, actor);
  assertVersion(row, expectedVersion);
  if (!['draft', 'rejected', 'withdrawn'].includes(row.status)) {
    throw new LeaveApplicationError(
      'leave_not_amendable',
      'Only Draft, Rejected or Withdrawn leave can be amended.',
      409,
    );
  }
  const changeReason = requireReason(input.changeReason, 'amendment_reason_required');
  const snapshot = await revisionSnapshot(exec, scope, row.employeeId, input);
  const revisionNo = row.currentRevisionNo + 1;
  const version = row.version + 1;
  await exec.insert(leaveRequestRevision).values({
    ...scope,
    requestId: row.id,
    revisionNo,
    leaveTypeId: snapshot.type.id,
    policyVersionId: snapshot.policy.id,
    calendarVersionId: snapshot.calendarVersionId,
    startDate: input.startDate,
    endDate: input.endDate,
    unit: snapshot.unit,
    days: snapshot.days,
    reason: snapshot.reason,
    changeReason,
    evidenceRequired: snapshot.evidenceRequired,
    createdByUserId: actor.userId,
    createdAt: now,
  });
  await exec.update(leaveRequest).set({
    leaveTypeId: snapshot.type.id,
    policyVersionId: snapshot.policy.id,
    calendarVersionId: snapshot.calendarVersionId,
    leaveType: snapshot.type.name,
    startDate: input.startDate,
    endDate: input.endDate,
    unit: snapshot.unit,
    days: snapshot.days,
    reason: snapshot.reason,
    status: 'draft',
    version,
    currentRevisionNo: revisionNo,
    rejectionReason: null,
    decidedAt: null,
    decidedByUserId: null,
    submittedAt: null,
    withdrawnAt: null,
    updatedAt: now,
  }).where(eq(leaveRequest.id, row.id));
  await appendEvent(exec, scope, {
    requestId: row.id,
    revisionNo,
    eventType: 'amended',
    fromStatus: row.status,
    toStatus: 'draft',
    reason: changeReason,
    eventKey: `leave:${row.id}:revision:${revisionNo}`,
    actorUserId: actor.userId,
    occurredAt: now,
  });
  return { id: row.id, status: 'draft' as const, version, revisionNo };
}

async function currentRevision(exec: DB, scope: Scope, row: {
  id: number;
  currentRevisionNo: number;
}) {
  const [revision] = await exec.select().from(leaveRequestRevision).where(and(
    eq(leaveRequestRevision.masterFn, scope.masterFn),
    eq(leaveRequestRevision.companyFn, scope.companyFn),
    eq(leaveRequestRevision.requestId, row.id),
    eq(leaveRequestRevision.revisionNo, row.currentRevisionNo),
  )).limit(1);
  if (!revision) {
    throw new LeaveApplicationError('leave_revision_missing', 'Current leave revision is missing.', 409);
  }
  return revision;
}

async function latestEvidenceState(
  exec: DB,
  scope: Scope,
  requestId: number,
  revisionNo: number,
) {
  const [evidence] = await exec.select({
    state: leaveEvidence.state,
  }).from(leaveEvidence).where(and(
    eq(leaveEvidence.masterFn, scope.masterFn),
    eq(leaveEvidence.companyFn, scope.companyFn),
    eq(leaveEvidence.requestId, requestId),
    eq(leaveEvidence.revisionNo, revisionNo),
  )).orderBy(desc(leaveEvidence.id)).limit(1);
  return evidence?.state ?? 'missing';
}

function ledgerReference(row: { id: number; currentRevisionNo: number }): string {
  return `${row.id}:revision:${row.currentRevisionNo}`;
}

export async function submitLeaveApplicationWithin(
  exec: DB,
  scope: Scope,
  actor: LeaveApplicationActor,
  requestId: number,
  expectedVersion: number,
  now = new Date(),
) {
  const row = await requestForUpdate(exec, scope, requestId);
  assertOwnerOrManager(row, actor);
  assertVersion(row, expectedVersion);
  if (row.status !== 'draft') {
    throw new LeaveApplicationError('leave_not_draft', 'Only Draft leave can be submitted.', 409);
  }
  const revision = await currentRevision(exec, scope, row);
  if (revision.evidenceRequired) {
    const state = await latestEvidenceState(exec, scope, row.id, row.currentRevisionNo);
    if (!['received', 'verified'].includes(state)) {
      throw new LeaveApplicationError(
        'leave_evidence_required',
        'Required medical evidence has not been received.',
        422,
      );
    }
  }
  const [type] = await exec.select({ paid: leaveType.paid }).from(leaveType)
    .where(eq(leaveType.id, revision.leaveTypeId)).limit(1);
  if (type?.paid) {
    await reservePaidLeaveWithin(exec, scope, {
      employeeId: row.employeeId,
      leaveTypeId: revision.leaveTypeId,
      policyVersionId: revision.policyVersionId,
      days: revision.days,
      effectiveDate: revision.startDate,
      requestReference: ledgerReference(row),
      actorUserId: actor.userId,
    });
  }
  const approval = await startLeaveApprovalWithin(exec, scope, {
    requestId: row.id,
    revisionNo: row.currentRevisionNo,
    employeeId: row.employeeId,
    submittedByUserId: actor.userId,
    leaveTypeId: revision.leaveTypeId,
    startDate: revision.startDate,
    endDate: revision.endDate,
    days: revision.days,
  }, now);
  const version = row.version + 1;
  await exec.update(leaveRequest).set({
    status: 'pending',
    version,
    submittedAt: now,
    updatedAt: now,
  }).where(eq(leaveRequest.id, row.id));
  await appendEvent(exec, scope, {
    requestId: row.id,
    revisionNo: row.currentRevisionNo,
    eventType: 'submitted',
    fromStatus: 'draft',
    toStatus: 'pending',
    eventKey: `leave:${row.id}:revision:${row.currentRevisionNo}:submitted`,
    actorUserId: actor.userId,
    occurredAt: now,
  });
  return { id: row.id, status: 'pending' as const, version, approval };
}

async function releaseReservationIfPaid(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  row: Awaited<ReturnType<typeof requestForUpdate>>,
  outcome: 'use' | 'release',
) {
  const revision = await currentRevision(exec, scope, row);
  const [type] = await exec.select({ paid: leaveType.paid }).from(leaveType)
    .where(eq(leaveType.id, revision.leaveTypeId)).limit(1);
  if (!type?.paid) return revision;
  await settlePaidLeaveReservationWithin(exec, scope, {
    employeeId: row.employeeId,
    leaveTypeId: revision.leaveTypeId,
    policyVersionId: revision.policyVersionId,
    days: revision.days,
    effectiveDate: revision.startDate,
    requestReference: ledgerReference(row),
    outcome,
    actorUserId,
  });
  return revision;
}

export async function withdrawLeaveApplicationWithin(
  exec: DB,
  scope: Scope,
  actor: LeaveApplicationActor,
  requestId: number,
  expectedVersion: number,
  reason: string,
  now = new Date(),
) {
  const row = await requestForUpdate(exec, scope, requestId);
  assertOwnerOrManager(row, actor);
  assertVersion(row, expectedVersion);
  if (row.status !== 'pending') {
    throw new LeaveApplicationError('leave_not_pending', 'Only Pending leave can be withdrawn.', 409);
  }
  const normalizedReason = requireReason(reason, 'withdrawal_reason_required');
  await cancelApprovalForEntityWithin(exec, scope, {
    domain: 'leave',
    entityType: 'leave_request',
    entityId: row.id,
    actorUserId: actor.userId,
    reason: normalizedReason,
  }, now);
  await releaseReservationIfPaid(exec, scope, actor.userId, row, 'release');
  const version = row.version + 1;
  await exec.update(leaveRequest).set({
    status: 'withdrawn', version, withdrawnAt: now, updatedAt: now,
  }).where(eq(leaveRequest.id, row.id));
  await appendEvent(exec, scope, {
    requestId: row.id,
    revisionNo: row.currentRevisionNo,
    eventType: 'withdrawn',
    fromStatus: 'pending',
    toStatus: 'withdrawn',
    reason: normalizedReason,
    eventKey: `leave:${row.id}:revision:${row.currentRevisionNo}:withdrawn`,
    actorUserId: actor.userId,
    occurredAt: now,
  });
  return { id: row.id, status: 'withdrawn' as const, version };
}

export async function decideGovernedLeaveWithin(
  exec: DB,
  scope: Scope,
  actor: LeaveApplicationActor,
  requestId: number,
  expectedVersion: number,
  decision: 'approved' | 'rejected',
  reason?: string | null,
  now = new Date(),
) {
  const row = await requestForUpdate(exec, scope, requestId);
  assertVersion(row, expectedVersion);
  if (actor.employeeId === row.employeeId) {
    throw new LeaveApplicationError('self_approval_forbidden', 'An employee cannot approve their own leave.', 403);
  }
  if (row.status !== 'pending') {
    throw new LeaveApplicationError('leave_not_pending', 'Only Pending leave can be decided.', 409);
  }
  const approval = await decideLeaveApprovalWithin(exec, scope, {
    requestId: row.id,
    actorUserId: actor.userId,
    decision,
    reason,
  }, now);
  const decisionReason = cleanReason(reason);
  if (approval.status === 'pending') {
    const version = row.version + 1;
    await exec.update(leaveRequest).set({
      version,
      updatedAt: now,
    }).where(eq(leaveRequest.id, row.id));
    return {
      id: row.id,
      status: 'pending' as const,
      version,
      approval,
    };
  }
  await releaseReservationIfPaid(
    exec, scope, actor.userId, row, decision === 'approved' ? 'use' : 'release',
  );
  const version = row.version + 1;
  await exec.update(leaveRequest).set({
    status: decision,
    version,
    rejectionReason: decision === 'rejected' ? decisionReason : null,
    decidedByUserId: actor.userId,
    decidedAt: now,
    updatedAt: now,
  }).where(eq(leaveRequest.id, row.id));
  await appendEvent(exec, scope, {
    requestId: row.id,
    revisionNo: row.currentRevisionNo,
    eventType: decision,
    fromStatus: 'pending',
    toStatus: decision,
    reason: decisionReason,
    eventKey: `leave:${row.id}:revision:${row.currentRevisionNo}:${decision}`,
    actorUserId: actor.userId,
    occurredAt: now,
  });
  if (decision === 'approved') {
    await createUnpaidLeavePayrollSourceWithin(exec, scope, {
      requestId: row.id,
      actorUserId: actor.userId,
    }, now);
    await enqueueLeaveCalendarSyncWithin(exec, scope, {
      leaveRequestId: row.id,
      eventType: 'approved',
    }, now);
  }
  return { id: row.id, status: decision, version, approval };
}

export async function voidLeaveApplicationWithin(
  exec: DB,
  scope: Scope,
  actor: LeaveApplicationActor,
  requestId: number,
  expectedVersion: number,
  reason: string,
  now = new Date(),
) {
  if (!actor.canManage) {
    throw new LeaveApplicationError('permission_denied', 'HR permission is required to Void leave.', 403);
  }
  const row = await requestForUpdate(exec, scope, requestId);
  assertVersion(row, expectedVersion);
  if (['approved', 'cancelled', 'voided'].includes(row.status)) {
    throw new LeaveApplicationError(
      'leave_requires_cancellation',
      'Approved leave requires the cancellation process and terminal leave cannot be Voided.',
      409,
    );
  }
  const voidReason = requireReason(reason, 'void_reason_required');
  if (row.status === 'pending') {
    await cancelApprovalForEntityWithin(exec, scope, {
      domain: 'leave',
      entityType: 'leave_request',
      entityId: row.id,
      actorUserId: actor.userId,
      reason: voidReason,
    }, now);
    await releaseReservationIfPaid(exec, scope, actor.userId, row, 'release');
  }
  const version = row.version + 1;
  await exec.update(leaveRequest).set({
    status: 'voided', version, voidedAt: now, updatedAt: now,
  }).where(eq(leaveRequest.id, row.id));
  await appendEvent(exec, scope, {
    requestId: row.id,
    revisionNo: row.currentRevisionNo,
    eventType: 'voided',
    fromStatus: row.status,
    toStatus: 'voided',
    reason: voidReason,
    eventKey: `leave:${row.id}:revision:${row.currentRevisionNo}:voided`,
    actorUserId: actor.userId,
    occurredAt: now,
  });
  return { id: row.id, status: 'voided' as const, version };
}

/** Employee-facing delete semantics: governed drafts are never physically
 * erased. The owner may Void an unsubmitted/amendable application, preserving
 * its revisions and lifecycle evidence as an auditable tombstone. */
export async function voidOwnLeaveApplicationWithin(
  exec: DB,
  scope: Scope,
  actor: LeaveApplicationActor,
  requestId: number,
  expectedVersion: number,
  reason: string,
  now = new Date(),
) {
  const row = await requestForUpdate(exec, scope, requestId);
  assertOwnerOrManager(row, actor);
  assertVersion(row, expectedVersion);
  if (!['draft', 'rejected', 'withdrawn'].includes(row.status)) {
    throw new LeaveApplicationError(
      'leave_not_owner_voidable',
      'Only Draft, Rejected or Withdrawn leave can be Voided by its owner.',
      409,
    );
  }
  const voidReason = requireReason(reason, 'void_reason_required');
  const version = row.version + 1;
  await exec.update(leaveRequest).set({
    status: 'voided', version, voidedAt: now, updatedAt: now,
  }).where(eq(leaveRequest.id, row.id));
  await appendEvent(exec, scope, {
    requestId: row.id,
    revisionNo: row.currentRevisionNo,
    eventType: 'voided',
    fromStatus: row.status,
    toStatus: 'voided',
    reason: voidReason,
    eventKey: `leave:${row.id}:revision:${row.currentRevisionNo}:owner-voided`,
    actorUserId: actor.userId,
    occurredAt: now,
  });
  return { id: row.id, status: 'voided' as const, version };
}

export async function requestApprovedLeaveCancellationWithin(
  exec: DB,
  scope: Scope,
  actor: LeaveApplicationActor,
  requestId: number,
  expectedVersion: number,
  reason: string,
  now = new Date(),
) {
  const row = await requestForUpdate(exec, scope, requestId);
  assertOwnerOrManager(row, actor);
  assertVersion(row, expectedVersion);
  if (row.status !== 'approved') {
    throw new LeaveApplicationError(
      'leave_not_approved',
      'Only Approved leave can enter the cancellation process.',
      409,
    );
  }
  const cancellationReason = requireReason(reason, 'cancellation_reason_required');
  const [cancellation] = await exec.insert(leaveCancellationRequest).values({
    ...scope,
    requestId: row.id,
    requestVersion: row.version,
    reason: cancellationReason,
    requestedByUserId: actor.userId,
    requestedAt: now,
  }).returning({ id: leaveCancellationRequest.id });
  const version = row.version + 1;
  await exec.update(leaveRequest).set({ version, updatedAt: now })
    .where(eq(leaveRequest.id, row.id));
  await appendEvent(exec, scope, {
    requestId: row.id,
    revisionNo: row.currentRevisionNo,
    eventType: 'cancellation_requested',
    fromStatus: 'approved',
    toStatus: 'approved',
    reason: cancellationReason,
    eventKey: `leave:${row.id}:cancellation:${cancellation.id}:requested`,
    actorUserId: actor.userId,
    occurredAt: now,
  });
  return { id: row.id, cancellationId: cancellation.id, status: 'approved' as const, version };
}

export async function decideApprovedLeaveCancellationWithin(
  exec: DB,
  scope: Scope,
  actor: LeaveApplicationActor,
  cancellationId: number,
  expectedCancellationVersion: number,
  decision: 'approved' | 'rejected',
  reason: string,
  now = new Date(),
) {
  if (!actor.canManage) {
    throw new LeaveApplicationError('permission_denied', 'HR permission is required.', 403);
  }
  requireExpectedVersion(expectedCancellationVersion);
  const [cancellation] = await exec.select().from(leaveCancellationRequest).where(and(
    eq(leaveCancellationRequest.id, cancellationId),
    eq(leaveCancellationRequest.masterFn, scope.masterFn),
    eq(leaveCancellationRequest.companyFn, scope.companyFn),
  )).limit(1).for('update');
  if (!cancellation) {
    throw new LeaveApplicationError('cancellation_not_found', 'Cancellation request not found.', 404);
  }
  if (cancellation.version !== expectedCancellationVersion || cancellation.status !== 'pending') {
    throw new LeaveApplicationError(
      'cancellation_version_conflict',
      'This cancellation request changed after it was loaded.',
      409,
    );
  }
  const decisionReason = requireReason(reason, 'cancellation_decision_reason_required');
  const row = await requestForUpdate(exec, scope, cancellation.requestId);
  if (row.status !== 'approved') {
    throw new LeaveApplicationError(
      'leave_not_approved',
      'The source leave is no longer Approved.',
      409,
    );
  }
  const revision = await currentRevision(exec, scope, row);
  if (decision === 'approved') {
    const [type] = await exec.select({ paid: leaveType.paid }).from(leaveType)
      .where(eq(leaveType.id, revision.leaveTypeId)).limit(1);
    if (type?.paid) {
      await appendLeaveBalanceEntryWithin(exec, scope, {
        employeeId: row.employeeId,
        leaveTypeId: revision.leaveTypeId,
        policyVersionId: revision.policyVersionId,
        entryType: 'cancellation',
        entryKey: `leave:${row.id}:cancellation:${cancellation.id}`,
        balanceDelta: revision.days,
        reservedDelta: '0.00',
        effectiveDate: revision.startDate,
        sourceType: 'leave_cancellation',
        sourceId: String(cancellation.id),
        note: decisionReason,
        createdByUserId: actor.userId,
      });
    }
  }
  await exec.update(leaveCancellationRequest).set({
    status: decision,
    version: cancellation.version + 1,
    decidedByUserId: actor.userId,
    decidedAt: now,
    decisionReason,
  }).where(eq(leaveCancellationRequest.id, cancellation.id));
  const version = row.version + 1;
  if (decision === 'approved') {
    await exec.update(leaveRequest).set({
      status: 'cancelled',
      version,
      cancelledAt: now,
      updatedAt: now,
    }).where(eq(leaveRequest.id, row.id));
  } else {
    await exec.update(leaveRequest).set({ version, updatedAt: now })
      .where(eq(leaveRequest.id, row.id));
  }
  await appendEvent(exec, scope, {
    requestId: row.id,
    revisionNo: row.currentRevisionNo,
    eventType: decision === 'approved' ? 'cancellation_approved' : 'cancellation_rejected',
    fromStatus: 'approved',
    toStatus: decision === 'approved' ? 'cancelled' : 'approved',
    reason: decisionReason,
    eventKey: `leave:${row.id}:cancellation:${cancellation.id}:${decision}`,
    actorUserId: actor.userId,
    occurredAt: now,
  });
  if (decision === 'approved') {
    await createUnpaidLeavePayrollSourceWithin(exec, scope, {
      requestId: row.id,
      actorUserId: actor.userId,
      cancellationId: cancellation.id,
    }, now);
    await enqueueLeaveCalendarSyncWithin(exec, scope, {
      leaveRequestId: row.id,
      eventType: 'cancelled',
    }, now);
  }
  return {
    id: row.id,
    cancellationId: cancellation.id,
    status: decision === 'approved' ? 'cancelled' as const : 'approved' as const,
    version,
  };
}

/** Internal metadata boundary used by tests and future DocumentStorageProvider.
 * It never stores file bytes and deliberately has no public upload endpoint yet. */
export async function recordLeaveEvidenceWithin(
  exec: DB,
  scope: Scope,
  actor: LeaveApplicationActor,
  input: {
    requestId: number;
    revisionNo: number;
    state: 'received' | 'verified' | 'rejected';
    documentReference: string;
    originalFileName?: string | null;
    mimeType?: string | null;
    note?: string | null;
    eventKey: string;
  },
) {
  const row = await requestForUpdate(exec, scope, input.requestId);
  assertOwnerOrManager(row, actor);
  const [revision] = await exec.select({ id: leaveRequestRevision.id })
    .from(leaveRequestRevision).where(and(
      eq(leaveRequestRevision.masterFn, scope.masterFn),
      eq(leaveRequestRevision.companyFn, scope.companyFn),
      eq(leaveRequestRevision.requestId, row.id),
      eq(leaveRequestRevision.revisionNo, input.revisionNo),
    )).limit(1);
  if (!revision) throw new LeaveApplicationError('leave_revision_missing', 'Leave revision not found.', 404);
  const reference = input.documentReference?.trim();
  if (!reference || reference.length < 3 || reference.length > 200) {
    throw new LeaveApplicationError(
      'evidence_reference_invalid',
      'A managed document reference is required.',
    );
  }
  const [evidence] = await exec.insert(leaveEvidence).values({
    ...scope,
    requestId: row.id,
    revisionNo: input.revisionNo,
    evidenceType: 'medical_certificate',
    state: input.state,
    documentReference: reference,
    originalFileName: cleanReason(input.originalFileName),
    mimeType: cleanReason(input.mimeType),
    note: cleanReason(input.note),
    eventKey: input.eventKey,
    createdByUserId: actor.userId,
  }).returning({ id: leaveEvidence.id });
  return { id: evidence.id, state: input.state };
}

export async function readGovernedLeaveWithin(
  exec: DB,
  scope: Scope,
  actor: LeaveApplicationActor,
  requestId: number,
) {
  const [row] = await exec.select().from(leaveRequest).where(and(
    eq(leaveRequest.id, requestId),
    eq(leaveRequest.masterFn, scope.masterFn),
    eq(leaveRequest.companyFn, scope.companyFn),
    eq(leaveRequest.legacyPolicy, false),
  )).limit(1);
  if (!row) throw new LeaveApplicationError('governed_leave_not_found', 'Leave application not found.', 404);
  assertOwnerOrManager(row, actor);
  const revisions = await exec.select().from(leaveRequestRevision).where(and(
    eq(leaveRequestRevision.masterFn, scope.masterFn),
    eq(leaveRequestRevision.companyFn, scope.companyFn),
    eq(leaveRequestRevision.requestId, row.id),
  )).orderBy(desc(leaveRequestRevision.revisionNo));
  const events = await exec.select().from(leaveRequestEvent).where(and(
    eq(leaveRequestEvent.masterFn, scope.masterFn),
    eq(leaveRequestEvent.companyFn, scope.companyFn),
    eq(leaveRequestEvent.requestId, row.id),
  )).orderBy(desc(leaveRequestEvent.id));
  const evidence = await exec.select().from(leaveEvidence).where(and(
    eq(leaveEvidence.masterFn, scope.masterFn),
    eq(leaveEvidence.companyFn, scope.companyFn),
    eq(leaveEvidence.requestId, row.id),
  )).orderBy(desc(leaveEvidence.id));
  const cancellations = await exec.select().from(leaveCancellationRequest).where(and(
    eq(leaveCancellationRequest.masterFn, scope.masterFn),
    eq(leaveCancellationRequest.companyFn, scope.companyFn),
    eq(leaveCancellationRequest.requestId, row.id),
  )).orderBy(desc(leaveCancellationRequest.id));
  return { ...row, revisions, events, evidence, cancellations };
}
