import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenant, timestamps } from './_shared';
import { appUser } from './tenancy';
import { documentVersion } from './documents';
import { expensePosting } from './expenses';

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
});

/** Immutable filter result and reconciliation totals used by every tax artifact. */
export const taxEvidenceSnapshot = pgTable('tax_evidence_snapshot', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  snapshotKey: text('snapshot_key').notNull(),
  filters: jsonb('filters').notNull(),
  sourceSha256: text('source_sha256').notNull(),
  rowCount: integer('row_count').notNull(),
  documentCount: integer('document_count').notNull(),
  originalGross: numeric('original_gross', { precision: 18, scale: 2 }).notNull(),
  baseExpense: numeric('base_expense', { precision: 18, scale: 2 }).notNull(),
  baseInputTax: numeric('base_input_tax', { precision: 18, scale: 2 }).notNull(),
  baseGross: numeric('base_gross', { precision: 18, scale: 2 }).notNull(),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_tax_evidence_snapshot_key')
    .on(t.masterFn, t.companyFn, t.snapshotKey),
  index('idx_tax_evidence_snapshot_actor')
    .on(t.masterFn, t.companyFn, t.createdByUserId, t.createdAt, t.id),
  check('ck_tax_evidence_snapshot_key',
    sql`${t.snapshotKey} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'`),
  check('ck_tax_evidence_snapshot_hash',
    sql`char_length(${t.sourceSha256}) = 64
      and ${t.sourceSha256} ~ '^[0-9a-f]{64}$'`),
  check('ck_tax_evidence_snapshot_counts',
    sql`${t.rowCount} > 0 and ${t.documentCount} >= 0`),
  check('ck_tax_evidence_snapshot_totals',
    sql`${t.originalGross} > 0
      and ${t.baseExpense} >= 0
      and ${t.baseInputTax} >= 0
      and ${t.baseGross} = ${t.baseExpense} + ${t.baseInputTax}
      and ${t.baseGross} > 0`),
]);

/** Frozen source row, including category/project/tax/completeness filters. */
export const taxEvidenceSnapshotLine = pgTable('tax_evidence_snapshot_line', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  snapshotId: bigint('snapshot_id', { mode: 'number' }).notNull()
    .references(() => taxEvidenceSnapshot.id),
  ordinal: integer('ordinal').notNull(),
  postingId: bigint('posting_id', { mode: 'number' }).notNull()
    .references(() => expensePosting.id),
  facts: jsonb('facts').notNull(),
  factsSha256: text('facts_sha256').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_tax_evidence_snapshot_line_ordinal')
    .on(t.masterFn, t.companyFn, t.snapshotId, t.ordinal),
  uniqueIndex('uq_tax_evidence_snapshot_line_posting')
    .on(t.masterFn, t.companyFn, t.snapshotId, t.postingId),
  index('idx_tax_evidence_snapshot_line')
    .on(t.masterFn, t.companyFn, t.snapshotId, t.id),
  check('ck_tax_evidence_snapshot_line_ordinal', sql`${t.ordinal} > 0`),
  check('ck_tax_evidence_snapshot_line_hash',
    sql`char_length(${t.factsSha256}) = 64
      and ${t.factsSha256} ~ '^[0-9a-f]{64}$'`),
]);

/** Exact original evidence version frozen into the source snapshot. */
export const taxEvidenceSnapshotDocument = pgTable('tax_evidence_snapshot_document', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  snapshotId: bigint('snapshot_id', { mode: 'number' }).notNull()
    .references(() => taxEvidenceSnapshot.id),
  documentVersionId: bigint('document_version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sha256: text('sha256').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sourcePostingIds: jsonb('source_posting_ids').$type<number[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_tax_evidence_snapshot_document')
    .on(t.masterFn, t.companyFn, t.snapshotId, t.documentVersionId),
  index('idx_tax_evidence_snapshot_document_snapshot')
    .on(t.masterFn, t.companyFn, t.snapshotId, t.id),
  check('ck_tax_evidence_snapshot_document_file',
    sql`char_length(${t.fileName}) between 1 and 255
      and char_length(${t.mimeType}) between 3 and 160`),
  check('ck_tax_evidence_snapshot_document_hash',
    sql`char_length(${t.sha256}) = 64 and ${t.sha256} ~ '^[0-9a-f]{64}$'`),
  check('ck_tax_evidence_snapshot_document_size', sql`${t.sizeBytes} > 0`),
]);

