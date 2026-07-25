import Decimal from 'decimal.js';
import {
  and,
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
  company,
  currency,
  documentVersion,
  expenseBankChargeOverride,
  expenseCategory,
  expenseLinePolicySnapshot,
  expensePolicy,
  expensePolicyVersion,
  fxRate,
  taxRule,
} from '../../data/schema';
import { assertDocumentScanClean } from '../documents/processing';

export class ExpensePolicyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'ExpensePolicyError';
  }
}

function dateText(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)
    || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw new ExpensePolicyError(
      'expense_policy_date_invalid',
      `${label} must be a valid ISO date.`,
      422,
    );
  }
  return value;
}

function decimal(
  value: string | number,
  label: string,
  options: { zero?: boolean } = {},
): Decimal {
  let amount: Decimal;
  try {
    amount = new Decimal(value);
  } catch {
    throw new ExpensePolicyError('expense_amount_invalid', `${label} is invalid.`, 422);
  }
  if (!amount.isFinite() || (options.zero ? amount.lt(0) : amount.lte(0))) {
    throw new ExpensePolicyError(
      'expense_amount_invalid',
      `${label} must be ${options.zero ? 'zero or positive' : 'positive'}.`,
      422,
    );
  }
  return amount;
}

function fixed(value: Decimal, places: number): string {
  return value.toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places);
}

function reasonText(value: string): string {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 1000) {
    throw new ExpensePolicyError(
      'expense_bank_charge_reason_invalid',
      'A Finance verification reason of 3–1000 characters is required.',
      422,
    );
  }
  return reason;
}

export interface ExpensePolicyConfiguration {
  categoryCode: string;
  categoryName: string;
  policyKey: string;
  policyName: string;
  versionNo: number;
  validFrom: string;
  validTo?: string | null;
  evidenceRequired?: boolean;
  maxGrossBase?: string | number | null;
  taxTreatment: 'input_tax' | 'non_deductible' | 'exempt';
  taxCode?: string | null;
  inputTaxRecoverablePct?: string | number;
  employeePaidAllowed?: boolean;
  companyPaidAllowed?: boolean;
  expenseAccountId: number;
  inputTaxAccountId?: number | null;
  employeePayableAccountId: number;
  companyPaidClearingAccountId: number;
  fxMethod: 'table_rate' | 'actual_bank_allowed';
}

