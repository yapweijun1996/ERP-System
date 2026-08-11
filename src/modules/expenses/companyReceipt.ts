import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { and, asc, desc, eq, lt } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  appUser,
  companyReceipt,
  currency as currencyTable,
  documentExtraction,
  documentExtractionField,
  documentScanJob,
  documentVersion,
  managedDocument,
  receiptInboxItem,
} from '../../data/schema';

export class CompanyReceiptError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'CompanyReceiptError';
  }
}

export interface CompanyReceiptMetadataInput {
  transactionDate?: unknown;
  merchant?: unknown;
  receiptNumber?: unknown;
  amount?: unknown;
  currency?: unknown;
  category?: unknown;
  businessPurpose?: unknown;
  notes?: unknown;
}

export interface CreateCompanyReceiptInput extends CompanyReceiptMetadataInput {
  documentId: unknown;
  documentVersionId: unknown;
}

export interface ListCompanyReceiptsOptions {
  limit?: number;
  afterId?: number | null;
  visibility?: CompanyReceiptReadVisibility;
}

export type CompanyReceiptReadVisibility = 'own' | 'company';

type StoredMetadata = {
  transactionDate: string | null;
  merchant: string;
  receiptNumber: string | null;
  amount: string;
  currencyCode: string;
  category: string;
  businessPurpose: string;
  notes: string | null;
};

const immutableUpdateFields = [
  'documentId',
  'documentVersionId',
  'uploaderUserId',
  'receiptKey',
  'status',
  'version',
  'voidReason',
  'voidedAt',
  'voidedByUserId',
] as const;

function invalid(
  code: string,
  message: string,
  status = 422,
  fieldErrors?: Record<string, string>,
): never {
  throw new CompanyReceiptError(code, message, status, fieldErrors);
}

function positiveId(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { [field]: `${field} must be a positive integer.` },
    );
  }
  return parsed;
}

function text(
  value: unknown,
  field: string,
  label: string,
  max: number,
  required: boolean,
): string | null {
  if (value == null) {
    if (required) {
      return invalid(
        'company_receipt_validation_failed',
        'Review the highlighted receipt fields.',
        422,
        { [field]: `${label} is required.` },
      );
    }
    return null;
  }
  if (typeof value !== 'string') {
    return invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { [field]: `${label} must be text.` },
    );
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    if (required) {
      return invalid(
        'company_receipt_validation_failed',
        'Review the highlighted receipt fields.',
        422,
        { [field]: `${label} is required.` },
      );
    }
    return null;
  }
  if (normalized.length > max) {
    return invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { [field]: `${label} must be ${max} characters or fewer.` },
    );
  }
  return normalized;
}

function dateValue(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { transactionDate: 'Transaction date must use YYYY-MM-DD.' },
    );
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { transactionDate: 'Transaction date is not a valid calendar date.' },
    );
  }
  return value;
}

function amountValue(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { amount: 'Amount is required.' },
    );
  }
  let amount: Decimal;
  try {
    amount = new Decimal(value);
  } catch {
    return invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { amount: 'Amount must be a valid number.' },
    );
  }
  if (!amount.isFinite() || amount.lte(0) || amount.decimalPlaces() > 4
    || amount.gt('99999999999999.9999')) {
    return invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { amount: 'Amount must be positive, have at most 4 decimals and fit 18,4 precision.' },
    );
  }
  return amount.toFixed(4);
}

function currencyValue(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value.trim())) {
    return invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { currency: 'Currency must be a three-letter code.' },
    );
  }
  return value.trim().toUpperCase();
}

