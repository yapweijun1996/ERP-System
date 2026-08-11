import { Router } from 'express';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import {
  CompanyReceiptError,
  createCompanyReceiptWithin,
  listCompanyReceiptsWithin,
  readCompanyReceiptConfirmationWithin,
  readCompanyReceiptWithin,
  updateCompanyReceiptWithin,
  voidCompanyReceiptWithin,
} from '../../modules/expenses/companyReceipt';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';

function findClientTenantIdentity(
  value: unknown,
  path = '',
  depth = 0,
): string | null {
  if (depth > 8 || value == null || typeof value !== 'object') return null;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key;
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized === 'masterfn' || normalized === 'companyfn') return nextPath;
    const found = findClientTenantIdentity(nested, nextPath, depth + 1);
    if (found) return found;
  }
  return null;
}

function positiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function createCompanyReceiptsRouter(db: DB): Router {
  const router = Router();

  router.use((req, res, next) => {
    const supplied = findClientTenantIdentity(req.query)
      ?? findClientTenantIdentity(req.body);
    if (supplied) {
      apiError(
        res,
        400,
        'tenant_scope_is_session_derived',
        'Master and Company scope must not be supplied to a Company Receipt endpoint.',
        { [supplied]: 'Tenant scope is derived from the signed-in Session.' },
      );
      return;
    }
    next();
  });

  async function requireReceiptAccess(
    req: import('express').Request,
    res: import('express').Response,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    /* TASK-177 intentionally reuses the existing receipt capability. TASK-182
       replaces it atomically with canonical own/company receipt actions. */
    if (!await hasPermission(db, session, PERMISSIONS.employeeReceiptsWrite)) {
      apiError(res, 403, 'permission_denied', 'You cannot access Company Receipts.');
      return null;
    }
    return session;
  }

  function handleError(res: import('express').Response, error: unknown): void {
    if (error instanceof CompanyReceiptError) {
      apiError(res, error.status, error.code, error.message, error.fieldErrors);
      return;
    }
    throw error;
  }

  router.get('/', async (req, res) => {
    const session = await requireReceiptAccess(req, res);
    if (!session) return;
    const limit = req.query.limit == null ? 50 : Number(req.query.limit);
    const afterId = req.query.afterId == null ? null : positiveId(req.query.afterId);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
      || (req.query.afterId != null && afterId == null)) {
      apiError(
        res,
        400,
        'company_receipt_query_invalid',
        'limit must be 1-100 and afterId must be a positive integer.',
      );
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const rows = await withTenantTransaction(db, scope, (tx) =>
        listCompanyReceiptsWithin(tx, scope, session.userId, { limit, afterId }));
      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit);
      res.json({
        data,
        meta: {
          scope: 'uploader',
          limit,
          nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/confirmations/:documentVersionId', async (req, res) => {
    const session = await requireReceiptAccess(req, res);
    if (!session) return;
    const documentVersionId = positiveId(req.params.documentVersionId);
    if (!documentVersionId) {
      apiError(
        res,
        400,
        'company_receipt_document_version_invalid',
        'documentVersionId must be a positive integer.',
      );
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        readCompanyReceiptConfirmationWithin(
          tx,
          scope,
          session.userId,
          documentVersionId,
        ));
      res.json({
        data,
        meta: {
          scope: 'uploader',
          ocrIsSuggestionOnly: true,
          originalPreserved: true,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/:receiptId', async (req, res) => {
    const session = await requireReceiptAccess(req, res);
    if (!session) return;
    const receiptId = positiveId(req.params.receiptId);
    if (!receiptId) {
      apiError(res, 400, 'company_receipt_id_invalid', 'receiptId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        readCompanyReceiptWithin(tx, scope, session.userId, receiptId));
      res.json({ data, meta: { scope: 'uploader' } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/', async (req, res) => {
    const session = await requireReceiptAccess(req, res);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const created = await createCompanyReceiptWithin(
          tx,
          scope,
          session.userId,
          req.body ?? {},
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'company_receipt',
          entityId: created.id,
          action: 'created',
          after: created,
        });
        return created;
      });
      res.status(201).json({ data, meta: { scope: 'uploader', evidenceImmutable: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.patch('/:receiptId', async (req, res) => {
    const session = await requireReceiptAccess(req, res);
    if (!session) return;
    const receiptId = positiveId(req.params.receiptId);
    if (!receiptId) {
      apiError(res, 400, 'company_receipt_id_invalid', 'receiptId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const result = await withTenantTransaction(db, scope, async (tx) => {
        const changed = await updateCompanyReceiptWithin(
          tx,
          scope,
          session.userId,
          receiptId,
          req.body?.expectedVersion,
          req.body ?? {},
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'company_receipt',
          entityId: receiptId,
          action: 'updated',
          before: changed.before,
          after: changed.after,
        });
        return changed.after;
      });
      res.json({ data: result, meta: { scope: 'uploader', evidenceImmutable: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/:receiptId/actions/void', async (req, res) => {
    const session = await requireReceiptAccess(req, res);
    if (!session) return;
    const receiptId = positiveId(req.params.receiptId);
    if (!receiptId) {
      apiError(res, 400, 'company_receipt_id_invalid', 'receiptId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const result = await withTenantTransaction(db, scope, async (tx) => {
        const changed = await voidCompanyReceiptWithin(
          tx,
          scope,
          session.userId,
          receiptId,
          req.body?.expectedVersion,
          req.body?.reason,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'company_receipt',
          entityId: receiptId,
          action: 'voided',
          before: changed.before,
          after: changed.after,
        });
        return changed.after;
      });
      res.json({ data: result, meta: { scope: 'uploader', tombstone: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
}
