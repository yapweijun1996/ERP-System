// A Platform Superadmin may temporarily view one active tenant user. This is
// intentionally an overlay on the independent platform session: it never
// creates an app_session, never unions platform permissions with tenant RBAC,
// and every lifecycle transition is dual-attributed in audit_log.
import { and, asc, eq, gt, isNull, lte } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appUser,
  company,
  platformSimulationSession,
  userCompany,
} from '../data/schema';
import { appendAudit } from '../api/audit';
import { hashSecret, type SessionData } from './session';
import {
  getPlatformSession,
  PLATFORM_PERMISSIONS,
  PlatformAccessError,
  requirePlatformPermission,
  type PlatformSessionData,
} from './platformSupport';

export const DEFAULT_PLATFORM_SIMULATION_TTL_MS = 15 * 60 * 1000;

export interface PlatformSimulationData {
  simulationId: number;
  platformPrincipalId: number;
  expiresAt: Date;
  target: SessionData;
}

export interface PlatformSimulationTarget {
  userId: number;
  username: string;
  email: string | null;
  fullName: string | null;
  masterFn: string;
  companyFn: string;
}

function normalizeScope(masterFn: string, companyFn: string): { masterFn: string; companyFn: string } {
  const normalizedMasterFn = masterFn.trim();
  const normalizedCompanyFn = companyFn.trim();
  if (!normalizedMasterFn || !normalizedCompanyFn
    || normalizedMasterFn.length > 128 || normalizedCompanyFn.length > 128) {
    throw new PlatformAccessError(400, 'invalid_simulation_scope', 'masterFn and companyFn are required.');
  }
  return { masterFn: normalizedMasterFn, companyFn: normalizedCompanyFn };
}

async function activeTarget(
  db: DB,
  scope: { masterFn: string; companyFn: string },
  userId: number,
): Promise<PlatformSimulationTarget | null> {
  const [target] = await db.select({
    userId: appUser.userId,
    username: appUser.username,
    email: appUser.email,
    fullName: appUser.fullName,
    masterFn: appUser.masterFn,
    companyFn: userCompany.companyFn,
  }).from(appUser)
    .innerJoin(userCompany, eq(userCompany.userId, appUser.userId))
    .innerJoin(company, eq(company.companyFn, userCompany.companyFn))
    .where(and(
      eq(appUser.userId, userId),
      eq(appUser.masterFn, scope.masterFn),
      eq(userCompany.companyFn, scope.companyFn),
      eq(company.masterFn, scope.masterFn),
      eq(appUser.isActive, true),
      eq(appUser.accountState, 'active'),
    ))
    .limit(1);
  return target ?? null;
}

function targetSession(target: PlatformSimulationTarget, authorizationVersion: number): SessionData {
  return {
    userId: target.userId,
    masterFn: target.masterFn,
    activeCompanyFn: target.companyFn,
    username: target.username,
    email: target.email,
    fullName: target.fullName,
    accountState: 'active',
    passwordChangeRequired: false,
    authorizationVersion,
  };
}

/** List only active users who are assigned to the selected company. */
export async function listPlatformSimulationTargets(
  db: DB,
  platformSession: PlatformSessionData,
  input: { masterFn: string; companyFn: string },
): Promise<PlatformSimulationTarget[]> {
  requirePlatformPermission(platformSession, PLATFORM_PERMISSIONS.simulationManage);
  const scope = normalizeScope(input.masterFn, input.companyFn);
  return db.select({
    userId: appUser.userId,
    username: appUser.username,
    email: appUser.email,
    fullName: appUser.fullName,
    masterFn: appUser.masterFn,
    companyFn: userCompany.companyFn,
  }).from(appUser)
    .innerJoin(userCompany, eq(userCompany.userId, appUser.userId))
    .innerJoin(company, eq(company.companyFn, userCompany.companyFn))
    .where(and(
      eq(appUser.masterFn, scope.masterFn),
      eq(userCompany.companyFn, scope.companyFn),
      eq(company.masterFn, scope.masterFn),
      eq(appUser.isActive, true),
      eq(appUser.accountState, 'active'),
    ))
    .orderBy(asc(appUser.fullName), asc(appUser.username));
}

