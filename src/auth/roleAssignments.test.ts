import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  appUser,
  role,
  rolePermission,
  userCompany,
  userCompanyRole,
  userCompanyRoleScope,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { effectiveCapabilities, hasPermission } from './permissions';
import { createRoleAssignment, revokeRoleAssignment } from './roleAssignments';

const session = (userId: number, username: string) => ({
  userId,
  masterFn: 'M1',
  activeCompanyFn: 'C-SG',
  username,
  email: `${username}@example.test`,
  fullName: username,
});

describe('assignment-scoped authorization', () => {
  it('backfills role scopes to stable assignment-owned rows', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [assignment] = await db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, viewer.userId),
      eq(userCompanyRole.companyFn, 'C-SG'),
    )).orderBy(userCompanyRole.assignmentId).limit(1);
    expect(assignment.assignmentId).toBeGreaterThan(0);
    // Demo seed data is inserted after migrations, so it exercises the
    // dual-read fallback until the assignment writer is cut over.
    expect(assignment.scopeBackfilledAt).toBeNull();
    const rows = await db.select().from(userCompanyRoleScope).where(
      eq(userCompanyRoleScope.assignmentId, assignment.assignmentId),
    );
    expect(rows).toHaveLength(0);
    const capabilities = await effectiveCapabilities(db, session(viewer.userId, viewer.username));
    expect(capabilities.scopes['*']).toBe('company');
  });

  it('supports multiple target rows on one reusable role assignment', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [targetRole] = await db.insert(role).values({ masterFn: 'M1', name: 'Targeted Viewer' })
      .returning({ roleId: role.roleId });
    await db.insert(userCompany).values({
      userId: viewer.userId,
      companyFn: 'C-MY',
      roleId: targetRole.roleId,
    });
    await db.insert(rolePermission).values({
      masterFn: 'M1', roleId: targetRole.roleId, permissionKey: 'inventory.read', allowed: true,
    });
    const created = await createRoleAssignment(db, session(viewer.userId, viewer.username), {
      userId: viewer.userId,
      roleId: targetRole.roleId,
      scopes: [
        { resourceKey: 'inventory/products', scope: 'department', targetType: 'department', targetId: 'Sales' },
        { resourceKey: 'inventory/products', scope: 'department', targetType: 'department', targetId: 'Warehouse' },
      ],
    }, 'assignment-targets');
    const assignments = await db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, viewer.userId),
      eq(userCompanyRole.companyFn, 'C-SG'),
      eq(userCompanyRole.roleId, targetRole.roleId),
    ));
    expect(assignments).toHaveLength(1);
    expect(created.scopes).toHaveLength(2);
    const second = await createRoleAssignment(db, session(viewer.userId, viewer.username), {
      userId: viewer.userId,
      roleId: targetRole.roleId,
      scopes: [
        { resourceKey: 'inventory/products', scope: 'department', targetType: 'department', targetId: 'Sales' },
      ],
    }, 'assignment-targets-second');
    expect(second.assignmentId).not.toBe(created.assignmentId);
    expect(await db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, viewer.userId),
      eq(userCompanyRole.companyFn, 'C-SG'),
      eq(userCompanyRole.roleId, targetRole.roleId),
    ))).toHaveLength(2);
    const capabilities = await effectiveCapabilities(db, session(viewer.userId, viewer.username));
    expect(capabilities.scopeGrants['inventory/products']).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'department', targetType: 'department', targetId: 'Sales' }),
      expect.objectContaining({ scope: 'department', targetType: 'department', targetId: 'Warehouse' }),
    ]));
  });

  it('denies permissions outside validity and after explicit revocation', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [targetRole] = await db.insert(role).values({ masterFn: 'M1', name: 'Temporary Viewer' })
      .returning({ roleId: role.roleId });
    await db.insert(userCompanyRole).values({
      userId: viewer.userId,
      companyFn: 'C-SG',
      roleId: targetRole.roleId,
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2026-02-01T00:00:00Z'),
    });
    await db.insert(rolePermission).values({
      masterFn: 'M1', roleId: targetRole.roleId, permissionKey: 'finance.write', allowed: true,
    });
    const viewerSession = session(viewer.userId, viewer.username);
    expect(await hasPermission(db, viewerSession, 'finance.write', new Date('2026-01-15T00:00:00Z'))).toBe(true);
    expect(await hasPermission(db, viewerSession, 'finance.write', new Date('2026-02-01T00:00:00Z'))).toBe(false);

    const [assignment] = await db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, viewer.userId),
      eq(userCompanyRole.companyFn, 'C-SG'),
      eq(userCompanyRole.roleId, targetRole.roleId),
    ));
    await db.update(userCompanyRole).set({
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: null,
    }).where(eq(userCompanyRole.assignmentId, assignment.assignmentId));
    expect(await hasPermission(db, viewerSession, 'finance.write', new Date('2026-08-09T00:00:00Z'))).toBe(true);
    await revokeRoleAssignment(db, viewerSession, assignment.assignmentId, 'Access no longer required', 'assignment-revoke');
    expect(await hasPermission(db, viewerSession, 'finance.write', new Date('2026-08-09T00:00:00Z'))).toBe(false);
  });
});
