import { describe, it, expect } from 'vitest';
import { customer } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createContactWithin, InvalidContactStateError } from './contact';

describe('createContactWithin', () => {
  it('success: creates a contact linked to a real customer', async () => {
    const db = await freshDb();
    const [cust] = await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'CT1', name: 'Contact Test Co',
    }).returning({ id: customer.id });

    const res = await createContactWithin(db, SCOPE, {
      customerId: cust.id, name: 'Jamie Lee', role: 'Buyer', email: 'jamie@test.example',
    });

    expect(res.id).toBeGreaterThan(0);
  });

  it('rejects a customer from another company without creating a contact', async () => {
    const db = await freshDb();
    const [cust] = await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'CT2', name: 'Other Company Co',
    }).returning({ id: customer.id });

    await expect(createContactWithin(
      db,
      { masterFn: 'OTHER', companyFn: 'OTHER-C' },
      { customerId: cust.id, name: 'Hijack Attempt', role: 'Buyer' },
    )).rejects.toThrow('does not belong to the active company');
  });

  it('rejects a missing name', async () => {
    const db = await freshDb();
    const [cust] = await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'CT3', name: 'Validation Co',
    }).returning({ id: customer.id });

    await expect(createContactWithin(db, SCOPE, {
      customerId: cust.id, name: '  ', role: 'Buyer',
    })).rejects.toThrow(InvalidContactStateError);
  });
});
