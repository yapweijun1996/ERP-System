import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  AGENT_GRANT_SCOPES,
  AGENT_GRANT_TARGET_TYPES,
  AGENT_PRINCIPAL_KINDS,
  AGENT_PRINCIPAL_STATUSES,
  agentCredential,
  agentGrant,
  agentPrincipal,
  appUser,
  userCompany,
  type AgentGrantScope,
  type AgentGrantTargetType,
  type AgentPrincipalKind,
} from '../../data/schema';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { appendAudit } from '../../api/audit';
import { authorizeWithin, type AuthorizationScopeTarget } from '../../auth/authorization';
import { AuthLifecycleError } from '../../auth/authErrors';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import { isAssignableTenantPermission } from '../../auth/permissionRegistry';
import { hashPassword } from '../../auth/password';
import { hashOpaqueToken, newOpaqueToken } from '../../auth/tokenCrypto';
import type { SessionData } from '../../auth/session';
import { bumpAuthorizationVersionWithin } from '../../auth/authorizationVersion';
import {
  AgentActionContractError,
  getAgentActionContract,
  type AgentActionName,
} from './actionContracts';

const SCOPE_RANK: Record<AgentGrantScope, number> = {
  self: 0,
  team: 1,
  department: 2,
  company: 3,
};

const ACTION_RESOURCE_KEYS: Readonly<Record<AgentActionName, string>> = {
  'receipt.search': 'expenses/company_receipts',
  'receipt.get': 'expenses/company_receipts',
  'receipt_pack.prepare': 'expenses/company_receipt_packs',
  'receipt_pack.create': 'expenses/company_receipt_packs',
  'receipt_pack.get': 'expenses/company_receipt_packs',
  'receipt_pack.export': 'expenses/company_receipt_packs',
};

/** Current ERP field authority for the pilot resources. Role permissions are
 * resource-level today; this catalog makes the Agent grant's field boundary
 * explicit and fails closed for fields the pilot projection cannot expose. */
const RESOURCE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'expenses/company_receipts': [
    'id', 'receiptKey', 'documentId', 'documentVersionId', 'documentVersionNo',
    'documentSha256', 'evidenceSha256', 'originalFileName', 'uploaderUserId',
    'uploaderName', 'transactionDate', 'merchant', 'receiptNumber', 'amount',
    'currency', 'category', 'businessPurpose', 'notes', 'status', 'version',
    'voidReason', 'voidedAt', 'voidedByUserId', 'createdAt', 'updatedAt',
  ],
  'expenses/company_receipt_packs': [
    'id', 'packKey', 'visibility', 'locale', 'filters', 'rows', 'totals',
    'sourceSha256', 'rowCount', 'documentCount', 'retentionUntil', 'legalHold',
    'recordVersion', 'createdByUserId', 'createdAt',
  ],
};

const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const PRINCIPAL_KEY_PATTERN = /^[a-z][a-z0-9_.:-]{2,127}$/;
const RESOURCE_KEY_PATTERN = /^[a-z][a-z0-9_/-]{1,127}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const MAX_AMOUNT = new Decimal('99999999999999.9999');

export interface CreateAgentPrincipalInput {
  principalKey: unknown;
  displayName: unknown;
  kind?: unknown;
  ownerUserId: unknown;
}

export interface CreateAgentGrantInput {
  agentPrincipalId: unknown;
  actionName: unknown;
  permissionKey: unknown;
  resourceKey: unknown;
  scope: unknown;
  targetType?: unknown;
  targetId?: unknown;
  fieldAllowlist: unknown;
  amountLimit?: unknown;
  amountCurrency?: unknown;
  validFrom?: unknown;
  validUntil?: unknown;
}

export interface ResolveAgentGrantInput {
  agentPrincipalId: unknown;
  actionName: unknown;
  permissionKey?: unknown;
  requestedScope?: {
    scope: unknown;
    targetType?: unknown;
    targetId?: unknown;
  };
  requestedFields?: unknown;
  amount?: unknown;
  currency?: unknown;
  now?: Date;
}

export interface AgentPrincipalView {
  id: number;
  masterFn: string;
  companyFn: string;
  principalKey: string;
  displayName: string;
  kind: AgentPrincipalKind;
  actorUserId: number;
  ownerUserId: number;
  status: string;
  version: number;
  disabledAt: Date | null;
  disabledReason: string | null;
  revokedAt: Date | null;
  revocationReason: string | null;
}

export interface AgentGrantView {
  id: number;
  agentPrincipalId: number;
  actionName: string;
  permissionKey: string;
  resourceKey: string;
  scope: string;
  targetType: string;
  targetId: string | null;
  fieldAllowlist: string[];
  amountLimit: string | null;
  amountCurrency: string | null;
  validFrom: Date;
  validUntil: Date | null;
  status: 'active' | 'expired' | 'revoked';
  revokedAt: Date | null;
  revocationReason: string | null;
  version: number;
  createdByUserId: number;
}

export interface AgentCredentialView {
  id: number;
  agentPrincipalId: number;
  credentialKey: string;
  tokenHint: string;
  status: 'active' | 'revoked' | 'expired';
  validFrom: Date;
  validUntil: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  revocationReason: string | null;
  version: number;
  createdByUserId: number;
}

export interface AgentPrincipalDetailView extends AgentPrincipalView {
  grants: AgentGrantView[];
  credentials: AgentCredentialView[];
}

export interface SetAgentPrincipalStatusInput {
  agentPrincipalId: unknown;
  status: unknown;
  expectedVersion: unknown;
  reason: unknown;
}

