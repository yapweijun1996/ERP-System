// User/role/permission admin writes -- deliberately split out from lifecycle.ts
// (which imports ./password and ./tokenCrypto, both hard node:crypto dependencies)
// so this file's import graph stays 100% node:crypto-free and can be safely bundled
// into the browser demo runtime (web/src/erp-demo-runtime-impl.ts). Verified by
// `npm run build:demo` -- importing anything from lifecycle.ts there fails the
// Rollup build ("randomBytes is not exported by __vite-browser-external").
//
// Each write follows the same two-tier shape every other module in this repo
// uses: a raw-exec `...Within(exec, session, ...)` core that opens no
// transaction of its own (the demo adapter always calls this flavor, already
// wrapped in its own transaction -- calling a self-transacting function there
// fails with "this.client.transaction is not a function", PGlite transactions
// don't support nesting), plus a thin self-transacting wrapper for direct/API
// callers that aren't already inside a transaction (mirrors createAssetWithin +
// createAsset in src/modules/assets/createAsset.ts).
import {
  and, eq, gt, inArray, isNull, ne,
} from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appSession, appUser, role, rolePermission, userCompany, userCompanyRole,
  userInvitation,
} from '../data/schema';
import { withTenantTransaction } from '../data/tenantTransaction';
import { appendAudit } from '../api/audit';
import { AuthLifecycleError } from './authErrors';
import { PERMISSIONS } from './permissions';
import type { SessionData } from './session';

const KNOWN_PERMISSION_KEYS = new Set<string>(Object.values(PERMISSIONS));

export async function setUserActiveWithin(
  exec: DB,
  session: SessionData,
  userId: number,
  isActive: boolean,
  requestId: string,
  now = new Date(),
): Promise<{ userId: number; isActive: boolean }> {
  if (userId === session.userId) {
    throw new AuthLifecycleError(400, 'cannot_disable_self', 'You cannot change your own active state.');
  }
  const [target] = await exec.select({ userId: appUser.userId, isActive: appUser.isActive })
    .from(appUser)
    .where(and(
      eq(appUser.userId, userId),
      eq(appUser.masterFn, session.masterFn),
    ))
    .limit(1);
  if (!target) {
    throw new AuthLifecycleError(404, 'user_not_found', 'User not found.');
  }
  if (!isActive) {
    // A tenant must never end up with zero working superadmins -- role.isSuperadmin
    // bypasses rolePermission entirely, so losing the last one means nobody left who
    // can manage users/roles at all, including re-enabling this same account.
    const [targetSuperadminGrant] = await exec.select({ roleId: role.roleId })
      .from(userCompanyRole)
      .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
      .where(and(
        eq(userCompanyRole.userId, userId),
        eq(userCompanyRole.companyFn, session.activeCompanyFn),
        eq(role.masterFn, session.masterFn),
        eq(role.isSuperadmin, true),
      ))
      .limit(1);
    if (targetSuperadminGrant) {
      const [otherActiveSuperadmin] = await exec.select({ userId: appUser.userId })
        .from(appUser)
        .innerJoin(userCompanyRole, eq(userCompanyRole.userId, appUser.userId))
        .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
        .where(and(
          eq(appUser.masterFn, session.masterFn),
          eq(appUser.isActive, true),
          eq(userCompanyRole.companyFn, session.activeCompanyFn),
          eq(role.masterFn, session.masterFn),
          eq(role.isSuperadmin, true),
          ne(appUser.userId, userId),
        ))
        .limit(1);
      if (!otherActiveSuperadmin) {
        throw new AuthLifecycleError(
          400,
          'cannot_disable_last_superadmin',
          'At least one active superadmin must remain for this organization.',
        );
      }
    }
  }
  await exec.update(appUser).set({
    isActive,
    updatedAt: now,
  }).where(eq(appUser.userId, userId));
  if (!isActive) {
    // Disabling a user also revokes their live sessions, mirroring
    // confirmPasswordReset's session-revocation on credential change.
    await exec.update(appSession).set({
      revokedAt: now,
      updatedAt: now,
    }).where(and(
      eq(appSession.userId, userId),
      isNull(appSession.revokedAt),
    ));
  }
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'app_user',
    entityId: userId,
    action: 'set_active',
    before: { isActive: target.isActive },
    after: { isActive },
  });
  return { userId, isActive };
}

export function setUserActive(
  db: DB,
  session: SessionData,
  userId: number,
  isActive: boolean,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => setUserActiveWithin(tx, session, userId, isActive, requestId));
}

