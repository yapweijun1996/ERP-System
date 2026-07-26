import { createHash } from 'node:crypto';
import { Router } from 'express';
import type { DB } from '../../data/db';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  createReimbursementBatchWithin,
  listOpenReimbursementPayablesWithin,
  listReimbursementBatchesWithin,
  ReimbursementBatchError,
  releaseReimbursementBatchWithin,
  replaceReimbursementBatchLinesWithin,
} from '../../modules/expenses/reimbursementBatches';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';
import {
  abandonIdempotentRequest,
  beginIdempotentRequest,
  completeIdempotentRequest,
} from '../idempotency';

function positiveId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function handle(res: import('express').Response, error: unknown): void {
  if (error instanceof ReimbursementBatchError) {
    apiError(res, error.status, error.code, error.message, error.details);
    return;
  }
  throw error;
}

function ids(value: unknown): number[] {
  return Array.isArray(value) ? value.map(Number) : [];
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function createReimbursementBatchesRouter(db: DB): Router {
  const router = Router();

  async function requirePermission(
    req: import('express').Request,
    res: import('express').Response,
    permission: string,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (!await hasPermission(db, session, permission)) {
      apiError(res, 403, 'permission_denied', 'Reimbursement payment permission is required.');
      return null;
    }
    return session;
  }

  async function requireRead(
    req: import('express').Request,
    res: import('express').Response,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    const allowed = await hasPermission(
      db,
      session,
      PERMISSIONS.expensesPaymentBatchPrepare,
    ) || await hasPermission(
      db,
      session,
      PERMISSIONS.expensesPaymentBatchRelease,
    );
    if (!allowed) {
      apiError(res, 403, 'permission_denied', 'Reimbursement payment permission is required.');
      return null;
    }
    return session;
  }

  router.get('/candidates', async (req, res) => {
    const session = await requireRead(req, res);
    if (!session) return;
    const currency = String(req.query.currency ?? '');
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        listOpenReimbursementPayablesWithin(tx, scope, currency));
      res.json({
        data,
        meta: {
          onlyOpenPostedEmployeePayables: true,
          payoutProfiles: 'verified_masked',
          limit: 500,
        },
      });
    } catch (error) {
      handle(res, error);
    }
  });

  router.get('/', async (req, res) => {
    const session = await requireRead(req, res);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        listReimbursementBatchesWithin(tx, scope));
      res.json({
        data,
        meta: {
          sensitiveFields: 'masked',
          releaseSnapshot: 'encrypted',
          limit: 200,
        },
      });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesPaymentBatchPrepare,
    );
    if (!session) return;
    const payload = {
      batchKey: String(req.body?.batchKey ?? ''),
      batchNo: String(req.body?.batchNo ?? ''),
      currency: String(req.body?.currency ?? ''),
      sourceBankAccountId: Number(req.body?.sourceBankAccountId),
      postingIds: ids(req.body?.postingIds),
    };
    const key = req.header('idempotency-key')?.trim() ?? '';
    if (!key || key.length > 128) {
      apiError(res, 428, 'idempotency_key_required', 'A valid Idempotency-Key is required.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const operation = 'expenses.reimbursement-batch.create';
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      operation,
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
        const result = await createReimbursementBatchWithin(
          tx,
          scope,
          session.userId,
          payload,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'reimbursement_payment_batch',
          entityId: result.batch.id,
          action: result.replayed ? 'create_replay' : 'create',
          after: {
            batchNo: result.batch.batchNo,
            currency: result.batch.currency,
            itemCount: result.batch.itemCount,
            totalAmount: result.batch.totalAmount,
            preparedByUserId: result.batch.preparedByUserId,
          },
        });
        return result;
      });
      const response = { data, meta: { makerChecker: true, sensitiveFields: 'masked' } };
      await completeIdempotentRequest(db, begun.recordId, data.replayed ? 200 : 201, response);
      res.status(data.replayed ? 200 : 201).json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  router.put('/:batchId/lines', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesPaymentBatchPrepare,
    );
    if (!session) return;
    const batchId = positiveId(req.params.batchId);
    const expectedVersion = Number(req.body?.expectedVersion);
    const payload = {
      batchId,
      expectedVersion,
      postingIds: ids(req.body?.postingIds),
    };
    if (!batchId || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
      apiError(res, 400, 'reimbursement_batch_invalid', 'Batch and expectedVersion are required.');
      return;
    }
    const key = req.header('idempotency-key')?.trim() ?? '';
    if (!key || key.length > 128) {
      apiError(res, 428, 'idempotency_key_required', 'A valid Idempotency-Key is required.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      'expenses.reimbursement-batch.replace-lines',
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
        const result = await replaceReimbursementBatchLinesWithin(
          tx,
          scope,
          session.userId,
          batchId,
          expectedVersion,
          payload.postingIds,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'reimbursement_payment_batch',
          entityId: batchId,
          action: 'membership_replaced',
          after: {
            version: result.batch.version,
            itemCount: result.batch.itemCount,
            totalAmount: result.batch.totalAmount,
          },
        });
        return result;
      });
      const response = { data, meta: { makerChecker: true, sensitiveFields: 'masked' } };
      await completeIdempotentRequest(db, begun.recordId, 200, response);
      res.json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  router.post('/:batchId/actions/release', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesPaymentBatchRelease,
    );
    if (!session) return;
    const batchId = positiveId(req.params.batchId);
    const expectedVersion = Number(req.body?.expectedVersion);
    const reason = String(req.body?.reason ?? '');
    if (!batchId || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
      apiError(res, 400, 'reimbursement_batch_invalid', 'Batch and expectedVersion are required.');
      return;
    }
    const key = req.header('idempotency-key')?.trim() ?? '';
    if (!key || key.length > 128) {
      apiError(res, 428, 'idempotency_key_required', 'A valid Idempotency-Key is required.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const payload = { batchId, expectedVersion, reason };
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      'expenses.reimbursement-batch.release',
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
        const result = await releaseReimbursementBatchWithin(
          tx,
          scope,
          session.userId,
          batchId,
          expectedVersion,
          reason,
          hashValue,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'reimbursement_payment_batch',
          entityId: batchId,
          action: result.replayed ? 'release_replay' : 'release',
          after: {
            version: result.batch.version,
            status: result.batch.status,
            itemCount: result.batch.itemCount,
            totalAmount: result.batch.totalAmount,
            releaseFactsSha256: result.batch.releaseFactsSha256,
          },
        });
        return result;
      });
      const response = {
        data,
        meta: {
          makerChecker: true,
          membership: 'immutable_after_release',
          sensitiveFields: 'masked',
        },
      };
      await completeIdempotentRequest(db, begun.recordId, 200, response);
      res.json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  return router;
}
