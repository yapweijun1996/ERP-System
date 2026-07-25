import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  appUser,
  documentBlob,
  documentCorrection,
  documentGovernanceEvent,
  documentPurgeRequest,
  documentTombstone,
  documentVersion,
  managedDocument,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { uploadReceiptDocument } from './upload';
import {
  deleteUnsubmittedDocument,
  executeDocumentPurge,
  initiateDocumentPurgeWithin,
  reviewDocumentPurgeWithin,
  setDocumentLegalHoldWithin,
  setDocumentPaperCustodyWithin,
  transitionDocumentRecordWithin,
  voidDocumentRecordWithin,
} from './governance';
import {
  appendManagedDocumentVersion,
  createManagedDocument,
} from './storage';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);
const changedJpeg = Uint8Array.from([...jpeg, 0x01]);

async function setup() {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  return { db, admin, viewer };
}

describe('document void, retention and purge governance', () => {
  it('directly deletes only an unsubmitted actor-owned draft', async () => {
    const { db, viewer } = await setup();
    const draft = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'governance_delete_001',
      fileName: 'draft.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
    });
    await expect(deleteUnsubmittedDocument(
      db, scope, { userId: viewer.userId }, draft.document.id,
    )).resolves.toEqual({ id: draft.document.id, deleted: true });
    expect(await db.select().from(managedDocument)).toHaveLength(0);
    expect(await db.select().from(documentVersion)).toHaveLength(0);
    expect(await db.select().from(documentBlob)).toHaveLength(0);

    const submitted = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'governance_delete_002',
      fileName: 'submitted.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
    });
    await withTenantTransaction(db, scope, (tx) => transitionDocumentRecordWithin(
      tx,
      scope,
      { userId: viewer.userId },
      submitted.document.id,
      1,
      'submitted',
      'Employee submitted this receipt.',
    ));
    await expect(deleteUnsubmittedDocument(
      db, scope, { userId: viewer.userId }, submitted.document.id,
    )).rejects.toMatchObject({ code: 'document_direct_delete_forbidden' });
    const voided = await withTenantTransaction(db, scope, (tx) =>
      voidDocumentRecordWithin(
        tx,
        scope,
        { userId: viewer.userId },
        submitted.document.id,
        2,
        'Uploaded the wrong receipt.',
      ));
    expect(voided).toMatchObject({
      recordStatus: 'voided',
      recordVersion: 3,
      voidReason: 'Uploaded the wrong receipt.',
      voidedByUserId: viewer.userId,
    });
    expect(await db.select().from(documentGovernanceEvent)).toEqual([
      expect.objectContaining({ eventType: 'submitted', recordVersion: 2 }),
      expect.objectContaining({ eventType: 'voided', recordVersion: 3 }),
    ]);
  });

  it('requires a linked reversal or correction version after posting or sealing', async () => {
    const { db, admin, viewer } = await setup();
    const stored = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'governance_correction_001',
      fileName: 'posted.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
    });
    let version = 1;
    for (const [status, reason] of [
      ['submitted', 'Employee submitted the receipt.'],
      ['approved', 'Manager approved the receipt.'],
      ['posted', 'Finance posted the receipt.'],
    ] as const) {
      const updated = await withTenantTransaction(db, scope, (tx) =>
        transitionDocumentRecordWithin(
          tx,
          scope,
          { userId: admin.userId, canManage: true },
          stored.document.id,
          version,
          status,
          reason,
        ));
      version = updated.recordVersion;
    }
    await expect(withTenantTransaction(db, scope, (tx) =>
      voidDocumentRecordWithin(
        tx,
        scope,
        { userId: admin.userId, canManage: true },
        stored.document.id,
        version,
        'Cannot directly void a posted record.',
      ))).rejects.toMatchObject({ code: 'document_correction_required' });
    await expect(appendManagedDocumentVersion(
      db,
      scope,
      { userId: admin.userId, canManage: true },
      stored.document.id,
      {
        expectedVersionNo: 1,
        mimeType: 'image/jpeg',
        content: changedJpeg,
      },
    )).rejects.toMatchObject({ code: 'document_correction_required' });

    const reversed = await appendManagedDocumentVersion(
      db,
      scope,
      { userId: admin.userId, canManage: true },
      stored.document.id,
      {
        expectedVersionNo: 1,
        mimeType: 'image/jpeg',
        content: changedJpeg,
        governance: {
          kind: 'reversal',
          reason: 'Reverse the posted receipt with an immutable new version.',
        },
      },
    );
    expect(reversed).toMatchObject({
      replayed: false,
      document: { recordStatus: 'corrected', recordVersion: 5 },
      version: { versionNo: 2 },
    });
    expect(await db.select().from(documentCorrection)).toEqual([
      expect.objectContaining({
        sourceVersionId: stored.version.id,
        correctionVersionId: reversed.version.id,
        kind: 'reversal',
      }),
    ]);
    expect((await db.select().from(documentGovernanceEvent)).at(-1)).toMatchObject({
      eventType: 'reversal_created',
      fromStatus: 'posted',
      toStatus: 'corrected',
    });
  });

  it('enforces retention, legal hold, paper custody and distinct Finance review before purge', async () => {
    const { db, admin, viewer } = await setup();
    const expired = new Date('2025-01-01T00:00:00.000Z');
    const now = new Date('2026-07-26T00:00:00.000Z');
    const stored = await createManagedDocument(
      db,
      scope,
      { userId: viewer.userId },
      {
        documentKey: 'purge-proof-001',
        purpose: 'receipt',
        ownerUserId: viewer.userId,
        originalFileName: 'purge.jpg',
        mimeType: 'image/jpeg',
        retentionUntil: expired,
        content: jpeg,
      },
    );
    const submitted = await withTenantTransaction(db, scope, (tx) =>
      transitionDocumentRecordWithin(
        tx,
        scope,
        { userId: viewer.userId },
        stored.document.id,
        1,
        'submitted',
        'Employee submitted this retained record.',
      ));
    const voided = await withTenantTransaction(db, scope, (tx) =>
      voidDocumentRecordWithin(
        tx,
        scope,
        { userId: viewer.userId },
        stored.document.id,
        submitted.recordVersion,
        'Receipt is no longer required operationally.',
        now,
      ));
    const held = await withTenantTransaction(db, scope, (tx) =>
      setDocumentLegalHoldWithin(
        tx,
        scope,
        { userId: admin.userId, canManage: true },
        stored.document.id,
        voided.recordVersion,
        true,
        'Litigation hold applies.',
      ));
    await expect(withTenantTransaction(db, scope, (tx) =>
      initiateDocumentPurgeWithin(
        tx, scope, admin.userId, stored.document.id, 'Retention expired.', now,
      ))).rejects.toMatchObject({ code: 'document_legal_hold' });
    const released = await withTenantTransaction(db, scope, (tx) =>
      setDocumentLegalHoldWithin(
        tx,
        scope,
        { userId: admin.userId, canManage: true },
        stored.document.id,
        held.recordVersion,
        false,
        'Legal team released the hold.',
      ));
    const archived = await withTenantTransaction(db, scope, (tx) =>
      setDocumentPaperCustodyWithin(
        tx,
        scope,
        { userId: admin.userId, canManage: true },
        stored.document.id,
        released.recordVersion,
        {
          status: 'finance_archive',
          reference: 'BOX-SG-001',
          reason: 'Finance received the paper original.',
        },
      ));
    await expect(withTenantTransaction(db, scope, (tx) =>
      initiateDocumentPurgeWithin(
        tx, scope, admin.userId, stored.document.id, 'Retention expired.', now,
      ))).rejects.toMatchObject({ code: 'document_paper_original_held' });
    await withTenantTransaction(db, scope, (tx) => setDocumentPaperCustodyWithin(
      tx,
      scope,
      { userId: admin.userId, canManage: true },
      stored.document.id,
      archived.recordVersion,
      {
        status: 'destroyed',
        reference: 'DESTRUCTION-CERT-001',
        reason: 'Certified paper destruction completed.',
      },
    ));
    const request = await withTenantTransaction(db, scope, (tx) =>
      initiateDocumentPurgeWithin(
        tx,
        scope,
        admin.userId,
        stored.document.id,
        'Retention expired and paper custody is resolved.',
        now,
      ));
    await expect(withTenantTransaction(db, scope, (tx) =>
      reviewDocumentPurgeWithin(
        tx,
        scope,
        admin.userId,
        request.id,
        request.version,
        'approve',
        'Self review must fail.',
        now,
      ))).rejects.toMatchObject({ code: 'document_purge_two_person_required' });
    const approved = await withTenantTransaction(db, scope, (tx) =>
      reviewDocumentPurgeWithin(
        tx,
        scope,
        viewer.userId,
        request.id,
        request.version,
        'approve',
        'Finance verified retention, hold and custody evidence.',
        now,
      ));
    const purged = await executeDocumentPurge(
      db,
      scope,
      admin.userId,
      stored.document.id,
      request.id,
      approved.version,
      undefined,
      now,
    );
    expect(purged.request).toMatchObject({
      status: 'executed',
      initiatedByUserId: admin.userId,
      reviewedByUserId: viewer.userId,
      executedByUserId: admin.userId,
    });
    expect(purged.tombstone).toMatchObject({
      originalDocumentId: stored.document.id,
      finalSha256: stored.version.sha256,
      finalPaperCustodyStatus: 'destroyed',
    });
    expect(purged.tombstone.versionManifest).toEqual([
      expect.objectContaining({ versionNo: 1, sha256: stored.version.sha256 }),
    ]);
    expect(await db.select().from(managedDocument)).toHaveLength(0);
    expect(await db.select().from(documentVersion)).toHaveLength(0);
    expect(await db.select().from(documentBlob)).toHaveLength(0);
    expect(await db.select().from(documentPurgeRequest)).toEqual([
      expect.objectContaining({ status: 'executed' }),
    ]);
    expect(await db.select().from(documentTombstone)).toHaveLength(1);
    await expect(createManagedDocument(
      db,
      scope,
      { userId: viewer.userId },
      {
        documentKey: 'purge-proof-001',
        purpose: 'receipt',
        ownerUserId: viewer.userId,
        originalFileName: 'reuse.jpg',
        mimeType: 'image/jpeg',
        retentionUntil: expired,
        content: jpeg,
      },
    )).rejects.toMatchObject({ code: 'document_key_purged', status: 410 });
  });
});
