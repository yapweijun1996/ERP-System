import { and, eq, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  account,
  appUser,
  cashAdvanceApplication,
  cashAdvanceEvent,
  cashAdvancePosting,
  employee,
  expenseAllowanceCalculation,
  glEntry,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { freshDb } from '../../test/helpers';
import {
  approveAllowanceCalculationWithin,
  calculateAllowance,
  closeCashAdvance,
  configureAllowancePolicyVersion,
  issueCashAdvance,
} from './allowancesAdvances';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

async function setup(rate = '0.7500') {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  const [viewerEmployee] = await db.select().from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.userId, viewer.userId),
  ));
  const accounts = await db.select().from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
  ));
  const accountId = (code: string) => accounts.find((row) => row.code === code)!.id;
  await configureAllowancePolicyVersion(db, scope, admin.userId, {
    policyKey: 'mileage-standard',
    versionNo: 1,
    allowanceType: 'mileage',
    unit: 'km',
    rate,
    currency: 'SGD',
    maximumUnits: '1000',
    effectiveFrom: '2026-01-01',
  });
  return {
    db,
    admin,
    viewer,
    viewerEmployee,
    accountId,
  };
}

async function approvedMileage(
  context: Awaited<ReturnType<typeof setup>>,
  suffix: string,
  units: string,
) {
  const calculated = await calculateAllowance(
    context.db,
    scope,
    context.viewer.userId,
    {
      calculationKey: `mileage-calc-${suffix}`,
      allowanceType: 'mileage',
      serviceDate: '2026-07-25',
      units,
    },
  );
  return withTenantTransaction(context.db, scope, (tx) =>
    approveAllowanceCalculationWithin(
      tx,
      scope,
      context.admin.userId,
      calculated.calculation.id,
      new Date('2026-07-26T01:00:00.000Z'),
    ));
}

