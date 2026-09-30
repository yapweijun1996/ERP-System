import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import type { Scope } from '../data/repo';
import { businessUnit, employee, hrPosition } from '../data/schema';

export type OrganizationDataScope = 'business_unit' | 'position';
/** Record projection only: callers must separately authorize a live permission
 * and assignment grant. This helper never grants a permission or widens a scope.
 * A null target derives from the actor's current active employee assignment.
 * An explicit target must be a verified grant target, never request input. */
export async function resolveOrganizationEmployeeIdsWithin(
  exec: DB, scope: Scope, actorUserId: number, dataScope: OrganizationDataScope,
  verifiedTargetId: number | null = null,
  includeInactiveTargets = false,
): Promise<number[]> {
  const table = dataScope === 'business_unit' ? businessUnit : dataScope === 'position' ? hrPosition : null;
  if (!table || !Number.isSafeInteger(actorUserId) || actorUserId <= 0) return [];
  const [actor] = await exec.select().from(employee).where(and(
    eq(employee.masterFn, scope.masterFn), eq(employee.companyFn, scope.companyFn),
    eq(employee.userId, actorUserId), eq(employee.isActive, true),
  )).limit(1);
  // Even a verified explicit target requires the actor to have an organization
  // assignment: unassigned/accountless/former staff receive no organization scope.
  const assignment = dataScope === 'business_unit' ? actor?.businessUnitId : actor?.positionId;
  if (assignment == null) return [];
  const [activeAssignment] = await exec.select({ id: table.id }).from(table).where(and(
    eq(table.masterFn, scope.masterFn), eq(table.companyFn, scope.companyFn), eq(table.id, assignment), eq(table.isActive, true),
  )).limit(1);
  if (!activeAssignment) return [];
  const targetId = verifiedTargetId ?? assignment;
  if (!Number.isSafeInteger(targetId) || targetId <= 0) return [];
  const [target] = await exec.select({ id: table.id }).from(table).where(and(
    eq(table.masterFn, scope.masterFn), eq(table.companyFn, scope.companyFn), eq(table.id, targetId), eq(table.isActive, true),
  )).limit(1);
  if (!target) return [];
  const column = dataScope === 'business_unit' ? employee.businessUnitId : employee.positionId;
  const rows = await exec.select({ id: employee.id }).from(employee).where(and(
    eq(employee.masterFn, scope.masterFn), eq(employee.companyFn, scope.companyFn),
    ...(includeInactiveTargets ? [] : [eq(employee.isActive, true)]), eq(column, targetId),
  )).orderBy(employee.id);
  return rows.map(row => row.id);
}
