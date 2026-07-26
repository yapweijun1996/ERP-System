import { Router } from 'express';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  accessTaxEvidenceArtifactWithin,
  createTaxEvidenceReportJobWithin,
  createTaxEvidenceSnapshotWithin,
  readTaxEvidenceJobWithin,
  TaxEvidenceError,
  type TaxEvidenceAction,
} from '../../modules/expenses/taxEvidence';
import {
  configureTaxEvidenceRetentionPolicyWithin,
  readTaxEvidencePackWithin,
  recordTaxEvidencePackLegalHoldWithin,
  sealTaxEvidencePackWithin,
} from '../../modules/expenses/taxEvidenceGovernance';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';
import {
  abandonIdempotentRequest,
  beginIdempotentRequest,
  completeIdempotentRequest,
} from '../idempotency';

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function handle(res: import('express').Response, error: unknown): void {
  if (error instanceof TaxEvidenceError) {
    apiError(res, error.status, error.code, error.message, error.details);
    return;
  }
  throw error;
}

export function createTaxEvidenceRouter(db: DB): Router {
  const router = Router();

  async function requirePermission(
    req: import('express').Request,
    res: import('express').Response,
    permission: string,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (!await hasPermission(db, session, permission)) {
      apiError(res, 403, 'permission_denied', 'Tax evidence permission is required.');
      return null;
    }
    return session;
  }

  function idempotencyKey(
    req: import('express').Request,
    res: import('express').Response,
  ) {
    const key = req.header('idempotency-key')?.trim() ?? '';
    if (!key || key.length > 128) {
      apiError(res, 428, 'idempotency_key_required', 'A valid Idempotency-Key is required.');
      return null;
    }
    return key;
  }

  router.post('/snapshots', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesTaxEvidenceGenerate,
    );
    if (!session) return;
    const key = idempotencyKey(req, res);
    if (!key) return;
    const payload = {
      snapshotKey: String(req.body?.snapshotKey ?? ''),
      filters: {
        startDate: String(req.body?.filters?.startDate ?? ''),
        endDate: String(req.body?.filters?.endDate ?? ''),
        categoryCodes: req.body?.filters?.categoryCodes,
        projectKeys: req.body?.filters?.projectKeys,
        taxStates: req.body?.filters?.taxStates,
        completeness: req.body?.filters?.completeness,
      },
    };
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      'expenses.tax-evidence.snapshot.create',
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
        const result = await createTaxEvidenceSnapshotWithin(
          tx,
          scope,
          session.userId,
          payload.snapshotKey,
          payload.filters,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'tax_evidence_snapshot',
          entityId: result.snapshot.id,
          action: result.replayed ? 'create_replay' : 'created',
          after: {
            filters: result.snapshot.filters,
            sourceSha256: result.snapshot.sourceSha256,
            rowCount: result.snapshot.rowCount,
            documentCount: result.snapshot.documentCount,
            baseExpense: result.snapshot.baseExpense,
            baseInputTax: result.snapshot.baseInputTax,
            baseGross: result.snapshot.baseGross,
          },
        });
        return result;
      });
      const response = { data, meta: { sourceSnapshot: 'immutable', limit: 5000 } };
      await completeIdempotentRequest(db, begun.recordId, data.replayed ? 200 : 201, response);
      res.status(data.replayed ? 200 : 201).json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  router.post('/jobs', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesTaxEvidenceGenerate,
    );
    if (!session) return;
    const key = idempotencyKey(req, res);
    if (!key) return;
    const payload = {
      jobKey: String(req.body?.jobKey ?? ''),
      snapshotId: Number(req.body?.snapshotId),
      locale: String(req.body?.locale ?? 'en'),
    };
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      'expenses.tax-evidence.job.create',
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
        const result = await createTaxEvidenceReportJobWithin(
          tx,
          scope,
          session.userId,
          payload,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'tax_evidence_report_job',
          entityId: result.job.id,
          action: result.replayed ? 'queue_replay' : 'queued',
          after: {
            snapshotId: result.job.snapshotId,
            locale: result.job.locale,
            status: result.job.status,
          },
        });
        return result;
      });
      const response = {
        data,
        meta: { asynchronous: true, artifactCount: 6, deterministicRetry: true },
      };
      await completeIdempotentRequest(db, begun.recordId, data.replayed ? 200 : 202, response);
      res.status(data.replayed ? 200 : 202).json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  router.get('/jobs/:jobId', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesTaxEvidenceAccess,
    );
    if (!session) return;
    const jobId = positiveId(req.params.jobId);
    if (!jobId) {
      apiError(res, 400, 'invalid_id', 'jobId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        readTaxEvidenceJobWithin(tx, scope, session.userId, jobId));
      res.json({
        data,
        meta: { artifactContent: 'omitted', sensitiveAccess: 'purpose_audited' },
      });
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/artifacts/:artifactId/actions/access', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesTaxEvidenceAccess,
    );
    if (!session) return;
    const artifactId = positiveId(req.params.artifactId);
    if (!artifactId) {
      apiError(res, 400, 'invalid_id', 'artifactId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, async (tx) => {
        const result = await accessTaxEvidenceArtifactWithin(
          tx,
          scope,
          session.userId,
          artifactId,
          {
            accessKey: String(req.body?.accessKey ?? ''),
            action: String(req.body?.action ?? '') as TaxEvidenceAction,
            purpose: String(req.body?.purpose ?? ''),
          },
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'tax_evidence_artifact',
          entityId: artifactId,
          action: result.replayedAccess
            ? `${String(req.body?.action)}_replay`
            : String(req.body?.action),
          after: {
            purpose: String(req.body?.purpose ?? '').trim(),
            artifactType: result.artifact.artifactType,
            sha256: result.artifact.sha256,
          },
        });
        return result;
      });
      res.setHeader('Cache-Control', 'no-store, private');
      res.setHeader('Content-Type', data.artifact.mimeType);
      res.setHeader(
        'Content-Disposition',
        `${req.body?.action === 'view' ? 'inline' : 'attachment'}; filename="`
          + `${data.artifact.fileName.replaceAll('"', '')}"`,
      );
      res.setHeader('Content-Length', String(data.artifact.sizeBytes));
      res.setHeader('X-Checksum-SHA256', data.artifact.sha256);
      res.send(data.content);
    } catch (error) {
      handle(res, error);
    }
  });

  router.post('/retention-policies', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesTaxEvidenceGovernance,
    );
    if (!session) return;
    const key = idempotencyKey(req, res);
    if (!key) return;
    const payload = {
      policyKey: String(req.body?.policyKey ?? ''),
      effectiveFrom: String(req.body?.effectiveFrom ?? ''),
      companyRetentionYears: Number(req.body?.companyRetentionYears),
    };
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      'expenses.tax-evidence.retention-policy.configure',
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
        const result = await configureTaxEvidenceRetentionPolicyWithin(
          tx,
          scope,
          session.userId,
          payload,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'tax_evidence_retention_policy',
          entityId: result.policy.id,
          action: result.replayed ? 'configure_replay' : 'configured',
          after: {
            versionNo: result.policy.versionNo,
            countryCode: result.policy.countryCode,
            statutoryMinimumYears: result.policy.statutoryMinimumYears,
            companyRetentionYears: result.policy.companyRetentionYears,
            effectiveFrom: result.policy.effectiveFrom,
          },
        });
        return result;
      });
      const response = { data, meta: { immutable: true, effectiveDated: true } };
      await completeIdempotentRequest(db, begun.recordId, data.replayed ? 200 : 201, response);
      res.status(data.replayed ? 200 : 201).json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  router.post('/packs/seal', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesTaxEvidenceGovernance,
    );
    if (!session) return;
    const key = idempotencyKey(req, res);
    if (!key) return;
    const payload = {
      packKey: String(req.body?.packKey ?? ''),
      reportJobId: Number(req.body?.reportJobId),
      supersedesPackId: req.body?.supersedesPackId == null
        ? undefined
        : Number(req.body.supersedesPackId),
      correctionReason: req.body?.correctionReason == null
        ? undefined
        : String(req.body.correctionReason),
    };
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      'expenses.tax-evidence.pack.seal',
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
        const result = await sealTaxEvidencePackWithin(
          tx,
          scope,
          session.userId,
          payload,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'tax_evidence_pack',
          entityId: result.pack.id,
          action: result.replayed ? 'seal_replay' : 'sealed',
          after: {
            packKey: result.pack.packKey,
            versionNo: result.pack.versionNo,
            supersedesPackId: result.pack.supersedesPackId,
            packSha256: result.pack.packSha256,
            retentionUntil: result.pack.retentionUntil,
          },
        });
        return result;
      });
      const response = {
        data,
        meta: { immutable: true, corrections: 'linked_versions' },
      };
      await completeIdempotentRequest(db, begun.recordId, data.replayed ? 200 : 201, response);
      res.status(data.replayed ? 200 : 201).json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  router.post('/packs/:packId/legal-holds', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesTaxEvidenceGovernance,
    );
    if (!session) return;
    const packId = positiveId(req.params.packId);
    if (!packId) {
      apiError(res, 400, 'invalid_id', 'packId must be a positive integer.');
      return;
    }
    const key = idempotencyKey(req, res);
    if (!key) return;
    const payload = {
      eventKey: String(req.body?.eventKey ?? ''),
      action: String(req.body?.action ?? '') as 'placed' | 'released',
      reason: String(req.body?.reason ?? ''),
    };
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const begun = await beginIdempotentRequest(
      db,
      { ...scope, actorUserId: session.userId },
      key,
      'expenses.tax-evidence.pack.legal-hold',
      { packId, ...payload },
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
        const result = await recordTaxEvidencePackLegalHoldWithin(
          tx,
          scope,
          session.userId,
          packId,
          payload,
        );
        await appendAudit(tx, {
          ...scope,
          actorUserId: session.userId,
          requestId: context(res).requestId,
          entity: 'tax_evidence_pack',
          entityId: packId,
          action: result.replayed
            ? `legal_hold_${payload.action}_replay`
            : `legal_hold_${payload.action}`,
          after: {
            eventKey: result.event.eventKey,
            reason: result.event.reason,
          },
        });
        return result;
      });
      const response = { data, meta: { appendOnly: true, chainScope: true } };
      await completeIdempotentRequest(db, begun.recordId, data.replayed ? 200 : 201, response);
      res.status(data.replayed ? 200 : 201).json(response);
    } catch (error) {
      await abandonIdempotentRequest(db, begun.recordId);
      handle(res, error);
    }
  });

  router.get('/packs/:packId', async (req, res) => {
    const session = await requirePermission(
      req,
      res,
      PERMISSIONS.expensesTaxEvidenceAccess,
    );
    if (!session) return;
    const packId = positiveId(req.params.packId);
    if (!packId) {
      apiError(res, 400, 'invalid_id', 'packId must be a positive integer.');
      return;
    }
    const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    try {
      const data = await withTenantTransaction(db, scope, (tx) =>
        readTaxEvidencePackWithin(tx, scope, packId));
      res.setHeader('Cache-Control', 'no-store, private');
      res.json({ data, meta: { sealed: true, artifactContent: 'omitted' } });
    } catch (error) {
      handle(res, error);
    }
  });

  return router;
}
