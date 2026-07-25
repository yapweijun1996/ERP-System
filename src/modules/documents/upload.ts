import { and, desc, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  documentExtraction,
  documentScanJob,
  documentVersion,
  managedDocument,
  receiptInboxItem,
  receiptUploadAuthorization,
} from '../../data/schema';
import {
  createManagedDocument,
  type DocumentActor,
  type DocumentStorageRegistry,
  createDocumentStorageRegistry,
} from './storage';
import {
  ReceiptUploadError,
  validateReceiptUpload,
} from './receiptValidation';
import { enqueueDocumentProcessing } from './processing';
export {
  RECEIPT_UPLOAD_MAX_BYTES,
  RECEIPT_UPLOAD_MAX_PDF_PAGES,
  ReceiptUploadError,
  validateReceiptUpload,
} from './receiptValidation';

export interface ReceiptUploadInput {
  clientDraftId: string;
  fileName: string;
  declaredMimeType: string;
  content: Uint8Array;
  storageBackend?: 'database' | 'filesystem';
  retentionUntil?: Date;
  autoSubmitAuthorized?: boolean;
}

function uploadError(code: string, message: string, status = 422): never {
  throw new ReceiptUploadError(code, message, status);
}

function defaultRetention(now = new Date()): Date {
  const deadline = new Date(now);
  deadline.setUTCFullYear(deadline.getUTCFullYear() + 7);
  return deadline;
}

export async function uploadReceiptDocument(
  db: DB,
  scope: Scope,
  actor: DocumentActor,
  input: ReceiptUploadInput,
  registry: DocumentStorageRegistry = createDocumentStorageRegistry(),
) {
  const clientDraftId = String(input.clientDraftId ?? '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/.test(clientDraftId)) {
    return uploadError(
      'receipt_draft_id_invalid',
      'A stable client draft identifier is required.',
    );
  }
  const validated = await validateReceiptUpload(input);
  const documentKey = `receipt:${actor.userId}:${clientDraftId}`;
  const existingRetention = await withTenantTransaction(db, scope, async (tx) => {
    const [existing] = await tx.select({
      retentionUntil: managedDocument.retentionUntil,
    }).from(managedDocument).where(and(
      eq(managedDocument.masterFn, scope.masterFn),
      eq(managedDocument.companyFn, scope.companyFn),
      eq(managedDocument.documentKey, documentKey),
      eq(managedDocument.ownerUserId, actor.userId),
      eq(managedDocument.purpose, 'receipt'),
    )).limit(1);
    return existing?.retentionUntil;
  });
  const stored = await createManagedDocument(db, scope, actor, {
    documentKey,
    purpose: 'receipt',
    ownerUserId: actor.userId,
    originalFileName: validated.fileName,
    mimeType: validated.mimeType,
    retentionUntil: input.retentionUntil ?? existingRetention ?? defaultRetention(),
    content: validated.content,
    pageCount: validated.pageCount,
    storageBackend: input.storageBackend,
  }, registry);
  const authorization = await withTenantTransaction(db, scope, async (tx) => {
    await tx.insert(receiptUploadAuthorization).values({
      ...scope,
      versionId: stored.version.id,
      uploaderUserId: actor.userId,
      autoSubmitAuthorized: input.autoSubmitAuthorized === true,
      authorizedAt: input.autoSubmitAuthorized === true ? new Date() : null,
    }).onConflictDoNothing();
    await enqueueDocumentProcessing(tx, scope, stored.version.id);
    const [row] = await tx.select().from(receiptUploadAuthorization).where(and(
      eq(receiptUploadAuthorization.masterFn, scope.masterFn),
      eq(receiptUploadAuthorization.companyFn, scope.companyFn),
      eq(receiptUploadAuthorization.versionId, stored.version.id),
    )).limit(1);
    if (!row) throw new Error('Receipt upload authorization was not recorded.');
    return row;
  });
  return {
    ...stored,
    format: validated.format,
    pageCount: validated.pageCount,
    autoSubmitAuthorized: authorization.autoSubmitAuthorized,
  };
}

export async function listReceiptDocuments(
  db: DB,
  scope: Scope,
  actor: DocumentActor,
) {
  return withTenantTransaction(db, scope, (tx) => tx.select({
    id: managedDocument.id,
    documentKey: managedDocument.documentKey,
    originalFileName: managedDocument.originalFileName,
    currentVersionNo: managedDocument.currentVersionNo,
    retentionUntil: managedDocument.retentionUntil,
    legalHold: managedDocument.legalHold,
    recordStatus: managedDocument.recordStatus,
    recordVersion: managedDocument.recordVersion,
    voidReason: managedDocument.voidReason,
    paperCustodyStatus: managedDocument.paperCustodyStatus,
    createdAt: managedDocument.createdAt,
    sha256: documentVersion.sha256,
    mimeType: documentVersion.mimeType,
    sizeBytes: documentVersion.sizeBytes,
    pageCount: documentVersion.pageCount,
    storageBackend: documentVersion.storageBackend,
    scanStatus: documentScanJob.status,
    scanResultCode: documentScanJob.resultCode,
    extractionStatus: documentExtraction.status,
    extractionProvider: documentExtraction.provider,
    inboxStatus: receiptInboxItem.status,
    reviewReasons: receiptInboxItem.reviewReasons,
    duplicateOfVersionId: receiptInboxItem.duplicateOfVersionId,
    submissionKind: receiptInboxItem.submissionKind,
    submittedAt: receiptInboxItem.submittedAt,
    autoSubmitAuthorized: receiptUploadAuthorization.autoSubmitAuthorized,
  }).from(managedDocument).innerJoin(documentVersion, and(
    eq(documentVersion.masterFn, managedDocument.masterFn),
    eq(documentVersion.companyFn, managedDocument.companyFn),
    eq(documentVersion.documentId, managedDocument.id),
    eq(documentVersion.versionNo, managedDocument.currentVersionNo),
  )).leftJoin(documentScanJob, and(
    eq(documentScanJob.masterFn, documentVersion.masterFn),
    eq(documentScanJob.companyFn, documentVersion.companyFn),
    eq(documentScanJob.versionId, documentVersion.id),
  )).leftJoin(documentExtraction, and(
    eq(documentExtraction.masterFn, documentVersion.masterFn),
    eq(documentExtraction.companyFn, documentVersion.companyFn),
    eq(documentExtraction.versionId, documentVersion.id),
    eq(documentExtraction.extractionVersion, 1),
  )).leftJoin(receiptInboxItem, and(
    eq(receiptInboxItem.masterFn, documentVersion.masterFn),
    eq(receiptInboxItem.companyFn, documentVersion.companyFn),
    eq(receiptInboxItem.versionId, documentVersion.id),
  )).leftJoin(receiptUploadAuthorization, and(
    eq(receiptUploadAuthorization.masterFn, documentVersion.masterFn),
    eq(receiptUploadAuthorization.companyFn, documentVersion.companyFn),
    eq(receiptUploadAuthorization.versionId, documentVersion.id),
  )).where(and(
    eq(managedDocument.masterFn, scope.masterFn),
    eq(managedDocument.companyFn, scope.companyFn),
    eq(managedDocument.ownerUserId, actor.userId),
    eq(managedDocument.purpose, 'receipt'),
  )).orderBy(desc(managedDocument.createdAt), desc(managedDocument.id)).limit(100));
}
