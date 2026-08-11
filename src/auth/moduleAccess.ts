import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { companyModule, masterModule } from '../data/schema';
import {
  COMMERCIAL_MODULE_CATALOG,
  type CommercialModuleKey,
  isCommercialModuleKey,
} from './moduleCatalog';

/**
 * Tenant-facing module projection after the EPIC-064 authority cutover.
 *
 * Tenants may consume only the effective decision. Master entitlement and
 * Company allocation remain platform-owned facts and are never returned by
 * this service.
 */
export const MODULE_KEYS = COMMERCIAL_MODULE_CATALOG.map(
  (definition) => definition.key,
) as readonly CommercialModuleKey[];
export type ModuleKey = CommercialModuleKey;

export const MODULE_DEPENDENCIES: Readonly<Record<ModuleKey, readonly ModuleKey[]>> =
  Object.freeze(Object.fromEntries(COMMERCIAL_MODULE_CATALOG.map((definition) => [
    definition.key,
    definition.dependencies,
  ])) as unknown as Record<ModuleKey, readonly ModuleKey[]>);

export interface CompanyModuleState {
  moduleKey: ModuleKey;
  enabled: boolean;
  configured: boolean;
  dependencies: readonly ModuleKey[];
  blockers: ModuleKey[];
}

/** Compatibility type/name retained for session and Demo adapter consumers. */
export type MasterModuleState = CompanyModuleState;

export async function listCompanyModules(
  exec: DB,
  masterFn: string,
  companyFn: string,
): Promise<CompanyModuleState[]> {
  const [entitlements, allocations] = await Promise.all([
    exec.select({
      moduleKey: masterModule.moduleKey,
      enabled: masterModule.enabled,
    }).from(masterModule).where(eq(masterModule.masterFn, masterFn)),
    exec.select({
      moduleKey: companyModule.moduleKey,
      enabled: companyModule.enabled,
      configured: companyModule.configured,
    }).from(companyModule).where(and(
      eq(companyModule.masterFn, masterFn),
      eq(companyModule.companyFn, companyFn),
    )),
  ]);
  const masterByKey = new Map(entitlements.map((row) => [row.moduleKey, row]));
  const companyByKey = new Map(allocations.map((row) => [row.moduleKey, row]));
  const effective = new Map<ModuleKey, boolean>(MODULE_KEYS.map((moduleKey) => [
    moduleKey,
    masterByKey.get(moduleKey)?.enabled === true
      && companyByKey.get(moduleKey)?.enabled === true,
  ]));

  return MODULE_KEYS.map((moduleKey) => ({
    moduleKey,
    enabled: effective.get(moduleKey) === true,
    configured: effective.get(moduleKey) === true
      && companyByKey.get(moduleKey)?.configured === true,
    dependencies: MODULE_DEPENDENCIES[moduleKey],
    blockers: MODULE_DEPENDENCIES[moduleKey].filter(
      (dependency) => effective.get(dependency) !== true,
    ),
  }));
}

export const listMasterModules = listCompanyModules;

/** Missing, unknown, or partially configured entitlement state fails closed. */
export async function isModuleEnabled(
  exec: DB,
  masterFn: string,
  companyFn: string,
  moduleKey: string,
): Promise<boolean> {
  if (!isCommercialModuleKey(moduleKey)) return false;
  const [entitlement, allocation] = await Promise.all([
    exec.select({ enabled: masterModule.enabled }).from(masterModule).where(and(
      eq(masterModule.masterFn, masterFn),
      eq(masterModule.moduleKey, moduleKey),
    )).limit(1),
    exec.select({ enabled: companyModule.enabled }).from(companyModule).where(and(
      eq(companyModule.masterFn, masterFn),
      eq(companyModule.companyFn, companyFn),
      eq(companyModule.moduleKey, moduleKey),
    )).limit(1),
  ]);
  return entitlement[0]?.enabled === true && allocation[0]?.enabled === true;
}

/**
 * Generic-resource URL prefix -> commercial module. Baseline Account and
 * Notifications resources are deliberately outside the sellable catalog.
 */
const RESOURCE_PREFIX_TO_MODULE: Partial<Record<string, ModuleKey>> = {
  assets: 'asset',
  crm: 'crm',
  finance: 'finance',
  integration: 'integration',
  inventory: 'inventory',
  manufacturing: 'manufacturing',
  payroll: 'payroll',
  project: 'project',
  purchasing: 'purchasing',
  quality: 'quality',
  sales: 'sales',
  service: 'service',
  warehouse: 'warehouse',
};

const UNGATED_RESOURCE_PREFIXES = new Set(['account']);

export function moduleKeyForResourcePrefix(prefix: string): string | null {
  if (UNGATED_RESOURCE_PREFIXES.has(prefix)) return null;
  return RESOURCE_PREFIX_TO_MODULE[prefix] ?? prefix;
}