export interface RevokeAgentGrantInput {
  agentPrincipalId: unknown;
  grantId: unknown;
  expectedVersion: unknown;
  reason: unknown;
}

export interface RotateAgentCredentialInput {
  agentPrincipalId: unknown;
  expectedVersion: unknown;
  validUntil?: unknown;
}

export interface RotatedAgentCredential {
  credentialId: number;
  agentPrincipalId: number;
  credentialKey: string;
  token: string;
  tokenHint: string;
  validFrom: Date;
  validUntil: Date | null;
}

export interface ResolvedAgentGrant {
  agentPrincipalId: number;
  principalKey: string;
  kind: AgentPrincipalKind;
  actorUserId: number;
  ownerUserId: number;
  principalVersion: number;
  grantId: number;
  grantVersion: number;
  actionName: AgentActionName;
  permissionKey: string;
  resourceKey: string;
  scope: AgentGrantScope;
  targetType: AgentGrantTargetType;
  targetId: string | null;
  fields: string[];
  amountLimit: string | null;
  amountCurrency: string | null;
}

function fail(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): never {
  throw new AuthLifecycleError(status, code, message, fieldErrors);
}

function positiveId(value: unknown, field: string): number {
  const id = typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) {
    fail(400, 'agent_identity_input_invalid', `${field} must be a positive integer.`, {
      [field]: `${field} must be a positive integer.`,
    });
  }
  return id;
}

function textValue(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    fail(400, 'agent_identity_input_invalid', `${field} is invalid.`, {
      [field]: `${field} is required and must be at most ${maxLength} characters.`,
    });
  }
  return value.trim();
}

function requestIdValue(requestId: string): string {
  if (typeof requestId !== 'string' || !requestId.trim() || requestId.length > 200) {
    fail(400, 'agent_identity_input_invalid', 'requestId is required.');
  }
  return requestId.trim();
}

function principalKind(value: unknown): AgentPrincipalKind {
  const kind = value == null ? 'delegated_agent' : String(value).trim();
  if (!(AGENT_PRINCIPAL_KINDS as readonly string[]).includes(kind)) {
    fail(400, 'agent_principal_kind_invalid', 'Agent principal kind is invalid.');
  }
  return kind as AgentPrincipalKind;
}

function actionName(value: unknown): AgentActionName {
  const action = textValue(value, 'actionName', 120);
  try {
    return getAgentActionContract(action).name;
  } catch (error) {
    if (error instanceof AgentActionContractError) {
      fail(400, 'agent_action_unknown', 'The requested Agent action is not registered.');
    }
    throw error;
  }
}

function permissionKey(value: unknown, action: AgentActionName): string {
  const permission = textValue(value, 'permissionKey', 160);
  const contract = getAgentActionContract(action);
  if (!isAssignableTenantPermission(permission)
    || !contract.permissions.anyOf.includes(permission)) {
    fail(400, 'agent_permission_invalid', 'The permission is not assignable to this Agent action.');
  }
  return permission;
}

function resourceKey(value: unknown, action: AgentActionName): string {
  const resource = textValue(value, 'resourceKey', 128);
  if (!RESOURCE_KEY_PATTERN.test(resource)
    || resource !== ACTION_RESOURCE_KEYS[action]
    || !RESOURCE_FIELDS[resource]) {
    fail(400, 'agent_resource_invalid', 'The Agent resource is not registered for this action.');
  }
  return resource;
}

function normalizeFields(
  value: unknown,
  resource: string,
  required: boolean,
  field = 'fieldAllowlist',
): string[] {
  if (!Array.isArray(value)) {
    if (!required && value == null) return [];
    fail(400, 'agent_field_allowlist_invalid', `${field} must be an array.`);
  }
  const fields = value as unknown[];
  if (required && fields.length === 0) {
    fail(400, 'agent_field_allowlist_invalid', 'At least one Agent field is required.');
  }
  if (fields.length > 100 || fields.some((item) => typeof item !== 'string')) {
    fail(400, 'agent_field_allowlist_invalid', `${field} contains invalid fields.`);
  }
  const catalog = new Set(RESOURCE_FIELDS[resource]);
  const normalized = [...new Set(fields.map((item) => (item as string).trim()))].sort();
  if (normalized.some((item) => item !== '*' && (!FIELD_PATTERN.test(item) || !catalog.has(item)))) {
    fail(400, 'agent_field_not_registered', `${field} contains a field outside the resource authority.`);
  }
  return normalized;
}

function normalizedScope(
  scopeValue: unknown,
  targetTypeValue: unknown,
  targetIdValue: unknown,
  ownerUserId?: number,
): AuthorizationScopeTarget {
  const scope = typeof scopeValue === 'string' ? scopeValue.trim() : '';
  if (!(AGENT_GRANT_SCOPES as readonly string[]).includes(scope)) {
    fail(400, 'agent_scope_invalid', 'Agent grant scope is invalid.');
  }
  const targetType = targetTypeValue == null || targetTypeValue === ''
    ? scope === 'company' ? 'none' : scope === 'self' ? 'employee' : scope
    : String(targetTypeValue).trim();
  if (!(AGENT_GRANT_TARGET_TYPES as readonly string[]).includes(targetType)) {
    fail(400, 'agent_target_invalid', 'Agent grant target type is invalid.');
  }
  const targetId = targetIdValue == null ? '' : String(targetIdValue).trim();
  const expectedTargetType: Record<AgentGrantScope, AgentGrantTargetType> = {
    self: 'employee',
    team: 'team',
    department: 'department',
    company: 'none',
  };
  if (targetType !== expectedTargetType[scope as AgentGrantScope]) {
    fail(400, 'agent_target_invalid', 'Agent grant target type does not match its scope.');
  }
  if (scope === 'company' && targetId) {
    fail(400, 'agent_target_invalid', 'A company-scoped grant cannot carry a record target.');
  }
  if (scope !== 'company' && !targetId) {
    fail(400, 'agent_target_invalid', 'A non-company grant requires a target id.');
  }
  if (scope === 'self' && ownerUserId != null && targetId !== String(ownerUserId)) {
    fail(400, 'agent_target_invalid', 'A self-scoped grant must target its accountable owner.');
  }
  return {
    scope: scope as AgentGrantScope,
    targetType: targetType as AgentGrantTargetType,
    targetId: targetId || null,
  };
}

