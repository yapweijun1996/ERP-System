import {
  and, asc, desc, eq, inArray,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  appUser,
  approvalInstance,
  approvalPolicy,
  approvalPolicyStep,
  approvalPolicyVersion,
  employee,
} from '../../data/schema';
import { isTenantPermission } from '../../auth/permissionRegistry';

export type LeaveApprovalAuthorityType = 'direct_manager' | 'permission' | 'named_employee';

export interface LeaveApprovalWorkflowStepInput {
  label: string;
  authorityType: LeaveApprovalAuthorityType;
  authorityEmployeeId?: number | null;
  authorityPermissionKey?: string | null;
  managerLevel?: number;
  fallbackPermissionKey?: string | null;
  reminderAfterHours?: number | null;
  escalateAfterHours?: number | null;
  escalationAuthorityType?: 'permission' | 'named_employee' | null;
  escalationEmployeeId?: number | null;
  escalationPermissionKey?: string | null;
}

export interface LeaveApprovalWorkflowInput {
  code: string;
  name: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  priority?: number;
  employeeId?: number | null;
  department?: string | null;
  typeRef?: string | null;
  minimumDays?: string | number | null;
  maximumDays?: string | number | null;
  steps: LeaveApprovalWorkflowStepInput[];
}

export class LeaveApprovalWorkflowError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'LeaveApprovalWorkflowError';
  }
}

