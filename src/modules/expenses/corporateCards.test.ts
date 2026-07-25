import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  appUser,
  corporateCardEvent,
  corporateCardFollowUp,
  corporateCardImport,
  corporateCardMatchCandidate,
  corporateCardTransaction,
  documentProcessingPolicy,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { processDocumentJobBatch } from '../documents/processing';
import { uploadReceiptDocument } from '../documents/upload';
import {
  acceptCorporateCardMatchWithin,
  importCorporateCardStatement,
  rejectCorporateCardMatchWithin,
  resolveCorporateCardFollowUpWithin,
} from './corporateCards';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);
const headers = [
  'external_transaction_id',
  'holder_employee_no',
  'card_last4',
  'transaction_date',
  'posted_date',
  'merchant',
  'currency',
  'amount',
];

function csv(rows: string[][]): Uint8Array {
  return new TextEncoder().encode([
    headers.join(','),
    ...rows.map((row) => row.map((value) =>
      value.includes(',') ? `"${value.replaceAll('"', '""')}"` : value).join(',')),
  ].join('\n'));
}

async function xlsx(rows: Array<Array<string | number | Date>>): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Statement');
  worksheet.addRow(headers);
  for (const row of rows) worksheet.addRow(row);
  const result = await workbook.xlsx.writeBuffer();
  return new Uint8Array(result);
}

async function setupReceipt() {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  await db.insert(documentProcessingPolicy).values({
    ...scope,
    extractionProvider: 'local_ocr',
    autoSubmitEnabled: false,
    autoSubmitMinConfidence: '0.9800',
    updatedByUserId: admin.userId,
  });
  await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
    clientDraftId: 'card_receipt_0001',
    fileName: 'card-receipt.jpg',
    declaredMimeType: 'image/jpeg',
    content: jpeg,
    autoSubmitAuthorized: false,
  });
  await processDocumentJobBatch(db, {
    scanner: {
      scan: async () => ({ status: 'clean' as const, scanner: 'card-test' }),
    },
    localOcr: {
      extract: async () => ({
        rawText: 'Card Taxi\n2026-07-20\nSGD 50.00',
        model: 'card-test',
        safetyClear: true,
        fields: [
          {
            fieldKey: 'merchant_name',
            value: 'Card Taxi',
            sourceRef: 'page:1:block:1',
            confidence: 0.999,
          },
          {
            fieldKey: 'transaction_date',
            value: '2026-07-20',
            sourceRef: 'page:1:block:2',
            confidence: 0.999,
          },
          {
            fieldKey: 'currency',
            value: 'SGD',
            sourceRef: 'page:1:block:3',
            confidence: 0.999,
          },
          {
            fieldKey: 'total_amount',
            value: '50.00',
            sourceRef: 'page:1:block:4',
            confidence: 0.999,
          },
        ],
      }),
    },
  });
  return { db, admin, viewer };
}

