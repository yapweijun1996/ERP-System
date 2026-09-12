import { Router } from 'express';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import {
  CompanyReceiptError,
  createCompanyReceiptWithin,
  listCompanyReceiptEvidenceWithin,
  listCompanyReceiptsWithin,
  readCompanyReceiptConfirmationWithin,
  readCompanyReceiptWithin,
  updateCompanyReceiptWithin,
  voidCompanyReceiptWithin,
} from '../../modules/expenses/companyReceipt';
import {
  CompanyReceiptPackError,
  createCompanyReceiptPackWithin,
  listCompanyReceiptPacksWithin,
  normalizeCompanyReceiptPackFilters,
  readCompanyReceiptPackWithin,
  renderCompanyReceiptPackWithin,
  selectCompanyReceiptPackWithin,
  type CompanyReceiptPackAction,
} from '../../modules/expenses/companyReceiptPack';
import {
  CompanyReceiptPackGovernanceError,
  executeCompanyReceiptPackPurge,
  initiateCompanyReceiptPackPurgeWithin,
  reviewCompanyReceiptPackPurgeWithin,
  setCompanyReceiptPackLegalHoldWithin,
} from '../../modules/expenses/companyReceiptPackGovernance';
import { DocumentQuarantineError } from '../../modules/documents/processing';
import { DocumentStorageError } from '../../modules/documents/storage';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';
import { SemanticContractError } from '../../modules/agent/semanticContracts';
import {
  readCompanyReceiptSemanticSummaryWithin,
  SemanticReadError,
} from '../../modules/agent/semanticReads';

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
    permission: string,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (!await hasPermission(db, session, permission)) {
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
    if (error instanceof CompanyReceiptPackGovernanceError) {
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
    if (error instanceof SemanticContractError) {
      apiError(res, 400, error.code, error.message);
      return;
    }
    if (error instanceof SemanticReadError) {
      apiError(res, error.status, error.code, error.message);
      return;
    }
    throw error;
  }

  router.get('/semantic-summary', async (req, res) => {
    const access = await requireReceiptReadAccess(req, res);
    if (!access) return;
    const { session } = access;
    const dateFrom = queryDate(req.query.dateFrom);
    const dateTo = queryDate(req.query.dateTo);
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      apiError(
        res,
        400,
        'semantic_query_invalid',
        'Use a valid inclusive dateFrom/dateTo range for semantic receipt facts.',
      );
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        // Recheck live authorization inside the tenant transaction so a
        // permission downgrade cannot leave a stale preflight result feeding
        // the semantic context.
        const visibility = await hasPermission(
          tx, session, PERMISSIONS.expensesCompanyReceiptsReadCompany,
        )
          ? 'company' as const
          : await hasPermission(tx, session, PERMISSIONS.expensesCompanyReceiptsReadOwn)
            ? 'own' as const
            : null;
        if (!visibility) {
          throw new SemanticReadError(
            'semantic_permission_denied',
            'You cannot read Company Receipt semantic facts.',
            403,
          );
        }
        return readCompanyReceiptSemanticSummaryWithin(tx, {
          scope,
          actorUserId: session.userId,
          visibility,
        }, { dateFrom, dateTo });
      });
      res.json({
        data,
        meta: {
          sourceAction: 'receipt.search',
          pageSize: 100,
          maxRows: 5000,
          scope: data.scope.visibility,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

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
      const canCreate = await hasPermission(
        db, session, PERMISSIONS.expensesCompanyReceiptsCreate,
      );
      const canEdit = await hasPermission(
        db, session, PERMISSIONS.expensesCompanyReceiptsEdit,
      );
      const canVoid = await hasPermission(
        db, session, PERMISSIONS.expensesCompanyReceiptsVoid,
      );
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
          actorUserId: session.userId,
          limit,
          nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
          filters: { search, dateFrom, dateTo },
          actions: { create: canCreate, edit: canEdit, void: canVoid },
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/confirmations/:documentVersionId', async (req, res) => {
    const session = await requireReceiptMutationAccess(
      req, res, PERMISSIONS.expensesCompanyReceiptsCreate,
    );
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

  router.get('/evidence', async (req, res) => {
    const session = await requireReceiptMutationAccess(
      req, res, PERMISSIONS.expensesCompanyReceiptsCreate,
    );
    if (!session) return;
    const limit = req.query.limit == null ? 50 : Number(req.query.limit);
    const afterId = req.query.afterId == null ? null : positiveId(req.query.afterId);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
      || (req.query.afterId != null && afterId == null)
      || search.length > 200) {
      apiError(
        res,
        400,
        'company_receipt_evidence_query_invalid',
        'Use limit 1-100, a positive afterId and search up to 200 characters.',
      );
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const rows = await withTenantTransaction(db, scope, (tx) =>
        listCompanyReceiptEvidenceWithin(tx, scope, session.userId, {
          limit, afterId, search,
        }));
      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit);
      res.json({
        data,
        meta: {
          scope: 'uploader',
          employeeIndependent: true,
          eligibleOnly: true,
          limit,
          nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
          filters: { search },
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/packs', async (req, res) => {
    const access = await requireReceiptReadAccess(req, res);
    if (!access) return;
    const limit = req.query.limit == null ? 25 : Number(req.query.limit);
    const afterId = req.query.afterId == null ? null : positiveId(req.query.afterId);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
      || (req.query.afterId != null && afterId == null)) {
      apiError(
        res,
        400,
        'company_receipt_pack_history_query_invalid',
        'Use limit 1-100 and a positive afterId.',
      );
      return;
    }
    const { session, visibility } = access;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const rows = await withTenantTransaction(db, scope, (tx) =>
        listCompanyReceiptPacksWithin(tx, scope, session.userId, visibility, {
          limit, afterId,
        }));
      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit);
      res.json({
        data,
        meta: {
          scope: 'actor',
          accessVisibility: visibility,
          immutableSnapshot: true,
          limit,
          nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/packs/prepare', async (req, res) => {
    const access = await requireReceiptReadAccess(req, res);
    if (!access) return;
    const { session, visibility } = access;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const filters = normalizeCompanyReceiptPackFilters(req.body ?? {});
      const selection = await withTenantTransaction(db, scope, (tx) =>
        selectCompanyReceiptPackWithin(
          tx,
          scope,
          session.userId,
          visibility,
          filters,
        ));
      const body = {
        data: {
          selectionDigest: selection.sourceSha256,
          visibility,
          filters: selection.filters,
          rows: selection.rows,
          totals: selection.totals,
          rowCount: selection.rowCount,
          documentCount: selection.documentCount,
          preparedAt: new Date().toISOString(),
        },
        meta: {
          preparationOnly: true,
          authorizationRequired: true,
          completeResult: true,
        },
      };
      res.json(body);
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

  router.post('/packs/:packId/actions/legal-hold', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.documentsGovernanceManage)) {
      apiError(res, 403, 'permission_denied', 'Receipt Pack governance permission is required.');
      return;
    }
    const packId = positiveId(req.params.packId);
    if (!packId || typeof req.body?.expectedVersion !== 'number'
      || typeof req.body?.legalHold !== 'boolean') {
      apiError(
        res,
        400,
        'company_receipt_pack_governance_payload_invalid',
        'packId, expectedVersion and legalHold are required.',
      );
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const changed = await setCompanyReceiptPackLegalHoldWithin(
          tx,
          scope,
          session.userId,
          packId,
          req.body.expectedVersion,
          req.body.legalHold,
          req.body.reason,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'company_receipt_pack',
          entityId: packId,
          action: req.body.legalHold ? 'legal_hold_set' : 'legal_hold_released',
          after: changed,
        });
        return changed;
      });
      res.json({ data, meta: { governed: true, appendOnly: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/packs/:packId/actions/initiate-purge', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.documentsRecordsManage)) {
      apiError(res, 403, 'permission_denied', 'Records-manager permission is required.');
      return;
    }
    const packId = positiveId(req.params.packId);
    if (!packId) {
      apiError(res, 400, 'company_receipt_pack_id_invalid', 'packId must be positive.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const request = await initiateCompanyReceiptPackPurgeWithin(
          tx, scope, session.userId, packId, req.body?.reason,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'company_receipt_pack',
          entityId: packId,
          action: 'purge_requested',
          after: request,
        });
        return request;
      });
      res.status(201).json({ data, meta: { governed: true, twoPersonReview: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/packs/purge-requests/:requestId/actions/review', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.documentsFinanceReview)) {
      apiError(res, 403, 'permission_denied', 'Finance review permission is required.');
      return;
    }
    const requestId = positiveId(req.params.requestId);
    if (!requestId || typeof req.body?.expectedVersion !== 'number'
      || !['approve', 'reject'].includes(String(req.body?.decision))) {
      apiError(
        res,
        400,
        'company_receipt_pack_purge_review_invalid',
        'requestId, expectedVersion and approve/reject decision are required.',
      );
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const reviewed = await reviewCompanyReceiptPackPurgeWithin(
          tx,
          scope,
          session.userId,
          requestId,
          req.body.expectedVersion,
          req.body.decision,
          req.body.reason,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'company_receipt_pack_purge_request',
          entityId: requestId,
          action: req.body.decision === 'approve' ? 'purge_approved' : 'purge_rejected',
          after: reviewed,
        });
        return reviewed;
      });
      res.json({ data, meta: { governed: true, twoPersonReview: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/packs/:packId/actions/execute-purge', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.documentsRecordsManage)) {
      apiError(res, 403, 'permission_denied', 'Records-manager permission is required.');
      return;
    }
    const packId = positiveId(req.params.packId);
    const requestId = positiveId(req.body?.requestId);
    if (!packId || !requestId || typeof req.body?.expectedVersion !== 'number') {
      apiError(
        res,
        400,
        'company_receipt_pack_purge_execution_invalid',
        'packId, requestId and expectedVersion are required.',
      );
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await executeCompanyReceiptPackPurge(
        db,
        scope,
        session.userId,
        packId,
        requestId,
        req.body.expectedVersion,
      );
      await withTenantTransaction(db, scope, (tx) => appendAudit(tx, {
        ...scope,
        actorUserId: session.userId,
        requestId: context(res).requestId,
        entity: 'company_receipt_pack',
        entityId: packId,
        action: 'purge_executed',
        after: data,
      }));
      res.json({ data, meta: { governed: true, tombstone: true } });
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
    const { session, visibility } = access;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        readCompanyReceiptPackWithin(tx, scope, session.userId, visibility, packId));
      res.json({
        data,
        meta: {
          immutableSnapshot: true,
          completeResult: true,
          accessVisibility: visibility,
        },
      });
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
    const { session, visibility } = access;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const rendered = await withTenantTransaction(db, scope, async (tx) => {
        const result = await renderCompanyReceiptPackWithin(
          tx,
          scope,
          session.userId,
          visibility,
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
            accessPurpose: result.accessPurpose,
            snapshotVisibility: result.pack.visibility,
            currentVisibility: visibility,
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
        'X-Receipt-Pack-Access-Purpose': rendered.accessPurpose,
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
    const session = await requireReceiptMutationAccess(
      req, res, PERMISSIONS.expensesCompanyReceiptsCreate,
    );
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
    const session = await requireReceiptMutationAccess(
      req, res, PERMISSIONS.expensesCompanyReceiptsEdit,
    );
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
    const session = await requireReceiptMutationAccess(
      req, res, PERMISSIONS.expensesCompanyReceiptsVoid,
    );
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
