import { createHash, randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  ne,
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
  documentExtractionField,
  documentProcessingPolicy,
  documentScanJob,
  documentVersion,
  integrationConnector,
  managedDocument,
  outboxEvent,
  receiptInboxItem,
  receiptUploadAuthorization,
} from '../../data/schema';
import {
  createDocumentStorageRegistry,
  readManagedDocument,
  type DocumentStorageRegistry,
} from './storage';
import { markDocumentSystemSubmittedWithin } from './governance';

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
  /** Provider-generated visual/perceptual fingerprint; never synthesized from OCR text. */
  visualFingerprint?: string;
  safetyClear?: boolean;
  fields?: ExtractionFieldCandidate[];
}

export interface ExtractionFieldCandidate {
  fieldKey: string;
  value: string;
  normalizedValue?: string;
  sourceRef: string;
  confidence: number;
  model?: string;
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

const CRITICAL_RECEIPT_FIELDS = [
  'merchant_name',
  'transaction_date',
  'currency',
  'total_amount',
] as const;
const RECEIPT_SUBMISSION_TOPIC = 'receipt.inbox.submitted';
const RECEIPT_SYSTEM_ACTOR = 'receipt-auto-submit-v1';

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
    autoSubmitEnabled: false,
    autoSubmitMinConfidence: '0.9800',
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

function normalizeReceiptFieldValue(fieldKey: string, value: string): string {
  const trimmed = value.trim();
  if (fieldKey === 'merchant_name') return trimmed.replace(/\s+/g, ' ').toLowerCase();
  if (fieldKey === 'currency') return trimmed.toUpperCase();
  if (fieldKey === 'total_amount') return trimmed.replace(/,/g, '');
  return trimmed;
}

function validReceiptCriticalValue(fieldKey: string, value: string): boolean {
  if (fieldKey === 'merchant_name') return value.length > 0;
  if (fieldKey === 'currency') return /^[A-Z]{3}$/.test(value);
  if (fieldKey === 'transaction_date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  if (fieldKey === 'total_amount') {
    try {
      const amount = new Decimal(value);
      return amount.isFinite() && amount.gt(0) && amount.lte('999999999999.9999');
    } catch {
      return false;
    }
  }
  return true;
}

function prepareExtractionFields(
  result: ExtractionResult,
  provider: 'local_ocr' | 'byok_vision',
  minConfidence: number,
) {
  const candidates = (result.fields ?? []).map((field) => {
    const fieldKey = field.fieldKey.trim();
    const valueText = field.value.trim();
    const sourceRef = field.sourceRef.trim();
    const model = (field.model ?? result.model).trim();
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(fieldKey)) {
      throw new Error(`Extraction field key is invalid: ${fieldKey || 'empty'}.`);
    }
    if (!valueText || valueText.length > 4000) {
      throw new Error(`Extraction field ${fieldKey} has an invalid value length.`);
    }
    if (!sourceRef || sourceRef.length > 500) {
      throw new Error(`Extraction field ${fieldKey} has an invalid source reference.`);
    }
    if (!model || model.length > 160) {
      throw new Error(`Extraction field ${fieldKey} has an invalid model.`);
    }
    if (!Number.isFinite(field.confidence)
      || field.confidence < 0 || field.confidence > 1) {
      throw new Error(`Extraction field ${fieldKey} has invalid confidence.`);
    }
    const normalizedValue = normalizeReceiptFieldValue(
      fieldKey,
      field.normalizedValue ?? valueText,
    );
    return {
      fieldKey,
      valueText,
      normalizedValue,
      sourceType: provider,
      sourceRef,
      model,
      confidence: field.confidence,
      critical: CRITICAL_RECEIPT_FIELDS.includes(
        fieldKey as typeof CRITICAL_RECEIPT_FIELDS[number],
      ),
    };
  });
  const groups = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.fieldKey) ?? [];
    group.push(candidate);
    groups.set(candidate.fieldKey, group);
  }

  const reasons: string[] = [];
  const conflictKeys = new Set<string>();
  for (const [fieldKey, group] of groups) {
    if (new Set(group.map((field) => field.normalizedValue)).size > 1) {
      conflictKeys.add(fieldKey);
      reasons.push(`field_conflict:${fieldKey}`);
    }
  }
  for (const fieldKey of CRITICAL_RECEIPT_FIELDS) {
    const group = groups.get(fieldKey) ?? [];
    if (!group.length) {
      reasons.push(`critical_field_missing:${fieldKey}`);
      continue;
    }
    if (conflictKeys.has(fieldKey)) continue;
    const selected = group.reduce((best, field) =>
      field.confidence > best.confidence ? field : best);
    if (selected.confidence < minConfidence) {
      reasons.push(`critical_field_low_confidence:${fieldKey}`);
    }
    if (!validReceiptCriticalValue(fieldKey, selected.normalizedValue)) {
      reasons.push(`critical_field_invalid:${fieldKey}`);
    }
  }
  if (result.safetyClear !== true) reasons.push('safety_check_not_clear');

  const rows = candidates.flatMap((candidate) => {
    const group = groups.get(candidate.fieldKey) ?? [];
    return [{
      ...candidate,
      candidateNo: group.indexOf(candidate) + 1,
      confidence: candidate.confidence.toFixed(4),
      reviewState: conflictKeys.has(candidate.fieldKey)
        ? 'conflict' as const
        : candidate.confidence < minConfidence
          ? 'low_confidence' as const
          : 'accepted' as const,
    }];
  });
  return { rows, reasons: Array.from(new Set(reasons)) };
}

