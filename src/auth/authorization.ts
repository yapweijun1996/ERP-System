import {
  and, asc, desc, eq, gt, inArray, isNull, lte, or,
} from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appUser,
  company,
  role,
  rolePermission,
  roleResourceScope,
  userCompany,
  userCompanyRole,
  userCompanyRoleScope,
  userPermissionOverride,
} from '../data/schema';
import type { DataScope } from './accessCatalog';
import { permissionCandidates, permissionDefinition } from './permissionRegistry';
import { activeRoleAssignmentCondition } from './roleAssignmentState';
import type { SessionData } from './session';

/** Public, non-enumerating reason codes returned by the decision engine. */
export const AUTHORIZATION_REASON_CODES = [
  'ALLOW_EXPLICIT_OVERRIDE',
  'ALLOW_ROLE_PERMISSION',
  'DENY_INVALID_PRINCIPAL',
  'DENY_TENANT_MISMATCH',
  'DENY_PLATFORM_PERMISSION',
  'DENY_PERMISSION_NOT_REGISTERED',
  'DENY_EXPLICIT',
  'DENY_SCOPE_UNRESOLVED',
  'DENY_SCOPE_UNAVAILABLE',
  'DENY_CONTEXT_MISMATCH',
  'DENY_PERMISSION_NOT_GRANTED',
] as const;

export type AuthorizationReasonCode = typeof AUTHORIZATION_REASON_CODES[number];
export type AuthorizationEffect = 'allow' | 'deny' | 'role' | 'none';

export interface AuthorizationPrincipal {
  userId: number;
  masterFn: string;
  companyFn: string;
}

export interface AuthorizationScopeTarget {
  scope: DataScope;
  targetType: string;
  targetId: string | null;
}

/** Optional business context carried by sensitive domain decisions. The
 * evaluator does not infer this context from a user-controlled permission
 * string; callers provide the already-resolved module/resource/workflow
 * identity and the evaluator rejects mismatched module context. */
export interface AuthorizationContext {
  moduleKey?: string | null;
  policyVersionId?: number | null;
  approvalInstanceId?: number | null;
  approvalStepId?: number | null;
}

export interface AuthorizationRequest {
  principal: AuthorizationPrincipal;
  permissionKey: string;
  /** Optional canonical route/resource path, for resource-specific overrides. */
  resourceKey?: string | null;
  /** Optional record scope context. Omit only for a permission-level preflight. */
  scopeTarget?: AuthorizationScopeTarget | null;
  /** Require an active role-assignment scope for the requested resource. */
  requireScope?: boolean;
  /** Server-resolved business context for sensitive decisions. */
  context?: AuthorizationContext | null;
  now?: Date;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reasonCode: AuthorizationReasonCode;
}

/** Full details are deliberately a separate type and must only be exposed by a
 * privileged, audited diagnostic endpoint. */
export interface AuthorizationExplanation extends AuthorizationDecision {
  permissionKey: string;
  resourceKey: string | null;
  context: AuthorizationContext | null;
  candidateKeys: string[];
  matchedEffect: AuthorizationEffect;
  matchedAssignmentId: number | null;
  matchedRoleId: number | null;
  matchedOverrideId: number | null;
  matchedScope: DataScope | null;
  matchedTargetType: string | null;
  matchedTargetId: string | null;
  conflictingOverride: boolean;
}

interface AssignmentPermissionRow {
  assignmentId: number;
  roleId: number;
  roleName: string;
  permissionKey: string;
  scopeBackfilledAt: Date | null;
}

interface ScopeGrantRow {
  resourceKey: string;
  scope: DataScope;
  targetType: string;
  targetId: string | null;
}

const SCOPE_RANK: Record<DataScope, number> = {
  self: 0,
  team: 1,
  department: 2,
  company: 3,
};

function principalIsValid(principal: AuthorizationPrincipal): boolean {
  return Number.isSafeInteger(principal.userId)
    && principal.userId > 0
    && Boolean(principal.masterFn?.trim())
    && Boolean(principal.companyFn?.trim());
}

