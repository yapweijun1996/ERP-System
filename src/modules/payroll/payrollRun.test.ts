import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  account, company, currency, employee, glEntry, master, payrollRunLine,
} from '../../data/schema';
import type { Scope } from '../../data/repo';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createEmployee } from '../hr/employee';
import {
  createPayrollRun,
  postPayrollRun,
  InvalidPayrollRunStateError,
  PostingError,
} from './payrollRun';

const MY_SCOPE: Scope = { masterFn: SCOPE.masterFn, companyFn: 'TEST-C-MY' };

async function seedCompany(db: DB, scope: Scope, country: 'SG' | 'MY') {
  await db.insert(master).values({
    masterFn: scope.masterFn,
    loginCode: `LOGIN-${scope.masterFn}`,
    name: 'Test Master',
  });
  const currencyCode = country === 'SG' ? 'SGD' : 'MYR';
  await db.insert(currency).values({ code: currencyCode, name: currencyCode, symbol: currencyCode });
  await db.insert(company).values({
    companyFn: scope.companyFn, masterFn: scope.masterFn, name: `Test ${country} Co`,
    country, currency: currencyCode, taxRegime: country === 'SG' ? 'GST' : 'SST',
  });
}

async function seedAccounts(db: DB, scope: Scope) {
  await db.insert(account).values([
    { masterFn: scope.masterFn, companyFn: scope.companyFn, code: '6100', name: 'Salary & Wages Expense', type: 'expense' },
    { masterFn: scope.masterFn, companyFn: scope.companyFn, code: '6110', name: 'Employer Statutory Contributions Expense', type: 'expense' },
    { masterFn: scope.masterFn, companyFn: scope.companyFn, code: '2310', name: 'Statutory Contributions Payable', type: 'liability' },
    { masterFn: scope.masterFn, companyFn: scope.companyFn, code: '2320', name: 'Income Tax Payable', type: 'liability' },
    { masterFn: scope.masterFn, companyFn: scope.companyFn, code: '1000', name: 'Cash & Bank', type: 'asset' },
  ]);
}

