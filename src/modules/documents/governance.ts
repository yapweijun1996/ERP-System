import { createHash } from 'node:crypto';
import {
  and,
  eq,
  inArray,
  sql,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  documentCorrection,
  documentExtraction,
  documentExtractionField,
  documentGovernanceEvent,
  documentPurgeRequest,
  documentScanJob,
  documentTombstone,
  documentVersion,
  managedDocument,
  outboxEvent,
  receiptInboxItem,
  receiptUploadAuthorization,
} from '../../data/schema';
import {
  createDocumentStorageRegistry,
  type DocumentStorageRegistry,
  type StorageRemoveReceipt,
  type StoredDocumentVersion,
} from './storage';

type RecordStatus = 'draft' | 'submitted' | 'approved' | 'posted'
  | 'sealed' | 'voided' | 'corrected';

export interface DocumentGovernanceActor {
  userId: number;
  canManage?: boolean;
}

export class DocumentGovernanceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'DocumentGovernanceError';
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function reasonText(value: string, label = 'reason'): string {
  const reason = value?.trim();
  if (!reason || reason.length < 3 || reason.length > 1000) {
    throw new DocumentGovernanceError(
      `document_${label}_invalid`,
      `A ${label.replaceAll('_', ' ')} of 3–1000 characters is required.`,
      422,
    );
  }
  return reason;
}

async function lockedDocument(exec: DB, scope: Scope, documentId: number) {
  const [document] = await exec.select().from(managedDocument).where(and(
    eq(managedDocument.masterFn, scope.masterFn),
    eq(managedDocument.companyFn, scope.companyFn),
    eq(managedDocument.id, documentId),
  )).limit(1).for('update');
  if (!document) {
    throw new DocumentGovernanceError(
      'document_missing',
      'Managed document is unavailable in the active company.',
      404,
    );
  }
  return document;
}

function assertOwnerOrManager(
  actor: DocumentGovernanceActor,
  ownerUserId: number,
): void {
  if (actor.userId !== ownerUserId && !actor.canManage) {
    throw new DocumentGovernanceError(
      'document_access_denied',
      'This document belongs to another user.',
      403,
    );
  }
}

async function appendEvent(
  exec: DB,
  scope: Scope,
  input: {
    documentId: number;
    eventType: typeof documentGovernanceEvent.$inferInsert.eventType;
    fromStatus?: string | null;
    toStatus?: string | null;
    reason: string;
    actorUserId: number;
    recordVersion: number;
  },
) {
  await exec.insert(documentGovernanceEvent).values({
    ...scope,
    ...input,
  });
}

const TRANSITIONS: Partial<Record<RecordStatus, RecordStatus[]>> = {
  draft: ['submitted'],
  submitted: ['approved'],
  approved: ['posted'],
  posted: ['sealed'],
};

export async function transitionDocumentRecordWithin(
  exec: DB,
  scope: Scope,
  actor: DocumentGovernanceActor,
  documentId: number,
  expectedVersion: number,
  targetStatus: 'submitted' | 'approved' | 'posted' | 'sealed',
  reasonValue: string,
  now = new Date(),
) {
  const reason = reasonText(reasonValue);
  const document = await lockedDocument(exec, scope, documentId);
  assertOwnerOrManager(actor, document.ownerUserId);
  if (document.recordVersion !== expectedVersion) {
    throw new DocumentGovernanceError(
      'document_record_version_conflict',
      'Document governance state changed before this action.',
    );
  }
  const allowed = TRANSITIONS[document.recordStatus as RecordStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    throw new DocumentGovernanceError(
      'document_transition_invalid',
      `Document cannot move from ${document.recordStatus} to ${targetStatus}.`,
    );
  }
  const [updated] = await exec.update(managedDocument).set({
    recordStatus: targetStatus,
    recordVersion: sql`${managedDocument.recordVersion} + 1`,
    taxFinalizedAt: targetStatus === 'sealed' ? now : document.taxFinalizedAt,
  }).where(and(
    eq(managedDocument.id, document.id),
    eq(managedDocument.recordVersion, expectedVersion),
  )).returning();
  if (!updated) {
    throw new DocumentGovernanceError(
      'document_record_version_conflict',
      'Document governance state changed before this action.',
    );
  }
  await appendEvent(exec, scope, {
    documentId,
    eventType: targetStatus === 'sealed' ? 'sealed' : targetStatus,
    fromStatus: document.recordStatus,
    toStatus: targetStatus,
    reason,
    actorUserId: actor.userId,
    recordVersion: updated.recordVersion,
  });
  return updated;
}

