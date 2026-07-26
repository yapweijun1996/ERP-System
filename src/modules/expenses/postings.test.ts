import { and, eq } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  account,
  accountingPeriod,
  appUser,
  expenseLineApproval,
  expensePosting,
  expensePostingLeg,
  glEntry,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  createExpenseClaimDraft,
  replaceExpenseClaimDraftLines,
  submitExpenseClaimByEmployee,
} from './claims';
import {
  configureExpenseControlPolicyVersion,
  decideExpenseLineWithin,
} from './controls';
import { configureExpensePolicyVersion } from './policy';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

async function setup(paymentSource: 'employee_paid' | 'company_paid', tax = true) {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  const accounts = await db.select().from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
  ));
  const accountId = (code: string) => accounts.find((row) => row.code === code)!.id;
  await db.insert(accountingPeriod).values({
    ...scope,
    fiscalYear: 2026,
    periodNo: 7,
    label: 'July 2026',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    status: 'open',
  });
  const categoryCode = paymentSource === 'employee_paid' ? 'EMPPOST' : 'COMPOST';
  await configureExpensePolicyVersion(db, scope, admin.userId, {
    categoryCode,
    categoryName: 'Posting test expense',
    policyKey: `posting-${paymentSource}`,
    policyName: 'Posting test policy',
    versionNo: 1,
    validFrom: '2026-01-01',
    evidenceRequired: false,
    taxTreatment: tax ? 'input_tax' : 'exempt',
    taxCode: tax ? 'SR' : null,
    inputTaxRecoverablePct: tax ? 100 : undefined,
    employeePaidAllowed: paymentSource === 'employee_paid',
    companyPaidAllowed: paymentSource === 'company_paid',
    expenseAccountId: accountId('5800'),
    inputTaxAccountId: tax ? accountId('1200') : null,
    employeePayableAccountId: accountId('2100'),
    companyPaidClearingAccountId: accountId('1000'),
    fxMethod: 'table_rate',
  });
  await configureExpenseControlPolicyVersion(db, scope, admin.userId, {
    policyKey: `posting-controls-${paymentSource}`,
    versionNo: 1,
    validFrom: '2026-01-01',
    duplicateHighRiskScore: 70,
    budgetAction: 'warn',
  });
  const gross = tax ? '109' : '50';
  const created = await createExpenseClaimDraft(db, scope, viewer.userId, {
    claimKey: `posting-claim-${paymentSource}`,
    claimNo: paymentSource === 'employee_paid' ? 'POST-EMP-1' : 'POST-COM-1',
    title: `Posting ${paymentSource}`,
  });
  const replaced = await replaceExpenseClaimDraftLines(
    db,
    scope,
    viewer.userId,
    created.claim.id,
    created.claim.version,
    [{
      merchant: 'Posting Merchant',
      transactionDate: '2026-07-20',
      purpose: 'Posting workflow proof',
      categoryCode,
      paymentSource,
      originalCurrency: 'SGD',
      originalNet: tax ? '100' : '50',
      originalTax: tax ? '9' : '0',
      originalGross: gross,
      allocationMode: 'percentage',
      allocations: [{
        dimensionType: 'department',
        dimensionKey: 'FINANCE',
        percentage: '100',
      }],
    }],
  );
  const submitted = await submitExpenseClaimByEmployee(
    db,
    scope,
    viewer.userId,
    created.claim.id,
    replaced.claim.version,
  );
  return {
    db,
    admin,
    viewer,
    accountId,
    lineApprovalId: submitted.controls![0].lineApproval.id,
  };
}

async function approve(context: Awaited<ReturnType<typeof setup>>) {
  await context.db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
    lineApprovalId: context.lineApprovalId,
    actorUserId: context.admin.userId,
    decision: 'approved',
  }, new Date('2026-07-26T01:00:00.000Z')));
  return context.db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
    lineApprovalId: context.lineApprovalId,
    actorUserId: context.admin.userId,
    decision: 'approved',
  }, new Date('2026-07-26T02:00:00.000Z')));
}

