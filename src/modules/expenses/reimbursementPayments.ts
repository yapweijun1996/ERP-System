import Decimal from 'decimal.js';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  or,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  account,
  accountingPeriod,
  glEntry,
  reimbursementBankExport,
  reimbursementBankExportAccessEvent,
  reimbursementBankExportLine,
  reimbursementBankLineResult,
  reimbursementBankResultImport,
  reimbursementBankTemplateVersion,
  reimbursementPaymentBatch,
  reimbursementPaymentBatchLine,
  reimbursementSettlement,
} from '../../data/schema';
import type {
  EncryptedPayoutEnvelope,
  PayoutDetails,
} from './payoutProfiles';

const BANK_FIELDS = [
  'batch_no',
  'line_no',
  'claim_no',
  'employee_id',
  'account_holder_name',
  'account_number',
  'bank_code',
  'bank_name',
  'swift_bic',
  'currency',
  'amount',
] as const;

type BankField = typeof BANK_FIELDS[number];

export interface BankTemplateInput {
  templateKey: string;
  versionNo: number;
  validFrom: string;
  validTo?: string | null;
  name: string;
  bankCode: string;
  delimiter?: ',' | '\t' | ';';
  includeHeader?: boolean;
  fieldOrder: string[];
}

export interface BankExportInput {
  exportKey: string;
  batchId: number;
  templateKey: string;
  exportDate: string;
  retryOfExportId?: number | null;
}

export interface BankResultInput {
  exportLineNo: number;
  outcome: 'success' | 'failed';
  bankLineReference: string;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface BankResultImportInput {
  importKey: string;
  exportId: number;
  bankReference: string;
  paymentDate: string;
  results: BankResultInput[];
}

export interface ReimbursementPaymentCrypto {
  encrypt(plaintext: string): EncryptedPayoutEnvelope | Promise<EncryptedPayoutEnvelope>;
  decrypt(envelope: EncryptedPayoutEnvelope): string | Promise<string>;
  hash(value: string): string | Promise<string>;
}

export class ReimbursementPaymentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ReimbursementPaymentError';
  }
}

function text(
  value: string | null | undefined,
  key: string,
  label: string,
  min: number,
  max: number,
): string {
  const result = value?.trim() ?? '';
  if (result.length < min || result.length > max) {
    throw new ReimbursementPaymentError(
      'reimbursement_payment_invalid',
      `${label} must contain ${min}–${max} characters.`,
      422,
      { [key]: `${label} must contain ${min}–${max} characters.` },
    );
  }
  return result;
}

function dateValue(value: string, key: string, label: string): string {
  const result = value.trim();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result)
    || new Date(`${result}T00:00:00.000Z`).toISOString().slice(0, 10) !== result
  ) {
    throw new ReimbursementPaymentError(
      'reimbursement_payment_invalid',
      `${label} must be a valid ISO date.`,
      422,
      { [key]: `Use YYYY-MM-DD for ${label.toLowerCase()}.` },
    );
  }
  return result;
}

function safeKey(value: string, key: string, label: string): string {
  const result = text(value, key, label, 8, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(result)) {
    throw new ReimbursementPaymentError(
      'reimbursement_payment_invalid',
      `${label} contains unsupported characters.`,
      422,
      { [key]: 'Use letters, digits, dots, underscores, colons or hyphens.' },
    );
  }
  return result;
}

function templateFields(values: string[]): BankField[] {
  const result = values.map((value) => value.trim()) as BankField[];
  if (
    result.length < 4
    || result.length > BANK_FIELDS.length
    || new Set(result).size !== result.length
    || result.some((field) => !BANK_FIELDS.includes(field))
    || !['account_holder_name', 'account_number', 'currency', 'amount']
      .every((required) => result.includes(required as BankField))
  ) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_template_fields_invalid',
      'Bank field order must be unique, supported and include holder, account, currency and amount.',
      422,
    );
  }
  return result;
}

function envelope(value: unknown): EncryptedPayoutEnvelope {
  const candidate = value as EncryptedPayoutEnvelope;
  if (
    candidate?.v !== 1
    || candidate.alg !== 'A256GCM'
    || !candidate.iv
    || !candidate.ciphertext
    || !candidate.tag
  ) {
    throw new ReimbursementPaymentError(
      'reimbursement_payment_encryption_failed',
      'The bank artifact could not be encrypted or decrypted.',
      503,
    );
  }
  return candidate;
}

