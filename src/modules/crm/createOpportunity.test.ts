import { describe, it, expect } from 'vitest';
import { customer } from '../../data/schema';
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
});
