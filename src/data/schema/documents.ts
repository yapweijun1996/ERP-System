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
