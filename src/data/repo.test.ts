import { describe, it, expect } from 'vitest';
import type { DB } from './db';
import { company, currency, master, taxRule } from './schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../test/helpers';
import { getEffectiveTaxRate, listProducts, addProduct } from './repo';

/** SG GST: 8% through end of 2023, 9% from 2024-01-01 onward (open-ended). */
async function seedTaxRules(db: DB) {
  await db.insert(taxRule).values([
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, taxRegime: 'GST', taxCode: 'SR', rate: '8.000', validFrom: '2023-01-01', validTo: '2024-01-01' },
    { masterFn: SCOPE.masterFn, companyFn: SCOPE.companyFn, taxRegime: 'GST', taxCode: 'SR', rate: '9.000', validFrom: '2024-01-01', validTo: null },
  ]);
}

describe('getEffectiveTaxRate', () => {
  it('returns the earlier rate for a date within its window', async () => {
    const db = await freshDb();
    await seedTaxRules(db);
    const r = await getEffectiveTaxRate(db, SCOPE, 'SR', '2023-06-01');
    expect(Number(r?.rate)).toBe(8);
  });

  it('returns the later rate exactly ON its validFrom boundary (inclusive)', async () => {
    const db = await freshDb();
    await seedTaxRules(db);
    const r = await getEffectiveTaxRate(db, SCOPE, 'SR', '2024-01-01');
    expect(Number(r?.rate)).toBe(9);
  });

  it('returns the earlier rate the day before the boundary (validTo is exclusive)', async () => {
    const db = await freshDb();
    await seedTaxRules(db);
    const r = await getEffectiveTaxRate(db, SCOPE, 'SR', '2023-12-31');
    expect(Number(r?.rate)).toBe(8);
  });

  it('returns the open-ended (validTo=null) rate for a date far in the future', async () => {
    const db = await freshDb();
    await seedTaxRules(db);
    const r = await getEffectiveTaxRate(db, SCOPE, 'SR', '2030-01-01');
    expect(Number(r?.rate)).toBe(9);
  });

  it('returns null when no rule covers the date (before any validFrom)', async () => {
    const db = await freshDb();
    await seedTaxRules(db);
    const r = await getEffectiveTaxRate(db, SCOPE, 'SR', '2020-01-01');
    expect(r).toBeNull();
  });

  it('returns null for a tax code that has no rules at all', async () => {
    const db = await freshDb();
    await seedTaxRules(db);
    const r = await getEffectiveTaxRate(db, SCOPE, 'NOPE', '2024-06-01');
    expect(r).toBeNull();
  });

  it('fails closed when overlapping rules make the effective date ambiguous', async () => {
    const db = await freshDb();
    await db.insert(taxRule).values([
      {
        masterFn: SCOPE.masterFn,
        companyFn: SCOPE.companyFn,
        taxRegime: 'GST',
        taxCode: 'SR',
        rate: '9.000',
        validFrom: '2024-01-01',
        validTo: '2025-01-01',
      },
      {
        masterFn: SCOPE.masterFn,
        companyFn: SCOPE.companyFn,
        taxRegime: 'GST',
        taxCode: 'SR',
        rate: '10.000',
        validFrom: '2024-06-01',
        validTo: null,
      },
    ]);

    expect(await getEffectiveTaxRate(db, SCOPE, 'SR', '2024-07-01')).toBeNull();
  });

  it('keeps identical tax codes isolated by Company scope and regime', async () => {
    const db = await freshDb();
    await db.insert(currency).values({ code: 'TST', name: 'Test currency', symbol: '$' });
    await db.insert(master).values({ masterFn: 'MASTER-A', loginCode: 'MASTER-A', name: 'Master A' });
    await db.insert(company).values([
      {
        companyFn: 'COMPANY-GST', masterFn: 'MASTER-A', name: 'GST Company', country: 'SG',
        currency: 'TST', taxRegime: 'GST',
      },
      {
        companyFn: 'COMPANY-SST', masterFn: 'MASTER-A', name: 'SST Company', country: 'MY',
        currency: 'TST', taxRegime: 'SST',
      },
    ]);
    await db.insert(taxRule).values([
      {
        masterFn: 'MASTER-A', companyFn: 'COMPANY-GST', taxRegime: 'GST', taxCode: 'SR',
        rate: '9.000', taxClassification: 'gst_standard', inputTaxRecoverablePct: '100.0000',
        validFrom: '2024-01-01', validTo: null,
      },
      {
        masterFn: 'MASTER-A', companyFn: 'COMPANY-SST', taxRegime: 'SST', taxCode: 'SR',
        rate: '8.000', taxClassification: 'sst_service', inputTaxRecoverablePct: '0.0000',
        validFrom: '2024-01-01', validTo: null,
      },
    ]);

    await expect(getEffectiveTaxRate(db, { masterFn: 'MASTER-A', companyFn: 'COMPANY-GST' }, 'SR', '2024-06-01'))
      .resolves.toMatchObject({ taxRegime: 'GST', rate: '9.000' });
    await expect(getEffectiveTaxRate(db, { masterFn: 'MASTER-A', companyFn: 'COMPANY-SST' }, 'SR', '2024-06-01'))
      .resolves.toMatchObject({ taxRegime: 'SST', rate: '8.000' });
    await expect(getEffectiveTaxRate(db, { masterFn: 'OTHER-MASTER', companyFn: 'COMPANY-GST' }, 'SR', '2024-06-01'))
      .resolves.toBeNull();
  });
});

describe('addProduct / listProducts', () => {
  it('addProduct returns the generated id and sku; listProducts includes it, tenant-scoped', async () => {
    const db = await freshDb();
    const added = await addProduct(db, SCOPE, 'NEW-SKU', 'New Product');
    expect(added.sku).toBe('NEW-SKU');

    const products = await listProducts(db, SCOPE);
    expect(products.some((p) => p.sku === 'NEW-SKU')).toBe(true);
  });

  it('does not leak products from a different tenant scope', async () => {
    const db = await freshDb();
    await addProduct(db, SCOPE, 'MINE', 'Mine');
    await addProduct(db, { masterFn: 'OTHER-M', companyFn: 'OTHER-C' }, 'THEIRS', 'Theirs');

    const products = await listProducts(db, SCOPE);
    expect(products.some((p) => p.sku === 'MINE')).toBe(true);
    expect(products.some((p) => p.sku === 'THEIRS')).toBe(false);
  });
});
