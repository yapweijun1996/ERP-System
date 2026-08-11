import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  appUser,
  company,
  companyOnboarding,
  role,
  rolePermission,
  userPermissionOverride,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';

describe('tenant module authority retirement migration', () => {
  it('removes role grants, revokes overrides, invalidates sessions, and is idempotent', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [adminRole] = await db.select().from(role).where(eq(role.name, 'Superadmin'));
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    await db.insert(rolePermission).values({
      masterFn: 'M1',
      roleId: adminRole.roleId,
      permissionKey: 'admin.modules.manage',
    });
    await db.insert(userPermissionOverride).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      userId: admin.userId,
      permissionKey: 'system.modules.manage',
      effect: 'allow',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      reason: 'Legacy tenant MAC override',
      assignedByUserId: admin.userId,
    });
    await db.update(companyOnboarding).set({
      status: 'setup',
      currentStage: 'modules',
      completedSteps: ['company', 'fiscal', 'warehouse', 'modules'],
    }).where(eq(companyOnboarding.companyFn, 'C-SG'));

    const migration = readFileSync(
      new URL('../../drizzle/0095_retire_tenant_module_authority.sql', import.meta.url),
      'utf8',
    );
    const applyMigration = async () => {
      for (const statement of migration.split('--> statement-breakpoint')
        .map((value) => value.trim()).filter(Boolean)) {
        await db.execute(sql.raw(statement));
      }
    };
    await applyMigration();
    await applyMigration();

    expect(await db.select().from(rolePermission).where(eq(
      rolePermission.permissionKey,
      'admin.modules.manage',
    ))).toHaveLength(0);
    const [override] = await db.select().from(userPermissionOverride).where(eq(
      userPermissionOverride.permissionKey,
      'system.modules.manage',
    ));
    expect(override).toMatchObject({
      revokedByUserId: admin.userId,
      revocationReason: 'System migration: tenant module authority retired by TASK-186',
    });
    expect(override.revokedAt).toBeInstanceOf(Date);
    const [onboarding] = await db.select().from(companyOnboarding)
      .where(eq(companyOnboarding.companyFn, 'C-SG'));
    expect(onboarding.currentStage).toBe('roles');
    expect(onboarding.completedSteps).toEqual(['company', 'fiscal', 'warehouse']);
    const [tenant] = await db.select({ version: company.authorizationVersion })
      .from(company).where(eq(company.companyFn, 'C-SG'));
    expect(tenant.version).toBe(2);
  });
});
