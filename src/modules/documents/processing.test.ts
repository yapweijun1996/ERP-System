import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import {
  appUser,
  documentExtraction,
  documentProcessingPolicy,
  documentScanJob,
  integrationConnector,
  outboxEvent,
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
      now: new Date('2026-07-26T00:00:00.000Z'),
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
      now: new Date('2026-07-26T00:01:00.000Z'),
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
      now: new Date('2026-07-26T00:02:00.000Z'),
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
      now: new Date('2026-07-26T00:00:00.000Z'),
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
      now: new Date('2026-07-26T00:00:00.000Z'),
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
});
