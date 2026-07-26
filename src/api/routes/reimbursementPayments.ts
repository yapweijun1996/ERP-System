import { createHash } from 'node:crypto';
import { Router } from 'express';
import { decryptToken, encryptToken } from '../../auth/tokenCrypto';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  accessReimbursementBankExportWithin,
  configureReimbursementBankTemplateWithin,
  generateReimbursementBankExportWithin,
  importReimbursementBankResultsWithin,
  listReimbursementPaymentEvidenceWithin,
  ReimbursementPaymentError,
  type BankResultInput,
} from '../../modules/expenses/reimbursementPayments';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';
import {
  abandonIdempotentRequest,
  beginIdempotentRequest,
  completeIdempotentRequest,
} from '../idempotency';

export interface ReimbursementPaymentsRouterOptions {
  encryptionKey?: Buffer;
}

function positiveId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function handle(res: import('express').Response, error: unknown): void {
  if (error instanceof ReimbursementPaymentError) {
    apiError(res, error.status, error.code, error.message, error.details);
    return;
  }
  throw error;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createReimbursementPaymentsRouter(
  db: DB,
  options: ReimbursementPaymentsRouterOptions = {},
): Router {
  const router = Router();
  const crypto = options.encryptionKey ? {
    encrypt: (value: string) => encryptToken(value, options.encryptionKey!),
    decrypt: (value: Parameters<typeof decryptToken>[0]) =>
      decryptToken(value, options.encryptionKey!),
    hash,
  } : null;

  async function requirePermission(
    req: import('express').Request,
    res: import('express').Response,
    permission: string,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (!await hasPermission(db, session, permission)) {
      apiError(res, 403, 'permission_denied', 'Reimbursement bank payment permission is required.');
      return null;
    }
    return session;
  }

  function requireKey(req: import('express').Request, res: import('express').Response) {
    const key = req.header('idempotency-key')?.trim() ?? '';
    if (!key || key.length > 128) {
      apiError(res, 428, 'idempotency_key_required', 'A valid Idempotency-Key is required.');
      return null;
    }
    return key;
  }

  router.get('/evidence', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesPaymentExport,
    );
    if (!session) return;
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        listReimbursementPaymentEvidenceWithin(tx, scope));
      res.json({
        data,
        meta: {
          artifactContent: 'encrypted_omitted',
          resultEvidence: 'immutable',
          limit: 500,
        },
      });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/templates/versions', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesPaymentTemplateManage,
    );
    if (!session) return;
    const key = requireKey(req, res);
    if (!key) return;
    const payload = {
      templateKey: String(req.body?.templateKey ?? ''),
      versionNo: Number(req.body?.versionNo),
      validFrom: String(req.body?.validFrom ?? ''),
      validTo: req.body?.validTo == null ? null : String(req.body.validTo),
      name: String(req.body?.name ?? ''),
      bankCode: String(req.body?.bankCode ?? ''),
      delimiter: req.body?.delimiter as ',' | '\t' | ';' | undefined,
      includeHeader: req.body?.includeHeader == null
        ? undefined
        : Boolean(req.body.includeHeader),
      fieldOrder: Array.isArray(req.body?.fieldOrder)
        ? req.body.fieldOrder.map(String)
        : [],
    };
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      'expenses.reimbursement-payment.template.configure',
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
        const result = await configureReimbursementBankTemplateWithin(
          tx,
          scope,
          session.userId,
          payload,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'reimbursement_bank_template_version',
          entityId: result.template.id,
          action: result.replayed ? 'configure_replay' : 'configured',
          after: {
            templateKey: result.template.templateKey,
            versionNo: result.template.versionNo,
            validFrom: result.template.validFrom,
            validTo: result.template.validTo,
          },
        });
        return result;
      });
      const response = { data, meta: { versioned: true, status: 'confirmed' } };
      await completeIdempotentRequest(db, begun.recordId, data.replayed ? 200 : 201, response);
      res.status(data.replayed ? 200 : 201).json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  router.post('/exports', async (req, res) => {
    const session = await requirePermission(req, res, PERMISSIONS.expensesPaymentExport);
    if (!session) return;
    if (!crypto) {
      apiError(res, 503, 'reimbursement_payment_encryption_unavailable',
        'Reimbursement bank artifact encryption is not configured.');
      return;
    }
    const key = requireKey(req, res);
    if (!key) return;
    const payload = {
      exportKey: String(req.body?.exportKey ?? ''),
      batchId: Number(req.body?.batchId),
      templateKey: String(req.body?.templateKey ?? ''),
      exportDate: String(req.body?.exportDate ?? ''),
      retryOfExportId: req.body?.retryOfExportId == null
        ? null
        : Number(req.body.retryOfExportId),
    };
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      'expenses.reimbursement-payment.export.generate',
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
        const result = await generateReimbursementBankExportWithin(
          tx,
          scope,
          session.userId,
          payload,
          crypto,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'reimbursement_bank_export',
          entityId: result.export.id,
          action: result.replayed ? 'generate_replay' : 'generated',
          after: {
            batchId: result.export.batchId,
            exportVersion: result.export.exportVersion,
            retryOfExportId: result.export.retryOfExportId,
            contentSha256: result.export.contentSha256,
            rowCount: result.export.rowCount,
            totalAmount: result.export.totalAmount,
          },
        });
        return result;
      });
      const response = {
        data,
        meta: { artifactContent: 'encrypted_omitted', integrity: 'sha256' },
      };
      await completeIdempotentRequest(db, begun.recordId, data.replayed ? 200 : 201, response);
      res.status(data.replayed ? 200 : 201).json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  router.post('/exports/:exportId/actions/download', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesPaymentArtifactDownload,
    );
    if (!session) return;
    if (!crypto) {
      apiError(res, 503, 'reimbursement_payment_encryption_unavailable',
        'Reimbursement bank artifact encryption is not configured.');
      return;
    }
    const exportId = positiveId(req.params.exportId);
    if (!exportId) {
      apiError(res, 400, 'invalid_id', 'exportId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const result = await accessReimbursementBankExportWithin(
          tx,
          scope,
          session.userId,
          exportId,
          String(req.body?.accessKey ?? ''),
          String(req.body?.purpose ?? ''),
          crypto,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'reimbursement_bank_export',
          entityId: exportId,
          action: result.replayedAccess ? 'download_replay' : 'downloaded',
          after: {
            purpose: String(req.body?.purpose ?? '').trim(),
            contentSha256: result.export.contentSha256,
          },
        });
        return result;
      });
      res.setHeader('Cache-Control', 'no-store, private');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${data.export.artifactFileName.replaceAll('"', '')}"`,
      );
      res.setHeader('X-Content-SHA256', data.export.contentSha256);
      res.status(200).send(data.content);
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/result-imports', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesPaymentResultImport,
    );
    if (!session) return;
    const key = requireKey(req, res);
    if (!key) return;
    const payload = {
      importKey: String(req.body?.importKey ?? ''),
      exportId: Number(req.body?.exportId),
      bankReference: String(req.body?.bankReference ?? ''),
      paymentDate: String(req.body?.paymentDate ?? ''),
      results: Array.isArray(req.body?.results)
        ? req.body.results.map((row: Record<string, unknown>): BankResultInput => ({
            exportLineNo: Number(row.exportLineNo),
            outcome: String(row.outcome) as BankResultInput['outcome'],
            bankLineReference: String(row.bankLineReference ?? ''),
            failureCode: row.failureCode == null ? null : String(row.failureCode),
            failureMessage: row.failureMessage == null ? null : String(row.failureMessage),
          }))
        : [],
    };
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      'expenses.reimbursement-payment.results.import',
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
        const result = await importReimbursementBankResultsWithin(
          tx,
          scope,
          session.userId,
          payload,
          hash,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'reimbursement_bank_result_import',
          entityId: result.import.id,
          action: result.replayed ? 'import_replay' : 'imported',
          after: {
            exportId: result.import.exportId,
            bankReference: result.import.bankReference,
            rowCount: result.import.rowCount,
            settlementCount: result.settlements.length,
          },
        });
        return result;
      });
      const response = {
        data,
        meta: { settlementPosting: 'successful_lines_only', idempotent: true },
      };
      await completeIdempotentRequest(db, begun.recordId, data.replayed ? 200 : 201, response);
      res.status(data.replayed ? 200 : 201).json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  return router;
}