function exportProjection(row: typeof reimbursementBankExport.$inferSelect) {
  return {
    id: row.id,
    exportKey: row.exportKey,
    batchId: row.batchId,
    templateVersionId: row.templateVersionId,
    exportVersion: row.exportVersion,
    retryOfExportId: row.retryOfExportId,
    artifactFileName: row.artifactFileName,
    contentSha256: row.contentSha256,
    rowCount: row.rowCount,
    totalAmount: row.totalAmount,
    generatedByUserId: row.generatedByUserId,
    generatedAt: row.generatedAt,
  };
}

function settlementProjection(row: typeof reimbursementSettlement.$inferSelect) {
  return {
    id: row.id,
    batchLineId: row.batchLineId,
    resultLineId: row.resultLineId,
    resultImportId: row.resultImportId,
    accountingPeriodId: row.accountingPeriodId,
    bankReference: row.bankReference,
    paymentDate: row.paymentDate,
    currency: row.currency,
    amount: row.amount,
    payableAccountId: row.payableAccountId,
    bankAccountId: row.bankAccountId,
    journalRef: row.journalRef,
    debitGlEntryId: row.debitGlEntryId,
    creditGlEntryId: row.creditGlEntryId,
    factsSha256: row.factsSha256,
    postedByUserId: row.postedByUserId,
    postedAt: row.postedAt,
  };
}

export async function configureReimbursementBankTemplateWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  input: BankTemplateInput,
  now = new Date(),
) {
  const templateKey = text(input.templateKey, 'templateKey', 'Template key', 3, 64);
  if (!/^[a-z][a-z0-9._-]{2,63}$/.test(templateKey)) {
    throw new ReimbursementPaymentError(
      'reimbursement_payment_invalid',
      'Template key must use lowercase letters, digits, dots, underscores or hyphens.',
      422,
    );
  }
  if (!Number.isSafeInteger(input.versionNo) || input.versionNo <= 0) {
    throw new ReimbursementPaymentError(
      'reimbursement_payment_invalid',
      'Template version must be a positive integer.',
      422,
    );
  }
  const validFrom = dateValue(input.validFrom, 'validFrom', 'Valid from');
  const validTo = input.validTo ? dateValue(input.validTo, 'validTo', 'Valid to') : null;
  if (validTo && validTo < validFrom) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_template_dates_invalid',
      'Template valid-to date must not precede valid-from.',
      422,
    );
  }
  const fields = templateFields(input.fieldOrder);
  const [existing] = await tx.select().from(reimbursementBankTemplateVersion).where(and(
    eq(reimbursementBankTemplateVersion.masterFn, scope.masterFn),
    eq(reimbursementBankTemplateVersion.companyFn, scope.companyFn),
    eq(reimbursementBankTemplateVersion.templateKey, templateKey),
    eq(reimbursementBankTemplateVersion.versionNo, input.versionNo),
  )).limit(1);
  if (existing) {
    const same = existing.validFrom === validFrom
      && existing.validTo === validTo
      && existing.name === input.name.trim()
      && existing.bankCode === input.bankCode.trim().toUpperCase()
      && existing.delimiter === (input.delimiter ?? ',')
      && existing.includeHeader === (input.includeHeader ?? true)
      && JSON.stringify(existing.fieldOrder) === JSON.stringify(fields);
    if (!same) {
      throw new ReimbursementPaymentError(
        'reimbursement_bank_template_version_conflict',
        'Template version already exists with different facts.',
      );
    }
    return { template: existing, replayed: true };
  }
  const overlaps = await tx.select({ id: reimbursementBankTemplateVersion.id })
    .from(reimbursementBankTemplateVersion).where(and(
      eq(reimbursementBankTemplateVersion.masterFn, scope.masterFn),
      eq(reimbursementBankTemplateVersion.companyFn, scope.companyFn),
      eq(reimbursementBankTemplateVersion.templateKey, templateKey),
      eq(reimbursementBankTemplateVersion.status, 'confirmed'),
      lte(reimbursementBankTemplateVersion.validFrom, validTo ?? '9999-12-31'),
      or(
        isNull(reimbursementBankTemplateVersion.validTo),
        gte(reimbursementBankTemplateVersion.validTo, validFrom),
      ),
    )).limit(1);
  if (overlaps.length) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_template_overlap',
      'Confirmed template effective periods cannot overlap.',
      422,
    );
  }
  const [template] = await tx.insert(reimbursementBankTemplateVersion).values({
    ...scope,
    templateKey,
    versionNo: input.versionNo,
    validFrom,
    validTo,
    name: text(input.name, 'name', 'Template name', 3, 160),
    bankCode: text(input.bankCode, 'bankCode', 'Bank code', 2, 20).toUpperCase(),
    fileFormat: 'csv',
    delimiter: input.delimiter ?? ',',
    includeHeader: input.includeHeader ?? true,
    fieldOrder: fields,
    status: 'confirmed',
    confirmedByUserId: actorUserId,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return { template, replayed: false };
}

function csvCell(value: string, delimiter: string): string {
  return value.includes('"') || value.includes('\n') || value.includes('\r') || value.includes(delimiter)
    ? `"${value.replaceAll('"', '""')}"`
    : value;
}

function bankValue(
  field: BankField,
  batch: typeof reimbursementPaymentBatch.$inferSelect,
  line: typeof reimbursementPaymentBatchLine.$inferSelect,
  details: PayoutDetails,
): string {
  const values: Record<BankField, string> = {
    batch_no: batch.batchNo,
    line_no: String(line.lineNo),
    claim_no: line.claimNo,
    employee_id: String(line.employeeId),
    account_holder_name: details.accountHolderName,
    account_number: details.accountNumber,
    bank_code: details.bankCode,
    bank_name: details.bankName,
    swift_bic: details.swiftBic ?? '',
    currency: line.currency,
    amount: new Decimal(line.amount).toFixed(2),
  };
  return values[field];
}

async function exportLinesForAttempt(
  tx: DB,
  scope: Scope,
  batch: typeof reimbursementPaymentBatch.$inferSelect,
  retryOfExportId: number | null,
) {
  const batchLines = await tx.select().from(reimbursementPaymentBatchLine).where(and(
    eq(reimbursementPaymentBatchLine.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatchLine.companyFn, scope.companyFn),
    eq(reimbursementPaymentBatchLine.batchId, batch.id),
  )).orderBy(asc(reimbursementPaymentBatchLine.lineNo));
  if (!retryOfExportId) {
    const existing = await tx.select({ id: reimbursementBankExport.id })
      .from(reimbursementBankExport).where(and(
        eq(reimbursementBankExport.masterFn, scope.masterFn),
        eq(reimbursementBankExport.companyFn, scope.companyFn),
        eq(reimbursementBankExport.batchId, batch.id),
      )).limit(1);
    if (existing.length) {
      throw new ReimbursementPaymentError(
        'reimbursement_bank_initial_export_exists',
        'A released batch already has an initial export; retry only failed lines.',
      );
    }
    return batchLines;
  }
  const [retryOf] = await tx.select().from(reimbursementBankExport).where(and(
    eq(reimbursementBankExport.masterFn, scope.masterFn),
    eq(reimbursementBankExport.companyFn, scope.companyFn),
    eq(reimbursementBankExport.id, retryOfExportId),
    eq(reimbursementBankExport.batchId, batch.id),
  )).limit(1);
  if (!retryOf) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_retry_export_invalid',
      'Retry export must reference an earlier export for this batch.',
      422,
    );
  }
  const priorLines = await tx.select({
    exportLine: reimbursementBankExportLine,
    result: reimbursementBankLineResult,
  }).from(reimbursementBankExportLine).innerJoin(
    reimbursementBankLineResult,
    and(
      eq(reimbursementBankLineResult.masterFn, scope.masterFn),
      eq(reimbursementBankLineResult.companyFn, scope.companyFn),
      eq(reimbursementBankLineResult.exportLineId, reimbursementBankExportLine.id),
    ),
  ).where(and(
    eq(reimbursementBankExportLine.masterFn, scope.masterFn),
    eq(reimbursementBankExportLine.companyFn, scope.companyFn),
    eq(reimbursementBankExportLine.exportId, retryOf.id),
    eq(reimbursementBankLineResult.outcome, 'failed'),
  ));
  if (!priorLines.length) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_retry_export_empty',
      'Only failed bank lines can be retried.',
      422,
    );
  }
  const failedBatchLineIds = priorLines.map((row) => row.exportLine.batchLineId);
  const laterAttempts = await tx.select({
    batchLineId: reimbursementBankExportLine.batchLineId,
  }).from(reimbursementBankExportLine).innerJoin(
    reimbursementBankExport,
    and(
      eq(reimbursementBankExport.masterFn, scope.masterFn),
      eq(reimbursementBankExport.companyFn, scope.companyFn),
      eq(reimbursementBankExport.id, reimbursementBankExportLine.exportId),
      gt(reimbursementBankExport.exportVersion, retryOf.exportVersion),
    ),
  ).where(and(
    eq(reimbursementBankExportLine.masterFn, scope.masterFn),
    eq(reimbursementBankExportLine.companyFn, scope.companyFn),
    inArray(reimbursementBankExportLine.batchLineId, failedBatchLineIds),
  ));
  if (laterAttempts.length) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_retry_export_stale',
      'Retry the latest failed attempt; a later export already exists.',
    );
  }
  const settlements = await tx.select({
    batchLineId: reimbursementSettlement.batchLineId,
  }).from(reimbursementSettlement).where(and(
    eq(reimbursementSettlement.masterFn, scope.masterFn),
    eq(reimbursementSettlement.companyFn, scope.companyFn),
    inArray(reimbursementSettlement.batchLineId, failedBatchLineIds),
  ));
  const settled = new Set(settlements.map((row) => row.batchLineId));
  return batchLines.filter((line) =>
    failedBatchLineIds.includes(line.id) && !settled.has(line.id));
}

