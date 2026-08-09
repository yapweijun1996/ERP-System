// Sales commission — effective-dated plans and immutable calculation runs.
// A run snapshots every contributing invoice/credit/debit document and never
// posts payroll or GL: approval is a commercial-control decision only.
import {
  and, asc, between, eq, gt, gte, isNull, lte, ne, or, sql,
} from 'drizzle-orm';
import Decimal from 'decimal.js';
import { authorizeWithin } from '../../auth/authorization';
import { PERMISSIONS } from '../../auth/permissionKeys';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  appUser,
  company,
  invoice,
  salesCommissionLine,
  salesCommissionPlan,
  salesCommissionRun,
  salesCommissionSource,
  salesCreditNote,
  salesDebitNote,
  userCompany,
} from '../../data/schema';

export class SalesCommissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalesCommissionError';
  }
}

export interface CreateCommissionPlanInput {
  code: string;
  name: string;
  salespersonUserId: number;
  basis?: 'recognized_revenue';
  ratePct: string | number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface CreateCommissionRunInput {
  docNo: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
}

type CommissionSourceType = 'invoice' | 'credit_note' | 'debit_note';

type CandidateSource = {
  sourceType: CommissionSourceType;
  sourceId: number;
  sourceDocNo: string;
  sourceDate: string;
  salespersonUserId: number | null;
  amount: Decimal;
};

function required(value: string | undefined, label: string, max = 200): string {
  const normalized = value?.trim();
  if (!normalized) throw new SalesCommissionError(`${label} is required.`);
  if (normalized.length > max) {
    throw new SalesCommissionError(`${label} must not exceed ${max} characters.`);
  }
  return normalized;
}

function date(value: string | null | undefined, label: string): string | null {
  if (value == null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new SalesCommissionError(`${label} must use YYYY-MM-DD.`);
  }
  return value;
}

function rate(value: string | number): Decimal {
  let parsed: Decimal;
  try {
    parsed = new Decimal(value);
  } catch {
    throw new SalesCommissionError('Commission rate must be a valid decimal.');
  }
  if (!parsed.isFinite() || parsed.lte(0) || parsed.gt(100)) {
    throw new SalesCommissionError('Commission rate must be greater than 0 and at most 100.');
  }
  return parsed;
}

async function companyActor(
  exec: DB,
  scope: Scope,
  userId: number,
  lock = false,
) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new SalesCommissionError('A valid company user is required.');
  }
  const query = exec.select({
    userId: appUser.userId,
    username: appUser.username,
    fullName: appUser.fullName,
    email: appUser.email,
  }).from(appUser).innerJoin(
    userCompany,
    and(
      eq(userCompany.userId, appUser.userId),
      eq(userCompany.companyFn, scope.companyFn),
    ),
  ).innerJoin(
    company,
    and(
      eq(company.companyFn, userCompany.companyFn),
      eq(company.masterFn, scope.masterFn),
    ),
  ).where(and(
    eq(appUser.masterFn, scope.masterFn),
    eq(appUser.userId, userId),
    eq(appUser.isActive, true),
  )).limit(1);
  const [actor] = lock ? await query.for('update') : await query;
  if (!actor) {
    throw new SalesCommissionError('The user is not active or assigned to this company.');
  }
  return { ...actor, name: actor.fullName?.trim() || actor.email || actor.username };
}

export async function listSalespeopleWithin(
  exec: DB,
  scope: Scope,
  input: { cursor?: number; limit?: number } = {},
) {
  const cursor = Number.isSafeInteger(input.cursor) && Number(input.cursor) >= 0
    ? Number(input.cursor) : 0;
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
  const rows = await exec.select({
    id: appUser.userId,
    userId: appUser.userId,
    fullName: appUser.fullName,
    email: appUser.email,
    isActive: appUser.isActive,
  }).from(appUser).innerJoin(
    userCompany,
    and(
      eq(userCompany.userId, appUser.userId),
      eq(userCompany.companyFn, scope.companyFn),
    ),
  ).innerJoin(
    company,
    and(eq(company.companyFn, userCompany.companyFn), eq(company.masterFn, scope.masterFn)),
  ).where(and(
    eq(appUser.masterFn, scope.masterFn),
    eq(appUser.isActive, true),
    gt(appUser.userId, cursor),
  )).orderBy(asc(appUser.userId)).limit(limit + 1);
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}

