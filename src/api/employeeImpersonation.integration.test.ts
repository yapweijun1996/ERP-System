import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { and, eq, isNull } from 'drizzle-orm';
import type { DB } from '../data/db';
import { appUser, auditLog, employee } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrf) throw new Error('Missing CSRF cookie');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrf.slice('erp_csrf='.length)) };
}

describe('Superadmin employee workspace session', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db, {
      tokenEncryptionKey: Buffer.alloc(32, 7).toString('base64'),
    }).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing API address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  async function login(username: string, password: string) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    return responseCookies(response);
  }

  function mutationHeaders(auth: { header: string; csrf: string }) {
    return {
      cookie: auth.header,
      'x-csrf-token': auth.csrf,
      'content-type': 'application/json',
    };
  }

  it('enters a linked employee with employee permissions and returns to the original Superadmin', async () => {
    const admin = await login('admin', 'demo1234');
    const [viewer] = await db.select({ userId: appUser.userId }).from(appUser)
      .where(eq(appUser.username, 'viewer')).limit(1);
    const [adminUser] = await db.select({ userId: appUser.userId }).from(appUser)
      .where(eq(appUser.username, 'admin')).limit(1);
    expect(viewer).toBeDefined();
    expect(adminUser).toBeDefined();

    const targets = await fetch(`${baseUrl}/api/auth/session/employee-workspace-targets`, {
      headers: { cookie: admin.header },
    });
    expect(targets.status).toBe(200);
    const targetBody = await targets.json() as {
      data: Array<{ userId: number; fullName: string; employeeNo: string }>;
    };
    expect(targetBody.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: viewer.userId }),
    ]));
    expect(targetBody.data.some((target) => target.userId === adminUser.userId)).toBe(false);

    const entered = await fetch(`${baseUrl}/api/auth/session/actions/impersonate`, {
      method: 'POST',
      headers: mutationHeaders(admin),
      body: JSON.stringify({ targetUserId: viewer.userId, reason: 'Verify employee My Work access' }),
    });
    expect(entered.status).toBe(200);
    expect((await entered.json()).data).toMatchObject({
      userId: viewer.userId,
      impersonatorUserId: adminUser.userId,
    });

    const session = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: admin.header } });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      userId: viewer.userId,
      impersonatorUserId: adminUser.userId,
      passwordChangeRequired: false,
    });
    const myContext = await fetch(`${baseUrl}/api/my/context`, { headers: { cookie: admin.header } });
    expect(myContext.status).toBe(200);
    expect((await myContext.json()).data.employee.id).toBeGreaterThan(0);

    const returned = await fetch(`${baseUrl}/api/auth/session/actions/return-to-superadmin`, {
      method: 'POST',
      headers: mutationHeaders(admin),
      body: '{}',
    });
    expect(returned.status).toBe(200);
    expect((await returned.json()).data).toMatchObject({ userId: adminUser.userId });
    expect((await (await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: admin.header },
    })).json())).not.toHaveProperty('impersonatorUserId');

    const audits = await db.select({ action: auditLog.action, actorUserId: auditLog.actorUserId })
      .from(auditLog).where(and(
        eq(auditLog.entity, 'app_session'),
        eq(auditLog.actorUserId, adminUser.userId),
      ));
    expect(audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining(['impersonation_started', 'impersonation_ended']),
    );
  });

  it('allows Superadmin to inspect a preactivated employee account without activating it', async () => {
    const admin = await login('admin', 'demo1234');
    const [unlinkedEmployee] = await db.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, 'M1'),
      eq(employee.companyFn, 'C-SG'),
      isNull(employee.userId),
    )).limit(1);
    expect(unlinkedEmployee).toBeDefined();
    const created = await fetch(`${baseUrl}/api/hr/employee-accounts/${unlinkedEmployee.id}/actions/create`, {
      method: 'POST',
      headers: { ...mutationHeaders(admin), 'idempotency-key': 'impersonation-preactivated-create' },
      body: JSON.stringify({ username: 'preactivated.employee' }),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { data: { userId: number } };

    const entered = await fetch(`${baseUrl}/api/auth/session/actions/impersonate`, {
      method: 'POST',
      headers: mutationHeaders(admin),
      body: JSON.stringify({ targetUserId: createdBody.data.userId }),
    });
    expect(entered.status).toBe(200);
    const session = await (await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: admin.header },
    })).json() as { userId: number; passwordChangeRequired: boolean; impersonatorUserId: number };
    expect(session.userId).toBe(createdBody.data.userId);
    expect(session.passwordChangeRequired).toBe(true);
    expect(session.impersonatorUserId).toBeGreaterThan(0);

    const activation = await fetch(`${baseUrl}/api/auth/activation/actions/complete`, {
      method: 'POST',
      headers: mutationHeaders(admin),
      body: JSON.stringify({
        email: 'preactivated.employee@example.com',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }),
    });
    expect(activation.status).toBe(403);
    expect((await activation.json()).error.code).toBe('impersonation_action_not_allowed');

    const myContext = await fetch(`${baseUrl}/api/my/context`, { headers: { cookie: admin.header } });
    expect(myContext.status).toBe(200);
  });

  it('does not let an ordinary employee start an impersonation session', async () => {
    const viewer = await login('viewer', 'viewer1234');
    const [admin] = await db.select({ userId: appUser.userId }).from(appUser)
      .where(eq(appUser.username, 'admin')).limit(1);
    const response = await fetch(`${baseUrl}/api/auth/session/actions/impersonate`, {
      method: 'POST',
      headers: mutationHeaders(viewer),
      body: JSON.stringify({ targetUserId: admin.userId }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('superadmin_required');

    const targets = await fetch(`${baseUrl}/api/auth/session/employee-workspace-targets`, {
      headers: { cookie: viewer.header },
    });
    expect(targets.status).toBe(403);
    expect((await targets.json()).error.code).toBe('superadmin_required');
  });
});