async function completeReceiptExtractionWithin(
  tx: DB,
  scope: Scope,
  job: typeof documentExtraction.$inferSelect,
  source: Awaited<ReturnType<typeof versionContext>>,
  result: ExtractionResult,
  workerId: string,
  now: Date,
) {
  await assertDocumentScanClean(tx, scope, job.versionId, 'ocr');
  const policy = await policyFor(tx, scope);
  const minConfidence = Number(policy.autoSubmitMinConfidence);
  if (job.provider !== 'local_ocr' && job.provider !== 'byok_vision') {
    throw new Error(`Unsupported extraction provider: ${job.provider}.`);
  }
  if (!result.rawText.trim() || result.rawText.length > 5_000_000) {
    throw new Error('Extractor returned invalid raw text.');
  }
  const prepared = prepareExtractionFields(result, job.provider, minConfidence);
  const visualFingerprint = result.visualFingerprint?.trim().toLowerCase() || null;
  if (visualFingerprint && !/^[0-9a-f]{64}$/.test(visualFingerprint)) {
    throw new Error('Extractor returned an invalid visual fingerprint.');
  }

  const [duplicate] = await tx.select({ id: documentVersion.id })
    .from(documentVersion)
    .innerJoin(managedDocument, and(
      eq(managedDocument.masterFn, documentVersion.masterFn),
      eq(managedDocument.companyFn, documentVersion.companyFn),
      eq(managedDocument.id, documentVersion.documentId),
    ))
    .where(and(
      eq(documentVersion.masterFn, scope.masterFn),
      eq(documentVersion.companyFn, scope.companyFn),
      eq(documentVersion.sha256, source.version.sha256),
      ne(documentVersion.id, job.versionId),
      eq(managedDocument.purpose, 'receipt'),
    ))
    .limit(1);
  if (duplicate) prepared.reasons.push('duplicate_receipt');

  const [authorization] = await tx.select()
    .from(receiptUploadAuthorization)
    .where(and(
      eq(receiptUploadAuthorization.masterFn, scope.masterFn),
      eq(receiptUploadAuthorization.companyFn, scope.companyFn),
      eq(receiptUploadAuthorization.versionId, job.versionId),
      eq(receiptUploadAuthorization.uploaderUserId, source.document.ownerUserId),
    ))
    .limit(1);
  const reviewReasons = Array.from(new Set(prepared.reasons));
  const checksClear = reviewReasons.length === 0;
  const autoSubmit = checksClear
    && policy.autoSubmitEnabled
    && authorization?.autoSubmitAuthorized === true
    && authorization.authorizedAt != null;
  const status = !checksClear ? 'review_required' : autoSubmit ? 'submitted' : 'ready';
  const rawText = result.rawText.trim();
  const [updated] = await tx.update(documentExtraction).set({
    status: 'succeeded',
    model: result.model,
    rawText,
    outputSha256: sha256Text(rawText),
    visualFingerprint,
    completedAt: now,
    lockedAt: null,
    lockedBy: null,
    lastError: null,
    updatedAt: now,
  }).where(and(
    eq(documentExtraction.id, job.id),
    eq(documentExtraction.lockedBy, workerId),
  )).returning({ id: documentExtraction.id });
  if (!updated) return null;

  if (prepared.rows.length) {
    await tx.insert(documentExtractionField).values(prepared.rows.map((field) => ({
      ...scope,
      extractionId: job.id,
      ...field,
    }))).onConflictDoNothing();
  }
  const [inbox] = await tx.insert(receiptInboxItem).values({
    ...scope,
    versionId: job.versionId,
    extractionId: job.id,
    ownerUserId: source.document.ownerUserId,
    status,
    reviewReasons,
    duplicateOfVersionId: duplicate?.id ?? null,
    submissionKind: autoSubmit ? 'system' : 'none',
    authorizedByUserId: autoSubmit ? authorization!.uploaderUserId : null,
    uploadAuthorizedAt: autoSubmit ? authorization!.authorizedAt : null,
    systemActorKey: autoSubmit ? RECEIPT_SYSTEM_ACTOR : null,
    submittedAt: autoSubmit ? now : null,
  }).onConflictDoNothing().returning();
  if (inbox?.status === 'submitted') {
    await markDocumentSystemSubmittedWithin(
      tx,
      scope,
      source.document.id,
      source.document.ownerUserId,
      now,
    );
    await tx.insert(outboxEvent).values({
      ...scope,
      topic: RECEIPT_SUBMISSION_TOPIC,
      aggregateType: 'receipt_inbox_item',
      aggregateId: String(inbox.id),
      payload: {
        inboxItemId: inbox.id,
        versionId: job.versionId,
        authorizedByUserId: inbox.authorizedByUserId,
        systemActorKey: inbox.systemActorKey,
      },
    }).onConflictDoNothing();
  }
  return inbox ?? null;
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
      const completed = await withTenantTransaction(db, scope, async (tx) => {
        if (source.document.purpose === 'receipt') {
          return Boolean(await completeReceiptExtractionWithin(
            tx, scope, job, source, result, workerId, now,
          ));
        }
        await assertDocumentScanClean(tx, scope, job.versionId, 'ocr');
        const rawText = result.rawText.trim();
        if (!rawText || result.rawText.length > 5_000_000) {
          throw new Error('Extractor returned invalid raw text.');
        }
        const [updated] = await tx.update(documentExtraction).set({
          status: 'succeeded',
          model: result.model,
          rawText,
          outputSha256: sha256Text(rawText),
          completedAt: now,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          updatedAt: now,
        }).where(and(
          eq(documentExtraction.id, job.id),
          eq(documentExtraction.lockedBy, workerId),
        )).returning({ id: documentExtraction.id });
        return Boolean(updated);
      });
      if (!completed) throw new Error('Extraction lease was lost before completion.');
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