/** Returns a tenant SessionData constructed from the target principal only.
 * The caller must use it in place of, never alongside, platform permissions. */
export async function getPlatformSimulation(
  db: DB,
  token: string | undefined,
  options: { touch?: boolean; now?: Date } = {},
): Promise<PlatformSimulationData | null> {
  const now = options.now ?? new Date();
  const platformSession = await getPlatformSession(db, token, { touch: options.touch, now });
  if (!platformSession || !token) return null;
  const [row] = await db.select({
    simulationId: platformSimulationSession.simulationId,
    platformPrincipalId: platformSimulationSession.platformPrincipalId,
    expiresAt: platformSimulationSession.expiresAt,
    userId: appUser.userId,
    username: appUser.username,
    email: appUser.email,
    fullName: appUser.fullName,
    masterFn: appUser.masterFn,
    companyFn: userCompany.companyFn,
    authorizationVersion: company.authorizationVersion,
  }).from(platformSimulationSession)
    .innerJoin(appUser, eq(appUser.userId, platformSimulationSession.targetUserId))
    .innerJoin(userCompany, and(
      eq(userCompany.userId, appUser.userId),
      eq(userCompany.companyFn, platformSimulationSession.companyFn),
    ))
    .innerJoin(company, eq(company.companyFn, platformSimulationSession.companyFn))
    .where(and(
      eq(platformSimulationSession.platformSessionHash, hashSecret(token)),
      eq(platformSimulationSession.platformPrincipalId, platformSession.principalId),
      isNull(platformSimulationSession.revokedAt),
      gt(platformSimulationSession.expiresAt, now),
      eq(appUser.isActive, true),
      eq(appUser.accountState, 'active'),
      eq(appUser.masterFn, platformSimulationSession.masterFn),
      eq(company.masterFn, platformSimulationSession.masterFn),
    ))
    .limit(1);
  if (!row) return null;
  return {
    simulationId: row.simulationId,
    platformPrincipalId: row.platformPrincipalId,
    expiresAt: row.expiresAt,
    target: targetSession({
      userId: row.userId,
      username: row.username,
      email: row.email,
      fullName: row.fullName,
      masterFn: row.masterFn,
      companyFn: row.companyFn,
    }, row.authorizationVersion),
  };
}

