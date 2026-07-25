import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  documentBlob,
  documentFileLocation,
  documentVersion,
  managedDocument,
  userCompany,
} from '../../data/schema';

export type DocumentStorageBackend = 'database' | 'filesystem';

export interface DocumentActor {
  userId: number;
  canManage?: boolean;
}

export interface StoredDocumentVersion {
  id: number;
  documentId: number;
  versionNo: number;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  storageBackend: DocumentStorageBackend;
}

interface StorageWriteReceipt {
  rollback?: () => Promise<void>;
}

export interface DocumentStorageProvider {
  readonly backend: DocumentStorageBackend;
  readonly deployment: 'cluster-safe' | 'single-node';
  writeWithin(
    exec: DB,
    scope: Scope,
    version: StoredDocumentVersion,
    content: Uint8Array,
  ): Promise<StorageWriteReceipt>;
  readWithin(
    exec: DB,
    scope: Scope,
    version: StoredDocumentVersion,
  ): Promise<Uint8Array>;
}

export class DocumentStorageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'DocumentStorageError';
  }
}

function asBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value);
  throw new DocumentStorageError(
    'document_content_unavailable',
    'Stored document content is not readable.',
    500,
  );
}

function sha256(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

function verifyContent(version: StoredDocumentVersion, content: Uint8Array): Uint8Array {
  if (content.byteLength !== version.sizeBytes || sha256(content) !== version.sha256) {
    throw new DocumentStorageError(
      'document_integrity_failed',
      'Stored document content does not match its database-owned integrity metadata.',
      500,
    );
  }
  return content;
}

export class DatabaseDocumentStorageProvider implements DocumentStorageProvider {
  readonly backend = 'database' as const;
  readonly deployment = 'cluster-safe' as const;

  async writeWithin(
    exec: DB,
    scope: Scope,
    version: StoredDocumentVersion,
    content: Uint8Array,
  ): Promise<StorageWriteReceipt> {
    await exec.insert(documentBlob).values({
      ...scope,
      versionId: version.id,
      content,
    });
    return {};
  }

  async readWithin(
    exec: DB,
    scope: Scope,
    version: StoredDocumentVersion,
  ): Promise<Uint8Array> {
    const [row] = await exec.select({ content: documentBlob.content })
      .from(documentBlob)
      .where(and(
        eq(documentBlob.masterFn, scope.masterFn),
        eq(documentBlob.companyFn, scope.companyFn),
        eq(documentBlob.versionId, version.id),
      ))
      .limit(1);
    if (!row) {
      throw new DocumentStorageError(
        'document_content_missing',
        'Database document content is unavailable.',
        404,
      );
    }
    return verifyContent(version, asBytes(row.content));
  }
}

export class FilesystemDocumentStorageProvider implements DocumentStorageProvider {
  readonly backend = 'filesystem' as const;
  readonly deployment = 'single-node' as const;
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    if (!root.trim() || this.root === path.parse(this.root).root) {
      throw new DocumentStorageError(
        'document_filesystem_root_invalid',
        'Filesystem document storage requires a dedicated non-root directory.',
        500,
      );
    }
  }

  private absolutePath(relativePath: string): string {
    const absolute = path.resolve(this.root, relativePath);
    if (!absolute.startsWith(`${this.root}${path.sep}`)) {
      throw new DocumentStorageError(
        'document_filesystem_locator_invalid',
        'Filesystem document locator escapes the configured root.',
        500,
      );
    }
    return absolute;
  }

  async writeWithin(
    exec: DB,
    scope: Scope,
    version: StoredDocumentVersion,
    content: Uint8Array,
  ): Promise<StorageWriteReceipt> {
    const tenantSegment = createHash('sha256')
      .update(`${scope.masterFn}\0${scope.companyFn}`)
      .digest('hex')
      .slice(0, 16);
    const relativePath = `${tenantSegment}/${version.id}-${randomUUID()}.bin`;
    const absolute = this.absolutePath(relativePath);
    await mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
    await writeFile(absolute, content, { flag: 'wx', mode: 0o600 });
    try {
      await exec.insert(documentFileLocation).values({
        ...scope,
        versionId: version.id,
        relativePath,
      });
    } catch (error) {
      await unlink(absolute).catch(() => undefined);
      throw error;
    }
    return {
      rollback: () => unlink(absolute).catch(() => undefined),
    };
  }

  async readWithin(
    exec: DB,
    scope: Scope,
    version: StoredDocumentVersion,
  ): Promise<Uint8Array> {
    const [row] = await exec.select({ relativePath: documentFileLocation.relativePath })
      .from(documentFileLocation)
      .where(and(
        eq(documentFileLocation.masterFn, scope.masterFn),
        eq(documentFileLocation.companyFn, scope.companyFn),
        eq(documentFileLocation.versionId, version.id),
      ))
      .limit(1);
    if (!row) {
      throw new DocumentStorageError(
        'document_content_missing',
        'Filesystem document content is unavailable.',
        404,
      );
    }
    let content: Uint8Array;
    try {
      content = new Uint8Array(await readFile(this.absolutePath(row.relativePath)));
    } catch (error) {
      if (error instanceof DocumentStorageError) throw error;
      throw new DocumentStorageError(
        'document_content_missing',
        'Filesystem document content is unavailable on this node.',
        404,
      );
    }
    return verifyContent(version, content);
  }
}

