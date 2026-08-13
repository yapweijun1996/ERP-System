// Elevated Platform Superadmin tenant administration. Authentication remains
// in the platform realm; a hidden, non-login app_user only supplies the tenant
// foreign keys and explicit Company RBAC required by existing business commands.
import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appUser,
  company,
  platformBreakGlassWindow,
  platformPrincipal,
  platformPrincipalTenantActor,
  platformSimulationSession,
  platformTenantAccessSession,
  role,
  rolePermission,
  roleResourceScope,
  userCompany,
  userCompanyRole,
} from '../data/schema';
import { appendAudit } from '../api/audit';
import {
  PERMISSION_CATALOG,
  PLATFORM_TENANT_ADMIN_ROLE_TEMPLATE_KEY,
} from './accessCatalog';
import { hashPassword } from './password';
import { hashSecret, type SessionData } from './session';
import {
  getPlatformSession,
  PLATFORM_PERMISSIONS,
  PlatformAccessError,
  requirePlatformPermission,
  type PlatformSessionData,
} from './platformSupport';

export const PLATFORM_TENANT_ACCESS_TTL_MS = 15 * 60 * 1000;
export const PLATFORM_BREAK_GLASS_TTL_MS = 15 * 60 * 1000;

export interface PlatformBreakGlassData {
  windowId: number;
  expiresAt: Date;
  reason: string;
  ticketReference: string;
}

export interface ActingPlatformPrincipal {
  actorType: 'platform_superadmin';
  platformPrincipalId: number;
  principalKey: string;
  displayName: string;
}

export interface PlatformTenantAccessData {
  accessId: number;
  mode: 'platform_admin';
  platformPrincipalId: number;
  masterFn: string;
  companyFn: string;
  actorUserId: number;
  reason: string;
  ticketReference: string;
  expiresAt: Date;
  target: SessionData;
  actingPrincipal: ActingPlatformPrincipal;
  breakGlass: PlatformBreakGlassData | null;
}

function normalizedText(value: string, field: string, max = 500): string {
  const result = value.trim();
  if (!result || result.length > max) {
    throw new PlatformAccessError(400, 'invalid_platform_tenant_access', `${field} is required.`);
  }
  return result;
}

function normalizeScope(masterFn: string, companyFn: string) {
  return {
    masterFn: normalizedText(masterFn, 'masterFn', 128),
    companyFn: normalizedText(companyFn, 'companyFn', 128),
  };
}

async function assertCompany(exec: DB, scope: { masterFn: string; companyFn: string }) {
  const [row] = await exec.select({ authorizationVersion: company.authorizationVersion })
    .from(company)
    .where(and(eq(company.masterFn, scope.masterFn), eq(company.companyFn, scope.companyFn)))
    .limit(1);
  if (!row) throw new PlatformAccessError(404, 'platform_tenant_scope_not_found', 'The target Company was not found.');
  return row;
}

