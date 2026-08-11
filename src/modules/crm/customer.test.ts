import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { customer } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createCustomerWithin, InvalidCustomerStateError } from './customer';

describe('createCustomerWithin', () => {
  it('creates a customer with an automatic code when code is omitted', async () => {
    const db = await freshDb();
    const created = await createCustomerWithin(db, SCOPE, {
      name: '  New Customer Co  ', industry: 'Manufacturing',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.code).toMatch(/^CUST-[A-Z0-9]{8}-[A-Z0-9]{6}$/);
    expect(created.name).toBe('New Customer Co');
    expect(created.industry).toBe('Manufacturing');
  });

  it('rejects a duplicate code within the active company', async () => {
    const db = await freshDb();
    await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, code: 'ACME', name: 'Existing Co',
    });

    await expect(createCustomerWithin(db, SCOPE, {
      code: ' acme ', name: 'Duplicate Co',
    })).rejects.toThrow('already exists');
  });

  it('does not treat a code from another company as a duplicate', async () => {
    const db = await freshDb();
    await db.insert(customer).values({
      masterFn: SCOPE.masterFn, companyFn: 'OTHER-C', code: 'ACME', name: 'Other Co',
    });

    const created = await createCustomerWithin(db, SCOPE, { code: 'ACME', name: 'Active Co' });
    const [row] = await db.select({ name: customer.name }).from(customer).where(and(
      eq(customer.id, created.id), eq(customer.companyFn, SCOPE.companyFn),
    ));
    expect(row.name).toBe('Active Co');
  });

  it('requires a customer name', async () => {
    const db = await freshDb();
    await expect(createCustomerWithin(db, SCOPE, { name: '  ' }))
      .rejects.toThrow(InvalidCustomerStateError);
  });
});