export async function markDocumentSystemSubmittedWithin(
  exec: DB,
  scope: Scope,
  documentId: number,
  uploaderUserId: number,
  now = new Date(),
) {
  const document = await lockedDocument(exec, scope, documentId);
  if (document.ownerUserId !== uploaderUserId) {
    throw new DocumentGovernanceError(
      'document_auto_submit_actor_invalid',
      'System submission must act for the authenticated uploader.',
      403,
    );
  }
  if (document.recordStatus === 'submitted') return document;
  if (document.recordStatus !== 'draft') {
    throw new DocumentGovernanceError(
      'document_auto_submit_state_invalid',
      'Only a draft receipt may be submitted automatically.',
    );
  }
  const [updated] = await exec.update(managedDocument).set({
    recordStatus: 'submitted',
    recordVersion: sql`${managedDocument.recordVersion} + 1`,
    updatedAt: now,
  }).where(and(
    eq(managedDocument.id, document.id),
    eq(managedDocument.recordVersion, document.recordVersion),
  )).returning();
  if (!updated) {
    throw new DocumentGovernanceError(
      'document_record_version_conflict',
      'Document governance state changed before system submission.',
    );
  }
  await appendEvent(exec, scope, {
    documentId,
    eventType: 'submitted',
    fromStatus: 'draft',
    toStatus: 'submitted',
    reason: 'System auto-submission after governed receipt checks.',
    actorUserId: uploaderUserId,
    recordVersion: updated.recordVersion,
  });
  return updated;
}

export async function voidDocumentRecordWithin(
  exec: DB,
  scope: Scope,
  actor: DocumentGovernanceActor,
  documentId: number,
  expectedVersion: number,
  reasonValue: string,
  now = new Date(),
) {
  const reason = reasonText(reasonValue, 'void_reason');
  const document = await lockedDocument(exec, scope, documentId);
  assertOwnerOrManager(actor, document.ownerUserId);
  if (document.recordVersion !== expectedVersion) {
    throw new DocumentGovernanceError(
      'document_record_version_conflict',
      'Document governance state changed before this action.',
    );
  }
  if (document.recordStatus === 'draft') {
    throw new DocumentGovernanceError(
      'document_draft_delete_required',
      'Unsubmitted drafts must use direct draft deletion.',
    );
  }
  if (['posted', 'sealed'].includes(document.recordStatus)) {
    throw new DocumentGovernanceError(
      'document_correction_required',
      'Posted or sealed records require a correction or reversal version.',
    );
  }
  if (!['submitted', 'approved'].includes(document.recordStatus)) {
    throw new DocumentGovernanceError(
      'document_void_invalid',
      `A ${document.recordStatus} document cannot be voided.`,
    );
  }
  const [updated] = await exec.update(managedDocument).set({
    recordStatus: 'voided',
    recordVersion: sql`${managedDocument.recordVersion} + 1`,
    voidReason: reason,
    voidedAt: now,
    voidedByUserId: actor.userId,
    updatedAt: now,
  }).where(and(
    eq(managedDocument.id, document.id),
    eq(managedDocument.recordVersion, expectedVersion),
  )).returning();
  if (!updated) {
    throw new DocumentGovernanceError(
      'document_record_version_conflict',
      'Document governance state changed before this action.',
    );
  }
  await appendEvent(exec, scope, {
    documentId,
    eventType: 'voided',
    fromStatus: document.recordStatus,
    toStatus: 'voided',
    reason,
    actorUserId: actor.userId,
    recordVersion: updated.recordVersion,
  });
  return updated;
}

