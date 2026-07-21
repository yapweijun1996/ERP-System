import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { activity, customer, opportunity } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { markOpportunityLostWithin } from './opportunityLifecycle';

async function fixture(stage = 'qualified') {
  const db = await freshDb();
  const [cust] = await db.insert(customer).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    code: `LOSS-${stage}`, name: 'Loss Test Co',
  }).returning({ id: customer.id });
  const [opp] = await db.insert(opportunity).values({
    masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
    docNo: `OPP-LOSS-${stage}`, customerId: cust.id, title: 'At-risk deal', value: '5000',
    currency: 'SGD', stage, probability: '40', closeDate: '2026-10-31',
  }).returning({ id: opportunity.id });
  return { db, cust, opp };
}

describe('markOpportunityLostWithin', () => {
  it('marks an open opportunity lost, bumps its version, and records the reason', async () => {
    const { db, cust, opp } = await fixture();

    const result = await db.transaction((tx) => markOpportunityLostWithin(
      tx, SCOPE, opp.id, 'Budget withdrawn',
    ));
    const [event] = await db.select().from(activity).where(eq(activity.opportunityId, opp.id));

    expect(result).toMatchObject({ id: opp.id, stage: 'lost', version: 2 });
    expect(event).toMatchObject({ customerId: cust.id, kind: 'system', body: 'Marked lost: Budget withdrawn' });
  });

  it('rejects an empty loss reason without changing the opportunity', async () => {
    const { db, opp } = await fixture();
    await expect(markOpportunityLostWithin(db, SCOPE, opp.id, '  ')).rejects.toThrow(
      'A loss reason is required',
    );
    const [stored] = await db.select().from(opportunity).where(eq(opportunity.id, opp.id));
    expect(stored.stage).toBe('qualified');
  });

  it.each(['won', 'lost'])('rejects a terminal %s opportunity', async (stage) => {
    const { db, opp } = await fixture(stage);
    await expect(markOpportunityLostWithin(db, SCOPE, opp.id, 'No longer active')).rejects.toThrow(
      `already '${stage}'`,
    );
  });

  it('rejects an opportunity from another tenant', async () => {
    const { db, opp } = await fixture();
    await expect(markOpportunityLostWithin(
      db, { masterFn: 'OTHER', companyFn: 'OTHER-C' }, opp.id, 'Out of scope',
    )).rejects.toThrow('not found');
  });
});