export async function configureExpensePolicyVersion(
  db: DB,
  scope: Scope,
  actorUserId: number,
  input: ExpensePolicyConfiguration,
  now = new Date(),
) {
  const categoryCode = input.categoryCode.trim().toUpperCase();
  const categoryName = input.categoryName.trim();
  const policyKey = input.policyKey.trim().toLowerCase();
  const policyName = input.policyName.trim();
  const validFrom = dateText(input.validFrom, 'Policy start');
  const validTo = input.validTo == null ? null : dateText(input.validTo, 'Policy end');
  if (validTo && validTo < validFrom) {
    throw new ExpensePolicyError(
      'expense_policy_date_invalid',
      'Policy end cannot precede its start.',
      422,
    );
  }
  if (!Number.isSafeInteger(input.versionNo) || input.versionNo <= 0) {
    throw new ExpensePolicyError(
      'expense_policy_version_invalid',
      'Policy version must be positive.',
      422,
    );
  }
  const maxGrossBase = input.maxGrossBase == null
    ? null
    : fixed(decimal(input.maxGrossBase, 'Maximum gross amount'), 4);
  const recoverablePct = input.taxTreatment === 'input_tax'
    ? decimal(input.inputTaxRecoverablePct ?? 100, 'Input-tax recoverable percentage', {
      zero: true,
    })
    : new Decimal(0);
  if (recoverablePct.gt(100)) {
    throw new ExpensePolicyError(
      'expense_policy_tax_invalid',
      'Input-tax recoverable percentage cannot exceed 100.',
      422,
    );
  }
  const accountIds = [
    input.expenseAccountId,
    input.employeePayableAccountId,
    input.companyPaidClearingAccountId,
    ...(input.inputTaxAccountId == null ? [] : [input.inputTaxAccountId]),
  ];
  return withTenantTransaction(db, scope, async (tx) => {
    const [companyRow] = await tx.select({
      currency: company.currency,
    }).from(company).where(and(
      eq(company.masterFn, scope.masterFn),
      eq(company.companyFn, scope.companyFn),
    )).limit(1);
    if (!companyRow) {
      throw new ExpensePolicyError('expense_company_missing', 'Company is unavailable.', 404);
    }
    const accountRows = await tx.select({
      id: account.id,
      type: account.type,
    }).from(account).where(and(
      eq(account.masterFn, scope.masterFn),
      eq(account.companyFn, scope.companyFn),
      inArray(account.id, accountIds),
    ));
    const byId = new Map(accountRows.map((row) => [row.id, row.type]));
    if (byId.get(input.expenseAccountId) !== 'expense'
      || byId.get(input.employeePayableAccountId) !== 'liability'
      || !['asset', 'liability'].includes(byId.get(input.companyPaidClearingAccountId) ?? '')
      || (input.taxTreatment === 'input_tax'
        && byId.get(input.inputTaxAccountId ?? -1) !== 'asset')) {
      throw new ExpensePolicyError(
        'expense_policy_account_invalid',
        'Expense, input-tax, employee-payable or company-clearing account mapping is invalid.',
        422,
      );
    }
    if (input.taxTreatment === 'input_tax' && !input.taxCode?.trim()) {
      throw new ExpensePolicyError(
        'expense_policy_tax_invalid',
        'Input-tax treatment requires a tax code.',
        422,
      );
    }
    const [category] = await tx.insert(expenseCategory).values({
      ...scope,
      code: categoryCode,
      name: categoryName,
    }).onConflictDoUpdate({
      target: [
        expenseCategory.masterFn,
        expenseCategory.companyFn,
        expenseCategory.code,
      ],
      set: { name: categoryName, active: true, updatedAt: now },
    }).returning();
    const [policy] = await tx.insert(expensePolicy).values({
      ...scope,
      policyKey,
      name: policyName,
      createdByUserId: actorUserId,
    }).onConflictDoNothing().returning();
    const resolvedPolicy = policy ?? (await tx.select().from(expensePolicy).where(and(
      eq(expensePolicy.masterFn, scope.masterFn),
      eq(expensePolicy.companyFn, scope.companyFn),
      eq(expensePolicy.policyKey, policyKey),
    )).limit(1))[0];
    if (!resolvedPolicy) throw new Error('Expense policy replay resolution failed.');
    const [existingVersion] = await tx.select().from(expensePolicyVersion).where(and(
      eq(expensePolicyVersion.masterFn, scope.masterFn),
      eq(expensePolicyVersion.companyFn, scope.companyFn),
      eq(expensePolicyVersion.policyId, resolvedPolicy.id),
      eq(expensePolicyVersion.versionNo, input.versionNo),
    )).limit(1);
    if (existingVersion) {
      const replay = existingVersion.categoryId === category.id
        && existingVersion.validFrom === validFrom
        && existingVersion.validTo === validTo;
      if (!replay) {
        throw new ExpensePolicyError(
          'expense_policy_version_conflict',
          'This policy version already exists with different effective facts.',
        );
      }
      return { category, policy: resolvedPolicy, version: existingVersion, replayed: true };
    }
    const [overlap] = await tx.select({ id: expensePolicyVersion.id })
      .from(expensePolicyVersion).where(and(
        eq(expensePolicyVersion.masterFn, scope.masterFn),
        eq(expensePolicyVersion.companyFn, scope.companyFn),
        eq(expensePolicyVersion.categoryId, category.id),
        eq(expensePolicyVersion.status, 'confirmed'),
        lte(expensePolicyVersion.validFrom, validTo ?? '9999-12-31'),
        or(
          isNull(expensePolicyVersion.validTo),
          gte(expensePolicyVersion.validTo, validFrom),
        ),
      )).limit(1);
    if (overlap) {
      throw new ExpensePolicyError(
        'expense_policy_version_overlap',
        'A confirmed policy already covers part of this category period.',
      );
    }
    const [version] = await tx.insert(expensePolicyVersion).values({
      ...scope,
      policyId: resolvedPolicy.id,
      categoryId: category.id,
      versionNo: input.versionNo,
      validFrom,
      validTo,
      evidenceRequired: input.evidenceRequired ?? true,
      maxGrossBase,
      taxTreatment: input.taxTreatment,
      taxCode: input.taxTreatment === 'input_tax' ? input.taxCode!.trim() : null,
      inputTaxRecoverablePct: fixed(recoverablePct, 4),
      employeePaidAllowed: input.employeePaidAllowed ?? true,
      companyPaidAllowed: input.companyPaidAllowed ?? false,
      expenseAccountId: input.expenseAccountId,
      inputTaxAccountId: input.taxTreatment === 'input_tax'
        ? input.inputTaxAccountId
        : null,
      employeePayableAccountId: input.employeePayableAccountId,
      companyPaidClearingAccountId: input.companyPaidClearingAccountId,
      fxMethod: input.fxMethod,
      confirmedByUserId: actorUserId,
      confirmedAt: now,
    }).returning();
    return { category, policy: resolvedPolicy, version, replayed: false };
  });
}

