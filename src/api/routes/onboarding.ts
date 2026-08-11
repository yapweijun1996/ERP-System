import { Router, raw } from 'express';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { onboardingImportJob, onboardingImportRow } from '../../data/schema';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  CompanyOnboardingError, completeCompanyOnboardingStage,
  goLiveCompany, readCompanyOnboardingWithin,
} from '../../modules/setup/companyOnboarding';
import {
  OnboardingImportError, commitOnboardingImport, preflightOnboardingImport,
} from '../../modules/setup/onboardingImport';
import { apiError, context, requireSession } from '../http';

export function createOnboardingRouter(db: DB): Router {
  const router = Router();

  async function requireSetupAdmin(
    req: import('express').Request,
    res: import('express').Response,
  ) {
    const session = await requireSession(db, req, res);
    if (!session) return null;
    if (!await hasPermission(db, session, PERMISSIONS.rolesWrite)) {
      apiError(res, 403, 'permission_denied', 'You cannot manage company onboarding.');
      return null;
    }
    return session;
  }

  function handleError(res: import('express').Response, error: unknown): void {
    if (error instanceof CompanyOnboardingError || error instanceof OnboardingImportError) {
      apiError(res, error.status, error.code, error.message, error.details);
      return;
    }
    throw error;
  }

  router.get('/status', async (req, res) => {
    const session = await requireSetupAdmin(req, res);
    if (!session) return;
    try {
      const data = await withTenantTransaction(db, {
        masterFn: session.masterFn, companyFn: session.activeCompanyFn,
      }, (tx) =>
        readCompanyOnboardingWithin(tx, session));
      res.json({ data, meta: {} });
    } catch (error) { handleError(res, error); }
  });

  router.post('/stages/:stage/actions/complete', async (req, res) => {
    const session = await requireSetupAdmin(req, res);
    if (!session) return;
    const expectedVersion = Number(req.body?.expectedVersion);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
      apiError(res, 400, 'invalid_request', 'expectedVersion is required.');
      return;
    }
    try {
      const data = await completeCompanyOnboardingStage(
        db, session, req.params.stage, expectedVersion, context(res).requestId,
      );
      res.json({ data, meta: {} });
    } catch (error) { handleError(res, error); }
  });

  router.get('/imports', async (req, res) => {
    const session = await requireSetupAdmin(req, res);
    if (!session) return;
    const data = await withTenantTransaction(db, {
      masterFn: session.masterFn, companyFn: session.activeCompanyFn,
    }, (tx) => tx.select()
      .from(onboardingImportJob).where(and(
        eq(onboardingImportJob.masterFn, session.masterFn),
        eq(onboardingImportJob.companyFn, session.activeCompanyFn),
      )).orderBy(onboardingImportJob.id));
    res.json({ data, meta: {} });
  });

  router.get('/imports/:jobId', async (req, res) => {
    const session = await requireSetupAdmin(req, res);
    if (!session) return;
    const jobId = Number(req.params.jobId);
    if (!Number.isSafeInteger(jobId) || jobId <= 0) {
      apiError(res, 400, 'invalid_id', 'jobId must be a positive integer.');
      return;
    }
    const data = await withTenantTransaction(db, {
      masterFn: session.masterFn, companyFn: session.activeCompanyFn,
    }, async (tx) => {
      const [job] = await tx.select().from(onboardingImportJob).where(and(
        eq(onboardingImportJob.id, jobId),
        eq(onboardingImportJob.masterFn, session.masterFn),
        eq(onboardingImportJob.companyFn, session.activeCompanyFn),
      )).limit(1);
      if (!job) return null;
      const rows = await tx.select().from(onboardingImportRow).where(and(
        eq(onboardingImportRow.masterFn, session.masterFn),
        eq(onboardingImportRow.companyFn, session.activeCompanyFn),
        eq(onboardingImportRow.jobId, jobId),
      )).orderBy(onboardingImportRow.rowNumber);
      return { ...job, rows };
    });
    if (!data) { apiError(res, 404, 'import_job_not_found', 'Import job was not found.'); return; }
    res.json({ data, meta: {} });
  });

  router.post(
    '/imports/actions/preflight',
    raw({ type: ['text/csv', 'application/csv', 'application/octet-stream', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], limit: '10mb' }),
    async (req, res) => {
      const session = await requireSetupAdmin(req, res);
      if (!session) return;
      const target = req.header('x-import-target') ?? '';
      const fileName = req.header('x-file-name') ?? '';
      const format = req.header('x-import-format')
        ?? (fileName.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv');
      if (!Buffer.isBuffer(req.body)) {
        apiError(res, 400, 'import_body_required', 'Send the CSV or XLSX file as the request body.');
        return;
      }
      try {
        const data = await preflightOnboardingImport(
          db, session, { target, format, fileName, buffer: req.body }, context(res).requestId,
        );
        res.status(201).json({ data, meta: {} });
      } catch (error) { handleError(res, error); }
    },
  );

  router.post('/imports/:jobId/actions/commit', async (req, res) => {
    const session = await requireSetupAdmin(req, res);
    if (!session) return;
    const jobId = Number(req.params.jobId);
    const expectedVersion = Number(req.body?.expectedVersion);
    if (!Number.isSafeInteger(jobId) || jobId <= 0
      || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
      apiError(res, 400, 'invalid_request', 'jobId and expectedVersion are required.');
      return;
    }
    try {
      const data = await commitOnboardingImport(
        db, session, jobId, expectedVersion, req.body?.confirmWarnings === true,
        context(res).requestId,
      );
      res.json({ data, meta: {} });
    } catch (error) { handleError(res, error); }
  });

  router.post('/actions/go-live', async (req, res) => {
    const session = await requireSetupAdmin(req, res);
    if (!session) return;
    const expectedVersion = Number(req.body?.expectedVersion);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
      apiError(res, 400, 'invalid_request', 'expectedVersion is required.');
      return;
    }
    try {
      const data = await goLiveCompany(db, session, expectedVersion, context(res).requestId);
      res.json({ data, meta: {} });
    } catch (error) { handleError(res, error); }
  });

  return router;
}
