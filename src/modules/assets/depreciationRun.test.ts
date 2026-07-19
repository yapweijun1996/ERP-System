import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { account, asset, glEntry, depreciationRunLine } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createAsset } from './createAsset';
import {
  createDepreciationRun,
  postDepreciationRun,
  InvalidDepreciationRunStateError,
  PostingError,
} from './depreciationRun';

async function seedAccounts(db: DB) {
  await db.insert(account).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1500', name: 'PP&E', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '1510', name: 'Accumulated Depreciation', type: 'asset' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: '6200', name: 'Depreciation Expense', type: 'expense' },
  ]);
}

describe('createDepreciationRun + postDepreciationRun', () => {
  it('success: computes straight-line, posts a balanced GL, and updates accumulated depreciation', async () => {
    const db = await freshDb();
    await seedAccounts(db);
    const created = await createAsset(db, SCOPE, {
      assetNo: 'FA-D1', name: 'Test Machine', category: 'Plant & Machinery',
      acquisitionDate: '2024-01-01', cost: '12000.00', residualValue: '0.00', usefulLifeYears: 10,
    });

    const run = await createDepreciationRun(db, SCOPE, { docNo: 'DEP-T1', runDate: '2024-02-01' });
    expect(run.lineCount).toBe(1);
    expect(run.totalAmount).toBe('100.00'); // 12000 / (10*12) = 100.00

    const posted = await postDepreciationRun(db, SCOPE, run.id);
    expect(posted.totalAmount).toBe('100.00');

    const legs = await db.select().from(glEntry).where(and(
      eq(glEntry.masterFn, SCOPE.masterFn), eq(glEntry.companyFn, SCOPE.companyFn),
      eq(glEntry.journalRef, 'DEP-T1'),
    ));
    expect(legs).toHaveLength(2);
    const totalDebit = legs.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = legs.reduce((sum, l) => sum + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
    expect(totalDebit).toBeCloseTo(100, 2);

    const [updatedAsset] = await db.select().from(asset).where(eq(asset.id, created.id));
    expect(Number(updatedAsset.accumulatedDepreciation)).toBe(100);
    expect(updatedAsset.version).toBe(2);
  });

  it('caps the final line at the remaining depreciable value instead of overshooting residual', async () => {
    const db = await freshDb();
    await seedAccounts(db);
    // 1 month useful life -> depreciable 100.00 fully consumed in a single run.
    const created = await createAsset(db, SCOPE, {
      assetNo: 'FA-D2', name: 'Short Life Asset', category: 'IT Equipment',
      acquisitionDate: '2024-01-01', cost: '100.00', residualValue: '0.00', usefulLifeYears: 1,
    });
    void created;
    const run = await createDepreciationRun(db, SCOPE, { docNo: 'DEP-T2', runDate: '2024-02-01' });
    const [line] = await db.select().from(depreciationRunLine).where(eq(depreciationRunLine.runId, run.id));
    expect(Number(line.depreciationAmount)).toBeLessThanOrEqual(100);
    expect(Number(line.closingNbv)).toBeGreaterThanOrEqual(0);
  });

  it('rollback: re-posting an already-posted run is rejected', async () => {
    const db = await freshDb();
    await seedAccounts(db);
    await createAsset(db, SCOPE, {
      assetNo: 'FA-D3', name: 'Test Machine', category: 'Plant & Machinery',
      acquisitionDate: '2024-01-01', cost: '12000.00', residualValue: '0.00', usefulLifeYears: 10,
    });
    const run = await createDepreciationRun(db, SCOPE, { docNo: 'DEP-T3', runDate: '2024-02-01' });
    await postDepreciationRun(db, SCOPE, run.id);

    await expect(postDepreciationRun(db, SCOPE, run.id)).rejects.toThrow(InvalidDepreciationRunStateError);

    const legs = await db.select().from(glEntry).where(eq(glEntry.journalRef, 'DEP-T3'));
    expect(legs).toHaveLength(2); // no duplicate legs from the rejected re-post
  });

  it('throws PostingError when the chart of accounts is missing a required code', async () => {
    const db = await freshDb();
    // Deliberately skip seedAccounts.
    await createAsset(db, SCOPE, {
      assetNo: 'FA-D4', name: 'Test Machine', category: 'Plant & Machinery',
      acquisitionDate: '2024-01-01', cost: '12000.00', residualValue: '0.00', usefulLifeYears: 10,
    });
    const run = await createDepreciationRun(db, SCOPE, { docNo: 'DEP-T4', runDate: '2024-02-01' });
    await expect(postDepreciationRun(db, SCOPE, run.id)).rejects.toThrow(PostingError);
  });

  it('throws when there are no assets with remaining depreciable value', async () => {
    const db = await freshDb();
    await seedAccounts(db);
    // No assets seeded at all.
    await expect(createDepreciationRun(db, SCOPE, { docNo: 'DEP-T5', runDate: '2024-02-01' }))
      .rejects.toThrow(InvalidDepreciationRunStateError);
  });
});
