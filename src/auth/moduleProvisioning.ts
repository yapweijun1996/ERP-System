import { eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { companyModule, masterModule } from '../data/schema';
import {
  COMMERCIAL_MODULE_CATALOG,
  type CommercialModuleKey,
  commercialModuleDefinition,
  isCommercialModuleKey,
} from './moduleCatalog';

export class ModuleProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModuleProvisioningError';
  }
}

export function defaultMasterModuleConfiguration(): Map<CommercialModuleKey, {
  enabled: boolean;
  defaultCompanyAllocated: boolean;
}> {
  return new Map(COMMERCIAL_MODULE_CATALOG.map((definition) => [definition.key, {
    // The catalogue represents modules the platform can allocate. A Company
    // allocation, rather than a purchase flag, controls the first-run default.
    enabled: true,
    defaultCompanyAllocated: definition.defaultCompanyAllocated,
  }]));
}

export function normalizeCompanyModuleSelection(
  moduleKeys: readonly string[],
): CommercialModuleKey[] {
  const selected = new Set<CommercialModuleKey>();
  for (const moduleKey of moduleKeys) {
    if (typeof moduleKey !== 'string' || !isCommercialModuleKey(moduleKey) || selected.has(moduleKey)) {
      throw new ModuleProvisioningError('Each selected module must be a unique commercial module.');
    }
    selected.add(moduleKey);
  }
  for (const moduleKey of selected) {
    const definition = commercialModuleDefinition(moduleKey);
    if (!definition) continue;
    for (const dependency of definition.dependencies) {
      if (!selected.has(dependency)) {
        throw new ModuleProvisioningError(`${definition.name} requires selected module ${dependency}.`);
      }
    }
  }
  return COMMERCIAL_MODULE_CATALOG
    .filter((definition) => selected.has(definition.key))
    .map((definition) => definition.key);
}

/**
 * Trusted bootstrap policy for a newly created Master. This module intentionally has
 * no platform-session dependency so the same provisioning contract can run in PGlite.
 */
export async function initializeMasterEntitlementDefaultsWithin(
  exec: DB,
  masterFn: string,
): Promise<void> {
  const defaults = defaultMasterModuleConfiguration();
  await exec.insert(masterModule).values(COMMERCIAL_MODULE_CATALOG.map((definition) => ({
    masterFn,
    moduleKey: definition.key,
    ...defaults.get(definition.key)!,
  }))).onConflictDoNothing();
}

/**
 * Apply platform-selected Company allocation during trusted Company creation.
 * An explicit selection is permitted only in an initial Platform bootstrap;
 * normal later Company creation inherits the Master default allocation.
 */
export async function applyMasterCompanyAllocationDefaultsWithin(
  exec: DB,
  masterFn: string,
  companyFn: string,
  selectedModuleKeys?: readonly string[],
): Promise<void> {
  await initializeMasterEntitlementDefaultsWithin(exec, masterFn);
  const defaults = await exec.select({
    moduleKey: masterModule.moduleKey,
    allocated: masterModule.defaultCompanyAllocated,
    enabled: masterModule.enabled,
  }).from(masterModule).where(eq(masterModule.masterFn, masterFn));
  const selected = selectedModuleKeys === undefined
    ? defaults.filter((row) => row.allocated && isCommercialModuleKey(row.moduleKey)).map((row) => row.moduleKey)
    : normalizeCompanyModuleSelection(selectedModuleKeys);
  const selectedSet = new Set(selected);
  for (const moduleKey of selected) {
    const entitlement = defaults.find((row) => row.moduleKey === moduleKey);
    if (entitlement?.enabled !== true) {
      throw new ModuleProvisioningError(`Selected module ${moduleKey} is not enabled for this Master.`);
    }
  }
  const allocations = defaults
    .filter((row) => isCommercialModuleKey(row.moduleKey))
    .map((row) => ({
      masterFn,
      companyFn,
      moduleKey: row.moduleKey,
      enabled: selectedSet.has(row.moduleKey),
      configured: selectedSet.has(row.moduleKey),
    }));
  if (allocations.length > 0) {
    await exec.insert(companyModule).values(allocations).onConflictDoNothing();
  }
}