export async function setDocumentLegalHoldWithin(
  exec: DB,
  scope: Scope,
  actor: DocumentGovernanceActor,
  documentId: number,
  expectedVersion: number,
  legalHold: boolean,
  reasonValue: string,
) {
  const reason = reasonText(reasonValue, 'legal_hold_reason');
  const document = await lockedDocument(exec, scope, documentId);
  if (!actor.canManage) {
    throw new DocumentGovernanceError(
      'document_governance_permission_required',
      'Document governance permission is required.',
      403,
    );
  }
  if (document.recordVersion !== expectedVersion) {
    throw new DocumentGovernanceError(
      'document_record_version_conflict',
      'Document governance state changed before this action.',
    );
  }
  if (document.legalHold === legalHold) return document;
  const [updated] = await exec.update(managedDocument).set({
    legalHold,
    recordVersion: sql`${managedDocument.recordVersion} + 1`,
  }).where(and(
    eq(managedDocument.id, document.id),
    eq(managedDocument.recordVersion, expectedVersion),
  )).returning();
  await appendEvent(exec, scope, {
    documentId,
    eventType: legalHold ? 'legal_hold_set' : 'legal_hold_released',
    fromStatus: document.recordStatus,
    toStatus: document.recordStatus,
    reason,
    actorUserId: actor.userId,
    recordVersion: updated.recordVersion,
  });
  return updated;
}

export async function setDocumentPaperCustodyWithin(
  exec: DB,
  scope: Scope,
  actor: DocumentGovernanceActor,
  documentId: number,
  expectedVersion: number,
  input: {
    status: 'none' | 'employee' | 'finance_archive' | 'returned' | 'destroyed';
    reference?: string | null;
    reason: string;
  },
) {
  const reason = reasonText(input.reason, 'paper_custody_reason');
  const reference = input.reference?.trim() || null;
  if ((input.status === 'none' && reference)
    || (input.status !== 'none' && (!reference || reference.length > 160))) {
    throw new DocumentGovernanceError(
      'document_paper_custody_invalid',
      'Paper custody requires a bounded reference except when status is none.',
      422,
    );
  }
  const document = await lockedDocument(exec, scope, documentId);
  if (!actor.canManage) {
    throw new DocumentGovernanceError(
      'document_governance_permission_required',
      'Document governance permission is required.',
      403,
    );
  }
  if (document.recordVersion !== expectedVersion) {
    throw new DocumentGovernanceError(
      'document_record_version_conflict',
      'Document governance state changed before this action.',
    );
  }
  const [updated] = await exec.update(managedDocument).set({
    paperCustodyStatus: input.status,
    paperOriginalReference: reference,
    recordVersion: sql`${managedDocument.recordVersion} + 1`,
  }).where(and(
    eq(managedDocument.id, document.id),
    eq(managedDocument.recordVersion, expectedVersion),
  )).returning();
  await appendEvent(exec, scope, {
    documentId,
    eventType: 'paper_custody_changed',
    fromStatus: document.recordStatus,
    toStatus: document.recordStatus,
    reason,
    actorUserId: actor.userId,
    recordVersion: updated.recordVersion,
  });
  return updated;
}

function versionContract(
  row: typeof documentVersion.$inferSelect,
): StoredDocumentVersion {
  return {
    id: row.id,
    documentId: row.documentId,
    versionNo: row.versionNo,
    sha256: row.sha256,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    pageCount: row.pageCount,
    storageBackend: row.storageBackend as 'database' | 'filesystem',
  };
}