export async function createCommissionPlanWithin(
  exec: DB,
  scope: Scope,
  input: CreateCommissionPlanInput,
) {
  const code = required(input.code, 'Plan code', 80);
  const name = required(input.name, 'Plan name');
  const effectiveFrom = date(input.effectiveFrom, 'Effective from');
  const effectiveTo = date(input.effectiveTo, 'Effective to');
  if (!effectiveFrom || (effectiveTo != null && effectiveTo < effectiveFrom)) {
    throw new SalesCommissionError('Commission plan dates are invalid.');
  }
  if (input.basis != null && input.basis !== 'recognized_revenue') {
    throw new SalesCommissionError('Only recognized-revenue commission is supported.');
  }
  const normalizedRate = rate(input.ratePct);
  await companyActor(exec, scope, input.salespersonUserId);
  const [duplicate] = await exec.select({ id: salesCommissionPlan.id })
    .from(salesCommissionPlan).where(and(
      eq(salesCommissionPlan.masterFn, scope.masterFn),
      eq(salesCommissionPlan.companyFn, scope.companyFn),
      eq(salesCommissionPlan.code, code),
    )).limit(1);
  if (duplicate) throw new SalesCommissionError(`Commission plan ${code} already exists.`);

  const [created] = await exec.insert(salesCommissionPlan).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    code,
    name,
    salespersonUserId: input.salespersonUserId,
    basis: 'recognized_revenue',
    ratePct: normalizedRate.toFixed(3),
    effectiveFrom,
    effectiveTo,
  }).returning();
  return created;
}

