// Bank reconciliation links imported statement facts to immutable GL legs. It never
// creates accounting entries: bank-originated charges/interest must be posted through a
// real journal first, then matched here.
import { and, asc, eq, isNull } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  account,
  bankStatement,
  bankStatementLine,
  glEntry,
} from '../../data/schema';

export class BankReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BankReconciliationError';
  }
}

export interface BankStatementLineInput {
  transactionDate: string;
  reference?: string | null;
  description: string;
  amount: string;
}

export interface CreateBankStatementInput {
  statementNo: string;
  bankAccountId: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: string;
  closingBalance: string;
  lines: BankStatementLineInput[];
}

export interface MatchBankStatementLineInput {
  glEntryId: number;
}

function required(value: unknown, label: string, max = 240): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BankReconciliationError(`${label} is required.`);
  }
  const text = value.trim();
  if (text.length > max) throw new BankReconciliationError(`${label} is too long.`);
  return text;
}

function validDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BankReconciliationError(`${label} must use YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BankReconciliationError(`${label} is not a valid calendar date.`);
  }
  return value;
}

function decimal(value: unknown, label: string, { nonZero = false } = {}): Decimal {
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim())) {
    throw new BankReconciliationError(`${label} must be a decimal string with at most 2 places.`);
  }
  const parsed = new Decimal(value);
  if (!parsed.isFinite()) throw new BankReconciliationError(`${label} must be finite.`);
  if (nonZero && parsed.isZero()) throw new BankReconciliationError(`${label} cannot be zero.`);
  return parsed;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new BankReconciliationError(`${label} must be a positive integer.`);
  }
  return Number(value);
}

function normalizeLines(
  lines: unknown,
  periodStart: string,
  periodEnd: string,
): Array<BankStatementLineInput & { amount: string }> {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 500) {
    throw new BankReconciliationError('A statement requires between 1 and 500 lines.');
  }
  return lines.map((line, index) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      throw new BankReconciliationError(`Line ${index + 1} must be an object.`);
    }
    const input = line as Partial<BankStatementLineInput>;
    const transactionDate = validDate(input.transactionDate, `Line ${index + 1} transactionDate`);
    if (transactionDate < periodStart || transactionDate > periodEnd) {
      throw new BankReconciliationError(`Line ${index + 1} date must fall inside the statement period.`);
    }
    return {
      transactionDate,
      reference: typeof input.reference === 'string' && input.reference.trim()
        ? required(input.reference, `Line ${index + 1} reference`, 120)
        : null,
      description: required(input.description, `Line ${index + 1} description`),
      amount: decimal(input.amount, `Line ${index + 1} amount`, { nonZero: true }).toFixed(2),
    };
  });
}

export async function createBankStatementWithin(
  exec: DB,
  scope: Scope,
  input: CreateBankStatementInput,
) {
  const statementNo = required(input.statementNo, 'Statement number', 120);
  const bankAccountId = positiveInteger(input.bankAccountId, 'bankAccountId');
  const currency = required(input.currency, 'Currency', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BankReconciliationError('Currency must be a 3-letter ISO code.');
  }
  const periodStart = validDate(input.periodStart, 'periodStart');
  const periodEnd = validDate(input.periodEnd, 'periodEnd');
  if (periodEnd < periodStart) {
    throw new BankReconciliationError('periodEnd cannot precede periodStart.');
  }
  const openingBalance = decimal(input.openingBalance, 'openingBalance');
  const closingBalance = decimal(input.closingBalance, 'closingBalance');
  const lines = normalizeLines(input.lines, periodStart, periodEnd);
  const movement = lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0));
  if (!openingBalance.plus(movement).eq(closingBalance)) {
    throw new BankReconciliationError(
      `Statement does not foot: opening ${openingBalance.toFixed(2)} + movement ${movement.toFixed(2)} `
      + `does not equal closing ${closingBalance.toFixed(2)}.`,
    );
  }

  const [bankAccount] = await exec.select({ id: account.id, type: account.type }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.id, bankAccountId),
  ));
  if (!bankAccount || bankAccount.type !== 'asset') {
    throw new BankReconciliationError('Bank account must be an asset account in this company.');
  }
  const [duplicate] = await exec.select({ id: bankStatement.id }).from(bankStatement).where(and(
    eq(bankStatement.masterFn, scope.masterFn),
    eq(bankStatement.companyFn, scope.companyFn),
    eq(bankStatement.statementNo, statementNo),
  ));
  if (duplicate) throw new BankReconciliationError(`Statement number ${statementNo} already exists.`);

  const [header] = await exec.insert(bankStatement).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    statementNo,
    bankAccountId,
    currency,
    periodStart,
    periodEnd,
    openingBalance: openingBalance.toFixed(2),
    closingBalance: closingBalance.toFixed(2),
  }).returning({
    id: bankStatement.id,
    statementNo: bankStatement.statementNo,
    bankAccountId: bankStatement.bankAccountId,
    currency: bankStatement.currency,
    periodStart: bankStatement.periodStart,
    periodEnd: bankStatement.periodEnd,
    openingBalance: bankStatement.openingBalance,
    closingBalance: bankStatement.closingBalance,
    status: bankStatement.status,
    version: bankStatement.version,
  });
  await exec.insert(bankStatementLine).values(lines.map((line, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    statementId: header.id,
    lineNo: index + 1,
    transactionDate: line.transactionDate,
    reference: line.reference,
    description: line.description,
    amount: line.amount,
  })));
  return { ...header, lineCount: lines.length, movement: movement.toFixed(2) };
}

async function lockedLine(exec: DB, scope: Scope, lineId: number) {
  const id = positiveInteger(lineId, 'lineId');
  const [line] = await exec.select().from(bankStatementLine).where(and(
    eq(bankStatementLine.masterFn, scope.masterFn),
    eq(bankStatementLine.companyFn, scope.companyFn),
    eq(bankStatementLine.id, id),
  )).for('update');
  if (!line) throw new BankReconciliationError('Statement line is unavailable in this company.');
  const [statement] = await exec.select().from(bankStatement).where(and(
    eq(bankStatement.masterFn, scope.masterFn),
    eq(bankStatement.companyFn, scope.companyFn),
    eq(bankStatement.id, line.statementId),
  )).for('update');
  if (!statement) throw new BankReconciliationError('Statement is unavailable in this company.');
  if (statement.status !== 'draft') {
    throw new BankReconciliationError('A reconciled statement is immutable.');
  }
  return { line, statement };
}

async function bumpStatement(exec: DB, scope: Scope, statement: typeof bankStatement.$inferSelect) {
  const now = new Date();
  const [updated] = await exec.update(bankStatement).set({
    version: statement.version + 1,
    updatedAt: now,
  }).where(and(
    eq(bankStatement.masterFn, scope.masterFn),
    eq(bankStatement.companyFn, scope.companyFn),
    eq(bankStatement.id, statement.id),
    eq(bankStatement.version, statement.version),
  )).returning({ version: bankStatement.version });
  if (!updated) throw new BankReconciliationError('Statement version changed during matching.');
  return updated.version;
}

export async function matchBankStatementLineWithin(
  exec: DB,
  scope: Scope,
  lineId: number,
  input: MatchBankStatementLineInput,
) {
  const glEntryId = positiveInteger(input.glEntryId, 'glEntryId');
  const { line, statement } = await lockedLine(exec, scope, lineId);
  if (line.matchedGlEntryId != null) {
    throw new BankReconciliationError('Statement line is already matched. Unmatch it before choosing another GL entry.');
  }
  const [leg] = await exec.select().from(glEntry).where(and(
    eq(glEntry.masterFn, scope.masterFn),
    eq(glEntry.companyFn, scope.companyFn),
    eq(glEntry.id, glEntryId),
    eq(glEntry.accountId, statement.bankAccountId),
  )).for('update');
  if (!leg) throw new BankReconciliationError('GL entry is not a bank-account leg in this company.');
  const glAmount = new Decimal(leg.debit).minus(leg.credit);
  if (!glAmount.eq(line.amount)) {
    throw new BankReconciliationError(
      `Statement amount ${new Decimal(line.amount).toFixed(2)} does not equal GL bank movement ${glAmount.toFixed(2)}.`,
    );
  }
  const [used] = await exec.select({ id: bankStatementLine.id }).from(bankStatementLine).where(and(
    eq(bankStatementLine.masterFn, scope.masterFn),
    eq(bankStatementLine.companyFn, scope.companyFn),
    eq(bankStatementLine.matchedGlEntryId, glEntryId),
  ));
  if (used) throw new BankReconciliationError('GL entry is already matched to another statement line.');

  const matchedAt = new Date();
  const [matched] = await exec.update(bankStatementLine).set({
    matchedGlEntryId: glEntryId,
    matchedAt,
    updatedAt: matchedAt,
  }).where(and(
    eq(bankStatementLine.masterFn, scope.masterFn),
    eq(bankStatementLine.companyFn, scope.companyFn),
    eq(bankStatementLine.id, line.id),
    isNull(bankStatementLine.matchedGlEntryId),
  )).returning({
    id: bankStatementLine.id,
    statementId: bankStatementLine.statementId,
    matchedGlEntryId: bankStatementLine.matchedGlEntryId,
    matchedAt: bankStatementLine.matchedAt,
  });
  if (!matched) throw new BankReconciliationError('Statement line changed during matching.');
  return { ...matched, statementVersion: await bumpStatement(exec, scope, statement) };
}

export async function unmatchBankStatementLineWithin(exec: DB, scope: Scope, lineId: number) {
  const { line, statement } = await lockedLine(exec, scope, lineId);
  if (line.matchedGlEntryId == null) throw new BankReconciliationError('Statement line is not matched.');
  const now = new Date();
  const [unmatched] = await exec.update(bankStatementLine).set({
    matchedGlEntryId: null,
    matchedAt: null,
    updatedAt: now,
  }).where(and(
    eq(bankStatementLine.masterFn, scope.masterFn),
    eq(bankStatementLine.companyFn, scope.companyFn),
    eq(bankStatementLine.id, line.id),
    eq(bankStatementLine.matchedGlEntryId, line.matchedGlEntryId),
  )).returning({ id: bankStatementLine.id, statementId: bankStatementLine.statementId });
  if (!unmatched) throw new BankReconciliationError('Statement line changed during unmatching.');
  return { ...unmatched, matchedGlEntryId: null, statementVersion: await bumpStatement(exec, scope, statement) };
}

export async function reconcileBankStatementWithin(exec: DB, scope: Scope, statementId: number) {
  const id = positiveInteger(statementId, 'statementId');
  const [statement] = await exec.select().from(bankStatement).where(and(
    eq(bankStatement.masterFn, scope.masterFn),
    eq(bankStatement.companyFn, scope.companyFn),
    eq(bankStatement.id, id),
  )).for('update');
  if (!statement) throw new BankReconciliationError('Statement is unavailable in this company.');
  if (statement.status !== 'draft') throw new BankReconciliationError('Only a draft statement can be reconciled.');
  const lines = await exec.select().from(bankStatementLine).where(and(
    eq(bankStatementLine.masterFn, scope.masterFn),
    eq(bankStatementLine.companyFn, scope.companyFn),
    eq(bankStatementLine.statementId, statement.id),
  )).orderBy(asc(bankStatementLine.lineNo));
  if (!lines.length || lines.some((line) => line.matchedGlEntryId == null)) {
    throw new BankReconciliationError('Every statement line must be matched before reconciliation.');
  }
  const movement = lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0));
  if (!new Decimal(statement.openingBalance).plus(movement).eq(statement.closingBalance)) {
    throw new BankReconciliationError('Statement balances no longer foot.');
  }
  const now = new Date();
  const [reconciled] = await exec.update(bankStatement).set({
    status: 'reconciled',
    reconciledAt: now,
    version: statement.version + 1,
    updatedAt: now,
  }).where(and(
    eq(bankStatement.masterFn, scope.masterFn),
    eq(bankStatement.companyFn, scope.companyFn),
    eq(bankStatement.id, statement.id),
    eq(bankStatement.version, statement.version),
  )).returning({
    id: bankStatement.id,
    statementNo: bankStatement.statementNo,
    status: bankStatement.status,
    version: bankStatement.version,
    reconciledAt: bankStatement.reconciledAt,
  });
  if (!reconciled) throw new BankReconciliationError('Statement version changed before reconciliation.');
  return { ...reconciled, matchedLineCount: lines.length, movement: movement.toFixed(2) };
}

export function createBankStatement(db: DB, scope: Scope, input: CreateBankStatementInput) {
  return db.transaction((tx) => createBankStatementWithin(tx, scope, input));
}

export function matchBankStatementLine(
  db: DB,
  scope: Scope,
  lineId: number,
  input: MatchBankStatementLineInput,
) {
  return db.transaction((tx) => matchBankStatementLineWithin(tx, scope, lineId, input));
}

export function unmatchBankStatementLine(db: DB, scope: Scope, lineId: number) {
  return db.transaction((tx) => unmatchBankStatementLineWithin(tx, scope, lineId));
}

export function reconcileBankStatement(db: DB, scope: Scope, statementId: number) {
  return db.transaction((tx) => reconcileBankStatementWithin(tx, scope, statementId));
}
