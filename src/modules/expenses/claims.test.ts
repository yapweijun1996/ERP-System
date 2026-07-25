import Decimal from 'decimal.js';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  account,
  appUser,
  currency,
  documentProcessingPolicy,
  expenseAllocation,
  expenseClaimEvent,
  expenseClaimLine,
  expenseClaimRevision,
  expenseLinePolicySnapshot,
  fxRate,
  receiptInboxItem,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { processDocumentJobBatch } from '../documents/processing';
import { uploadReceiptDocument } from '../documents/upload';
import {
  createExpenseClaimDraft,
  replaceExpenseClaimDraftLines,
  submitAuthorizedExpenseClaimBySystem,
  submitExpenseClaimByEmployee,
} from './claims';
import { configureExpenseControlPolicyVersion } from './controls';
import { configureExpensePolicyVersion } from './policy';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);

async function setup(evidenceRequired = false) {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  const accounts = await db.select().from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
  ));
  const accountId = (code: string) => {
    const row = accounts.find((candidate) => candidate.code === code);
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
  await configureExpenseControlPolicyVersion(db, scope, admin.userId, {
    policyKey: 'expense-controls-test',
    versionNo: 1,
    validFrom: '2026-01-01',
    duplicateHighRiskScore: 70,
    budgetAction: 'warn',
  });
  for (const categoryCode of ['TRAVEL', 'MEALS']) {
    await configureExpensePolicyVersion(db, scope, admin.userId, {
      categoryCode,
      categoryName: categoryCode === 'TRAVEL' ? 'Business travel' : 'Business meals',
      policyKey: `${categoryCode.toLowerCase()}-claim`,
      policyName: `${categoryCode} claim policy`,
      versionNo: 1,
      validFrom: '2026-01-01',
      evidenceRequired,
      taxTreatment: 'exempt',
      employeePaidAllowed: true,
      companyPaidAllowed: true,
      expenseAccountId: accountId('5800'),
      employeePayableAccountId: accountId('2100'),
      companyPaidClearingAccountId: accountId('1000'),
      fxMethod: 'table_rate',
    });
  }
  return { db, admin, viewer };
}

function amountLine() {
  return {
    merchant: 'Acme Taxi',
    transactionDate: '2026-07-20',
    purpose: 'Client site transport',
    categoryCode: 'TRAVEL',
    paymentSource: 'employee_paid' as const,
    originalCurrency: 'SGD',
    originalNet: '100.00',
    originalTax: '0',
    originalGross: '100.00',
    allocationMode: 'amount' as const,
    allocations: [
      {
        dimensionType: 'department' as const,
        dimensionKey: 'SALES',
        amount: '30',
      },
      {
        dimensionType: 'project' as const,
        dimensionKey: 'CLIENT-A',
        amount: '70',
      },
    ],
  };
}

function percentageLine() {
  return {
    merchant: 'Cafe Example',
    transactionDate: '2026-07-21',
    purpose: 'Customer working lunch',
    categoryCode: 'MEALS',
    paymentSource: 'company_paid' as const,
    originalCurrency: 'USD',
    originalNet: '50.00',
    originalTax: '0',
    originalGross: '50.00',
    allocationMode: 'percentage' as const,
    allocations: [
      {
        dimensionType: 'cost_center' as const,
        dimensionKey: 'CC-SALES',
        percentage: '33.3333',
      },
      {
        dimensionType: 'cost_center' as const,
        dimensionKey: 'CC-SUPPORT',
        percentage: '66.6667',
      },
    ],
  };
}