async function removeDocumentDependenciesWithin(
  exec: DB,
  scope: Scope,
  documentId: number,
  versions: Array<typeof documentVersion.$inferSelect>,
  registry: DocumentStorageRegistry,
  receipts: StorageRemoveReceipt[],
) {
  const versionIds = versions.map((version) => version.id);
  const inboxes = versionIds.length
    ? await exec.select({ id: receiptInboxItem.id }).from(receiptInboxItem).where(and(
      eq(receiptInboxItem.masterFn, scope.masterFn),
      eq(receiptInboxItem.companyFn, scope.companyFn),
      inArray(receiptInboxItem.versionId, versionIds),
    ))
    : [];
  if (inboxes.length) {
    await exec.delete(outboxEvent).where(and(
      eq(outboxEvent.masterFn, scope.masterFn),
      eq(outboxEvent.companyFn, scope.companyFn),
      eq(outboxEvent.aggregateType, 'receipt_inbox_item'),
      inArray(outboxEvent.aggregateId, inboxes.map((row) => String(row.id))),
    ));
  }
  if (versionIds.length) {
    await exec.delete(outboxEvent).where(and(
      eq(outboxEvent.masterFn, scope.masterFn),
      eq(outboxEvent.companyFn, scope.companyFn),
      eq(outboxEvent.aggregateType, 'document_version'),
      inArray(outboxEvent.aggregateId, versionIds.map(String)),
    ));
    const extractions = await exec.select({ id: documentExtraction.id })
      .from(documentExtraction).where(and(
        eq(documentExtraction.masterFn, scope.masterFn),
        eq(documentExtraction.companyFn, scope.companyFn),
        inArray(documentExtraction.versionId, versionIds),
      ));
    if (extractions.length) {
      await exec.delete(documentExtractionField).where(and(
        eq(documentExtractionField.masterFn, scope.masterFn),
        eq(documentExtractionField.companyFn, scope.companyFn),
        inArray(documentExtractionField.extractionId, extractions.map((row) => row.id)),
      ));
    }
    await exec.update(receiptInboxItem).set({
      duplicateOfVersionId: null,
    }).where(and(
      eq(receiptInboxItem.masterFn, scope.masterFn),
      eq(receiptInboxItem.companyFn, scope.companyFn),
      inArray(receiptInboxItem.duplicateOfVersionId, versionIds),
    ));
    await exec.delete(receiptInboxItem).where(and(
      eq(receiptInboxItem.masterFn, scope.masterFn),
      eq(receiptInboxItem.companyFn, scope.companyFn),
      inArray(receiptInboxItem.versionId, versionIds),
    ));
    await exec.delete(receiptUploadAuthorization).where(and(
      eq(receiptUploadAuthorization.masterFn, scope.masterFn),
      eq(receiptUploadAuthorization.companyFn, scope.companyFn),
      inArray(receiptUploadAuthorization.versionId, versionIds),
    ));
    await exec.delete(documentExtraction).where(and(
      eq(documentExtraction.masterFn, scope.masterFn),
      eq(documentExtraction.companyFn, scope.companyFn),
      inArray(documentExtraction.versionId, versionIds),
    ));
    await exec.delete(documentScanJob).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      inArray(documentScanJob.versionId, versionIds),
    ));
  }
  await exec.delete(documentCorrection).where(and(
    eq(documentCorrection.masterFn, scope.masterFn),
    eq(documentCorrection.companyFn, scope.companyFn),
    eq(documentCorrection.documentId, documentId),
  ));
  await exec.delete(documentGovernanceEvent).where(and(
    eq(documentGovernanceEvent.masterFn, scope.masterFn),
    eq(documentGovernanceEvent.companyFn, scope.companyFn),
    eq(documentGovernanceEvent.documentId, documentId),
  ));
  for (const version of versions) {
    receipts.push(await registry.get(
      version.storageBackend as 'database' | 'filesystem',
    ).removeWithin(exec, scope, versionContract(version)));
  }
  if (versionIds.length) {
    await exec.delete(documentVersion).where(and(
      eq(documentVersion.masterFn, scope.masterFn),
      eq(documentVersion.companyFn, scope.companyFn),
      inArray(documentVersion.id, versionIds),
    ));
  }
}

async function finalizeRemovalReceipts(
  receipts: StorageRemoveReceipt[],
  outcome: 'commit' | 'rollback',
) {
  for (const receipt of receipts) await receipt[outcome]?.();
}

export async function deleteUnsubmittedDocument(
  db: DB,
  scope: Scope,
  actor: DocumentGovernanceActor,
  documentId: number,
  registry = createDocumentStorageRegistry(),
) {
  const receipts: StorageRemoveReceipt[] = [];
  try {
    const result = await withTenantTransaction(db, scope, async (tx) => {
      const document = await lockedDocument(tx, scope, documentId);
      assertOwnerOrManager(actor, document.ownerUserId);
      if (document.recordStatus !== 'draft') {
        throw new DocumentGovernanceError(
          'document_direct_delete_forbidden',
          'Only an unsubmitted draft may be directly deleted.',
        );
      }
      const versions = await tx.select().from(documentVersion).where(and(
        eq(documentVersion.masterFn, scope.masterFn),
        eq(documentVersion.companyFn, scope.companyFn),
        eq(documentVersion.documentId, document.id),
      ));
      await tx.execute(sql`
        select set_config('app.document_governance_delete', 'on', true)
      `);
      await removeDocumentDependenciesWithin(
        tx, scope, document.id, versions, registry, receipts,
      );
      await tx.delete(managedDocument).where(eq(managedDocument.id, document.id));
      return { id: document.id, deleted: true };
    });
    await finalizeRemovalReceipts(receipts, 'commit');
    return result;
  } catch (error) {
    await finalizeRemovalReceipts(receipts, 'rollback');
    throw error;
  }
}

