import { and, eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { seedDemo } from '../../data/seed';
import {
  appUser,
  companyReceiptPack,
  documentScanJob,
} from '../../data/schema';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { freshDb } from '../../test/helpers';
import { uploadReceiptDocument } from '../documents/upload';
import { createCompanyReceiptWithin, updateCompanyReceiptWithin } from './companyReceipt';
import {
  createCompanyReceiptPackWithin,
  readCompanyReceiptPackWithin,
  renderCompanyReceiptPackWithin,
} from './companyReceiptPack';

const sg = { masterFn: 'M1', companyFn: 'C-SG' };

describe('Company Receipt Pack', () => {
  let db: DB;
  let viewerId: number;
  let adminId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const users = await db.select({
      userId: appUser.userId,
      username: appUser.username,
    }).from(appUser);
    viewerId = users.find((user) => user.username === 'viewer')!.userId;
    adminId = users.find((user) => user.username === 'admin')!.userId;
  });

  async function cleanEvidence(
    actorUserId: number,
    draftId: string,
    fileName: string,
    mimeType: 'image/png' | 'application/pdf',
    content: Uint8Array,
  ) {
    const uploaded = await uploadReceiptDocument(db, sg, { userId: actorUserId }, {
      clientDraftId: draftId,
      fileName,
      declaredMimeType: mimeType,
      content,
    });
    await withTenantTransaction(db, sg, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'company-receipt-pack-test',
      resultCode: 'clean',
      completedAt: new Date('2026-08-11T08:00:00.000Z'),
    }).where(and(
      eq(documentScanJob.masterFn, sg.masterFn),
      eq(documentScanJob.companyFn, sg.companyFn),
      eq(documentScanJob.versionId, uploaded.version.id),
    )));
    return uploaded;
  }

  it('freezes every matching row, groups currencies and preserves image/PDF pages', async () => {
    const png = Uint8Array.from(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zsx8AAAAASUVORK5CYII=',
      'base64',
    ));
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([200, 300]);
    sourcePdf.addPage([300, 200]);
    const firstEvidence = await cleanEvidence(
      viewerId,
      'receipt_pack_png_0001',
      'first-receipt.png',
      'image/png',
      png,
    );
    const secondEvidence = await cleanEvidence(
      adminId,
      'receipt_pack_pdf_0001',
      'second-receipt.pdf',
      'application/pdf',
      await sourcePdf.save({ useObjectStreams: false }),
    );
    const missingDateEvidence = await cleanEvidence(
      adminId,
      'receipt_pack_missing_0001',
      'missing-date.png',
      'image/png',
      Uint8Array.from([...png, 1]),
    );
    const first = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(tx, sg, viewerId, {
        documentId: firstEvidence.document.id,
        documentVersionId: firstEvidence.version.id,
        transactionDate: '2026-08-09',
        merchant: 'Alpha Supplies',
        receiptNumber: 'SG-001',
        amount: '12.3400',
        currency: 'SGD',
        category: 'Office supplies',
        businessPurpose: 'Printer paper',
      }));
    const second = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(tx, sg, adminId, {
        documentId: secondEvidence.document.id,
        documentVersionId: secondEvidence.version.id,
        transactionDate: '2026-08-10',
        merchant: 'Beta Travel',
        receiptNumber: 'MY-002',
        amount: '20.6600',
        currency: 'MYR',
        category: 'Travel',
        businessPurpose: 'Client transport',
      }));
    await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(tx, sg, adminId, {
        documentId: missingDateEvidence.document.id,
        documentVersionId: missingDateEvidence.version.id,
        merchant: 'Missing Date Merchant',
        amount: '99.0000',
        currency: 'SGD',
        category: 'Meals',
        businessPurpose: 'Team meal',
      }));

    const created = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptPackWithin(tx, sg, adminId, 'company', {
        packKey: 'company-receipt-pack:test-0001',
        dateFrom: '2026-08-09',
        dateTo: '2026-08-10',
        locale: 'en',
      }, new Date('2026-08-11T09:00:00.000Z')));
    expect(created.replayed).toBe(false);
    expect(created.pack.rows.map((row) => row.receiptId)).toEqual([first.id, second.id]);
    expect(created.pack.totals).toEqual([
      { currency: 'MYR', amount: '20.6600', receiptCount: 1 },
      { currency: 'SGD', amount: '12.3400', receiptCount: 1 },
    ]);
    expect(created.pack).toMatchObject({ rowCount: 2, documentCount: 2 });

    await withTenantTransaction(db, sg, (tx) =>
      updateCompanyReceiptWithin(tx, sg, viewerId, first.id, 1, {
        merchant: 'Changed after snapshot',
      }));
    const frozen = await withTenantTransaction(db, sg, (tx) =>
      readCompanyReceiptPackWithin(tx, sg, adminId, created.pack.id));
    expect(frozen.rows[0]?.merchant).toBe('Alpha Supplies');

    const rendered = await withTenantTransaction(db, sg, (tx) =>
      renderCompanyReceiptPackWithin(tx, sg, adminId, created.pack.id, 'view'));
    const pdf = await PDFDocument.load(rendered.content);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(4);
    expect(rendered.sha256).toMatch(/^[0-9a-f]{64}$/);

    const replay = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptPackWithin(tx, sg, adminId, 'company', {
        packKey: 'company-receipt-pack:test-0001',
        dateFrom: '2026-08-09',
        dateTo: '2026-08-10',
        locale: 'en',
      }));
    expect(replay).toMatchObject({ replayed: true, pack: { id: created.pack.id } });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
  });

  it('rejects invalid, empty and actor-inaccessible packs without partial snapshots', async () => {
    await expect(withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptPackWithin(tx, sg, viewerId, 'own', {
        packKey: 'company-receipt-pack:invalid-range',
        dateFrom: '2026-08-11',
        dateTo: '2026-08-10',
      }))).rejects.toMatchObject({ code: 'company_receipt_pack_range_invalid' });
    await expect(withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptPackWithin(tx, sg, viewerId, 'own', {
        packKey: 'company-receipt-pack:empty',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      }))).rejects.toMatchObject({ code: 'company_receipt_pack_empty', status: 404 });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
    await expect(withTenantTransaction(db, sg, (tx) =>
      readCompanyReceiptPackWithin(tx, sg, adminId, 999_999)))
      .rejects.toMatchObject({ code: 'company_receipt_pack_not_found', status: 404 });
  });
});
