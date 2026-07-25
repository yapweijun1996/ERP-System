import { Router } from 'express';
import type { DB } from '../../data/db';
import { normalizeUsername, isValidUsername } from '../../auth/identifiers';
import {
  provisionEmployeeAccount,
  resetEmployeeTemporaryPassword,
  revealEmployeeTemporaryPassword,
} from '../../auth/employeeAccountLifecycle';
import {
  EmployeeAccountError,
  offboardEmployeeAccount,
  readEmployeeAccount,
} from '../../modules/hr/employeeAccount';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
} from '../idempotency';
import { withTenantTransaction } from '../../data/tenantTransaction';

export interface HrRouterOptions {
  tokenEncryptionKey?: Buffer;
}

export function createHrRouter(db: DB, options: HrRouterOptions = {}): Router {
  const router = Router();

  function employeeIdParam(value: string): number | null {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function handleError(res: import('express').Response, error: unknown): void {
    if (error instanceof EmployeeAccountError) {
      apiError(res, error.status, error.code, error.message, error.fieldErrors);
      return;
    }
    throw error;
  }

  async function requireHr(
    req: import('express').Request,
    res: import('express').Response,
    permission: string,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (!await hasPermission(db, session, permission)) {
      apiError(res, 403, 'permission_denied', 'You cannot manage employee accounts.');
      return null;
    }
    return session;
  }

  async function runIdempotent(
    req: import('express').Request,
    res: import('express').Response,
    session: NonNullable<Awaited<ReturnType<typeof requireSession>>>,
    operation: string,
    payload: unknown,
    execute: () => Promise<{ status: number; data: unknown }>,
  ) {
    const key = req.header('idempotency-key')?.trim() ?? '';
    if (!key || key.length > 128) {
      apiError(res, 400, 'idempotency_key_required', 'A valid Idempotency-Key is required.');
      return;
    }
    const begun = await beginIdempotentRequest(db, {
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
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
        begun.reason === 'in_progress' ? 409 : 422,
        `idempotency_${begun.reason}`,
        begun.reason === 'in_progress'
          ? 'This request is already in progress.'
          : 'This Idempotency-Key was used for a different request.',
      );
      return;
    }
    const result = await execute();
    const body = { data: result.data, meta: {} };
    await completeIdempotentRequest(db, begun.recordId, result.status, body);
    res.status(result.status).json(body);
  }

  router.get('/employee-accounts/:employeeId', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const employeeId = employeeIdParam(req.params.employeeId);
    if (!employeeId) {
      apiError(res, 400, 'invalid_id', 'employeeId must be a positive integer.');
      return;
    }
    try {
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      };
      const data = await withTenantTransaction(db, scope, (tx) =>
        readEmployeeAccount(tx, scope, employeeId));
      res.json({ data, meta: {} });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/employee-accounts/:employeeId/actions/create', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    if (!options.tokenEncryptionKey) {
      apiError(res, 503, 'credential_encryption_unavailable', 'Temporary credential encryption is not configured.');
      return;
    }
    const employeeId = employeeIdParam(req.params.employeeId);
    const username = normalizeUsername(typeof req.body?.username === 'string' ? req.body.username : '');
    if (!employeeId || !isValidUsername(username)) {
      apiError(res, 400, 'invalid_request', 'Employee and username are required.', {
        ...(!employeeId ? { employeeId: 'Select a valid employee.' } : {}),
        ...(!isValidUsername(username) ? { username: 'Use 3–64 lowercase letters, digits, dot, dash or underscore.' } : {}),
      });
      return;
    }
    const payload = { employeeId, username };
    try {
      await runIdempotent(req, res, session, 'hr.employee-account.create', payload, async () => {
        const scope = {
          masterFn: session.masterFn,
          companyFn: session.activeCompanyFn,
        };
        const data = await withTenantTransaction(db, scope, (tx) =>
          provisionEmployeeAccount(tx, scope, {
          ...payload,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          }, options.tokenEncryptionKey!));
        return { status: 201, data };
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/employee-accounts/:employeeId/actions/reveal-temporary-password', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    if (!options.tokenEncryptionKey) {
      apiError(res, 503, 'credential_encryption_unavailable', 'Temporary credential encryption is not configured.');
      return;
    }
    const employeeId = employeeIdParam(req.params.employeeId);
    if (!employeeId) {
      apiError(res, 400, 'invalid_id', 'employeeId must be a positive integer.');
      return;
    }
    try {
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      };
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const revealed = await revealEmployeeTemporaryPassword(tx, {
          masterFn: session.masterFn,
          companyFn: session.activeCompanyFn,
        }, employeeId, options.tokenEncryptionKey!);
        await appendAudit(tx, {
          masterFn: session.masterFn,
          companyFn: session.activeCompanyFn,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'employee_account',
          entityId: employeeId,
          action: 'temporary_password_revealed',
          after: {
            userId: revealed.userId,
            purpose: revealed.purpose,
            generation: revealed.generation,
          },
        });
        return revealed;
      });
      res.json({ data, meta: {} });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/employee-accounts/:employeeId/actions/reset-password', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    if (!options.tokenEncryptionKey) {
      apiError(res, 503, 'credential_encryption_unavailable', 'Temporary credential encryption is not configured.');
      return;
    }
    const employeeId = employeeIdParam(req.params.employeeId);
    if (!employeeId) {
      apiError(res, 400, 'invalid_id', 'employeeId must be a positive integer.');
      return;
    }
    try {
      await runIdempotent(req, res, session, 'hr.employee-account.reset', { employeeId }, async () => {
        const scope = {
          masterFn: session.masterFn,
          companyFn: session.activeCompanyFn,
        };
        const data = await withTenantTransaction(db, scope, (tx) =>
          resetEmployeeTemporaryPassword(tx, scope, {
          employeeId,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          }, options.tokenEncryptionKey!));
        return { status: 200, data };
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/employee-accounts/:employeeId/actions/offboard', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const employeeId = employeeIdParam(req.params.employeeId);
    const targetEmployeeId = Number(req.body?.targetEmployeeId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (
      !employeeId
      || !Number.isSafeInteger(targetEmployeeId)
      || targetEmployeeId <= 0
      || reason.length < 3
    ) {
      apiError(res, 400, 'invalid_request', 'Handoff target and reason are required.', {
        ...(!Number.isSafeInteger(targetEmployeeId) || targetEmployeeId <= 0
          ? { targetEmployeeId: 'Select an active employee.' }
          : {}),
        ...(reason.length < 3 ? { reason: 'Enter at least 3 characters.' } : {}),
      });
      return;
    }
    const payload = { employeeId, targetEmployeeId, reason };
    try {
      await runIdempotent(req, res, session, 'hr.employee-account.offboard', payload, async () => {
        const scope = {
          masterFn: session.masterFn,
          companyFn: session.activeCompanyFn,
        };
        const data = await withTenantTransaction(db, scope, (tx) =>
          offboardEmployeeAccount(tx, scope, {
          ...payload,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          }));
        return { status: 200, data };
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
}