export async function activateCommissionPlanWithin(
  exec: DB,
  scope: Scope,
  planId: number,
) {
  const [plan] = await exec.select().from(salesCommissionPlan).where(and(
    eq(salesCommissionPlan.masterFn, scope.masterFn),
    eq(salesCommissionPlan.companyFn, scope.companyFn),
    eq(salesCommissionPlan.id, planId),
  )).for('update');
  if (!plan || plan.status !== 'draft') {
    throw new SalesCommissionError('Only a draft commission plan can be activated.');
  }
  // Lock the salesperson row so two concurrent activations for the same person
  // cannot both pass the overlap check.
  await companyActor(exec, scope, plan.salespersonUserId, true);
  const overlap = and(
    eq(salesCommissionPlan.masterFn, scope.masterFn),
    eq(salesCommissionPlan.companyFn, scope.companyFn),
    eq(salesCommissionPlan.salespersonUserId, plan.salespersonUserId),
    eq(salesCommissionPlan.status, 'active'),
    ne(salesCommissionPlan.id, plan.id),
    lte(salesCommissionPlan.effectiveFrom, plan.effectiveTo ?? '9999-12-31'),
    or(
      isNull(salesCommissionPlan.effectiveTo),
      gte(salesCommissionPlan.effectiveTo, plan.effectiveFrom),
    ),
  );
  const [existing] = await exec.select({ id: salesCommissionPlan.id })
    .from(salesCommissionPlan).where(overlap).limit(1);
  if (existing) {
    throw new SalesCommissionError(
      'An active commission plan already overlaps this salesperson and date range.',
    );
  }
  const [active] = await exec.update(salesCommissionPlan).set({
    status: 'active',
    version: sql`${salesCommissionPlan.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(salesCommissionPlan.masterFn, scope.masterFn),
    eq(salesCommissionPlan.companyFn, scope.companyFn),
    eq(salesCommissionPlan.id, plan.id),
  )).returning();
  return active;
}

function planForSource<Plan extends {
  id: number;
  salespersonUserId: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}>(plans: Plan[], source: CandidateSource): Plan | null {
  if (source.salespersonUserId == null) return null;
  const matches = plans.filter((plan) =>
    plan.salespersonUserId === source.salespersonUserId
    && plan.effectiveFrom <= source.sourceDate
    && (plan.effectiveTo == null || plan.effectiveTo >= source.sourceDate));
  if (matches.length > 1) {
    throw new SalesCommissionError(
      `Multiple active commission plans match ${source.sourceDocNo}; repair the plan dates first.`,
    );
  }
  return matches[0] ?? null;
}

export async function createCommissionRunWithin(
  exec: DB,
  scope: Scope,
  input: CreateCommissionRunInput,
  actorUserId: number,
) {
  const docNo = required(input.docNo, 'Commission run number', 80);
  const periodStart = date(input.periodStart, 'Period start');
  const periodEnd = date(input.periodEnd, 'Period end');
  if (!periodStart || !periodEnd || periodEnd < periodStart) {
    throw new SalesCommissionError('Commission period is invalid.');
  }
  const currency = required(input.currency, 'Currency', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new SalesCommissionError('Currency must be a three-letter ISO code.');
  }
  const actor = await companyActor(exec, scope, actorUserId);
  // Serialise period checks per company. This prevents two concurrent,
  // overlapping runs from both being calculated and later double-approved.
  const [companyRow] = await exec.select({ currency: company.currency }).from(company).where(and(
    eq(company.masterFn, scope.masterFn),
    eq(company.companyFn, scope.companyFn),
  )).for('update');
  if (!companyRow) throw new SalesCommissionError('Company is unavailable.');
  if (companyRow.currency !== currency) {
    throw new SalesCommissionError(
      `Commission runs must use the company currency ${companyRow.currency}.`,
    );
  }
  const [duplicateDoc] = await exec.select({ id: salesCommissionRun.id })
    .from(salesCommissionRun).where(and(
      eq(salesCommissionRun.masterFn, scope.masterFn),
      eq(salesCommissionRun.companyFn, scope.companyFn),
      eq(salesCommissionRun.docNo, docNo),
    )).limit(1);
  if (duplicateDoc) throw new SalesCommissionError(`Commission run ${docNo} already exists.`);
  const [overlappingRun] = await exec.select({ id: salesCommissionRun.id })
    .from(salesCommissionRun).where(and(
      eq(salesCommissionRun.masterFn, scope.masterFn),
      eq(salesCommissionRun.companyFn, scope.companyFn),
      eq(salesCommissionRun.currency, currency),
      lte(salesCommissionRun.periodStart, periodEnd),
      gte(salesCommissionRun.periodEnd, periodStart),
    )).limit(1);
  if (overlappingRun) {
    throw new SalesCommissionError('A commission run already overlaps this period.');
  }

  const tenant = and(eq(invoice.masterFn, scope.masterFn), eq(invoice.companyFn, scope.companyFn));
  const [invoiceRows, creditRows, debitRows, plans] = await Promise.all([
    exec.select({
      sourceId: invoice.id,
      sourceDocNo: invoice.docNo,
      sourceDate: invoice.invoiceDate,
      salespersonUserId: invoice.salespersonUserId,
      amount: invoice.netAmount,
    }).from(invoice).where(and(
      tenant,
      ne(invoice.status, 'cancelled'),
      eq(invoice.currency, currency),
      between(invoice.invoiceDate, periodStart, periodEnd),
    )).orderBy(invoice.invoiceDate, invoice.id),
    exec.select({
      sourceId: salesCreditNote.id,
      sourceDocNo: salesCreditNote.docNo,
      sourceDate: salesCreditNote.noteDate,
      salespersonUserId: invoice.salespersonUserId,
      amount: salesCreditNote.netAmount,
    }).from(salesCreditNote).innerJoin(invoice, and(
      eq(invoice.id, salesCreditNote.invoiceId),
      eq(invoice.masterFn, salesCreditNote.masterFn),
      eq(invoice.companyFn, salesCreditNote.companyFn),
    )).where(and(
      eq(salesCreditNote.masterFn, scope.masterFn),
      eq(salesCreditNote.companyFn, scope.companyFn),
      eq(salesCreditNote.status, 'posted'),
      eq(salesCreditNote.currency, currency),
      between(salesCreditNote.noteDate, periodStart, periodEnd),
    )).orderBy(salesCreditNote.noteDate, salesCreditNote.id),
    exec.select({
      sourceId: salesDebitNote.id,
      sourceDocNo: salesDebitNote.docNo,
      sourceDate: salesDebitNote.noteDate,
      salespersonUserId: invoice.salespersonUserId,
      amount: salesDebitNote.netAmount,
    }).from(salesDebitNote).innerJoin(invoice, and(
      eq(invoice.id, salesDebitNote.invoiceId),
      eq(invoice.masterFn, salesDebitNote.masterFn),
      eq(invoice.companyFn, salesDebitNote.companyFn),
    )).where(and(
      eq(salesDebitNote.masterFn, scope.masterFn),
      eq(salesDebitNote.companyFn, scope.companyFn),
      eq(salesDebitNote.status, 'posted'),
      eq(salesDebitNote.currency, currency),
      between(salesDebitNote.noteDate, periodStart, periodEnd),
    )).orderBy(salesDebitNote.noteDate, salesDebitNote.id),
    exec.select({
      id: salesCommissionPlan.id,
      salespersonUserId: salesCommissionPlan.salespersonUserId,
      basis: salesCommissionPlan.basis,
      ratePct: salesCommissionPlan.ratePct,
      effectiveFrom: salesCommissionPlan.effectiveFrom,
      effectiveTo: salesCommissionPlan.effectiveTo,
      salespersonName: appUser.fullName,
      salespersonEmail: appUser.email,
      salespersonUsername: appUser.username,
    }).from(salesCommissionPlan).innerJoin(appUser, and(
      eq(appUser.userId, salesCommissionPlan.salespersonUserId),
      eq(appUser.masterFn, salesCommissionPlan.masterFn),
    )).where(and(
      eq(salesCommissionPlan.masterFn, scope.masterFn),
      eq(salesCommissionPlan.companyFn, scope.companyFn),
      eq(salesCommissionPlan.status, 'active'),
      lte(salesCommissionPlan.effectiveFrom, periodEnd),
      or(isNull(salesCommissionPlan.effectiveTo), gte(salesCommissionPlan.effectiveTo, periodStart)),
    )).orderBy(salesCommissionPlan.id),
  ]);

  const candidates: CandidateSource[] = [
    ...invoiceRows.map((row) => ({
      ...row, sourceType: 'invoice' as const, amount: new Decimal(row.amount),
    })),
    ...creditRows.map((row) => ({
      ...row, sourceType: 'credit_note' as const, amount: new Decimal(row.amount).negated(),
    })),
    ...debitRows.map((row) => ({
      ...row, sourceType: 'debit_note' as const, amount: new Decimal(row.amount),
    })),
  ].sort((left, right) =>
    left.sourceDate.localeCompare(right.sourceDate)
    || left.sourceType.localeCompare(right.sourceType)
    || left.sourceId - right.sourceId);
  if (candidates.length === 0) {
    throw new SalesCommissionError('No recognized-revenue documents exist in this period.');
  }

  const missing = candidates.filter((source) => planForSource(plans, source) == null);
  if (missing.length) {
    throw new SalesCommissionError(
      `${missing.length} document(s) have no snapshotted salesperson or active commission plan.`,
    );
  }

  type PlanRow = typeof plans[number];
  type Group = {
    plan: PlanRow;
    sources: Array<CandidateSource & { commission: Decimal }>;
    gross: Decimal;
    credit: Decimal;
    debit: Decimal;
    eligible: Decimal;
    commission: Decimal;
  };
  const groups = new Map<number, Group>();
  for (const source of candidates) {
    const plan = planForSource(plans, source)!;
    const sourceCommission = source.amount.mul(plan.ratePct).div(100).toDecimalPlaces(2);
    const group = groups.get(plan.id) || {
      plan,
      sources: [],
      gross: new Decimal(0),
      credit: new Decimal(0),
      debit: new Decimal(0),
      eligible: new Decimal(0),
      commission: new Decimal(0),
    };
    group.sources.push({ ...source, commission: sourceCommission });
    if (source.sourceType === 'invoice') group.gross = group.gross.plus(source.amount);
    if (source.sourceType === 'credit_note') group.credit = group.credit.plus(source.amount.abs());
    if (source.sourceType === 'debit_note') group.debit = group.debit.plus(source.amount);
    group.eligible = group.eligible.plus(source.amount);
    group.commission = group.commission.plus(sourceCommission);
    groups.set(plan.id, group);
  }

  const orderedGroups = [...groups.values()].sort((left, right) =>
    left.plan.salespersonUserId - right.plan.salespersonUserId || left.plan.id - right.plan.id);
  const totals = orderedGroups.reduce((result, group) => ({
    gross: result.gross.plus(group.gross),
    credit: result.credit.plus(group.credit),
    debit: result.debit.plus(group.debit),
    eligible: result.eligible.plus(group.eligible),
    commission: result.commission.plus(group.commission),
    sourceCount: result.sourceCount + group.sources.length,
  }), {
    gross: new Decimal(0), credit: new Decimal(0), debit: new Decimal(0),
    eligible: new Decimal(0), commission: new Decimal(0), sourceCount: 0,
  });

  const [run] = await exec.insert(salesCommissionRun).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    periodStart,
    periodEnd,
    currency,
    grossInvoiceRevenue: totals.gross.toFixed(2),
    creditRevenue: totals.credit.toFixed(2),
    debitRevenue: totals.debit.toFixed(2),
    eligibleRevenue: totals.eligible.toFixed(2),
    commissionAmount: totals.commission.toFixed(2),
    sourceCount: totals.sourceCount,
    createdByUserId: actor.userId,
    createdByName: actor.name,
  }).returning();

  for (let index = 0; index < orderedGroups.length; index += 1) {
    const group = orderedGroups[index];
    const [line] = await exec.insert(salesCommissionLine).values({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      runId: run.id,
      lineNo: index + 1,
      planId: group.plan.id,
      salespersonUserId: group.plan.salespersonUserId,
      salespersonName: group.plan.salespersonName?.trim()
        || group.plan.salespersonEmail
        || group.plan.salespersonUsername,
      basis: group.plan.basis,
      ratePct: group.plan.ratePct,
      grossInvoiceRevenue: group.gross.toFixed(2),
      creditRevenue: group.credit.toFixed(2),
      debitRevenue: group.debit.toFixed(2),
      eligibleRevenue: group.eligible.toFixed(2),
      commissionAmount: group.commission.toFixed(2),
      sourceCount: group.sources.length,
    }).returning({ id: salesCommissionLine.id });
    await exec.insert(salesCommissionSource).values(group.sources.map((source) => ({
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      runId: run.id,
      lineId: line.id,
      planId: group.plan.id,
      salespersonUserId: group.plan.salespersonUserId,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      sourceDocNo: source.sourceDocNo,
      sourceDate: source.sourceDate,
      recognizedAmount: source.amount.toFixed(2),
      ratePct: group.plan.ratePct,
      commissionAmount: source.commission.toFixed(2),
    })));
  }

  return {
    ...run,
    lineCount: orderedGroups.length,
    sourceCount: totals.sourceCount,
  };
}

export async function approveCommissionRunWithin(
  exec: DB,
  scope: Scope,
  runId: number,
  input: { note: string; actorUserId: number },
) {
  const note = required(input.note, 'Approval note', 1000);
  const actor = await companyActor(exec, scope, input.actorUserId);
  const authorization = await authorizeWithin(
    exec,
    { userId: actor.userId, masterFn: scope.masterFn, companyFn: scope.companyFn },
    PERMISSIONS.salesCommissionApprove,
    { resourceKey: 'sales/commission-runs', requireScope: false },
  );
  if (!authorization.allowed) {
    throw new SalesCommissionError(
      'The actor is not authorized to approve this commission run.',
    );
  }

  const [run] = await exec.select().from(salesCommissionRun).where(and(
    eq(salesCommissionRun.masterFn, scope.masterFn),
    eq(salesCommissionRun.companyFn, scope.companyFn),
    eq(salesCommissionRun.id, runId),
  )).for('update');
  if (!run || run.status !== 'draft') {
    throw new SalesCommissionError('Only a draft commission run can be approved.');
  }
  const [approved] = await exec.update(salesCommissionRun).set({
    status: 'approved',
    approvedAt: sql`now()`,
    approvedByUserId: actor.userId,
    approvedByName: actor.name,
    approvalNote: note,
    version: sql`${salesCommissionRun.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(salesCommissionRun.masterFn, scope.masterFn),
    eq(salesCommissionRun.companyFn, scope.companyFn),
    eq(salesCommissionRun.id, run.id),
  )).returning();
  return approved;
}