describe('createPayrollRun + postPayrollRun', () => {
  it('SG: computes CPF lines, posts a balanced GL with no income-tax leg', async () => {
    const db = await freshDb();
    await seedCompany(db, SCOPE, 'SG');
    await seedAccounts(db, SCOPE);
    await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-P1', fullName: 'Employee One', email: 'p1@example.test',
      department: 'Ops', jobTitle: 'Staff', startDate: '2024-01-01', baseSalary: '4000.00',
    });
    await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-P2', fullName: 'Employee Two', email: 'p2@example.test',
      department: 'Ops', jobTitle: 'Staff', startDate: '2024-01-01', baseSalary: '6000.00',
    });

    const run = await createPayrollRun(db, SCOPE, {
      docNo: 'PAY-T1', periodStart: '2026-06-01', periodEnd: '2026-06-30', payDate: '2026-06-28',
    });
    expect(run.lineCount).toBe(2);
    expect(run.totalGrossPay).toBe('10000.00');
    expect(run.totalNetPay).toBe('8000.00');

    const posted = await postPayrollRun(db, SCOPE, run.id);
    expect(posted.totalGrossPay).toBe('10000.00');

    const legs = await db.select().from(glEntry).where(and(
      eq(glEntry.masterFn, SCOPE.masterFn), eq(glEntry.companyFn, SCOPE.companyFn),
      eq(glEntry.journalRef, 'PAY-T1'),
    ));
    // 4 legs, not 5: SG's income-tax leg is skipped since incomeTaxDeduction is 0.
    expect(legs).toHaveLength(4);
    const totalDebit = legs.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = legs.reduce((sum, l) => sum + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
    expect(totalDebit).toBeCloseTo(11725, 2); // 10000 gross + 1725 employer contributions
  });

  it('MY: computes EPF/SOCSO/EIS/PCB lines, posts a balanced GL including the income-tax leg', async () => {
    const db = await freshDb();
    await seedCompany(db, MY_SCOPE, 'MY');
    await seedAccounts(db, MY_SCOPE);
    await createEmployee(db, MY_SCOPE, {
      employeeNo: 'EMP-P3', fullName: 'Employee Three', email: 'p3@example.test',
      department: 'Ops', jobTitle: 'Staff', startDate: '2024-01-01', baseSalary: '5000.00',
    });
    await createEmployee(db, MY_SCOPE, {
      employeeNo: 'EMP-P4', fullName: 'Employee Four', email: 'p4@example.test',
      department: 'Ops', jobTitle: 'Staff', startDate: '2024-01-01', baseSalary: '3000.00',
    });

    const run = await createPayrollRun(db, MY_SCOPE, {
      docNo: 'PAY-T2', periodStart: '2026-06-01', periodEnd: '2026-06-30', payDate: '2026-06-28',
    });
    expect(run.totalGrossPay).toBe('8000.00');
    expect(run.totalNetPay).toBe('6880.00');

    await postPayrollRun(db, MY_SCOPE, run.id);

    const legs = await db.select().from(glEntry).where(and(
      eq(glEntry.masterFn, MY_SCOPE.masterFn), eq(glEntry.companyFn, MY_SCOPE.companyFn),
      eq(glEntry.journalRef, 'PAY-T2'),
    ));
    expect(legs).toHaveLength(5); // MY has a real (approximate) PCB withholding
    const totalDebit = legs.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = legs.reduce((sum, l) => sum + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
    expect(totalDebit).toBeCloseTo(9132, 2); // 8000 gross + 1132 employer contributions
  });

  it('excludes inactive employees from the computed run', async () => {
    const db = await freshDb();
    await seedCompany(db, SCOPE, 'SG');
    await seedAccounts(db, SCOPE);
    const active = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-P5', fullName: 'Active Employee', email: 'p5@example.test',
      department: 'Ops', jobTitle: 'Staff', startDate: '2024-01-01', baseSalary: '4000.00',
    });
    const inactive = await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-P6', fullName: 'Inactive Employee', email: 'p6@example.test',
      department: 'Ops', jobTitle: 'Staff', startDate: '2024-01-01', baseSalary: '4000.00',
    });
    void active;
    await db.update(employee).set({ isActive: false }).where(eq(employee.id, inactive.id));

    const run = await createPayrollRun(db, SCOPE, {
      docNo: 'PAY-T3', periodStart: '2026-06-01', periodEnd: '2026-06-30', payDate: '2026-06-28',
    });
    expect(run.lineCount).toBe(1);
    const lines = await db.select().from(payrollRunLine).where(eq(payrollRunLine.runId, run.id));
    expect(lines).toHaveLength(1);
    expect(lines[0].employeeId).toBe(active.id);
  });

  it('rollback: re-posting an already-posted run is rejected', async () => {
    const db = await freshDb();
    await seedCompany(db, SCOPE, 'SG');
    await seedAccounts(db, SCOPE);
    await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-P7', fullName: 'Employee Seven', email: 'p7@example.test',
      department: 'Ops', jobTitle: 'Staff', startDate: '2024-01-01', baseSalary: '4000.00',
    });
    const run = await createPayrollRun(db, SCOPE, {
      docNo: 'PAY-T4', periodStart: '2026-06-01', periodEnd: '2026-06-30', payDate: '2026-06-28',
    });
    await postPayrollRun(db, SCOPE, run.id);

    await expect(postPayrollRun(db, SCOPE, run.id)).rejects.toThrow(InvalidPayrollRunStateError);

    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'PAY-T4'));
    expect(legs).toHaveLength(4); // no duplicate legs from the rejected re-post
  });

  it('throws PostingError when the chart of accounts is missing a required code', async () => {
    const db = await freshDb();
    await seedCompany(db, SCOPE, 'SG');
    // Deliberately skip seedAccounts.
    await createEmployee(db, SCOPE, {
      employeeNo: 'EMP-P8', fullName: 'Employee Eight', email: 'p8@example.test',
      department: 'Ops', jobTitle: 'Staff', startDate: '2024-01-01', baseSalary: '4000.00',
    });
    const run = await createPayrollRun(db, SCOPE, {
      docNo: 'PAY-T5', periodStart: '2026-06-01', periodEnd: '2026-06-30', payDate: '2026-06-28',
    });
    await expect(postPayrollRun(db, SCOPE, run.id)).rejects.toThrow(PostingError);
  });

  it('throws when there are no active employees to run payroll for', async () => {
    const db = await freshDb();
    await seedCompany(db, SCOPE, 'SG');
    await seedAccounts(db, SCOPE);
    // No employees seeded at all.
    await expect(createPayrollRun(db, SCOPE, {
      docNo: 'PAY-T6', periodStart: '2026-06-01', periodEnd: '2026-06-30', payDate: '2026-06-28',
    })).rejects.toThrow(InvalidPayrollRunStateError);
  });

  it('throws when the company is not found', async () => {
    const db = await freshDb();
    // Deliberately skip seedCompany.
    await expect(createPayrollRun(db, SCOPE, {
      docNo: 'PAY-T7', periodStart: '2026-06-01', periodEnd: '2026-06-30', payDate: '2026-06-28',
    })).rejects.toThrow(InvalidPayrollRunStateError);
  });
});
