// Agent identity and delegation state. Agent rows are deliberately separate
// from human role assignments and the hidden Platform actor bridge. The
// business command layer continues to receive a numeric actor user id, while
// this model carries the accountable owner and current delegation boundary.
import {
  pgTable, text, bigint, integer, timestamp, numeric, jsonb, boolean,
  date, index, uniqueIndex, foreignKey, check,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { appUser, company, userCompany } from './tenancy';
import { currency } from './localization';
import { documentVersion, managedDocument } from './documents';
import { tenant, timestamps } from './_shared';

export const AGENT_PRINCIPAL_KINDS = ['delegated_agent', 'service_automation'] as const;
export type AgentPrincipalKind = typeof AGENT_PRINCIPAL_KINDS[number];

export const AGENT_PRINCIPAL_STATUSES = ['active', 'paused', 'revoked', 'disabled'] as const;
export type AgentPrincipalStatus = typeof AGENT_PRINCIPAL_STATUSES[number];

export const AGENT_CREDENTIAL_STATUSES = ['active', 'revoked'] as const;
export type AgentCredentialStatus = typeof AGENT_CREDENTIAL_STATUSES[number];

export const AGENT_GRANT_SCOPES = ['self', 'team', 'department', 'company'] as const;
export type AgentGrantScope = typeof AGENT_GRANT_SCOPES[number];

export const AGENT_GRANT_TARGET_TYPES = [
  'none', 'company', 'branch', 'department', 'team', 'employee',
  'region', 'business_unit', 'legal_entity', 'cost_center',
] as const;
export type AgentGrantTargetType = typeof AGENT_GRANT_TARGET_TYPES[number];

export const AGENT_KNOWLEDGE_STATUSES = ['active', 'revoked', 'expired'] as const;
export type AgentKnowledgeStatus = typeof AGENT_KNOWLEDGE_STATUSES[number];

export const AGENT_KNOWLEDGE_FIELDS = [
  'title',
  'content',
  'effectiveFrom',
  'effectiveTo',
  'documentId',
  'documentVersionId',
  'documentVersionNo',
  'sourceSha256',
] as const;
export type AgentKnowledgeField = typeof AGENT_KNOWLEDGE_FIELDS[number];

/** A non-login tenant identity with one accountable human owner. */
export const agentPrincipal = pgTable('agent_principal', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  principalKey: text('principal_key').notNull(),
  displayName: text('display_name').notNull(),
  kind: text('kind').notNull().default('delegated_agent'),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  status: text('status').notNull().default('active'),
  version: integer('version').notNull().default(1),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  disabledByUserId: bigint('disabled_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  disabledReason: text('disabled_reason'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedByUserId: bigint('revoked_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  revocationReason: text('revocation_reason'),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.masterFn, t.companyFn],
    foreignColumns: [company.masterFn, company.companyFn],
    name: 'fk_agent_principal_company_master',
  }),
  foreignKey({
    columns: [t.ownerUserId, t.companyFn],
    foreignColumns: [userCompany.userId, userCompany.companyFn],
    name: 'fk_agent_principal_owner_membership',
  }),
  uniqueIndex('uq_agent_principal_key').on(t.masterFn, t.companyFn, t.principalKey),
  uniqueIndex('uq_agent_principal_actor_user').on(t.actorUserId),
  unique('uq_agent_principal_tenant_id').on(t.id, t.masterFn, t.companyFn),
  index('idx_agent_principal_owner').on(t.masterFn, t.companyFn, t.ownerUserId, t.status),
  index('idx_agent_principal_status').on(t.masterFn, t.companyFn, t.status, t.id),
  check(
    'ck_agent_principal_kind',
    sql`${t.kind} in ('delegated_agent', 'service_automation')`,
  ),
  check(
    'ck_agent_principal_status',
    sql`${t.status} in ('active', 'paused', 'revoked', 'disabled')`,
  ),
  check('ck_agent_principal_version', sql`${t.version} > 0`),
  check('ck_agent_principal_key', sql`char_length(${t.principalKey}) between 3 and 128`),
  check('ck_agent_principal_display_name', sql`char_length(${t.displayName}) between 1 and 160`),
  check(
    'ck_agent_principal_revocation',
    sql`(${t.revokedAt} is null and ${t.revokedByUserId} is null and ${t.revocationReason} is null)
      or (${t.revokedAt} is not null and ${t.revokedByUserId} is not null and ${t.revocationReason} is not null)`,
  ),
]);