export async function initiateDocumentPurgeWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  documentId: number,
  reasonValue: string,
  now = new Date(),
) {
  const reason = reasonText(reasonValue, 'purge_reason');
  const document = await lockedDocument(exec, scope, documentId);
  if (document.recordStatus === 'draft') {
    throw new DocumentGovernanceError(
      'document_draft_delete_required',
      'Unsubmitted drafts must use direct draft deletion.',
    );
  }
  if (document.legalHold) {
    throw new DocumentGovernanceError(
      'document_legal_hold',
      'Legal hold blocks permanent purge.',
    );
  }
  if (document.retentionUntil.getTime() > now.getTime()) {
    throw new DocumentGovernanceError(
      'document_retention_active',
      'Document retention has not expired.',
    );
  }
  if (['employee', 'finance_archive'].includes(document.paperCustodyStatus)) {
    throw new DocumentGovernanceError(
      'document_paper_original_held',
      'Paper-original custody must be returned or destroyed before purge.',
    );
  }
  const [current] = await exec.select({ sha256: documentVersion.sha256 })
    .from(documentVersion).where(and(
      eq(documentVersion.masterFn, scope.masterFn),
      eq(documentVersion.companyFn, scope.companyFn),
      eq(documentVersion.documentId, document.id),
      eq(documentVersion.versionNo, document.currentVersionNo),
    )).limit(1);
  if (!current) {
    throw new DocumentGovernanceError(
      'document_version_missing',
      'The current document version is unavailable.',
      404,
    );
  }
  const [request] = await exec.insert(documentPurgeRequest).values({
    ...scope,
    documentId: document.id,
    documentKeyHash: hash(document.documentKey),
    finalSha256: current.sha256,
    retentionUntil: document.retentionUntil,
    initiatedByUserId: actorUserId,
  }).returning();
  await appendEvent(exec, scope, {
    documentId,
    eventType: 'purge_requested',
    fromStatus: document.recordStatus,
    toStatus: document.recordStatus,
    reason,
    actorUserId,
    recordVersion: document.recordVersion,
  });
  return request;
}

export async function reviewDocumentPurgeWithin(
  exec: DB,
  scope: Scope,
  reviewerUserId: number,
  requestId: number,
  expectedVersion: number,
  decision: 'approve' | 'reject',
  reasonValue: string,
  now = new Date(),
) {
  const reason = reasonText(reasonValue, 'purge_review_reason');
  const [request] = await exec.select().from(documentPurgeRequest).where(and(
    eq(documentPurgeRequest.masterFn, scope.masterFn),
    eq(documentPurgeRequest.companyFn, scope.companyFn),
    eq(documentPurgeRequest.id, requestId),
  )).limit(1).for('update');
  if (!request) {
    throw new DocumentGovernanceError(
      'document_purge_request_missing',
      'Document purge request is unavailable.',
      404,
    );
  }
  if (request.status !== 'pending_finance' || request.version !== expectedVersion) {
    throw new DocumentGovernanceError(
      'document_purge_request_conflict',
      'Document purge request is no longer pending at this version.',
    );
  }
  if (request.initiatedByUserId === reviewerUserId) {
    throw new DocumentGovernanceError(
      'document_purge_two_person_required',
      'Finance reviewer must be different from the records-manager initiator.',
      403,
    );
  }
  const document = await lockedDocument(exec, scope, request.documentId);
  if (decision === 'approve' && document.legalHold) {
    throw new DocumentGovernanceError(
      'document_legal_hold',
      'Legal hold blocks permanent purge.',
    );
  }
  const status = decision === 'approve' ? 'approved' : 'rejected';
  const [updated] = await exec.update(documentPurgeRequest).set({
    status,
    reviewedByUserId: reviewerUserId,
    reviewReason: reason,
    reviewedAt: now,
    version: sql`${documentPurgeRequest.version} + 1`,
  }).where(and(
    eq(documentPurgeRequest.id, request.id),
    eq(documentPurgeRequest.version, expectedVersion),
  )).returning();
  await appendEvent(exec, scope, {
    documentId: document.id,
    eventType: decision === 'approve' ? 'purge_approved' : 'purge_rejected',
    fromStatus: document.recordStatus,
    toStatus: document.recordStatus,
    reason,
    actorUserId: reviewerUserId,
    recordVersion: document.recordVersion,
  });
  return updated;
}

