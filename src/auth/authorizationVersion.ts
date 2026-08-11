import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../data/db';
import { company } from '../data/schema';
import { AuthLifecycleError } from './authErrors';

export interface AuthorizationVersionScope {
  masterFn: string;
  companyFn: string;
}

/**
 * Read the current tenant authorization version. This is a freshness marker
 * only; authorization decisions still query the central evaluator's current
 * role, scope, override and module state.
 */
export async function getAuthorizationVersionWithin(
  exec: DB,
  scope: AuthorizationVersionScope,
): Promise<number> {
  const [row] = await exec.select({
    authorizationVersion: company.authorizationVersion,
  }).from(company).where(and(
    eq(company.masterFn, scope.masterFn),
    eq(company.companyFn, scope.companyFn),
  )).limit(1);
  if (!row) {
    throw new AuthLifecycleError(404, 'company_not_found', 'Company not found.');
  }
  return row.authorizationVersion;
}

/**
 * Atomically advance the tenant authorization version inside the caller's
 * transaction. Callers must invoke this after a successful authorization
 * graph mutation and before the transaction commits.
 */
export async function bumpAuthorizationVersionWithin(
  exec: DB,
  scope: AuthorizationVersionScope,
  now = new Date(),
): Promise<number> {
  const [row] = await exec.update(company).set({
    authorizationVersion: sql`${company.authorizationVersion} + 1`,
    updatedAt: now,
  }).where(and(
    eq(company.masterFn, scope.masterFn),
    eq(company.companyFn, scope.companyFn),
  )).returning({ authorizationVersion: company.authorizationVersion });
  if (!row) {
    throw new AuthLifecycleError(404, 'company_not_found', 'Company not found.');
  }
  return row.authorizationVersion;
}

/**
 * Advance every Company authorization marker for one Master. Master-wide
 * platform grants can affect any Company under that Master, so invalidating
 * only the currently selected Company would leave other capability snapshots
 * stale until their next unrelated tenant mutation.
 */
export async function bumpMasterAuthorizationVersionsWithin(
  exec: DB,
  masterFn: string,
  now = new Date(),
): Promise<number> {
  const rows = await exec.update(company).set({
    authorizationVersion: sql`${company.authorizationVersion} + 1`,
    updatedAt: now,
  }).where(eq(company.masterFn, masterFn))
    .returning({ companyFn: company.companyFn });
  if (!rows.length) {
    throw new AuthLifecycleError(404, 'master_not_found', 'Master not found.');
  }
  return rows.length;
}
