import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import { outboxEvent, role } from '../data/schema';
import { freshDb } from '../test/helpers';
import { decryptToken, type EncryptedToken } from '../auth/tokenCrypto';
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
    body: JSON.stringify({ email, password }),
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

  it('protects one-time production setup with the deployment token', async () => {
    const db = await freshDb();
    const running = await startApi(db, { setupToken: 'deployment-secret' });
    server = running.server;
    const payload = JSON.stringify({
      organizationName: 'Example Group',
      companyName: 'Example Malaysia',
      country: 'MY',
      adminName: 'System Admin',
      adminEmail: 'admin@example.test',
      adminPassword: 'safe-password',
      language: 'vi',
    });
    const wrong = await fetch(`${running.baseUrl}/api/setup/actions/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-erp-setup-token': 'wrong',
      },
      body: payload,
    });
    expect(wrong.status).toBe(403);
    const created = await fetch(`${running.baseUrl}/api/setup/actions/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-erp-setup-token': 'deployment-secret',
      },
      body: payload,
    });
    expect(created.status).toBe(201);
    const replay = await fetch(`${running.baseUrl}/api/setup/actions/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-erp-setup-token': 'deployment-secret',
      },
      body: payload,
    });
    expect(replay.status).toBe(409);
    expect((await replay.json()).error.code).toBe('already_initialized');
  });
});
