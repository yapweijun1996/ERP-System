import { createHash, randomUUID } from 'node:crypto';
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { decryptToken, type EncryptedToken } from '../../auth/tokenCrypto';
import {
  withDocumentWorkerTransaction,
  withTenantTransaction,
} from '../../data/tenantTransaction';
import {
  documentExtraction,
  documentProcessingPolicy,
  documentScanJob,
  documentVersion,
  integrationConnector,
  managedDocument,
  outboxEvent,
} from '../../data/schema';
import {
  createDocumentStorageRegistry,
  readManagedDocument,
  type DocumentStorageRegistry,
} from './storage';

const DOCUMENT_SCAN_TOPIC = 'document.scan.requested';
const DOCUMENT_EXTRACTION_TOPIC = 'document.extraction.requested';

export interface MalwareScanResult {
  status: 'clean' | 'infected' | 'indeterminate';
  scanner: string;
  resultCode?: string;
}

export interface MalwareScanner {
  scan(input: {
    content: Uint8Array;
    mimeType: string;
    sha256: string;
  }): Promise<MalwareScanResult>;
}

export interface ExtractionResult {
  rawText: string;
  model: string;
}

export interface DocumentExtractor {
  extract(input: {
    content: Uint8Array;
    mimeType: string;
    sha256: string;
    region?: string;
    retentionDays?: number;
    credential?: string;
  }): Promise<ExtractionResult>;
}

export interface DocumentProcessingOptions {
  scanner?: MalwareScanner;
  localOcr?: DocumentExtractor;
  vision?: DocumentExtractor;
  credentialEncryptionKey?: Buffer;
  registry?: DocumentStorageRegistry;
  workerId?: string;
  batchSize?: number;
  leaseMs?: number;
  now?: Date;
}

export type GovernedDocumentAction = 'preview' | 'ocr' | 'submission' | 'export';

export class DocumentQuarantineError extends Error {
  readonly code = 'document_quarantined';

  constructor(
    public readonly action: GovernedDocumentAction,
    public readonly scanStatus: string,
  ) {
    super(`Document ${action} is blocked while scan status is ${scanStatus}.`);
  }
}

function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function retryAt(now: Date, attempts: number): Date {
  const delay = Math.min(60 * 60 * 1000, 2 ** Math.min(attempts, 10) * 1000);
  return new Date(now.getTime() + delay);
}

async function enqueueSignal(
  exec: DB,
  scope: Scope,
  topic: typeof DOCUMENT_SCAN_TOPIC | typeof DOCUMENT_EXTRACTION_TOPIC,
  versionId: number,
) {
  await exec.insert(outboxEvent).values({
    ...scope,
    topic,
    aggregateType: 'document_version',
    aggregateId: String(versionId),
    payload: { versionId },
  }).onConflictDoNothing();
}

export async function enqueueDocumentProcessing(
  exec: DB,
  scope: Scope,
  versionId: number,
) {
  const [version] = await exec.select({ id: documentVersion.id })
    .from(documentVersion)
    .where(and(
      eq(documentVersion.masterFn, scope.masterFn),
      eq(documentVersion.companyFn, scope.companyFn),
      eq(documentVersion.id, versionId),
    ))
    .limit(1);
  if (!version) throw new Error('Document version is unavailable for processing.');
  await exec.insert(documentScanJob).values({
    ...scope,
    versionId,
  }).onConflictDoNothing();
  await enqueueSignal(exec, scope, DOCUMENT_SCAN_TOPIC, versionId);
}

async function markSignalDelivered(
  db: DB,
  scope: Scope,
  topic: string,
  versionId: number,
  now: Date,
) {
  await db.update(outboxEvent).set({
    deliveredAt: now,
    lockedAt: null,
    lockedBy: null,
    lastError: null,
  }).where(and(
    eq(outboxEvent.masterFn, scope.masterFn),
    eq(outboxEvent.companyFn, scope.companyFn),
    eq(outboxEvent.topic, topic),
    eq(outboxEvent.aggregateType, 'document_version'),
    eq(outboxEvent.aggregateId, String(versionId)),
    isNull(outboxEvent.deliveredAt),
  ));
}

