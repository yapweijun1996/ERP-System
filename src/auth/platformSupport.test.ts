import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  auditLog,
  company,
  master,
  platformPrincipal,
  platformRole,
  role,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import {
  createPlatformSession,
  createSupportAccessGrant,
  evaluateSupportAccess,
  getPlatformSession,
  PLATFORM_PERMISSIONS,
  provisionPlatformPrincipal,
  revokeSupportAccessGrant,
  type PlatformSessionData,
} from './platformSupport';

const NOW = new Date('2026-08-09T00:00:00.000Z');

async function platformFixture() {
  const db = await freshDb();
  await seedDemo(db);
  const provisioned = await provisionPlatformPrincipal(db, {
    principalKey: 'support-admin',
    displayName: 'Support Admin',
    roleCodes: ['platform_support_admin'],
  });
  const credentials = await createPlatformSession(db, provisioned.principalId, { now: NOW });
  const session = await getPlatformSession(db, credentials.token, { now: NOW });
  if (!session) throw new Error('platform fixture session was not created');
  return { db, principalId: provisioned.principalId, credentials, session };
}

function grantInput(overrides: Partial<Parameters<typeof createSupportAccessGrant>[2]> = {}) {
  return {
    masterFn: 'M1',
    companyFn: 'C-SG',
    reason: 'Investigate invoice rendering failure',
    ticketReference: 'SUP-1001',
    mode: 'read_only' as const,
    validFrom: NOW,
    validUntil: new Date(NOW.getTime() + 60 * 60 * 1000),
    ...overrides,
  };
}

