import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from '../../auth/tokenCrypto';
import {
  account,
  accountingPeriod,
  appUser,
  employee,
  expensePosting,
  glEntry,
  reimbursementBankExport,
  reimbursementBankExportAccessEvent,
  reimbursementBankLineResult,
  reimbursementPaymentBatchLine,
  reimbursementSettlement,
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
  accessReimbursementBankExportWithin,
  configureReimbursementBankTemplateWithin,
  generateReimbursementBankExportWithin,
  importReimbursementBankResultsWithin,
  listReimbursementPaymentEvidenceWithin,
} from './reimbursementPayments';
import {
  createReimbursementBatchWithin,
  releaseReimbursementBatchWithin,
} from './reimbursementBatches';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const julyApprovalNow = new Date('2026-07-26T00:00:00.000Z');
const key = Buffer.alloc(32, 23);
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const crypto = {
  encrypt: (plaintext: string) => encryptToken(plaintext, key),
  decrypt: (value: Parameters<typeof decryptToken>[0]) => decryptToken(value, key),
  hash,
};

async function setup() {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
  const [checker] = await db.insert(appUser).values({
    masterFn: scope.masterFn,
    username: 'bank.checker',
    email: 'bank.checker@example.test',
    fullName: 'Bank Checker',
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
    categoryCode: 'BANKPAY',
    categoryName: 'Bank payment expense',
    policyKey: 'bank-payment-policy',
    policyName: 'Bank payment policy',
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
    policyKey: 'bank-payment-controls',
    versionNo: 1,
    validFrom: '2026-01-01',
    duplicateHighRiskScore: 70,
    budgetAction: 'warn',
  });
  const claim = await createExpenseClaimDraft(db, scope, viewer.userId, {
    claimKey: 'bank-payment-claim-0001',
    claimNo: 'BANK-PAY-0001',
    title: 'Bank payment partial result proof',
  });
  const replaced = await replaceExpenseClaimDraftLines(
    db,
    scope,
    viewer.userId,
    claim.claim.id,
    claim.claim.version,
    [40, 60].map((amount, index) => ({
      merchant: `Bank Payment Merchant ${index + 1}`,
      transactionDate: '2026-07-20',
      purpose: `Bank payment line ${index + 1}`,
      categoryCode: 'BANKPAY',
      paymentSource: 'employee_paid' as const,
      originalCurrency: 'SGD',
      originalNet: String(amount),
      originalTax: '0',
      originalGross: String(amount),
      allocationMode: 'percentage' as const,
      allocations: [{
        dimensionType: 'department' as const,
        dimensionKey: 'FINANCE',
        percentage: '100',
      }],
    })),
  );
  const submitted = await submitExpenseClaimByEmployee(
    db,
    scope,
    viewer.userId,
    claim.claim.id,
    replaced.claim.version,
  );
  for (const control of submitted.controls!) {
    await withTenantTransaction(db, scope, (tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId: control.lineApproval.id,
      actorUserId: admin.userId,
      decision: 'approved',
    }, julyApprovalNow));
    await withTenantTransaction(db, scope, (tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId: control.lineApproval.id,
      actorUserId: admin.userId,
      decision: 'approved',
    }, julyApprovalNow));
  }
  const postings = await db.select().from(expensePosting)
    .orderBy(expensePosting.lineId);
  const [owner] = await db.select().from(employee).where(and(
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
      {
        bankCountry: 'SG',
        currency: 'SGD',
        bankCode: 'DBSSG',
        bankName: 'DBS Bank',
        accountHolderName: 'Demo Viewer',
        accountNumber: '123456789012',
        swiftBic: 'DBSSSGSG',
      },
      crypto.encrypt,
    ));
  await withTenantTransaction(db, scope, (tx) =>
    verifyPayoutProfileWithin(
      tx,
      scope,
      admin.userId,
      owner.id,
      profile.version,
      'Matched evidence before bank export.',
    ));
  const prepared = await withTenantTransaction(db, scope, (tx) =>
    createReimbursementBatchWithin(tx, scope, admin.userId, {
      batchKey: 'bank-payment-batch-0001',
      batchNo: 'BANK-BATCH-0001',
      currency: 'SGD',
      sourceBankAccountId: accountId('1000'),
      postingIds: postings.map((posting) => posting.id),
    }));
  const released = await withTenantTransaction(db, scope, (tx) =>
    releaseReimbursementBatchWithin(
      tx,
      scope,
      checker.userId,
      prepared.batch.id,
      prepared.batch.version,
      'Independent checker releases bank payment batch.',
      (value) => hash(JSON.stringify(value)),
    ));
  await withTenantTransaction(db, scope, (tx) =>
    configureReimbursementBankTemplateWithin(tx, scope, admin.userId, {
      templateKey: 'dbs.generic',
      versionNo: 1,
      validFrom: '2026-01-01',
      name: 'DBS generic reimbursement CSV',
      bankCode: 'DBSSG',
      delimiter: ',',
      includeHeader: true,
      fieldOrder: [
        'batch_no',
        'line_no',
        'claim_no',
        'account_holder_name',
        'account_number',
        'bank_code',
        'currency',
        'amount',
      ],
    }));
  return { db, admin, checker, postings, released };
}

