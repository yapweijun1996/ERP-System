import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  appUser,
  documentBlob,
  documentFileLocation,
  documentVersion,
  managedDocument,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  appendManagedDocumentVersion,
  createDocumentStorageRegistry,
  createManagedDocument,
  DatabaseDocumentStorageProvider,
  DocumentStorageError,
  DocumentStorageRegistry,
  FilesystemDocumentStorageProvider,
  readManagedDocument,
} from './storage';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  return { db, admin, viewer };
}

async function providerRegistry(backend: 'database' | 'filesystem') {
  if (backend === 'database') {
    return {
      registry: new DocumentStorageRegistry([new DatabaseDocumentStorageProvider()]),
      root: null,
    };
  }
  const root = await mkdtemp(path.join(tmpdir(), 'erp-document-storage-'));
  tempRoots.push(root);
  return {
    registry: new DocumentStorageRegistry([
      new DatabaseDocumentStorageProvider(),
      new FilesystemDocumentStorageProvider(root),
    ]),
    root,
  };
}

async function proveProviderParity(
  backend: 'database' | 'filesystem',
) {
  const { db, admin, viewer } = await fixture();
  const { registry, root } = await providerRegistry(backend);
  const firstContent = new TextEncoder().encode(`receipt-v1-${backend}`);
  const secondContent = new TextEncoder().encode(`receipt-v2-${backend}`);
  const retentionUntil = new Date('2033-12-31T00:00:00.000Z');
  const created = await createManagedDocument(db, scope, { userId: viewer.userId }, {
    documentKey: `receipt:${backend}:1`,
    purpose: 'receipt',
    ownerUserId: viewer.userId,
    originalFileName: 'taxi-receipt.txt',
    mimeType: 'text/plain',
    retentionUntil,
    content: firstContent,
    storageBackend: backend,
  }, registry);
  expect(created.replayed).toBe(false);
  expect(created.version).toMatchObject({
    versionNo: 1,
    storageBackend: backend,
    mimeType: 'text/plain',
    sizeBytes: firstContent.byteLength,
    sha256: createHash('sha256').update(firstContent).digest('hex'),
  });
  expect(created.document).toMatchObject({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    ownerUserId: viewer.userId,
    currentVersionNo: 1,
    legalHold: false,
  });

  const replay = await createManagedDocument(db, scope, { userId: viewer.userId }, {
    documentKey: `receipt:${backend}:1`,
    purpose: 'receipt',
    ownerUserId: viewer.userId,
    originalFileName: 'taxi-receipt.txt',
    mimeType: 'text/plain',
    retentionUntil,
    content: firstContent,
    storageBackend: backend,
  }, registry);
  expect(replay.replayed).toBe(true);
  expect(await db.select().from(managedDocument)).toHaveLength(1);
  expect(await db.select().from(documentVersion)).toHaveLength(1);

  const ownerRead = await readManagedDocument(
    db, scope, { userId: viewer.userId }, created.document.id, registry,
  );
  expect(ownerRead.content).toEqual(firstContent);
  const managerRead = await readManagedDocument(
    db, scope, { userId: admin.userId, canManage: true }, created.document.id, registry,
  );
  expect(managerRead.content).toEqual(firstContent);
  await expect(readManagedDocument(
    db, scope, { userId: admin.userId }, created.document.id, registry,
  )).rejects.toMatchObject({ code: 'document_access_denied', status: 403 });
  await expect(readManagedDocument(
    db,
    { masterFn: 'M1', companyFn: 'C-MY' },
    { userId: viewer.userId, canManage: true },
    created.document.id,
    registry,
  )).rejects.toMatchObject({ code: 'document_missing', status: 404 });

  const appended = await appendManagedDocumentVersion(
    db,
    scope,
    { userId: viewer.userId },
    created.document.id,
    {
      expectedVersionNo: 1,
      mimeType: 'text/plain',
      content: secondContent,
      storageBackend: backend,
    },
    registry,
  );
  expect(appended).toMatchObject({
    replayed: false,
    document: { currentVersionNo: 2 },
    version: { versionNo: 2, storageBackend: backend },
  });
  const appendReplay = await appendManagedDocumentVersion(
    db,
    scope,
    { userId: viewer.userId },
    created.document.id,
    {
      expectedVersionNo: 1,
      mimeType: 'text/plain',
      content: secondContent,
      storageBackend: backend,
    },
    registry,
  );
  expect(appendReplay.replayed).toBe(true);
  expect(await db.select().from(documentVersion)).toHaveLength(2);
  expect((await readManagedDocument(
    db, scope, { userId: viewer.userId }, created.document.id, registry,
  )).content).toEqual(secondContent);
  expect((await readManagedDocument(
    db, scope, { userId: viewer.userId }, created.document.id, registry, 1,
  )).content).toEqual(firstContent);

  await expect(db.update(documentVersion).set({ sha256: '0'.repeat(64) })
    .where(eq(documentVersion.id, created.version.id))).rejects.toThrow();
  await expect(db.update(managedDocument).set({ ownerUserId: admin.userId })
    .where(eq(managedDocument.id, created.document.id))).rejects.toThrow();
  await expect(db.delete(managedDocument)
    .where(eq(managedDocument.id, created.document.id))).rejects.toThrow();

  const blobs = await db.select().from(documentBlob);
  const locations = await db.select().from(documentFileLocation);
  if (backend === 'database') {
    expect(blobs).toHaveLength(2);
    expect(locations).toHaveLength(0);
  } else {
    expect(blobs).toHaveLength(0);
    expect(locations).toHaveLength(2);
    expect(root).not.toBeNull();
    for (const location of locations) {
      const file = await readFile(path.resolve(root!, location.relativePath));
      expect(file.byteLength).toBeGreaterThan(0);
    }
  }
  return {
    db,
    registry,
    root,
    documentId: created.document.id,
    currentVersionId: appended.version.id,
    viewerUserId: viewer.userId,
  };
}

