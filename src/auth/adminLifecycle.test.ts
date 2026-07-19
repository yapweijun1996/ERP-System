import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { seedDemo } from '../data/seed';
import {
  appUser, master, outboxEvent, role, rolePermission, userInvitation,
} from '../data/schema';
import { freshDb } from '../test/helpers';
import { createSession, getSession } from './session';
import {
  createInvitationRecordWithin,
  createRole,
  setRolePermission,
  setUserActive,
} from './adminLifecycle';
import { PERMISSIONS } from './permissions';

describe('admin user/role/permission lifecycle', () => {
  async function adminSession(db: Awaited<ReturnType<typeof freshDb>>) {
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    return {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: 'C-SG',
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

  it('rejects toggling a user outside the caller master', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const session = await adminSession(db);
    await db.insert(master).values({ masterFn: 'OTHER-M2', name: 'Other Master 2' });
    const [otherUser] = await db.insert(appUser).values({
      masterFn: 'OTHER-M2', email: 'outsider@example.test', passwordHash: 'pbkdf2$1$a$b',
    }).returning({ userId: appUser.userId });
    await expect(setUserActive(db, session, otherUser.userId, false, 'cross-master-disable'))
      .rejects.toMatchObject({ code: 'user_not_found' });
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
