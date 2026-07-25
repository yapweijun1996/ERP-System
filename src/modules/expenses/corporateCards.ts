import { createHash } from 'node:crypto';
import Decimal from 'decimal.js';
import ExcelJS from 'exceljs';
import {
  and,
  asc,
  eq,
  inArray,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  corporateCardEvent,
  corporateCardFollowUp,
  corporateCardImport,
  corporateCardMatchCandidate,
  corporateCardTransaction,
  documentExtractionField,
  employee,
  receiptInboxItem,
} from '../../data/schema';

export const CORPORATE_CARD_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const CORPORATE_CARD_IMPORT_MAX_ROWS = 1000;
const EXPECTED_HEADERS = [
  'external_transaction_id',
  'holder_employee_no',
  'card_last4',
  'transaction_date',
  'posted_date',
  'merchant',
  'currency',
  'amount',
] as const;

export class CorporateCardError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = 'CorporateCardError';
  }
}

export interface CorporateCardImportInput {
  importKey: string;
  issuer: string;
  statementRef: string;
  fileName: string;
  fileFormat: 'csv' | 'xlsx';
  content: Uint8Array;
}

interface ParsedRow {
  externalTransactionId: string;
  holderEmployeeNo: string;
  cardLast4: string;
  transactionDate: string;
  postedDate: string;
  merchant: string;
  currency: string;
  amount: string;
}

function text(value: unknown, label: string, min: number, max: number): string {
  const result = String(value ?? '').trim();
  if (result.length < min || result.length > max) {
    throw new CorporateCardError(
      'corporate_card_import_invalid',
      `${label} must contain ${min}–${max} characters.`,
    );
  }
  return result;
}

function reason(value: unknown): string {
  return text(value, 'Reason', 3, 1000);
}

function dateText(value: unknown, label: string): string {
  const raw = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)
    || new Date(`${raw}T00:00:00.000Z`).toISOString().slice(0, 10) !== raw) {
    throw new CorporateCardError(
      'corporate_card_import_invalid',
      `${label} must be a valid ISO date.`,
    );
  }
  return raw;
}

function amountText(value: unknown, label: string): string {
  try {
    const amount = new Decimal(String(value ?? '').trim().replace(/,/g, ''));
    if (amount.isFinite() && amount.gt(0) && amount.lte('99999999999999.9999')) {
      return amount.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
    }
  } catch {
    // Converted to a governed validation error below.
  }
  throw new CorporateCardError(
    'corporate_card_import_invalid',
    `${label} must be a positive decimal amount.`,
  );
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function csvRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      if (field.length) {
        throw new CorporateCardError(
          'corporate_card_csv_invalid',
          'CSV quotes must begin at the start of a field.',
      );
      }
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) {
    throw new CorporateCardError('corporate_card_csv_invalid', 'CSV contains an unterminated quote.');
  }
  row.push(field.replace(/\r$/, ''));
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function cellValue(value: ExcelJS.CellValue): string | Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    if ('result' in value) return String(value.result ?? '');
    if ('text' in value) return String(value.text ?? '');
    if ('richText' in value) {
      return value.richText.map((part) => part.text).join('');
    }
  }
  return String(value ?? '');
}

async function fileRows(
  content: Uint8Array,
  format: 'csv' | 'xlsx',
): Promise<Array<Array<string | Date>>> {
  if (!content.byteLength || content.byteLength > CORPORATE_CARD_IMPORT_MAX_BYTES) {
    throw new CorporateCardError(
      'corporate_card_file_size_invalid',
      'Card statement files must contain 1 byte to 5 MB.',
      content.byteLength ? 413 : 422,
    );
  }
  if (format === 'csv') {
    let source = new TextDecoder('utf-8', { fatal: true }).decode(content);
    if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
    return csvRows(source);
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(new Uint8Array(content).buffer as ArrayBuffer);
  } catch {
    throw new CorporateCardError(
      'corporate_card_xlsx_invalid',
      'The Excel statement is corrupt or unsupported.',
    );
  }
  if (workbook.worksheets.length !== 1) {
    throw new CorporateCardError(
      'corporate_card_xlsx_invalid',
      'The Excel statement must contain exactly one worksheet.',
    );
  }
  const worksheet = workbook.worksheets[0];
  if (worksheet.actualRowCount > CORPORATE_CARD_IMPORT_MAX_ROWS + 1
    || worksheet.actualColumnCount > EXPECTED_HEADERS.length) {
    throw new CorporateCardError(
      'corporate_card_file_bounds_exceeded',
      'The statement exceeds 1,000 data rows or 8 columns.',
      413,
    );
  }
  const rows: Array<Array<string | Date>> = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push(Array.from(
      { length: EXPECTED_HEADERS.length },
      (_, index) => cellValue(row.getCell(index + 1).value),
    ));
  });
  return rows;
}