describe('DocumentStorageProvider', () => {
  it('uses database byte storage by default', () => {
    const registry = createDocumentStorageRegistry({});
    expect(registry.get('database')).toMatchObject({
      backend: 'database',
      deployment: 'cluster-safe',
    });
    expect(() => registry.get('filesystem')).toThrow(DocumentStorageError);
  });

  it('requires a dedicated filesystem root and labels it single-node', async () => {
    expect(() => new FilesystemDocumentStorageProvider('/')).toThrow(DocumentStorageError);
    const root = await mkdtemp(path.join(tmpdir(), 'erp-document-storage-config-'));
    tempRoots.push(root);
    const registry = createDocumentStorageRegistry({ DOCUMENT_STORAGE_FS_ROOT: root });
    expect(registry.get('filesystem')).toMatchObject({
      backend: 'filesystem',
      deployment: 'single-node',
      root: path.resolve(root),
    });
  });

  it('enforces immutable metadata, versioning and authorization with database content', async () => {
    await proveProviderParity('database');
  });

  it('enforces the identical contract with single-node filesystem content', async () => {
    const result = await proveProviderParity('filesystem');
    const [location] = await result.db.select().from(documentFileLocation).where(and(
      eq(documentFileLocation.versionId, result.currentVersionId),
      eq(documentFileLocation.companyFn, scope.companyFn),
    ));
    await writeFile(
      path.resolve(result.root!, location.relativePath),
      new TextEncoder().encode('tampered content'),
    );
    await expect(readManagedDocument(
      result.db,
      scope,
      { userId: result.viewerUserId },
      result.documentId,
      result.registry,
    )).rejects.toMatchObject({ code: 'document_integrity_failed', status: 500 });
  });

  it('rejects a changed payload for an existing immutable document key', async () => {
    const { db, viewer } = await fixture();
    const registry = new DocumentStorageRegistry([new DatabaseDocumentStorageProvider()]);
    const base = {
      documentKey: 'receipt:key-conflict',
      purpose: 'receipt' as const,
      ownerUserId: viewer.userId,
      originalFileName: 'receipt.txt',
      mimeType: 'text/plain',
      retentionUntil: new Date('2033-12-31T00:00:00.000Z'),
      storageBackend: 'database' as const,
    };
    await createManagedDocument(
      db, scope, { userId: viewer.userId },
      { ...base, content: new TextEncoder().encode('one') },
      registry,
    );
    await expect(createManagedDocument(
      db, scope, { userId: viewer.userId },
      { ...base, content: new TextEncoder().encode('two') },
      registry,
    )).rejects.toMatchObject({ code: 'document_key_conflict', status: 409 });
  });
});