export async function generateReimbursementBankExportWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  input: BankExportInput,
  crypto: ReimbursementPaymentCrypto,
  now = new Date(),
) {
  const exportKey = safeKey(input.exportKey, 'exportKey', 'Export key');
  const exportDate = dateValue(input.exportDate, 'exportDate', 'Export date');
  const [existing] = await tx.select().from(reimbursementBankExport).where(and(
    eq(reimbursementBankExport.masterFn, scope.masterFn),
    eq(reimbursementBankExport.companyFn, scope.companyFn),
    eq(reimbursementBankExport.exportKey, exportKey),
  )).limit(1);
  if (existing) {
    const [existingTemplate] = await tx.select({
      templateKey: reimbursementBankTemplateVersion.templateKey,
      validFrom: reimbursementBankTemplateVersion.validFrom,
      validTo: reimbursementBankTemplateVersion.validTo,
    }).from(reimbursementBankTemplateVersion).where(and(
      eq(reimbursementBankTemplateVersion.masterFn, scope.masterFn),
      eq(reimbursementBankTemplateVersion.companyFn, scope.companyFn),
      eq(reimbursementBankTemplateVersion.id, existing.templateVersionId),
    )).limit(1);
    if (existing.batchId !== input.batchId
      || existing.retryOfExportId !== (input.retryOfExportId ?? null)
      || existingTemplate?.templateKey !== input.templateKey.trim()
      || exportDate < existingTemplate.validFrom
      || (existingTemplate.validTo !== null && exportDate > existingTemplate.validTo)) {
      throw new ReimbursementPaymentError(
        'reimbursement_bank_export_key_conflict',
        'Export key already exists with different facts.',
      );
    }
    const lines = await tx.select().from(reimbursementBankExportLine).where(and(
      eq(reimbursementBankExportLine.masterFn, scope.masterFn),
      eq(reimbursementBankExportLine.companyFn, scope.companyFn),
      eq(reimbursementBankExportLine.exportId, existing.id),
    )).orderBy(asc(reimbursementBankExportLine.lineNo));
    return { export: exportProjection(existing), lines, replayed: true };
  }
  const [batch] = await tx.select().from(reimbursementPaymentBatch).where(and(
    eq(reimbursementPaymentBatch.masterFn, scope.masterFn),
    eq(reimbursementPaymentBatch.companyFn, scope.companyFn),
    eq(reimbursementPaymentBatch.id, input.batchId),
  )).limit(1).for('update');
  if (!batch || batch.status !== 'released') {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_batch_not_released',
      'Only a released reimbursement batch can be exported.',
      422,
    );
  }
  const [template] = await tx.select().from(reimbursementBankTemplateVersion).where(and(
    eq(reimbursementBankTemplateVersion.masterFn, scope.masterFn),
    eq(reimbursementBankTemplateVersion.companyFn, scope.companyFn),
    eq(reimbursementBankTemplateVersion.templateKey, input.templateKey.trim()),
    eq(reimbursementBankTemplateVersion.status, 'confirmed'),
    lte(reimbursementBankTemplateVersion.validFrom, exportDate),
    or(
      isNull(reimbursementBankTemplateVersion.validTo),
      gte(reimbursementBankTemplateVersion.validTo, exportDate),
    ),
  )).orderBy(desc(reimbursementBankTemplateVersion.versionNo)).limit(1);
  if (!template) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_template_missing',
      'No confirmed bank template is effective for the export date.',
      422,
    );
  }
  const lines = await exportLinesForAttempt(
    tx,
    scope,
    batch,
    input.retryOfExportId ?? null,
  );
  if (!lines.length) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_export_empty',
      'No eligible failed or unpaid lines remain for export.',
      422,
    );
  }
  const fields = templateFields(template.fieldOrder as string[]);
  const rendered: string[] = [];
  if (template.includeHeader) rendered.push(fields.join(template.delimiter));
  for (const line of lines) {
    if (!line.payoutEnvelopeSnapshot) {
      throw new ReimbursementPaymentError(
        'reimbursement_bank_release_snapshot_missing',
        `Released batch line ${line.lineNo} has no encrypted payout snapshot.`,
        503,
      );
    }
    let details: PayoutDetails;
    try {
      details = JSON.parse(
        await crypto.decrypt(envelope(line.payoutEnvelopeSnapshot)),
      ) as PayoutDetails;
    } catch {
      throw new ReimbursementPaymentError(
        'reimbursement_payment_encryption_failed',
        'The encrypted payout snapshot could not be read.',
        503,
      );
    }
    if (details?.v !== 1 || !details.accountHolderName || !details.accountNumber) {
      throw new ReimbursementPaymentError(
        'reimbursement_payment_encryption_failed',
        'The encrypted payout snapshot is invalid.',
        503,
      );
    }
    rendered.push(fields.map((field) =>
      csvCell(bankValue(field, batch, line, details), template.delimiter))
      .join(template.delimiter));
  }
  const content = `${rendered.join('\r\n')}\r\n`;
  const contentSha256 = await crypto.hash(content);
  const artifactEnvelope = envelope(await crypto.encrypt(content));
  const [last] = await tx.select({
    exportVersion: reimbursementBankExport.exportVersion,
  }).from(reimbursementBankExport).where(and(
    eq(reimbursementBankExport.masterFn, scope.masterFn),
    eq(reimbursementBankExport.companyFn, scope.companyFn),
    eq(reimbursementBankExport.batchId, batch.id),
  )).orderBy(desc(reimbursementBankExport.exportVersion)).limit(1);
  const exportVersion = (last?.exportVersion ?? 0) + 1;
  const fileStem = `${batch.batchNo}-${template.bankCode}-v${exportVersion}`
    .replace(/[^A-Za-z0-9._-]/g, '-');
  const total = lines.reduce(
    (sum, line) => sum.plus(line.amount),
    new Decimal(0),
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const [created] = await tx.insert(reimbursementBankExport).values({
    ...scope,
    exportKey,
    batchId: batch.id,
    templateVersionId: template.id,
    exportVersion,
    retryOfExportId: input.retryOfExportId ?? null,
    artifactFileName: `${fileStem}.csv`,
    artifactEnvelope,
    contentSha256,
    rowCount: lines.length,
    totalAmount: total.toFixed(2),
    generatedByUserId: actorUserId,
    generatedAt: now,
  }).returning();
  const exportLines = await tx.insert(reimbursementBankExportLine).values(
    lines.map((line, index) => ({
      ...scope,
      exportId: created.id,
      lineNo: index + 1,
      batchLineId: line.id,
      currency: line.currency,
      amount: line.amount,
      createdAt: now,
    })),
  ).returning();
  await tx.insert(reimbursementBankExportAccessEvent).values({
    ...scope,
    exportId: created.id,
    actorUserId,
    accessKey: `generated:${exportKey}`,
    action: 'generated',
    purpose: 'Generate configured bank payment artifact.',
    contentSha256,
    occurredAt: now,
  });
  return {
    export: exportProjection(created),
    lines: exportLines,
    replayed: false,
  };
}