describe('reimbursement bank exports and outcomes', () => {
  it('encrypts and audits exports, posts successes only and retries failures once', async () => {
    const context = await setup();
    const first = await withTenantTransaction(context.db, scope, (tx) =>
      generateReimbursementBankExportWithin(
        tx,
        scope,
        context.admin.userId,
        {
          exportKey: 'bank-export-initial-0001',
          batchId: context.released.batch.id,
          templateKey: 'dbs.generic',
          exportDate: '2026-07-26',
        },
        crypto,
      ));
    expect(first.export).toMatchObject({
      exportVersion: 1,
      rowCount: 2,
      totalAmount: '100.00',
      contentSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const [storedExport] = await context.db.select().from(reimbursementBankExport);
    expect(JSON.stringify(storedExport.artifactEnvelope)).not.toContain('123456789012');

    const accessed = await withTenantTransaction(context.db, scope, (tx) =>
      accessReimbursementBankExportWithin(
        tx,
        scope,
        context.admin.userId,
        first.export.id,
        'bank-export-download-0001',
        'Upload approved payment file to bank portal.',
        crypto,
      ));
    expect(accessed.content).toContain('123456789012');
    expect(hash(accessed.content)).toBe(first.export.contentSha256);
    expect(await context.db.select().from(reimbursementBankExportAccessEvent))
      .toHaveLength(2);

    const partial = await withTenantTransaction(context.db, scope, (tx) =>
      importReimbursementBankResultsWithin(
        tx,
        scope,
        context.checker.userId,
        {
          importKey: 'bank-result-partial-0001',
          exportId: first.export.id,
          bankReference: 'DBS-RESULT-0001',
          paymentDate: '2026-07-26',
          results: [
            {
              exportLineNo: 1,
              outcome: 'success',
              bankLineReference: 'DBS-LINE-0001',
            },
            {
              exportLineNo: 2,
              outcome: 'failed',
              bankLineReference: 'DBS-LINE-0002',
              failureCode: 'INVALID_ACCOUNT',
              failureMessage: 'Bank rejected the destination account.',
            },
          ],
        },
        hash,
      ));
    expect(partial.results.map((row) => row.outcome)).toEqual(['success', 'failed']);
    expect(partial.settlements).toHaveLength(1);
    const firstSettlementEntries = await context.db.select().from(glEntry).where(
      eq(glEntry.journalRef, partial.settlements[0].journalRef),
    );
    expect(firstSettlementEntries).toMatchObject([
      { debit: '40.00', credit: '0.00' },
      { debit: '0.00', credit: '40.00' },
    ]);

    const replay = await withTenantTransaction(context.db, scope, (tx) =>
      importReimbursementBankResultsWithin(
        tx,
        scope,
        context.checker.userId,
        {
          importKey: 'bank-result-partial-0001',
          exportId: first.export.id,
          bankReference: 'DBS-RESULT-0001',
          paymentDate: '2026-07-26',
          results: [
            {
              exportLineNo: 1,
              outcome: 'success',
              bankLineReference: 'DBS-LINE-0001',
            },
            {
              exportLineNo: 2,
              outcome: 'failed',
              bankLineReference: 'DBS-LINE-0002',
              failureCode: 'INVALID_ACCOUNT',
              failureMessage: 'Bank rejected the destination account.',
            },
          ],
        },
        hash,
      ));
    expect(replay.replayed).toBe(true);
    expect(await context.db.select().from(reimbursementSettlement)).toHaveLength(1);

    const retry = await withTenantTransaction(context.db, scope, (tx) =>
      generateReimbursementBankExportWithin(
        tx,
        scope,
        context.admin.userId,
        {
          exportKey: 'bank-export-retry-0001',
          batchId: context.released.batch.id,
          templateKey: 'dbs.generic',
          exportDate: '2026-07-26',
          retryOfExportId: first.export.id,
        },
        crypto,
      ));
    expect(retry.export).toMatchObject({
      exportVersion: 2,
      retryOfExportId: first.export.id,
      rowCount: 1,
      totalAmount: '60.00',
    });
    const retryResult = await withTenantTransaction(context.db, scope, (tx) =>
      importReimbursementBankResultsWithin(
        tx,
        scope,
        context.checker.userId,
        {
          importKey: 'bank-result-retry-0001',
          exportId: retry.export.id,
          bankReference: 'DBS-RESULT-0002',
          paymentDate: '2026-07-26',
          results: [{
            exportLineNo: 1,
            outcome: 'success',
            bankLineReference: 'DBS-LINE-RETRY-0002',
          }],
        },
        hash,
      ));
    expect(retryResult.settlements).toHaveLength(1);
    expect(retryResult.settlements[0].amount).toBe('60.00');
    expect(await context.db.select().from(reimbursementSettlement)).toHaveLength(2);
    expect(await context.db.select().from(reimbursementBankLineResult)).toHaveLength(3);
    expect(await context.db.select().from(glEntry).where(
      eq(glEntry.journalRef, retryResult.settlements[0].journalRef),
    )).toMatchObject([
      { debit: '60.00', credit: '0.00' },
      { debit: '0.00', credit: '60.00' },
    ]);

    await expect(withTenantTransaction(context.db, scope, (tx) =>
      generateReimbursementBankExportWithin(
        tx,
        scope,
        context.admin.userId,
        {
          exportKey: 'bank-export-stale-retry-0001',
          batchId: context.released.batch.id,
          templateKey: 'dbs.generic',
          exportDate: '2026-07-26',
          retryOfExportId: first.export.id,
        },
        crypto,
      ))).rejects.toMatchObject({ code: 'reimbursement_bank_retry_export_stale' });
    await expect(context.db.delete(reimbursementSettlement)).rejects.toThrow();
    await expect(context.db.update(glEntry).set({ memo: 'rewrite' }).where(
      eq(glEntry.journalRef, partial.settlements[0].journalRef),
    )).rejects.toThrow();

    const evidence = await withTenantTransaction(context.db, scope, (tx) =>
      listReimbursementPaymentEvidenceWithin(tx, scope));
    expect(JSON.stringify(evidence)).not.toContain('artifactEnvelope');
    expect(JSON.stringify(evidence)).not.toContain('123456789012');
    expect(evidence.settlements.reduce(
      (sum, row) => sum + Number(row.amount),
      0,
    )).toBe(100);
    expect(await context.db.select().from(reimbursementPaymentBatchLine))
      .toHaveLength(2);
  });
});
