import { sql } from 'drizzle-orm';
import type { DB } from '../../data/db';

/**
 * The setup wizard is an anonymous, one-time bootstrap. It is only available
 * before the database contains any tenant foundation rows. Migrations may have
 * created the tables already; that is still considered an empty database for
 * this purpose.
 */
export interface ProductionSetupStatus {
  hasAdmin: boolean;
  isFreshDatabase: boolean;
}

export async function getProductionSetupStatus(db: DB): Promise<ProductionSetupStatus> {
  const result = await db.execute(sql`
    select
      (select count(*)::int from "master") as masters,
      (select count(*)::int from "company") as companies,
      (select count(*)::int from "app_user") as users,
      (select count(*)::int from "role") as roles,
      (select count(*)::int from "user_company") as memberships,
      (select count(*)::int from "user_company_role") as role_assignments,
      (select count(*)::int from "system_state" where "key" = 'production_setup') as setup_states
  `) as { rows: Array<Record<string, unknown>> };
  const row = result.rows[0] as Record<string, unknown> | undefined;
  const count = (value: unknown): number => Number(value ?? 0);
  const masters = count(row?.masters);
  const companies = count(row?.companies);
  const users = count(row?.users);
  const roles = count(row?.roles);
  const memberships = count(row?.memberships);
  const roleAssignments = count(row?.role_assignments);
  const setupStates = count(row?.setup_states);

  return {
    hasAdmin: users > 0,
    isFreshDatabase: [
      masters,
      companies,
      users,
      roles,
      memberships,
      roleAssignments,
      setupStates,
    ].every((value) => value === 0),
  };
}
