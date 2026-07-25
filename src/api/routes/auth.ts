import { Router, type Request } from 'express';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  appUser, company, master, userCompany,
} from '../../data/schema';
import { verifyPassword } from '../../auth/password';
import {
  isValidOrganizationCode,
  isValidUsername,
  normalizeOrganizationCode,
  normalizeUsername,
} from '../../auth/identifiers';
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
import {
  acceptInvitation,
  AuthLifecycleError,
  confirmPasswordReset,
  createInvitation,
  requestPasswordReset,
  type LifecycleOptions,
} from '../../auth/lifecycle';
import { hashOpaqueToken } from '../../auth/tokenCrypto';
import { appendAudit } from '../audit';
import { apiError, context, requireSession } from '../http';

export interface AuthRouterOptions {
  secureCookies: boolean;
  lifecycle?: LifecycleOptions;
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

  function handleLifecycleError(res: import('express').Response, error: unknown): void {
    if (error instanceof AuthLifecycleError) {
      apiError(res, error.status, error.code, error.message, error.fieldErrors);
      return;
    }
    throw error;
  }

  function requireLifecycle(res: import('express').Response): LifecycleOptions | null {
    if (options.lifecycle) return options.lifecycle;
    apiError(res, 503, 'auth_lifecycle_unavailable', 'Email account lifecycle is not configured.');
    return null;
  }

