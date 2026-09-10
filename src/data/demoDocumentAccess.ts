import { and, eq } from 'drizzle-orm';
import type { DB } from './db';
import type { Scope } from './repo';
import { documentBlob } from './schema';
import { accessManagedDocumentWithRegistry, accessManagedDocumentWithin } from '../modules/documents/accessCommands';
import { DocumentStorageRegistry } from '../modules/documents/storageRegistry';
import { DocumentStorageError } from '../modules/documents/storageError';

const registry = new DocumentStorageRegistry([{
  backend: 'database', deployment: 'cluster-safe',
  async writeWithin() { throw new Error('This document provider is read-only.'); },
  async removeWithin() { throw new Error('This document provider is read-only.'); },
  async readWithin(db, scope, version) {
    const [row] = await db.select({ content: documentBlob.content }).from(documentBlob).where(and(
      eq(documentBlob.masterFn, scope.masterFn), eq(documentBlob.companyFn, scope.companyFn),
      eq(documentBlob.versionId, version.id),
    )).limit(1);
    if (!row) throw new DocumentStorageError('document_content_missing', 'Document content is unavailable.', 404);
    const content = new Uint8Array(row.content);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', content)), byte => byte.toString(16).padStart(2, '0')).join('');
    if (content.byteLength !== version.sizeBytes || hash !== version.sha256) {
      throw new DocumentStorageError('document_integrity_failed', 'Document content failed integrity verification.', 500);
    }
    return content;
  },
}]);

export function accessDemoDocument(db: DB, scope: Scope, actor: { userId: number; canManage: boolean },
  documentId: number, versionNo: number) {
  return accessManagedDocumentWithRegistry(db, scope, actor, documentId, {
    action: 'view', purpose: 'receipt_assistant_evidence_review', accessKey: crypto.randomUUID(), versionNo,
  }, registry);
}

export function accessDemoDocumentWithin(db: DB, scope: Scope, actor: { userId: number; canManage: boolean },
  documentId: number, versionNo: number) {
  return accessManagedDocumentWithin(db, scope, actor, documentId, {
    action: 'view', purpose: 'receipt_assistant_evidence_review', accessKey: crypto.randomUUID(), versionNo,
  }, registry);
}
