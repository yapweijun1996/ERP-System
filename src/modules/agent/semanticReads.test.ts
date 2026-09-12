import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { seedDemo } from '../../data/seed';
import { appUser, companyReceipt, documentScanJob } from '../../data/schema';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { freshDb } from '../../test/helpers';
import { uploadReceiptDocument } from '../documents/upload';
import { createCompanyReceiptWithin } from '../expenses/companyReceipt';
import {
  readCompanyReceiptSemanticSummaryWithin,
  SEMANTIC_RECEIPT_MAX_ROWS,
  SEMANTIC_RECEIPT_PAGE_SIZE,
} from './semanticReads';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

describe('bounded Company Receipt semantic reads', () => {
  let db: DB;
  let viewerId: number;
  let adminId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const users = await db.select({ userId: appUser.userId, username: appUser.username })
      .from(appUser);
    viewerId = users.find((user) => user.username === 'viewer')!.userId;
    adminId = users.find((user) => user.username === 'admin')!.userId;
  });

  async function createReceipt(
    actorUserId: number,
    draftId: string,
    transactionDate: string,
    amount: string,
    currency: string,
  ) {
    const uploaded = await uploadReceiptDocument(db, scope, { userId: actorUserId }, {
      clientDraftId: draftId,
      fileName: `${draftId}.jpg`,
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
        ...new TextEncoder().encode(draftId),
      ]),
    });
    await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'semantic-read-test',
      resultCode: 'clean',
      completedAt: new Date('2026-09-09T00:00:00.000Z'),
    }).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, uploaded.version.id),
    )));
    return withTenantTransaction(db, scope, (tx) => createCompanyReceiptWithin(
      tx,
      scope,
      actorUserId,
      {
        documentId: uploaded.document.id,
        documentVersionId: uploaded.version.id,
        transactionDate,
        merchant: `Semantic ${draftId}`,
        receiptNumber: `R-${draftId}`,
        amount,
        currency,
        category: 'Office',
        businessPurpose: 'Semantic retrieval fixture',
        notes: null,
      },
    ));
  }

  it('reconciles the bounded read with canonical receipt rows and G01 visibility', async () => {
    const own = await createReceipt(viewerId, 'semantic_viewer_0001', '2026-09-01', '10.5000', 'SGD');
    await createReceipt(adminId, 'semantic_admin_0001', '2026-09-02', '5.2500', 'SGD');
    await createReceipt(adminId, 'semantic_admin_0002', '2026-09-02', '7.7500', 'MYR');

    const ownResult = await withTenantTransaction(db, scope, (tx) =>
      readCompanyReceiptSemanticSummaryWithin(tx, {
        scope, actorUserId: viewerId, visibility: 'own',
      }, {
        dateFrom: '2026-09-01', dateTo: '2026-09-02',
        asOf: '2026-09-09T00:00:00.000Z',
      }));
    expect(ownResult).toMatchObject({
      receiptCount: 1,
      totalsByCurrency: [{ currency: 'SGD', amount: '10.5000', receiptCount: 1 }],
      sources: [{ receiptId: own.id, receiptVersion: 1 }],
    });

    const companyResult = await withTenantTransaction(db, scope, (tx) =>
      readCompanyReceiptSemanticSummaryWithin(tx, {
        scope, actorUserId: viewerId, visibility: 'company',
      }, {
        dateFrom: '2026-09-01', dateTo: '2026-09-02',
        asOf: '2026-09-09T00:00:00.000Z',
      }));
    expect(companyResult).toMatchObject({
      receiptCount: 3,
      totalsByCurrency: [
        { currency: 'MYR', amount: '7.7500', receiptCount: 1 },
        { currency: 'SGD', amount: '15.7500', receiptCount: 2 },
      ],
    });
    expect(companyResult.sources.map((source) => source.receiptId)).toEqual(
      expect.arrayContaining([own.id]),
    );
    expect(companyResult.sources.every((source) => source.documentVersionId > 0)).toBe(true);
  });

  it('uses bounded keyset pages and returns an empty result without a second tenant source', async () => {
    const result = await withTenantTransaction(db, scope, (tx) =>
      readCompanyReceiptSemanticSummaryWithin(tx, {
        scope, actorUserId: viewerId, visibility: 'own',
      }, {
        dateFrom: '2027-01-01', dateTo: '2027-01-31',
        asOf: '2026-09-09T00:00:00.000Z',
      }));
    expect(result.receiptCount).toBe(0);
    expect(result.totalsByCurrency).toEqual([]);
    expect(SEMANTIC_RECEIPT_PAGE_SIZE).toBe(100);
    expect(SEMANTIC_RECEIPT_MAX_ROWS).toBe(5000);
    expect(await db.select().from(companyReceipt)).toHaveLength(0);
  });
});
