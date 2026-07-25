import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import { company } from '../../data/schema';
import {
  ActorScopeError,
  listActorLeaveWithin,
  listTeamLeaveWithin,
  resolveActorEmployeeWithin,
  resolveTeamEmployeeIdsWithin,
} from '../../modules/hr/actorScope';
import { apiError, requireSession } from '../http';

function findClientEmployeeIdentity(
  value: unknown,
  path = '',
  depth = 0,
): string | null {
  if (depth > 8 || value == null || typeof value !== 'object') return null;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key;
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized.endsWith('employeeid')) return nextPath;
    const found = findClientEmployeeIdentity(nested, nextPath, depth + 1);
    if (found) return found;
  }
  return null;
}

export function createMyRouter(db: DB): Router {
  const router = Router();

  router.use((req, res, next) => {
    const supplied = findClientEmployeeIdentity(req.query)
      ?? findClientEmployeeIdentity(req.body);
    if (supplied) {
      apiError(
        res,
        400,
        'actor_identity_is_session_derived',
        'employeeId must not be supplied to a My Work endpoint.',
        { [supplied]: 'Employee identity is derived from the signed-in Session.' },
      );
      return;
    }
    next();
  });

  function handleActorError(res: import('express').Response, error: unknown): void {
    if (error instanceof ActorScopeError) {
      apiError(res, error.status, error.code, error.message);
      return;
    }
    throw error;
  }

  async function requireSelf(
    req: import('express').Request,
    res: import('express').Response,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (!await hasPermission(db, session, PERMISSIONS.employeeSelfRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot access Employee Self Service.');
      return null;
    }
    return session;
  }

  router.get('/context', async (req, res) => {
    const session = await requireSelf(req, res);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const canReadTeam = await hasPermission(db, session, PERMISSIONS.employeeTeamRead);
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const actor = await resolveActorEmployeeWithin(tx, scope, session.userId);
        const [activeCompany] = await tx.select({
          companyFn: company.companyFn,
          name: company.name,
          country: company.country,
          currency: company.currency,
          taxRegime: company.taxRegime,
          locale: company.locale,
        }).from(company).where(and(
          eq(company.masterFn, scope.masterFn),
          eq(company.companyFn, scope.companyFn),
        )).limit(1);
        if (!activeCompany) {
          throw new ActorScopeError(
            'active_company_missing',
            'The active employee company could not be resolved.',
          );
        }
        const teamEmployeeIds = canReadTeam
          ? await resolveTeamEmployeeIdsWithin(tx, scope, actor.id)
          : [];
        return {
          company: activeCompany,
          employee: actor,
          capabilities: {
            leave: { available: true, writable: false },
            claims: { available: false, reason: 'not_modelled' },
            receipts: { available: false, reason: 'not_modelled' },
            team: { available: canReadTeam, employeeCount: teamEmployeeIds.length },
          },
        };
      });
      res.json({ data, meta: { actorDerived: true } });
    } catch (error) {
      handleActorError(res, error);
    }
  });

  router.get('/leave-requests', async (req, res) => {
    const session = await requireSelf(req, res);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const actor = await resolveActorEmployeeWithin(tx, scope, session.userId);
        return listActorLeaveWithin(tx, scope, actor.id);
      });
      res.json({ data, meta: { actorDerived: true, limit: 100 } });
    } catch (error) {
      handleActorError(res, error);
    }
  });

  for (const resource of ['claims', 'receipts'] as const) {
    router.get(`/${resource}`, async (req, res) => {
      const session = await requireSelf(req, res);
      if (!session) return;
      const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
      try {
        await withTenantTransaction(db, scope, (tx) =>
          resolveActorEmployeeWithin(tx, scope, session.userId));
        res.json({
          data: [],
          meta: {
            actorDerived: true,
            availability: 'not_modelled',
            plannedEpic: resource === 'claims' ? 'EPIC-055' : 'EPIC-054',
          },
        });
      } catch (error) {
        handleActorError(res, error);
      }
    });
  }

  router.get('/team/leave-requests', async (req, res) => {
    const session = await requireSelf(req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.employeeTeamRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read team leave.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const actor = await resolveActorEmployeeWithin(tx, scope, session.userId);
        const teamEmployeeIds = await resolveTeamEmployeeIdsWithin(tx, scope, actor.id);
        return listTeamLeaveWithin(tx, scope, teamEmployeeIds);
      });
      res.json({
        data,
        meta: {
          actorDerived: true,
          privacy: 'reason_and_evidence_redacted',
          limit: 100,
        },
      });
    } catch (error) {
      handleActorError(res, error);
    }
  });

  return router;
}
