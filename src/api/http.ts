import type express from 'express';
import type { DB } from '../data/db';
import {
  SESSION_COOKIE,
  getSession,
  parseCookies,
  type SessionData,
} from '../auth/session';

export interface RequestContext {
  requestId: string;
  sessionId?: string;
  session?: SessionData;
}

export function context(res: express.Response): RequestContext {
  return res.locals.erpContext as RequestContext;
}

export function apiError(
  res: express.Response,
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
  options: {
    params?: Record<string, string | number | boolean | null>;
    fieldErrorCodes?: Record<string, {
      code: string;
      params?: Record<string, string | number | boolean | null>;
    }>;
  } = {},
): void {
  res.status(status).json({
    error: {
      code,
      message,
      ...(options.params ? { params: options.params } : {}),
      ...(fieldErrors ? { fieldErrors } : {}),
      ...(options.fieldErrorCodes ? { fieldErrorCodes: options.fieldErrorCodes } : {}),
      requestId: context(res).requestId,
    },
  });
}

export async function requireSession(
  db: DB,
  req: express.Request,
  res: express.Response,
  options: {
    allowActivationPending?: boolean;
    /** The session endpoint is the recovery path for a stale browser snapshot. */
    allowStaleAuthorization?: boolean;
  } = {},
): Promise<SessionData | null> {
  const checkAuthorizationFreshness = (session: SessionData): boolean => {
    const currentVersion = session.authorizationVersion;
    if (currentVersion == null) return true;
    res.setHeader('X-ERP-Authorization-Version', String(currentVersion));
    const supplied = req.get('x-erp-authorization-version');
    if (options.allowStaleAuthorization || supplied == null || supplied === '') return true;
    if (/^[1-9]\d*$/.test(supplied) && Number(supplied) === currentVersion) return true;
    apiError(
      res,
      409,
      'authorization_state_stale',
      'Authorization changed. Refresh the signed-in workspace before retrying.',
      undefined,
      { params: { authorizationVersion: currentVersion } },
    );
    return false;
  };
  const ctx = context(res);
  if (ctx.session) {
    if (ctx.session.passwordChangeRequired && !options.allowActivationPending) {
      apiError(res, 403, 'activation_required', 'Complete first-login activation before using the application.');
      return null;
    }
    if (!checkAuthorizationFreshness(ctx.session)) return null;
    return ctx.session;
  }
  const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const session = await getSession(db, sessionId);
  if (!session) {
    apiError(res, 401, 'not_authenticated', 'Sign in first (POST /api/auth/login).');
    return null;
  }
  ctx.sessionId = sessionId;
  ctx.session = session;
  if (session.passwordChangeRequired && !options.allowActivationPending) {
    apiError(
      res,
      403,
      'activation_required',
      'Complete first-login activation before using the application.',
    );
    return null;
  }
  if (!checkAuthorizationFreshness(session)) return null;
  return session;
}
