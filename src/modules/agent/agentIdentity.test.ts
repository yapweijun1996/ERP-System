import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import {
  appUser,
  role,
  userCompanyRole,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { setUserActive } from '../../auth/adminLifecycle';
import type { SessionData } from '../../auth/session';
import { freshDb } from '../../test/helpers';
import {
  createAgentGrant,
  createAgentPrincipal,
  resolveAgentGrantWithin,
  type CreateAgentGrantInput,
} from './agentIdentity';

const NOW = new Date('2026-09-08T12:00:00.000Z');
const PAST = new Date('2026-01-01T00:00:00.000Z');

function sessionFor(user: typeof appUser.$inferSelect): SessionData {
  return {
    userId: user.userId,
    masterFn: user.masterFn,
    activeCompanyFn: 'C-SG',
    username: user.username,
    email: user.email,
    fullName: user.fullName,
  };
}

async function fixture() {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
  const [viewer] = await db.select().from(appUser).where(eq(appUser.email, 'viewer@acme.co'));
  const adminSession = sessionFor(admin);
  return { db, adminSession, admin, viewer };
}

async function addOperatorRole(db: DB, userId: number, assignedByUserId: number): Promise<void> {
  const [operatorRole] = await db.select({ roleId: role.roleId }).from(role).where(and(
    eq(role.masterFn, 'M1'),
    eq(role.companyFn, 'C-SG'),
    eq(role.name, 'Demo Operator'),
  ));
  await db.insert(userCompanyRole).values({
    userId,
    companyFn: 'C-SG',
    roleId: operatorRole.roleId,
    validFrom: PAST,
    assignedByUserId,
    assignmentSource: 'manual',
  });
}

async function principalFor(
  db: DB,
  adminSession: SessionData,
  ownerUserId: number,
  principalKey: string,
) {
  return createAgentPrincipal(db, adminSession, {
    principalKey,
    displayName: `Receipt Agent ${principalKey}`,
    kind: 'delegated_agent',
    ownerUserId,
  }, `agent-principal-${principalKey}`);
}

function grantInput(
  agentPrincipalId: number,
  ownerUserId: number,
  overrides: Partial<CreateAgentGrantInput> = {},
): CreateAgentGrantInput {
  return {
    agentPrincipalId,
    actionName: 'receipt.search',
    permissionKey: 'expenses.company_receipts.read_own',
    resourceKey: 'expenses/company_receipts',
    scope: 'self',
    targetType: 'employee',
    targetId: String(ownerUserId),
    fieldAllowlist: ['id', 'merchant'],
    validFrom: PAST,
    ...overrides,
  };
}

describe('Agent identity and delegation boundary', () => {
  it('persists a non-login Agent bridge without creating a human session principal', async () => {
    const { db, adminSession, viewer } = await fixture();
    await addOperatorRole(db, viewer.userId, adminSession.userId);
    const created = await principalFor(db, adminSession, viewer.userId, 'receipt-reader');

    expect(created).toMatchObject({
      principalKey: 'receipt-reader',
      kind: 'delegated_agent',
      ownerUserId: viewer.userId,
      status: 'active',
      version: 1,
    });
    const [bridge] = await db.select().from(appUser).where(eq(appUser.userId, created.actorUserId));
    expect(bridge).toMatchObject({
      identityKind: 'agent',
      loginEnabled: false,
      isActive: true,
    });
    expect(bridge.passwordHash).toMatch(/^pbkdf2\$/);

    const service = await createAgentPrincipal(db, adminSession, {
      principalKey: 'receipt-service',
      displayName: 'Receipt Service',
      kind: 'service_automation',
      ownerUserId: adminSession.userId,
    }, 'agent-principal-service');
    const [serviceBridge] = await db.select({
      identityKind: appUser.identityKind,
      loginEnabled: appUser.loginEnabled,
    }).from(appUser).where(eq(appUser.userId, service.actorUserId));
    expect(service).toMatchObject({ kind: 'service_automation' });
    expect(serviceBridge).toEqual({ identityKind: 'service_automation', loginEnabled: false });
  });

  it('denies unknown actions and unknown tenant actors', async () => {
    const { db, adminSession } = await fixture();
    const created = await principalFor(db, adminSession, adminSession.userId, 'unknown-boundary');

    await expect(resolveAgentGrantWithin(db, {
      masterFn: 'M1', companyFn: 'C-SG',
    }, {
      agentPrincipalId: created.id,
      actionName: 'receipt.unknown',
    })).rejects.toMatchObject({ code: 'agent_action_unknown' });
    await expect(resolveAgentGrantWithin(db, {
      masterFn: 'M1', companyFn: 'C-SG',
    }, {
      agentPrincipalId: 999999,
      actionName: 'receipt.search',
    })).rejects.toMatchObject({ code: 'agent_principal_not_found' });
  });

  it('rechecks the accountable owner and denies after owner deactivation', async () => {
    const { db, adminSession, viewer } = await fixture();
    await addOperatorRole(db, viewer.userId, adminSession.userId);
    const created = await principalFor(db, adminSession, viewer.userId, 'owner-lifecycle');
    await createAgentGrant(db, adminSession, grantInput(created.id, viewer.userId), 'grant-owner-lifecycle');

    await expect(resolveAgentGrantWithin(db, {
      masterFn: 'M1', companyFn: 'C-SG',
    }, {
      agentPrincipalId: created.id,
      actionName: 'receipt.search',
      requestedScope: {
        scope: 'self', targetType: 'employee', targetId: String(viewer.userId),
      },
      now: NOW,
    })).resolves.toMatchObject({ ownerUserId: viewer.userId });

    await setUserActive(db, adminSession, viewer.userId, false, 'disable-agent-owner');
    await expect(resolveAgentGrantWithin(db, {
      masterFn: 'M1', companyFn: 'C-SG',
    }, {
      agentPrincipalId: created.id,
      actionName: 'receipt.search',
      now: NOW,
    })).rejects.toMatchObject({ code: 'agent_owner_inactive' });
  });

  it('denies expired grants and enforces the exact amount boundary', async () => {
    const { db, adminSession } = await fixture();
    const expired = await principalFor(db, adminSession, adminSession.userId, 'expired-grant');
    await createAgentGrant(db, adminSession, grantInput(expired.id, adminSession.userId, {
      validUntil: new Date('2026-09-07T23:59:59.000Z'),
    }), 'grant-expired');
    await expect(resolveAgentGrantWithin(db, {
      masterFn: 'M1', companyFn: 'C-SG',
    }, { agentPrincipalId: expired.id, actionName: 'receipt.search', now: NOW }))
      .rejects.toMatchObject({ code: 'agent_grant_inactive' });

    const bounded = await principalFor(db, adminSession, adminSession.userId, 'amount-boundary');
    await createAgentGrant(db, adminSession, grantInput(bounded.id, adminSession.userId, {
      actionName: 'receipt_pack.create',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipt_packs',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['id', 'rows'],
      amountLimit: '100.0000',
      amountCurrency: 'SGD',
    }), 'grant-amount-boundary');

    await expect(resolveAgentGrantWithin(db, {
      masterFn: 'M1', companyFn: 'C-SG',
    }, {
      agentPrincipalId: bounded.id,
      actionName: 'receipt_pack.create',
      amount: '100.0000',
      currency: 'sgd',
      now: NOW,
    })).resolves.toMatchObject({ amountLimit: '100.0000', amountCurrency: 'SGD' });
    await expect(resolveAgentGrantWithin(db, {
      masterFn: 'M1', companyFn: 'C-SG',
    }, {
      agentPrincipalId: bounded.id,
      actionName: 'receipt_pack.create',
      amount: '100.0001',
      currency: 'SGD',
      now: NOW,
    })).rejects.toMatchObject({ code: 'agent_amount_exceeded' });
  });

  it('keeps read-own grants below Company scope and permits read-company only when granted', async () => {
    const { db, adminSession } = await fixture();
    const created = await principalFor(db, adminSession, adminSession.userId, 'scope-boundary');
    await createAgentGrant(db, adminSession, grantInput(created.id, adminSession.userId), 'grant-read-own');

    await expect(resolveAgentGrantWithin(db, {
      masterFn: 'M1', companyFn: 'C-SG',
    }, {
      agentPrincipalId: created.id,
      actionName: 'receipt.search',
      requestedScope: { scope: 'self', targetType: 'employee', targetId: String(adminSession.userId) },
      requestedFields: ['id'],
      now: NOW,
    })).resolves.toMatchObject({ scope: 'self', permissionKey: 'expenses.company_receipts.read_own' });
    await expect(resolveAgentGrantWithin(db, {
      masterFn: 'M1', companyFn: 'C-SG',
    }, {
      agentPrincipalId: created.id,
      actionName: 'receipt.search',
      requestedScope: { scope: 'company' },
      now: NOW,
    })).rejects.toMatchObject({ code: 'agent_scope_denied' });

    await createAgentGrant(db, adminSession, grantInput(created.id, adminSession.userId, {
      permissionKey: 'expenses.company_receipts.read_company',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['id', 'merchant'],
    }), 'grant-read-company');
    await expect(resolveAgentGrantWithin(db, {
      masterFn: 'M1', companyFn: 'C-SG',
    }, {
      agentPrincipalId: created.id,
      actionName: 'receipt.search',
      requestedScope: { scope: 'company' },
      now: NOW,
    })).resolves.toMatchObject({
      scope: 'company', permissionKey: 'expenses.company_receipts.read_company',
    });
  });
});