async function ensurePlatformActorWithin(
  exec: DB,
  platformSession: PlatformSessionData,
  scope: { masterFn: string; companyFn: string },
): Promise<number> {
  await exec.select({ principalId: platformPrincipal.principalId }).from(platformPrincipal)
    .where(eq(platformPrincipal.principalId, platformSession.principalId)).limit(1).for('update');

  let [actor] = await exec.select({ actorUserId: platformPrincipalTenantActor.actorUserId })
    .from(platformPrincipalTenantActor)
    .where(and(
      eq(platformPrincipalTenantActor.platformPrincipalId, platformSession.principalId),
      eq(platformPrincipalTenantActor.masterFn, scope.masterFn),
    )).limit(1);
  if (!actor) {
    const [createdUser] = await exec.insert(appUser).values({
      masterFn: scope.masterFn,
      username: `__platform_actor_${platformSession.principalId}`,
      email: null,
      // Some governed records expose their actor FK through ordinary app_user
      // joins. Keep that fallback attribution honest even though tenant user
      // administration hides the bridge row entirely.
      fullName: `Platform Admin · P-${platformSession.principalId} · ${platformSession.displayName}`,
      passwordHash: hashPassword(randomUUID()),
      identityKind: 'platform_actor',
      loginEnabled: false,
      language: 'en',
      isActive: true,
      accountState: 'active',
      passwordChangeRequired: false,
      activatedAt: new Date(),
    }).returning({ actorUserId: appUser.userId });
    [actor] = await exec.insert(platformPrincipalTenantActor).values({
      platformPrincipalId: platformSession.principalId,
      masterFn: scope.masterFn,
      actorUserId: createdUser.actorUserId,
    }).returning({ actorUserId: platformPrincipalTenantActor.actorUserId });
  }
  const [actorIdentity] = await exec.select({
    identityKind: appUser.identityKind,
    loginEnabled: appUser.loginEnabled,
  }).from(appUser).where(and(
    eq(appUser.userId, actor.actorUserId),
    eq(appUser.masterFn, scope.masterFn),
  )).limit(1);
  if (actorIdentity?.identityKind !== 'platform_actor' || actorIdentity.loginEnabled) {
    throw new PlatformAccessError(
      409,
      'platform_tenant_actor_invalid',
      'The hidden Platform tenant actor is unavailable.',
    );
  }
  await exec.update(appUser).set({
    fullName: `Platform Admin · P-${platformSession.principalId} · ${platformSession.displayName}`,
    updatedAt: new Date(),
  }).where(eq(appUser.userId, actor.actorUserId));

  let [adminRole] = await exec.select({ roleId: role.roleId }).from(role).where(and(
    eq(role.masterFn, scope.masterFn),
    eq(role.companyFn, scope.companyFn),
    eq(role.sourceTemplateKey, PLATFORM_TENANT_ADMIN_ROLE_TEMPLATE_KEY),
  )).limit(1);
  if (!adminRole) {
    [adminRole] = await exec.insert(role).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      name: 'Platform Tenant Admin',
      isSuperadmin: false,
      sourceTemplateKey: PLATFORM_TENANT_ADMIN_ROLE_TEMPLATE_KEY,
    }).returning({ roleId: role.roleId });
  }
  await exec.update(role).set({
    name: 'Platform Tenant Admin',
    isSuperadmin: false,
    updatedAt: new Date(),
  }).where(eq(role.roleId, adminRole.roleId));
  // Reconcile on every entry so newly registered tenant permissions become
  // available without making this hidden system role tenant-editable.
  await exec.insert(rolePermission).values(PERMISSION_CATALOG.map((permissionKey) => ({
    masterFn: scope.masterFn,
    roleId: adminRole.roleId,
    permissionKey,
    allowed: true,
  }))).onConflictDoNothing();
  await exec.insert(roleResourceScope).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    roleId: adminRole.roleId,
    resourceKey: '*',
    scope: 'company',
  }).onConflictDoNothing();

  await exec.insert(userCompany).values({
    userId: actor.actorUserId,
    companyFn: scope.companyFn,
    roleId: adminRole.roleId,
  }).onConflictDoNothing();
  const [assignment] = await exec.select({ assignmentId: userCompanyRole.assignmentId })
    .from(userCompanyRole).where(and(
      eq(userCompanyRole.userId, actor.actorUserId),
      eq(userCompanyRole.companyFn, scope.companyFn),
      eq(userCompanyRole.roleId, adminRole.roleId),
      isNull(userCompanyRole.revokedAt),
    )).limit(1);
  if (!assignment) {
    await exec.insert(userCompanyRole).values({
      userId: actor.actorUserId,
      companyFn: scope.companyFn,
      roleId: adminRole.roleId,
      managedBySystem: true,
      assignmentSource: 'system',
      assignmentReason: 'Platform Tenant Admin bridge',
    });
  }
  return actor.actorUserId;
}

function tenantSession(
  access: {
    actorUserId: number;
    masterFn: string;
    companyFn: string;
    authorizationVersion: number;
  },
  platformSession: PlatformSessionData,
): SessionData {
  return {
    userId: access.actorUserId,
    masterFn: access.masterFn,
    activeCompanyFn: access.companyFn,
    username: platformSession.principalKey,
    email: null,
    fullName: platformSession.displayName,
    accountState: 'active',
    passwordChangeRequired: false,
    authorizationVersion: access.authorizationVersion,
  };
}