  router.post('/login', async (req, res) => {
    const {
      organizationCode,
      username,
      password,
    } = (req.body ?? {}) as {
      organizationCode?: unknown;
      username?: unknown;
      password?: unknown;
    };
    const normalizedOrganizationCode = typeof organizationCode === 'string'
      ? normalizeOrganizationCode(organizationCode)
      : '';
    const normalizedUsername = typeof username === 'string' ? normalizeUsername(username) : '';
    const validIdentity = isValidOrganizationCode(normalizedOrganizationCode)
      && isValidUsername(normalizedUsername);
    if (!validIdentity || typeof password !== 'string' || !password) {
      const fieldErrors: Record<string, string> = {};
      if (!isValidOrganizationCode(normalizedOrganizationCode)) {
        fieldErrors.organizationCode = 'Organization code is required.';
      }
      if (!isValidUsername(normalizedUsername)) {
        fieldErrors.username = 'Username is required.';
      }
      if (typeof password !== 'string' || !password) fieldErrors.password = 'Password is required.';
      apiError(
        res,
        400,
        'invalid_request',
        'Organization code, username and password are required.',
        fieldErrors,
      );
      return;
    }
    const loginIdentity = `${normalizedOrganizationCode}:${normalizedUsername}`;
    const identifier = loginIdentifierHash(loginIdentity, clientIp(req));
    const rateLimit = await checkLoginRateLimit(db, identifier);
    if (!rateLimit.allowed) {
      res.setHeader('retry-after', String(rateLimit.retryAfterSeconds));
      apiError(res, 429, 'login_rate_limited', 'Too many sign-in attempts. Try again later.');
      return;
    }

    const userFields = {
      userId: appUser.userId,
      masterFn: appUser.masterFn,
      organizationCode: master.loginCode,
      username: appUser.username,
      email: appUser.email,
      fullName: appUser.fullName,
      passwordHash: appUser.passwordHash,
      isActive: appUser.isActive,
    };
    const users = await db.select(userFields)
      .from(appUser)
      .innerJoin(master, eq(master.masterFn, appUser.masterFn))
      .where(and(
        eq(master.loginCode, normalizedOrganizationCode),
        eq(appUser.username, normalizedUsername),
      ))
      .limit(2);
    const user = users.length === 1 ? users[0] : null;
    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      const failure = await recordLoginFailure(db, identifier);
      if (failure.blocked) res.setHeader('retry-after', String(failure.retryAfterSeconds));
      // Identical response for unknown user, ambiguous email and wrong password.
      apiError(
        res,
        401,
        'invalid_credentials',
        'Incorrect organization code, username or password.',
      );
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
      username: user.username,
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
      organizationCode: user.organizationCode,
      username: user.username,
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

  router.post('/invitations', async (req, res) => {
    const lifecycle = requireLifecycle(res);
    if (!lifecycle) return;
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!await hasPermission(db, session, PERMISSIONS.usersInvite)) {
      apiError(res, 403, 'permission_denied', 'You cannot invite users.');
      return;
    }
    const body = (req.body ?? {}) as { email?: unknown; roleId?: unknown };
    if (typeof body.email !== 'string') {
      apiError(res, 400, 'invalid_request', 'Email is required.', {
        email: 'Email is required.',
      });
      return;
    }
    const roleId = typeof body.roleId === 'number'
      ? body.roleId
      : Number(typeof body.roleId === 'string' ? body.roleId : Number.NaN);
    try {
      const invitation = await createInvitation(
        db,
        session,
        { email: body.email, roleId },
        context(res).requestId,
        lifecycle,
      );
      res.status(201).json({ data: invitation, meta: {} });
    } catch (error) {
      handleLifecycleError(res, error);
    }
  });

  router.post('/invitations/actions/accept', async (req, res) => {
    const body = (req.body ?? {}) as {
      token?: unknown;
      fullName?: unknown;
      password?: unknown;
      language?: unknown;
    };
    const token = typeof body.token === 'string' ? body.token : '';
    const identifier = loginIdentifierHash(
      `invitation:${hashOpaqueToken(token)}`,
      clientIp(req),
    );
    const rateLimit = await checkLoginRateLimit(db, identifier);
    if (!rateLimit.allowed) {
      res.setHeader('retry-after', String(rateLimit.retryAfterSeconds));
      apiError(res, 429, 'auth_rate_limited', 'Too many attempts. Try again later.');
      return;
    }
    try {
      const accepted = await acceptInvitation(db, {
        token,
        fullName: typeof body.fullName === 'string' ? body.fullName : '',
        password: typeof body.password === 'string' ? body.password : '',
        language: typeof body.language === 'string' ? body.language : undefined,
      }, context(res).requestId);
      await clearLoginFailures(db, identifier);
      res.status(201).json({ data: accepted, meta: {} });
    } catch (error) {
      await recordLoginFailure(db, identifier);
      handleLifecycleError(res, error);
    }
  });

  router.post('/password-reset/actions/request', async (req, res) => {
    const lifecycle = requireLifecycle(res);
    if (!lifecycle) return;
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    const identifier = loginIdentifierHash(`password-reset:${email}`, clientIp(req));
    const rateLimit = await checkLoginRateLimit(db, identifier);
    if (rateLimit.allowed) {
      try {
        await requestPasswordReset(db, email, context(res).requestId, lifecycle);
        await recordLoginFailure(db, identifier);
      } catch (error) {
        // Deliberately keep an identical response for existing and unknown accounts.
        const errorType = error instanceof Error ? error.name : 'UnknownError';
        console.error(
          `[erp-system-api] password reset request ${context(res).requestId} failed (${errorType})`,
        );
      }
    }
    res.status(202).json({
      data: {
        accepted: true,
        message: 'If the account exists, password reset instructions will be sent.',
      },
      meta: {},
    });
  });

  router.post('/password-reset/actions/confirm', async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const identifier = loginIdentifierHash(
      `password-confirm:${hashOpaqueToken(token)}`,
      clientIp(req),
    );
    const rateLimit = await checkLoginRateLimit(db, identifier);
    if (!rateLimit.allowed) {
      res.setHeader('retry-after', String(rateLimit.retryAfterSeconds));
      apiError(res, 429, 'auth_rate_limited', 'Too many attempts. Try again later.');
      return;
    }
    try {
      await confirmPasswordReset(db, token, password, context(res).requestId);
      await clearLoginFailures(db, identifier);
      res.json({ data: { ok: true }, meta: {} });
    } catch (error) {
      await recordLoginFailure(db, identifier);
      handleLifecycleError(res, error);
    }
  });

  return router;
}