function grantCoversRequest(
  grant: AuthorizationScopeTarget,
  requested: AuthorizationScopeTarget,
): boolean {
  if (SCOPE_RANK[grant.scope] < SCOPE_RANK[requested.scope]) return false;
  if (grant.scope === 'company' && grant.targetType === 'none') return true;
  return grant.targetType === requested.targetType && grant.targetId === requested.targetId;
}

function normalizedDate(value: unknown, field: string, fallback: Date): Date {
  const date = value == null ? fallback : value instanceof Date ? value : new Date(String(value));
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    fail(400, 'agent_date_invalid', `${field} is invalid.`, { [field]: `${field} is invalid.` });
  }
  return date;
}

function normalizedAmount(value: unknown, field: string): string | null {
  if (value == null || value === '') return null;
  let amount: Decimal;
  try {
    amount = new Decimal(String(value));
  } catch {
    fail(400, 'agent_amount_invalid', `${field} is invalid.`, { [field]: `${field} is invalid.` });
  }
  if (!amount.isFinite() || amount.isNegative() || amount.decimalPlaces() > 4 || amount.gt(MAX_AMOUNT)) {
    fail(400, 'agent_amount_invalid', `${field} is invalid.`, { [field]: `${field} is invalid.` });
  }
  return amount.toFixed(4);
}

function normalizedCurrency(value: unknown, field: string): string | null {
  if (value == null || value === '') return null;
  const currency = String(value).trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(currency)) {
    fail(400, 'agent_currency_invalid', `${field} is invalid.`, { [field]: `${field} is invalid.` });
  }
  return currency;
}

async function requireManagementPermission(
  exec: DB,
  session: SessionData,
  now: Date,
): Promise<void> {
  if (!await hasPermission(exec, session, PERMISSIONS.usersManage, now)) {
    fail(403, 'agent_management_denied', 'Agent identity management permission is required.');
  }
}

async function activeHumanOwner(
  exec: DB,
  scope: { masterFn: string; companyFn: string },
  ownerUserId: number,
): Promise<{ userId: number }> {
  const [owner] = await exec.select({ userId: appUser.userId }).from(userCompany)
    .innerJoin(appUser, eq(appUser.userId, userCompany.userId))
    .where(and(
      eq(userCompany.userId, ownerUserId),
      eq(userCompany.companyFn, scope.companyFn),
      eq(appUser.masterFn, scope.masterFn),
      eq(appUser.identityKind, 'human'),
      eq(appUser.isActive, true),
      eq(appUser.loginEnabled, true),
      eq(appUser.accountState, 'active'),
    ))
    .limit(1);
  if (!owner) {
    fail(403, 'agent_owner_inactive', 'The accountable human owner is inactive or outside the Company.');
  }
  return owner;
}

async function registeredPrincipal(
  exec: DB,
  scope: { masterFn: string; companyFn: string },
  principalId: number,
): Promise<{
  principal: typeof agentPrincipal.$inferSelect;
  actor: Pick<typeof appUser.$inferSelect, 'identityKind' | 'loginEnabled' | 'isActive' | 'accountState'>;
}> {
  const [row] = await exec.select({
    principal: agentPrincipal,
    actor: {
      identityKind: appUser.identityKind,
      loginEnabled: appUser.loginEnabled,
      isActive: appUser.isActive,
      accountState: appUser.accountState,
    },
  }).from(agentPrincipal)
    .innerJoin(appUser, eq(appUser.userId, agentPrincipal.actorUserId))
    .where(and(
      eq(agentPrincipal.id, principalId),
      eq(agentPrincipal.masterFn, scope.masterFn),
      eq(agentPrincipal.companyFn, scope.companyFn),
    ))
    .limit(1);
  if (!row) fail(403, 'agent_principal_not_found', 'Agent principal is not available.');
  const expectedIdentityKind = row.principal.kind === 'service_automation'
    ? 'service_automation'
    : 'agent';
  if (
    row.actor.identityKind !== expectedIdentityKind
    || row.actor.loginEnabled
    || !row.actor.isActive
    || row.actor.accountState !== 'active'
  ) {
    fail(403, 'agent_actor_invalid', 'Agent actor identity is inactive or invalid.');
  }
  if (row.principal.status !== 'active' || row.principal.revokedAt != null) {
    fail(403, 'agent_principal_inactive', 'Agent principal is paused, revoked or disabled.');
  }
  return row;
}

function viewPrincipal(row: typeof agentPrincipal.$inferSelect): AgentPrincipalView {
  return {
    id: row.id,
    masterFn: row.masterFn,
    companyFn: row.companyFn,
    principalKey: row.principalKey,
    displayName: row.displayName,
    kind: row.kind as AgentPrincipalKind,
    actorUserId: row.actorUserId,
    ownerUserId: row.ownerUserId,
    status: row.status,
    version: row.version,
    disabledAt: row.disabledAt,
    disabledReason: row.disabledReason,
    revokedAt: row.revokedAt,
    revocationReason: row.revocationReason,
  };
}