export async function getPlatformTenantAccess(
  db: DB,
  token: string | undefined,
  options: { touch?: boolean; now?: Date } = {},
): Promise<PlatformTenantAccessData | null> {
  const now = options.now ?? new Date();
  const platformSession = await getPlatformSession(db, token, { touch: options.touch, now });
  if (!platformSession || !token) return null;
  const [row] = await db.select({
    accessId: platformTenantAccessSession.accessId,
    platformPrincipalId: platformTenantAccessSession.platformPrincipalId,
    actorUserId: platformTenantAccessSession.actorUserId,
    masterFn: platformTenantAccessSession.masterFn,
    companyFn: platformTenantAccessSession.companyFn,
    reason: platformTenantAccessSession.reason,
    ticketReference: platformTenantAccessSession.ticketReference,
    expiresAt: platformTenantAccessSession.expiresAt,
    authorizationVersion: company.authorizationVersion,
    identityKind: appUser.identityKind,
    loginEnabled: appUser.loginEnabled,
  }).from(platformTenantAccessSession)
    .innerJoin(appUser, eq(appUser.userId, platformTenantAccessSession.actorUserId))
    .innerJoin(company, eq(company.companyFn, platformTenantAccessSession.companyFn))
    .where(and(
      eq(platformTenantAccessSession.platformSessionHash, hashSecret(token)),
      eq(platformTenantAccessSession.platformPrincipalId, platformSession.principalId),
      isNull(platformTenantAccessSession.revokedAt),
      gt(platformTenantAccessSession.expiresAt, now),
      eq(appUser.identityKind, 'platform_actor'),
      eq(appUser.loginEnabled, false),
      eq(appUser.isActive, true),
      eq(appUser.masterFn, platformTenantAccessSession.masterFn),
      eq(company.masterFn, platformTenantAccessSession.masterFn),
    )).limit(1);
  if (!row) return null;
  const [window] = await db.select({
    windowId: platformBreakGlassWindow.windowId,
    expiresAt: platformBreakGlassWindow.expiresAt,
    reason: platformBreakGlassWindow.reason,
    ticketReference: platformBreakGlassWindow.ticketReference,
  }).from(platformBreakGlassWindow).where(and(
    eq(platformBreakGlassWindow.accessId, row.accessId),
    eq(platformBreakGlassWindow.platformPrincipalId, row.platformPrincipalId),
    eq(platformBreakGlassWindow.masterFn, row.masterFn),
    eq(platformBreakGlassWindow.companyFn, row.companyFn),
    isNull(platformBreakGlassWindow.revokedAt),
    gt(platformBreakGlassWindow.expiresAt, now),
  )).limit(1);
  return {
    accessId: row.accessId,
    mode: 'platform_admin',
    platformPrincipalId: row.platformPrincipalId,
    actorUserId: row.actorUserId,
    masterFn: row.masterFn,
    companyFn: row.companyFn,
    reason: row.reason,
    ticketReference: row.ticketReference,
    expiresAt: row.expiresAt,
    target: tenantSession(row, platformSession),
    actingPrincipal: {
      actorType: 'platform_superadmin',
      platformPrincipalId: platformSession.principalId,
      principalKey: platformSession.principalKey,
      displayName: platformSession.displayName,
    },
    breakGlass: window ?? null,
  };
}

export async function startPlatformTenantAccess(
  db: DB,
  platformSession: PlatformSessionData,
  token: string,
  input: { masterFn: string; companyFn: string; reason: string; ticketReference: string },
  requestId: string,
  now = new Date(),
): Promise<PlatformTenantAccessData> {
  requirePlatformPermission(platformSession, PLATFORM_PERMISSIONS.tenantAccessManage);
  const scope = normalizeScope(input.masterFn, input.companyFn);
  const reason = normalizedText(input.reason, 'reason');
  const ticketReference = normalizedText(input.ticketReference, 'ticketReference', 128);
  const ttl = Math.min(PLATFORM_TENANT_ACCESS_TTL_MS, platformSession.expiresAt.getTime() - now.getTime());
  if (ttl <= 0) throw new PlatformAccessError(401, 'platform_not_authenticated', 'A valid platform session is required.');
  await db.transaction(async (tx) => {
    const exec = tx as unknown as DB;
    await assertCompany(exec, scope);
    const sessionHash = hashSecret(token);
    const [simulation] = await exec.select({ id: platformSimulationSession.simulationId })
      .from(platformSimulationSession).where(and(
        eq(platformSimulationSession.platformSessionHash, sessionHash),
        isNull(platformSimulationSession.revokedAt),
        gt(platformSimulationSession.expiresAt, now),
      )).limit(1);
    if (simulation) throw new PlatformAccessError(409, 'platform_simulation_active', 'Return from Employee simulation first.');
    const [active] = await exec.select({ id: platformTenantAccessSession.accessId })
      .from(platformTenantAccessSession).where(and(
        eq(platformTenantAccessSession.platformSessionHash, sessionHash),
        isNull(platformTenantAccessSession.revokedAt),
        gt(platformTenantAccessSession.expiresAt, now),
      )).limit(1);
    if (active) throw new PlatformAccessError(409, 'platform_tenant_access_active', 'Return to the Platform workspace first.');
    await exec.update(platformTenantAccessSession).set({ revokedAt: now, updatedAt: now })
      .where(and(
        eq(platformTenantAccessSession.platformSessionHash, sessionHash),
        isNull(platformTenantAccessSession.revokedAt),
        lte(platformTenantAccessSession.expiresAt, now),
      ));
    const actorUserId = await ensurePlatformActorWithin(exec, platformSession, scope);
    const [created] = await exec.insert(platformTenantAccessSession).values({
      platformSessionHash: sessionHash,
      platformPrincipalId: platformSession.principalId,
      actorUserId,
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      mode: 'platform_admin',
      reason,
      ticketReference,
      expiresAt: new Date(now.getTime() + ttl),
    }).returning({ accessId: platformTenantAccessSession.accessId });
    await appendAudit(exec, {
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      actorUserId,
      platformPrincipalId: platformSession.principalId,
      requestId,
      entity: 'platform/tenant-access',
      entityId: created.accessId,
      action: 'platform_tenant_access_started',
      after: { reason, ticketReference, expiresAt: new Date(now.getTime() + ttl) },
      occurredAt: now,
    });
  });
  const access = await getPlatformTenantAccess(db, token, { touch: false, now });
  if (!access) throw new PlatformAccessError(409, 'platform_tenant_access_failed', 'Tenant access could not be established.');
  return access;
}

