import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sum,
} from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  account,
  accountingPeriod,
  budgetLine,
  budgetVersion,
  company,
  consolidationRate,
  financialStatementAccountMap,
  glEntry,
  userCompany,
} from '../../data/schema';

export type ProfitLossComparison = 'budget' | 'prior_period' | 'prior_year';

export interface ProfitLossRequest {
  masterFn: string;
  activeCompanyFn: string;
  actorUserId: number;
  periodId?: number;
  companyFns?: string[];
  presentationCurrency?: string;
  comparison?: ProfitLossComparison;
}

export interface ProfitLossWarning {
  code: 'no_approved_budget' | 'unmapped_accounts' | 'comparison_unavailable';
  companyFn?: string;
  detail?: string;
}

export interface ProfitLossAmountSet {
  actualPeriod: string;
  actualYtd: string;
  comparisonPeriod: string;
  comparisonYtd: string;
  variancePeriod: string;
  varianceYtd: string;
  variancePercentPeriod: string | null;
  variancePercentYtd: string | null;
  favorablePeriod: boolean | null;
  favorableYtd: boolean | null;
}

export interface ProfitLossRow extends ProfitLossAmountSet {
  key: string;
  accountCode: string;
  accountName: string;
  mapped: boolean;
}

export interface ProfitLossSection extends ProfitLossAmountSet {
  key: string;
  rows: ProfitLossRow[];
  subtotal: ProfitLossAmountSet;
}

export interface ProfitLossReport {
  data: {
    scope: 'company' | 'consolidated';
    period: {
      id: number;
      fiscalYear: number;
      periodNo: number;
      label: string;
      startDate: string;
      endDate: string;
    };
    presentationCurrency: string;
    comparison: ProfitLossComparison;
    metrics: {
      revenue: string;
      grossProfit: string;
      operatingExpenses: string;
      netProfit: string;
      netMargin: string | null;
    };
    sections: ProfitLossSection[];
    totals: ProfitLossAmountSet;
    warnings: ProfitLossWarning[];
  };
  meta: {
    generatedAt: string;
    companies: Array<{
      companyFn: string;
      name: string;
      currency: string;
      budgetVersionId: number | null;
      consolidationRates: Array<{
        id: number;
        fiscalYear: number;
        periodNo: number;
        fromCurrency: string;
        toCurrency: string;
        averageRate: string;
      }>;
    }>;
    source: 'posted_gl';
    accountingBasis: 'accrual';
  };
}

export class ProfitLossError extends Error {
  constructor(
    public readonly code:
      | 'invalid_report_query'
      | 'company_access_denied'
      | 'period_not_found'
      | 'incompatible_fiscal_calendar'
      | 'missing_consolidation_rate',
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'ProfitLossError';
  }
}

const SECTION_ORDER = [
  'revenue',
  'cost_of_sales',
  'operating_expense',
  'other_income',
  'other_expense',
  'tax',
  'unmapped',
] as const;

type Period = typeof accountingPeriod.$inferSelect;
type CompanyRow = Pick<typeof company.$inferSelect, 'companyFn' | 'name' | 'currency'>;
type SectionKey = typeof SECTION_ORDER[number];

interface AccountDefinition {
  id: number;
  code: string;
  name: string;
  type: string;
  section: SectionKey;
  displayOrder: number;
  signPolicy: 'positive' | 'negative';
  mapped: boolean;
}

interface NaturalPeriodAmounts {
  period: Period;
  byAccount: Map<number, Decimal>;
}

interface CompanyStatement {
  company: CompanyRow;
  budgetVersionId: number | null;
  consolidationRates: Array<{
    id: number;
    fiscalYear: number;
    periodNo: number;
    fromCurrency: string;
    toCurrency: string;
    averageRate: string;
  }>;
  accounts: Array<{
    definition: AccountDefinition;
    actualPeriod: Decimal;
    actualYtd: Decimal;
    comparisonPeriod: Decimal;
    comparisonYtd: Decimal;
  }>;
  warnings: ProfitLossWarning[];
}

function decimal(value: unknown): Decimal {
  return new Decimal(value == null || value === '' ? 0 : String(value));
}