function resourcePatternMatches(pattern: string | null, resourceKey: string | null | undefined): boolean {
  if (!pattern) return true;
  if (!resourceKey) return false;
  return pattern === '*'
    || pattern === resourceKey
    || (pattern.endsWith('/*') && resourceKey.startsWith(`${pattern.slice(0, -1)}`));
}

function scopeTargetMatches(
  grant: { scope: DataScope; targetType: string; targetId: string | null },
  requested: AuthorizationScopeTarget | null | undefined,
): boolean {
  if (!requested) return grant.scope === 'company' && grant.targetType === 'none';
  if (SCOPE_RANK[grant.scope] < SCOPE_RANK[requested.scope]) return false;
  if (grant.scope === 'company' && grant.targetType === 'none') return true;
  if (grant.targetType === 'none') return requested.targetType === 'none';
  return grant.targetType === requested.targetType
    && grant.targetId === requested.targetId;
}

function overrideMatches(
  row: typeof userPermissionOverride.$inferSelect,
  request: AuthorizationRequest,
): boolean {
  if (!resourcePatternMatches(row.resourceKey, request.resourceKey)) return false;
  // A broad company/none override is applicable to every record in the active
  // company. A narrower deny without record context fails closed rather than
  // silently widening access; a narrower allow cannot widen a missing context.
  const requestedScope = request.scopeTarget ?? (
    row.targetType === 'company'
      ? { scope: 'company' as const, targetType: 'company', targetId: request.principal.companyFn }
      : undefined
  );
  return scopeTargetMatches({
    scope: row.scope as DataScope,
    targetType: row.targetType,
    targetId: row.targetId || null,
  }, requestedScope)
    || (!request.scopeTarget && row.effect === 'deny');
}

function publicDecision(evaluation: AuthorizationExplanation): AuthorizationDecision {
  return {
    allowed: evaluation.allowed,
    reasonCode: evaluation.reasonCode,
  };
}

function principalFromSession(session: SessionData): AuthorizationPrincipal {
  return {
    userId: session.userId,
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  };
}

export { principalFromSession };

async function activeMembership(
  db: DB,
  principal: AuthorizationPrincipal,
): Promise<'valid' | 'missing' | 'tenant_mismatch'> {
  const [row] = await db.select({
    userMasterFn: appUser.masterFn,
    userActive: appUser.isActive,
    companyMasterFn: company.masterFn,
  }).from(userCompany)
    .innerJoin(appUser, eq(appUser.userId, userCompany.userId))
    .innerJoin(company, eq(company.companyFn, userCompany.companyFn))
    .where(and(
      eq(userCompany.userId, principal.userId),
      eq(userCompany.companyFn, principal.companyFn),
    ))
    .limit(1);
  if (!row) return 'missing';
  if (
    row.userMasterFn !== principal.masterFn
    || row.companyMasterFn !== principal.masterFn
    || row.userActive !== true
  ) return 'tenant_mismatch';
  return 'valid';
}

async function assignmentScopeRows(
  db: DB,
  principal: AuthorizationPrincipal,
  assignment: AssignmentPermissionRow,
): Promise<ScopeGrantRow[]> {
  const rows = await db.select({
    resourceKey: userCompanyRoleScope.resourceKey,
    scope: userCompanyRoleScope.scope,
    targetType: userCompanyRoleScope.targetType,
    targetId: userCompanyRoleScope.targetId,
  }).from(userCompanyRoleScope).where(and(
    eq(userCompanyRoleScope.assignmentId, assignment.assignmentId),
    eq(userCompanyRoleScope.masterFn, principal.masterFn),
    eq(userCompanyRoleScope.companyFn, principal.companyFn),
  ));
  const child = rows.map((row) => ({
    resourceKey: row.resourceKey,
    scope: row.scope as DataScope,
    targetType: row.targetType,
    targetId: row.targetId || null,
  }));
  if (assignment.scopeBackfilledAt != null) return child;
  const legacy = await db.select({
    resourceKey: roleResourceScope.resourceKey,
    scope: roleResourceScope.scope,
  }).from(roleResourceScope).where(and(
    eq(roleResourceScope.masterFn, principal.masterFn),
    eq(roleResourceScope.companyFn, principal.companyFn),
    eq(roleResourceScope.roleId, assignment.roleId),
  ));
  return [
    ...child,
    ...legacy.map((row) => ({
      resourceKey: row.resourceKey,
      scope: row.scope as DataScope,
      targetType: 'none',
      targetId: null,
    })),
  ];
}

