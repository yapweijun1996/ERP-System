import { createHash } from 'node:crypto';
import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  account,
  accountingPeriod,
  appUser,
  documentExtraction,
  documentScanJob,
  expensePosting,
  managedDocument,
  receiptInboxItem,
  taxEvidenceAccessEvent,
  taxEvidenceArtifact,
  taxEvidencePack,
  taxEvidencePackLegalHoldEvent,
  taxEvidenceReportJob,
  taxEvidenceRetentionPolicy,
  taxEvidenceSnapshot,
  taxEvidenceSnapshotLine,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { freshDb } from '../../test/helpers';
import { createApp } from '../../api/app';
import {
  createManagedDocument,
  type DocumentStorageRegistry,
} from '../documents/storage';
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
import {
  accessTaxEvidenceArtifactWithin,
  createTaxEvidenceReportJobWithin,
  createTaxEvidenceSnapshotWithin,
  processTaxEvidenceJobBatch,
  readTaxEvidenceJobWithin,
} from './taxEvidence';
import {
  assessTaxEvidencePackPurgeWithin,
  configureTaxEvidenceRetentionPolicyWithin,
  readTaxEvidencePackWithin,
  recordTaxEvidencePackLegalHoldWithin,
  sealTaxEvidencePackWithin,
} from './taxEvidenceGovernance';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

function cookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='))?.slice(9);
  if (!csrf) throw new Error('Missing CSRF cookie');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrf) };
}