describe('corporate-card statement reconciliation', () => {
  it('imports CSV, exposes an exact explainable suggestion and requires review', async () => {
    const { db, admin } = await setupReceipt();
    const content = csv([[
      'CARD-TXN-0001',
      'EMP-1042',
      '4242',
      '2026-07-20',
      '2026-07-21',
      'Card Taxi',
      'SGD',
      '50.00',
    ]]);
    const imported = await importCorporateCardStatement(
      db,
      scope,
      admin.userId,
      {
        importKey: 'card-import-csv-0001',
        issuer: 'Example Bank',
        statementRef: 'JUL-2026-4242',
        fileName: 'july-card.csv',
        fileFormat: 'csv',
        content,
      },
      new Date('2026-07-26T00:00:00.000Z'),
    );
    expect(imported).toMatchObject({
      replayed: false,
      matching: { suggestions: 1, followUps: 0 },
      transactions: [{
        holderEmployeeNo: 'EMP-1042',
        status: 'suggested',
        amount: '50.0000',
      }],
    });
    const [candidate] = await db.select().from(corporateCardMatchCandidate);
    expect(candidate).toMatchObject({
      confidence: '1.0000',
      status: 'suggested',
      reasons: [
        'holder_exact',
        'transaction_date_exact',
        'currency_exact',
        'amount_exact',
      ],
    });
    const replay = await importCorporateCardStatement(db, scope, admin.userId, {
      importKey: 'card-import-csv-0001',
      issuer: 'Example Bank',
      statementRef: 'JUL-2026-4242',
      fileName: 'july-card.csv',
      fileFormat: 'csv',
      content,
    });
    expect(replay.replayed).toBe(true);

    const matched = await db.transaction((tx) => acceptCorporateCardMatchWithin(
      tx,
      scope,
      admin.userId,
      candidate.id,
      'Finance verified the exact holder, date, currency and amount.',
    ));
    expect(matched).toMatchObject({
      status: 'matched',
      matchConfidence: '1.0000',
      matchMethod: 'automatic_review',
      matchedByUserId: admin.userId,
    });
    expect((await db.select().from(corporateCardMatchCandidate))[0].status)
      .toBe('accepted');
    await expect(db.update(corporateCardTransaction).set({
      merchant: 'Silently rewritten merchant',
    })).rejects.toThrow();
    await expect(db.delete(corporateCardEvent)).rejects.toThrow();
  });

  it('imports XLSX and persists unresolved-holder and missing-receipt follow-up', async () => {
    const { db, admin } = await setupReceipt();
    const content = await xlsx([
      [
        'CARD-TXN-0002',
        'EMP-1042',
        '4242',
        new Date('2026-07-22T00:00:00.000Z'),
        new Date('2026-07-23T00:00:00.000Z'),
        'Hotel Example',
        'SGD',
        200,
      ],
      [
        'CARD-TXN-0003',
        'EMP-UNKNOWN',
        '4242',
        '2026-07-24',
        '2026-07-25',
        'Unknown Holder Merchant',
        'SGD',
        15,
      ],
    ]);
    const imported = await importCorporateCardStatement(db, scope, admin.userId, {
      importKey: 'card-import-xlsx-0001',
      issuer: 'Example Bank',
      statementRef: 'JUL-2026-SECOND',
      fileName: 'july-card.xlsx',
      fileFormat: 'xlsx',
      content,
    });
    expect(imported.matching).toEqual({ suggestions: 0, followUps: 2 });
    expect(imported.transactions.map((row) => row.status)).toEqual([
      'missing_receipt',
      'unmatched',
    ]);
    const followUps = await db.select().from(corporateCardFollowUp)
      .orderBy(corporateCardFollowUp.id);
    expect(followUps.map((row) => row.followUpType)).toEqual([
      'missing_receipt',
      'holder_unresolved',
    ]);
    const resolved = await db.transaction((tx) => resolveCorporateCardFollowUpWithin(
      tx,
      scope,
      admin.userId,
      followUps[0].id,
      'waived',
      'Finance approved the documented lost-receipt exception.',
    ));
    expect(resolved.status).toBe('waived');
    expect((await db.select().from(corporateCardTransaction)
      .where(eq(corporateCardTransaction.id, followUps[0].transactionId)))[0].status)
      .toBe('waived');
    expect((await db.select().from(corporateCardEvent)).map((row) => row.eventType))
      .toContain('follow_up_waived');
  });

  it('rejects a suggestion into follow-up and rejects invalid or duplicate files atomically', async () => {
    const { db, admin } = await setupReceipt();
    const content = csv([[
      'CARD-TXN-0004',
      'EMP-1042',
      '4242',
      '2026-07-20',
      '2026-07-21',
      'Card Taxi',
      'SGD',
      '50.00',
    ]]);
    await importCorporateCardStatement(db, scope, admin.userId, {
      importKey: 'card-import-reject-0001',
      issuer: 'Example Bank',
      statementRef: 'JUL-2026-REJECT',
      fileName: 'reject.csv',
      fileFormat: 'csv',
      content,
    });
    const [candidate] = await db.select().from(corporateCardMatchCandidate);
    const rejected = await db.transaction((tx) => rejectCorporateCardMatchWithin(
      tx,
      scope,
      admin.userId,
      candidate.id,
      'Receipt belongs to a personally paid transaction.',
    ));
    expect(rejected.followUpId).not.toBeNull();
    expect((await db.select().from(corporateCardTransaction))[0].status)
      .toBe('missing_receipt');

    const badSchema = new TextEncoder().encode('wrong,columns\n1,2');
    await expect(importCorporateCardStatement(db, scope, admin.userId, {
      importKey: 'card-import-invalid-0001',
      issuer: 'Example Bank',
      statementRef: 'INVALID',
      fileName: 'invalid.csv',
      fileFormat: 'csv',
      content: badSchema,
    })).rejects.toMatchObject({ code: 'corporate_card_schema_invalid' });
    expect(await db.select().from(corporateCardImport)).toHaveLength(1);

    await expect(importCorporateCardStatement(db, scope, admin.userId, {
      importKey: 'card-import-duplicate-0001',
      issuer: 'Example Bank',
      statementRef: 'JUL-2026-DUPLICATE',
      fileName: 'duplicate.csv',
      fileFormat: 'csv',
      content,
    })).rejects.toMatchObject({ code: 'corporate_card_duplicate_line' });
    expect(await db.select().from(corporateCardImport)).toHaveLength(1);
  });
});