describe('platform principal and support access boundary', () => {
  it('uses a separate platform role/session domain', async () => {
    const { db, principalId, credentials, session } = await platformFixture();
    expect(session.permissions).toEqual(expect.arrayContaining([
      PLATFORM_PERMISSIONS.supportGrant,
      PLATFORM_PERMISSIONS.supportUse,
      PLATFORM_PERMISSIONS.supportRevoke,
    ]));
    expect(await db.select().from(platformRole)).toHaveLength(2);
    expect(await db.select().from(role).where(eq(role.name, 'platform_support_admin'))).toHaveLength(0);
    expect(await db.select().from(platformPrincipal).where(eq(platformPrincipal.principalId, principalId))).toHaveLength(1);
    await expect(getPlatformSession(db, credentials.token, { now: new Date(NOW.getTime() + 9 * 60 * 60 * 1000) }))
      .resolves.toBeNull();
  });

  it('does not let a tenant app user become a platform session', async () => {
    const db = await freshDb();
    await seedDemo(db);
    await expect(createPlatformSession(db, 1, { now: NOW }))
      .rejects.toMatchObject({ code: 'platform_principal_inactive' });
  });

  it('requires an active grant, exact tenant/company scope and read-only enforcement', async () => {
    const { db, session } = await platformFixture();
    const grant = await createSupportAccessGrant(db, session, grantInput(), 'platform-test-create', NOW);
    await expect(evaluateSupportAccess(db, session, {
      grantId: grant.id, masterFn: 'M1', companyFn: 'C-SG', operation: 'read',
    }, 'platform-test-read', NOW)).resolves.toMatchObject({
      allowed: true, reasonCode: 'ALLOWED', mode: 'read_only',
    });
    await expect(evaluateSupportAccess(db, session, {
      grantId: grant.id, masterFn: 'M1', companyFn: 'C-SG', operation: 'write',
    }, 'platform-test-write', NOW)).resolves.toMatchObject({
      allowed: false, reasonCode: 'SUPPORT_ACCESS_OPERATION_DENIED',
    });
    await expect(evaluateSupportAccess(db, session, {
      grantId: grant.id, masterFn: 'M1', companyFn: 'C-SG', operation: 'read', sensitiveField: 'hr.salary',
    }, 'platform-test-sensitive', NOW)).resolves.toMatchObject({
      allowed: false, reasonCode: 'SUPPORT_ACCESS_SENSITIVE_FIELD_DENIED',
    });
    await expect(evaluateSupportAccess(db, session, {
      grantId: grant.id, masterFn: 'M1', companyFn: 'C-MY', operation: 'read',
    }, 'platform-test-company', NOW)).resolves.toMatchObject({
      allowed: false, reasonCode: 'SUPPORT_ACCESS_DENIED',
    });
    await db.insert(master).values({ masterFn: 'M2', loginCode: 'OTHER', name: 'Other Group' });
    await db.insert(company).values({
      companyFn: 'C-OTHER', masterFn: 'M2', name: 'Other Company', country: 'SG',
      currency: 'SGD', taxRegime: 'GST', locale: 'en',
    });
    await expect(evaluateSupportAccess(db, session, {
      grantId: grant.id, masterFn: 'M2', companyFn: 'C-OTHER', operation: 'read',
    }, 'platform-test-cross-master', NOW)).resolves.toMatchObject({
      allowed: false, reasonCode: 'SUPPORT_ACCESS_DENIED',
    });
  });

  it('uses an exclusive expiry boundary and immediate revocation', async () => {
    const { db, session } = await platformFixture();
    const grant = await createSupportAccessGrant(db, session, grantInput(), 'platform-test-window', NOW);
    const validUntil = new Date(NOW.getTime() + 60 * 60 * 1000);
    await expect(evaluateSupportAccess(db, session, {
      grantId: grant.id, masterFn: 'M1', companyFn: 'C-SG', operation: 'read',
    }, 'platform-test-expiry', validUntil)).resolves.toMatchObject({
      allowed: false, reasonCode: 'SUPPORT_ACCESS_EXPIRED',
    });
    await revokeSupportAccessGrant(db, session, grant.id, 'Incident closed', 'platform-test-revoke', NOW);
    await expect(evaluateSupportAccess(db, session, {
      grantId: grant.id, masterFn: 'M1', companyFn: 'C-SG', operation: 'read',
    }, 'platform-test-after-revoke', NOW)).resolves.toMatchObject({
      allowed: false, reasonCode: 'SUPPORT_ACCESS_REVOKED',
    });
    const audits = await db.select({ action: auditLog.action, platformPrincipalId: auditLog.platformPrincipalId })
      .from(auditLog)
      .where(and(
        eq(auditLog.platformPrincipalId, session.principalId),
        eq(auditLog.entity, 'platform/support-grants'),
      ));
    expect(audits.map((audit) => audit.action)).toEqual(expect.arrayContaining([
      'support_grant_created', 'support_grant_revoked',
    ]));
    expect(audits.every((audit) => audit.platformPrincipalId === session.principalId)).toBe(true);
  });

  it('invalidates every Company snapshot for a Master-wide support grant', async () => {
    const { db, session } = await platformFixture();
    const before = await db.select({
      companyFn: company.companyFn,
      authorizationVersion: company.authorizationVersion,
    }).from(company).where(eq(company.masterFn, 'M1'));

    const grant = await createSupportAccessGrant(db, session, grantInput({ companyFn: null }),
      'platform-test-master-wide-create', NOW);
    const afterCreate = await db.select({
      companyFn: company.companyFn,
      authorizationVersion: company.authorizationVersion,
    }).from(company).where(eq(company.masterFn, 'M1'));
    expect(afterCreate).toHaveLength(before.length);
    for (const row of afterCreate) {
      const previous = before.find((candidate) => candidate.companyFn === row.companyFn);
      expect(row.authorizationVersion).toBe((previous?.authorizationVersion ?? 0) + 1);
    }

    await revokeSupportAccessGrant(db, session, grant.id, 'Master incident closed',
      'platform-test-master-wide-revoke', NOW);
    const afterRevoke = await db.select({
      companyFn: company.companyFn,
      authorizationVersion: company.authorizationVersion,
    }).from(company).where(eq(company.masterFn, 'M1'));
    for (const row of afterRevoke) {
      const created = afterCreate.find((candidate) => candidate.companyFn === row.companyFn);
      expect(row.authorizationVersion).toBe((created?.authorizationVersion ?? 0) + 1);
    }
  });

  it('defaults restricted writes to deny and models break-glass approval', async () => {
    const { db, session } = await platformFixture();
    const restricted = await createSupportAccessGrant(db, session, grantInput({
      mode: 'restricted_write',
      restrictions: { allowedOperations: ['support.ticket.comment'] },
    }), 'platform-test-restricted', NOW);
    await expect(evaluateSupportAccess(db, session, {
      grantId: restricted.id, masterFn: 'M1', companyFn: 'C-SG', operation: 'support.ticket.comment',
    }, 'platform-test-allowed-operation', NOW)).resolves.toMatchObject({ allowed: true });
    await expect(evaluateSupportAccess(db, session, {
      grantId: restricted.id, masterFn: 'M1', companyFn: 'C-SG', operation: 'finance.payment.approve',
    }, 'platform-test-denied-operation', NOW)).resolves.toMatchObject({
      allowed: false, reasonCode: 'SUPPORT_ACCESS_OPERATION_DENIED',
    });
    await expect(createSupportAccessGrant(db, session, grantInput({
      mode: 'break_glass', restrictions: { allowedOperations: ['support.ticket.comment'] },
    }), 'platform-test-break-glass', NOW)).rejects.toMatchObject({
      code: 'break_glass_approval_required',
    });
    const breakGlass = await createSupportAccessGrant(db, session, grantInput({
      mode: 'break_glass',
      restrictions: {
        allowedOperations: ['support.ticket.comment'],
        breakGlassApprovalReference: 'APP-1001',
      },
    }), 'platform-test-break-glass-approved', NOW);
    await expect(evaluateSupportAccess(db, session, {
      grantId: breakGlass.id, masterFn: 'M1', companyFn: 'C-SG', operation: 'support.ticket.comment',
    }, 'platform-test-break-glass-use', NOW)).resolves.toMatchObject({ allowed: true, mode: 'break_glass' });
  });

  it('does not allow a support engineer to grant or revoke access', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const provisioned = await provisionPlatformPrincipal(db, {
      principalKey: 'support-engineer',
      displayName: 'Support Engineer',
      roleCodes: ['platform_support_engineer'],
    });
    const credentials = await createPlatformSession(db, provisioned.principalId, { now: NOW });
    const session = await getPlatformSession(db, credentials.token, { now: NOW }) as PlatformSessionData;
    await expect(createSupportAccessGrant(db, session, grantInput(), 'platform-test-engineer-grant', NOW))
      .rejects.toMatchObject({ code: 'platform_permission_denied' });
  });
});
