import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  appUser,
  role,
  rolePermission,
  roleResourceScope,
  userCompany,
  userCompanyRole,
  userCompanyRoleScope,
  userPermissionOverride,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { COMPANY_OWNER_ROLE_TEMPLATE_KEY } from './accessCatalog';
import {
  createInvitationRecordWithin,
  setRolePermission,
  setRoleResourceScope,
  setUserRoles,
} from './adminLifecycle';
import { createPermissionOverride, revokePermissionOverride } from './permissionOverrides';
import {
  effectiveCapabilities, hasPermission, isCompanyOwnerSession, PERMISSIONS,
} from './permissions';
import { createRoleAssignment } from './roleAssignments';

describe('tenant privilege delegation ceiling', () => {
  async function fixture() {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [ownerRole] = await db.select().from(role).where(and(
      eq(role.companyFn, 'C-SG'),
      eq(role.sourceTemplateKey, COMPANY_OWNER_ROLE_TEMPLATE_KEY),
    ));
    const [identityRole] = await db.insert(role).values({
      masterFn: 'M1', companyFn: 'C-SG', name: 'Identity Administrator', sourceTemplateKey: 'custom',
    }).returning({ roleId: role.roleId });
    await db.insert(rolePermission).values([
      PERMISSIONS.usersInvite,
      PERMISSIONS.usersRead,
      PERMISSIONS.usersManage,
      PERMISSIONS.rolesRead,
      PERMISSIONS.rolesWrite,
      PERMISSIONS.inventoryRead,
    ].map((permissionKey) => ({
      masterFn: 'M1', roleId: identityRole.roleId, permissionKey,
    })));
    await db.insert(roleResourceScope).values([
      {
        masterFn: 'M1', companyFn: 'C-SG', roleId: identityRole.roleId,
        resourceKey: 'admin/*', scope: 'company',
      },
      {
        masterFn: 'M1', companyFn: 'C-SG', roleId: identityRole.roleId,
        resourceKey: 'inventory/*', scope: 'self',
      },
    ]);
    const [identityAdmin] = await db.insert(appUser).values({
      masterFn: 'M1', username: 'identity.admin', email: 'identity.admin@example.test',
      fullName: 'Identity Admin', passwordHash: 'pbkdf2$1$a$b',
    }).returning();
    await db.insert(userCompany).values({
      userId: identityAdmin.userId, companyFn: 'C-SG', roleId: identityRole.roleId,
    });
    await db.insert(userCompanyRole).values({
      userId: identityAdmin.userId,
      companyFn: 'C-SG',
      roleId: identityRole.roleId,
      assignedByUserId: admin.userId,
      assignmentSource: 'system',
    });
    const identitySession = {
      userId: identityAdmin.userId,
      masterFn: 'M1',
      activeCompanyFn: 'C-SG',
      username: identityAdmin.username,
      email: identityAdmin.email,
      fullName: identityAdmin.fullName,
    };
    const ownerSession = {
      userId: admin.userId,
      masterFn: 'M1',
      activeCompanyFn: 'C-SG',
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    };
    return {
      db, identityAdmin, identityRole, identitySession, ownerRole, ownerSession, viewer,
    };
  }

  it('rejects self grants and permissions above the provisioned owner ceiling', async () => {
    const {
      db, identityAdmin, identitySession, ownerSession, viewer,
    } = await fixture();
    await expect(createPermissionOverride(db, identitySession, {
      userId: identityAdmin.userId,
      permissionKey: PERMISSIONS.payrollWrite,
      effect: 'allow',
      scope: 'company',
      reason: 'Attempted self elevation',
    }, 'self-override')).rejects.toMatchObject({ code: 'self_permission_grant_forbidden' });

    await createPermissionOverride(db, ownerSession, {
      userId: ownerSession.userId,
      permissionKey: PERMISSIONS.payrollWrite,
      effect: 'deny',
      scope: 'company',
      reason: 'Remove demo-only payroll authority',
    }, 'owner-payroll-deny');
    await expect(createPermissionOverride(db, ownerSession, {
      userId: viewer.userId,
      permissionKey: PERMISSIONS.payrollWrite,
      effect: 'allow',
      scope: 'company',
      reason: 'Attempt above current authority',
    }, 'owner-payroll-allow')).rejects.toMatchObject({ code: 'delegation_ceiling_exceeded' });

    await createPermissionOverride(db, ownerSession, {
      userId: viewer.userId,
      permissionKey: PERMISSIONS.usersRead,
      effect: 'allow',
      scope: 'company',
      reason: 'Legitimate identity support access',
    }, 'owner-users-read');
    expect(await hasPermission(db, {
      ...ownerSession,
      userId: viewer.userId,
      username: viewer.username,
      email: viewer.email,
      fullName: viewer.fullName,
    }, PERMISSIONS.usersRead)).toBe(true);

    const deny = await createPermissionOverride(db, identitySession, {
      userId: viewer.userId,
      permissionKey: PERMISSIONS.payrollWrite,
      effect: 'deny',
      scope: 'company',
      reason: 'Restricted payroll access',
    }, 'identity-payroll-deny');
    await expect(revokePermissionOverride(
      db, identitySession, deny.id, 'Attempted deny removal', 'identity-revoke-deny',
    )).rejects.toMatchObject({ code: 'delegation_authority_required' });
    await expect(revokePermissionOverride(
      db, ownerSession, deny.id, 'Owner reviewed restriction', 'owner-revoke-deny',
    )).resolves.toMatchObject({ effect: 'deny' });
  });

  it('neutralizes historical self elevation and protects role administration', async () => {
    const {
      db, identityAdmin, identityRole, identitySession, ownerRole, ownerSession, viewer,
    } = await fixture();
    const [payrollRole] = await db.insert(role).values({
      masterFn: 'M1', companyFn: 'C-SG', name: 'Payroll Writer', sourceTemplateKey: 'custom',
    }).returning({ roleId: role.roleId });
    await db.insert(rolePermission).values({
      masterFn: 'M1', roleId: payrollRole.roleId,
      permissionKey: PERMISSIONS.payrollWrite, allowed: true,
    });
    await db.insert(roleResourceScope).values({
      masterFn: 'M1', companyFn: 'C-SG', roleId: payrollRole.roleId,
      resourceKey: 'payroll/*', scope: 'company',
    });

    await expect(setUserRoles(
      db,
      identitySession,
      identityAdmin.userId,
      [identityRole.roleId, ownerRole.roleId],
      'self-owner-role',
    )).rejects.toMatchObject({ code: 'self_role_grant_forbidden' });
    await expect(createRoleAssignment(db, identitySession, {
      userId: identityAdmin.userId, roleId: payrollRole.roleId,
    }, 'self-payroll-role')).rejects.toMatchObject({ code: 'self_role_grant_forbidden' });

    await db.insert(userPermissionOverride).values({
      masterFn: 'M1', companyFn: 'C-SG', userId: identityAdmin.userId,
      permissionKey: PERMISSIONS.payrollWrite, effect: 'allow', scope: 'company',
      targetType: 'none', targetId: '', reason: 'Historical unsafe self grant',
      assignedByUserId: identityAdmin.userId,
    });
    expect(await hasPermission(db, identitySession, PERMISSIONS.payrollWrite)).toBe(false);
    await db.insert(userPermissionOverride).values({
      masterFn: 'M1', companyFn: 'C-SG', userId: viewer.userId,
      permissionKey: PERMISSIONS.payrollWrite, effect: 'allow', scope: 'company',
      targetType: 'none', targetId: '', reason: 'Historical non-owner grant',
      assignedByUserId: identityAdmin.userId,
    });
    expect(await hasPermission(db, {
      ...ownerSession,
      userId: viewer.userId,
      username: viewer.username,
      email: viewer.email,
      fullName: viewer.fullName,
    }, PERMISSIONS.payrollWrite)).toBe(false);

    await db.insert(userCompanyRole).values({
      userId: identityAdmin.userId,
      companyFn: 'C-SG',
      roleId: ownerRole.roleId,
      assignedByUserId: identityAdmin.userId,
      assignmentSource: 'manual',
    });
    expect(await isCompanyOwnerSession(db, identitySession)).toBe(false);
    expect(await hasPermission(db, identitySession, PERMISSIONS.assetWrite)).toBe(false);
    const capabilities = await effectiveCapabilities(db, identitySession);
    expect(capabilities.isCompanyOwner).toBe(false);
    expect(capabilities.permissions).not.toContain(PERMISSIONS.assetWrite);
    expect(capabilities.permissions).not.toContain(PERMISSIONS.payrollWrite);

    const [customRole] = await db.insert(role).values({
      masterFn: 'M1', companyFn: 'C-SG', name: 'Bounded Custom Role', sourceTemplateKey: 'custom',
    }).returning({ roleId: role.roleId });
    const [broadAssignment] = await db.insert(userCompanyRole).values({
      userId: viewer.userId,
      companyFn: 'C-SG',
      roleId: customRole.roleId,
      assignedByUserId: ownerSession.userId,
      assignmentSource: 'manual',
      scopeBackfilledAt: new Date('2026-11-23T00:00:00.000Z'),
    }).returning({ assignmentId: userCompanyRole.assignmentId });
    await db.insert(userCompanyRoleScope).values({
      masterFn: 'M1', companyFn: 'C-SG', assignmentId: broadAssignment.assignmentId,
      resourceKey: 'inventory/*', scope: 'company', targetType: 'none', targetId: '',
    });
    await expect(setRolePermission(
      db, identitySession, customRole.roleId, PERMISSIONS.payrollWrite, true, 'grant-payroll',
    )).rejects.toMatchObject({ code: 'delegation_ceiling_exceeded' });
    await expect(setRolePermission(
      db, identitySession, customRole.roleId, PERMISSIONS.usersRead, true, 'grant-users-read',
    )).resolves.toMatchObject({ permissionKey: PERMISSIONS.usersRead, allowed: true });
    await expect(setRolePermission(
      db, identitySession, customRole.roleId, PERMISSIONS.inventoryRead, true, 'grant-wide-inventory',
    )).rejects.toMatchObject({ code: 'delegation_ceiling_exceeded' });
    await expect(setRoleResourceScope(
      db, identitySession, customRole.roleId, '*', 'company', 'widen-custom-role',
    )).rejects.toMatchObject({ code: 'delegation_ceiling_exceeded' });
    await expect(createInvitationRecordWithin(db, identitySession, {
      email: 'protected-owner@example.test',
      roleId: ownerRole.roleId,
      tokenHash: 'protected-owner-token-hash',
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    }, 'invite-owner')).rejects.toMatchObject({ code: 'protected_role_assignment' });
  });
});
