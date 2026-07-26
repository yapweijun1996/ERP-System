import Decimal from 'decimal.js';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  account,
  cashAdvance,
  cashAdvanceApplication,
  cashAdvanceEvent,
  cashAdvancePosting,
  company,
  employee,
  expenseAllowanceCalculation,
  expenseAllowancePolicyVersion,
  expenseClaim,
  expenseClaimLine,
  expenseLineApproval,
  expenseLinePolicySnapshot,
  glEntry,
} from '../../data/schema';

export class ExpenseSettlementError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'ExpenseSettlementError';
  }
}

function boundedText(value: unknown, label: string, min: number, max: number): string {
  const result = String(value ?? '').trim();
  if (result.length < min || result.length > max) {
    throw new ExpenseSettlementError(
      'expense_settlement_text_invalid',
      `${label} must contain ${min}–${max} characters.`,
      422,
    );
  }
  return result;
}

function stableKey(value: unknown, label: string): string {
  const result = boundedText(value, label, 8, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(result)) {
    throw new ExpenseSettlementError(
      'expense_settlement_key_invalid',
      `${label} must be a stable 8–128 character key.`,
      422,
    );
  }
  return result;
}

function isoDate(value: unknown, label: string): string {
  const result = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)
    || new Date(`${result}T00:00:00.000Z`).toISOString().slice(0, 10) !== result) {
    throw new ExpenseSettlementError(
      'expense_settlement_date_invalid',
      `${label} must be a valid ISO date.`,
      422,
    );
  }
  return result;
}

function decimal(value: unknown, label: string, allowZero = false): Decimal {
  try {
    const result = new Decimal(String(value ?? ''));
    if (result.isFinite() && (allowZero ? result.gte(0) : result.gt(0))) return result;
  } catch {
    // Replaced with the stable domain error below.
  }
  throw new ExpenseSettlementError(
    'expense_settlement_amount_invalid',
    `${label} must be ${allowZero ? 'zero or a positive' : 'a positive'} decimal.`,
    422,
  );
}

function fixed(value: Decimal, places: 2 | 4): string {
  return value.toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places);
}

function sameDecimal(left: string | number, right: string | number): boolean {
  return new Decimal(left).eq(right);
}

