import {
  and, asc, desc, eq, gte, isNull, lte, or,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  appUser,
  approvalDecision,
  approvalDelegation,
  approvalInstance,
  approvalInstanceEvent,
  approvalInstanceStep,
  approvalPolicy,
  approvalPolicyStep,
  approvalPolicyVersion,
  employee,
  userCompanyRole,
} from '../../data/schema';
import { deliverNotificationWithin } from '../account/notification';
import { fixedUnits } from '../inventory/decimal';
import { isTenantPermission } from '../../auth/permissionRegistry';
import {
  authorizeWithin,
  type AuthorizationContext,
  type AuthorizationScopeTarget,
} from '../../auth/authorization';
import { activeRoleAssignmentCondition } from '../../auth/roleAssignmentState';

export class ApprovalWorkflowError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApprovalWorkflowError';
  }
}

export interface ApprovalContextInput {
  domain: string;
  entityType: string;
  entityId: number;
  entityVersion: number;
  subjectEmployeeId?: number | null;
  submittedByUserId: number;
  effectiveDate: string;
  department?: string | null;
  typeRef?: string | null;
  days?: string | null;
  amount?: string | null;
  currency?: string | null;
  extraPermissionSteps?: Array<{
    label: string;
    permissionKey: string;
    position?: 'before_final' | 'after';
  }>;
}

interface ResolvedAuthority {
  type: 'employee' | 'permission';
  employeeId: number | null;
  userId: number | null;
  permissionKey: string | null;
}

interface ResolvedStep {
  policyStepId: number | null;
  stepNo: number;
  label: string;
  authority: ResolvedAuthority;
  escalation: ResolvedAuthority | null;
  reminderAfterHours: number | null;
  escalateAfterHours: number | null;
}

