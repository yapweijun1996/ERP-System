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
): void {
  res.status(status).json({
    error: {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
      requestId: context(res).requestId,
    },
  });
}

export async function requireSession(
  db: DB,
  req: express.Request,
  res: express.Response,
): Promise<SessionData | null> {
  const ctx = context(res);
  if (ctx.session) return ctx.session;
  const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const session = await getSession(db, sessionId);
  if (!session) {
    apiError(res, 401, 'not_authenticated', 'Sign in first (POST /api/auth/login).');
    return null;
  }
  ctx.sessionId = sessionId;
  ctx.session = session;
  return session;
}
