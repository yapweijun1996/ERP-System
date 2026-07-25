import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  employee,
  role,
  userCompanyRole,
} from '../../data/schema';
import type { Scope } from '../../data/repo';

export class ManagerRoleSyncError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ManagerRoleSyncError';
  }
}

/**
 * Reconciles only the system-owned Manager grant for one Employee.
 *
 * A manually assigned Manager role has managedBySystem=false and is never
 * removed here. This lets reporting lines add/remove the automatic grant
 * without silently revoking a separately authorised hierarchy assignment.
 */
export async function syncManagerRoleWithin(
  exec: DB,
  scope: Scope,
  employeeId: number,
  now = new Date(),
) {
  const [manager] = await exec.select({
    id: employee.id,
    userId: employee.userId,
    isActive: employee.isActive,
  }).from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.id, employeeId),
  )).limit(1);
  if (!manager?.userId) {
    return {
      employeeId,
      userId: manager?.userId ?? null,
      required: false,
      changed: false,
    };
  }

  const [managerRole] = await exec.select({ roleId: role.roleId })
    .from(role)
    .where(and(
      eq(role.masterFn, scope.masterFn),
      eq(role.name, 'Manager'),
    ))
    .limit(1);
  if (!managerRole) {
    throw new ManagerRoleSyncError(
      'manager_role_missing',
      'The Manager role is not configured for this organization.',
    );
  }

  const [activeReport] = manager.isActive
    ? await exec.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.managerId, manager.id),
      eq(employee.isActive, true),
    )).limit(1)
    : [];
  const required = Boolean(activeReport);
  const [existing] = await exec.select({
    managedBySystem: userCompanyRole.managedBySystem,
  }).from(userCompanyRole).where(and(
    eq(userCompanyRole.userId, manager.userId),
    eq(userCompanyRole.companyFn, scope.companyFn),
    eq(userCompanyRole.roleId, managerRole.roleId),
  )).limit(1);

  if (required) {
    if (existing) {
      return { employeeId, userId: manager.userId, required, changed: false };
    }
    const inserted = await exec.insert(userCompanyRole).values({
      userId: manager.userId,
      companyFn: scope.companyFn,
      roleId: managerRole.roleId,
      managedBySystem: true,
      updatedAt: now,
    }).onConflictDoNothing().returning({ roleId: userCompanyRole.roleId });
    return {
      employeeId,
      userId: manager.userId,
      required,
      changed: inserted.length > 0,
    };
  }

  if (existing?.managedBySystem) {
    await exec.delete(userCompanyRole).where(and(
      eq(userCompanyRole.userId, manager.userId),
      eq(userCompanyRole.companyFn, scope.companyFn),
      eq(userCompanyRole.roleId, managerRole.roleId),
      eq(userCompanyRole.managedBySystem, true),
    ));
    return { employeeId, userId: manager.userId, required, changed: true };
  }
  return { employeeId, userId: manager.userId, required, changed: false };
}

export async function syncManagerRolesWithin(
  exec: DB,
  scope: Scope,
  employeeIds: Array<number | null | undefined>,
) {
  const unique = [...new Set(employeeIds.filter(
    (employeeId): employeeId is number => Number.isSafeInteger(employeeId) && Number(employeeId) > 0,
  ))];
  const results = [];
  for (const employeeId of unique) {
    results.push(await syncManagerRoleWithin(exec, scope, employeeId));
  }
  return results;
}
