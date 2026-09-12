import { and, eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appUser,
  documentExtraction,
  documentExtractionField,
  documentProcessingPolicy,
  documentScanJob,
  integrationConnector,
  outboxEvent,
  receiptInboxItem,
  receiptUploadAuthorization,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { encryptToken } from '../../auth/tokenCrypto';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { uploadReceiptDocument } from './upload';
import {
  assertDocumentScanClean,
  processDocumentJobBatch,
  retryDocumentProcessing,
} from './processing';
import { createHttpByokVisionExtractor, createHttpLocalOcrExtractor } from './processingDrivers';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const uploadNow = new Date('2026-07-26T11:59:00.000Z');
const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);
const changedJpeg = Uint8Array.from([...jpeg, 0x01]);

afterEach(() => {
  vi.unstubAllGlobals();
});

async function setup() {
  const db = await freshDb();
  await seedDemo(db);
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  return { db, viewer, admin };
}

const safeReceiptFields = [
  { fieldKey: 'merchant_name', value: 'Merchant Example', sourceRef: 'page:1:block:1', confidence: 0.995 },
  { fieldKey: 'transaction_date', value: '2026-07-25', sourceRef: 'page:1:block:2', confidence: 0.992 },
  { fieldKey: 'currency', value: 'SGD', sourceRef: 'page:1:block:3', confidence: 0.999 },
  { fieldKey: 'total_amount', value: '10.00', sourceRef: 'page:1:block:4', confidence: 0.998 },
];

function safeExtractor() {
  return {
    extract: async () => ({
      rawText: 'Merchant Example\n2026-07-25\nSGD 10.00',
      model: 'local-receipt-v1',
      safetyClear: true,
      fields: safeReceiptFields,
    }),
  };
}

function cleanScanner() {
  return {
    scan: async () => ({ status: 'clean' as const, scanner: 'clamav-test' }),
  };
}

