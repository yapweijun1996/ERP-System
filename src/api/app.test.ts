import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { auditLog } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

interface RunningApi {
  baseUrl: string;
  server: Server;
}

async function startApi(db: DB): Promise<RunningApi> {
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP test server has no TCP address');
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
  const pairs = values.flatMap((value) => {
    const matches = value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g);
    return Array.from(matches, (match) => `${match[1]}=${match[2]}`);
  });
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair || !pairs.some((pair) => pair.startsWith('erp_session='))) {
    throw new Error(`Missing auth cookies: ${values.join(' | ')}`);
  }
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice('erp_csrf='.length)),
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

describe('production API security contract', () => {
  let db: DB;
  let running: RunningApi;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    running = await startApi(db);
  });

  afterEach(async () => {
    await stopApi(running.server);
  });

  it('persists sessions across application restarts', async () => {
    const cookies = await login(running.baseUrl);
    await stopApi(running.server);
    running = await startApi(db);
    const response = await fetch(`${running.baseUrl}/api/auth/session`, {
      headers: { cookie: cookies.header },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      masterFn: 'M1',
      activeCompanyFn: 'C-SG',
      email: 'admin@acme.co',
    });
  });

  it('requires a matching CSRF header for state-changing requests', async () => {
    const cookies = await login(running.baseUrl);
    const missing = await fetch(`${running.baseUrl}/api/auth/session/actions/switch-company`, {
      method: 'POST',
      headers: { cookie: cookies.header, 'content-type': 'application/json' },
      body: JSON.stringify({ companyFn: 'C-MY' }),
    });
    expect(missing.status).toBe(403);
    expect((await missing.json()).error.code).toBe('csrf_invalid');

    const valid = await fetch(`${running.baseUrl}/api/auth/session/actions/switch-company`, {
      method: 'POST',
      headers: {
        cookie: cookies.header,
        'content-type': 'application/json',
        'x-csrf-token': cookies.csrf,
        'x-request-id': 'switch-test',
      },
      body: JSON.stringify({ companyFn: 'C-MY' }),
    });
    expect(valid.status).toBe(200);
    expect((await valid.json()).data.activeCompanyFn).toBe('C-MY');
    const [audit] = await db.select().from(auditLog)
      .where(eq(auditLog.requestId, 'switch-test'));
    expect(audit).toMatchObject({ action: 'switch_company', actorUserId: 1 });
  });

  it('rejects switching to a company without a user assignment', async () => {
    const cookies = await login(running.baseUrl, 'viewer@acme.co', 'viewer1234');
    const response = await fetch(`${running.baseUrl}/api/auth/session/actions/switch-company`, {
      method: 'POST',
      headers: {
        cookie: cookies.header,
        'content-type': 'application/json',
        'x-csrf-token': cookies.csrf,
      },
      body: JSON.stringify({ companyFn: 'C-MY' }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('company_access_denied');
  });

  it('takes tenant scope only from the session and rejects query overrides', async () => {
    const cookies = await login(running.baseUrl);
    const override = await fetch(
      `${running.baseUrl}/api/inventory/products?companyFn=C-MY`,
      { headers: { cookie: cookies.header } },
    );
    expect(override.status).toBe(400);
    expect((await override.json()).error.code).toBe('invalid_query');
  });

  it('revokes logout sessions and does not accept the CSRF cookie alone', async () => {
    const cookies = await login(running.baseUrl);
    const cookieOnly = await fetch(`${running.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookies.header },
    });
    expect(cookieOnly.status).toBe(403);

    const logout = await fetch(`${running.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookies.header, 'x-csrf-token': cookies.csrf },
    });
    expect(logout.status).toBe(200);
    const session = await fetch(`${running.baseUrl}/api/auth/session`, {
      headers: { cookie: cookies.header },
    });
    expect(session.status).toBe(401);
  });

  it('returns the structured error contract for malformed JSON', async () => {
    const response = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'bad-json' },
      body: '{',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'invalid_json',
        message: 'Request body is not valid JSON.',
        requestId: 'bad-json',
      },
    });
  });
});
