import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { encryptToken } from '../../auth/tokenCrypto';
import {
  account,
  accountingPeriod,
  appUser,
  employee,
  employeePayoutProfile,
  expensePosting,
  reimbursementPaymentBatch,
  reimbursementPaymentBatchEvent,
  reimbursementPaymentBatchLine,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { withTenantTransaction } from '../../data/tenantTransaction';
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
import {
  upsertOwnPayoutProfileWithin,
  verifyPayoutProfileWithin,
} from './payoutProfiles';
import { configureExpensePolicyVersion } from './policy';
import {
  createReimbursementBatchWithin,
  listOpenReimbursementPayablesWithin,
  listReimbursementBatchesWithin,
  releaseReimbursementBatchWithin,
} from './reimbursementBatches';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const encryptionKey = Buffer.alloc(32, 21);
const payoutDetails = {
  bankCountry: 'SG',
  currency: 'SGD',
  bankCode: 'DBSSG',
  bankName: 'DBS Bank',
  accountHolderName: 'Demo Viewer',
  accountNumber: '123456789012',
  swiftBic: 'DBSSSGSG',
};

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function setup(verifyProfile = true) {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  const [checker] = await db.insert(appUser).values({
    masterFn: scope.masterFn,
    username: 'finance.checker',
    email: 'finance.checker@example.test',
    fullName: 'Finance Checker',
    passwordHash: viewer.passwordHash,
    language: 'en',
  }).returning();
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
    categoryCode: 'REIMBURSE',
    categoryName: 'Reimbursement batch expense',
    policyKey: 'reimbursement-batch-policy',
    policyName: 'Reimbursement batch policy',
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
    policyKey: 'reimbursement-batch-controls',
    versionNo: 1,
    validFrom: '2026-01-01',
    duplicateHighRiskScore: 70,
    budgetAction: 'warn',
  });
  const created = await createExpenseClaimDraft(db, scope, viewer.userId, {
    claimKey: 'reimbursement-batch-claim-0001',
    claimNo: 'RB-CLAIM-0001',
    title: 'Reimbursement batch proof',
  });
  const replaced = await replaceExpenseClaimDraftLines(
    db,
    scope,
    viewer.userId,
    created.claim.id,
    created.claim.version,
    [{
      merchant: 'Batch Merchant',
      transactionDate: '2026-07-20',
      purpose: 'Reimbursement batch proof',
      categoryCode: 'REIMBURSE',
      paymentSource: 'employee_paid',
      originalCurrency: 'SGD',
      originalNet: '88',
      originalTax: '0',
      originalGross: '88',
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
  await withTenantTransaction(db, scope, (tx) => decideExpenseLineWithin(tx, scope, {
    lineApprovalId: submitted.controls![0].lineApproval.id,
    actorUserId: admin.userId,
    decision: 'approved',
  }));
  await withTenantTransaction(db, scope, (tx) => decideExpenseLineWithin(tx, scope, {
    lineApprovalId: submitted.controls![0].lineApproval.id,
    actorUserId: admin.userId,
    decision: 'approved',
  }));
  const [posting] = await db.select().from(expensePosting);
  const [employeeOwner] = await db.select().from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.userId, viewer.userId),
  ));
  const profile = await withTenantTransaction(db, scope, (tx) =>
    upsertOwnPayoutProfileWithin(
      tx,
      scope,
      viewer.userId,
      null,
      payoutDetails,
      (plaintext) => encryptToken(plaintext, encryptionKey),
    ));
  const verified = verifyProfile
    ? await withTenantTransaction(db, scope, (tx) =>
      verifyPayoutProfileWithin(
        tx,
        scope,
        admin.userId,
        employeeOwner.id,
        profile.version,
        'Matched bank evidence for reimbursement batch.',
      ))
    : null;
  return {
    db,
    admin,
    viewer,
    checker,
    employeeOwner,
    posting,
    profile: verified?.profile ?? profile,
    sourceBankAccountId: accountId('1000'),
  };
}

