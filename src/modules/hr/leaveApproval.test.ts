import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import {
  appNotification,
  appUser,
  approvalDecision,
  approvalInstanceEvent,
  approvalInstanceStep,
  approvalPolicy,
  approvalPolicyVersion,
  employee,
  leaveRequest,
  leaveType,
  role,
  userCompany,
  userCompanyRole,
} from '../../data/schema';
import { freshDb } from '../../test/helpers';
import {
  createApprovalDelegationWithin,
  processApprovalTimersWithin,
  resolveApprovalPolicyVersionWithin,
} from '../approval/workflow';
import {
  createLeaveDraftWithin,
  decideGovernedLeaveWithin,
  submitLeaveApplicationWithin,
} from './leaveApplication';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

describe('configurable leave approval governance', () => {
  async function fixture() {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [subject] = await db.select().from(employee).where(eq(employee.userId, viewer.userId));
    const [managerEmployee] = await db.select().from(employee).where(eq(
      employee.id,
      subject.managerId!,
    ));
    const [managerUser] = await db.insert(appUser).values({
      masterFn: scope.masterFn,
      username: 'approval.manager',
      email: 'approval.manager@acme.co',
      fullName: managerEmployee.fullName,
      passwordHash: viewer.passwordHash,
    }).returning({ id: appUser.userId });
    const managerRoles = await db.select().from(role).where(eq(role.masterFn, scope.masterFn));
    const managerRole = managerRoles.find((item) => item.name === 'Manager')!;
    const superadminRole = managerRoles.find((item) => item.name === 'Superadmin')!;
    await db.insert(userCompany).values({
      userId: managerUser.id,
      companyFn: scope.companyFn,
      roleId: managerRole.roleId,
    });
    await db.insert(userCompanyRole).values([
      {
        userId: managerUser.id,
        companyFn: scope.companyFn,
        roleId: managerRole.roleId,
      },
      {
        userId: managerUser.id,
        companyFn: scope.companyFn,
        roleId: superadminRole.roleId,
      },
    ]);
    await db.update(employee).set({ userId: managerUser.id }).where(eq(
      employee.id,
      managerEmployee.id,
    ));
    const types = await db.select().from(leaveType).where(and(
      eq(leaveType.masterFn, scope.masterFn),
      eq(leaveType.companyFn, scope.companyFn),
    ));
    return {
      db,
      admin,
      viewer,
      managerUser,
      subject,
      types: new Map(types.map((type) => [type.code, type])),
      employeeActor: { userId: viewer.userId, employeeId: subject.id },
      managerActor: {
        userId: managerUser.id,
        employeeId: subject.managerId,
        canManage: true,
      },
    };
  }

  async function draftAndSubmit(
    data: Awaited<ReturnType<typeof fixture>>,
    input: {
      typeCode?: string;
      startDate?: string;
      endDate?: string;
      employeeId?: number;
      actor?: { userId: number; employeeId?: number | null; canManage?: boolean };
    } = {},
    now = new Date('2026-07-25T08:00:00Z'),
  ) {
    const type = data.types.get(input.typeCode ?? 'ANNUAL')!;
    const actor = input.actor ?? data.employeeActor;
    const employeeId = input.employeeId ?? data.subject.id;
    const draft = await data.db.transaction((tx) => createLeaveDraftWithin(
      tx,
      scope,
      actor,
      employeeId,
      {
        leaveTypeId: type.id,
        startDate: input.startDate ?? '2026-10-05',
        endDate: input.endDate ?? '2026-10-06',
        unit: 'full_day',
        reason: 'Approval governance test',
      },
      now,
    ));
    const pending = await data.db.transaction((tx) => submitLeaveApplicationWithin(
      tx,
      scope,
      actor,
      draft.id,
      draft.version,
      now,
    ));
    return { type, draft, pending };
  }

  it('resolves policy steps by leave type and days, with generic amount conditions supported', async () => {
    const data = await fixture();
    const long = await resolveApprovalPolicyVersionWithin(data.db, scope, {
      domain: 'leave',
      effectiveDate: '2026-10-05',
      subjectEmployeeId: data.subject.id,
      department: data.subject.department,
      typeRef: 'ANNUAL',
      days: '6.00',
      amount: null,
      currency: null,
    });
    const unpaid = await resolveApprovalPolicyVersionWithin(data.db, scope, {
      domain: 'leave',
      effectiveDate: '2026-10-05',
      subjectEmployeeId: data.subject.id,
      department: data.subject.department,
      typeRef: 'UNPAID',
      days: '1.00',
      amount: null,
      currency: null,
    });
    expect(long.policyCode).toBe('LEAVE-LONG');
    expect(unpaid.policyCode).toBe('LEAVE-UNPAID');

    const [expensePolicy] = await data.db.insert(approvalPolicy).values({
      ...scope,
      code: 'EXPENSE-HIGH',
      name: 'High-value expense',
      domain: 'expense_test',
    }).returning({ id: approvalPolicy.id });
    await data.db.insert(approvalPolicyVersion).values({
      ...scope,
      policyId: expensePolicy.id,
      versionNo: 1,
      effectiveFrom: '2026-01-01',
      status: 'confirmed',
      priority: 50,
      department: 'Warehouse',
      minimumAmount: '1000.00',
      currency: 'SGD',
      confirmedByUserId: data.admin.userId,
      confirmedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const expense = await resolveApprovalPolicyVersionWithin(data.db, scope, {
      domain: 'expense_test',
      effectiveDate: '2026-10-05',
      subjectEmployeeId: data.subject.id,
      department: 'Warehouse',
      typeRef: 'TRAVEL',
      days: null,
      amount: '1500.00',
      currency: 'SGD',
    });
    expect(expense.policyCode).toBe('EXPENSE-HIGH');
  });

  it('snapshots and completes an ordered multi-level approval without early balance use', async () => {
    const data = await fixture();
    const created = await draftAndSubmit(data, {
      startDate: '2026-10-05',
      endDate: '2026-10-12',
    });
    expect(created.pending.approval).toMatchObject({
      policyCode: 'LEAVE-LONG',
      stepCount: 2,
      currentStepNo: 1,
    });
    const first = await data.db.transaction((tx) => decideGovernedLeaveWithin(
      tx,
      scope,
      data.managerActor,
      created.draft.id,
      created.pending.version,
      'approved',
      'Manager confirms coverage',
    ));
    expect(first).toMatchObject({
      status: 'pending',
      version: 3,
      approval: { status: 'pending', currentStepNo: 2 },
    });
    const second = await data.db.transaction((tx) => decideGovernedLeaveWithin(
      tx,
      scope,
      data.managerActor,
      created.draft.id,
      first.version,
      'approved',
      'HR governance confirmed',
    ));
    expect(second).toMatchObject({ status: 'approved', version: 4 });
    const decisions = await data.db.select().from(approvalDecision);
    expect(decisions).toHaveLength(2);
    expect(decisions.map((decision) => decision.originalAuthorityType)).toEqual([
      'employee',
      'permission',
    ]);
  });

  it('permits only an active bounded delegate and preserves original authority in the decision', async () => {
    const data = await fixture();
    const [employeeRole] = await data.db.select().from(role).where(and(
      eq(role.masterFn, scope.masterFn),
      eq(role.name, 'Employee'),
    ));
    const [delegateUser] = await data.db.insert(appUser).values({
      masterFn: scope.masterFn,
      username: 'delegate',
      email: 'delegate@acme.co',
      fullName: 'Approval Delegate',
      passwordHash: data.viewer.passwordHash,
    }).returning({ id: appUser.userId });
    await data.db.insert(userCompany).values({
      userId: delegateUser.id,
      companyFn: scope.companyFn,
      roleId: employeeRole.roleId,
    });
    await data.db.insert(userCompanyRole).values({
      userId: delegateUser.id,
      companyFn: scope.companyFn,
      roleId: employeeRole.roleId,
    });
    const [delegateEmployee] = await data.db.insert(employee).values({
      ...scope,
      employeeNo: 'EMP-1999',
      fullName: 'Approval Delegate',
      email: 'delegate@acme.co',
      department: 'Operations',
      jobTitle: 'Deputy Operations Manager',
      employmentType: 'Full-time',
      userId: delegateUser.id,
      startDate: '2025-01-01',
      annualLeaveDays: 14,
      baseSalary: '5000.00',
    }).returning({ id: employee.id });
    const now = new Date('2026-07-25T08:00:00Z');
    const delegation = await data.db.transaction((tx) => createApprovalDelegationWithin(
      tx,
      scope,
      {
        domain: 'leave',
        authorityEmployeeId: data.subject.managerId!,
        delegateEmployeeId: delegateEmployee.id,
        validFrom: new Date('2026-07-25T00:00:00Z'),
        validTo: new Date('2026-08-01T00:00:00Z'),
        reason: 'Manager annual leave cover',
        createdByUserId: data.admin.userId,
      },
      now,
    ));
    const created = await draftAndSubmit(data, {}, now);
    const approved = await data.db.transaction((tx) => decideGovernedLeaveWithin(
      tx,
      scope,
      { userId: delegateUser.id, employeeId: delegateEmployee.id },
      created.draft.id,
      created.pending.version,
      'approved',
      'Covered under active delegation',
      now,
    ));
    expect(approved.status).toBe('approved');
    const [decision] = await data.db.select().from(approvalDecision);
    expect(decision).toMatchObject({
      actorUserId: delegateUser.id,
      originalAuthorityUserId: data.managerUser.id,
      authoritySource: 'delegated',
      delegationId: delegation.id,
    });
  });

  it('appends idempotent reminder and escalation facts and redirects the current authority', async () => {
    const data = await fixture();
    const now = new Date('2026-07-25T08:00:00Z');
    const created = await draftAndSubmit(data, {}, now);
    const processed = await data.db.transaction((tx) => processApprovalTimersWithin(
      tx,
      scope,
      new Date('2026-07-27T09:00:00Z'),
    ));
    expect(processed).toEqual({ reminded: 1, escalated: 1 });
    const [step] = await data.db.select().from(approvalInstanceStep).where(eq(
      approvalInstanceStep.instanceId,
      created.pending.approval.id,
    ));
    expect(step).toMatchObject({
      originalAuthorityType: 'employee',
      currentAuthorityType: 'permission',
      currentAuthorityPermissionKey: 'hr.write',
    });
    const events = await data.db.select().from(approvalInstanceEvent).where(eq(
      approvalInstanceEvent.instanceId,
      created.pending.approval.id,
    ));
    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      'reminder_sent',
      'escalated',
    ]));
    const notifications = await data.db.select().from(appNotification).where(eq(
      appNotification.entityRef,
      `approval:${created.pending.approval.id}`,
    ));
    expect(notifications.map((item) => item.subject)).toEqual(expect.arrayContaining([
      'Approval reminder',
      'Approval escalated',
    ]));
  });

  it('supports warn, add-level and block capacity actions', async () => {
    const data = await fixture();
    const warning = await draftAndSubmit(data);
    expect(warning.pending.approval).toMatchObject({
      stepCount: 1,
      capacity: {
        action: 'warn',
        breached: true,
        minimumStaff: 1,
        remainingStaff: 0,
      },
    });

    const extra = await draftAndSubmit(data, {
      typeCode: 'UNPAID',
      startDate: '2026-11-02',
      endDate: '2026-11-02',
    });
    expect(extra.pending.approval).toMatchObject({
      policyCode: 'LEAVE-UNPAID',
      stepCount: 3,
      capacity: { action: 'extra_approval', breached: true },
    });

    const [productionEmployee] = await data.db.select().from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.department, 'Production'),
    ));
    const blocked = await draftAndSubmit(data, {
      typeCode: 'MEDICAL',
      startDate: '2026-11-09',
      endDate: '2026-11-09',
      employeeId: productionEmployee.id,
      actor: data.managerActor,
    });
    await expect(data.db.transaction((tx) => decideGovernedLeaveWithin(
      tx,
      scope,
      data.managerActor,
      blocked.draft.id,
      blocked.pending.version,
      'approved',
      'Coverage reviewed',
    ))).rejects.toMatchObject({
      code: 'leave_capacity_blocked',
      status: 409,
      details: { minimumStaff: '1', remainingStaff: '0' },
    });
    const [row] = await data.db.select().from(leaveRequest).where(eq(
      leaveRequest.id,
      blocked.draft.id,
    ));
    expect(row.status).toBe('pending');
  });
});