function cleanOptional(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function requireReason(value: string | null | undefined, code: string): string {
  const reason = cleanOptional(value);
  if (!reason || reason.length < 3 || reason.length > 500) {
    throw new ApprovalWorkflowError(code, 'A reason between 3 and 500 characters is required.');
  }
  return reason;
}

function addHours(at: Date, hours: number | null): Date | null {
  return hours == null ? null : new Date(at.getTime() + hours * 60 * 60 * 1000);
}

function conditionSpecificity(row: typeof approvalPolicyVersion.$inferSelect): number {
  return [
    row.employeeId, row.department, row.typeRef, row.minimumDays, row.maximumDays,
    row.minimumAmount, row.maximumAmount, row.currency,
  ].filter((value) => value != null).length;
}

function numericConditionMatches(
  value: string | null | undefined,
  minimum: string | null,
  maximum: string | null,
): boolean {
  if (minimum == null && maximum == null) return true;
  if (value == null) return false;
  const units = fixedUnits(value, 2);
  return (minimum == null || units >= fixedUnits(minimum, 2))
    && (maximum == null || units <= fixedUnits(maximum, 2));
}

export async function resolveApprovalPolicyVersionWithin(
  exec: DB,
  scope: Scope,
  input: Pick<
  ApprovalContextInput,
  'domain' | 'effectiveDate' | 'subjectEmployeeId' | 'department' | 'typeRef'
  | 'days' | 'amount' | 'currency'
  >,
) {
  const rows = await exec.select({
    version: approvalPolicyVersion,
    policyCode: approvalPolicy.code,
  }).from(approvalPolicyVersion)
    .innerJoin(approvalPolicy, and(
      eq(approvalPolicy.id, approvalPolicyVersion.policyId),
      eq(approvalPolicy.masterFn, approvalPolicyVersion.masterFn),
      eq(approvalPolicy.companyFn, approvalPolicyVersion.companyFn),
    ))
    .where(and(
      eq(approvalPolicyVersion.masterFn, scope.masterFn),
      eq(approvalPolicyVersion.companyFn, scope.companyFn),
      eq(approvalPolicyVersion.status, 'confirmed'),
      eq(approvalPolicy.domain, input.domain),
      eq(approvalPolicy.isActive, true),
      lte(approvalPolicyVersion.effectiveFrom, input.effectiveDate),
      or(
        isNull(approvalPolicyVersion.effectiveTo),
        gte(approvalPolicyVersion.effectiveTo, input.effectiveDate),
      ),
    ));
  const matching = rows.filter(({ version }) =>
    (version.employeeId == null || version.employeeId === input.subjectEmployeeId)
    && (version.department == null || version.department === input.department)
    && (version.typeRef == null || version.typeRef === input.typeRef)
    && (version.currency == null || version.currency === input.currency)
    && numericConditionMatches(input.days, version.minimumDays, version.maximumDays)
    && numericConditionMatches(input.amount, version.minimumAmount, version.maximumAmount));
  if (!matching.length) {
    throw new ApprovalWorkflowError(
      'approval_policy_missing',
      `No confirmed ${input.domain} approval policy matches this submission.`,
      409,
    );
  }
  matching.sort((left, right) =>
    right.version.priority - left.version.priority
    || conditionSpecificity(right.version) - conditionSpecificity(left.version)
    || right.version.versionNo - left.version.versionNo);
  const winner = matching[0];
  const runnerUp = matching[1];
  if (
    runnerUp
    && runnerUp.version.priority === winner.version.priority
    && conditionSpecificity(runnerUp.version) === conditionSpecificity(winner.version)
  ) {
    throw new ApprovalWorkflowError(
      'approval_policy_ambiguous',
      'Multiple equally-ranked approval policies match this submission.',
      409,
      { first: winner.policyCode, second: runnerUp.policyCode },
    );
  }
  return winner;
}

async function employeeAuthority(
  exec: DB,
  scope: Scope,
  employeeId: number,
): Promise<ResolvedAuthority | null> {
  const [row] = await exec.select({
    employeeId: employee.id,
    userId: employee.userId,
    active: employee.isActive,
    userActive: appUser.isActive,
  }).from(employee)
    .leftJoin(appUser, and(
      eq(appUser.userId, employee.userId),
      eq(appUser.masterFn, employee.masterFn),
    ))
    .where(and(
      eq(employee.id, employeeId),
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
    )).limit(1);
  if (!row?.active || !row.userId || row.userActive !== true) return null;
  return {
    type: 'employee',
    employeeId: row.employeeId,
    userId: row.userId,
    permissionKey: null,
  };
}

async function managerAuthority(
  exec: DB,
  scope: Scope,
  subjectEmployeeId: number,
  managerLevel: number,
): Promise<ResolvedAuthority | null> {
  let currentId: number | null = subjectEmployeeId;
  for (let level = 0; level < managerLevel; level += 1) {
    if (!currentId) return null;
    const [row] = await exec.select({ managerId: employee.managerId }).from(employee)
      .where(and(
        eq(employee.id, currentId),
        eq(employee.masterFn, scope.masterFn),
        eq(employee.companyFn, scope.companyFn),
        eq(employee.isActive, true),
      )).limit(1);
    currentId = row?.managerId ?? null;
  }
  return currentId ? employeeAuthority(exec, scope, currentId) : null;
}

function permissionAuthority(permissionKey: string): ResolvedAuthority {
  if (!isTenantPermission(permissionKey)) {
    throw new ApprovalWorkflowError(
      'approval_permission_unknown',
      'The approval permission is not registered in the tenant permission catalog.',
      409,
    );
  }
  return {
    type: 'permission',
    employeeId: null,
    userId: null,
    permissionKey,
  };
}

async function resolveConfiguredAuthority(
  exec: DB,
  scope: Scope,
  subjectEmployeeId: number | null,
  config: {
    authorityType: string;
    authorityEmployeeId: number | null;
    authorityPermissionKey: string | null;
    managerLevel: number;
    fallbackPermissionKey?: string | null;
  },
): Promise<ResolvedAuthority> {
  let resolved: ResolvedAuthority | null = null;
  if (config.authorityType === 'permission' && config.authorityPermissionKey) {
    resolved = permissionAuthority(config.authorityPermissionKey);
  } else if (config.authorityType === 'named_employee' && config.authorityEmployeeId) {
    resolved = await employeeAuthority(exec, scope, config.authorityEmployeeId);
  } else if (config.authorityType === 'direct_manager' && subjectEmployeeId) {
    resolved = await managerAuthority(exec, scope, subjectEmployeeId, config.managerLevel);
  }
  if (!resolved && config.fallbackPermissionKey) {
    resolved = permissionAuthority(config.fallbackPermissionKey);
  }
  if (!resolved) {
    throw new ApprovalWorkflowError(
      'approval_authority_unavailable',
      'A configured approval authority is unavailable and no fallback is configured.',
      409,
    );
  }
  return resolved;
}

async function resolvedPolicySteps(
  exec: DB,
  scope: Scope,
  input: ApprovalContextInput,
  policyVersionId: number,
): Promise<ResolvedStep[]> {
  const configured = await exec.select().from(approvalPolicyStep).where(and(
    eq(approvalPolicyStep.masterFn, scope.masterFn),
    eq(approvalPolicyStep.companyFn, scope.companyFn),
    eq(approvalPolicyStep.policyVersionId, policyVersionId),
  )).orderBy(asc(approvalPolicyStep.stepNo));
  if (!configured.length) {
    throw new ApprovalWorkflowError(
      'approval_policy_has_no_steps',
      'The resolved approval policy has no approval steps.',
      409,
    );
  }
  const steps: ResolvedStep[] = [];
  for (const row of configured) {
    const authority = await resolveConfiguredAuthority(
      exec,
      scope,
      input.subjectEmployeeId ?? null,
      row,
    );
    let escalation: ResolvedAuthority | null = null;
    if (row.escalationAuthorityType) {
      escalation = await resolveConfiguredAuthority(
        exec,
        scope,
        input.subjectEmployeeId ?? null,
        {
          authorityType: row.escalationAuthorityType,
          authorityEmployeeId: row.escalationEmployeeId,
          authorityPermissionKey: row.escalationPermissionKey,
          managerLevel: 1,
        },
      );
    }
    steps.push({
      policyStepId: row.id,
      stepNo: steps.length + 1,
      label: row.label,
      authority,
      escalation,
      reminderAfterHours: row.reminderAfterHours,
      escalateAfterHours: row.escalateAfterHours,
    });
  }
  for (const extra of input.extraPermissionSteps ?? []) {
    const resolved: ResolvedStep = {
      policyStepId: null,
      stepNo: 0,
      label: extra.label,
      authority: permissionAuthority(extra.permissionKey),
      escalation: null,
      reminderAfterHours: null,
      escalateAfterHours: null,
    };
    if (extra.position === 'before_final' && steps.length > 0) {
      steps.splice(steps.length - 1, 0, resolved);
    } else {
      steps.push(resolved);
    }
  }
  return steps.map((step, index) => ({ ...step, stepNo: index + 1 }));
}

async function appendEvent(
  exec: DB,
  scope: Scope,
  input: {
    instanceId: number;
    stepId?: number | null;
    eventType: typeof approvalInstanceEvent.$inferInsert.eventType;
    actorUserId?: number | null;
    detail?: string | null;
    eventKey: string;
    occurredAt: Date;
  },
) {
  await exec.insert(approvalInstanceEvent).values({
    ...scope,
    instanceId: input.instanceId,
    stepId: input.stepId ?? null,
    eventType: input.eventType,
    actorUserId: input.actorUserId ?? null,
    detail: cleanOptional(input.detail),
    eventKey: input.eventKey,
    occurredAt: input.occurredAt,
  });
}

async function hasPermissionWithin(
  exec: DB,
  scope: Scope,
  userId: number,
  permissionKey: string,
  now = new Date(),
  context: {
    resourceKey?: string;
    scopeTarget?: AuthorizationScopeTarget;
    requireScope?: boolean;
    authorizationContext?: AuthorizationContext;
  } = {},
): Promise<boolean> {
  return (await authorizeWithin(
    exec,
    { userId, masterFn: scope.masterFn, companyFn: scope.companyFn },
    permissionKey,
    {
      now,
      resourceKey: context.resourceKey,
      scopeTarget: context.scopeTarget,
      requireScope: context.requireScope,
      context: context.authorizationContext,
    },
  )).allowed;
}

async function usersWithPermissionWithin(
  exec: DB,
  scope: Scope,
  permissionKey: string,
  now = new Date(),
): Promise<number[]> {
  const rows = await exec.select({ userId: userCompanyRole.userId })
    .from(userCompanyRole)
    .where(and(
      eq(userCompanyRole.companyFn, scope.companyFn),
      activeRoleAssignmentCondition(now),
    ));
  const userIds = [...new Set(rows.map((row) => row.userId))];
  const authorized: number[] = [];
  for (const userId of userIds) {
    if (await hasPermissionWithin(exec, scope, userId, permissionKey, now)) {
      authorized.push(userId);
    }
  }
  return authorized;
}

async function authorityRecipients(
  exec: DB,
  scope: Scope,
  authority: ResolvedAuthority,
  now = new Date(),
): Promise<number[]> {
  if (authority.type === 'employee') return authority.userId ? [authority.userId] : [];
  return authority.permissionKey
    ? usersWithPermissionWithin(exec, scope, authority.permissionKey, now)
    : [];
}

async function notifyStep(
  exec: DB,
  scope: Scope,
  authority: ResolvedAuthority,
  input: {
    subject: string;
    detail: string;
    entityRef: string;
    severity?: 'info' | 'warning';
  },
  now: Date,
) {
  const recipients = await authorityRecipients(exec, scope, authority);
  for (const recipient of recipients) {
    await deliverNotificationWithin(exec, scope, recipient, {
      kind: 'approval_required',
      severity: input.severity ?? 'info',
      subject: input.subject,
      detail: input.detail,
      route: 'my-approvals',
      entityRef: input.entityRef,
    }, now);
  }
}

export async function startApprovalWithin(
  exec: DB,
  scope: Scope,
  input: ApprovalContextInput,
  now = new Date(),
) {
  if (!Number.isSafeInteger(input.entityId) || input.entityId <= 0 || input.entityVersion <= 0) {
    throw new ApprovalWorkflowError('approval_entity_invalid', 'Approval entity identity is invalid.');
  }
  const policy = await resolveApprovalPolicyVersionWithin(exec, scope, input);
  const steps = await resolvedPolicySteps(exec, scope, input, policy.version.id);
  const [subject] = input.subjectEmployeeId
    ? await exec.select({ userId: employee.userId }).from(employee).where(and(
      eq(employee.id, input.subjectEmployeeId),
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
    )).limit(1)
    : [];
  for (const step of steps) {
    if (
      step.authority.type === 'employee'
      && subject?.userId
      && step.authority.userId === subject.userId
    ) {
      throw new ApprovalWorkflowError(
        'self_approval_policy_invalid',
        'The resolved approval policy assigns the subject to approve their own submission.',
        409,
      );
    }
  }
  const [instance] = await exec.insert(approvalInstance).values({
    ...scope,
    domain: input.domain,
    entityType: input.entityType,
    entityId: input.entityId,
    entityVersion: input.entityVersion,
    policyVersionId: policy.version.id,
    status: 'pending',
    currentStepNo: 1,
    subjectEmployeeId: input.subjectEmployeeId ?? null,
    submittedByUserId: input.submittedByUserId,
    department: cleanOptional(input.department),
    typeRef: cleanOptional(input.typeRef),
    days: input.days ?? null,
    amount: input.amount ?? null,
    currency: cleanOptional(input.currency),
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: approvalInstance.id });
  const insertedSteps = await exec.insert(approvalInstanceStep).values(steps.map((step) => {
    const active = step.stepNo === 1;
    return {
      ...scope,
      instanceId: instance.id,
      policyStepId: step.policyStepId,
      stepNo: step.stepNo,
      label: step.label,
      status: active ? 'pending' : 'waiting',
      originalAuthorityType: step.authority.type,
      originalAuthorityEmployeeId: step.authority.employeeId,
      originalAuthorityUserId: step.authority.userId,
      originalAuthorityPermissionKey: step.authority.permissionKey,
      currentAuthorityType: step.authority.type,
      currentAuthorityEmployeeId: step.authority.employeeId,
      currentAuthorityUserId: step.authority.userId,
      currentAuthorityPermissionKey: step.authority.permissionKey,
      escalationAuthorityType: step.escalation?.type ?? null,
      escalationAuthorityEmployeeId: step.escalation?.employeeId ?? null,
      escalationAuthorityUserId: step.escalation?.userId ?? null,
      escalationAuthorityPermissionKey: step.escalation?.permissionKey ?? null,
      activatedAt: active ? now : null,
      reminderDueAt: active ? addHours(now, step.reminderAfterHours) : null,
      escalationDueAt: active ? addHours(now, step.escalateAfterHours) : null,
      createdAt: now,
      updatedAt: now,
    };
  })).returning({
    id: approvalInstanceStep.id,
    stepNo: approvalInstanceStep.stepNo,
  });
  const first = insertedSteps[0];
  await appendEvent(exec, scope, {
    instanceId: instance.id,
    eventType: 'created',
    actorUserId: input.submittedByUserId,
    eventKey: `approval:${instance.id}:created`,
    occurredAt: now,
  });
  await appendEvent(exec, scope, {
    instanceId: instance.id,
    stepId: first.id,
    eventType: 'step_activated',
    eventKey: `approval:${instance.id}:step:1:activated`,
    occurredAt: now,
  });
  await notifyStep(exec, scope, steps[0].authority, {
    subject: `${input.domain} approval required`,
    detail: `${input.entityType} #${input.entityId} is awaiting ${steps[0].label}.`,
    entityRef: `${input.entityType}:${input.entityId}`,
  }, now);
  return {
    id: instance.id,
    policyVersionId: policy.version.id,
    policyCode: policy.policyCode,
    status: 'pending' as const,
    currentStepNo: 1,
    stepCount: steps.length,
  };
}

async function actorEmployeeWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
) {
  const [row] = await exec.select({
    id: employee.id,
    userId: employee.userId,
  }).from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.userId, actorUserId),
    eq(employee.isActive, true),
  )).limit(1);
  return row ?? null;
}