export interface SubmittedExpenseLine {
  lineKey: string;
  categoryCode: string;
  transactionDate: string;
  paymentSource: 'employee_paid' | 'company_paid';
  originalCurrency: string;
  originalNet: string | number;
  originalTax: string | number;
  originalGross: string | number;
}

export async function snapshotSubmittedExpenseLine(
  db: DB,
  scope: Scope,
  ownerUserId: number,
  input: SubmittedExpenseLine,
  now = new Date(),
) {
  const lineKey = input.lineKey.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(lineKey)) {
    throw new ExpensePolicyError(
      'expense_line_key_invalid',
      'A stable line key of 8–128 safe characters is required.',
      422,
    );
  }
  const transactionDate = dateText(input.transactionDate, 'Transaction date');
  const originalNet = decimal(input.originalNet, 'Original net', { zero: true });
  const originalTax = decimal(input.originalTax, 'Original tax', { zero: true });
  const originalGross = decimal(input.originalGross, 'Original gross');
  if (!originalNet.plus(originalTax).eq(originalGross)) {
    throw new ExpensePolicyError(
      'expense_line_total_invalid',
      'Original net plus tax must equal original gross exactly.',
      422,
    );
  }
  const originalCurrency = input.originalCurrency.trim().toUpperCase();
  return withTenantTransaction(db, scope, async (tx) => {
    const [companyRow] = await tx.select({
      currency: company.currency,
    }).from(company).where(and(
      eq(company.masterFn, scope.masterFn),
      eq(company.companyFn, scope.companyFn),
    )).limit(1);
    const [currencyRow] = await tx.select({
      decimals: currency.decimals,
    }).from(currency).where(eq(currency.code, originalCurrency)).limit(1);
    if (!companyRow || !currencyRow) {
      throw new ExpensePolicyError(
        'expense_line_currency_invalid',
        'Original or functional currency is unavailable.',
        422,
      );
    }
    const [category] = await tx.select().from(expenseCategory).where(and(
      eq(expenseCategory.masterFn, scope.masterFn),
      eq(expenseCategory.companyFn, scope.companyFn),
      eq(expenseCategory.code, input.categoryCode.trim().toUpperCase()),
      eq(expenseCategory.active, true),
    )).limit(1);
    if (!category) {
      throw new ExpensePolicyError(
        'expense_category_missing',
        'Expense category is unavailable.',
        404,
      );
    }
    const [policy] = await tx.select().from(expensePolicyVersion).where(and(
      eq(expensePolicyVersion.masterFn, scope.masterFn),
      eq(expensePolicyVersion.companyFn, scope.companyFn),
      eq(expensePolicyVersion.categoryId, category.id),
      eq(expensePolicyVersion.status, 'confirmed'),
      lte(expensePolicyVersion.validFrom, transactionDate),
      or(
        isNull(expensePolicyVersion.validTo),
        gte(expensePolicyVersion.validTo, transactionDate),
      ),
    )).orderBy(desc(expensePolicyVersion.validFrom)).limit(1);
    if (!policy) {
      throw new ExpensePolicyError(
        'expense_policy_not_effective',
        'No confirmed expense policy covers this line date.',
        422,
      );
    }
    if ((input.paymentSource === 'employee_paid' && !policy.employeePaidAllowed)
      || (input.paymentSource === 'company_paid' && !policy.companyPaidAllowed)) {
      throw new ExpensePolicyError(
        'expense_payment_source_forbidden',
        'This payment source is not allowed by the selected policy.',
        422,
      );
    }
    let rate = new Decimal(1);
    if (originalCurrency !== companyRow.currency) {
      const [rateRow] = await tx.select().from(fxRate).where(and(
        eq(fxRate.fromCcy, originalCurrency),
        eq(fxRate.toCcy, companyRow.currency),
        lte(fxRate.validFrom, transactionDate),
      )).orderBy(desc(fxRate.validFrom)).limit(1);
      if (!rateRow) {
        throw new ExpensePolicyError(
          'expense_fx_rate_missing',
          'No policy FX rate covers this line date.',
          422,
        );
      }
      rate = decimal(rateRow.rate, 'Policy FX rate');
    }
    let taxRate = new Decimal(0);
    if (policy.taxTreatment === 'input_tax') {
      const [rule] = await tx.select().from(taxRule).where(and(
        eq(taxRule.masterFn, scope.masterFn),
        eq(taxRule.companyFn, scope.companyFn),
        eq(taxRule.taxCode, policy.taxCode!),
        lte(taxRule.validFrom, transactionDate),
        or(isNull(taxRule.validTo), gte(taxRule.validTo, transactionDate)),
      )).orderBy(desc(taxRule.validFrom)).limit(1);
      if (!rule) {
        throw new ExpensePolicyError(
          'expense_tax_rule_missing',
          'No configured tax rule covers this line date.',
          422,
        );
      }
      taxRate = decimal(rule.rate, 'Tax rate', { zero: true });
      const expectedTax = originalNet.mul(taxRate).div(100)
        .toDecimalPlaces(currencyRow.decimals, Decimal.ROUND_HALF_UP);
      if (!originalTax.eq(expectedTax)) {
        throw new ExpensePolicyError(
          'expense_tax_amount_invalid',
          `Original tax must equal configured ${policy.taxCode} treatment.`,
          422,
        );
      }
    } else if (policy.taxTreatment === 'exempt' && !originalTax.isZero()) {
      throw new ExpensePolicyError(
        'expense_tax_amount_invalid',
        'Exempt expense lines cannot carry tax.',
        422,
      );
    }
    const convertedNet = originalNet.mul(rate);
    const convertedTax = originalTax.mul(rate);
    const recoverableTax = policy.taxTreatment === 'input_tax'
      ? convertedTax.mul(new Decimal(policy.inputTaxRecoverablePct)).div(100)
      : new Decimal(0);
    const baseInputTax = recoverableTax.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const baseExpense = convertedNet.plus(convertedTax).minus(baseInputTax)
      .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const baseGross = baseExpense.plus(baseInputTax);
    if (policy.maxGrossBase != null && baseGross.gt(policy.maxGrossBase)) {
      throw new ExpensePolicyError(
        'expense_policy_limit_exceeded',
        'Expense line exceeds the applicable base-currency policy limit.',
        422,
      );
    }
    const values = {
      ...scope,
      lineKey,
      ownerUserId,
      categoryId: category.id,
      policyVersionId: policy.id,
      transactionDate,
      submittedAt: now,
      paymentSource: input.paymentSource,
      originalCurrency,
      originalNet: fixed(originalNet, 4),
      originalTax: fixed(originalTax, 4),
      originalGross: fixed(originalGross, 4),
      functionalCurrency: companyRow.currency,
      policyFxRate: fixed(rate, 8),
      baseExpense: fixed(baseExpense, 4),
      baseInputTax: fixed(baseInputTax, 4),
      baseGross: fixed(baseGross, 4),
      taxTreatment: policy.taxTreatment,
      taxCode: policy.taxCode,
      taxRate: fixed(taxRate, 4),
      inputTaxRecoverablePct: policy.inputTaxRecoverablePct,
      expenseAccountId: policy.expenseAccountId,
      inputTaxAccountId: policy.inputTaxAccountId,
      creditAccountId: input.paymentSource === 'employee_paid'
        ? policy.employeePayableAccountId
        : policy.companyPaidClearingAccountId,
      fxMethod: policy.fxMethod,
    };
    const [existing] = await tx.select().from(expenseLinePolicySnapshot).where(and(
      eq(expenseLinePolicySnapshot.masterFn, scope.masterFn),
      eq(expenseLinePolicySnapshot.companyFn, scope.companyFn),
      eq(expenseLinePolicySnapshot.lineKey, lineKey),
    )).limit(1);
    if (existing) {
      const matches = existing.ownerUserId === ownerUserId
        && existing.policyVersionId === policy.id
        && existing.originalCurrency === originalCurrency
        && existing.originalGross === values.originalGross
        && existing.paymentSource === input.paymentSource;
      if (!matches) {
        throw new ExpensePolicyError(
          'expense_line_key_conflict',
          'This expense line key is already used by different submitted facts.',
        );
      }
      return { snapshot: existing, replayed: true };
    }
    const [snapshot] = await tx.insert(expenseLinePolicySnapshot).values(values).returning();
    return { snapshot, replayed: false };
  });
}