async function setup() {
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
    categoryCode: 'TAXPACK',
    categoryName: 'Tax pack expense',
    policyKey: 'tax-pack-policy',
    policyName: 'Tax pack policy',
    versionNo: 1,
    validFrom: '2026-01-01',
    evidenceRequired: false,
    taxTreatment: 'input_tax',
    taxCode: 'SR',
    inputTaxRecoverablePct: '100',
    employeePaidAllowed: true,
    companyPaidAllowed: false,
    expenseAccountId: accountId('5800'),
    inputTaxAccountId: accountId('1200'),
    employeePayableAccountId: accountId('2100'),
    companyPaidClearingAccountId: accountId('1000'),
    fxMethod: 'table_rate',
  });
  await configureExpenseControlPolicyVersion(db, scope, admin.userId, {
    policyKey: 'tax-pack-controls',
    versionNo: 1,
    validFrom: '2026-01-01',
    duplicateHighRiskScore: 70,
    budgetAction: 'warn',
  });

  const sourcePdf = await PDFDocument.create();
  const page = sourcePdf.addPage([300, 300]);
  page.drawText('Immutable receipt evidence', { x: 30, y: 240, size: 14 });
  const receiptBytes = await sourcePdf.save({ useObjectStreams: false });
  const receipt = await createManagedDocument(
    db,
    scope,
    { userId: viewer.userId },
    {
      documentKey: 'tax-pack-receipt-0001',
      purpose: 'receipt',
      ownerUserId: viewer.userId,
      originalFileName: 'merchant-receipt.pdf',
      mimeType: 'application/pdf',
      retentionUntil: new Date('2033-07-31T00:00:00.000Z'),
      content: receiptBytes,
      pageCount: 1,
    },
  );
  await withTenantTransaction(db, scope, async (tx) => {
    await tx.update(managedDocument).set({
      recordStatus: 'approved',
      recordVersion: 2,
      updatedAt: new Date('2026-07-21T00:00:00.000Z'),
    }).where(eq(managedDocument.id, receipt.document.id));
    await tx.insert(documentScanJob).values({
      ...scope,
      versionId: receipt.version.id,
      status: 'clean',
      scanner: 'test-scanner',
      resultCode: 'clean',
      attempts: 1,
      completedAt: new Date('2026-07-21T00:00:00.000Z'),
    });
    const [extraction] = await tx.insert(documentExtraction).values({
      ...scope,
      versionId: receipt.version.id,
      extractionVersion: 1,
      provider: 'local_ocr',
      model: 'test-ocr-v1',
      status: 'succeeded',
      rawText: 'Merchant receipt 109.00',
      outputSha256: createHash('sha256').update('Merchant receipt 109.00').digest('hex'),
      attempts: 1,
      completedAt: new Date('2026-07-21T00:00:00.000Z'),
    }).returning();
    await tx.insert(receiptInboxItem).values({
      ...scope,
      versionId: receipt.version.id,
      extractionId: extraction.id,
      ownerUserId: viewer.userId,
      status: 'ready',
      reviewReasons: [],
    });
  });
  const [inbox] = await db.select().from(receiptInboxItem)
    .where(eq(receiptInboxItem.versionId, receipt.version.id));

  const claim = await createExpenseClaimDraft(db, scope, viewer.userId, {
    claimKey: 'tax-pack-claim-0001',
    claimNo: 'TAX-PACK-0001',
    title: 'Tax evidence center proof',
  });
  const replaced = await replaceExpenseClaimDraftLines(
    db,
    scope,
    viewer.userId,
    claim.claim.id,
    claim.claim.version,
    [
      {
        merchant: 'Complete Evidence Merchant',
        merchantTaxNumber: 'SG-TAX-001',
        transactionDate: '2026-07-20',
        purpose: 'Complete tax evidence',
        categoryCode: 'TAXPACK',
        paymentSource: 'employee_paid' as const,
        originalCurrency: 'SGD',
        originalNet: '100',
        originalTax: '9',
        originalGross: '109',
        receiptInboxItemId: inbox.id,
        allocationMode: 'percentage' as const,
        allocations: [{
          dimensionType: 'project' as const,
          dimensionKey: 'PROJECT-ALPHA',
          percentage: '100',
        }],
      },
      {
        merchant: 'Missing Evidence Merchant',
        transactionDate: '2026-07-21',
        purpose: 'Missing evidence state',
        categoryCode: 'TAXPACK',
        paymentSource: 'employee_paid' as const,
        originalCurrency: 'SGD',
        originalNet: '50',
        originalTax: '4.5',
        originalGross: '54.5',
        allocationMode: 'percentage' as const,
        allocations: [{
          dimensionType: 'project' as const,
          dimensionKey: 'PROJECT-BETA',
          percentage: '100',
        }],
      },
    ],
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
    }));
    await withTenantTransaction(db, scope, (tx) => decideExpenseLineWithin(tx, scope, {
      lineApprovalId: control.lineApproval.id,
      actorUserId: admin.userId,
      decision: 'approved',
    }));
  }
  expect(await db.select().from(expensePosting)).toHaveLength(2);
  return { db, admin, receipt };
}