export async function accessReimbursementBankExportWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  exportId: number,
  accessKeyValue: string,
  purposeValue: string,
  crypto: ReimbursementPaymentCrypto,
  now = new Date(),
) {
  const accessKey = safeKey(accessKeyValue, 'accessKey', 'Access key');
  const purpose = text(purposeValue, 'purpose', 'Access purpose', 3, 500);
  const [bankExport] = await tx.select().from(reimbursementBankExport).where(and(
    eq(reimbursementBankExport.masterFn, scope.masterFn),
    eq(reimbursementBankExport.companyFn, scope.companyFn),
    eq(reimbursementBankExport.id, exportId),
  )).limit(1);
  if (!bankExport) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_export_not_found',
      'The bank export is unavailable.',
      404,
    );
  }
  let content: string;
  try {
    content = await crypto.decrypt(envelope(bankExport.artifactEnvelope));
  } catch {
    throw new ReimbursementPaymentError(
      'reimbursement_payment_encryption_failed',
      'The encrypted bank artifact could not be read.',
      503,
    );
  }
  if (await crypto.hash(content) !== bankExport.contentSha256) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_export_integrity_failed',
      'The bank export checksum does not match its encrypted content.',
      503,
    );
  }
  const [existing] = await tx.select().from(reimbursementBankExportAccessEvent).where(and(
    eq(reimbursementBankExportAccessEvent.masterFn, scope.masterFn),
    eq(reimbursementBankExportAccessEvent.companyFn, scope.companyFn),
    eq(reimbursementBankExportAccessEvent.exportId, bankExport.id),
    eq(reimbursementBankExportAccessEvent.actorUserId, actorUserId),
    eq(reimbursementBankExportAccessEvent.accessKey, accessKey),
  )).limit(1);
  if (existing && (
    existing.action !== 'downloaded'
    || existing.purpose !== purpose
    || existing.contentSha256 !== bankExport.contentSha256
  )) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_access_key_conflict',
      'Access key is already used for a different bank artifact access.',
    );
  }
  if (!existing) {
    await tx.insert(reimbursementBankExportAccessEvent).values({
      ...scope,
      exportId: bankExport.id,
      actorUserId,
      accessKey,
      action: 'downloaded',
      purpose,
      contentSha256: bankExport.contentSha256,
      occurredAt: now,
    });
  }
  return {
    export: exportProjection(bankExport),
    content,
    replayedAccess: Boolean(existing),
  };
}