describe('approved expense posting', () => {
  it('posts recoverable input tax and employee payable as immutable balanced facts', async () => {
    const context = await setup('employee_paid');
    const result = await approve(context);
    expect(result).toMatchObject({
      status: 'approved',
      claimStatus: 'approved',
      posting: {
        replayed: false,
        posting: {
          paymentSource: 'employee_paid',
          baseExpense: '100.00',
          baseInputTax: '9.00',
          baseGross: '109.00',
          creditAccountId: context.accountId('2100'),
        },
      },
    });
    const [posting] = await context.db.select().from(expensePosting);
    expect(posting.factsSha256).toMatch(/^[0-9a-f]{64}$/);
    const legs = await context.db.select().from(expensePostingLeg)
      .where(eq(expensePostingLeg.postingId, posting.id));
    expect(legs.map((leg) => leg.legType)).toEqual(['expense', 'input_tax', 'credit']);
    const totals = legs.reduce((sum, leg) => ({
      debit: sum.debit.plus(leg.debit),
      credit: sum.credit.plus(leg.credit),
    }), { debit: new Decimal(0), credit: new Decimal(0) });
    expect(totals.debit.eq('109')).toBe(true);
    expect(totals.debit.eq(totals.credit)).toBe(true);
    const [ordinaryEntry] = await context.db.insert(glEntry).values({
      ...scope,
      postedAt: new Date('2026-07-26T00:00:00.000Z'),
      journalRef: 'ORDINARY-UNLINKED-GL',
      accountId: context.accountId('1000'),
      debit: '1.00',
      credit: '0.00',
      memo: 'ordinary',
    }).returning();
    await context.db.update(glEntry).set({ memo: 'ordinary updated' })
      .where(eq(glEntry.id, ordinaryEntry.id));
    expect((await context.db.select().from(glEntry)
      .where(eq(glEntry.id, ordinaryEntry.id)))[0].memo).toBe('ordinary updated');
    await expect(context.db.update(glEntry).set({ memo: 'rewritten' })
      .where(eq(glEntry.journalRef, posting.journalRef))).rejects.toThrow();
    await expect(context.db.delete(expensePostingLeg)).rejects.toThrow();
  });

  it('credits the configured company-paid clearing account without employee payable', async () => {
    const context = await setup('company_paid', false);
    const result = await approve(context);
    expect(result.posting?.posting).toMatchObject({
      paymentSource: 'company_paid',
      baseExpense: '50.00',
      baseInputTax: '0.00',
      baseGross: '50.00',
      creditAccountId: context.accountId('1000'),
    });
    const legs = await context.db.select().from(expensePostingLeg);
    expect(legs).toHaveLength(2);
    expect(legs.find((leg) => leg.legType === 'credit')).toMatchObject({
      accountId: context.accountId('1000'),
      credit: '50.00',
    });
  });

  it('rolls final approval back on a locked period and remains retryable after reopen', async () => {
    const context = await setup('employee_paid');
    const [period] = await context.db.select().from(accountingPeriod).where(and(
      eq(accountingPeriod.masterFn, scope.masterFn),
      eq(accountingPeriod.companyFn, scope.companyFn),
      eq(accountingPeriod.periodNo, 7),
    ));
    await context.db.update(accountingPeriod).set({
      status: 'locked',
      lockedAt: new Date('2026-07-25T00:00:00.000Z'),
      lockedByUserId: context.admin.userId,
    }).where(eq(accountingPeriod.id, period.id));
    await context.db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId: context.lineApprovalId,
      actorUserId: context.admin.userId,
      decision: 'approved',
    }, new Date('2026-07-26T01:00:00.000Z')));
    await expect(context.db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId: context.lineApprovalId,
      actorUserId: context.admin.userId,
      decision: 'approved',
    }, new Date('2026-07-26T02:00:00.000Z'))))
      .rejects.toMatchObject({ code: 'expense_posting_period_locked' });
    expect((await context.db.select().from(expenseLineApproval))[0].status).toBe('pending');
    expect(await context.db.select().from(expensePosting)).toHaveLength(0);

    await context.db.update(accountingPeriod).set({
      status: 'open',
      lockedAt: null,
      lockedByUserId: null,
    }).where(eq(accountingPeriod.id, period.id));
    expect((await context.db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId: context.lineApprovalId,
      actorUserId: context.admin.userId,
      decision: 'approved',
    }, new Date('2026-07-26T03:00:00.000Z')))).posting?.replayed).toBe(false);
    expect(await context.db.select().from(expensePosting)).toHaveLength(1);
  });
});