/** Hash-only bearer credentials issued by the ERP's local Agent issuer adapter.
 * The raw token is returned exactly once by the rotation command and is never
 * persisted, logged or included in review responses. */
export const agentCredential = pgTable('agent_credential', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  agentPrincipalId: bigint('agent_principal_id', { mode: 'number' }).notNull(),
  credentialKey: text('credential_key').notNull(),
  tokenHash: text('token_hash').notNull(),
  tokenHint: text('token_hint').notNull(),
  status: text('status').notNull().default('active'),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedByUserId: bigint('revoked_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  revocationReason: text('revocation_reason'),
  version: integer('version').notNull().default(1),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.masterFn, t.companyFn],
    foreignColumns: [company.masterFn, company.companyFn],
    name: 'fk_agent_credential_company_master',
  }),
  foreignKey({
    columns: [t.agentPrincipalId, t.masterFn, t.companyFn],
    foreignColumns: [agentPrincipal.id, agentPrincipal.masterFn, agentPrincipal.companyFn],
    name: 'fk_agent_credential_principal_tenant',
  }),
  foreignKey({
    columns: [t.createdByUserId, t.companyFn],
    foreignColumns: [userCompany.userId, userCompany.companyFn],
    name: 'fk_agent_credential_creator_membership',
  }),
  foreignKey({
    columns: [t.revokedByUserId, t.companyFn],
    foreignColumns: [userCompany.userId, userCompany.companyFn],
    name: 'fk_agent_credential_revoker_membership',
  }),
  uniqueIndex('uq_agent_credential_key').on(t.masterFn, t.companyFn, t.agentPrincipalId, t.credentialKey),
  uniqueIndex('uq_agent_credential_hash').on(t.tokenHash),
  index('idx_agent_credential_principal').on(
    t.masterFn, t.companyFn, t.agentPrincipalId, t.status, t.id,
  ),
  check('ck_agent_credential_status', sql`${t.status} in ('active', 'revoked')`),
  check('ck_agent_credential_key', sql`char_length(${t.credentialKey}) between 8 and 160`),
  check('ck_agent_credential_hash', sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
  check('ck_agent_credential_hint', sql`char_length(${t.tokenHint}) between 4 and 32`),
  check('ck_agent_credential_window', sql`${t.validUntil} is null or ${t.validUntil} > ${t.validFrom}`),
  check('ck_agent_credential_revocation', sql`(
    (${t.revokedAt} is null and ${t.revokedByUserId} is null and ${t.revocationReason} is null)
    or (${t.revokedAt} is not null and ${t.revokedByUserId} is not null and ${t.revocationReason} is not null)
  )`),
  check('ck_agent_credential_version', sql`${t.version} > 0`),
]);

export const AGENT_PROVIDER_IDS = [
  'deterministic.zero_spend',
  'openai',
  'google',
  'openai_compatible',
] as const;
export type AgentProviderId = typeof AGENT_PROVIDER_IDS[number];

export const AGENT_DATA_POLICIES = ['tenant_only', 'tenant_no_training'] as const;
export type AgentDataPolicy = typeof AGENT_DATA_POLICIES[number];

/** Company-owned server AI configuration. The credential is recoverable only
 * inside the server provider boundary and is never part of a public view. */
