import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { employee } from '../data/schema';
import type { SessionData } from './session';
import { authorize, principalFromSession, type AuthorizationContext } from './authorization';
import { effectiveCapabilitiesWithin, scopeGrantsForResource } from './permissions';
import { resolveScopedUserIds } from './dataScope';
import { resolveOrganizationEmployeeIdsWithin } from './organizationScope';

/** One current permission + assignment + tenant + staff projection for HR APIs.
 * null means company scope; [] means fail-closed. No request-owned tenant/target. */
export async function resolveHrEmployeeAccessWithin(
  exec: DB, session: SessionData, resource: string, permissionKey: string,
  options: { context?: AuthorizationContext; now?: Date } = {},
): Promise<number[] | null> {
  const capabilities = await effectiveCapabilitiesWithin(exec, session);
  const grants = scopeGrantsForResource(capabilities, resource);
  const ids = new Set<number>();
  const rows = await exec.select({ id: employee.id, userId: employee.userId }).from(employee).where(and(
    eq(employee.masterFn, session.masterFn), eq(employee.companyFn, session.activeCompanyFn), eq(employee.isActive, true),
  ));
  for (const grant of grants) {
    const decision = await authorize(exec, { principal: principalFromSession(session), permissionKey,
      resourceKey: resource, requireScope: true, scopeTarget: grant, context: options.context, now: options.now });
    if (!decision.allowed) continue;
    if (grant.scope === 'company' && (grant.targetType === 'none'
      || grant.targetType === 'company' && grant.targetId === session.activeCompanyFn)) return null;
    if (grant.scope === 'business_unit' || grant.scope === 'position') {
      if (!['none', grant.scope].includes(grant.targetType)) continue;
      const targetId = grant.targetType === grant.scope ? Number(grant.targetId) : null;
      for (const id of await resolveOrganizationEmployeeIdsWithin(exec,
        { masterFn: session.masterFn, companyFn: session.activeCompanyFn }, session.userId, grant.scope, targetId)) ids.add(id);
    } else {
      const users = await resolveScopedUserIds(exec, session, grant.scope, grant);
      for (const row of rows) if (row.userId != null && users.includes(row.userId)) ids.add(row.id);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/** Serialize with organization reassignment before a staff-scoped mutation. */
export async function assertHrEmployeeAccessWithin(
  exec: DB, session: SessionData, resource: string, permissionKey: string, employeeId: number,
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