function expectedVersion(value: unknown): number {
  const version = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(version) || version <= 0) {
    fail(400, 'agent_version_invalid', 'expectedVersion must be a positive integer.');
  }
  return version;
}

function lifecycleReason(value: unknown, field = 'reason'): string {
  return textValue(value, field, 500);
}

async function managedPrincipal(
  exec: DB,
  scope: { masterFn: string; companyFn: string },
  principalId: number,
): Promise<typeof agentPrincipal.$inferSelect> {
  const [principal] = await exec.select().from(agentPrincipal).where(and(
    eq(agentPrincipal.id, principalId),
    eq(agentPrincipal.masterFn, scope.masterFn),
    eq(agentPrincipal.companyFn, scope.companyFn),
  )).limit(1);
  if (!principal) fail(404, 'agent_principal_not_found', 'Agent principal is not available.');
  return principal;
}

function grantStatus(row: typeof agentGrant.$inferSelect, now: Date): AgentGrantView['status'] {
  if (row.revokedAt != null) return 'revoked';
  if (row.validUntil != null && row.validUntil <= now) return 'expired';
  return 'active';
}

function credentialStatus(
  row: typeof agentCredential.$inferSelect,
  now: Date,
): AgentCredentialView['status'] {
  if (row.revokedAt != null || row.status === 'revoked') return 'revoked';
  if (row.validUntil != null && row.validUntil <= now) return 'expired';
  return 'active';
}

function viewGrant(row: typeof agentGrant.$inferSelect, now: Date): AgentGrantView {
  return {
    id: row.id,
    agentPrincipalId: row.agentPrincipalId,
    actionName: row.actionName,
    permissionKey: row.permissionKey,
    resourceKey: row.resourceKey,
    scope: row.scope,
    targetType: row.targetType,
    targetId: row.targetId || null,
    fieldAllowlist: row.fieldAllowlist,
    amountLimit: row.amountLimit,
    amountCurrency: row.amountCurrency,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    status: grantStatus(row, now),
    revokedAt: row.revokedAt,
    revocationReason: row.revocationReason,
    version: row.version,
    createdByUserId: row.createdByUserId,
  };
}

function viewCredential(
  row: typeof agentCredential.$inferSelect,
  now: Date,
): AgentCredentialView {
  return {
    id: row.id,
    agentPrincipalId: row.agentPrincipalId,
    credentialKey: row.credentialKey,
    tokenHint: row.tokenHint,
    status: credentialStatus(row, now),
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    revocationReason: row.revocationReason,
    version: row.version,
    createdByUserId: row.createdByUserId,
  };
}

export async function listAgentPrincipalsWithin(
  exec: DB,
  session: SessionData,
  now = new Date(),
): Promise<AgentPrincipalDetailView[]> {
  const canRead = await hasPermission(exec, session, PERMISSIONS.usersRead, now);
  const canManage = await hasPermission(exec, session, PERMISSIONS.usersManage, now);
  if (!canRead && !canManage) {
    fail(403, 'agent_management_denied', 'Agent identity review permission is required.');
  }
  const principals = await exec.select().from(agentPrincipal).where(and(
    eq(agentPrincipal.masterFn, session.masterFn),
    eq(agentPrincipal.companyFn, session.activeCompanyFn),
  )).orderBy(agentPrincipal.id);
  if (!principals.length) return [];
  const principalIds = principals.map((principal) => principal.id);
  const grants = await exec.select().from(agentGrant).where(and(
    eq(agentGrant.masterFn, session.masterFn),
    eq(agentGrant.companyFn, session.activeCompanyFn),
  )).orderBy(agentGrant.id);
  const credentials = await exec.select().from(agentCredential).where(and(
    eq(agentCredential.masterFn, session.masterFn),
    eq(agentCredential.companyFn, session.activeCompanyFn),
  )).orderBy(agentCredential.id);
  return principals.map((principal) => ({
    ...viewPrincipal(principal),
    grants: grants
      .filter((grant) => principalIds.includes(grant.agentPrincipalId)
        && grant.agentPrincipalId === principal.id)
      .map((grant) => viewGrant(grant, now)),
    credentials: credentials
      .filter((credential) => principalIds.includes(credential.agentPrincipalId)
        && credential.agentPrincipalId === principal.id)
      .map((credential) => viewCredential(credential, now)),
  }));
}

export function listAgentPrincipals(
  db: DB,
  session: SessionData,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => listAgentPrincipalsWithin(tx, session));
}

