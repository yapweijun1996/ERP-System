import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  account,
  appUser,
  currency,
  documentScanJob,
  expenseBankChargeOverride,
  expenseLinePolicySnapshot,
  expensePolicyVersion,
  fxRate,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { uploadReceiptDocument } from '../documents/upload';
import {
  configureExpensePolicyVersion,
  snapshotSubmittedExpenseLine,
  verifyActualBankCharge,
} from './policy';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);

async function setup() {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  const rows = await db.select().from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
  ));
  const accountId = (code: string) => {
    const row = rows.find((candidate) => candidate.code === code);
    if (!row) throw new Error(`Missing account ${code}`);
    return row.id;
  };
  await db.insert(currency).values({
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
  });
  await db.insert(fxRate).values({
    fromCcy: 'USD',
    toCcy: 'SGD',
    rate: '1.35000000',
    validFrom: '2026-01-01',
  });
  return { db, admin, viewer, accountId };
}

describe('effective-dated expense tax, FX and GL policy', () => {
  it('snapshots the applicable version with Decimal-exact original/base and tax facts', async () => {
    const { db, admin, viewer, accountId } = await setup();
    const configured = await configureExpensePolicyVersion(
      db,
      scope,
      admin.userId,
      {
        categoryCode: 'TRAVEL',
        categoryName: 'Business travel',
        policyKey: 'travel-standard',
        policyName: 'Travel standard policy',
        versionNo: 1,
        validFrom: '2026-01-01',
        taxTreatment: 'input_tax',
        taxCode: 'SR',
        inputTaxRecoverablePct: '100',
        employeePaidAllowed: true,
        companyPaidAllowed: true,
        expenseAccountId: accountId('5800'),
        inputTaxAccountId: accountId('1200'),
        employeePayableAccountId: accountId('2100'),
        companyPaidClearingAccountId: accountId('1000'),
        fxMethod: 'actual_bank_allowed',
      },
      new Date('2025-12-01T00:00:00.000Z'),
    );
    expect(configured).toMatchObject({
      replayed: false,
      version: {
        versionNo: 1,
        validFrom: '2026-01-01',
        taxTreatment: 'input_tax',
        taxCode: 'SR',
      },
    });
    expect((await configureExpensePolicyVersion(
      db,
      scope,
      admin.userId,
      {
        categoryCode: 'TRAVEL',
        categoryName: 'Business travel',
        policyKey: 'travel-standard',
        policyName: 'Travel standard policy',
        versionNo: 1,
        validFrom: '2026-01-01',
        taxTreatment: 'input_tax',
        taxCode: 'SR',
        inputTaxRecoverablePct: '100',
        employeePaidAllowed: true,
        companyPaidAllowed: true,
        expenseAccountId: accountId('5800'),
        inputTaxAccountId: accountId('1200'),
        employeePayableAccountId: accountId('2100'),
        companyPaidClearingAccountId: accountId('1000'),
        fxMethod: 'actual_bank_allowed',
      },
    )).replayed).toBe(true);
    await expect(configureExpensePolicyVersion(
      db,
      scope,
      admin.userId,
      {
        categoryCode: 'TRAVEL',
        categoryName: 'Business travel',
        policyKey: 'travel-overlap',
        policyName: 'Overlapping travel policy',
        versionNo: 1,
        validFrom: '2026-06-01',
        taxTreatment: 'exempt',
        employeePaidAllowed: true,
        companyPaidAllowed: false,
        expenseAccountId: accountId('5800'),
        employeePayableAccountId: accountId('2100'),
        companyPaidClearingAccountId: accountId('1000'),
        fxMethod: 'table_rate',
      },
    )).rejects.toMatchObject({ code: 'expense_policy_version_overlap' });

    const submitted = await snapshotSubmittedExpenseLine(
      db,
      scope,
      viewer.userId,
      {
        lineKey: 'expense-line-policy-0001',
        categoryCode: 'TRAVEL',
        transactionDate: '2026-07-20',
        paymentSource: 'company_paid',
        originalCurrency: 'USD',
        originalNet: '100.00',
        originalTax: '9.00',
        originalGross: '109.00',
      },
      new Date('2026-07-21T00:00:00.000Z'),
    );
    expect(submitted).toMatchObject({
      replayed: false,
      snapshot: {
        ownerUserId: viewer.userId,
        policyVersionId: configured.version.id,
        transactionDate: '2026-07-20',
        paymentSource: 'company_paid',
        originalCurrency: 'USD',
        originalNet: '100.0000',
        originalTax: '9.0000',
        originalGross: '109.0000',
        functionalCurrency: 'SGD',
        policyFxRate: '1.35000000',
        baseExpense: '135.0000',
        baseInputTax: '12.1500',
        baseGross: '147.1500',
        taxTreatment: 'input_tax',
        taxCode: 'SR',
        taxRate: '9.0000',
        creditAccountId: accountId('1000'),
      },
    });
    expect((await snapshotSubmittedExpenseLine(
      db,
      scope,
      viewer.userId,
      {
        lineKey: 'expense-line-policy-0001',
        categoryCode: 'TRAVEL',
        transactionDate: '2026-07-20',
        paymentSource: 'company_paid',
        originalCurrency: 'USD',
        originalNet: '100.00',
        originalTax: '9.00',
        originalGross: '109.00',
      },
    )).replayed).toBe(true);
    expect(await db.select().from(expenseLinePolicySnapshot)).toHaveLength(1);
    await expect(db.update(expenseLinePolicySnapshot).set({
      originalGross: '999.0000',
    })).rejects.toThrow();
  });

  it('allows a verified actual bank charge only for Finance with clean evidence', async () => {
    const { db, admin, viewer, accountId } = await setup();
    await configureExpensePolicyVersion(db, scope, admin.userId, {
      categoryCode: 'TRAVEL',
      categoryName: 'Business travel',
      policyKey: 'travel-bank',
      policyName: 'Travel bank policy',
      versionNo: 1,
      validFrom: '2025-01-01',
      taxTreatment: 'input_tax',
      taxCode: 'SR',
      inputTaxRecoverablePct: '100',
      employeePaidAllowed: false,
      companyPaidAllowed: true,
      expenseAccountId: accountId('5800'),
      inputTaxAccountId: accountId('1200'),
      employeePayableAccountId: accountId('2100'),
      companyPaidClearingAccountId: accountId('1000'),
      fxMethod: 'actual_bank_allowed',
    });
    const { snapshot } = await snapshotSubmittedExpenseLine(
      db,
      scope,
      viewer.userId,
      {
        lineKey: 'expense-bank-charge-0001',
        categoryCode: 'TRAVEL',
        transactionDate: '2026-07-20',
        paymentSource: 'company_paid',
        originalCurrency: 'USD',
        originalNet: '100.00',
        originalTax: '9.00',
        originalGross: '109.00',
      },
    );
    const evidence = await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'bank_charge_evidence_001',
      fileName: 'bank-charge.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
    });
    await expect(verifyActualBankCharge(
      db,
      scope,
      { userId: viewer.userId, canFinance: false },
      {
        snapshotId: snapshot.id,
        actualBaseGross: '148.50',
        evidenceVersionId: evidence.version.id,
        reason: 'Card statement confirms the actual charge.',
      },
    )).rejects.toMatchObject({ code: 'expense_bank_charge_finance_required' });
    await expect(verifyActualBankCharge(
      db,
      scope,
      { userId: admin.userId, canFinance: true },
      {
        snapshotId: snapshot.id,
        actualBaseGross: '148.50',
        evidenceVersionId: evidence.version.id,
        reason: 'Card statement confirms the actual charge.',
      },
    )).rejects.toMatchObject({
      code: 'document_quarantined',
      scanStatus: 'queued',
    });
    await db.update(documentScanJob).set({
      status: 'clean',
      scanner: 'expense-policy-proof',
      resultCode: 'clean',
      completedAt: new Date('2026-07-22T00:00:00.000Z'),
    }).where(eq(documentScanJob.versionId, evidence.version.id));
    const verified = await verifyActualBankCharge(
      db,
      scope,
      { userId: admin.userId, canFinance: true },
      {
        snapshotId: snapshot.id,
        actualBaseGross: '148.50',
        evidenceVersionId: evidence.version.id,
        reason: 'Card statement confirms the actual charge.',
      },
      new Date('2026-07-22T00:00:00.000Z'),
    );
    expect(verified).toMatchObject({
      replayed: false,
      override: {
        snapshotId: snapshot.id,
        actualBaseGross: '148.5000',
        actualFxRate: '1.36238532',
        evidenceVersionId: evidence.version.id,
        reason: 'Card statement confirms the actual charge.',
        verifiedByUserId: admin.userId,
      },
    });
    expect((await verifyActualBankCharge(
      db,
      scope,
      { userId: admin.userId, canFinance: true },
      {
        snapshotId: snapshot.id,
        actualBaseGross: '148.50',
        evidenceVersionId: evidence.version.id,
        reason: 'Card statement confirms the actual charge.',
      },
    )).replayed).toBe(true);
    expect(await db.select().from(expenseBankChargeOverride)).toHaveLength(1);
    await expect(db.delete(expenseBankChargeOverride)).rejects.toThrow();
  });

  it('rejects wrong configured tax and missing effective FX rates', async () => {
    const { db, admin, viewer, accountId } = await setup();
    await configureExpensePolicyVersion(db, scope, admin.userId, {
      categoryCode: 'MEALS',
      categoryName: 'Business meals',
      policyKey: 'meals-standard',
      policyName: 'Meals standard policy',
      versionNo: 1,
      validFrom: '2025-01-01',
      taxTreatment: 'input_tax',
      taxCode: 'SR',
      inputTaxRecoverablePct: '50',
      employeePaidAllowed: true,
      companyPaidAllowed: false,
      expenseAccountId: accountId('5800'),
      inputTaxAccountId: accountId('1200'),
      employeePayableAccountId: accountId('2100'),
      companyPaidClearingAccountId: accountId('1000'),
      fxMethod: 'table_rate',
    });
    await expect(snapshotSubmittedExpenseLine(db, scope, viewer.userId, {
      lineKey: 'expense-wrong-tax-0001',
      categoryCode: 'MEALS',
      transactionDate: '2026-07-20',
      paymentSource: 'employee_paid',
      originalCurrency: 'SGD',
      originalNet: '100.00',
      originalTax: '8.00',
      originalGross: '108.00',
    })).rejects.toMatchObject({ code: 'expense_tax_amount_invalid' });
    await expect(snapshotSubmittedExpenseLine(db, scope, viewer.userId, {
      lineKey: 'expense-missing-fx-0001',
      categoryCode: 'MEALS',
      transactionDate: '2025-07-20',
      paymentSource: 'employee_paid',
      originalCurrency: 'USD',
      originalNet: '100.00',
      originalTax: '9.00',
      originalGross: '109.00',
    })).rejects.toMatchObject({ code: 'expense_fx_rate_missing' });
    expect(await db.select().from(expensePolicyVersion)).toHaveLength(1);
  });
});
