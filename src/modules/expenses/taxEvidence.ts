import { createHash, randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  withReportingWorkerTransaction,
  withTenantTransaction,
} from '../../data/tenantTransaction';
import {
  documentScanJob,
  documentExtractionField,
  documentVersion,
  employee,
  expenseAllocation,
  expenseClaim,
  expenseClaimLine,
  expenseLinePolicySnapshot,
  expensePosting,
  managedDocument,
  receiptInboxItem,
  taxEvidenceAccessEvent,
  taxEvidenceArtifact,
  taxEvidenceReportJob,
  taxEvidenceSnapshot,
  taxEvidenceSnapshotDocument,
  taxEvidenceSnapshotLine,
} from '../../data/schema';
import {
  createDocumentStorageRegistry,
  type DocumentStorageBackend,
  type DocumentStorageRegistry,
  type StoredDocumentVersion,
} from '../documents/storage';
import { renderEvidencePdf } from '../documents/evidencePdf';

export type TaxEvidenceCompleteness =
  | 'complete'
  | 'missing_receipt'
  | 'unverified_receipt';
export type TaxEvidenceAction = 'view' | 'download' | 'print' | 'export';

export interface TaxEvidenceFilters {
  startDate: string;
  endDate: string;
  employeeIds?: number[];
  categoryCodes?: string[];
  projectKeys?: string[];
  currencyCodes?: string[];
  taxStates?: Array<'input_tax' | 'non_deductible' | 'exempt'>;
  completeness?: TaxEvidenceCompleteness[];
  paperCustodyStatuses?: Array<'none' | 'employee' | 'finance_archive' | 'returned' | 'destroyed'>;
}

export interface TaxEvidenceOcrField {
  fieldKey: string;
  value: string;
  normalizedValue: string;
  confidence: string;
  reviewState: string;
  model: string;
}

export interface TaxEvidenceLineFacts {
  postingId: number;
  postingDate: string;
  journalRef: string;
  claimId: number;
  claimNo: string;
  claimVersion: number;
  ownerUserId: number;
  employeeId: number | null;
  employeeNo: string | null;
  employeeName: string | null;
  employeeDepartment: string | null;
  lineId: number;
  lineNo: number;
  merchant: string;
  merchantTaxNumber: string | null;
  transactionDate: string;
  purpose: string;
  categoryCode: string;
  projectKeys: string[];
  paymentSource: string;
  originalCurrency: string;
  originalGross: string;
  functionalCurrency: string;
  baseExpense: string;
  baseInputTax: string;
  baseGross: string;
  taxTreatment: string;
  taxCode: string | null;
  taxRate: string;
  inputTaxRecoverablePct: string;
  completeness: TaxEvidenceCompleteness;
  ocrMinConfidence: string | null;
  ocrReviewState: string | null;
  ocrFields: TaxEvidenceOcrField[];
  evidenceDocumentId: number | null;
  evidenceVersionId: number | null;
  evidenceSha256: string | null;
  evidenceFileName: string | null;
  paperCustodyStatus: string | null;
  paperOriginalReference: string | null;
  retentionUntil: string | null;
  legalHold: boolean;
}

export class TaxEvidenceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'TaxEvidenceError';
  }
}

type ArtifactType =
  | 'register_pdf'
  | 'merged_pdf'
  | 'register_xlsx'
  | 'register_csv'
  | 'originals_zip'
  | 'manifest_json';

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeKey(value: string, label: string): string {
  const result = value?.trim() ?? '';
  if (
    result.length < 8
    || result.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(result)
  ) {
    throw new TaxEvidenceError(
      'tax_evidence_invalid',
      `${label} must be a stable 8–128 character key.`,
    );
  }
  return result;
}

function dateValue(value: string, label: string): string {
  const result = value?.trim() ?? '';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result)
    || new Date(`${result}T00:00:00.000Z`).toISOString().slice(0, 10) !== result
  ) {
    throw new TaxEvidenceError(
      'tax_evidence_invalid',
      `${label} must use a valid YYYY-MM-DD date.`,
    );
  }
  return result;
}

function strings(
  values: unknown,
  label: string,
  pattern: RegExp,
): string[] {
  if (values == null) return [];
  if (!Array.isArray(values) || values.length > 50) {
    throw new TaxEvidenceError(
      'tax_evidence_invalid',
      `${label} must contain at most 50 values.`,
    );
  }
  const result = values.map((value) => String(value).trim());
  if (new Set(result).size !== result.length || result.some((value) => !pattern.test(value))) {
    throw new TaxEvidenceError(
      'tax_evidence_invalid',
      `${label} contains duplicate or unsupported values.`,
    );
  }
  return result.sort();
}

function positiveIds(values: unknown, label: string): number[] {
  if (values == null) return [];
  if (!Array.isArray(values) || values.length > 50) {
    throw new TaxEvidenceError(
      'tax_evidence_invalid',
      `${label} must contain at most 50 values.`,
    );
  }
  if (values.some((value) => !Number.isSafeInteger(value) || Number(value) <= 0)) {
    throw new TaxEvidenceError(
      'tax_evidence_invalid',
      `${label} must contain positive integer identifiers.`,
    );
  }
  const result = values.map(Number);
  if (new Set(result).size !== result.length) {
    throw new TaxEvidenceError(
      'tax_evidence_invalid',
      `${label} contains duplicate values.`,
    );
  }
  return result.sort((a, b) => a - b);
}

