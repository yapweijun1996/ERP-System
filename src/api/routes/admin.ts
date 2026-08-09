// Bespoke admin routes for app_user/role/role_permission/audit_log. These tables
// are deliberately NOT registered as generic resources (see
// deploy/sql/production-rls.sql's header comment): they sit outside the
// company-scoped RLS policy array by design (security/config infrastructure, not
// business documents), and structurally don't fit ResourceDefinition's
// single-monotonic-id cursor pagination (appUser's PK is userId, role's is roleId,
// role_permission has a composite PK with no id column at all). This mirrors
// routes/auth.ts's existing style exactly: manual hasPermission + manual
// masterFn/companyFn scoping, no ResourceDefinition/actionDispatcher.
import { Router } from 'express';
import type { DB } from '../../data/db';
import {
  listAuditLog, listCompanyUsers, listRolePermissions, listRoleScopes, listRoles,
} from '../admin';
import {
  AuthLifecycleError,
  createInvitation,
  type LifecycleOptions,
} from '../../auth/lifecycle';
import {
  cloneRoleTemplate,
  createRole,
  listRoleTemplates,
  setRolePermission,
  setRoleResourceScope,
  setUserActive,
  setUserRoles,
} from '../../auth/adminLifecycle';
import {
  createRoleAssignment,
  revokeRoleAssignment,
  type RoleAssignmentScopeInput,
} from '../../auth/roleAssignments';
import { listMasterModules, setMasterModule } from '../../auth/moduleAccess';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import { apiError, context, requireSession } from '../http';
import { getMasterControlWithin } from '../../modules/admin/controlPlane';
import { withTenantTransaction } from '../../data/tenantTransaction';

export interface AdminRouterOptions {
  lifecycle?: LifecycleOptions;
}