export class DocumentStorageRegistry {
  private readonly providers = new Map<DocumentStorageBackend, DocumentStorageProvider>();

  constructor(providers: DocumentStorageProvider[]) {
    for (const provider of providers) this.providers.set(provider.backend, provider);
    if (!this.providers.has('database')) {
      throw new DocumentStorageError(
        'document_database_provider_required',
        'The database document provider must always be configured.',
        500,
      );
    }
  }

  get(backend: DocumentStorageBackend): DocumentStorageProvider {
    const provider = this.providers.get(backend);
    if (!provider) {
      throw new DocumentStorageError(
        'document_storage_backend_unavailable',
        `Document storage backend '${backend}' is not configured on this server.`,
        503,
      );
    }
    return provider;
  }
}

export function createDocumentStorageRegistry(
  environment: Record<string, string | undefined> = process.env,
): DocumentStorageRegistry {
  const providers: DocumentStorageProvider[] = [new DatabaseDocumentStorageProvider()];
  if (environment.DOCUMENT_STORAGE_FS_ROOT?.trim()) {
    providers.push(new FilesystemDocumentStorageProvider(
      environment.DOCUMENT_STORAGE_FS_ROOT,
    ));
  }
  return new DocumentStorageRegistry(providers);
}

export interface CreateManagedDocumentInput {
  documentKey: string;
  purpose: 'receipt' | 'leave_evidence' | 'tax_evidence' | 'other';
  ownerUserId: number;
  originalFileName: string;
  mimeType: string;
  retentionUntil: Date;
  content: Uint8Array;
  storageBackend?: DocumentStorageBackend;
}

function validateInput(input: CreateManagedDocumentInput): {
  documentKey: string;
  originalFileName: string;
  mimeType: string;
  content: Uint8Array;
  contentHash: string;
} {
  const documentKey = input.documentKey?.trim();
  const originalFileName = input.originalFileName?.trim();
  const mimeType = input.mimeType?.trim().toLowerCase();
  const content = asBytes(input.content);
  if (!documentKey || documentKey.length > 160) {
    throw new DocumentStorageError(
      'document_key_invalid',
      'A bounded document key is required.',
      422,
    );
  }
  if (!originalFileName || originalFileName.length > 255) {
    throw new DocumentStorageError(
      'document_file_name_invalid',
      'A file name of at most 255 characters is required.',
      422,
    );
  }
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(mimeType)) {
    throw new DocumentStorageError(
      'document_mime_invalid',
      'A valid MIME type is required.',
      422,
    );
  }
  if (content.byteLength <= 0 || content.byteLength > 2_147_483_647) {
    throw new DocumentStorageError(
      'document_size_invalid',
      'Document content must be non-empty and fit the metadata size field.',
      422,
    );
  }
  if (!(input.retentionUntil instanceof Date)
    || Number.isNaN(input.retentionUntil.getTime())) {
    throw new DocumentStorageError(
      'document_retention_invalid',
      'A valid retention deadline is required.',
      422,
    );
  }
  return {
    documentKey,
    originalFileName,
    mimeType,
    content,
    contentHash: sha256(content),
  };
}

