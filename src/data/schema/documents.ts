import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenant, timestamps } from './_shared';
import { appUser } from './tenancy';

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
});

/**
 * Database-owned document identity and retention projection. Content providers
 * never own tenant, ownership, integrity, version or retention metadata.
 */
export const managedDocument = pgTable('managed_document', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  documentKey: text('document_key').notNull(),
  purpose: text('purpose').notNull(),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  originalFileName: text('original_file_name').notNull(),
  currentVersionNo: integer('current_version_no').notNull().default(1),
  retentionUntil: timestamp('retention_until', { withTimezone: true }).notNull(),
  legalHold: boolean('legal_hold').notNull().default(false),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_managed_document_key').on(t.masterFn, t.companyFn, t.documentKey),
  index('idx_managed_document_owner').on(t.masterFn, t.companyFn, t.ownerUserId, t.id),
  index('idx_managed_document_retention')
    .on(t.masterFn, t.companyFn, t.legalHold, t.retentionUntil, t.id),
  check('ck_managed_document_purpose',
    sql`${t.purpose} in ('receipt', 'leave_evidence', 'tax_evidence', 'other')`),
  check('ck_managed_document_version', sql`${t.currentVersionNo} > 0`),
  check('ck_managed_document_file_name',
    sql`char_length(${t.originalFileName}) between 1 and 255`),
]);

/** Immutable integrity and backend locator metadata for one content version. */
export const documentVersion = pgTable('document_version', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  documentId: bigint('document_id', { mode: 'number' }).notNull()
    .references(() => managedDocument.id),
  versionNo: integer('version_no').notNull(),
  sha256: text('sha256').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  pageCount: integer('page_count').notNull().default(1),
  storageBackend: text('storage_backend').notNull(),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_document_version')
    .on(t.masterFn, t.companyFn, t.documentId, t.versionNo),
  index('idx_document_version_hash').on(t.masterFn, t.companyFn, t.sha256, t.id),
  check('ck_document_version_no', sql`${t.versionNo} > 0`),
  check('ck_document_version_sha256',
    sql`char_length(${t.sha256}) = 64 and ${t.sha256} ~ '^[0-9a-f]{64}$'`),
  check('ck_document_version_mime',
    sql`char_length(${t.mimeType}) between 3 and 160`),
  check('ck_document_version_size', sql`${t.sizeBytes} > 0`),
  check('ck_document_version_page_count', sql`${t.pageCount} > 0`),
  check('ck_document_version_backend',
    sql`${t.storageBackend} in ('database', 'filesystem')`),
]);

/** Default content backend. Scope columns keep production RLS enforceable. */
export const documentBlob = pgTable('document_blob', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  versionId: bigint('version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  content: bytea('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_document_blob_version').on(t.masterFn, t.companyFn, t.versionId),
]);

/**
 * Optional single-node filesystem locator. The path is relative to the
 * configured root; it is never a tenant or integrity authority.
 */
export const documentFileLocation = pgTable('document_file_location', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  versionId: bigint('version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  relativePath: text('relative_path').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_document_file_location_version')
    .on(t.masterFn, t.companyFn, t.versionId),
  check('ck_document_file_location_relative',
    sql`char_length(${t.relativePath}) between 1 and 500
      and ${t.relativePath} !~ '(^/|(^|/)\\.\\.(/|$))'`),
]);

/** Company extraction policy. Local OCR is the fail-closed default. */
export const documentProcessingPolicy = pgTable('document_processing_policy', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  extractionProvider: text('extraction_provider').notNull().default('local_ocr'),
  visionProvider: text('vision_provider'),
  visionRegion: text('vision_region'),
  visionRetentionDays: integer('vision_retention_days'),
  version: integer('version').notNull().default(1),
  updatedByUserId: bigint('updated_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_document_processing_policy_company').on(t.masterFn, t.companyFn),
  check('ck_document_processing_policy_provider',
    sql`${t.extractionProvider} in ('local_ocr', 'byok_vision')`),
  check('ck_document_processing_policy_vision_provider',
    sql`${t.visionProvider} is null or ${t.visionProvider} in ('openai', 'google')`),
  check('ck_document_processing_policy_vision_config',
    sql`(${t.extractionProvider} = 'local_ocr'
      and ${t.visionProvider} is null
      and ${t.visionRegion} is null
      and ${t.visionRetentionDays} is null)
      or (${t.extractionProvider} = 'byok_vision'
        and char_length(${t.visionProvider}) > 0
        and char_length(${t.visionRegion}) between 2 and 80
        and ${t.visionRetentionDays} between 0 and 365)`),
  check('ck_document_processing_policy_version', sql`${t.version} > 0`),
]);

/** One retryable, leased malware-scan job per immutable document version. */
export const documentScanJob = pgTable('document_scan_job', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  versionId: bigint('version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  status: text('status').notNull().default('queued'),
  scanner: text('scanner'),
  resultCode: text('result_code'),
  attempts: integer('attempts').notNull().default(0),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: text('locked_by'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  lastError: text('last_error'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_document_scan_job_version').on(t.masterFn, t.companyFn, t.versionId),
  index('idx_document_scan_job_queue').on(t.status, t.availableAt, t.lockedAt, t.id),
  check('ck_document_scan_job_status',
    sql`${t.status} in ('queued','scanning','clean','infected','indeterminate','unavailable')`),
  check('ck_document_scan_job_attempts', sql`${t.attempts} >= 0`),
]);

/** Retry-stable extraction result header; field provenance arrives in TASK-120. */
export const documentExtraction = pgTable('document_extraction', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  versionId: bigint('version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  extractionVersion: integer('extraction_version').notNull().default(1),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  status: text('status').notNull().default('queued'),
  rawText: text('raw_text'),
  outputSha256: text('output_sha256'),
  attempts: integer('attempts').notNull().default(0),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: text('locked_by'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  lastError: text('last_error'),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_document_extraction_version')
    .on(t.masterFn, t.companyFn, t.versionId, t.extractionVersion),
  index('idx_document_extraction_queue').on(t.status, t.availableAt, t.lockedAt, t.id),
  check('ck_document_extraction_version', sql`${t.extractionVersion} > 0`),
  check('ck_document_extraction_provider',
    sql`${t.provider} in ('local_ocr','byok_vision')`),
  check('ck_document_extraction_status',
    sql`${t.status} in ('queued','extracting','succeeded','failed','unavailable')`),
  check('ck_document_extraction_attempts', sql`${t.attempts} >= 0`),
  check('ck_document_extraction_output_hash',
    sql`${t.outputSha256} is null or (
      char_length(${t.outputSha256}) = 64
      and ${t.outputSha256} ~ '^[0-9a-f]{64}$'
    )`),
]);