function normalizeFilters(input: TaxEvidenceFilters): Required<TaxEvidenceFilters> {
  const startDate = dateValue(input.startDate, 'Start date');
  const endDate = dateValue(input.endDate, 'End date');
  if (endDate < startDate) {
    throw new TaxEvidenceError(
      'tax_evidence_invalid',
      'End date must not precede start date.',
    );
  }
  const maxEnd = new Date(`${startDate}T00:00:00.000Z`);
  maxEnd.setUTCFullYear(maxEnd.getUTCFullYear() + 5);
  if (new Date(`${endDate}T00:00:00.000Z`) > maxEnd) {
    throw new TaxEvidenceError(
      'tax_evidence_invalid',
      'A tax evidence snapshot cannot span more than five years.',
    );
  }
  const taxStates = strings(
    input.taxStates,
    'Tax states',
    /^(input_tax|non_deductible|exempt)$/,
  ) as Required<TaxEvidenceFilters>['taxStates'];
  const completeness = strings(
    input.completeness,
    'Completeness states',
    /^(complete|missing_receipt|unverified_receipt)$/,
  ) as TaxEvidenceCompleteness[];
  return {
    startDate,
    endDate,
    employeeIds: positiveIds(input.employeeIds, 'Employees'),
    categoryCodes: strings(input.categoryCodes, 'Categories', /^[A-Z][A-Z0-9_-]{1,31}$/),
    projectKeys: strings(input.projectKeys, 'Projects', /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/),
    currencyCodes: strings(input.currencyCodes, 'Currencies', /^[A-Z]{3}$/),
    taxStates,
    completeness,
    paperCustodyStatuses: strings(
      input.paperCustodyStatuses,
      'Paper custody states',
      /^(none|employee|finance_archive|returned|destroyed)$/,
    ) as Required<TaxEvidenceFilters>['paperCustodyStatuses'],
  };
}

function same(value: unknown, expected: unknown): boolean {
  return JSON.stringify(value) === JSON.stringify(expected);
}

