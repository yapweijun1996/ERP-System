import { Router } from 'express';
import type express from 'express';
import { createHash } from 'node:crypto';
import type { DB } from '../../data/db';
import {
  ProductCaseError,
  appendHumanProductCaseEvidence,
  linkProductCaseTask,
  listProductCases,
  preflightProductCaseRelease,
  readProductCase,
  releaseProductCase,
  triageProductCase,
  transitionProductCase,
  verifyProductCaseRelease,
  type VerifiedProductRelease,
} from '../../modules/product/productCase';
import { verifyRelease } from '../../release/verifyRelease.mjs';
import { apiError, context, requireSession } from '../http';

function handleError(res: express.Response, error: unknown): void {
  if (error instanceof ProductCaseError) {
    apiError(res, error.status, error.code, error.message);
    return;
  }
  throw error;
}

function optionalPositiveInteger(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : NaN;
}

export interface ProductCasesRouterOptions {
  releaseRevision?: string;
  publicUrl?: string;
  /** Controlled verification fixture for tests; never taken from a request. */
  releaseVerifier?: (revision: string) => Promise<VerifiedProductRelease>;
}

export function createProductCasesRouter(db: DB, options: ProductCasesRouterOptions = {}): Router {
  const router = Router();

  async function verifiedCurrentRelease(): Promise<VerifiedProductRelease> {
    const revision = options.releaseRevision?.trim() ?? '';
    if (!/^[a-f0-9]{40}$/.test(revision)) {
      throw new ProductCaseError(503, 'product_case_release_unavailable', 'A deployed release revision is unavailable.');
    }
    if (options.releaseVerifier) {
      let proof: VerifiedProductRelease;
      try {
        proof = await options.releaseVerifier(revision);
      } catch {
        throw new ProductCaseError(503, 'product_case_release_unavailable', 'Release verification did not pass.');
      }
      if (proof.revision !== revision || !/^[a-f0-9]{64}$/.test(proof.proofDigest)) {
        throw new ProductCaseError(503, 'product_case_release_unavailable', 'Release verification did not match this server.');
      }
      return proof;
    }
    if (!options.publicUrl) {
      throw new ProductCaseError(503, 'product_case_release_unavailable', 'The public release origin is not configured.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const report = await verifyRelease({
        origin: options.publicUrl,
        expectedRevision: revision,
        fetchImpl: (url, init) => fetch(url, { ...init, signal: controller.signal }),
      });
      const proofDigest = createHash('sha256').update(JSON.stringify({
        origin: report.origin,
        revision: report.revision,
        fileCount: report.fileCount,
        checks: report.checks,
      })).digest('hex');
      return { revision, proofDigest };
    } catch {
      throw new ProductCaseError(503, 'product_case_release_unavailable', 'Public release verification did not pass.');
    } finally {
      clearTimeout(timeout);
    }
  }

  router.get('/', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    const limit = optionalPositiveInteger(req.query.limit);
    const afterId = optionalPositiveInteger(req.query.afterId);
    if (Number.isNaN(limit) || Number.isNaN(afterId)) {
      apiError(res, 400, 'product_case_query_invalid', 'Pagination values are invalid.');
      return;
    }
    try {
      const result = await listProductCases(db, session, {
        caseType: typeof req.query.caseType === 'string' ? req.query.caseType : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        limit,
        afterId,
      });
      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get('/:id', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    try {
      res.json({ data: await readProductCase(db, session, req.params.id) });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/:id/transitions', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    try {
      const data = await transitionProductCase(
        db, session, req.params.id, req.body, context(res).requestId,
      );
      res.json({ data });
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post('/:id/triage', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    try {
      res.json({ data: await triageProductCase(db, session, req.params.id, req.body, context(res).requestId) });
    } catch (error) { handleError(res, error); }
  });

  router.post('/:id/tasks', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    try {
      res.json({ data: await linkProductCaseTask(db, session, req.params.id, req.body, context(res).requestId) });
    } catch (error) { handleError(res, error); }
  });

  router.post('/:id/evidence', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    try {
      res.json(await appendHumanProductCaseEvidence(
        db, session, req.params.id, req.body, context(res).requestId,
      ));
    } catch (error) { handleError(res, error); }
  });

  router.post('/:id/releases', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    try {
      await preflightProductCaseRelease(db, session, req.params.id, req.body);
      const proof = await verifiedCurrentRelease();
      res.json({ data: await releaseProductCase(
        db, session, req.params.id, req.body, proof, context(res).requestId,
      ) });
    } catch (error) { handleError(res, error); }
  });

  router.post('/:id/verifications', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    try {
      res.json({ data: await verifyProductCaseRelease(
        db, session, req.params.id, req.body, context(res).requestId,
      ) });
    } catch (error) { handleError(res, error); }
  });

  return router;
}