async function assertOwnerAccess(
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

function versionContract(row: typeof documentVersion.$inferSelect): StoredDocumentVersion {
  return {
    id: row.id,
    documentId: row.documentId,
    versionNo: row.versionNo,
    sha256: row.sha256,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storageBackend: row.storageBackend as DocumentStorageBackend,
  };
}

export async function createManagedDocument(
  db: DB,
  scope: Scope,
  actor: DocumentActor,
  input: CreateManagedDocumentInput,
  registry = createDocumentStorageRegistry(),
) {
  const normalized = validateInput(input);
  const backend = input.storageBackend ?? 'database';
  const provider = registry.get(backend);
  let writeReceipt: StorageWriteReceipt | undefined;
  try {
    return await withTenantTransaction(db, scope, async (tx) => {
      await assertOwnerAccess(tx, scope, actor, input.ownerUserId);
      const [existing] = await tx.select().from(managedDocument).where(and(
        eq(managedDocument.masterFn, scope.masterFn),
        eq(managedDocument.companyFn, scope.companyFn),
        eq(managedDocument.documentKey, normalized.documentKey),
      )).limit(1);
      if (existing) {
        const [existingVersion] = await tx.select().from(documentVersion).where(and(
          eq(documentVersion.masterFn, scope.masterFn),
          eq(documentVersion.companyFn, scope.companyFn),
          eq(documentVersion.documentId, existing.id),
          eq(documentVersion.versionNo, 1),
        )).limit(1);
        if (
          existing.ownerUserId !== input.ownerUserId
          || existing.purpose !== input.purpose
          || existing.originalFileName !== normalized.originalFileName
          || existing.retentionUntil.getTime() !== input.retentionUntil.getTime()
          || !existingVersion
          || existingVersion.sha256 !== normalized.contentHash
          || existingVersion.mimeType !== normalized.mimeType
          || existingVersion.sizeBytes !== normalized.content.byteLength
          || existingVersion.storageBackend !== backend
        ) {
          throw new DocumentStorageError(
            'document_key_conflict',
            'This immutable document key is already used by different content or metadata.',
            409,
          );
        }
        return {
          document: existing,
          version: versionContract(existingVersion),
          replayed: true,
        };
      }
      const [document] = await tx.insert(managedDocument).values({
        ...scope,
        documentKey: normalized.documentKey,
        purpose: input.purpose,
        ownerUserId: input.ownerUserId,
        originalFileName: normalized.originalFileName,
        retentionUntil: input.retentionUntil,
        createdByUserId: actor.userId,
      }).returning();
      const [versionRow] = await tx.insert(documentVersion).values({
        ...scope,
        documentId: document.id,
        versionNo: 1,
        sha256: normalized.contentHash,
        mimeType: normalized.mimeType,
        sizeBytes: normalized.content.byteLength,
        storageBackend: backend,
        createdByUserId: actor.userId,
      }).returning();
      const version = versionContract(versionRow);
      writeReceipt = await provider.writeWithin(tx, scope, version, normalized.content);
      return { document, version, replayed: false };
    });
  } catch (error) {
    await writeReceipt?.rollback?.();
    throw error;
  }
}

export interface AppendManagedDocumentVersionInput {
  expectedVersionNo: number;
  mimeType: string;
  content: Uint8Array;
  storageBackend?: DocumentStorageBackend;
}

export async function appendManagedDocumentVersion(
  db: DB,
  scope: Scope,
  actor: DocumentActor,
  documentId: number,
  input: AppendManagedDocumentVersionInput,
  registry = createDocumentStorageRegistry(),
) {
  const normalized = validateInput({
    documentKey: 'version-validation',
    purpose: 'other',
    ownerUserId: actor.userId,
    originalFileName: 'version.bin',
    mimeType: input.mimeType,
    retentionUntil: new Date(0),
    content: input.content,
  });
  const backend = input.storageBackend ?? 'database';
  const provider = registry.get(backend);
  let writeReceipt: StorageWriteReceipt | undefined;
  try {
    return await withTenantTransaction(db, scope, async (tx) => {
      const [document] = await tx.select().from(managedDocument).where(and(
        eq(managedDocument.masterFn, scope.masterFn),
        eq(managedDocument.companyFn, scope.companyFn),
        eq(managedDocument.id, documentId),
      )).limit(1).for('update');
      if (!document) {
        throw new DocumentStorageError(
          'document_missing',
          'Managed document is unavailable in the active company.',
          404,
        );
      }
      await assertOwnerAccess(tx, scope, actor, document.ownerUserId);
      if (document.currentVersionNo !== input.expectedVersionNo) {
        const [current] = await tx.select().from(documentVersion).where(and(
          eq(documentVersion.masterFn, scope.masterFn),
          eq(documentVersion.companyFn, scope.companyFn),
          eq(documentVersion.documentId, document.id),
          eq(documentVersion.versionNo, document.currentVersionNo),
        )).limit(1);
        if (
          document.currentVersionNo === input.expectedVersionNo + 1
          && current
          && current.sha256 === normalized.contentHash
          && current.mimeType === normalized.mimeType
          && current.sizeBytes === normalized.content.byteLength
          && current.storageBackend === backend
        ) {
          return { document, version: versionContract(current), replayed: true };
        }
        throw new DocumentStorageError(
          'document_version_conflict',
          'Managed document version changed before this content was appended.',
          409,
        );
      }
      const nextVersionNo = document.currentVersionNo + 1;
      const [versionRow] = await tx.insert(documentVersion).values({
        ...scope,
        documentId: document.id,
        versionNo: nextVersionNo,
        sha256: normalized.contentHash,
        mimeType: normalized.mimeType,
        sizeBytes: normalized.content.byteLength,
        storageBackend: backend,
        createdByUserId: actor.userId,
      }).returning();
      const version = versionContract(versionRow);
      writeReceipt = await provider.writeWithin(tx, scope, version, normalized.content);
      const [updated] = await tx.update(managedDocument).set({
        currentVersionNo: nextVersionNo,
      }).where(and(
        eq(managedDocument.masterFn, scope.masterFn),
        eq(managedDocument.companyFn, scope.companyFn),
        eq(managedDocument.id, document.id),
        eq(managedDocument.currentVersionNo, input.expectedVersionNo),
      )).returning();
      if (!updated) {
        throw new DocumentStorageError(
          'document_version_conflict',
          'Managed document version changed before this content was appended.',
          409,
        );
      }
      return { document: updated, version, replayed: false };
    });
  } catch (error) {
    await writeReceipt?.rollback?.();
    throw error;
  }
}

export async function readManagedDocument(
  db: DB,
  scope: Scope,
  actor: DocumentActor,
  documentId: number,
  registry = createDocumentStorageRegistry(),
  versionNo?: number,
) {
  return withTenantTransaction(db, scope, async (tx) => {
    const [document] = await tx.select().from(managedDocument).where(and(
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
    await assertOwnerAccess(tx, scope, actor, document.ownerUserId);
    const selectedVersion = versionNo ?? document.currentVersionNo;
    const [versionRow] = await tx.select().from(documentVersion).where(and(
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
      .readWithin(tx, scope, version);
    return { document, version, content };
  });
}
