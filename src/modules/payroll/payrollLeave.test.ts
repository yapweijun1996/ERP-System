import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import {
  appUser,
  employee,
  leaveBalanceEntry,
  leavePolicyVersion,
  leaveRequest,
  leaveType,
  payrollLeaveSource,
  payrollRunLeaveSource,
  payrollRunLine,
} from '../../data/schema';
import { freshDb } from '../../test/helpers';
import {
  createLeaveDraftWithin,
  decideApprovedLeaveCancellationWithin,
  decideGovernedLeaveWithin,
  requestApprovedLeaveCancellationWithin,
  submitLeaveApplicationWithin,
} from '../hr/leaveApplication';
import { createPayrollRun } from './payrollRun';
import {
  approveLeaveEncashment,
  createUnpaidLeavePayrollSourceWithin,
  payrollLeaveAmount,
} from './payrollLeave';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

describe('leave Payroll sources', () => {
  it('uses exact 26-day half-up proration', () => {
    expect(payrollLeaveAmount('4200.00', '2.00')).toBe('323.08');
    expect(payrollLeaveAmount('4200.00', '1.50')).toBe('242.31');
  });

  it('creates immutable revision sources, applies them once and preserves Legacy Policy rows', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [subject] = await db.select().from(employee).where(eq(employee.userId, viewer.userId));
    const [unpaidType] = await db.select().from(leaveType).where(and(
      eq(leaveType.companyFn, scope.companyFn),
      eq(leaveType.code, 'UNPAID'),
    ));
    const [annualType] = await db.select().from(leaveType).where(and(
      eq(leaveType.companyFn, scope.companyFn),
      eq(leaveType.code, 'ANNUAL'),
    ));
    const [annualPolicy] = await db.select().from(leavePolicyVersion).where(and(
      eq(leavePolicyVersion.leaveTypeId, annualType.id),
      eq(leavePolicyVersion.status, 'confirmed'),
    ));
    const [legacyBefore] = await db.select().from(leaveRequest).where(and(
      eq(leaveRequest.companyFn, scope.companyFn),
      eq(leaveRequest.legacyPolicy, true),
    )).limit(1);
    const employeeActor = { userId: viewer.userId, employeeId: subject.id };
    const hrActor = { userId: admin.userId, canManage: true };
    const draft = await db.transaction((tx) => createLeaveDraftWithin(
      tx,
      scope,
      employeeActor,
      subject.id,
      {
        leaveTypeId: unpaidType.id,
        startDate: '2026-09-07',
        endDate: '2026-09-08',
        unit: 'full_day',
        reason: 'Personal unpaid leave',
      },
    ));
    const pending = await db.transaction((tx) => submitLeaveApplicationWithin(
      tx, scope, employeeActor, draft.id, draft.version,
    ));
    let approved = await db.transaction((tx) => decideGovernedLeaveWithin(
      tx, scope, hrActor, draft.id, pending.version, 'approved',
    ));
    while (approved.status === 'pending') {
      approved = await db.transaction((tx) => decideGovernedLeaveWithin(
        tx, scope, hrActor, draft.id, approved.version, 'approved',
      ));
    }
    expect(approved.status).toBe('approved');

    const [deduction] = await db.select().from(payrollLeaveSource).where(and(
      eq(payrollLeaveSource.leaveRequestId, draft.id),
      eq(payrollLeaveSource.sourceType, 'unpaid_leave'),
    ));
    expect(deduction).toMatchObject({
      leaveRevisionNo: 1,
      effectDirection: 'deduction',
      days: '2.00',
      baseSalarySnapshot: '4200.00',
      amount: '323.08',
      effectiveDate: '2026-09-07',
    });
    const replay = await db.transaction((tx) => createUnpaidLeavePayrollSourceWithin(
      tx, scope, { requestId: draft.id, actorUserId: admin.userId },
    ));
    expect(replay?.replayed).toBe(true);

    const cancellation = await db.transaction((tx) => requestApprovedLeaveCancellationWithin(
      tx,
      scope,
      employeeActor,
      draft.id,
      approved.version,
      'Leave is no longer required',
      new Date('2026-09-10T00:00:00Z'),
    ));
    await db.transaction((tx) => decideApprovedLeaveCancellationWithin(
      tx,
      scope,
      hrActor,
      cancellation.cancellationId,
      1,
      'approved',
      'Cancellation approved before payroll',
      new Date('2026-09-10T00:00:00Z'),
    ));

    const encashment = await approveLeaveEncashment(db, scope, {
      employeeId: subject.id,
      leaveTypeId: annualType.id,
      policyVersionId: annualPolicy.id,
      days: '1.50',
      effectiveDate: '2026-09-10',
      eventKey: 'ENCASH-MARCUS-2026-01',
      actorUserId: admin.userId,
      note: 'Policy-approved annual leave encashment',
    });
    expect(encashment).toMatchObject({
      sourceType: 'encashment',
      effectDirection: 'earning',
      amount: '242.31',
      replayed: false,
    });
    const encashmentReplay = await approveLeaveEncashment(db, scope, {
      employeeId: subject.id,
      leaveTypeId: annualType.id,
      policyVersionId: annualPolicy.id,
      days: '1.50',
      effectiveDate: '2026-09-10',
      eventKey: 'ENCASH-MARCUS-2026-01',
      actorUserId: admin.userId,
      note: 'Policy-approved annual leave encashment',
    });
    expect(encashmentReplay.replayed).toBe(true);

    const run = await createPayrollRun(db, scope, {
      docNo: 'PAY-LEAVE-1',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      payDate: '2026-09-28',
    });
    expect(run.leaveSourceCount).toBe(3);
    const [subjectLine] = await db.select().from(payrollRunLine).where(and(
      eq(payrollRunLine.runId, run.id),
      eq(payrollRunLine.employeeId, subject.id),
    ));
    expect(subjectLine).toMatchObject({
      baseGrossPay: '4200.00',
      leaveEarnings: '565.39',
      leaveDeductions: '323.08',
      grossPay: '4442.31',
    });
    expect(await db.select().from(payrollRunLeaveSource)
      .where(eq(payrollRunLeaveSource.runId, run.id))).toHaveLength(3);

    const second = await createPayrollRun(db, scope, {
      docNo: 'PAY-LEAVE-2',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      payDate: '2026-09-29',
    });
    expect(second.leaveSourceCount).toBe(0);
    const [secondLine] = await db.select().from(payrollRunLine).where(and(
      eq(payrollRunLine.runId, second.id),
      eq(payrollRunLine.employeeId, subject.id),
    ));
    expect(secondLine).toMatchObject({
      baseGrossPay: '4200.00',
      leaveEarnings: '0.00',
      leaveDeductions: '0.00',
      grossPay: '4200.00',
    });

    const [legacyAfter] = await db.select().from(leaveRequest)
      .where(eq(leaveRequest.id, legacyBefore.id));
    expect(legacyAfter).toMatchObject({
      legacyPolicy: true,
      days: legacyBefore.days,
      currentRevisionNo: 0,
    });
    expect(await db.select().from(payrollLeaveSource)
      .where(eq(payrollLeaveSource.leaveRequestId, legacyBefore.id))).toHaveLength(0);

    const [ledger] = await db.select().from(leaveBalanceEntry).where(and(
      eq(leaveBalanceEntry.entryType, 'encashment'),
      eq(leaveBalanceEntry.sourceId, 'ENCASH-MARCUS-2026-01'),
    ));
    expect(ledger.balanceDelta).toBe('-1.50');
    await expect(db.update(payrollLeaveSource).set({ amount: '999.00' })
      .where(eq(payrollLeaveSource.id, deduction.id))).rejects.toThrow();
    await expect(db.delete(payrollRunLeaveSource)
      .where(eq(payrollRunLeaveSource.runId, run.id))).rejects.toThrow();
  });
});
