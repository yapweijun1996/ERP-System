import { Router, type Request } from 'express';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { appUser, company, userCompany } from '../../data/schema';
import { verifyPassword } from '../../auth/password';
import {
  CSRF_COOKIE,
  DEFAULT_ABSOLUTE_TTL_MS,
  SESSION_COOKIE,
  createSession,
  destroySession,
  parseCookies,
  switchSessionCompany,
} from '../../auth/session';
import {
  checkLoginRateLimit,
  clearLoginFailures,
  loginIdentifierHash,
  recordLoginFailure,
} from '../../auth/rateLimit';
import { PERMISSIONS, hasPermission } from '../../auth/permissions';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';

export interface AuthRouterOptions {
  secureCookies: boolean;
}

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function clearAuthCookies(res: import('express').Response, secure: boolean): void {
  const common = { sameSite: 'strict' as const, secure, path: '/' };
  res.clearCookie(SESSION_COOKIE, { ...common, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...common, httpOnly: false });
}

export function createAuthRouter(db: DB, options: AuthRouterOptions): Router {
  const router = Router();
  const cookieCommon = {
    sameSite: 'strict' as const,
    secure: options.secureCookies,
    path: '/',
  };

  router.post('/login', async (req, res) => {
    const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      const fieldErrors: Record<string, string> = {};
      if (typeof email !== 'string' || !email.trim()) fieldErrors.email = 'Email is required.';
      if (typeof password !== 'string' || !password) fieldErrors.password = 'Password is required.';
      apiError(res, 400, 'invalid_request', 'Email and password are required.', fieldErrors);
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const identifier = loginIdentifierHash(normalizedEmail, clientIp(req));
    const rateLimit = await checkLoginRateLimit(db, identifier);
    if (!rateLimit.allowed) {
      res.setHeader('retry-after', String(rateLimit.retryAfterSeconds));
      apiError(res, 429, 'login_rate_limited', 'Too many sign-in attempts. Try again later.');
      return;
    }

    const users = await db.select({
      userId: appUser.userId,
      masterFn: appUser.masterFn,
      email: appUser.email,
      fullName: appUser.fullName,
      passwordHash: appUser.passwordHash,
      isActive: appUser.isActive,
    }).from(appUser).where(eq(appUser.email, normalizedEmail)).limit(2);
    const user = users.length === 1 ? users[0] : null;
    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      const failure = await recordLoginFailure(db, identifier);
      if (failure.blocked) res.setHeader('retry-after', String(failure.retryAfterSeconds));
      // Identical response for unknown user, ambiguous email and wrong password.
      apiError(res, 401, 'invalid_credentials', 'Incorrect email or password.');
      return;
    }

    const [assignment] = await db.select({ companyFn: userCompany.companyFn })
      .from(userCompany)
      .innerJoin(company, eq(company.companyFn, userCompany.companyFn))
      .where(and(
        eq(userCompany.userId, user.userId),
        eq(company.masterFn, user.masterFn),
      ))
      .limit(1);
    if (!assignment) {
      apiError(res, 403, 'no_company_access', 'This user has no company assignments.');
      return;
    }

    await clearLoginFailures(db, identifier);
    const created = await createSession(db, {
      userId: user.userId,
      masterFn: user.masterFn,
      activeCompanyFn: assignment.companyFn,
      email: user.email,
      fullName: user.fullName,
      userAgent: req.header('user-agent'),
    });
    res.cookie(SESSION_COOKIE, created.sessionId, {
      ...cookieCommon,
      httpOnly: true,
      maxAge: DEFAULT_ABSOLUTE_TTL_MS,
    });
    res.cookie(CSRF_COOKIE, created.csrfToken, {
      ...cookieCommon,
      httpOnly: false,
      maxAge: DEFAULT_ABSOLUTE_TTL_MS,
    });
    res.json({
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      masterFn: user.masterFn,
      activeCompanyFn: assignment.companyFn,
    });
  });

  router.post('/logout', async (req, res) => {
    const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    await destroySession(db, sessionId);
    clearAuthCookies(res, options.secureCookies);
    res.json({ data: { ok: true }, meta: {} });
  });

  router.get('/session', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    res.json(session);
  });

  router.post('/session/actions/switch-company', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.companySwitch)) {
      apiError(res, 403, 'permission_denied', 'You cannot switch companies.');
      return;
    }
    const companyFn = (req.body as { companyFn?: unknown } | undefined)?.companyFn;
    if (typeof companyFn !== 'string' || !companyFn.trim()) {
      apiError(res, 400, 'invalid_request', 'companyFn is required.', {
        companyFn: 'Company is required.',
      });
      return;
    }
    const ctx = context(res);
    const changed = await switchSessionCompany(db, ctx.sessionId!, companyFn.trim());
    if (!changed) {
      apiError(res, 403, 'company_access_denied', 'You are not assigned to this company.');
      return;
    }
    await appendAudit(db, {
      masterFn: session.masterFn,
      companyFn: changed.activeCompanyFn,
      actorUserId: session.userId,
      requestId: ctx.requestId,
      entity: 'app_session',
      action: 'switch_company',
      before: { activeCompanyFn: session.activeCompanyFn },
      after: { activeCompanyFn: changed.activeCompanyFn },
    });
    ctx.session = changed;
    res.json({ data: changed, meta: {} });
  });

  return router;
}
