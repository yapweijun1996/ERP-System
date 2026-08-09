import { and, eq, isNotNull } from 'drizzle-orm';
import type { DB } from '../data/db';
import { employee } from '../data/schema';
import type { SessionData } from './session';
import type { DataScope } from './accessCatalog';

export interface ScopeTarget {
  targetType: string;
  targetId: string | null;
}

export async function resolveScopedUserIds(
  db: DB,
  session: SessionData,
  scope: DataScope,
  target?: ScopeTarget,
): Promise<number[]> {
  if (scope === 'company') return [];
  const rows = await db.select({
    id: employee.id,
    userId: employee.userId,
    managerId: employee.managerId,
    department: employee.department,
  }).from(employee).where(and(
    eq(employee.masterFn, session.masterFn),
    eq(employee.companyFn, session.activeCompanyFn),
    eq(employee.isActive, true),
    isNotNull(employee.userId),
  ));
  if (scope === 'self') {
    if (!target || target.targetType === 'none') return [session.userId];
    if (!['employee', 'team'].includes(target.targetType) || !target.targetId) return [];
    const employeeId = Number(target.targetId);
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) return [];
    return rows
      .filter((row) => row.id === employeeId)
      .map((row) => row.userId!)
      .sort((a, b) => a - b);
  }
  const actor = rows.find((row) => row.userId === session.userId);
  if (!actor && (!target || target.targetType === 'none')) return [];
  if (scope === 'department') {
    const department = target?.targetType === 'department'
      ? target.targetId
      : target?.targetType && target.targetType !== 'none'
        ? null
        : actor?.department;
    if (!department) return [];
    return rows.filter((row) => row.department === department)
      .map((row) => row.userId!)
      .sort((a, b) => a - b);
  }
  const targetEmployeeId = target?.targetType === 'team' || target?.targetType === 'employee'
    ? Number(target.targetId)
    : actor?.id;
  if (targetEmployeeId == null || !Number.isSafeInteger(targetEmployeeId) || targetEmployeeId <= 0) return [];
  const included = new Set<number>([targetEmployeeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (row.managerId != null && included.has(row.managerId) && !included.has(row.id)) {
        included.add(row.id);
        changed = true;
      }
    }
  }
  return rows.filter((row) => included.has(row.id)).map((row) => row.userId!);
}