function metadata(
  input: CompanyReceiptMetadataInput,
  fallback?: StoredMetadata,
): StoredMetadata {
  const value = <K extends keyof CompanyReceiptMetadataInput>(key: K) =>
    Object.prototype.hasOwnProperty.call(input, key) ? input[key] : undefined;
  const transactionDate = value('transactionDate') === undefined && fallback
    ? fallback.transactionDate
    : dateValue(value('transactionDate'));
  const merchant = value('merchant') === undefined && fallback
    ? fallback.merchant
    : text(value('merchant'), 'merchant', 'Merchant', 200, true)!;
  const receiptNumber = value('receiptNumber') === undefined && fallback
    ? fallback.receiptNumber
    : text(value('receiptNumber'), 'receiptNumber', 'Receipt number', 120, false);
  const amount = value('amount') === undefined && fallback
    ? fallback.amount
    : amountValue(value('amount'));
  const currencyCode = value('currency') === undefined && fallback
    ? fallback.currencyCode
    : currencyValue(value('currency'));
  const category = value('category') === undefined && fallback
    ? fallback.category
    : text(value('category'), 'category', 'Category', 120, true)!;
  const businessPurpose = value('businessPurpose') === undefined && fallback
    ? fallback.businessPurpose
    : text(value('businessPurpose'), 'businessPurpose', 'Business purpose', 500, true)!;
  const notes = value('notes') === undefined && fallback
    ? fallback.notes
    : text(value('notes'), 'notes', 'Notes', 2000, false);
  return {
    transactionDate,
    merchant,
    receiptNumber,
    amount,
    currencyCode,
    category,
    businessPurpose,
    notes,
  };
}

async function assertCurrency(exec: DB, currencyCode: string): Promise<void> {
  const [found] = await exec.select({ code: currencyTable.code })
    .from(currencyTable)
    .where(eq(currencyTable.code, currencyCode))
    .limit(1);
  if (!found) {
    invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { currency: 'Currency is not registered.' },
    );
  }
}

async function assertGovernedEvidence(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  documentId: number,
  documentVersionId: number,
): Promise<string> {
  const [evidence] = await exec.select({
    documentId: managedDocument.id,
    ownerUserId: managedDocument.ownerUserId,
    recordStatus: managedDocument.recordStatus,
    currentVersionNo: managedDocument.currentVersionNo,
    versionNo: documentVersion.versionNo,
    sha256: documentVersion.sha256,
  }).from(managedDocument)
    .innerJoin(documentVersion, and(
      eq(documentVersion.masterFn, managedDocument.masterFn),
      eq(documentVersion.companyFn, managedDocument.companyFn),
      eq(documentVersion.documentId, managedDocument.id),
      eq(documentVersion.id, documentVersionId),
    ))
    .where(and(
      eq(managedDocument.id, documentId),
      eq(managedDocument.masterFn, scope.masterFn),
      eq(managedDocument.companyFn, scope.companyFn),
      eq(managedDocument.ownerUserId, actorUserId),
      eq(managedDocument.purpose, 'receipt'),
    ))
    .limit(1)
    .for('update');
  if (!evidence) {
    invalid(
      'company_receipt_evidence_not_found',
      'Receipt evidence was not found in the active company.',
      404,
    );
  }
  if (evidence.recordStatus === 'voided') {
    invalid(
      'company_receipt_evidence_voided',
      'Voided receipt evidence cannot be confirmed.',
      409,
    );
  }
  if (evidence.currentVersionNo !== evidence.versionNo) {
    invalid(
      'company_receipt_evidence_stale',
      'Choose the current governed document version before confirming the receipt.',
      409,
    );
  }
  const [scan] = await exec.select({ status: documentScanJob.status })
    .from(documentScanJob)
    .where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, documentVersionId),
    ))
    .limit(1);
  if (scan?.status !== 'clean') {
    invalid(
      'company_receipt_evidence_quarantined',
      'Receipt evidence cannot be confirmed until its security scan is clean.',
      409,
    );
  }
  return evidence.sha256;
}

