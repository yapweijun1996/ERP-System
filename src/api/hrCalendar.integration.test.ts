import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { appUser, workingCalendarVersion } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { addCalendarHoliday, confirmOfficialHoliday } from '../modules/hr/leavePolicy';
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

describe('HR calendar API', () => {
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

  it('returns the active company holiday facts with substitute metadata', async () => {
    const [admin] = await db.select({ userId: appUser.userId })
      .from(appUser).where(eq(appUser.username, 'admin')).limit(1);
    const [version] = await db.select({ id: workingCalendarVersion.id })
      .from(workingCalendarVersion).where(eq(workingCalendarVersion.companyFn, 'C-SG')).limit(1);
    const holiday = await addCalendarHoliday(db, { masterFn: 'M1', companyFn: 'C-SG' }, {
      calendarVersionId: version.id,
      holidayDate: '2026-08-10',
      name: 'National Day observed substitute day',
      source: 'official',
      country: 'SG',
      actorUserId: admin.userId,
    });
    await confirmOfficialHoliday(db, { masterFn: 'M1', companyFn: 'C-SG' }, holiday.id, admin.userId);

    const cookies = await login();
    const response = await fetch(`${baseUrl}/api/hr/calendar/holidays?from=2026-01-01&to=2026-12-31`, {
      headers: { cookie: cookies.header },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.meta).toMatchObject({ source: 'calendar_holiday', tenantScoped: true, limit: 366 });
    expect(body.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Company year-end holiday', source: 'company', status: 'confirmed' }),
      expect.objectContaining({
        name: 'National Day observed substitute day', isSubstitute: true, status: 'confirmed',
      }),
    ]));
  });

  it('rejects a calendar request wider than one year', async () => {
    const cookies = await login();
    const response = await fetch(`${baseUrl}/api/hr/calendar/holidays?from=2026-01-01&to=2027-01-02`, {
      headers: { cookie: cookies.header },
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('calendar_range_too_large');
  });

  it('creates, submits and approves a holiday through the governed API', async () => {
    const [version] = await db.select({ id: workingCalendarVersion.id })
      .from(workingCalendarVersion).where(eq(workingCalendarVersion.companyFn, 'C-SG')).limit(1);
    const cookies = await login();
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const createdResponse = await fetch(`${baseUrl}/api/hr/calendar/holidays`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'hr-calendar-create-1' },
      body: JSON.stringify({
        calendarVersionId: version.id,
        holidayDate: '2026-11-02',
        name: 'Company wellness day',
        source: 'company',
        country: 'SG',
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).data;
    expect(created).toMatchObject({ status: 'draft', recordVersion: 1 });

    const submitResponse = await fetch(`${baseUrl}/api/hr/calendar/holidays/${created.id}/actions/submit`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'hr-calendar-submit-1' },
      body: JSON.stringify({ expectedVersion: created.recordVersion }),
    });
    expect(submitResponse.status).toBe(200);
    const submitted = (await submitResponse.json()).data;
    expect(submitted).toMatchObject({ status: 'pending_approval', recordVersion: 2 });

    const approveResponse = await fetch(`${baseUrl}/api/hr/calendar/holidays/${created.id}/actions/approve`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'hr-calendar-approve-1' },
      body: JSON.stringify({ expectedVersion: submitted.recordVersion }),
    });
    expect(approveResponse.status).toBe(200);
    expect((await approveResponse.json()).data).toMatchObject({ status: 'confirmed', recordVersion: 3 });
  });
});