export interface AllowancePolicyInput {
  policyKey: string;
  versionNo: number;
  allowanceType: 'mileage' | 'per_diem';
  unit: 'km' | 'day';
  rate: string | number;
  currency: string;
  maximumUnits?: string | number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export async function configureAllowancePolicyVersion(
  db: DB,
  scope: Scope,
  actorUserId: number,
  input: AllowancePolicyInput,
) {
  const policyKey = boundedText(input.policyKey, 'Policy key', 3, 64).toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,63}$/.test(policyKey)
    || !Number.isSafeInteger(input.versionNo)
    || input.versionNo <= 0
    || (input.allowanceType === 'mileage' && input.unit !== 'km')
    || (input.allowanceType === 'per_diem' && input.unit !== 'day')) {
    throw new ExpenseSettlementError(
      'allowance_policy_invalid',
      'Policy key, positive version, allowance type and unit must be valid.',
      422,
    );
  }
  const rate = fixed(decimal(input.rate, 'Rate'), 4);
  const maximumUnits = input.maximumUnits == null
    ? null
    : fixed(decimal(input.maximumUnits, 'Maximum units'), 4);
  const effectiveFrom = isoDate(input.effectiveFrom, 'Effective from');
  const effectiveTo = input.effectiveTo == null
    ? null
    : isoDate(input.effectiveTo, 'Effective to');
  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new ExpenseSettlementError(
      'allowance_policy_dates_invalid',
      'Effective to cannot precede effective from.',
      422,
    );
  }
  const currency = boundedText(input.currency, 'Currency', 3, 3).toUpperCase();

  return withTenantTransaction(db, scope, async (tx) => {
    const [companyRow] = await tx.select({ currency: company.currency }).from(company)
      .where(and(
        eq(company.masterFn, scope.masterFn),
        eq(company.companyFn, scope.companyFn),
      )).limit(1);
    if (!companyRow || companyRow.currency !== currency) {
      throw new ExpenseSettlementError(
        'allowance_policy_currency_invalid',
        'Allowance policy currency must equal the company functional currency.',
        422,
      );
    }
    const [existing] = await tx.select().from(expenseAllowancePolicyVersion).where(and(
      eq(expenseAllowancePolicyVersion.masterFn, scope.masterFn),
      eq(expenseAllowancePolicyVersion.companyFn, scope.companyFn),
      eq(expenseAllowancePolicyVersion.policyKey, policyKey),
      eq(expenseAllowancePolicyVersion.versionNo, input.versionNo),
    )).limit(1);
    if (existing) {
      const identical = existing.allowanceType === input.allowanceType
        && existing.unit === input.unit
        && sameDecimal(existing.rate, rate)
        && existing.currency === currency
        && (existing.maximumUnits == null ? maximumUnits == null
          : maximumUnits != null && sameDecimal(existing.maximumUnits, maximumUnits))
        && existing.effectiveFrom === effectiveFrom
        && existing.effectiveTo === effectiveTo;
      if (!identical) {
        throw new ExpenseSettlementError(
          'allowance_policy_version_conflict',
          'This allowance policy version already has different confirmed facts.',
        );
      }
      return { policy: existing, replayed: true };
    }
    const [overlap] = await tx.select({ id: expenseAllowancePolicyVersion.id })
      .from(expenseAllowancePolicyVersion)
      .where(and(
        eq(expenseAllowancePolicyVersion.masterFn, scope.masterFn),
        eq(expenseAllowancePolicyVersion.companyFn, scope.companyFn),
        eq(expenseAllowancePolicyVersion.allowanceType, input.allowanceType),
        eq(expenseAllowancePolicyVersion.status, 'confirmed'),
        lte(expenseAllowancePolicyVersion.effectiveFrom, effectiveTo ?? '9999-12-31'),
        or(
          isNull(expenseAllowancePolicyVersion.effectiveTo),
          gte(expenseAllowancePolicyVersion.effectiveTo, effectiveFrom),
        ),
      )).limit(1);
    if (overlap) {
      throw new ExpenseSettlementError(
        'allowance_policy_effective_overlap',
        'Confirmed allowance policy periods cannot overlap for the same allowance type.',
      );
    }
    const [policy] = await tx.insert(expenseAllowancePolicyVersion).values({
      ...scope,
      policyKey,
      versionNo: input.versionNo,
      allowanceType: input.allowanceType,
      unit: input.unit,
      rate,
      currency,
      maximumUnits,
      effectiveFrom,
      effectiveTo,
      status: 'confirmed',
      confirmedByUserId: actorUserId,
    }).returning();
    return { policy, replayed: false };
  });
}