function isoStart(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoEndExclusive(value: string): Date {
  const result = isoStart(value);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

function normalizedCurrency(value: unknown, fallback: string): string {
  const currencyCode = String(value || fallback).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw new ProfitLossError(
      'invalid_report_query',
      'presentationCurrency must be a three-letter currency code.',
    );
  }
  return currencyCode;
}

function normalizedComparison(value: unknown): ProfitLossComparison {
  const comparison = String(value || 'budget') as ProfitLossComparison;
  if (!['budget', 'prior_period', 'prior_year'].includes(comparison)) {
    throw new ProfitLossError(
      'invalid_report_query',
      'comparison must be budget, prior_period or prior_year.',
    );
  }
  return comparison;
}

function amountSet(
  actualPeriod: Decimal,
  actualYtd: Decimal,
  comparisonPeriod: Decimal,
  comparisonYtd: Decimal,
): ProfitLossAmountSet {
  const periodVariance = actualPeriod.minus(comparisonPeriod);
  const ytdVariance = actualYtd.minus(comparisonYtd);
  const percentage = (variance: Decimal, reference: Decimal) =>
    reference.isZero() ? null : variance.div(reference.abs()).mul(100).toFixed(1);
  return {
    actualPeriod: actualPeriod.toFixed(2),
    actualYtd: actualYtd.toFixed(2),
    comparisonPeriod: comparisonPeriod.toFixed(2),
    comparisonYtd: comparisonYtd.toFixed(2),
    variancePeriod: periodVariance.toFixed(2),
    varianceYtd: ytdVariance.toFixed(2),
    variancePercentPeriod: percentage(periodVariance, comparisonPeriod),
    variancePercentYtd: percentage(ytdVariance, comparisonYtd),
    favorablePeriod: comparisonPeriod.isZero() ? null : periodVariance.gte(0),
    favorableYtd: comparisonYtd.isZero() ? null : ytdVariance.gte(0),
  };
}

function naturalBalance(accountType: string, debit: unknown, credit: unknown): Decimal {
  if (accountType === 'income') return decimal(credit).minus(decimal(debit));
  return decimal(debit).minus(decimal(credit));
}

function statementAmount(value: Decimal, signPolicy: 'positive' | 'negative'): Decimal {
  return signPolicy === 'negative' ? value.negated() : value;
}

async function authorisedCompanies(
  db: DB,
  masterFn: string,
  actorUserId: number,
): Promise<CompanyRow[]> {
  return db.select({
    companyFn: company.companyFn,
    name: company.name,
    currency: company.currency,
  }).from(userCompany).innerJoin(company, eq(company.companyFn, userCompany.companyFn))
    .where(and(
      eq(userCompany.userId, actorUserId),
      eq(company.masterFn, masterFn),
    ))
    .orderBy(asc(company.name), asc(company.companyFn));
}

export async function getProfitLossOptions(
  db: DB,
  input: Pick<ProfitLossRequest, 'masterFn' | 'activeCompanyFn' | 'actorUserId'>,
) {
  const companies = await authorisedCompanies(db, input.masterFn, input.actorUserId);
  if (!companies.some((row) => row.companyFn === input.activeCompanyFn)) {
    throw new ProfitLossError('company_access_denied', 'The active company is unavailable.');
  }
  const periods = await withTenantTransaction(
    db,
    { masterFn: input.masterFn, companyFn: input.activeCompanyFn },
    (tx) => tx.select({
      id: accountingPeriod.id,
      fiscalYear: accountingPeriod.fiscalYear,
      periodNo: accountingPeriod.periodNo,
      label: accountingPeriod.label,
      startDate: accountingPeriod.startDate,
      endDate: accountingPeriod.endDate,
      status: accountingPeriod.status,
    }).from(accountingPeriod).where(and(
      eq(accountingPeriod.masterFn, input.masterFn),
      eq(accountingPeriod.companyFn, input.activeCompanyFn),
    )).orderBy(desc(accountingPeriod.endDate), desc(accountingPeriod.id)),
  );
  return {
    companies,
    periods,
    presentationCurrencies: [...new Set(companies.map((row) => row.currency))].sort(),
    comparisons: ['budget', 'prior_period', 'prior_year'] as ProfitLossComparison[],
    accountingBasis: 'accrual' as const,
  };
}

async function aggregatePeriod(
  exec: DB,
  masterFn: string,
  companyFn: string,
  period: Period,
  accountTypes: Map<number, string>,
): Promise<NaturalPeriodAmounts> {
  const rows = await exec.select({
    accountId: glEntry.accountId,
    debit: sum(glEntry.debit),
    credit: sum(glEntry.credit),
  }).from(glEntry).where(and(
    eq(glEntry.masterFn, masterFn),
    eq(glEntry.companyFn, companyFn),
    gte(glEntry.postedAt, isoStart(period.startDate)),
    lte(glEntry.postedAt, new Date(isoEndExclusive(period.endDate).getTime() - 1)),
  )).groupBy(glEntry.accountId);
  const byAccount = new Map<number, Decimal>();
  for (const row of rows) {
    const accountType = accountTypes.get(row.accountId);
    if (!accountType) continue;
    const amount = naturalBalance(accountType, row.debit, row.credit);
    byAccount.set(row.accountId, (byAccount.get(row.accountId) ?? new Decimal(0)).plus(amount));
  }
  return { period, byAccount };
}

async function buildCompanyStatement(
  exec: DB,
  input: {
    masterFn: string;
    company: CompanyRow;
    anchor: Period;
    presentationCurrency: string;
    comparison: ProfitLossComparison;
  },
): Promise<CompanyStatement> {
  const { masterFn, company: companyRow, anchor, presentationCurrency, comparison } = input;
  const scopePredicates = [
    eq(accountingPeriod.masterFn, masterFn),
    eq(accountingPeriod.companyFn, companyRow.companyFn),
  ];
  const periods = await exec.select().from(accountingPeriod)
    .where(and(
      ...scopePredicates,
      gte(accountingPeriod.fiscalYear, anchor.fiscalYear - 1),
      lte(accountingPeriod.fiscalYear, anchor.fiscalYear),
    ))
    .orderBy(asc(accountingPeriod.startDate), asc(accountingPeriod.id));
  const current = periods.find((period) =>
    period.fiscalYear === anchor.fiscalYear
    && period.periodNo === anchor.periodNo
    && period.startDate === anchor.startDate
    && period.endDate === anchor.endDate);
  if (!current) {
    throw new ProfitLossError(
      'incompatible_fiscal_calendar',
      `${companyRow.name} has no compatible ${anchor.label} accounting period.`,
      { companyFn: companyRow.companyFn },
    );
  }
  const currentYtd = periods.filter((period) =>
    period.fiscalYear === current.fiscalYear && period.periodNo <= current.periodNo);
  const previous = periods.filter((period) => period.endDate < current.startDate).at(-1) ?? null;
  const previousYtd = previous
    ? periods.filter((period) =>
      period.fiscalYear === previous.fiscalYear && period.periodNo <= previous.periodNo)
    : [];
  const priorYearPeriod = periods.find((period) =>
    period.fiscalYear === current.fiscalYear - 1 && period.periodNo === current.periodNo) ?? null;
  const priorYearYtd = priorYearPeriod
    ? periods.filter((period) =>
      period.fiscalYear === priorYearPeriod.fiscalYear
      && period.periodNo <= priorYearPeriod.periodNo)
    : [];
  const requiredPeriods = new Map<number, Period>();
  currentYtd.forEach((period) => requiredPeriods.set(period.id, period));
  if (comparison === 'prior_period') {
    previousYtd.forEach((period) => requiredPeriods.set(period.id, period));
  }
  if (comparison === 'prior_year') {
    priorYearYtd.forEach((period) => requiredPeriods.set(period.id, period));
  }

  const definitions = await exec.select({
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    section: financialStatementAccountMap.section,
    displayOrder: financialStatementAccountMap.displayOrder,
    signPolicy: financialStatementAccountMap.signPolicy,
  }).from(account).leftJoin(financialStatementAccountMap, and(
    eq(financialStatementAccountMap.masterFn, account.masterFn),
    eq(financialStatementAccountMap.companyFn, account.companyFn),
    eq(financialStatementAccountMap.accountId, account.id),
  )).where(and(
    eq(account.masterFn, masterFn),
    eq(account.companyFn, companyRow.companyFn),
    inArray(account.type, ['income', 'expense']),
  )).orderBy(asc(account.code), asc(account.id));
  const accounts: AccountDefinition[] = definitions.map((row) => {
    const mapped = row.section != null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      section: mapped ? row.section as SectionKey : 'unmapped',
      displayOrder: row.displayOrder ?? (Number(row.code) || 0),
      signPolicy: mapped
        ? row.signPolicy as 'positive' | 'negative'
        : row.type === 'income' ? 'positive' : 'negative',
      mapped,
    };
  });
  const accountTypes = new Map(accounts.map((row) => [row.id, row.type]));
  const periodAmounts = new Map<number, NaturalPeriodAmounts>();
  for (const period of requiredPeriods.values()) {
    periodAmounts.set(
      period.id,
      await aggregatePeriod(exec, masterFn, companyRow.companyFn, period, accountTypes),
    );
  }

  const [activeBudget] = await exec.select().from(budgetVersion).where(and(
    eq(budgetVersion.masterFn, masterFn),
    eq(budgetVersion.companyFn, companyRow.companyFn),
    eq(budgetVersion.fiscalYear, current.fiscalYear),
    eq(budgetVersion.status, 'approved'),
    eq(budgetVersion.isActive, true),
  )).orderBy(desc(budgetVersion.id)).limit(1);
  const budgetRows = activeBudget
    ? await exec.select({
      accountId: budgetLine.accountId,
      periodNo: budgetLine.periodNo,
      amount: budgetLine.amount,
    }).from(budgetLine).where(and(
      eq(budgetLine.masterFn, masterFn),
      eq(budgetLine.companyFn, companyRow.companyFn),
      eq(budgetLine.budgetVersionId, activeBudget.id),
    ))
    : [];
  const budgets = new Map<string, Decimal>();
  for (const row of budgetRows) budgets.set(`${row.accountId}:${row.periodNo}`, decimal(row.amount));

  const years = [...new Set([...requiredPeriods.values()].map((period) => period.fiscalYear))];
  const rates = companyRow.currency === presentationCurrency || years.length === 0
    ? []
    : await exec.select().from(consolidationRate).where(and(
      eq(consolidationRate.masterFn, masterFn),
      eq(consolidationRate.companyFn, companyRow.companyFn),
      eq(consolidationRate.fromCurrency, companyRow.currency),
      eq(consolidationRate.toCurrency, presentationCurrency),
      eq(consolidationRate.status, 'approved'),
      inArray(consolidationRate.fiscalYear, years),
    ));
  const rateByPeriod = new Map(
    rates.map((row) => [`${row.fiscalYear}:${row.periodNo}`, decimal(row.averageRate)]),
  );
  const missingRates = new Set<string>();
  const translate = (value: Decimal, period: Period): Decimal => {
    if (value.isZero() || companyRow.currency === presentationCurrency) return value;
    const key = `${period.fiscalYear}:${period.periodNo}`;
    const rate = rateByPeriod.get(key);
    if (!rate) {
      missingRates.add(key);
      return new Decimal(0);
    }
    return value.mul(rate);
  };
  const periodValue = (accountId: number, period: Period | null): Decimal => {
    if (!period) return new Decimal(0);
    return translate(periodAmounts.get(period.id)?.byAccount.get(accountId) ?? new Decimal(0), period);
  };
  const periodSum = (accountId: number, selected: Period[]): Decimal =>
    selected.reduce((sum, period) => sum.plus(periodValue(accountId, period)), new Decimal(0));
  const budgetValue = (
    definition: AccountDefinition,
    selected: Period[],
  ): Decimal => selected.reduce((sum, period) => {
    const natural = budgets.get(`${definition.id}:${period.periodNo}`) ?? new Decimal(0);
    return sum.plus(translate(statementAmount(natural, definition.signPolicy), period));
  }, new Decimal(0));

  const accountRows = accounts.map((definition) => {
    const actualPeriod = statementAmount(periodValue(definition.id, current), definition.signPolicy);
    const actualYtd = statementAmount(periodSum(definition.id, currentYtd), definition.signPolicy);
    const [comparisonPeriod, comparisonYtd] = comparison === 'budget'
      ? [budgetValue(definition, [current]), budgetValue(definition, currentYtd)]
      : comparison === 'prior_period'
        ? [
          statementAmount(periodValue(definition.id, previous), definition.signPolicy),
          statementAmount(periodSum(definition.id, previousYtd), definition.signPolicy),
        ]
        : [
          statementAmount(periodValue(definition.id, priorYearPeriod), definition.signPolicy),
          statementAmount(periodSum(definition.id, priorYearYtd), definition.signPolicy),
        ];
    return { definition, actualPeriod, actualYtd, comparisonPeriod, comparisonYtd };
  });
  if (missingRates.size) {
    throw new ProfitLossError(
      'missing_consolidation_rate',
      `Approved ${companyRow.currency}/${presentationCurrency} consolidation rates are missing.`,
      {
        companyFn: companyRow.companyFn,
        periods: [...missingRates].sort(),
        fromCurrency: companyRow.currency,
        toCurrency: presentationCurrency,
      },
    );
  }
  const warnings: ProfitLossWarning[] = [];
  if (comparison === 'budget' && !activeBudget) {
    warnings.push({ code: 'no_approved_budget', companyFn: companyRow.companyFn });
  }
  const unmapped = accounts.filter((row) => !row.mapped);
  if (unmapped.length) {
    warnings.push({
      code: 'unmapped_accounts',
      companyFn: companyRow.companyFn,
      detail: unmapped.map((row) => row.code).join(', '),
    });
  }
  if (
    (comparison === 'prior_period' && !previous)
    || (comparison === 'prior_year' && !priorYearPeriod)
  ) {
    warnings.push({ code: 'comparison_unavailable', companyFn: companyRow.companyFn });
  }
  return {
    company: companyRow,
    budgetVersionId: activeBudget?.id ?? null,
    consolidationRates: rates.map((row) => ({
      id: row.id,
      fiscalYear: row.fiscalYear,
      periodNo: row.periodNo,
      fromCurrency: row.fromCurrency,
      toCurrency: row.toCurrency,
      averageRate: String(row.averageRate),
    })),
    accounts: accountRows,
    warnings,
  };
}