async function activeDelegationWithin(
  exec: DB,
  scope: Scope,
  domain: string,
  authorityEmployeeId: number,
  delegateEmployeeId: number,
  now: Date,
) {
  const [row] = await exec.select().from(approvalDelegation).where(and(
    eq(approvalDelegation.masterFn, scope.masterFn),
    eq(approvalDelegation.companyFn, scope.companyFn),
    eq(approvalDelegation.authorityEmployeeId, authorityEmployeeId),
    eq(approvalDelegation.delegateEmployeeId, delegateEmployeeId),
    or(isNull(approvalDelegation.domain), eq(approvalDelegation.domain, domain)),
    lte(approvalDelegation.validFrom, now),
    gte(approvalDelegation.validTo, now),
    isNull(approvalDelegation.revokedAt),
  )).orderBy(desc(approvalDelegation.id)).limit(1);
  return row ?? null;
}

async function authorizeDecision(
  exec: DB,
  scope: Scope,
  instance: typeof approvalInstance.$inferSelect,
  step: typeof approvalInstanceStep.$inferSelect,
  actorUserId: number,
  now: Date,
) {
  const actorEmployee = await actorEmployeeWithin(exec, scope, actorUserId);
  if (instance.subjectEmployeeId && actorEmployee?.id === instance.subjectEmployeeId) {
    throw new ApprovalWorkflowError(
      'self_approval_forbidden',
      'An employee cannot approve their own submission.',
      403,
    );
  }
  const authorizationContext = approvalAuthorizationContext(instance, step, scope);
  if (step.currentAuthorityType === 'permission' && step.currentAuthorityPermissionKey) {
    if (!await hasPermissionWithin(
      exec,
      scope,
      actorUserId,
      step.currentAuthorityPermissionKey,
      now,
      authorizationContext,
    )) {
      throw new ApprovalWorkflowError(
        'approval_authority_required',
        'The signed-in user does not hold the required approval authority.',
        403,
      );
    }
    return {
      actorEmployeeId: actorEmployee?.id ?? null,
      authoritySource: step.escalatedAt ? 'escalated' as const : 'permission' as const,
      delegationId: null,
    };
  }
  if (step.currentAuthorityUserId === actorUserId) {
    if (!actorEmployee) {
      throw new ApprovalWorkflowError(
        'approval_authority_required',
        'The assigned employee account is no longer active in this company.',
        403,
      );
    }
    return {
      actorEmployeeId: actorEmployee.id,
      authoritySource: step.escalatedAt ? 'escalated' as const : 'direct' as const,
      delegationId: null,
    };
  }
  if (!step.currentAuthorityEmployeeId || !actorEmployee) {
    throw new ApprovalWorkflowError(
      'approval_authority_required',
      'The signed-in user is not assigned to this approval step.',
      403,
    );
  }
  const delegation = await activeDelegationWithin(
    exec,
    scope,
    instance.domain,
    step.currentAuthorityEmployeeId,
    actorEmployee.id,
    now,
  );
  if (!delegation) {
    throw new ApprovalWorkflowError(
      'approval_authority_required',
      'The signed-in user is not assigned or actively delegated to this approval step.',
      403,
    );
  }
  return {
    actorEmployeeId: actorEmployee.id,
    authoritySource: 'delegated' as const,
    delegationId: delegation.id,
  };
}

