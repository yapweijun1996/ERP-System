import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { company, companyModule, currency, master, masterModule } from '../data/schema';
import { freshDb } from '../test/helpers';
import { COMMERCIAL_MODULE_KEYS } from './moduleCatalog';
import {
  applyMasterCompanyAllocationDefaultsWithin,
  initializeMasterEntitlementDefaultsWithin,
} from './moduleProvisioning';

describe('trusted platform module provisioning', () => {
  it('initializes a Master and applies its default allocation to a new Company', async () => {
    const db = await freshDb();
    await db.insert(master).values({ masterFn: 'M-NEW', loginCode: 'NEW', name: 'New Master' });
    await db.insert(currency).values({ code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' });
    await db.insert(company).values({
      masterFn: 'M-NEW', companyFn: 'C-NEW', name: 'New Company', country: 'SG',
      currency: 'SGD', taxRegime: 'GST', locale: 'en',
    });

    await initializeMasterEntitlementDefaultsWithin(db, 'M-NEW');
    await applyMasterCompanyAllocationDefaultsWithin(db, 'M-NEW', 'C-NEW');

    const entitlements = await db.select().from(masterModule)
      .where(eq(masterModule.masterFn, 'M-NEW'));
    const allocations = await db.select().from(companyModule).where(and(
      eq(companyModule.masterFn, 'M-NEW'),
      eq(companyModule.companyFn, 'C-NEW'),
    ));
    expect(entitlements).toHaveLength(COMMERCIAL_MODULE_KEYS.length);
    expect(allocations).toHaveLength(COMMERCIAL_MODULE_KEYS.length);
    expect(allocations.find((row) => row.moduleKey === 'sales')?.enabled).toBe(true);
    expect(allocations.find((row) => row.moduleKey === 'expenses_tax')?.enabled).toBe(false);
  });
});
