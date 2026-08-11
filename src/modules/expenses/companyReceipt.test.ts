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
import {
  createCompanyReceiptWithin,
  listCompanyReceiptsWithin,
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
  ) {
    const uploaded = await uploadReceiptDocument(db, sg, { userId: actorUserId }, {
      clientDraftId: draftId,
      fileName: 'company-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
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
      readCompanyReceiptWithin(tx, sg, viewerId, created.id))).toEqual(created);

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
      code: 'company_receipt_evidence_conflict',
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
});
