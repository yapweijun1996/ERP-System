// Platform authorization is intentionally separate from tenant RBAC.
// Platform principals have their own role/session tables and receive no tenant
// data authority unless an active, reasoned support grant is evaluated.
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  company,
  master,
  platformPrincipal,
  platformPrincipalRole,
  platformRole,
  platformRolePermission,
  platformSession,
  supportAccessGrant,
} from '../data/schema';
import { appendAudit } from '../api/audit';
import {
  bumpAuthorizationVersionWithin,
  bumpMasterAuthorizationVersionsWithin,
} from './authorizationVersion';
import { PLATFORM_PERMISSIONS, type PlatformPermission } from './platformPermissionCatalog';
import { hashPassword, verifyPassword } from './password';

export { PLATFORM_PERMISSIONS, type PlatformPermission } from './platformPermissionCatalog';

export const PLATFORM_ROLE_TEMPLATES = {
  superadmin: {
    code: 'platform_superadmin',
    name: 'Platform Superadmin',
    permissions: [
      PLATFORM_PERMISSIONS.modulesRead,
      PLATFORM_PERMISSIONS.modulesManage,
      PLATFORM_PERMISSIONS.simulationManage,
    ],
  },
  supportEngineer: {
    code: 'platform_support_engineer',
    name: 'Platform Support Engineer',
    permissions: [PLATFORM_PERMISSIONS.supportRead, PLATFORM_PERMISSIONS.supportUse],
  },
  supportAdmin: {
    code: 'platform_support_admin',
    name: 'Platform Support Administrator',
    permissions: [
      PLATFORM_PERMISSIONS.supportRead,
      PLATFORM_PERMISSIONS.supportUse,
      PLATFORM_PERMISSIONS.supportGrant,
      PLATFORM_PERMISSIONS.supportRevoke,
    ],
  },
} as const;

const ROLE_TEMPLATES_BY_CODE = new Map<string, {
  code: string;
  name: string;
  permissions: readonly PlatformPermission[];
}>(
  Object.values(PLATFORM_ROLE_TEMPLATES).map((template) => [template.code, template]),
);

export const SUPPORT_ACCESS_MODES = ['read_only', 'restricted_write', 'break_glass'] as const;
export type SupportAccessMode = typeof SUPPORT_ACCESS_MODES[number];

export const MAX_SUPPORT_GRANT_DURATION_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_SENSITIVE_FIELDS = [
  'auth.credentials',
  'finance.bank_account',
  'hr.salary',
] as const;

export interface PlatformSessionData {
  principalId: number;
  principalKey: string;
  displayName: string;
  permissions: readonly string[];
  expiresAt: Date;
}

export interface PlatformSessionCredentials {
  token: string;
  csrfToken: string;
  expiresAt: Date;
}

export const PLATFORM_SESSION_COOKIE = 'erp_platform_session';
export const PLATFORM_CSRF_COOKIE = 'erp_platform_csrf';
export const PLATFORM_SESSION_TTL_MS = 60 * 60 * 1000;

export interface SupportAccessRestrictions {
  blockedSensitiveFields?: readonly string[];
  allowedOperations?: readonly string[];
  breakGlassApprovalReference?: string;
}

interface NormalizedSupportAccessRestrictions {
  blockedSensitiveFields: string[];
  allowedOperations: string[];
  breakGlassApprovalReference?: string;
}

export interface CreateSupportAccessGrantInput {
  masterFn: string;
  companyFn?: string | null;
  grantedPrincipalId?: number;
  reason: string;
  ticketReference: string;
  mode: SupportAccessMode;
  validFrom: Date | string;
  validUntil: Date | string;
  restrictions?: SupportAccessRestrictions;
}

export interface SupportAccessDecision {
  allowed: boolean;
  grantId?: number;
  mode?: SupportAccessMode;
  masterFn: string;
  companyFn: string;
  reasonCode: 'ALLOWED' | 'SUPPORT_ACCESS_DENIED' | 'SUPPORT_ACCESS_EXPIRED'
    | 'SUPPORT_ACCESS_REVOKED' | 'SUPPORT_ACCESS_SENSITIVE_FIELD_DENIED'
    | 'SUPPORT_ACCESS_OPERATION_DENIED';
}

