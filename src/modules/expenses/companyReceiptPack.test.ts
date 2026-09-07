import { and, eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { seedDemo } from '../../data/seed';
import {
  appUser,
  companyReceiptPack,
  companyReceiptPackGovernanceEvent,
  companyReceiptPackPurgeRequest,
  companyReceiptPackTombstone,
  documentScanJob,
} from '../../data/schema';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { freshDb } from '../../test/helpers';
import { createManagedDocument } from '../documents/storage';
import { uploadReceiptDocument } from '../documents/upload';
import { createCompanyReceiptWithin, updateCompanyReceiptWithin } from './companyReceipt';
import {
  createCompanyReceiptPackWithin,
  listCompanyReceiptPacksWithin,
  readCompanyReceiptPackWithin,
  renderCompanyReceiptPackWithin,
} from './companyReceiptPack';
import {
  executeCompanyReceiptPackPurge,
  initiateCompanyReceiptPackPurgeWithin,
  reviewCompanyReceiptPackPurgeWithin,
  setCompanyReceiptPackLegalHoldWithin,
} from './companyReceiptPackGovernance';

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
    retentionUntil?: Date,
  ) {
    const uploaded = await uploadReceiptDocument(db, sg, { userId: actorUserId }, {
      clientDraftId: draftId,
      fileName,
      declaredMimeType: mimeType,
      content,
      retentionUntil,
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
      readCompanyReceiptPackWithin(tx, sg, adminId, 'company', created.pack.id));
    expect(frozen.rows[0]?.merchant).toBe('Alpha Supplies');
    await expect(withTenantTransaction(db, sg, (tx) =>
      readCompanyReceiptPackWithin(tx, sg, adminId, 'own', created.pack.id)))
      .rejects.toMatchObject({ code: 'company_receipt_pack_not_found', status: 404 });

    const rendered = await withTenantTransaction(db, sg, (tx) =>
      renderCompanyReceiptPackWithin(tx, sg, adminId, 'company', created.pack.id, 'view'));
    const pdf = await PDFDocument.load(rendered.content);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(4);
    expect(rendered.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(rendered.accessPurpose).toBe('receipt_pack_preview');
    await expect(withTenantTransaction(db, sg, (tx) =>
      renderCompanyReceiptPackWithin(tx, sg, adminId, 'own', created.pack.id, 'download')))
      .rejects.toMatchObject({ code: 'company_receipt_pack_not_found', status: 404 });

    const ownPack = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptPackWithin(tx, sg, viewerId, 'own', {
        packKey: 'company-receipt-pack:own-0001',
        dateFrom: '2026-08-09',
        dateTo: '2026-08-10',
        locale: 'en',
      }));
    expect(ownPack.pack.visibility).toBe('own');
    const ownRendered = await withTenantTransaction(db, sg, (tx) =>
      renderCompanyReceiptPackWithin(tx, sg, viewerId, 'own', ownPack.pack.id, 'download'));
    expect(ownRendered.accessPurpose).toBe('receipt_pack_original_evidence_export');

    const localizedPack = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptPackWithin(tx, sg, adminId, 'company', {
        packKey: 'company-receipt-pack:zh-0001',
        dateFrom: '2026-08-09',
        dateTo: '2026-08-10',
        locale: 'zh',
      }));
    const localizedRendered = await withTenantTransaction(db, sg, (tx) =>
      renderCompanyReceiptPackWithin(tx, sg, adminId, 'company', localizedPack.pack.id, 'view'));
    const localizedPdf = await PDFDocument.load(localizedRendered.content);
    expect(localizedPdf.getPageCount()).toBeGreaterThanOrEqual(4);
    expect(Buffer.from(localizedRendered.content).toString('latin1'))
      .toContain('NotoSansCJKsc-Regular');

    const history = await withTenantTransaction(db, sg, (tx) =>
      listCompanyReceiptPacksWithin(tx, sg, adminId, 'company', { limit: 2 }));
    expect(history).toHaveLength(2);
    expect(history.slice(0, 2).map((pack) => pack.id)).toEqual([
      localizedPack.pack.id,
      created.pack.id,
    ]);

    await expect(withTenantTransaction(db, { masterFn: 'M1', companyFn: 'C-MY' }, (tx) =>
      readCompanyReceiptPackWithin(
        tx,
        { masterFn: 'M1', companyFn: 'C-MY' },
        adminId,
        'company',
        created.pack.id,
      )))
      .rejects.toMatchObject({ code: 'company_receipt_pack_not_found', status: 404 });

    const replay = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptPackWithin(tx, sg, adminId, 'company', {
        packKey: 'company-receipt-pack:test-0001',
        dateFrom: '2026-08-09',
        dateTo: '2026-08-10',
        locale: 'en',
      }));
    expect(replay).toMatchObject({ replayed: true, pack: { id: created.pack.id } });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(3);
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
      readCompanyReceiptPackWithin(tx, sg, adminId, 'company', 999_999)))
      .rejects.toMatchObject({ code: 'company_receipt_pack_not_found', status: 404 });
  });

  it('preserves identity for an unsupported original through Pack PDF rendering', async () => {
    const stored = await createManagedDocument(db, sg, { userId: viewerId }, {
      documentKey: 'receipt-pack-heic-placeholder-0001',
      purpose: 'receipt',
      ownerUserId: viewerId,
      originalFileName: 'camera-capture.heic',
      mimeType: 'image/heic',
      retentionUntil: new Date('2030-01-01T00:00:00.000Z'),
      content: Uint8Array.from([0, 1, 2, 3, 4]),
    });
    await withTenantTransaction(db, sg, (tx) => tx.insert(documentScanJob).values({
      ...sg,
      versionId: stored.version.id,
      status: 'clean',
      scanner: 'company-receipt-pack-test',
      resultCode: 'clean',
      completedAt: new Date('2026-08-11T08:00:00.000Z'),
    }));
    await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(tx, sg, viewerId, {
        documentId: stored.document.id,
        documentVersionId: stored.version.id,
        transactionDate: '2026-08-11',
        merchant: 'HEIC Placeholder Merchant',
        amount: '12.0000',
        currency: 'SGD',
        category: 'Office supplies',
        businessPurpose: 'Unsupported-original identity proof',
      }));
    const created = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptPackWithin(tx, sg, adminId, 'company', {
        packKey: 'company-receipt-pack:heic-0001',
        dateFrom: '2026-08-11',
        dateTo: '2026-08-11',
        locale: 'en',
      }));

    const rendered = await withTenantTransaction(db, sg, (tx) =>
      renderCompanyReceiptPackWithin(tx, sg, adminId, 'company', created.pack.id, 'download'));
    const pdf = await PDFDocument.load(rendered.content);
    expect(pdf.getPageCount()).toBe(2);
    expect(rendered.accessPurpose).toBe('receipt_pack_original_evidence_export');
    expect(rendered.pack.rows[0]).toMatchObject({
      originalFileName: 'camera-capture.heic',
      documentSha256: stored.version.sha256,
    });
  });

  it('enforces Pack retention, legal hold, two-person purge and tombstone key reuse protection', async () => {
    const png = Uint8Array.from(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zsx8AAAAASUVORK5CYII=',
      'base64',
    ));
    const expired = new Date('2025-01-01T00:00:00.000Z');
    const now = new Date('2026-08-11T09:00:00.000Z');
    const evidence = await cleanEvidence(
      viewerId,
      'receipt_pack_governance_001',
      'governed-receipt.png',
      'image/png',
      png,
      expired,
    );
    const receipt = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(tx, sg, viewerId, {
        documentId: evidence.document.id,
        documentVersionId: evidence.version.id,
        transactionDate: '2025-01-01',
        merchant: 'Governed Merchant',
        amount: '10.0000',
        currency: 'SGD',
        category: 'Office supplies',
        businessPurpose: 'Governance test',
      }));
    const created = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptPackWithin(tx, sg, adminId, 'company', {
        packKey: 'company-receipt-pack:purge-0001',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-01',
      }, now));
    expect(created.pack).toMatchObject({
      rowCount: 1,
      retentionUntil: expired,
      legalHold: false,
      recordVersion: 1,
    });

    const held = await withTenantTransaction(db, sg, (tx) =>
      setCompanyReceiptPackLegalHoldWithin(
        tx, sg, adminId, created.pack.id, 1, true, 'Litigation review is active.',
      ));
    await expect(withTenantTransaction(db, sg, (tx) =>
      initiateCompanyReceiptPackPurgeWithin(
        tx, sg, adminId, created.pack.id, 'Retention expired.', now,
      ))).rejects.toMatchObject({ code: 'company_receipt_pack_legal_hold' });
    const released = await withTenantTransaction(db, sg, (tx) =>
      setCompanyReceiptPackLegalHoldWithin(
        tx, sg, adminId, created.pack.id, held.recordVersion, false,
        'Legal review is complete.',
      ));
    expect(released.recordVersion).toBe(3);
    const request = await withTenantTransaction(db, sg, (tx) =>
      initiateCompanyReceiptPackPurgeWithin(
        tx, sg, adminId, created.pack.id, 'Retention expired and review is complete.', now,
      ));
    await expect(withTenantTransaction(db, sg, (tx) =>
      reviewCompanyReceiptPackPurgeWithin(
        tx, sg, adminId, request.id, request.version, 'approve',
        'The initiator cannot approve the same purge.', now,
      ))).rejects.toMatchObject({ code: 'company_receipt_pack_purge_two_person_required' });
    const approved = await withTenantTransaction(db, sg, (tx) =>
      reviewCompanyReceiptPackPurgeWithin(
        tx, sg, viewerId, request.id, request.version, 'approve',
        'Finance verified retention and the legal-hold state.', now,
      ));
    const purged = await executeCompanyReceiptPackPurge(
      db, sg, adminId, created.pack.id, request.id, approved.version, now,
    );
    expect(purged.request).toMatchObject({
      status: 'executed',
      initiatedByUserId: adminId,
      reviewedByUserId: viewerId,
      executedByUserId: adminId,
    });
    expect(purged.tombstone).toMatchObject({
      originalPackId: created.pack.id,
      sourceSha256: created.pack.sourceSha256,
      rowCount: 1,
      documentCount: 1,
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
    expect(await db.select().from(companyReceiptPackTombstone)).toHaveLength(1);
    expect(await db.select().from(companyReceiptPackGovernanceEvent)).toHaveLength(4);
    expect(await db.select().from(companyReceiptPackPurgeRequest)).toEqual([
      expect.objectContaining({ status: 'executed', version: 3 }),
    ]);
    await expect(withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptPackWithin(tx, sg, adminId, 'company', {
        packKey: 'company-receipt-pack:purge-0001',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-01',
      }, now))).rejects.toMatchObject({
      code: 'company_receipt_pack_key_purged',
      status: 410,
    });
    await expect(db.delete(companyReceiptPackTombstone).where(
      eq(companyReceiptPackTombstone.id, purged.tombstone.id),
    )).rejects.toThrow();
    expect(receipt.id).toBeGreaterThan(0);
  });
});
