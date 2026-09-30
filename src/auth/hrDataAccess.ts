import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { employee } from '../data/schema';
import type { SessionData } from './session';
import { authorize, principalFromSession, type AuthorizationContext, explicitDenyMatcherWithin } from './authorization';
import { effectiveCapabilitiesWithin, scopeGrantsForResource } from './permissions';
import { resolveScopedUserIds } from './dataScope';
import { resolveOrganizationEmployeeIdsWithin } from './organizationScope';

/** One current permission + assignment + tenant + staff projection for HR APIs.
 * null means company scope; [] means fail-closed. No request-owned tenant/target. */
export async function resolveHrEmployeeAccessWithin(
  exec: DB, session: SessionData, resource: string, permissionKey: string | string[],
  options: { context?: AuthorizationContext; now?: Date; includeInactiveTargets?: boolean } = {},
): Promise<number[] | null> {
  const permissionKeys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  const capabilities = await effectiveCapabilitiesWithin(exec, session);
  const grants = scopeGrantsForResource(capabilities, resource);
  const ids = new Set<number>();
  let companyAccess = false;
  const rows = await exec.select({ id: employee.id, userId: employee.userId, department: employee.department, businessUnitId: employee.businessUnitId, positionId: employee.positionId }).from(employee).where(and(
    eq(employee.masterFn, session.masterFn), eq(employee.companyFn, session.activeCompanyFn),
  ));
  for (const grant of grants) {
    const decisions = await Promise.all(permissionKeys.map(key => authorize(exec, {
      principal: principalFromSession(session), permissionKey: key,
      resourceKey: resource, requireScope: true, scopeTarget: grant, context: options.context, now: options.now,
    })));
    if (!decisions.some(decision => decision.allowed)) continue;
    if (grant.scope === 'company' && (grant.targetType === 'none'
      || grant.targetType === 'company' && grant.targetId === session.activeCompanyFn)) { companyAccess = true; continue; }
    if (grant.scope === 'business_unit' || grant.scope === 'position') {
      if (!['none', grant.scope].includes(grant.targetType)) continue;
      const targetId = grant.targetType === grant.scope ? Number(grant.targetId) : null;
      for (const id of await resolveOrganizationEmployeeIdsWithin(exec,
        { masterFn: session.masterFn, companyFn: session.activeCompanyFn }, session.userId, grant.scope, targetId, options.includeInactiveTargets)) ids.add(id);
    } else {
      const users = await resolveScopedUserIds(exec, session, grant.scope, grant);
      for (const row of rows) if (row.userId != null && users.includes(row.userId)) ids.add(row.id);
    }
  }
  const denyMatchers = await Promise.all(permissionKeys.map(key => explicitDenyMatcherWithin(exec, {
    principal: principalFromSession(session), permissionKey: key, resourceKey: resource,
    requireScope: true, now: options.now, context: options.context,
  })));
  const denied = (targets: Parameters<typeof denyMatchers[number]>[0]) => denyMatchers.some(matches => matches(targets));
  // Company-wide and unresolved relative denies across all entry candidates
  // apply even with no staff rows. Empty candidates never erase deny state.
  if (denied([{ scope: 'company', targetType: 'company', targetId: session.activeCompanyFn }])) return [];
  const candidates = rows.filter(row => companyAccess || ids.has(row.id));
  const allowed = candidates.filter(row => !denied([
    { scope: 'company', targetType: 'company', targetId: session.activeCompanyFn },
    { scope: 'self', targetType: 'employee', targetId: String(row.id) },
    { scope: 'department', targetType: 'department', targetId: row.department },
    ...(row.businessUnitId == null ? [] : [{ scope: 'business_unit' as const, targetType: 'business_unit', targetId: String(row.businessUnitId) }]),
    ...(row.positionId == null ? [] : [{ scope: 'position' as const, targetType: 'position', targetId: String(row.positionId) }]),
  ]));
  return companyAccess && allowed.length === candidates.length ? null : allowed.map(row => row.id).sort((a, b) => a - b);
}

/** Serialize with organization reassignment before a staff-scoped mutation. */
export async function assertHrEmployeeAccessWithin(
  exec: DB, session: SessionData, resource: string, permissionKey: string | string[], employeeId: number,
): Promise<void> {
  const staff = await exec.select({ id: employee.id }).from(employee).where(and(
    eq(employee.masterFn, session.masterFn), eq(employee.companyFn, session.activeCompanyFn),
    eq(employee.id, employeeId),
  )).limit(1).for('update');
  const access = await resolveHrEmployeeAccessWithin(exec, session, resource, permissionKey);
  if (!staff.length || access !== null && !access.includes(employeeId)) {
    const error = new Error('Current staff scope does not include this record.') as Error & { code: string; status: number };
    error.code = 'data_scope_denied'; error.status = staff.length ? 403 : 404; throw error;
  }
}

/** Employment end may reassign reports: every affected staff row needs authority. */
export async function assertHrEmploymentEndAccessWithin(
  exec: DB, session: SessionData, employeeId: number, handoffEmployeeId: number | null,
): Promise<void> {
  await assertHrEmployeeAccessWithin(exec, session, 'hr/employees', 'hr.write', employeeId);
  const reports = await exec.select({ id: employee.id }).from(employee).where(and(
    eq(employee.masterFn, session.masterFn), eq(employee.companyFn, session.activeCompanyFn),
    eq(employee.managerId, employeeId), eq(employee.isActive, true),
  )).for('update');
  for (const report of reports) {
    await assertHrEmployeeAccessWithin(exec, session, 'hr/employees', 'hr.write', report.id);
  }
  if (reports.length && handoffEmployeeId != null) {
    await assertHrEmployeeAccessWithin(exec, session, 'hr/employees', 'hr.write', handoffEmployeeId);
  }
}

/** Broad offboarding/configuration may affect several domains; restricted HR cannot run it. */
export async function assertHrCompanyAccessWithin(
  exec: DB, session: SessionData, permissionKey = 'hr.write',
): Promise<void> {
  const permission = await authorize(exec, { principal: principalFromSession(session), permissionKey });
  const scope = await resolveHrEmployeeAccessWithin(exec, session, 'hr/employees', permissionKey);
  if (!permission.allowed || scope !== null) {
    const error = new Error('Permission-qualified Company scope is required.') as Error & { code: string; status: number };
    error.code = 'data_scope_denied'; error.status = 403; throw error;
  }
}