export async function switchPlatformTenantScope(
  db: DB,
  platformSession: PlatformSessionData,
  token: string,
  input: { masterFn: string; companyFn: string },
  requestId: string,
  now = new Date(),
): Promise<PlatformTenantAccessData> {
  requirePlatformPermission(platformSession, PLATFORM_PERMISSIONS.tenantAccessManage);
  const scope = normalizeScope(input.masterFn, input.companyFn);
  const current = await getPlatformTenantAccess(db, token, { touch: false, now });
  if (!current) throw new PlatformAccessError(409, 'platform_tenant_access_required', 'Open a Platform Admin tenant workspace first.');
  await db.transaction(async (tx) => {
    const exec = tx as unknown as DB;
    const [lockedCurrent] = await exec.select({
      accessId: platformTenantAccessSession.accessId,
      actorUserId: platformTenantAccessSession.actorUserId,
      masterFn: platformTenantAccessSession.masterFn,
      companyFn: platformTenantAccessSession.companyFn,
      reason: platformTenantAccessSession.reason,
      ticketReference: platformTenantAccessSession.ticketReference,
    }).from(platformTenantAccessSession).where(and(
      eq(platformTenantAccessSession.accessId, current.accessId),
      eq(platformTenantAccessSession.platformSessionHash, hashSecret(token)),
      eq(platformTenantAccessSession.platformPrincipalId, platformSession.principalId),
      isNull(platformTenantAccessSession.revokedAt),
      gt(platformTenantAccessSession.expiresAt, now),
    )).limit(1).for('update');
    if (!lockedCurrent) {
      throw new PlatformAccessError(409, 'platform_tenant_access_required', 'Platform tenant access is no longer active.');
    }
    await assertCompany(exec, scope);
    const actorUserId = await ensurePlatformActorWithin(exec, platformSession, scope);
    await exec.update(platformBreakGlassWindow).set({ revokedAt: now, updatedAt: now })
      .where(and(eq(platformBreakGlassWindow.accessId, lockedCurrent.accessId), isNull(platformBreakGlassWindow.revokedAt)));
    await exec.update(platformTenantAccessSession).set({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      actorUserId,
      updatedAt: now,
    }).where(and(
      eq(platformTenantAccessSession.accessId, lockedCurrent.accessId),
      isNull(platformTenantAccessSession.revokedAt),
    ));
    await appendAudit(exec, {
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      actorUserId,
      platformPrincipalId: platformSession.principalId,
      requestId,
      entity: 'platform/tenant-access',
      entityId: lockedCurrent.accessId,
      action: 'platform_tenant_scope_switched',
      before: { masterFn: lockedCurrent.masterFn, companyFn: lockedCurrent.companyFn, actorUserId: lockedCurrent.actorUserId },
      after: { ...scope, actorUserId, inheritedReason: lockedCurrent.reason, inheritedTicketReference: lockedCurrent.ticketReference },
      occurredAt: now,
    });
  });
  const access = await getPlatformTenantAccess(db, token, { touch: false, now });
  if (!access) throw new PlatformAccessError(409, 'platform_tenant_scope_switch_failed', 'Tenant scope could not be switched.');
  return access;
}

