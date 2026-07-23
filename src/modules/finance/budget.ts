import { and, asc, desc, eq } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import {
  account,
  budgetLine,
  budgetVersion,
  company,
} from '../../data/schema';

export interface FinanceScope {
  masterFn: string;
  companyFn: string;
}

export interface BudgetImportRow {
  accountCode: string;
  periodNo: number;
  amount: string;
}

export class BudgetError extends Error {
  constructor(
    public readonly code:
      | 'budget_not_found'
      | 'budget_invalid'
      | 'budget_immutable'
      | 'budget_empty'
      | 'budget_currency_mismatch',
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'BudgetError';
  }
}

function currency(value: unknown): string {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new BudgetError('budget_invalid', 'Currency must use a three-letter ISO code.');
  }
  return normalized;
}

function budgetName(value: unknown): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 120) {
    throw new BudgetError('budget_invalid', 'Budget name must contain 1–120 characters.');
  }
  return normalized;
}

export async function listBudgetVersionsWithin(
  db: DB,
  scope: FinanceScope,
  fiscalYear?: number,
) {
  const conditions = [
    eq(budgetVersion.masterFn, scope.masterFn),
    eq(budgetVersion.companyFn, scope.companyFn),
  ];
  if (fiscalYear != null) conditions.push(eq(budgetVersion.fiscalYear, fiscalYear));
  return db.select().from(budgetVersion)
    .where(and(...conditions))
    .orderBy(desc(budgetVersion.fiscalYear), desc(budgetVersion.id))
    .limit(100);
}

export async function listBudgetLinesWithin(
  db: DB,
  scope: FinanceScope,
  budgetVersionId: number,
) {
  const [version] = await db.select().from(budgetVersion).where(and(
    eq(budgetVersion.id, budgetVersionId),
    eq(budgetVersion.masterFn, scope.masterFn),
    eq(budgetVersion.companyFn, scope.companyFn),
  )).limit(1);
  if (!version) throw new BudgetError('budget_not_found', 'Budget version not found.');
  const rows = await db.select({
    id: budgetLine.id,
    accountId: budgetLine.accountId,
    accountCode: account.code,
    accountName: account.name,
    periodNo: budgetLine.periodNo,
    amount: budgetLine.amount,
  }).from(budgetLine).innerJoin(account, and(
    eq(account.id, budgetLine.accountId),
    eq(account.masterFn, budgetLine.masterFn),
    eq(account.companyFn, budgetLine.companyFn),
  )).where(and(
    eq(budgetLine.masterFn, scope.masterFn),
    eq(budgetLine.companyFn, scope.companyFn),
    eq(budgetLine.budgetVersionId, budgetVersionId),
  )).orderBy(asc(budgetLine.periodNo), asc(account.code), asc(budgetLine.id));
  return { version, rows };
}

export async function createBudgetVersionWithin(
  db: DB,
  scope: FinanceScope,
  input: { fiscalYear: unknown; name: unknown; currency: unknown },
) {
  const fiscalYear = Number(input.fiscalYear);
  if (!Number.isSafeInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2200) {
    throw new BudgetError('budget_invalid', 'Fiscal year must be between 2000 and 2200.');
  }
  const [companyRow] = await db.select({ currency: company.currency }).from(company).where(and(
    eq(company.masterFn, scope.masterFn),
    eq(company.companyFn, scope.companyFn),
  )).limit(1);
  if (!companyRow) throw new BudgetError('budget_invalid', 'Company not found.');
  const inputCurrency = currency(input.currency);
  if (inputCurrency !== companyRow.currency) {
    throw new BudgetError(
      'budget_currency_mismatch',
      'Budget currency must match the company functional currency.',
    );
  }
  const [created] = await db.insert(budgetVersion).values({
    ...scope,
    fiscalYear,
    name: budgetName(input.name),
    currency: inputCurrency,
    status: 'draft',
    isActive: false,
  }).returning();
  return created;
}

