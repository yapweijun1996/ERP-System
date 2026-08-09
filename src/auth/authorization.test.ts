import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  appUser,
  userPermissionOverride,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import {
  authorize,
  explainAuthorization,
  principalFromSession,
} from './authorization';
import { effectiveCapabilities, hasPermission } from './permissions';
import type { SessionData } from './session';
import '../api/resources';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

function sessionFor(user: Pick<SessionData, 'userId' | 'username' | 'email' | 'fullName'>): SessionData {
  return {
    ...user,
    ...scope,
    activeCompanyFn: scope.companyFn,
  };
}

async function fixture() {
  const db = await freshDb();
  await seedDemo(db);
  const [viewer] = await db.select({
    userId: appUser.userId,
    username: appUser.username,
    email: appUser.email,
    fullName: appUser.fullName,
  }).from(appUser).where(eq(appUser.username, 'viewer'));
  const [admin] = await db.select({
    userId: appUser.userId,
    username: appUser.username,
    email: appUser.email,
    fullName: appUser.fullName,
  }).from(appUser).where(eq(appUser.username, 'admin'));
  return { db, viewer: sessionFor(viewer), admin: sessionFor(admin) };
}

function overrideValues(
  session: SessionData,
  input: Partial<typeof userPermissionOverride.$inferInsert> & Pick<typeof userPermissionOverride.$inferInsert, 'permissionKey' | 'effect'>,
) {
  return {
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    userId: session.userId,
    resourceKey: null,
    scope: 'company',
    targetType: 'none',
    targetId: '',
    reason: 'Authorization regression test',
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: null,
    assignedByUserId: session.userId,
    ...input,
  };
}

describe('central authorization decision service', () => {
  it('returns safe decisions, rejects unknown keys, and keeps public output non-enumerating', async () => {
    const { db, viewer, admin } = await fixture();
    const allowed = await authorize(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'inventory.read',
    });
    expect(allowed).toEqual({ allowed: true, reasonCode: 'ALLOW_ROLE_PERMISSION' });

    const unknown = await authorize(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'inventory.secret.write',
    });
    expect(unknown).toEqual({ allowed: false, reasonCode: 'DENY_PERMISSION_NOT_REGISTERED' });

    const explanation = await explainAuthorization(db, {
      principal: principalFromSession(admin),
      permissionKey: 'inventory.read',
    });
    expect(explanation.allowed).toBe(true);
    expect(explanation.matchedAssignmentId).toBeTypeOf('number');
    expect(allowed).not.toHaveProperty('matchedAssignmentId');
    expect(allowed).not.toHaveProperty('candidateKeys');
  });

  it('applies explicit deny before role grants and before explicit allows', async () => {
    const { db, viewer } = await fixture();
    await db.insert(userPermissionOverride).values([
      overrideValues(viewer, { permissionKey: 'inventory.read', effect: 'allow' }),
      overrideValues(viewer, { permissionKey: 'inventory.read', effect: 'deny' }),
    ]);

    const decision = await authorize(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'inventory.read',
    });
    expect(decision).toEqual({ allowed: false, reasonCode: 'DENY_EXPLICIT' });
    expect(await hasPermission(db, viewer, 'inventory.read')).toBe(false);

    const explanation = await explainAuthorization(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'inventory.read',
    });
    expect(explanation).toMatchObject({
      allowed: false,
      reasonCode: 'DENY_EXPLICIT',
      conflictingOverride: true,
      matchedEffect: 'deny',
    });
  });

  it('keeps resource and department-scoped denies narrow to their target', async () => {
    const { db, viewer } = await fixture();
    await db.insert(userPermissionOverride).values([
      overrideValues(viewer, {
        permissionKey: 'inventory.read',
        resourceKey: 'inventory/products',
        effect: 'deny',
      }),
      overrideValues(viewer, {
        permissionKey: 'inventory.read',
        effect: 'deny',
        scope: 'department',
        targetType: 'department',
        targetId: 'Sales',
      }),
    ]);

    expect(await authorize(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'inventory.read',
      resourceKey: 'inventory/products',
      scopeTarget: { scope: 'department', targetType: 'department', targetId: 'Sales' },
    })).toEqual({ allowed: false, reasonCode: 'DENY_EXPLICIT' });
    expect(await authorize(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'inventory.read',
      resourceKey: 'inventory/stock-levels',
      scopeTarget: { scope: 'department', targetType: 'department', targetId: 'Warehouse' },
    })).toEqual({ allowed: true, reasonCode: 'ALLOW_ROLE_PERMISSION' });
    // A narrow deny without record context fails closed instead of becoming a
    // broad allow during a permission-only preflight.
    expect(await authorize(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'inventory.read',
    })).toEqual({ allowed: false, reasonCode: 'DENY_EXPLICIT' });
  });

  it('fails closed when server-resolved module context mismatches the permission', async () => {
    const { db, viewer } = await fixture();
    const decision = await authorize(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'inventory.read',
      context: {
        moduleKey: 'finance',
        approvalInstanceId: 101,
        approvalStepId: 202,
      },
    });
    expect(decision).toEqual({ allowed: false, reasonCode: 'DENY_CONTEXT_MISMATCH' });

    const explanation = await explainAuthorization(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'inventory.read',
      context: { moduleKey: 'finance' },
    });
    expect(explanation).toMatchObject({
      allowed: false,
      reasonCode: 'DENY_CONTEXT_MISMATCH',
      context: { moduleKey: 'finance' },
    });
  });

  it('allows a registered exception and projects it into effective capabilities', async () => {
    const { db, viewer } = await fixture();
    await db.insert(userPermissionOverride).values(overrideValues(viewer, {
      permissionKey: 'inventory.adjust',
      effect: 'allow',
    }));

    expect(await authorize(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'inventory.adjust',
    })).toEqual({ allowed: true, reasonCode: 'ALLOW_EXPLICIT_OVERRIDE' });
    expect(await effectiveCapabilities(db, viewer)).toMatchObject({
      permissions: expect.arrayContaining(['inventory.adjust']),
      scopes: { '*': 'company' },
    });
  });

  it('ignores expired and revoked overrides', async () => {
    const { db, viewer } = await fixture();
    await db.insert(userPermissionOverride).values([
      overrideValues(viewer, {
        permissionKey: 'inventory.adjust',
        effect: 'allow',
        validUntil: new Date('2026-02-01T00:00:00Z'),
      }),
      overrideValues(viewer, {
        permissionKey: 'finance.write',
        effect: 'allow',
        revokedAt: new Date('2026-02-01T00:00:00Z'),
        revokedByUserId: viewer.userId,
        revocationReason: 'Test revoke',
      }),
    ]);
    expect(await authorize(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'inventory.adjust',
      now: new Date('2026-08-10T00:00:00Z'),
    })).toEqual({ allowed: false, reasonCode: 'DENY_PERMISSION_NOT_GRANTED' });
    expect(await authorize(db, {
      principal: principalFromSession(viewer),
      permissionKey: 'finance.write',
      now: new Date('2026-08-10T00:00:00Z'),
    })).toEqual({ allowed: false, reasonCode: 'DENY_PERMISSION_NOT_GRANTED' });
    const active = await db.select().from(userPermissionOverride).where(and(
      eq(userPermissionOverride.userId, viewer.userId),
      eq(userPermissionOverride.companyFn, scope.companyFn),
    ));
    expect(active).toHaveLength(2);
  });
});
