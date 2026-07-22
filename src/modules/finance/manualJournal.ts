// Manual journals are the only user-authored GL source. A draft stores its header and
// exact Decimal lines without touching gl_entry. Posting is immutable; correction is a
// separately numbered reversal whose lines are swapped and linked to the original.
import { and, asc, eq, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { account, glEntry, journalHeader, journalLine } from '../../data/schema';

export class ManualJournalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManualJournalError';
  }
}

export type ManualJournalType = 'standard' | 'accrual' | 'reclassification';

export interface ManualJournalLineInput {
  accountId: number;
  dimension?: string | null;
  debit: string;
  credit: string;
  memo?: string | null;
}

export interface CreateManualJournalInput {
  docNo: string;
  postingDate: string;
  journalType: ManualJournalType;
  memo: string;
  reference?: string | null;
  lines: ManualJournalLineInput[];
}

export interface ReverseManualJournalInput {
  docNo: string;
  postingDate: string;
  reason: string;
}

function required(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ManualJournalError(`${label} is required.`);
  }
  return value.trim();
}

function validDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ManualJournalError(`${label} must use YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ManualJournalError(`${label} is not a valid calendar date.`);
  }
  return value;
}

function dateText(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function amount(value: unknown, label: string): Decimal {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim())) {
    throw new ManualJournalError(`${label} must be a non-negative decimal string with at most 2 places.`);
  }
  const parsed = new Decimal(value);
  if (!parsed.isFinite()) throw new ManualJournalError(`${label} must be finite.`);
  return parsed;
}

function normalizeLines(lines: unknown): Array<ManualJournalLineInput & {
  debit: string;
  credit: string;
}> {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new ManualJournalError('At least two journal lines are required.');
  }
  const normalized = lines.map((line, index) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      throw new ManualJournalError(`Line ${index + 1} must be an object.`);
    }
    const candidate = line as Partial<ManualJournalLineInput>;
    if (!Number.isSafeInteger(candidate.accountId) || Number(candidate.accountId) <= 0) {
      throw new ManualJournalError(`Line ${index + 1} accountId must be a positive integer.`);
    }
    const debit = amount(candidate.debit, `Line ${index + 1} debit`);
    const credit = amount(candidate.credit, `Line ${index + 1} credit`);
    if (debit.gt(0) === credit.gt(0)) {
      throw new ManualJournalError(`Line ${index + 1} must contain exactly one positive debit or credit.`);
    }
    return {
      accountId: Number(candidate.accountId),
      dimension: typeof candidate.dimension === 'string' && candidate.dimension.trim()
        ? candidate.dimension.trim()
        : null,
      debit: debit.toFixed(2),
      credit: credit.toFixed(2),
      memo: typeof candidate.memo === 'string' && candidate.memo.trim()
        ? candidate.memo.trim()
        : null,
    };
  });
  const totals = normalized.reduce((acc, line) => ({
    debit: acc.debit.plus(line.debit),
    credit: acc.credit.plus(line.credit),
  }), { debit: new Decimal(0), credit: new Decimal(0) });
  if (totals.debit.lte(0) || !totals.debit.eq(totals.credit)) {
    throw new ManualJournalError(
      `Journal must balance with a positive total (debit ${totals.debit.toFixed(2)}, credit ${totals.credit.toFixed(2)}).`,
    );
  }
  return normalized;
}

async function validateAccounts(
  exec: DB,
  scope: Scope,
  lines: Array<{ accountId: number }>,
): Promise<void> {
  const accountIds = Array.from(new Set(lines.map((line) => line.accountId)));
  const found = await exec.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    inArray(account.id, accountIds),
  ));
  if (found.length !== accountIds.length) {
    throw new ManualJournalError('One or more accounts are unavailable in this company.');
  }
}

function journalTotal(lines: Array<{ debit: string }>): string {
  return lines.reduce((sum, line) => sum.plus(line.debit), new Decimal(0)).toFixed(2);
}

export async function createManualJournalWithin(
  exec: DB,
  scope: Scope,
  input: CreateManualJournalInput,
) {
  const docNo = required(input.docNo, 'Journal number');
  const postingDate = validDate(input.postingDate, 'postingDate');
  const memo = required(input.memo, 'Memo');
  const types: ManualJournalType[] = ['standard', 'accrual', 'reclassification'];
  if (!types.includes(input.journalType)) {
    throw new ManualJournalError('journalType must be standard, accrual, or reclassification.');
  }
  const lines = normalizeLines(input.lines);
  await validateAccounts(exec, scope, lines);

  const [existingHeader] = await exec.select({ id: journalHeader.id }).from(journalHeader).where(and(
    eq(journalHeader.masterFn, scope.masterFn),
    eq(journalHeader.companyFn, scope.companyFn),
    eq(journalHeader.docNo, docNo),
  ));
  const [existingPosting] = await exec.select({ id: glEntry.id }).from(glEntry).where(and(
    eq(glEntry.masterFn, scope.masterFn),
    eq(glEntry.companyFn, scope.companyFn),
    eq(glEntry.journalRef, docNo),
  ));
  if (existingHeader || existingPosting) {
    throw new ManualJournalError(`Journal number ${docNo} already exists.`);
  }

  const [header] = await exec.insert(journalHeader).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    postingDate,
    journalType: input.journalType,
    memo,
    reference: input.reference?.trim() || null,
  }).returning({
    id: journalHeader.id,
    docNo: journalHeader.docNo,
    postingDate: journalHeader.postingDate,
    journalType: journalHeader.journalType,
    memo: journalHeader.memo,
    reference: journalHeader.reference,
    status: journalHeader.status,
    version: journalHeader.version,
  });

  await exec.insert(journalLine).values(lines.map((line, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    journalId: header.id,
    lineNo: index + 1,
    accountId: line.accountId,
    dimension: line.dimension,
    debit: line.debit,
    credit: line.credit,
    memo: line.memo,
  })));

  return { ...header, lineCount: lines.length, total: journalTotal(lines) };
}

async function lockedJournal(exec: DB, scope: Scope, journalId: number) {
  if (!Number.isSafeInteger(journalId) || journalId <= 0) {
    throw new ManualJournalError('journalId must be a positive integer.');
  }
  const [header] = await exec.select().from(journalHeader).where(and(
    eq(journalHeader.masterFn, scope.masterFn),
    eq(journalHeader.companyFn, scope.companyFn),
    eq(journalHeader.id, journalId),
  )).for('update');
  if (!header) throw new ManualJournalError('Journal is unavailable in this company.');
  return header;
}

async function storedLines(exec: DB, scope: Scope, journalId: number) {
  const lines = await exec.select().from(journalLine).where(and(
    eq(journalLine.masterFn, scope.masterFn),
    eq(journalLine.companyFn, scope.companyFn),
    eq(journalLine.journalId, journalId),
  )).orderBy(asc(journalLine.lineNo));
  const normalized = normalizeLines(lines.map((line) => ({
    accountId: line.accountId,
    dimension: line.dimension,
    debit: line.debit,
    credit: line.credit,
    memo: line.memo,
  })));
  await validateAccounts(exec, scope, normalized);
  return normalized;
}

function glMemo(headerMemo: string, line: { memo?: string | null; dimension?: string | null }) {
  return line.memo || line.dimension || headerMemo;
}

export async function postManualJournalWithin(exec: DB, scope: Scope, journalId: number) {
  const header = await lockedJournal(exec, scope, journalId);
  if (header.status !== 'draft') {
    throw new ManualJournalError(`Only a draft journal can be posted; ${header.docNo} is '${header.status}'.`);
  }
  const lines = await storedLines(exec, scope, header.id);
  const [existingPosting] = await exec.select({ id: glEntry.id }).from(glEntry).where(and(
    eq(glEntry.masterFn, scope.masterFn),
    eq(glEntry.companyFn, scope.companyFn),
    eq(glEntry.journalRef, header.docNo),
  ));
  if (existingPosting) throw new ManualJournalError(`Journal ${header.docNo} is already present in the GL.`);

  const postingTimestamp = new Date(`${dateText(header.postingDate)}T00:00:00.000Z`);
  await exec.insert(glEntry).values(lines.map((line) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    postedAt: postingTimestamp,
    journalRef: header.docNo,
    accountId: line.accountId,
    debit: line.debit,
    credit: line.credit,
    memo: glMemo(header.memo, line),
  })));
  const now = new Date();
  const [posted] = await exec.update(journalHeader).set({
    status: 'posted',
    postedAt: now,
    version: header.version + 1,
    updatedAt: now,
  }).where(and(
    eq(journalHeader.masterFn, scope.masterFn),
    eq(journalHeader.companyFn, scope.companyFn),
    eq(journalHeader.id, header.id),
    eq(journalHeader.version, header.version),
  )).returning({
    id: journalHeader.id,
    docNo: journalHeader.docNo,
    status: journalHeader.status,
    version: journalHeader.version,
    postedAt: journalHeader.postedAt,
  });
  if (!posted) throw new ManualJournalError('Journal version changed before posting.');
  return { ...posted, lineCount: lines.length, total: journalTotal(lines) };
}

export async function reverseManualJournalWithin(
  exec: DB,
  scope: Scope,
  journalId: number,
  input: ReverseManualJournalInput,
) {
  const original = await lockedJournal(exec, scope, journalId);
  if (original.status !== 'posted') {
    throw new ManualJournalError(`Only a posted journal can be reversed; ${original.docNo} is '${original.status}'.`);
  }
  const docNo = required(input.docNo, 'Reversal journal number');
  const postingDate = validDate(input.postingDate, 'postingDate');
  const reason = required(input.reason, 'Reversal reason');
  if (postingDate < dateText(original.postingDate)) {
    throw new ManualJournalError('Reversal postingDate cannot precede the original journal date.');
  }
  const [existingReversal] = await exec.select({ id: journalHeader.id }).from(journalHeader).where(and(
    eq(journalHeader.masterFn, scope.masterFn),
    eq(journalHeader.companyFn, scope.companyFn),
    eq(journalHeader.reversalOfId, original.id),
  ));
  if (existingReversal) throw new ManualJournalError(`Journal ${original.docNo} already has a reversal.`);
  const [duplicateDoc] = await exec.select({ id: journalHeader.id }).from(journalHeader).where(and(
    eq(journalHeader.masterFn, scope.masterFn),
    eq(journalHeader.companyFn, scope.companyFn),
    eq(journalHeader.docNo, docNo),
  ));
  const [duplicateGl] = await exec.select({ id: glEntry.id }).from(glEntry).where(and(
    eq(glEntry.masterFn, scope.masterFn),
    eq(glEntry.companyFn, scope.companyFn),
    eq(glEntry.journalRef, docNo),
  ));
  if (duplicateDoc || duplicateGl) throw new ManualJournalError(`Journal number ${docNo} already exists.`);

  const originalLines = await storedLines(exec, scope, original.id);
  const reversalLines = originalLines.map((line) => ({
    ...line,
    debit: line.credit,
    credit: line.debit,
  }));
  const now = new Date();
  const [reversal] = await exec.insert(journalHeader).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    postingDate,
    journalType: 'reversal',
    memo: `Reversal of ${original.docNo} — ${reason}`,
    reference: original.docNo,
    status: 'posted',
    reversalOfId: original.id,
    postedAt: now,
  }).returning({
    id: journalHeader.id,
    docNo: journalHeader.docNo,
    status: journalHeader.status,
    version: journalHeader.version,
    reversalOfId: journalHeader.reversalOfId,
  });

  await exec.insert(journalLine).values(reversalLines.map((line, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    journalId: reversal.id,
    lineNo: index + 1,
    accountId: line.accountId,
    dimension: line.dimension,
    debit: line.debit,
    credit: line.credit,
    memo: line.memo,
  })));
  const postingTimestamp = new Date(`${postingDate}T00:00:00.000Z`);
  await exec.insert(glEntry).values(reversalLines.map((line) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    postedAt: postingTimestamp,
    journalRef: docNo,
    accountId: line.accountId,
    debit: line.debit,
    credit: line.credit,
    memo: glMemo(`Reversal of ${original.docNo} — ${reason}`, line),
  })));
  const [reversedOriginal] = await exec.update(journalHeader).set({
    status: 'reversed',
    reversedAt: now,
    version: original.version + 1,
    updatedAt: now,
  }).where(and(
    eq(journalHeader.masterFn, scope.masterFn),
    eq(journalHeader.companyFn, scope.companyFn),
    eq(journalHeader.id, original.id),
    eq(journalHeader.version, original.version),
  )).returning({
    id: journalHeader.id,
    docNo: journalHeader.docNo,
    status: journalHeader.status,
    version: journalHeader.version,
  });
  if (!reversedOriginal) throw new ManualJournalError('Journal version changed before reversal.');
  return {
    original: reversedOriginal,
    reversal: { ...reversal, lineCount: reversalLines.length, total: journalTotal(reversalLines) },
  };
}

export function createManualJournal(db: DB, scope: Scope, input: CreateManualJournalInput) {
  return db.transaction((tx) => createManualJournalWithin(tx, scope, input));
}

export function postManualJournal(db: DB, scope: Scope, journalId: number) {
  return db.transaction((tx) => postManualJournalWithin(tx, scope, journalId));
}

export function reverseManualJournal(
  db: DB,
  scope: Scope,
  journalId: number,
  input: ReverseManualJournalInput,
) {
  return db.transaction((tx) => reverseManualJournalWithin(tx, scope, journalId, input));
}
