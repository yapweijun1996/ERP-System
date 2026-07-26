import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encryptToken } from '../auth/tokenCrypto';
import {
  account,
  accountingPeriod,
  appUser,
  auditLog,
  employee,
  expensePosting,
  glEntry,
  reimbursementBankExport,
  reimbursementBankExportAccessEvent,
  reimbursementSettlement,
  reimbursementPaymentBatchEvent,
  reimbursementPaymentBatchLine,
  role,
  rolePermission,
  userCompany,
  userCompanyRole,
} from '../data/schema';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import { withTenantTransaction } from '../data/tenantTransaction';
import {
  createExpenseClaimDraft,
  replaceExpenseClaimDraftLines,
  submitExpenseClaimByEmployee,
} from '../modules/expenses/claims';
import {
  configureExpenseControlPolicyVersion,
  decideExpenseLineWithin,
} from '../modules/expenses/controls';
import {
  upsertOwnPayoutProfileWithin,
  verifyPayoutProfileWithin,
} from '../modules/expenses/payoutProfiles';
import { configureExpensePolicyVersion } from '../modules/expenses/policy';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const encryptionKey = Buffer.alloc(32, 22);

function cookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='))?.slice('erp_csrf='.length);
  if (!csrf) throw new Error('Missing CSRF cookie');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrf) };
}

