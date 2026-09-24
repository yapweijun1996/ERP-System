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
  'submitted', 'triaged', 'in_progress', 'resolved', 'closed',
] as const;

export const productCase = pgTable('product_case', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  caseType: text('case_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  routeKey: text('route_key'),
  referenceId: text('reference_id'),
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
  unique('uq_product_case_tenant_id').on(t.id, t.masterFn, t.companyFn),
  uniqueIndex('uq_product_case_agent_key').on(
    t.masterFn, t.companyFn, t.submittedByAgentId, t.idempotencyHash,
  ),
  index('idx_product_case_queue').on(t.masterFn, t.companyFn, t.status, t.id),
  index('idx_product_case_agent').on(t.masterFn, t.companyFn, t.submittedByAgentId, t.id),
  check('ck_product_case_type', sql`${t.caseType} in ('feedback', 'ticket')`),
  check('ck_product_case_status', sql`${t.status} in ('submitted', 'triaged', 'in_progress', 'resolved', 'closed')`),
  check('ck_product_case_version', sql`${t.version} > 0`),
  check('ck_product_case_title', sql`char_length(${t.title}) between 1 and 160`),
  check('ck_product_case_description', sql`char_length(${t.description}) between 1 and 4000`),
  check('ck_product_case_hash', sql`${t.idempotencyHash} ~ '^[a-f0-9]{64}$'`),
  check('ck_product_case_digest', sql`${t.payloadDigest} ~ '^[a-f0-9]{64}$'`),
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
  note: text('note'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  foreignKey({
    columns: [t.caseId, t.masterFn, t.companyFn],
    foreignColumns: [productCase.id, productCase.masterFn, productCase.companyFn],
    name: 'fk_product_case_event_case',
  }),
  index('idx_product_case_event_case').on(t.masterFn, t.companyFn, t.caseId, t.id),
  check('ck_product_case_event_type', sql`${t.eventType} in ('submitted', 'transitioned')`),
  check('ck_product_case_event_note', sql`${t.note} is null or char_length(${t.note}) <= 1000`),
]);
