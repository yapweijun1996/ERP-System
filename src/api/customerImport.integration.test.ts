import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { auditLog, customer, importJob } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) =>
    Array.from(value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
      (match) => `${match[1]}=${match[2]}`));
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair) throw new Error('Missing CSRF cookie');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrfPair.slice(9)) };
}

describe('customer import API vertical slice', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('HTTP server did not bind');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  });

  async function login(email = 'admin@acme.co', password = 'demo1234') {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(response.status).toBe(200);
    return responseCookies(response);
  }

  function writeHeaders(auth: { header: string; csrf: string }) {
    return {
      cookie: auth.header,
      'content-type': 'application/json',
      'x-csrf-token': auth.csrf,
    };
  }

  const payload = {
    fileName: 'customer-import.csv',
    duplicateStrategy: 'update_existing',
    rows: [
      { code: 'CUST1', name: 'Updated Fictional Customer', industry: 'Industrial' },
      { code: 'API-CUST-2', name: 'Fictional Automation Pte Ltd', industry: 'Automation' },
      { code: '', name: 'Invalid row' },
    ],
  };

  it('creates, exposes row errors, runs once and records audit facts', async () => {
    const auth = await login();
    const headers = writeHeaders(auth);
    const createdResponse = await fetch(`${baseUrl}/api/integration/import-jobs`, {
      method: 'POST', headers: { ...headers, 'x-request-id': 'import-create' },
      body: JSON.stringify(payload),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).data as { id: number };

    const rowsResponse = await fetch(
      `${baseUrl}/api/integration/import-rows?jobId=${created.id}&limit=100`,
      { headers: { cookie: auth.header } },
    );
    expect(rowsResponse.status).toBe(200);
    expect((await rowsResponse.json()).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ rowNumber: 2, code: 'CUST1', operation: 'update', status: 'ready' }),
      expect.objectContaining({ rowNumber: 4, operation: 'invalid', status: 'error' }),
    ]));
    const errorsResponse = await fetch(
      `${baseUrl}/api/integration/import-errors?jobId=${created.id}&limit=100`,
      { headers: { cookie: auth.header } },
    );
    expect(errorsResponse.status).toBe(200);
    expect((await errorsResponse.json()).data).toEqual([
      expect.objectContaining({ rowNumber: 4, field: 'code', errorCode: 'required' }),
    ]);

    const run = () => fetch(
      `${baseUrl}/api/integration/import-jobs/${created.id}/actions/run`,
      {
        method: 'POST', headers: { ...headers, 'idempotency-key': 'customer-import-once' },
        body: '{}',
      },
    );
    const completed = await run();
    expect(completed.status).toBe(200);
    expect(await completed.json()).toMatchObject({
      data: { id: created.id, status: 'completed', importedRows: 2, errorRows: 1, version: 2 },
    });
    const replay = await run();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(await db.select().from(customer).where(and(
      eq(customer.masterFn, 'M1'), eq(customer.companyFn, 'C-SG'), eq(customer.code, 'API-CUST-2'),
    ))).toEqual([expect.objectContaining({ name: 'Fictional Automation Pte Ltd' })]);
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'integration/import-jobs'),
      eq(auditLog.entityId, String(created.id)),
    ))).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'create', requestId: 'import-create' }),
      expect.objectContaining({ action: 'run' }),
    ]));
  });

  it('allows Viewer history reads but denies import writes', async () => {
    const viewer = await login('viewer@acme.co', 'viewer1234');
    expect((await fetch(`${baseUrl}/api/integration/import-jobs`, {
      headers: { cookie: viewer.header },
    })).status).toBe(200);
    const denied = await fetch(`${baseUrl}/api/integration/import-jobs`, {
      method: 'POST', headers: writeHeaders(viewer), body: JSON.stringify(payload),
    });
    expect(denied.status).toBe(403);
    expect(await db.select().from(importJob)).toHaveLength(0);
  });

  it('rejects tenant overrides, invalid files and unsupported queries', async () => {
    const auth = await login();
    const headers = writeHeaders(auth);
    const override = await fetch(`${baseUrl}/api/integration/import-jobs`, {
      method: 'POST', headers,
      body: JSON.stringify({ ...payload, masterFn: 'OTHER', companyFn: 'OTHER-C' }),
    });
    expect(override.status).toBe(400);
    const nestedOverride = await fetch(`${baseUrl}/api/integration/import-jobs`, {
      method: 'POST', headers,
      body: JSON.stringify({ ...payload, rows: [{ code: 'X', name: 'X', companyFn: 'OTHER-C' }] }),
    });
    expect(nestedOverride.status).toBe(422);
    const invalid = await fetch(`${baseUrl}/api/integration/import-jobs`, {
      method: 'POST', headers,
      body: JSON.stringify({ ...payload, fileName: 'customers.xlsx' }),
    });
    expect(invalid.status).toBe(422);
    expect((await fetch(`${baseUrl}/api/integration/import-jobs?offset=1`, {
      headers: { cookie: auth.header },
    })).status).toBe(400);
  });
});
