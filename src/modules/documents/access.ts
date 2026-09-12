import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { createDocumentStorageRegistry, type DocumentActor } from './storage';
import { accessManagedDocumentWithRegistry, type DocumentAccessAction } from './accessCommands';
export type { DocumentAccessAction } from './accessCommands';

export function accessManagedDocument(db: DB, scope: Scope, actor: DocumentActor, documentId: number,
  input: { action: DocumentAccessAction; purpose: string; accessKey: string; versionNo?: number },
  registry = createDocumentStorageRegistry(), now = new Date()) {
  return accessManagedDocumentWithRegistry(db, scope, actor, documentId, input, registry, now);
}
