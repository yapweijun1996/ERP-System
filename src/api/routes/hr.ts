import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { normalizeUsername, isValidUsername } from '../../auth/identifiers';
import { hashPassword } from '../../auth/password';
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
import { employee } from '../../data/schema';
import {
  LeaveApplicationError,
  createLeaveDraftWithin,
  decideApprovedLeaveCancellationWithin,
  decideGovernedLeaveWithin,
  readGovernedLeaveWithin,
  voidLeaveApplicationWithin,
} from '../../modules/hr/leaveApplication';
import { LeaveBalanceError } from '../../modules/hr/leaveBalance';
import { LeavePolicyError } from '../../modules/hr/leavePolicy';
import { ApprovalWorkflowError } from '../../modules/approval/workflow';
import {
  StaffOnboardingError,
  activateStaffOnboarding,
  createStaffOnboardingDraft,
  listStaffOnboardingDrafts,
  updateStaffOnboardingDraft,
  type StaffOnboardingDraftInput,
} from '../../modules/hr/staffOnboarding';

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
    if (error instanceof StaffOnboardingError) {
      apiError(res, error.status, error.code, error.message, error.fieldErrors);
      return;
    }
    if (
      error instanceof LeaveApplicationError
      || error instanceof LeaveBalanceError
      || error instanceof LeavePolicyError
      || error instanceof ApprovalWorkflowError
    ) {
      const status = error instanceof LeaveApplicationError
        || error instanceof ApprovalWorkflowError
        ? error.status
        : 422;
      const details = error instanceof LeaveApplicationError
        || error instanceof LeaveBalanceError
        || error instanceof ApprovalWorkflowError
        ? error.details
        : undefined;
      apiError(res, status, error.code, error.message, details);
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

  async function managementActor(
    tx: DB,
    scope: { masterFn: string; companyFn: string },
    userId: number,
  ) {
    const [linked] = await tx.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
      eq(employee.userId, userId),
    )).limit(1);
    return { userId, employeeId: linked?.id ?? null, canManage: true };
  }

  router.get('/staff-onboarding-drafts', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const data = await withTenantTransaction(db, scope, (tx) =>
      listStaffOnboardingDrafts(tx, session));
    res.json({ data, meta: {} });
  });

  router.post('/staff-onboarding-drafts', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    try {
      const data = await createStaffOnboardingDraft(
        db, session, (req.body ?? {}) as StaffOnboardingDraftInput, context(res).requestId,
      );
      res.status(201).json({ data, meta: {} });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.put('/staff-onboarding-drafts/:draftId', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const draftId = employeeIdParam(req.params.draftId);
    const expectedVersion = Number(req.body?.expectedVersion);
    if (!draftId || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
      apiError(res, 400, 'invalid_request', 'draftId and expectedVersion are required.');
      return;
    }
    try {
      const data = await updateStaffOnboardingDraft(
        db,
        session,
        draftId,
        expectedVersion,
        (req.body?.draft ?? {}) as StaffOnboardingDraftInput,
        context(res).requestId,
      );
      res.json({ data, meta: {} });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/staff-onboarding-drafts/:draftId/actions/activate', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const draftId = employeeIdParam(req.params.draftId);
    const expectedVersion = Number(req.body?.expectedVersion);
    const initialPassword = typeof req.body?.initialPassword === 'string'
      ? req.body.initialPassword
      : '';
    if (!draftId || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0
      || (initialPassword.length > 0 && initialPassword.length < 8)) {
      apiError(res, 400, 'invalid_request', 'Draft version and a valid optional initial password are required.', {
        ...(initialPassword.length > 0 && initialPassword.length < 8
          ? { initialPassword: 'Use at least 8 characters.' } : {}),
      });
      return;
    }
    try {
      await runIdempotent(
        req,
        res,
        session,
        'hr.staff-onboarding.activate',
        { draftId, expectedVersion },
        async () => ({
          status: 201,
          data: await activateStaffOnboarding(
            db,
            session,
            draftId,
            expectedVersion,
            initialPassword ? hashPassword(initialPassword) : null,
            context(res).requestId,
          ),
        }),
      );
    } catch (error) {
      handleError(res, error);
    }
  });

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

  router.get('/leave-applications/:requestId', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrRead);
    if (!session) return;
    const requestId = employeeIdParam(req.params.requestId);
    if (!requestId) {
      apiError(res, 400, 'invalid_id', 'requestId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) =>
        readGovernedLeaveWithin(
          tx, scope, await managementActor(tx, scope, session.userId), requestId,
        ));
      res.json({ data, meta: { privacy: 'hr_private' } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/leave-applications', async (req, res) => {
    const session = await requireHr(req, res, PERMISSIONS.hrWrite);
    if (!session) return;
    const payload = {
      employeeId: Number(req.body?.employeeId),
      leaveTypeId: Number(req.body?.leaveTypeId),
      startDate: String(req.body?.startDate ?? ''),
      endDate: String(req.body?.endDate ?? ''),
      unit: String(req.body?.unit ?? ''),
      reason: typeof req.body?.reason === 'string' ? req.body.reason : null,
    };
    if (!Number.isSafeInteger(payload.employeeId) || payload.employeeId <= 0) {
      apiError(res, 400, 'invalid_employee', 'Select a valid employee.');
      return;
    }
    try {
      await runIdempotent(
        req,
        res,
        session,
        'hr.leave.create-on-behalf',
        payload,
        async () => {
          const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
          const data = await withTenantTransaction(db, scope, async (tx) => {
            const result = await createLeaveDraftWithin(
              tx,
              scope,
              await managementActor(tx, scope, session.userId),
              payload.employeeId,
              payload as Parameters<typeof createLeaveDraftWithin>[4],
            );
            await appendAudit(tx, {
              ...scope,
              actorUserId: session.userId,
              requestId: context(res).requestId,
              entity: 'leave_application',
              entityId: result.id,
              action: 'create_on_behalf',
              after: result,
            });
            return result;
          });
          return { status: 201, data };
        },
      );
    } catch (error) {
      handleError(res, error);
    }
  });

  for (const action of ['approve', 'reject', 'void'] as const) {
    router.post(`/leave-applications/:requestId/actions/${action}`, async (req, res) => {
      const session = await requireHr(req, res, PERMISSIONS.hrWrite);
      if (!session) return;
      const requestId = employeeIdParam(req.params.requestId);
      if (!requestId) {
        apiError(res, 400, 'invalid_id', 'requestId must be a positive integer.');
        return;
      }
      const payload = {
        expectedVersion: Number(req.body?.expectedVersion),
        reason: typeof req.body?.reason === 'string' ? req.body.reason : '',
      };
      try {
        await runIdempotent(
          req,
          res,
          session,
          `hr.leave.${action}:${requestId}`,
          payload,
          async () => {
            const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
            const data = await withTenantTransaction(db, scope, async (tx) => {
              const actor = await managementActor(tx, scope, session.userId);
              const result = action === 'void'
                ? await voidLeaveApplicationWithin(
                  tx, scope, actor, requestId, payload.expectedVersion, payload.reason,
                )
                : await decideGovernedLeaveWithin(
                  tx,
                  scope,
                  actor,
                  requestId,
                  payload.expectedVersion,
                  action === 'approve' ? 'approved' : 'rejected',
                  payload.reason,
                );
              await appendAudit(tx, {
                ...scope,
                actorUserId: session.userId,
                requestId: context(res).requestId,
                entity: 'leave_application',
                entityId: requestId,
                action,
                after: result,
              });
              return result;
            });
            return { status: 200, data };
          },
        );
      } catch (error) {
        handleError(res, error);
      }
    });
  }

  for (const action of ['approve', 'reject'] as const) {
    router.post(`/leave-cancellations/:cancellationId/actions/${action}`, async (req, res) => {
      const session = await requireHr(req, res, PERMISSIONS.hrWrite);
      if (!session) return;
      const cancellationId = employeeIdParam(req.params.cancellationId);
      if (!cancellationId) {
        apiError(res, 400, 'invalid_id', 'cancellationId must be a positive integer.');
        return;
      }
      const payload = {
        expectedVersion: Number(req.body?.expectedVersion),
        reason: typeof req.body?.reason === 'string' ? req.body.reason : '',
      };
      try {
        await runIdempotent(
          req,
          res,
          session,
          `hr.leave-cancellation.${action}:${cancellationId}`,
          payload,
          async () => {
            const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
            const data = await withTenantTransaction(db, scope, async (tx) => {
              const result = await decideApprovedLeaveCancellationWithin(
                tx,
                scope,
                await managementActor(tx, scope, session.userId),
                cancellationId,
                payload.expectedVersion,
                action === 'approve' ? 'approved' : 'rejected',
                payload.reason,
              );
              await appendAudit(tx, {
                ...scope,
                actorUserId: session.userId,
                requestId: context(res).requestId,
                entity: 'leave_cancellation',
                entityId: cancellationId,
                action,
                after: result,
              });
              return result;
            });
            return { status: 200, data };
          },
        );
      } catch (error) {
        handleError(res, error);
      }
    });
  }

  return router;
}