async function readResultImport(
  tx: DB,
  scope: Scope,
  importId: number,
) {
  const [resultImport] = await tx.select().from(reimbursementBankResultImport).where(and(
    eq(reimbursementBankResultImport.masterFn, scope.masterFn),
    eq(reimbursementBankResultImport.companyFn, scope.companyFn),
    eq(reimbursementBankResultImport.id, importId),
  )).limit(1);
  const results = await tx.select().from(reimbursementBankLineResult).where(and(
    eq(reimbursementBankLineResult.masterFn, scope.masterFn),
    eq(reimbursementBankLineResult.companyFn, scope.companyFn),
    eq(reimbursementBankLineResult.resultImportId, importId),
  )).orderBy(asc(reimbursementBankLineResult.id));
  const settlements = results.length
    ? await tx.select().from(reimbursementSettlement).where(and(
      eq(reimbursementSettlement.masterFn, scope.masterFn),
      eq(reimbursementSettlement.companyFn, scope.companyFn),
      inArray(reimbursementSettlement.resultLineId, results.map((row) => row.id)),
    )).orderBy(asc(reimbursementSettlement.id))
    : [];
  return {
    import: resultImport,
    results,
    settlements: settlements.map(settlementProjection),
  };
}

export async function importReimbursementBankResultsWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  input: BankResultImportInput,
  hashValue: (value: string) => string | Promise<string>,
  now = new Date(),
) {
  const importKey = safeKey(input.importKey, 'importKey', 'Import key');
  const bankReference = text(
    input.bankReference,
    'bankReference',
    'Bank reference',
    3,
    160,
  );
  const paymentDate = dateValue(input.paymentDate, 'paymentDate', 'Payment date');
  if (!Array.isArray(input.results) || !input.results.length || input.results.length > 500) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_results_invalid',
      'Import 1–500 bank line outcomes.',
      422,
    );
  }
  const normalized = input.results.map((result) => ({
    exportLineNo: Number(result.exportLineNo),
    outcome: result.outcome,
    bankLineReference: text(
      result.bankLineReference,
      'bankLineReference',
      'Bank line reference',
      1,
      160,
    ),
    failureCode: result.outcome === 'failed'
      ? text(result.failureCode, 'failureCode', 'Failure code', 1, 80)
      : null,
    failureMessage: result.outcome === 'failed'
      ? text(result.failureMessage, 'failureMessage', 'Failure message', 3, 500)
      : null,
  }));
  if (
    normalized.some((result) =>
      !Number.isSafeInteger(result.exportLineNo)
      || result.exportLineNo <= 0
      || !['success', 'failed'].includes(result.outcome))
    || new Set(normalized.map((result) => result.exportLineNo)).size !== normalized.length
  ) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_results_invalid',
      'Each result requires a distinct positive export line and success/failed outcome.',
      422,
    );
  }
  const sourceSha256 = await hashValue(JSON.stringify({
    exportId: input.exportId,
    bankReference,
    paymentDate,
    results: normalized,
  }));
  const [existing] = await tx.select().from(reimbursementBankResultImport).where(and(
    eq(reimbursementBankResultImport.masterFn, scope.masterFn),
    eq(reimbursementBankResultImport.companyFn, scope.companyFn),
    eq(reimbursementBankResultImport.importKey, importKey),
  )).limit(1);
  if (existing) {
    if (existing.exportId !== input.exportId || existing.sourceSha256 !== sourceSha256) {
      throw new ReimbursementPaymentError(
        'reimbursement_bank_import_key_conflict',
        'Import key already exists with different bank outcomes.',
      );
    }
    return { ...(await readResultImport(tx, scope, existing.id)), replayed: true };
  }
  const [bankExport] = await tx.select().from(reimbursementBankExport).where(and(
    eq(reimbursementBankExport.masterFn, scope.masterFn),
    eq(reimbursementBankExport.companyFn, scope.companyFn),
    eq(reimbursementBankExport.id, input.exportId),
  )).limit(1);
  if (!bankExport) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_export_not_found',
      'The bank export is unavailable.',
      404,
    );
  }
  const exportLines = await tx.select({
    exportLine: reimbursementBankExportLine,
    batchLine: reimbursementPaymentBatchLine,
    batch: reimbursementPaymentBatch,
  }).from(reimbursementBankExportLine)
    .innerJoin(reimbursementPaymentBatchLine, and(
      eq(reimbursementPaymentBatchLine.masterFn, scope.masterFn),
      eq(reimbursementPaymentBatchLine.companyFn, scope.companyFn),
      eq(reimbursementPaymentBatchLine.id, reimbursementBankExportLine.batchLineId),
    ))
    .innerJoin(reimbursementPaymentBatch, and(
      eq(reimbursementPaymentBatch.masterFn, scope.masterFn),
      eq(reimbursementPaymentBatch.companyFn, scope.companyFn),
      eq(reimbursementPaymentBatch.id, reimbursementPaymentBatchLine.batchId),
    ))
    .where(and(
      eq(reimbursementBankExportLine.masterFn, scope.masterFn),
      eq(reimbursementBankExportLine.companyFn, scope.companyFn),
      eq(reimbursementBankExportLine.exportId, bankExport.id),
    )).for('update');
  const byLineNo = new Map(exportLines.map((row) => [row.exportLine.lineNo, row]));
  if (normalized.some((result) => !byLineNo.has(result.exportLineNo))) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_results_invalid',
      'A result references a line outside this export.',
      422,
    );
  }
  const selectedExportLineIds = normalized.map((result) =>
    byLineNo.get(result.exportLineNo)!.exportLine.id);
  const priorResults = await tx.select().from(reimbursementBankLineResult).where(and(
    eq(reimbursementBankLineResult.masterFn, scope.masterFn),
    eq(reimbursementBankLineResult.companyFn, scope.companyFn),
    inArray(reimbursementBankLineResult.exportLineId, selectedExportLineIds),
  ));
  if (priorResults.length) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_result_already_recorded',
      'A bank outcome already exists for one of these export lines.',
    );
  }
  const successfulBatchLineIds = normalized
    .filter((result) => result.outcome === 'success')
    .map((result) => byLineNo.get(result.exportLineNo)!.batchLine.id);
  const priorSettlements = successfulBatchLineIds.length
    ? await tx.select().from(reimbursementSettlement).where(and(
      eq(reimbursementSettlement.masterFn, scope.masterFn),
      eq(reimbursementSettlement.companyFn, scope.companyFn),
      inArray(reimbursementSettlement.batchLineId, successfulBatchLineIds),
    ))
    : [];
  if (priorSettlements.length) {
    throw new ReimbursementPaymentError(
      'reimbursement_bank_line_already_settled',
      'A successful reimbursement cannot be posted twice.',
    );
  }
  const periods = normalized.some((result) => result.outcome === 'success')
    ? await tx.select().from(accountingPeriod).where(and(
      eq(accountingPeriod.masterFn, scope.masterFn),
      eq(accountingPeriod.companyFn, scope.companyFn),
      lte(accountingPeriod.startDate, paymentDate),
      gte(accountingPeriod.endDate, paymentDate),
    )).limit(2).for('update')
    : [];
  if (successfulBatchLineIds.length && (
    periods.length !== 1 || periods[0].status !== 'open'
  )) {
    throw new ReimbursementPaymentError(
      periods.length === 1
        ? 'reimbursement_payment_period_locked'
        : 'reimbursement_payment_period_invalid',
      'Exactly one open accounting period must cover the bank payment date.',
      422,
    );
  }
  const accountIds = Array.from(new Set(exportLines.flatMap((row) => [
    row.batchLine.payableAccountId,
    row.batch.sourceBankAccountId,
  ])));
  const accounts = await tx.select().from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    inArray(account.id, accountIds),
  ));
  const byAccount = new Map(accounts.map((row) => [row.id, row]));
  const [resultImport] = await tx.insert(reimbursementBankResultImport).values({
    ...scope,
    importKey,
    exportId: bankExport.id,
    bankReference,
    paymentDate,
    sourceSha256,
    rowCount: normalized.length,
    importedByUserId: actorUserId,
    importedAt: now,
  }).returning();
  const resultRows = [];
  const settlementRows = [];
  for (const result of normalized) {
    const source = byLineNo.get(result.exportLineNo)!;
    const [resultRow] = await tx.insert(reimbursementBankLineResult).values({
      ...scope,
      resultImportId: resultImport.id,
      exportLineId: source.exportLine.id,
      outcome: result.outcome,
      bankLineReference: result.bankLineReference,
      failureCode: result.failureCode,
      failureMessage: result.failureMessage,
      recordedAt: now,
    }).returning();
    resultRows.push(resultRow);
    if (result.outcome !== 'success') continue;
    const payable = byAccount.get(source.batchLine.payableAccountId);
    const bank = byAccount.get(source.batch.sourceBankAccountId);
    if (payable?.type !== 'liability' || bank?.type !== 'asset') {
      throw new ReimbursementPaymentError(
        'reimbursement_payment_account_invalid',
        'Employee payable and source bank accounts must be liability and asset accounts.',
        422,
      );
    }
    const journalRef = `REIMB:B${source.batch.id}:L${source.batchLine.id}`;
    const [journalConflict] = await tx.select({ id: glEntry.id }).from(glEntry).where(and(
      eq(glEntry.masterFn, scope.masterFn),
      eq(glEntry.companyFn, scope.companyFn),
      eq(glEntry.journalRef, journalRef),
    )).limit(1);
    if (journalConflict) {
      throw new ReimbursementPaymentError(
        'reimbursement_payment_journal_conflict',
        'Reimbursement journal exists without its settlement fact.',
      );
    }
    const amount = new Decimal(source.batchLine.amount).toFixed(2);
    const facts = {
      schema: 'reimbursement-settlement-v1',
      batchLineId: source.batchLine.id,
      resultLineId: resultRow.id,
      resultImportId: resultImport.id,
      bankReference,
      bankLineReference: result.bankLineReference,
      paymentDate,
      currency: source.batchLine.currency,
      amount,
      payableAccountId: source.batchLine.payableAccountId,
      bankAccountId: source.batch.sourceBankAccountId,
      journalRef,
    };
    const entries = await tx.insert(glEntry).values([
      {
        ...scope,
        postedAt: new Date(`${paymentDate}T00:00:00.000Z`),
        journalRef,
        accountId: source.batchLine.payableAccountId,
        debit: amount,
        credit: '0.00',
        memo: `${source.batchLine.claimNo} employee payable settled`,
      },
      {
        ...scope,
        postedAt: new Date(`${paymentDate}T00:00:00.000Z`),
        journalRef,
        accountId: source.batch.sourceBankAccountId,
        debit: '0.00',
        credit: amount,
        memo: `${source.batchLine.claimNo} bank reimbursement`,
      },
    ]).returning();
    const [settlement] = await tx.insert(reimbursementSettlement).values({
      ...scope,
      batchLineId: source.batchLine.id,
      resultLineId: resultRow.id,
      resultImportId: resultImport.id,
      accountingPeriodId: periods[0].id,
      bankReference,
      paymentDate,
      currency: source.batchLine.currency,
      amount,
      payableAccountId: source.batchLine.payableAccountId,
      bankAccountId: source.batch.sourceBankAccountId,
      journalRef,
      debitGlEntryId: entries[0].id,
      creditGlEntryId: entries[1].id,
      factsSha256: await hashValue(JSON.stringify(facts)),
      postedByUserId: actorUserId,
      postedAt: now,
    }).returning();
    settlementRows.push(settlementProjection(settlement));
  }
  return {
    import: resultImport,
    results: resultRows,
    settlements: settlementRows,
    replayed: false,
  };
}

