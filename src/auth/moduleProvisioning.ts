import { eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { companyModule, masterModule } from '../data/schema';
import { COMMERCIAL_MODULE_CATALOG, isCommercialModuleKey } from './moduleCatalog';

function initialMasterModuleEnabled(moduleKey: string): boolean {
  return moduleKey !== 'expenses_tax';
}

/**
 * Trusted bootstrap policy for a newly created Master. This module intentionally has
 * no platform-session dependency so the same provisioning contract can run in PGlite.
 */
export async function initializeMasterEntitlementDefaultsWithin(
  exec: DB,
  masterFn: string,
): Promise<void> {
  await exec.insert(masterModule).values(COMMERCIAL_MODULE_CATALOG.map((definition) => {
    const enabled = initialMasterModuleEnabled(definition.key);
    return {
      masterFn,
      moduleKey: definition.key,
      enabled,
      defaultCompanyAllocated: enabled,
    };
  })).onConflictDoNothing();
}

/** Apply the platform-owned Master defaults during trusted Company creation. */
export async function applyMasterCompanyAllocationDefaultsWithin(
  exec: DB,
  masterFn: string,
  companyFn: string,
): Promise<void> {
  await initializeMasterEntitlementDefaultsWithin(exec, masterFn);
  const defaults = await exec.select({
    moduleKey: masterModule.moduleKey,
    allocated: masterModule.defaultCompanyAllocated,
  }).from(masterModule).where(eq(masterModule.masterFn, masterFn));
  const allocations = defaults
    .filter((row) => isCommercialModuleKey(row.moduleKey))
    .map((row) => ({
      masterFn,
      companyFn,
      moduleKey: row.moduleKey,
      enabled: row.allocated,
      configured: row.allocated,
    }));
  if (allocations.length > 0) {
    await exec.insert(companyModule).values(allocations).onConflictDoNothing();
  }
}