/** Retryable async generation. One job owns one deterministic artifact set. */
export const taxEvidenceReportJob = pgTable('tax_evidence_report_job', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  jobKey: text('job_key').notNull(),
  snapshotId: bigint('snapshot_id', { mode: 'number' }).notNull()
    .references(() => taxEvidenceSnapshot.id),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  locale: text('locale').notNull().default('en'),
  status: text('status').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: text('locked_by'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  artifactSetSha256: text('artifact_set_sha256'),
  lastError: text('last_error'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_tax_evidence_report_job_key')
    .on(t.masterFn, t.companyFn, t.jobKey),
  uniqueIndex('uq_tax_evidence_report_job_snapshot')
    .on(t.masterFn, t.companyFn, t.snapshotId),
  index('idx_tax_evidence_report_job_queue')
    .on(t.status, t.availableAt, t.id),
  index('idx_tax_evidence_report_job_actor')
    .on(t.masterFn, t.companyFn, t.actorUserId, t.createdAt, t.id),
  check('ck_tax_evidence_report_job_key',
    sql`${t.jobKey} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'`),
  check('ck_tax_evidence_report_job_locale',
    sql`${t.locale} in ('en','ms','zh','ja','vi')`),
  check('ck_tax_evidence_report_job_status',
    sql`${t.status} in ('queued','running','succeeded','failed')`),
  check('ck_tax_evidence_report_job_attempts',
    sql`${t.attempts} >= 0 and ${t.attempts} <= 3`),
  check('ck_tax_evidence_report_job_artifact_hash',
    sql`${t.artifactSetSha256} is null
      or (char_length(${t.artifactSetSha256}) = 64
        and ${t.artifactSetSha256} ~ '^[0-9a-f]{64}$')`),
]);

/** Multiple outputs rendered atomically from exactly one snapshot. */
export const taxEvidenceArtifact = pgTable('tax_evidence_artifact', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  jobId: bigint('job_id', { mode: 'number' }).notNull()
    .references(() => taxEvidenceReportJob.id),
  snapshotId: bigint('snapshot_id', { mode: 'number' }).notNull()
    .references(() => taxEvidenceSnapshot.id),
  artifactType: text('artifact_type').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sha256: text('sha256').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  content: bytea('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_tax_evidence_artifact_type')
    .on(t.masterFn, t.companyFn, t.jobId, t.artifactType),
  index('idx_tax_evidence_artifact_snapshot')
    .on(t.masterFn, t.companyFn, t.snapshotId, t.artifactType, t.id),
  check('ck_tax_evidence_artifact_type',
    sql`${t.artifactType} in (
      'register_pdf','merged_pdf','register_xlsx','register_csv',
      'originals_zip','manifest_json'
    )`),
  check('ck_tax_evidence_artifact_file',
    sql`char_length(${t.fileName}) between 5 and 255
      and char_length(${t.mimeType}) between 3 and 160`),
  check('ck_tax_evidence_artifact_hash',
    sql`char_length(${t.sha256}) = 64 and ${t.sha256} ~ '^[0-9a-f]{64}$'`),
  check('ck_tax_evidence_artifact_size', sql`${t.sizeBytes} > 0`),
]);

/** Append-only purpose-bound sensitive artifact access evidence. */
export const taxEvidenceAccessEvent = pgTable('tax_evidence_access_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  artifactId: bigint('artifact_id', { mode: 'number' }).notNull()
    .references(() => taxEvidenceArtifact.id),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  accessKey: text('access_key').notNull(),
  action: text('action').notNull(),
  purpose: text('purpose').notNull(),
  artifactSha256: text('artifact_sha256').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_tax_evidence_access_key')
    .on(t.masterFn, t.companyFn, t.artifactId, t.actorUserId, t.accessKey),
  index('idx_tax_evidence_access_artifact')
    .on(t.masterFn, t.companyFn, t.artifactId, t.occurredAt, t.id),
  check('ck_tax_evidence_access_key',
    sql`${t.accessKey} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'`),
  check('ck_tax_evidence_access_action',
    sql`${t.action} in ('view','download','print','export')`),
  check('ck_tax_evidence_access_purpose',
    sql`char_length(${t.purpose}) between 3 and 500`),
  check('ck_tax_evidence_access_hash',
    sql`char_length(${t.artifactSha256}) = 64
      and ${t.artifactSha256} ~ '^[0-9a-f]{64}$'`),
]);
