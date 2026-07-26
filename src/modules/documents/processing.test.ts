import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
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
} from './processing';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);

async function setup() {
  const db = await freshDb();
  await seedDemo(db);
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  return { db, viewer };
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

  it('never creates extraction work for infected or indeterminate content', async () => {
    const { db, viewer } = await setup();
    await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'processing_infected_001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
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
