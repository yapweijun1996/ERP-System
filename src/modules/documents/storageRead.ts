import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { managedDocument, documentVersion, userCompany } from '../../data/schema';
import type { DocumentActor, DocumentStorageRegistry, StoredDocumentVersion, DocumentStorageBackend } from './storage';
import { DocumentStorageError } from './storageError';

export async function assertOwnerAccess(
  exec: DB,
  scope: Scope,
  actor: DocumentActor,
  ownerUserId: number,
): Promise<void> {
  if (actor.userId !== ownerUserId && !actor.canManage) {
    throw new DocumentStorageError(
      'document_access_denied',
      'This document belongs to another user.',
      403,
    );
  }
  const [membership] = await exec.select({ userId: userCompany.userId })
    .from(userCompany)
    .where(and(
      eq(userCompany.userId, ownerUserId),
      eq(userCompany.companyFn, scope.companyFn),
    ))
    .limit(1);
  if (!membership) {
    throw new DocumentStorageError(
      'document_owner_invalid',
      'Document owner is not a member of the active company.',
      422,
    );
  }
}

export function versionContract(row: typeof documentVersion.$inferSelect): StoredDocumentVersion {
  return {
    id: row.id,
    documentId: row.documentId,
    versionNo: row.versionNo,
    sha256: row.sha256,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    pageCount: row.pageCount,
    storageBackend: row.storageBackend as DocumentStorageBackend,
  };
}

export async function readManagedDocumentWithRegistry(
  exec: DB,
  scope: Scope,
  actor: DocumentActor,
  documentId: number,
  registry: DocumentStorageRegistry,
  versionNo?: number,
) {
  const [document] = await exec.select().from(managedDocument).where(and(
      eq(managedDocument.masterFn, scope.masterFn),
      eq(managedDocument.companyFn, scope.companyFn),
      eq(managedDocument.id, documentId),
  )).limit(1);
  if (!document) {
    throw new DocumentStorageError(
      'document_missing',
      'Managed document is unavailable in the active company.',
      404,
    );
  }
  await assertOwnerAccess(exec, scope, actor, document.ownerUserId);
  const selectedVersion = versionNo ?? document.currentVersionNo;
  const [versionRow] = await exec.select().from(documentVersion).where(and(
    eq(documentVersion.masterFn, scope.masterFn),
    eq(documentVersion.companyFn, scope.companyFn),
    eq(documentVersion.documentId, document.id),
    eq(documentVersion.versionNo, selectedVersion),
  )).limit(1);
  if (!versionRow) {
    throw new DocumentStorageError(
      'document_version_missing',
      'Managed document version is unavailable.',
      404,
    );
  }
  const version = versionContract(versionRow);
  const content = await registry.get(version.storageBackend)
    .readWithin(exec, scope, version);
  return { document, version, content };
}
