import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  customer,
  product,
  salesDiscountRule,
  salesPriceList,
  salesPriceListLine,
} from '../../data/schema';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import {
  activateDiscountRule,
  activatePriceList,
  createDiscountRule,
  createPriceList,
  SalesPricingError,
} from './pricing';

async function fixture(db: DB) {
  const [buyer] = await db.insert(customer).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    code: 'PRICE-CUSTOMER',
    name: 'Fictional Pricing Customer',
  }).returning({ id: customer.id });
  const [item] = await db.insert(product).values({
    masterFn: SCOPE.masterFn,
    companyFn: SCOPE.companyFn,
    sku: 'PRICE-ITEM',
    name: 'Fictional Pricing Item',
    standardCost: '6',
  }).returning({ id: product.id });
  return { buyer, item };
}

describe('sales pricing controls', () => {
  it('creates a customer price list with floor-safe tiers and activates once', async () => {
    const db = await freshDb();
    const { buyer, item } = await fixture(db);
    const draft = await createPriceList(db, SCOPE, {
      code: 'PL-CUSTOMER',
      name: 'Fictional Customer Contract',
      basis: 'customer',
      customerId: buyer.id,
      currency: 'SGD',
      effectiveFrom: '2026-07-19',
      isDefault: true,
      lines: [{ productId: item.id, minQty: '10', unitPrice: '9.50', floorPrice: '8.00' }],
    });
    expect(draft).toMatchObject({
      status: 'draft', version: 1, customerId: buyer.id, isDefault: true,
    });
    expect(await db.select().from(salesPriceListLine)
      .where(eq(salesPriceListLine.priceListId, draft.id)))
      .toMatchObject([{ minQty: '10.0000', unitPrice: '9.5000', floorPrice: '8.0000' }]);
    await expect(activatePriceList(db, SCOPE, draft.id))
      .resolves.toMatchObject({ status: 'active', version: 2 });
    await expect(activatePriceList(db, SCOPE, draft.id)).rejects.toThrow(SalesPricingError);
    const replacement = await createPriceList(db, SCOPE, {
      code: 'PL-REPLACEMENT',
      name: 'Replacement default',
      basis: 'standard',
      currency: 'SGD',
      effectiveFrom: '2026-08-01',
      isDefault: true,
      lines: [{ productId: item.id, unitPrice: '10', floorPrice: '8' }],
    });
    expect(replacement.isDefault).toBe(true);
    expect(await db.select({ id: salesPriceList.id }).from(salesPriceList)
      .where(eq(salesPriceList.isDefault, true))).toHaveLength(1);
  });

  it('rejects a price below its protected floor without partial rows', async () => {
    const db = await freshDb();
    const { item } = await fixture(db);
    await expect(createPriceList(db, SCOPE, {
      code: 'PL-BELOW-FLOOR',
      name: 'Invalid floor example',
      basis: 'standard',
      currency: 'SGD',
      effectiveFrom: '2026-07-19',
      lines: [{ productId: item.id, unitPrice: '7', floorPrice: '8' }],
    })).rejects.toThrow('Unit price cannot be below the floor price.');
    expect(await db.select().from(salesPriceList)).toHaveLength(0);
    expect(await db.select().from(salesPriceListLine)).toHaveLength(0);
  });

  it('creates and activates a bounded customer discount rule', async () => {
    const db = await freshDb();
    const { buyer } = await fixture(db);
    const rule = await createDiscountRule(db, SCOPE, {
      code: 'DR-CUSTOMER',
      name: 'Fictional customer discount',
      ruleType: 'customer',
      customerId: buyer.id,
      discountPct: '8',
      approvalThresholdPct: '10',
      minOrderAmount: '1000',
      effectiveFrom: '2026-07-19',
    });
    expect(rule).toMatchObject({
      status: 'draft',
      discountPct: '8.000',
      approvalThresholdPct: '10.000',
    });
    await expect(activateDiscountRule(db, SCOPE, rule.id))
      .resolves.toMatchObject({ status: 'active', version: 2 });
    expect(await db.select().from(salesDiscountRule)).toHaveLength(1);
  });

  it('rejects a zero minimum quantity tier', async () => {
    const db = await freshDb();
    const { item } = await fixture(db);
    await expect(createPriceList(db, SCOPE, {
      code: 'PL-ZERO-MINQTY',
      name: 'Invalid tier example',
      basis: 'standard',
      currency: 'SGD',
      effectiveFrom: '2026-07-19',
      lines: [{ productId: item.id, minQty: '0', unitPrice: '10', floorPrice: '8' }],
    })).rejects.toThrow('Minimum quantity is invalid.');
    expect(await db.select().from(salesPriceList)).toHaveLength(0);
  });
});
