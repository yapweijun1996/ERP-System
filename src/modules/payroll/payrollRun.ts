// Payroll -- compute a draft payroll run, then post it as one balanced GL journal,
// mirroring assets/depreciationRun.ts's "one document, one balanced journal via
// accountIdByCode lookup" pattern exactly.
import {
  and, eq, gte, isNull, lte, sql,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  account, company, employee, glEntry, payrollLeaveSource, payrollRun,
  payrollRunLeaveSource, payrollRunLine,
} from '../../data/schema';
import { fixedUnits, fixedString } from '../inventory/decimal';
import { computeStatutoryContributions, type PayrollCountry } from './statutory';

export class InvalidPayrollRunStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPayrollRunStateError';
  }
}

export class PostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostingError';
  }
}

async function accountIdByCode(exec: DB, scope: Scope, code: string): Promise<number> {
  const [row] = await exec.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.code, code),
  ));
  if (!row) throw new PostingError(`Account ${code} not configured`);
  return row.id;
}

export interface CreatePayrollRunInput {
  docNo: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  payDate: string; // YYYY-MM-DD
}

function assertDateFormat(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidPayrollRunStateError(`${label} must be YYYY-MM-DD`);
  }
}

export async function createPayrollRunWithin(
  exec: DB,
  scope: Scope,
  input: CreatePayrollRunInput,
) {
  if (!input.docNo?.trim()) throw new InvalidPayrollRunStateError('docNo is required');
  assertDateFormat(input.periodStart, 'periodStart');
  assertDateFormat(input.periodEnd, 'periodEnd');
  assertDateFormat(input.payDate, 'payDate');
  if (input.periodEnd < input.periodStart) {
    throw new InvalidPayrollRunStateError('periodEnd must not be before periodStart');
  }

  const [companyRow] = await exec.select({ country: company.country }).from(company).where(and(
    eq(company.masterFn, scope.masterFn),
    eq(company.companyFn, scope.companyFn),
  ));
  if (!companyRow) {
    throw new InvalidPayrollRunStateError(`Company ${scope.companyFn} not found`);
  }
  const country = companyRow.country as PayrollCountry;

  const employees = await exec.select().from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.isActive, true),
  )).orderBy(employee.id);

  if (employees.length === 0) {
    throw new InvalidPayrollRunStateError('No active employees to run payroll for');
  }

  const leaveSources = await exec.select({
    id: payrollLeaveSource.id,
    employeeId: payrollLeaveSource.employeeId,
    effectDirection: payrollLeaveSource.effectDirection,
    amount: payrollLeaveSource.amount,
  }).from(payrollLeaveSource)
    .leftJoin(payrollRunLeaveSource, and(
      eq(payrollRunLeaveSource.masterFn, payrollLeaveSource.masterFn),
      eq(payrollRunLeaveSource.companyFn, payrollLeaveSource.companyFn),
      eq(payrollRunLeaveSource.sourceId, payrollLeaveSource.id),
    ))
    .where(and(
      eq(payrollLeaveSource.masterFn, scope.masterFn),
      eq(payrollLeaveSource.companyFn, scope.companyFn),
      gte(payrollLeaveSource.effectiveDate, input.periodStart),
      lte(payrollLeaveSource.effectiveDate, input.periodEnd),
      isNull(payrollRunLeaveSource.id),
    ))
    .orderBy(payrollLeaveSource.id);
  const sourcesByEmployee = new Map<number, typeof leaveSources>();
  for (const source of leaveSources) {
    const rows = sourcesByEmployee.get(source.employeeId) ?? [];
    rows.push(source);
    sourcesByEmployee.set(source.employeeId, rows);
  }
  const lines = employees.map((row) => {
    const sources = sourcesByEmployee.get(row.id) ?? [];
    const earningCents = sources
      .filter((source) => source.effectDirection === 'earning')
      .reduce((sum, source) => sum + fixedUnits(source.amount, 2), 0n);
    const deductionCents = sources
      .filter((source) => source.effectDirection === 'deduction')
      .reduce((sum, source) => sum + fixedUnits(source.amount, 2), 0n);
    const baseCents = fixedUnits(row.baseSalary, 2);
    const grossCents = baseCents + earningCents - deductionCents;
    if (grossCents < 0n) {
      throw new InvalidPayrollRunStateError(
        `Leave deductions exceed gross earnings for employee ${row.employeeNo}.`,
      );
    }
    const grossPay = fixedString(grossCents, 2);
    const contributions = computeStatutoryContributions(country, grossPay);
    return {
      employeeId: row.id,
      baseGrossPay: row.baseSalary,
      leaveEarnings: fixedString(earningCents, 2),
      leaveDeductions: fixedString(deductionCents, 2),
      grossPay,
      sources,
      ...contributions,
    };
  });

  const totalGrossCents = lines.reduce((sum, line) => sum + fixedUnits(line.grossPay, 2), 0n);
  const totalNetCents = lines.reduce((sum, line) => sum + fixedUnits(line.netPay, 2), 0n);

  const [run] = await exec.insert(payrollRun).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo: input.docNo.trim(),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    payDate: input.payDate,
    status: 'draft',
    totalGrossPay: fixedString(totalGrossCents, 2),
    totalNetPay: fixedString(totalNetCents, 2),
  }).returning({ id: payrollRun.id });

  const createdLines = await exec.insert(payrollRunLine).values(lines.map((line, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    runId: run.id,
    lineNo: index + 1,
    employeeId: line.employeeId,
    baseGrossPay: line.baseGrossPay,
    leaveEarnings: line.leaveEarnings,
    leaveDeductions: line.leaveDeductions,
    grossPay: line.grossPay,
    employeeStatutoryDeduction: line.employeeStatutoryDeduction,
    incomeTaxDeduction: line.incomeTaxDeduction,
    employerStatutoryContribution: line.employerStatutoryContribution,
    employerAdditionalContribution: line.employerAdditionalContribution,
    netPay: line.netPay,
  }))).returning({
    id: payrollRunLine.id,
    employeeId: payrollRunLine.employeeId,
  });
  const lineIdByEmployee = new Map(createdLines.map((line) => [line.employeeId, line.id]));
  const appliedSources = lines.flatMap((line) => line.sources.map((source) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    runId: run.id,
    runLineId: lineIdByEmployee.get(line.employeeId)!,
    sourceId: source.id,
    effectAmount: source.effectDirection === 'earning'
      ? source.amount
      : fixedString(-fixedUnits(source.amount, 2), 2),
  })));
  if (appliedSources.length) {
    await exec.insert(payrollRunLeaveSource).values(appliedSources);
  }

  return {
    id: run.id,
    docNo: input.docNo.trim(),
    totalGrossPay: fixedString(totalGrossCents, 2),
    totalNetPay: fixedString(totalNetCents, 2),
    lineCount: lines.length,
    leaveSourceCount: appliedSources.length,
  };
}

