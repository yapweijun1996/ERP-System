import Decimal from 'decimal.js';
import {
  and,
  asc,
  eq,
  gte,
  ilike,
  lte,
  or,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  appUser,
  companyReceipt,
  managedDocument,
} from '../../data/schema';
import type { CompanyReceiptReadVisibility } from './companyReceipt';
import type {
  CompanyReceiptPackFilters,
  CompanyReceiptPackLineFacts,
  CompanyReceiptPackTotal,
} from './companyReceiptPackPdf';

export const MAX_PACK_RECEIPTS = 5000;

export interface CompanyReceiptPackSelection {
  filters: CompanyReceiptPackFilters;
  rows: CompanyReceiptPackLineFacts[];
  totals: CompanyReceiptPackTotal[];
  sourceSha256: string;
  rowCount: number;
  documentCount: number;
  retentionUntil: Date;
}

type Failure = (code: string, message: string, status?: number) => never;

function defaultFailure(code: string, message: string, status = 422): never {
  const error = Object.assign(new Error(message), { code, status });
  throw error;
}

function date(value: unknown, label: string, failure: Failure): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return failure('company_receipt_pack_date_invalid', `${label} must be a valid date.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return failure('company_receipt_pack_date_invalid', `${label} must be a valid date.`);
  }
  return value;
}

export function normalizeCompanyReceiptPackFilters(
  input: { search?: unknown; dateFrom?: unknown; dateTo?: unknown },
  failure: Failure = defaultFailure,
): CompanyReceiptPackFilters {
  const search = typeof input.search === 'string' ? input.search.trim() : '';
  if (search.length > 200) {
    return failure(
      'company_receipt_pack_search_invalid',
      'Receipt Pack search must be 200 characters or fewer.',
    );
  }
  const dateFrom = date(input.dateFrom, 'Date From', failure);
  const dateTo = date(input.dateTo, 'Date To', failure);
  if (dateFrom > dateTo) {
    return failure(
      'company_receipt_pack_range_invalid',
      'Date From must be on or before Date To.',
    );
  }
  return { search, dateFrom, dateTo };
}

export type SelectionHash = (value: string) => string | Promise<string>;

/**
 * Select the exact facts a Pack would freeze without inserting a Pack. The
 * caller supplies the platform-appropriate SHA-256 implementation so the
 * query and digest contract is shared by PostgreSQL and the browser Demo.
 */
export async function selectCompanyReceiptPackSelectionWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  visibility: CompanyReceiptReadVisibility,
  filters: CompanyReceiptPackFilters,
  hash: SelectionHash,
  options: { lockRows?: boolean } = {},
  failure: Failure = defaultFailure,
): Promise<CompanyReceiptPackSelection> {
  const predicates = [
    eq(companyReceipt.masterFn, scope.masterFn),
    eq(companyReceipt.companyFn, scope.companyFn),
    eq(companyReceipt.status, 'ready'),
    gte(companyReceipt.transactionDate, filters.dateFrom),
    lte(companyReceipt.transactionDate, filters.dateTo),
  ];
  if (visibility === 'own') predicates.push(eq(companyReceipt.uploaderUserId, actorUserId));
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    predicates.push(or(
      ilike(companyReceipt.merchant, pattern),
      ilike(companyReceipt.receiptNumber, pattern),
      ilike(companyReceipt.notes, pattern),
      ilike(companyReceipt.category, pattern),
    )!);
  }
  const selectionQuery = tx.select({
    receiptId: companyReceipt.id,
    receiptVersion: companyReceipt.version,
    transactionDate: companyReceipt.transactionDate,
    merchant: companyReceipt.merchant,
    receiptNumber: companyReceipt.receiptNumber,
    category: companyReceipt.category,
    businessPurpose: companyReceipt.businessPurpose,
    notes: companyReceipt.notes,
    amount: companyReceipt.amount,
    currency: companyReceipt.currencyCode,
    uploaderUserId: companyReceipt.uploaderUserId,
    uploaderName: appUser.fullName,
    documentId: companyReceipt.documentId,
    documentVersionId: companyReceipt.documentVersionId,
    documentSha256: companyReceipt.evidenceSha256,
    originalFileName: managedDocument.originalFileName,
    retentionUntil: managedDocument.retentionUntil,
  }).from(companyReceipt)
    .innerJoin(appUser, and(
      eq(appUser.masterFn, companyReceipt.masterFn),
      eq(appUser.userId, companyReceipt.uploaderUserId),
    ))
    .innerJoin(managedDocument, and(
      eq(managedDocument.masterFn, companyReceipt.masterFn),
      eq(managedDocument.companyFn, companyReceipt.companyFn),
      eq(managedDocument.id, companyReceipt.documentId),
    ))
    .where(and(...predicates))
    .orderBy(asc(companyReceipt.transactionDate), asc(companyReceipt.id))
    .limit(MAX_PACK_RECEIPTS + 1);
  const selected = options.lockRows
    ? await selectionQuery.for('update', { of: companyReceipt })
    : await selectionQuery;
  if (!selected.length) {
    return failure(
      'company_receipt_pack_empty',
      'No ready, dated Company Receipts match the selected range.',
      404,
    );
  }
  if (selected.length > MAX_PACK_RECEIPTS) {
    return failure(
      'company_receipt_pack_limit_exceeded',
      `A Receipt Pack may contain at most ${MAX_PACK_RECEIPTS} receipts. Narrow the filters.`,
      413,
    );
  }
  const rows = selected.map((row) => ({
    receiptId: row.receiptId,
    receiptVersion: row.receiptVersion,
    transactionDate: row.transactionDate,
    merchant: row.merchant,
    receiptNumber: row.receiptNumber,
    category: row.category,
    businessPurpose: row.businessPurpose,
    notes: row.notes,
    amount: row.amount,
    currency: row.currency,
    uploaderUserId: row.uploaderUserId,
    uploaderName: row.uploaderName,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    documentSha256: row.documentSha256,
    originalFileName: row.originalFileName,
  })) as CompanyReceiptPackLineFacts[];
  const totalMap = new Map<string, { amount: Decimal; receiptCount: number }>();
  for (const row of rows) {
    const current = totalMap.get(row.currency) ?? { amount: new Decimal(0), receiptCount: 0 };
    current.amount = current.amount.plus(row.amount);
    current.receiptCount += 1;
    totalMap.set(row.currency, current);
  }
  const totals = [...totalMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, total]) => ({
      currency,
      amount: total.amount.toFixed(4),
      receiptCount: total.receiptCount,
    }));
  const sourceSha256 = await hash(JSON.stringify({ filters, visibility, rows, totals }));
  const retentionUntil = selected.reduce((latest, row) => (
    row.retentionUntil.getTime() > latest.getTime() ? row.retentionUntil : latest
  ), new Date(0));
  return {
    filters,
    rows,
    totals,
    sourceSha256,
    rowCount: rows.length,
    documentCount: rows.length,
    retentionUntil,
  };
}
