import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import {
  appUser,
  auditLog,
  passwordResetToken,
  platformPrincipal,
  company,
  master,
  outboxEvent,
  role,
  userCompany,
  userCompanyRole,
} from '../data/schema';
import { freshDb } from '../test/helpers';
import { decryptToken, type EncryptedToken } from '../auth/tokenCrypto';
import { hashPassword } from '../auth/password';
import { processOutboxBatch, type MailMessage } from '../worker/outbox';
import { createApp, type AppOptions } from './app';

async function startApi(db: DB, options: AppOptions = {}) {
  const server = createApp(db, options).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No API address');
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopApi(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) =>
    Array.from(
      value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
      (match) => `${match[1]}=${match[2]}`,
    ));
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(pairs.find((pair) => pair.startsWith('erp_csrf='))!
      .slice('erp_csrf='.length)),
  };
}

function platformCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_platform_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_platform_csrf='));
  if (!csrfPair) throw new Error('Missing platform CSRF cookie');
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice('erp_platform_csrf='.length)),
  };
}

async function login(baseUrl: string, email = 'admin@acme.co', password = 'demo1234') {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationCode: 'ACME', username: email.split('@')[0], password }),
  });
  expect(response.status).toBe(200);
  return responseCookies(response);
}

describe('auth lifecycle API', () => {
  let server: Server | undefined;
  afterEach(async () => {
    if (server) await stopApi(server);
    server = undefined;
  });

  it('requires CSRF and permission for invitations, then accepts once', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const key = Buffer.alloc(32, 8);
    const running = await startApi(db, {
      tokenEncryptionKey: key.toString('base64'),
      publicUrl: 'https://erp.example.test',
    });
    server = running.server;
    const cookies = await login(running.baseUrl);
    const [viewerRole] = await db.select().from(role).where(eq(role.name, 'Viewer'));
    const body = JSON.stringify({ email: 'invitee@example.test', roleId: viewerRole.roleId });

    const withoutCsrf = await fetch(`${running.baseUrl}/api/auth/invitations`, {
      method: 'POST',
      headers: { cookie: cookies.header, 'content-type': 'application/json' },
      body,
    });
    expect(withoutCsrf.status).toBe(403);

    const invitation = await fetch(`${running.baseUrl}/api/auth/invitations`, {
      method: 'POST',
      headers: {
        cookie: cookies.header,
        'content-type': 'application/json',
        'x-csrf-token': cookies.csrf,
      },
      body,
    });
    expect(invitation.status).toBe(201);
    const [event] = await db.select().from(outboxEvent);
    const token = decryptToken(
      (event.payload as { token: EncryptedToken }).token,
      key,
    );
    const accepted = await fetch(`${running.baseUrl}/api/auth/invitations/actions/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token,
        fullName: 'Invitee',
        password: 'safe-password',
        language: 'ms',
      }),
    });
    expect(accepted.status).toBe(201);
    const replay = await fetch(`${running.baseUrl}/api/auth/invitations/actions/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token,
        fullName: 'Invitee',
        password: 'safe-password',
      }),
    });
    expect(replay.status).toBe(400);
    expect((await replay.json()).error.code).toBe('invitation_invalid');
  });

  it('returns an identical password-reset request response for known and unknown users', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const running = await startApi(db, {
      tokenEncryptionKey: Buffer.alloc(32, 9).toString('base64'),
      publicUrl: 'https://erp.example.test',
    });
    server = running.server;
    const request = (email: string) => fetch(
      `${running.baseUrl}/api/auth/password-reset/actions/request`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      },
    );
    const known = await request('admin@acme.co');
    const unknown = await request('unknown@example.test');
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await known.json()).toEqual(await unknown.json());
  });

  it('recovers Company Owner and Master Admin through an isolated mail sink without crossing the platform realm', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const key = Buffer.alloc(32, 19);
    const [masterRole] = await db.insert(role).values({
      masterFn: 'M1', companyFn: 'C-SG', name: 'Master Admin', sourceTemplateKey: 'master_admin',
    }).returning();
    const [masterAdmin] = await db.insert(appUser).values({
      masterFn: 'M1', username: 'masteradmin', email: 'masteradmin@acme.co',
      passwordHash: hashPassword('demo1234'),
    }).returning();
    await db.insert(userCompany).values({ userId: masterAdmin.userId, companyFn: 'C-SG', roleId: masterRole.roleId });
    await db.insert(userCompanyRole).values({ userId: masterAdmin.userId, companyFn: 'C-SG', roleId: masterRole.roleId });
    const [platform] = await db.insert(platformPrincipal).values({
      principalKey: 'recovery-platform', displayName: 'Platform', email: 'platform@example.test',
      passwordHash: hashPassword('platform-original-password'),
    }).returning();
    const running = await startApi(db, {
      tokenEncryptionKey: key.toString('base64'), publicUrl: 'https://erp.example.test/erp',
    });
    server = running.server;
    const post = (action: string, body: object) => fetch(
      `${running.baseUrl}/api/auth/password-reset/actions/${action}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    );
    const sent: MailMessage[] = [];
    for (const email of ['admin@acme.co', 'masteradmin@acme.co']) {
      const cookies = await login(running.baseUrl, email);
      const requested = await post('request', { email });
      expect(requested.status).toBe(202);
      expect((await requested.json()).data.accepted).toBe(true);
      const result = await processOutboxBatch(db, { async send(message) { sent.push(message); } }, {
        tokenEncryptionKey: key, workerId: 'recovery-mail-sink',
      });
      expect(result.delivered).toBe(1);
      const message = sent[sent.length - 1];
      expect(message.to).toBe(email);
      const link = new URL(message.text.match(/https:\/\/[^\s]+/)![0]);
      expect(link.pathname).toBe('/erp/reset-password');
      expect(link.search).toBe('');
      const token = new URLSearchParams(link.hash.slice(1)).get('token')!;
      expect((await post('confirm', { token, password: 'recovered-password' })).status).toBe(200);
      expect((await post('confirm', { token, password: 'replayed-password' })).status).toBe(400);
      const oldSession = await fetch(`${running.baseUrl}/api/auth/session`, { headers: { cookie: cookies.header } });
      expect(oldSession.status).toBe(401);
      await login(running.baseUrl, email, 'recovered-password');
      const audit = await db.select().from(auditLog).where(eq(auditLog.action, 'password_reset'));
      const [target] = await db.select().from(appUser).where(eq(appUser.email, email));
      expect(audit.filter((row) => row.actorUserId === target.userId && row.masterFn === target.masterFn)).toHaveLength(1);
      expect(JSON.stringify(audit)).not.toContain(token);
      expect(JSON.stringify(audit)).not.toContain('recovered-password');
      const events = await db.select().from(outboxEvent);
      expect(JSON.stringify(events)).not.toContain(token);
      expect(events.every((event) => (event.payload as { redacted?: boolean }).redacted)).toBe(true);
    }
    const platformRequest = await post('request', { email: platform.email });
    const unknownRequest = await post('request', { email: 'unknown@example.test' });
    expect(await platformRequest.json()).toEqual(await unknownRequest.json());
    expect(await db.select().from(passwordResetToken)).toHaveLength(2);
    const [unchanged] = await db.select().from(platformPrincipal);
    expect(unchanged.passwordHash).toBe(platform.passwordHash);
  });

  it('bounds repeated reset emails while retaining the non-enumerating response', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const running = await startApi(db, {
      tokenEncryptionKey: Buffer.alloc(32, 20).toString('base64'), publicUrl: 'https://erp.example.test',
    });
    server = running.server;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await fetch(`${running.baseUrl}/api/auth/password-reset/actions/request`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: `${' '.repeat(attempt)}ADMIN@ACME.CO ` }),
      });
      expect(response.status).toBe(202);
      expect((await response.json()).data.accepted).toBe(true);
    }
    expect(await db.select().from(passwordResetToken)).toHaveLength(5);
  });

  it('authenticates the same username independently in two organizations', async () => {
    const db = await freshDb();
    await seedDemo(db);
    await db.insert(master).values({
      masterFn: 'M-BETA',
      loginCode: 'BETA',
      name: 'Beta Group',
    });
    await db.insert(company).values({
      companyFn: 'C-BETA',
      masterFn: 'M-BETA',
      name: 'Beta Singapore',
      country: 'SG',
      currency: 'SGD',
      taxRegime: 'GST',
      locale: 'en',
    });
    const [betaRole] = await db.insert(role).values({
      masterFn: 'M-BETA',
      name: 'Employee',
    }).returning({ roleId: role.roleId });
    const [betaUser] = await db.insert(appUser).values({
      masterFn: 'M-BETA',
      username: 'viewer',
      email: 'viewer@beta.example',
      fullName: 'Beta Viewer',
      passwordHash: hashPassword('beta-password'),
    }).returning({ userId: appUser.userId });
    await db.insert(userCompany).values({
      userId: betaUser.userId,
      companyFn: 'C-BETA',
      roleId: betaRole.roleId,
    });
    await db.insert(userCompanyRole).values({
      userId: betaUser.userId,
      companyFn: 'C-BETA',
      roleId: betaRole.roleId,
    });
    const running = await startApi(db);
    server = running.server;

    const acme = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationCode: 'ACME',
        username: 'viewer',
        password: 'viewer1234',
      }),
    });
    const beta = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationCode: 'BETA',
        username: 'viewer',
        password: 'beta-password',
      }),
    });
    expect(acme.status).toBe(200);
    expect(beta.status).toBe(200);
    expect((await acme.json()).masterFn).toBe('M1');
    expect((await beta.json()).masterFn).toBe('M-BETA');
  });

  it('bootstraps the independent Platform Superadmin only for a fresh database', async () => {
    const db = await freshDb();
    const running = await startApi(db);
    server = running.server;
    const before = await fetch(`${running.baseUrl}/api/setup/status`);
    expect(before.status).toBe(200);
    expect(await before.json()).toMatchObject({
      hasAdmin: false,
      hasPlatformAdmin: false,
      requiresPlatformBootstrap: true,
      isFreshDatabase: true,
    });
    const payload = JSON.stringify({
      principalKey: 'platform-admin',
      displayName: 'Platform Admin',
      email: 'platform@example.test',
      password: 'safe-platform-password',
    });
    const created = await fetch(`${running.baseUrl}/api/setup/platform-superadmin/actions/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    expect(created.status).toBe(201);
    const cookies = platformCookies(created);
    expect(cookies.header).not.toContain('erp_session=');
    const session = await fetch(`${running.baseUrl}/api/platform/session`, { headers: { cookie: cookies.header } });
    expect(session.status).toBe(200);
    expect((await session.json()).data).toMatchObject({ realm: 'platform', principalKey: 'platform-admin' });
    const after = await fetch(`${running.baseUrl}/api/setup/status`);
    expect(after.status).toBe(200);
    expect(await after.json()).toMatchObject({
      hasAdmin: false,
      hasPlatformAdmin: true,
      requiresPlatformBootstrap: false,
      isFreshDatabase: false,
    });
    const replay = await fetch(`${running.baseUrl}/api/setup/platform-superadmin/actions/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    expect(replay.status).toBe(409);
    expect((await replay.json()).error.code).toBe('already_initialized');
  });

  it('retires the old anonymous tenant setup endpoint', async () => {
    const db = await freshDb();
    const running = await startApi(db);
    server = running.server;
    const fresh = await fetch(`${running.baseUrl}/api/setup/actions/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(fresh.status).toBe(410);
    expect((await fresh.json()).error.code).toBe('legacy_setup_disabled');
  });

  it('serializes concurrent first-run Platform bootstrap claims', async () => {
    const db = await freshDb();
    const running = await startApi(db);
    server = running.server;
    const submit = (principalKey: string) => fetch(
      `${running.baseUrl}/api/setup/platform-superadmin/actions/complete`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          principalKey,
          displayName: `Platform ${principalKey}`,
          email: `${principalKey}@example.test`,
          password: 'safe-platform-password',
        }),
      },
    );
    const responses = await Promise.all([submit('platform-one'), submit('platform-two')]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const failed = responses.find((response) => response.status === 409);
    expect(failed).toBeTruthy();
    expect((await failed!.json()).error.code).toBe('already_initialized');
  });

  it('does not expose Platform bootstrap once the database contains tenant data', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const running = await startApi(db);
    server = running.server;
    const response = await fetch(`${running.baseUrl}/api/setup/platform-superadmin/actions/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('already_initialized');
  });
});
