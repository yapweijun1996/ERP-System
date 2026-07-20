import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { customer } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createServiceContract, InvalidServiceContractStateError } from './serviceContract';

async function fixtureCustomer(db: DB) {
  const [row] = await db.insert(customer).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'SVC-CUSTOMER',
    name: 'Fictional Service Customer',
  }).returning({ id: customer.id });
  return row;
}

describe('service contract register', () => {
  it('creates a contract linked to a real customer', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    const created = await createServiceContract(db, SCOPE, {
      contractNo: 'SC-1',
      customerId: cust.id,
      plan: 'Gold',
      slaResponseHours: 4,
      assetsCovered: 5,
      startDate: '2026-01-01',
      expiryDate: '2027-01-01',
      annualValue: '48000',
    });
    expect(created.id).toBeGreaterThan(0);
  });

  it('rejects an unknown plan', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    await expect(createServiceContract(db, SCOPE, {
      contractNo: 'SC-BADPLAN',
      customerId: cust.id,
      plan: 'Platinum',
      startDate: '2026-01-01',
      expiryDate: '2027-01-01',
      annualValue: '0',
    })).rejects.toThrow(InvalidServiceContractStateError);
  });

  it('rejects an expiryDate on or before startDate', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    await expect(createServiceContract(db, SCOPE, {
      contractNo: 'SC-BADDATES',
      customerId: cust.id,
      plan: 'Bronze',
      startDate: '2026-01-01',
      expiryDate: '2026-01-01',
      annualValue: '0',
    })).rejects.toThrow('expiryDate must be after startDate');
  });

  it('rejects a non-positive slaResponseHours when provided', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    await expect(createServiceContract(db, SCOPE, {
      contractNo: 'SC-BADSLA',
      customerId: cust.id,
      plan: 'Silver',
      slaResponseHours: 0,
      startDate: '2026-01-01',
      expiryDate: '2027-01-01',
      annualValue: '0',
    })).rejects.toThrow(InvalidServiceContractStateError);
  });

  it('rejects a customerId that does not belong to this company', async () => {
    const db = await freshDb();
    await expect(createServiceContract(db, SCOPE, {
      contractNo: 'SC-BADCUST',
      customerId: 999999,
      plan: 'Gold',
      startDate: '2026-01-01',
      expiryDate: '2027-01-01',
      annualValue: '0',
    })).rejects.toThrow(InvalidServiceContractStateError);
  });
});