export class PlatformAccessError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PlatformAccessError';
  }
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function newToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

function secretsMatch(expectedHash: string, rawValue: string): boolean {
  const actual = Buffer.from(hashSecret(rawValue), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function asDate(value: Date | string, field: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new PlatformAccessError(400, 'invalid_support_grant', `${field} must be a valid date.`);
  }
  return date;
}

function normalizeStringList(value: readonly string[] | undefined, field: string): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 100) {
    throw new PlatformAccessError(400, 'invalid_support_restrictions', `${field} is invalid.`);
  }
  const result = [...new Set(value.map((item) => {
    if (typeof item !== 'string' || item.trim().length === 0 || item.length > 128) {
      throw new PlatformAccessError(400, 'invalid_support_restrictions', `${field} contains an invalid value.`);
    }
    return item.trim();
  }))];
  return result.sort();
}

function normalizeRestrictions(
  mode: SupportAccessMode,
  input: SupportAccessRestrictions | undefined,
): NormalizedSupportAccessRestrictions {
  if (!SUPPORT_ACCESS_MODES.includes(mode)) {
    throw new PlatformAccessError(400, 'invalid_support_grant_mode', 'Unsupported support access mode.');
  }
  const blockedSensitiveFields = [...new Set([
    ...DEFAULT_SENSITIVE_FIELDS,
    ...normalizeStringList(input?.blockedSensitiveFields, 'blockedSensitiveFields'),
  ])].sort();
  const allowedOperations = normalizeStringList(input?.allowedOperations, 'allowedOperations');
  const breakGlassApprovalReference = input?.breakGlassApprovalReference?.trim();
  if (mode === 'read_only' && allowedOperations.length > 0) {
    throw new PlatformAccessError(
      400,
      'invalid_support_restrictions',
      'Read-only grants cannot include write operations.',
    );
  }
  if (mode === 'restricted_write' && allowedOperations.length === 0) {
    throw new PlatformAccessError(
      400,
      'invalid_support_restrictions',
      'Restricted-write grants require an operation allowlist.',
    );
  }
  if (mode === 'break_glass' && (!breakGlassApprovalReference || breakGlassApprovalReference.length > 128)) {
    throw new PlatformAccessError(
      400,
      'break_glass_approval_required',
      'Break-glass grants require an approval reference.',
    );
  }
  return {
    blockedSensitiveFields,
    allowedOperations,
    ...(breakGlassApprovalReference ? { breakGlassApprovalReference } : {}),
  };
}

async function ensurePlatformRoles(exec: DB): Promise<Map<string, number>> {
  const roleIds = new Map<string, number>();
  for (const template of ROLE_TEMPLATES_BY_CODE.values()) {
    let [row] = await exec.select({ platformRoleId: platformRole.platformRoleId })
      .from(platformRole)
      .where(eq(platformRole.code, template.code))
      .limit(1);
    if (!row) {
      [row] = await exec.insert(platformRole).values({
        code: template.code,
        name: template.name,
        isSystemRole: true,
      }).returning({ platformRoleId: platformRole.platformRoleId });
    }
    roleIds.set(template.code, row.platformRoleId);
    await exec.insert(platformRolePermission).values(template.permissions.map((permissionKey) => ({
      platformRoleId: row.platformRoleId,
      permissionKey,
    }))).onConflictDoNothing();
  }
  return roleIds;
}

async function platformPrincipalPermissions(exec: DB, principalId: number): Promise<string[]> {
  const rows = await exec.select({ permissionKey: platformRolePermission.permissionKey })
    .from(platformPrincipalRole)
    .innerJoin(platformRole, eq(platformRole.platformRoleId, platformPrincipalRole.platformRoleId))
    .innerJoin(
      platformRolePermission,
      eq(platformRolePermission.platformRoleId, platformRole.platformRoleId),
    )
    .where(eq(platformPrincipalRole.principalId, principalId));
  return [...new Set(rows.map((row) => row.permissionKey))].sort();
}

