import { Router } from 'express';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  getReportArtifact,
  getReportJob,
  ReportJobError,
} from '../../modules/reporting/reportJobs';
import { apiError, requireSession } from '../http';

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function createReportingRouter(db: DB): Router {
  const router = Router();

  router.get('/jobs/:id', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const id = positiveId(req.params.id);
    if (!id) {
      apiError(res, 400, 'invalid_id', 'Report job id must be a positive integer.');
      return;
    }
    try {
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      };
      res.json({
        data: await withTenantTransaction(db, scope, (tx) => getReportJob(tx, {
          masterFn: scope.masterFn,
          actorUserId: session.userId,
          id,
        })),
        meta: {},
      });
    } catch (error) {
      if (error instanceof ReportJobError) {
        apiError(res, 404, error.code, error.message);
        return;
      }
      throw error;
    }
  });

  router.get('/artifacts/:id/download', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const artifactId = positiveId(req.params.id);
    if (!artifactId) {
      apiError(res, 400, 'invalid_id', 'Artifact id must be a positive integer.');
      return;
    }
    try {
      const scope = {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      };
      const artifact = await withTenantTransaction(
        db,
        scope,
        (tx) => getReportArtifact(tx, {
          masterFn: scope.masterFn,
          actorUserId: session.userId,
          artifactId,
        }),
      );
      res.setHeader('Content-Type', artifact.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${artifact.fileName.replaceAll('"', '')}"`,
      );
      res.setHeader('Content-Length', String(artifact.sizeBytes));
      res.setHeader('X-Checksum-SHA256', artifact.sha256);
      res.send(Buffer.from(artifact.content));
    } catch (error) {
      if (error instanceof ReportJobError) {
        apiError(
          res,
          error.code === 'report_artifact_expired' ? 410 : 404,
          error.code,
          error.message,
        );
        return;
      }
      throw error;
    }
  });

  return router;
}
