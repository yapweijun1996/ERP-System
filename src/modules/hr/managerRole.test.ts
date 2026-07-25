import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import {
  appUser,
  employee,
  role,
  userCompanyRole,
} from '../../data/schema';
import { freshDb } from '../../test/helpers';
import { createEmployee } from './employee';
import { syncManagerRoleWithin } from './managerRole';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

describe('reporting-line managed Manager role', () => {
  async function fixture() {
    const db = await freshDb();
    await seedDemo(db);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [manager] = await db.select().from(employee).where(eq(employee.userId, viewer.userId));
    const [managerRole] = await db.select().from(role).where(and(
      eq(role.masterFn, scope.masterFn),
      eq(role.name, 'Manager'),
    ));
    return { db, viewer, manager, managerRole };
  }

  it('adds a system-owned Manager grant when a linked employee gains a direct report', async () => {
    const data = await fixture();
    await createEmployee(data.db, scope, {
      employeeNo: 'EMP-MGR-1',
      fullName: 'Direct Report',
      email: 'direct.report@example.test',
      department: 'Warehouse',
      jobTitle: 'Coordinator',
      managerId: data.manager.id,
      startDate: '2026-07-25',
      baseSalary: '3200.00',
    });

    const [grant] = await data.db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, data.viewer.userId),
      eq(userCompanyRole.companyFn, scope.companyFn),
      eq(userCompanyRole.roleId, data.managerRole.roleId),
    ));
    expect(grant.managedBySystem).toBe(true);
  });

  it('removes only its own grant after the last active direct report is removed', async () => {
    const data = await fixture();
    const report = await createEmployee(data.db, scope, {
      employeeNo: 'EMP-MGR-2',
      fullName: 'Temporary Report',
      email: 'temporary.report@example.test',
      department: 'Warehouse',
      jobTitle: 'Coordinator',
      managerId: data.manager.id,
      startDate: '2026-07-25',
      baseSalary: '3200.00',
    });
    await data.db.update(employee).set({ isActive: false }).where(eq(employee.id, report.id));

    const result = await syncManagerRoleWithin(data.db, scope, data.manager.id);
    expect(result).toMatchObject({ required: false, changed: true });
    expect(await data.db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, data.viewer.userId),
      eq(userCompanyRole.companyFn, scope.companyFn),
      eq(userCompanyRole.roleId, data.managerRole.roleId),
    ))).toHaveLength(0);
  });

  it('never removes a manually assigned Manager grant', async () => {
    const data = await fixture();
    await data.db.insert(userCompanyRole).values({
      userId: data.viewer.userId,
      companyFn: scope.companyFn,
      roleId: data.managerRole.roleId,
      managedBySystem: false,
    });

    const result = await syncManagerRoleWithin(data.db, scope, data.manager.id);
    expect(result).toMatchObject({ required: false, changed: false });
    const [grant] = await data.db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, data.viewer.userId),
      eq(userCompanyRole.companyFn, scope.companyFn),
      eq(userCompanyRole.roleId, data.managerRole.roleId),
    ));
    expect(grant.managedBySystem).toBe(false);
  });
});