describe('tax evidence snapshots and artifact jobs', () => {
  it('renders one reconciled immutable snapshot into six audited artifacts', async () => {
    const context = await setup();
    const created = await withTenantTransaction(context.db, scope, (tx) =>
      createTaxEvidenceSnapshotWithin(
        tx,
        scope,
        context.admin.userId,
        'tax-snapshot-july-0001',
        {
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          categoryCodes: ['TAXPACK'],
          taxStates: ['input_tax'],
        },
        new Date('2026-07-26T00:00:00.000Z'),
      ));
    expect(created.snapshot).toMatchObject({
      rowCount: 2,
      documentCount: 1,
      originalGross: '163.50',
      baseExpense: '150.00',
      baseInputTax: '13.50',
      baseGross: '163.50',
      sourceSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(created.lines.map((row) =>
      (row.facts as { completeness: string }).completeness))
      .toEqual(['complete', 'missing_receipt']);

    const filtered = await withTenantTransaction(context.db, scope, (tx) =>
      createTaxEvidenceSnapshotWithin(
        tx,
        scope,
        context.admin.userId,
        'tax-snapshot-project-0001',
        {
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          projectKeys: ['PROJECT-ALPHA'],
          completeness: ['complete'],
        },
      ));
    expect(filtered.snapshot).toMatchObject({ rowCount: 1, documentCount: 1 });

    const job = await withTenantTransaction(context.db, scope, (tx) =>
      createTaxEvidenceReportJobWithin(tx, scope, context.admin.userId, {
        jobKey: 'tax-report-july-0001',
        snapshotId: created.snapshot.id,
        locale: 'zh',
      }, new Date('2026-07-26T00:01:00.000Z')));
    expect(job).toMatchObject({ replayed: false, job: { status: 'queued' } });
    const unavailableStorage = {
      get() {
        return {
          readWithin: async () => {
            throw new Error('Simulated document provider outage.');
          },
        };
      },
    } as unknown as DocumentStorageRegistry;
    expect(await processTaxEvidenceJobBatch(context.db, {
      workerId: 'tax-test-worker',
      now: new Date('2026-07-26T00:05:00.000Z'),
      storageRegistry: unavailableStorage,
    })).toEqual({ claimed: 1, succeeded: 0, failed: 1 });
    expect(await context.db.select().from(taxEvidenceArtifact)).toHaveLength(0);
    expect(await processTaxEvidenceJobBatch(context.db, {
      workerId: 'tax-test-worker-retry',
      now: new Date('2026-07-26T00:05:02.000Z'),
    })).toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    const evidence = await withTenantTransaction(context.db, scope, (tx) =>
      readTaxEvidenceJobWithin(
        tx,
        scope,
        context.admin.userId,
        job.job.id,
      ));
    expect(evidence.job).toMatchObject({
      status: 'succeeded',
      attempts: 2,
      artifactSetSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(evidence.artifacts.map((row) => row.artifactType).sort()).toEqual([
      'manifest_json',
      'merged_pdf',
      'originals_zip',
      'register_csv',
      'register_pdf',
      'register_xlsx',
    ]);
    const stored = await context.db.select().from(taxEvidenceArtifact);
    for (const artifact of stored) {
      expect(createHash('sha256').update(Buffer.from(artifact.content)).digest('hex'))
        .toBe(artifact.sha256);
    }
    const manifestArtifact = stored.find((row) => row.artifactType === 'manifest_json')!;
    const manifest = JSON.parse(Buffer.from(manifestArtifact.content).toString('utf8')) as {
      snapshot: { sourceSha256: string; baseGross: string };
      artifacts: Array<{ artifactType: string; sha256: string }>;
    };
    expect(manifest.snapshot).toMatchObject({
      sourceSha256: created.snapshot.sourceSha256,
      baseGross: '163.50',
    });
    expect(manifest.artifacts).toHaveLength(5);
    const zip = stored.find((row) => row.artifactType === 'originals_zip')!;
    expect(Buffer.from(zip.content).subarray(0, 4).toString('hex')).toBe('504b0304');
    const merged = stored.find((row) => row.artifactType === 'merged_pdf')!;
    expect(Buffer.from(merged.content).subarray(0, 4).toString()).toBe('%PDF');

    const accessed = await withTenantTransaction(context.db, scope, (tx) =>
      accessTaxEvidenceArtifactWithin(
        tx,
        scope,
        context.admin.userId,
        manifestArtifact.id,
        {
          accessKey: 'tax-artifact-download-0001',
          action: 'download',
          purpose: 'Provide reconciled tax evidence to the statutory reviewer.',
        },
      ));
    expect(accessed.artifact.sha256).toBe(manifestArtifact.sha256);
    expect(accessed.replayedAccess).toBe(false);
    await withTenantTransaction(context.db, scope, (tx) =>
      accessTaxEvidenceArtifactWithin(
        tx,
        scope,
        context.admin.userId,
        manifestArtifact.id,
        {
          accessKey: 'tax-artifact-download-0001',
          action: 'download',
          purpose: 'Provide reconciled tax evidence to the statutory reviewer.',
        },
      ));
    expect(await context.db.select().from(taxEvidenceAccessEvent)).toHaveLength(1);

    const replayedJob = await withTenantTransaction(context.db, scope, (tx) =>
      createTaxEvidenceReportJobWithin(tx, scope, context.admin.userId, {
        jobKey: 'tax-report-july-0001',
        snapshotId: created.snapshot.id,
        locale: 'zh',
      }));
    expect(replayedJob.replayed).toBe(true);
    expect(await processTaxEvidenceJobBatch(context.db, {
      workerId: 'tax-test-worker-replay',
      now: new Date('2026-07-26T00:10:00.000Z'),
    })).toEqual({ claimed: 0, succeeded: 0, failed: 0 });
    expect(await context.db.select().from(taxEvidenceArtifact)).toHaveLength(6);

    await expect(context.db.update(taxEvidenceSnapshot).set({
      baseGross: '999.00',
    }).where(eq(taxEvidenceSnapshot.id, created.snapshot.id))).rejects.toThrow();
    await expect(context.db.delete(taxEvidenceSnapshotLine)
      .where(eq(taxEvidenceSnapshotLine.snapshotId, created.snapshot.id)))
      .rejects.toThrow();
    await expect(context.db.delete(taxEvidenceArtifact)
      .where(eq(taxEvidenceArtifact.jobId, job.job.id)))
      .rejects.toThrow();
    expect((await context.db.select().from(taxEvidenceSnapshot)
      .where(eq(taxEvidenceSnapshot.id, created.snapshot.id)))[0].baseGross)
      .toBe('163.50');
    expect(await context.db.select().from(taxEvidenceReportJob)).toHaveLength(1);

    let server: Server | undefined;
    try {
      server = createApp(context.db).listen(0, '127.0.0.1');
      await new Promise<void>((resolve) => server!.once('listening', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing API address');
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          organizationCode: 'ACME',
          username: 'admin',
          password: 'demo1234',
        }),
      });
      const session = cookies(login);
      const commonHeaders = (key: string) => ({
        cookie: session.header,
        'x-csrf-token': session.csrf,
        'content-type': 'application/json',
        'idempotency-key': key,
      });
      const apiSnapshot = await fetch(`${baseUrl}/api/tax-evidence/snapshots`, {
        method: 'POST',
        headers: commonHeaders('tax-api-snapshot-request-0001'),
        body: JSON.stringify({
          snapshotKey: 'tax-api-snapshot-0001',
          filters: {
            startDate: '2026-07-01',
            endDate: '2026-07-31',
            completeness: ['missing_receipt'],
          },
        }),
      });
      expect(apiSnapshot.status).toBe(201);
      const apiSnapshotBody = await apiSnapshot.json() as {
        data: { snapshot: { id: number; rowCount: number } };
      };
      expect(apiSnapshotBody.data.snapshot.rowCount).toBe(1);
      const apiJob = await fetch(`${baseUrl}/api/tax-evidence/jobs`, {
        method: 'POST',
        headers: commonHeaders('tax-api-job-request-0001'),
        body: JSON.stringify({
          jobKey: 'tax-api-job-0001',
          snapshotId: apiSnapshotBody.data.snapshot.id,
          locale: 'en',
        }),
      });
      expect(apiJob.status).toBe(202);
      const apiJobBody = await apiJob.json() as { data: { job: { id: number } } };
      expect((await processTaxEvidenceJobBatch(context.db, {
        workerId: 'tax-api-worker',
      })).succeeded).toBe(1);
      const apiEvidence = await fetch(
        `${baseUrl}/api/tax-evidence/jobs/${apiJobBody.data.job.id}`,
        { headers: { cookie: session.header } },
      );
      expect(apiEvidence.status).toBe(200);
      const apiEvidenceBody = await apiEvidence.json() as {
        data: { artifacts: Array<{ id: number; artifactType: string; sha256: string }> };
      };
      const apiManifest = apiEvidenceBody.data.artifacts.find(
        (row) => row.artifactType === 'manifest_json',
      )!;
      expect(JSON.stringify(apiEvidenceBody)).not.toContain('"content"');
      const apiDownload = await fetch(
        `${baseUrl}/api/tax-evidence/artifacts/${apiManifest.id}/actions/access`,
        {
          method: 'POST',
          headers: commonHeaders('unused-access-idempotency'),
          body: JSON.stringify({
            accessKey: 'tax-api-download-0001',
            action: 'download',
            purpose: 'Download the reviewed statutory evidence package.',
          }),
        },
      );
      expect(apiDownload.status).toBe(200);
      expect(apiDownload.headers.get('cache-control')).toContain('no-store');
      expect(apiDownload.headers.get('x-checksum-sha256')).toBe(apiManifest.sha256);
      expect((await apiDownload.json()).snapshot.sourceSha256)
        .toMatch(/^[0-9a-f]{64}$/);
    } finally {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => error ? reject(error) : resolve());
        });
      }
    }
  });

  it('seals a linear correction chain with statutory retention and legal hold', async () => {
    const context = await setup();
    const retention = await withTenantTransaction(context.db, scope, (tx) =>
      configureTaxEvidenceRetentionPolicyWithin(
        tx,
        scope,
        context.admin.userId,
        {
          policyKey: 'tax-retention-sg-0001',
          effectiveFrom: '2026-01-01',
          companyRetentionYears: 8,
        },
        new Date('2026-07-26T01:00:00.000Z'),
      ));
    expect(retention.policy).toMatchObject({
      countryCode: 'SG',
      statutoryMinimumYears: 5,
      companyRetentionYears: 8,
      versionNo: 1,
    });
    expect((await withTenantTransaction(context.db, scope, (tx) =>
      configureTaxEvidenceRetentionPolicyWithin(
        tx,
        scope,
        context.admin.userId,
        {
          policyKey: 'tax-retention-sg-0001',
          effectiveFrom: '2026-01-01',
          companyRetentionYears: 8,
        },
      ))).replayed).toBe(true);

    const initialSnapshot = await withTenantTransaction(context.db, scope, (tx) =>
      createTaxEvidenceSnapshotWithin(
        tx,
        scope,
        context.admin.userId,
        'tax-pack-seal-snapshot-0001',
        { startDate: '2026-07-01', endDate: '2026-07-31' },
      ));
    const initialJob = await withTenantTransaction(context.db, scope, (tx) =>
      createTaxEvidenceReportJobWithin(tx, scope, context.admin.userId, {
        jobKey: 'tax-pack-seal-job-0001',
        snapshotId: initialSnapshot.snapshot.id,
      }));
    expect((await processTaxEvidenceJobBatch(context.db, {
      workerId: 'tax-pack-seal-worker-1',
    })).succeeded).toBe(1);
    const initialPack = await withTenantTransaction(context.db, scope, (tx) =>
      sealTaxEvidencePackWithin(
        tx,
        scope,
        context.admin.userId,
        {
          packKey: 'tax-pack-july-2026',
          reportJobId: initialJob.job.id,
        },
        new Date('2026-07-26T02:00:00.000Z'),
      ));
    expect(initialPack.pack).toMatchObject({
      versionNo: 1,
      supersedesPackId: null,
      countryCode: 'SG',
      statutoryMinimumYears: 5,
      companyRetentionYears: 8,
      sourceSha256: initialSnapshot.snapshot.sourceSha256,
      packSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      differenceManifestSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(initialPack.pack.retentionUntil.toISOString())
      .toBe('2034-07-31T23:59:59.999Z');
    const initialDifference = initialPack.pack.differenceManifest as {
      lines: { added: string[] };
      totalDifference: { baseGross: string };
    };
    expect(initialDifference.lines.added).toHaveLength(2);
    expect(initialDifference.totalDifference.baseGross).toBe('163.50');
    expect((await withTenantTransaction(context.db, scope, (tx) =>
      sealTaxEvidencePackWithin(tx, scope, context.admin.userId, {
        packKey: 'tax-pack-july-2026',
        reportJobId: initialJob.job.id,
      }))).replayed).toBe(true);

    const correctedSnapshot = await withTenantTransaction(context.db, scope, (tx) =>
      createTaxEvidenceSnapshotWithin(
        tx,
        scope,
        context.admin.userId,
        'tax-pack-seal-snapshot-0002',
        {
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          completeness: ['complete'],
        },
      ));
    const correctedJob = await withTenantTransaction(context.db, scope, (tx) =>
      createTaxEvidenceReportJobWithin(tx, scope, context.admin.userId, {
        jobKey: 'tax-pack-seal-job-0002',
        snapshotId: correctedSnapshot.snapshot.id,
      }));
    expect((await processTaxEvidenceJobBatch(context.db, {
      workerId: 'tax-pack-seal-worker-2',
    })).succeeded).toBe(1);
    const correctedPack = await withTenantTransaction(context.db, scope, (tx) =>
      sealTaxEvidencePackWithin(
        tx,
        scope,
        context.admin.userId,
        {
          packKey: 'tax-pack-july-2026',
          reportJobId: correctedJob.job.id,
          supersedesPackId: initialPack.pack.id,
          correctionReason: 'Remove the incomplete evidence row after Finance review.',
        },
        new Date('2026-07-26T03:00:00.000Z'),
      ));
    expect(correctedPack.pack).toMatchObject({
      versionNo: 2,
      supersedesPackId: initialPack.pack.id,
      sourceSha256: correctedSnapshot.snapshot.sourceSha256,
    });
    const correctionDifference = correctedPack.pack.differenceManifest as {
      lines: { removed: string[] };
      totalDifference: { baseGross: string };
    };
    expect(correctionDifference.lines.removed).toHaveLength(1);
    expect(correctionDifference.totalDifference.baseGross).toBe('-54.50');
    const chain = await withTenantTransaction(context.db, scope, (tx) =>
      readTaxEvidencePackWithin(tx, scope, correctedPack.pack.id));
    expect(chain.versions.map((pack) => pack.versionNo)).toEqual([1, 2]);

    const hold = await withTenantTransaction(context.db, scope, (tx) =>
      recordTaxEvidencePackLegalHoldWithin(
        tx,
        scope,
        context.admin.userId,
        initialPack.pack.id,
        {
          eventKey: 'tax-pack-hold-placed-0001',
          action: 'placed',
          reason: 'Preserve the entire correction chain for an active tax audit.',
        },
        new Date('2035-01-01T00:00:00.000Z'),
      ));
    expect(hold.replayed).toBe(false);
    const blocked = await withTenantTransaction(context.db, scope, (tx) =>
      assessTaxEvidencePackPurgeWithin(
        tx,
        scope,
        correctedPack.pack.id,
        new Date('2035-01-02T00:00:00.000Z'),
      ));
    expect(blocked).toMatchObject({
      eligible: false,
      retentionActive: false,
      legalHoldActive: true,
      blockingLegalHoldPackId: initialPack.pack.id,
    });
    await withTenantTransaction(context.db, scope, (tx) =>
      recordTaxEvidencePackLegalHoldWithin(
        tx,
        scope,
        context.admin.userId,
        initialPack.pack.id,
        {
          eventKey: 'tax-pack-hold-release-0001',
          action: 'released',
          reason: 'Tax authority confirmed the audit has closed.',
        },
        new Date('2035-01-03T00:00:00.000Z'),
      ));
    expect((await withTenantTransaction(context.db, scope, (tx) =>
      assessTaxEvidencePackPurgeWithin(
        tx,
        scope,
        correctedPack.pack.id,
        new Date('2035-01-04T00:00:00.000Z'),
      ))).eligible).toBe(true);

    const malaysiaScope = { masterFn: 'M1', companyFn: 'C-MY' };
    await expect(withTenantTransaction(context.db, malaysiaScope, (tx) =>
      configureTaxEvidenceRetentionPolicyWithin(
        tx,
        malaysiaScope,
        context.admin.userId,
        {
          policyKey: 'tax-retention-my-short',
          effectiveFrom: '2026-01-01',
          companyRetentionYears: 6,
        },
      ))).rejects.toMatchObject({ code: 'tax_evidence_retention_invalid' });
    const malaysiaPolicy = await withTenantTransaction(context.db, malaysiaScope, (tx) =>
      configureTaxEvidenceRetentionPolicyWithin(
        tx,
        malaysiaScope,
        context.admin.userId,
        {
          policyKey: 'tax-retention-my-0001',
          effectiveFrom: '2026-01-01',
          companyRetentionYears: 9,
        },
      ));
    expect(malaysiaPolicy.policy).toMatchObject({
      countryCode: 'MY',
      statutoryMinimumYears: 7,
      companyRetentionYears: 9,
    });

    let server: Server | undefined;
    try {
      server = createApp(context.db).listen(0, '127.0.0.1');
      await new Promise<void>((resolve) => server!.once('listening', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing API address');
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          organizationCode: 'ACME',
          username: 'admin',
          password: 'demo1234',
        }),
      });
      const session = cookies(login);
      const commonHeaders = (key: string) => ({
        cookie: session.header,
        'x-csrf-token': session.csrf,
        'content-type': 'application/json',
        'idempotency-key': key,
      });
      const apiPolicy = await fetch(`${baseUrl}/api/tax-evidence/retention-policies`, {
        method: 'POST',
        headers: commonHeaders('tax-api-retention-request-0001'),
        body: JSON.stringify({
          policyKey: 'tax-retention-sg-api-0002',
          effectiveFrom: '2027-01-01',
          companyRetentionYears: 9,
        }),
      });
      expect(apiPolicy.status).toBe(201);
      const apiSealReplay = await fetch(`${baseUrl}/api/tax-evidence/packs/seal`, {
        method: 'POST',
        headers: commonHeaders('tax-api-seal-request-0001'),
        body: JSON.stringify({
          packKey: 'tax-pack-july-2026',
          reportJobId: correctedJob.job.id,
          supersedesPackId: initialPack.pack.id,
          correctionReason: 'Remove the incomplete evidence row after Finance review.',
        }),
      });
      expect(apiSealReplay.status).toBe(200);
      expect((await apiSealReplay.json() as {
        data: { replayed: boolean };
      }).data.replayed).toBe(true);
      const apiHold = await fetch(
        `${baseUrl}/api/tax-evidence/packs/${correctedPack.pack.id}/legal-holds`,
        {
          method: 'POST',
          headers: commonHeaders('tax-api-hold-request-0001'),
          body: JSON.stringify({
            eventKey: 'tax-api-hold-placed-0001',
            action: 'placed',
            reason: 'API proof for a chain-scoped legal hold.',
          }),
        },
      );
      expect(apiHold.status).toBe(201);
      const apiPack = await fetch(
        `${baseUrl}/api/tax-evidence/packs/${correctedPack.pack.id}`,
        { headers: { cookie: session.header } },
      );
      expect(apiPack.status).toBe(200);
      expect(apiPack.headers.get('cache-control')).toContain('no-store');
      expect((await apiPack.json() as {
        data: { versions: Array<{ versionNo: number }>; purge: { legalHoldActive: boolean } };
      }).data).toMatchObject({
        versions: [{ versionNo: 1 }, { versionNo: 2 }],
        purge: { legalHoldActive: true },
      });
    } finally {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => error ? reject(error) : resolve());
        });
      }
    }

    await expect(context.db.update(taxEvidencePack).set({
      correctionReason: 'Silent replacement attempt',
    }).where(eq(taxEvidencePack.id, initialPack.pack.id))).rejects.toThrow();
    await expect(context.db.delete(taxEvidencePackLegalHoldEvent)
      .where(eq(taxEvidencePackLegalHoldEvent.id, hold.event.id)))
      .rejects.toThrow();
    await expect(context.db.update(taxEvidenceRetentionPolicy).set({
      companyRetentionYears: 5,
    }).where(eq(taxEvidenceRetentionPolicy.id, retention.policy.id)))
      .rejects.toThrow();
  });
});
