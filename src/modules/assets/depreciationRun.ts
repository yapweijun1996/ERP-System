// Fixed Assets — compute a draft depreciation run, then post it as one balanced GL
// journal, mirroring purchasing/postSupplierInvoice.ts's "one document, one balanced
// journal via accountIdByCode lookup" pattern exactly.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { account, asset, depreciationRun, depreciationRunLine, glEntry } from '../../data/schema';
import { fixedUnits, fixedString } from '../inventory/decimal';
import { straightLineMonthly } from './decimal';

export class InvalidDepreciationRunStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDepreciationRunStateError';
  }
}

export class PostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostingError';
  }
}

async function accountIdByCode(exec: DB, scope: Scope, code: string): Promise<number> {
  const [row] = await exec.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.code, code),
  ));
  if (!row) throw new PostingError(`Account ${code} not configured`);
  return row.id;
}

export interface CreateDepreciationRunInput {
  docNo: string;
  runDate: string; // YYYY-MM-DD
}

export async function createDepreciationRunWithin(
  exec: DB,
  scope: Scope,
  input: CreateDepreciationRunInput,
) {
  if (!input.docNo?.trim()) throw new InvalidDepreciationRunStateError('docNo is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.runDate)) {
    throw new InvalidDepreciationRunStateError('runDate must be YYYY-MM-DD');
  }

  const assets = await exec.select().from(asset).where(and(
    eq(asset.masterFn, scope.masterFn),
    eq(asset.companyFn, scope.companyFn),
  )).orderBy(asset.id);

  const lines: { assetId: number; openingNbv: string; depreciationAmount: string; closingNbv: string }[] = [];
  for (const row of assets) {
    if (row.status === 'disposed') continue;
    const costCents = fixedUnits(row.cost, 2);
    const residualCents = fixedUnits(row.residualValue, 2);
    const accumulatedCents = fixedUnits(row.accumulatedDepreciation, 2);
    const openingCents = costCents - accumulatedCents;
    const remainingDepreciableCents = costCents - residualCents - accumulatedCents;
    if (remainingDepreciableCents <= 0n) continue;
    const monthlyCents = fixedUnits(
      straightLineMonthly(row.cost, row.residualValue, row.usefulLifeYears),
      2,
    );
    const lineCents = monthlyCents < remainingDepreciableCents ? monthlyCents : remainingDepreciableCents;
    if (lineCents <= 0n) continue;
    lines.push({
      assetId: row.id,
      openingNbv: fixedString(openingCents, 2),
      depreciationAmount: fixedString(lineCents, 2),
      closingNbv: fixedString(openingCents - lineCents, 2),
    });
  }

  if (lines.length === 0) {
    throw new InvalidDepreciationRunStateError('No assets have remaining depreciable value to run');
  }

  const totalCents = lines.reduce((sum, line) => sum + fixedUnits(line.depreciationAmount, 2), 0n);

  const [run] = await exec.insert(depreciationRun).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo: input.docNo.trim(),
    runDate: input.runDate,
    status: 'draft',
    totalAmount: fixedString(totalCents, 2),
  }).returning({ id: depreciationRun.id });

  await exec.insert(depreciationRunLine).values(lines.map((line, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    runId: run.id,
    lineNo: index + 1,
    assetId: line.assetId,
    openingNbv: line.openingNbv,
    depreciationAmount: line.depreciationAmount,
    closingNbv: line.closingNbv,
  })));

  return { id: run.id, docNo: input.docNo.trim(), totalAmount: fixedString(totalCents, 2), lineCount: lines.length };
}

export function createDepreciationRun(db: DB, scope: Scope, input: CreateDepreciationRunInput) {
  return db.transaction((tx) => createDepreciationRunWithin(tx, scope, input));
}

export async function postDepreciationRunWithin(exec: DB, scope: Scope, runId: number) {
  const [run] = await exec.select().from(depreciationRun).where(and(
    eq(depreciationRun.masterFn, scope.masterFn),
    eq(depreciationRun.companyFn, scope.companyFn),
    eq(depreciationRun.id, runId),
  )).for('update');
  if (!run) throw new InvalidDepreciationRunStateError(`Depreciation run ${runId} not found`);
  if (run.status !== 'draft') {
    throw new InvalidDepreciationRunStateError(
      `Depreciation run ${runId} is '${run.status}', not 'draft' — cannot post it again`,
    ); // → ROLLBACK
  }

  const lines = await exec.select().from(depreciationRunLine).where(and(
    eq(depreciationRunLine.masterFn, scope.masterFn),
    eq(depreciationRunLine.companyFn, scope.companyFn),
    eq(depreciationRunLine.runId, runId),
  ));

  for (const line of lines) {
    await exec.update(asset).set({
      accumulatedDepreciation: sql`${asset.accumulatedDepreciation} + ${line.depreciationAmount}`,
      version: sql`${asset.version} + 1`,
      updatedAt: sql`now()`,
    }).where(and(
      eq(asset.masterFn, scope.masterFn),
      eq(asset.companyFn, scope.companyFn),
      eq(asset.id, line.assetId),
    ));
  }

  const expenseId = await accountIdByCode(exec, scope, '6200'); // Depreciation Expense
  const accumId = await accountIdByCode(exec, scope, '1510');   // Accumulated Depreciation
  await exec.insert(glEntry).values([
    { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: run.docNo, accountId: expenseId, debit: run.totalAmount, credit: '0', memo: 'Depreciation expense' },
    { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: run.docNo, accountId: accumId, debit: '0', credit: run.totalAmount, memo: 'Accumulated depreciation' },
  ]);

  const [posted] = await exec.update(depreciationRun).set({
    status: 'posted',
    postedAt: sql`now()`,
    version: sql`${depreciationRun.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(depreciationRun.masterFn, scope.masterFn),
    eq(depreciationRun.companyFn, scope.companyFn),
    eq(depreciationRun.id, runId),
  )).returning({ id: depreciationRun.id, docNo: depreciationRun.docNo, totalAmount: depreciationRun.totalAmount });

  return posted;
}

export function postDepreciationRun(db: DB, scope: Scope, runId: number) {
  return db.transaction((tx) => postDepreciationRunWithin(tx, scope, runId));
}