export async function provisionPlatformPrincipal(
  db: DB,
  input: {
    principalKey: string;
    displayName: string;
    email?: string | null;
    /** Optional while legacy bootstrap continues to issue out-of-band bearer
     * sessions. Interactive platform login requires this independent hash. */
    password?: string;
    roleCodes?: readonly string[];
  },
): Promise<{ principalId: number; principalKey: string }> {
  const principalKey = input.principalKey.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(principalKey)) {
    throw new PlatformAccessError(400, 'invalid_platform_principal', 'principalKey is invalid.');
  }
  const displayName = input.displayName.trim();
  if (displayName.length === 0 || displayName.length > 160) {
    throw new PlatformAccessError(400, 'invalid_platform_principal', 'displayName is invalid.');
  }
  const roleCodes = [...new Set(input.roleCodes ?? [PLATFORM_ROLE_TEMPLATES.supportEngineer.code])];
  if (roleCodes.length === 0 || roleCodes.some((code) => !ROLE_TEMPLATES_BY_CODE.has(code))) {
    throw new PlatformAccessError(400, 'invalid_platform_role', 'Only application-owned platform roles may be assigned.');
  }
  if (input.password != null && (typeof input.password !== 'string'
    || input.password.length < 12 || input.password.length > 1024)) {
    throw new PlatformAccessError(
      400,
      'invalid_platform_password',
      'Platform passwords must be from 12 to 1024 characters.',
    );
  }
  return db.transaction(async (tx) => {
    const exec = tx as unknown as DB;
    const roleIds = await ensurePlatformRoles(exec);
    const [existing] = await exec.select({ principalId: platformPrincipal.principalId })
      .from(platformPrincipal)
      .where(eq(platformPrincipal.principalKey, principalKey))
      .limit(1);
    if (existing) {
      throw new PlatformAccessError(409, 'platform_principal_exists', 'Platform principal already exists.');
    }
    const [principal] = await exec.insert(platformPrincipal).values({
      principalKey,
      displayName,
      email: input.email?.trim() || null,
      passwordHash: input.password ? hashPassword(input.password) : null,
      isActive: true,
    }).returning({ principalId: platformPrincipal.principalId });
    await exec.insert(platformPrincipalRole).values(roleCodes.map((code) => ({
      principalId: principal.principalId,
      platformRoleId: roleIds.get(code)!,
    })));
    return { principalId: principal.principalId, principalKey };
  });
}

export async function createPlatformSession(
  db: DB,
  principalId: number,
  options: { ttlMs?: number; now?: Date } = {},
): Promise<PlatformSessionCredentials> {
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? PLATFORM_SESSION_TTL_MS;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > PLATFORM_SESSION_TTL_MS) {
    throw new PlatformAccessError(400, 'invalid_platform_session_ttl', 'Platform session TTL is invalid.');
  }
  const [principal] = await db.select({ isActive: platformPrincipal.isActive })
    .from(platformPrincipal)
    .where(eq(platformPrincipal.principalId, principalId))
    .limit(1);
  if (!principal?.isActive) {
    throw new PlatformAccessError(403, 'platform_principal_inactive', 'Platform principal is inactive.');
  }
  const token = newToken('p_');
  const csrfToken = newToken('pc_');
  const expiresAt = new Date(now.getTime() + ttlMs);
  await db.insert(platformSession).values({
    tokenHash: hashSecret(token),
    csrfHash: hashSecret(csrfToken),
    principalId,
    expiresAt,
    lastSeenAt: now,
  });
  return { token, csrfToken, expiresAt };
}

/** Authenticate only against the independent platform-principal credential
 * store. Tenant app_user records and erp_session are deliberately absent. */
export async function authenticatePlatformPrincipal(
  db: DB,
  principalKeyInput: string,
  password: string,
): Promise<{ principalId: number; principalKey: string; displayName: string } | null> {
  const principalKey = principalKeyInput.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(principalKey) || password.length === 0) return null;
  const [principal] = await db.select({
    principalId: platformPrincipal.principalId,
    principalKey: platformPrincipal.principalKey,
    displayName: platformPrincipal.displayName,
    passwordHash: platformPrincipal.passwordHash,
    isActive: platformPrincipal.isActive,
  }).from(platformPrincipal)
    .where(eq(platformPrincipal.principalKey, principalKey))
    .limit(1);
  if (!principal?.isActive || !principal.passwordHash || !verifyPassword(password, principal.passwordHash)) {
    return null;
  }
  return {
    principalId: principal.principalId,
    principalKey: principal.principalKey,
    displayName: principal.displayName,
  };
}