function approvalAuthorizationContext(
  instance: typeof approvalInstance.$inferSelect,
  step: typeof approvalInstanceStep.$inferSelect,
  scope: Scope,
): {
  resourceKey: string;
  scopeTarget: AuthorizationScopeTarget;
  requireScope: true;
  authorizationContext: AuthorizationContext;
} {
  const resource = instance.domain === 'leave' && instance.entityType === 'leave_request'
    ? { moduleKey: 'hr', resourceKey: 'hr/leave-requests' }
    : instance.domain === 'expense' && instance.entityType === 'expense_claim_line'
      ? { moduleKey: 'finance', resourceKey: 'expenses/claims' }
      : null;
  if (!resource) {
    throw new ApprovalWorkflowError(
      'approval_context_missing',
      'The approval entity is not mapped to a registered module and resource.',
      409,
    );
  }
  return {
    ...resource,
    scopeTarget: instance.department
      ? { scope: 'department', targetType: 'department', targetId: instance.department }
      : instance.subjectEmployeeId
        ? { scope: 'self', targetType: 'employee', targetId: String(instance.subjectEmployeeId) }
        : { scope: 'company', targetType: 'company', targetId: scope.companyFn },
    requireScope: true,
    authorizationContext: {
      moduleKey: resource.moduleKey,
      policyVersionId: instance.policyVersionId,
      approvalInstanceId: instance.id,
      approvalStepId: step.id,
    },
  };
}