export async function setUserRolesWithin(
  exec: DB,
  session: SessionData,
  userId: number,
  roleIdsInput: number[],
  requestId: string,
  now = new Date(),
): Promise<{
  userId: number;
  roles: Array<{ roleId: number; name: string; isSuperadmin: boolean }>;
}> {
  const roleIds = [...new Set(roleIdsInput)].sort((left, right) => left - right);
  if (
    !Number.isSafeInteger(userId)
    || userId <= 0
    || roleIds.length === 0
    || roleIds.some((roleId) => !Number.isSafeInteger(roleId) || roleId <= 0)
  ) {
    throw new AuthLifecycleError(400, 'invalid_request', 'Select at least one valid role.', {
      roleIds: 'At least one role is required.',
    });
  }

  const [target] = await exec.select({
    userId: appUser.userId,
    companyFn: userCompany.companyFn,
  }).from(userCompany)
    .innerJoin(appUser, eq(appUser.userId, userCompany.userId))
    .where(and(
      eq(userCompany.userId, userId),
      eq(userCompany.companyFn, session.activeCompanyFn),
      eq(appUser.masterFn, session.masterFn),
    ))
    .limit(1)
    .for('update');
  if (!target) {
    throw new AuthLifecycleError(404, 'user_not_found', 'User not found in this company.');
  }

  const selectedRoles = await exec.select({
    roleId: role.roleId,
    name: role.name,
    isSuperadmin: role.isSuperadmin,
  }).from(role).where(and(
    eq(role.masterFn, session.masterFn),
    inArray(role.roleId, roleIds),
  )).orderBy(role.roleId);
  if (selectedRoles.length !== roleIds.length) {
    throw new AuthLifecycleError(400, 'invalid_role', 'One or more selected roles are unavailable.');
  }

  const before = await exec.select({
    roleId: role.roleId,
    name: role.name,
    isSuperadmin: role.isSuperadmin,
    managedBySystem: userCompanyRole.managedBySystem,
  }).from(userCompanyRole)
    .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
    .where(and(
      eq(userCompanyRole.userId, userId),
      eq(userCompanyRole.companyFn, session.activeCompanyFn),
      eq(role.masterFn, session.masterFn),
    ))
    .orderBy(role.roleId);
  const managedRoleIds = before
    .filter((grant) => grant.managedBySystem)
    .map((grant) => grant.roleId);
  const omittedManagedRole = managedRoleIds.find((roleId) => !roleIds.includes(roleId));
  if (omittedManagedRole != null) {
    throw new AuthLifecycleError(
      409,
      'managed_role_required',
      'A reporting-line managed role cannot be removed manually.',
      { roleIds: 'Update the employee reporting line before removing this role.' },
    );
  }
  const removesSuperadmin = before.some((grant) => grant.isSuperadmin)
    && !selectedRoles.some((grant) => grant.isSuperadmin);
  if (removesSuperadmin) {
    const [otherActiveSuperadmin] = await exec.select({ userId: appUser.userId })
      .from(appUser)
      .innerJoin(userCompanyRole, eq(userCompanyRole.userId, appUser.userId))
      .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
      .where(and(
        eq(appUser.masterFn, session.masterFn),
        eq(appUser.isActive, true),
        eq(userCompanyRole.companyFn, session.activeCompanyFn),
        eq(role.masterFn, session.masterFn),
        eq(role.isSuperadmin, true),
        ne(appUser.userId, userId),
      ))
      .limit(1);
    if (!otherActiveSuperadmin) {
      throw new AuthLifecycleError(
        400,
        'cannot_remove_last_superadmin',
        'At least one active superadmin must remain for this company.',
      );
    }
  }

  await exec.delete(userCompanyRole).where(and(
    eq(userCompanyRole.userId, userId),
    eq(userCompanyRole.companyFn, session.activeCompanyFn),
    eq(userCompanyRole.managedBySystem, false),
  ));
  const manualRoleIds = roleIds.filter((roleId) => !managedRoleIds.includes(roleId));
  if (manualRoleIds.length) {
    await exec.insert(userCompanyRole).values(manualRoleIds.map((roleId) => ({
      userId,
      companyFn: session.activeCompanyFn,
      roleId,
      managedBySystem: false,
    })));
  }
  await exec.update(userCompany).set({
    roleId: roleIds[0],
    updatedAt: now,
  }).where(and(
    eq(userCompany.userId, userId),
    eq(userCompany.companyFn, session.activeCompanyFn),
  ));
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'user_company_role',
    entityId: userId,
    action: 'set_roles',
    before: { roles: before.map((grant) => grant.roleId) },
    after: { roles: roleIds },
  });
  return { userId, roles: selectedRoles };
}

export function setUserRoles(
  db: DB,
  session: SessionData,
  userId: number,
  roleIds: number[],
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => setUserRolesWithin(tx, session, userId, roleIds, requestId));
}

export async function createRoleWithin(
  exec: DB,
  session: SessionData,
  name: string,
  requestId: string,
): Promise<{ id: number; name: string }> {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new AuthLifecycleError(400, 'invalid_request', 'Role name is required.', {
      name: 'Role name is required.',
    });
  }
  const [existing] = await exec.select({ roleId: role.roleId })
    .from(role)
    .where(and(
      eq(role.masterFn, session.masterFn),
      eq(role.name, trimmed),
    ))
    .limit(1);
  if (existing) {
    throw new AuthLifecycleError(409, 'role_exists', 'A role with this name already exists.');
  }
  const [created] = await exec.insert(role).values({
    masterFn: session.masterFn,
    name: trimmed,
    isSuperadmin: false,
  }).returning({ id: role.roleId, name: role.name });
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'role',
    entityId: created.id,
    action: 'create',
    after: { name: trimmed },
  });
  return created;
}