export interface LeaveApprovalWorkflowRow {
  id: number;
  policyId: number;
  code: string;
  name: string;
  domain: string;
  versionNo: number;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  priority: number;
  employeeId: number | null;
  department: string | null;
  typeRef: string | null;
  minimumDays: string | null;
  maximumDays: string | null;
  confirmedAt: Date | null;
  steps: Array<{
    id: number;
    stepNo: number;
    label: string;
    authorityType: string;
    authorityEmployeeId: number | null;
    authorityEmployeeName: string | null;
    authorityPermissionKey: string | null;
    managerLevel: number;
    fallbackPermissionKey: string | null;
    reminderAfterHours: number | null;
    escalateAfterHours: number | null;
    escalationAuthorityType: string | null;
    escalationEmployeeId: number | null;
    escalationEmployeeName: string | null;
    escalationPermissionKey: string | null;
  }>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CODE_RE = /^[A-Z][A-Z0-9_-]{1,47}$/;
const PERMISSION_RE = /^[a-z][a-z0-9_.-]{2,79}$/;

function cleanText(value: unknown, label: string, maximum: number): string {
  const result = String(value ?? '').trim();
  if (!result) throw new LeaveApprovalWorkflowError('validation_failed', `${label} is required.`);
  if (result.length > maximum) {
    throw new LeaveApprovalWorkflowError('validation_failed', `${label} must be ${maximum} characters or fewer.`);
  }
  return result;
}

function optionalText(value: unknown, label: string, maximum: number): string | null {
  if (value == null || String(value).trim() === '') return null;
  return cleanText(value, label, maximum);
}

function dateValue(value: unknown, label: string, required = true): string | null {
  const result = String(value ?? '').trim();
  if (!result && !required) return null;
  if (!DATE_RE.test(result)) {
    throw new LeaveApprovalWorkflowError('validation_failed', `${label} must be an ISO date (YYYY-MM-DD).`);
  }
  const date = new Date(`${result}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result) {
    throw new LeaveApprovalWorkflowError('validation_failed', `${label} is not a valid date.`);
  }
  return result;
}

function decimalValue(value: unknown, label: string): string | null {
  if (value == null || String(value).trim() === '') return null;
  const result = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(result)) {
    throw new LeaveApprovalWorkflowError('validation_failed', `${label} must be a non-negative number with up to 2 decimals.`);
  }
  const numeric = Number(result);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 99999999) {
    throw new LeaveApprovalWorkflowError('validation_failed', `${label} is outside the supported range.`);
  }
  return numeric.toFixed(2);
}

function positiveInteger(value: unknown, label: string, fallback: number): number {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new LeaveApprovalWorkflowError('validation_failed', `${label} must be a positive integer.`);
  }
  return number;
}

function optionalHours(value: unknown, label: string): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > 8760) {
    throw new LeaveApprovalWorkflowError('validation_failed', `${label} must be between 1 and 8760 hours.`);
  }
  return number;
}

function permissionValue(value: unknown, label: string): string | null {
  const result = optionalText(value, label, 80);
  if (result && !PERMISSION_RE.test(result)) {
    throw new LeaveApprovalWorkflowError('validation_failed', `${label} is not a valid permission key.`);
  }
  if (result && !isTenantPermission(result)) {
    throw new LeaveApprovalWorkflowError('validation_failed', `${label} is not registered by the application.`);
  }
  return result;
}

function authorityType(value: unknown, label: string): LeaveApprovalAuthorityType {
  if (value === 'direct_manager' || value === 'permission' || value === 'named_employee') {
    return value;
  }
  throw new LeaveApprovalWorkflowError('validation_failed', `${label} is not a supported approval authority.`);
}

function escalationType(value: unknown): 'permission' | 'named_employee' | null {
  if (value == null || value === '') return null;
  if (value === 'permission' || value === 'named_employee') return value;
  throw new LeaveApprovalWorkflowError('validation_failed', 'Escalation authority is not supported.');
}

async function assertActiveEmployee(
  exec: DB,
  scope: Scope,
  employeeId: number,
  label: string,
): Promise<void> {
  const [row] = await exec.select({
    id: employee.id,
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
  if (!row || row.active !== true || !row.userId || row.userActive !== true) {
    throw new LeaveApprovalWorkflowError(
      'validation_failed',
      `${label} must be an active employee with a linked active login account.`,
    );
  }
}

async function normalizeSteps(
  exec: DB,
  scope: Scope,
  input: unknown,
): Promise<Array<typeof approvalPolicyStep.$inferInsert>> {
  if (!Array.isArray(input) || input.length < 1 || input.length > 8) {
    throw new LeaveApprovalWorkflowError('validation_failed', 'Configure between 1 and 8 approval steps.');
  }
  const rows: Array<typeof approvalPolicyStep.$inferInsert> = [];
  for (const [index, raw] of input.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new LeaveApprovalWorkflowError('validation_failed', `Approval step ${index + 1} is invalid.`);
    }
    const step = raw as LeaveApprovalWorkflowStepInput;
    const type = authorityType(step.authorityType, `Step ${index + 1} authority`);
    const label = cleanText(step.label, `Step ${index + 1} label`, 120);
    const rawEmployeeId = step.authorityEmployeeId as unknown;
    const employeeId = rawEmployeeId == null || rawEmployeeId === ''
      ? null : Number(rawEmployeeId);
    const permissionKey = permissionValue(step.authorityPermissionKey, `Step ${index + 1} permission`);
    const managerLevel = positiveInteger(step.managerLevel, `Step ${index + 1} manager level`, 1);
    if (type === 'direct_manager' && (employeeId != null || permissionKey)) {
      throw new LeaveApprovalWorkflowError('validation_failed', `Step ${index + 1} direct manager authority cannot include an employee or permission.`);
    }
    if (type === 'permission' && (!permissionKey || employeeId != null)) {
      throw new LeaveApprovalWorkflowError('validation_failed', `Step ${index + 1} permission authority needs a permission key only.`);
    }
    if (type === 'named_employee' && (employeeId == null || !Number.isSafeInteger(employeeId) || employeeId <= 0 || permissionKey)) {
      throw new LeaveApprovalWorkflowError('validation_failed', `Step ${index + 1} named employee authority needs an employee only.`);
    }
    if (employeeId != null) await assertActiveEmployee(exec, scope, employeeId, `Step ${index + 1} authority employee`);
    const fallbackPermissionKey = permissionValue(
      step.fallbackPermissionKey,
      `Step ${index + 1} fallback permission`,
    );
    const escalationAuthorityType = escalationType(step.escalationAuthorityType);
    const rawEscalationEmployeeId = step.escalationEmployeeId as unknown;
    const escalationEmployeeId = rawEscalationEmployeeId == null || rawEscalationEmployeeId === ''
      ? null : Number(rawEscalationEmployeeId);
    const escalationPermissionKey = permissionValue(
      step.escalationPermissionKey,
      `Step ${index + 1} escalation permission`,
    );
    if (escalationAuthorityType === 'named_employee') {
      if (escalationEmployeeId == null || !Number.isSafeInteger(escalationEmployeeId) || escalationEmployeeId <= 0 || escalationPermissionKey) {
        throw new LeaveApprovalWorkflowError('validation_failed', `Step ${index + 1} named escalation needs an employee only.`);
      }
      await assertActiveEmployee(exec, scope, escalationEmployeeId, `Step ${index + 1} escalation employee`);
    } else if (escalationAuthorityType === 'permission') {
      if (!escalationPermissionKey || escalationEmployeeId != null) {
        throw new LeaveApprovalWorkflowError('validation_failed', `Step ${index + 1} permission escalation needs a permission key only.`);
      }
    } else if (escalationEmployeeId != null || escalationPermissionKey) {
      throw new LeaveApprovalWorkflowError('validation_failed', `Step ${index + 1} escalation authority is incomplete.`);
    }
    const reminderAfterHours = optionalHours(step.reminderAfterHours, `Step ${index + 1} reminder window`);
    const escalateAfterHours = optionalHours(step.escalateAfterHours, `Step ${index + 1} escalation window`);
    if (reminderAfterHours != null && escalateAfterHours != null && escalateAfterHours < reminderAfterHours) {
      throw new LeaveApprovalWorkflowError('validation_failed', `Step ${index + 1} escalation window must not precede the reminder window.`);
    }
    rows.push({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      policyVersionId: 0,
      stepNo: index + 1,
      label,
      authorityType: type,
      authorityEmployeeId: type === 'named_employee' ? employeeId : null,
      authorityPermissionKey: type === 'permission' ? permissionKey : null,
      managerLevel,
      fallbackPermissionKey,
      reminderAfterHours,
      escalateAfterHours,
      escalationAuthorityType,
      escalationEmployeeId: escalationAuthorityType === 'named_employee' ? escalationEmployeeId : null,
      escalationPermissionKey: escalationAuthorityType === 'permission' ? escalationPermissionKey : null,
    });
  }
  return rows;
}

function normalizeWorkflowInput(input: LeaveApprovalWorkflowInput): {
  code: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  priority: number;
  employeeId: number | null;
  department: string | null;
  typeRef: string | null;
  minimumDays: string | null;
  maximumDays: string | null;
} {
  const code = cleanText(input.code, 'Workflow code', 48).toUpperCase();
  if (!CODE_RE.test(code)) {
    throw new LeaveApprovalWorkflowError('validation_failed', 'Workflow code may contain uppercase letters, numbers, hyphens and underscores only.');
  }
  const name = cleanText(input.name, 'Workflow name', 160);
  const effectiveFrom = dateValue(input.effectiveFrom, 'Effective from')!;
  const effectiveTo = dateValue(input.effectiveTo, 'Effective to', false);
  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new LeaveApprovalWorkflowError('validation_failed', 'Effective to must be on or after effective from.');
  }
  const priority = Number(input.priority ?? 0);
  if (!Number.isSafeInteger(priority) || priority < 0 || priority > 100000) {
    throw new LeaveApprovalWorkflowError('validation_failed', 'Priority must be a whole number from 0 to 100000.');
  }
  const rawEmployeeId = input.employeeId as unknown;
  const employeeId = rawEmployeeId == null || rawEmployeeId === '' ? null : Number(rawEmployeeId);
  if (employeeId != null && (!Number.isSafeInteger(employeeId) || employeeId <= 0)) {
    throw new LeaveApprovalWorkflowError('validation_failed', 'Employee scope must be a valid employee.');
  }
  const minimumDays = decimalValue(input.minimumDays, 'Minimum days');
  const maximumDays = decimalValue(input.maximumDays, 'Maximum days');
  if (minimumDays != null && maximumDays != null && Number(maximumDays) < Number(minimumDays)) {
    throw new LeaveApprovalWorkflowError('validation_failed', 'Maximum days must be on or after minimum days.');
  }
  return {
    code,
    name,
    effectiveFrom,
    effectiveTo,
    priority,
    employeeId,
    department: optionalText(input.department, 'Department', 120),
    typeRef: optionalText(input.typeRef, 'Leave type', 80)?.toUpperCase() ?? null,
    minimumDays,
    maximumDays,
  };
}

async function readVersionRows(exec: DB, scope: Scope): Promise<LeaveApprovalWorkflowRow[]> {
  const policies = await exec.select().from(approvalPolicy).where(and(
    eq(approvalPolicy.masterFn, scope.masterFn),
    eq(approvalPolicy.companyFn, scope.companyFn),
    eq(approvalPolicy.domain, 'leave'),
  )).orderBy(asc(approvalPolicy.code));
  if (!policies.length) return [];
  const policyIds = policies.map((policy) => policy.id);
  const versions = await exec.select().from(approvalPolicyVersion).where(and(
    eq(approvalPolicyVersion.masterFn, scope.masterFn),
    eq(approvalPolicyVersion.companyFn, scope.companyFn),
    inArray(approvalPolicyVersion.policyId, policyIds),
  )).orderBy(desc(approvalPolicyVersion.id));
  if (!versions.length) return [];
  const versionIds = versions.map((version) => version.id);
  const steps = await exec.select().from(approvalPolicyStep).where(and(
    eq(approvalPolicyStep.masterFn, scope.masterFn),
    eq(approvalPolicyStep.companyFn, scope.companyFn),
    inArray(approvalPolicyStep.policyVersionId, versionIds),
  )).orderBy(asc(approvalPolicyStep.policyVersionId), asc(approvalPolicyStep.stepNo));
  const employeeIds = [...new Set(steps.flatMap((step) => [
    step.authorityEmployeeId,
    step.escalationEmployeeId,
  ]).filter((id): id is number => id != null))];
  const employees = employeeIds.length
    ? await exec.select({ id: employee.id, fullName: employee.fullName }).from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      inArray(employee.id, employeeIds),
    ))
    : [];
  const employeeNames = new Map(employees.map((item) => [item.id, item.fullName]));
  const policyNames = new Map(policies.map((policy) => [policy.id, policy]));
  const stepsByVersion = new Map<number, typeof steps>();
  for (const step of steps) {
    const current = stepsByVersion.get(step.policyVersionId) ?? [];
    current.push(step);
    stepsByVersion.set(step.policyVersionId, current);
  }
  return versions.map((version) => {
    const policy = policyNames.get(version.policyId)!;
    return {
      id: version.id,
      policyId: policy.id,
      code: policy.code,
      name: policy.name,
      domain: policy.domain,
      versionNo: version.versionNo,
      status: version.status,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo,
      priority: version.priority,
      employeeId: version.employeeId,
      department: version.department,
      typeRef: version.typeRef,
      minimumDays: version.minimumDays,
      maximumDays: version.maximumDays,
      confirmedAt: version.confirmedAt,
      steps: (stepsByVersion.get(version.id) ?? []).map((step) => ({
        id: step.id,
        stepNo: step.stepNo,
        label: step.label,
        authorityType: step.authorityType,
        authorityEmployeeId: step.authorityEmployeeId,
        authorityEmployeeName: step.authorityEmployeeId == null ? null : employeeNames.get(step.authorityEmployeeId) ?? null,
        authorityPermissionKey: step.authorityPermissionKey,
        managerLevel: step.managerLevel,
        fallbackPermissionKey: step.fallbackPermissionKey,
        reminderAfterHours: step.reminderAfterHours,
        escalateAfterHours: step.escalateAfterHours,
        escalationAuthorityType: step.escalationAuthorityType,
        escalationEmployeeId: step.escalationEmployeeId,
        escalationEmployeeName: step.escalationEmployeeId == null ? null : employeeNames.get(step.escalationEmployeeId) ?? null,
        escalationPermissionKey: step.escalationPermissionKey,
      })),
    };
  });
}

export async function listLeaveApprovalWorkflowsWithin(
  exec: DB,
  scope: Scope,
): Promise<LeaveApprovalWorkflowRow[]> {
  return readVersionRows(exec, scope);
}

export async function createLeaveApprovalWorkflowDraftWithin(
  exec: DB,
  scope: Scope,
  input: LeaveApprovalWorkflowInput,
): Promise<LeaveApprovalWorkflowRow> {
  const normalized = normalizeWorkflowInput(input);
  const steps = await normalizeSteps(exec, scope, input.steps);
  if (normalized.employeeId != null) {
    await assertActiveEmployee(exec, scope, normalized.employeeId, 'Employee scope');
  }
  let [policy] = await exec.select().from(approvalPolicy).where(and(
    eq(approvalPolicy.masterFn, scope.masterFn),
    eq(approvalPolicy.companyFn, scope.companyFn),
    eq(approvalPolicy.code, normalized.code),
  )).limit(1).for('update');
  if (policy && policy.domain !== 'leave') {
    throw new LeaveApprovalWorkflowError('workflow_code_conflict', 'This workflow code belongs to another approval domain.', 409);
  }
  if (!policy) {
    [policy] = await exec.insert(approvalPolicy).values({
      ...scope,
      code: normalized.code,
      name: normalized.name,
      domain: 'leave',
      isActive: true,
    }).returning();
  }
  const [latest] = await exec.select({ versionNo: approvalPolicyVersion.versionNo })
    .from(approvalPolicyVersion)
    .where(and(
      eq(approvalPolicyVersion.masterFn, scope.masterFn),
      eq(approvalPolicyVersion.companyFn, scope.companyFn),
      eq(approvalPolicyVersion.policyId, policy.id),
    )).orderBy(desc(approvalPolicyVersion.versionNo)).limit(1).for('update');
  const [version] = await exec.insert(approvalPolicyVersion).values({
    ...scope,
    policyId: policy.id,
    versionNo: (latest?.versionNo ?? 0) + 1,
    effectiveFrom: normalized.effectiveFrom,
    effectiveTo: normalized.effectiveTo,
    status: 'draft',
    priority: normalized.priority,
    employeeId: normalized.employeeId,
    department: normalized.department,
    typeRef: normalized.typeRef,
    minimumDays: normalized.minimumDays,
    maximumDays: normalized.maximumDays,
  }).returning({ id: approvalPolicyVersion.id });
  await exec.insert(approvalPolicyStep).values(steps.map((step) => ({
    ...step,
    policyVersionId: version.id,
  })));
  const rows = await readVersionRows(exec, scope);
  const created = rows.find((row) => row.id === version.id);
  if (!created) throw new LeaveApprovalWorkflowError('workflow_create_failed', 'The workflow draft could not be read after creation.', 500);
  return created;
}

export async function confirmLeaveApprovalWorkflowWithin(
  exec: DB,
  scope: Scope,
  versionId: number,
  actorUserId: number,
): Promise<LeaveApprovalWorkflowRow> {
  const [version] = await exec.select().from(approvalPolicyVersion).where(and(
    eq(approvalPolicyVersion.id, versionId),
    eq(approvalPolicyVersion.masterFn, scope.masterFn),
    eq(approvalPolicyVersion.companyFn, scope.companyFn),
  )).limit(1).for('update');
  if (!version) throw new LeaveApprovalWorkflowError('workflow_not_found', 'Workflow version not found.', 404);
  if (version.status !== 'draft') throw new LeaveApprovalWorkflowError('workflow_not_draft', 'Only a draft workflow can be confirmed.', 409);
  const [step] = await exec.select({ id: approvalPolicyStep.id }).from(approvalPolicyStep).where(and(
    eq(approvalPolicyStep.masterFn, scope.masterFn),
    eq(approvalPolicyStep.companyFn, scope.companyFn),
    eq(approvalPolicyStep.policyVersionId, version.id),
  )).limit(1);
  if (!step) throw new LeaveApprovalWorkflowError('workflow_has_no_steps', 'A workflow must contain at least one approval step.', 409);
  await exec.update(approvalPolicyVersion).set({
    status: 'confirmed',
    confirmedByUserId: actorUserId,
    confirmedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(approvalPolicyVersion.id, version.id),
    eq(approvalPolicyVersion.status, 'draft'),
  ));
  const rows = await readVersionRows(exec, scope);
  const confirmed = rows.find((row) => row.id === version.id);
  if (!confirmed) throw new LeaveApprovalWorkflowError('workflow_confirm_failed', 'The confirmed workflow could not be read.', 500);
  return confirmed;
}

export async function retireLeaveApprovalWorkflowWithin(
  exec: DB,
  scope: Scope,
  versionId: number,
): Promise<LeaveApprovalWorkflowRow> {
  const [version] = await exec.select().from(approvalPolicyVersion).where(and(
    eq(approvalPolicyVersion.id, versionId),
    eq(approvalPolicyVersion.masterFn, scope.masterFn),
    eq(approvalPolicyVersion.companyFn, scope.companyFn),
  )).limit(1).for('update');
  if (!version) throw new LeaveApprovalWorkflowError('workflow_not_found', 'Workflow version not found.', 404);
  if (version.status !== 'confirmed') throw new LeaveApprovalWorkflowError('workflow_not_confirmed', 'Only a confirmed workflow can be retired.', 409);
  const [pending] = await exec.select({ id: approvalInstance.id }).from(approvalInstance).where(and(
    eq(approvalInstance.masterFn, scope.masterFn),
    eq(approvalInstance.companyFn, scope.companyFn),
    eq(approvalInstance.policyVersionId, version.id),
    eq(approvalInstance.status, 'pending'),
  )).limit(1);
  if (pending) throw new LeaveApprovalWorkflowError('workflow_in_use', 'A workflow with pending leave approvals cannot be retired.', 409);
  await exec.update(approvalPolicyVersion).set({
    status: 'retired',
    updatedAt: new Date(),
  }).where(and(
    eq(approvalPolicyVersion.id, version.id),
    eq(approvalPolicyVersion.status, 'confirmed'),
  ));
  const rows = await readVersionRows(exec, scope);
  const retired = rows.find((row) => row.id === version.id);
  if (!retired) throw new LeaveApprovalWorkflowError('workflow_retire_failed', 'The retired workflow could not be read.', 500);
  return retired;
}
