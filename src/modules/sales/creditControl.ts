import { and, eq, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { customer, invoice, salesCreditProfile } from '../../data/schema';

export class SalesCreditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalesCreditError';
  }
}

function amount(value: string | number, label: string) {
  let result: Decimal;
  try {
    result = new Decimal(value);
  } catch {
    throw new SalesCreditError(`${label} must be a valid decimal.`);
  }
  if (!result.isFinite() || result.isNegative()) {
    throw new SalesCreditError(`${label} must be zero or greater.`);
  }
  return result;
}

export interface CreateCreditProfileInput {
  customerId: number;
  currency: string;
  creditLimit: string | number;
}

export async function createCreditProfileWithin(
  exec: DB,
  scope: Scope,
  input: CreateCreditProfileInput,
) {
  if (!Number.isSafeInteger(input.customerId) || input.customerId <= 0) {
    throw new SalesCreditError('customerId must be a positive integer.');
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new SalesCreditError('currency must be a three-letter ISO code.');
  }
  const limit = amount(input.creditLimit, 'Credit limit');
  const [buyer] = await exec.select({ id: customer.id }).from(customer).where(and(
    eq(customer.masterFn, scope.masterFn),
    eq(customer.companyFn, scope.companyFn),
    eq(customer.id, input.customerId),
  ));
  if (!buyer) throw new SalesCreditError('Customer is unavailable in this company.');
  const [profile] = await exec.insert(salesCreditProfile).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    customerId: buyer.id,
    currency: input.currency,
    creditLimit: limit.toFixed(2),
  }).returning();
  return profile;
}

async function transitionCredit(
  exec: DB,
  scope: Scope,
  profileId: number,
  target: 'open' | 'held',
  reason?: string,
) {
  const [row] = await exec.select().from(salesCreditProfile).where(and(
    eq(salesCreditProfile.masterFn, scope.masterFn),
    eq(salesCreditProfile.companyFn, scope.companyFn),
    eq(salesCreditProfile.id, profileId),
  )).for('update');
  if (!row || row.status === target) {
    throw new SalesCreditError(
      target === 'held'
        ? 'Only an open credit profile can be held.'
        : 'Only a held credit profile can be released.',
    );
  }
  const holdReason = target === 'held' ? reason?.trim() : null;
  if (target === 'held' && !holdReason) throw new SalesCreditError('Hold reason is required.');
  const [updated] = await exec.update(salesCreditProfile).set({
    status: target,
    holdReason,
    version: sql`${salesCreditProfile.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(salesCreditProfile.masterFn, scope.masterFn),
    eq(salesCreditProfile.companyFn, scope.companyFn),
    eq(salesCreditProfile.id, row.id),
  )).returning();
  return updated;
}

export function placeCreditHoldWithin(
  exec: DB,
  scope: Scope,
  profileId: number,
  reason: string,
) {
  return transitionCredit(exec, scope, profileId, 'held', reason);
}

export function releaseCreditHoldWithin(exec: DB, scope: Scope, profileId: number) {
  return transitionCredit(exec, scope, profileId, 'open');
}

export async function assertCustomerCreditWithin(
  exec: DB,
  scope: Scope,
  customerId: number,
  currency: string,
  additionalExposure: string | number,
) {
  const [profile] = await exec.select().from(salesCreditProfile).where(and(
    eq(salesCreditProfile.masterFn, scope.masterFn),
    eq(salesCreditProfile.companyFn, scope.companyFn),
    eq(salesCreditProfile.customerId, customerId),
  )).for('update');
  if (!profile) return;
  if (profile.currency !== currency) {
    throw new SalesCreditError('Order currency does not match the customer credit profile.');
  }
  if (profile.status === 'held') {
    throw new SalesCreditError(`Customer is on credit hold: ${profile.holdReason || 'No reason'}.`);
  }
  const [row] = await exec.select({
    exposure: sql<string>`coalesce(sum(${invoice.totalAmount}), 0)`,
  }).from(invoice).where(and(
    eq(invoice.masterFn, scope.masterFn),
    eq(invoice.companyFn, scope.companyFn),
    eq(invoice.customerId, customerId),
    eq(invoice.status, 'unpaid'),
    eq(invoice.currency, currency),
  ));
  const current = new Decimal(row?.exposure ?? 0);
  const requested = amount(additionalExposure, 'Additional exposure');
  const limit = new Decimal(profile.creditLimit);
  if (current.plus(requested).gt(limit)) {
    throw new SalesCreditError(
      `Credit limit exceeded: ${current.plus(requested).toFixed(2)} > ${limit.toFixed(2)}.`,
    );
  }
}

export function createCreditProfile(db: DB, scope: Scope, input: CreateCreditProfileInput) {
  return db.transaction((tx) => createCreditProfileWithin(tx, scope, input));
}

export function placeCreditHold(db: DB, scope: Scope, profileId: number, reason: string) {
  return db.transaction((tx) => placeCreditHoldWithin(tx, scope, profileId, reason));
}

export function releaseCreditHold(db: DB, scope: Scope, profileId: number) {
  return db.transaction((tx) => releaseCreditHoldWithin(tx, scope, profileId));
}
