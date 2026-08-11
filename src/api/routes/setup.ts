import { Router } from 'express';
import type { DB } from '../../data/db';
import {
  completeProductionSetup,
  SetupError,
  type CompleteSetupInput,
} from '../../modules/setup/completeSetup';
import { getProductionSetupStatus } from '../../modules/setup/setupState';
import { apiError, context } from '../http';

export function createSetupRouter(db: DB): Router {
  const router = Router();
  router.post('/actions/complete', async (req, res) => {
    const status = await getProductionSetupStatus(db);
    if (!status.isFreshDatabase) {
      apiError(res, 409, 'setup_not_empty', 'Production setup is available only for an empty database.');
      return;
    }
    try {
      const result = await completeProductionSetup(
        db,
        (req.body ?? {}) as CompleteSetupInput,
        context(res).requestId,
      );
      res.status(201).json({ data: result, meta: {} });
    } catch (error) {
      if (error instanceof SetupError) {
        apiError(res, error.status, error.code, error.message, error.fieldErrors);
        return;
      }
      throw error;
    }
  });
  return router;
}
