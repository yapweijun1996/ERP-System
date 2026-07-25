import { and, eq, gt, isNull } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appSession,
  appUser,
  company,
  employee,
  outboxEvent,
  passwordResetToken,
  role,
  userCompany,
  userCompanyRole,
  userInvitation,
} from '../data/schema';
import { withTenantTransaction } from '../data/tenantTransaction';
import { appendAudit } from '../api/audit';
import { AuthLifecycleError } from './authErrors';
import { hashPassword } from './password';
import { usernameFromEmail } from './identifiers';
import type { SessionData } from './session';
import {
  encryptToken,
  hashOpaqueToken,
  newOpaqueToken,
} from './tokenCrypto';

export { AuthLifecycleError } from './authErrors';

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const SUPPORTED_LANGUAGES = new Set(['en', 'ms', 'zh', 'ja', 'vi']);

export interface LifecycleOptions {
  tokenEncryptionKey: Buffer;
  publicUrl: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthLifecycleError(400, 'invalid_request', 'Enter a valid email address.', {
      email: 'Enter a valid email address.',
    });
  }
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new AuthLifecycleError(400, 'invalid_request', 'Password must be at least 8 characters.', {
      password: 'Use at least 8 characters.',
    });
  }
}

function safePublicUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export async function createInvitation(
  db: DB,
  session: SessionData,
  input: { email: string; roleId: number },
  requestId: string,
  options: LifecycleOptions,
  now = new Date(),
): Promise<{ id: number; email: string; expiresAt: Date }> {
  const email = normalizeEmail(input.email);
  validateEmail(email);
  if (!Number.isSafeInteger(input.roleId) || input.roleId <= 0) {
    throw new AuthLifecycleError(400, 'invalid_request', 'Select a valid role.', {
      roleId: 'Role is required.',
    });
  }

  return withTenantTransaction(db, {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
  }, async (tx) => {
    const [targetRole] = await tx.select({ roleId: role.roleId })
      .from(role)
      .where(and(
        eq(role.roleId, input.roleId),
        eq(role.masterFn, session.masterFn),
      ))
      .limit(1);
    if (!targetRole) {
      throw new AuthLifecycleError(400, 'invalid_role', 'The selected role is unavailable.');
    }

    const [existingUser] = await tx.select({ userId: appUser.userId })
      .from(appUser)
      .where(and(
        eq(appUser.masterFn, session.masterFn),
        eq(appUser.email, email),
      ))
      .limit(1);
    if (existingUser) {
      throw new AuthLifecycleError(409, 'user_exists', 'A user with this email already exists.');
    }

    await tx.update(userInvitation).set({
      expiresAt: now,
      updatedAt: now,
    }).where(and(
      eq(userInvitation.masterFn, session.masterFn),
      eq(userInvitation.companyFn, session.activeCompanyFn),
      eq(userInvitation.email, email),
      isNull(userInvitation.acceptedAt),
      gt(userInvitation.expiresAt, now),
    ));

    const token = newOpaqueToken();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    const [invitation] = await tx.insert(userInvitation).values({
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
      email,
      roleId: targetRole.roleId,
      tokenHash: hashOpaqueToken(token),
      invitedByUserId: session.userId,
      expiresAt,
    }).returning({ id: userInvitation.id });

    await tx.insert(outboxEvent).values({
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
      topic: 'auth.invitation.created',
      aggregateType: 'user_invitation',
      aggregateId: String(invitation.id),
      payload: {
        to: email,
        template: 'user-invitation',
        token: encryptToken(token, options.tokenEncryptionKey),
        actionUrl: `${safePublicUrl(options.publicUrl)}/accept-invitation`,
        expiresAt: expiresAt.toISOString(),
      },
    });
    await appendAudit(tx, {
      masterFn: session.masterFn,
      companyFn: session.activeCompanyFn,
      actorUserId: session.userId,
      requestId,
      entity: 'user_invitation',
      entityId: invitation.id,
      action: 'create',
      after: { email, roleId: targetRole.roleId, expiresAt: expiresAt.toISOString() },
    });
    return { id: invitation.id, email, expiresAt };
  });
}