export function createRole(db: DB, session: SessionData, name: string, requestId: string) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => createRoleWithin(tx, session, name, requestId));
}

export async function setRolePermissionWithin(
  exec: DB,
  session: SessionData,
  roleId: number,
  permissionKey: string,
  allowed: boolean,
  requestId: string,
  now = new Date(),
): Promise<{ roleId: number; permissionKey: string; allowed: boolean }> {
  if (!KNOWN_PERMISSION_KEYS.has(permissionKey)) {
    throw new AuthLifecycleError(400, 'invalid_permission_key', 'Unknown permission key.');
  }
  const [targetRole] = await exec.select({ roleId: role.roleId, isSuperadmin: role.isSuperadmin })
    .from(role)
    .where(and(
      eq(role.roleId, roleId),
      eq(role.masterFn, session.masterFn),
    ))
    .limit(1);
  if (!targetRole) {
    throw new AuthLifecycleError(404, 'role_not_found', 'Role not found.');
  }
  if (targetRole.isSuperadmin) {
    throw new AuthLifecycleError(
      400,
      'superadmin_immutable',
      'The superadmin role always has full access and cannot be edited.',
    );
  }
  const [existing] = await exec.select({ allowed: rolePermission.allowed })
    .from(rolePermission)
    .where(and(
      eq(rolePermission.roleId, roleId),
      eq(rolePermission.permissionKey, permissionKey),
    ))
    .limit(1);
  if (existing) {
    await exec.update(rolePermission).set({
      allowed,
      updatedAt: now,
    }).where(and(
      eq(rolePermission.roleId, roleId),
      eq(rolePermission.permissionKey, permissionKey),
    ));
  } else {
    await exec.insert(rolePermission).values({
      masterFn: session.masterFn,
      roleId,
      permissionKey,
      allowed,
    });
  }
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'role_permission',
    entityId: roleId,
    action: 'set_permission',
    before: existing ? { allowed: existing.allowed } : null,
    after: { permissionKey, allowed },
  });
  return { roleId, permissionKey, allowed };
}

export function setRolePermission(
  db: DB,
  session: SessionData,
  roleId: number,
  permissionKey: string,
  allowed: boolean,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => setRolePermissionWithin(tx, session, roleId, permissionKey, allowed, requestId));
}

/**
 * Demo-only sibling of lifecycle.ts's createInvitation() with the token/hash
 * computed by the caller instead of node:crypto -- the browser demo runtime
 * computes these via the Web Crypto API and has no email outbox worker, so this
 * skips encryptToken()/newOpaqueToken()/the outbox insert entirely. Otherwise
 * identical validation and userInvitation-insert shape to createInvitation().
 * Raw-exec only (no outer wrapper) -- nothing in production calls this; the
 * production /api/admin/invitations route uses the real createInvitation().
 */
export async function createInvitationRecordWithin(
  exec: DB,
  session: SessionData,
  input: { email: string; roleId: number; tokenHash: string; expiresAt: Date },
  requestId: string,
  now = new Date(),
): Promise<{ id: number; email: string; expiresAt: Date }> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthLifecycleError(400, 'invalid_request', 'Enter a valid email address.', {
      email: 'Enter a valid email address.',
    });
  }
  if (!Number.isSafeInteger(input.roleId) || input.roleId <= 0) {
    throw new AuthLifecycleError(400, 'invalid_request', 'Select a valid role.', {
      roleId: 'Role is required.',
    });
  }

  const [targetRole] = await exec.select({ roleId: role.roleId })
    .from(role)
    .where(and(
      eq(role.roleId, input.roleId),
      eq(role.masterFn, session.masterFn),
    ))
    .limit(1);
  if (!targetRole) {
    throw new AuthLifecycleError(400, 'invalid_role', 'The selected role is unavailable.');
  }

  const [existingUser] = await exec.select({ userId: appUser.userId })
    .from(appUser)
    .where(and(
      eq(appUser.masterFn, session.masterFn),
      eq(appUser.email, email),
    ))
    .limit(1);
  if (existingUser) {
    throw new AuthLifecycleError(409, 'user_exists', 'A user with this email already exists.');
  }

  await exec.update(userInvitation).set({
    expiresAt: now,
    updatedAt: now,
  }).where(and(
    eq(userInvitation.masterFn, session.masterFn),
    eq(userInvitation.companyFn, session.activeCompanyFn),
    eq(userInvitation.email, email),
    isNull(userInvitation.acceptedAt),
    gt(userInvitation.expiresAt, now),
  ));

  const [invitation] = await exec.insert(userInvitation).values({
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    email,
    roleId: targetRole.roleId,
    tokenHash: input.tokenHash,
    invitedByUserId: session.userId,
    expiresAt: input.expiresAt,
  }).returning({ id: userInvitation.id });

  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'user_invitation',
    entityId: invitation.id,
    action: 'create',
    after: { email, roleId: targetRole.roleId, expiresAt: input.expiresAt.toISOString() },
  });
  return { id: invitation.id, email, expiresAt: input.expiresAt };
}
