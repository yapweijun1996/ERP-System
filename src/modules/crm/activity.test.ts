import { describe, it, expect } from 'vitest';
import { customer } from '../../data/schema';
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
});