function projection(row: typeof taxEvidenceSnapshot.$inferSelect) {
  return {
    id: row.id,
    snapshotKey: row.snapshotKey,
    filters: row.filters,
    sourceSha256: row.sourceSha256,
    rowCount: row.rowCount,
    documentCount: row.documentCount,
    originalGross: row.originalGross,
    baseExpense: row.baseExpense,
    baseInputTax: row.baseInputTax,
    baseGross: row.baseGross,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

export async function createTaxEvidenceSnapshotWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  snapshotKeyValue: string,
  input: TaxEvidenceFilters,
  now = new Date(),
) {
  const snapshotKey = safeKey(snapshotKeyValue, 'Snapshot key');
  const filters = normalizeFilters(input);
  if (filters.employeeIds.length) {
    const selectedEmployees = await tx.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      inArray(employee.id, filters.employeeIds),
    ));
    const selectedIds = new Set(selectedEmployees.map((row) => row.id));
    if (filters.employeeIds.some((id) => !selectedIds.has(id))) {
      throw new TaxEvidenceError(
        'tax_evidence_employee_invalid',
        'One or more selected employees are unavailable in the active company.',
        422,
      );
    }
  }
  const [existing] = await tx.select().from(taxEvidenceSnapshot).where(and(
    eq(taxEvidenceSnapshot.masterFn, scope.masterFn),
    eq(taxEvidenceSnapshot.companyFn, scope.companyFn),
    eq(taxEvidenceSnapshot.snapshotKey, snapshotKey),
  )).limit(1);
  if (existing) {
    if (!same(existing.filters, filters)) {
      throw new TaxEvidenceError(
        'tax_evidence_snapshot_key_conflict',
        'Snapshot key already exists with different filters.',
        409,
      );
    }
    const lines = await tx.select().from(taxEvidenceSnapshotLine).where(and(
      eq(taxEvidenceSnapshotLine.masterFn, scope.masterFn),
      eq(taxEvidenceSnapshotLine.companyFn, scope.companyFn),
      eq(taxEvidenceSnapshotLine.snapshotId, existing.id),
    )).orderBy(asc(taxEvidenceSnapshotLine.ordinal));
    return { snapshot: projection(existing), lines, replayed: true };
  }

  const candidates = await tx.select({
    posting: expensePosting,
    claim: expenseClaim,
    line: expenseClaimLine,
    policy: expenseLinePolicySnapshot,
    receipt: receiptInboxItem,
    version: documentVersion,
    document: managedDocument,
    scan: documentScanJob,
    employee,
  }).from(expensePosting)
    .innerJoin(expenseClaim, and(
      eq(expenseClaim.masterFn, scope.masterFn),
      eq(expenseClaim.companyFn, scope.companyFn),
      eq(expenseClaim.id, expensePosting.claimId),
    ))
    .innerJoin(expenseClaimLine, and(
      eq(expenseClaimLine.masterFn, scope.masterFn),
      eq(expenseClaimLine.companyFn, scope.companyFn),
      eq(expenseClaimLine.id, expensePosting.lineId),
    ))
    .innerJoin(expenseLinePolicySnapshot, and(
      eq(expenseLinePolicySnapshot.masterFn, scope.masterFn),
      eq(expenseLinePolicySnapshot.companyFn, scope.companyFn),
      eq(expenseLinePolicySnapshot.id, expensePosting.policySnapshotId),
    ))
    .leftJoin(employee, and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.userId, expenseClaim.ownerUserId),
    ))
    .leftJoin(receiptInboxItem, and(
      eq(receiptInboxItem.masterFn, scope.masterFn),
      eq(receiptInboxItem.companyFn, scope.companyFn),
      eq(receiptInboxItem.id, expenseClaimLine.receiptInboxItemId),
    ))
    .leftJoin(documentVersion, and(
      eq(documentVersion.masterFn, scope.masterFn),
      eq(documentVersion.companyFn, scope.companyFn),
      eq(documentVersion.id, receiptInboxItem.versionId),
    ))
    .leftJoin(managedDocument, and(
      eq(managedDocument.masterFn, scope.masterFn),
      eq(managedDocument.companyFn, scope.companyFn),
      eq(managedDocument.id, documentVersion.documentId),
    ))
    .leftJoin(documentScanJob, and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, documentVersion.id),
    ))
    .where(and(
      eq(expensePosting.masterFn, scope.masterFn),
      eq(expensePosting.companyFn, scope.companyFn),
      sql`${expensePosting.postingDate} >= ${filters.startDate}`,
      sql`${expensePosting.postingDate} <= ${filters.endDate}`,
      filters.employeeIds.length
        ? inArray(employee.id, filters.employeeIds)
        : undefined,
      filters.categoryCodes.length
        ? inArray(expenseClaimLine.categoryCode, filters.categoryCodes)
        : undefined,
      filters.taxStates.length
        ? inArray(expenseLinePolicySnapshot.taxTreatment, filters.taxStates)
        : undefined,
      filters.currencyCodes.length
        ? inArray(expenseClaimLine.originalCurrency, filters.currencyCodes)
        : undefined,
      filters.paperCustodyStatuses.length
        ? inArray(managedDocument.paperCustodyStatus, filters.paperCustodyStatuses)
        : undefined,
    ))
    .orderBy(asc(expensePosting.postingDate), asc(expensePosting.id))
    .limit(5001);
  if (candidates.length > 5000) {
    throw new TaxEvidenceError(
      'tax_evidence_snapshot_too_large',
      'Narrow the filters to at most 5,000 posted expense lines.',
    );
  }
  const lineIds = candidates.map((row) => row.line.id);
  const allocations = lineIds.length
    ? await tx.select().from(expenseAllocation).where(and(
        eq(expenseAllocation.masterFn, scope.masterFn),
        eq(expenseAllocation.companyFn, scope.companyFn),
        inArray(expenseAllocation.lineId, lineIds),
      )).orderBy(asc(expenseAllocation.lineId), asc(expenseAllocation.allocationNo))
    : [];
  const projects = new Map<number, string[]>();
  for (const allocation of allocations) {
    if (allocation.dimensionType !== 'project') continue;
    const values = projects.get(allocation.lineId) ?? [];
    values.push(allocation.dimensionKey);
    projects.set(allocation.lineId, values);
  }

  const extractionIds = [...new Set(candidates
    .map((row) => row.receipt?.extractionId)
    .filter((id): id is number => id != null))];
  const extractionFields = extractionIds.length
    ? await tx.select().from(documentExtractionField).where(and(
        eq(documentExtractionField.masterFn, scope.masterFn),
        eq(documentExtractionField.companyFn, scope.companyFn),
        inArray(documentExtractionField.extractionId, extractionIds),
      )).orderBy(
        asc(documentExtractionField.extractionId),
        asc(documentExtractionField.fieldKey),
        asc(documentExtractionField.candidateNo),
      )
    : [];
  const ocrFieldsByExtraction = new Map<number, TaxEvidenceOcrField[]>();
  for (const field of extractionFields) {
    const values = ocrFieldsByExtraction.get(field.extractionId) ?? [];
    values.push({
      fieldKey: field.fieldKey,
      value: field.valueText,
      normalizedValue: field.normalizedValue,
      confidence: field.confidence,
      reviewState: field.reviewState,
      model: field.model,
    });
    ocrFieldsByExtraction.set(field.extractionId, values);
  }

  const facts = candidates.map((row): TaxEvidenceLineFacts => {
    const projectKeys = [...new Set(projects.get(row.line.id) ?? [])].sort();
    const completeness: TaxEvidenceCompleteness = !row.version
      ? 'missing_receipt'
      : row.scan?.status === 'clean'
        && row.document
        && !['voided', 'draft'].includes(row.document.recordStatus)
        ? 'complete'
        : 'unverified_receipt';
    return {
      postingId: row.posting.id,
      postingDate: row.posting.postingDate,
      journalRef: row.posting.journalRef,
      claimId: row.claim.id,
      claimNo: row.claim.claimNo,
      claimVersion: row.posting.claimVersion,
      ownerUserId: row.claim.ownerUserId,
      employeeId: row.employee?.id ?? null,
      employeeNo: row.employee?.employeeNo ?? null,
      employeeName: row.employee?.fullName ?? null,
      employeeDepartment: row.employee?.department ?? null,
      lineId: row.line.id,
      lineNo: row.line.lineNo,
      merchant: row.line.merchant,
      merchantTaxNumber: row.line.merchantTaxNumber,
      transactionDate: row.line.transactionDate,
      purpose: row.line.purpose,
      categoryCode: row.line.categoryCode,
      projectKeys,
      paymentSource: row.posting.paymentSource,
      originalCurrency: row.line.originalCurrency,
      originalGross: new Decimal(row.line.originalGross).toFixed(2),
      functionalCurrency: row.posting.functionalCurrency,
      baseExpense: new Decimal(row.posting.baseExpense).toFixed(2),
      baseInputTax: new Decimal(row.posting.baseInputTax).toFixed(2),
      baseGross: new Decimal(row.posting.baseGross).toFixed(2),
      taxTreatment: row.policy.taxTreatment,
      taxCode: row.policy.taxCode,
      taxRate: row.policy.taxRate,
      inputTaxRecoverablePct: row.policy.inputTaxRecoverablePct,
      completeness,
      ocrMinConfidence: row.receipt
        ? (ocrFieldsByExtraction.get(row.receipt.extractionId) ?? [])
          .reduce<string | null>((lowest, field) => (
            lowest == null || new Decimal(field.confidence).lt(lowest)
              ? field.confidence
              : lowest
          ), null)
        : null,
      ocrReviewState: row.receipt
        ? (ocrFieldsByExtraction.get(row.receipt.extractionId) ?? [])
          .some((field) => field.reviewState !== 'accepted')
          ? 'review_required'
          : 'accepted'
        : null,
      ocrFields: row.receipt
        ? ocrFieldsByExtraction.get(row.receipt.extractionId) ?? []
        : [],
      evidenceDocumentId: row.document?.id ?? null,
      evidenceVersionId: row.version?.id ?? null,
      evidenceSha256: row.version?.sha256 ?? null,
      evidenceFileName: row.document?.originalFileName ?? null,
      paperCustodyStatus: row.document?.paperCustodyStatus ?? null,
      paperOriginalReference: row.document?.paperOriginalReference ?? null,
      retentionUntil: row.document?.retentionUntil.toISOString() ?? null,
      legalHold: row.document?.legalHold ?? false,
    };
  }).filter((row) =>
    (!filters.projectKeys.length
      || row.projectKeys.some((key) => filters.projectKeys.includes(key)))
    && (!filters.completeness.length
      || filters.completeness.includes(row.completeness)));
  if (!facts.length) {
    throw new TaxEvidenceError(
      'tax_evidence_snapshot_empty',
      'No posted expense evidence matches the selected filters.',
      404,
    );
  }
  const originalGross = facts.reduce(
    (total, row) => total.plus(row.originalGross),
    new Decimal(0),
  );
  const baseExpense = facts.reduce(
    (total, row) => total.plus(row.baseExpense),
    new Decimal(0),
  );
  const baseInputTax = facts.reduce(
    (total, row) => total.plus(row.baseInputTax),
    new Decimal(0),
  );
  const documentMap = new Map<number, {
    versionId: number;
    fileName: string;
    mimeType: string;
    sha256: string;
    sizeBytes: number;
    postingIds: number[];
  }>();
  for (const row of candidates) {
    if (!facts.some((fact) => fact.postingId === row.posting.id) || !row.version) continue;
    const current = documentMap.get(row.version.id);
    if (current) {
      current.postingIds.push(row.posting.id);
    } else {
      documentMap.set(row.version.id, {
        versionId: row.version.id,
        fileName: row.document!.originalFileName,
        mimeType: row.version.mimeType,
        sha256: row.version.sha256,
        sizeBytes: row.version.sizeBytes,
        postingIds: [row.posting.id],
      });
    }
  }
  const source = {
    filters,
    lines: facts,
    documents: [...documentMap.values()].map((row) => ({
      ...row,
      postingIds: [...new Set(row.postingIds)].sort((a, b) => a - b),
    })),
  };
  const sourceSha256 = sha256(JSON.stringify(source));
  const [snapshot] = await tx.insert(taxEvidenceSnapshot).values({
    ...scope,
    snapshotKey,
    filters,
    sourceSha256,
    rowCount: facts.length,
    documentCount: documentMap.size,
    originalGross: originalGross.toFixed(2),
    baseExpense: baseExpense.toFixed(2),
    baseInputTax: baseInputTax.toFixed(2),
    baseGross: baseExpense.plus(baseInputTax).toFixed(2),
    createdByUserId: actorUserId,
    createdAt: now,
  }).returning();
  const lines = await tx.insert(taxEvidenceSnapshotLine).values(
    facts.map((row, index) => ({
      ...scope,
      snapshotId: snapshot.id,
      ordinal: index + 1,
      postingId: row.postingId,
      facts: row,
      factsSha256: sha256(JSON.stringify(row)),
      createdAt: now,
    })),
  ).returning();
  if (documentMap.size) {
    await tx.insert(taxEvidenceSnapshotDocument).values(
      [...documentMap.values()].map((row) => ({
        ...scope,
        snapshotId: snapshot.id,
        documentVersionId: row.versionId,
        fileName: row.fileName,
        mimeType: row.mimeType,
        sha256: row.sha256,
        sizeBytes: row.sizeBytes,
        sourcePostingIds: [...new Set(row.postingIds)].sort((a, b) => a - b),
        createdAt: now,
      })),
    );
  }
  return { snapshot: projection(snapshot), lines, replayed: false };
}

