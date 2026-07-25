import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { seedDemo } from '../data/seed';
import {
  appUser, employee, master, outboxEvent, role, rolePermission, userCompany, userCompanyRole,
  userInvitation,
} from '../data/schema';
import { freshDb } from '../test/helpers';
import { createSession, getSession } from './session';
import {
  createInvitationRecordWithin,
  createRole,
  setRolePermission,
  setUserActive,
  setUserRoles,
} from './adminLifecycle';
import { PERMISSIONS } from './permissions';

describe('admin user/role/permission lifecycle', () => {
  async function adminSession(db: Awaited<ReturnType<typeof freshDb>>) {
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    return {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: 'C-SG',
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    };
  }

  it('rejects disabling your own account', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    await expect(setUserActive(db, session, session.userId, false, 'self-disable'))
      .rejects.toMatchObject({ code: 'cannot_disable_self' });
  });

  it('disables another user and revokes their live sessions', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.email, 'viewer@acme.co'));
    const viewerSession = await createSession(db, {
      userId: viewer.userId,
      masterFn: viewer.masterFn,
      activeCompanyFn: 'C-SG',
      username: viewer.username,
      email: viewer.email,
      fullName: viewer.fullName,
    });

    const result = await setUserActive(db, session, viewer.userId, false, 'disable-viewer');
    expect(result).toEqual({ userId: viewer.userId, isActive: false });
    const [updated] = await db.select().from(appUser).where(eq(appUser.userId, viewer.userId));
    expect(updated.isActive).toBe(false);
    expect(await getSession(db, viewerSession.sessionId)).toBeNull();

    await expect(setUserActive(db, session, viewer.userId, true, 're-enable-viewer'))
      .resolves.toEqual({ userId: viewer.userId, isActive: true });
  });

  it('protects the last active superadmin, but allows disabling an extra one', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    const [superadminRole] = await db.select().from(role).where(and(
      eq(role.masterFn, session.masterFn),
      eq(role.isSuperadmin, true),
    ));
    const [secondAdmin] = await db.insert(appUser).values({
      masterFn: session.masterFn,
      username: 'second.admin',
      email: 'second.admin@acme.co',
      passwordHash: 'pbkdf2$1$a$b',
    }).returning({ userId: appUser.userId });
    await db.insert(userCompany).values({
      userId: secondAdmin.userId,
      companyFn: 'C-SG',
      roleId: superadminRole.roleId,
    });
    await db.insert(userCompanyRole).values({
      userId: secondAdmin.userId,
      companyFn: 'C-SG',
      roleId: superadminRole.roleId,
    });
    const secondAdminSession = {
      userId: secondAdmin.userId,
      masterFn: session.masterFn,
      activeCompanyFn: 'C-SG',
      username: 'second.admin',
      email: 'second.admin@acme.co',
      fullName: null,
    };

    // Two active superadmins exist -- disabling one (as the other) is allowed.
    await expect(setUserActive(db, secondAdminSession, session.userId, false, 'disable-first-admin'))
      .resolves.toEqual({ userId: session.userId, isActive: false });

    // Now only secondAdmin is an active superadmin -- disabling them must be rejected,
    // even though the acting session (the now-disabled original admin) isn't self-targeting.
    await expect(setUserActive(db, session, secondAdmin.userId, false, 'disable-last-admin'))
      .rejects.toMatchObject({ code: 'cannot_disable_last_superadmin' });

    // A non-superadmin user is never subject to this guard.
    const [viewer] = await db.select().from(appUser).where(eq(appUser.email, 'viewer@acme.co'));
    await expect(setUserActive(db, secondAdminSession, viewer.userId, false, 'disable-viewer-still-fine'))
      .resolves.toEqual({ userId: viewer.userId, isActive: false });
  });

  it('rejects toggling a user outside the caller master', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    await db.insert(master).values({
      masterFn: 'OTHER-M2',
      loginCode: 'OTHER-M2',
      name: 'Other Master 2',
    });
    const [otherUser] = await db.insert(appUser).values({
      masterFn: 'OTHER-M2',
      username: 'outsider',
      email: 'outsider@example.test',
      passwordHash: 'pbkdf2$1$a$b',
    }).returning({ userId: appUser.userId });
    await expect(setUserActive(db, session, otherUser.userId, false, 'cross-master-disable'))
      .rejects.toMatchObject({ code: 'user_not_found' });
  });

  it('replaces company roles atomically while preserving the last superadmin', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [viewerRole] = await db.select().from(role).where(eq(role.name, 'Viewer'));
    const [operatorRole] = await db.insert(role).values({
      masterFn: session.masterFn,
      name: 'Operator',
    }).returning({ roleId: role.roleId });

    const updated = await setUserRoles(
      db,
      session,
      viewer.userId,
      [operatorRole.roleId, viewerRole.roleId, operatorRole.roleId],
      'set-multiple-roles',
    );
    expect(updated.roles.map((grant) => grant.name)).toEqual(['Viewer', 'Operator']);
    expect(await db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, viewer.userId),
      eq(userCompanyRole.companyFn, 'C-SG'),
    ))).toHaveLength(2);
    const [legacyMembership] = await db.select().from(userCompany).where(and(
      eq(userCompany.userId, viewer.userId),
      eq(userCompany.companyFn, 'C-SG'),
    ));
    expect(legacyMembership.roleId).toBe(Math.min(viewerRole.roleId, operatorRole.roleId));

    await expect(setUserRoles(
      db,
      session,
      session.userId,
      [viewerRole.roleId],
      'remove-last-superadmin',
    )).rejects.toMatchObject({ code: 'cannot_remove_last_superadmin' });
  });

  it('preserves reporting-line managed roles while allowing manual role changes', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [managerEmployee] = await db.select().from(employee)
      .where(eq(employee.userId, viewer.userId));
    const [managerRole] = await db.select().from(role).where(eq(role.name, 'Manager'));
    const [viewerRole] = await db.select().from(role).where(eq(role.name, 'Viewer'));
    const [employeeRole] = await db.select().from(role).where(eq(role.name, 'Employee'));
    const [operatorRole] = await db.insert(role).values({
      masterFn: session.masterFn,
      name: 'Operator',
    }).returning({ roleId: role.roleId });
    await db.insert(employee).values({
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
      employeeNo: 'EMP-ADMIN-MANAGED',
      fullName: 'Managed Direct Report',
      email: 'managed.direct@example.test',
      department: 'Warehouse',
      jobTitle: 'Coordinator',
      employmentType: 'Full-time',
      managerId: managerEmployee.id,
      startDate: '2026-07-25',
      baseSalary: '3200.00',
    });
    await db.insert(userCompanyRole).values({
      userId: viewer.userId,
      companyFn: session.activeCompanyFn,
      roleId: managerRole.roleId,
      managedBySystem: true,
    });

    await expect(setUserRoles(
      db,
      session,
      viewer.userId,
      [viewerRole.roleId, employeeRole.roleId],
      'omit-managed-manager',
    )).rejects.toMatchObject({ code: 'managed_role_required' });

    await setUserRoles(
      db,
      session,
      viewer.userId,
      [viewerRole.roleId, employeeRole.roleId, managerRole.roleId, operatorRole.roleId],
      'preserve-managed-manager',
    );
    const grants = await db.select().from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, viewer.userId),
      eq(userCompanyRole.companyFn, session.activeCompanyFn),
    ));
    expect(grants.find((grant) => grant.roleId === managerRole.roleId)?.managedBySystem).toBe(true);
    expect(grants.find((grant) => grant.roleId === operatorRole.roleId)?.managedBySystem).toBe(false);
  });

  it('createInvitationRecordWithin (demo path) inserts with a pre-computed hash and no outbox event', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    const [viewerRole] = await db.select().from(role).where(eq(role.name, 'Viewer'));
    const result = await createInvitationRecordWithin(db, session, {
      email: 'demo.invitee@example.test',
      roleId: viewerRole.roleId,
      tokenHash: 'precomputed-hash',
      expiresAt: new Date('2026-01-03T00:00:00.000Z'),
    }, 'demo-invite');
    expect(result.email).toBe('demo.invitee@example.test');
    const [stored] = await db.select().from(userInvitation)
      .where(eq(userInvitation.id, result.id));
    expect(stored.tokenHash).toBe('precomputed-hash');
    expect(stored.invitedByUserId).toBe(session.userId);
    expect(await db.select().from(outboxEvent)).toHaveLength(0);

    await expect(createInvitationRecordWithin(db, session, {
      email: 'admin@acme.co',
      roleId: viewerRole.roleId,
      tokenHash: 'another-hash',
      expiresAt: new Date('2026-01-03T00:00:00.000Z'),
    }, 'demo-invite-existing')).rejects.toMatchObject({ code: 'user_exists' });
  });

  it('creates a role and rejects a duplicate name', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    const created = await createRole(db, session, 'Warehouse Lead', 'create-role');
    expect(created.name).toBe('Warehouse Lead');
    const [stored] = await db.select().from(role).where(eq(role.roleId, created.id));
    expect(stored.isSuperadmin).toBe(false);

    await expect(createRole(db, session, 'Viewer', 'dup-role'))
      .rejects.toMatchObject({ code: 'role_exists' });
    await expect(createRole(db, session, '  ', 'blank-role'))
      .rejects.toMatchObject({ code: 'invalid_request' });
  });

  it('sets and updates a role permission, rejecting unknown keys and the superadmin role', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    const [viewerRole] = await db.select().from(role).where(eq(role.name, 'Viewer'));
    const [superadminRole] = await db.select().from(role).where(eq(role.name, 'Superadmin'));

    await expect(setRolePermission(
      db, session, viewerRole.roleId, 'not.a.real.key', true, 'bad-key',
    )).rejects.toMatchObject({ code: 'invalid_permission_key' });

    await expect(setRolePermission(
      db, session, superadminRole.roleId, PERMISSIONS.assetWrite, true, 'edit-superadmin',
    )).rejects.toMatchObject({ code: 'superadmin_immutable' });

    const granted = await setRolePermission(
      db, session, viewerRole.roleId, PERMISSIONS.assetWrite, true, 'grant-asset-write',
    );
    expect(granted).toEqual({
      roleId: viewerRole.roleId, permissionKey: PERMISSIONS.assetWrite, allowed: true,
    });
    const [row1] = await db.select().from(rolePermission).where(and(
      eq(rolePermission.roleId, viewerRole.roleId),
      eq(rolePermission.permissionKey, PERMISSIONS.assetWrite),
    ));
    expect(row1.allowed).toBe(true);

    await setRolePermission(
      db, session, viewerRole.roleId, PERMISSIONS.assetWrite, false, 'revoke-asset-write',
    );
    const rows = await db.select().from(rolePermission).where(and(
      eq(rolePermission.roleId, viewerRole.roleId),
      eq(rolePermission.permissionKey, PERMISSIONS.assetWrite),
    ));
    expect(rows).toHaveLength(1);
    expect(rows[0].allowed).toBe(false);
  });
});