export async function importBudgetLinesWithin(
  db: DB,
  scope: FinanceScope,
  budgetVersionId: number,
  rows: BudgetImportRow[],
) {
  const [version] = await db.select().from(budgetVersion).where(and(
    eq(budgetVersion.id, budgetVersionId),
    eq(budgetVersion.masterFn, scope.masterFn),
    eq(budgetVersion.companyFn, scope.companyFn),
  )).limit(1);
  if (!version) throw new BudgetError('budget_not_found', 'Budget version not found.');
  if (version.status !== 'draft') {
    throw new BudgetError('budget_immutable', 'Approved or archived budgets cannot be changed.');
  }
  if (!Array.isArray(rows) || !rows.length || rows.length > 5_000) {
    throw new BudgetError('budget_invalid', 'Import must contain 1–5,000 budget rows.');
  }
  const availableAccounts = await db.select({
    id: account.id,
    code: account.code,
    type: account.type,
  }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
  ));
  const accountByCode = new Map(availableAccounts.map((row) => [row.code, row]));
  const normalized: Array<{
    masterFn: string;
    companyFn: string;
    budgetVersionId: number;
    accountId: number;
    periodNo: number;
    amount: string;
  }> = [];
  const seen = new Set<string>();
  const fieldErrors: Record<string, string> = {};
  rows.forEach((row, index) => {
    const prefix = `rows.${index}`;
    const accountCode = String(row?.accountCode ?? '').trim();
    const matched = accountByCode.get(accountCode);
    const periodNo = Number(row?.periodNo);
    let amount: Decimal | undefined;
    try {
      amount = new Decimal(String(row?.amount ?? ''));
    } catch {
      // Validation below reports a field-level error.
    }
    if (!matched || !['income', 'expense'].includes(matched.type)) {
      fieldErrors[`${prefix}.accountCode`] = 'Use an income or expense account code.';
    }
    if (!Number.isSafeInteger(periodNo) || periodNo < 1 || periodNo > 53) {
      fieldErrors[`${prefix}.periodNo`] = 'Period must be between 1 and 53.';
    }
    if (!amount || !amount.isFinite() || amount.isNegative() || amount.decimalPlaces() > 2) {
      fieldErrors[`${prefix}.amount`] = 'Amount must be a non-negative decimal with two decimals.';
    }
    const key = `${accountCode}:${periodNo}`;
    if (seen.has(key)) fieldErrors[prefix] = 'Duplicate account and period.';
    seen.add(key);
    if (matched && amount && !fieldErrors[prefix]
      && !fieldErrors[`${prefix}.accountCode`]
      && !fieldErrors[`${prefix}.periodNo`]
      && !fieldErrors[`${prefix}.amount`]) {
      normalized.push({
        ...scope,
        budgetVersionId,
        accountId: matched.id,
        periodNo,
        amount: amount.toFixed(2),
      });
    }
  });
  if (Object.keys(fieldErrors).length) {
    throw new BudgetError('budget_invalid', 'Budget import contains invalid rows.', fieldErrors);
  }
  await db.delete(budgetLine).where(and(
    eq(budgetLine.masterFn, scope.masterFn),
    eq(budgetLine.companyFn, scope.companyFn),
    eq(budgetLine.budgetVersionId, budgetVersionId),
  ));
  await db.insert(budgetLine).values(normalized);
  await db.update(budgetVersion).set({
    version: version.version + 1,
    updatedAt: new Date(),
  }).where(eq(budgetVersion.id, budgetVersionId));
  return { budgetVersionId, imported: normalized.length, version: version.version + 1 };
}

export async function approveBudgetWithin(
  db: DB,
  scope: FinanceScope,
  budgetVersionId: number,
  actorUserId: number,
) {
  const [version] = await db.select().from(budgetVersion).where(and(
    eq(budgetVersion.id, budgetVersionId),
    eq(budgetVersion.masterFn, scope.masterFn),
    eq(budgetVersion.companyFn, scope.companyFn),
  )).limit(1);
  if (!version) throw new BudgetError('budget_not_found', 'Budget version not found.');
  if (version.status !== 'draft') {
    throw new BudgetError('budget_immutable', 'Only a draft budget can be approved.');
  }
  const [firstLine] = await db.select({ id: budgetLine.id }).from(budgetLine).where(and(
    eq(budgetLine.masterFn, scope.masterFn),
    eq(budgetLine.companyFn, scope.companyFn),
    eq(budgetLine.budgetVersionId, budgetVersionId),
  )).limit(1);
  if (!firstLine) throw new BudgetError('budget_empty', 'Import budget lines before approval.');
  await db.update(budgetVersion).set({
    status: 'archived',
    isActive: false,
    updatedAt: new Date(),
  }).where(and(
    eq(budgetVersion.masterFn, scope.masterFn),
    eq(budgetVersion.companyFn, scope.companyFn),
    eq(budgetVersion.fiscalYear, version.fiscalYear),
    eq(budgetVersion.status, 'approved'),
    eq(budgetVersion.isActive, true),
  ));
  const now = new Date();
  const [approved] = await db.update(budgetVersion).set({
    status: 'approved',
    isActive: true,
    approvedByUserId: actorUserId,
    approvedAt: now,
    version: version.version + 1,
    updatedAt: now,
  }).where(and(
    eq(budgetVersion.id, budgetVersionId),
    eq(budgetVersion.status, 'draft'),
  )).returning();
  if (!approved) throw new BudgetError('budget_immutable', 'Budget changed before approval.');
  return approved;
}
