import { and, asc, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { company, companyModule, master, masterModule } from '../data/schema';
import { appendAudit } from '../api/audit';
import {
  COMMERCIAL_MODULE_CATALOG,
  commercialModuleDefinition,
  isCommercialModuleKey,
} from './moduleCatalog';
import {
  bumpAuthorizationVersionWithin,
  bumpMasterAuthorizationVersionsWithin,
} from './authorizationVersion';
import {
  PLATFORM_PERMISSIONS,
  PlatformAccessError,
  requirePlatformPermission,
  type PlatformSessionData,
} from './platformSupport';

type ModuleFlag = { moduleKey: string; enabled: boolean; defaultCompanyAllocated?: boolean };

export interface PlatformModuleState {
  moduleKey: string;
  name: string;
  dependencies: readonly string[];
  masterEnabled: boolean;
  companyAllocated?: boolean;
  effectiveEnabled?: boolean;
  defaultCompanyAllocated: boolean;
  version: number;
}

function knownModule(moduleKey: string) {
  const definition = commercialModuleDefinition(moduleKey);
  if (!definition) throw new PlatformAccessError(400, 'invalid_module_key', 'Unknown commercial module key.');
  return definition;
}

function expectedVersion(value: unknown): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new PlatformAccessError(400, 'invalid_expected_version', 'expectedVersion must be a non-negative integer.');
  }
  return version;
}

function dependencyConflict(message: string): never {
  throw new PlatformAccessError(409, 'platform_module_dependency_conflict', message);
}

function assertDependencies(
  moduleKey: string,
  nextEnabled: boolean,
  rows: readonly ModuleFlag[],
  flag: 'enabled' | 'defaultCompanyAllocated',
): void {
  const definition = knownModule(moduleKey);
  const enabledByKey = new Map(rows.map((row) => [row.moduleKey, row[flag] === true]));
  if (nextEnabled) {
    const missing = definition.dependencies.filter((dependency) => enabledByKey.get(dependency) !== true);
    if (missing.length > 0) {
      dependencyConflict(`${definition.name} requires enabled dependencies: ${missing.join(', ')}.`);
    }
    return;
  }
  const enabledDependents = COMMERCIAL_MODULE_CATALOG.filter((candidate) =>
    (candidate.dependencies as readonly string[]).includes(definition.key)
      && enabledByKey.get(candidate.key) === true);
  if (enabledDependents.length > 0) {
    dependencyConflict(`${definition.name} is required by enabled modules: ${enabledDependents.map((item) => item.key).join(', ')}.`);
  }
}

async function requireMaster(exec: DB, masterFn: string) {
  const [row] = await exec.select({ masterFn: master.masterFn, name: master.name })
    .from(master).where(eq(master.masterFn, masterFn)).limit(1);
  if (!row) throw new PlatformAccessError(404, 'platform_target_not_found', 'Master or Company was not found.');
  return row;
}

async function requireCompany(exec: DB, masterFn: string, companyFn: string) {
  const [row] = await exec.select({ companyFn: company.companyFn, name: company.name })
    .from(company).where(and(eq(company.masterFn, masterFn), eq(company.companyFn, companyFn))).limit(1);
  if (!row) throw new PlatformAccessError(404, 'platform_target_not_found', 'Master or Company was not found.');
  return row;
}

export async function listPlatformTenants(db: DB, session: PlatformSessionData) {
  requirePlatformPermission(session, PLATFORM_PERMISSIONS.modulesRead);
  const masters = await db.select({ masterFn: master.masterFn, name: master.name })
    .from(master).orderBy(asc(master.name), asc(master.masterFn));
  const companies = await db.select({ masterFn: company.masterFn, companyFn: company.companyFn, name: company.name })
    .from(company).orderBy(asc(company.masterFn), asc(company.name), asc(company.companyFn));
  return masters.map((item) => ({
    ...item,
    companies: companies.filter((candidate) => candidate.masterFn === item.masterFn),
  }));
}

