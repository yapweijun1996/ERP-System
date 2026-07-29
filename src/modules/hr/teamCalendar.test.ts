import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import {
  appUser,
  calendarOutboundEvent,
  employee,
  employeeHierarchyScope,
  leaveCancellationRequest,
  leaveRequest,
  leaveRequestRevision,
  leaveType,
  role,
  userCompany,
  userCompanyRole,
} from '../../data/schema';
import { freshDb } from '../../test/helpers';
import {
  resolveCompanyEmployeeIdsWithin,
  resolveDirectReportEmployeeIdsWithin,
  resolveTeamEmployeeIdsWithin,
} from './actorScope';
import {
  enqueueLeaveCalendarSyncWithin,
  processCalendarOutboundBatch,
  type CalendarOutboundDriver,
} from './calendarSync';
import {
  createLeaveDraftWithin,
  decideApprovedLeaveCancellationWithin,
  decideGovernedLeaveWithin,
  requestApprovedLeaveCancellationWithin,
  submitLeaveApplicationWithin,
} from './leaveApplication';
import { listTeamCalendarWithin } from './teamCalendar';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

describe('team calendar workspace and outbound sync', () => {
  async function fixture() {
    const db = await freshDb();
    await seedDemo(db);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [subject] = await db.select().from(employee).where(eq(employee.userId, viewer.userId));
    const [managerEmployee] = await db.select().from(employee).where(eq(
      employee.id,
      subject.managerId!,
    ));
    const [managerUser] = await db.insert(appUser).values({
      masterFn: scope.masterFn,
      username: 'calendar.manager',
      email: 'calendar.manager@acme.co',
      fullName: managerEmployee.fullName,
      passwordHash: viewer.passwordHash,
    }).returning({ id: appUser.userId });
    const roles = await db.select().from(role).where(eq(role.masterFn, scope.masterFn));
    const managerRole = roles.find((item) => item.name === 'Manager')!;
    const superadminRole = roles.find((item) => item.name === 'Superadmin')!;
    await db.insert(userCompany).values({
      userId: managerUser.id,
      companyFn: scope.companyFn,
      roleId: managerRole.roleId,
    });
    await db.insert(userCompanyRole).values([
      { userId: managerUser.id, companyFn: scope.companyFn, roleId: managerRole.roleId },
      { userId: managerUser.id, companyFn: scope.companyFn, roleId: superadminRole.roleId },
    ]);
    await db.update(employee).set({ userId: managerUser.id }).where(eq(
      employee.id,
      managerEmployee.id,
    ));
    const [annual] = await db.select().from(leaveType).where(and(
      eq(leaveType.masterFn, scope.masterFn),
      eq(leaveType.companyFn, scope.companyFn),
      eq(leaveType.code, 'ANNUAL'),
    ));
    return {
      db,
      viewer,
      subject,
      managerEmployee,
      managerUser,
      annual,
      employeeActor: { userId: viewer.userId, employeeId: subject.id },
      managerActor: {
        userId: managerUser.id,
        employeeId: managerEmployee.id,
        canManage: true,
      },
    };
  }

  it('defaults to direct reports and expands only an authorised reporting tree', async () => {
    const data = await fixture();
    const [scopeRoot] = await data.db.insert(employee).values({
      ...scope,
      employeeNo: 'EMP-CAL-ROOT',
      fullName: 'Authorised Department Head',
      email: 'calendar.root@example.test',
      department: 'Projects',
      jobTitle: 'Department Head',
      employmentType: 'Full-time',
      startDate: '2025-01-01',
      annualLeaveDays: 14,
      baseSalary: '6000.00',
    }).returning({ id: employee.id });
    const [scopeChild] = await data.db.insert(employee).values({
      ...scope,
      employeeNo: 'EMP-CAL-CHILD',
      fullName: 'Tree Team Member',
      email: 'calendar.child@example.test',
      department: 'Projects',
      jobTitle: 'Coordinator',
      employmentType: 'Full-time',
      managerId: scopeRoot.id,
      startDate: '2025-02-01',
      annualLeaveDays: 14,
      baseSalary: '3500.00',
    }).returning({ id: employee.id });
    await data.db.insert(employeeHierarchyScope).values({
      ...scope,
      granteeEmployeeId: data.managerEmployee.id,
      scopeRootEmployeeId: scopeRoot.id,
      scopeType: 'tree',
      validFrom: '2026-01-01',
      grantedByUserId: data.managerUser.id,
    });
    const [otherDirect] = await data.db.select().from(employee).where(and(
      eq(employee.managerId, data.managerEmployee.id),
      eq(employee.department, 'Finance'),
    ));
    const inserted = await data.db.insert(leaveRequest).values([
      {
        ...scope,
        employeeId: data.subject.id,
        leaveType: 'Annual leave',
        startDate: '2026-08-10',
        endDate: '2026-08-11',
        days: '2.00',
        reason: 'Private direct-report reason',
        status: 'approved',
      },
      {
        ...scope,
        employeeId: otherDirect.id,
        leaveType: 'Medical leave',
        startDate: '2026-08-11',
        endDate: '2026-08-11',
        days: '1.00',
        reason: 'Private overlapping reason',
        status: 'pending',
      },
      {
        ...scope,
        employeeId: scopeChild.id,
        leaveType: 'Annual leave',
        startDate: '2026-08-12',
        endDate: '2026-08-12',
        days: '1.00',
        reason: 'Private expanded-tree reason',
        status: 'approved',
      },
    ]).returning({ id: leaveRequest.id });

    const directIds = await resolveDirectReportEmployeeIdsWithin(
      data.db,
      scope,
      data.managerEmployee.id,
    );
    const expandedIds = await resolveTeamEmployeeIdsWithin(
      data.db,
      scope,
      data.managerEmployee.id,
      '2026-08-01',
    );
    expect(directIds).not.toContain(scopeChild.id);
    expect(expandedIds).toContain(scopeChild.id);
    const companyIds = await resolveCompanyEmployeeIdsWithin(data.db, scope);
    expect(companyIds).toEqual(expect.arrayContaining([
      data.managerEmployee.id,
      data.subject.id,
      scopeRoot.id,
      scopeChild.id,
    ]));

    const direct = await listTeamCalendarWithin(data.db, scope, directIds, {
      from: '2026-08-01',
      to: '2026-08-31',
      status: 'all',
    });
    expect(direct.items.some((item) => item.employeeId === scopeChild.id)).toBe(false);
    expect(direct.items.filter((item) => inserted.slice(0, 2)
      .some((created) => created.id === item.id))
      .every((item) => item.conflict)).toBe(true);
    expect(direct.items.every((item) =>
      !Object.prototype.hasOwnProperty.call(item, 'reason'))).toBe(true);

    const expanded = await listTeamCalendarWithin(data.db, scope, expandedIds, {
      from: '2026-08-01',
      to: '2026-08-31',
      department: 'Projects',
      status: 'approved',
    });
    expect(expanded.items).toHaveLength(1);
    expect(expanded.items[0]).toMatchObject({
      employeeId: scopeChild.id,
      privacy: 'reason_and_evidence_redacted',
    });
  });

  async function createAndApprove(data: Awaited<ReturnType<typeof fixture>>) {
    const now = new Date('2026-07-25T08:00:00Z');
    const draft = await data.db.transaction((tx) => createLeaveDraftWithin(
      tx,
      scope,
      data.employeeActor,
      data.subject.id,
      {
        leaveTypeId: data.annual.id,
        startDate: '2026-09-14',
        endDate: '2026-09-15',
        unit: 'full_day',
        reason: 'Private calendar sync reason',
      },
      now,
    ));
    const pending = await data.db.transaction((tx) => submitLeaveApplicationWithin(
      tx,
      scope,
      data.employeeActor,
      draft.id,
      draft.version,
      now,
    ));
    const approved = await data.db.transaction((tx) => decideGovernedLeaveWithin(
      tx,
      scope,
      data.managerActor,
      draft.id,
      pending.version,
      'approved',
      'Coverage confirmed',
      now,
    ));
    return { draft, approved, now };
  }

  it('queues approved, changed and cancelled facts idempotently and reuses the external event', async () => {
    const data = await fixture();
    const created = await createAndApprove(data);
    let events = await data.db.select().from(calendarOutboundEvent);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('approved');
    expect(JSON.stringify(events[0].payload)).not.toContain('Private calendar sync reason');
    expect(await enqueueLeaveCalendarSyncWithin(data.db, scope, {
      leaveRequestId: created.draft.id,
      eventType: 'approved',
    }, created.now)).toMatchObject({ queued: 0 });

    const upserts: Array<Record<string, unknown>> = [];
    const cancels: Array<Record<string, unknown>> = [];
    const driver: CalendarOutboundDriver = {
      async upsert(input) {
        upserts.push(input);
        return { externalEventId: input.externalEventId ?? 'external-leave-1' };
      },
      async cancel(input) {
        cancels.push(input);
      },
    };
    expect(await processCalendarOutboundBatch(
      data.db,
      { generic: driver },
      { workerId: 'calendar-test', now: created.now },
    )).toEqual({ claimed: 1, delivered: 1, failed: 0, superseded: 0 });
    expect(upserts[0]).toMatchObject({ externalEventId: null });

    const [current] = await data.db.select().from(leaveRequest).where(eq(
      leaveRequest.id,
      created.draft.id,
    ));
    const [revision] = await data.db.select().from(leaveRequestRevision).where(and(
      eq(leaveRequestRevision.requestId, created.draft.id),
      eq(leaveRequestRevision.revisionNo, 1),
    ));
    await data.db.insert(leaveRequestRevision).values({
      ...scope,
      requestId: current.id,
      revisionNo: 2,
      leaveTypeId: revision.leaveTypeId,
      policyVersionId: revision.policyVersionId,
      calendarVersionId: revision.calendarVersionId,
      startDate: '2026-09-16',
      endDate: '2026-09-17',
      unit: revision.unit,
      days: '2.00',
      reason: 'Changed private reason',
      changeReason: 'Approved dates changed under governed correction',
      evidenceRequired: false,
      createdByUserId: data.managerUser.id,
      createdAt: new Date('2026-07-26T08:00:00Z'),
    });
    await data.db.update(leaveRequest).set({
      currentRevisionNo: 2,
      version: current.version + 1,
      startDate: '2026-09-16',
      endDate: '2026-09-17',
      reason: 'Changed private reason',
    }).where(eq(leaveRequest.id, current.id));
    expect(await enqueueLeaveCalendarSyncWithin(data.db, scope, {
      leaveRequestId: current.id,
      eventType: 'approved',
    }, new Date('2026-07-26T08:00:00Z'))).toMatchObject({ queued: 1 });
    expect(await processCalendarOutboundBatch(
      data.db,
      { generic: driver },
      { workerId: 'calendar-change', now: new Date('2026-07-26T08:00:00Z') },
    )).toMatchObject({ claimed: 1, delivered: 1 });
    expect(upserts[1]).toMatchObject({ externalEventId: 'external-leave-1' });

    const [changed] = await data.db.select().from(leaveRequest).where(eq(
      leaveRequest.id,
      current.id,
    ));
    const cancellation = await data.db.transaction((tx) =>
      requestApprovedLeaveCancellationWithin(
        tx,
        scope,
        data.employeeActor,
        current.id,
        changed.version,
        'Plans changed',
        new Date('2026-07-27T08:00:00Z'),
      ));
    const [cancellationRow] = await data.db.select().from(leaveCancellationRequest).where(eq(
      leaveCancellationRequest.id,
      cancellation.cancellationId,
    ));
    await data.db.transaction((tx) => decideApprovedLeaveCancellationWithin(
      tx,
      scope,
      data.managerActor,
      cancellation.cancellationId,
      cancellationRow.version,
      'approved',
      'Cancellation confirmed',
      new Date('2026-07-27T09:00:00Z'),
    ));
    expect(await processCalendarOutboundBatch(
      data.db,
      { generic: driver },
      { workerId: 'calendar-cancel', now: new Date('2026-07-27T09:00:00Z') },
    )).toMatchObject({ claimed: 1, delivered: 1 });
    expect(cancels[0]).toMatchObject({ externalEventId: 'external-leave-1' });
    events = await data.db.select().from(calendarOutboundEvent);
    expect(events.map((event) => event.eventType)).toEqual([
      'approved',
      'changed',
      'cancelled',
    ]);
    expect(events.every((event) => event.status === 'delivered')).toBe(true);
  });

  it('supersedes a stale upsert when ERP has already cancelled the leave', async () => {
    const data = await fixture();
    const created = await createAndApprove(data);
    const cancellation = await data.db.transaction((tx) =>
      requestApprovedLeaveCancellationWithin(
        tx,
        scope,
        data.employeeActor,
        created.draft.id,
        created.approved.version,
        'Cancel before outbound delivery',
        new Date('2026-07-25T09:00:00Z'),
      ));
    const [row] = await data.db.select().from(leaveCancellationRequest).where(eq(
      leaveCancellationRequest.id,
      cancellation.cancellationId,
    ));
    await data.db.transaction((tx) => decideApprovedLeaveCancellationWithin(
      tx,
      scope,
      data.managerActor,
      cancellation.cancellationId,
      row.version,
      'approved',
      'Cancellation confirmed',
      new Date('2026-07-25T10:00:00Z'),
    ));
    let cancelExternalId: string | null | undefined;
    const result = await processCalendarOutboundBatch(data.db, {
      generic: {
        async upsert() {
          throw new Error('Stale upsert must not be delivered.');
        },
        async cancel(input) {
          cancelExternalId = input.externalEventId;
        },
      },
    }, { workerId: 'calendar-stale', now: new Date('2026-07-25T10:00:00Z') });
    expect(result).toEqual({ claimed: 2, delivered: 1, failed: 0, superseded: 1 });
    expect(cancelExternalId).toBeNull();
  });
});
