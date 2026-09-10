import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { documentAccessEvent } from '../../data/schema';
import { assertDocumentScanClean } from './scanAccess';
import { readManagedDocumentWithRegistry } from './storageRead';
import { DocumentStorageError } from './storageError';
import type { DocumentActor, DocumentStorageRegistry } from './storage';

export type DocumentAccessAction = 'view' | 'download' | 'print' | 'export';

function accessText(value: string, field: 'purpose' | 'key'): string {
  const text = value.trim();
  const valid = field === 'purpose'
    ? text.length >= 3 && text.length <= 500
    : /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(text);
  if (!valid) {
    throw new DocumentStorageError(
      `document_access_${field}_invalid`,
      field === 'purpose'
        ? 'A document access purpose of 3–500 characters is required.'
        : 'A stable document access key of 8–128 safe characters is required.',
      422,
    );
  }
  return text;
}

export async function accessManagedDocumentWithin(
  db: DB,
  scope: Scope,
  actor: DocumentActor,
  documentId: number,
  input: {
    action: DocumentAccessAction;
    purpose: string;
    accessKey: string;
    versionNo?: number;
  },
  registry: DocumentStorageRegistry,
  now = new Date(),
) {
  const tx = db;
  const purpose = accessText(input.purpose, 'purpose');
  const accessKey = accessText(input.accessKey, 'key');
    const stored = await readManagedDocumentWithRegistry(
      tx,
      scope,
      actor,
      documentId,
      registry,
      input.versionNo,
    );
    await assertDocumentScanClean(
      tx,
      scope,
      stored.version.id,
      input.action === 'export' ? 'export' : 'preview',
    );
    const [existing] = await tx.select().from(documentAccessEvent).where(and(
      eq(documentAccessEvent.masterFn, scope.masterFn),
      eq(documentAccessEvent.companyFn, scope.companyFn),
      eq(documentAccessEvent.actorUserId, actor.userId),
      eq(documentAccessEvent.accessKey, accessKey),
    )).limit(1);
    if (existing) {
      const matches = existing.documentId === stored.document.id
        && existing.versionId === stored.version.id
        && existing.accessAction === input.action
        && existing.accessPurpose === purpose;
      if (!matches) {
        throw new DocumentStorageError(
          'document_access_key_conflict',
          'This document access key was already used for a different access.',
          409,
        );
      }
      return { ...stored, access: existing, replayed: true };
    }
    const [access] = await tx.insert(documentAccessEvent).values({
      ...scope,
      documentId: stored.document.id,
      versionId: stored.version.id,
      versionNo: stored.version.versionNo,
      versionSha256: stored.version.sha256,
      actorUserId: actor.userId,
      accessAction: input.action,
      accessPurpose: purpose,
      accessKey,
      occurredAt: now,
    }).returning();
    return { ...stored, access, replayed: false };
}

export function accessManagedDocumentWithRegistry(...args: Parameters<typeof accessManagedDocumentWithin>) {
  const [db, scope, ...rest] = args;
  return withTenantTransaction(db, scope, tx => accessManagedDocumentWithin(tx, scope, ...rest));
}