export async function buildProfitLossReport(
  db: DB,
  request: ProfitLossRequest,
  generatedAt = new Date(),
): Promise<ProfitLossReport> {
  const available = await authorisedCompanies(db, request.masterFn, request.actorUserId);
  const availableByFn = new Map(available.map((row) => [row.companyFn, row]));
  const selectedFns = [...new Set(
    (request.companyFns?.length ? request.companyFns : [request.activeCompanyFn])
      .map((value) => String(value).trim())
      .filter(Boolean),
  )].sort();
  if (!selectedFns.length) {
    throw new ProfitLossError('invalid_report_query', 'At least one company is required.');
  }
  const denied = selectedFns.filter((companyFn) => !availableByFn.has(companyFn));
  if (denied.length) {
    throw new ProfitLossError(
      'company_access_denied',
      'One or more selected companies are not assigned to this user.',
      { companyFns: denied },
    );
  }
  const activeCompany = availableByFn.get(request.activeCompanyFn);
  if (!activeCompany) {
    throw new ProfitLossError('company_access_denied', 'The active company is unavailable.');
  }
  const anchor = await withTenantTransaction(
    db,
    { masterFn: request.masterFn, companyFn: request.activeCompanyFn },
    async (tx) => {
      const predicates = [
        eq(accountingPeriod.masterFn, request.masterFn),
        eq(accountingPeriod.companyFn, request.activeCompanyFn),
      ];
      if (request.periodId != null) {
        if (!Number.isSafeInteger(request.periodId) || Number(request.periodId) <= 0) {
          throw new ProfitLossError(
            'invalid_report_query',
            'periodId must be a positive integer.',
          );
        }
        predicates.push(eq(accountingPeriod.id, Number(request.periodId)));
      }
      const [period] = await tx.select().from(accountingPeriod)
        .where(and(...predicates))
        .orderBy(desc(accountingPeriod.endDate), desc(accountingPeriod.id))
        .limit(1);
      return period;
    },
  );
  if (!anchor) {
    throw new ProfitLossError('period_not_found', 'The selected accounting period is unavailable.');
  }
  const presentationCurrency = normalizedCurrency(
    request.presentationCurrency,
    activeCompany.currency,
  );
  const comparison = normalizedComparison(request.comparison);
  const companyStatements: CompanyStatement[] = [];
  for (const companyFn of selectedFns) {
    const selectedCompany = availableByFn.get(companyFn)!;
    companyStatements.push(await withTenantTransaction(
      db,
      { masterFn: request.masterFn, companyFn },
      (tx) => buildCompanyStatement(tx, {
        masterFn: request.masterFn,
        company: selectedCompany,
        anchor,
        presentationCurrency,
        comparison,
      }),
    ));
  }

  const combined = new Map<string, {
    definition: AccountDefinition;
    actualPeriod: Decimal;
    actualYtd: Decimal;
    comparisonPeriod: Decimal;
    comparisonYtd: Decimal;
  }>();
  for (const statement of companyStatements) {
    for (const row of statement.accounts) {
      const key = `${row.definition.section}:${row.definition.code}`;
      const current = combined.get(key);
      if (!current) {
        combined.set(key, { ...row, definition: { ...row.definition } });
        continue;
      }
      current.actualPeriod = current.actualPeriod.plus(row.actualPeriod);
      current.actualYtd = current.actualYtd.plus(row.actualYtd);
      current.comparisonPeriod = current.comparisonPeriod.plus(row.comparisonPeriod);
      current.comparisonYtd = current.comparisonYtd.plus(row.comparisonYtd);
      current.definition.mapped = current.definition.mapped && row.definition.mapped;
    }
  }
  const sections = SECTION_ORDER.flatMap((sectionKey): ProfitLossSection[] => {
    const rows = [...combined.values()]
      .filter((row) => row.definition.section === sectionKey)
      .sort((a, b) =>
        a.definition.displayOrder - b.definition.displayOrder
        || a.definition.code.localeCompare(b.definition.code))
      .map((row) => ({
        key: `${sectionKey}:${row.definition.code}`,
        accountCode: row.definition.code,
        accountName: row.definition.name,
        mapped: row.definition.mapped,
        ...amountSet(
          row.actualPeriod,
          row.actualYtd,
          row.comparisonPeriod,
          row.comparisonYtd,
        ),
      }));
    if (!rows.length) return [];
    const total = rows.reduce((sum, row) => ({
      actualPeriod: sum.actualPeriod.plus(row.actualPeriod),
      actualYtd: sum.actualYtd.plus(row.actualYtd),
      comparisonPeriod: sum.comparisonPeriod.plus(row.comparisonPeriod),
      comparisonYtd: sum.comparisonYtd.plus(row.comparisonYtd),
    }), {
      actualPeriod: new Decimal(0),
      actualYtd: new Decimal(0),
      comparisonPeriod: new Decimal(0),
      comparisonYtd: new Decimal(0),
    });
    const subtotal = amountSet(
      total.actualPeriod,
      total.actualYtd,
      total.comparisonPeriod,
      total.comparisonYtd,
    );
    return [{ key: sectionKey, rows, subtotal, ...subtotal }];
  });

  const sectionValue = (key: string, field: keyof Pick<
    ProfitLossAmountSet,
    'actualPeriod' | 'actualYtd' | 'comparisonPeriod' | 'comparisonYtd'
  >) => decimal(sections.find((section) => section.key === key)?.subtotal[field]);
  const totals = sections.reduce((sum, section) => ({
    actualPeriod: sum.actualPeriod.plus(section.subtotal.actualPeriod),
    actualYtd: sum.actualYtd.plus(section.subtotal.actualYtd),
    comparisonPeriod: sum.comparisonPeriod.plus(section.subtotal.comparisonPeriod),
    comparisonYtd: sum.comparisonYtd.plus(section.subtotal.comparisonYtd),
  }), {
    actualPeriod: new Decimal(0),
    actualYtd: new Decimal(0),
    comparisonPeriod: new Decimal(0),
    comparisonYtd: new Decimal(0),
  });
  const totalSet = amountSet(
    totals.actualPeriod,
    totals.actualYtd,
    totals.comparisonPeriod,
    totals.comparisonYtd,
  );
  const revenue = sectionValue('revenue', 'actualYtd');
  const grossProfit = revenue.plus(sectionValue('cost_of_sales', 'actualYtd'));
  const operatingExpenses = sectionValue('operating_expense', 'actualYtd').abs();
  const netProfit = decimal(totalSet.actualYtd);
  return {
    data: {
      scope: selectedFns.length > 1 ? 'consolidated' : 'company',
      period: {
        id: anchor.id,
        fiscalYear: anchor.fiscalYear,
        periodNo: anchor.periodNo,
        label: anchor.label,
        startDate: anchor.startDate,
        endDate: anchor.endDate,
      },
      presentationCurrency,
      comparison,
      metrics: {
        revenue: revenue.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        operatingExpenses: operatingExpenses.toFixed(2),
        netProfit: netProfit.toFixed(2),
        netMargin: revenue.isZero() ? null : netProfit.div(revenue.abs()).mul(100).toFixed(1),
      },
      sections,
      totals: totalSet,
      warnings: companyStatements.flatMap((statement) => statement.warnings),
    },
    meta: {
      generatedAt: generatedAt.toISOString(),
      companies: companyStatements.map((statement) => ({
        ...statement.company,
        budgetVersionId: statement.budgetVersionId,
        consolidationRates: statement.consolidationRates,
      })),
      source: 'posted_gl',
      accountingBasis: 'accrual',
    },
  };
}