export async function startPlatformSimulation(
  db: DB,
  platformSession: PlatformSessionData,
  token: string,
  input: { masterFn: string; companyFn: string; targetUserId: number },
  requestId: string,
  now = new Date(),
): Promise<PlatformSimulationData> {
  requirePlatformPermission(platformSession, PLATFORM_PERMISSIONS.simulationManage);
  const scope = normalizeScope(input.masterFn, input.companyFn);
  if (!Number.isSafeInteger(input.targetUserId) || input.targetUserId <= 0) {
    throw new PlatformAccessError(400, 'invalid_simulation_target', 'targetUserId is invalid.');
  }
  const ttlMs = Math.min(DEFAULT_PLATFORM_SIMULATION_TTL_MS, platformSession.expiresAt.getTime() - now.getTime());
  if (ttlMs <= 0) {
    throw new PlatformAccessError(401, 'platform_not_authenticated', 'A valid platform session is required.');
  }
  const expiresAt = new Date(now.getTime() + ttlMs);
  const platformSessionHash = hashSecret(token);
  return db.transaction(async (tx) => {
    const exec = tx as unknown as DB;
    const target = await activeTarget(exec, scope, input.targetUserId);
    if (!target) {
      throw new PlatformAccessError(404, 'simulation_target_not_found', 'The active tenant user was not found in this company.');
    }
    const [activeSimulation] = await exec.select({ simulationId: platformSimulationSession.simulationId })
      .from(platformSimulationSession)
      .where(and(
        eq(platformSimulationSession.platformSessionHash, platformSessionHash),
        isNull(platformSimulationSession.revokedAt),
        gt(platformSimulationSession.expiresAt, now),
      ))
      .limit(1);
    if (activeSimulation) {
      throw new PlatformAccessError(
        409,
        'platform_simulation_active',
        'Return to the Platform workspace before simulating another user.',
      );
    }
    // Expired rows must be closed before the partial unique index can admit a
    // new explicit simulation on the same platform session.
    await exec.update(platformSimulationSession).set({ revokedAt: now, updatedAt: now })
      .where(and(
        eq(platformSimulationSession.platformSessionHash, platformSessionHash),
        isNull(platformSimulationSession.revokedAt),
        lte(platformSimulationSession.expiresAt, now),
      ));
    const [created] = await exec.insert(platformSimulationSession).values({
      platformSessionHash,
      platformPrincipalId: platformSession.principalId,
      targetUserId: target.userId,
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    }).returning({ simulationId: platformSimulationSession.simulationId });
    const [companyRow] = await exec.select({ authorizationVersion: company.authorizationVersion })
      .from(company)
      .where(and(eq(company.companyFn, scope.companyFn), eq(company.masterFn, scope.masterFn)))
      .limit(1);
    if (!companyRow) throw new PlatformAccessError(404, 'simulation_target_not_found', 'The target company was not found.');
    await appendAudit(exec, {
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      actorUserId: target.userId,
      platformPrincipalId: platformSession.principalId,
      requestId,
      entity: 'platform/simulation',
      entityId: created.simulationId,
      action: 'platform_simulation_started',
      after: { targetUserId: target.userId, expiresAt },
      occurredAt: now,
    });
    return {
      simulationId: created.simulationId,
      platformPrincipalId: platformSession.principalId,
      expiresAt,
      target: targetSession(target, companyRow.authorizationVersion),
    };
  });
}

/** Explicit return-to-platform. Repeating it is idempotent for browser retry
 * safety; a revoked or expired simulation can never be reactivated. */
export async function endPlatformSimulation(
  db: DB,
  platformSession: PlatformSessionData,
  token: string,
  requestId: string,
  now = new Date(),
): Promise<boolean> {
  const platformSessionHash = hashSecret(token);
  return db.transaction(async (tx) => {
    const exec = tx as unknown as DB;
    const [current] = await exec.select({
      simulationId: platformSimulationSession.simulationId,
      targetUserId: platformSimulationSession.targetUserId,
      masterFn: platformSimulationSession.masterFn,
      companyFn: platformSimulationSession.companyFn,
    }).from(platformSimulationSession)
      .where(and(
        eq(platformSimulationSession.platformSessionHash, platformSessionHash),
        eq(platformSimulationSession.platformPrincipalId, platformSession.principalId),
        isNull(platformSimulationSession.revokedAt),
        gt(platformSimulationSession.expiresAt, now),
      ))
      .limit(1);
    if (!current) return false;
    const revoked = await exec.update(platformSimulationSession).set({ revokedAt: now, updatedAt: now })
      .where(and(
        eq(platformSimulationSession.simulationId, current.simulationId),
        isNull(platformSimulationSession.revokedAt),
      )).returning({ simulationId: platformSimulationSession.simulationId });
    if (!revoked.length) return false;
    await appendAudit(exec, {
      masterFn: current.masterFn,
      companyFn: current.companyFn,
      actorUserId: current.targetUserId,
      platformPrincipalId: platformSession.principalId,
      requestId,
      entity: 'platform/simulation',
      entityId: current.simulationId,
      action: 'platform_simulation_ended',
      before: { targetUserId: current.targetUserId },
      after: { reason: 'platform_return' },
      occurredAt: now,
    });
    return true;
  });
}

export async function platformSimulationIsActive(
  db: DB,
  token: string | undefined,
  now = new Date(),
): Promise<boolean> {
  return Boolean(await getPlatformSimulation(db, token, { touch: false, now }));
}
