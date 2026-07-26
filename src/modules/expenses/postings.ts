import { createHash } from 'node:crypto';
import Decimal from 'decimal.js';
import {
  and,
  eq,
  gte,
  inArray,
  lte,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  account,
  accountingPeriod,
  expenseBankChargeOverride,
  expenseClaim,
  expenseClaimLine,
  expenseLineApproval,
  expenseLinePolicySnapshot,
  expensePosting,
  expensePostingLeg,
  glEntry,
} from '../../data/schema';

export class ExpensePostingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'ExpensePostingError';
  }
}

function dateText(value: Date | string): string {
  const result = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)
    || new Date(`${result}T00:00:00.000Z`).toISOString().slice(0, 10) !== result) {
    throw new ExpensePostingError(
      'expense_posting_date_invalid',
      'Posting date must be a valid ISO date.',
      422,
    );
  }
  return result;
}

function money(value: Decimal): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

function factsHash(facts: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(facts)).digest('hex');
}

export async function postApprovedExpenseLineWithin(
  tx: DB,
  scope: Scope,
  lineApprovalId: number,
  actorUserId: number,
  postingDateInput: Date | string,
  now = new Date(),
) {
  const postingDate = dateText(postingDateInput);
  const [existing] = await tx.select().from(expensePosting).where(and(
    eq(expensePosting.masterFn, scope.masterFn),
    eq(expensePosting.companyFn, scope.companyFn),
    eq(expensePosting.lineApprovalId, lineApprovalId),
  )).limit(1);
  if (existing) return { posting: existing, replayed: true };

  const [source] = await tx.select({
    approval: expenseLineApproval,
    claim: expenseClaim,
    line: expenseClaimLine,
    snapshot: expenseLinePolicySnapshot,
  }).from(expenseLineApproval)
    .innerJoin(expenseClaim, and(
      eq(expenseClaim.id, expenseLineApproval.claimId),
      eq(expenseClaim.masterFn, scope.masterFn),
      eq(expenseClaim.companyFn, scope.companyFn),
    ))
    .innerJoin(expenseClaimLine, and(
      eq(expenseClaimLine.id, expenseLineApproval.lineId),
      eq(expenseClaimLine.masterFn, scope.masterFn),
      eq(expenseClaimLine.companyFn, scope.companyFn),
    ))
    .innerJoin(expenseLinePolicySnapshot, and(
      eq(expenseLinePolicySnapshot.id, expenseClaimLine.policySnapshotId),
      eq(expenseLinePolicySnapshot.masterFn, scope.masterFn),
      eq(expenseLinePolicySnapshot.companyFn, scope.companyFn),
    ))
    .where(and(
      eq(expenseLineApproval.masterFn, scope.masterFn),
      eq(expenseLineApproval.companyFn, scope.companyFn),
      eq(expenseLineApproval.id, lineApprovalId),
    )).limit(1);
  if (!source) {
    throw new ExpensePostingError(
      'expense_posting_source_missing',
      'The approved expense line and policy snapshot are unavailable.',
      404,
    );
  }
  if (source.approval.status !== 'approved') {
    throw new ExpensePostingError(
      'expense_posting_approval_required',
      'Only a final-approved expense line can be posted.',
      422,
    );
  }
  if (source.approval.claimVersion !== source.claim.version) {
    throw new ExpensePostingError(
      'expense_posting_claim_version_changed',
      'The approved line does not match the current immutable claim version.',
      422,
    );
  }

  const [override] = await tx.select().from(expenseBankChargeOverride).where(and(
    eq(expenseBankChargeOverride.masterFn, scope.masterFn),
    eq(expenseBankChargeOverride.companyFn, scope.companyFn),
    eq(expenseBankChargeOverride.snapshotId, source.snapshot.id),
  )).limit(1);
  const policyGross = new Decimal(source.snapshot.baseGross);
  const gross = new Decimal(override?.actualBaseGross ?? source.snapshot.baseGross)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const inputTax = new Decimal(source.snapshot.baseInputTax)
    .mul(gross)
    .div(policyGross)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const expense = gross.minus(inputTax);
  if (gross.lte(0) || inputTax.lt(0) || expense.lt(0)
    || !expense.plus(inputTax).eq(gross)) {
    throw new ExpensePostingError(
      'expense_posting_amount_invalid',
      'Rounded expense, input tax and gross amounts must reconcile exactly.',
      422,
    );
  }

  const periods = await tx.select().from(accountingPeriod).where(and(
    eq(accountingPeriod.masterFn, scope.masterFn),
    eq(accountingPeriod.companyFn, scope.companyFn),
    lte(accountingPeriod.startDate, postingDate),
    gte(accountingPeriod.endDate, postingDate),
  )).limit(2).for('update');
  if (periods.length !== 1) {
    throw new ExpensePostingError(
      periods.length ? 'expense_posting_period_ambiguous' : 'expense_posting_period_missing',
      'Exactly one accounting period must cover the posting date.',
      422,
    );
  }
  const period = periods[0];
  if (period.status !== 'open') {
    throw new ExpensePostingError(
      'expense_posting_period_locked',
      `Accounting period ${period.label} is locked.`,
      422,
    );
  }

  const accountIds = [
    source.snapshot.expenseAccountId,
    source.snapshot.creditAccountId,
    ...(inputTax.gt(0) && source.snapshot.inputTaxAccountId != null
      ? [source.snapshot.inputTaxAccountId]
      : []),
  ];
  const accounts = await tx.select().from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    inArray(account.id, accountIds),
  ));
  const byId = new Map(accounts.map((row) => [row.id, row]));
  const expenseAccount = byId.get(source.snapshot.expenseAccountId);
  const creditAccount = byId.get(source.snapshot.creditAccountId);
  const inputTaxAccount = source.snapshot.inputTaxAccountId == null
    ? null
    : byId.get(source.snapshot.inputTaxAccountId);
  if (expenseAccount?.type !== 'expense'
    || !creditAccount
    || (source.snapshot.paymentSource === 'employee_paid'
      ? creditAccount.type !== 'liability'
      : !['asset', 'liability'].includes(creditAccount.type))
    || (inputTax.gt(0) && inputTaxAccount?.type !== 'asset')) {
    throw new ExpensePostingError(
      'expense_posting_account_invalid',
      'Configured expense, input-tax or credit accounts are unavailable or have invalid types.',
      422,
    );
  }

  const journalRef = `EXP:${source.claim.claimNo}:L${source.line.lineNo}:V${source.claim.version}`;
  const [journalConflict] = await tx.select({ id: glEntry.id }).from(glEntry).where(and(
    eq(glEntry.masterFn, scope.masterFn),
    eq(glEntry.companyFn, scope.companyFn),
    eq(glEntry.journalRef, journalRef),
  )).limit(1);
  if (journalConflict) {
    throw new ExpensePostingError(
      'expense_posting_journal_conflict',
      'The expense journal reference already exists without its posting record.',
    );
  }
  const facts = {
    schema: 'expense-posting-v1',
    lineApprovalId,
    claimId: source.claim.id,
    lineId: source.line.id,
    claimVersion: source.claim.version,
    policySnapshotId: source.snapshot.id,
    bankChargeOverrideId: override?.id ?? null,
    postingDate,
    paymentSource: source.snapshot.paymentSource,
    functionalCurrency: source.snapshot.functionalCurrency,
    baseExpense: money(expense),
    baseInputTax: money(inputTax),
    baseGross: money(gross),
    expenseAccountId: source.snapshot.expenseAccountId,
    inputTaxAccountId: inputTax.gt(0) ? source.snapshot.inputTaxAccountId : null,
    creditAccountId: source.snapshot.creditAccountId,
  };
  const [posting] = await tx.insert(expensePosting).values({
    ...scope,
    lineApprovalId,
    claimId: source.claim.id,
    lineId: source.line.id,
    claimVersion: source.claim.version,
    policySnapshotId: source.snapshot.id,
    bankChargeOverrideId: override?.id ?? null,
    accountingPeriodId: period.id,
    journalRef,
    postingDate,
    paymentSource: source.snapshot.paymentSource,
    functionalCurrency: source.snapshot.functionalCurrency,
    baseExpense: facts.baseExpense,
    baseInputTax: facts.baseInputTax,
    baseGross: facts.baseGross,
    creditAccountId: source.snapshot.creditAccountId,
    factsSha256: factsHash(facts),
    postedByUserId: actorUserId,
    postedAt: now,
  }).returning();

  const legInputs = [
    ...(expense.gt(0) ? [{
      legType: 'expense' as const,
      accountId: source.snapshot.expenseAccountId,
      debit: money(expense),
      credit: '0.00',
      memo: `${source.claim.claimNo} line ${source.line.lineNo} expense`,
    }] : []),
    ...(inputTax.gt(0) ? [{
      legType: 'input_tax' as const,
      accountId: source.snapshot.inputTaxAccountId!,
      debit: money(inputTax),
      credit: '0.00',
      memo: `${source.claim.claimNo} line ${source.line.lineNo} input tax`,
    }] : []),
    {
      legType: 'credit' as const,
      accountId: source.snapshot.creditAccountId,
      debit: '0.00',
      credit: money(gross),
      memo: source.snapshot.paymentSource === 'employee_paid'
        ? `${source.claim.claimNo} employee payable`
        : `${source.claim.claimNo} company-paid clearing`,
    },
  ];
  const glEntries = await tx.insert(glEntry).values(legInputs.map((leg) => ({
    ...scope,
    postedAt: new Date(`${postingDate}T00:00:00.000Z`),
    journalRef,
    accountId: leg.accountId,
    debit: leg.debit,
    credit: leg.credit,
    memo: leg.memo,
  }))).returning();
  await tx.insert(expensePostingLeg).values(legInputs.map((leg, index) => ({
    ...scope,
    postingId: posting.id,
    legNo: index + 1,
    legType: leg.legType,
    accountId: leg.accountId,
    debit: leg.debit,
    credit: leg.credit,
    glEntryId: glEntries[index].id,
  })));
  return { posting, replayed: false };
}