describe('employee-owned expense claims', () => {
  it('reconciles amount and percentage allocations and seals employee facts on submission', async () => {
    const { db, admin, viewer } = await setup();
    const created = await createExpenseClaimDraft(
      db,
      scope,
      viewer.userId,
      {
        claimKey: 'claim-manual-0001',
        claimNo: 'EC-0001',
        title: 'July customer expenses',
      },
    );
    const replaced = await replaceExpenseClaimDraftLines(
      db,
      scope,
      viewer.userId,
      created.claim.id,
      created.claim.version,
      [amountLine(), percentageLine()],
    );
    const lines = await db.select().from(expenseClaimLine)
      .orderBy(expenseClaimLine.lineNo);
    const allocations = await db.select().from(expenseAllocation)
      .orderBy(expenseAllocation.lineId, expenseAllocation.allocationNo);
    for (const line of lines) {
      const total = allocations
        .filter((allocation) => allocation.lineId === line.id)
        .reduce(
          (sum, allocation) => sum.plus(allocation.amountOriginal),
          new Decimal(0),
        );
      expect(total.eq(line.originalGross)).toBe(true);
    }
    expect(allocations.map((allocation) => allocation.amountOriginal)).toEqual([
      '30.0000',
      '70.0000',
      '16.6667',
      '33.3333',
    ]);

    await expect(replaceExpenseClaimDraftLines(
      db,
      scope,
      admin.userId,
      created.claim.id,
      replaced.claim.version,
      [amountLine()],
    )).rejects.toMatchObject({ code: 'expense_claim_employee_owner_required' });
    await expect(replaceExpenseClaimDraftLines(
      db,
      scope,
      viewer.userId,
      created.claim.id,
      replaced.claim.version,
      [{
        ...amountLine(),
        allocations: [{
          dimensionType: 'department',
          dimensionKey: 'SALES',
          amount: '99.99',
        }],
      }],
    )).rejects.toMatchObject({ code: 'expense_allocation_not_reconciled' });

    const submitted = await submitExpenseClaimByEmployee(
      db,
      scope,
      viewer.userId,
      created.claim.id,
      replaced.claim.version,
      new Date('2026-07-22T00:00:00.000Z'),
    );
    expect(submitted).toMatchObject({
      replayed: false,
      claim: {
        status: 'pending_approval',
        submissionKind: 'employee',
        submittedByUserId: viewer.userId,
      },
    });
    expect(submitted.claim.factsSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await db.select().from(expenseLinePolicySnapshot)).toHaveLength(2);
    expect(await db.select().from(expenseClaimRevision)).toHaveLength(1);
    expect(await db.select().from(expenseClaimEvent)).toHaveLength(3);
    await expect(replaceExpenseClaimDraftLines(
      db,
      scope,
      viewer.userId,
      created.claim.id,
      submitted.claim.version,
      [amountLine()],
    )).rejects.toMatchObject({ code: 'expense_claim_not_draft' });
    await expect(db.update(expenseClaimLine).set({
      merchant: 'Silently rewritten merchant',
    }).where(eq(expenseClaimLine.claimId, created.claim.id))).rejects.toThrow();
    await expect(db.delete(expenseAllocation)).rejects.toThrow();
  });

  it('requires explicit claim authorization and eligible system-submitted receipts', async () => {
    const { db, viewer } = await setup(true);
    const unauthorized = await createExpenseClaimDraft(
      db,
      scope,
      viewer.userId,
      {
        claimKey: 'claim-system-denied-0001',
        claimNo: 'EC-0002',
        title: 'Unauthorized automatic claim',
      },
    );
    const unauthorizedLines = await replaceExpenseClaimDraftLines(
      db,
      scope,
      viewer.userId,
      unauthorized.claim.id,
      unauthorized.claim.version,
      [amountLine()],
    );
    await expect(submitAuthorizedExpenseClaimBySystem(
      db,
      scope,
      viewer.userId,
      unauthorized.claim.id,
      unauthorizedLines.claim.version,
    )).rejects.toMatchObject({ code: 'expense_claim_auto_submit_not_authorized' });

    const ineligible = await createExpenseClaimDraft(
      db,
      scope,
      viewer.userId,
      {
        claimKey: 'claim-system-ineligible-0001',
        claimNo: 'EC-0003',
        title: 'Missing receipt automatic claim',
        autoSubmitAuthorized: true,
      },
    );
    const ineligibleLines = await replaceExpenseClaimDraftLines(
      db,
      scope,
      viewer.userId,
      ineligible.claim.id,
      ineligible.claim.version,
      [amountLine()],
    );
    await expect(submitAuthorizedExpenseClaimBySystem(
      db,
      scope,
      viewer.userId,
      ineligible.claim.id,
      ineligibleLines.claim.version,
    )).rejects.toMatchObject({ code: 'expense_claim_auto_submit_ineligible' });

    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'local_ocr',
      autoSubmitEnabled: true,
      autoSubmitMinConfidence: '0.9800',
      updatedByUserId: viewer.userId,
    });
    await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
      clientDraftId: 'claim_system_receipt_0001',
      fileName: 'receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      autoSubmitAuthorized: true,
    });
    await processDocumentJobBatch(db, {
      scanner: {
        scan: async () => ({ status: 'clean' as const, scanner: 'claim-test' }),
      },
      localOcr: {
        extract: async () => ({
          rawText: 'Acme Taxi\n2026-07-20\nSGD 100.00',
          model: 'claim-test',
          safetyClear: true,
          fields: [
            {
              fieldKey: 'merchant_name',
              value: 'Acme Taxi',
              sourceRef: 'page:1:block:1',
              confidence: 0.999,
            },
            {
              fieldKey: 'transaction_date',
              value: '2026-07-20',
              sourceRef: 'page:1:block:2',
              confidence: 0.999,
            },
            {
              fieldKey: 'currency',
              value: 'SGD',
              sourceRef: 'page:1:block:3',
              confidence: 0.999,
            },
            {
              fieldKey: 'total_amount',
              value: '100.00',
              sourceRef: 'page:1:block:4',
              confidence: 0.999,
            },
          ],
        }),
      },
    });
    const [receipt] = await db.select().from(receiptInboxItem);
    expect(receipt.status).toBe('submitted');

    const eligible = await createExpenseClaimDraft(
      db,
      scope,
      viewer.userId,
      {
        claimKey: 'claim-system-eligible-0001',
        claimNo: 'EC-0004',
        title: 'Authorized automatic claim',
        autoSubmitAuthorized: true,
      },
    );
    const eligibleLines = await replaceExpenseClaimDraftLines(
      db,
      scope,
      viewer.userId,
      eligible.claim.id,
      eligible.claim.version,
      [{
        ...amountLine(),
        receiptInboxItemId: receipt.id,
      }],
    );
    const submitted = await submitAuthorizedExpenseClaimBySystem(
      db,
      scope,
      viewer.userId,
      eligible.claim.id,
      eligibleLines.claim.version,
    );
    expect(submitted).toMatchObject({
      replayed: false,
      claim: {
        status: 'pending_approval',
        submissionKind: 'system',
        submittedByUserId: viewer.userId,
        systemActorKey: 'expense-auto-submit-v1',
      },
    });
  });
});