function locale(value: string): 'en' | 'ms' | 'zh' | 'ja' | 'vi' {
  return ['en', 'ms', 'zh', 'ja', 'vi'].includes(value)
    ? value as 'en' | 'ms' | 'zh' | 'ja' | 'vi'
    : 'en';
}

export async function createTaxEvidenceReportJobWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  input: { jobKey: string; snapshotId: number; locale?: string },
  now = new Date(),
) {
  const jobKey = safeKey(input.jobKey, 'Job key');
  const normalizedLocale = locale(input.locale ?? 'en');
  const [existing] = await tx.select().from(taxEvidenceReportJob).where(and(
    eq(taxEvidenceReportJob.masterFn, scope.masterFn),
    eq(taxEvidenceReportJob.companyFn, scope.companyFn),
    eq(taxEvidenceReportJob.jobKey, jobKey),
  )).limit(1);
  if (existing) {
    if (
      existing.snapshotId !== input.snapshotId
      || existing.locale !== normalizedLocale
      || existing.actorUserId !== actorUserId
    ) {
      throw new TaxEvidenceError(
        'tax_evidence_job_key_conflict',
        'Job key already exists with different facts.',
        409,
      );
    }
    return { job: existing, replayed: true };
  }
  const [snapshot] = await tx.select({ id: taxEvidenceSnapshot.id })
    .from(taxEvidenceSnapshot).where(and(
      eq(taxEvidenceSnapshot.masterFn, scope.masterFn),
      eq(taxEvidenceSnapshot.companyFn, scope.companyFn),
      eq(taxEvidenceSnapshot.id, input.snapshotId),
    )).limit(1);
  if (!snapshot) {
    throw new TaxEvidenceError(
      'tax_evidence_snapshot_not_found',
      'Tax evidence snapshot is unavailable.',
      404,
    );
  }
  const [job] = await tx.insert(taxEvidenceReportJob).values({
    ...scope,
    jobKey,
    snapshotId: snapshot.id,
    actorUserId,
    locale: normalizedLocale,
    status: 'queued',
    availableAt: now,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return { job, replayed: false };
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const registerColumns: Array<keyof TaxEvidenceLineFacts> = [
  'postingId',
  'postingDate',
  'journalRef',
  'claimNo',
  'ownerUserId',
  'employeeId',
  'employeeNo',
  'employeeName',
  'employeeDepartment',
  'lineNo',
  'merchant',
  'merchantTaxNumber',
  'transactionDate',
  'categoryCode',
  'projectKeys',
  'paymentSource',
  'originalCurrency',
  'originalGross',
  'functionalCurrency',
  'baseExpense',
  'baseInputTax',
  'baseGross',
  'taxTreatment',
  'taxCode',
  'taxRate',
  'inputTaxRecoverablePct',
  'completeness',
  'ocrMinConfidence',
  'ocrReviewState',
  'paperCustodyStatus',
  'paperOriginalReference',
  'retentionUntil',
  'legalHold',
  'evidenceDocumentId',
  'evidenceVersionId',
  'evidenceSha256',
  'evidenceFileName',
];

function renderRegisterCsv(lines: TaxEvidenceLineFacts[]): Buffer {
  return Buffer.from([
    registerColumns.join(','),
    ...lines.map((row) =>
      registerColumns.map((column) => csvCell(row[column])).join(',')),
    '',
  ].join('\r\n'), 'utf8');
}

async function renderRegisterXlsx(
  snapshot: typeof taxEvidenceSnapshot.$inferSelect,
  lines: TaxEvidenceLineFacts[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Aria ERP';
  workbook.created = snapshot.createdAt;
  workbook.modified = snapshot.createdAt;
  workbook.lastPrinted = snapshot.createdAt;
  const sheet = workbook.addWorksheet('Tax Evidence Register', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });
  sheet.addRow(['Tax Evidence Register']);
  sheet.mergeCells(1, 1, 1, registerColumns.length);
  sheet.getCell(1, 1).font = { bold: true, size: 18 };
  sheet.addRow([
    `Snapshot ${snapshot.id}`,
    `SHA-256 ${snapshot.sourceSha256}`,
    `Rows ${snapshot.rowCount}`,
    `Documents ${snapshot.documentCount}`,
    `Base gross ${snapshot.baseGross}`,
  ]);
  sheet.addRow([]);
  sheet.addRow(registerColumns);
  sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(4).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B74E5' },
  };
  for (const line of lines) {
    sheet.addRow(registerColumns.map((column) => {
      const value = line[column];
      return Array.isArray(value) ? value.join(', ') : value;
    }));
  }
  sheet.columns.forEach((column, index) => {
    column.width = Math.min(
      45,
      Math.max(12, index === 5 || index === 7 ? 24 : String(registerColumns[index]).length + 3),
    );
  });
  for (const key of ['originalGross', 'baseExpense', 'baseInputTax', 'baseGross']) {
    const index = registerColumns.indexOf(key as keyof TaxEvidenceLineFacts) + 1;
    sheet.getColumn(index).numFmt = '#,##0.00;[Red](#,##0.00);–';
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function renderRegisterPdf(
  snapshot: typeof taxEvidenceSnapshot.$inferSelect,
  lines: TaxEvidenceLineFacts[],
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Tax Evidence Register');
  pdf.setAuthor('Aria ERP');
  pdf.setSubject(`Snapshot ${snapshot.id} ${snapshot.sourceSha256}`);
  pdf.setCreationDate(snapshot.createdAt);
  pdf.setModificationDate(snapshot.createdAt);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([842, 595]);
  let y = 560;
  const heading = () => {
    page.drawText('Tax Evidence Register', {
      x: 32, y, size: 18, font: bold, color: rgb(0.04, 0.29, 0.62),
    });
    y -= 20;
    page.drawText(
      `Snapshot ${snapshot.id} | Rows ${snapshot.rowCount} | Documents ${snapshot.documentCount}`
      + ` | Base gross ${snapshot.baseGross}`,
      { x: 32, y, size: 8, font },
    );
    y -= 14;
    page.drawText(`Source SHA-256 ${snapshot.sourceSha256}`, {
      x: 32, y, size: 7, font,
    });
    y -= 20;
  };
  heading();
  for (const line of lines) {
    if (y < 54) {
      page = pdf.addPage([842, 595]);
      y = 560;
      heading();
    }
    const employeeLabel = line.employeeName
      ? `${line.employeeName}${line.employeeNo ? ` (${line.employeeNo})` : ''}`
      : `User ${line.ownerUserId}`;
    const left = `${line.postingDate} | ${employeeLabel} | ${line.claimNo}/${line.lineNo} | ${line.merchant}`;
    const right = `${line.categoryCode} | ${line.taxTreatment} | ${line.baseGross} ${line.functionalCurrency}`;
    page.drawText(left.slice(0, 92), { x: 32, y, size: 8, font: bold });
    page.drawText(right.slice(0, 74), { x: 455, y, size: 8, font });
    y -= 11;
    page.drawText(
      `${line.completeness} | evidence ${line.evidenceSha256 ?? 'none'}`
        .slice(0, 145),
      { x: 32, y, size: 7, font, color: rgb(0.35, 0.39, 0.45) },
    );
    y -= 14;
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function safeZipName(value: string, index: number): string {
  const cleaned = value.replaceAll('\\', '_').replaceAll('/', '_')
    .replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 180);
  return `${String(index + 1).padStart(4, '0')}-${cleaned || 'evidence.bin'}`;
}

/** Minimal deterministic ZIP writer using the store method. */
function renderOriginalsZip(
  documents: Array<{ fileName: string; content: Uint8Array }>,
): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  documents.forEach((document, index) => {
    const name = Buffer.from(safeZipName(document.fileName, index), 'utf8');
    const content = Buffer.from(document.content);
    const crc = crc32(content);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    locals.push(local, content);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + content.length;
  });
  const centralOffset = offset;
  const centralSize = centrals.reduce((total, row) => total + row.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(documents.length, 8);
  end.writeUInt16LE(documents.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

async function readSnapshotForRender(
  tx: DB,
  scope: Scope,
  snapshotId: number,
  registry: DocumentStorageRegistry,
) {
  const [snapshot] = await tx.select().from(taxEvidenceSnapshot).where(and(
    eq(taxEvidenceSnapshot.masterFn, scope.masterFn),
    eq(taxEvidenceSnapshot.companyFn, scope.companyFn),
    eq(taxEvidenceSnapshot.id, snapshotId),
  )).limit(1);
  if (!snapshot) throw new Error('Tax evidence snapshot is unavailable.');
  const storedLines = await tx.select().from(taxEvidenceSnapshotLine).where(and(
    eq(taxEvidenceSnapshotLine.masterFn, scope.masterFn),
    eq(taxEvidenceSnapshotLine.companyFn, scope.companyFn),
    eq(taxEvidenceSnapshotLine.snapshotId, snapshot.id),
  )).orderBy(asc(taxEvidenceSnapshotLine.ordinal));
  const storedDocuments = await tx.select({
    frozen: taxEvidenceSnapshotDocument,
    version: documentVersion,
  }).from(taxEvidenceSnapshotDocument).innerJoin(documentVersion, and(
    eq(documentVersion.masterFn, scope.masterFn),
    eq(documentVersion.companyFn, scope.companyFn),
    eq(documentVersion.id, taxEvidenceSnapshotDocument.documentVersionId),
  )).where(and(
    eq(taxEvidenceSnapshotDocument.masterFn, scope.masterFn),
    eq(taxEvidenceSnapshotDocument.companyFn, scope.companyFn),
    eq(taxEvidenceSnapshotDocument.snapshotId, snapshot.id),
  )).orderBy(asc(taxEvidenceSnapshotDocument.id));
  const documents = [];
  for (const row of storedDocuments) {
    const content = await registry.get(
      row.version.storageBackend as DocumentStorageBackend,
    ).readWithin(
      tx,
      scope,
      row.version as StoredDocumentVersion,
    );
    if (
      sha256(content) !== row.frozen.sha256
      || content.byteLength !== row.frozen.sizeBytes
    ) {
      throw new Error('Frozen evidence content failed integrity verification.');
    }
    documents.push({
      fileName: row.frozen.fileName,
      mimeType: row.frozen.mimeType,
      sha256: row.frozen.sha256,
      content,
    });
  }
  return {
    snapshot,
    lines: storedLines.map((row) => row.facts as TaxEvidenceLineFacts),
    documents,
  };
}

interface RenderedArtifact {
  artifactType: ArtifactType;
  fileName: string;
  mimeType: string;
  content: Buffer;
  sha256: string;
}

async function renderArtifactSet(
  snapshot: typeof taxEvidenceSnapshot.$inferSelect,
  lines: TaxEvidenceLineFacts[],
  documents: Array<{
    fileName: string;
    mimeType: string;
    sha256: string;
    content: Uint8Array;
  }>,
): Promise<RenderedArtifact[]> {
  const stem = `tax-evidence-${snapshot.id}`;
  const initial: Omit<RenderedArtifact, 'sha256'>[] = [
    {
      artifactType: 'register_pdf',
      fileName: `${stem}-register.pdf`,
      mimeType: 'application/pdf',
      content: await renderRegisterPdf(snapshot, lines),
    },
    {
      artifactType: 'merged_pdf',
      fileName: `${stem}-evidence.pdf`,
      mimeType: 'application/pdf',
      content: Buffer.from(await renderEvidencePdf({
        title: 'Merged Tax Evidence',
        createdAt: snapshot.createdAt,
        emptyMessage: 'No original evidence matched this snapshot.',
      }, documents)),
    },
    {
      artifactType: 'register_xlsx',
      fileName: `${stem}-register.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: await renderRegisterXlsx(snapshot, lines),
    },
    {
      artifactType: 'register_csv',
      fileName: `${stem}-register.csv`,
      mimeType: 'text/csv',
      content: renderRegisterCsv(lines),
    },
    {
      artifactType: 'originals_zip',
      fileName: `${stem}-originals.zip`,
      mimeType: 'application/zip',
      content: renderOriginalsZip(documents),
    },
  ];
  const rendered = initial.map((artifact) => ({
    ...artifact,
    sha256: sha256(artifact.content),
  }));
  const manifestContent = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    snapshot: projection(snapshot),
    lineFacts: lines.map((row) => ({
      postingId: row.postingId,
      sha256: sha256(JSON.stringify(row)),
    })),
    sourceDocuments: documents.map((row) => ({
      fileName: row.fileName,
      mimeType: row.mimeType,
      sha256: row.sha256,
      sizeBytes: row.content.byteLength,
    })),
    artifacts: rendered.map((row) => ({
      artifactType: row.artifactType,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sha256: row.sha256,
      sizeBytes: row.content.byteLength,
    })),
  }, null, 2), 'utf8');
  rendered.push({
    artifactType: 'manifest_json',
    fileName: `${stem}-manifest.json`,
    mimeType: 'application/json',
    content: manifestContent,
    sha256: sha256(manifestContent),
  });
  return rendered;
}

async function claimTaxEvidenceJobs(
  db: DB,
  workerId: string,
  batchSize: number,
  now: Date,
  leaseMs: number,
) {
  const expiredLease = new Date(now.getTime() - leaseMs);
  return withReportingWorkerTransaction(db, async (tx) => {
    const rows = await tx.select().from(taxEvidenceReportJob).where(and(
      inArray(taxEvidenceReportJob.status, ['queued', 'running']),
      lte(taxEvidenceReportJob.availableAt, now),
      lt(taxEvidenceReportJob.attempts, 3),
      or(
        eq(taxEvidenceReportJob.status, 'queued'),
        and(
          eq(taxEvidenceReportJob.status, 'running'),
          or(
            isNull(taxEvidenceReportJob.lockedAt),
            lt(taxEvidenceReportJob.lockedAt, expiredLease),
          ),
        ),
      ),
    )).orderBy(asc(taxEvidenceReportJob.id))
      .limit(batchSize)
      .for('update', { skipLocked: true });
    if (!rows.length) return rows;
    await tx.update(taxEvidenceReportJob).set({
      status: 'running',
      lockedAt: now,
      lockedBy: workerId,
      attempts: sql`${taxEvidenceReportJob.attempts} + 1`,
      updatedAt: now,
    }).where(inArray(taxEvidenceReportJob.id, rows.map((row) => row.id)));
    return rows;
  });
}

export async function processTaxEvidenceJobBatch(
  db: DB,
  options: {
    workerId?: string;
    batchSize?: number;
    leaseMs?: number;
    now?: Date;
    storageRegistry?: DocumentStorageRegistry;
  } = {},
) {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `tax-evidence-${randomUUID()}`;
  const registry = options.storageRegistry ?? createDocumentStorageRegistry();
  const rows = await claimTaxEvidenceJobs(
    db,
    workerId,
    Math.min(Math.max(options.batchSize ?? 2, 1), 5),
    now,
    options.leaseMs ?? 10 * 60 * 1000,
  );
  let succeeded = 0;
  let failed = 0;
  for (const row of rows) {
    const scope = { masterFn: row.masterFn, companyFn: row.companyFn };
    try {
      const source = await withTenantTransaction(db, scope, (tx) =>
        readSnapshotForRender(tx, scope, row.snapshotId, registry));
      const artifacts = await renderArtifactSet(
        source.snapshot,
        source.lines,
        source.documents,
      );
      const artifactSetSha256 = sha256(artifacts
        .map((artifact) => `${artifact.artifactType}:${artifact.sha256}`)
        .join('\n'));
      await withTenantTransaction(db, scope, async (tx) => {
        await tx.insert(taxEvidenceArtifact).values(artifacts.map((artifact) => ({
          ...scope,
          jobId: row.id,
          snapshotId: row.snapshotId,
          artifactType: artifact.artifactType,
          fileName: artifact.fileName,
          mimeType: artifact.mimeType,
          sha256: artifact.sha256,
          sizeBytes: artifact.content.byteLength,
          content: artifact.content,
          createdAt: now,
        })));
        await tx.update(taxEvidenceReportJob).set({
          status: 'succeeded',
          completedAt: now,
          artifactSetSha256,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          updatedAt: now,
        }).where(and(
          eq(taxEvidenceReportJob.id, row.id),
          eq(taxEvidenceReportJob.lockedBy, workerId),
        ));
      });
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const finalAttempt = row.attempts + 1 >= 3;
      await withTenantTransaction(db, scope, (tx) =>
        tx.update(taxEvidenceReportJob).set({
          status: finalAttempt ? 'failed' : 'queued',
          availableAt: new Date(
            now.getTime() + Math.min(60_000, 2 ** row.attempts * 1_000),
          ),
          lockedAt: null,
          lockedBy: null,
          lastError: message.slice(0, 1_000),
          completedAt: finalAttempt ? now : null,
          updatedAt: now,
        }).where(and(
          eq(taxEvidenceReportJob.id, row.id),
          eq(taxEvidenceReportJob.lockedBy, workerId),
        )));
      failed += 1;
    }
  }
  return { claimed: rows.length, succeeded, failed };
}

export async function readTaxEvidenceJobWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  jobId: number,
) {
  const [job] = await tx.select().from(taxEvidenceReportJob).where(and(
    eq(taxEvidenceReportJob.masterFn, scope.masterFn),
    eq(taxEvidenceReportJob.companyFn, scope.companyFn),
    eq(taxEvidenceReportJob.id, jobId),
    eq(taxEvidenceReportJob.actorUserId, actorUserId),
  )).limit(1);
  if (!job) {
    throw new TaxEvidenceError(
      'tax_evidence_job_not_found',
      'Tax evidence report job is unavailable.',
      404,
    );
  }
  const artifacts = await tx.select({
    id: taxEvidenceArtifact.id,
    artifactType: taxEvidenceArtifact.artifactType,
    fileName: taxEvidenceArtifact.fileName,
    mimeType: taxEvidenceArtifact.mimeType,
    sha256: taxEvidenceArtifact.sha256,
    sizeBytes: taxEvidenceArtifact.sizeBytes,
    createdAt: taxEvidenceArtifact.createdAt,
  }).from(taxEvidenceArtifact).where(and(
    eq(taxEvidenceArtifact.masterFn, scope.masterFn),
    eq(taxEvidenceArtifact.companyFn, scope.companyFn),
    eq(taxEvidenceArtifact.jobId, job.id),
  )).orderBy(asc(taxEvidenceArtifact.artifactType));
  return { job, artifacts };
}

export async function accessTaxEvidenceArtifactWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  artifactId: number,
  input: {
    accessKey: string;
    action: TaxEvidenceAction;
    purpose: string;
  },
  now = new Date(),
) {
  const accessKey = safeKey(input.accessKey, 'Access key');
  const purpose = input.purpose?.trim() ?? '';
  if (purpose.length < 3 || purpose.length > 500) {
    throw new TaxEvidenceError(
      'tax_evidence_invalid',
      'Access purpose must contain 3–500 characters.',
    );
  }
  if (!['view', 'download', 'print', 'export'].includes(input.action)) {
    throw new TaxEvidenceError(
      'tax_evidence_invalid',
      'Access action must be view, download, print or export.',
    );
  }
  const [artifact] = await tx.select().from(taxEvidenceArtifact)
    .innerJoin(taxEvidenceReportJob, and(
      eq(taxEvidenceReportJob.masterFn, scope.masterFn),
      eq(taxEvidenceReportJob.companyFn, scope.companyFn),
      eq(taxEvidenceReportJob.id, taxEvidenceArtifact.jobId),
      eq(taxEvidenceReportJob.status, 'succeeded'),
    )).where(and(
      eq(taxEvidenceArtifact.masterFn, scope.masterFn),
      eq(taxEvidenceArtifact.companyFn, scope.companyFn),
      eq(taxEvidenceArtifact.id, artifactId),
    )).limit(1);
  if (!artifact) {
    throw new TaxEvidenceError(
      'tax_evidence_artifact_not_found',
      'Tax evidence artifact is unavailable.',
      404,
    );
  }
  const row = artifact.tax_evidence_artifact;
  const content = Buffer.from(row.content);
  if (content.byteLength !== row.sizeBytes || sha256(content) !== row.sha256) {
    throw new TaxEvidenceError(
      'tax_evidence_artifact_integrity_failed',
      'Tax evidence artifact failed SHA-256 verification.',
      503,
    );
  }
  const [existing] = await tx.select().from(taxEvidenceAccessEvent).where(and(
    eq(taxEvidenceAccessEvent.masterFn, scope.masterFn),
    eq(taxEvidenceAccessEvent.companyFn, scope.companyFn),
    eq(taxEvidenceAccessEvent.artifactId, row.id),
    eq(taxEvidenceAccessEvent.actorUserId, actorUserId),
    eq(taxEvidenceAccessEvent.accessKey, accessKey),
  )).limit(1);
  if (existing && (
    existing.action !== input.action
    || existing.purpose !== purpose
    || existing.artifactSha256 !== row.sha256
  )) {
    throw new TaxEvidenceError(
      'tax_evidence_access_key_conflict',
      'Access key is already used for a different sensitive action.',
      409,
    );
  }
  if (!existing) {
    await tx.insert(taxEvidenceAccessEvent).values({
      ...scope,
      artifactId: row.id,
      actorUserId,
      accessKey,
      action: input.action,
      purpose,
      artifactSha256: row.sha256,
      occurredAt: now,
    });
  }
  return {
    artifact: {
      id: row.id,
      artifactType: row.artifactType,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sha256: row.sha256,
      sizeBytes: row.sizeBytes,
    },
    content,
    replayedAccess: Boolean(existing),
  };
}