export async function acceptInvitation(
  db: DB,
  input: { token: string; fullName: string; password: string; language?: string },
  requestId: string,
  now = new Date(),
): Promise<{ userId: number; email: string }> {
  if (!input.token || typeof input.token !== 'string') {
    throw new AuthLifecycleError(400, 'invitation_invalid', 'The invitation is invalid or expired.');
  }
  const fullName = input.fullName?.trim();
  if (!fullName) {
    throw new AuthLifecycleError(400, 'invalid_request', 'Name is required.', {
      fullName: 'Name is required.',
    });
  }
  validatePassword(input.password ?? '');
  const language = SUPPORTED_LANGUAGES.has(input.language ?? '') ? input.language! : 'en';

  return db.transaction(async (tx) => {
    const [invitation] = await tx.select()
      .from(userInvitation)
      .where(and(
        eq(userInvitation.tokenHash, hashOpaqueToken(input.token)),
        isNull(userInvitation.acceptedAt),
        gt(userInvitation.expiresAt, now),
      ))
      .limit(1)
      .for('update');
    if (!invitation) {
      throw new AuthLifecycleError(400, 'invitation_invalid', 'The invitation is invalid or expired.');
    }

    const [existing] = await tx.select({ userId: appUser.userId })
      .from(appUser)
      .where(and(
        eq(appUser.masterFn, invitation.masterFn),
        eq(appUser.email, invitation.email),
      ))
      .limit(1);
    if (existing) {
      throw new AuthLifecycleError(409, 'invitation_invalid', 'The invitation is invalid or expired.');
    }

    const baseUsername = usernameFromEmail(invitation.email);
    const [usernameTaken] = await tx.select({ userId: appUser.userId })
      .from(appUser)
      .where(and(
        eq(appUser.masterFn, invitation.masterFn),
        eq(appUser.username, baseUsername),
      ))
      .limit(1);
    const username = usernameTaken
      ? `${baseUsername.slice(0, Math.max(3, 63 - String(invitation.id).length))}-${invitation.id}`
      : baseUsername;
    const [created] = await tx.insert(appUser).values({
      masterFn: invitation.masterFn,
      username,
      email: invitation.email,
      fullName,
      passwordHash: hashPassword(input.password),
      language,
    }).returning({ userId: appUser.userId });
    await tx.insert(userCompany).values({
      userId: created.userId,
      companyFn: invitation.companyFn,
      roleId: invitation.roleId,
    });
    await tx.insert(userCompanyRole).values({
      userId: created.userId,
      companyFn: invitation.companyFn,
      roleId: invitation.roleId,
    });
    await tx.update(userInvitation).set({
      acceptedAt: now,
      updatedAt: now,
    }).where(eq(userInvitation.id, invitation.id));
    await appendAudit(tx, {
      masterFn: invitation.masterFn,
      companyFn: invitation.companyFn,
      actorUserId: created.userId,
      requestId,
      entity: 'user_invitation',
      entityId: invitation.id,
      action: 'accept',
      after: { userId: created.userId, username },
    });
    return { userId: created.userId, email: invitation.email };
  });
}

