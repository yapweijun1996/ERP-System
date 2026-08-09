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
