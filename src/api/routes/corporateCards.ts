import { Router } from 'express';
import type { DB } from '../../data/db';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  acceptCorporateCardMatchWithin,
  CorporateCardError,
  CORPORATE_CARD_IMPORT_MAX_BYTES,
  importCorporateCardStatement,
  listCorporateCardQueueWithin,
  rejectCorporateCardMatchWithin,
  resolveCorporateCardFollowUpWithin,
} from '../../modules/expenses/corporateCards';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';

function positiveId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function handle(res: import('express').Response, error: unknown): void {
  if (error instanceof CorporateCardError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  throw error;
}

async function boundedBody(req: import('express').Request): Promise<Uint8Array> {
  const declaredLength = Number(req.header('content-length') ?? 0);
  if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
    throw new CorporateCardError(
      'corporate_card_content_length_invalid',
      'Content-Length is invalid.',
      400,
    );
  }
  if (declaredLength > CORPORATE_CARD_IMPORT_MAX_BYTES) {
    throw new CorporateCardError(
      'corporate_card_file_size_invalid',
      'Card statement files cannot exceed 5 MB.',
      413,
    );
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of req) {
    const bytes = chunk instanceof Uint8Array
      ? new Uint8Array(chunk)
      : new TextEncoder().encode(String(chunk));
    total += bytes.byteLength;
    if (total > CORPORATE_CARD_IMPORT_MAX_BYTES) {
      throw new CorporateCardError(
        'corporate_card_file_size_invalid',
        'Card statement files cannot exceed 5 MB.',
        413,
      );
    }
    chunks.push(bytes);
  }
  const content = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    content.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return content;
}

export function createCorporateCardsRouter(db: DB): Router {
  const router = Router();

  async function requireFinance(
    req: import('express').Request,
    res: import('express').Response,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (!await hasPermission(db, session, PERMISSIONS.expensesCardManage)) {
      apiError(res, 403, 'permission_denied', 'Corporate-card management permission is required.');
      return null;
    }
    return session;
  }

  router.post('/imports', async (req, res) => {
    const session = await requireFinance(req, res);
    if (!session) return;
    const formatHeader = req.header('x-erp-file-format')?.trim().toLowerCase();
    const fileFormat = formatHeader === 'csv' || formatHeader === 'xlsx'
      ? formatHeader
      : null;
    if (!fileFormat) {
      apiError(res, 400, 'corporate_card_format_invalid', 'x-erp-file-format must be csv or xlsx.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const content = await boundedBody(req);
      const data = await importCorporateCardStatement(
        db,
        scope,
        session.userId,
        {
          importKey: req.header('x-erp-import-key') ?? '',
          issuer: req.header('x-erp-card-issuer') ?? '',
          statementRef: req.header('x-erp-statement-ref') ?? '',
          fileName: decodeURIComponent(req.header('x-erp-file-name') ?? ''),
          fileFormat,
          content,
        },
      );
      await withTenantTransaction(db, scope, (tx) => appendAudit(tx, {
        ...scope,
        actorUserId: session.userId,
        requestId: context(res).requestId,
        entity: 'corporate_card_import',
        entityId: data.import.id,
        action: data.replayed ? 'import_replay' : 'import',
        after: {
          rowCount: data.import.rowCount,
          sourceSha256: data.import.sourceSha256,
          suggestions: data.matching?.suggestions,
          followUps: data.matching?.followUps,
        },
      }));
      res.status(data.replayed ? 200 : 201).json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  router.get('/queue', async (req, res) => {
    const session = await requireFinance(req, res);
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        listCorporateCardQueueWithin(tx, scope));
      res.json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/matches/:id/actions/:action', async (req, res) => {
    const session = await requireFinance(req, res);
    if (!session) return;
    const candidateId = positiveId(req.params.id);
    const action = req.params.action;
    if (!candidateId || (action !== 'accept' && action !== 'reject')) {
      apiError(res, 400, 'corporate_card_match_action_invalid', 'A valid match and action are required.');
      return;
    }
    const reason = String(req.body?.reason ?? '');
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const result = action === 'accept'
          ? await acceptCorporateCardMatchWithin(
            tx,
            scope,
            session.userId,
            candidateId,
            reason,
          )
          : await rejectCorporateCardMatchWithin(
            tx,
            scope,
            session.userId,
            candidateId,
            reason,
          );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'corporate_card_match_candidate',
          entityId: candidateId,
          action,
          after: { reason, result },
        });
        return result;
      });
      res.json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/follow-ups/:id/actions/:action', async (req, res) => {
    const session = await requireFinance(req, res);
    if (!session) return;
    const followUpId = positiveId(req.params.id);
    const action = req.params.action;
    if (!followUpId || (action !== 'resolve' && action !== 'waive')) {
      apiError(res, 400, 'corporate_card_follow_up_action_invalid', 'A valid follow-up action is required.');
      return;
    }
    const reason = String(req.body?.reason ?? '');
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const result = await resolveCorporateCardFollowUpWithin(
          tx,
          scope,
          session.userId,
          followUpId,
          action === 'resolve' ? 'resolved' : 'waived',
          reason,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'corporate_card_follow_up',
          entityId: followUpId,
          action,
          after: { reason, status: result.status },
        });
        return result;
      });
      res.json({ data, meta: {} });
    } catch (error) {
      handle(res, error);
    }
  });

  return router;
}
