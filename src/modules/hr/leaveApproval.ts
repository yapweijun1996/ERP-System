import {
  and, asc, desc, eq, gte, isNull, lte, ne, or,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  approvalCapacitySnapshot,
  approvalInstance,
  approvalInstanceEvent,
  approvalInstanceStep,
  employee,
  leaveCapacityRule,
  leaveEvidence,
  leaveRequest,
  leaveRequestRevision,
  leaveType,
} from '../../data/schema';
import {
  ApprovalWorkflowError,
  decideApprovalWithin,
  listApprovalQueueWithin,
  processApprovalTimersWithin,
  readApprovalInstanceWithin,
  startApprovalWithin,
} from '../approval/workflow';

interface LeaveApprovalSource {
  requestId: number;
  revisionNo: number;
  employeeId: number;
  submittedByUserId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  days: string;
}

interface CapacityResult {
  ruleId: number | null;
  action: 'none' | 'warn' | 'extra_approval' | 'block';
  extraApprovalPermissionKey: string | null;
  minimumStaff: number;
  activeStaff: number;
  unavailableStaff: number;
  remainingStaff: number;
  breached: boolean;
}

async function leaveContext(
  exec: DB,
  scope: Scope,
  source: LeaveApprovalSource,
) {
  const [subject] = await exec.select({
    id: employee.id,
    department: employee.department,
  }).from(employee).where(and(
    eq(employee.id, source.employeeId),
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.isActive, true),
  )).limit(1);
  const [type] = await exec.select({
    id: leaveType.id,
    code: leaveType.code,
    name: leaveType.name,
  }).from(leaveType).where(and(
    eq(leaveType.id, source.leaveTypeId),
    eq(leaveType.masterFn, scope.masterFn),
    eq(leaveType.companyFn, scope.companyFn),
  )).limit(1);
  if (!subject || !type) {
    throw new ApprovalWorkflowError(
      'leave_approval_context_missing',
      'The leave employee or leave type is unavailable.',
      409,
    );
  }
  return { subject, type };
}

async function resolveCapacityRuleWithin(
  exec: DB,
  scope: Scope,
  input: {
    department: string;
    typeRef: string;
    date: string;
  },
) {
  const rows = await exec.select().from(leaveCapacityRule).where(and(
    eq(leaveCapacityRule.masterFn, scope.masterFn),
    eq(leaveCapacityRule.companyFn, scope.companyFn),
    eq(leaveCapacityRule.isActive, true),
    lte(leaveCapacityRule.effectiveFrom, input.date),
    or(
      isNull(leaveCapacityRule.effectiveTo),
      gte(leaveCapacityRule.effectiveTo, input.date),
    ),
  ));
  const matching = rows.filter((row) =>
    (row.department == null || row.department === input.department)
    && (row.typeRef == null || row.typeRef === input.typeRef));
  matching.sort((left, right) => {
    const leftSpecificity = Number(left.department != null) + Number(left.typeRef != null);
    const rightSpecificity = Number(right.department != null) + Number(right.typeRef != null);
    return right.priority - left.priority
      || rightSpecificity - leftSpecificity
      || right.id - left.id;
  });
  return matching[0] ?? null;
}

