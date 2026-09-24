import { Router } from 'express';
import type express from 'express';
import type { DB } from '../../data/db';
import {
  ProductCaseError,
  listProductCases,
  readProductCase,
  transitionProductCase,
} from '../../modules/product/productCase';
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

export function createProductCasesRouter(db: DB): Router {
  const router = Router();

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

  return router;
}
