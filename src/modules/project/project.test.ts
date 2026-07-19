import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { customer } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createProject, InvalidProjectStateError } from './project';

async function fixtureCustomer(db: DB) {
  const [row] = await db.insert(customer).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'PROJ-CUSTOMER',
    name: 'Fictional Project Customer',
  }).returning({ id: customer.id });
  return row;
}

describe('project register', () => {
  it('creates a Customer project linked to a real customer', async () => {
    const db = await freshDb();
    const cust = await fixtureCustomer(db);
    const created = await createProject(db, SCOPE, {
      projectNo: 'PRJ-1',
      name: 'Fictional Cell Integration',
      customerId: cust.id,
      managerName: 'Fictional Manager',
      startDate: '2026-01-01',
      contractValue: '10000',
    });
    expect(created.id).toBeGreaterThan(0);
  });

  it('creates an Internal project with no customer', async () => {
    const db = await freshDb();
    const created = await createProject(db, SCOPE, {
      projectNo: 'PRJ-INTERNAL',
      name: 'Fictional Internal Retrofit',
      managerName: 'Fictional Manager',
      startDate: '2026-01-01',
      contractValue: '0',
    });
    expect(created.id).toBeGreaterThan(0);
  });

  it('rejects a customerId that does not belong to this company', async () => {
    const db = await freshDb();
    await expect(createProject(db, SCOPE, {
      projectNo: 'PRJ-BADCUST',
      name: 'Fictional Project',
      customerId: 999999,
      managerName: 'Fictional Manager',
      startDate: '2026-01-01',
      contractValue: '0',
    })).rejects.toThrow(InvalidProjectStateError);
  });

  it('rejects a negative contract value', async () => {
    const db = await freshDb();
    await expect(createProject(db, SCOPE, {
      projectNo: 'PRJ-NEG',
      name: 'Fictional Project',
      managerName: 'Fictional Manager',
      startDate: '2026-01-01',
      contractValue: '-1',
    })).rejects.toThrow('contractValue must be non-negative');
  });

  it('rejects an unknown status', async () => {
    const db = await freshDb();
    await expect(createProject(db, SCOPE, {
      projectNo: 'PRJ-BADSTATUS',
      name: 'Fictional Project',
      managerName: 'Fictional Manager',
      status: 'archived',
      startDate: '2026-01-01',
      contractValue: '0',
    })).rejects.toThrow(InvalidProjectStateError);
  });
});
