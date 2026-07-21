import { describe, it, expect } from 'vitest';
import { activity, customer, opportunity } from '../../data/schema';
import { eq } from 'drizzle-orm';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createCustomerActivityWithin, InvalidActivityStateError } from './activity';

describe('createCustomerActivityWithin', () => {
  it('success: logs an activity against a real customer', async () => {
    const db = await freshDb();
    const [cust] = await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'AC1', name: 'Activity Test Co',
    }).returning({ id: customer.id });

    const res = await createCustomerActivityWithin(db, SCOPE, {
      customerId: cust.id, kind: 'call', body: 'Discussed renewal terms.',
    });

    expect(res.id).toBeGreaterThan(0);
  });

  it('rejects a customer from another company without creating an activity', async () => {
    const db = await freshDb();
    const [cust] = await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'AC2', name: 'Other Company Co',
    }).returning({ id: customer.id });

    await expect(createCustomerActivityWithin(
      db,
      { masterFn: 'OTHER', companyFn: 'OTHER-C' },
      { customerId: cust.id, kind: 'note', body: 'Hijack attempt' },
    )).rejects.toThrow('does not belong to the active company');
  });

  it('rejects an invalid kind', async () => {
    const db = await freshDb();
    const [cust] = await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'AC3', name: 'Validation Co',
    }).returning({ id: customer.id });

    await expect(createCustomerActivityWithin(db, SCOPE, {
      customerId: cust.id, kind: 'carrier-pigeon', body: 'Sent an update.',
    })).rejects.toThrow(InvalidActivityStateError);
  });

  it('rejects an empty body', async () => {
    const db = await freshDb();
    const [cust] = await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'AC4', name: 'Empty Body Co',
    }).returning({ id: customer.id });

    await expect(createCustomerActivityWithin(db, SCOPE, {
      customerId: cust.id, kind: 'note', body: '   ',
    })).rejects.toThrow(InvalidActivityStateError);
  });

  it('logs one activity against a real opportunity and its customer timeline', async () => {
    const db = await freshDb();
    const [cust] = await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'AC5', name: 'Opportunity Co',
    }).returning({ id: customer.id });
    const [opp] = await db.insert(opportunity).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      docNo: 'OPP-ACT-1', customerId: cust.id, title: 'Renewal', value: '1000',
      currency: 'SGD', stage: 'qualified', probability: '30', closeDate: '2026-08-31',
    }).returning({ id: opportunity.id });

    const res = await createCustomerActivityWithin(db, SCOPE, {
      opportunityId: opp.id, customerId: cust.id, kind: 'email', body: 'Proposal sent.',
    });
    const [stored] = await db.select().from(activity).where(eq(activity.id, res.id));

    expect(stored.opportunityId).toBe(opp.id);
    expect(stored.customerId).toBe(cust.id);
    expect(stored.body).toBe('Proposal sent.');
  });

  it('rejects mismatched opportunity and customer targets', async () => {
    const db = await freshDb();
    const [first, second] = await db.insert(customer).values([
      { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'AC6', name: 'First Co' },
      { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'AC7', name: 'Second Co' },
    ]).returning({ id: customer.id });
    const [opp] = await db.insert(opportunity).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn,
      docNo: 'OPP-ACT-2', customerId: first.id, title: 'Expansion', value: '2000',
      currency: 'SGD', stage: 'lead', probability: '10', closeDate: '2026-09-30',
    }).returning({ id: opportunity.id });

    await expect(createCustomerActivityWithin(db, SCOPE, {
      opportunityId: opp.id, customerId: second.id, kind: 'note', body: 'Wrong account.',
    })).rejects.toThrow('does not belong to the selected customer');
  });
});