export async function setAgentPrincipalStatusWithin(
  exec: DB,
  session: SessionData,
  input: SetAgentPrincipalStatusInput,
  requestId: string,
  now = new Date(),
): Promise<AgentPrincipalView> {
  await requireManagementPermission(exec, session, now);
  const principalId = positiveId(input.agentPrincipalId, 'agentPrincipalId');
  const nextStatus = textValue(input.status, 'status', 32);
  if (!(AGENT_PRINCIPAL_STATUSES as readonly string[]).includes(nextStatus)) {
    fail(400, 'agent_principal_status_invalid', 'Agent principal status is invalid.');
  }
  const version = expectedVersion(input.expectedVersion);
  const reason = nextStatus === 'active'
    ? input.reason == null || input.reason === '' ? 'resumed by administrator' : lifecycleReason(input.reason)
    : lifecycleReason(input.reason);
  const principal = await managedPrincipal(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, principalId);
  if (principal.version !== version) {
    fail(409, 'agent_version_stale', 'The Agent principal changed; reload its current review state.');
  }
  if (principal.status === 'revoked' && nextStatus !== 'revoked') {
    fail(409, 'agent_principal_terminal', 'A revoked Agent principal cannot be resumed.');
  }
  if (principal.status === nextStatus) {
    fail(409, 'agent_principal_status_unchanged', 'The Agent principal already has this status.');
  }
  if (nextStatus === 'active') {
    await activeHumanOwner(exec, {
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
    }, principal.ownerUserId);
  }
  const [updated] = await exec.update(agentPrincipal).set({
    status: nextStatus,
    version: sql`${agentPrincipal.version} + 1`,
    disabledAt: nextStatus === 'disabled' ? now : null,
    disabledByUserId: nextStatus === 'disabled' ? session.userId : null,
    disabledReason: nextStatus === 'disabled' ? reason : null,
    revokedAt: nextStatus === 'revoked' ? now : principal.revokedAt,
    revokedByUserId: nextStatus === 'revoked' ? session.userId : principal.revokedByUserId,
    revocationReason: nextStatus === 'revoked' ? reason : principal.revocationReason,
    updatedAt: now,
  }).where(and(
    eq(agentPrincipal.id, principal.id),
    eq(agentPrincipal.masterFn, session.masterFn),
    eq(agentPrincipal.companyFn, session.activeCompanyFn),
    eq(agentPrincipal.version, version),
  )).returning();
  if (!updated) fail(409, 'agent_version_stale', 'The Agent principal changed; reload its current review state.');

  let revokedGrants = 0;
  let revokedCredentials = 0;
  if (nextStatus === 'revoked') {
    const revokedGrantRows = await exec.update(agentGrant).set({
      revokedAt: now,
      revokedByUserId: session.userId,
      revocationReason: 'principal revoked: ' + reason,
      version: sql`${agentGrant.version} + 1`,
      updatedAt: now,
    }).where(and(
      eq(agentGrant.masterFn, session.masterFn),
      eq(agentGrant.companyFn, session.activeCompanyFn),
      eq(agentGrant.agentPrincipalId, principal.id),
      sql`${agentGrant.revokedAt} is null`,
    )).returning({ id: agentGrant.id });
    revokedGrants = revokedGrantRows.length;
  }
  if (nextStatus === 'disabled' || nextStatus === 'revoked') {
    const revokedCredentialRows = await exec.update(agentCredential).set({
      status: 'revoked',
      revokedAt: now,
      revokedByUserId: session.userId,
      revocationReason: nextStatus === 'revoked'
        ? 'principal revoked: ' + reason
        : 'emergency disabled: ' + reason,
      version: sql`${agentCredential.version} + 1`,
      updatedAt: now,
    }).where(and(
      eq(agentCredential.masterFn, session.masterFn),
      eq(agentCredential.companyFn, session.activeCompanyFn),
      eq(agentCredential.agentPrincipalId, principal.id),
      eq(agentCredential.status, 'active'),
      sql`${agentCredential.revokedAt} is null`,
    )).returning({ id: agentCredential.id });
    revokedCredentials = revokedCredentialRows.length;
  }
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId: requestIdValue(requestId),
    entity: 'agent_principal',
    entityId: principal.id,
    action: `status_${nextStatus}`,
    before: { status: principal.status, version: principal.version },
    after: {
      status: updated.status,
      version: updated.version,
      reason,
      revokedGrants,
      revokedCredentials,
    },
    occurredAt: now,
  });
  await bumpAuthorizationVersionWithin(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, now);
  return viewPrincipal(updated);
}

export function setAgentPrincipalStatus(
  db: DB,
  session: SessionData,
  input: SetAgentPrincipalStatusInput,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => setAgentPrincipalStatusWithin(tx, session, input, requestId));
}

export async function createAgentPrincipalWithin(
  exec: DB,
  session: SessionData,
  input: CreateAgentPrincipalInput,
  requestId: string,
  now = new Date(),
): Promise<AgentPrincipalView> {
  await requireManagementPermission(exec, session, now);
  const principalKey = textValue(input.principalKey, 'principalKey', 128).toLowerCase();
  if (!PRINCIPAL_KEY_PATTERN.test(principalKey)) {
    fail(400, 'agent_principal_key_invalid', 'principalKey must use a stable lowercase identifier.');
  }
  const displayName = textValue(input.displayName, 'displayName', 160);
  const kind = principalKind(input.kind);
  const ownerUserId = positiveId(input.ownerUserId, 'ownerUserId');
  await activeHumanOwner(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, ownerUserId);

  const [existing] = await exec.select({ id: agentPrincipal.id }).from(agentPrincipal).where(and(
    eq(agentPrincipal.masterFn, session.masterFn),
    eq(agentPrincipal.companyFn, session.activeCompanyFn),
    eq(agentPrincipal.principalKey, principalKey),
  )).limit(1);
  if (existing) fail(409, 'agent_principal_exists', 'An Agent principal with this key already exists.');

  const bridgeUsername = `__agent_${principalKey.replace(/[^a-z0-9_]/g, '_')}_${randomUUID().replace(/-/g, '')}`;
  const [bridge] = await exec.insert(appUser).values({
    masterFn: session.masterFn,
    username: bridgeUsername,
    fullName: displayName,
    passwordHash: hashPassword(randomUUID()),
    identityKind: kind === 'service_automation' ? 'service_automation' : 'agent',
    loginEnabled: false,
    isActive: true,
    accountState: 'active',
    passwordChangeRequired: false,
    activatedAt: now,
  }).returning({ userId: appUser.userId });
  const [created] = await exec.insert(agentPrincipal).values({
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    principalKey,
    displayName,
    kind,
    actorUserId: bridge.userId,
    ownerUserId,
    status: 'active',
    version: 1,
  }).returning();

  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId: requestIdValue(requestId),
    entity: 'agent_principal',
    entityId: created.id,
    action: 'create',
    after: {
      principalKey,
      displayName,
      kind,
      actorUserId: bridge.userId,
      ownerUserId,
      version: created.version,
    },
    occurredAt: now,
  });
  await bumpAuthorizationVersionWithin(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, now);
  return viewPrincipal(created);
}

