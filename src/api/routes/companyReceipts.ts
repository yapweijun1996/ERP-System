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
import {
  CompanyReceiptPackError,
  createCompanyReceiptPackWithin,
  readCompanyReceiptPackWithin,
  renderCompanyReceiptPackWithin,
  type CompanyReceiptPackAction,
} from '../../modules/expenses/companyReceiptPack';
import { DocumentQuarantineError } from '../../modules/documents/processing';
import { DocumentStorageError } from '../../modules/documents/storage';
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

function queryDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value : null;
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

  async function requireReceiptMutationAccess(
    req: import('express').Request,
    res: import('express').Response,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    /* TASK-182 replaces this compatibility mutation permission atomically. */
    if (!await hasPermission(db, session, PERMISSIONS.employeeReceiptsWrite)) {
      apiError(res, 403, 'permission_denied', 'You cannot access Company Receipts.');
      return null;
    }
    return session;
  }

  async function requireReceiptReadAccess(
    req: import('express').Request,
    res: import('express').Response,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (await hasPermission(db, session, PERMISSIONS.expensesCompanyReceiptsReadCompany)) {
      return { session, visibility: 'company' as const };
    }
    if (await hasPermission(db, session, PERMISSIONS.expensesCompanyReceiptsReadOwn)) {
      return { session, visibility: 'own' as const };
    }
    apiError(res, 403, 'permission_denied', 'You cannot read Company Receipts.');
    return null;
  }

  function handleError(res: import('express').Response, error: unknown): void {
    if (error instanceof CompanyReceiptError) {
      apiError(res, error.status, error.code, error.message, error.fieldErrors);
      return;
    }
    if (error instanceof CompanyReceiptPackError) {
      apiError(res, error.status, error.code, error.message);
      return;
    }
    if (error instanceof DocumentQuarantineError) {
      apiError(res, 423, error.code, error.message, {
        action: error.action,
        scanStatus: error.scanStatus,
      });
      return;
    }
    if (error instanceof DocumentStorageError) {
      apiError(res, error.status, error.code, error.message);
      return;
    }
    throw error;
  }

  router.get('/', async (req, res) => {
    const access = await requireReceiptReadAccess(req, res);
    if (!access) return;
    const { session, visibility } = access;
    const limit = req.query.limit == null ? 50 : Number(req.query.limit);
    const afterId = req.query.afterId == null ? null : positiveId(req.query.afterId);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const dateFrom = queryDate(req.query.dateFrom);
    const dateTo = queryDate(req.query.dateTo);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
      || (req.query.afterId != null && afterId == null)
      || search.length > 200
      || (req.query.dateFrom != null && dateFrom == null)
      || (req.query.dateTo != null && dateTo == null)
      || (dateFrom != null && dateTo != null && dateFrom > dateTo)) {
      apiError(
        res,
        400,
        'company_receipt_query_invalid',
        'Use limit 1-100, a positive afterId, search up to 200 characters and a valid inclusive date range.',
      );
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const rows = await withTenantTransaction(db, scope, (tx) =>
        listCompanyReceiptsWithin(tx, scope, session.userId, {
          limit, afterId, visibility, search, dateFrom, dateTo,
        }));
      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit);
      res.json({
        data,
        meta: {
          scope: visibility,
          limit,
          nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
          filters: { search, dateFrom, dateTo },
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/confirmations/:documentVersionId', async (req, res) => {
    const session = await requireReceiptMutationAccess(req, res);
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

  router.post('/packs', async (req, res) => {
    const access = await requireReceiptReadAccess(req, res);
    if (!access) return;
    const { session, visibility } = access;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const result = await withTenantTransaction(db, scope, async (tx) => {
        const created = await createCompanyReceiptPackWithin(
          tx,
          scope,
          session.userId,
          visibility,
          req.body ?? {},
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'company_receipt_pack',
          entityId: created.pack.id,
          action: created.replayed ? 'create_replay' : 'created',
          after: {
            filters: created.pack.filters,
            visibility: created.pack.visibility,
            sourceSha256: created.pack.sourceSha256,
            rowCount: created.pack.rowCount,
            documentCount: created.pack.documentCount,
            totals: created.pack.totals,
          },
        });
        return created;
      });
      res.status(result.replayed ? 200 : 201).json({
        data: result,
        meta: {
          immutableSnapshot: true,
          completeResult: true,
          missingDatesExcluded: true,
          currencyTotalsSeparated: true,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/packs/:packId', async (req, res) => {
    const access = await requireReceiptReadAccess(req, res);
    if (!access) return;
    const packId = positiveId(req.params.packId);
    if (!packId) {
      apiError(res, 400, 'company_receipt_pack_id_invalid', 'packId must be positive.');
      return;
    }
    const { session } = access;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        readCompanyReceiptPackWithin(tx, scope, session.userId, packId));
      res.json({ data, meta: { immutableSnapshot: true, completeResult: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/packs/:packId/pdf', async (req, res) => {
    const access = await requireReceiptReadAccess(req, res);
    if (!access) return;
    const packId = positiveId(req.params.packId);
    const action = String(req.query.action ?? 'view') as CompanyReceiptPackAction;
    if (!packId || !['view', 'download', 'print'].includes(action)) {
      apiError(
        res,
        400,
        'company_receipt_pack_access_invalid',
        'Use a positive packId and action view, download or print.',
      );
      return;
    }
    const { session } = access;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const rendered = await withTenantTransaction(db, scope, async (tx) => {
        const result = await renderCompanyReceiptPackWithin(
          tx,
          scope,
          session.userId,
          packId,
          action,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'company_receipt_pack',
          entityId: packId,
          action: `pdf_${action}`,
          after: {
            sourceSha256: result.pack.sourceSha256,
            artifactSha256: result.sha256,
            rowCount: result.pack.rowCount,
            documentCount: result.pack.documentCount,
          },
        });
        return result;
      });
      const encodedName = encodeURIComponent(rendered.fileName).replaceAll("'", '%27');
      res.set({
        'Content-Type': rendered.mimeType,
        'Content-Length': String(rendered.content.byteLength),
        'Content-Disposition': `${action === 'download' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Receipt-Pack-SHA256': rendered.sha256,
        'X-Receipt-Pack-Source-SHA256': rendered.pack.sourceSha256,
      });
      res.send(Buffer.from(rendered.content));
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/:receiptId', async (req, res) => {
    const access = await requireReceiptReadAccess(req, res);
    if (!access) return;
    const { session, visibility } = access;
    const receiptId = positiveId(req.params.receiptId);
    if (!receiptId) {
      apiError(res, 400, 'company_receipt_id_invalid', 'receiptId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        readCompanyReceiptWithin(tx, scope, session.userId, receiptId, visibility));
      res.json({ data, meta: { scope: visibility } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/', async (req, res) => {
    const session = await requireReceiptMutationAccess(req, res);
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
    const session = await requireReceiptMutationAccess(req, res);
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
    const session = await requireReceiptMutationAccess(req, res);
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