export async function getPlatformSession(
  db: DB,
  token: string | undefined,
  options: { touch?: boolean; now?: Date } = {},
): Promise<PlatformSessionData | null> {
  if (!token) return null;
  const now = options.now ?? new Date();
  const [row] = await db.select({
    principalId: platformPrincipal.principalId,
    principalKey: platformPrincipal.principalKey,
    displayName: platformPrincipal.displayName,
    expiresAt: platformSession.expiresAt,
  }).from(platformSession)
    .innerJoin(platformPrincipal, eq(platformPrincipal.principalId, platformSession.principalId))
    .where(and(
      eq(platformSession.tokenHash, hashSecret(token)),
      eq(platformPrincipal.isActive, true),
      isNull(platformSession.revokedAt),
      gt(platformSession.expiresAt, now),
    ))
    .limit(1);
  if (!row) return null;
  if (options.touch !== false) {
    await db.update(platformSession).set({ lastSeenAt: now, updatedAt: now })
      .where(eq(platformSession.tokenHash, hashSecret(token)));
  }
  return {
    principalId: row.principalId,
    principalKey: row.principalKey,
    displayName: row.displayName,
    permissions: await platformPrincipalPermissions(db, row.principalId),
    expiresAt: row.expiresAt,
  };
}

export async function verifyPlatformCsrfToken(
  db: DB,
  token: string | undefined,
  csrfToken: string | undefined,
  now = new Date(),
): Promise<boolean> {
  if (!token || !csrfToken) return false;
  const [row] = await db.select({ csrfHash: platformSession.csrfHash })
    .from(platformSession)
    .where(and(
      eq(platformSession.tokenHash, hashSecret(token)),
      isNull(platformSession.revokedAt),
      gt(platformSession.expiresAt, now),
    ))
    .limit(1);
  return Boolean(row && secretsMatch(row.csrfHash, csrfToken));
}

export async function revokePlatformSession(db: DB, token: string, now = new Date()): Promise<void> {
  await db.update(platformSession).set({ revokedAt: now, updatedAt: now })
    .where(and(eq(platformSession.tokenHash, hashSecret(token)), isNull(platformSession.revokedAt)));
}

export function requirePlatformPermission(session: PlatformSessionData, permission: PlatformPermission): void {
  if (!session.permissions.includes(permission)) {
    throw new PlatformAccessError(403, 'platform_permission_denied', 'Platform permission is required.');
  }
}

async function targetCompanyExists(exec: DB, masterFn: string, companyFn: string | null): Promise<void> {
  const [targetMaster] = await exec.select({ masterFn: master.masterFn })
    .from(master)
    .where(eq(master.masterFn, masterFn))
    .limit(1);
  if (!targetMaster) throw new PlatformAccessError(404, 'support_target_not_found', 'Support target was not found.');
  if (companyFn) {
    const [targetCompany] = await exec.select({ companyFn: company.companyFn })
      .from(company)
      .where(and(eq(company.companyFn, companyFn), eq(company.masterFn, masterFn)))
      .limit(1);
    if (!targetCompany) throw new PlatformAccessError(404, 'support_target_not_found', 'Support target was not found.');
  }
}

