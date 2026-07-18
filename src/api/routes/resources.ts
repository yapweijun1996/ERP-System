import { Router } from 'express';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { hasPermission } from '../../auth/permissions';
import {
  InvalidResourceQueryError,
  UnknownResourceError,
  getResource,
  isKnownResource,
  listResource,
  readPermissionForResource,
} from '../resources';
import { apiError, requireSession } from '../http';

export function createResourceRouter(db: DB): Router {
  const router = Router();

  router.get('/:module/:resource', async (req, res) => {
    const resource = `${req.params.module}/${req.params.resource}`;
    if (!isKnownResource(resource)) {
      apiError(res, 404, 'resource_not_found', `Unknown ERP resource '${resource}'.`);
      return;
    }
    try {
      const session = await requireSession(db, req, res);
      if (!session) return;
      if (!await hasPermission(db, session, readPermissionForResource(resource))) {
        apiError(res, 403, 'permission_denied', 'You cannot read this ERP resource.');
        return;
      }
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      };
      res.json(await withTenantTransaction(db, scope, (tx) =>
        listResource(tx, scope, resource, req.query)));
    } catch (error) {
      if (error instanceof InvalidResourceQueryError) {
        apiError(res, 400, 'invalid_query', error.message);
        return;
      }
      if (error instanceof UnknownResourceError) {
        apiError(res, 404, 'resource_not_found', error.message);
        return;
      }
      throw error;
    }
  });

  router.get('/:module/:resource/:id', async (req, res) => {
    const resource = `${req.params.module}/${req.params.resource}`;
    if (!isKnownResource(resource)) {
      apiError(res, 404, 'resource_not_found', `Unknown ERP resource '${resource}'.`);
      return;
    }
    try {
      const session = await requireSession(db, req, res);
      if (!session) return;
      if (!await hasPermission(db, session, readPermissionForResource(resource))) {
        apiError(res, 403, 'permission_denied', 'You cannot read this ERP resource.');
        return;
      }
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      };
      const result = await withTenantTransaction(db, scope, (tx) =>
        getResource(tx, scope, resource, req.params.id));
      if (!result) {
        apiError(res, 404, 'record_not_found', `No ${resource} record exists with id ${req.params.id}.`);
        return;
      }
      res.json(result);
    } catch (error) {
      if (error instanceof InvalidResourceQueryError) {
        apiError(res, 400, 'invalid_id', error.message, { id: error.message });
        return;
      }
      throw error;
    }
  });

  return router;
}