async function activateStep(
  exec: DB,
  scope: Scope,
  instanceId: number,
  step: typeof approvalInstanceStep.$inferSelect,
  now: Date,
) {
  const [policyStep] = step.policyStepId
    ? await exec.select({
      reminderAfterHours: approvalPolicyStep.reminderAfterHours,
      escalateAfterHours: approvalPolicyStep.escalateAfterHours,
    }).from(approvalPolicyStep).where(eq(approvalPolicyStep.id, step.policyStepId)).limit(1)
    : [];
  await exec.update(approvalInstanceStep).set({
    status: 'pending',
    activatedAt: now,
    reminderDueAt: addHours(now, policyStep?.reminderAfterHours ?? null),
    escalationDueAt: addHours(now, policyStep?.escalateAfterHours ?? null),
    updatedAt: now,
  }).where(eq(approvalInstanceStep.id, step.id));
  await appendEvent(exec, scope, {
    instanceId,
    stepId: step.id,
    eventType: 'step_activated',
    eventKey: `approval:${instanceId}:step:${step.stepNo}:activated`,
    occurredAt: now,
  });
  await notifyStep(exec, scope, {
    type: step.currentAuthorityType as ResolvedAuthority['type'],
    employeeId: step.currentAuthorityEmployeeId,
    userId: step.currentAuthorityUserId,
    permissionKey: step.currentAuthorityPermissionKey,
  }, {
    subject: 'Approval step required',
    detail: `Approval #${instanceId} is awaiting ${step.label}.`,
    entityRef: `approval:${instanceId}`,
  }, now);
}

export async function decideApprovalWithin(
  exec: DB,
  scope: Scope,
  input: {
    instanceId: number;
    actorUserId: number;
    decision: 'approved' | 'rejected' | 'returned';
    reason?: string | null;
  },
  now = new Date(),
) {
  const [instance] = await exec.select().from(approvalInstance).where(and(
    eq(approvalInstance.id, input.instanceId),
    eq(approvalInstance.masterFn, scope.masterFn),
    eq(approvalInstance.companyFn, scope.companyFn),
  )).limit(1).for('update');
  if (!instance) {
    throw new ApprovalWorkflowError('approval_instance_not_found', 'Approval instance not found.', 404);
  }
  if (instance.status !== 'pending') {
    throw new ApprovalWorkflowError(
      'approval_instance_terminal',
      'Only a Pending approval instance can be decided.',
      409,
    );
  }
  const [step] = await exec.select().from(approvalInstanceStep).where(and(
    eq(approvalInstanceStep.instanceId, instance.id),
    eq(approvalInstanceStep.masterFn, scope.masterFn),
    eq(approvalInstanceStep.companyFn, scope.companyFn),
    eq(approvalInstanceStep.stepNo, instance.currentStepNo),
  )).limit(1).for('update');
  if (!step || step.status !== 'pending') {
    throw new ApprovalWorkflowError(
      'approval_step_not_pending',
      'The current approval step is unavailable.',
      409,
    );
  }
  if (step.policyStepId) {
    const [policyStep] = await exec.select({ id: approvalPolicyStep.id }).from(approvalPolicyStep).where(and(
      eq(approvalPolicyStep.id, step.policyStepId),
      eq(approvalPolicyStep.masterFn, scope.masterFn),
      eq(approvalPolicyStep.companyFn, scope.companyFn),
      eq(approvalPolicyStep.policyVersionId, instance.policyVersionId),
    )).limit(1);
    if (!policyStep) {
      throw new ApprovalWorkflowError(
        'approval_policy_context_mismatch',
        'The active approval step is not part of the instance policy snapshot.',
        409,
      );
    }
  }
  const authority = await authorizeDecision(
    exec,
    scope,
    instance,
    step,
    input.actorUserId,
    now,
  );
  const reason = input.decision === 'rejected' || input.decision === 'returned'
    ? requireReason(
      input.reason,
      input.decision === 'returned'
        ? 'approval_return_reason_required'
        : 'approval_rejection_reason_required',
    )
    : cleanOptional(input.reason);
  const [decision] = await exec.insert(approvalDecision).values({
    ...scope,
    instanceId: instance.id,
    stepId: step.id,
    decision: input.decision,
    reason,
    actorUserId: input.actorUserId,
    actorEmployeeId: authority.actorEmployeeId,
    authoritySource: authority.authoritySource,
    originalAuthorityType: step.originalAuthorityType,
    originalAuthorityEmployeeId: step.originalAuthorityEmployeeId,
    originalAuthorityUserId: step.originalAuthorityUserId,
    originalAuthorityPermissionKey: step.originalAuthorityPermissionKey,
    delegationId: authority.delegationId,
    eventKey: `approval:${instance.id}:step:${step.stepNo}:${input.decision}`,
    decidedAt: now,
  }).returning({ id: approvalDecision.id });
  await exec.update(approvalInstanceStep).set({
    status: input.decision,
    decidedAt: now,
    updatedAt: now,
  }).where(eq(approvalInstanceStep.id, step.id));
  if (input.decision === 'rejected' || input.decision === 'returned') {
    await exec.update(approvalInstanceStep).set({
      status: 'cancelled',
      updatedAt: now,
    }).where(and(
      eq(approvalInstanceStep.instanceId, instance.id),
      eq(approvalInstanceStep.status, 'waiting'),
    ));
    await exec.update(approvalInstance).set({
      status: input.decision,
      completedAt: now,
      updatedAt: now,
    }).where(eq(approvalInstance.id, instance.id));
    await appendEvent(exec, scope, {
      instanceId: instance.id,
      stepId: step.id,
      eventType: input.decision,
      actorUserId: input.actorUserId,
      detail: reason,
      eventKey: `approval:${instance.id}:${input.decision}`,
      occurredAt: now,
    });
    return {
      id: instance.id,
      decisionId: decision.id,
      status: input.decision,
      currentStepNo: step.stepNo,
    };
  }
  await appendEvent(exec, scope, {
    instanceId: instance.id,
    stepId: step.id,
    eventType: 'step_approved',
    actorUserId: input.actorUserId,
    detail: reason,
    eventKey: `approval:${instance.id}:step:${step.stepNo}:approved`,
    occurredAt: now,
  });
  const [next] = await exec.select().from(approvalInstanceStep).where(and(
    eq(approvalInstanceStep.instanceId, instance.id),
    eq(approvalInstanceStep.stepNo, step.stepNo + 1),
  )).limit(1);
  if (next) {
    await exec.update(approvalInstance).set({
      currentStepNo: next.stepNo,
      updatedAt: now,
    }).where(eq(approvalInstance.id, instance.id));
    await activateStep(exec, scope, instance.id, next, now);
    return {
      id: instance.id,
      decisionId: decision.id,
      status: 'pending' as const,
      currentStepNo: next.stepNo,
    };
  }
  await exec.update(approvalInstance).set({
    status: 'approved',
    completedAt: now,
    updatedAt: now,
  }).where(eq(approvalInstance.id, instance.id));
  await appendEvent(exec, scope, {
    instanceId: instance.id,
    stepId: step.id,
    eventType: 'approved',
    actorUserId: input.actorUserId,
    eventKey: `approval:${instance.id}:approved`,
    occurredAt: now,
  });
  return {
    id: instance.id,
    decisionId: decision.id,
    status: 'approved' as const,
    currentStepNo: step.stepNo,
  };
}

