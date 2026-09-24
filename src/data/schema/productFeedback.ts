import {
  pgTable, bigint, text, integer, timestamp, index, uniqueIndex,
  unique, foreignKey, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { company, appUser } from './tenancy';
import { agentPrincipal } from './agent';

export const PRODUCT_CASE_TYPES = ['feedback', 'ticket'] as const;
export const PRODUCT_CASE_STATUSES = [
  'submitted', 'triaged', 'needs_info', 'accepted', 'in_progress',
  'resolved', 'released', 'verified', 'closed',
] as const;

export const productCase = pgTable('product_case', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  caseType: text('case_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  routeKey: text('route_key'),
  referenceId: text('reference_id'),
  category: text('category'),
  assignedUserId: bigint('assigned_user_id', { mode: 'number' }).references(() => appUser.userId),
  duplicateOfCaseId: bigint('duplicate_of_case_id', { mode: 'number' }),
  taskReference: text('task_reference'),
  taskLinkedByUserId: bigint('task_linked_by_user_id', { mode: 'number' }).references(() => appUser.userId),
  releaseRevision: text('release_revision'),
  releaseProofDigest: text('release_proof_digest'),
  releasedByUserId: bigint('released_by_user_id', { mode: 'number' }).references(() => appUser.userId),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  verifiedByUserId: bigint('verified_by_user_id', { mode: 'number' }).references(() => appUser.userId),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  resolutionCode: text('resolution_code'),
  outcomePublishedAt: timestamp('outcome_published_at', { withTimezone: true }),
  status: text('status').notNull().default('submitted'),
  resolution: text('resolution'),
  version: integer('version').notNull().default(1),
  submittedByAgentId: bigint('submitted_by_agent_id', { mode: 'number' }).notNull(),
  accountableOwnerUserId: bigint('accountable_owner_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  idempotencyHash: text('idempotency_hash').notNull(),
  payloadDigest: text('payload_digest').notNull(),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.masterFn, t.companyFn],
    foreignColumns: [company.masterFn, company.companyFn],
    name: 'fk_product_case_company',
  }),
  foreignKey({
    columns: [t.submittedByAgentId, t.masterFn, t.companyFn],
    foreignColumns: [agentPrincipal.id, agentPrincipal.masterFn, agentPrincipal.companyFn],
    name: 'fk_product_case_agent',
  }),
  foreignKey({
    columns: [t.duplicateOfCaseId, t.masterFn, t.companyFn],
    foreignColumns: [t.id, t.masterFn, t.companyFn],
    name: 'fk_product_case_duplicate_same_company',
  }),
  unique('uq_product_case_tenant_id').on(t.id, t.masterFn, t.companyFn),
  uniqueIndex('uq_product_case_agent_key').on(
    t.masterFn, t.companyFn, t.submittedByAgentId, t.idempotencyHash,
  ),
  index('idx_product_case_queue').on(t.masterFn, t.companyFn, t.status, t.id),
  index('idx_product_case_agent').on(t.masterFn, t.companyFn, t.submittedByAgentId, t.id),
  index('idx_product_case_duplicate').on(t.masterFn, t.companyFn, t.duplicateOfCaseId),
  check('ck_product_case_type', sql`${t.caseType} in ('feedback', 'ticket')`),
  check('ck_product_case_status', sql`${t.status} in ('submitted', 'triaged', 'needs_info', 'accepted', 'in_progress', 'resolved', 'released', 'verified', 'closed')`),
  check('ck_product_case_category', sql`${t.category} is null or ${t.category} in ('defect', 'usability', 'improvement')`),
  check('ck_product_case_resolution_code', sql`${t.resolutionCode} is null or ${t.resolutionCode} in ('fixed', 'duplicate', 'not_reproducible', 'declined', 'answered')`),
  check('ck_product_case_duplicate_not_self', sql`${t.duplicateOfCaseId} is null or ${t.duplicateOfCaseId} <> ${t.id}`),
  check('ck_product_case_task_reference', sql`${t.taskReference} is null or char_length(${t.taskReference}) between 4 and 160`),
  check('ck_product_case_release_revision', sql`${t.releaseRevision} is null or ${t.releaseRevision} ~ '^[a-f0-9]{40}$'`),
  check('ck_product_case_release_proof', sql`${t.releaseProofDigest} is null or ${t.releaseProofDigest} ~ '^[a-f0-9]{64}$'`),
  check('ck_product_case_release_pair', sql`(${t.releaseRevision} is null) = (${t.releaseProofDigest} is null)`),
  check('ck_product_case_released', sql`${t.status} not in ('released', 'verified') or (${t.releaseRevision} is not null and ${t.releaseProofDigest} is not null and ${t.releasedByUserId} is not null and ${t.releasedAt} is not null)`),
  check('ck_product_case_verified', sql`${t.status} <> 'verified' or (${t.verifiedByUserId} is not null and ${t.verifiedAt} is not null)`),
  check('ck_product_case_verifier_pair', sql`(${t.verifiedByUserId} is null) = (${t.verifiedAt} is null)`),
  check('ck_product_case_version', sql`${t.version} > 0`),
  check('ck_product_case_title', sql`char_length(${t.title}) between 1 and 160`),
  check('ck_product_case_description', sql`char_length(${t.description}) between 1 and 4000`),
  check('ck_product_case_hash', sql`${t.idempotencyHash} ~ '^[a-f0-9]{64}$'`),
  check('ck_product_case_digest', sql`${t.payloadDigest} ~ '^[a-f0-9]{64}$'`),
]);

