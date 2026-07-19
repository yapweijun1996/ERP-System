// Super-admin per-tenant module gating (EPIC-018). Deliberately its own file, not
// folded into adminLifecycle.ts: same node:crypto-free constraint (bundled into the
// browser demo runtime, web/src/erp-demo-runtime-impl.ts -- see adminLifecycle.ts's
// header comment for why that matters), but a different concern (tenant module
// access, not user/role lifecycle). Same two-tier shape as every other write in this
// repo: a raw-exec `...Within(exec, ...)` core plus a thin self-transacting wrapper.
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { masterModule } from '../data/schema';
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

export interface MasterModuleState {
  moduleKey: string;
  enabled: boolean;
}

/**
 * Absence of a master_module row for a (masterFn, moduleKey) pair means enabled --
 * only rows disabling a module need to exist, so a brand-new master starts with
 * every module on, matching today's client-side default in app.js's
 * defaultModuleControl().
 */
export async function listMasterModules(exec: DB, masterFn: string): Promise<MasterModuleState[]> {
  const rows = await exec.select({
    moduleKey: masterModule.moduleKey,
    enabled: masterModule.enabled,
  }).from(masterModule).where(eq(masterModule.masterFn, masterFn));
  const overrides = new Map(rows.map((r) => [r.moduleKey, r.enabled]));
  return MODULE_KEYS.map((moduleKey) => ({
    moduleKey,
    enabled: overrides.has(moduleKey) ? overrides.get(moduleKey) as boolean : true,
  }));
}

/** True unless a master_module row explicitly disables this module. Used by
 *  server-side enforcement (routes/resources.ts). Unknown module keys are treated
 *  as enabled (fail open) -- a resource prefix must be explicitly mapped below to
 *  become gateable, so a forgotten mapping entry never blocks legitimate access. */
export async function isModuleEnabled(exec: DB, masterFn: string, moduleKey: string): Promise<boolean> {
  if (!KNOWN_MODULE_KEYS.has(moduleKey)) return true;
  const [row] = await exec.select({ enabled: masterModule.enabled })
    .from(masterModule)
    .where(and(eq(masterModule.masterFn, masterFn), eq(masterModule.moduleKey, moduleKey)))
    .limit(1);
  return row ? row.enabled : true;
}

/** Generic-resource URL prefix (req.params.module in routes/resources.ts) -> the
 *  MODULE_KEYS entry that gates it. 'admin'/'hr'/'project'/'service'/'bi'/
 *  'integration' have no generic resources yet (bespoke routes or no schema), so
 *  they're not listed -- nothing to gate there today. */
const RESOURCE_PREFIX_TO_MODULE: Partial<Record<string, ModuleKey>> = {
  assets: 'asset',
  crm: 'crm',
  finance: 'finance',
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
): Promise<MasterModuleState> {
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
  const [existing] = await exec.select({ enabled: masterModule.enabled })
    .from(masterModule)
    .where(and(eq(masterModule.masterFn, session.masterFn), eq(masterModule.moduleKey, moduleKey)))
    .limit(1);
  if (existing) {
    await exec.update(masterModule).set({
      enabled,
      updatedAt: now,
    }).where(and(
      eq(masterModule.masterFn, session.masterFn),
      eq(masterModule.moduleKey, moduleKey),
    ));
  } else {
    await exec.insert(masterModule).values({
      masterFn: session.masterFn,
      moduleKey,
      enabled,
    });
  }
  await appendAudit(exec, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    actorUserId: session.userId,
    requestId,
    entity: 'master_module',
    entityId: moduleKey,
    action: 'set_enabled',
    before: existing ? { enabled: existing.enabled } : null,
    after: { moduleKey, enabled },
  });
  return { moduleKey, enabled };
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
