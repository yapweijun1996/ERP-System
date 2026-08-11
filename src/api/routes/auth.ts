import { Router, type Request } from 'express';
import { and, asc, eq, gt, isNull, or } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  appUser, company, companyOnboarding, employee, employeeActivationSecret, master, role,
  userCompany, userCompanyRole,
} from '../../data/schema';
import { verifyPassword } from '../../auth/password';
import { hashPassword } from '../../auth/password';
import {
  isValidOrganizationCode,
  isValidUsername,
  normalizeOrganizationCode,
  normalizeUsername,
} from '../../auth/identifiers';
import {
  CSRF_COOKIE,
  DEFAULT_ABSOLUTE_TTL_MS,
  DEFAULT_IDLE_TTL_MS,
  REMEMBERED_ABSOLUTE_TTL_MS,
  REMEMBERED_IDLE_TTL_MS,
  SESSION_COOKIE,
  createSession,
  destroySession,
  getSession,
  impersonateSession,
  returnFromImpersonation,
  parseCookies,
  switchSessionCompany,
} from '../../auth/session';
import {
  checkLoginRateLimit,
  clearLoginFailures,
  loginIdentifierHash,
  recordLoginFailure,
} from '../../auth/rateLimit';
import {
  PERMISSIONS,
  effectiveCapabilities,
  hasPermission,
  isSuperadminSession,
} from '../../auth/permissions';
import { listCompanyModules } from '../../auth/moduleAccess';
import { COMPANY_OWNER_ROLE_TEMPLATE_KEY } from '../../auth/accessCatalog';
import { activeRoleAssignmentCondition } from '../../auth/roleAssignmentState';
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
import { withTenantTransaction } from '../../data/tenantTransaction';
import {
  completeEmployeeActivation,
  EmployeeAccountError,
} from '../../modules/hr/employeeAccount';

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
  router.use((_req, res, next) => {
    /* Auth responses must never be replayed by a CDN, browser cache or an
     * intermediary without considering the browser's session cookie. */
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    next();
  });
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
      rememberDevice,
    } = (req.body ?? {}) as {
      organizationCode?: unknown;
      username?: unknown;
      password?: unknown;
      rememberDevice?: unknown;
    };
    const keepDeviceSignedIn = rememberDevice === true;
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
      accountState: appUser.accountState,
      passwordChangeRequired: appUser.passwordChangeRequired,
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
    const credentialsValid = Boolean(
      user && user.isActive && verifyPassword(password, user.passwordHash),
    );
    if (!user || !credentialsValid) {
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
      .orderBy(asc(userCompany.createdAt), asc(userCompany.companyFn))
      .limit(1);
    if (!assignment) {
      apiError(res, 403, 'no_company_access', 'This user has no company assignments.');
      return;
    }
    const [onboarding] = await db.select({ status: companyOnboarding.status })
      .from(companyOnboarding).where(and(
        eq(companyOnboarding.masterFn, user.masterFn),
        eq(companyOnboarding.companyFn, assignment.companyFn),
      )).limit(1);
    if (onboarding?.status === 'setup') {
      const [superadmin] = await db.select({ roleId: role.roleId })
        .from(userCompanyRole)
        .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
        .where(and(
          eq(userCompanyRole.userId, user.userId),
          eq(userCompanyRole.companyFn, assignment.companyFn),
          eq(role.masterFn, user.masterFn),
          eq(role.companyFn, assignment.companyFn),
          eq(role.sourceTemplateKey, COMPANY_OWNER_ROLE_TEMPLATE_KEY),
          activeRoleAssignmentCondition(),
        )).limit(1);
      if (!superadmin) {
        apiError(res, 403, 'company_setup_in_progress', 'This company is not live yet.');
        return;
      }
    }
    if (user.passwordChangeRequired) {
      const temporaryCredential = await withTenantTransaction(db, {
        masterFn: user.masterFn,
        companyFn: assignment.companyFn,
      }, async (tx) => {
        const [row] = await tx.select({ id: employeeActivationSecret.id })
          .from(employeeActivationSecret)
          .where(and(
            eq(employeeActivationSecret.masterFn, user.masterFn),
            eq(employeeActivationSecret.companyFn, assignment.companyFn),
            eq(employeeActivationSecret.userId, user.userId),
            isNull(employeeActivationSecret.clearedAt),
            gt(employeeActivationSecret.expiresAt, new Date()),
          ))
          .limit(1);
        return row;
      });
      if (!temporaryCredential) {
        await recordLoginFailure(db, identifier);
        apiError(
          res,
          401,
          'invalid_credentials',
          'Incorrect organization code, username or password.',
        );
        return;
      }
    }

    await clearLoginFailures(db, identifier);
    const created = await createSession(db, {
      userId: user.userId,
      masterFn: user.masterFn,
      activeCompanyFn: assignment.companyFn,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      accountState: user.accountState as 'preactivated' | 'active' | 'offboarded',
      passwordChangeRequired: user.passwordChangeRequired,
      userAgent: req.header('user-agent'),
      absoluteTtlMs: keepDeviceSignedIn ? REMEMBERED_ABSOLUTE_TTL_MS : DEFAULT_ABSOLUTE_TTL_MS,
      idleTtlMs: keepDeviceSignedIn ? REMEMBERED_IDLE_TTL_MS : DEFAULT_IDLE_TTL_MS,
      rememberedDevice: keepDeviceSignedIn,
    });
    res.cookie(SESSION_COOKIE, created.sessionId, {
      ...cookieCommon,
      httpOnly: true,
      maxAge: keepDeviceSignedIn ? REMEMBERED_ABSOLUTE_TTL_MS : DEFAULT_ABSOLUTE_TTL_MS,
    });
    res.cookie(CSRF_COOKIE, created.csrfToken, {
      ...cookieCommon,
      httpOnly: false,
      maxAge: keepDeviceSignedIn ? REMEMBERED_ABSOLUTE_TTL_MS : DEFAULT_ABSOLUTE_TTL_MS,
    });
    res.json({
      userId: user.userId,
      organizationCode: user.organizationCode,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      masterFn: user.masterFn,
      activeCompanyFn: assignment.companyFn,
      accountState: user.accountState,
      passwordChangeRequired: user.passwordChangeRequired,
    });
  });

  router.post('/logout', async (req, res) => {
    if (context(res).platformSimulation) {
      apiError(res, 409, 'platform_simulation_return_required',
        'Return to the Platform workspace before signing out of the simulated tenant session.');
      return;
    }
    const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const session = await getSession(db, sessionId, { touch: false });
    if (session?.impersonatorUserId != null) {
      await appendAudit(db, {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
        actorUserId: session.impersonatorUserId,
        requestId: context(res).requestId,
        entity: 'app_session',
        entityId: session.userId,
        action: 'impersonation_ended',
        after: { targetUserId: session.userId, reason: 'Signed out while viewing employee workspace' },
      });
    }
    await destroySession(db, sessionId);
    clearAuthCookies(res, options.secureCookies);
    res.json({ data: { ok: true }, meta: {} });
  });

  router.get('/session', async (req, res) => {
    const session = await requireSession(db, req, res, {
      allowActivationPending: true,
      allowStaleAuthorization: true,
    });
    if (!session) return;
    const [capabilities, modules, onboarding, companyAssignments] = await Promise.all([
      effectiveCapabilities(db, session),
      listCompanyModules(db, session.masterFn, session.activeCompanyFn),
      db.select({
        status: companyOnboarding.status,
        currentStage: companyOnboarding.currentStage,
      }).from(companyOnboarding).where(and(
        eq(companyOnboarding.masterFn, session.masterFn),
        eq(companyOnboarding.companyFn, session.activeCompanyFn),
      )).limit(1),
      db.select({ companyFn: userCompany.companyFn }).from(userCompany)
        .innerJoin(company, eq(company.companyFn, userCompany.companyFn))
        .where(and(
          eq(userCompany.userId, session.userId),
          eq(company.masterFn, session.masterFn),
        ))
        .orderBy(asc(userCompany.createdAt), asc(userCompany.companyFn)),
    ]);
    res.json({
      ...session,
      capabilities,
      modules,
      onboarding: onboarding[0] ?? null,
      companyFns: companyAssignments.map((assignment) => assignment.companyFn),
    });
  });

  router.get('/session/employee-workspace-targets', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (session.impersonatorUserId != null) {
      apiError(res, 409, 'impersonation_already_active', 'Return to Superadmin before choosing another employee workspace.');
      return;
    }
    if (!await isSuperadminSession(db, session)) {
      apiError(res, 403, 'superadmin_required', 'Only a Superadmin can choose an employee workspace.');
      return;
    }

    const [targetRows, superadminRows] = await Promise.all([
      db.select({
        employeeId: employee.id,
        userId: appUser.userId,
        username: appUser.username,
        fullName: employee.fullName,
        employeeNo: employee.employeeNo,
        department: employee.department,
        jobTitle: employee.jobTitle,
        accountState: appUser.accountState,
      }).from(employee)
        .innerJoin(appUser, eq(appUser.userId, employee.userId))
        .innerJoin(userCompany, and(
          eq(userCompany.userId, appUser.userId),
          eq(userCompany.companyFn, session.activeCompanyFn),
        ))
        .where(and(
          eq(employee.masterFn, session.masterFn),
          eq(employee.companyFn, session.activeCompanyFn),
          eq(employee.isActive, true),
          eq(appUser.masterFn, session.masterFn),
          eq(appUser.isActive, true),
          or(eq(appUser.accountState, 'active'), eq(appUser.accountState, 'preactivated')),
        )),
      db.select({ userId: userCompanyRole.userId })
        .from(userCompanyRole)
        .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
        .where(and(
          eq(userCompanyRole.companyFn, session.activeCompanyFn),
          eq(role.masterFn, session.masterFn),
          eq(role.sourceTemplateKey, COMPANY_OWNER_ROLE_TEMPLATE_KEY),
          activeRoleAssignmentCondition(),
        )),
    ]);
    const superadminIds = new Set(superadminRows.map((row) => row.userId));
    const data = targetRows
      .filter((target) => !superadminIds.has(target.userId))
      .sort((left, right) => left.fullName.localeCompare(right.fullName))
      .map((target) => ({
        employeeId: target.employeeId,
        userId: target.userId,
        username: target.username,
        fullName: target.fullName,
        employeeNo: target.employeeNo,
        department: target.department,
        jobTitle: target.jobTitle,
        accountState: target.accountState,
      }));
    res.json({ data, meta: { count: data.length } });
  });

  router.post('/activation/actions/complete', async (req, res) => {
    const session = await requireSession(db, req, res, { allowActivationPending: true });
    if (!session) return;
    if (session.impersonatorUserId != null) {
      apiError(res, 403, 'impersonation_action_not_allowed', 'Complete employee activation from the employee sign-in flow.');
      return;
    }
    if (!session.passwordChangeRequired) {
      apiError(res, 409, 'activation_not_required', 'This account does not require activation.');
      return;
    }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const confirmPassword = typeof req.body?.confirmPassword === 'string'
      ? req.body.confirmPassword
      : '';
    const fieldErrors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = 'Enter a valid email address.';
    if (password.length < 8) fieldErrors.password = 'Use at least 8 characters.';
    if (password !== confirmPassword) fieldErrors.confirmPassword = 'Passwords do not match.';
    if (Object.keys(fieldErrors).length) {
      apiError(res, 400, 'invalid_request', 'Complete all activation fields.', fieldErrors);
      return;
    }
    const [currentUser] = await db.select({ passwordHash: appUser.passwordHash })
      .from(appUser).where(eq(appUser.userId, session.userId)).limit(1);
    if (currentUser && verifyPassword(password, currentUser.passwordHash)) {
      apiError(res, 400, 'password_reused', 'Choose a password different from the temporary password.', {
        password: 'Choose a new password.',
      });
      return;
    }
    try {
      await withTenantTransaction(db, {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
      }, (tx) => completeEmployeeActivation(
        tx,
        session.userId,
        email,
        hashPassword(password),
        context(res).requestId,
      ));
      clearAuthCookies(res, options.secureCookies);
      res.json({ data: { ok: true, signInAgain: true }, meta: {} });
    } catch (error) {
      if (error instanceof EmployeeAccountError) {
        apiError(res, error.status, error.code, error.message, error.fieldErrors);
        return;
      }
      throw error;
    }
  });

  router.post('/session/actions/switch-company', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (context(res).platformSimulation) {
      apiError(res, 409, 'platform_simulation_company_locked',
        'Return to the Platform workspace before switching company.');
      return;
    }
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

  router.post('/session/actions/impersonate', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (session.impersonatorUserId != null) {
      apiError(res, 409, 'impersonation_already_active', 'Return to Superadmin before entering another employee workspace.');
      return;
    }
    if (!await isSuperadminSession(db, session)) {
      apiError(res, 403, 'superadmin_required', 'Only a Superadmin can enter an employee workspace.');
      return;
    }
    const targetUserId = Number(req.body?.targetUserId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
      apiError(res, 400, 'invalid_request', 'A valid employee account is required.', {
        targetUserId: 'Select an employee account.',
      });
      return;
    }
    if (reason.length > 240) {
      apiError(res, 400, 'invalid_request', 'The audit reason is too long.', {
        reason: 'Use 240 characters or fewer.',
      });
      return;
    }
    const [target] = await db.select({
      userId: appUser.userId,
      username: appUser.username,
      fullName: appUser.fullName,
      employeeId: employee.id,
    }).from(appUser)
      .innerJoin(userCompany, and(
        eq(userCompany.userId, appUser.userId),
        eq(userCompany.companyFn, session.activeCompanyFn),
      ))
      .innerJoin(employee, and(
        eq(employee.userId, appUser.userId),
        eq(employee.masterFn, session.masterFn),
        eq(employee.companyFn, session.activeCompanyFn),
      ))
      .where(and(
        eq(appUser.userId, targetUserId),
        eq(appUser.masterFn, session.masterFn),
        eq(appUser.isActive, true),
        or(eq(appUser.accountState, 'active'), eq(appUser.accountState, 'preactivated')),
        eq(employee.isActive, true),
      )).limit(1);
    if (!target) {
      apiError(res, 404, 'employee_account_not_found', 'Only an active linked employee account can be opened.');
      return;
    }
    const [superadminTarget] = await db.select({ roleId: userCompanyRole.roleId })
      .from(userCompanyRole)
      .innerJoin(role, eq(role.roleId, userCompanyRole.roleId))
      .where(and(
        eq(userCompanyRole.userId, targetUserId),
        eq(userCompanyRole.companyFn, session.activeCompanyFn),
        eq(role.masterFn, session.masterFn),
        eq(role.sourceTemplateKey, COMPANY_OWNER_ROLE_TEMPLATE_KEY),
        activeRoleAssignmentCondition(),
      )).limit(1);
    if (superadminTarget) {
      apiError(res, 409, 'target_superadmin_not_allowed', 'Superadmin accounts cannot be entered as employee workspaces.');
      return;
    }
    const ctx = context(res);
    const changed = await withTenantTransaction(db, {
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
    }, async (tx) => {
      const entered = await impersonateSession(tx, ctx.sessionId!, targetUserId);
      if (!entered) {
        apiError(res, 409, 'impersonation_conflict', 'This session changed. Reload and try again.');
        return null;
      }
      await appendAudit(tx, {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
        actorUserId: session.userId,
        requestId: ctx.requestId,
        entity: 'app_session',
        entityId: targetUserId,
        action: 'impersonation_started',
        after: {
          targetUserId,
          targetEmployeeId: target.employeeId,
          targetUsername: target.username,
          reason: reason || 'Superadmin employee workspace review',
        },
      });
      return entered;
    });
    if (!changed) return;
    ctx.session = changed;
    res.json({ data: changed, meta: { impersonating: true } });
  });

  router.post('/session/actions/return-to-superadmin', async (req, res) => {
    const session = await requireSession(db, req, res);
    if (!session) return;
    if (!session.impersonatorUserId) {
      apiError(res, 409, 'impersonation_not_active', 'This session is not viewing an employee workspace.');
      return;
    }
    const ctx = context(res);
    const originalUserId = session.impersonatorUserId;
    const [original] = await db.select({
      userId: appUser.userId,
      username: appUser.username,
      fullName: appUser.fullName,
    }).from(appUser)
      .innerJoin(userCompany, and(
        eq(userCompany.userId, appUser.userId),
        eq(userCompany.companyFn, session.activeCompanyFn),
      ))
      .where(and(
        eq(appUser.userId, originalUserId),
        eq(appUser.masterFn, session.masterFn),
        eq(appUser.isActive, true),
      )).limit(1);
    if (!original) {
      apiError(res, 409, 'original_superadmin_unavailable', 'The original Superadmin account is no longer available. Sign out and sign in again.');
      return;
    }
    const restored = await withTenantTransaction(db, {
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
    }, async (tx) => {
      const result = await returnFromImpersonation(tx, ctx.sessionId!);
      if (!result) return null;
      await appendAudit(tx, {
        masterFn: session.masterFn,
        companyFn: session.activeCompanyFn,
        actorUserId: originalUserId,
        requestId: ctx.requestId,
        entity: 'app_session',
        entityId: session.userId,
        action: 'impersonation_ended',
        after: { targetUserId: session.userId, reason: 'Returned to Superadmin' },
      });
      return result;
    });
    if (!restored) {
      apiError(res, 409, 'impersonation_conflict', 'This session changed. Reload and try again.');
      return;
    }
    ctx.session = restored;
    res.json({ data: restored, meta: { impersonating: false } });
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