async function parseRows(
  content: Uint8Array,
  format: 'csv' | 'xlsx',
): Promise<ParsedRow[]> {
  const rows = await fileRows(content, format);
  if (rows.length < 2 || rows.length > CORPORATE_CARD_IMPORT_MAX_ROWS + 1) {
    throw new CorporateCardError(
      'corporate_card_row_count_invalid',
      'A statement requires 1–1,000 data rows.',
    );
  }
  const headers = rows[0].map((value) => String(value).trim().toLowerCase());
  if (headers.length !== EXPECTED_HEADERS.length
    || headers.some((header, index) => header !== EXPECTED_HEADERS[index])) {
    throw new CorporateCardError(
      'corporate_card_schema_invalid',
      `Statement columns must be exactly: ${EXPECTED_HEADERS.join(', ')}.`,
    );
  }
  return rows.slice(1).map((row, index) => {
    if (row.length !== EXPECTED_HEADERS.length) {
      throw new CorporateCardError(
        'corporate_card_schema_invalid',
        `Row ${index + 2} must contain exactly 8 columns.`,
      );
    }
    const transactionDate = dateText(row[3], `Row ${index + 2} transaction_date`);
    const postedDate = dateText(row[4], `Row ${index + 2} posted_date`);
    if (postedDate < transactionDate) {
      throw new CorporateCardError(
        'corporate_card_import_invalid',
        `Row ${index + 2} posted_date cannot precede transaction_date.`,
      );
    }
    const holderEmployeeNo = text(row[1], `Row ${index + 2} holder_employee_no`, 2, 64)
      .toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(holderEmployeeNo)) {
      throw new CorporateCardError(
        'corporate_card_import_invalid',
        `Row ${index + 2} holder_employee_no is invalid.`,
      );
    }
    const cardLast4 = text(row[2], `Row ${index + 2} card_last4`, 4, 4);
    if (!/^[0-9]{4}$/.test(cardLast4)) {
      throw new CorporateCardError(
        'corporate_card_import_invalid',
        `Row ${index + 2} card_last4 must contain four digits.`,
      );
    }
    const currency = text(row[6], `Row ${index + 2} currency`, 3, 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new CorporateCardError(
        'corporate_card_import_invalid',
        `Row ${index + 2} currency must be a three-letter ISO code.`,
      );
    }
    return {
      externalTransactionId: text(
        row[0],
        `Row ${index + 2} external_transaction_id`,
        1,
        120,
      ),
      holderEmployeeNo,
      cardLast4,
      transactionDate,
      postedDate,
      merchant: text(row[5], `Row ${index + 2} merchant`, 1, 240),
      currency,
      amount: amountText(row[7], `Row ${index + 2} amount`),
    };
  });
}

function lineFingerprint(issuer: string, row: ParsedRow): string {
  return sha256([
    issuer.toLowerCase(),
    row.externalTransactionId.toLowerCase(),
    row.cardLast4,
    row.transactionDate,
    row.currency,
    row.amount,
  ].join('|'));
}

function dayDistance(left: string, right: string): number {
  const leftTime = new Date(`${left}T00:00:00.000Z`).getTime();
  const rightTime = new Date(`${right}T00:00:00.000Z`).getTime();
  return Math.abs(Math.round((leftTime - rightTime) / 86_400_000));
}

