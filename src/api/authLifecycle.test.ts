import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import {
  appUser,
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

  it('allows tokenless production setup only for a fresh database', async () => {
    const db = await freshDb();
    const running = await startApi(db);
    server = running.server;
    const before = await fetch(`${running.baseUrl}/api/setup/status`);
    expect(before.status).toBe(200);
    expect(await before.json()).toMatchObject({ hasAdmin: false, isFreshDatabase: true });
    const payload = JSON.stringify({
      organizationName: 'Example Group',
      organizationCode: 'EXAMPLE',
      companyName: 'Example Malaysia',
      country: 'MY',
      adminName: 'System Admin',
      adminUsername: 'admin',
      adminEmail: 'admin@example.test',
      adminPassword: 'safe-password',
      language: 'vi',
    });
    const created = await fetch(`${running.baseUrl}/api/setup/actions/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    expect(created.status).toBe(201);
    const after = await fetch(`${running.baseUrl}/api/setup/status`);
    expect(after.status).toBe(200);
    expect(await after.json()).toMatchObject({ hasAdmin: true, isFreshDatabase: false });
    const replay = await fetch(`${running.baseUrl}/api/setup/actions/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    expect(replay.status).toBe(409);
    expect((await replay.json()).error.code).toBe('setup_not_empty');
  });

  it('does not expose production setup once the database contains tenant data', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const running = await startApi(db);
    server = running.server;
    const response = await fetch(`${running.baseUrl}/api/setup/actions/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('setup_not_empty');
  });
});
