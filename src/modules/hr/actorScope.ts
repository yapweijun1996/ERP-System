import {
  and, asc, eq, gte, inArray, isNull, lte, or,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  employee,
  employeeHierarchyScope,
  leaveRequest,
} from '../../data/schema';

export class ActorScopeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'ActorScopeError';
  }
}

export async function resolveActorEmployeeWithin(
  exec: DB,
  scope: Scope,
  userId: number,
) {
  const rows = await exec.select({
    id: employee.id,
    employeeNo: employee.employeeNo,
    fullName: employee.fullName,
    email: employee.email,
    department: employee.department,
    jobTitle: employee.jobTitle,
    managerId: employee.managerId,
    startDate: employee.startDate,
    annualLeaveDays: employee.annualLeaveDays,
  }).from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.userId, userId),
    eq(employee.isActive, true),
  )).limit(2);
  if (rows.length !== 1) {
    throw new ActorScopeError(
      rows.length === 0 ? 'employee_identity_missing' : 'employee_identity_ambiguous',
      rows.length === 0
        ? 'The signed-in account is not linked to an active employee in this company.'
        : 'The signed-in account has more than one employee identity in this company.',
    );
  }
  return rows[0];
}

export async function listActorLeaveWithin(
  exec: DB,
  scope: Scope,
  employeeId: number,
) {
  return exec.select({
    id: leaveRequest.id,
    leaveType: leaveRequest.leaveType,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    days: leaveRequest.days,
    reason: leaveRequest.reason,
    status: leaveRequest.status,
    rejectionReason: leaveRequest.rejectionReason,
    decidedAt: leaveRequest.decidedAt,
    createdAt: leaveRequest.createdAt,
    updatedAt: leaveRequest.updatedAt,
  }).from(leaveRequest).where(and(
    eq(leaveRequest.masterFn, scope.masterFn),
    eq(leaveRequest.companyFn, scope.companyFn),
    eq(leaveRequest.employeeId, employeeId),
  )).orderBy(asc(leaveRequest.startDate), asc(leaveRequest.id)).limit(100);
}

export async function resolveTeamEmployeeIdsWithin(
  exec: DB,
  scope: Scope,
  actorEmployeeId: number,
  today = new Date().toISOString().slice(0, 10),
) {
  const employees = await exec.select({
    id: employee.id,
    managerId: employee.managerId,
  }).from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.isActive, true),
  ));
  const byManager = new Map<number, number[]>();
  const companyIds = new Set(employees.map((row) => row.id));
  for (const row of employees) {
    if (row.managerId == null) continue;
    const children = byManager.get(row.managerId) ?? [];
    children.push(row.id);
    byManager.set(row.managerId, children);
  }
  const permitted = new Set(byManager.get(actorEmployeeId) ?? []);
  const grants = await exec.select({
    rootId: employeeHierarchyScope.scopeRootEmployeeId,
    type: employeeHierarchyScope.scopeType,
  }).from(employeeHierarchyScope).where(and(
    eq(employeeHierarchyScope.masterFn, scope.masterFn),
    eq(employeeHierarchyScope.companyFn, scope.companyFn),
    eq(employeeHierarchyScope.granteeEmployeeId, actorEmployeeId),
    lte(employeeHierarchyScope.validFrom, today),
    or(isNull(employeeHierarchyScope.validTo), gte(employeeHierarchyScope.validTo, today)),
  ));
  for (const grant of grants) {
    if (!companyIds.has(grant.rootId)) continue;
    if (grant.type === 'direct') {
      for (const id of byManager.get(grant.rootId) ?? []) permitted.add(id);
      continue;
    }
    const queue = [grant.rootId];
    const visited = new Set<number>();
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (id !== actorEmployeeId) permitted.add(id);
      for (const child of byManager.get(id) ?? []) queue.push(child);
    }
  }
  permitted.delete(actorEmployeeId);
  return Array.from(permitted).sort((a, b) => a - b);
}

export async function listTeamLeaveWithin(
  exec: DB,
  scope: Scope,
  teamEmployeeIds: number[],
) {
  if (!teamEmployeeIds.length) return [];
  return exec.select({
    id: leaveRequest.id,
    employeeId: leaveRequest.employeeId,
    employeeNo: employee.employeeNo,
    employeeName: employee.fullName,
    department: employee.department,
    leaveType: leaveRequest.leaveType,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    days: leaveRequest.days,
    status: leaveRequest.status,
    createdAt: leaveRequest.createdAt,
  }).from(leaveRequest)
    .innerJoin(employee, eq(employee.id, leaveRequest.employeeId))
    .where(and(
      eq(leaveRequest.masterFn, scope.masterFn),
      eq(leaveRequest.companyFn, scope.companyFn),
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      inArray(leaveRequest.employeeId, teamEmployeeIds),
    ))
    .orderBy(asc(leaveRequest.startDate), asc(leaveRequest.id))
    .limit(100);
}
