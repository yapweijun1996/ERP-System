import { readFileSync } from 'node:fs';
import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  appUser, company, role, rolePermission, userCompany, userCompanyRole,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import {
  COMPANY_OWNER_ROLE_TEMPLATE_KEY,
} from './accessCatalog';
import { explainAuthorization, principalFromSession } from './authorization';
import { isCompanyOwnerSession, hasPermission } from './permissions';
import { setRolePermission } from './adminLifecycle';
import type { SessionData } from './session';
import '../api/resources';

function sessionFor(user: typeof appUser.$inferSelect): SessionData {
  return {
    userId: user.userId,
    masterFn: user.masterFn,
    activeCompanyFn: 'C-SG',
    username: user.username,
    email: user.email,
    fullName: user.fullName,
  };
}

describe('Company Owner cutover', () => {
  it('replays the legacy backfill on PGlite and is idempotent', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const migration = readFileSync(new URL('../../drizzle/0089_company_owner_cutover.sql', import.meta.url), 'utf8');
    const applyMigration = async () => {
      for (const statement of migration.split('--> statement-breakpoint').map((value) => value.trim()).filter(Boolean)) {
        await db.execute(sql.raw(statement));
      }
    };
    await applyMigration();
    await applyMigration();

    const [legacyRole] = await db.select().from(role).where(eq(role.name, 'Superadmin'));
    const ownerRoles = await db.select().from(role).where(eq(role.sourceTemplateKey, COMPANY_OWNER_ROLE_TEMPLATE_KEY));
    const ownerPermissions = await db.select().from(rolePermission).where(eq(rolePermission.roleId, ownerRoles[0].roleId));
    const [sg] = await db.select({ authorizationVersion: company.authorizationVersion })
      .from(company).where(eq(company.companyFn, 'C-SG'));
    const legacyAssignments = await db.select().from(userCompanyRole)
      .where(eq(userCompanyRole.roleId, legacyRole.roleId));

    expect(legacyRole).toMatchObject({ isSuperadmin: false, sourceTemplateKey: 'legacy_superadmin' });
    expect(ownerRoles).toHaveLength(2);
    // The current seed also carries TASK-182's three canonical Company Receipt
    // mutation grants; 0089 remains a historical, idempotent cutover.
    expect(ownerPermissions.length).toBe(116);
    expect(sg.authorizationVersion).toBe(2);
    expect(legacyAssignments).toHaveLength(0);
  });

  it('uses explicit tenant permissions and never grants platform or approval authority implicitly', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [ownerRole] = await db.select().from(role).where(and(
      eq(role.companyFn, 'C-SG'),
      eq(role.sourceTemplateKey, COMPANY_OWNER_ROLE_TEMPLATE_KEY),
    ));
    const [legacyRole] = await db.select().from(role).where(eq(role.name, 'Superadmin'));
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));

    expect(await isCompanyOwnerSession(db, sessionFor(admin))).toBe(true);
    expect(await hasPermission(db, sessionFor(admin), 'inventory.read')).toBe(true);
    // Admin also has an explicit demo-only Manager assignment; isolate the
    // owner bundle with a user assigned only to Company Owner below.
    const [ownerOnly] = await db.insert(appUser).values({
      masterFn: 'M1',
      username: 'owner-only',
      email: 'owner-only@acme.co',
      fullName: 'Owner Only',
      passwordHash: 'pbkdf2$1$ab$cd',
    }).returning();
    await db.insert(userCompany).values({
      userId: ownerOnly.userId,
      companyFn: 'C-SG',
      roleId: ownerRole.roleId,
    });
    await db.insert(userCompanyRole).values({
      userId: ownerOnly.userId,
      companyFn: 'C-SG',
      roleId: ownerRole.roleId,
      assignedByUserId: admin.userId,
      assignmentSource: 'onboarding',
    });
    const ownerSession = sessionFor(ownerOnly);
    expect(await hasPermission(db, ownerSession, 'inventory.read')).toBe(true);
    expect(await hasPermission(
      db,
      ownerSession,
      'expenses.company_receipts.read_company',
    )).toBe(true);
    expect(await hasPermission(db, ownerSession, 'expenses.company_receipts.read_own')).toBe(false);
    expect(await hasPermission(db, ownerSession, 'purchasing.approve')).toBe(false);
    expect(await hasPermission(db, ownerSession, 'payroll.read')).toBe(false);
    expect(await hasPermission(db, ownerSession, 'platform.support.grant')).toBe(false);

    const explanation = await explainAuthorization(db, {
      principal: principalFromSession(ownerSession),
      permissionKey: 'inventory.read',
      resourceKey: 'inventory/products',
      requireScope: true,
      scopeTarget: { scope: 'company', targetType: 'company', targetId: 'C-SG' },
    });
    expect(explanation).toMatchObject({
      allowed: true,
      reasonCode: 'ALLOW_ROLE_PERMISSION',
      matchedRoleId: ownerRole.roleId,
      matchedEffect: 'role',
      matchedScope: 'company',
    });

    // A legacy Superadmin assignment without role_permission rows is inert.
    const [legacyOnly] = await db.insert(appUser).values({
      masterFn: 'M1',
      username: 'legacy-only',
      email: 'legacy-only@acme.co',
      fullName: 'Legacy Only',
      passwordHash: 'pbkdf2$1$ab$cd',
    }).returning();
    await db.insert(userCompany).values({
      userId: legacyOnly.userId,
      companyFn: 'C-SG',
      roleId: legacyRole.roleId,
    });
    await db.insert(userCompanyRole).values({
      userId: legacyOnly.userId,
      companyFn: 'C-SG',
      roleId: legacyRole.roleId,
    });
    expect(await isCompanyOwnerSession(db, sessionFor(legacyOnly))).toBe(false);
    expect(await hasPermission(db, sessionFor(legacyOnly), 'inventory.read')).toBe(false);
  });

  it('keeps the system-managed owner permission and scope contract immutable', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [ownerRole] = await db.select().from(role).where(and(
      eq(role.companyFn, 'C-SG'),
      eq(role.sourceTemplateKey, COMPANY_OWNER_ROLE_TEMPLATE_KEY),
    ));
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    await expect(setRolePermission(
      db,
      sessionFor(admin),
      ownerRole.roleId,
      'inventory.read',
      false,
      'owner-role-edit',
    )).rejects.toMatchObject({ code: 'company_owner_immutable' });
  });
});