async function suggestMatches(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  importRow: typeof corporateCardImport.$inferSelect,
  transactions: Array<typeof corporateCardTransaction.$inferSelect>,
  now: Date,
) {
  const receipts = await tx.select().from(receiptInboxItem).where(and(
    eq(receiptInboxItem.masterFn, scope.masterFn),
    eq(receiptInboxItem.companyFn, scope.companyFn),
  ));
  const fields = receipts.length
    ? await tx.select().from(documentExtractionField).where(and(
      eq(documentExtractionField.masterFn, scope.masterFn),
      eq(documentExtractionField.companyFn, scope.companyFn),
      inArray(
        documentExtractionField.extractionId,
        receipts.map((receipt) => receipt.extractionId),
      ),
      eq(documentExtractionField.candidateNo, 1),
      eq(documentExtractionField.reviewState, 'accepted'),
    ))
    : [];
  const employees = await tx.select().from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.isActive, true),
  ));
  const employeeByUser = new Map(
    employees.filter((row) => row.userId != null).map((row) => [row.userId!, row]),
  );
  const fieldMap = new Map<number, Map<string, string>>();
  for (const field of fields) {
    const values = fieldMap.get(field.extractionId) ?? new Map<string, string>();
    values.set(field.fieldKey, field.normalizedValue);
    fieldMap.set(field.extractionId, values);
  }
  const alreadyMatched = await tx.select({
    receiptId: corporateCardTransaction.matchedReceiptInboxItemId,
  }).from(corporateCardTransaction).where(and(
    eq(corporateCardTransaction.masterFn, scope.masterFn),
    eq(corporateCardTransaction.companyFn, scope.companyFn),
    eq(corporateCardTransaction.status, 'matched'),
  ));
  const matchedReceiptIds = new Set(
    alreadyMatched.flatMap((row) => row.receiptId == null ? [] : [row.receiptId]),
  );
  let suggestions = 0;
  let followUps = 0;
  for (const transaction of transactions) {
    if (!transaction.holderEmployeeId) {
      const [followUp] = await tx.insert(corporateCardFollowUp).values({
        ...scope,
        transactionId: transaction.id,
        followUpType: 'holder_unresolved',
        reason: `Employee ${transaction.holderEmployeeNo} is not active in this company.`,
        dueAt: new Date(now.getTime() + 7 * 86_400_000),
        createdAt: now,
        updatedAt: now,
      }).returning();
      await tx.insert(corporateCardEvent).values({
        ...scope,
        importId: importRow.id,
        transactionId: transaction.id,
        eventType: 'follow_up_opened',
        reason: 'Imported card holder could not be resolved.',
        actorUserId,
        detail: { followUpId: followUp.id, type: followUp.followUpType },
        createdAt: now,
      });
      followUps += 1;
      continue;
    }
    const ranked = receipts.flatMap((receipt) => {
      if (matchedReceiptIds.has(receipt.id)) return [];
      const owner = employeeByUser.get(receipt.ownerUserId);
      const facts = fieldMap.get(receipt.extractionId);
      if (!owner || owner.id !== transaction.holderEmployeeId || !facts) return [];
      const date = facts.get('transaction_date');
      const currency = facts.get('currency');
      const total = facts.get('total_amount');
      if (!date || currency !== transaction.currency || !total) return [];
      if (!new Decimal(total).eq(transaction.amount)) return [];
      const distance = dayDistance(date, transaction.transactionDate);
      if (distance > 2) return [];
      const confidence = distance === 0 ? new Decimal(1) : new Decimal('0.9000');
      return [{
        receipt,
        confidence,
        reasons: [
          'holder_exact',
          distance === 0 ? 'transaction_date_exact' : `transaction_date_within_${distance}_days`,
          'currency_exact',
          'amount_exact',
        ],
      }];
    }).sort((left, right) =>
      right.confidence.comparedTo(left.confidence)
      || left.receipt.id - right.receipt.id).slice(0, 3);
    if (ranked.length) {
      const candidates = await tx.insert(corporateCardMatchCandidate).values(
        ranked.map((candidate) => ({
          ...scope,
          transactionId: transaction.id,
          receiptInboxItemId: candidate.receipt.id,
          confidence: candidate.confidence.toFixed(4),
          reasons: candidate.reasons,
          createdAt: now,
          updatedAt: now,
        })),
      ).returning();
      await tx.update(corporateCardTransaction).set({
        status: 'suggested',
        version: transaction.version + 1,
        updatedAt: now,
      }).where(eq(corporateCardTransaction.id, transaction.id));
      await tx.insert(corporateCardEvent).values(candidates.map((candidate) => ({
        ...scope,
        importId: importRow.id,
        transactionId: transaction.id,
        eventType: 'match_suggested',
        reason: 'Automatic receipt match requires Finance review.',
        actorUserId,
        detail: {
          candidateId: candidate.id,
          confidence: candidate.confidence,
          reasons: candidate.reasons,
        },
        createdAt: now,
      })));
      suggestions += candidates.length;
      continue;
    }
    const [followUp] = await tx.insert(corporateCardFollowUp).values({
      ...scope,
      transactionId: transaction.id,
      followUpType: 'missing_receipt',
      assignedEmployeeId: transaction.holderEmployeeId,
      reason: 'No eligible receipt matched holder, date, currency and amount.',
      dueAt: new Date(now.getTime() + 7 * 86_400_000),
      createdAt: now,
      updatedAt: now,
    }).returning();
    await tx.update(corporateCardTransaction).set({
      status: 'missing_receipt',
      version: transaction.version + 1,
      updatedAt: now,
    }).where(eq(corporateCardTransaction.id, transaction.id));
    await tx.insert(corporateCardEvent).values({
      ...scope,
      importId: importRow.id,
      transactionId: transaction.id,
      eventType: 'follow_up_opened',
      reason: 'No eligible receipt was found during automatic matching.',
      actorUserId,
      detail: { followUpId: followUp.id, type: followUp.followUpType },
      createdAt: now,
    });
    followUps += 1;
  }
  return { suggestions, followUps };
}