export async function calculateAllowance(
  db: DB,
  scope: Scope,
  ownerUserId: number,
  input: {
    calculationKey: string;
    allowanceType: 'mileage' | 'per_diem';
    serviceDate: string;
    units: string | number;
  },
) {
  const calculationKey = stableKey(input.calculationKey, 'Calculation key');
  const serviceDate = isoDate(input.serviceDate, 'Service date');
  const units = decimal(input.units, 'Units');

  return withTenantTransaction(db, scope, async (tx) => {
    const [employeeRow] = await tx.select().from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.userId, ownerUserId),
      eq(employee.isActive, true),
    )).limit(1);
    if (!employeeRow) {
      throw new ExpenseSettlementError(
        'allowance_employee_invalid',
        'An active employee profile linked to the session is required.',
        403,
      );
    }
    const [existing] = await tx.select().from(expenseAllowanceCalculation).where(and(
      eq(expenseAllowanceCalculation.masterFn, scope.masterFn),
      eq(expenseAllowanceCalculation.companyFn, scope.companyFn),
      eq(expenseAllowanceCalculation.calculationKey, calculationKey),
    )).limit(1);
    if (existing) {
      if (existing.ownerUserId !== ownerUserId
        || existing.allowanceType !== input.allowanceType
        || existing.serviceDate !== serviceDate
        || !sameDecimal(existing.units, units.toString())) {
        throw new ExpenseSettlementError(
          'allowance_calculation_key_conflict',
          'This calculation key already belongs to different employee facts.',
        );
      }
      return { calculation: existing, replayed: true };
    }
    const policies = await tx.select().from(expenseAllowancePolicyVersion).where(and(
      eq(expenseAllowancePolicyVersion.masterFn, scope.masterFn),
      eq(expenseAllowancePolicyVersion.companyFn, scope.companyFn),
      eq(expenseAllowancePolicyVersion.allowanceType, input.allowanceType),
      eq(expenseAllowancePolicyVersion.status, 'confirmed'),
      lte(expenseAllowancePolicyVersion.effectiveFrom, serviceDate),
      or(
        isNull(expenseAllowancePolicyVersion.effectiveTo),
        gte(expenseAllowancePolicyVersion.effectiveTo, serviceDate),
      ),
    )).orderBy(desc(expenseAllowancePolicyVersion.versionNo)).limit(2);
    if (policies.length !== 1) {
      throw new ExpenseSettlementError(
        policies.length ? 'allowance_policy_ambiguous' : 'allowance_policy_missing',
        'Exactly one confirmed allowance policy must cover the service date.',
      );
    }
    const policy = policies[0];
    if (policy.maximumUnits != null && units.gt(policy.maximumUnits)) {
      throw new ExpenseSettlementError(
        'allowance_units_exceed_policy',
        'Units exceed the confirmed policy maximum.',
        422,
      );
    }
    const normalizedUnits = fixed(units, 4);
    const amount = fixed(units.mul(policy.rate), 4);
    const evidence = {
      schema: 'expense-allowance-calculation-v1',
      formula: 'units × confirmed policy rate',
      policyVersionId: policy.id,
      policyKey: policy.policyKey,
      policyVersionNo: policy.versionNo,
      allowanceType: policy.allowanceType,
      serviceDate,
      unit: policy.unit,
      units: normalizedUnits,
      rate: policy.rate,
      amount,
      currency: policy.currency,
      receiptRequired: false,
    };
    const [calculation] = await tx.insert(expenseAllowanceCalculation).values({
      ...scope,
      calculationKey,
      ownerUserId,
      employeeId: employeeRow.id,
      policyVersionId: policy.id,
      allowanceType: policy.allowanceType,
      serviceDate,
      unit: policy.unit,
      units: normalizedUnits,
      rate: policy.rate,
      amount,
      currency: policy.currency,
      receiptRequired: false,
      calculationEvidence: evidence,
    }).returning();
    return { calculation, replayed: false };
  });
}

export async function approveAllowanceCalculationWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  calculationId: number,
  now = new Date(),
) {
  const [calculation] = await tx.select().from(expenseAllowanceCalculation)
    .where(and(
      eq(expenseAllowanceCalculation.masterFn, scope.masterFn),
      eq(expenseAllowanceCalculation.companyFn, scope.companyFn),
      eq(expenseAllowanceCalculation.id, calculationId),
    )).limit(1).for('update');
  if (!calculation) {
    throw new ExpenseSettlementError('allowance_calculation_not_found', 'Allowance calculation not found.', 404);
  }
  if (calculation.status !== 'calculated') {
    throw new ExpenseSettlementError(
      'allowance_calculation_not_pending',
      'Only a calculated allowance can be approved.',
    );
  }
  if (calculation.ownerUserId === actorUserId) {
    throw new ExpenseSettlementError(
      'self_approval_forbidden',
      'Employees cannot approve their own allowance calculation.',
      403,
    );
  }
  const [updated] = await tx.update(expenseAllowanceCalculation).set({
    status: 'approved',
    approvedByUserId: actorUserId,
    approvedAt: now,
    updatedAt: now,
  }).where(eq(expenseAllowanceCalculation.id, calculation.id)).returning();
  return updated;
}

