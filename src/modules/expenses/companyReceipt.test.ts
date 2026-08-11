import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { seedDemo } from '../../data/seed';
import {
  appUser,
  companyReceipt,
  documentScanJob,
  employee,
  expenseClaim,
  managedDocument,
} from '../../data/schema';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { freshDb } from '../../test/helpers';
import { uploadReceiptDocument } from '../documents/upload';
import { processDocumentJobBatch } from '../documents/processing';
import {
  createCompanyReceiptWithin,
  listCompanyReceiptsWithin,
  readCompanyReceiptConfirmationWithin,
  readCompanyReceiptWithin,
  updateCompanyReceiptWithin,
  voidCompanyReceiptWithin,
} from './companyReceipt';

const sg = { masterFn: 'M1', companyFn: 'C-SG' };
const my = { masterFn: 'M1', companyFn: 'C-MY' };

describe('Company Receipt aggregate', () => {
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

  async function evidence(
    actorUserId = viewerId,
    draftId = `receipt_${actorUserId}_0001`,
    clean = true,
    contentSuffix = '',
  ) {
    const uploaded = await uploadReceiptDocument(db, sg, { userId: actorUserId }, {
      clientDraftId: draftId,
      fileName: 'company-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
        ...new TextEncoder().encode(contentSuffix),
      ]),
    });
    if (clean) {
      await withTenantTransaction(db, sg, (tx) => tx.update(documentScanJob).set({
        status: 'clean',
        scanner: 'company-receipt-test',
        resultCode: 'clean',
        completedAt: new Date('2026-08-11T08:00:00.000Z'),
      }).where(and(
        eq(documentScanJob.masterFn, sg.masterFn),
        eq(documentScanJob.companyFn, sg.companyFn),
        eq(documentScanJob.versionId, uploaded.version.id),
      )));
    }
    return uploaded;
  }

  function input(documentId: number, documentVersionId: number) {
    return {
      documentId,
      documentVersionId,
      transactionDate: '2026-08-10',
      merchant: '  Northwind   Supplies  ',
      receiptNumber: 'INV-2026-0042',
      amount: '123.4500',
      currency: 'sgd',
      category: 'Office supplies',
      businessPurpose: 'Printer consumables for the finance team',
      notes: 'Original retained electronically.',
    };
  }

  it('persists confirmed metadata without Employee, Claim, reimbursement, GL or tax records', async () => {
    await db.update(employee).set({ userId: null }).where(eq(employee.userId, viewerId));
    const beforeClaims = await db.select({ id: expenseClaim.id }).from(expenseClaim);
    const uploaded = await evidence();

    const created = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(
        tx,
        sg,
        viewerId,
        input(uploaded.document.id, uploaded.version.id),
      ));
    expect(created).toMatchObject({
      documentId: uploaded.document.id,
      documentVersionId: uploaded.version.id,
      documentSha256: uploaded.version.sha256,
      uploaderUserId: viewerId,
      merchant: 'Northwind Supplies',
      amount: '123.4500',
      currency: 'SGD',
      status: 'ready',
      version: 1,
    });
    expect(await db.select({ id: expenseClaim.id }).from(expenseClaim)).toHaveLength(beforeClaims.length);

    const listed = await withTenantTransaction(db, sg, (tx) =>
      listCompanyReceiptsWithin(tx, sg, viewerId));
    expect(listed).toEqual([created]);
    expect(await withTenantTransaction(db, sg, (tx) =>
      listCompanyReceiptsWithin(tx, sg, adminId, { visibility: 'company' })))
      .toEqual([created]);
    expect(await withTenantTransaction(db, sg, (tx) =>
      readCompanyReceiptWithin(tx, sg, viewerId, created.id))).toEqual(created);
    expect(await withTenantTransaction(db, sg, (tx) =>
      readCompanyReceiptWithin(tx, sg, adminId, created.id, 'company'))).toEqual(created);

    const missingDateEvidence = await evidence(viewerId, 'receipt_missing_date_0001', true, 'missing-date');
    const missingDate = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(tx, sg, viewerId, {
        ...input(missingDateEvidence.document.id, missingDateEvidence.version.id),
        transactionDate: undefined,
        merchant: 'Missing Date Café',
        category: 'Meals',
      }));
    expect(await withTenantTransaction(db, sg, (tx) =>
      listCompanyReceiptsWithin(tx, sg, viewerId, { search: 'office supplies' })))
      .toEqual([created]);
    expect(await withTenantTransaction(db, sg, (tx) =>
      listCompanyReceiptsWithin(tx, sg, viewerId, {
        dateFrom: '2026-08-10', dateTo: '2026-08-10',
      }))).toEqual([created]);
    expect(await withTenantTransaction(db, sg, (tx) =>
      listCompanyReceiptsWithin(tx, sg, viewerId, { search: 'missing date' })))
      .toEqual([missingDate]);

    const changed = await withTenantTransaction(db, sg, (tx) =>
      updateCompanyReceiptWithin(tx, sg, viewerId, created.id, 1, {
        merchant: 'Northwind Supplies Pte Ltd',
        notes: '',
      }));
    expect(changed.after).toMatchObject({
      merchant: 'Northwind Supplies Pte Ltd',
      notes: null,
      version: 2,
      documentId: uploaded.document.id,
      documentVersionId: uploaded.version.id,
    });

    await expect(withTenantTransaction(db, sg, (tx) =>
      updateCompanyReceiptWithin(tx, sg, viewerId, created.id, 1, {
        merchant: 'Stale edit',
      }))).rejects.toMatchObject({ code: 'company_receipt_version_conflict', status: 409 });

    const voided = await withTenantTransaction(db, sg, (tx) =>
      voidCompanyReceiptWithin(
        tx,
        sg,
        viewerId,
        created.id,
        2,
        'Duplicate business record',
        new Date('2026-08-11T09:00:00.000Z'),
      ));
    expect(voided.after).toMatchObject({
      status: 'voided',
      version: 3,
      voidReason: 'Duplicate business record',
      voidedByUserId: viewerId,
    });
    const [document] = await db.select().from(managedDocument)
      .where(eq(managedDocument.id, uploaded.document.id));
    expect(document.recordStatus).toBe('draft');
  });

  it('fails closed for quarantined, duplicate, other-user and cross-tenant evidence', async () => {
    const quarantined = await evidence(viewerId, 'receipt_viewer_quarantined', false);
    await expect(withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(
        tx,
        sg,
        viewerId,
        input(quarantined.document.id, quarantined.version.id),
      ))).rejects.toMatchObject({
      code: 'company_receipt_evidence_quarantined',
      status: 409,
    });

    const uploaded = await evidence(viewerId, 'receipt_viewer_clean');
    const created = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(
        tx,
        sg,
        viewerId,
        input(uploaded.document.id, uploaded.version.id),
      ));
    await expect(withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(
        tx,
        sg,
        viewerId,
        input(uploaded.document.id, uploaded.version.id),
      ))).rejects.toMatchObject({
      code: 'company_receipt_exact_duplicate',
      status: 409,
    });
    await expect(withTenantTransaction(db, sg, (tx) =>
      readCompanyReceiptWithin(tx, sg, adminId, created.id)))
      .rejects.toMatchObject({ code: 'company_receipt_not_found', status: 404 });
    await expect(withTenantTransaction(db, my, (tx) =>
      readCompanyReceiptWithin(tx, my, viewerId, created.id)))
      .rejects.toMatchObject({ code: 'company_receipt_not_found', status: 404 });
    await expect(withTenantTransaction(db, my, (tx) =>
      createCompanyReceiptWithin(
        tx,
        my,
        viewerId,
        input(uploaded.document.id, uploaded.version.id),
      ))).rejects.toMatchObject({
      code: 'company_receipt_evidence_not_found',
      status: 404,
    });
    expect(await db.select().from(companyReceipt)).toHaveLength(1);
  });

  it('keeps OCR provenance immutable, permits manual fallback and blocks exact-hash duplicates', async () => {
    const first = await evidence(viewerId, 'receipt_confirmation_first', false);
    const processed = await processDocumentJobBatch(db, {
      scanner: { scan: async () => ({ status: 'clean' as const, scanner: 'clamav-test' }) },
      localOcr: {
        extract: async () => ({
          rawText: 'Northwind Supplies\n2026-08-10\nSGD 123.45',
          model: 'receipt-confirmation-test',
          safetyClear: true,
          fields: [
            { fieldKey: 'merchant_name', value: 'Northwind Supplies', sourceRef: 'page:1:block:1', confidence: 0.995 },
            { fieldKey: 'transaction_date', value: '2026-08-10', sourceRef: 'page:1:block:2', confidence: 0.995 },
            { fieldKey: 'currency', value: 'SGD', sourceRef: 'page:1:block:3', confidence: 0.995 },
            { fieldKey: 'total_amount', value: '123.45', sourceRef: 'page:1:block:4', confidence: 0.995 },
          ],
        }),
      },
      workerId: 'company-receipt-confirmation-worker',
    });
    expect(processed).toMatchObject({ clean: 1, extracted: 1, failed: 0 });

    const confirmation = await withTenantTransaction(db, sg, (tx) =>
      readCompanyReceiptConfirmationWithin(tx, sg, viewerId, first.version.id));
    expect(confirmation).toMatchObject({
      evidence: { scanStatus: 'clean', current: true },
      extraction: { status: 'succeeded', inboxStatus: 'ready' },
      suggestedMetadata: {
        merchant: 'Northwind Supplies',
        transactionDate: '2026-08-10',
        currency: 'SGD',
        amount: '123.45',
      },
      manualConfirmationAllowed: true,
      provenanceImmutable: true,
    });
    expect(confirmation.extraction.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fieldKey: 'merchant_name',
        sourceRef: 'page:1:block:1',
        model: 'receipt-confirmation-test',
        confidence: '0.9950',
      }),
    ]));

    const confirmed = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(tx, sg, viewerId, input(first.document.id, first.version.id)));
    expect(confirmed.evidenceSha256).toBe(first.version.sha256);
    const alreadyConfirmed = await withTenantTransaction(db, sg, (tx) =>
      readCompanyReceiptConfirmationWithin(tx, sg, viewerId, first.version.id));
    expect(alreadyConfirmed.manualConfirmationAllowed).toBe(false);
    expect(alreadyConfirmed.warnings).toContain('already_confirmed');

    const duplicate = await evidence(viewerId, 'receipt_confirmation_duplicate', true);
    const duplicateContext = await withTenantTransaction(db, sg, (tx) =>
      readCompanyReceiptConfirmationWithin(tx, sg, viewerId, duplicate.version.id));
    expect(duplicateContext).toMatchObject({
      existingReceipt: { id: confirmed.id },
      manualConfirmationAllowed: false,
    });
    expect(duplicateContext.warnings).toContain('exact_duplicate_confirmed');
    await expect(withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(
        tx,
        sg,
        viewerId,
        input(duplicate.document.id, duplicate.version.id),
      ))).rejects.toMatchObject({ code: 'company_receipt_exact_duplicate', status: 409 });

    const differentBytes = await uploadReceiptDocument(db, sg, { userId: viewerId }, {
      clientDraftId: 'receipt_confirmation_manual_fallback',
      fileName: 'manual-fallback.jpg',
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x47,
      ]),
    });
    await processDocumentJobBatch(db, {
      scanner: { scan: async () => ({ status: 'clean' as const, scanner: 'clamav-test' }) },
      localOcr: { extract: async () => { throw new Error('OCR unavailable'); } },
      workerId: 'company-receipt-fallback-worker',
    });
    await processDocumentJobBatch(db, {
      scanner: { scan: async () => ({ status: 'clean' as const, scanner: 'clamav-test' }) },
      localOcr: { extract: async () => { throw new Error('OCR unavailable'); } },
      workerId: 'company-receipt-fallback-worker-retry',
    });
    const fallback = await withTenantTransaction(db, sg, (tx) =>
      readCompanyReceiptConfirmationWithin(tx, sg, viewerId, differentBytes.version.id));
    expect(fallback).toMatchObject({
      evidence: { scanStatus: 'clean' },
      extraction: { status: 'unavailable', candidates: [] },
      suggestedMetadata: {
        merchant: null,
        transactionDate: null,
        currency: null,
        amount: null,
      },
      manualConfirmationAllowed: true,
    });
    expect(fallback.warnings).toContain('ocr_unavailable');
  });
});