export async function importCorporateCardStatementWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  metadata: Omit<CorporateCardImportInput, 'content'>,
  rows: ParsedRow[],
  sourceSha256: string,
  now = new Date(),
) {
  const importKey = text(metadata.importKey, 'Import key', 8, 128);
  const issuer = text(metadata.issuer, 'Issuer', 2, 120);
  const statementRef = text(metadata.statementRef, 'Statement reference', 2, 120);
  const fileName = text(metadata.fileName, 'File name', 1, 240);
  const [replay] = await tx.select().from(corporateCardImport).where(and(
    eq(corporateCardImport.masterFn, scope.masterFn),
    eq(corporateCardImport.companyFn, scope.companyFn),
    eq(corporateCardImport.importKey, importKey),
  )).limit(1);
  if (replay) {
    if (replay.sourceSha256 !== sourceSha256
      || replay.issuer !== issuer
      || replay.statementRef !== statementRef
      || replay.fileFormat !== metadata.fileFormat) {
      throw new CorporateCardError(
        'corporate_card_import_key_conflict',
        'This import key already identifies different statement facts.',
        409,
      );
    }
    const transactions = await tx.select().from(corporateCardTransaction).where(and(
      eq(corporateCardTransaction.masterFn, scope.masterFn),
      eq(corporateCardTransaction.companyFn, scope.companyFn),
      eq(corporateCardTransaction.importId, replay.id),
    )).orderBy(asc(corporateCardTransaction.lineNo));
    return { import: replay, transactions, replayed: true };
  }
  const externalIds = rows.map((row) => row.externalTransactionId);
  if (new Set(externalIds).size !== externalIds.length) {
    throw new CorporateCardError(
      'corporate_card_duplicate_line',
      'The statement repeats an external transaction id.',
      409,
    );
  }
  const fingerprints = rows.map((row) => lineFingerprint(issuer, row));
  if (new Set(fingerprints).size !== fingerprints.length) {
    throw new CorporateCardError(
      'corporate_card_duplicate_line',
      'The statement contains duplicate transaction facts.',
      409,
    );
  }
  const duplicates = await tx.select({ id: corporateCardTransaction.id })
    .from(corporateCardTransaction).where(and(
      eq(corporateCardTransaction.masterFn, scope.masterFn),
      eq(corporateCardTransaction.companyFn, scope.companyFn),
      inArray(corporateCardTransaction.lineFingerprint, fingerprints),
    )).limit(1);
  if (duplicates.length) {
    throw new CorporateCardError(
      'corporate_card_duplicate_line',
      'A transaction in this statement was imported previously.',
      409,
    );
  }
  const employees = await tx.select().from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.isActive, true),
  ));
  const employeeByNo = new Map(employees.map((row) => [row.employeeNo.toUpperCase(), row]));
  const [importRow] = await tx.insert(corporateCardImport).values({
    ...scope,
    importKey,
    issuer,
    statementRef,
    fileName,
    fileFormat: metadata.fileFormat,
    sourceSha256,
    rowCount: rows.length,
    importedByUserId: actorUserId,
    importedAt: now,
  }).returning();
  const transactions = await tx.insert(corporateCardTransaction).values(
    rows.map((row, index) => ({
      ...scope,
      importId: importRow.id,
      lineNo: index + 1,
      ...row,
      holderEmployeeId: employeeByNo.get(row.holderEmployeeNo)?.id ?? null,
      lineFingerprint: fingerprints[index],
      createdAt: now,
      updatedAt: now,
    })),
  ).returning();
  await tx.insert(corporateCardEvent).values({
    ...scope,
    importId: importRow.id,
    eventType: 'imported',
    reason: 'Corporate-card statement imported after complete validation.',
    actorUserId,
    detail: { rowCount: rows.length, sourceSha256, fileFormat: metadata.fileFormat },
    createdAt: now,
  });
  const matching = await suggestMatches(
    tx,
    scope,
    actorUserId,
    importRow,
    transactions,
    now,
  );
  const current = await tx.select().from(corporateCardTransaction).where(and(
    eq(corporateCardTransaction.masterFn, scope.masterFn),
    eq(corporateCardTransaction.companyFn, scope.companyFn),
    eq(corporateCardTransaction.importId, importRow.id),
  )).orderBy(asc(corporateCardTransaction.lineNo));
  return { import: importRow, transactions: current, matching, replayed: false };
}

