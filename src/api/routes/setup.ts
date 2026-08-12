import { Router } from 'express';
import type express from 'express';
import type { DB } from '../../data/db';
import { apiError, context } from '../http';
import { getProductionSetupStatus } from '../../modules/setup/setupState';
import {
  completePlatformBootstrap,
  type PlatformBootstrapInput,
} from '../../modules/setup/platformBootstrap';
import {
  createPlatformSession,
  PLATFORM_CSRF_COOKIE,
  PLATFORM_SESSION_COOKIE,
  PLATFORM_SESSION_TTL_MS,
  PlatformAccessError,
} from '../../auth/platformSupport';

function clientIp(req: express.Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function createSetupRouter(db: DB, options: { secureCookies: boolean }): Router {
  const router = Router();
  router.post('/actions/complete', async (req, res) => {
    apiError(res, 410, 'legacy_setup_disabled', 'Production tenant setup must begin in the Platform Superadmin workspace.');
  });

  router.post('/platform-superadmin/actions/complete', async (req, res) => {
    try {
      const status = await getProductionSetupStatus(db);
      if (!status.isFreshDatabase) {
        apiError(res, 409, 'already_initialized', 'Platform bootstrap is available only for an empty database.');
        return;
      }
      const result = await completePlatformBootstrap(
        db,
        { ...(req.body ?? {}), clientIp: clientIp(req) } as PlatformBootstrapInput,
        context(res).requestId,
      );
      const created = await createPlatformSession(db, result.principalId);
      const cookieCommon = {
        sameSite: 'strict' as const,
        secure: options.secureCookies,
        path: '/',
      };
      res.cookie(PLATFORM_SESSION_COOKIE, created.token, {
        ...cookieCommon, httpOnly: true, maxAge: PLATFORM_SESSION_TTL_MS,
      });
      res.cookie(PLATFORM_CSRF_COOKIE, created.csrfToken, {
        ...cookieCommon, httpOnly: false, maxAge: PLATFORM_SESSION_TTL_MS,
      });
      res.status(201).json({
        data: {
          realm: 'platform',
          ...result,
          expiresAt: created.expiresAt,
          rememberDevice: false,
        },
        meta: { realm: 'platform', bootstrap: true },
      });
    } catch (error) {
      if (error instanceof PlatformAccessError) {
        apiError(res, error.status, error.code, error.message);
        return;
      }
      throw error;
    }
  });
  return router;
}
