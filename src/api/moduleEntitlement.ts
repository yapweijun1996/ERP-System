import type { RequestHandler } from 'express';
import type { DB } from '../data/db';
import type { CommercialModuleKey } from '../auth/moduleCatalog';
import { isModuleEnabled } from '../auth/moduleAccess';
import { apiError, requireSession } from './http';

const BESPOKE_API_MODULES: readonly [prefix: string, moduleKey: CommercialModuleKey][] = [
  ['/api/company-receipts', 'expenses_tax'],
  ['/api/integration', 'integration'],
  ['/api/hr', 'hr'],
  ['/api/finance', 'finance'],
  ['/api/reporting', 'bi'],
  ['/api/my/leave-requests', 'hr'],
  ['/api/my/approvals', 'hr'],
  ['/api/my/approval-delegations', 'hr'],
  ['/api/my/approval-delegation-candidates', 'hr'],
  ['/api/my/team', 'hr'],
];

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function moduleKeyForBespokeApiPath(path: string): CommercialModuleKey | null {
  return BESPOKE_API_MODULES.find(([prefix]) => matchesPrefix(path, prefix))?.[1] ?? null;
}

/**
 * Fail closed before a bespoke business router can evaluate permission, scope,
 * or workflow authority. Generic resource routes retain their own equivalent
 * gate because their module key comes from an allowlisted resource definition.
 */
export function createTenantModuleEntitlementGate(db: DB): RequestHandler {
  return async (req, res, next) => {
    const moduleKey = moduleKeyForBespokeApiPath(req.path);
    if (!moduleKey) {
      next();
      return;
    }
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await isModuleEnabled(
      db,
      session.masterFn,
      session.activeCompanyFn,
      moduleKey,
    )) {
      apiError(
        res,
        403,
        'module_not_enabled',
        `The ${moduleKey} module is not enabled for this organization.`,
      );
      return;
    }
    next();
  };
}