async function evaluateAuthorization(
  db: DB,
  request: AuthorizationRequest,
): Promise<AuthorizationExplanation> {
  const permissionKey = request.permissionKey.trim();
  const resourceKey = request.resourceKey?.trim() || null;
  const context = request.context ?? null;
  const now = request.now ?? new Date();
  const empty = (reasonCode: AuthorizationReasonCode): AuthorizationExplanation => ({
    allowed: false,
    reasonCode,
    permissionKey,
    resourceKey,
    context,
    candidateKeys: [],
    matchedEffect: 'none',
    matchedAssignmentId: null,
    matchedRoleId: null,
    matchedOverrideId: null,
    matchedScope: null,
    matchedTargetType: null,
    matchedTargetId: null,
    conflictingOverride: false,
  });

  if (!principalIsValid(request.principal)) return empty('DENY_INVALID_PRINCIPAL');
  const membership = await activeMembership(db, request.principal);
  if (membership === 'missing') return empty('DENY_INVALID_PRINCIPAL');
  if (membership !== 'valid') return empty('DENY_TENANT_MISMATCH');

  if (permissionDefinition(permissionKey)?.domain === 'platform') {
    return empty('DENY_PLATFORM_PERMISSION');
  }
  const definition = permissionDefinition(permissionKey);
  if (context?.moduleKey && (!definition || definition.module !== context.moduleKey)) {
    return empty('DENY_CONTEXT_MISMATCH');
  }
  const candidates = [...permissionCandidates(permissionKey)];
  if (!candidates.length) return empty('DENY_PERMISSION_NOT_REGISTERED');

  const overrides = await db.select().from(userPermissionOverride).where(and(
    eq(userPermissionOverride.masterFn, request.principal.masterFn),
    eq(userPermissionOverride.companyFn, request.principal.companyFn),
    eq(userPermissionOverride.userId, request.principal.userId),
    inArray(userPermissionOverride.permissionKey, candidates),
    lte(userPermissionOverride.validFrom, now),
    or(isNull(userPermissionOverride.validUntil), gt(userPermissionOverride.validUntil, now)),
    isNull(userPermissionOverride.revokedAt),
  )).orderBy(desc(userPermissionOverride.id));
  const matchingOverrides = overrides.filter((row) => overrideMatches(row, {
    ...request,
    permissionKey,
    resourceKey,
    now,
  }));
  const denies = matchingOverrides.filter((row) => row.effect === 'deny');
  const allows = matchingOverrides.filter((row) => row.effect === 'allow');
  const candidateKeys = candidates;
  const overrideDetails = (row: typeof userPermissionOverride.$inferSelect) => ({
    permissionKey,
    resourceKey,
    context,
    candidateKeys,
    matchedEffect: row.effect as AuthorizationEffect,
    matchedAssignmentId: null,
    matchedRoleId: null,
    matchedOverrideId: row.id,
    matchedScope: row.scope as DataScope,
    matchedTargetType: row.targetType,
    matchedTargetId: row.targetId || null,
    conflictingOverride: denies.length > 0 && allows.length > 0,
  });
  if (denies.length) {
    return {
      allowed: false,
      reasonCode: 'DENY_EXPLICIT',
      ...overrideDetails(denies[0]),
    };
  }
  if (allows.length) {
    return {
      allowed: true,
      reasonCode: 'ALLOW_EXPLICIT_OVERRIDE',
      ...overrideDetails(allows[0]),
    };
  }

  const assignments = await db.select({
    assignmentId: userCompanyRole.assignmentId,
    roleId: role.roleId,
    roleName: role.name,
    permissionKey: rolePermission.permissionKey,
    scopeBackfilledAt: userCompanyRole.scopeBackfilledAt,
  }).from(userCompanyRole)
    .innerJoin(role, and(
      eq(role.roleId, userCompanyRole.roleId),
      eq(role.masterFn, request.principal.masterFn),
      or(eq(role.companyFn, request.principal.companyFn), isNull(role.companyFn)),
    ))
    .innerJoin(rolePermission, and(
      eq(rolePermission.roleId, userCompanyRole.roleId),
      eq(rolePermission.masterFn, request.principal.masterFn),
      inArray(rolePermission.permissionKey, candidates),
      eq(rolePermission.allowed, true),
    ))
    .where(and(
      eq(userCompanyRole.userId, request.principal.userId),
      eq(userCompanyRole.companyFn, request.principal.companyFn),
      activeRoleAssignmentCondition(now),
    ))
    .orderBy(asc(userCompanyRole.assignmentId));

  let hasAssignmentScope = false;
  for (const assignment of assignments) {
    if (!request.requireScope) {
      return {
        allowed: true,
        reasonCode: 'ALLOW_ROLE_PERMISSION',
        permissionKey,
        resourceKey,
        context,
        candidateKeys,
        matchedEffect: 'role',
        matchedAssignmentId: assignment.assignmentId,
        matchedRoleId: assignment.roleId,
        matchedOverrideId: null,
        matchedScope: null,
        matchedTargetType: null,
        matchedTargetId: null,
        conflictingOverride: false,
      };
    }
    if (!resourceKey) continue;
    const scopes = await assignmentScopeRows(db, request.principal, assignment);
    hasAssignmentScope ||= scopes.length > 0;
    const matchingScope = scopes.find((scope) =>
      resourcePatternMatches(scope.resourceKey, resourceKey)
      && scopeTargetMatches(scope, request.scopeTarget));
    if (matchingScope) {
      return {
        allowed: true,
        reasonCode: 'ALLOW_ROLE_PERMISSION',
        permissionKey,
        resourceKey,
        context,
        candidateKeys,
        matchedEffect: 'role',
        matchedAssignmentId: assignment.assignmentId,
        matchedRoleId: assignment.roleId,
        matchedOverrideId: null,
        matchedScope: matchingScope.scope,
        matchedTargetType: matchingScope.targetType,
        matchedTargetId: matchingScope.targetId,
        conflictingOverride: false,
      };
    }
  }

  const reasonCode = request.requireScope && resourceKey
    ? !request.scopeTarget && hasAssignmentScope
      ? 'DENY_SCOPE_UNRESOLVED'
      : assignments.length ? 'DENY_SCOPE_UNAVAILABLE' : 'DENY_PERMISSION_NOT_GRANTED'
    : 'DENY_PERMISSION_NOT_GRANTED';
  return {
    ...empty(reasonCode),
    candidateKeys,
  };
}

