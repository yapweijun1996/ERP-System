import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import {
  documentCorrection,
  documentGovernanceEvent,
  documentPurgeRequest,
  documentTombstone,
  managedDocument,
} from '../../data/schema';
import {
  deleteUnsubmittedDocument,
  DocumentGovernanceError,
  executeDocumentPurge,
  initiateDocumentPurgeWithin,
  reviewDocumentPurgeWithin,
  setDocumentLegalHoldWithin,
  setDocumentPaperCustodyWithin,
  transitionDocumentRecordWithin,
  voidDocumentRecordWithin,
} from '../../modules/documents/governance';
import { DocumentStorageError } from '../../modules/documents/storage';
import { appendAudit } from '../audit';
import { ActionDispatchError, dispatchAction } from '../actionDispatcher';
import { apiError, context, requireSession } from '../http';

function objectBody(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function positiveId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function handleError(res: import('express').Response, error: unknown): void {
  if (error instanceof ActionDispatchError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  if (error instanceof DocumentGovernanceError || error instanceof DocumentStorageError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  throw error;
}

export function createDocumentsRouter(db: DB): Router {
  const router = Router();

  router.get('/:id/governance', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const id = positiveId(req.params.id);
    if (!id) {
      apiError(res, 400, 'invalid_id', 'Document id must be a positive integer.');
      return;
    }
    const canGovern = await hasPermission(
      db, session, PERMISSIONS.documentsGovernanceManage,
    );
    const canReadSelf = await hasPermission(db, session, PERMISSIONS.employeeSelfRead);
    if (!canGovern && !canReadSelf) {
      apiError(res, 403, 'permission_denied', 'You cannot read document governance.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const data = await withTenantTransaction(db, scope, async (tx) => {
      const [document] = await tx.select({
        id: managedDocument.id,
        ownerUserId: managedDocument.ownerUserId,
        originalFileName: managedDocument.originalFileName,
        retentionUntil: managedDocument.retentionUntil,
        legalHold: managedDocument.legalHold,
        recordStatus: managedDocument.recordStatus,
        recordVersion: managedDocument.recordVersion,
        voidReason: managedDocument.voidReason,
        voidedAt: managedDocument.voidedAt,
        taxFinalizedAt: managedDocument.taxFinalizedAt,
        paperCustodyStatus: managedDocument.paperCustodyStatus,
        paperOriginalReference: managedDocument.paperOriginalReference,
      }).from(managedDocument).where(and(
        eq(managedDocument.masterFn, scope.masterFn),
        eq(managedDocument.companyFn, scope.companyFn),
        eq(managedDocument.id, id),
      )).limit(1);
      if (!document || (!canGovern && document.ownerUserId !== session.userId)) {
        throw new DocumentGovernanceError(
          'document_missing',
          'Managed document is unavailable in the active company.',
          404,
        );
      }
      const [events, corrections, purgeRequests] = await Promise.all([
        tx.select().from(documentGovernanceEvent).where(and(
          eq(documentGovernanceEvent.masterFn, scope.masterFn),
          eq(documentGovernanceEvent.companyFn, scope.companyFn),
          eq(documentGovernanceEvent.documentId, id),
        )).orderBy(asc(documentGovernanceEvent.id)),
        tx.select().from(documentCorrection).where(and(
          eq(documentCorrection.masterFn, scope.masterFn),
          eq(documentCorrection.companyFn, scope.companyFn),
          eq(documentCorrection.documentId, id),
        )).orderBy(asc(documentCorrection.id)),
        canGovern
          ? tx.select().from(documentPurgeRequest).where(and(
            eq(documentPurgeRequest.masterFn, scope.masterFn),
            eq(documentPurgeRequest.companyFn, scope.companyFn),
            eq(documentPurgeRequest.documentId, id),
          ))
          : Promise.resolve([]),
      ]);
      return { document, events, corrections, purgeRequests };
    });
    res.json({ data, meta: { actorDerived: true } });
  });

  router.get('/purge-requests/:id/tombstone', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.documentsGovernanceManage)) {
      apiError(res, 403, 'permission_denied', 'You cannot read purge tombstones.');
      return;
    }
    const id = positiveId(req.params.id);
    if (!id) {
      apiError(res, 400, 'invalid_id', 'Purge request id must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const [data] = await withTenantTransaction(db, scope, (tx) =>
      tx.select().from(documentTombstone).where(and(
        eq(documentTombstone.masterFn, scope.masterFn),
        eq(documentTombstone.companyFn, scope.companyFn),
        eq(documentTombstone.purgeRequestId, id),
      )).limit(1));
    if (!data) {
      apiError(res, 404, 'document_tombstone_missing', 'Purge tombstone is unavailable.');
      return;
    }
    res.json({ data, meta: {} });
  });

  router.post('/:id/actions/:action', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const id = positiveId(req.params.id);
    if (!id) {
      apiError(res, 400, 'invalid_id', 'Document id must be a positive integer.');
      return;
    }
    const action = req.params.action;
    const payload = objectBody(req.body);
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      if (action === 'delete-draft') {
        if (!await hasPermission(db, session, PERMISSIONS.employeeReceiptsWrite)) {
          apiError(res, 403, 'permission_denied', 'You cannot delete receipt drafts.');
          return;
        }
        const data = await deleteUnsubmittedDocument(
          db, scope, { userId: session.userId }, id,
        );
        await withTenantTransaction(db, scope, (tx) => appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'documents',
          entityId: id,
          action: 'delete_draft',
          after: data,
        }));
        res.json({ data, meta: {} });
        return;
      }
      if (action === 'execute-purge') {
        if (!await hasPermission(db, session, PERMISSIONS.documentsRecordsManage)) {
          apiError(res, 403, 'permission_denied', 'Records-manager permission is required.');
          return;
        }
        if (typeof payload.requestId !== 'number'
          || typeof payload.expectedVersion !== 'number') {
          apiError(
            res,
            400,
            'invalid_action_payload',
            'Purge request id and expected version are required.',
          );
          return;
        }
        const data = await executeDocumentPurge(
          db,
          scope,
          session.userId,
          id,
          payload.requestId,
          payload.expectedVersion,
        );
        await withTenantTransaction(db, scope, (tx) => appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'documents',
          entityId: id,
          action: 'execute_purge',
          after: data,
        }));
        res.json({ data, meta: {} });
        return;
      }

      const permission = action === 'initiate-purge'
        ? PERMISSIONS.documentsRecordsManage
        : action === 'review-purge'
          ? PERMISSIONS.documentsFinanceReview
          : action === 'void'
            ? PERMISSIONS.employeeReceiptsWrite
            : PERMISSIONS.documentsGovernanceManage;
      const result = await dispatchAction({
        db,
        session,
        resource: 'documents',
        resourceId: id,
        action,
        payload,
        idempotencyKey: req.header('idempotency-key'),
        requestId: context(res).requestId,
      }, {
        permission,
        idempotency: 'required',
        audit: 'required',
        execute: async (tx, tenant, input) => {
          const expectedVersion = payload.expectedVersion;
          if (typeof expectedVersion !== 'number') {
            throw new ActionDispatchError(
              400,
              'invalid_action_payload',
              'Expected governance version is required.',
            );
          }
          if (action === 'void') {
            return voidDocumentRecordWithin(
              tx,
              tenant,
              { userId: input.actorUserId },
              id,
              expectedVersion,
              String(payload.reason ?? ''),
            );
          }
          if (['submit', 'approve', 'post', 'seal'].includes(action)) {
            return transitionDocumentRecordWithin(
              tx,
              tenant,
              { userId: input.actorUserId, canManage: true },
              id,
              expectedVersion,
              action === 'submit'
                ? 'submitted'
                : action === 'approve'
                  ? 'approved'
                  : action === 'post'
                    ? 'posted'
                    : 'sealed',
              String(payload.reason ?? ''),
            );
          }
          if (action === 'set-legal-hold') {
            if (typeof payload.legalHold !== 'boolean') {
              throw new ActionDispatchError(
                400, 'invalid_action_payload', 'Legal-hold value is required.',
              );
            }
            return setDocumentLegalHoldWithin(
              tx,
              tenant,
              { userId: input.actorUserId, canManage: true },
              id,
              expectedVersion,
              payload.legalHold,
              String(payload.reason ?? ''),
            );
          }
          if (action === 'set-paper-custody') {
            if (!['none', 'employee', 'finance_archive', 'returned', 'destroyed']
              .includes(String(payload.status))) {
              throw new ActionDispatchError(
                400, 'invalid_action_payload', 'Paper-custody status is invalid.',
              );
            }
            return setDocumentPaperCustodyWithin(
              tx,
              tenant,
              { userId: input.actorUserId, canManage: true },
              id,
              expectedVersion,
              {
                status: payload.status as
                  | 'none' | 'employee' | 'finance_archive' | 'returned' | 'destroyed',
                reference: typeof payload.reference === 'string' ? payload.reference : null,
                reason: String(payload.reason ?? ''),
              },
            );
          }
          if (action === 'initiate-purge') {
            return initiateDocumentPurgeWithin(
              tx, tenant, input.actorUserId, id, String(payload.reason ?? ''),
            );
          }
          if (action === 'review-purge') {
            if (typeof payload.requestId !== 'number'
              || !['approve', 'reject'].includes(String(payload.decision))) {
              throw new ActionDispatchError(
                400,
                'invalid_action_payload',
                'Purge request id and approve/reject decision are required.',
              );
            }
            return reviewDocumentPurgeWithin(
              tx,
              tenant,
              input.actorUserId,
              payload.requestId,
              expectedVersion,
              payload.decision as 'approve' | 'reject',
              String(payload.reason ?? ''),
            );
          }
          throw new ActionDispatchError(404, 'action_not_found', 'Unknown document action.');
        },
      });
      if (result.replayed) res.setHeader('Idempotency-Replayed', 'true');
      res.status(result.status).json(result.body);
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
}
