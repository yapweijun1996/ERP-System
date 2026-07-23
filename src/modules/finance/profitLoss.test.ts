import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  appUser,
  budgetLine,
  budgetVersion,
  reportArtifact,
  reportJob,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  approveBudgetWithin,
  BudgetError,
  createBudgetVersionWithin,
  importBudgetLinesWithin,
} from './budget';
import { buildProfitLossReport } from './profitLoss';
import {
  createProfitLossExportJobWithin,
  getReportArtifact,
  processReportJobBatch,
} from '../reporting/reportJobs';

async function fixture() {
  const db = await freshDb();
  await seedDemo(db);
  const [actor] = await db.select({ id: appUser.userId }).from(appUser)
    .where(eq(appUser.email, 'admin@acme.co')).limit(1);
  return { db, actorUserId: actor.id };
}

describe('canonical profit and loss', () => {
  it('uses posted period facts, approved budget and explicit zero-reference variance', async () => {
    const { db, actorUserId } = await fixture();
    const report = await buildProfitLossReport(db, {
      masterFn: 'M1',
      activeCompanyFn: 'C-SG',
      actorUserId,
      companyFns: ['C-SG'],
      comparison: 'budget',
      presentationCurrency: 'SGD',
    }, new Date('2026-07-23T00:00:00Z'));
    expect(report.data.period.periodNo).toBe(6);
    expect(report.data.scope).toBe('company');
    expect(report.data.sections.some((section) => section.key === 'revenue')).toBe(true);
    expect(Number(report.data.metrics.revenue)).toBeGreaterThan(0);
    expect(report.data.warnings.some((warning) => warning.code === 'no_approved_budget')).toBe(false);
    const zeroComparison = report.data.sections.flatMap((section) => section.rows)
      .find((row) => row.comparisonYtd === '0.00');
    if (zeroComparison) expect(zeroComparison.variancePercentYtd).toBeNull();
  });

  it('consolidates authorised companies with approved period rates', async () => {
    const { db, actorUserId } = await fixture();
    const report = await buildProfitLossReport(db, {
      masterFn: 'M1',
      activeCompanyFn: 'C-SG',
      actorUserId,
      companyFns: ['C-SG', 'C-MY'],
      comparison: 'budget',
      presentationCurrency: 'SGD',
    });
    expect(report.data.scope).toBe('consolidated');
    expect(report.meta.companies.map((row) => row.companyFn).sort()).toEqual(['C-MY', 'C-SG']);
    expect(report.data.presentationCurrency).toBe('SGD');
  });

  it('fails the entire consolidation when an approved rate is unavailable', async () => {
    const { db, actorUserId } = await fixture();
    await expect(buildProfitLossReport(db, {
      masterFn: 'M1',
      activeCompanyFn: 'C-SG',
      actorUserId,
      companyFns: ['C-SG', 'C-MY'],
      comparison: 'budget',
      presentationCurrency: 'USD',
    })).rejects.toMatchObject({
      code: 'missing_consolidation_rate',
    });
  });
});

describe('versioned finance budgets', () => {
  it('imports one draft, approves it and blocks later mutation', async () => {
    const { db, actorUserId } = await fixture();
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const draft = await createBudgetVersionWithin(db, scope, {
      fiscalYear: 2027,
      name: 'Fictional FY2027 plan',
      currency: 'SGD',
    });
    const imported = await importBudgetLinesWithin(db, scope, draft.id, [
      { accountCode: '4000', periodNo: 1, amount: '1234.56' },
      { accountCode: '6100', periodNo: 1, amount: '345.67' },
    ]);
    expect(imported.imported).toBe(2);
    const approved = await approveBudgetWithin(db, scope, draft.id, actorUserId);
    expect(approved).toMatchObject({ status: 'approved', isActive: true });
    await expect(importBudgetLinesWithin(db, scope, draft.id, [
      { accountCode: '4000', periodNo: 1, amount: '1.00' },
    ])).rejects.toThrow(BudgetError);
    expect(await db.select().from(budgetLine).where(and(
      eq(budgetLine.budgetVersionId, draft.id),
      eq(budgetLine.companyFn, scope.companyFn),
    ))).toHaveLength(2);
    expect(await db.select().from(budgetVersion).where(eq(budgetVersion.id, draft.id)))
      .toMatchObject([{ status: 'approved', isActive: true }]);
  });

  it('returns row-level validation without partially replacing a draft', async () => {
    const { db } = await fixture();
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const draft = await createBudgetVersionWithin(db, scope, {
      fiscalYear: 2028,
      name: 'Fictional invalid import',
      currency: 'SGD',
    });
    await expect(importBudgetLinesWithin(db, scope, draft.id, [
      { accountCode: 'DOES-NOT-EXIST', periodNo: 54, amount: '-2' },
    ])).rejects.toMatchObject({ code: 'budget_invalid' });
    expect(await db.select().from(budgetLine).where(eq(budgetLine.budgetVersionId, draft.id)))
      .toHaveLength(0);
  });
});

describe('durable P&L export jobs', () => {
  it('generates a tenant-bound XLSX artifact once', async () => {
    const { db, actorUserId } = await fixture();
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const job = await createProfitLossExportJobWithin(db, scope, {
      actorUserId,
      locale: 'zh',
      format: 'xlsx',
      filters: {
        companyFns: ['C-SG'],
        presentationCurrency: 'SGD',
        comparison: 'budget',
      },
      now: new Date('2026-07-23T00:00:00Z'),
    });
    const processed = await processReportJobBatch(db, {
      workerId: 'test-report-worker',
      now: new Date('2026-07-23T00:00:01Z'),
    });
    expect(processed).toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    const [savedJob] = await db.select().from(reportJob).where(eq(reportJob.id, job.id));
    const [artifactRow] = await db.select().from(reportArtifact)
      .where(eq(reportArtifact.jobId, job.id));
    expect(savedJob.status).toBe('succeeded');
    expect(artifactRow.mimeType).toContain('spreadsheetml');
    expect(artifactRow.sizeBytes).toBeGreaterThan(1_000);
    const artifact = await getReportArtifact(db, {
      masterFn: 'M1',
      actorUserId,
      artifactId: artifactRow.id,
      now: new Date('2026-07-23T00:00:02Z'),
    });
    expect(Buffer.from(artifact.content).subarray(0, 2).toString()).toBe('PK');
    expect(await processReportJobBatch(db, {
      workerId: 'test-report-worker',
      now: new Date('2026-07-23T00:00:03Z'),
    })).toMatchObject({ claimed: 0 });
  });
});