export function createPayrollRun(db: DB, scope: Scope, input: CreatePayrollRunInput) {
  return db.transaction((tx) => createPayrollRunWithin(tx, scope, input));
}

export async function postPayrollRunWithin(exec: DB, scope: Scope, runId: number) {
  const [run] = await exec.select().from(payrollRun).where(and(
    eq(payrollRun.masterFn, scope.masterFn),
    eq(payrollRun.companyFn, scope.companyFn),
    eq(payrollRun.id, runId),
  )).for('update');
  if (!run) throw new InvalidPayrollRunStateError(`Payroll run ${runId} not found`);
  if (run.status !== 'draft') {
    throw new InvalidPayrollRunStateError(
      `Payroll run ${runId} is '${run.status}', not 'draft' — cannot post it again`,
    ); // → ROLLBACK
  }

  const lines = await exec.select().from(payrollRunLine).where(and(
    eq(payrollRunLine.masterFn, scope.masterFn),
    eq(payrollRunLine.companyFn, scope.companyFn),
    eq(payrollRunLine.runId, runId),
  ));

  let employeeStatutoryCents = 0n;
  let employerStatutoryCents = 0n;
  let employerAdditionalCents = 0n;
  let incomeTaxCents = 0n;
  let netPayCents = 0n;
  for (const line of lines) {
    employeeStatutoryCents += fixedUnits(line.employeeStatutoryDeduction, 2);
    employerStatutoryCents += fixedUnits(line.employerStatutoryContribution, 2);
    employerAdditionalCents += fixedUnits(line.employerAdditionalContribution, 2);
    incomeTaxCents += fixedUnits(line.incomeTaxDeduction, 2);
    netPayCents += fixedUnits(line.netPay, 2);
  }
  const employerContributionCents = employerStatutoryCents + employerAdditionalCents;
  const statutoryPayableCents = employeeStatutoryCents + employerContributionCents;

  const salaryExpenseId = await accountIdByCode(exec, scope, '6100'); // Salary & Wages Expense
  const employerContribExpenseId = await accountIdByCode(exec, scope, '6110'); // Employer Statutory Contributions Expense
  const statutoryPayableId = await accountIdByCode(exec, scope, '2310'); // Statutory Contributions Payable
  const incomeTaxPayableId = await accountIdByCode(exec, scope, '2320'); // Income Tax Payable
  const cashId = await accountIdByCode(exec, scope, '1000'); // Cash & Bank

  const legs: { accountId: number; debit: string; credit: string; memo: string }[] = [
    { accountId: salaryExpenseId, debit: run.totalGrossPay, credit: '0', memo: 'Salary & wages expense' },
    {
      accountId: employerContribExpenseId,
      debit: fixedString(employerContributionCents, 2),
      credit: '0',
      memo: 'Employer statutory contributions expense',
    },
    {
      accountId: statutoryPayableId,
      debit: '0',
      credit: fixedString(statutoryPayableCents, 2),
      memo: 'Statutory contributions payable (employee + employer)',
    },
    // Singapore's incomeTaxBps is correctly 0 (no monthly withholding) -- skip
    // posting a zero-value leg rather than fabricating a $0 payable line.
    ...(incomeTaxCents > 0n ? [{
      accountId: incomeTaxPayableId,
      debit: '0',
      credit: fixedString(incomeTaxCents, 2),
      memo: 'Income tax payable',
    }] : []),
    { accountId: cashId, debit: '0', credit: fixedString(netPayCents, 2), memo: 'Net pay disbursed' },
  ];

  await exec.insert(glEntry).values(legs.map((leg) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    journalRef: run.docNo,
    accountId: leg.accountId,
    debit: leg.debit,
    credit: leg.credit,
    memo: leg.memo,
  })));

  const [posted] = await exec.update(payrollRun).set({
    status: 'posted',
    postedAt: sql`now()`,
    version: sql`${payrollRun.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(payrollRun.masterFn, scope.masterFn),
    eq(payrollRun.companyFn, scope.companyFn),
    eq(payrollRun.id, runId),
  )).returning({
    id: payrollRun.id, docNo: payrollRun.docNo, totalGrossPay: payrollRun.totalGrossPay, totalNetPay: payrollRun.totalNetPay,
  });

  return posted;
}

export function postPayrollRun(db: DB, scope: Scope, runId: number) {
  return db.transaction((tx) => postPayrollRunWithin(tx, scope, runId));
}