const receiptProjection = {
  id: companyReceipt.id,
  receiptKey: companyReceipt.receiptKey,
  documentId: companyReceipt.documentId,
  documentVersionId: companyReceipt.documentVersionId,
  documentVersionNo: documentVersion.versionNo,
  documentSha256: documentVersion.sha256,
  evidenceSha256: companyReceipt.evidenceSha256,
  originalFileName: managedDocument.originalFileName,
  uploaderUserId: companyReceipt.uploaderUserId,
  uploaderName: appUser.fullName,
  transactionDate: companyReceipt.transactionDate,
  merchant: companyReceipt.merchant,
  receiptNumber: companyReceipt.receiptNumber,
  amount: companyReceipt.amount,
  currency: companyReceipt.currencyCode,
  category: companyReceipt.category,
  businessPurpose: companyReceipt.businessPurpose,
  notes: companyReceipt.notes,
  status: companyReceipt.status,
  version: companyReceipt.version,
  voidReason: companyReceipt.voidReason,
  voidedAt: companyReceipt.voidedAt,
  voidedByUserId: companyReceipt.voidedByUserId,
  createdAt: companyReceipt.createdAt,
  updatedAt: companyReceipt.updatedAt,
};

function receiptJoins(exec: DB) {
  return exec.select(receiptProjection).from(companyReceipt)
    .innerJoin(managedDocument, and(
      eq(managedDocument.masterFn, companyReceipt.masterFn),
      eq(managedDocument.companyFn, companyReceipt.companyFn),
      eq(managedDocument.id, companyReceipt.documentId),
    ))
    .innerJoin(documentVersion, and(
      eq(documentVersion.masterFn, companyReceipt.masterFn),
      eq(documentVersion.companyFn, companyReceipt.companyFn),
      eq(documentVersion.id, companyReceipt.documentVersionId),
      eq(documentVersion.documentId, companyReceipt.documentId),
    ))
    .innerJoin(appUser, and(
      eq(appUser.masterFn, companyReceipt.masterFn),
      eq(appUser.userId, companyReceipt.uploaderUserId),
    ));
}

/** Read scope is selected only after API permission evaluation. Aggregate
 * ownership and every mutation remain uploader-scoped. */
export async function listCompanyReceiptsWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  options: ListCompanyReceiptsOptions = {},
) {
  const limit = Math.min(100, Math.max(1, Math.floor(options.limit ?? 50)));
  const predicates = [
    eq(companyReceipt.masterFn, scope.masterFn),
    eq(companyReceipt.companyFn, scope.companyFn),
  ];
  if ((options.visibility ?? 'own') === 'own') {
    predicates.push(eq(companyReceipt.uploaderUserId, actorUserId));
  }
  if (options.afterId != null) predicates.push(lt(companyReceipt.id, options.afterId));
  return receiptJoins(exec)
    .where(and(...predicates))
    .orderBy(desc(companyReceipt.id))
    .limit(limit + 1);
}

export async function readCompanyReceiptWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  receiptId: number,
  visibility: CompanyReceiptReadVisibility = 'own',
) {
  const predicates = [
    eq(companyReceipt.id, receiptId),
    eq(companyReceipt.masterFn, scope.masterFn),
    eq(companyReceipt.companyFn, scope.companyFn),
  ];
  if (visibility === 'own') predicates.push(eq(companyReceipt.uploaderUserId, actorUserId));
  const [row] = await receiptJoins(exec).where(and(...predicates)).limit(1);
  if (!row) {
    invalid(
      'company_receipt_not_found',
      'Company receipt was not found in the active company.',
      404,
    );
  }
  return row;
}

/** Read-only bridge from governed extraction provenance to user-confirmed receipt
 * facts. OCR candidates are suggestions only and are never rewritten here. */
export async function readCompanyReceiptConfirmationWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  documentVersionId: number,
) {
  const [evidence] = await exec.select({
    documentId: managedDocument.id,
    documentVersionId: documentVersion.id,
    originalFileName: managedDocument.originalFileName,
    recordStatus: managedDocument.recordStatus,
    currentVersionNo: managedDocument.currentVersionNo,
    versionNo: documentVersion.versionNo,
    sha256: documentVersion.sha256,
    scanStatus: documentScanJob.status,
    extractionId: documentExtraction.id,
    extractionStatus: documentExtraction.status,
    extractionProvider: documentExtraction.provider,
    extractionModel: documentExtraction.model,
    inboxStatus: receiptInboxItem.status,
    reviewReasons: receiptInboxItem.reviewReasons,
    duplicateOfVersionId: receiptInboxItem.duplicateOfVersionId,
  }).from(managedDocument)
    .innerJoin(documentVersion, and(
      eq(documentVersion.masterFn, managedDocument.masterFn),
      eq(documentVersion.companyFn, managedDocument.companyFn),
      eq(documentVersion.documentId, managedDocument.id),
      eq(documentVersion.id, documentVersionId),
    ))
    .leftJoin(documentScanJob, and(
      eq(documentScanJob.masterFn, documentVersion.masterFn),
      eq(documentScanJob.companyFn, documentVersion.companyFn),
      eq(documentScanJob.versionId, documentVersion.id),
    ))
    .leftJoin(documentExtraction, and(
      eq(documentExtraction.masterFn, documentVersion.masterFn),
      eq(documentExtraction.companyFn, documentVersion.companyFn),
      eq(documentExtraction.versionId, documentVersion.id),
      eq(documentExtraction.extractionVersion, 1),
    ))
    .leftJoin(receiptInboxItem, and(
      eq(receiptInboxItem.masterFn, documentVersion.masterFn),
      eq(receiptInboxItem.companyFn, documentVersion.companyFn),
      eq(receiptInboxItem.versionId, documentVersion.id),
    ))
    .where(and(
      eq(managedDocument.masterFn, scope.masterFn),
      eq(managedDocument.companyFn, scope.companyFn),
      eq(managedDocument.ownerUserId, actorUserId),
      eq(managedDocument.purpose, 'receipt'),
    ))
    .limit(1);
  if (!evidence) {
    invalid(
      'company_receipt_evidence_not_found',
      'Receipt evidence was not found in the active company.',
      404,
    );
  }

  const candidates = evidence.extractionId == null ? [] : await exec.select({
    fieldKey: documentExtractionField.fieldKey,
    candidateNo: documentExtractionField.candidateNo,
    valueText: documentExtractionField.valueText,
    normalizedValue: documentExtractionField.normalizedValue,
    sourceType: documentExtractionField.sourceType,
    sourceRef: documentExtractionField.sourceRef,
    model: documentExtractionField.model,
    confidence: documentExtractionField.confidence,
    critical: documentExtractionField.critical,
    reviewState: documentExtractionField.reviewState,
  }).from(documentExtractionField).where(and(
    eq(documentExtractionField.masterFn, scope.masterFn),
    eq(documentExtractionField.companyFn, scope.companyFn),
    eq(documentExtractionField.extractionId, evidence.extractionId),
  )).orderBy(
    asc(documentExtractionField.fieldKey),
    asc(documentExtractionField.candidateNo),
  );

  const [existingReceipt] = await exec.select({
    id: companyReceipt.id,
    status: companyReceipt.status,
    version: companyReceipt.version,
    documentVersionId: companyReceipt.documentVersionId,
  }).from(companyReceipt).where(and(
    eq(companyReceipt.masterFn, scope.masterFn),
    eq(companyReceipt.companyFn, scope.companyFn),
    eq(companyReceipt.evidenceSha256, evidence.sha256),
  )).limit(1);

  const byKey = new Map<string, typeof candidates[number]>();
  for (const candidate of candidates) {
    if (candidate.reviewState === 'conflict') continue;
    const selected = byKey.get(candidate.fieldKey);
    if (!selected || Number(candidate.confidence) > Number(selected.confidence)) {
      byKey.set(candidate.fieldKey, candidate);
    }
  }
  const suggestion = (fieldKey: string, normalized = false) => {
    const candidate = byKey.get(fieldKey);
    if (!candidate) return null;
    return normalized ? candidate.normalizedValue : candidate.valueText;
  };
  const reviewReasons = evidence.reviewReasons ?? [];
  const warnings = Array.from(new Set([
    ...reviewReasons,
    ...(evidence.extractionStatus === 'failed' ? ['ocr_failed'] : []),
    ...(evidence.extractionStatus === 'unavailable' ? ['ocr_unavailable'] : []),
    ...(!evidence.extractionStatus || ['queued', 'extracting'].includes(evidence.extractionStatus)
      ? ['ocr_pending'] : []),
    ...(existingReceipt && existingReceipt.documentVersionId !== evidence.documentVersionId
      ? ['exact_duplicate_confirmed'] : []),
    ...(existingReceipt && existingReceipt.documentVersionId === evidence.documentVersionId
      ? ['already_confirmed'] : []),
  ]));
  const evidenceCurrent = evidence.recordStatus !== 'voided'
    && evidence.currentVersionNo === evidence.versionNo;
  const manualConfirmationAllowed = evidence.scanStatus === 'clean'
    && evidenceCurrent
    && !existingReceipt;

  return {
    evidence: {
      documentId: evidence.documentId,
      documentVersionId: evidence.documentVersionId,
      originalFileName: evidence.originalFileName,
      sha256: evidence.sha256,
      scanStatus: evidence.scanStatus ?? 'missing',
      recordStatus: evidence.recordStatus,
      current: evidence.currentVersionNo === evidence.versionNo,
    },
    extraction: {
      status: evidence.extractionStatus ?? 'not_started',
      provider: evidence.extractionProvider ?? null,
      model: evidence.extractionModel ?? null,
      inboxStatus: evidence.inboxStatus ?? null,
      reviewReasons,
      duplicateOfVersionId: evidence.duplicateOfVersionId ?? null,
      candidates,
    },
    suggestedMetadata: {
      transactionDate: suggestion('transaction_date', true),
      merchant: suggestion('merchant_name'),
      receiptNumber: suggestion('receipt_number'),
      amount: suggestion('total_amount', true),
      currency: suggestion('currency', true),
    },
    existingReceipt: existingReceipt ?? null,
    warnings,
    manualConfirmationAllowed,
    provenanceImmutable: true,
  };
}

