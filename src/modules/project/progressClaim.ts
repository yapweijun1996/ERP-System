// Progress claims — project billing documents. Draft creation snapshots the
// effective tax rate exactly like modules/sales/debitNote.ts; posting inserts
// the same balanced Dr AR / Cr Revenue / Cr Output Tax legs against the same
// accounts (1100/4000/2200), no new chart-of-accounts codes. The project's
// billed_to_date aggregate increments by the *net* amount on post, so
// contract_value vs. billed_to_date stays a net-to-net comparison (tax is a
// pass-through, not contract progress).
import { and, eq, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { getEffectiveTaxRate } from '../../data/repo';
import { account, glEntry, progressClaim, project } from '../../data/schema';

export class ProjectProgressClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectProgressClaimError';
  }
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new ProjectProgressClaimError(`${label} is required.`);
  return normalized;
}

async function accountId(exec: DB, scope: Scope, code: string) {
  const [row] = await exec.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.code, code),
  ));
  if (!row) throw new ProjectProgressClaimError(`Account ${code} is not configured.`);
  return row.id;
}

export interface CreateProgressClaimInput {
  docNo: string;
  projectId: number;
  claimDate: string;
  description: string;
  netAmount: string | number;
  taxCode: string;
}

export async function createProgressClaimWithin(
  exec: DB,
  scope: Scope,
  input: CreateProgressClaimInput,
) {
  const docNo = required(input.docNo, 'Claim number');
  const description = required(input.description, 'Description');
  const taxCode = required(input.taxCode, 'Tax code');
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0) {
    throw new ProjectProgressClaimError('projectId must be a positive integer.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.claimDate)) {
    throw new ProjectProgressClaimError('claimDate must use YYYY-MM-DD.');
  }
  let net: Decimal;
  try {
    net = new Decimal(input.netAmount);
  } catch {
    throw new ProjectProgressClaimError('netAmount must be a valid decimal.');
  }
  if (!net.isFinite() || net.lte(0)) {
    throw new ProjectProgressClaimError('netAmount must be greater than zero.');
  }
  const [proj] = await exec.select({
    id: project.id,
    customerId: project.customerId,
    status: project.status,
  }).from(project).where(and(
    eq(project.masterFn, scope.masterFn),
    eq(project.companyFn, scope.companyFn),
    eq(project.id, input.projectId),
  ));
  if (!proj) throw new ProjectProgressClaimError('Project is unavailable in this company.');
  if (proj.customerId == null) {
    throw new ProjectProgressClaimError('An Internal project (no customer) cannot be billed.');
  }
  if (proj.status === 'completed') {
    throw new ProjectProgressClaimError('A completed project cannot receive a new progress claim.');
  }
  const taxRule = await getEffectiveTaxRate(exec, scope, taxCode, input.claimDate);
  if (!taxRule) throw new ProjectProgressClaimError(`No tax rule for ${taxCode} on ${input.claimDate}.`);
  const rate = new Decimal(taxRule.rate);
  const roundedNet = net.toDecimalPlaces(2);
  const tax = roundedNet.mul(rate).div(100).toDecimalPlaces(2);
  const total = roundedNet.plus(tax);
  const [claim] = await exec.insert(progressClaim).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    projectId: proj.id,
    claimDate: input.claimDate,
    description,
    netAmount: roundedNet.toFixed(2),
    taxCode,
    taxRate: rate.toFixed(3),
    taxAmount: tax.toFixed(2),
    totalAmount: total.toFixed(2),
  }).returning({
    id: progressClaim.id,
    docNo: progressClaim.docNo,
    status: progressClaim.status,
    version: progressClaim.version,
    totalAmount: progressClaim.totalAmount,
  });
  return claim;
}

export async function postProgressClaimWithin(exec: DB, scope: Scope, claimId: number) {
  const [claim] = await exec.select().from(progressClaim).where(and(
    eq(progressClaim.masterFn, scope.masterFn),
    eq(progressClaim.companyFn, scope.companyFn),
    eq(progressClaim.id, claimId),
  )).for('update');
  if (!claim || claim.status !== 'draft') {
    throw new ProjectProgressClaimError('Only a draft progress claim can be posted.');
  }
  const arId = await accountId(exec, scope, '1100');
  const revenueId = await accountId(exec, scope, '4000');
  const taxId = await accountId(exec, scope, '2200');
  await exec.insert(glEntry).values([
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: claim.docNo,
      accountId: arId, debit: claim.totalAmount, credit: '0', memo: 'AR progress claim',
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: claim.docNo,
      accountId: revenueId, debit: '0', credit: claim.netAmount, memo: 'Progress claim revenue',
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: claim.docNo,
      accountId: taxId, debit: '0', credit: claim.taxAmount, memo: 'Output tax',
    },
  ]);
  await exec.update(project).set({
    billedToDate: sql`${project.billedToDate} + ${claim.netAmount}`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(project.masterFn, scope.masterFn),
    eq(project.companyFn, scope.companyFn),
    eq(project.id, claim.projectId),
  ));
  const [posted] = await exec.update(progressClaim).set({
    status: 'posted',
    version: sql`${progressClaim.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(progressClaim.masterFn, scope.masterFn),
    eq(progressClaim.companyFn, scope.companyFn),
    eq(progressClaim.id, claim.id),
  )).returning({
    claimId: progressClaim.id,
    status: progressClaim.status,
    version: progressClaim.version,
    totalAmount: progressClaim.totalAmount,
  });
  return posted;
}

export function createProgressClaim(db: DB, scope: Scope, input: CreateProgressClaimInput) {
  return db.transaction((tx) => createProgressClaimWithin(tx, scope, input));
}

export function postProgressClaim(db: DB, scope: Scope, claimId: number) {
  return db.transaction((tx) => postProgressClaimWithin(tx, scope, claimId));
}