export async function createApprovalDelegationWithin(
  exec: DB,
  scope: Scope,
  input: {
    domain?: string | null;
    authorityEmployeeId: number;
    delegateEmployeeId: number;
    validFrom: Date;
    validTo: Date;
    reason: string;
    createdByUserId: number;
  },
  now = new Date(),
) {
  if (input.authorityEmployeeId === input.delegateEmployeeId) {
    throw new ApprovalWorkflowError(
      'approval_delegation_self',
      'Approval authority cannot be delegated to the same employee.',
    );
  }
  const durationMs = input.validTo.getTime() - input.validFrom.getTime();
  if (durationMs <= 0 || durationMs > 90 * 24 * 60 * 60 * 1000) {
    throw new ApprovalWorkflowError(
      'approval_delegation_window_invalid',
      'Delegation must have a positive duration of at most 90 days.',
    );
  }
  if (input.validTo <= now) {
    throw new ApprovalWorkflowError(
      'approval_delegation_expired',
      'Delegation must end in the future.',
    );
  }
  const [authority, delegate] = await Promise.all([
    employeeAuthority(exec, scope, input.authorityEmployeeId),
    employeeAuthority(exec, scope, input.delegateEmployeeId),
  ]);
  if (!authority || !delegate) {
    throw new ApprovalWorkflowError(
      'approval_delegation_employee_unavailable',
      'Both delegation employees need active linked user accounts.',
    );
  }
  const [overlap] = await exec.select({ id: approvalDelegation.id }).from(approvalDelegation)
    .where(and(
      eq(approvalDelegation.masterFn, scope.masterFn),
      eq(approvalDelegation.companyFn, scope.companyFn),
      eq(approvalDelegation.authorityEmployeeId, input.authorityEmployeeId),
      eq(approvalDelegation.delegateEmployeeId, input.delegateEmployeeId),
      or(isNull(approvalDelegation.domain), eq(approvalDelegation.domain, input.domain ?? '')),
      isNull(approvalDelegation.revokedAt),
      lte(approvalDelegation.validFrom, input.validTo),
      gte(approvalDelegation.validTo, input.validFrom),
    )).limit(1);
  if (overlap) {
    throw new ApprovalWorkflowError(
      'approval_delegation_overlaps',
      'An overlapping active delegation already exists.',
      409,
    );
  }
  const [created] = await exec.insert(approvalDelegation).values({
    ...scope,
    domain: cleanOptional(input.domain),
    authorityEmployeeId: input.authorityEmployeeId,
    delegateEmployeeId: input.delegateEmployeeId,
    validFrom: input.validFrom,
    validTo: input.validTo,
    reason: requireReason(input.reason, 'approval_delegation_reason_required'),
    createdByUserId: input.createdByUserId,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: approvalDelegation.id });
  return { id: created.id, status: 'active' as const };
}