export async function verifyActualBankCharge(
  db: DB,
  scope: Scope,
  actor: { userId: number; canFinance: boolean },
  input: {
    snapshotId: number;
    actualBaseGross: string | number;
    evidenceVersionId: number;
    reason: string;
  },
  now = new Date(),
) {
  if (!actor.canFinance) {
    throw new ExpensePolicyError(
      'expense_bank_charge_finance_required',
      'Finance permission is required to verify an actual bank charge.',
      403,
    );
  }
  const actualBaseGross = decimal(input.actualBaseGross, 'Actual base-currency charge');
  const reason = reasonText(input.reason);
  return withTenantTransaction(db, scope, async (tx) => {
    const [snapshot] = await tx.select().from(expenseLinePolicySnapshot).where(and(
      eq(expenseLinePolicySnapshot.masterFn, scope.masterFn),
      eq(expenseLinePolicySnapshot.companyFn, scope.companyFn),
      eq(expenseLinePolicySnapshot.id, input.snapshotId),
    )).limit(1).for('update');
    if (!snapshot) {
      throw new ExpensePolicyError(
        'expense_snapshot_missing',
        'Expense line policy snapshot is unavailable.',
        404,
      );
    }
    if (snapshot.fxMethod !== 'actual_bank_allowed'
      || snapshot.paymentSource !== 'company_paid'
      || snapshot.originalCurrency === snapshot.functionalCurrency) {
      throw new ExpensePolicyError(
        'expense_bank_charge_override_forbidden',
        'This submitted line is not eligible for an actual bank-charge override.',
        422,
      );
    }
    const [evidence] = await tx.select().from(documentVersion).where(and(
      eq(documentVersion.masterFn, scope.masterFn),
      eq(documentVersion.companyFn, scope.companyFn),
      eq(documentVersion.id, input.evidenceVersionId),
    )).limit(1);
    if (!evidence) {
      throw new ExpensePolicyError(
        'expense_bank_charge_evidence_missing',
        'Finance evidence is unavailable in the active company.',
        404,
      );
    }
    await assertDocumentScanClean(tx, scope, evidence.id, 'preview');
    const rate = actualBaseGross.div(snapshot.originalGross);
    const values = {
      ...scope,
      snapshotId: snapshot.id,
      actualBaseGross: fixed(actualBaseGross, 4),
      actualFxRate: fixed(rate, 8),
      evidenceVersionId: evidence.id,
      reason,
      verifiedByUserId: actor.userId,
      verifiedAt: now,
    };
    const [existing] = await tx.select().from(expenseBankChargeOverride).where(and(
      eq(expenseBankChargeOverride.masterFn, scope.masterFn),
      eq(expenseBankChargeOverride.companyFn, scope.companyFn),
      eq(expenseBankChargeOverride.snapshotId, snapshot.id),
    )).limit(1);
    if (existing) {
      const matches = existing.actualBaseGross === values.actualBaseGross
        && existing.evidenceVersionId === evidence.id
        && existing.reason === reason
        && existing.verifiedByUserId === actor.userId;
      if (!matches) {
        throw new ExpensePolicyError(
          'expense_bank_charge_override_conflict',
          'A different verified bank charge already exists for this line.',
        );
      }
      return { snapshot, override: existing, replayed: true };
    }
    const [override] = await tx.insert(expenseBankChargeOverride).values(values).returning();
    return { snapshot, override, replayed: false };
  });
}
