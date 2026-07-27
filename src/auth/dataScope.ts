import { and, eq, isNotNull } from 'drizzle-orm';
import type { DB } from '../data/db';
import { employee } from '../data/schema';
import type { SessionData } from './session';
import type { DataScope } from './accessCatalog';

export async function resolveScopedUserIds(
  db: DB,
  session: SessionData,
  scope: DataScope,
): Promise<number[]> {
  if (scope === 'company') return [];
  if (scope === 'self') return [session.userId];
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
  const actor = rows.find((row) => row.userId === session.userId);
  if (!actor) return [];
  if (scope === 'department') {
    return rows.filter((row) => row.department === actor.department)
      .map((row) => row.userId!)
      .sort((a, b) => a - b);
  }
  const included = new Set<number>([actor.id]);
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