export async function createSupportAccessGrant(
  db: DB,
  session: PlatformSessionData,
  input: CreateSupportAccessGrantInput,
  requestId: string,
  now = new Date(),
): Promise<{ id: number; platformPrincipalId: number; masterFn: string; companyFn: string | null; mode: SupportAccessMode; validFrom: Date; validUntil: Date }> {
  requirePlatformPermission(session, PLATFORM_PERMISSIONS.supportGrant);
  const validFrom = asDate(input.validFrom, 'validFrom');
  const validUntil = asDate(input.validUntil, 'validUntil');
  if (validUntil <= validFrom || validUntil.getTime() - validFrom.getTime() > MAX_SUPPORT_GRANT_DURATION_MS) {
    throw new PlatformAccessError(400, 'invalid_support_grant_window', 'Support grants must have a positive window no longer than 24 hours.');
  }
  const reason = input.reason.trim();
  const ticketReference = input.ticketReference.trim();
  if (reason.length === 0 || reason.length > 500 || ticketReference.length === 0 || ticketReference.length > 128) {
    throw new PlatformAccessError(400, 'invalid_support_grant_reason', 'A reason and ticket reference are required.');
  }
  const companyFn = input.companyFn?.trim() || null;
  const restrictions = normalizeRestrictions(input.mode, input.restrictions);
  const targetPrincipalId = input.grantedPrincipalId ?? session.principalId;
  return db.transaction(async (tx) => {
    const exec = tx as unknown as DB;
    await targetCompanyExists(exec, input.masterFn, companyFn);
    const targetPermissions = await platformPrincipalPermissions(exec, targetPrincipalId);
    if (!targetPermissions.includes(PLATFORM_PERMISSIONS.supportUse)) {
      throw new PlatformAccessError(400, 'support_principal_not_eligible', 'The target platform principal cannot use support access.');
    }
    const [targetPrincipal] = await exec.select({ isActive: platformPrincipal.isActive })
      .from(platformPrincipal)
      .where(eq(platformPrincipal.principalId, targetPrincipalId))
      .limit(1);
    if (!targetPrincipal?.isActive) {
      throw new PlatformAccessError(404, 'support_principal_not_found', 'The target platform principal was not found.');
    }
    const [grant] = await exec.insert(supportAccessGrant).values({
      platformPrincipalId: targetPrincipalId,
      createdByPrincipalId: session.principalId,
      masterFn: input.masterFn,
      companyFn,
      reason,
      ticketReference,
      mode: input.mode,
      validFrom,
      validUntil,
      sensitiveRestrictions: restrictions,
      createdAt: now,
      updatedAt: now,
    }).returning({
      id: supportAccessGrant.id,
      platformPrincipalId: supportAccessGrant.platformPrincipalId,
      masterFn: supportAccessGrant.masterFn,
      companyFn: supportAccessGrant.companyFn,
      mode: supportAccessGrant.mode,
      validFrom: supportAccessGrant.validFrom,
      validUntil: supportAccessGrant.validUntil,
    });
    if (companyFn) {
      await bumpAuthorizationVersionWithin(exec, { masterFn: input.masterFn, companyFn }, now);
    } else {
      await bumpMasterAuthorizationVersionsWithin(exec, input.masterFn, now);
    }
    await appendAudit(exec, {
      masterFn: input.masterFn,
      companyFn,
      platformPrincipalId: session.principalId,
      requestId,
      entity: 'platform/support-grants',
      entityId: grant.id,
      action: 'support_grant_created',
      after: {
        platformPrincipalId: targetPrincipalId,
        mode: input.mode,
        validFrom,
        validUntil,
        ticketReference,
        reason,
        sensitiveRestrictions: restrictions,
      },
      occurredAt: now,
    });
    return grant as {
      id: number; platformPrincipalId: number; masterFn: string; companyFn: string | null;
      mode: SupportAccessMode; validFrom: Date; validUntil: Date;
    };
  });
}