export async function requestPasswordReset(
  db: DB,
  emailInput: string,
  requestId: string,
  options: LifecycleOptions,
  now = new Date(),
): Promise<void> {
  const email = normalizeEmail(emailInput);
  if (!email) return;
  const users = await db.select({
    userId: appUser.userId,
    masterFn: appUser.masterFn,
    isActive: appUser.isActive,
  }).from(appUser).where(eq(appUser.email, email)).limit(2);
  const user = users.length === 1 && users[0].isActive ? users[0] : null;
  if (!user) return;
  // Employee-linked accounts are reset only by HR so the public email flow
  // cannot bypass the audited one-time credential lifecycle.
  const [employeeAccount] = await db.select({ id: employee.id }).from(employee)
    .where(eq(employee.userId, user.userId)).limit(1);
  if (employeeAccount) return;
  const [assignment] = await db.select({ companyFn: userCompany.companyFn })
    .from(userCompany)
    .innerJoin(company, eq(company.companyFn, userCompany.companyFn))
    .where(and(
      eq(userCompany.userId, user.userId),
      eq(company.masterFn, user.masterFn),
    ))
    .limit(1);
  if (!assignment) return;

  await db.transaction(async (tx) => {
    await tx.update(passwordResetToken).set({ usedAt: now })
      .where(and(
        eq(passwordResetToken.userId, user.userId),
        isNull(passwordResetToken.usedAt),
        gt(passwordResetToken.expiresAt, now),
      ));
    const token = newOpaqueToken();
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
    const [reset] = await tx.insert(passwordResetToken).values({
      userId: user.userId,
      tokenHash: hashOpaqueToken(token),
      expiresAt,
    }).returning({ id: passwordResetToken.id });
    await tx.insert(outboxEvent).values({
      masterFn: user.masterFn,
      companyFn: assignment.companyFn,
      topic: 'auth.password-reset.requested',
      aggregateType: 'password_reset_token',
      aggregateId: String(reset.id),
      payload: {
        to: email,
        template: 'password-reset',
        token: encryptToken(token, options.tokenEncryptionKey),
        actionUrl: `${safePublicUrl(options.publicUrl)}/reset-password`,
        expiresAt: expiresAt.toISOString(),
      },
    });
    await appendAudit(tx, {
      masterFn: user.masterFn,
      companyFn: assignment.companyFn,
      actorUserId: user.userId,
      requestId,
      entity: 'password_reset_token',
      entityId: reset.id,
      action: 'request',
      after: { expiresAt: expiresAt.toISOString() },
    });
  });
}

export async function confirmPasswordReset(
  db: DB,
  token: string,
  password: string,
  requestId: string,
  now = new Date(),
): Promise<void> {
  validatePassword(password ?? '');
  if (!token || typeof token !== 'string') {
    throw new AuthLifecycleError(400, 'reset_invalid', 'The reset link is invalid or expired.');
  }
  await db.transaction(async (tx) => {
    const [reset] = await tx.select({
      id: passwordResetToken.id,
      userId: passwordResetToken.userId,
      masterFn: appUser.masterFn,
    }).from(passwordResetToken)
      .innerJoin(appUser, eq(appUser.userId, passwordResetToken.userId))
      .where(and(
        eq(passwordResetToken.tokenHash, hashOpaqueToken(token)),
        isNull(passwordResetToken.usedAt),
        gt(passwordResetToken.expiresAt, now),
      ))
      .limit(1)
      .for('update');
    if (!reset) {
      throw new AuthLifecycleError(400, 'reset_invalid', 'The reset link is invalid or expired.');
    }
    const [employeeAccount] = await tx.select({ id: employee.id }).from(employee)
      .where(eq(employee.userId, reset.userId)).limit(1);
    if (employeeAccount) {
      throw new AuthLifecycleError(
        400,
        'reset_invalid',
        'The reset link is invalid or expired.',
      );
    }
    await tx.update(appUser).set({
      passwordHash: hashPassword(password),
      updatedAt: now,
    }).where(eq(appUser.userId, reset.userId));
    await tx.update(passwordResetToken).set({ usedAt: now })
      .where(eq(passwordResetToken.id, reset.id));
    await tx.update(appSession).set({
      revokedAt: now,
      updatedAt: now,
    }).where(and(
      eq(appSession.userId, reset.userId),
      isNull(appSession.revokedAt),
    ));
    await appendAudit(tx, {
      masterFn: reset.masterFn,
      actorUserId: reset.userId,
      requestId,
      entity: 'app_user',
      entityId: reset.userId,
      action: 'password_reset',
    });
  });
}