async function requireAccount(
  tx: DB,
  scope: Scope,
  accountId: number,
  expectedType: 'asset' | 'liability',
  label: string,
) {
  const [row] = await tx.select().from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.id, accountId),
  )).limit(1);
  if (!row || row.type !== expectedType) {
    throw new ExpenseSettlementError(
      'cash_advance_account_invalid',
      `${label} must be a tenant-owned ${expectedType} account.`,
      422,
    );
  }
  return row;
}

async function postAdvancePair(
  tx: DB,
  scope: Scope,
  input: {
    advanceId: number;
    postingType: 'issue' | 'expense_application' | 'employee_repayment';
    journalRef: string;
    amount: Decimal;
    debitAccountId: number;
    creditAccountId: number;
    actorUserId: number;
    postedAt: Date;
    memo: string;
  },
) {
  const amount = fixed(input.amount, 2);
  const [existing] = await tx.select({ id: glEntry.id }).from(glEntry).where(and(
    eq(glEntry.masterFn, scope.masterFn),
    eq(glEntry.companyFn, scope.companyFn),
    eq(glEntry.journalRef, input.journalRef),
  )).limit(1);
  if (existing) {
    throw new ExpenseSettlementError(
      'cash_advance_journal_conflict',
      'The cash-advance journal reference is already in use.',
    );
  }
  const [debitLeg, creditLeg] = await tx.insert(glEntry).values([
    {
      ...scope,
      postedAt: input.postedAt,
      journalRef: input.journalRef,
      accountId: input.debitAccountId,
      debit: amount,
      credit: '0',
      memo: input.memo,
    },
    {
      ...scope,
      postedAt: input.postedAt,
      journalRef: input.journalRef,
      accountId: input.creditAccountId,
      debit: '0',
      credit: amount,
      memo: input.memo,
    },
  ]).returning();
  const [posting] = await tx.insert(cashAdvancePosting).values({
    ...scope,
    advanceId: input.advanceId,
    postingType: input.postingType,
    journalRef: input.journalRef,
    amount,
    debitAccountId: input.debitAccountId,
    creditAccountId: input.creditAccountId,
    debitGlEntryId: debitLeg.id,
    creditGlEntryId: creditLeg.id,
    postedByUserId: input.actorUserId,
    postedAt: input.postedAt,
  }).returning();
  return posting;
}

export interface IssueCashAdvanceInput {
  advanceKey: string;
  advanceNo: string;
  employeeId: number;
  currency: string;
  issuedAmount: string | number;
  issuedDate: string;
  purpose: string;
  advanceReceivableAccountId: number;
  employeePayableAccountId: number;
  bankAccountId: number;
}