async function markSignalFailed(
  db: DB,
  scope: Scope,
  topic: string,
  versionId: number,
  message: string,
  availableAt: Date,
  now: Date,
) {
  await db.update(outboxEvent).set({
    attempts: sql`${outboxEvent.attempts} + 1`,
    lastAttemptAt: now,
    availableAt,
    lastError: message.slice(0, 1000),
  }).where(and(
    eq(outboxEvent.masterFn, scope.masterFn),
    eq(outboxEvent.companyFn, scope.companyFn),
    eq(outboxEvent.topic, topic),
    eq(outboxEvent.aggregateType, 'document_version'),
    eq(outboxEvent.aggregateId, String(versionId)),
    isNull(outboxEvent.deliveredAt),
  ));
}

async function policyFor(db: DB, scope: Scope) {
  const [policy] = await db.select().from(documentProcessingPolicy).where(and(
    eq(documentProcessingPolicy.masterFn, scope.masterFn),
    eq(documentProcessingPolicy.companyFn, scope.companyFn),
  )).limit(1);
  return policy ?? {
    extractionProvider: 'local_ocr' as const,
    visionProvider: null,
    visionRegion: null,
    visionRetentionDays: null,
  };
}

export async function assertDocumentScanClean(
  exec: DB,
  scope: Scope,
  versionId: number,
  action: GovernedDocumentAction,
) {
  const [scan] = await exec.select({ status: documentScanJob.status })
    .from(documentScanJob).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, versionId),
    )).limit(1);
  if (scan?.status !== 'clean') {
    throw new DocumentQuarantineError(action, scan?.status ?? 'missing');
  }
  return scan;
}

async function createExtractionAfterClean(
  db: DB,
  scope: Scope,
  versionId: number,
  options: DocumentProcessingOptions,
  now: Date,
) {
  return withTenantTransaction(db, scope, async (tx) => {
    const policy = await policyFor(tx, scope);
    let model = 'local-ocr';
    let status: 'queued' | 'unavailable' = 'queued';
    let error: string | null = null;
    if (policy.extractionProvider === 'local_ocr') {
      if (!options.localOcr) {
        status = 'unavailable';
        error = 'Local OCR is not configured on this worker.';
      }
    } else {
      const [connector] = await tx.select({
        status: integrationConnector.status,
        enabled: integrationConnector.enabled,
        credentialEnvelope: integrationConnector.credentialEnvelope,
      }).from(integrationConnector).where(and(
        eq(integrationConnector.masterFn, scope.masterFn),
        eq(integrationConnector.companyFn, scope.companyFn),
        eq(integrationConnector.connectorKey, 'document-vision'),
      )).limit(1);
      model = `${policy.visionProvider ?? 'vision'}-vision`;
      if (
        !options.vision
        || !policy.visionProvider
        || !policy.visionRegion
        || policy.visionRetentionDays == null
        || !connector
        || !connector.enabled
        || connector.status !== 'connected'
        || !connector.credentialEnvelope
      ) {
        status = 'unavailable';
        error = 'BYOK Vision requires a connected credential, provider, region and retention policy.';
      }
    }
    await tx.insert(documentExtraction).values({
      ...scope,
      versionId,
      extractionVersion: 1,
      provider: policy.extractionProvider,
      model,
      status,
      availableAt: now,
      lastError: error,
    }).onConflictDoNothing();
    await enqueueSignal(tx, scope, DOCUMENT_EXTRACTION_TOPIC, versionId);
  });
}

async function claimScanJobs(
  db: DB,
  workerId: string,
  now: Date,
  batchSize: number,
  leaseMs: number,
) {
  const expiredLease = new Date(now.getTime() - leaseMs);
  return withDocumentWorkerTransaction(db, async (tx) => {
    const rows = await tx.select().from(documentScanJob).where(and(
      inArray(documentScanJob.status, ['queued', 'indeterminate', 'unavailable']),
      lte(documentScanJob.availableAt, now),
      or(isNull(documentScanJob.lockedAt), lt(documentScanJob.lockedAt, expiredLease)),
    )).orderBy(asc(documentScanJob.id)).limit(batchSize)
      .for('update', { skipLocked: true });
    if (!rows.length) return rows;
    await tx.update(documentScanJob).set({
      status: 'scanning',
      lockedAt: now,
      lockedBy: workerId,
      attempts: sql`${documentScanJob.attempts} + 1`,
      updatedAt: now,
    }).where(inArray(documentScanJob.id, rows.map((row) => row.id)));
    return rows;
  });
}