describe('reimbursement payment batch API', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let postingId: number;
  let sourceBankAccountId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [checker] = await db.insert(appUser).values({
      masterFn: scope.masterFn,
      username: 'payment.checker',
      email: 'payment.checker@example.test',
      fullName: 'Payment Checker',
      passwordHash: viewer.passwordHash,
      language: 'en',
    }).returning();
    const [checkerRole] = await db.insert(role).values({
      masterFn: scope.masterFn,
      name: 'Payment Checker',
      isSuperadmin: false,
    }).returning();
    await db.insert(rolePermission).values({
      masterFn: scope.masterFn,
      roleId: checkerRole.roleId,
      permissionKey: 'expenses.payment.release',
    });
    await db.insert(userCompany).values({
      userId: checker.userId,
      companyFn: scope.companyFn,
      roleId: checkerRole.roleId,
    });
    await db.insert(userCompanyRole).values({
      userId: checker.userId,
      companyFn: scope.companyFn,
      roleId: checkerRole.roleId,
    });
    const accounts = await db.select().from(account).where(and(
      eq(account.masterFn, scope.masterFn),
      eq(account.companyFn, scope.companyFn),
    ));
    const accountId = (code: string) => accounts.find((row) => row.code === code)!.id;
    sourceBankAccountId = accountId('1000');
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
      categoryCode: 'PAYAPI',
      categoryName: 'Payment batch API expense',
      policyKey: 'payment-batch-api-policy',
      policyName: 'Payment batch API policy',
      versionNo: 1,
      validFrom: '2026-01-01',
      evidenceRequired: false,
      taxTreatment: 'exempt',
      employeePaidAllowed: true,
      companyPaidAllowed: false,
      expenseAccountId: accountId('5800'),
      employeePayableAccountId: accountId('2100'),
      companyPaidClearingAccountId: sourceBankAccountId,
      fxMethod: 'table_rate',
    });
    await configureExpenseControlPolicyVersion(db, scope, admin.userId, {
      policyKey: 'payment-batch-api-controls',
      versionNo: 1,
      validFrom: '2026-01-01',
      duplicateHighRiskScore: 70,
      budgetAction: 'warn',
    });
    const created = await createExpenseClaimDraft(db, scope, viewer.userId, {
      claimKey: 'payment-batch-api-claim-0001',
      claimNo: 'PAY-API-0001',
      title: 'Payment batch API proof',
    });
    const replaced = await replaceExpenseClaimDraftLines(
      db,
      scope,
      viewer.userId,
      created.claim.id,
      created.claim.version,
      [{
        merchant: 'API Batch Merchant',
        transactionDate: '2026-07-20',
        purpose: 'Payment batch API proof',
        categoryCode: 'PAYAPI',
        paymentSource: 'employee_paid',
        originalCurrency: 'SGD',
        originalNet: '64',
        originalTax: '0',
        originalGross: '64',
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
    [postingId] = (await db.select({ id: expensePosting.id }).from(expensePosting))
      .map((row) => row.id);
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
        (plaintext) => encryptToken(plaintext, encryptionKey),
      ));
    await withTenantTransaction(db, scope, (tx) =>
      verifyPayoutProfileWithin(
        tx,
        scope,
        admin.userId,
        owner.id,
        profile.version,
        'Matched bank evidence for API payment batch.',
      ));

    server = createApp(db, {
      tokenEncryptionKey: encryptionKey.toString('base64'),
    }).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing API address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  async function login(username: string, password: string) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    return cookies(response);
  }

  it('enforces permissions, idempotency, maker checker separation and masked reads', async () => {
    const viewer = await login('viewer', 'viewer1234');
    const admin = await login('admin', 'demo1234');
    const checker = await login('payment.checker', 'viewer1234');
    expect((await fetch(`${baseUrl}/api/reimbursement-batches/candidates?currency=SGD`, {
      headers: { cookie: viewer.header },
    })).status).toBe(403);
    const candidates = await fetch(
      `${baseUrl}/api/reimbursement-batches/candidates?currency=SGD`,
      { headers: { cookie: admin.header } },
    );
    expect(candidates.status).toBe(200);
    const candidateText = await candidates.text();
    expect(candidateText).not.toContain('123456789012');
    expect(candidateText).not.toContain('detailsEnvelope');

    const createHeaders = {
      cookie: admin.header,
      'x-csrf-token': admin.csrf,
      'content-type': 'application/json',
      'idempotency-key': 'payment-batch-create-api-0001',
    };
    const createBody = {
      batchKey: 'payment-batch-api-0001',
      batchNo: 'PAY-BATCH-API-0001',
      currency: 'SGD',
      sourceBankAccountId,
      postingIds: [postingId],
    };
    const created = await fetch(`${baseUrl}/api/reimbursement-batches`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify(createBody),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as {
      data: { batch: { id: number; version: number } };
    };
    const replay = await fetch(`${baseUrl}/api/reimbursement-batches`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify(createBody),
    });
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');

    const makerRelease = await fetch(
      `${baseUrl}/api/reimbursement-batches/${createdBody.data.batch.id}/actions/release`,
      {
        method: 'POST',
        headers: {
          cookie: admin.header,
          'x-csrf-token': admin.csrf,
          'content-type': 'application/json',
          'idempotency-key': 'payment-batch-maker-release-api-0001',
        },
        body: JSON.stringify({
          expectedVersion: createdBody.data.batch.version,
          reason: 'Maker cannot release.',
        }),
      },
    );
    expect(makerRelease.status).toBe(403);
    expect((await makerRelease.json()).error.code)
      .toBe('reimbursement_batch_maker_checker_required');

    const released = await fetch(
      `${baseUrl}/api/reimbursement-batches/${createdBody.data.batch.id}/actions/release`,
      {
        method: 'POST',
        headers: {
          cookie: checker.header,
          'x-csrf-token': checker.csrf,
          'content-type': 'application/json',
          'idempotency-key': 'payment-batch-checker-release-api-0001',
        },
        body: JSON.stringify({
          expectedVersion: createdBody.data.batch.version,
          reason: 'Independent Finance checker release.',
        }),
      },
    );
    expect(released.status).toBe(200);
    const releasedText = await released.text();
    expect(releasedText).not.toContain('123456789012');
    expect(releasedText).not.toContain('payoutEnvelopeSnapshot');

    const listed = await fetch(`${baseUrl}/api/reimbursement-batches`, {
      headers: { cookie: checker.header },
    });
    expect(listed.status).toBe(200);
    const listedText = await listed.text();
    expect(listedText).not.toContain('123456789012');
    expect(listedText).not.toContain('payoutEnvelopeSnapshot');
    expect(await db.select().from(reimbursementPaymentBatchLine)).toHaveLength(1);
    expect(await db.select().from(reimbursementPaymentBatchEvent)).toHaveLength(2);
    expect(await db.select().from(auditLog).where(
      eq(auditLog.entity, 'reimbursement_payment_batch'),
    )).toHaveLength(2);

    const paymentHeaders = (idempotencyKey: string) => ({
      cookie: admin.header,
      'x-csrf-token': admin.csrf,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    });
    const configured = await fetch(
      `${baseUrl}/api/reimbursement-payments/templates/versions`,
      {
        method: 'POST',
        headers: paymentHeaders('payment-template-api-0001'),
        body: JSON.stringify({
          templateKey: 'api.generic',
          versionNo: 1,
          validFrom: '2026-01-01',
          name: 'API generic CSV',
          bankCode: 'GENERIC',
          fieldOrder: [
            'claim_no',
            'account_holder_name',
            'account_number',
            'currency',
            'amount',
          ],
        }),
      },
    );
    expect(configured.status).toBe(201);
    const generated = await fetch(`${baseUrl}/api/reimbursement-payments/exports`, {
      method: 'POST',
      headers: paymentHeaders('payment-export-api-request-0001'),
      body: JSON.stringify({
        exportKey: 'payment-export-api-0001',
        batchId: createdBody.data.batch.id,
        templateKey: 'api.generic',
        exportDate: '2026-07-22',
      }),
    });
    expect(generated.status).toBe(201);
    const generatedBody = await generated.json() as {
      data: { export: { id: number; contentSha256: string } };
    };
    expect(JSON.stringify(generatedBody)).not.toContain('123456789012');
    expect(JSON.stringify(generatedBody)).not.toContain('artifactEnvelope');
    const [storedExport] = await db.select().from(reimbursementBankExport);
    expect(JSON.stringify(storedExport.artifactEnvelope)).not.toContain('123456789012');

    const evidence = await fetch(
      `${baseUrl}/api/reimbursement-payments/evidence`,
      { headers: { cookie: admin.header } },
    );
    expect(evidence.status).toBe(200);
    const evidenceText = await evidence.text();
    expect(evidenceText).not.toContain('123456789012');
    expect(evidenceText).not.toContain('artifactEnvelope');

    const downloaded = await fetch(
      `${baseUrl}/api/reimbursement-payments/exports/${generatedBody.data.export.id}/actions/download`,
      {
        method: 'POST',
        headers: paymentHeaders('unused-by-download'),
        body: JSON.stringify({
          accessKey: 'payment-download-api-0001',
          purpose: 'Upload the approved reimbursement file to the bank.',
        }),
      },
    );
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('cache-control')).toContain('no-store');
    expect(downloaded.headers.get('x-content-sha256'))
      .toBe(generatedBody.data.export.contentSha256);
    expect(await downloaded.text()).toContain('123456789012');
    expect(await db.select().from(reimbursementBankExportAccessEvent)).toHaveLength(2);

    const resultPayload = {
      importKey: 'payment-result-api-0001',
      exportId: generatedBody.data.export.id,
      bankReference: 'BANK-API-REF-0001',
      paymentDate: '2026-07-22',
      results: [{
        exportLineNo: 1,
        outcome: 'success',
        bankLineReference: 'BANK-API-LINE-0001',
      }],
    };
    const imported = await fetch(
      `${baseUrl}/api/reimbursement-payments/result-imports`,
      {
        method: 'POST',
        headers: paymentHeaders('payment-result-api-request-0001'),
        body: JSON.stringify(resultPayload),
      },
    );
    expect(imported.status).toBe(201);
    expect(await db.select().from(reimbursementSettlement)).toHaveLength(1);
    expect(await db.select().from(glEntry).where(
      eq(glEntry.journalRef, `REIMB:B${createdBody.data.batch.id}:L1`),
    )).toHaveLength(2);
    const importedReplay = await fetch(
      `${baseUrl}/api/reimbursement-payments/result-imports`,
      {
        method: 'POST',
        headers: paymentHeaders('payment-result-api-request-0001'),
        body: JSON.stringify(resultPayload),
      },
    );
    expect(importedReplay.status).toBe(201);
    expect(importedReplay.headers.get('idempotency-replayed')).toBe('true');
    expect(await db.select().from(reimbursementSettlement)).toHaveLength(1);
  });
});
