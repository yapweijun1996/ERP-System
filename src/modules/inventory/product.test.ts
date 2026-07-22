import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { product } from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  createProductWithin,
  updateProductWithin,
  InventoryProductValidationError,
  InventoryProductConflictError,
} from './product';

describe('createProductWithin', () => {
  it('success: creates a product with master-data fields', async () => {
    const db = await freshDb();
    const res = await createProductWithin(db, SCOPE, {
      sku: 'IM-T1', name: 'Test Widget', uom: 'unit', category: 'Finished Goods',
      standardCost: '4.5000', reorderPoint: '10', reorderQty: '50',
    });
    expect(res.id).toBeGreaterThan(0);
  });

  it('rejects an invalid category', async () => {
    const db = await freshDb();
    await expect(createProductWithin(db, SCOPE, {
      sku: 'IM-T2', name: 'Bad Category', uom: 'unit', category: 'Not A Category',
      standardCost: '1', reorderPoint: '0', reorderQty: '0',
    })).rejects.toThrow(InventoryProductValidationError);
  });

  it('rejects a duplicate sku within the same tenant', async () => {
    const db = await freshDb();
    await createProductWithin(db, SCOPE, {
      sku: 'IM-DUP', name: 'First', uom: 'unit', category: 'Components',
      standardCost: '1', reorderPoint: '0', reorderQty: '0',
    });
    await expect(createProductWithin(db, SCOPE, {
      sku: 'IM-DUP', name: 'Second', uom: 'unit', category: 'Components',
      standardCost: '1', reorderPoint: '0', reorderQty: '0',
    })).rejects.toThrow(InventoryProductConflictError);
  });
});

describe('updateProductWithin', () => {
  it('success: updates fields and bumps version', async () => {
    const db = await freshDb();
    const created = await createProductWithin(db, SCOPE, {
      sku: 'IM-U1', name: 'Original', uom: 'unit', category: 'Components',
      standardCost: '1', reorderPoint: '5', reorderQty: '20',
    });
    const updated = await updateProductWithin(db, SCOPE, created.id, {
      name: 'Updated Name', uom: 'box', category: 'Packaging',
      standardCost: '2.5000', reorderPoint: '15', reorderQty: '40',
    });
    expect(updated.version).toBe(2);
    const [row] = await db.select().from(product).where(eq(product.id, created.id));
    expect(row.name).toBe('Updated Name');
    expect(row.category).toBe('Packaging');
    expect(row.reorderPoint).toBe('15.0000');
  });

  it('rejects updating a product that belongs to another tenant', async () => {
    const db = await freshDb();
    const created = await createProductWithin(db, SCOPE, {
      sku: 'IM-U2', name: 'Tenant Scoped', uom: 'unit', category: 'Components',
      standardCost: '1', reorderPoint: '0', reorderQty: '0',
    });
    await expect(updateProductWithin(
      db,
      { masterFn: 'OTHER', companyFn: 'OTHER-C' },
      created.id,
      {
        name: 'Hijacked', uom: 'unit', category: 'Components',
        standardCost: '1', reorderPoint: '0', reorderQty: '0',
      },
    )).rejects.toThrow(InventoryProductConflictError);
  });

  it('rejects an unknown product id', async () => {
    const db = await freshDb();
    await expect(updateProductWithin(db, SCOPE, 999999, {
      name: 'Ghost', uom: 'unit', category: 'Components',
      standardCost: '1', reorderPoint: '0', reorderQty: '0',
    })).rejects.toThrow(InventoryProductConflictError);
  });
});
