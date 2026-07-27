// Super-admin per-tenant module gating (EPIC-018). Deliberately its own file, not
// folded into adminLifecycle.ts: same node:crypto-free constraint (bundled into the
// browser demo runtime, web/src/erp-demo-runtime-impl.ts -- see adminLifecycle.ts's
// header comment for why that matters), but a different concern (tenant module
// access, not user/role lifecycle). Same two-tier shape as every other write in this
// repo: a raw-exec `...Within(exec, ...)` core plus a thin self-transacting wrapper.
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { companyModule } from '../data/schema';
import { withTenantTransaction } from '../data/tenantTransaction';
import { appendAudit } from '../api/audit';
import { AuthLifecycleError } from './authErrors';
import type { SessionData } from './session';

/** Matches every gateable id in web/public/assets/data-core.js's DB.nav (i.e. every
 *  sidebar entry except 'home', which -- like 'settings' -- is deliberately always
 *  on; see app.js's routeAllowed()). 'admin' is included but can never be disabled
 *  -- see setMasterModuleWithin. */
export const MODULE_KEYS = [
  'sales', 'purchasing', 'crm', 'inventory', 'warehouse', 'manufacturing', 'quality',
  'finance', 'hr', 'project', 'service', 'asset', 'workflow', 'bi', 'admin', 'integration',
] as const;
export type ModuleKey = typeof MODULE_KEYS[number];
const KNOWN_MODULE_KEYS = new Set<string>(MODULE_KEYS);

/** Only hard technical prerequisites belong here. Commercial packaging remains
 * independent from the authorization boundary. */
export const MODULE_DEPENDENCIES: Readonly<Record<ModuleKey, readonly ModuleKey[]>> = {
  sales: ['finance'],
  purchasing: ['finance'],
  crm: [],
  inventory: [],
  warehouse: ['inventory'],
  manufacturing: ['inventory', 'warehouse'],
  quality: ['inventory'],
  finance: [],
  hr: [],
  project: ['finance'],
  service: ['crm'],
  asset: ['finance'],
  workflow: [],
  bi: [],
  admin: [],
  integration: [],
};

export interface CompanyModuleState {
  moduleKey: string;
  enabled: boolean;
  configured: boolean;
  dependencies: readonly string[];
  blockers: string[];
}

/** Compatibility name retained for existing adapter consumers. */
export type MasterModuleState = CompanyModuleState;

/**
 * Absence of a master_module row for a (masterFn, moduleKey) pair means enabled --
 * only rows disabling a module need to exist, so a brand-new master starts with
 * every module on, matching today's client-side default in app.js's
 * defaultModuleControl().
 */
export async function listCompanyModules(
  exec: DB,
  masterFn: string,
  companyFn: string,
): Promise<CompanyModuleState[]> {
  const rows = await exec.select({
    moduleKey: companyModule.moduleKey,
    enabled: companyModule.enabled,
    configured: companyModule.configured,
  }).from(companyModule).where(and(
    eq(companyModule.masterFn, masterFn),
    eq(companyModule.companyFn, companyFn),
  ));
  const states = new Map(rows.map((row) => [row.moduleKey, row]));
  return MODULE_KEYS.map((moduleKey) => ({
    moduleKey,
    enabled: states.get(moduleKey)?.enabled ?? false,
    configured: states.get(moduleKey)?.configured ?? false,
    dependencies: MODULE_DEPENDENCIES[moduleKey],
    blockers: MODULE_DEPENDENCIES[moduleKey].filter(
      (dependency) => !(states.get(dependency)?.enabled ?? false),
    ),
  }));
}

export const listMasterModules = listCompanyModules;

/** True unless a master_module row explicitly disables this module. Used by
 *  server-side enforcement (routes/resources.ts). Unknown module keys are treated
 *  as enabled (fail open) -- a resource prefix must be explicitly mapped below to
 *  become gateable, so a forgotten mapping entry never blocks legitimate access. */