/** The single tenant decision entry point used by API and domain code. */
export async function authorize(
  db: DB,
  request: AuthorizationRequest,
): Promise<AuthorizationDecision> {
  return publicDecision(await evaluateAuthorization(db, request));
}

/** Same decision contract for domain code that has a transaction scope but no
 * SessionData object (approval workflow, workers and command handlers). */
export async function authorizeWithin(
  db: DB,
  principal: AuthorizationPrincipal,
  permissionKey: string,
  options: Omit<AuthorizationRequest, 'principal' | 'permissionKey'> = {},
): Promise<AuthorizationDecision> {
  return authorize(db, { ...options, principal, permissionKey });
}

export async function hasAnyAuthorization(
  db: DB,
  session: SessionData,
  permissionKeys: readonly string[],
  options: Omit<AuthorizationRequest, 'principal' | 'permissionKey'> = {},
): Promise<boolean> {
  const principal = principalFromSession(session);
  for (const permissionKey of permissionKeys) {
    if ((await authorize(db, { ...options, principal, permissionKey })).allowed) return true;
  }
  return false;
}

/** Only privileged, audited admin code should call this function. */
export async function explainAuthorization(
  db: DB,
  request: AuthorizationRequest,
): Promise<AuthorizationExplanation> {
  return evaluateAuthorization(db, request);
}