describe('maker checker reimbursement payment batches', () => {
  it('freezes an encrypted release snapshot and rejects maker or self release', async () => {
    const context = await setup();
    const candidates = await withTenantTransaction(context.db, scope, (tx) =>
      listOpenReimbursementPayablesWithin(tx, scope, 'SGD'));
    expect(candidates).toHaveLength(1);
    expect(JSON.stringify(candidates)).not.toContain('detailsEnvelope');
    expect(JSON.stringify(candidates)).not.toContain(payoutDetails.accountNumber);

    const created = await withTenantTransaction(context.db, scope, (tx) =>
      createReimbursementBatchWithin(tx, scope, context.admin.userId, {
        batchKey: 'reimbursement-batch-0001',
        batchNo: 'RB-0001',
        currency: 'SGD',
        sourceBankAccountId: context.sourceBankAccountId,
        postingIds: [context.posting.id],
      }));
    expect(created).toMatchObject({
      batch: {
        status: 'draft',
        version: 1,
        itemCount: 1,
        totalAmount: '88.00',
      },
      lines: [{
        destinationSnapshotted: false,
        accountNumberMasked: '••••••••9012',
      }],
    });
    await expect(withTenantTransaction(context.db, scope, (tx) =>
      releaseReimbursementBatchWithin(
        tx,
        scope,
        context.admin.userId,
        created.batch.id,
        created.batch.version,
        'Maker release attempt.',
        hashValue,
      ))).rejects.toMatchObject({ code: 'reimbursement_batch_maker_checker_required' });
    await expect(withTenantTransaction(context.db, scope, (tx) =>
      releaseReimbursementBatchWithin(
        tx,
        scope,
        context.viewer.userId,
        created.batch.id,
        created.batch.version,
        'Employee self-payment attempt.',
        hashValue,
      ))).rejects.toMatchObject({ code: 'reimbursement_batch_self_payment_forbidden' });

    const released = await withTenantTransaction(context.db, scope, (tx) =>
      releaseReimbursementBatchWithin(
        tx,
        scope,
        context.checker.userId,
        created.batch.id,
        created.batch.version,
        'Independent Finance checker release.',
        hashValue,
      ));
    expect(released).toMatchObject({
      batch: {
        status: 'released',
        version: 2,
        releasedByUserId: context.checker.userId,
        releaseFactsSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      lines: [{ destinationSnapshotted: true }],
    });
    expect(JSON.stringify(released)).not.toContain('payoutEnvelopeSnapshot');
    expect(JSON.stringify(released)).not.toContain(payoutDetails.accountNumber);
    const [storedLine] = await context.db.select().from(reimbursementPaymentBatchLine);
    expect(storedLine.payoutEnvelopeSnapshot).not.toBeNull();
    expect(JSON.stringify(storedLine.payoutEnvelopeSnapshot))
      .not.toContain(payoutDetails.accountNumber);

    await expect(context.db.delete(reimbursementPaymentBatchLine)).rejects.toThrow();
    await expect(context.db.update(reimbursementPaymentBatch).set({
      batchNo: 'REWRITTEN',
    })).rejects.toThrow();
    await expect(context.db.update(reimbursementPaymentBatchEvent).set({
      reason: 'Rewrite immutable event.',
    })).rejects.toThrow();
    const listed = await withTenantTransaction(context.db, scope, (tx) =>
      listReimbursementBatchesWithin(tx, scope));
    expect(JSON.stringify(listed)).not.toContain('payoutEnvelopeSnapshot');
  });

  it('excludes unverified payables and blocks release after the payout profile changes', async () => {
    const context = await setup(false);
    expect(await withTenantTransaction(context.db, scope, (tx) =>
      listOpenReimbursementPayablesWithin(tx, scope, 'SGD'))).toHaveLength(0);
    await expect(withTenantTransaction(context.db, scope, (tx) =>
      createReimbursementBatchWithin(tx, scope, context.admin.userId, {
        batchKey: 'reimbursement-batch-0002',
        batchNo: 'RB-0002',
        currency: 'SGD',
        sourceBankAccountId: context.sourceBankAccountId,
        postingIds: [context.posting.id],
      }))).rejects.toMatchObject({ code: 'reimbursement_batch_payable_ineligible' });

    const verified = await withTenantTransaction(context.db, scope, (tx) =>
      verifyPayoutProfileWithin(
        tx,
        scope,
        context.admin.userId,
        context.employeeOwner.id,
        context.profile.version,
        'Matched bank evidence before batch preparation.',
      ));
    const created = await withTenantTransaction(context.db, scope, (tx) =>
      createReimbursementBatchWithin(tx, scope, context.admin.userId, {
        batchKey: 'reimbursement-batch-0003',
        batchNo: 'RB-0003',
        currency: 'SGD',
        sourceBankAccountId: context.sourceBankAccountId,
        postingIds: [context.posting.id],
      }));
    await withTenantTransaction(context.db, scope, (tx) =>
      upsertOwnPayoutProfileWithin(
        tx,
        scope,
        context.viewer.userId,
        verified.profile.version,
        { ...payoutDetails, accountNumber: '998877665544' },
        (plaintext) => encryptToken(plaintext, encryptionKey),
      ));
    await expect(withTenantTransaction(context.db, scope, (tx) =>
      releaseReimbursementBatchWithin(
        tx,
        scope,
        context.checker.userId,
        created.batch.id,
        created.batch.version,
        'Attempt after employee changed payout details.',
        hashValue,
      ))).rejects.toMatchObject({ code: 'reimbursement_batch_payout_changed' });
    expect((await context.db.select().from(reimbursementPaymentBatch))[0].status)
      .toBe('draft');
    expect((await context.db.select().from(employeePayoutProfile))[0].verificationStatus)
      .toBe('unverified');
  });
});