async function evaluateCapacityWithin(
  exec: DB,
  scope: Scope,
  source: LeaveApprovalSource,
): Promise<CapacityResult> {
  const context = await leaveContext(exec, scope, source);
  const rule = await resolveCapacityRuleWithin(exec, scope, {
    department: context.subject.department,
    typeRef: context.type.code,
    date: source.startDate,
  });
  if (!rule) {
    return {
      ruleId: null,
      action: 'none',
      extraApprovalPermissionKey: null,
      minimumStaff: 0,
      activeStaff: 0,
      unavailableStaff: 0,
      remainingStaff: 0,
      breached: false,
    };
  }
  const activeRows = await exec.select({ id: employee.id }).from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.department, context.subject.department),
    eq(employee.isActive, true),
  ));
  const unavailableRows = await exec.select({
    employeeId: leaveRequest.employeeId,
  }).from(leaveRequest)
    .innerJoin(employee, and(
      eq(employee.id, leaveRequest.employeeId),
      eq(employee.masterFn, leaveRequest.masterFn),
      eq(employee.companyFn, leaveRequest.companyFn),
    ))
    .where(and(
      eq(leaveRequest.masterFn, scope.masterFn),
      eq(leaveRequest.companyFn, scope.companyFn),
      eq(leaveRequest.status, 'approved'),
      eq(employee.department, context.subject.department),
      ne(leaveRequest.id, source.requestId),
      lte(leaveRequest.startDate, source.endDate),
      gte(leaveRequest.endDate, source.startDate),
    ));
  const unavailableStaff = new Set(unavailableRows.map((row) => row.employeeId)).size;
  const activeStaff = activeRows.length;
  const remainingStaff = Math.max(0, activeStaff - unavailableStaff - 1);
  return {
    ruleId: rule.id,
    action: rule.action as CapacityResult['action'],
    extraApprovalPermissionKey: rule.extraApprovalPermissionKey,
    minimumStaff: rule.minimumStaff,
    activeStaff,
    unavailableStaff,
    remainingStaff,
    breached: remainingStaff < rule.minimumStaff,
  };
}

async function appendCapacitySnapshot(
  exec: DB,
  scope: Scope,
  instanceId: number,
  stage: 'submission' | 'final_approval',
  result: CapacityResult,
  now: Date,
) {
  const existing = await exec.select({ id: approvalCapacitySnapshot.id })
    .from(approvalCapacitySnapshot).where(and(
      eq(approvalCapacitySnapshot.masterFn, scope.masterFn),
      eq(approvalCapacitySnapshot.companyFn, scope.companyFn),
      eq(approvalCapacitySnapshot.instanceId, instanceId),
      eq(approvalCapacitySnapshot.evaluationStage, stage),
    ));
  const eventKey = `approval:${instanceId}:capacity:${stage}:${existing.length + 1}`;
  await exec.insert(approvalCapacitySnapshot).values({
    ...scope,
    instanceId,
    ruleId: result.ruleId,
    evaluationStage: stage,
    action: result.action,
    minimumStaff: result.minimumStaff,
    activeStaff: result.activeStaff,
    unavailableStaff: result.unavailableStaff,
    remainingStaff: result.remainingStaff,
    breached: result.breached,
    eventKey,
    evaluatedAt: now,
  });
  await exec.insert(approvalInstanceEvent).values({
    ...scope,
    instanceId,
    eventType: 'capacity_evaluated',
    detail: JSON.stringify({
      stage,
      action: result.action,
      minimumStaff: result.minimumStaff,
      remainingStaff: result.remainingStaff,
      breached: result.breached,
    }),
    eventKey,
    occurredAt: now,
  });
}

export async function startLeaveApprovalWithin(
  exec: DB,
  scope: Scope,
  source: LeaveApprovalSource,
  now = new Date(),
) {
  const context = await leaveContext(exec, scope, source);
  const capacity = await evaluateCapacityWithin(exec, scope, source);
  const extraPermissionSteps = capacity.breached
    && capacity.action === 'extra_approval'
    && capacity.extraApprovalPermissionKey
    ? [{
      label: 'Capacity exception approval',
      permissionKey: capacity.extraApprovalPermissionKey,
    }]
    : [];
  const instance = await startApprovalWithin(exec, scope, {
    domain: 'leave',
    entityType: 'leave_request',
    entityId: source.requestId,
    entityVersion: source.revisionNo,
    subjectEmployeeId: source.employeeId,
    submittedByUserId: source.submittedByUserId,
    effectiveDate: source.startDate,
    department: context.subject.department,
    typeRef: context.type.code,
    days: source.days,
    extraPermissionSteps,
  }, now);
  await appendCapacitySnapshot(exec, scope, instance.id, 'submission', capacity, now);
  return {
    ...instance,
    capacity: {
      action: capacity.action,
      breached: capacity.breached,
      minimumStaff: capacity.minimumStaff,
      remainingStaff: capacity.remainingStaff,
    },
  };
}

