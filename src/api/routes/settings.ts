import { Router } from 'express';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import {
  ControlPlaneError,
  getSystemSettingsWithin,
  setAccountingPeriodStatusWithin,
  updateCompanyPolicyWithin,
  updateDocumentSequenceWithin,
} from '../../modules/admin/controlPlane';
import { apiError, context, requireSession } from '../http';
import { ActionDispatchError, dispatchAction } from '../actionDispatcher';

export function createSettingsRouter(db: DB): Router {
  const router = Router();
  const fail = (res: import('express').Response, error: unknown) => {
    if (error instanceof ControlPlaneError) { apiError(res, error.code.endsWith('not_found') ? 404 : 422, error.code, error.message); return true; }
    return false;
  };
  router.get('/overview', async (req, res) => {
    const session = await requireSession(db, req, res); if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.settingsRead)) { apiError(res, 403, 'permission_denied', 'You cannot read company settings.'); return; }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    res.json({ data: await withTenantTransaction(db, scope, (tx) => getSystemSettingsWithin(tx, scope)), meta: {} });
  });
  router.post('/policy/:id/actions/update', async (req, res) => {
    const session = await requireSession(db, req, res); if (!session) return;
    try {
      const result = await dispatchAction({ db, session, resource: 'settings/policy', resourceId: 1, action: 'update', payload: req.body ?? {}, idempotencyKey: req.header('idempotency-key'), requestId: context(res).requestId }, {
        permission: PERMISSIONS.settingsManage, idempotency: 'required', audit: 'none',
        execute: (tx, scope, input) => updateCompanyPolicyWithin(tx, scope, { userId: input.actorUserId, requestId: context(res).requestId }, input.payload as unknown as Parameters<typeof updateCompanyPolicyWithin>[3]),
      });
      if (result.replayed) res.setHeader('Idempotency-Replayed', 'true'); res.status(result.status).json(result.body);
    } catch (error) { if (error instanceof ActionDispatchError) apiError(res, error.status, error.code, error.message); else if (!fail(res, error)) throw error; }
  });
  router.post('/sequences/:id/actions/update', async (req, res) => {
    const session = await requireSession(db, req, res); if (!session) return;
    const id = Number(req.params.id); if (!Number.isSafeInteger(id) || id <= 0) { apiError(res, 400, 'invalid_id', 'Sequence id must be positive.'); return; }
    try {
      const result = await dispatchAction({ db, session, resource: 'settings/sequences', resourceId: id, action: 'update', payload: req.body ?? {}, idempotencyKey: req.header('idempotency-key'), requestId: context(res).requestId }, {
        permission: PERMISSIONS.settingsManage, idempotency: 'required', audit: 'none',
        execute: (tx, scope, input) => updateDocumentSequenceWithin(tx, scope, { userId: input.actorUserId, requestId: context(res).requestId }, id, input.payload as unknown as Parameters<typeof updateDocumentSequenceWithin>[4]),
      });
      if (result.replayed) res.setHeader('Idempotency-Replayed', 'true'); res.status(result.status).json(result.body);
    } catch (error) { if (error instanceof ActionDispatchError) apiError(res, error.status, error.code, error.message); else if (!fail(res, error)) throw error; }
  });
  router.post('/periods/:id/actions/set-status', async (req, res) => {
    const session = await requireSession(db, req, res); if (!session) return;
    const id = Number(req.params.id); if (!Number.isSafeInteger(id) || id <= 0) { apiError(res, 400, 'invalid_id', 'Period id must be positive.'); return; }
    try {
      const result = await dispatchAction({ db, session, resource: 'settings/periods', resourceId: id, action: 'set-status', payload: req.body ?? {}, idempotencyKey: req.header('idempotency-key'), requestId: context(res).requestId }, {
        permission: PERMISSIONS.settingsManage, idempotency: 'required', audit: 'none',
        execute: (tx, scope, input) => setAccountingPeriodStatusWithin(tx, scope, { userId: input.actorUserId, requestId: context(res).requestId }, id, String(input.payload.status ?? '')),
      });
      if (result.replayed) res.setHeader('Idempotency-Replayed', 'true'); res.status(result.status).json(result.body);
    } catch (error) { if (error instanceof ActionDispatchError) apiError(res, error.status, error.code, error.message); else if (!fail(res, error)) throw error; }
  });
  return router;
}
