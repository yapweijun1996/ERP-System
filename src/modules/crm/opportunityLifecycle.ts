// Opportunity terminal-state actions that do not create a sales order. Conversion
// remains in convertOpportunityToSalesOrder.ts because it composes the full Sales
// transaction; marking a deal lost only updates CRM state and appends its reason to
// the real activity timeline in the same transaction.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { activity, opportunity } from '../../data/schema';
import { InvalidOpportunityStateError } from './errors';

export async function markOpportunityLostWithin(
  exec: DB,
  scope: Scope,
  opportunityId: number,
  reason: string,
) {
  if (!reason?.trim()) {
    throw new InvalidOpportunityStateError('A loss reason is required.');
  }

  const [existing] = await exec.select({
    id: opportunity.id,
    customerId: opportunity.customerId,
    stage: opportunity.stage,
    version: opportunity.version,
  }).from(opportunity).where(and(
    eq(opportunity.masterFn, scope.masterFn),
    eq(opportunity.companyFn, scope.companyFn),
    eq(opportunity.id, opportunityId),
  )).for('update');

  if (!existing) {
    throw new InvalidOpportunityStateError(`Opportunity ${opportunityId} not found`);
  }
  if (existing.stage === 'won' || existing.stage === 'lost') {
    throw new InvalidOpportunityStateError(
      `Opportunity ${opportunityId} is already '${existing.stage}'.`,
    );
  }

  const [updated] = await exec.update(opportunity).set({
    stage: 'lost',
    version: sql`${opportunity.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(opportunity.masterFn, scope.masterFn),
    eq(opportunity.companyFn, scope.companyFn),
    eq(opportunity.id, opportunityId),
  )).returning({ id: opportunity.id, stage: opportunity.stage, version: opportunity.version });

  await exec.insert(activity).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    opportunityId: existing.id,
    customerId: existing.customerId,
    kind: 'system',
    body: `Marked lost: ${reason.trim()}`,
  });

  return updated;
}