export function createAgentPrincipal(
  db: DB,
  session: SessionData,
  input: CreateAgentPrincipalInput,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => createAgentPrincipalWithin(tx, session, input, requestId));
}

async function validateGrantInput(
  exec: DB,
  session: SessionData,
  input: CreateAgentGrantInput,
  now: Date,
): Promise<{
  principalId: number;
  action: AgentActionName;
  permission: string;
  resource: string;
  scopeTarget: AuthorizationScopeTarget;
  fields: string[];
  amountLimit: string | null;
  amountCurrency: string | null;
  validFrom: Date;
  validUntil: Date | null;
  principal: typeof agentPrincipal.$inferSelect;
}> {
  const principalId = positiveId(input.agentPrincipalId, 'agentPrincipalId');
  const { principal } = await registeredPrincipal(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, principalId);
  await activeHumanOwner(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, principal.ownerUserId);
  const action = actionName(input.actionName);
  const permission = permissionKey(input.permissionKey, action);
  const resource = resourceKey(input.resourceKey, action);
  const scopeTarget = normalizedScope(
    input.scope,
    input.targetType,
    input.targetId,
    principal.ownerUserId,
  );
  const fields = normalizeFields(input.fieldAllowlist, resource, true);
  const amountLimit = normalizedAmount(input.amountLimit, 'amountLimit');
  const amountCurrency = normalizedCurrency(input.amountCurrency, 'amountCurrency');
  if ((amountLimit == null) !== (amountCurrency == null)) {
    fail(400, 'agent_amount_currency_invalid', 'An amount limit and currency must be supplied together.');
  }
  const validFrom = normalizedDate(input.validFrom, 'validFrom', now);
  const validUntil = input.validUntil == null ? null : normalizedDate(input.validUntil, 'validUntil', now);
  if (validUntil != null && validUntil <= validFrom) {
    fail(400, 'agent_grant_window_invalid', 'validUntil must be later than validFrom.');
  }
  if (permission.endsWith('.read_own') && scopeTarget.scope !== 'self') {
    fail(400, 'agent_scope_permission_mismatch', 'A read-own permission cannot be delegated at Company scope.');
  }
  const ownerDecision = await authorizeWithin(exec, {
    userId: principal.ownerUserId,
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, permission, {
    resourceKey: resource,
    scopeTarget,
    requireScope: true,
    now: validFrom > now ? validFrom : now,
  });
  if (!ownerDecision.allowed) {
    fail(403, 'agent_owner_authority_denied', 'The accountable owner does not currently hold this scoped authority.');
  }
  return {
    principalId,
    action,
    permission,
    resource,
    scopeTarget,
    fields,
    amountLimit,
    amountCurrency,
    validFrom,
    validUntil,
    principal,
  };
}

export async function createAgentGrantWithin(
  exec: DB,
  session: SessionData,
  input: CreateAgentGrantInput,
  requestId: string,
  now = new Date(),
): Promise<typeof agentGrant.$inferSelect> {
  await requireManagementPermission(exec, session, now);
  const validated = await validateGrantInput(exec, session, input, now);
  const [created] = await exec.insert(agentGrant).values({
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    agentPrincipalId: validated.principalId,
    actionName: validated.action,
    permissionKey: validated.permission,
    resourceKey: validated.resource,
    scope: validated.scopeTarget.scope,
    targetType: validated.scopeTarget.targetType,
    targetId: validated.scopeTarget.targetId ?? '',
    fieldAllowlist: validated.fields,
    amountLimit: validated.amountLimit,
    amountCurrency: validated.amountCurrency,
    validFrom: validated.validFrom,
    validUntil: validated.validUntil,
    version: 1,
    createdByUserId: session.userId,
  }).returning();
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId: requestIdValue(requestId),
    entity: 'agent_grant',
    entityId: created.id,
    action: 'create',
    after: {
      agentPrincipalId: created.agentPrincipalId,
      actionName: created.actionName,
      permissionKey: created.permissionKey,
      resourceKey: created.resourceKey,
      scope: created.scope,
      targetType: created.targetType,
      targetId: created.targetId || null,
      fieldAllowlist: created.fieldAllowlist,
      amountLimit: created.amountLimit,
      amountCurrency: created.amountCurrency,
      validFrom: created.validFrom,
      validUntil: created.validUntil,
      version: created.version,
    },
    occurredAt: now,
  });
  await bumpAuthorizationVersionWithin(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, now);
  return created;
}

export function createAgentGrant(
  db: DB,
  session: SessionData,
  input: CreateAgentGrantInput,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => createAgentGrantWithin(tx, session, input, requestId));
}