export async function revokeSupportAccessGrant(
  db: DB,
  session: PlatformSessionData,
  grantId: number,
  reason: string,
  requestId: string,
  now = new Date(),
): Promise<void> {
  requirePlatformPermission(session, PLATFORM_PERMISSIONS.supportRevoke);
  const revocationReason = reason.trim();
  if (revocationReason.length === 0 || revocationReason.length > 500) {
    throw new PlatformAccessError(400, 'invalid_revocation_reason', 'A revocation reason is required.');
  }
  await db.transaction(async (tx) => {
    const exec = tx as unknown as DB;
    const [grant] = await exec.select({
      id: supportAccessGrant.id,
      masterFn: supportAccessGrant.masterFn,
      companyFn: supportAccessGrant.companyFn,
      revokedAt: supportAccessGrant.revokedAt,
    }).from(supportAccessGrant)
      .where(eq(supportAccessGrant.id, grantId))
      .limit(1);
    if (!grant) throw new PlatformAccessError(404, 'support_grant_not_found', 'Support grant was not found.');
    if (grant.revokedAt) throw new PlatformAccessError(409, 'support_grant_already_revoked', 'Support grant is already revoked.');
    const revoked = await exec.update(supportAccessGrant).set({
      revokedAt: now,
      revokedByPrincipalId: session.principalId,
      revocationReason,
      updatedAt: now,
    }).where(and(eq(supportAccessGrant.id, grantId), isNull(supportAccessGrant.revokedAt)))
      .returning({ id: supportAccessGrant.id });
    if (!revoked.length) {
      throw new PlatformAccessError(409, 'support_grant_already_revoked', 'Support grant is already revoked.');
    }
    if (grant.companyFn) {
      await bumpAuthorizationVersionWithin(exec, {
        masterFn: grant.masterFn,
        companyFn: grant.companyFn,
      }, now);
    } else {
      await bumpMasterAuthorizationVersionsWithin(exec, grant.masterFn, now);
    }
    await appendAudit(exec, {
      masterFn: grant.masterFn,
      companyFn: grant.companyFn,
      platformPrincipalId: session.principalId,
      requestId,
      entity: 'platform/support-grants',
      entityId: grantId,
      action: 'support_grant_revoked',
      after: { revocationReason, revokedAt: now },
    });
  });
}

function denyDecision(
  masterFn: string,
  companyFn: string,
  reasonCode: SupportAccessDecision['reasonCode'],
): SupportAccessDecision {
  return { allowed: false, masterFn, companyFn, reasonCode };
}