export function createAdminRouter(db: DB, options: AdminRouterOptions = {}): Router {
  const router = Router();

  function handleLifecycleError(res: import('express').Response, error: unknown): void {
    if (error instanceof AuthLifecycleError) {
      apiError(res, error.status, error.code, error.message, error.fieldErrors);
      return;
    }
    throw error;
  }

  router.get('/users', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.usersRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read users.');
      return;
    }
    const result = await listCompanyUsers(db, session.masterFn, session.activeCompanyFn);
    res.json({ data: result, meta: {} });
  });

  router.get('/master-control', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.masterControlRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read tenant control data.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    res.json({ data: await withTenantTransaction(db, scope, (tx) => getMasterControlWithin(tx, scope)), meta: {} });
  });

  router.post('/users/:userId/actions/toggle-active', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.usersManage)) {
      apiError(res, 403, 'permission_denied', 'You cannot manage users.');
      return;
    }
    const userId = Number(req.params.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      apiError(res, 400, 'invalid_id', 'userId must be a positive integer.');
      return;
    }
    const isActive = (req.body as { isActive?: unknown } | undefined)?.isActive;
    if (typeof isActive !== 'boolean') {
      apiError(res, 400, 'invalid_request', 'isActive must be a boolean.', {
        isActive: 'isActive must be a boolean.',
      });
      return;
    }
    try {
      const result = await setUserActive(
        db, session, userId, isActive, context(res).requestId,
      );
      res.json({ data: result, meta: {} });
    } catch (error) {
      handleLifecycleError(res, error);
    }
  });

  router.post('/users/:userId/actions/set-roles', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.usersManage)) {
      apiError(res, 403, 'permission_denied', 'You cannot manage users.');
      return;
    }
    const userId = Number(req.params.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      apiError(res, 400, 'invalid_id', 'userId must be a positive integer.');
      return;
    }
    const rawRoleIds = (req.body as { roleIds?: unknown } | undefined)?.roleIds;
    if (!Array.isArray(rawRoleIds)) {
      apiError(res, 400, 'invalid_request', 'roleIds must be an array.', {
        roleIds: 'Select at least one role.',
      });
      return;
    }
    try {
      const result = await setUserRoles(
        db,
        session,
        userId,
        rawRoleIds.map((roleId) => Number(roleId)),
        context(res).requestId,
      );
      res.json({ data: result, meta: {} });
    } catch (error) {
      handleLifecycleError(res, error);
    }
  });

  router.post('/users/:userId/role-assignments', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.usersManage)) {
      apiError(res, 403, 'permission_denied', 'You cannot manage role assignments.');
      return;
    }
    const userId = Number(req.params.userId);
    const body = (req.body ?? {}) as {
      roleId?: unknown;
      validFrom?: unknown;
      validUntil?: unknown;
      reason?: unknown;
      scopes?: unknown;
    };
    const roleId = Number(body.roleId);
    if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(roleId) || roleId <= 0) {
      apiError(res, 400, 'invalid_request', 'userId and roleId must be positive integers.');
      return;
    }
    const validFrom = body.validFrom == null ? undefined : new Date(String(body.validFrom));
    const validUntil = body.validUntil == null ? undefined : new Date(String(body.validUntil));
    if ((validFrom && Number.isNaN(validFrom.getTime())) || (validUntil && Number.isNaN(validUntil.getTime()))) {
      apiError(res, 400, 'invalid_request', 'validFrom and validUntil must be valid ISO dates.');
      return;
    }
    try {
      const result = await createRoleAssignment(
        db,
        session,
        {
          userId,
          roleId,
          validFrom,
          validUntil,
          reason: typeof body.reason === 'string' ? body.reason : null,
          scopes: Array.isArray(body.scopes) ? body.scopes as RoleAssignmentScopeInput[] : undefined,
        },
        context(res).requestId,
      );
      res.status(201).json({ data: result, meta: {} });
    } catch (error) {
      handleLifecycleError(res, error);
    }
  });

  router.post('/role-assignments/:assignmentId/actions/revoke', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.usersManage)) {
      apiError(res, 403, 'permission_denied', 'You cannot revoke role assignments.');
      return;
    }
    const assignmentId = Number(req.params.assignmentId);
    const reason = (req.body as { reason?: unknown } | undefined)?.reason;
    if (!Number.isSafeInteger(assignmentId) || assignmentId <= 0 || typeof reason !== 'string') {
      apiError(res, 400, 'invalid_request', 'assignmentId and a revocation reason are required.');
      return;
    }
    try {
      const result = await revokeRoleAssignment(
        db, session, assignmentId, reason, context(res).requestId,
      );
      res.json({ data: result, meta: {} });
    } catch (error) {
      handleLifecycleError(res, error);
    }
  });

  router.post('/invitations', async (req, res) => {
    if (!options.lifecycle) {
      apiError(res, 503, 'auth_lifecycle_unavailable', 'Email account lifecycle is not configured.');
      return;
    }
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.usersInvite)) {
      apiError(res, 403, 'permission_denied', 'You cannot invite users.');
      return;
    }
    const body = (req.body ?? {}) as { email?: unknown; roleId?: unknown };
    if (typeof body.email !== 'string') {
      apiError(res, 400, 'invalid_request', 'Email is required.', { email: 'Email is required.' });
      return;
    }
    const roleId = typeof body.roleId === 'number'
      ? body.roleId
      : Number(typeof body.roleId === 'string' ? body.roleId : Number.NaN);
    try {
      const invitation = await createInvitation(
        db, session, { email: body.email, roleId }, context(res).requestId, options.lifecycle,
      );
      res.status(201).json({ data: invitation, meta: {} });
    } catch (error) {
      handleLifecycleError(res, error);
    }
  });

  router.get('/roles', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.rolesRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read roles.');
      return;
    }
    const result = await listRoles(db, session.masterFn, session.activeCompanyFn);
    res.json({ data: result, meta: {} });
  });

  router.get('/role-templates', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.rolesRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read role templates.');
      return;
    }
    res.json({ data: listRoleTemplates(), meta: { immutable: true } });
  });

  router.get('/role-scopes', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.rolesRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read role scopes.');
      return;
    }
    res.json({
      data: await listRoleScopes(db, session.masterFn, session.activeCompanyFn), meta: {},
    });
  });

  router.post('/roles/actions/clone-template', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.rolesWrite)) {
      apiError(res, 403, 'permission_denied', 'You cannot create roles.');
      return;
    }
    const body = (req.body ?? {}) as { templateKey?: unknown; name?: unknown };
    try {
      const result = await cloneRoleTemplate(
        db,
        session,
        typeof body.templateKey === 'string' ? body.templateKey : '',
        typeof body.name === 'string' ? body.name : undefined,
        context(res).requestId,
      );
      res.status(201).json({ data: result, meta: {} });
    } catch (error) {
      handleLifecycleError(res, error);
    }
  });

  router.get('/role-permissions', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.rolesRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read role permissions.');
      return;
    }
    const result = await listRolePermissions(db, session.masterFn, session.activeCompanyFn);
    res.json({ data: result, meta: {} });
  });

  router.post('/roles', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.rolesWrite)) {
      apiError(res, 403, 'permission_denied', 'You cannot create roles.');
      return;
    }
    const name = (req.body as { name?: unknown } | undefined)?.name;
    try {
      const result = await createRole(
        db, session, typeof name === 'string' ? name : '', context(res).requestId,
      );
      res.status(201).json({ data: result, meta: {} });
    } catch (error) {
      handleLifecycleError(res, error);
    }
  });

  router.post('/roles/:roleId/actions/set-permission', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.rolesWrite)) {
      apiError(res, 403, 'permission_denied', 'You cannot change role permissions.');
      return;
    }
    const roleId = Number(req.params.roleId);
    if (!Number.isSafeInteger(roleId) || roleId <= 0) {
      apiError(res, 400, 'invalid_id', 'roleId must be a positive integer.');
      return;
    }
    const body = (req.body ?? {}) as { permissionKey?: unknown; allowed?: unknown };
    if (typeof body.permissionKey !== 'string' || typeof body.allowed !== 'boolean') {
      apiError(res, 400, 'invalid_request', 'permissionKey (string) and allowed (boolean) are required.');
      return;
    }
    try {
      const result = await setRolePermission(
        db, session, roleId, body.permissionKey, body.allowed, context(res).requestId,
      );
      res.json({ data: result, meta: {} });
    } catch (error) {
      handleLifecycleError(res, error);
    }
  });

  router.post('/roles/:roleId/actions/set-scope', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.rolesWrite)) {
      apiError(res, 403, 'permission_denied', 'You cannot change role data scopes.');
      return;
    }
    const roleId = Number(req.params.roleId);
    const body = (req.body ?? {}) as { resourceKey?: unknown; scope?: unknown };
    if (!Number.isSafeInteger(roleId) || roleId <= 0
      || typeof body.resourceKey !== 'string' || typeof body.scope !== 'string') {
      apiError(res, 400, 'invalid_request', 'roleId, resourceKey and scope are required.');
      return;
    }
    try {
      const result = await setRoleResourceScope(
        db,
        session,
        roleId,
        body.resourceKey,
        body.scope as 'self' | 'team' | 'department' | 'company',
        context(res).requestId,
      );
      res.json({ data: result, meta: {} });
    } catch (error) {
      handleLifecycleError(res, error);
    }
  });

  router.get('/audit-log', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.auditRead)) {
      apiError(res, 403, 'permission_denied', 'You cannot read the audit log.');
      return;
    }
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    const cursor = req.query.cursor != null ? Number(req.query.cursor) : undefined;
    const result = await listAuditLog(db, session.masterFn, session.activeCompanyFn, {
      limit, cursor,
    });
    res.json({ data: result.data, meta: { nextCursor: result.nextCursor } });
  });

  router.get('/modules', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.modulesManage)) {
      apiError(res, 403, 'permission_denied', 'You cannot read module activation state.');
      return;
    }
    const result = await listMasterModules(db, session.masterFn, session.activeCompanyFn);
    res.json({ data: result, meta: {} });
  });

  router.post('/modules/:moduleKey/actions/set-enabled', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.modulesManage)) {
      apiError(res, 403, 'permission_denied', 'You cannot change module activation state.');
      return;
    }
    const { moduleKey } = req.params;
    const enabled = (req.body as { enabled?: unknown } | undefined)?.enabled;
    if (typeof enabled !== 'boolean') {
      apiError(res, 400, 'invalid_request', 'enabled must be a boolean.', {
        enabled: 'enabled must be a boolean.',
      });
      return;
    }
    try {
      const result = await setMasterModule(
        db, session, moduleKey, enabled, context(res).requestId,
      );
      res.json({ data: result, meta: {} });
    } catch (error) {
      handleLifecycleError(res, error);
    }
  });

  return router;
}
