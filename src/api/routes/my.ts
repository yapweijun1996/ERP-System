import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import { company } from '../../data/schema';
import {
  ActorScopeError,
  listAvailableLeaveTypesWithin,
  listActorLeaveWithin,
  listTeamLeaveWithin,
  resolveActorEmployeeWithin,
  resolveTeamEmployeeIdsWithin,
} from '../../modules/hr/actorScope';
import {
  LeaveApplicationError,
  amendLeaveApplicationWithin,
  createLeaveDraftWithin,
  readGovernedLeaveWithin,
  requestApprovedLeaveCancellationWithin,
  submitLeaveApplicationWithin,
  voidOwnLeaveApplicationWithin,
  withdrawLeaveApplicationWithin,
} from '../../modules/hr/leaveApplication';
import { LeaveBalanceError } from '../../modules/hr/leaveBalance';
import { LeavePolicyError } from '../../modules/hr/leavePolicy';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
} from '../idempotency';

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

  function positiveId(value: string): number | null {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

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
    if (
      error instanceof LeaveApplicationError
      || error instanceof LeaveBalanceError
      || error instanceof LeavePolicyError
    ) {
      const status = error instanceof LeaveApplicationError ? error.status : 422;
      const details = error instanceof LeaveApplicationError || error instanceof LeaveBalanceError
        ? error.details
        : undefined;
      apiError(res, status, error.code, error.message, details);
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

  async function requireLeaveWrite(
    req: import('express').Request,
    res: import('express').Response,
  ) {
    const session = await requireSelf(req, res);
    if (!session) return null;
    if (!await hasPermission(db, session, PERMISSIONS.employeeLeaveWrite)) {
      apiError(res, 403, 'permission_denied', 'You cannot maintain your leave applications.');
      return null;
    }
    return session;
  }

  async function runLeaveCommand(
    req: import('express').Request,
    res: import('express').Response,
    session: NonNullable<Awaited<ReturnType<typeof requireSession>>>,
    operation: string,
    payload: Record<string, unknown>,
    execute: (
      tx: DB,
      scope: { masterFn: string; companyFn: string },
      actor: { userId: number; employeeId: number },
    ) => Promise<unknown>,
    status = 200,
  ) {
    const key = req.header('idempotency-key')?.trim() ?? '';
    if (!key || key.length > 128) {
      apiError(res, 428, 'idempotency_key_required', 'A valid Idempotency-Key is required.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const begun = await beginIdempotentRequest(db, {
      ...scope,
      actorUserId: session.userId,
    }, key, operation, payload);
    if (begun.kind === 'replay') {
      res.setHeader('Idempotency-Replayed', 'true');
      res.status(begun.status).json(begun.body);
      return;
    }
    if (begun.kind === 'conflict') {
      apiError(
        res,
        409,
        begun.reason === 'different_request'
          ? 'idempotency_key_reused'
          : 'idempotency_request_in_progress',
        'This Idempotency-Key cannot be used for this request.',
      );
      return;
    }
    const data = await withTenantTransaction(db, scope, async (tx) => {
      const employeeActor = await resolveActorEmployeeWithin(tx, scope, session.userId);
      const result = await execute(tx, scope, {
        userId: session.userId,
        employeeId: employeeActor.id,
      });
      await appendAudit(tx, {
        ...scope,
        actorUserId: session.userId,
        requestId: context(res).requestId,
        entity: 'my/leave-requests',
        entityId: Number((result as { id?: unknown }).id) || null,
        action: operation,
        after: result,
      });
      return result;
    });
    const body = { data, meta: { actorDerived: true } };
    await completeIdempotentRequest(db, begun.recordId, status, body);
    res.status(status).json(body);
  }

  router.get('/context', async (req, res) => {
    const session = await requireSelf(req, res);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const canReadTeam = await hasPermission(db, session, PERMISSIONS.employeeTeamRead);
      const canWriteLeave = await hasPermission(db, session, PERMISSIONS.employeeLeaveWrite);
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
        const leaveTypes = await listAvailableLeaveTypesWithin(tx, scope);
        return {
          company: activeCompany,
          employee: actor,
          leaveTypes,
          capabilities: {
            leave: { available: true, writable: canWriteLeave },
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

  router.get('/leave-requests/:requestId', async (req, res) => {
    const session = await requireSelf(req, res);
    if (!session) return;
    const requestId = positiveId(req.params.requestId);
    if (!requestId) {
      apiError(res, 400, 'invalid_id', 'requestId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const employeeActor = await resolveActorEmployeeWithin(tx, scope, session.userId);
        return readGovernedLeaveWithin(tx, scope, {
          userId: session.userId,
          employeeId: employeeActor.id,
        }, requestId);
      });
      res.json({ data, meta: { actorDerived: true, privacy: 'owner_private' } });
    } catch (error) {
      handleActorError(res, error);
    }
  });

  router.post('/leave-requests', async (req, res) => {
    const session = await requireLeaveWrite(req, res);
    if (!session) return;
    const payload = {
      leaveTypeId: Number(req.body?.leaveTypeId),
      startDate: String(req.body?.startDate ?? ''),
      endDate: String(req.body?.endDate ?? ''),
      unit: String(req.body?.unit ?? ''),
      reason: typeof req.body?.reason === 'string' ? req.body.reason : null,
    };
    try {
      await runLeaveCommand(
        req,
        res,
        session,
        'create_draft',
        payload,
        (tx, scope, actor) => createLeaveDraftWithin(
          tx,
          scope,
          actor,
          actor.employeeId,
          payload as Parameters<typeof createLeaveDraftWithin>[4],
        ),
        201,
      );
    } catch (error) {
      handleActorError(res, error);
    }
  });

  router.post('/leave-requests/:requestId/actions/amend', async (req, res) => {
    const session = await requireLeaveWrite(req, res);
    if (!session) return;
    const requestId = positiveId(req.params.requestId);
    if (!requestId) {
      apiError(res, 400, 'invalid_id', 'requestId must be a positive integer.');
      return;
    }
    const payload = {
      expectedVersion: Number(req.body?.expectedVersion),
      leaveTypeId: Number(req.body?.leaveTypeId),
      startDate: String(req.body?.startDate ?? ''),
      endDate: String(req.body?.endDate ?? ''),
      unit: String(req.body?.unit ?? ''),
      reason: typeof req.body?.reason === 'string' ? req.body.reason : null,
      changeReason: typeof req.body?.changeReason === 'string' ? req.body.changeReason : null,
    };
    try {
      await runLeaveCommand(req, res, session, `amend:${requestId}`, payload,
        (tx, scope, actor) => amendLeaveApplicationWithin(
          tx,
          scope,
          actor,
          requestId,
          payload.expectedVersion,
          payload as Parameters<typeof amendLeaveApplicationWithin>[5],
        ));
    } catch (error) {
      handleActorError(res, error);
    }
  });

  for (const action of ['submit', 'withdraw', 'void', 'request-cancellation'] as const) {
    router.post(`/leave-requests/:requestId/actions/${action}`, async (req, res) => {
      const session = await requireLeaveWrite(req, res);
      if (!session) return;
      const requestId = positiveId(req.params.requestId);
      if (!requestId) {
        apiError(res, 400, 'invalid_id', 'requestId must be a positive integer.');
        return;
      }
      const payload = {
        expectedVersion: Number(req.body?.expectedVersion),
        reason: typeof req.body?.reason === 'string' ? req.body.reason : '',
      };
      try {
        await runLeaveCommand(req, res, session, `${action}:${requestId}`, payload,
          async (tx, scope, actor) => {
            if (action === 'submit') {
              return submitLeaveApplicationWithin(
                tx, scope, actor, requestId, payload.expectedVersion,
              );
            }
            if (action === 'withdraw') {
              return withdrawLeaveApplicationWithin(
                tx, scope, actor, requestId, payload.expectedVersion, payload.reason,
              );
            }
            if (action === 'void') {
              return voidOwnLeaveApplicationWithin(
                tx, scope, actor, requestId, payload.expectedVersion, payload.reason,
              );
            }
            return requestApprovedLeaveCancellationWithin(
              tx, scope, actor, requestId, payload.expectedVersion, payload.reason,
            );
          });
      } catch (error) {
        handleActorError(res, error);
      }
    });
  }

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
