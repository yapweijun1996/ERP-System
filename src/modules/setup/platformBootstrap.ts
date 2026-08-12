import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  platformPrincipal,
  platformPrincipalRole,
  systemState,
} from '../../data/schema';
import { appendAudit } from '../../api/audit';
import {
  ensurePlatformRoles,
  PLATFORM_ROLE_TEMPLATES,
  PlatformAccessError,
} from '../../auth/platformSupport';
import { hashPassword } from '../../auth/password';

const SETUP_STATE_KEY = 'production_setup';

export interface PlatformBootstrapInput {
  principalKey: string;
  displayName: string;
  email: string;
  password: string;
  clientIp?: string;
}

function required(value: unknown, field: string, label: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new PlatformAccessError(400, 'invalid_request', `${label} is required.`);
  }
  return normalized;
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ipDigest(value: string): string {
  return createHash('sha256').update(value || 'unknown').digest('hex');
}

/**
 * Claim the empty production database for the first independent Platform
 * Superadmin. The setup-state row is the serialization point: the counts are
 * checked while it is locked, so two first callers cannot both win.
 */
export async function completePlatformBootstrap(
  db: DB,
  input: PlatformBootstrapInput,
  requestId: string,
): Promise<{ principalId: number; principalKey: string; displayName: string; email: string }> {
  const principalKey = required(input.principalKey, 'principalKey', 'Platform principal key').toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(principalKey)) {
    throw new PlatformAccessError(400, 'invalid_platform_principal', 'principalKey is invalid.');
  }
  const displayName = required(input.displayName, 'displayName', 'Display name');
  if (displayName.length > 160) {
    throw new PlatformAccessError(400, 'invalid_platform_principal', 'displayName is invalid.');
  }
  const email = required(input.email, 'email', 'Email').toLowerCase();
  if (!validEmail(email)) {
    throw new PlatformAccessError(400, 'invalid_request', 'Enter a valid email address.');
  }
  if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 1024) {
    throw new PlatformAccessError(400, 'invalid_platform_password', 'Platform passwords must be from 12 to 1024 characters.');
  }

  return db.transaction(async (transaction) => {
    const exec = transaction as unknown as DB;
    await exec.insert(systemState).values({
      key: SETUP_STATE_KEY,
      value: { status: 'platform_bootstrapping' },
    }).onConflictDoNothing();
    const [setup] = await exec.select({ value: systemState.value })
      .from(systemState)
      .where(eq(systemState.key, SETUP_STATE_KEY))
      .limit(1)
      .for('update');

    const counts = await exec.execute(sql`
      select
        (select count(*)::int from "platform_principal") as platform_principals,
        (select count(*)::int from "master") as masters,
        (select count(*)::int from "company") as companies,
        (select count(*)::int from "app_user") as users,
        (select count(*)::int from "role") as roles,
        (select count(*)::int from "user_company") as memberships,
        (select count(*)::int from "user_company_role") as role_assignments
    `) as { rows: Array<Record<string, unknown>> };
    const row = counts.rows[0] ?? {};
    const nonEmpty = Object.values(row).some((value) => Number(value ?? 0) > 0);
    const setupStatus = (setup?.value as { status?: string } | undefined)?.status;
    if (nonEmpty || (setupStatus && setupStatus !== 'platform_bootstrapping')) {
      throw new PlatformAccessError(409, 'already_initialized', 'Platform bootstrap is available only for an empty database.');
    }

    const roleIds = await ensurePlatformRoles(exec);
    const superadminRoleId = roleIds.get(PLATFORM_ROLE_TEMPLATES.superadmin.code);
    if (!superadminRoleId) {
      throw new PlatformAccessError(500, 'platform_role_unavailable', 'The Platform Superadmin role is unavailable.');
    }
    const [existingKey] = await exec.select({ principalId: platformPrincipal.principalId })
      .from(platformPrincipal)
      .where(eq(platformPrincipal.principalKey, principalKey))
      .limit(1);
    if (existingKey) {
      throw new PlatformAccessError(409, 'platform_principal_exists', 'Platform principal already exists.');
    }
    const [principal] = await exec.insert(platformPrincipal).values({
      principalKey,
      displayName,
      email,
      passwordHash: hashPassword(input.password),
      isActive: true,
    }).returning({ principalId: platformPrincipal.principalId });
    await exec.insert(platformPrincipalRole).values({
      principalId: principal.principalId,
      platformRoleId: superadminRoleId,
    });
    await appendAudit(exec, {
      masterFn: '__platform__',
      platformPrincipalId: principal.principalId,
      requestId,
      entity: 'platform_principal',
      entityId: principal.principalId,
      action: 'bootstrap_create',
      after: {
        principalKey,
        displayName,
        email,
        clientIpHash: ipDigest(input.clientIp ?? 'unknown'),
      },
    });
    await exec.update(systemState).set({
      value: {
        status: 'platform_bootstrapped',
        platformPrincipalId: principal.principalId,
        completedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    }).where(eq(systemState.key, SETUP_STATE_KEY));
    return { principalId: principal.principalId, principalKey, displayName, email };
  });
}