export async function revokeAgentGrantWithin(
  exec: DB,
  session: SessionData,
  input: RevokeAgentGrantInput,
  requestId: string,
  now = new Date(),
): Promise<AgentGrantView> {
  await requireManagementPermission(exec, session, now);
  const principalId = positiveId(input.agentPrincipalId, 'agentPrincipalId');
  const grantId = positiveId(input.grantId, 'grantId');
  const version = expectedVersion(input.expectedVersion);
  const reason = lifecycleReason(input.reason);
  await managedPrincipal(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, principalId);
  const [grant] = await exec.select().from(agentGrant).where(and(
    eq(agentGrant.id, grantId),
    eq(agentGrant.masterFn, session.masterFn),
    eq(agentGrant.companyFn, session.activeCompanyFn),
    eq(agentGrant.agentPrincipalId, principalId),
  )).limit(1);
  if (!grant) fail(404, 'agent_grant_not_found', 'Agent grant is not available.');
  if (grant.version !== version) {
    fail(409, 'agent_version_stale', 'The Agent grant changed; reload its current review state.');
  }
  if (grant.revokedAt != null) {
    fail(409, 'agent_grant_already_revoked', 'The Agent grant is already revoked.');
  }
  const [updated] = await exec.update(agentGrant).set({
    revokedAt: now,
    revokedByUserId: session.userId,
    revocationReason: reason,
    version: sql`${agentGrant.version} + 1`,
    updatedAt: now,
  }).where(and(
    eq(agentGrant.id, grant.id),
    eq(agentGrant.masterFn, session.masterFn),
    eq(agentGrant.companyFn, session.activeCompanyFn),
    eq(agentGrant.version, version),
    sql`${agentGrant.revokedAt} is null`,
  )).returning();
  if (!updated) fail(409, 'agent_version_stale', 'The Agent grant changed; reload its current review state.');
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId: requestIdValue(requestId),
    entity: 'agent_grant',
    entityId: updated.id,
    action: 'revoke',
    before: {
      status: 'active',
      version: grant.version,
      actionName: grant.actionName,
      agentPrincipalId: grant.agentPrincipalId,
    },
    after: {
      status: 'revoked',
      version: updated.version,
      reason,
    },
    occurredAt: now,
  });
  await bumpAuthorizationVersionWithin(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, now);
  return viewGrant(updated, now);
}

export function revokeAgentGrant(
  db: DB,
  session: SessionData,
  input: RevokeAgentGrantInput,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => revokeAgentGrantWithin(tx, session, input, requestId));
}

const MAX_AGENT_CREDENTIAL_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const DEFAULT_AGENT_CREDENTIAL_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function credentialExpiry(value: unknown, now: Date): Date {
  if (value == null || value === '') {
    return new Date(now.getTime() + DEFAULT_AGENT_CREDENTIAL_TTL_MS);
  }
  const expiry = normalizedDate(value, 'validUntil', now);
  if (expiry <= now || expiry.getTime() > now.getTime() + MAX_AGENT_CREDENTIAL_TTL_MS) {
    fail(400, 'agent_credential_window_invalid', 'Credential validUntil must be within one year.');
  }
  return expiry;
}

export async function rotateAgentCredentialWithin(
  exec: DB,
  session: SessionData,
  input: RotateAgentCredentialInput,
  requestId: string,
  now = new Date(),
): Promise<RotatedAgentCredential> {
  await requireManagementPermission(exec, session, now);
  const principalId = positiveId(input.agentPrincipalId, 'agentPrincipalId');
  const version = expectedVersion(input.expectedVersion);
  const principal = await managedPrincipal(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, principalId);
  if (principal.version !== version) {
    fail(409, 'agent_version_stale', 'The Agent principal changed; reload its current review state.');
  }
  if (principal.status === 'revoked') {
    fail(409, 'agent_principal_terminal', 'A revoked Agent principal cannot receive a credential.');
  }
  const validUntil = credentialExpiry(input.validUntil, now);
  const token = newOpaqueToken(32);
  const credentialKey = `agent_${randomUUID()}`;
  const tokenHint = token.slice(0, 8);
  await exec.update(agentCredential).set({
    status: 'revoked',
    revokedAt: now,
    revokedByUserId: session.userId,
    revocationReason: 'rotated by administrator',
    version: sql`${agentCredential.version} + 1`,
    updatedAt: now,
  }).where(and(
    eq(agentCredential.masterFn, session.masterFn),
    eq(agentCredential.companyFn, session.activeCompanyFn),
    eq(agentCredential.agentPrincipalId, principal.id),
    eq(agentCredential.status, 'active'),
    sql`${agentCredential.revokedAt} is null`,
  ));
  const [created] = await exec.insert(agentCredential).values({
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    agentPrincipalId: principal.id,
    credentialKey,
    tokenHash: hashOpaqueToken(token),
    tokenHint,
    status: 'active',
    validFrom: now,
    validUntil,
    version: 1,
    createdByUserId: session.userId,
  }).returning();
  const [updatedPrincipal] = await exec.update(agentPrincipal).set({
    version: sql`${agentPrincipal.version} + 1`,
    updatedAt: now,
  }).where(and(
    eq(agentPrincipal.id, principal.id),
    eq(agentPrincipal.masterFn, session.masterFn),
    eq(agentPrincipal.companyFn, session.activeCompanyFn),
    eq(agentPrincipal.version, version),
  )).returning({ version: agentPrincipal.version });
  if (!updatedPrincipal) fail(409, 'agent_version_stale', 'The Agent principal changed; reload its current review state.');
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId: requestIdValue(requestId),
    entity: 'agent_credential',
    entityId: created.id,
    action: 'rotate',
    after: {
      agentPrincipalId: created.agentPrincipalId,
      credentialKey: created.credentialKey,
      tokenHint: created.tokenHint,
      validFrom: created.validFrom,
      validUntil: created.validUntil,
      principalVersion: updatedPrincipal.version,
    },
    occurredAt: now,
  });
  await bumpAuthorizationVersionWithin(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, now);
  return {
    credentialId: created.id,
    agentPrincipalId: created.agentPrincipalId,
    credentialKey: created.credentialKey,
    token,
    tokenHint,
    validFrom: created.validFrom,
    validUntil: created.validUntil,
  };
}

