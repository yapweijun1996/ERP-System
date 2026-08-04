import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  account,
  accountingPeriod,
  appUser,
  approvalInstanceStep,
  documentProcessingPolicy,
  expenseClaim,
  expenseDuplicateOverride,
  expenseDuplicateSignal,
  expenseLineApproval,
  expenseLineControlAssessment,
  receiptInboxItem,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { processDocumentJobBatch } from '../documents/processing';
import { uploadReceiptDocument } from '../documents/upload';
import {
  createExpenseClaimDraft,
  replaceExpenseClaimDraftLines,
  submitExpenseClaimByEmployee,
} from './claims';
import {
  configureExpenseControlPolicyVersion,
  decideExpenseLineWithin,
  overrideHighRiskDuplicateWithin,
} from './controls';
import { configureExpensePolicyVersion } from './policy';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const julyApprovalNow = new Date('2026-07-26T00:00:00.000Z');
const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);
const visualFingerprint = 'ab'.repeat(32);

async function setup(
  budgetAction: 'warn' | 'extra_approval' | 'block',
  duplicateHighRiskScore = 70,
) {
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
  await configureExpensePolicyVersion(db, scope, admin.userId, {
    categoryCode: 'TRAVEL',
    categoryName: 'Business travel',
    policyKey: 'travel-control-test',
    policyName: 'Travel control test policy',
    versionNo: 1,
    validFrom: '2026-01-01',
    evidenceRequired: false,
    taxTreatment: 'exempt',
    employeePaidAllowed: true,
    companyPaidAllowed: false,
    expenseAccountId: accountId('5800'),
    employeePayableAccountId: accountId('2100'),
    companyPaidClearingAccountId: accountId('1000'),
    fxMethod: 'table_rate',
  });
  await configureExpenseControlPolicyVersion(db, scope, admin.userId, {
    policyKey: `expense-controls-${budgetAction}`,
    versionNo: 1,
    validFrom: '2026-01-01',
    duplicateHighRiskScore,
    budgetAction,
    budgetExtraApprovalPermissionKey: budgetAction === 'extra_approval'
      ? 'expenses.approve.budget'
      : null,
  });
  return { db, admin, viewer };
}

function line(receiptInboxItemId?: number) {
  return {
    merchant: 'Control Taxi',
    merchantTaxNumber: 'SG-TAX-7788',
    transactionDate: '2026-07-20',
    purpose: 'Customer visit transport',
    categoryCode: 'TRAVEL',
    paymentSource: 'employee_paid' as const,
    originalCurrency: 'SGD',
    originalNet: '50',
    originalTax: '0',
    originalGross: '50',
    receiptInboxItemId,
    allocationMode: 'percentage' as const,
    allocations: [{
      dimensionType: 'department' as const,
      dimensionKey: 'SALES',
      percentage: '100',
    }],
  };
}

async function createAndSubmit(
  db: Awaited<ReturnType<typeof freshDb>>,
  ownerUserId: number,
  suffix: string,
  receiptInboxItemId?: number,
) {
  const created = await createExpenseClaimDraft(db, scope, ownerUserId, {
    claimKey: `control-claim-${suffix}`,
    claimNo: `CTRL-${suffix}`,
    title: `Controlled expense ${suffix}`,
  });
  const replaced = await replaceExpenseClaimDraftLines(
    db,
    scope,
    ownerUserId,
    created.claim.id,
    created.claim.version,
    [line(receiptInboxItemId)],
  );
  return submitExpenseClaimByEmployee(
    db,
    scope,
    ownerUserId,
    created.claim.id,
    replaced.claim.version,
  );
}

