import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { employee } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookiesFrom(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrf || !pairs.some((pair) => pair.startsWith('erp_session='))) {
    throw new Error(`Missing authentication cookies: ${values.join(' | ')}`);
  }
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrf.slice('erp_csrf='.length)) };
}

describe('Staff Calendar appointment API', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('API test server has no address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function login() {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username: 'admin', password: 'demo1234' }),
    });
    expect(response.status).toBe(200);
    return cookiesFrom(response);
  }

  it('reads mixed leave and appointment events and governs appointment writes', async () => {
    const [marcus] = await db.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, 'M1'), eq(employee.companyFn, 'C-SG'), eq(employee.employeeNo, 'EMP-1042'),
    )).limit(1);
    const cookies = await login();
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const connectionResponse = await fetch(`${baseUrl}/api/hr/calendar/connections`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'calendar-connection-create-1' },
      body: JSON.stringify({
        name: 'Demo calendar gateway', provider: 'generic', calendarRef: 'demo-calendar',
      }),
    });
    expect(connectionResponse.status).toBe(201);
    const connectionsResponse = await fetch(`${baseUrl}/api/hr/calendar/connections`, {
      headers: { cookie: cookies.header },
    });
    expect(connectionsResponse.status).toBe(200);
    expect((await connectionsResponse.json()).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Demo calendar gateway', provider: 'generic', isEnabled: true }),
    ]));
    const calendar = await fetch(`${baseUrl}/api/hr/calendar/staff?from=2026-08-01&to=2026-08-31`, {
      headers: { cookie: cookies.header },
    });
    expect(calendar.status).toBe(200);
    const calendarBody = await calendar.json();
    expect(calendarBody.meta).toMatchObject({ tenantScoped: true, canManage: true });
    expect(calendarBody.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventKind: 'leave', id: expect.stringMatching(/^leave:/) }),
      expect.objectContaining({ eventKind: 'appointment', title: 'Client site inspection' }),
    ]));

    const payload = {
      employeeId: marcus.id,
      appointmentType: 'meeting',
      title: 'API appointment contract test',
      startAt: '2026-09-10T01:00:00Z',
      endAt: '2026-09-10T02:00:00Z',
      location: 'Room A',
    };
    const createdResponse = await fetch(`${baseUrl}/api/hr/calendar/appointments`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'appointment-api-create-1' },
      body: JSON.stringify(payload),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).data;
    expect(created).toMatchObject({ title: payload.title, status: 'scheduled', recordVersion: 1 });

    const replayResponse = await fetch(`${baseUrl}/api/hr/calendar/appointments`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'appointment-api-create-1' },
      body: JSON.stringify(payload),
    });
    expect(replayResponse.status).toBe(201);
    expect((await replayResponse.json()).data.id).toBe(created.id);

    const updatedResponse = await fetch(`${baseUrl}/api/hr/calendar/appointments/${created.id}`, {
      method: 'PUT', headers: { ...headers, 'idempotency-key': 'appointment-api-update-1' },
      body: JSON.stringify({ ...payload, title: 'API appointment updated', expectedVersion: 1 }),
    });
    expect(updatedResponse.status).toBe(200);
    const updated = (await updatedResponse.json()).data;
    expect(updated).toMatchObject({ title: 'API appointment updated', recordVersion: 2 });

    const staleResponse = await fetch(`${baseUrl}/api/hr/calendar/appointments/${created.id}`, {
      method: 'PUT', headers: { ...headers, 'idempotency-key': 'appointment-api-stale-1' },
      body: JSON.stringify({ ...payload, expectedVersion: 1 }),
    });
    expect(staleResponse.status).toBe(409);
    expect((await staleResponse.json()).error.code).toBe('appointment_version_conflict');

    const cancelledResponse = await fetch(`${baseUrl}/api/hr/calendar/appointments/${created.id}/actions/cancel`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'appointment-api-cancel-1' },
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    expect(cancelledResponse.status).toBe(200);
    expect((await cancelledResponse.json()).data).toMatchObject({ status: 'cancelled', recordVersion: 3 });
  });
});
