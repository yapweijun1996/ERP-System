import { createHash } from 'node:crypto';
import Decimal from 'decimal.js';
import {
  and,
  asc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  appUser,
  companyReceipt,
  companyReceiptPack,
  documentVersion,
  managedDocument,
} from '../../data/schema';
import { assertDocumentScanClean } from '../documents/processing';
import {
  createDocumentStorageRegistry,
  type DocumentStorageBackend,
  type DocumentStorageRegistry,
  type StoredDocumentVersion,
} from '../documents/storage';
import type { EvidencePdfDocument } from '../documents/evidencePdf';
import {
  renderCompanyReceiptPackPdf,
  type CompanyReceiptPackFacts,
  type CompanyReceiptPackFilters,
  type CompanyReceiptPackLineFacts,
  type CompanyReceiptPackTotal,
} from './companyReceiptPackPdf';
import type { CompanyReceiptReadVisibility } from './companyReceipt';

const MAX_PACK_RECEIPTS = 5000;
const MAX_PACK_SOURCE_BYTES = 250 * 1024 * 1024;

export type CompanyReceiptPackAction = 'view' | 'download' | 'print';

export class CompanyReceiptPackError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = 'CompanyReceiptPackError';
  }
}

export interface CreateCompanyReceiptPackInput {
  packKey: unknown;
  search?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  locale?: unknown;
}

function fail(code: string, message: string, status = 422): never {
  throw new CompanyReceiptPackError(code, message, status);
}

function safeKey(value: unknown): string {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) {
    return fail(
      'company_receipt_pack_key_invalid',
      'A stable Receipt Pack key of 8–128 safe characters is required.',
    );
  }
  return key;
}