async function claimExtractions(
  db: DB,
  workerId: string,
  now: Date,
  batchSize: number,
  leaseMs: number,
) {
  const expiredLease = new Date(now.getTime() - leaseMs);
  return withDocumentWorkerTransaction(db, async (tx) => {
    const rows = await tx.select().from(documentExtraction).where(and(
      inArray(documentExtraction.status, ['queued', 'failed', 'unavailable']),
      lte(documentExtraction.availableAt, now),
      or(isNull(documentExtraction.lockedAt), lt(documentExtraction.lockedAt, expiredLease)),
    )).orderBy(asc(documentExtraction.id)).limit(batchSize)
      .for('update', { skipLocked: true });
    if (!rows.length) return rows;
    await tx.update(documentExtraction).set({
      status: 'extracting',
      lockedAt: now,
      lockedBy: workerId,
      attempts: sql`${documentExtraction.attempts} + 1`,
      updatedAt: now,
    }).where(inArray(documentExtraction.id, rows.map((row) => row.id)));
    return rows;
  });
}

async function versionContext(db: DB, scope: Scope, versionId: number) {
  return withTenantTransaction(db, scope, async (tx) => {
    const [row] = await tx.select({
      version: documentVersion,
      document: managedDocument,
    }).from(documentVersion).innerJoin(managedDocument, and(
      eq(managedDocument.masterFn, documentVersion.masterFn),
      eq(managedDocument.companyFn, documentVersion.companyFn),
      eq(managedDocument.id, documentVersion.documentId),
    )).where(and(
      eq(documentVersion.masterFn, scope.masterFn),
      eq(documentVersion.companyFn, scope.companyFn),
      eq(documentVersion.id, versionId),
    )).limit(1);
    if (!row) throw new Error('Document processing source is unavailable.');
    return row;
  });
}

