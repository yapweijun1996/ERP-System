import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { appNotification, appUser, auditLog, role, rolePermission } from '../data/schema';
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
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair) throw new Error('Missing CSRF cookie');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrfPair.slice(9)) };
}

describe('canonical notifications API', () => {
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
      body: JSON.stringify({ organizationCode: 'ACME', username: email.split('@')[0], password }),
    });
    expect(response.status).toBe(200);
    return responseCookies(response);
  }

  function writeHeaders(auth: { header: string; csrf: string }, key: string) {
    return {
      cookie: auth.header, 'content-type': 'application/json',
      'x-csrf-token': auth.csrf, 'idempotency-key': key,
    };
  }

  it('lists only actor/company rows and idempotently persists read and dismiss actions', async () => {
    const viewer = await login('viewer@acme.co', 'viewer1234');
    const listed = await fetch(`${baseUrl}/api/account/notifications?limit=100`, {
      headers: { cookie: viewer.header },
    });
    expect(listed.status).toBe(200);
    const listBody = await listed.json();
    expect(listBody.data).toEqual([
      expect.objectContaining({ subject: 'Viewer workspace is ready', category: 'system', version: 1 }),
    ]);
    const serialized = JSON.stringify(listBody);
    expect(serialized).not.toContain('recipientUserId');
    expect(serialized).not.toContain('masterFn');
    expect(serialized).not.toContain('companyFn');
    const id = listBody.data[0].id as number;

    const markRead = () => fetch(`${baseUrl}/api/account/notifications/${id}/actions/mark-read`, {
      method: 'POST', headers: writeHeaders(viewer, 'viewer-notification-read'), body: '{}',
    });
    const read = await markRead();
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ data: { id, version: 2 } });
    const replay = await markRead();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');

    const dismissed = await fetch(`${baseUrl}/api/account/notifications/${id}/actions/dismiss`, {
      method: 'POST', headers: writeHeaders(viewer, 'viewer-notification-dismiss'), body: '{}',
    });
    expect(dismissed.status).toBe(200);
    expect(await dismissed.json()).toMatchObject({ data: { id, version: 3 } });
    expect((await (await fetch(`${baseUrl}/api/account/notifications`, {
      headers: { cookie: viewer.header },
    })).json()).data).toEqual([]);
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'account/notifications'), eq(auditLog.entityId, String(id)),
    ))).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'mark-read' }),
      expect.objectContaining({ action: 'dismiss' }),
    ]));
  });

  it('rejects unauthenticated, malformed and cross-user access', async () => {
    expect((await fetch(`${baseUrl}/api/account/notifications`)).status).toBe(401);
    const viewer = await login('viewer@acme.co', 'viewer1234');
    for (const query of ['offset=1', 'cursor=not-a-cursor']) {
      const response = await fetch(`${baseUrl}/api/account/notifications?${query}`, {
        headers: { cookie: viewer.header },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: 'invalid_query' } });
    }
    const [adminNotification] = await db.select({ id: appNotification.id }).from(appNotification)
      .where(and(eq(appNotification.companyFn, 'C-SG'), eq(appNotification.recipientUserId, 1)))
      .limit(1);
    const denied = await fetch(
      `${baseUrl}/api/account/notifications/${adminNotification.id}/actions/mark-read`,
      { method: 'POST', headers: writeHeaders(viewer, 'cross-user-notification'), body: '{}' },
    );
    expect(denied.status).toBe(404);
    expect(await denied.json()).toMatchObject({ error: { code: 'notification_not_found' } });
  });

  it('lets the addressed user manage their own notification state without admin management permission', async () => {
    const [viewerRole] = await db.select({ id: role.roleId }).from(role)
      .where(and(eq(role.masterFn, 'M1'), eq(role.name, 'Viewer')));
    await db.delete(rolePermission).where(and(
      eq(rolePermission.roleId, viewerRole.id),
      eq(rolePermission.permissionKey, 'notifications.manage'),
    ));
    const viewer = await login('viewer@acme.co', 'viewer1234');
    const listed = await fetch(`${baseUrl}/api/account/notifications`, {
      headers: { cookie: viewer.header },
    });
    expect(listed.status).toBe(200);
    const id = (await listed.json()).data[0].id;
    const markedRead = await fetch(`${baseUrl}/api/account/notifications/${id}/actions/mark-read`, {
      method: 'POST', headers: writeHeaders(viewer, 'viewer-notification-read-without-manage'), body: '{}',
    });
    expect(markedRead.status).toBe(200);
    const dismissed = await fetch(`${baseUrl}/api/account/notifications/${id}/actions/dismiss`, {
      method: 'POST', headers: writeHeaders(viewer, 'permission-denied-notification'), body: '{}',
    });
    expect(dismissed.status).toBe(200);
    expect(await dismissed.json()).toMatchObject({ data: { id } });
  });

  it('filters inaccessible destinations and resolves legacy approval routes before delivery to the UI', async () => {
    const [viewerRole] = await db.select({ id: role.roleId }).from(role)
      .where(and(eq(role.masterFn, 'M1'), eq(role.name, 'Viewer')));
    await db.delete(rolePermission).where(and(
      eq(rolePermission.roleId, viewerRole.id),
      eq(rolePermission.permissionKey, 'hr.read'),
    ));
    await db.delete(rolePermission).where(and(
      eq(rolePermission.roleId, viewerRole.id),
      eq(rolePermission.permissionKey, 'dashboard.read'),
    ));
    const [viewerUser] = await db.select({ id: appUser.userId }).from(appUser)
      .where(eq(appUser.email, 'viewer@acme.co'));
    await db.insert(appNotification).values([
      {
        masterFn: 'M1', companyFn: 'C-SG', recipientUserId: viewerUser.id,
        kind: 'approval_required', severity: 'warning',
        subject: 'Legacy personal approval', detail: 'A personal approval is waiting.',
        route: 'leave-approval', entityRef: 'leave_request:1',
      },
      {
        masterFn: 'M1', companyFn: 'C-SG', recipientUserId: viewerUser.id,
        kind: 'system_notice', severity: 'info',
        subject: 'Restricted staff calendar', detail: 'This must not be shown to a non-HR user.',
        route: 'staff-calendar', entityRef: 'appointment:1',
      },
      {
        masterFn: 'M1', companyFn: 'C-SG', recipientUserId: viewerUser.id,
        kind: 'system_notice', severity: 'info',
        subject: 'Restricted dashboard', detail: 'This must not be shown without dashboard access.',
        route: 'dashboard', entityRef: 'dashboard',
      },
      {
        masterFn: 'M1', companyFn: 'C-SG', recipientUserId: viewerUser.id,
        kind: 'system_notice', severity: 'info',
        subject: 'Unknown destination', detail: 'Unregistered destinations are not clickable.',
        route: 'future-screen', entityRef: 'future:1',
      },
    ]);
    const viewer = await login('viewer@acme.co', 'viewer1234');
    const listed = await fetch(`${baseUrl}/api/account/notifications?limit=100`, {
      headers: { cookie: viewer.header },
    });
    expect(listed.status).toBe(200);
    const body = await listed.json();
    expect(body.data).toEqual([
      expect.objectContaining({ subject: 'Legacy personal approval', route: 'my-approvals' }),
    ]);
    const myApprovals = await fetch(`${baseUrl}/api/my/approvals`, {
      headers: { cookie: viewer.header },
    });
    expect(myApprovals.status).toBe(200);
  });
});