export const agentProviderConfig = pgTable('agent_provider_config', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  provider: text('provider').notNull().default('deterministic.zero_spend'),
  model: text('model').notNull(),
  endpointUrl: text('endpoint_url'),
  dataRegion: text('data_region').notNull().default('tenant-local'),
  dataPolicy: text('data_policy').notNull().default('tenant_no_training'),
  credentialEnvelope: jsonb('credential_envelope'),
  credentialLabel: text('credential_label'),
  maxProviderCalls: integer('max_provider_calls').notNull().default(1),
  maxRetries: integer('max_retries').notNull().default(0),
  maxDurationMs: integer('max_duration_ms').notNull().default(30_000),
  maxInputChars: integer('max_input_chars').notNull().default(16_000),
  maxOutputChars: integer('max_output_chars').notNull().default(4_000),
  maxCostMicros: integer('max_cost_micros').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
  version: integer('version').notNull().default(1),
  updatedByUserId: bigint('updated_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.masterFn, t.companyFn],
    foreignColumns: [company.masterFn, company.companyFn],
    name: 'fk_agent_provider_config_company_master',
  }),
  foreignKey({
    columns: [t.updatedByUserId, t.companyFn],
    foreignColumns: [userCompany.userId, userCompany.companyFn],
    name: 'fk_agent_provider_config_updater_membership',
  }),
  uniqueIndex('uq_agent_provider_config_company').on(t.masterFn, t.companyFn),
  index('idx_agent_provider_config_provider').on(t.masterFn, t.companyFn, t.provider, t.enabled),
  check('ck_agent_provider_config_provider', sql`${t.provider} in ('deterministic.zero_spend', 'openai', 'google', 'openai_compatible')`),
  check('ck_agent_provider_config_model', sql`char_length(${t.model}) between 1 and 160`),
  check('ck_agent_provider_config_region', sql`char_length(${t.dataRegion}) between 2 and 80`),
  check('ck_agent_provider_config_policy', sql`${t.dataPolicy} in ('tenant_only', 'tenant_no_training')`),
  check('ck_agent_provider_config_credential_label', sql`${t.credentialLabel} is null or char_length(${t.credentialLabel}) between 1 and 80`),
  check('ck_agent_provider_config_calls', sql`${t.maxProviderCalls} between 1 and 32`),
  check('ck_agent_provider_config_retries', sql`${t.maxRetries} >= 0 and ${t.maxRetries} < ${t.maxProviderCalls}`),
  check('ck_agent_provider_config_duration', sql`${t.maxDurationMs} between 1000 and 120000`),
  check('ck_agent_provider_config_input', sql`${t.maxInputChars} between 1 and 100000`),
  check('ck_agent_provider_config_output', sql`${t.maxOutputChars} between 1 and 100000`),
  check('ck_agent_provider_config_cost', sql`${t.maxCostMicros} between 0 and 2000000000`),
  check('ck_agent_provider_config_version', sql`${t.version} > 0`),
]);

/** A bounded, time-limited permission grant for one Agent action. */
export const agentGrant = pgTable('agent_grant', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  agentPrincipalId: bigint('agent_principal_id', { mode: 'number' }).notNull(),
  actionName: text('action_name').notNull(),
  permissionKey: text('permission_key').notNull(),
  resourceKey: text('resource_key').notNull(),
  scope: text('scope').notNull(),
  targetType: text('target_type').notNull().default('none'),
  targetId: text('target_id').notNull().default(''),
  fieldAllowlist: jsonb('field_allowlist').$type<string[]>().notNull().default([]),
  amountLimit: numeric('amount_limit', { precision: 18, scale: 4 }),
  amountCurrency: text('amount_currency').references(() => currency.code),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedByUserId: bigint('revoked_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  revocationReason: text('revocation_reason'),
  version: integer('version').notNull().default(1),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.masterFn, t.companyFn],
    foreignColumns: [company.masterFn, company.companyFn],
    name: 'fk_agent_grant_company_master',
  }),
  foreignKey({
    columns: [t.agentPrincipalId, t.masterFn, t.companyFn],
    foreignColumns: [agentPrincipal.id, agentPrincipal.masterFn, agentPrincipal.companyFn],
    name: 'fk_agent_grant_principal_tenant',
  }),
  foreignKey({
    columns: [t.createdByUserId, t.companyFn],
    foreignColumns: [userCompany.userId, userCompany.companyFn],
    name: 'fk_agent_grant_creator_membership',
  }),
  index('idx_agent_grant_lookup').on(
    t.masterFn, t.companyFn, t.agentPrincipalId, t.actionName, t.validFrom, t.validUntil,
  ),
  index('idx_agent_grant_permission').on(
    t.masterFn, t.companyFn, t.permissionKey, t.resourceKey, t.scope,
  ),
  check('ck_agent_grant_scope', sql`${t.scope} in ('self', 'team', 'department', 'company')`),
  check(
    'ck_agent_grant_target_type',
    sql`${t.targetType} in ('none', 'company', 'branch', 'department', 'team', 'employee', 'region', 'business_unit', 'legal_entity', 'cost_center')`,
  ),
  check(
    'ck_agent_grant_target',
    sql`(${t.targetType} = 'none' and ${t.targetId} = '') or (${t.targetType} <> 'none' and char_length(${t.targetId}) > 0)`,
  ),
  check('ck_agent_grant_fields', sql`jsonb_array_length(${t.fieldAllowlist}) > 0`),
  check('ck_agent_grant_amount', sql`${t.amountLimit} is null or ${t.amountLimit} >= 0`),
  check(
    'ck_agent_grant_amount_currency',
    sql`(${t.amountLimit} is null and ${t.amountCurrency} is null)
      or (${t.amountLimit} is not null and ${t.amountCurrency} is not null)`,
  ),
  check(
    'ck_agent_grant_window',
    sql`${t.validUntil} is null or ${t.validUntil} > ${t.validFrom}`,
  ),
  check(
    'ck_agent_grant_revocation',
    sql`(${t.revokedAt} is null and ${t.revokedByUserId} is null and ${t.revocationReason} is null)
      or (${t.revokedAt} is not null and ${t.revokedByUserId} is not null and ${t.revocationReason} is not null)`,
  ),
  check('ck_agent_grant_version', sql`${t.version} > 0`),
]);