export const productCaseEvidence = pgTable('product_case_evidence', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  caseId: bigint('case_id', { mode: 'number' }).notNull(),
  kind: text('kind').notNull(),
  visibility: text('visibility').notNull(),
  summary: text('summary').notNull(),
  contentDigest: text('content_digest').notNull(),
  idempotencyHash: text('idempotency_hash'),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).references(() => appUser.userId),
  agentPrincipalId: bigint('agent_principal_id', { mode: 'number' }),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.caseId, t.masterFn, t.companyFn],
    foreignColumns: [productCase.id, productCase.masterFn, productCase.companyFn],
    name: 'fk_product_case_evidence_case',
  }),
  foreignKey({
    columns: [t.agentPrincipalId, t.masterFn, t.companyFn],
    foreignColumns: [agentPrincipal.id, agentPrincipal.masterFn, agentPrincipal.companyFn],
    name: 'fk_product_case_evidence_agent',
  }),
  unique('uq_product_case_evidence_tenant_case_id').on(t.id, t.masterFn, t.companyFn, t.caseId),
  uniqueIndex('uq_product_case_evidence_agent_key').on(
    t.masterFn, t.companyFn, t.caseId, t.agentPrincipalId, t.idempotencyHash,
  ),
  index('idx_product_case_evidence_case').on(t.masterFn, t.companyFn, t.caseId, t.id),
  check('ck_product_case_evidence_kind', sql`${t.kind} in ('agent_observation', 'agent_reproduction', 'human_reproduction', 'post_release_verification')`),
  check('ck_product_case_evidence_visibility', sql`${t.visibility} in ('reporter', 'internal')`),
  check('ck_product_case_evidence_summary', sql`char_length(${t.summary}) between 1 and 1000`),
  check('ck_product_case_evidence_digest', sql`${t.contentDigest} ~ '^[a-f0-9]{64}$'`),
  check('ck_product_case_evidence_key', sql`${t.idempotencyHash} is null or ${t.idempotencyHash} ~ '^[a-f0-9]{64}$'`),
  check('ck_product_case_evidence_actor', sql`(
    (${t.kind} in ('agent_observation', 'agent_reproduction') and ${t.agentPrincipalId} is not null and ${t.idempotencyHash} is not null and ${t.visibility} = 'reporter')
    or (${t.kind} in ('human_reproduction', 'post_release_verification') and ${t.agentPrincipalId} is null and ${t.actorUserId} is not null and ${t.idempotencyHash} is null and ${t.visibility} = 'internal')
  )`),
]);

export const productCaseEvent = pgTable('product_case_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  caseId: bigint('case_id', { mode: 'number' }).notNull(),
  eventType: text('event_type').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).references(() => appUser.userId),
  agentPrincipalId: bigint('agent_principal_id', { mode: 'number' }),
  evidenceId: bigint('evidence_id', { mode: 'number' }),
  taskReference: text('task_reference'),
  releaseRevision: text('release_revision'),
  releaseProofDigest: text('release_proof_digest'),
  verificationResult: text('verification_result'),
  resolutionCode: text('resolution_code'),
  duplicateOfCaseId: bigint('duplicate_of_case_id', { mode: 'number' }),
  note: text('note'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.caseId, t.masterFn, t.companyFn],
    foreignColumns: [productCase.id, productCase.masterFn, productCase.companyFn],
    name: 'fk_product_case_event_case',
  }),
  foreignKey({
    columns: [t.evidenceId, t.masterFn, t.companyFn, t.caseId],
    foreignColumns: [productCaseEvidence.id, productCaseEvidence.masterFn, productCaseEvidence.companyFn, productCaseEvidence.caseId],
    name: 'fk_product_case_event_evidence',
  }),
  foreignKey({
    columns: [t.duplicateOfCaseId, t.masterFn, t.companyFn],
    foreignColumns: [productCase.id, productCase.masterFn, productCase.companyFn],
    name: 'fk_product_case_event_duplicate_same_company',
  }),
  index('idx_product_case_event_case').on(t.masterFn, t.companyFn, t.caseId, t.id),
  check('ck_product_case_event_type', sql`${t.eventType} in ('submitted', 'transitioned', 'evidence_added', 'triaged', 'task_linked', 'released', 'verified', 'verification_failed')`),
  check('ck_product_case_event_note', sql`${t.note} is null or char_length(${t.note}) <= 1000`),
  check('ck_product_case_event_verification', sql`${t.verificationResult} is null or ${t.verificationResult} in ('passed', 'failed')`),
  check('ck_product_case_event_evidence', sql`${t.eventType} not in ('evidence_added', 'verified', 'verification_failed') or ${t.evidenceId} is not null`),
  check('ck_product_case_event_release', sql`${t.eventType} <> 'released' or (${t.releaseRevision} is not null and ${t.releaseRevision} ~ '^[a-f0-9]{40}$' and ${t.releaseProofDigest} is not null and ${t.releaseProofDigest} ~ '^[a-f0-9]{64}$')`),
]);