export async function listReimbursementPaymentEvidenceWithin(
  tx: DB,
  scope: Scope,
) {
  const exports = await tx.select().from(reimbursementBankExport).where(and(
    eq(reimbursementBankExport.masterFn, scope.masterFn),
    eq(reimbursementBankExport.companyFn, scope.companyFn),
  )).orderBy(desc(reimbursementBankExport.generatedAt), desc(reimbursementBankExport.id))
    .limit(200);
  const imports = await tx.select().from(reimbursementBankResultImport).where(and(
    eq(reimbursementBankResultImport.masterFn, scope.masterFn),
    eq(reimbursementBankResultImport.companyFn, scope.companyFn),
  )).orderBy(
    desc(reimbursementBankResultImport.importedAt),
    desc(reimbursementBankResultImport.id),
  ).limit(200);
  const results = await tx.select().from(reimbursementBankLineResult).where(and(
    eq(reimbursementBankLineResult.masterFn, scope.masterFn),
    eq(reimbursementBankLineResult.companyFn, scope.companyFn),
  )).orderBy(desc(reimbursementBankLineResult.recordedAt), desc(reimbursementBankLineResult.id))
    .limit(500);
  const settlements = await tx.select().from(reimbursementSettlement).where(and(
    eq(reimbursementSettlement.masterFn, scope.masterFn),
    eq(reimbursementSettlement.companyFn, scope.companyFn),
  )).orderBy(desc(reimbursementSettlement.postedAt), desc(reimbursementSettlement.id))
    .limit(500);
  return {
    exports: exports.map(exportProjection),
    imports,
    results,
    settlements: settlements.map(settlementProjection),
  };
}