function date(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fail('company_receipt_pack_date_invalid', `${label} must be a valid date.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return fail('company_receipt_pack_date_invalid', `${label} must be a valid date.`);
  }
  return value;
}

function normalizeFilters(input: CreateCompanyReceiptPackInput): CompanyReceiptPackFilters {
  const search = typeof input.search === 'string' ? input.search.trim() : '';
  if (search.length > 200) {
    return fail(
      'company_receipt_pack_search_invalid',
      'Receipt Pack search must be 200 characters or fewer.',
    );
  }
  const dateFrom = date(input.dateFrom, 'Date From');
  const dateTo = date(input.dateTo, 'Date To');
  if (dateFrom > dateTo) {
    return fail(
      'company_receipt_pack_range_invalid',
      'Date From must be on or before Date To.',
    );
  }
  return { search, dateFrom, dateTo };
}

function normalizedLocale(value: unknown): 'en' | 'ms' | 'zh' | 'ja' | 'vi' {
  return ['en', 'ms', 'zh', 'ja', 'vi'].includes(String(value))
    ? String(value) as 'en' | 'ms' | 'zh' | 'ja' | 'vi'
    : 'en';
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function packProjection(row: typeof companyReceiptPack.$inferSelect): CompanyReceiptPackFacts & {
  visibility: CompanyReceiptReadVisibility;
  createdByUserId: number;
} {
  return {
    id: row.id,
    packKey: row.packKey,
    visibility: row.visibility as CompanyReceiptReadVisibility,
    locale: row.locale,
    filters: row.filters as CompanyReceiptPackFilters,
    rows: row.rows as CompanyReceiptPackLineFacts[],
    totals: row.totals as CompanyReceiptPackTotal[],
    sourceSha256: row.sourceSha256,
    rowCount: row.rowCount,
    documentCount: row.documentCount,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

function sameFilters(value: unknown, expected: CompanyReceiptPackFilters): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const stored = value as Partial<CompanyReceiptPackFilters>;
  return stored.search === expected.search
    && stored.dateFrom === expected.dateFrom
    && stored.dateTo === expected.dateTo;
}

export async function createCompanyReceiptPackWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  visibility: CompanyReceiptReadVisibility,
  input: CreateCompanyReceiptPackInput,
  now = new Date(),
) {
  const packKey = safeKey(input.packKey);
  const filters = normalizeFilters(input);
  const locale = normalizedLocale(input.locale);
  const [existing] = await tx.select().from(companyReceiptPack).where(and(
    eq(companyReceiptPack.masterFn, scope.masterFn),
    eq(companyReceiptPack.companyFn, scope.companyFn),
    eq(companyReceiptPack.packKey, packKey),
  )).limit(1);
  if (existing) {
    const same = existing.createdByUserId === actorUserId
      && existing.visibility === visibility
      && existing.locale === locale
      && sameFilters(existing.filters, filters);
    if (!same) {
      return fail(
        'company_receipt_pack_key_conflict',
        'This Receipt Pack key was already used for different selection facts.',
        409,
      );
    }
    return { pack: packProjection(existing), replayed: true };
  }

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
  const selected = await tx.select({
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
  if (!selected.length) {
    return fail(
      'company_receipt_pack_empty',
      'No ready, dated Company Receipts match the selected range.',
      404,
    );
  }
  if (selected.length > MAX_PACK_RECEIPTS) {
    return fail(
      'company_receipt_pack_limit_exceeded',
      `A Receipt Pack may contain at most ${MAX_PACK_RECEIPTS} receipts. Narrow the filters.`,
      413,
    );
  }
  const rows = selected as CompanyReceiptPackLineFacts[];
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
  const sourceSha256 = sha256(JSON.stringify({ filters, visibility, rows, totals }));
  const [created] = await tx.insert(companyReceiptPack).values({
    ...scope,
    packKey,
    visibility,
    locale,
    filters,
    rows,
    totals,
    sourceSha256,
    rowCount: rows.length,
    documentCount: rows.length,
    createdByUserId: actorUserId,
    createdAt: now,
  }).returning();
  return { pack: packProjection(created), replayed: false };
}

export async function readCompanyReceiptPackWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  packId: number,
) {
  const [row] = await tx.select().from(companyReceiptPack).where(and(
    eq(companyReceiptPack.masterFn, scope.masterFn),
    eq(companyReceiptPack.companyFn, scope.companyFn),
    eq(companyReceiptPack.id, packId),
    eq(companyReceiptPack.createdByUserId, actorUserId),
  )).limit(1);
  if (!row) {
    return fail(
      'company_receipt_pack_not_found',
      'Receipt Pack is unavailable for the signed-in user and active Company.',
      404,
    );
  }
  return packProjection(row);
}

export async function renderCompanyReceiptPackWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  packId: number,
  action: CompanyReceiptPackAction,
  registry: DocumentStorageRegistry = createDocumentStorageRegistry(),
) {
  const pack = await readCompanyReceiptPackWithin(tx, scope, actorUserId, packId);
  const versionIds = pack.rows.map((row) => row.documentVersionId);
  const versions = await tx.select().from(documentVersion).where(and(
    eq(documentVersion.masterFn, scope.masterFn),
    eq(documentVersion.companyFn, scope.companyFn),
    inArray(documentVersion.id, versionIds),
  ));
  const byId = new Map(versions.map((version) => [version.id, version]));
  const totalBytes = versions.reduce((total, version) => total + version.sizeBytes, 0);
  if (versions.length !== versionIds.length || totalBytes > MAX_PACK_SOURCE_BYTES) {
    return fail(
      'company_receipt_pack_source_unavailable',
      totalBytes > MAX_PACK_SOURCE_BYTES
        ? 'Receipt Pack source files exceed the 250 MB rendering limit.'
        : 'One or more frozen Receipt Pack document versions are unavailable.',
      totalBytes > MAX_PACK_SOURCE_BYTES ? 413 : 409,
    );
  }
  const documents: EvidencePdfDocument[] = [];
  for (const row of pack.rows) {
    const version = byId.get(row.documentVersionId)!;
    if (version.documentId !== row.documentId || version.sha256 !== row.documentSha256) {
      return fail(
        'company_receipt_pack_source_changed',
        'Frozen Receipt Pack evidence identity no longer matches its source version.',
        409,
      );
    }
    await assertDocumentScanClean(
      tx,
      scope,
      version.id,
      action === 'view' ? 'preview' : 'export',
    );
    const content = await registry.get(version.storageBackend as DocumentStorageBackend)
      .readWithin(tx, scope, version as StoredDocumentVersion);
    if (sha256(content) !== row.documentSha256) {
      return fail(
        'company_receipt_pack_source_changed',
        'Frozen Receipt Pack evidence content failed integrity verification.',
        409,
      );
    }
    documents.push({
      fileName: row.originalFileName,
      mimeType: version.mimeType,
      sha256: version.sha256,
      content,
    });
  }
  const content = await renderCompanyReceiptPackPdf(pack, documents);
  return {
    pack,
    fileName: `company-receipt-pack-${pack.filters.dateFrom}-${pack.filters.dateTo}.pdf`,
    mimeType: 'application/pdf' as const,
    content,
    sha256: sha256(content),
  };
}