export async function currentLeaveApprovalWithin(
  exec: DB,
  scope: Scope,
  requestId: number,
) {
  const [instance] = await exec.select().from(approvalInstance).where(and(
    eq(approvalInstance.masterFn, scope.masterFn),
    eq(approvalInstance.companyFn, scope.companyFn),
    eq(approvalInstance.domain, 'leave'),
    eq(approvalInstance.entityType, 'leave_request'),
    eq(approvalInstance.entityId, requestId),
    eq(approvalInstance.status, 'pending'),
  )).orderBy(desc(approvalInstance.id)).limit(1);
  if (!instance) {
    throw new ApprovalWorkflowError(
      'leave_approval_instance_missing',
      'This Pending leave request has no active approval instance.',
      409,
    );
  }
  return instance;
}

export async function decideLeaveApprovalWithin(
  exec: DB,
  scope: Scope,
  input: {
    requestId: number;
    actorUserId: number;
    decision: 'approved' | 'rejected';
    reason?: string | null;
  },
  now = new Date(),
) {
  const instance = await currentLeaveApprovalWithin(exec, scope, input.requestId);
  const [currentStep] = await exec.select({
    id: approvalInstanceStep.id,
    stepNo: approvalInstanceStep.stepNo,
  }).from(approvalInstanceStep).where(and(
    eq(approvalInstanceStep.instanceId, instance.id),
    eq(approvalInstanceStep.stepNo, instance.currentStepNo),
  )).limit(1);
  const [nextStep] = currentStep
    ? await exec.select({ id: approvalInstanceStep.id }).from(approvalInstanceStep).where(and(
      eq(approvalInstanceStep.instanceId, instance.id),
      eq(approvalInstanceStep.stepNo, currentStep.stepNo + 1),
    )).limit(1)
    : [];
  if (input.decision === 'approved' && !nextStep) {
    const [request] = await exec.select().from(leaveRequest).where(and(
      eq(leaveRequest.id, input.requestId),
      eq(leaveRequest.masterFn, scope.masterFn),
      eq(leaveRequest.companyFn, scope.companyFn),
    )).limit(1);
    const [revision] = request
      ? await exec.select().from(leaveRequestRevision).where(and(
        eq(leaveRequestRevision.requestId, request.id),
        eq(leaveRequestRevision.revisionNo, request.currentRevisionNo),
      )).limit(1)
      : [];
    if (!request || !revision) {
      throw new ApprovalWorkflowError(
        'leave_approval_context_missing',
        'The leave request revision is unavailable.',
        409,
      );
    }
    const capacity = await evaluateCapacityWithin(exec, scope, {
      requestId: request.id,
      revisionNo: revision.revisionNo,
      employeeId: request.employeeId,
      submittedByUserId: request.createdByUserId ?? input.actorUserId,
      leaveTypeId: revision.leaveTypeId,
      startDate: revision.startDate,
      endDate: revision.endDate,
      days: revision.days,
    });
    await appendCapacitySnapshot(
      exec,
      scope,
      instance.id,
      'final_approval',
      capacity,
      now,
    );
    if (capacity.breached && capacity.action === 'block') {
      throw new ApprovalWorkflowError(
        'leave_capacity_blocked',
        'Approval is blocked because the configured minimum staffing level would be breached.',
        409,
        {
          minimumStaff: String(capacity.minimumStaff),
          remainingStaff: String(capacity.remainingStaff),
        },
      );
    }
  }
  return decideApprovalWithin(exec, scope, {
    instanceId: instance.id,
    actorUserId: input.actorUserId,
    decision: input.decision,
    reason: input.reason,
  }, now);
}

export async function listMyLeaveApprovalsWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  now = new Date(),
) {
  await processApprovalTimersWithin(exec, scope, now);
  const queue = await listApprovalQueueWithin(
    exec,
    scope,
    actorUserId,
    'leave',
    now,
  );
  const rows = [];
  for (const item of queue) {
    const [leave] = await exec.select({
      requestId: leaveRequest.id,
      requestVersion: leaveRequest.version,
      revisionNo: leaveRequest.currentRevisionNo,
      status: leaveRequest.status,
      employeeId: leaveRequest.employeeId,
      employeeName: employee.fullName,
      department: employee.department,
      jobTitle: employee.jobTitle,
      leaveType: leaveRequest.leaveType,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      unit: leaveRequest.unit,
      days: leaveRequest.days,
    }).from(leaveRequest)
      .innerJoin(employee, and(
        eq(employee.id, leaveRequest.employeeId),
        eq(employee.masterFn, leaveRequest.masterFn),
        eq(employee.companyFn, leaveRequest.companyFn),
      ))
      .where(and(
        eq(leaveRequest.id, item.entityId),
        eq(leaveRequest.masterFn, scope.masterFn),
        eq(leaveRequest.companyFn, scope.companyFn),
        eq(leaveRequest.status, 'pending'),
      )).limit(1);
    if (!leave) continue;
    const [authorityEmployee] = item.currentAuthorityEmployeeId
      ? await exec.select({
        id: employee.id,
        employeeNo: employee.employeeNo,
        fullName: employee.fullName,
      }).from(employee).where(and(
        eq(employee.id, item.currentAuthorityEmployeeId),
        eq(employee.masterFn, scope.masterFn),
        eq(employee.companyFn, scope.companyFn),
      )).limit(1)
      : [];
    const [capacity] = await exec.select().from(approvalCapacitySnapshot).where(and(
      eq(approvalCapacitySnapshot.instanceId, item.id),
      eq(approvalCapacitySnapshot.evaluationStage, 'submission'),
    )).orderBy(desc(approvalCapacitySnapshot.id)).limit(1);
    rows.push({
      ...leave,
      approvalInstanceId: item.id,
      policyVersionId: item.policyVersionId,
      currentStepNo: item.currentStepNo,
      stepLabel: item.stepLabel,
      stepActivatedAt: item.stepActivatedAt,
      stepDueAt: item.stepDueAt,
      escalatedAt: item.escalatedAt,
      currentAuthority: {
        type: item.currentAuthorityType,
        permissionKey: item.currentAuthorityPermissionKey,
        employeeId: item.currentAuthorityEmployeeId,
        userId: item.currentAuthorityUserId,
        employeeNo: authorityEmployee?.employeeNo ?? null,
        employeeName: authorityEmployee?.fullName ?? null,
      },
      capacity: capacity ? {
        action: capacity.action,
        breached: capacity.breached,
        minimumStaff: capacity.minimumStaff,
        remainingStaff: capacity.remainingStaff,
      } : null,
      privacy: 'reason_and_evidence_redacted' as const,
    });
  }
  return rows;
}

export async function readMyLeaveApprovalWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  requestId: number,
  now = new Date(),
) {
  const queue = await listMyLeaveApprovalsWithin(exec, scope, actorUserId, now);
  const row = queue.find((item) => item.requestId === requestId);
  if (!row) {
    throw new ApprovalWorkflowError(
      'leave_approval_not_assigned',
      'This leave approval is not assigned or delegated to the signed-in employee.',
      404,
    );
  }
  const [revision] = await exec.select({
    evidenceRequired: leaveRequestRevision.evidenceRequired,
  }).from(leaveRequestRevision).where(and(
    eq(leaveRequestRevision.requestId, row.requestId),
    eq(leaveRequestRevision.revisionNo, row.revisionNo),
  )).limit(1);
  const evidenceStates = await exec.select({
    state: leaveEvidence.state,
  }).from(leaveEvidence).where(and(
    eq(leaveEvidence.masterFn, scope.masterFn),
    eq(leaveEvidence.companyFn, scope.companyFn),
    eq(leaveEvidence.requestId, row.requestId),
    eq(leaveEvidence.revisionNo, row.revisionNo),
  )).orderBy(asc(leaveEvidence.id));
  const workflow = await readApprovalInstanceWithin(exec, scope, row.approvalInstanceId);
  return {
    ...row,
    evidenceRequired: revision?.evidenceRequired ?? false,
    evidenceStates: evidenceStates.map((evidence) => evidence.state),
    workflow,
  };
}