export async function processDocumentJobBatch(
  db: DB,
  options: DocumentProcessingOptions = {},
) {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `document-${randomUUID()}`;
  const batchSize = Math.min(Math.max(options.batchSize ?? 10, 1), 50);
  const leaseMs = options.leaseMs ?? 5 * 60 * 1000;
  const registry = options.registry ?? createDocumentStorageRegistry();
  const scans = await claimScanJobs(db, workerId, now, batchSize, leaseMs);
  let clean = 0;
  let blocked = 0;
  let failed = 0;
  for (const job of scans) {
    const scope = { masterFn: job.masterFn, companyFn: job.companyFn };
    try {
      if (!options.scanner) throw new Error('Malware scanner is unavailable.');
      const source = await versionContext(db, scope, job.versionId);
      const stored = await readManagedDocument(
        db,
        scope,
        { userId: source.document.ownerUserId, canManage: true },
        source.document.id,
        registry,
        source.version.versionNo,
      );
      const result = await options.scanner.scan({
        content: stored.content,
        mimeType: source.version.mimeType,
        sha256: source.version.sha256,
      });
      if (result.status === 'clean') {
        await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
          status: 'clean',
          scanner: result.scanner,
          resultCode: result.resultCode ?? 'clean',
          completedAt: now,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          updatedAt: now,
        }).where(and(eq(documentScanJob.id, job.id), eq(documentScanJob.lockedBy, workerId))));
        await markSignalDelivered(db, scope, DOCUMENT_SCAN_TOPIC, job.versionId, now);
        await createExtractionAfterClean(db, scope, job.versionId, options, now);
        clean += 1;
      } else if (result.status === 'infected') {
        await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
          status: 'infected',
          scanner: result.scanner,
          resultCode: result.resultCode ?? 'infected',
          completedAt: now,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          updatedAt: now,
        }).where(and(eq(documentScanJob.id, job.id), eq(documentScanJob.lockedBy, workerId))));
        await markSignalDelivered(db, scope, DOCUMENT_SCAN_TOPIC, job.versionId, now);
        blocked += 1;
      } else {
        throw new Error(`Scanner returned indeterminate result: ${result.resultCode ?? 'unknown'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = options.scanner ? 'indeterminate' : 'unavailable';
      const availableAt = retryAt(now, job.attempts + 1);
      await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
        status,
        availableAt,
        lockedAt: null,
        lockedBy: null,
        lastError: message.slice(0, 1000),
        updatedAt: now,
      }).where(and(eq(documentScanJob.id, job.id), eq(documentScanJob.lockedBy, workerId))));
      await markSignalFailed(
        db, scope, DOCUMENT_SCAN_TOPIC, job.versionId, message, availableAt, now,
      );
      failed += 1;
    }
  }

  const extractions = await claimExtractions(db, workerId, now, batchSize, leaseMs);
  let extracted = 0;
  for (const job of extractions) {
    const scope = { masterFn: job.masterFn, companyFn: job.companyFn };
    try {
      const context = await withTenantTransaction(db, scope, async (tx) => {
        await assertDocumentScanClean(tx, scope, job.versionId, 'ocr');
        const policy = await policyFor(tx, scope);
        const [connector] = await tx.select({
          credentialEnvelope: integrationConnector.credentialEnvelope,
          status: integrationConnector.status,
          enabled: integrationConnector.enabled,
        }).from(integrationConnector).where(and(
          eq(integrationConnector.masterFn, scope.masterFn),
          eq(integrationConnector.companyFn, scope.companyFn),
          eq(integrationConnector.connectorKey, 'document-vision'),
        )).limit(1);
        return { policy, connector };
      });
      const { policy, connector } = context;
      const source = await versionContext(db, scope, job.versionId);
      const stored = await readManagedDocument(
        db,
        scope,
        { userId: source.document.ownerUserId, canManage: true },
        source.document.id,
        registry,
        source.version.versionNo,
      );
      const extractor = job.provider === 'local_ocr' ? options.localOcr : options.vision;
      if (!extractor) throw new Error(
        job.provider === 'local_ocr'
          ? 'Local OCR is unavailable.'
          : 'BYOK Vision is unavailable.',
      );
      let credential: string | undefined;
      if (job.provider === 'byok_vision') {
        if (!connector?.enabled || connector.status !== 'connected'
          || !connector.credentialEnvelope || !policy.visionRegion
          || policy.visionRetentionDays == null) {
          throw new Error(
            'BYOK Vision requires a connected credential, region and retention policy.',
          );
        }
        if (!options.credentialEncryptionKey) {
          throw new Error('BYOK Vision credential decryption is unavailable.');
        }
        credential = decryptToken(
          connector.credentialEnvelope as EncryptedToken,
          options.credentialEncryptionKey,
        );
      }
      const result = await extractor.extract({
        content: stored.content,
        mimeType: source.version.mimeType,
        sha256: source.version.sha256,
        region: policy.visionRegion ?? undefined,
        retentionDays: policy.visionRetentionDays ?? undefined,
        credential,
      });
      const rawText = result.rawText.trim();
      await withTenantTransaction(db, scope, (tx) => tx.update(documentExtraction).set({
        status: 'succeeded',
        model: result.model,
        rawText,
        outputSha256: sha256Text(rawText),
        completedAt: now,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        updatedAt: now,
      }).where(and(eq(documentExtraction.id, job.id), eq(documentExtraction.lockedBy, workerId))));
      await markSignalDelivered(db, scope, DOCUMENT_EXTRACTION_TOPIC, job.versionId, now);
      extracted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const availableAt = retryAt(now, job.attempts + 1);
      await withTenantTransaction(db, scope, (tx) => tx.update(documentExtraction).set({
        status: error instanceof DocumentQuarantineError
          || message.toLowerCase().includes('unavailable')
          || message.toLowerCase().includes('requires')
          ? 'unavailable'
          : 'failed',
        availableAt,
        lockedAt: null,
        lockedBy: null,
        lastError: message.slice(0, 1000),
        updatedAt: now,
      }).where(and(eq(documentExtraction.id, job.id), eq(documentExtraction.lockedBy, workerId))));
      await markSignalFailed(
        db, scope, DOCUMENT_EXTRACTION_TOPIC, job.versionId, message, availableAt, now,
      );
      failed += 1;
    }
  }
  return {
    scansClaimed: scans.length,
    clean,
    blocked,
    extractionsClaimed: extractions.length,
    extracted,
    failed,
  };
}