describe('quarantined document processing', () => {
  it('fails closed while scanning is unavailable, then extracts once after a clean retry', async () => {
    const { db, viewer } = await setup();
    const stored = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_retry_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });

    expect(await db.select().from(documentScanJob)).toHaveLength(1);
    expect(await db.select().from(documentExtraction)).toHaveLength(0);
    const unavailable = await processDocumentJobBatch(db, {
      now: new Date('2026-07-26T12:00:00.000Z'),
    });
    expect(unavailable).toMatchObject({ scansClaimed: 1, failed: 1, extracted: 0 });
    expect((await db.select().from(documentScanJob))[0]).toMatchObject({
      status: 'unavailable',
    });
    expect(await db.select().from(documentExtraction)).toHaveLength(0);
    for (const action of ['preview', 'ocr', 'submission', 'export'] as const) {
      await expect(withTenantTransaction(db, scope, (tx) =>
        assertDocumentScanClean(tx, scope, stored.version.id, action)))
        .rejects.toMatchObject({
          code: 'document_quarantined',
          action,
          scanStatus: 'unavailable',
        });
    }

    const scan = vi.fn(async () => ({
      status: 'clean' as const,
      scanner: 'clamav-test',
      resultCode: 'ok',
    }));
    const extract = vi.fn(async () => ({
      rawText: 'Merchant Example\nTotal 10.00',
      model: 'local-ocr-test',
    }));
    const processed = await processDocumentJobBatch(db, {
      scanner: { scan },
      localOcr: { extract },
      now: new Date('2026-07-26T12:01:00.000Z'),
    });
    expect(processed).toMatchObject({
      scansClaimed: 1,
      clean: 1,
      extractionsClaimed: 1,
      extracted: 1,
      failed: 0,
    });
    expect(scan).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledTimes(1);
    expect((await db.select().from(documentExtraction))[0]).toMatchObject({
      extractionVersion: 1,
      provider: 'local_ocr',
      model: 'local-ocr-test',
      status: 'succeeded',
      rawText: 'Merchant Example\nTotal 10.00',
    });
    await expect(withTenantTransaction(db, scope, (tx) =>
      assertDocumentScanClean(tx, scope, stored.version.id, 'preview')))
      .resolves.toMatchObject({ status: 'clean' });
    expect(await db.select().from(documentScanJob)).toHaveLength(1);
    expect(await db.select().from(documentExtraction)).toHaveLength(1);
    expect((await db.select().from(outboxEvent))
      .filter((row) => row.topic.startsWith('document.'))
      .every((row) => row.deliveredAt != null)).toBe(true);

    const retry = await processDocumentJobBatch(db, {
      scanner: { scan },
      localOcr: { extract },
      now: new Date('2026-07-26T12:02:00.000Z'),
    });
    expect(retry).toMatchObject({ scansClaimed: 0, extractionsClaimed: 0 });
    expect(scan).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledTimes(1);
  });

  it('persists bounded processing errors without provider details', async () => {
    const { db, viewer } = await setup();
    const sensitiveMessage = 'provider response https://fixture-user:fixture-secret@vision.example.test/result?token=fixture';
    const scanned = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_error_redaction_scan_001',
      fileName: 'scan-error.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const scanResult = await processDocumentJobBatch(db, {
      scanner: { scan: async () => { throw new Error(sensitiveMessage); } },
      maxAttempts: 1,
      now: new Date('2026-07-26T12:00:00.000Z'),
    });
    expect(scanResult).toMatchObject({ scansClaimed: 1, failed: 1 });
    const [scanJob] = await db.select().from(documentScanJob)
      .where(eq(documentScanJob.versionId, scanned.version.id));
    const scanSignal = (await db.select().from(outboxEvent))
      .find((row) => row.topic === 'document.scan.requested'
        && row.aggregateId === String(scanned.version.id));
    expect(scanJob.lastError).toBe('Document processing failed.');
    expect(scanSignal?.lastError).toBe('Document processing failed.');
    expect(JSON.stringify({ scanJob, scanSignal })).not.toContain('fixture-secret');

    const extracted = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_error_redaction_extract_001',
      fileName: 'extract-error.jpg',
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45]),
      processingNow: uploadNow,
    });
    const extractionResult = await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      localOcr: { extract: async () => { throw new Error(sensitiveMessage); } },
      now: new Date('2026-07-26T12:01:00.000Z'),
    });
    expect(extractionResult).toMatchObject({ scansClaimed: 1, clean: 1, extractionsClaimed: 1, failed: 1 });
    const [extractionJob] = await db.select().from(documentExtraction)
      .where(eq(documentExtraction.versionId, extracted.version.id));
    const extractionSignal = (await db.select().from(outboxEvent))
      .find((row) => row.topic === 'document.extraction.requested'
        && row.aggregateId === String(extracted.version.id));
    expect(extractionJob.lastError).toBe('Document processing failed.');
    expect(extractionSignal?.lastError).toBe('Document processing failed.');
    expect(JSON.stringify({ extractionJob, extractionSignal })).not.toContain('fixture-secret');
  });

  it('never creates extraction work for infected or indeterminate content', async () => {
    const { db, viewer } = await setup();
    await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_infected_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const result = await processDocumentJobBatch(db, {
      scanner: {
        scan: async () => ({
          status: 'infected',
          scanner: 'clamav-test',
          resultCode: 'eicar',
        }),
      },
      localOcr: {
        extract: async () => {
          throw new Error('must not run');
        },
      },
      now: new Date('2026-07-26T12:00:00.000Z'),
    });
    expect(result).toMatchObject({ blocked: 1, extracted: 0 });
    expect((await db.select().from(documentScanJob))[0]).toMatchObject({
      status: 'infected',
      resultCode: 'eicar',
    });
    expect(await db.select().from(documentExtraction)).toHaveLength(0);
  });

  it('uses BYOK Vision only with connected credentials, region and retention policy', async () => {
    const { db, viewer } = await setup();
    const encryptionKey = Buffer.alloc(32, 7);
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'byok_vision',
      visionProvider: 'openai',
      visionRegion: 'sg',
      visionRetentionDays: 0,
      updatedByUserId: viewer.userId,
    });
    await db.update(integrationConnector).set({
      status: 'connected',
      health: 'healthy',
      endpointHost: 'api.example.invalid',
      credentialEnvelope: encryptToken('vision-secret', encryptionKey),
      enabled: true,
    }).where(eq(integrationConnector.connectorKey, 'document-vision'));
    await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_vision_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const vision = vi.fn(async (input: {
      region?: string;
      retentionDays?: number;
      credential?: string;
    }) => ({
      rawText: `vision:${input.region}:${input.retentionDays}`,
      model: 'vision-test',
    }));
    const result = await processDocumentJobBatch(db, {
      scanner: {
        scan: async () => ({ status: 'clean', scanner: 'clamav-test' }),
      },
      vision: { extract: vision },
      credentialEncryptionKey: encryptionKey,
      now: new Date('2026-07-26T12:00:00.000Z'),
    });
    expect(result).toMatchObject({ clean: 1, extracted: 1, failed: 0 });
    expect(vision).toHaveBeenCalledWith(expect.objectContaining({
      region: 'sg',
      retentionDays: 0,
      credential: 'vision-secret',
    }));
    expect((await db.select().from(documentExtraction))[0]).toMatchObject({
      provider: 'byok_vision',
      status: 'succeeded',
      model: 'vision-test',
    });
  });

  it('passes a credential-free OpenAI-compatible endpoint through the governed vision gateway', async () => {
    const { db, viewer } = await setup();
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'byok_vision',
      visionProvider: 'openai_compatible',
      visionRegion: 'local',
      visionRetentionDays: 0,
      visionBaseUrl: 'http://127.0.0.1:1234/v1',
      visionModel: 'receipt-vision-local',
      visionCredentialRequired: false,
      updatedByUserId: viewer.userId,
    });
    await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_compatible_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const vision = vi.fn(async () => ({
      rawText: 'LM Studio receipt',
      model: 'receipt-vision-local',
    }));
    const result = await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      vision: { extract: vision },
      now: new Date('2026-07-26T12:00:00.000Z'),
    });
    expect(result).toMatchObject({ clean: 1, extracted: 1, failed: 0 });
    expect(vision).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openai_compatible',
      baseUrl: 'http://127.0.0.1:1234/v1',
      model: 'receipt-vision-local',
      region: 'local',
      retentionDays: 0,
      credential: undefined,
    }));
  });

  it('does not call Vision or local OCR when an optional connector has a malformed envelope', async () => {
    const { db, viewer } = await setup();
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'byok_vision',
      visionProvider: 'openai_compatible',
      visionRegion: 'local',
      visionRetentionDays: 0,
      visionBaseUrl: 'http://127.0.0.1:1234/v1',
      visionModel: 'receipt-vision-local',
      visionCredentialRequired: false,
      updatedByUserId: viewer.userId,
    });
    await db.update(integrationConnector).set({
      credentialRequired: false,
      status: 'connected',
      health: 'healthy',
      endpointHost: 'vision-gateway.example.test',
      credentialEnvelope: { secret: 'plaintext' },
      enabled: true,
    }).where(eq(integrationConnector.connectorKey, 'document-vision'));
    await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_compatible_malformed_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const vision = vi.fn();
    const localOcr = vi.fn();
    const result = await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      vision: { extract: vision },
      localOcr: { extract: localOcr },
      now: new Date('2026-07-26T12:00:00.000Z'),
    });

    expect(result).toMatchObject({ clean: 1, extracted: 0, failed: 1 });
    expect(vision).not.toHaveBeenCalled();
    expect(localOcr).not.toHaveBeenCalled();
    expect((await db.select().from(documentExtraction))[0]).toMatchObject({
      provider: 'byok_vision',
      status: 'unavailable',
      rawText: null,
    });
  });

  it('does not call Vision or local OCR after a connector is revoked', async () => {
    const { db, viewer } = await setup();
    const encryptionKey = Buffer.alloc(32, 8);
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'byok_vision',
      visionProvider: 'openai',
      visionRegion: 'sg',
      visionRetentionDays: 0,
      updatedByUserId: viewer.userId,
    });
    await db.update(integrationConnector).set({
      status: 'paused',
      health: 'error',
      enabled: false,
      credentialEnvelope: null,
    }).where(eq(integrationConnector.connectorKey, 'document-vision'));
    await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_vision_revoked_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const vision = vi.fn();
    const localOcr = vi.fn();
    const result = await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      vision: { extract: vision },
      localOcr: { extract: localOcr },
      credentialEncryptionKey: encryptionKey,
      now: new Date('2026-07-26T12:00:00.000Z'),
    });

    expect(result).toMatchObject({ clean: 1, extracted: 0, failed: 1 });
    expect(vision).not.toHaveBeenCalled();
    expect(localOcr).not.toHaveBeenCalled();
    expect((await db.select().from(documentExtraction))[0]).toMatchObject({
      provider: 'byok_vision',
      status: 'unavailable',
      rawText: null,
    });
  });

  it('does not call Vision when a persisted credential envelope is malformed', async () => {
    const { db, viewer } = await setup();
    const encryptionKey = Buffer.alloc(32, 8);
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'byok_vision',
      visionProvider: 'openai',
      visionRegion: 'sg',
      visionRetentionDays: 0,
      updatedByUserId: viewer.userId,
    });
    await db.update(integrationConnector).set({
      status: 'connected',
      health: 'healthy',
      endpointHost: 'api.example.invalid',
      credentialEnvelope: { secret: 'plaintext' },
      enabled: true,
    }).where(eq(integrationConnector.connectorKey, 'document-vision'));
    await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_vision_malformed_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const vision = vi.fn();
    const localOcr = vi.fn();
    const result = await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      vision: { extract: vision },
      localOcr: { extract: localOcr },
      credentialEncryptionKey: encryptionKey,
      now: new Date('2026-07-26T12:00:00.000Z'),
    });

    expect(result).toMatchObject({ clean: 1, extracted: 0, failed: 1 });
    expect(vision).not.toHaveBeenCalled();
    expect(localOcr).not.toHaveBeenCalled();
    expect((await db.select().from(documentExtraction))[0]).toMatchObject({
      provider: 'byok_vision',
      status: 'unavailable',
      rawText: null,
    });
  });

  it('uses explicit retry/manual review after a gateway failure and never auto-falls back to local OCR', async () => {
    const { db, viewer } = await setup();
    const encryptionKey = Buffer.alloc(32, 9);
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'byok_vision',
      visionProvider: 'openai',
      visionRegion: 'sg',
      visionRetentionDays: 0,
      updatedByUserId: viewer.userId,
    });
    await db.update(integrationConnector).set({
      status: 'connected',
      health: 'healthy',
      endpointHost: 'api.example.invalid',
      credentialEnvelope: encryptToken('vision-retry-secret', encryptionKey),
      enabled: true,
    }).where(eq(integrationConnector.connectorKey, 'document-vision'));
    const stored = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_vision_retry_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const scan = vi.fn(async () => ({ status: 'clean' as const, scanner: 'clamav-test' }));
    let attempts = 0;
    const vision = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('Vision gateway timeout');
      return { rawText: 'Vision retry response', model: 'vision-retry-test', safetyClear: false };
    });
    const localOcr = vi.fn(async () => ({ rawText: 'must not be used', model: 'local-fallback' }));

    const first = await processDocumentJobBatch(db, {
      scanner: { scan },
      vision: { extract: vision },
      localOcr: { extract: localOcr },
      credentialEncryptionKey: encryptionKey,
      workerId: 'vision-retry-worker',
      now: new Date('2026-07-26T12:00:00.000Z'),
    });
    const [failedExtraction] = await db.select().from(documentExtraction);
    expect(first).toMatchObject({ clean: 1, extracted: 0, failed: 1 });
    expect(failedExtraction).toMatchObject({
      versionId: stored.version.id,
      status: 'failed',
      attempts: 1,
      rawText: null,
    });
    expect(localOcr).not.toHaveBeenCalled();

    const second = await processDocumentJobBatch(db, {
      scanner: { scan },
      vision: { extract: vision },
      localOcr: { extract: localOcr },
      credentialEncryptionKey: encryptionKey,
      workerId: 'vision-retry-worker-2',
      now: new Date(failedExtraction.availableAt.getTime() + 1),
    });
    const [succeededExtraction] = await db.select().from(documentExtraction);
    expect(second).toMatchObject({ scansClaimed: 0, extractionsClaimed: 1, extracted: 1, failed: 0 });
    expect(succeededExtraction).toMatchObject({
      id: failedExtraction.id,
      versionId: stored.version.id,
      status: 'succeeded',
      rawText: 'Vision retry response',
    });
    expect(vision).toHaveBeenCalledTimes(2);
    expect(localOcr).not.toHaveBeenCalled();
    expect(await db.select().from(documentExtraction)).toHaveLength(1);
    expect((await db.select().from(receiptInboxItem))[0]).toMatchObject({
      versionId: stored.version.id,
      status: 'review_required',
    });
  });

  it.each([401, 500])(
    'keeps extraction unsafe when the HTTP Vision driver returns %s',
    async (status) => {
      const { db, viewer } = await setup();
      const encryptionKey = Buffer.alloc(32, 10);
      await db.insert(documentProcessingPolicy).values({
        ...scope,
        extractionProvider: 'byok_vision',
        visionProvider: 'openai',
        visionRegion: 'sg',
        visionRetentionDays: 0,
        updatedByUserId: viewer.userId,
      });
      await db.update(integrationConnector).set({
        status: 'connected',
        health: 'healthy',
        endpointHost: 'vision.example.test',
        credentialEnvelope: encryptToken('vision-http-secret', encryptionKey),
        enabled: true,
      }).where(eq(integrationConnector.connectorKey, 'document-vision'));
      const stored = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
        clientDraftId: `processing_vision_http_${status}`,
        fileName: 'receipt.jpg',
        declaredMimeType: 'image/jpeg',
        content: jpeg,
        processingNow: uploadNow,
      });
      const fetchMock = vi.fn(async () => new Response(
        JSON.stringify({ error: 'upstream-secret https://vision.example.test/?token=fixture' }),
        { status, headers: { 'content-type': 'application/json' } },
      ));
      vi.stubGlobal('fetch', fetchMock);
      const localOcr = vi.fn(async () => ({ rawText: 'must not be used', model: 'local-fallback' }));

      const result = await processDocumentJobBatch(db, {
        scanner: cleanScanner(),
        vision: createHttpByokVisionExtractor('https://vision.example.test/extract'),
        localOcr: { extract: localOcr },
        credentialEncryptionKey: encryptionKey,
        workerId: `vision-http-worker-${status}`,
        now: new Date('2026-07-26T12:00:00.000Z'),
      });

      expect(result).toMatchObject({
        scansClaimed: 1,
        clean: 1,
        extractionsClaimed: 1,
        extracted: 0,
        failed: 1,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(localOcr).not.toHaveBeenCalled();
      const [extraction] = await db.select().from(documentExtraction)
        .where(eq(documentExtraction.versionId, stored.version.id));
      expect(extraction).toMatchObject({
        provider: 'byok_vision',
        status: 'failed',
        rawText: null,
        lastError: 'Document processing failed.',
      });
      expect(JSON.stringify(extraction)).not.toContain('upstream-secret');
      expect(JSON.stringify(extraction)).not.toContain('fixture');
    },
  );

  it('persists extraction through the HTTP Local OCR worker path', async () => {
    const { db, viewer } = await setup();
    const stored = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_local_ocr_http_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(init?.redirect).toBe('error');
      expect(init?.headers).toMatchObject({
        'content-type': 'image/jpeg',
        'x-content-sha256': stored.version.sha256,
      });
      expect(Buffer.from(init?.body as Uint8Array)).toEqual(Buffer.from(jpeg));
      return new Response(JSON.stringify({
        rawText: 'Coffee Demo Pte Ltd\nDEMO-234-0911\nSGD 32.80',
        model: 'tesseract-5.5.3-local',
        safetyClear: true,
        fields: safeReceiptFields,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      localOcr: createHttpLocalOcrExtractor('http://127.0.0.1:4567/extract'),
      workerId: 'local-ocr-http-worker',
      now: new Date('2026-07-26T12:00:00.000Z'),
    });

    expect(result).toMatchObject({
      scansClaimed: 1,
      clean: 1,
      extractionsClaimed: 1,
      extracted: 1,
      failed: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await db.select().from(documentExtraction))[0]).toMatchObject({
      versionId: stored.version.id,
      provider: 'local_ocr',
      model: 'tesseract-5.5.3-local',
      status: 'succeeded',
      rawText: 'Coffee Demo Pte Ltd\nDEMO-234-0911\nSGD 32.80',
    });
  });

  it('keeps each tenant scope bound when claiming Local OCR jobs', async () => {
    const { db, viewer, admin } = await setup();
    const singapore = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_local_ocr_scope_sg_001',
      fileName: 'sg-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const malaysia = await uploadReceiptDocument(
      db,
      { masterFn: 'M1', companyFn: 'C-MY' },
      { userId: admin.userId },
      {
        clientDraftId: 'processing_local_ocr_scope_my_001',
        fileName: 'my-receipt.jpg',
        declaredMimeType: 'image/jpeg',
        content: changedJpeg,
        processingNow: uploadNow,
      },
    );
    const extract = vi.fn(async (input: {
      content: Uint8Array;
      sha256: string;
      mimeType: string;
    }) => ({
      rawText: `tenant-source:${input.sha256}`,
      model: 'local-ocr-tenant-scope-test',
      safetyClear: true,
    }));

    const result = await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      localOcr: { extract },
      workerId: 'local-ocr-tenant-scope-worker',
      now: new Date('2026-07-26T12:00:00.000Z'),
    });

    expect(result).toMatchObject({
      scansClaimed: 2,
      clean: 2,
      extractionsClaimed: 2,
      extracted: 2,
      failed: 0,
    });
    expect(extract).toHaveBeenCalledTimes(2);
    const calls = extract.mock.calls.map(([input]) => input);
    expect(new Set(calls.map((input) => input.sha256))).toEqual(new Set([
      singapore.version.sha256,
      malaysia.version.sha256,
    ]));
    expect(calls.find((input) => input.sha256 === singapore.version.sha256)?.content)
      .toEqual(jpeg);
    expect(calls.find((input) => input.sha256 === malaysia.version.sha256)?.content)
      .toEqual(changedJpeg);

    const extractions = await db.select().from(documentExtraction);
    expect(extractions).toHaveLength(2);
    expect(extractions.find((row) => row.versionId === singapore.version.id)).toMatchObject({
      masterFn: 'M1',
      companyFn: 'C-SG',
      provider: 'local_ocr',
      status: 'succeeded',
      rawText: `tenant-source:${singapore.version.sha256}`,
    });
    expect(extractions.find((row) => row.versionId === malaysia.version.id)).toMatchObject({
      masterFn: 'M1',
      companyFn: 'C-MY',
      provider: 'local_ocr',
      status: 'succeeded',
      rawText: `tenant-source:${malaysia.version.sha256}`,
    });
  });

  it('keeps each tenant extraction policy and credential bound in one worker pass', async () => {
    const { db, viewer, admin } = await setup();
    const malaysiaScope = { masterFn: 'M1', companyFn: 'C-MY' };
    const encryptionKey = Buffer.alloc(32, 13);
    await db.insert(documentProcessingPolicy).values({
      ...malaysiaScope,
      extractionProvider: 'byok_vision',
      visionProvider: 'openai_compatible',
      visionRegion: 'my',
      visionRetentionDays: 30,
      visionBaseUrl: 'https://vision.my.example.test/extract',
      visionModel: 'my-vision-v1',
      visionCredentialRequired: true,
      updatedByUserId: admin.userId,
    });
    await db.update(integrationConnector).set({
      status: 'connected',
      health: 'healthy',
      endpointHost: 'vision.my.example.test',
      credentialEnvelope: encryptToken('my-only-vision-secret', encryptionKey),
      enabled: true,
    }).where(and(
      eq(integrationConnector.masterFn, malaysiaScope.masterFn),
      eq(integrationConnector.companyFn, malaysiaScope.companyFn),
      eq(integrationConnector.connectorKey, 'document-vision'),
    ));
    const singapore = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_policy_scope_sg_001',
      fileName: 'sg-policy-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const malaysia = await uploadReceiptDocument(db, malaysiaScope, { userId: admin.userId }, {
      clientDraftId: 'processing_policy_scope_my_001',
      fileName: 'my-policy-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: changedJpeg,
      processingNow: uploadNow,
    });
    const localOcr = vi.fn(async (input: {
      content: Uint8Array;
      sha256: string;
      region?: string;
      credential?: string;
    }) => {
      expect(input.region).toBeUndefined();
      expect(input.credential).toBeUndefined();
      return { rawText: `sg-local:${input.sha256}`, model: 'sg-local-ocr', safetyClear: true };
    });
    const vision = vi.fn(async (input: {
      content: Uint8Array;
      sha256: string;
      region?: string;
      retentionDays?: number;
      credential?: string;
      provider?: string;
      baseUrl?: string;
      model?: string;
    }) => {
      expect(input.region).toBe('my');
      expect(input.retentionDays).toBe(30);
      expect(input.credential).toBe('my-only-vision-secret');
      expect(input.provider).toBe('openai_compatible');
      expect(input.baseUrl).toBe('https://vision.my.example.test/extract');
      expect(input.model).toBe('my-vision-v1');
      return { rawText: `my-vision:${input.sha256}`, model: 'my-vision-v1', safetyClear: true };
    });

    const result = await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      localOcr: { extract: localOcr },
      vision: { extract: vision },
      credentialEncryptionKey: encryptionKey,
      workerId: 'policy-scope-worker',
      now: new Date('2026-07-26T12:00:00.000Z'),
    });

    expect(result).toMatchObject({
      scansClaimed: 2,
      clean: 2,
      extractionsClaimed: 2,
      extracted: 2,
      failed: 0,
    });
    expect(localOcr).toHaveBeenCalledTimes(1);
    expect(vision).toHaveBeenCalledTimes(1);
    expect(localOcr.mock.calls[0][0].content).toEqual(jpeg);
    expect(localOcr.mock.calls[0][0].sha256).toBe(singapore.version.sha256);
    expect(vision.mock.calls[0][0].content).toEqual(changedJpeg);
    expect(vision.mock.calls[0][0].sha256).toBe(malaysia.version.sha256);

    const extractions = await db.select().from(documentExtraction);
    expect(extractions.find((row) => row.versionId === singapore.version.id)).toMatchObject({
      masterFn: 'M1',
      companyFn: 'C-SG',
      provider: 'local_ocr',
      model: 'sg-local-ocr',
      status: 'succeeded',
      rawText: `sg-local:${singapore.version.sha256}`,
    });
    expect(extractions.find((row) => row.versionId === malaysia.version.id)).toMatchObject({
      masterFn: 'M1',
      companyFn: 'C-MY',
      provider: 'byok_vision',
      model: 'my-vision-v1',
      status: 'succeeded',
      rawText: `my-vision:${malaysia.version.sha256}`,
    });
  });

  it('persists the provider visual fingerprint through the HTTP Vision worker path', async () => {
    const { db, viewer } = await setup();
    const encryptionKey = Buffer.alloc(32, 10);
    const visualFingerprint = 'ab'.repeat(32);
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'byok_vision',
      visionProvider: 'openai',
      visionRegion: 'sg',
      visionRetentionDays: 0,
      updatedByUserId: viewer.userId,
    });
    await db.update(integrationConnector).set({
      status: 'connected',
      health: 'healthy',
      endpointHost: 'vision.example.test',
      credentialEnvelope: encryptToken('vision-http-secret', encryptionKey),
      enabled: true,
    }).where(eq(integrationConnector.connectorKey, 'document-vision'));
    const stored = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_vision_http_fingerprint',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      rawText: 'Merchant Example\nTotal 10.00',
      model: 'vision-fingerprint-test',
      visualFingerprint: visualFingerprint.toUpperCase(),
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      vision: createHttpByokVisionExtractor('https://vision.example.test/extract'),
      credentialEncryptionKey: encryptionKey,
      workerId: 'vision-http-fingerprint-worker',
      now: new Date('2026-07-26T12:00:00.000Z'),
    });

    expect(result).toMatchObject({
      scansClaimed: 1,
      clean: 1,
      extractionsClaimed: 1,
      extracted: 1,
      failed: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [extraction] = await db.select().from(documentExtraction)
      .where(eq(documentExtraction.versionId, stored.version.id));
    expect(extraction).toMatchObject({
      provider: 'byok_vision',
      status: 'succeeded',
      model: 'vision-fingerprint-test',
      visualFingerprint,
    });
  });

  it('auto-submits exactly once only with prior uploader authorization and every check clear', async () => {
    const { db, viewer } = await setup();
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'local_ocr',
      autoSubmitEnabled: true,
      autoSubmitMinConfidence: '0.9800',
      updatedByUserId: viewer.userId,
    });
    const stored = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_auto_submit_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      autoSubmitAuthorized: true,
      processingNow: uploadNow,
    });
    const result = await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      localOcr: safeExtractor(),
      workerId: 'auto-submit-worker',
      now: new Date('2026-07-26T12:00:00.000Z'),
    });
    expect(result).toMatchObject({ clean: 1, extracted: 1, failed: 0 });
    expect(await db.select().from(documentExtractionField)).toHaveLength(4);
    expect((await db.select().from(receiptUploadAuthorization))[0]).toMatchObject({
      versionId: stored.version.id,
      uploaderUserId: viewer.userId,
      autoSubmitAuthorized: true,
      statementVersion: 'receipt-auto-submit-v1',
    });
    expect((await db.select().from(receiptInboxItem))[0]).toMatchObject({
      versionId: stored.version.id,
      status: 'submitted',
      reviewReasons: [],
      submissionKind: 'system',
      authorizedByUserId: viewer.userId,
      systemActorKey: 'receipt-auto-submit-v1',
    });
    expect((await db.select().from(outboxEvent))
      .filter((row) => row.topic === 'receipt.inbox.submitted')).toHaveLength(1);

    await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      localOcr: safeExtractor(),
      workerId: 'auto-submit-retry-worker',
      now: new Date('2026-07-26T12:01:00.000Z'),
    });
    expect(await db.select().from(documentExtractionField)).toHaveLength(4);
    expect(await db.select().from(receiptInboxItem)).toHaveLength(1);
    expect((await db.select().from(outboxEvent))
      .filter((row) => row.topic === 'receipt.inbox.submitted')).toHaveLength(1);
  });

  it('routes low-confidence and conflicting critical fields to explicit human review', async () => {
    const { db, viewer } = await setup();
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'local_ocr',
      autoSubmitEnabled: true,
      autoSubmitMinConfidence: '0.9800',
      updatedByUserId: viewer.userId,
    });
    await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_review_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
      autoSubmitAuthorized: true,
    });
    await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      localOcr: {
        extract: async () => ({
          rawText: 'Merchant Example\n2026-07-25\nSGD 10.00\nSGD 12.00',
          model: 'local-receipt-v1',
          safetyClear: true,
          fields: [
            ...safeReceiptFields.map((field) =>
              field.fieldKey === 'transaction_date'
                ? { ...field, confidence: 0.97 }
                : field),
            {
              fieldKey: 'total_amount',
              value: '12.00',
              sourceRef: 'page:1:block:5',
              confidence: 0.999,
            },
          ],
        }),
      },
      now: new Date('2026-07-26T12:00:00.000Z'),
    });
    const [inbox] = await db.select().from(receiptInboxItem);
    expect(inbox).toMatchObject({
      status: 'review_required',
      submissionKind: 'none',
    });
    expect(inbox.reviewReasons).toEqual(expect.arrayContaining([
      'field_conflict:total_amount',
      'critical_field_low_confidence:transaction_date',
    ]));
    expect((await db.select().from(documentExtractionField))
      .filter((row) => row.reviewState === 'conflict')).toHaveLength(2);
    expect((await db.select().from(outboxEvent))
      .filter((row) => row.topic === 'receipt.inbox.submitted')).toHaveLength(0);
  });

  it('prevents exact duplicate receipt auto-submission', async () => {
    const { db, viewer } = await setup();
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'local_ocr',
      autoSubmitEnabled: true,
      autoSubmitMinConfidence: '0.9800',
      updatedByUserId: viewer.userId,
    });
    await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_original_001',
      fileName: 'original.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      autoSubmitAuthorized: true,
      processingNow: uploadNow,
    });
    await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      localOcr: safeExtractor(),
      now: new Date('2026-07-26T12:00:00.000Z'),
    });
    const duplicate = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_duplicate_001',
      fileName: 'duplicate.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      autoSubmitAuthorized: true,
      processingNow: uploadNow,
    });
    await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      localOcr: safeExtractor(),
      now: new Date('2026-07-26T12:01:00.000Z'),
    });
    const inboxes = await db.select().from(receiptInboxItem);
    const duplicateInbox = inboxes.find((row) => row.versionId === duplicate.version.id);
    expect(duplicateInbox).toMatchObject({
      status: 'review_required',
      reviewReasons: ['duplicate_receipt'],
      submissionKind: 'none',
    });
    expect(duplicateInbox?.duplicateOfVersionId).toBeTypeOf('number');
    expect((await db.select().from(outboxEvent))
      .filter((row) => row.topic === 'receipt.inbox.submitted')).toHaveLength(1);
    });
  });

  it('dead-letters repeated provider failures and manually requeues the same extraction chain', async () => {
    const { db, viewer } = await setup();
    const encryptionKey = Buffer.alloc(32, 10);
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'byok_vision',
      visionProvider: 'openai',
      visionRegion: 'sg',
      visionRetentionDays: 0,
      updatedByUserId: viewer.userId,
    });
    await db.update(integrationConnector).set({
      status: 'connected',
      health: 'healthy',
      endpointHost: 'api.example.invalid',
      credentialEnvelope: encryptToken('vision-dead-letter-secret', encryptionKey),
      enabled: true,
    }).where(eq(integrationConnector.connectorKey, 'document-vision'));
    const stored = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_vision_dead_letter_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      processingNow: uploadNow,
    });
    const vision = vi.fn(async () => {
      throw new Error('Vision gateway timeout');
    });
    const first = await processDocumentJobBatch(db, {
      scanner: cleanScanner(),
      vision: { extract: vision },
      credentialEncryptionKey: encryptionKey,
      maxAttempts: 2,
      workerId: 'vision-dead-letter-worker-1',
      now: new Date('2026-07-26T12:00:00.000Z'),
    });
    const [firstExtraction] = await db.select().from(documentExtraction);
    expect(first).toMatchObject({ clean: 1, extracted: 0, failed: 1, deadLettered: 0 });
    expect(firstExtraction).toMatchObject({
      versionId: stored.version.id,
      status: 'failed',
      attempts: 1,
      deadLetteredAt: null,
    });

    const second = await processDocumentJobBatch(db, {
      vision: { extract: vision },
      credentialEncryptionKey: encryptionKey,
      maxAttempts: 2,
      workerId: 'vision-dead-letter-worker-2',
      now: new Date(firstExtraction.availableAt.getTime() + 1),
    });
    const [deadLetteredExtraction] = await db.select().from(documentExtraction);
    const extractionSignal = (await db.select().from(outboxEvent))
      .find((row) => row.topic === 'document.extraction.requested');
    expect(second).toMatchObject({ scansClaimed: 0, extractionsClaimed: 1, failed: 1, deadLettered: 1 });
    expect(deadLetteredExtraction).toMatchObject({
      id: firstExtraction.id,
      versionId: stored.version.id,
      status: 'dead_letter',
      attempts: 2,
    });
    expect(deadLetteredExtraction.deadLetteredAt).toBeInstanceOf(Date);
    expect(extractionSignal).toMatchObject({ deliveredAt: null });
    expect(extractionSignal?.deadLetteredAt).toBeInstanceOf(Date);
    expect(vision).toHaveBeenCalledTimes(2);

    const requeued = await retryDocumentProcessing(
      db,
      scope,
      stored.version.id,
      new Date('2026-07-26T12:05:00.000Z'),
    );
    expect(requeued).toEqual({ scanRequeued: false, extractionRequeued: true });
    const [requeuedExtraction] = await db.select().from(documentExtraction);
    expect(requeuedExtraction).toMatchObject({
      id: firstExtraction.id,
      versionId: stored.version.id,
      status: 'queued',
      attempts: 0,
      deadLetteredAt: null,
    });

    const recovered = await processDocumentJobBatch(db, {
      vision: {
        extract: async () => ({ rawText: 'Manual retry response', model: 'vision-retry-test' }),
      },
      credentialEncryptionKey: encryptionKey,
      maxAttempts: 2,
      workerId: 'vision-dead-letter-worker-3',
      now: new Date('2026-07-26T12:06:00.000Z'),
    });
    const [recoveredExtraction] = await db.select().from(documentExtraction);
    const [recoveredSignal] = await db.select().from(outboxEvent).where(eq(
      outboxEvent.topic,
      'document.extraction.requested',
    ));
    expect(recovered).toMatchObject({ extractionsClaimed: 1, extracted: 1, failed: 0 });
    expect(recoveredExtraction).toMatchObject({
      id: firstExtraction.id,
      versionId: stored.version.id,
      status: 'succeeded',
      attempts: 1,
      rawText: 'Manual retry response',
    });
    expect(recoveredSignal).toMatchObject({ deliveredAt: expect.any(Date), deadLetteredAt: null });
    expect(await db.select().from(documentExtraction)).toHaveLength(1);
    expect(vision).toHaveBeenCalledTimes(2);
  });