export async function listApprovalDelegationsWithin(
  exec: DB,
  scope: Scope,
  authorityEmployeeId: number,
) {
  return exec.select({
    id: approvalDelegation.id,
    domain: approvalDelegation.domain,
    authorityEmployeeId: approvalDelegation.authorityEmployeeId,
    delegateEmployeeId: approvalDelegation.delegateEmployeeId,
    delegateName: employee.fullName,
    validFrom: approvalDelegation.validFrom,
    validTo: approvalDelegation.validTo,
    reason: approvalDelegation.reason,
    revokedAt: approvalDelegation.revokedAt,
    createdAt: approvalDelegation.createdAt,
  }).from(approvalDelegation)
    .innerJoin(employee, and(
      eq(employee.id, approvalDelegation.delegateEmployeeId),
      eq(employee.masterFn, approvalDelegation.masterFn),
      eq(employee.companyFn, approvalDelegation.companyFn),
    ))
    .where(and(
      eq(approvalDelegation.masterFn, scope.masterFn),
      eq(approvalDelegation.companyFn, scope.companyFn),
      eq(approvalDelegation.authorityEmployeeId, authorityEmployeeId),
    )).orderBy(desc(approvalDelegation.id));
}

export async function listApprovalDelegationCandidatesWithin(
  exec: DB,
  scope: Scope,
  authorityEmployeeId: number,
) {
  const rows = await exec.select({
    id: employee.id,
    fullName: employee.fullName,
    department: employee.department,
    jobTitle: employee.jobTitle,
  }).from(employee)
    .innerJoin(appUser, and(
      eq(appUser.userId, employee.userId),
      eq(appUser.masterFn, employee.masterFn),
      eq(appUser.isActive, true),
    ))
    .where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.isActive, true),
    )).orderBy(asc(employee.fullName));
  return rows.filter((row) => row.id !== authorityEmployeeId);
}

export async function revokeApprovalDelegationWithin(
  exec: DB,
  scope: Scope,
  input: {
    delegationId: number;
    authorityEmployeeId: number;
    actorUserId: number;
  },
  now = new Date(),
) {
  const [row] = await exec.select().from(approvalDelegation).where(and(
    eq(approvalDelegation.id, input.delegationId),
    eq(approvalDelegation.masterFn, scope.masterFn),
    eq(approvalDelegation.companyFn, scope.companyFn),
    eq(approvalDelegation.authorityEmployeeId, input.authorityEmployeeId),
  )).limit(1).for('update');
  if (!row) {
    throw new ApprovalWorkflowError(
      'approval_delegation_not_found',
      'Approval delegation not found.',
      404,
    );
  }
  if (row.revokedAt) {
    return { id: row.id, status: 'revoked' as const, revokedAt: row.revokedAt };
  }
  await exec.update(approvalDelegation).set({
    revokedAt: now,
    revokedByUserId: input.actorUserId,
    updatedAt: now,
  }).where(eq(approvalDelegation.id, row.id));
  return { id: row.id, status: 'revoked' as const, revokedAt: now };
}

export async function cancelApprovalForEntityWithin(
  exec: DB,
  scope: Scope,
  input: {
    domain: string;
    entityType: string;
    entityId: number;
    actorUserId: number;
    reason: string;
  },
  now = new Date(),
) {
  const [instance] = await exec.select().from(approvalInstance).where(and(
    eq(approvalInstance.masterFn, scope.masterFn),
    eq(approvalInstance.companyFn, scope.companyFn),
    eq(approvalInstance.domain, input.domain),
    eq(approvalInstance.entityType, input.entityType),
    eq(approvalInstance.entityId, input.entityId),
    eq(approvalInstance.status, 'pending'),
  )).orderBy(desc(approvalInstance.id)).limit(1).for('update');
  if (!instance) return { cancelled: false };
  await exec.update(approvalInstanceStep).set({
    status: 'cancelled',
    updatedAt: now,
  }).where(and(
    eq(approvalInstanceStep.instanceId, instance.id),
    or(
      eq(approvalInstanceStep.status, 'pending'),
      eq(approvalInstanceStep.status, 'waiting'),
    ),
  ));
  await exec.update(approvalInstance).set({
    status: 'cancelled',
    completedAt: now,
    updatedAt: now,
  }).where(eq(approvalInstance.id, instance.id));
  await appendEvent(exec, scope, {
    instanceId: instance.id,
    eventType: 'cancelled',
    actorUserId: input.actorUserId,
    detail: input.reason,
    eventKey: `approval:${instance.id}:cancelled`,
    occurredAt: now,
  });
  return { cancelled: true, instanceId: instance.id };
}