export async function issueCashAdvance(
  db: DB,
  scope: Scope,
  actorUserId: number,
  input: IssueCashAdvanceInput,
  now = new Date(),
) {
  const advanceKey = stableKey(input.advanceKey, 'Advance key');
  const advanceNo = boundedText(input.advanceNo, 'Advance number', 2, 80);
  const currency = boundedText(input.currency, 'Currency', 3, 3).toUpperCase();
  const issuedAmount = decimal(input.issuedAmount, 'Issued amount');
  const issuedDate = isoDate(input.issuedDate, 'Issued date');
  const purpose = boundedText(input.purpose, 'Purpose', 3, 500);
  if (!Number.isSafeInteger(input.employeeId) || input.employeeId <= 0) {
    throw new ExpenseSettlementError('cash_advance_employee_invalid', 'Employee is invalid.', 422);
  }

  return withTenantTransaction(db, scope, async (tx) => {
    const [existing] = await tx.select().from(cashAdvance).where(and(
      eq(cashAdvance.masterFn, scope.masterFn),
      eq(cashAdvance.companyFn, scope.companyFn),
      eq(cashAdvance.advanceKey, advanceKey),
    )).limit(1);
    if (existing) {
      const identical = existing.advanceNo === advanceNo
        && existing.employeeId === input.employeeId
        && existing.currency === currency
        && sameDecimal(existing.issuedAmount, issuedAmount.toString())
        && existing.issuedDate === issuedDate
        && existing.purpose === purpose
        && existing.advanceReceivableAccountId === input.advanceReceivableAccountId
        && existing.employeePayableAccountId === input.employeePayableAccountId
        && existing.bankAccountId === input.bankAccountId;
      if (!identical) {
        throw new ExpenseSettlementError(
          'cash_advance_key_conflict',
          'This advance key already belongs to different issue facts.',
        );
      }
      return { advance: existing, replayed: true };
    }
    const [companyRow] = await tx.select({ currency: company.currency }).from(company)
      .where(and(
        eq(company.masterFn, scope.masterFn),
        eq(company.companyFn, scope.companyFn),
      )).limit(1);
    if (!companyRow || companyRow.currency !== currency) {
      throw new ExpenseSettlementError(
        'cash_advance_currency_invalid',
        'Cash advances must use the company functional currency.',
        422,
      );
    }
    const [employeeRow] = await tx.select().from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.id, input.employeeId),
      eq(employee.isActive, true),
    )).limit(1);
    if (!employeeRow?.userId) {
      throw new ExpenseSettlementError(
        'cash_advance_employee_invalid',
        'Cash advances require an active employee linked to a user.',
        422,
      );
    }
    await requireAccount(tx, scope, input.advanceReceivableAccountId, 'asset', 'Advance receivable');
    await requireAccount(tx, scope, input.employeePayableAccountId, 'liability', 'Employee payable');
    await requireAccount(tx, scope, input.bankAccountId, 'asset', 'Bank');

    const [advance] = await tx.insert(cashAdvance).values({
      ...scope,
      advanceKey,
      advanceNo,
      employeeId: employeeRow.id,
      ownerUserId: employeeRow.userId,
      currency,
      issuedAmount: fixed(issuedAmount, 2),
      issuedDate,
      purpose,
      advanceReceivableAccountId: input.advanceReceivableAccountId,
      employeePayableAccountId: input.employeePayableAccountId,
      bankAccountId: input.bankAccountId,
    }).returning();
    const posting = await postAdvancePair(tx, scope, {
      advanceId: advance.id,
      postingType: 'issue',
      journalRef: `CA:${advanceNo}:ISSUE`,
      amount: issuedAmount,
      debitAccountId: input.advanceReceivableAccountId,
      creditAccountId: input.bankAccountId,
      actorUserId,
      postedAt: now,
      memo: `Cash advance ${advanceNo} issued to ${employeeRow.employeeNo}`,
    });
    await tx.insert(cashAdvanceEvent).values({
      ...scope,
      advanceId: advance.id,
      eventType: 'issued',
      actorUserId,
      reason: purpose,
      detail: {
        issuedAmount: advance.issuedAmount,
        currency,
        journalRef: posting.journalRef,
      },
      createdAt: now,
    });
    return { advance, posting, replayed: false };
  });
}

export type CashAdvanceSourceInput =
  | { sourceType: 'expense_claim_line'; sourceId: number }
  | { sourceType: 'allowance'; sourceId: number };