export async function isModuleEnabled(
  exec: DB,
  masterFn: string,
  companyFn: string,
  moduleKey: string,
): Promise<boolean> {
  if (!KNOWN_MODULE_KEYS.has(moduleKey)) return true;
  const [row] = await exec.select({ enabled: companyModule.enabled })
    .from(companyModule)
    .where(and(
      eq(companyModule.masterFn, masterFn),
      eq(companyModule.companyFn, companyFn),
      eq(companyModule.moduleKey, moduleKey),
    ))
    .limit(1);
  return row?.enabled === true;
}

/** Generic-resource URL prefix (req.params.module in routes/resources.ts) -> the
 *  MODULE_KEYS entry that gates it. Prefixes whose resource name already matches
 *  the module key can rely on the fallback, but keeping active modules explicit
 *  makes this security boundary easy to audit. */
const RESOURCE_PREFIX_TO_MODULE: Partial<Record<string, ModuleKey>> = {
  assets: 'asset',
  crm: 'crm',
  finance: 'finance',
  integration: 'integration',
  inventory: 'inventory',
  manufacturing: 'manufacturing',
  purchasing: 'purchasing',
  quality: 'quality',
  sales: 'sales',
  warehouse: 'warehouse',
};

export function moduleKeyForResourcePrefix(prefix: string): string {
  return RESOURCE_PREFIX_TO_MODULE[prefix] ?? prefix;
}

export async function setMasterModuleWithin(
  exec: DB,
  session: SessionData,
  moduleKey: string,
  enabled: boolean,
  requestId: string,
  now = new Date(),
): Promise<CompanyModuleState> {
  if (!KNOWN_MODULE_KEYS.has(moduleKey)) {
    throw new AuthLifecycleError(400, 'invalid_module_key', 'Unknown module key.');
  }
  if (moduleKey === 'admin' && !enabled) {
    throw new AuthLifecycleError(
      400,
      'admin_module_required',
      'The Admin module cannot be disabled -- doing so would lock every superadmin out of re-enabling it.',
    );
  }
  const states = await listCompanyModules(exec, session.masterFn, session.activeCompanyFn);
  const current = states.find((state) => state.moduleKey === moduleKey)!;
  if (enabled && current.blockers.length) {
    throw new AuthLifecycleError(
      409,
      'module_dependencies_required',
      `Enable required modules first: ${current.blockers.join(', ')}.`,
      { moduleKey: current.blockers.join(',') },
    );
  }
  if (!enabled) {
    const dependents = states.filter((state) =>
      state.enabled && state.dependencies.includes(moduleKey as ModuleKey));
    if (dependents.length) {
      throw new AuthLifecycleError(
        409,
        'module_required_by_enabled_module',
        `Disable dependent modules first: ${dependents.map((state) => state.moduleKey).join(', ')}.`,
        { moduleKey: dependents.map((state) => state.moduleKey).join(',') },
      );
    }
  }
  const [existing] = await exec.select({
    enabled: companyModule.enabled,
    configured: companyModule.configured,
  })
    .from(companyModule)
    .where(and(
      eq(companyModule.masterFn, session.masterFn),
      eq(companyModule.companyFn, session.activeCompanyFn),
      eq(companyModule.moduleKey, moduleKey),
    ))
    .limit(1);
  if (existing) {
    await exec.update(companyModule).set({
      enabled,
      configured: enabled || existing.configured,
      updatedAt: now,
    }).where(and(
      eq(companyModule.masterFn, session.masterFn),
      eq(companyModule.companyFn, session.activeCompanyFn),
      eq(companyModule.moduleKey, moduleKey),
    ));
  } else {
    await exec.insert(companyModule).values({
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
      moduleKey,
      enabled,
      configured: enabled,
    });
  }
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'company_module',
    entityId: moduleKey,
    action: 'set_enabled',
    before: existing ? { enabled: existing.enabled } : null,
    after: { moduleKey, enabled },
  });
  return (await listCompanyModules(exec, session.masterFn, session.activeCompanyFn))
    .find((state) => state.moduleKey === moduleKey)!;
}

export function setMasterModule(
  db: DB,
  session: SessionData,
  moduleKey: string,
  enabled: boolean,
  requestId: string,
) {
  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, (tx) => setMasterModuleWithin(tx, session, moduleKey, enabled, requestId));
}
