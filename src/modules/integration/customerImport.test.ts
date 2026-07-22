import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { customer, importJob, importJobRow, importRowError } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  createCustomerImportJob,
  CustomerImportStateError,
  CustomerImportValidationError,
  listCustomerImportJobsWithin,
  runCustomerImportJob,
} from './customerImport';

const SCOPE = { masterFn: 'M1', companyFn: 'C-SG' };

async function fixture() {
  const db = await freshDb();
  await seedDemo(db);
  return { db, actorUserId: 1 };
}

describe('canonical customer CSV import', () => {
  it('persists validation facts and atomically creates or updates ready customers', async () => {
    const { db, actorUserId } = await fixture();
    const job = await createCustomerImportJob(db, SCOPE, actorUserId, {
      fileName: 'customers.csv',
      duplicateStrategy: 'update_existing',
      rows: [
        { code: 'cust1', name: 'Beta Manufacturing Pte Ltd', industry: 'Industrial' },
        { code: 'cust2', name: 'Fictional Robotics Pte Ltd', industry: 'Robotics' },
        { code: '', name: 'Missing code' },
      ],
    });
    expect(job).toMatchObject({
      status: 'validated', totalRows: 3, readyRows: 2, errorRows: 1, skippedRows: 0,
    });
    expect(await db.select().from(importRowError).where(eq(importRowError.jobId, job.id)))
      .toEqual([expect.objectContaining({ rowNumber: 4, field: 'code', errorCode: 'required' })]);

    const completed = await runCustomerImportJob(db, SCOPE, job.id);
    expect(completed).toMatchObject({ status: 'completed', importedRows: 2, errorRows: 1, version: 2 });
    expect(await db.select({ code: customer.code, name: customer.name }).from(customer).where(and(
      eq(customer.masterFn, 'M1'), eq(customer.companyFn, 'C-SG'),
    ))).toEqual(expect.arrayContaining([
      { code: 'CUST1', name: 'Beta Manufacturing Pte Ltd' },
      { code: 'CUST2', name: 'Fictional Robotics Pte Ltd' },
    ]));
    expect(await db.select().from(importJobRow).where(eq(importJobRow.jobId, job.id)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ rowNumber: 2, status: 'imported', operation: 'update' }),
        expect.objectContaining({ rowNumber: 3, status: 'imported', operation: 'create' }),
        expect.objectContaining({ rowNumber: 4, status: 'error', operation: 'invalid' }),
      ]));
  });

  it('records existing rows as skipped and rejects duplicate codes inside one file', async () => {
    const { db, actorUserId } = await fixture();
    const job = await createCustomerImportJob(db, SCOPE, actorUserId, {
      fileName: 'bounded.csv',
      duplicateStrategy: 'skip_existing',
      rows: [
        { code: 'CUST1', name: 'Existing customer' },
        { code: 'NEW-1', name: 'First row' },
        { code: 'new-1', name: 'Duplicate row' },
      ],
    });
    expect(job).toMatchObject({ readyRows: 1, skippedRows: 1, errorRows: 1 });
    expect(await db.select().from(importRowError).where(eq(importRowError.jobId, job.id)))
      .toEqual([expect.objectContaining({ rowNumber: 4, errorCode: 'duplicate_in_file' })]);
  });

  it('rejects unbounded, unsupported and tenant-bearing inputs', async () => {
    const { db, actorUserId } = await fixture();
    await expect(createCustomerImportJob(db, SCOPE, actorUserId, {
      fileName: 'customers.xlsx', duplicateStrategy: 'update_existing', rows: [{ code: 'A', name: 'A' }],
    })).rejects.toThrow(CustomerImportValidationError);
    await expect(createCustomerImportJob(db, SCOPE, actorUserId, {
      fileName: 'customers.csv', duplicateStrategy: 'update_existing',
      rows: [{ code: 'A', name: 'A', masterFn: 'OTHER' } as never],
    })).rejects.toThrow('Tenant scope cannot appear inside import rows.');
    await expect(createCustomerImportJob(db, SCOPE, actorUserId, {
      fileName: 'customers.csv', duplicateStrategy: 'update_existing',
      rows: Array.from({ length: 251 }, (_, i) => ({ code: `C${i}`, name: `Customer ${i}` })),
    })).rejects.toThrow('limited to 250 rows');
  });

  it('keeps company isolation and fully rolls back a corrupt validated job', async () => {
    const { db, actorUserId } = await fixture();
    const job = await createCustomerImportJob(db, SCOPE, actorUserId, {
      fileName: 'rollback.csv', duplicateStrategy: 'update_existing',
      rows: [{ code: 'ROLL-1', name: 'First' }, { code: 'ROLL-2', name: 'Second' }],
    });
    await expect(runCustomerImportJob(
      db, { masterFn: 'M1', companyFn: 'C-MY' }, job.id,
    )).rejects.toThrow(CustomerImportStateError);

    const [second] = await db.select({ id: importJobRow.id }).from(importJobRow).where(and(
      eq(importJobRow.jobId, job.id), eq(importJobRow.rowNumber, 3),
    ));
    await db.update(importJobRow).set({ code: null }).where(eq(importJobRow.id, second.id));
    await expect(runCustomerImportJob(db, SCOPE, job.id)).rejects.toThrow('incomplete');
    expect(await db.select().from(customer).where(and(
      eq(customer.masterFn, 'M1'), eq(customer.companyFn, 'C-SG'), eq(customer.code, 'ROLL-1'),
    ))).toHaveLength(0);
    expect(await db.select().from(importJob).where(eq(importJob.id, job.id)))
      .toEqual([expect.objectContaining({ status: 'validated', importedRows: 0 })]);
  });

  it('lists newest jobs first with descending keyset pagination', async () => {
    const { db, actorUserId } = await fixture();
    for (let index = 1; index <= 3; index += 1) {
      await createCustomerImportJob(db, SCOPE, actorUserId, {
        fileName: `customers-${index}.csv`,
        duplicateStrategy: 'update_existing',
        rows: [{ code: `PAGE-${index}`, name: `Customer ${index}` }],
      });
    }
    const first = await listCustomerImportJobsWithin(db, SCOPE, { limit: 2 });
    expect(first.data).toHaveLength(2);
    expect(first.data[0].id).toBeGreaterThan(first.data[1].id);
    expect(first.nextCursor).toBe(first.data[1].id);

    const second = await listCustomerImportJobsWithin(db, SCOPE, {
      cursor: first.nextCursor ?? undefined,
      limit: 2,
    });
    expect(second.data).toHaveLength(1);
    expect(second.data[0].id).toBeLessThan(first.nextCursor ?? 0);
    expect(second.nextCursor).toBeNull();
  });
});
