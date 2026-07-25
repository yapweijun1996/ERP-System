import {
  bigint,
  boolean,
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
  recordStatus: text('record_status').notNull().default('draft'),
  recordVersion: integer('record_version').notNull().default(1),
  voidReason: text('void_reason'),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedByUserId: bigint('voided_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  taxFinalizedAt: timestamp('tax_finalized_at', { withTimezone: true }),
  paperCustodyStatus: text('paper_custody_status').notNull().default('none'),
  paperOriginalReference: text('paper_original_reference'),
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
  check('ck_managed_document_record_status',
    sql`${t.recordStatus} in (
      'draft','submitted','approved','posted','sealed','voided','corrected'
    )`),
  check('ck_managed_document_record_version', sql`${t.recordVersion} > 0`),
  check('ck_managed_document_void',
    sql`(${t.recordStatus} = 'voided'
      and char_length(${t.voidReason}) between 3 and 1000
      and ${t.voidedAt} is not null
      and ${t.voidedByUserId} is not null)
      or (${t.recordStatus} <> 'voided'
        and ${t.voidReason} is null
        and ${t.voidedAt} is null
        and ${t.voidedByUserId} is null)`),
  check('ck_managed_document_tax_finalized',
    sql`${t.taxFinalizedAt} is null
      or ${t.recordStatus} in ('sealed','corrected')`),
  check('ck_managed_document_paper_custody',
    sql`(${t.paperCustodyStatus} = 'none' and ${t.paperOriginalReference} is null)
      or (${t.paperCustodyStatus} in (
          'employee','finance_archive','returned','destroyed'
        )
        and char_length(${t.paperOriginalReference}) between 1 and 160)`),
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
  autoSubmitEnabled: boolean('auto_submit_enabled').notNull().default(false),
  autoSubmitMinConfidence: numeric('auto_submit_min_confidence', {
    precision: 5,
    scale: 4,
  }).notNull().default('0.9800'),
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
  check('ck_document_processing_policy_auto_submit_confidence',
    sql`${t.autoSubmitMinConfidence} between 0.9800 and 1.0000`),
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

/** Immutable extraction candidates with source, model and confidence provenance. */
export const documentExtractionField = pgTable('document_extraction_field', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  extractionId: bigint('extraction_id', { mode: 'number' }).notNull()
    .references(() => documentExtraction.id),
  fieldKey: text('field_key').notNull(),
  candidateNo: integer('candidate_no').notNull().default(1),
  valueText: text('value_text').notNull(),
  normalizedValue: text('normalized_value').notNull(),
  sourceType: text('source_type').notNull(),
  sourceRef: text('source_ref').notNull(),
  model: text('model').notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(),
  critical: boolean('critical').notNull().default(false),
  reviewState: text('review_state').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_document_extraction_field_candidate')
    .on(t.masterFn, t.companyFn, t.extractionId, t.fieldKey, t.candidateNo),
  index('idx_document_extraction_field_review')
    .on(t.masterFn, t.companyFn, t.extractionId, t.reviewState, t.fieldKey),
  check('ck_document_extraction_field_key',
    sql`${t.fieldKey} ~ '^[a-z][a-z0-9_]{1,63}$'`),
  check('ck_document_extraction_field_candidate', sql`${t.candidateNo} > 0`),
  check('ck_document_extraction_field_value',
    sql`char_length(${t.valueText}) between 1 and 4000`),
  check('ck_document_extraction_field_source',
    sql`${t.sourceType} in ('local_ocr','byok_vision','user')
      and char_length(${t.sourceRef}) between 1 and 500`),
  check('ck_document_extraction_field_confidence',
    sql`${t.confidence} between 0.0000 and 1.0000`),
  check('ck_document_extraction_field_review_state',
    sql`${t.reviewState} in ('accepted','low_confidence','conflict')`),
]);

/** Immutable uploader choice captured before any system submission decision. */
export const receiptUploadAuthorization = pgTable('receipt_upload_authorization', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  versionId: bigint('version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  uploaderUserId: bigint('uploader_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  autoSubmitAuthorized: boolean('auto_submit_authorized').notNull().default(false),
  authorizedAt: timestamp('authorized_at', { withTimezone: true }),
  statementVersion: text('statement_version').notNull().default('receipt-auto-submit-v1'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_receipt_upload_authorization_version')
    .on(t.masterFn, t.companyFn, t.versionId),
  check('ck_receipt_upload_authorization',
    sql`(${t.autoSubmitAuthorized} and ${t.authorizedAt} is not null)
      or (not ${t.autoSubmitAuthorized} and ${t.authorizedAt} is null)`),
  check('ck_receipt_upload_authorization_statement',
    sql`${t.statementVersion} = 'receipt-auto-submit-v1'`),
]);

/**
 * Receipt inbox projection. `submitted` is system-only in this slice; claim
 * authoring and employee/Finance submission arrive in EPIC-055.
 */
export const receiptInboxItem = pgTable('receipt_inbox_item', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  versionId: bigint('version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  extractionId: bigint('extraction_id', { mode: 'number' }).notNull()
    .references(() => documentExtraction.id),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  status: text('status').notNull(),
  reviewReasons: jsonb('review_reasons').$type<string[]>().notNull()
    .default(sql`'[]'::jsonb`),
  duplicateOfVersionId: bigint('duplicate_of_version_id', { mode: 'number' })
    .references(() => documentVersion.id),
  submissionKind: text('submission_kind').notNull().default('none'),
  authorizedByUserId: bigint('authorized_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  uploadAuthorizedAt: timestamp('upload_authorized_at', { withTimezone: true }),
  systemActorKey: text('system_actor_key'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_receipt_inbox_version').on(t.masterFn, t.companyFn, t.versionId),
  uniqueIndex('uq_receipt_inbox_extraction').on(t.masterFn, t.companyFn, t.extractionId),
  index('idx_receipt_inbox_owner_status')
    .on(t.masterFn, t.companyFn, t.ownerUserId, t.status, t.id),
  check('ck_receipt_inbox_status',
    sql`${t.status} in ('review_required','ready','submitted')`),
  check('ck_receipt_inbox_submission_kind',
    sql`${t.submissionKind} in ('none','system')`),
  check('ck_receipt_inbox_submission',
    sql`(${t.status} = 'submitted'
      and ${t.submissionKind} = 'system'
      and ${t.authorizedByUserId} is not null
      and ${t.uploadAuthorizedAt} is not null
      and ${t.systemActorKey} = 'receipt-auto-submit-v1'
      and ${t.submittedAt} is not null)
      or (${t.status} <> 'submitted'
        and ${t.submissionKind} = 'none'
        and ${t.authorizedByUserId} is null
        and ${t.uploadAuthorizedAt} is null
        and ${t.systemActorKey} is null
        and ${t.submittedAt} is null)`),
  check('ck_receipt_inbox_version', sql`${t.version} > 0`),
]);

/** Append-only state, legal-hold and paper-custody decision history. */
export const documentGovernanceEvent = pgTable('document_governance_event', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  documentId: bigint('document_id', { mode: 'number' }).notNull()
    .references(() => managedDocument.id),
  eventType: text('event_type').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  reason: text('reason').notNull(),
  actorUserId: bigint('actor_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  recordVersion: integer('record_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_document_governance_event_document')
    .on(t.masterFn, t.companyFn, t.documentId, t.id),
  check('ck_document_governance_event_type',
    sql`${t.eventType} in (
      'submitted','approved','posted','sealed','voided',
      'correction_created','reversal_created',
      'legal_hold_set','legal_hold_released','paper_custody_changed',
      'purge_requested','purge_approved','purge_rejected'
    )`),
  check('ck_document_governance_event_status',
    sql`(${t.fromStatus} is null or ${t.fromStatus} in (
      'draft','submitted','approved','posted','sealed','voided','corrected'
    )) and (${t.toStatus} is null or ${t.toStatus} in (
      'draft','submitted','approved','posted','sealed','voided','corrected'
    ))`),
  check('ck_document_governance_event_reason',
    sql`char_length(${t.reason}) between 3 and 1000`),
  check('ck_document_governance_event_version', sql`${t.recordVersion} > 0`),
]);

/** Immutable link from a posted/sealed version to its correction or reversal version. */
export const documentCorrection = pgTable('document_correction', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  documentId: bigint('document_id', { mode: 'number' }).notNull()
    .references(() => managedDocument.id),
  sourceVersionId: bigint('source_version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  correctionVersionId: bigint('correction_version_id', { mode: 'number' }).notNull()
    .references(() => documentVersion.id),
  kind: text('kind').notNull(),
  reason: text('reason').notNull(),
  createdByUserId: bigint('created_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_document_correction_version')
    .on(t.masterFn, t.companyFn, t.correctionVersionId),
  index('idx_document_correction_source')
    .on(t.masterFn, t.companyFn, t.sourceVersionId, t.id),
  check('ck_document_correction_kind', sql`${t.kind} in ('correction','reversal')`),
  check('ck_document_correction_reason',
    sql`char_length(${t.reason}) between 3 and 1000`),
  check('ck_document_correction_versions',
    sql`${t.sourceVersionId} <> ${t.correctionVersionId}`),
]);

/** Two-person permanent-purge approval that survives content deletion. */
export const documentPurgeRequest = pgTable('document_purge_request', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  documentId: bigint('document_id', { mode: 'number' }).notNull(),
  documentKeyHash: text('document_key_hash').notNull(),
  finalSha256: text('final_sha256').notNull(),
  retentionUntil: timestamp('retention_until', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('pending_finance'),
  initiatedByUserId: bigint('initiated_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  initiatedAt: timestamp('initiated_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedByUserId: bigint('reviewed_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  reviewReason: text('review_reason'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  executedByUserId: bigint('executed_by_user_id', { mode: 'number' })
    .references(() => appUser.userId),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  ...timestamps,
}, (t) => [
  uniqueIndex('uq_document_purge_request_document')
    .on(t.masterFn, t.companyFn, t.documentId),
  uniqueIndex('uq_document_purge_request_key_hash')
    .on(t.masterFn, t.companyFn, t.documentKeyHash),
  index('idx_document_purge_request_status')
    .on(t.masterFn, t.companyFn, t.status, t.id),
  check('ck_document_purge_request_hashes',
    sql`char_length(${t.documentKeyHash}) = 64
      and ${t.documentKeyHash} ~ '^[0-9a-f]{64}$'
      and char_length(${t.finalSha256}) = 64
      and ${t.finalSha256} ~ '^[0-9a-f]{64}$'`),
  check('ck_document_purge_request_status',
    sql`${t.status} in ('pending_finance','approved','rejected','executed')`),
  check('ck_document_purge_request_review',
    sql`(${t.status} = 'pending_finance'
      and ${t.reviewedByUserId} is null
      and ${t.reviewReason} is null
      and ${t.reviewedAt} is null)
      or (${t.status} in ('approved','rejected','executed')
        and ${t.reviewedByUserId} is not null
        and ${t.reviewedByUserId} <> ${t.initiatedByUserId}
        and char_length(${t.reviewReason}) between 3 and 1000
        and ${t.reviewedAt} is not null)`),
  check('ck_document_purge_request_execution',
    sql`(${t.status} = 'executed'
      and ${t.executedByUserId} is not null
      and ${t.executedAt} is not null)
      or (${t.status} <> 'executed'
        and ${t.executedByUserId} is null
        and ${t.executedAt} is null)`),
  check('ck_document_purge_request_version', sql`${t.version} > 0`),
]);

/** Permanent non-content proof retained after an authorized purge. */
export const documentTombstone = pgTable('document_tombstone', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ...tenant,
  purgeRequestId: bigint('purge_request_id', { mode: 'number' }).notNull()
    .references(() => documentPurgeRequest.id),
  originalDocumentId: bigint('original_document_id', { mode: 'number' }).notNull(),
  documentKeyHash: text('document_key_hash').notNull(),
  purpose: text('purpose').notNull(),
  ownerHash: text('owner_hash').notNull(),
  finalSha256: text('final_sha256').notNull(),
  versionManifest: jsonb('version_manifest').$type<Array<{
    versionNo: number;
    sha256: string;
    mimeType: string;
    sizeBytes: number;
    pageCount: number;
  }>>().notNull(),
  retentionUntil: timestamp('retention_until', { withTimezone: true }).notNull(),
  finalPaperCustodyStatus: text('final_paper_custody_status').notNull(),
  initiatedByUserId: bigint('initiated_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  reviewedByUserId: bigint('reviewed_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  executedByUserId: bigint('executed_by_user_id', { mode: 'number' }).notNull()
    .references(() => appUser.userId),
  purgedAt: timestamp('purged_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_document_tombstone_request').on(t.purgeRequestId),
  uniqueIndex('uq_document_tombstone_key_hash')
    .on(t.masterFn, t.companyFn, t.documentKeyHash),
  check('ck_document_tombstone_hashes',
    sql`char_length(${t.documentKeyHash}) = 64
      and ${t.documentKeyHash} ~ '^[0-9a-f]{64}$'
      and char_length(${t.ownerHash}) = 64
      and ${t.ownerHash} ~ '^[0-9a-f]{64}$'
      and char_length(${t.finalSha256}) = 64
      and ${t.finalSha256} ~ '^[0-9a-f]{64}$'`),
  check('ck_document_tombstone_purpose',
    sql`${t.purpose} in ('receipt','leave_evidence','tax_evidence','other')`),
  check('ck_document_tombstone_paper',
    sql`${t.finalPaperCustodyStatus} in (
      'none','employee','finance_archive','returned','destroyed'
    )`),
  check('ck_document_tombstone_two_person',
    sql`${t.initiatedByUserId} <> ${t.reviewedByUserId}`),
]);
