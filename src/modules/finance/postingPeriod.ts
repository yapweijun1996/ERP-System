import { and, eq, gte, lte } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { accountingPeriod } from '../../data/schema';

export async function assertOpenAccountingPeriod(
  exec: DB,
  scope: Scope,
  postingDate: string | Date,
  error: (message: string) => Error = (message) => new Error(message),
) {
  const date = postingDate instanceof Date
    ? postingDate.toISOString().slice(0, 10)
    : String(postingDate);
  const periods = await exec.select({
    label: accountingPeriod.label,
    status: accountingPeriod.status,
  }).from(accountingPeriod).where(and(
    eq(accountingPeriod.masterFn, scope.masterFn),
    eq(accountingPeriod.companyFn, scope.companyFn),
    lte(accountingPeriod.startDate, date),
    gte(accountingPeriod.endDate, date),
  )).limit(2).for('update');
  if (periods.length !== 1) {
    throw error('Exactly one accounting period must cover the posting date.');
  }
  if (periods[0].status !== 'open') {
    throw error(`Accounting period ${periods[0].label} is locked.`);
  }
  return periods[0];
}