export async function listMasterEntitlements(db: DB, session: PlatformSessionData, masterFn: string) {
  requirePlatformPermission(session, PLATFORM_PERMISSIONS.modulesRead);
  await requireMaster(db, masterFn);
  const rows = await db.select().from(masterModule).where(eq(masterModule.masterFn, masterFn));
  const byKey = new Map(rows.map((row) => [row.moduleKey, row]));
  return COMMERCIAL_MODULE_CATALOG.map((definition) => {
    const row = byKey.get(definition.key);
    return {
      moduleKey: definition.key,
      name: definition.name,
      dependencies: definition.dependencies,
      masterEnabled: row?.enabled === true,
      defaultCompanyAllocated: row?.defaultCompanyAllocated === true,
      version: row?.version ?? 0,
    } satisfies PlatformModuleState;
  });
}

export async function listCompanyAllocations(
  db: DB, session: PlatformSessionData, masterFn: string, companyFn: string,
) {
  requirePlatformPermission(session, PLATFORM_PERMISSIONS.modulesRead);
  await requireCompany(db, masterFn, companyFn);
  const [entitlements, allocations] = await Promise.all([
    listMasterEntitlements(db, session, masterFn),
    db.select().from(companyModule).where(and(
      eq(companyModule.masterFn, masterFn), eq(companyModule.companyFn, companyFn),
    )),
  ]);
  const byKey = new Map(allocations.map((row) => [row.moduleKey, row]));
  return entitlements.map((entitlement) => {
    const allocation = byKey.get(entitlement.moduleKey);
    const companyAllocated = allocation?.enabled === true;
    return {
      ...entitlement,
      companyAllocated,
      effectiveEnabled: entitlement.masterEnabled && companyAllocated,
      version: allocation?.version ?? 0,
    } satisfies PlatformModuleState;
  });
}

export async function setMasterEntitlement(
  db: DB,
  session: PlatformSessionData,
  input: { masterFn: string; moduleKey: string; enabled: boolean; defaultCompanyAllocated: boolean; expectedVersion: unknown },
  requestId: string,
) {
  requirePlatformPermission(session, PLATFORM_PERMISSIONS.modulesManage);
  const definition = knownModule(input.moduleKey);
  const expected = expectedVersion(input.expectedVersion);
  return db.transaction(async (transaction) => {
    const exec = transaction as unknown as DB;
    await requireMaster(exec, input.masterFn);
    const [current] = await exec.select().from(masterModule).where(and(
      eq(masterModule.masterFn, input.masterFn), eq(masterModule.moduleKey, definition.key),
    )).limit(1);
    if ((current?.version ?? 0) !== expected) {
      throw new PlatformAccessError(409, 'platform_entitlement_version_conflict', 'Master entitlement version changed.');
    }
    const after = { enabled: Boolean(input.enabled), defaultCompanyAllocated: Boolean(input.defaultCompanyAllocated) };
    const masterStates = await exec.select({
      moduleKey: masterModule.moduleKey,
      enabled: masterModule.enabled,
      defaultCompanyAllocated: masterModule.defaultCompanyAllocated,
    }).from(masterModule).where(eq(masterModule.masterFn, input.masterFn));
    assertDependencies(definition.key, after.enabled, masterStates, 'enabled');
    assertDependencies(definition.key, after.defaultCompanyAllocated, masterStates, 'defaultCompanyAllocated');
    let nextVersion: number;
    if (current) {
      const updated = await exec.update(masterModule).set({ ...after, version: current.version + 1, updatedAt: new Date() }).where(and(
        eq(masterModule.masterFn, input.masterFn), eq(masterModule.moduleKey, definition.key), eq(masterModule.version, expected),
      )).returning({ version: masterModule.version });
      if (updated.length !== 1) {
        throw new PlatformAccessError(409, 'platform_entitlement_version_conflict', 'Master entitlement version changed.');
      }
      nextVersion = updated[0].version;
    } else {
      const inserted = await exec.insert(masterModule)
        .values({ masterFn: input.masterFn, moduleKey: definition.key, ...after, version: 1 })
        .onConflictDoNothing()
        .returning({ version: masterModule.version });
      if (inserted.length !== 1) {
        throw new PlatformAccessError(409, 'platform_entitlement_version_conflict', 'Master entitlement version changed.');
      }
      nextVersion = inserted[0].version;
    }
    await bumpMasterAuthorizationVersionsWithin(exec, input.masterFn);
    await appendAudit(exec, { masterFn: input.masterFn, platformPrincipalId: session.principalId, requestId,
      entity: 'master_module', entityId: definition.key, action: 'platform_set_entitlement',
      before: current ? { enabled: current.enabled, defaultCompanyAllocated: current.defaultCompanyAllocated, version: current.version } : null,
      after: { moduleKey: definition.key, ...after, version: nextVersion } });
    return (await listMasterEntitlements(exec, session, input.masterFn)).find((item) => item.moduleKey === definition.key)!;
  });
}