export async function createCompanyReceiptWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  input: CreateCompanyReceiptInput,
) {
  const documentId = positiveId(input.documentId, 'documentId');
  const documentVersionId = positiveId(input.documentVersionId, 'documentVersionId');
  const fields = metadata(input);
  await assertCurrency(exec, fields.currencyCode);
  const evidenceSha256 = await assertGovernedEvidence(
    exec,
    scope,
    actorUserId,
    documentId,
    documentVersionId,
  );
  const [exactDuplicate] = await exec.select({ id: companyReceipt.id })
    .from(companyReceipt)
    .where(and(
      eq(companyReceipt.masterFn, scope.masterFn),
      eq(companyReceipt.companyFn, scope.companyFn),
      eq(companyReceipt.evidenceSha256, evidenceSha256),
    )).limit(1);
  if (exactDuplicate) {
    invalid(
      'company_receipt_exact_duplicate',
      'This exact receipt evidence is already confirmed in the active company.',
      409,
      { documentVersionId: `Existing Company Receipt ${exactDuplicate.id} uses the same file hash.` },
    );
  }
  const [inserted] = await exec.insert(companyReceipt).values({
    ...scope,
    receiptKey: `company-receipt:${randomUUID()}`,
    documentId,
    documentVersionId,
    evidenceSha256,
    uploaderUserId: actorUserId,
    ...fields,
    status: 'ready',
  }).onConflictDoNothing().returning({ id: companyReceipt.id });
  if (!inserted) {
    const [duplicate] = await exec.select({ id: companyReceipt.id })
      .from(companyReceipt)
      .where(and(
        eq(companyReceipt.masterFn, scope.masterFn),
        eq(companyReceipt.companyFn, scope.companyFn),
        eq(companyReceipt.evidenceSha256, evidenceSha256),
      )).limit(1);
    if (duplicate) {
      invalid(
        'company_receipt_exact_duplicate',
        'This exact receipt evidence is already confirmed in the active company.',
        409,
        { documentVersionId: `Existing Company Receipt ${duplicate.id} uses the same file hash.` },
      );
    }
    invalid(
      'company_receipt_evidence_conflict',
      'This governed document is already linked to a Company Receipt.',
      409,
    );
  }
  return readCompanyReceiptWithin(exec, scope, actorUserId, inserted.id);
}

