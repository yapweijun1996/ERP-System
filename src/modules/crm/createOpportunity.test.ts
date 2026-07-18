import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { customer, opportunity } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createOpportunity } from './createOpportunity';

describe('createOpportunity', () => {
  it('success: creates a lead-stage opportunity linked to a real customer', async () => {
    const db = await freshDb();
    const [cust] = await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'C1', name: 'Test Customer',
    }).returning({ id: customer.id });

    const res = await createOpportunity(db, SCOPE, {
      docNo: 'OPP-T1', customerId: cust.id, title: 'Widget expansion',
      value: 50000, currency: 'SGD', closeDate: '2024-07-01', probability: 40,
    });

    expect(res.opportunityId).toBeGreaterThan(0);
  });

  it('preserves an explicitly selected open pipeline stage', async () => {
    const db = await freshDb();
    const [cust] = await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'C2', name: 'Stage Customer',
    }).returning({ id: customer.id });

    const res = await createOpportunity(db, SCOPE, {
      docNo: 'OPP-T2', customerId: cust.id, title: 'Qualified expansion',
      value: 12000, currency: 'SGD', closeDate: '2024-08-01',
      probability: 60, stage: 'qualified',
    });

    const [created] = await db.select({ stage: opportunity.stage })
      .from(opportunity)
      .where(eq(opportunity.id, res.opportunityId));
    expect(created.stage).toBe('qualified');
  });
});
