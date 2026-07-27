import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../../auth/password';
import { cloneRoleTemplate } from '../../auth/adminLifecycle';
import {
  appUser, employee, leaveBalanceEntry, leaveType, userCompany,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  activateStaffOnboarding, createStaffOnboardingDraft,
} from './staffOnboarding';

describe('atomic staff onboarding', () => {
  async function fixture(companyFn = 'C-SG') {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const session = {
      userId: admin.userId, masterFn: 'M1', activeCompanyFn: companyFn,
      username: admin.username, email: admin.email, fullName: admin.fullName,
    };
    const companyRole = await cloneRoleTemplate(
      db, session, 'sales', `Sales Staff ${companyFn}`, `fixture-${companyFn}`,
    );
    return {
      db,
      session,
      roleId: companyRole.id,
    };
  }

  const employeeInput = {
    employeeNo: 'EMP-NEW-1', fullName: 'New Staff', email: 'new.staff@example.test',
    phone: null, department: 'Sales', jobTitle: 'Account Executive',
    employmentType: 'Full-time' as const, managerId: null,
    startDate: '2026-07-27', annualLeaveDays: 14, baseSalary: '4500.00',
  };

  it('creates employee, identity, membership and roles in one activation transaction', async () => {
    const { db, session, roleId } = await fixture();
    const draft = await createStaffOnboardingDraft(db, session, {
      employee: employeeInput, username: 'new.staff', email: employeeInput.email,
      roleIds: [roleId],
    }, 'draft');
    const activated = await activateStaffOnboarding(
      db, session, draft.id, draft.version, hashPassword('temporary-pass'), 'activate',
    );
    expect(activated).toMatchObject({ username: 'new.staff', passwordChangeRequired: true });
    expect(await db.select().from(employee).where(eq(employee.employeeNo, 'EMP-NEW-1'))).toHaveLength(1);
    expect(await db.select().from(userCompany).where(eq(userCompany.userId, activated.userId))).toHaveLength(1);
    const [created] = await db.select().from(appUser).where(eq(appUser.userId, activated.userId));
    expect(created.passwordHash).toMatch(/^pbkdf2\$/);
    expect(created.initialPasswordExpiresAt).not.toBeNull();
    const [annual] = await db.select({ id: leaveType.id }).from(leaveType).where(and(
      eq(leaveType.masterFn, 'M1'),
      eq(leaveType.companyFn, 'C-SG'),
      eq(leaveType.code, 'ANNUAL'),
    ));
    const entries = await db.select().from(leaveBalanceEntry).where(and(
      eq(leaveBalanceEntry.employeeId, activated.employeeId),
      eq(leaveBalanceEntry.leaveTypeId, annual.id),
    ));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      entryType: 'grant', balanceDelta: '14.00', sourceType: 'employee_opening',
    });
  });

  it('links an existing organization identity across companies without resetting its password', async () => {
    const { db, session, roleId } = await fixture('C-MY');
    const [identity] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const originalHash = identity.passwordHash;
    const draft = await createStaffOnboardingDraft(db, session, {
      employee: { ...employeeInput, employeeNo: 'EMP-MY-LINK', email: identity.email! },
      username: identity.username, email: identity.email!, roleIds: [roleId],
    }, 'link-draft');
    const activated = await activateStaffOnboarding(db, session, draft.id, draft.version, null, 'link');
    expect(activated.userId).toBe(identity.userId);
    expect((await db.select().from(appUser).where(eq(appUser.userId, identity.userId)))[0].passwordHash)
      .toBe(originalHash);
  });

  it('rolls every business row back when a new identity has no initial password', async () => {
    const { db, session, roleId } = await fixture();
    const draft = await createStaffOnboardingDraft(db, session, {
      employee: { ...employeeInput, employeeNo: 'EMP-ROLLBACK' },
      username: 'rollback.staff', email: 'rollback.staff@example.test', roleIds: [roleId],
    }, 'rollback-draft');
    await expect(activateStaffOnboarding(db, session, draft.id, draft.version, null, 'rollback'))
      .rejects.toMatchObject({ code: 'initial_password_required' });
    expect(await db.select().from(employee).where(eq(employee.employeeNo, 'EMP-ROLLBACK'))).toHaveLength(0);
    expect(await db.select().from(appUser).where(eq(appUser.username, 'rollback.staff'))).toHaveLength(0);
  });
});
