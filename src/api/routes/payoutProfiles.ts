import { Router } from 'express';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { decryptToken } from '../../auth/tokenCrypto';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import {
  listMaskedPayoutProfilesWithin,
  PayoutProfileError,
  revealPayoutProfileWithin,
  verifyPayoutProfileWithin,
} from '../../modules/expenses/payoutProfiles';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';
import {
  abandonIdempotentRequest,
  beginIdempotentRequest,
  completeIdempotentRequest,
} from '../idempotency';

export interface PayoutProfilesRouterOptions {
  payoutEncryptionKey?: Buffer;
}

function positiveId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function handle(res: import('express').Response, error: unknown): void {
  if (error instanceof PayoutProfileError) {
    apiError(res, error.status, error.code, error.message, error.details);
    return;
  }
  throw error;
}

export function createPayoutProfilesRouter(
  db: DB,
  options: PayoutProfilesRouterOptions = {},
): Router {
  const router = Router();

  async function requirePermission(
    req: import('express').Request,
    res: import('express').Response,
    permission: string,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (!await hasPermission(db, session, permission)) {
      apiError(res, 403, 'permission_denied', 'Payout profile permission is required.');
      return null;
    }
    return session;
  }

  router.get('/', async (req, res) => {
    const session = await requirePermission(req, res, PERMISSIONS.expensesPayoutVerify);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        listMaskedPayoutProfilesWithin(tx, scope));
      res.json({
        data,
        meta: {
          sensitiveFields: 'masked',
          limit: 200,
        },
      });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/:employeeId/actions/verify', async (req, res) => {
    const session = await requirePermission(req, res, PERMISSIONS.expensesPayoutVerify);
    if (!session) return;
    const employeeId = positiveId(req.params.employeeId);
    const expectedVersion = Number(req.body?.expectedVersion);
    const reason = String(req.body?.reason ?? '');
    if (!employeeId || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
      apiError(
        res,
        400,
        'payout_verification_invalid',
        'Employee and expectedVersion are required.',
      );
      return;
    }
    const key = req.header('idempotency-key')?.trim() ?? '';
    if (!key || key.length > 128) {
      apiError(res, 428, 'idempotency_key_required', 'A valid Idempotency-Key is required.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const payload = { employeeId, expectedVersion, reason };
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      'expenses.payout-profile.verify',
      payload,
    );
    if (begun.kind === 'replay') {
      res.setHeader('Idempotency-Replayed', 'true');
      res.status(begun.status).json(begun.body);
      return;
    }
    if (begun.kind === 'conflict') {
      apiError(res, 409, 'idempotency_key_reused', 'This Idempotency-Key cannot be reused.');
      return;
    }
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const result = await verifyPayoutProfileWithin(
          tx,
          scope,
          session.userId,
          employeeId,
          expectedVersion,
          reason,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'employee_payout_profile',
          entityId: result.profile.id,
          action: result.replayed ? 'verification_replayed' : 'verified',
          after: {
            employeeId,
            profileVersion: result.profile.version,
            verificationStatus: result.profile.verificationStatus,
            reason,
          },
        });
        return result;
      });
      const response = { data, meta: { sensitiveFields: 'masked' } };
      await completeIdempotentRequest(db, begun.recordId, 200, response);
      res.json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  router.post('/:employeeId/actions/reveal', async (req, res) => {
    const session = await requirePermission(req, res, PERMISSIONS.expensesPayoutReveal);
    if (!session) return;
    if (!options.payoutEncryptionKey) {
      apiError(
        res,
        503,
        'payout_encryption_unavailable',
        'Payout profile encryption is not configured.',
      );
      return;
    }
    const employeeId = positiveId(req.params.employeeId);
    if (!employeeId) {
      apiError(res, 400, 'invalid_id', 'employeeId must be a positive integer.');
      return;
    }
    const purpose = String(req.body?.purpose ?? '');
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const result = await revealPayoutProfileWithin(
          tx,
          scope,
          session.userId,
          employeeId,
          purpose,
          (envelope) => decryptToken(envelope, options.payoutEncryptionKey!),
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'employee_payout_profile',
          entityId: result.profile.id,
          action: 'sensitive_details_revealed',
          after: {
            employeeId,
            profileVersion: result.profile.version,
            purpose: result.purpose,
          },
        });
        return result;
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        data,
        meta: {
          sensitiveAccess: 'audited',
        },
      });
    } catch (error) {
      handle(res, error);
    }
  });

  return router;
}
