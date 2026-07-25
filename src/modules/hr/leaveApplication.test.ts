import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import {
  appUser,
  employee,
  leaveBalanceEntry,
  leavePolicyVersion,
  leaveRequest,
  leaveRequestEvent,
  leaveRequestRevision,
  leaveType,
} from '../../data/schema';
import { freshDb } from '../../test/helpers';
import {
  LeaveApplicationError,
  amendLeaveApplicationWithin,
  createLeaveDraftWithin,
  decideApprovedLeaveCancellationWithin,
  decideGovernedLeaveWithin,
  readGovernedLeaveWithin,
  recordLeaveEvidenceWithin,
  requestApprovedLeaveCancellationWithin,
  submitLeaveApplicationWithin,
  voidLeaveApplicationWithin,
  voidOwnLeaveApplicationWithin,
  withdrawLeaveApplicationWithin,
} from './leaveApplication';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

describe('governed leave application lifecycle', () => {
  async function fixture(typeCode = 'ANNUAL') {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const [employeeUser] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [subject] = await db.select().from(employee).where(eq(employee.userId, employeeUser.userId));
    const [type] = await db.select().from(leaveType).where(and(
      eq(leaveType.masterFn, scope.masterFn),
      eq(leaveType.companyFn, scope.companyFn),
      eq(leaveType.code, typeCode),
    ));
    const [policy] = await db.select().from(leavePolicyVersion).where(and(
      eq(leavePolicyVersion.leaveTypeId, type.id),
      eq(leavePolicyVersion.status, 'confirmed'),
    ));
    const employeeActor = { userId: employeeUser.userId, employeeId: subject.id };
    const hrActor = { userId: admin.userId, canManage: true };
    return {
      db, admin, employeeUser, subject, type, policy, employeeActor, hrActor,
    };
  }

  async function createDraft(data: Awaited<ReturnType<typeof fixture>>, input = {}) {
    return data.db.transaction((tx) => createLeaveDraftWithin(
      tx,
      scope,
      data.employeeActor,
      data.subject.id,
      {
        leaveTypeId: data.type.id,
        startDate: '2026-08-10',
        endDate: '2026-08-14',
        unit: 'full_day',
        reason: 'Family trip',
        ...input,
      },
    ));
  }

  it('uses immutable revisions through Draft, Pending, Withdrawn, amendment and approval', async () => {
    const data = await fixture();
    const draft = await createDraft(data);
    expect(draft).toMatchObject({ status: 'draft', version: 1, revisionNo: 1 });

    const pending = await data.db.transaction((tx) => submitLeaveApplicationWithin(
      tx, scope, data.employeeActor, draft.id, draft.version,
    ));
    expect(pending).toMatchObject({ status: 'pending', version: 2 });

    const withdrawn = await data.db.transaction((tx) => withdrawLeaveApplicationWithin(
      tx, scope, data.employeeActor, draft.id, pending.version, 'Travel dates changed',
    ));
    expect(withdrawn).toMatchObject({ status: 'withdrawn', version: 3 });

    const amended = await data.db.transaction((tx) => amendLeaveApplicationWithin(
      tx,
      scope,
      data.employeeActor,
      draft.id,
      withdrawn.version,
      {
        leaveTypeId: data.type.id,
        startDate: '2026-08-17',
        endDate: '2026-08-19',
        unit: 'full_day',
        reason: 'Rescheduled family trip',
        changeReason: 'Travel dates changed',
      },
    ));
    expect(amended).toMatchObject({ status: 'draft', version: 4, revisionNo: 2 });
    const pendingAgain = await data.db.transaction((tx) => submitLeaveApplicationWithin(
      tx, scope, data.employeeActor, draft.id, amended.version,
    ));
    const approved = await data.db.transaction((tx) => decideGovernedLeaveWithin(
      tx, scope, data.hrActor, draft.id, pendingAgain.version, 'approved',
    ));
    expect(approved).toMatchObject({ status: 'approved', version: 6 });

    const [header] = await data.db.select().from(leaveRequest).where(eq(leaveRequest.id, draft.id));
    expect(header.days).toBe('3.00');
    expect(header.legacyPolicy).toBe(false);
    expect(await data.db.select().from(leaveRequestRevision)
      .where(eq(leaveRequestRevision.requestId, draft.id))).toHaveLength(2);
    expect(await data.db.select().from(leaveRequestEvent)
      .where(eq(leaveRequestEvent.requestId, draft.id))).toHaveLength(6);
    const ledger = await data.db.select().from(leaveBalanceEntry).where(and(
      eq(leaveBalanceEntry.employeeId, data.subject.id),
      eq(leaveBalanceEntry.leaveTypeId, data.type.id),
    ));
    expect(ledger.map((entry) => entry.entryType)).toEqual([
      'grant', 'reserve', 'release', 'reserve', 'use',
    ]);
  });

  it('implements employee delete as an auditable Void tombstone', async () => {
    const data = await fixture();
    const draft = await createDraft(data);
    const result = await data.db.transaction((tx) => voidOwnLeaveApplicationWithin(
      tx,
      scope,
      data.employeeActor,
      draft.id,
      draft.version,
      'Draft entered in error',
    ));
    expect(result).toMatchObject({ status: 'voided', version: 2 });
    const detail = await readGovernedLeaveWithin(
      data.db,
      scope,
      data.employeeActor,
      draft.id,
    );
    expect(detail.status).toBe('voided');
    expect(detail.revisions).toHaveLength(1);
    expect(detail.events.map((event) => event.eventType)).toContain('voided');
  });

  it('supports AM/PM half-day snapshots and rejects stale versions', async () => {
    const data = await fixture();
    const draft = await createDraft(data, {
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      unit: 'half_day_am',
    });
    const [row] = await data.db.select().from(leaveRequest).where(eq(leaveRequest.id, draft.id));
    expect(row.days).toBe('0.50');
    await expect(data.db.transaction((tx) => submitLeaveApplicationWithin(
      tx, scope, data.employeeActor, draft.id, 99,
    ))).rejects.toMatchObject({ code: 'leave_version_conflict', status: 409 });
  });

  it('enforces medical evidence without exposing a fake upload service', async () => {
    const data = await fixture('MEDICAL');
    const draft = await createDraft(data, {
      startDate: '2026-08-10',
      endDate: '2026-08-11',
      reason: 'Medical treatment',
    });
    await expect(data.db.transaction((tx) => submitLeaveApplicationWithin(
      tx, scope, data.employeeActor, draft.id, draft.version,
    ))).rejects.toMatchObject({ code: 'leave_evidence_required' });
    await data.db.transaction((tx) => recordLeaveEvidenceWithin(
      tx,
      scope,
      data.employeeActor,
      {
        requestId: draft.id,
        revisionNo: 1,
        state: 'received',
        documentReference: 'managed-document:test-medical-1',
        originalFileName: 'medical-certificate.pdf',
        mimeType: 'application/pdf',
        eventKey: 'evidence:test-medical-1',
      },
    ));
    await expect(data.db.transaction((tx) => submitLeaveApplicationWithin(
      tx, scope, data.employeeActor, draft.id, draft.version,
    ))).resolves.toMatchObject({ status: 'pending' });
  });

  it('prevents self approval and supports reasoned HR Void for non-approved records', async () => {
    const data = await fixture();
    const draft = await createDraft(data);
    const pending = await data.db.transaction((tx) => submitLeaveApplicationWithin(
      tx, scope, data.employeeActor, draft.id, draft.version,
    ));
    await expect(data.db.transaction((tx) => decideGovernedLeaveWithin(
      tx,
      scope,
      { ...data.employeeActor, canManage: true },
      draft.id,
      pending.version,
      'approved',
    ))).rejects.toMatchObject({ code: 'self_approval_forbidden' });
    const voided = await data.db.transaction((tx) => voidLeaveApplicationWithin(
      tx, scope, data.hrActor, draft.id, pending.version, 'Duplicate application',
    ));
    expect(voided).toMatchObject({ status: 'voided' });
  });

  it('cancels Approved leave through a separate decision and restores paid balance', async () => {
    const data = await fixture();
    const draft = await createDraft(data);
    const pending = await data.db.transaction((tx) => submitLeaveApplicationWithin(
      tx, scope, data.employeeActor, draft.id, draft.version,
    ));
    const approved = await data.db.transaction((tx) => decideGovernedLeaveWithin(
      tx, scope, data.hrActor, draft.id, pending.version, 'approved',
    ));
    await expect(data.db.transaction((tx) => voidLeaveApplicationWithin(
      tx, scope, data.hrActor, draft.id, approved.version, 'Do not bypass cancellation',
    ))).rejects.toMatchObject({ code: 'leave_requires_cancellation' });
    const requested = await data.db.transaction((tx) => requestApprovedLeaveCancellationWithin(
      tx, scope, data.employeeActor, draft.id, approved.version, 'Trip no longer required',
    ));
    const cancelled = await data.db.transaction((tx) => decideApprovedLeaveCancellationWithin(
      tx,
      scope,
      data.hrActor,
      requested.cancellationId,
      1,
      'approved',
      'Cancellation verified',
    ));
    expect(cancelled).toMatchObject({ status: 'cancelled' });
    const entries = await data.db.select().from(leaveBalanceEntry).where(and(
      eq(leaveBalanceEntry.employeeId, data.subject.id),
      eq(leaveBalanceEntry.leaveTypeId, data.type.id),
    ));
    expect(entries.map((entry) => [entry.entryType, entry.balanceDelta])).toEqual([
      ['grant', '16.00'],
      ['reserve', '0.00'],
      ['use', '-5.00'],
      ['cancellation', '5.00'],
    ]);
  });

  it('keeps private reason and evidence owner/HR scoped', async () => {
    const data = await fixture('MEDICAL');
    const draft = await createDraft(data, {
      startDate: '2026-08-10',
      endDate: '2026-08-11',
      reason: 'Private diagnosis detail',
    });
    await data.db.transaction((tx) => recordLeaveEvidenceWithin(
      tx,
      scope,
      data.employeeActor,
      {
        requestId: draft.id,
        revisionNo: 1,
        state: 'received',
        documentReference: 'managed-document:private',
        originalFileName: 'private-medical.pdf',
        eventKey: 'evidence:private',
      },
    ));
    const own = await data.db.transaction((tx) => readGovernedLeaveWithin(
      tx, scope, data.employeeActor, draft.id,
    ));
    expect(own.reason).toBe('Private diagnosis detail');
    expect(own.evidence[0].documentReference).toBe('managed-document:private');
    await expect(data.db.transaction((tx) => readGovernedLeaveWithin(
      tx,
      scope,
      { userId: data.admin.userId, employeeId: data.subject.id + 999 },
      draft.id,
    ))).rejects.toMatchObject({ code: 'leave_request_not_owned' });
    await expect(data.db.transaction((tx) => readGovernedLeaveWithin(
      tx, scope, data.hrActor, draft.id,
    ))).resolves.toMatchObject({ id: draft.id });
  });

  it('enforces append-only revision, event and evidence facts in PostgreSQL', async () => {
    const data = await fixture();
    const draft = await createDraft(data);
    await expect(data.db.update(leaveRequestRevision).set({ reason: 'rewrite' })
      .where(eq(leaveRequestRevision.requestId, draft.id))).rejects.toThrow();
    await expect(data.db.delete(leaveRequestEvent)
      .where(eq(leaveRequestEvent.requestId, draft.id))).rejects.toThrow();
  });

  it('requires explicit ownership for employee-created drafts', async () => {
    const data = await fixture();
    await expect(data.db.transaction((tx) => createLeaveDraftWithin(
      tx,
      scope,
      { userId: data.employeeUser.userId, employeeId: data.subject.id + 1 },
      data.subject.id,
      {
        leaveTypeId: data.type.id,
        startDate: '2026-08-10',
        endDate: '2026-08-10',
        unit: 'full_day',
      },
    ))).rejects.toBeInstanceOf(LeaveApplicationError);
  });
});
