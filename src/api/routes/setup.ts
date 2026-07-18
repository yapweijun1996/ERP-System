import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import type { DB } from '../../data/db';
import {
  completeProductionSetup,
  SetupError,
  type CompleteSetupInput,
} from '../../modules/setup/completeSetup';
import { apiError, context } from '../http';

function setupTokenMatches(expected: string, received: string | undefined): boolean {
  if (!received) return false;
  const expectedHash = createHash('sha256').update(expected).digest();
  const receivedHash = createHash('sha256').update(received).digest();
  return timingSafeEqual(expectedHash, receivedHash);
}

export function createSetupRouter(db: DB, setupToken: string | undefined): Router {
  const router = Router();
  router.post('/actions/complete', async (req, res) => {
    if (!setupToken) {
      apiError(res, 503, 'setup_unavailable', 'Production setup is not configured.');
      return;
    }
    if (!setupTokenMatches(setupToken, req.header('x-erp-setup-token'))) {
      apiError(res, 403, 'setup_token_invalid', 'The production setup token is invalid.');
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