export async function processApprovalTimersWithin(
  exec: DB,
  scope: Scope,
  now = new Date(),
) {
  const pending = await exec.select({
    step: approvalInstanceStep,
    instance: approvalInstance,
  }).from(approvalInstanceStep)
    .innerJoin(approvalInstance, and(
      eq(approvalInstance.id, approvalInstanceStep.instanceId),
      eq(approvalInstance.masterFn, approvalInstanceStep.masterFn),
      eq(approvalInstance.companyFn, approvalInstanceStep.companyFn),
    ))
    .where(and(
      eq(approvalInstanceStep.masterFn, scope.masterFn),
      eq(approvalInstanceStep.companyFn, scope.companyFn),
      eq(approvalInstanceStep.status, 'pending'),
      eq(approvalInstance.status, 'pending'),
    ));
  let reminded = 0;
  let escalated = 0;
  for (const row of pending) {
    if (row.step.reminderDueAt && !row.step.remindedAt && row.step.reminderDueAt <= now) {
      await exec.update(approvalInstanceStep).set({
        remindedAt: now,
        updatedAt: now,
      }).where(eq(approvalInstanceStep.id, row.step.id));
      await appendEvent(exec, scope, {
        instanceId: row.instance.id,
        stepId: row.step.id,
        eventType: 'reminder_sent',
        eventKey: `approval:${row.instance.id}:step:${row.step.stepNo}:reminder`,
        occurredAt: now,
      });
      await notifyStep(exec, scope, {
        type: row.step.currentAuthorityType as ResolvedAuthority['type'],
        employeeId: row.step.currentAuthorityEmployeeId,
        userId: row.step.currentAuthorityUserId,
        permissionKey: row.step.currentAuthorityPermissionKey,
      }, {
        subject: 'Approval reminder',
        detail: `Approval #${row.instance.id} is still awaiting ${row.step.label}.`,
        entityRef: `approval:${row.instance.id}`,
        severity: 'warning',
      }, now);
      reminded += 1;
    }
    if (
      row.step.escalationDueAt
      && !row.step.escalatedAt
      && row.step.escalationDueAt <= now
      && row.step.escalationAuthorityType
    ) {
      await exec.update(approvalInstanceStep).set({
        currentAuthorityType: row.step.escalationAuthorityType,
        currentAuthorityEmployeeId: row.step.escalationAuthorityEmployeeId,
        currentAuthorityUserId: row.step.escalationAuthorityUserId,
        currentAuthorityPermissionKey: row.step.escalationAuthorityPermissionKey,
        escalatedAt: now,
        updatedAt: now,
      }).where(eq(approvalInstanceStep.id, row.step.id));
      await appendEvent(exec, scope, {
        instanceId: row.instance.id,
        stepId: row.step.id,
        eventType: 'escalated',
        eventKey: `approval:${row.instance.id}:step:${row.step.stepNo}:escalated`,
        occurredAt: now,
      });
      await notifyStep(exec, scope, {
        type: row.step.escalationAuthorityType as ResolvedAuthority['type'],
        employeeId: row.step.escalationAuthorityEmployeeId,
        userId: row.step.escalationAuthorityUserId,
        permissionKey: row.step.escalationAuthorityPermissionKey,
      }, {
        subject: 'Approval escalated',
        detail: `Approval #${row.instance.id} escalated to you for ${row.step.label}.`,
        entityRef: `approval:${row.instance.id}`,
        severity: 'warning',
      }, now);
      escalated += 1;
    }
  }
  return { reminded, escalated };
}

async function actorCanSeeStep(
  exec: DB,
  scope: Scope,
  instance: typeof approvalInstance.$inferSelect,
  step: typeof approvalInstanceStep.$inferSelect,
  actorUserId: number,
  now: Date,
) {
  try {
    await authorizeDecision(exec, scope, instance, step, actorUserId, now);
    return true;
  } catch (error) {
    if (error instanceof ApprovalWorkflowError && error.status === 403) return false;
    throw error;
  }
}

export async function listApprovalQueueWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  domain?: string,
  now = new Date(),
) {
  const predicates = [
    eq(approvalInstance.masterFn, scope.masterFn),
    eq(approvalInstance.companyFn, scope.companyFn),
    eq(approvalInstance.status, 'pending'),
    eq(approvalInstanceStep.status, 'pending'),
  ];
  if (domain) predicates.push(eq(approvalInstance.domain, domain));
  const rows = await exec.select({
    instance: approvalInstance,
    step: approvalInstanceStep,
  }).from(approvalInstance)
    .innerJoin(approvalInstanceStep, and(
      eq(approvalInstanceStep.instanceId, approvalInstance.id),
      eq(approvalInstanceStep.stepNo, approvalInstance.currentStepNo),
    ))
    .where(and(...predicates))
    .orderBy(asc(approvalInstance.submittedAt), asc(approvalInstance.id));
  const visible = [];
  for (const row of rows) {
    if (await actorCanSeeStep(exec, scope, row.instance, row.step, actorUserId, now)) {
      visible.push({
        ...row.instance,
        stepId: row.step.id,
        stepLabel: row.step.label,
        stepActivatedAt: row.step.activatedAt,
        stepDueAt: row.step.escalationDueAt,
        escalatedAt: row.step.escalatedAt,
      });
    }
  }
  return visible;
}

export async function readApprovalInstanceWithin(
  exec: DB,
  scope: Scope,
  instanceId: number,
) {
  const [instance] = await exec.select().from(approvalInstance).where(and(
    eq(approvalInstance.id, instanceId),
    eq(approvalInstance.masterFn, scope.masterFn),
    eq(approvalInstance.companyFn, scope.companyFn),
  )).limit(1);
  if (!instance) {
    throw new ApprovalWorkflowError('approval_instance_not_found', 'Approval instance not found.', 404);
  }
  const [steps, decisions, events] = await Promise.all([
    exec.select().from(approvalInstanceStep).where(and(
      eq(approvalInstanceStep.masterFn, scope.masterFn),
      eq(approvalInstanceStep.companyFn, scope.companyFn),
      eq(approvalInstanceStep.instanceId, instance.id),
    )).orderBy(asc(approvalInstanceStep.stepNo)),
    exec.select().from(approvalDecision).where(and(
      eq(approvalDecision.masterFn, scope.masterFn),
      eq(approvalDecision.companyFn, scope.companyFn),
      eq(approvalDecision.instanceId, instance.id),
    )).orderBy(asc(approvalDecision.id)),
    exec.select().from(approvalInstanceEvent).where(and(
      eq(approvalInstanceEvent.masterFn, scope.masterFn),
      eq(approvalInstanceEvent.companyFn, scope.companyFn),
      eq(approvalInstanceEvent.instanceId, instance.id),
    )).orderBy(asc(approvalInstanceEvent.id)),
  ]);
  return { ...instance, steps, decisions, events };
}