/**
 * Server-owned registration of one effective SOP/policy version. The content
 * remains in the governed document/extraction tables; this row only selects
 * which versions belong to the bounded Agent retrieval corpus and which fields
 * may be projected into model context.
 */
export const agentKnowledgeDocument = pgTable('agent_knowledge_document', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  corpusKey: text('corpus_key').notNull(),
  title: text('title').notNull(),
  documentId: bigint('document_id', { mode: 'number' }).notNull()
    .references(() => managedDocument.id),
  documentVersionId: bigint('document_version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  requiredPermission: text('required_permission').notNull()
    .default('documents.knowledge.read'),
  fieldAllowlist: jsonb('field_allowlist').$type<AgentKnowledgeField[]>()
    .notNull()
    .default(['title', 'content', 'effectiveFrom', 'effectiveTo', 'documentId',
      'documentVersionId', 'documentVersionNo', 'sourceSha256']),
  status: text('status').notNull().default('active'),
  version: integer('version').notNull().default(1),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedByUserId: bigint('revoked_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  revocationReason: text('revocation_reason'),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.masterFn, t.companyFn],
    foreignColumns: [company.masterFn, company.companyFn],
    name: 'fk_agent_knowledge_company_master',
  }),
  foreignKey({
    columns: [t.createdByUserId, t.companyFn],
    foreignColumns: [userCompany.userId, userCompany.companyFn],
    name: 'fk_agent_knowledge_creator_membership',
  }),
  foreignKey({
    columns: [t.revokedByUserId, t.companyFn],
    foreignColumns: [userCompany.userId, userCompany.companyFn],
    name: 'fk_agent_knowledge_revoker_membership',
  }),
  uniqueIndex('uq_agent_knowledge_corpus_version')
    .on(t.masterFn, t.companyFn, t.corpusKey, t.documentVersionId),
  index('idx_agent_knowledge_lookup')
    .on(t.masterFn, t.companyFn, t.corpusKey, t.status, t.effectiveFrom, t.id),
  check('ck_agent_knowledge_corpus_key',
    sql`${t.corpusKey} ~ '^[a-z][a-z0-9._-]{2,63}$'`),
  check('ck_agent_knowledge_title', sql`char_length(${t.title}) between 1 and 160`),
  check('ck_agent_knowledge_effective_window',
    sql`${t.effectiveTo} is null or ${t.effectiveTo} > ${t.effectiveFrom}`),
  check('ck_agent_knowledge_permission',
    sql`${t.requiredPermission} = 'documents.knowledge.read'`),
  check('ck_agent_knowledge_fields',
    sql`jsonb_typeof(${t.fieldAllowlist}) = 'array'
      and jsonb_array_length(${t.fieldAllowlist}) > 0`),
  check('ck_agent_knowledge_status',
    sql`${t.status} in ('active', 'revoked', 'expired')`),
  check('ck_agent_knowledge_version', sql`${t.version} > 0`),
  check('ck_agent_knowledge_revocation', sql`(
    (${t.status} <> 'revoked' and ${t.revokedAt} is null
      and ${t.revokedByUserId} is null and ${t.revocationReason} is null)
    or (${t.status} = 'revoked' and ${t.revokedAt} is not null
      and ${t.revokedByUserId} is not null
      and char_length(${t.revocationReason}) between 3 and 1000)
  )`),
]);

export const AGENT_EXECUTION_INTENT_ACTIONS = ['receipt_pack.create'] as const;
export type AgentExecutionIntentAction = typeof AGENT_EXECUTION_INTENT_ACTIONS[number];

export const AGENT_EXECUTION_INTENT_STATUSES = [
  'prepared', 'approved', 'rejected', 'cancelled', 'expired', 'consumed',
] as const;
export type AgentExecutionIntentStatus = typeof AGENT_EXECUTION_INTENT_STATUSES[number];

/**
 * A short-lived, server-owned confirmation record. The raw execution intent
 * key is never persisted; reviewedFacts contains the exact normalized facts
 * that a later domain command must revalidate before it can execute.
 */