export async function setCompanyAllocation(
  db: DB,
  session: PlatformSessionData,
  input: { masterFn: string; companyFn: string; moduleKey: string; allocated: boolean; expectedVersion: unknown },
  requestId: string,
) {
  requirePlatformPermission(session, PLATFORM_PERMISSIONS.modulesManage);
  const definition = knownModule(input.moduleKey);
  const expected = expectedVersion(input.expectedVersion);
  return db.transaction(async (transaction) => {
    const exec = transaction as unknown as DB;
    await requireCompany(exec, input.masterFn, input.companyFn);
    const [current] = await exec.select().from(companyModule).where(and(
      eq(companyModule.masterFn, input.masterFn), eq(companyModule.companyFn, input.companyFn),
      eq(companyModule.moduleKey, definition.key),
    )).limit(1);
    if ((current?.version ?? 0) !== expected) {
      throw new PlatformAccessError(409, 'platform_allocation_version_conflict', 'Company allocation version changed.');
    }
    const allocationStates = await exec.select({
      moduleKey: companyModule.moduleKey,
      enabled: companyModule.enabled,
    }).from(companyModule).where(and(
      eq(companyModule.masterFn, input.masterFn), eq(companyModule.companyFn, input.companyFn),
    ));
    assertDependencies(definition.key, Boolean(input.allocated), allocationStates, 'enabled');
    let nextVersion: number;
    if (current) {
      const updated = await exec.update(companyModule).set({ enabled: Boolean(input.allocated), configured: true,
        version: current.version + 1, updatedAt: new Date() }).where(and(
        eq(companyModule.masterFn, input.masterFn), eq(companyModule.companyFn, input.companyFn),
        eq(companyModule.moduleKey, definition.key), eq(companyModule.version, expected),
      )).returning({ version: companyModule.version });
      if (updated.length !== 1) {
        throw new PlatformAccessError(409, 'platform_allocation_version_conflict', 'Company allocation version changed.');
      }
      nextVersion = updated[0].version;
    } else {
      const inserted = await exec.insert(companyModule).values({ masterFn: input.masterFn, companyFn: input.companyFn,
        moduleKey: definition.key, enabled: Boolean(input.allocated), configured: true, version: 1 })
        .onConflictDoNothing()
        .returning({ version: companyModule.version });
      if (inserted.length !== 1) {
        throw new PlatformAccessError(409, 'platform_allocation_version_conflict', 'Company allocation version changed.');
      }
      nextVersion = inserted[0].version;
    }
    await bumpAuthorizationVersionWithin(exec, { masterFn: input.masterFn, companyFn: input.companyFn });
    await appendAudit(exec, { masterFn: input.masterFn, companyFn: input.companyFn,
      platformPrincipalId: session.principalId, requestId, entity: 'company_module', entityId: definition.key,
      action: 'platform_set_allocation', before: current ? { allocated: current.enabled, version: current.version } : null,
      after: { moduleKey: definition.key, allocated: Boolean(input.allocated), version: nextVersion } });
    return (await listCompanyAllocations(exec, session, input.masterFn, input.companyFn))
      .find((item) => item.moduleKey === definition.key)!;
  });
}

export async function isPlatformModuleEffectivelyEnabled(
  db: DB, masterFn: string, companyFn: string, moduleKey: string,
): Promise<boolean> {
  if (!isCommercialModuleKey(moduleKey)) return false;
  const [entitlement] = await db.select({ enabled: masterModule.enabled }).from(masterModule).where(and(
    eq(masterModule.masterFn, masterFn), eq(masterModule.moduleKey, moduleKey),
  )).limit(1);
  const [allocation] = await db.select({ enabled: companyModule.enabled }).from(companyModule).where(and(
    eq(companyModule.masterFn, masterFn), eq(companyModule.companyFn, companyFn),
    eq(companyModule.moduleKey, moduleKey),
  )).limit(1);
  return entitlement?.enabled === true && allocation?.enabled === true;
}