export function rotateAgentCredential(
  db: DB,
  session: SessionData,
  input: RotateAgentCredentialInput,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => rotateAgentCredentialWithin(tx, session, input, requestId));
}

function grantFields(
  grantFieldsValue: unknown,
  requestedFields: unknown,
  resource: string,
): string[] {
  const grantFields = normalizeFields(grantFieldsValue, resource, true);
  const requested = normalizeFields(requestedFields, resource, false, 'requestedFields');
  if (!requested.length) {
    return grantFields.includes('*') ? [...RESOURCE_FIELDS[resource]] : grantFields;
  }
  if (!grantFields.includes('*') && requested.some((field) => !grantFields.includes(field))) {
    fail(403, 'agent_field_denied', 'The Agent grant does not include every requested field.');
  }
  return requested;
}

function requestedAmount(value: unknown): string | null {
  return normalizedAmount(value, 'amount');
}

function checkAmountBoundary(
  grant: typeof agentGrant.$inferSelect,
  amountValue: unknown,
  currencyValue: unknown,
): void {
  const amount = requestedAmount(amountValue);
  const currency = normalizedCurrency(currencyValue, 'currency');
  if (grant.amountLimit == null) return;
  if (amount == null) return;
  if (grant.amountCurrency == null || currency == null) {
    fail(403, 'agent_currency_required', 'A currency matching the Agent amount limit is required.');
  }
  if (currency !== grant.amountCurrency) {
    fail(403, 'agent_currency_mismatch', 'The requested amount currency is outside the Agent grant.');
  }
  if (new Decimal(amount).gt(new Decimal(grant.amountLimit))) {
    fail(403, 'agent_amount_exceeded', 'The requested amount exceeds the Agent grant limit.');
  }
}

export async function resolveAgentGrantWithin(
  exec: DB,
  scope: { masterFn: string; companyFn: string },
  input: ResolveAgentGrantInput,
): Promise<ResolvedAgentGrant> {
  const now = input.now ?? new Date();
  const principalId = positiveId(input.agentPrincipalId, 'agentPrincipalId');
  const action = actionName(input.actionName);
  const principalRow = await registeredPrincipal(exec, scope, principalId);
  const owner = await activeHumanOwner(exec, scope, principalRow.principal.ownerUserId);
  const requestedPermission = input.permissionKey == null
    ? null
    : permissionKey(input.permissionKey, action);
  const grants = await exec.select().from(agentGrant).where(and(
    eq(agentGrant.masterFn, scope.masterFn),
    eq(agentGrant.companyFn, scope.companyFn),
    eq(agentGrant.agentPrincipalId, principalId),
    eq(agentGrant.actionName, action),
    requestedPermission ? eq(agentGrant.permissionKey, requestedPermission) : undefined,
  )).orderBy(agentGrant.id);
  if (!grants.length) fail(403, 'agent_grant_not_found', 'No Agent grant is registered for this action.');

  let lastFailure: AuthLifecycleError | null = null;
  for (const grant of grants) {
    try {
      if (grant.revokedAt != null || grant.validFrom > now
        || (grant.validUntil != null && grant.validUntil <= now)) {
        fail(403, 'agent_grant_inactive', 'The Agent grant is expired or revoked.');
      }
      const grantScope: AuthorizationScopeTarget = {
        scope: grant.scope as AgentGrantScope,
        targetType: grant.targetType as AgentGrantTargetType,
        targetId: grant.targetId || null,
      };
      const requestedScope = input.requestedScope == null
        ? grantScope
        : normalizedScope(
          input.requestedScope.scope,
          input.requestedScope.targetType,
          input.requestedScope.targetId,
          owner.userId,
        );
      if (!grantCoversRequest(grantScope, requestedScope)) {
        fail(403, 'agent_scope_denied', 'The requested data scope exceeds the Agent grant.');
      }
      const fields = grantFields(grant.fieldAllowlist, input.requestedFields, grant.resourceKey);
      checkAmountBoundary(grant, input.amount, input.currency);
      const ownerDecision = await authorizeWithin(exec, {
        userId: owner.userId,
        masterFn: scope.masterFn,
        companyFn: scope.companyFn,
      }, grant.permissionKey, {
        resourceKey: grant.resourceKey,
        scopeTarget: requestedScope,
        requireScope: true,
        now,
      });
      if (!ownerDecision.allowed) {
        fail(403, 'agent_owner_authority_denied', 'The accountable owner no longer holds this authority.');
      }
      return {
        agentPrincipalId: principalRow.principal.id,
        principalKey: principalRow.principal.principalKey,
        kind: principalRow.principal.kind as AgentPrincipalKind,
        actorUserId: principalRow.principal.actorUserId,
        ownerUserId: owner.userId,
        principalVersion: principalRow.principal.version,
        grantId: grant.id,
        grantVersion: grant.version,
        actionName: action,
        permissionKey: grant.permissionKey,
        resourceKey: grant.resourceKey,
        scope: grant.scope as AgentGrantScope,
        targetType: grant.targetType as AgentGrantTargetType,
        targetId: grant.targetId || null,
        fields,
        amountLimit: grant.amountLimit,
        amountCurrency: grant.amountCurrency,
      };
    } catch (error) {
      if (error instanceof AuthLifecycleError) {
        lastFailure = error;
        continue;
      }
      throw error;
    }
  }
  if (lastFailure) throw lastFailure;
  fail(403, 'agent_grant_denied', 'The Agent grant does not authorize this request.');
}