describe('mileage, per diem and cash advances', () => {
  it('snapshots exact no-receipt evidence and rejects overlap and self-approval', async () => {
    const context = await setup();
    const first = await calculateAllowance(
      context.db,
      scope,
      context.viewer.userId,
      {
        calculationKey: 'mileage-calc-evidence',
        allowanceType: 'mileage',
        serviceDate: '2026-07-25',
        units: '120.5',
      },
    );
    expect(first).toMatchObject({
      replayed: false,
      calculation: {
        unit: 'km',
        units: '120.5000',
        rate: '0.7500',
        amount: '90.3750',
        currency: 'SGD',
        receiptRequired: false,
        status: 'calculated',
      },
    });
    expect(first.calculation.calculationEvidence).toMatchObject({
      schema: 'expense-allowance-calculation-v1',
      formula: 'units × confirmed policy rate',
      policyVersionNo: 1,
      receiptRequired: false,
    });
    expect((await calculateAllowance(
      context.db,
      scope,
      context.viewer.userId,
      {
        calculationKey: 'mileage-calc-evidence',
        allowanceType: 'mileage',
        serviceDate: '2026-07-25',
        units: '120.5000',
      },
    )).replayed).toBe(true);

    await expect(withTenantTransaction(context.db, scope, (tx) =>
      approveAllowanceCalculationWithin(
        tx,
        scope,
        context.viewer.userId,
        first.calculation.id,
      ))).rejects.toMatchObject({ code: 'self_approval_forbidden' });
    await expect(configureAllowancePolicyVersion(
      context.db,
      scope,
      context.admin.userId,
      {
        policyKey: 'mileage-overlap',
        versionNo: 1,
        allowanceType: 'mileage',
        unit: 'km',
        rate: '0.8',
        currency: 'SGD',
        effectiveFrom: '2026-07-01',
      },
    )).rejects.toMatchObject({ code: 'allowance_policy_effective_overlap' });
  });

  it('does not close until approved expenses and employee repayment reconcile exactly', async () => {
    const context = await setup('1');
    const allowance = await approvedMileage(context, 'repayment', '30');
    const issued = await issueCashAdvance(
      context.db,
      scope,
      context.admin.userId,
      {
        advanceKey: 'advance-repayment-0001',
        advanceNo: 'CA-2026-0001',
        employeeId: context.viewerEmployee.id,
        currency: 'SGD',
        issuedAmount: '100',
        issuedDate: '2026-07-25',
        purpose: 'Customer site travel float',
        advanceReceivableAccountId: context.accountId('1100'),
        employeePayableAccountId: context.accountId('2100'),
        bankAccountId: context.accountId('1000'),
      },
      new Date('2026-07-25T00:00:00.000Z'),
    );
    expect(issued.posting).toMatchObject({
      postingType: 'issue',
      amount: '100.00',
      journalRef: 'CA:CA-2026-0001:ISSUE',
    });
    await expect(closeCashAdvance(
      context.db,
      scope,
      context.admin.userId,
      issued.advance.id,
      {
        sources: [{ sourceType: 'allowance', sourceId: allowance.id }],
        employeeRepaidAmount: '69.99',
        reason: 'Attempt settlement with an unreconciled employee repayment.',
      },
    )).rejects.toMatchObject({ code: 'cash_advance_repayment_not_reconciled' });
    expect(await context.db.select().from(cashAdvanceApplication)).toHaveLength(0);

    const closed = await closeCashAdvance(
      context.db,
      scope,
      context.admin.userId,
      issued.advance.id,
      {
        sources: [{ sourceType: 'allowance', sourceId: allowance.id }],
        employeeRepaidAmount: '70',
        reason: 'Finance reconciled the approved mileage and employee repayment.',
      },
      new Date('2026-07-26T02:00:00.000Z'),
    );
    expect(closed.reconciliation).toEqual({
      approvedExpenseTotal: '30.00',
      appliedExpenseAmount: '30.00',
      requiredRepayment: '70.00',
      employeePayableDifference: '0.00',
    });
    expect(closed.advance).toMatchObject({
      status: 'closed',
      appliedExpenseAmount: '30.00',
      employeeRepaidAmount: '70.00',
      employeePayableDifference: '0.00',
    });
    expect(await context.db.select().from(cashAdvancePosting)).toHaveLength(3);
    expect(await context.db.select().from(glEntry).where(inArray(glEntry.journalRef, [
      'CA:CA-2026-0001:ISSUE',
      'CA:CA-2026-0001:APPLY',
      'CA:CA-2026-0001:REPAY',
    ]))).toHaveLength(6);
    expect(await context.db.select().from(cashAdvanceEvent)).toHaveLength(2);
    expect((await context.db.select().from(expenseAllowanceCalculation))[0].status)
      .toBe('applied');
  });

  it('retains an explicit employee-payable difference when expenses exceed the advance', async () => {
    const context = await setup('1');
    const allowance = await approvedMileage(context, 'payable', '125');
    const issued = await issueCashAdvance(context.db, scope, context.admin.userId, {
      advanceKey: 'advance-payable-0001',
      advanceNo: 'CA-2026-0002',
      employeeId: context.viewerEmployee.id,
      currency: 'SGD',
      issuedAmount: '100',
      issuedDate: '2026-07-25',
      purpose: 'Regional travel cash advance',
      advanceReceivableAccountId: context.accountId('1100'),
      employeePayableAccountId: context.accountId('2100'),
      bankAccountId: context.accountId('1000'),
    });
    const closed = await closeCashAdvance(
      context.db,
      scope,
      context.admin.userId,
      issued.advance.id,
      {
        sources: [{ sourceType: 'allowance', sourceId: allowance.id }],
        employeeRepaidAmount: '0',
        reason: 'Approved mileage exceeds the advance and leaves employee payable.',
      },
    );
    expect(closed.reconciliation).toEqual({
      approvedExpenseTotal: '125.00',
      appliedExpenseAmount: '100.00',
      requiredRepayment: '0.00',
      employeePayableDifference: '25.00',
    });
    const entries = await context.db.select().from(glEntry)
      .where(eq(glEntry.journalRef, 'CA:CA-2026-0002:APPLY'));
    expect(entries).toHaveLength(2);
    expect(entries.reduce(
      (sum, entry) => sum.plus(entry.debit),
      new Decimal(0),
    ).eq(entries.reduce(
      (sum, entry) => sum.plus(entry.credit),
      new Decimal(0),
    ))).toBe(true);
    await expect(context.db.delete(cashAdvanceEvent)).rejects.toThrow();
  });
});