export async function executeDocumentPurge(
  db: DB,
  scope: Scope,
  actorUserId: number,
  documentId: number,
  requestId: number,
  expectedVersion: number,
  registry = createDocumentStorageRegistry(),
  now = new Date(),
) {
  const receipts: StorageRemoveReceipt[] = [];
  try {
    const result = await withTenantTransaction(db, scope, async (tx) => {
      const [request] = await tx.select().from(documentPurgeRequest).where(and(
        eq(documentPurgeRequest.masterFn, scope.masterFn),
        eq(documentPurgeRequest.companyFn, scope.companyFn),
        eq(documentPurgeRequest.id, requestId),
      )).limit(1).for('update');
      if (!request || request.status !== 'approved'
        || request.version !== expectedVersion
        || request.documentId !== documentId
        || !request.reviewedByUserId) {
        throw new DocumentGovernanceError(
          'document_purge_request_conflict',
          'An approved Finance-reviewed purge request is required.',
        );
      }
      const document = await lockedDocument(tx, scope, request.documentId);
      if (document.legalHold) {
        throw new DocumentGovernanceError(
          'document_legal_hold',
          'Legal hold blocks permanent purge.',
        );
      }
      if (document.retentionUntil.getTime() > now.getTime()) {
        throw new DocumentGovernanceError(
          'document_retention_active',
          'Document retention has not expired.',
        );
      }
      if (['employee', 'finance_archive'].includes(document.paperCustodyStatus)) {
        throw new DocumentGovernanceError(
          'document_paper_original_held',
          'Paper-original custody must be returned or destroyed before purge.',
        );
      }
      const versions = await tx.select().from(documentVersion).where(and(
        eq(documentVersion.masterFn, scope.masterFn),
        eq(documentVersion.companyFn, scope.companyFn),
        eq(documentVersion.documentId, document.id),
      )).orderBy(documentVersion.versionNo);
      if (!versions.length || versions.at(-1)?.sha256 !== request.finalSha256) {
        throw new DocumentGovernanceError(
          'document_purge_integrity_changed',
          'Document versions changed after purge initiation.',
        );
      }
      const [tombstone] = await tx.insert(documentTombstone).values({
        ...scope,
        purgeRequestId: request.id,
        originalDocumentId: document.id,
        documentKeyHash: request.documentKeyHash,
        purpose: document.purpose,
        ownerHash: hash(`${scope.masterFn}\0${scope.companyFn}\0${document.ownerUserId}`),
        finalSha256: request.finalSha256,
        versionManifest: versions.map((version) => ({
          versionNo: version.versionNo,
          sha256: version.sha256,
          mimeType: version.mimeType,
          sizeBytes: version.sizeBytes,
          pageCount: version.pageCount,
        })),
        retentionUntil: document.retentionUntil,
        finalPaperCustodyStatus: document.paperCustodyStatus,
        initiatedByUserId: request.initiatedByUserId,
        reviewedByUserId: request.reviewedByUserId,
        executedByUserId: actorUserId,
        purgedAt: now,
      }).returning();
      await tx.execute(sql`
        select set_config('app.document_governance_delete', 'on', true)
      `);
      await removeDocumentDependenciesWithin(
        tx, scope, document.id, versions, registry, receipts,
      );
      await tx.delete(managedDocument).where(eq(managedDocument.id, document.id));
      const [executed] = await tx.update(documentPurgeRequest).set({
        status: 'executed',
        executedByUserId: actorUserId,
        executedAt: now,
        version: sql`${documentPurgeRequest.version} + 1`,
      }).where(and(
        eq(documentPurgeRequest.id, request.id),
        eq(documentPurgeRequest.version, expectedVersion),
      )).returning();
      return { request: executed, tombstone };
    });
    await finalizeRemovalReceipts(receipts, 'commit');
    return result;
  } catch (error) {
    await finalizeRemovalReceipts(receipts, 'rollback');
    throw error;
  }
}