export async function evaluateSupportAccess(
  db: DB,
  session: PlatformSessionData,
  input: {
    grantId: number;
    masterFn: string;
    companyFn: string;
    operation: string;
    sensitiveField?: string;
  },
  requestId: string,
  now = new Date(),
): Promise<SupportAccessDecision> {
  requirePlatformPermission(session, PLATFORM_PERMISSIONS.supportUse);
  const decision = await db.transaction(async (tx) => {
    const exec = tx as unknown as DB;
    const [grant] = await exec.select({
      id: supportAccessGrant.id,
      platformPrincipalId: supportAccessGrant.platformPrincipalId,
      masterFn: supportAccessGrant.masterFn,
      companyFn: supportAccessGrant.companyFn,
      mode: supportAccessGrant.mode,
      validFrom: supportAccessGrant.validFrom,
      validUntil: supportAccessGrant.validUntil,
      revokedAt: supportAccessGrant.revokedAt,
      sensitiveRestrictions: supportAccessGrant.sensitiveRestrictions,
    }).from(supportAccessGrant)
      .where(eq(supportAccessGrant.id, input.grantId))
      .limit(1);
    let result: SupportAccessDecision;
    const [targetCompany] = await exec.select({ companyFn: company.companyFn })
      .from(company)
      .where(and(eq(company.companyFn, input.companyFn), eq(company.masterFn, input.masterFn)))
      .limit(1);
    if (!targetCompany || !grant || grant.platformPrincipalId !== session.principalId) {
      result = denyDecision(input.masterFn, input.companyFn, 'SUPPORT_ACCESS_DENIED');
    } else if (grant.masterFn !== input.masterFn || (grant.companyFn != null && grant.companyFn !== input.companyFn)) {
      result = denyDecision(input.masterFn, input.companyFn, 'SUPPORT_ACCESS_DENIED');
    } else if (grant.revokedAt) {
      result = denyDecision(input.masterFn, input.companyFn, 'SUPPORT_ACCESS_REVOKED');
    } else if (now < grant.validFrom || now >= grant.validUntil) {
      result = denyDecision(input.masterFn, input.companyFn, 'SUPPORT_ACCESS_EXPIRED');
    } else {
      const rawRestrictions = grant.sensitiveRestrictions as Partial<NormalizedSupportAccessRestrictions> | null;
      const blockedSensitiveFields = Array.isArray(rawRestrictions?.blockedSensitiveFields)
        && rawRestrictions.blockedSensitiveFields.every((field) => typeof field === 'string')
        ? rawRestrictions.blockedSensitiveFields
        : [...DEFAULT_SENSITIVE_FIELDS];
      const allowedOperations = Array.isArray(rawRestrictions?.allowedOperations)
        && rawRestrictions.allowedOperations.every((operation) => typeof operation === 'string')
        ? rawRestrictions.allowedOperations
        : [];
      if (input.sensitiveField && blockedSensitiveFields.includes(input.sensitiveField)) {
        result = denyDecision(input.masterFn, input.companyFn, 'SUPPORT_ACCESS_SENSITIVE_FIELD_DENIED');
      } else if (grant.mode === 'read_only' && input.operation !== 'read') {
        result = denyDecision(input.masterFn, input.companyFn, 'SUPPORT_ACCESS_OPERATION_DENIED');
      } else if (
        grant.mode === 'restricted_write'
        && input.operation !== 'read'
        && !allowedOperations.includes(input.operation)
      ) {
        result = denyDecision(input.masterFn, input.companyFn, 'SUPPORT_ACCESS_OPERATION_DENIED');
      } else if (
        grant.mode === 'break_glass'
        && typeof rawRestrictions?.breakGlassApprovalReference !== 'string'
      ) {
        result = denyDecision(input.masterFn, input.companyFn, 'SUPPORT_ACCESS_OPERATION_DENIED');
      } else if (
        grant.mode !== 'read_only'
        && grant.mode !== 'restricted_write'
        && grant.mode !== 'break_glass'
      ) {
        result = denyDecision(input.masterFn, input.companyFn, 'SUPPORT_ACCESS_OPERATION_DENIED');
      } else {
        result = {
          allowed: true,
          grantId: grant.id,
          mode: grant.mode as SupportAccessMode,
          masterFn: input.masterFn,
          companyFn: input.companyFn,
          reasonCode: 'ALLOWED',
        };
      }
    }
    await appendAudit(exec, {
      masterFn: input.masterFn,
      companyFn: input.companyFn,
      platformPrincipalId: session.principalId,
      requestId,
      entity: 'platform/support-access',
      entityId: input.grantId,
      action: result.allowed ? 'support_access_allowed' : 'support_access_denied',
      after: {
        reasonCode: result.reasonCode,
        operation: input.operation,
        sensitiveField: input.sensitiveField ?? null,
      },
    });
    return result;
  });
  return decision;
}

export async function listSupportAccessGrants(
  db: DB,
  session: PlatformSessionData,
  options: { masterFn?: string; companyFn?: string | null } = {},
) {
  requirePlatformPermission(session, PLATFORM_PERMISSIONS.supportRead);
  const rows = await db.select({
    id: supportAccessGrant.id,
    platformPrincipalId: supportAccessGrant.platformPrincipalId,
    createdByPrincipalId: supportAccessGrant.createdByPrincipalId,
    masterFn: supportAccessGrant.masterFn,
    companyFn: supportAccessGrant.companyFn,
    reason: supportAccessGrant.reason,
    ticketReference: supportAccessGrant.ticketReference,
    mode: supportAccessGrant.mode,
    validFrom: supportAccessGrant.validFrom,
    validUntil: supportAccessGrant.validUntil,
    sensitiveRestrictions: supportAccessGrant.sensitiveRestrictions,
    revokedAt: supportAccessGrant.revokedAt,
    revokedByPrincipalId: supportAccessGrant.revokedByPrincipalId,
    revocationReason: supportAccessGrant.revocationReason,
  }).from(supportAccessGrant)
    .where(and(
      eq(supportAccessGrant.platformPrincipalId, session.principalId),
      options.masterFn ? eq(supportAccessGrant.masterFn, options.masterFn) : undefined,
      options.companyFn === undefined
        ? undefined
        : options.companyFn === null
          ? isNull(supportAccessGrant.companyFn)
          : eq(supportAccessGrant.companyFn, options.companyFn),
    ));
  return rows;
}