export const agentExecutionIntent = pgTable('agent_execution_intent', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  agentPrincipalId: bigint('agent_principal_id', { mode: 'number' }).notNull(),
  actionName: text('action_name').notNull(),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull(),
  packKey: text('pack_key').notNull(),
  visibility: text('visibility').notNull(),
  locale: text('locale').notNull(),
  filters: jsonb('filters').$type<Record<string, string>>().notNull(),
  selectionDigest: text('selection_digest').notNull(),
  resourceVersionDigest: text('resource_version_digest').notNull(),
  payloadDigest: text('payload_digest').notNull(),
  reviewedFacts: jsonb('reviewed_facts').$type<Record<string, unknown>>().notNull(),
  intentKeyHash: text('intent_key_hash').notNull(),
  status: text('status').notNull().default('prepared'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  decisionByUserId: bigint('decision_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  decisionReason: text('decision_reason'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.masterFn, t.companyFn],
    foreignColumns: [company.masterFn, company.companyFn],
    name: 'fk_agent_execution_intent_company_master',
  }),
  foreignKey({
    columns: [t.agentPrincipalId, t.masterFn, t.companyFn],
    foreignColumns: [agentPrincipal.id, agentPrincipal.masterFn, agentPrincipal.companyFn],
    name: 'fk_agent_execution_intent_principal_tenant',
  }),
  foreignKey({
    columns: [t.actorUserId, t.companyFn],
    foreignColumns: [userCompany.userId, userCompany.companyFn],
    name: 'fk_agent_execution_intent_actor_membership',
  }),
  foreignKey({
    columns: [t.decisionByUserId, t.companyFn],
    foreignColumns: [userCompany.userId, userCompany.companyFn],
    name: 'fk_agent_execution_intent_decision_membership',
  }),
  uniqueIndex('uq_agent_execution_intent_key')
    .on(t.masterFn, t.companyFn, t.agentPrincipalId, t.intentKeyHash),
  index('idx_agent_execution_intent_actor')
    .on(t.masterFn, t.companyFn, t.actorUserId, t.status, t.id),
  index('idx_agent_execution_intent_expiry')
    .on(t.masterFn, t.companyFn, t.status, t.expiresAt, t.id),
  check(
    'ck_agent_execution_intent_action',
    sql`${t.actionName} in ('receipt_pack.create')`,
  ),
  check(
    'ck_agent_execution_intent_pack_key',
    sql`${t.packKey} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'`,
  ),
  check(
    'ck_agent_execution_intent_visibility',
    sql`${t.visibility} in ('own', 'company')`,
  ),
  check(
    'ck_agent_execution_intent_locale',
    sql`${t.locale} in ('en', 'ms', 'zh', 'ja', 'vi')`,
  ),
  check(
    'ck_agent_execution_intent_json',
    sql`jsonb_typeof(${t.filters}) = 'object' and jsonb_typeof(${t.reviewedFacts}) = 'object'`,
  ),
  check(
    'ck_agent_execution_intent_hashes',
    sql`${t.intentKeyHash} ~ '^[0-9a-f]{64}$'
      and ${t.selectionDigest} ~ '^[0-9a-f]{64}$'
      and ${t.resourceVersionDigest} ~ '^[0-9a-f]{64}$'
      and ${t.payloadDigest} ~ '^[0-9a-f]{64}$'`,
  ),
  check(
    'ck_agent_execution_intent_status',
    sql`${t.status} in ('prepared', 'approved', 'rejected', 'cancelled', 'expired', 'consumed')`,
  ),
  check(
    'ck_agent_execution_intent_decision',
    sql`(
      ${t.status} = 'prepared'
      and ${t.decisionByUserId} is null
      and ${t.decisionReason} is null
      and ${t.decidedAt} is null
    )
    or (
      ${t.status} = 'expired'
      and ${t.decisionByUserId} is null
      and ${t.decisionReason} = 'expired'
      and ${t.decidedAt} is not null
    )
    or (
      ${t.status} in ('approved', 'rejected', 'cancelled', 'consumed')
      and ${t.decisionByUserId} is not null
      and char_length(${t.decisionReason}) between 3 and 1000
      and ${t.decidedAt} is not null
    )`,
  ),
  check('ck_agent_execution_intent_expiry', sql`${t.expiresAt} > ${t.createdAt}`),
  check('ck_agent_execution_intent_version', sql`${t.version} > 0`),
]);
