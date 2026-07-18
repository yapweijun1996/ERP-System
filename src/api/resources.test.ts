import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import {
  InvalidResourceQueryError,
  UnknownResourceError,
  getResource,
  listResource,
} from './resources';

describe('canonical API resources', () => {
  let db: DB;
  const scope = { masterFn: 'M1', companyFn: 'C-SG' };

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
  });

  it('lists a tenant-scoped resource with bounded keyset pagination', async () => {
    const first = await listResource(db, scope, 'inventory/products', { limit: 1 });
    expect(first.data).toHaveLength(1);
    expect(first.meta.nextCursor).toBe(String((first.data[0] as { id: number }).id));

    const second = await listResource(db, scope, 'inventory/products', {
      limit: 1000,
      cursor: first.meta.nextCursor,
    });
    expect(second.data).toHaveLength(1);
    expect(second.meta.nextCursor).toBeNull();
    expect((second.data[0] as { id: number }).id).toBeGreaterThan(
      (first.data[0] as { id: number }).id,
    );
  });

  it('never crosses company scope', async () => {
    const sg = await listResource(db, scope, 'inventory/products');
    const my = await listResource(
      db,
      { masterFn: 'M1', companyFn: 'C-MY' },
      'inventory/products',
    );
    expect(sg.data.map((row: any) => row.sku)).toEqual(['SG-WIDGET', 'SG-GADGET']);
    expect(my.data.map((row: any) => row.sku)).toEqual(['MY-WIDGET']);
  });

  it('gets one row only inside the requested tenant', async () => {
    const sg = await listResource(db, scope, 'inventory/products', { limit: 1 });
    const id = (sg.data[0] as { id: number }).id;
    expect((await getResource(db, scope, 'inventory/products', id))?.data).toMatchObject({
      id,
      masterFn: 'M1',
      companyFn: 'C-SG',
    });
    expect(await getResource(
      db,
      { masterFn: 'M1', companyFn: 'C-MY' },
      'inventory/products',
      id,
    )).toBeNull();
  });

  it('allows only declared filters and sort order', async () => {
    await expect(listResource(db, scope, 'inventory/products', { status: 'draft' }))
      .rejects.toBeInstanceOf(InvalidResourceQueryError);
    await expect(listResource(db, scope, 'inventory/products', { sort: 'name' }))
      .rejects.toBeInstanceOf(InvalidResourceQueryError);
    await expect(listResource(db, scope, 'inventory/products', { search: 'Widget' }))
      .rejects.toThrow('unsupported filter(s): search');
    await expect(listResource(db, scope, 'unknown/things'))
      .rejects.toBeInstanceOf(UnknownResourceError);
  });
});
