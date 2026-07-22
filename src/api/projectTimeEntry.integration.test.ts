import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { appUser, auditLog, project, projectTimeEntry } from '../data/schema';
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
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice('erp_csrf='.length)),
  };
}

describe('project time-entry API vertical slice', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let adminUserId: number;
  let openProjectId: number;
  let heldProjectId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select({ id: appUser.userId }).from(appUser).where(and(
      eq(appUser.masterFn, 'M1'), eq(appUser.email, 'admin@acme.co'),
    ));
    adminUserId = admin.id;
    const projects = await db.select({ id: project.id, status: project.status }).from(project)
      .where(and(eq(project.masterFn, 'M1'), eq(project.companyFn, 'C-SG')));
    openProjectId = projects.find((row) => row.status === 'open')!.id;
    heldProjectId = projects.find((row) => row.status === 'on_hold')!.id;
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

  it('creates, actor-scopes, audits and idempotently voids one time fact', async () => {
    const auth = await login();
    const headers = writeHeaders(auth);
    const createdResponse = await fetch(`${baseUrl}/api/project/time-entries`, {
      method: 'POST',
      headers: { ...headers, 'x-request-id': 'time-entry-create' },
      body: JSON.stringify({
        projectId: openProjectId,
        workDate: '2026-07-20',
        task: 'Commissioning review',
        hours: '2.50',
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).data as { id: number };
    expect(await db.select().from(projectTimeEntry).where(eq(projectTimeEntry.id, created.id)))
      .toEqual([expect.objectContaining({
        masterFn: 'M1', companyFn: 'C-SG', actorUserId: adminUserId,
        projectId: openProjectId, hours: '2.50', status: 'active',
      })]);

    const listed = await fetch(
      `${baseUrl}/api/project/time-entries?from=2026-07-20&to=2026-07-26&limit=100`,
      { headers: { cookie: auth.header } },
    );
    expect(listed.status).toBe(200);
    expect((await listed.json()).data).toEqual([
      expect.objectContaining({ id: created.id, task: 'Commissioning review' }),
    ]);

    const voidEntry = () => fetch(
      `${baseUrl}/api/project/time-entries/${created.id}/actions/void`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'void-time-entry-once' },
        body: JSON.stringify({ reason: 'Wrong work package.' }),
      },
    );
    const firstVoid = await voidEntry();
    expect(firstVoid.status).toBe(200);
    expect(await firstVoid.json()).toMatchObject({
      data: { id: created.id, status: 'voided', version: 2, voidReason: 'Wrong work package.' },
    });
    const replay = await voidEntry();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');

    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'project/time-entries'),
      eq(auditLog.entityId, String(created.id)),
    ))).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'create', requestId: 'time-entry-create' }),
      expect.objectContaining({ action: 'void' }),
    ]));
  });

  it('does not expose another user\'s entries and denies Viewer writes', async () => {
    const admin = await login();
    const created = await fetch(`${baseUrl}/api/project/time-entries`, {
      method: 'POST', headers: writeHeaders(admin),
      body: JSON.stringify({
        projectId: openProjectId, workDate: '2026-07-21', task: 'Admin-owned', hours: '1.25',
      }),
    });
    const entryId = (await created.json()).data.id;

    const viewer = await login('viewer@acme.co', 'viewer1234');
    const viewerList = await fetch(
      `${baseUrl}/api/project/time-entries?from=2026-07-20&to=2026-07-26`,
      { headers: { cookie: viewer.header } },
    );
    expect(viewerList.status).toBe(200);
    expect((await viewerList.json()).data).toEqual([]);
    expect((await fetch(`${baseUrl}/api/project/time-entries/${entryId}`, {
      headers: { cookie: viewer.header },
    })).status).toBe(404);

    const denied = await fetch(`${baseUrl}/api/project/time-entries`, {
      method: 'POST', headers: writeHeaders(viewer),
      body: JSON.stringify({
        projectId: openProjectId, workDate: '2026-07-21', task: 'Denied', hours: '1',
      }),
    });
    expect(denied.status).toBe(403);
  });

  it('returns bounded validation and date-range errors without accepting tenant overrides', async () => {
    const auth = await login();
    const headers = writeHeaders(auth);
    const invalidDate = await fetch(`${baseUrl}/api/project/time-entries`, {
      method: 'POST', headers,
      body: JSON.stringify({
        projectId: openProjectId, workDate: '2026-02-31', task: 'Invalid', hours: '1',
      }),
    });
    expect(invalidDate.status).toBe(422);
    const held = await fetch(`${baseUrl}/api/project/time-entries`, {
      method: 'POST', headers,
      body: JSON.stringify({
        projectId: heldProjectId, workDate: '2026-07-20', task: 'Held project', hours: '1',
      }),
    });
    expect(held.status).toBe(422);
    const override = await fetch(`${baseUrl}/api/project/time-entries`, {
      method: 'POST', headers,
      body: JSON.stringify({
        projectId: openProjectId, workDate: '2026-07-20', task: 'Override', hours: '1',
        masterFn: 'OTHER', companyFn: 'OTHER-C',
      }),
    });
    expect(override.status).toBe(400);
    expect(await override.json()).toMatchObject({ error: { code: 'tenant_override_rejected' } });

    const badRange = await fetch(
      `${baseUrl}/api/project/time-entries?from=2026-07-27&to=2026-07-20`,
      { headers: { cookie: auth.header } },
    );
    expect(badRange.status).toBe(400);
    expect(await badRange.json()).toMatchObject({ error: { code: 'invalid_query' } });
  });
});