export async function closeCashAdvanceWithin(
  tx: DB,
  scope: Scope,
  actorUserId: number,
  advanceId: number,
  input: {
    sources: CashAdvanceSourceInput[];
    employeeRepaidAmount: string | number;
    reason: string;
  },
  now = new Date(),
) {
  const reason = boundedText(input.reason, 'Reason', 3, 1000);
  const repayment = decimal(input.employeeRepaidAmount, 'Employee repayment', true)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (!Array.isArray(input.sources) || input.sources.length > 200) {
    throw new ExpenseSettlementError(
      'cash_advance_sources_invalid',
      'A settlement can contain at most 200 approved sources.',
      422,
    );
  }
  const sourceKeys = input.sources.map((source) => `${source.sourceType}:${source.sourceId}`);
  if (new Set(sourceKeys).size !== sourceKeys.length
    || input.sources.some((source) =>
      !Number.isSafeInteger(source.sourceId) || source.sourceId <= 0)) {
    throw new ExpenseSettlementError(
      'cash_advance_sources_invalid',
      'Settlement sources must be unique positive identifiers.',
      422,
    );
  }
  const [advance] = await tx.select().from(cashAdvance).where(and(
    eq(cashAdvance.masterFn, scope.masterFn),
    eq(cashAdvance.companyFn, scope.companyFn),
    eq(cashAdvance.id, advanceId),
  )).limit(1).for('update');
  if (!advance) {
    throw new ExpenseSettlementError('cash_advance_not_found', 'Cash advance not found.', 404);
  }
  if (advance.status !== 'issued') {
    throw new ExpenseSettlementError(
      'cash_advance_not_open',
      'Only an issued cash advance can be closed.',
    );
  }

  const applications: Array<{
    sourceType: 'expense_claim_line' | 'allowance';
    expenseClaimLineId: number | null;
    allowanceCalculationId: number | null;
    amount: Decimal;
  }> = [];
  for (const source of input.sources) {
    const [used] = source.sourceType === 'allowance'
      ? await tx.select({ id: cashAdvanceApplication.id }).from(cashAdvanceApplication)
        .where(and(
          eq(cashAdvanceApplication.masterFn, scope.masterFn),
          eq(cashAdvanceApplication.companyFn, scope.companyFn),
          eq(cashAdvanceApplication.allowanceCalculationId, source.sourceId),
        )).limit(1)
      : await tx.select({ id: cashAdvanceApplication.id }).from(cashAdvanceApplication)
        .where(and(
          eq(cashAdvanceApplication.masterFn, scope.masterFn),
          eq(cashAdvanceApplication.companyFn, scope.companyFn),
          eq(cashAdvanceApplication.expenseClaimLineId, source.sourceId),
        )).limit(1);
    if (used) {
      throw new ExpenseSettlementError(
        'cash_advance_source_already_applied',
        'An approved source can be applied to only one cash advance.',
      );
    }
    if (source.sourceType === 'allowance') {
      const [allowance] = await tx.select().from(expenseAllowanceCalculation).where(and(
        eq(expenseAllowanceCalculation.masterFn, scope.masterFn),
        eq(expenseAllowanceCalculation.companyFn, scope.companyFn),
        eq(expenseAllowanceCalculation.id, source.sourceId),
      )).limit(1).for('update');
      if (!allowance
        || allowance.status !== 'approved'
        || allowance.employeeId !== advance.employeeId
        || allowance.currency !== advance.currency) {
        throw new ExpenseSettlementError(
          'cash_advance_allowance_invalid',
          'Allowance sources must be approved, unapplied and belong to the advance employee and currency.',
        );
      }
      applications.push({
        sourceType: 'allowance',
        expenseClaimLineId: null,
        allowanceCalculationId: allowance.id,
        amount: new Decimal(allowance.amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      });
      continue;
    }
    const [claimLine] = await tx.select({
      lineId: expenseClaimLine.id,
      ownerUserId: expenseClaim.ownerUserId,
      paymentSource: expenseClaimLine.paymentSource,
      approvalStatus: expenseLineApproval.status,
      baseGross: expenseLinePolicySnapshot.baseGross,
      functionalCurrency: expenseLinePolicySnapshot.functionalCurrency,
    }).from(expenseClaimLine)
      .innerJoin(expenseClaim, and(
        eq(expenseClaim.id, expenseClaimLine.claimId),
        eq(expenseClaim.masterFn, scope.masterFn),
        eq(expenseClaim.companyFn, scope.companyFn),
      ))
      .innerJoin(expenseLineApproval, and(
        eq(expenseLineApproval.lineId, expenseClaimLine.id),
        eq(expenseLineApproval.masterFn, scope.masterFn),
        eq(expenseLineApproval.companyFn, scope.companyFn),
      ))
      .innerJoin(expenseLinePolicySnapshot, and(
        eq(expenseLinePolicySnapshot.id, expenseClaimLine.policySnapshotId),
        eq(expenseLinePolicySnapshot.masterFn, scope.masterFn),
        eq(expenseLinePolicySnapshot.companyFn, scope.companyFn),
      ))
      .where(and(
        eq(expenseClaimLine.masterFn, scope.masterFn),
        eq(expenseClaimLine.companyFn, scope.companyFn),
        eq(expenseClaimLine.id, source.sourceId),
      )).limit(1);
    if (!claimLine
      || claimLine.ownerUserId !== advance.ownerUserId
      || claimLine.paymentSource !== 'employee_paid'
      || claimLine.approvalStatus !== 'approved'
      || claimLine.functionalCurrency !== advance.currency) {
      throw new ExpenseSettlementError(
        'cash_advance_claim_line_invalid',
        'Claim sources must be approved employee-paid lines owned by the advance employee in functional currency.',
      );
    }
    applications.push({
      sourceType: 'expense_claim_line',
      expenseClaimLineId: claimLine.lineId,
      allowanceCalculationId: null,
      amount: new Decimal(claimLine.baseGross).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    });
  }

  const expenseTotal = applications.reduce(
    (sum, application) => sum.plus(application.amount),
    new Decimal(0),
  );
  const issued = new Decimal(advance.issuedAmount);
  const applied = Decimal.min(expenseTotal, issued);
  const requiredRepayment = Decimal.max(issued.minus(expenseTotal), 0);
  const payableDifference = Decimal.max(expenseTotal.minus(issued), 0);
  if (!repayment.eq(requiredRepayment)) {
    throw new ExpenseSettlementError(
      'cash_advance_repayment_not_reconciled',
      `Employee repayment must equal ${fixed(requiredRepayment, 2)} ${advance.currency}.`,
      422,
    );
  }

  if (applications.length) {
    await tx.insert(cashAdvanceApplication).values(applications.map((application) => ({
      ...scope,
      advanceId: advance.id,
      sourceType: application.sourceType,
      expenseClaimLineId: application.expenseClaimLineId,
      allowanceCalculationId: application.allowanceCalculationId,
      amount: fixed(application.amount, 2),
      appliedByUserId: actorUserId,
      appliedAt: now,
    })));
    const allowanceIds = applications.flatMap((application) =>
      application.allowanceCalculationId == null ? [] : [application.allowanceCalculationId]);
    if (allowanceIds.length) {
      await tx.update(expenseAllowanceCalculation).set({
        status: 'applied',
        appliedAt: now,
        updatedAt: now,
      }).where(inArray(expenseAllowanceCalculation.id, allowanceIds));
    }
  }

  const postings = [];
  if (applied.gt(0)) {
    postings.push(await postAdvancePair(tx, scope, {
      advanceId: advance.id,
      postingType: 'expense_application',
      journalRef: `CA:${advance.advanceNo}:APPLY`,
      amount: applied,
      debitAccountId: advance.employeePayableAccountId,
      creditAccountId: advance.advanceReceivableAccountId,
      actorUserId,
      postedAt: now,
      memo: `Apply approved employee expenses to cash advance ${advance.advanceNo}`,
    }));
  }
  if (repayment.gt(0)) {
    postings.push(await postAdvancePair(tx, scope, {
      advanceId: advance.id,
      postingType: 'employee_repayment',
      journalRef: `CA:${advance.advanceNo}:REPAY`,
      amount: repayment,
      debitAccountId: advance.bankAccountId,
      creditAccountId: advance.advanceReceivableAccountId,
      actorUserId,
      postedAt: now,
      memo: `Employee repayment for cash advance ${advance.advanceNo}`,
    }));
  }
  const [closed] = await tx.update(cashAdvance).set({
    status: 'closed',
    appliedExpenseAmount: fixed(applied, 2),
    employeeRepaidAmount: fixed(repayment, 2),
    employeePayableDifference: fixed(payableDifference, 2),
    closedByUserId: actorUserId,
    closedAt: now,
    version: advance.version + 1,
    updatedAt: now,
  }).where(and(
    eq(cashAdvance.id, advance.id),
    eq(cashAdvance.version, advance.version),
  )).returning();
  if (!closed) {
    throw new ExpenseSettlementError(
      'cash_advance_concurrent_change',
      'The cash advance changed while it was being settled.',
    );
  }
  await tx.insert(cashAdvanceEvent).values({
    ...scope,
    advanceId: advance.id,
    eventType: 'closed',
    actorUserId,
    reason,
    detail: {
      approvedExpenseTotal: fixed(expenseTotal, 2),
      appliedExpenseAmount: fixed(applied, 2),
      employeeRepaidAmount: fixed(repayment, 2),
      employeePayableDifference: fixed(payableDifference, 2),
      applicationCount: applications.length,
      journalRefs: postings.map((posting) => posting.journalRef),
    },
    createdAt: now,
  });
  return {
    advance: closed,
    applications,
    postings,
    reconciliation: {
      approvedExpenseTotal: fixed(expenseTotal, 2),
      appliedExpenseAmount: fixed(applied, 2),
      requiredRepayment: fixed(requiredRepayment, 2),
      employeePayableDifference: fixed(payableDifference, 2),
    },
  };
}

export async function closeCashAdvance(
  db: DB,
  scope: Scope,
  actorUserId: number,
  advanceId: number,
  input: {
    sources: CashAdvanceSourceInput[];
    employeeRepaidAmount: string | number;
    reason: string;
  },
  now = new Date(),
) {
  return withTenantTransaction(db, scope, (tx) =>
    closeCashAdvanceWithin(tx, scope, actorUserId, advanceId, input, now));
}

export async function listAllowanceAndAdvanceQueueWithin(
  tx: DB,
  scope: Scope,
  ownerUserId?: number,
) {
  const allowanceWhere = ownerUserId == null
    ? and(
      eq(expenseAllowanceCalculation.masterFn, scope.masterFn),
      eq(expenseAllowanceCalculation.companyFn, scope.companyFn),
    )
    : and(
      eq(expenseAllowanceCalculation.masterFn, scope.masterFn),
      eq(expenseAllowanceCalculation.companyFn, scope.companyFn),
      eq(expenseAllowanceCalculation.ownerUserId, ownerUserId),
    );
  const advanceWhere = ownerUserId == null
    ? and(
      eq(cashAdvance.masterFn, scope.masterFn),
      eq(cashAdvance.companyFn, scope.companyFn),
    )
    : and(
      eq(cashAdvance.masterFn, scope.masterFn),
      eq(cashAdvance.companyFn, scope.companyFn),
      eq(cashAdvance.ownerUserId, ownerUserId),
    );
  const [allowances, advances] = await Promise.all([
    tx.select().from(expenseAllowanceCalculation)
      .where(allowanceWhere).orderBy(desc(expenseAllowanceCalculation.serviceDate), asc(expenseAllowanceCalculation.id)),
    tx.select().from(cashAdvance)
      .where(advanceWhere).orderBy(desc(cashAdvance.issuedDate), asc(cashAdvance.id)),
  ]);
  return { allowances, advances };
}
