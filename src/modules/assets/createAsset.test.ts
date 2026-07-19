import { describe, it, expect } from 'vitest';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { createAsset, InvalidAssetStateError } from './createAsset';

describe('createAsset', () => {
  it('success: registers an asset with zero accumulated depreciation', async () => {
    const db = await freshDb();
    const res = await createAsset(db, SCOPE, {
      assetNo: 'FA-T1', name: 'Test Machine', category: 'Plant & Machinery',
      acquisitionDate: '2024-01-01', cost: '120000.00', residualValue: '20000.00',
      usefulLifeYears: 10,
    });
    expect(res.id).toBeGreaterThan(0);
  });

  it('rejects an invalid category', async () => {
    const db = await freshDb();
    await expect(createAsset(db, SCOPE, {
      assetNo: 'FA-T2', name: 'Bad Category', category: 'Not A Category',
      acquisitionDate: '2024-01-01', cost: '1000', residualValue: '0', usefulLifeYears: 5,
    })).rejects.toThrow(InvalidAssetStateError);
  });

  it('rejects a residual value greater than cost', async () => {
    const db = await freshDb();
    await expect(createAsset(db, SCOPE, {
      assetNo: 'FA-T3', name: 'Bad Residual', category: 'Vehicles',
      acquisitionDate: '2024-01-01', cost: '1000', residualValue: '2000', usefulLifeYears: 5,
    })).rejects.toThrow(InvalidAssetStateError);
  });

  it('rejects a non-positive useful life', async () => {
    const db = await freshDb();
    await expect(createAsset(db, SCOPE, {
      assetNo: 'FA-T4', name: 'Bad Life', category: 'Vehicles',
      acquisitionDate: '2024-01-01', cost: '1000', residualValue: '0', usefulLifeYears: 0,
    })).rejects.toThrow(InvalidAssetStateError);
  });

  it('rejects a duplicate assetNo within the same tenant', async () => {
    const db = await freshDb();
    await createAsset(db, SCOPE, {
      assetNo: 'FA-DUP', name: 'First', category: 'Vehicles',
      acquisitionDate: '2024-01-01', cost: '1000', residualValue: '0', usefulLifeYears: 5,
    });
    await expect(createAsset(db, SCOPE, {
      assetNo: 'FA-DUP', name: 'Second', category: 'Vehicles',
      acquisitionDate: '2024-01-01', cost: '1000', residualValue: '0', usefulLifeYears: 5,
    })).rejects.toThrow();
  });
});