async function lockUploaderReceipt(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  receiptId: number,
) {
  const [row] = await exec.select().from(companyReceipt).where(and(
    eq(companyReceipt.id, receiptId),
    eq(companyReceipt.masterFn, scope.masterFn),
    eq(companyReceipt.companyFn, scope.companyFn),
    eq(companyReceipt.uploaderUserId, actorUserId),
  )).limit(1).for('update');
  if (!row) {
    invalid(
      'company_receipt_not_found',
      'Company receipt was not found in the active company.',
      404,
    );
  }
  return row;
}

function assertExpectedVersion(actual: number, expected: unknown): number {
  const value = Number(expected);
  if (!Number.isSafeInteger(value) || value <= 0) {
    return invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { expectedVersion: 'expectedVersion must be a positive integer.' },
    );
  }
  if (value !== actual) {
    invalid(
      'company_receipt_version_conflict',
      'This Company Receipt changed in another session. Refresh before retrying.',
      409,
    );
  }
  return value;
}

export async function updateCompanyReceiptWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  receiptId: number,
  expectedVersion: unknown,
  input: CompanyReceiptMetadataInput & Record<string, unknown>,
) {
  const suppliedImmutable = immutableUpdateFields.find((field) =>
    Object.prototype.hasOwnProperty.call(input, field));
  if (suppliedImmutable) {
    invalid(
      'company_receipt_immutable_field',
      'Evidence, uploader, state and version fields cannot be changed through metadata update.',
      400,
      { [suppliedImmutable]: 'This field is immutable.' },
    );
  }
  const before = await lockUploaderReceipt(exec, scope, actorUserId, receiptId);
  assertExpectedVersion(before.version, expectedVersion);
  if (before.status === 'voided') {
    invalid(
      'company_receipt_voided',
      'A voided Company Receipt cannot be edited.',
      409,
    );
  }
  const fields = metadata(input, before);
  await assertCurrency(exec, fields.currencyCode);
  const now = new Date();
  const [updated] = await exec.update(companyReceipt).set({
    ...fields,
    version: before.version + 1,
    updatedAt: now,
  }).where(and(
    eq(companyReceipt.id, before.id),
    eq(companyReceipt.masterFn, scope.masterFn),
    eq(companyReceipt.companyFn, scope.companyFn),
    eq(companyReceipt.uploaderUserId, actorUserId),
    eq(companyReceipt.version, before.version),
  )).returning({ id: companyReceipt.id });
  if (!updated) {
    invalid(
      'company_receipt_version_conflict',
      'This Company Receipt changed in another session. Refresh before retrying.',
      409,
    );
  }
  const after = await readCompanyReceiptWithin(exec, scope, actorUserId, before.id);
  return { before, after };
}

export async function voidCompanyReceiptWithin(
  exec: DB,
  scope: Scope,
  actorUserId: number,
  receiptId: number,
  expectedVersion: unknown,
  reason: unknown,
  now = new Date(),
) {
  const before = await lockUploaderReceipt(exec, scope, actorUserId, receiptId);
  assertExpectedVersion(before.version, expectedVersion);
  if (before.status === 'voided') {
    invalid(
      'company_receipt_voided',
      'Company Receipt is already voided.',
      409,
    );
  }
  const voidReason = text(reason, 'reason', 'Void reason', 1000, true)!;
  if (voidReason.length < 3) {
    invalid(
      'company_receipt_validation_failed',
      'Review the highlighted receipt fields.',
      422,
      { reason: 'Void reason must contain at least 3 characters.' },
    );
  }
  const [updated] = await exec.update(companyReceipt).set({
    status: 'voided',
    voidReason,
    voidedAt: now,
    voidedByUserId: actorUserId,
    version: before.version + 1,
    updatedAt: now,
  }).where(and(
    eq(companyReceipt.id, before.id),
    eq(companyReceipt.masterFn, scope.masterFn),
    eq(companyReceipt.companyFn, scope.companyFn),
    eq(companyReceipt.uploaderUserId, actorUserId),
    eq(companyReceipt.version, before.version),
  )).returning({ id: companyReceipt.id });
  if (!updated) {
    invalid(
      'company_receipt_version_conflict',
      'This Company Receipt changed in another session. Refresh before retrying.',
      409,
    );
  }
  const after = await readCompanyReceiptWithin(exec, scope, actorUserId, before.id);
  return { before, after };
}