export async function importCorporateCardStatement(
  db: DB,
  scope: Scope,
  actorUserId: number,
  input: CorporateCardImportInput,
  now = new Date(),
) {
  if (input.fileFormat !== 'csv' && input.fileFormat !== 'xlsx') {
    throw new CorporateCardError(
      'corporate_card_format_invalid',
      'Card statement format must be csv or xlsx.',
    );
  }
  const rows = await parseRows(input.content, input.fileFormat);
  const sourceSha256 = sha256(input.content);
  return withTenantTransaction(db, scope, (tx) =>
    importCorporateCardStatementWithin(
      tx,
      scope,
      actorUserId,
      {
        importKey: input.importKey,
        issuer: input.issuer,
        statementRef: input.statementRef,
        fileName: input.fileName,
        fileFormat: input.fileFormat,
      },
      rows,
      sourceSha256,
      now,
    ));
}

async function candidateFacts(
  tx: DB,
  scope: Scope,
  candidateId: number,
) {
  const [candidate] = await tx.select().from(corporateCardMatchCandidate).where(and(
    eq(corporateCardMatchCandidate.masterFn, scope.masterFn),
    eq(corporateCardMatchCandidate.companyFn, scope.companyFn),
    eq(corporateCardMatchCandidate.id, candidateId),
  )).limit(1).for('update');
  if (!candidate) {
    throw new CorporateCardError(
      'corporate_card_match_missing',
      'Card match suggestion is unavailable.',
      404,
    );
  }
  const [transaction] = await tx.select().from(corporateCardTransaction).where(and(
    eq(corporateCardTransaction.masterFn, scope.masterFn),
    eq(corporateCardTransaction.companyFn, scope.companyFn),
    eq(corporateCardTransaction.id, candidate.transactionId),
  )).limit(1).for('update');
  if (!transaction) {
    throw new CorporateCardError(
      'corporate_card_transaction_missing',
      'Card transaction is unavailable.',
      404,
    );
  }
  return { candidate, transaction };
}

export async function acceptCorporateCardMatchWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  candidateId: number,
  reasonValue: string,
  now = new Date(),
) {
  const reviewReason = reason(reasonValue);
  const { candidate, transaction } = await candidateFacts(tx, scope, candidateId);
  if (candidate.status !== 'suggested' || transaction.status !== 'suggested') {
    throw new CorporateCardError(
      'corporate_card_match_not_reviewable',
      'Only an active suggestion may be accepted.',
      409,
    );
  }
  const [used] = await tx.select({ id: corporateCardTransaction.id })
    .from(corporateCardTransaction).where(and(
      eq(corporateCardTransaction.masterFn, scope.masterFn),
      eq(corporateCardTransaction.companyFn, scope.companyFn),
      eq(
        corporateCardTransaction.matchedReceiptInboxItemId,
        candidate.receiptInboxItemId,
      ),
    )).limit(1);
  if (used) {
    throw new CorporateCardError(
      'corporate_card_receipt_already_matched',
      'This receipt is already matched to another card transaction.',
      409,
    );
  }
  await tx.update(corporateCardMatchCandidate).set({
    status: 'accepted',
    reviewedByUserId: actorUserId,
    reviewReason,
    reviewedAt: now,
    updatedAt: now,
  }).where(eq(corporateCardMatchCandidate.id, candidate.id));
  await tx.update(corporateCardMatchCandidate).set({
    status: 'rejected',
    reviewedByUserId: actorUserId,
    reviewReason: 'Superseded by the accepted receipt match.',
    reviewedAt: now,
    updatedAt: now,
  }).where(and(
    eq(corporateCardMatchCandidate.transactionId, transaction.id),
    eq(corporateCardMatchCandidate.status, 'suggested'),
  ));
  const [matched] = await tx.update(corporateCardTransaction).set({
    status: 'matched',
    matchedReceiptInboxItemId: candidate.receiptInboxItemId,
    matchConfidence: candidate.confidence,
    matchMethod: 'automatic_review',
    matchedByUserId: actorUserId,
    matchedAt: now,
    version: transaction.version + 1,
    updatedAt: now,
  }).where(and(
    eq(corporateCardTransaction.id, transaction.id),
    eq(corporateCardTransaction.version, transaction.version),
  )).returning();
  const resolved = await tx.update(corporateCardFollowUp).set({
    status: 'resolved',
    resolutionReason: 'Receipt match accepted by Finance.',
    resolvedByUserId: actorUserId,
    resolvedAt: now,
    updatedAt: now,
  }).where(and(
    eq(corporateCardFollowUp.transactionId, transaction.id),
    eq(corporateCardFollowUp.status, 'open'),
  )).returning({ id: corporateCardFollowUp.id });
  await tx.insert(corporateCardEvent).values([
    {
      ...scope,
      importId: transaction.importId,
      transactionId: transaction.id,
      eventType: 'match_accepted',
      reason: reviewReason,
      actorUserId,
      detail: {
        candidateId: candidate.id,
        receiptInboxItemId: candidate.receiptInboxItemId,
        confidence: candidate.confidence,
      },
      createdAt: now,
    },
    ...resolved.map((followUp) => ({
      ...scope,
      importId: transaction.importId,
      transactionId: transaction.id,
      eventType: 'follow_up_resolved',
      reason: 'Receipt match accepted by Finance.',
      actorUserId,
      detail: { followUpId: followUp.id },
      createdAt: now,
    })),
  ]);
  return matched;
}

export async function rejectCorporateCardMatchWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  candidateId: number,
  reasonValue: string,
  now = new Date(),
) {
  const reviewReason = reason(reasonValue);
  const { candidate, transaction } = await candidateFacts(tx, scope, candidateId);
  if (candidate.status !== 'suggested' || transaction.status !== 'suggested') {
    throw new CorporateCardError(
      'corporate_card_match_not_reviewable',
      'Only an active suggestion may be rejected.',
      409,
    );
  }
  await tx.update(corporateCardMatchCandidate).set({
    status: 'rejected',
    reviewedByUserId: actorUserId,
    reviewReason,
    reviewedAt: now,
    updatedAt: now,
  }).where(eq(corporateCardMatchCandidate.id, candidate.id));
  const remaining = await tx.select({ id: corporateCardMatchCandidate.id })
    .from(corporateCardMatchCandidate).where(and(
      eq(corporateCardMatchCandidate.transactionId, transaction.id),
      eq(corporateCardMatchCandidate.status, 'suggested'),
    ));
  let followUpId: number | null = null;
  if (!remaining.length) {
    await tx.update(corporateCardTransaction).set({
      status: 'missing_receipt',
      version: transaction.version + 1,
      updatedAt: now,
    }).where(eq(corporateCardTransaction.id, transaction.id));
    const [followUp] = await tx.insert(corporateCardFollowUp).values({
      ...scope,
      transactionId: transaction.id,
      followUpType: 'missing_receipt',
      assignedEmployeeId: transaction.holderEmployeeId,
      reason: 'All automatic receipt suggestions were rejected by Finance.',
      dueAt: new Date(now.getTime() + 7 * 86_400_000),
      createdAt: now,
      updatedAt: now,
    }).returning();
    followUpId = followUp.id;
  }
  await tx.insert(corporateCardEvent).values([
    {
      ...scope,
      importId: transaction.importId,
      transactionId: transaction.id,
      eventType: 'match_rejected',
      reason: reviewReason,
      actorUserId,
      detail: { candidateId: candidate.id },
      createdAt: now,
    },
    ...(followUpId == null ? [] : [{
      ...scope,
      importId: transaction.importId,
      transactionId: transaction.id,
      eventType: 'follow_up_opened',
      reason: 'All automatic receipt suggestions were rejected.',
      actorUserId,
      detail: { followUpId, type: 'missing_receipt' },
      createdAt: now,
    }]),
  ]);
  return { candidateId: candidate.id, transactionId: transaction.id, followUpId };
}

export async function resolveCorporateCardFollowUpWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  followUpId: number,
  action: 'resolved' | 'waived',
  reasonValue: string,
  now = new Date(),
) {
  const resolutionReason = reason(reasonValue);
  const [followUp] = await tx.select().from(corporateCardFollowUp).where(and(
    eq(corporateCardFollowUp.masterFn, scope.masterFn),
    eq(corporateCardFollowUp.companyFn, scope.companyFn),
    eq(corporateCardFollowUp.id, followUpId),
  )).limit(1).for('update');
  if (!followUp) {
    throw new CorporateCardError(
      'corporate_card_follow_up_missing',
      'Card follow-up is unavailable.',
      404,
    );
  }
  if (followUp.status !== 'open') {
    throw new CorporateCardError(
      'corporate_card_follow_up_terminal',
      'Only an open card follow-up may be resolved or waived.',
      409,
    );
  }
  const [transaction] = await tx.select().from(corporateCardTransaction).where(and(
    eq(corporateCardTransaction.masterFn, scope.masterFn),
    eq(corporateCardTransaction.companyFn, scope.companyFn),
    eq(corporateCardTransaction.id, followUp.transactionId),
  )).limit(1).for('update');
  if (!transaction) {
    throw new CorporateCardError(
      'corporate_card_transaction_missing',
      'Card transaction is unavailable.',
      404,
    );
  }
  const [updated] = await tx.update(corporateCardFollowUp).set({
    status: action,
    resolutionReason,
    resolvedByUserId: actorUserId,
    resolvedAt: now,
    updatedAt: now,
  }).where(eq(corporateCardFollowUp.id, followUp.id)).returning();
  if (action === 'waived' && transaction.status !== 'matched') {
    await tx.update(corporateCardTransaction).set({
      status: 'waived',
      version: transaction.version + 1,
      updatedAt: now,
    }).where(eq(corporateCardTransaction.id, transaction.id));
  }
  await tx.insert(corporateCardEvent).values({
    ...scope,
    importId: transaction.importId,
    transactionId: transaction.id,
    eventType: action === 'waived' ? 'follow_up_waived' : 'follow_up_resolved',
    reason: resolutionReason,
    actorUserId,
    detail: { followUpId: followUp.id, action },
    createdAt: now,
  });
  return updated;
}

export async function listCorporateCardQueueWithin(
  tx: DB,
  scope: Scope,
) {
  const transactions = await tx.select().from(corporateCardTransaction).where(and(
    eq(corporateCardTransaction.masterFn, scope.masterFn),
    eq(corporateCardTransaction.companyFn, scope.companyFn),
  )).orderBy(asc(corporateCardTransaction.postedDate), asc(corporateCardTransaction.id));
  const candidates = await tx.select().from(corporateCardMatchCandidate).where(and(
    eq(corporateCardMatchCandidate.masterFn, scope.masterFn),
    eq(corporateCardMatchCandidate.companyFn, scope.companyFn),
  )).orderBy(asc(corporateCardMatchCandidate.id));
  const followUps = await tx.select().from(corporateCardFollowUp).where(and(
    eq(corporateCardFollowUp.masterFn, scope.masterFn),
    eq(corporateCardFollowUp.companyFn, scope.companyFn),
  )).orderBy(asc(corporateCardFollowUp.id));
  return { transactions, candidates, followUps };
}
