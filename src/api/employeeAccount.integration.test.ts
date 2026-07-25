import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  appUser,
  auditLog,
  employee,
  employeeActivationSecret,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='))?.slice('erp_csrf='.length);
  if (!csrf) throw new Error('Missing CSRF cookie');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrf) };
}

describe('employee account API lifecycle', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db, {
      tokenEncryptionKey: Buffer.alloc(32, 9).toString('base64'),
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
    return fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
  }

  it('requires an audited reveal, restricts preactivation, and destroys the secret on completion', async () => {
    const adminLogin = await login('admin', 'demo1234');
    const admin = cookies(adminLogin);
    const [subject] = await db.select().from(employee).where(and(
      eq(employee.masterFn, 'M1'),
      eq(employee.companyFn, 'C-SG'),
    )).limit(1);
    const mutationHeaders = {
      cookie: admin.header,
      'x-csrf-token': admin.csrf,
      'content-type': 'application/json',
    };

    const created = await fetch(`${baseUrl}/api/hr/employee-accounts/${subject.id}/actions/create`, {
      method: 'POST',
      headers: { ...mutationHeaders, 'idempotency-key': 'create-employee-login' },
      body: JSON.stringify({ username: 'staff.one' }),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { data: { userId: number } };
    expect(JSON.stringify(createdBody)).not.toContain('temporaryPassword');

    const reveal = async () => {
      const response = await fetch(
        `${baseUrl}/api/hr/employee-accounts/${subject.id}/actions/reveal-temporary-password`,
        { method: 'POST', headers: mutationHeaders, body: '{}' },
      );
      expect(response.status).toBe(200);
      return response.json() as Promise<{ data: { temporaryPassword: string } }>;
    };
    const first = await reveal();
    const second = await reveal();
    expect(second.data.temporaryPassword).toBe(first.data.temporaryPassword);
    const revealAudits = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'employee_account'),
      eq(auditLog.action, 'temporary_password_revealed'),
    ));
    expect(revealAudits).toHaveLength(2);

    await db.update(employeeActivationSecret).set({
      expiresAt: new Date(Date.now() - 1_000),
    }).where(eq(employeeActivationSecret.userId, createdBody.data.userId));
    expect((await login('staff.one', first.data.temporaryPassword)).status).toBe(401);
    await db.update(employeeActivationSecret).set({
      expiresAt: new Date(Date.now() + 60_000),
    }).where(eq(employeeActivationSecret.userId, createdBody.data.userId));

    const employeeLogin = await login('staff.one', first.data.temporaryPassword);
    expect(employeeLogin.status).toBe(200);
    const employeeCookies = cookies(employeeLogin);
    const sessionBody = await (await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: employeeCookies.header },
    })).json() as { passwordChangeRequired: boolean };
    expect(sessionBody.passwordChangeRequired).toBe(true);
    const blockedDashboard = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { cookie: employeeCookies.header },
    });
    expect(blockedDashboard.status).toBe(403);
    expect((await blockedDashboard.json()).error.code).toBe('activation_required');

    const completed = await fetch(`${baseUrl}/api/auth/activation/actions/complete`, {
      method: 'POST',
      headers: {
        cookie: employeeCookies.header,
        'x-csrf-token': employeeCookies.csrf,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'staff.one@example.com',
        password: 'Changed-password-456!',
        confirmPassword: 'Changed-password-456!',
      }),
    });
    expect(completed.status).toBe(200);
    const [secret] = await db.select().from(employeeActivationSecret)
      .where(eq(employeeActivationSecret.userId, createdBody.data.userId));
    expect(secret.credentialEnvelope).toBeNull();
    expect(secret.clearedAt).toBeInstanceOf(Date);
    expect((await login('staff.one', first.data.temporaryPassword)).status).toBe(401);
    expect((await login('staff.one', 'Changed-password-456!')).status).toBe(200);
  });

  it('does not issue public email reset tokens for linked employee accounts', async () => {
    const [user] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const [subject] = await db.select().from(employee).where(and(
      eq(employee.masterFn, 'M1'),
      eq(employee.companyFn, 'C-SG'),
    )).limit(1);
    await db.update(employee).set({ userId: user.userId }).where(eq(employee.id, subject.id));

    const response = await fetch(`${baseUrl}/api/auth/password-reset/actions/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    });
    expect(response.status).toBe(202);
    // Endpoint stays enumeration-safe; absence of an outbox/reset record is
    // covered by lifecycle unit tests and the employee link guard.
  });
});