describe('expense line approval and controls', () => {
  it('approves each line through manager and Finance while forbidding self-approval', async () => {
    const { db, admin, viewer } = await setup('warn');
    const submitted = await createAndSubmit(db, viewer.userId, 'APPROVE');
    const lineApprovalId = submitted.controls![0].lineApproval.id;
    expect(submitted.claim.status).toBe('pending_approval');
    expect(submitted.controls![0].assessment).toMatchObject({
      duplicateRiskLevel: 'none',
      budgetAction: 'warn',
      budgetBreached: true,
    });

    await expect(db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId,
      actorUserId: viewer.userId,
      decision: 'approved',
    }, julyApprovalNow))).rejects.toMatchObject({ code: 'self_approval_forbidden' });

    const manager = await db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId,
      actorUserId: admin.userId,
      decision: 'approved',
    }, julyApprovalNow));
    expect(manager).toMatchObject({ status: 'pending', claimStatus: 'pending_approval' });
    const finance = await db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId,
      actorUserId: admin.userId,
      decision: 'approved',
    }, julyApprovalNow));
    expect(finance).toMatchObject({ status: 'approved', claimStatus: 'approved' });
    expect((await db.select().from(expenseClaim))[0].status).toBe('approved');
  });

  it('supports reasoned line return and inserts budget exception before Finance', async () => {
    const { db, admin, viewer } = await setup('extra_approval');
    const submitted = await createAndSubmit(db, viewer.userId, 'EXTRA');
    const link = submitted.controls![0].lineApproval;
    const steps = await db.select().from(approvalInstanceStep)
      .where(eq(approvalInstanceStep.instanceId, link.approvalInstanceId))
      .orderBy(approvalInstanceStep.stepNo);
    expect(steps.map((step) => step.label)).toEqual([
      'Direct manager approval',
      'Budget exception approval',
      'Finance evidence, tax and GL approval',
    ]);
    await db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId: link.id,
      actorUserId: admin.userId,
      decision: 'returned',
      reason: 'Please provide a clearer business purpose.',
    }, julyApprovalNow));
    expect((await db.select().from(expenseLineApproval))[0].status).toBe('returned');
    expect((await db.select().from(expenseClaim))[0].status).toBe('returned');
  });

  it('rolls back submission when the confirmed budget action is block', async () => {
    const { db, viewer } = await setup('block');
    await expect(createAndSubmit(db, viewer.userId, 'BLOCK'))
      .rejects.toMatchObject({ code: 'expense_budget_blocked' });
    expect(await db.select().from(expenseLineControlAssessment)).toHaveLength(0);
    expect((await db.select().from(expenseClaim))[0]).toMatchObject({
      status: 'draft',
      version: 2,
    });
  });

  it('requires an immutable Finance override before final approval of a high-risk duplicate', async () => {
    const { db, admin, viewer } = await setup('warn');
    await db.insert(documentProcessingPolicy).values({
      ...scope,
      extractionProvider: 'local_ocr',
      autoSubmitEnabled: false,
      autoSubmitMinConfidence: '0.9800',
      updatedByUserId: admin.userId,
    });
    for (const suffix of ['first', 'second']) {
      await uploadReceiptDocument(db, scope, { userId: viewer.userId }, {
        clientDraftId: `duplicate_${suffix}`,
        fileName: `${suffix}.jpg`,
        declaredMimeType: 'image/jpeg',
        content: jpeg,
        autoSubmitAuthorized: false,
      });
    }
    await processDocumentJobBatch(db, {
      scanner: {
        scan: async () => ({ status: 'clean' as const, scanner: 'duplicate-test' }),
      },
      localOcr: {
        extract: async () => ({
          rawText: 'Control Taxi\nSGD 50.00',
          visualFingerprint,
          model: 'duplicate-test',
          safetyClear: true,
          fields: [],
        }),
      },
    });
    const receipts = await db.select().from(receiptInboxItem).orderBy(receiptInboxItem.id);
    await createAndSubmit(db, viewer.userId, 'DUP1', receipts[0].id);
    const duplicate = await createAndSubmit(db, viewer.userId, 'DUP2', receipts[1].id);
    const control = duplicate.controls![0];
    expect(control.assessment).toMatchObject({
      duplicateRiskScore: 100,
      duplicateRiskLevel: 'high',
    });
    expect(await db.select().from(expenseDuplicateSignal)).toHaveLength(3);

    await db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId: control.lineApproval.id,
      actorUserId: admin.userId,
      decision: 'approved',
    }, julyApprovalNow));
    await expect(db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId: control.lineApproval.id,
      actorUserId: admin.userId,
      decision: 'approved',
    }, julyApprovalNow))).rejects.toMatchObject({ code: 'expense_duplicate_override_required' });
    await expect(db.transaction((tx) => overrideHighRiskDuplicateWithin(
      tx,
      scope,
      { userId: viewer.userId, canOverride: false },
      control.assessment.id,
      'Not authorized to override.',
    ))).rejects.toMatchObject({
      code: 'expense_duplicate_override_permission_required',
    });
    await db.transaction((tx) => overrideHighRiskDuplicateWithin(
      tx,
      scope,
      { userId: admin.userId, canOverride: true },
      control.assessment.id,
      'Verified as a legitimate repeated journey with separate business purpose.',
    ));
    await db.transaction((tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId: control.lineApproval.id,
      actorUserId: admin.userId,
      decision: 'approved',
    }, julyApprovalNow));
    expect((await db.select().from(expenseLineApproval)
      .where(eq(expenseLineApproval.id, control.lineApproval.id)))[0].status).toBe('approved');
    await expect(db.update(expenseDuplicateOverride).set({
      reason: 'Silently rewritten override.',
    })).rejects.toThrow();
  });
});
