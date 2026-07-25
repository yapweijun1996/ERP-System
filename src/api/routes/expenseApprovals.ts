import { Router } from 'express';
import type { DB } from '../../data/db';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { ApprovalWorkflowError } from '../../modules/approval/workflow';
import {
  decideExpenseLineWithin,
  ExpenseControlError,
  listExpenseApprovalQueueWithin,
  overrideHighRiskDuplicateWithin,
} from '../../modules/expenses/controls';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
} from '../idempotency';

function positiveId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function body(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function handle(res: import('express').Response, error: unknown): void {
  if (error instanceof ExpenseControlError || error instanceof ApprovalWorkflowError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  throw error;
}

export function createExpenseApprovalsRouter(db: DB): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        listExpenseApprovalQueueWithin(tx, scope, session.userId));
      res.json({ data, meta: { actorDerived: true } });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/:id/actions/decide', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const lineApprovalId = positiveId(req.params.id);
    const input = body(req.body);
    const decision = input.decision;
    if (!lineApprovalId || !['approved', 'rejected', 'returned'].includes(String(decision))) {
      apiError(res, 400, 'expense_approval_decision_invalid', 'A valid approval and decision are required.');
      return;
    }
    const payload = {
      lineApprovalId,
      decision: String(decision),
      reason: input.reason == null ? null : String(input.reason),
    };
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
      'expense.line-approval.decide',
      payload,
    );
    if (begun.kind === 'replay') {
      res.setHeader('Idempotency-Replayed', 'true');
      res.status(begun.status).json(begun.body);
      return;
    }
    if (begun.kind === 'conflict') {
      apiError(res, 409, 'idempotency_key_reused', 'This Idempotency-Key cannot be used for this request.');
      return;
    }
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const result = await decideExpenseLineWithin(tx, scope, {
          lineApprovalId,
          actorUserId: session.userId,
          decision: decision as 'approved' | 'rejected' | 'returned',
          reason: payload.reason,
        });
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'expense_line_approval',
          entityId: lineApprovalId,
          action: payload.decision,
          after: {
            status: result.status,
            claimStatus: result.claimStatus,
            reason: payload.reason,
          },
        });
        return result;
      });
      const response = { data, meta: { actorDerived: true } };
      await completeIdempotentRequest(db, begun.recordId, 200, response);
      res.json(response);
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/assessments/:id/actions/override-duplicate', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const assessmentId = positiveId(req.params.id);
    if (!assessmentId) {
      apiError(res, 400, 'invalid_id', 'Assessment id must be a positive integer.');
      return;
    }
    const canOverride = await hasPermission(
      db,
      session,
      PERMISSIONS.expensesDuplicateOverride,
    );
    if (!canOverride) {
      apiError(res, 403, 'permission_denied', 'Finance duplicate-override permission is required.');
      return;
    }
    const reason = String(body(req.body).reason ?? '');
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const result = await overrideHighRiskDuplicateWithin(
          tx,
          scope,
          { userId: session.userId, canOverride },
          assessmentId,
          reason,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'expense_duplicate_override',
          entityId: result.override.id,
          action: result.replayed ? 'override_replay' : 'override',
          after: { assessmentId, reason: result.override.reason },
        });
        return result;
      });
      res.status(data.replayed ? 200 : 201).json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  return router;
}