export async function startPlatformBreakGlass(
  db: DB,
  platformSession: PlatformSessionData,
  token: string,
  input: { reason: string; ticketReference: string },
  requestId: string,
  now = new Date(),
): Promise<PlatformBreakGlassData> {
  requirePlatformPermission(platformSession, PLATFORM_PERMISSIONS.tenantAccessManage);
  const access = await getPlatformTenantAccess(db, token, { touch: false, now });
  if (!access) throw new PlatformAccessError(409, 'platform_tenant_access_required', 'Open a Platform Admin tenant workspace first.');
  const reason = normalizedText(input.reason, 'reason');
  const ticketReference = normalizedText(input.ticketReference, 'ticketReference', 128);
  const expiresAt = new Date(Math.min(
    now.getTime() + PLATFORM_BREAK_GLASS_TTL_MS,
    access.expiresAt.getTime(),
    platformSession.expiresAt.getTime(),
  ));
  const result = await db.transaction(async (tx) => {
    const exec = tx as unknown as DB;
    const [lockedAccess] = await exec.select({ accessId: platformTenantAccessSession.accessId })
      .from(platformTenantAccessSession).where(and(
        eq(platformTenantAccessSession.accessId, access.accessId),
        eq(platformTenantAccessSession.platformSessionHash, hashSecret(token)),
        eq(platformTenantAccessSession.platformPrincipalId, platformSession.principalId),
        eq(platformTenantAccessSession.masterFn, access.masterFn),
        eq(platformTenantAccessSession.companyFn, access.companyFn),
        isNull(platformTenantAccessSession.revokedAt),
        gt(platformTenantAccessSession.expiresAt, now),
      )).limit(1).for('update');
    if (!lockedAccess) {
      throw new PlatformAccessError(409, 'platform_tenant_access_required', 'Platform tenant access is no longer active.');
    }
    await exec.update(platformBreakGlassWindow).set({ revokedAt: now, updatedAt: now })
      .where(and(eq(platformBreakGlassWindow.accessId, lockedAccess.accessId), isNull(platformBreakGlassWindow.revokedAt)));
    const [window] = await exec.insert(platformBreakGlassWindow).values({
      accessId: lockedAccess.accessId,
      platformPrincipalId: platformSession.principalId,
      masterFn: access.masterFn,
      companyFn: access.companyFn,
      reason,
      ticketReference,
      expiresAt,
    }).returning({ windowId: platformBreakGlassWindow.windowId });
    await appendAudit(exec, {
      masterFn: access.masterFn,
      companyFn: access.companyFn,
      actorUserId: access.actorUserId,
      platformPrincipalId: platformSession.principalId,
      requestId,
      entity: 'platform/break-glass',
      entityId: window.windowId,
      action: 'platform_break_glass_started',
      after: { reason, ticketReference, expiresAt },
      occurredAt: now,
    });
    return { windowId: window.windowId, expiresAt, reason, ticketReference };
  });
  return result;
}

export async function endPlatformTenantAccess(
  db: DB,
  platformSession: PlatformSessionData,
  token: string,
  requestId: string,
  reason = 'platform_return',
  now = new Date(),
): Promise<boolean> {
  const current = await getPlatformTenantAccess(db, token, { touch: false, now });
  if (!current) return false;
  return db.transaction(async (tx) => {
    const exec = tx as unknown as DB;
    await exec.update(platformBreakGlassWindow).set({ revokedAt: now, updatedAt: now })
      .where(and(eq(platformBreakGlassWindow.accessId, current.accessId), isNull(platformBreakGlassWindow.revokedAt)));
    const revoked = await exec.update(platformTenantAccessSession).set({ revokedAt: now, updatedAt: now })
      .where(and(eq(platformTenantAccessSession.accessId, current.accessId), isNull(platformTenantAccessSession.revokedAt)))
      .returning({ accessId: platformTenantAccessSession.accessId });
    if (!revoked.length) return false;
    await appendAudit(exec, {
      masterFn: current.masterFn,
      companyFn: current.companyFn,
      actorUserId: current.actorUserId,
      platformPrincipalId: platformSession.principalId,
      requestId,
      entity: 'platform/tenant-access',
      entityId: current.accessId,
      action: 'platform_tenant_access_ended',
      before: { reason: current.reason, ticketReference: current.ticketReference },
      after: { reason },
      occurredAt: now,
    });
    return true;
  });
}

export function isSensitivePlatformMutation(method: string, path: string): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return false;
  const normalized = path.toLowerCase();
  return /\/(approve|reject|release|pay|post|commission|budget|verify|reveal|result-import)(?:\/|$)/.test(normalized)
    || /^\/api\/(finance|payroll|payout-profiles|reimbursement-batches|reimbursement-payments|tax-evidence)(?:\/|$)/.test(normalized)
    || /payment-batch|payment-voucher|bank|credential|tax-evidence|payout/.test(normalized);
}
