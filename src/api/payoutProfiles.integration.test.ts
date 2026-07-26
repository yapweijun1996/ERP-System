import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import {
  auditLog,
  employeePayoutProfile,
  employeePayoutProfileEvent,
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

describe('employee payout profile API', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db, {
      tokenEncryptionKey: Buffer.alloc(32, 13).toString('base64'),
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
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    return cookies(response);
  }

  it('masks ordinary reads, audits reveals, verifies independently and invalidates on change', async () => {
    const viewer = await login('viewer', 'viewer1234');
    const admin = await login('admin', 'demo1234');
    const details = {
      bankCountry: 'SG',
      currency: 'SGD',
      bankCode: 'DBSSG',
      bankName: 'DBS Bank',
      accountHolderName: 'Marcus Silva',
      accountNumber: '123456789012',
      swiftBic: 'DBSSSGSG',
    };
    const viewerWriteHeaders = {
      cookie: viewer.header,
      'x-csrf-token': viewer.csrf,
      'content-type': 'application/json',
    };
    const adminWriteHeaders = {
      cookie: admin.header,
      'x-csrf-token': admin.csrf,
      'content-type': 'application/json',
    };
    const created = await fetch(`${baseUrl}/api/my/payout-profile`, {
      method: 'PUT',
      headers: { ...viewerWriteHeaders, 'idempotency-key': 'payout-create-0001' },
      body: JSON.stringify(details),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as {
      data: { id: number; employeeId: number; version: number; verificationStatus: string };
    };
    expect(createdBody.data).toMatchObject({ version: 1, verificationStatus: 'unverified' });
    expect(JSON.stringify(createdBody)).not.toContain(details.accountNumber);
    expect(JSON.stringify(createdBody)).not.toContain(details.accountHolderName);
    expect(JSON.stringify(createdBody)).not.toContain('detailsEnvelope');

    const replay = await fetch(`${baseUrl}/api/my/payout-profile`, {
      method: 'PUT',
      headers: { ...viewerWriteHeaders, 'idempotency-key': 'payout-create-0001' },
      body: JSON.stringify(details),
    });
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');

    const ordinary = await fetch(`${baseUrl}/api/my/payout-profile`, {
      headers: { cookie: viewer.header },
    });
    expect(ordinary.status).toBe(200);
    const ordinaryText = await ordinary.text();
    expect(ordinaryText).not.toContain(details.accountNumber);
    expect(ordinaryText).not.toContain('detailsEnvelope');

    const deniedQueue = await fetch(`${baseUrl}/api/payout-profiles`, {
      headers: { cookie: viewer.header },
    });
    expect(deniedQueue.status).toBe(403);

    const adminQueue = await fetch(`${baseUrl}/api/payout-profiles`, {
      headers: { cookie: admin.header },
    });
    expect(adminQueue.status).toBe(200);
    const queueText = await adminQueue.text();
    expect(queueText).not.toContain(details.accountNumber);
    expect(queueText).not.toContain('detailsEnvelope');

    const verified = await fetch(
      `${baseUrl}/api/payout-profiles/${createdBody.data.employeeId}/actions/verify`,
      {
        method: 'POST',
        headers: { ...adminWriteHeaders, 'idempotency-key': 'payout-verify-0001' },
        body: JSON.stringify({
          expectedVersion: createdBody.data.version,
          reason: 'Matched employee-provided bank evidence.',
        }),
      },
    );
    expect(verified.status).toBe(200);
    const verifiedBody = await verified.json() as {
      data: { profile: { version: number; verificationStatus: string } };
    };
    expect(verifiedBody.data.profile).toMatchObject({
      version: 2,
      verificationStatus: 'verified',
    });

    const revealed = await fetch(
      `${baseUrl}/api/payout-profiles/${createdBody.data.employeeId}/actions/reveal`,
      {
        method: 'POST',
        headers: adminWriteHeaders,
        body: JSON.stringify({ purpose: 'Finance verification against bank evidence.' }),
      },
    );
    expect(revealed.status).toBe(200);
    expect(revealed.headers.get('cache-control')).toBe('no-store');
    const revealedBody = await revealed.json() as {
      data: { details: typeof details };
    };
    expect(revealedBody.data.details).toMatchObject(details);

    const modified = await fetch(`${baseUrl}/api/my/payout-profile`, {
      method: 'PUT',
      headers: { ...viewerWriteHeaders, 'idempotency-key': 'payout-update-0001' },
      body: JSON.stringify({
        ...details,
        accountNumber: '998877665544',
        expectedVersion: verifiedBody.data.profile.version,
      }),
    });
    expect(modified.status).toBe(200);
    const modifiedBody = await modified.json() as {
      data: { version: number; verificationStatus: string; verificationInvalidatedAt: string };
    };
    expect(modifiedBody.data).toMatchObject({
      version: 3,
      verificationStatus: 'unverified',
    });
    expect(modifiedBody.data.verificationInvalidatedAt).toBeTruthy();
    expect(JSON.stringify(modifiedBody)).not.toContain('998877665544');

    const [stored] = await db.select().from(employeePayoutProfile);
    expect(JSON.stringify(stored.detailsEnvelope)).not.toContain('998877665544');
    const reveals = await db.select().from(employeePayoutProfileEvent).where(
      eq(employeePayoutProfileEvent.eventType, 'revealed'),
    );
    expect(reveals).toHaveLength(1);
    const revealAudits = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'employee_payout_profile'),
      eq(auditLog.action, 'sensitive_details_revealed'),
    ));
    expect(revealAudits).toHaveLength(1);
    expect(JSON.stringify({ reveals, revealAudits })).not.toContain(details.accountNumber);
  });

  it('rejects client-selected employee identity', async () => {
    const viewer = await login('viewer', 'viewer1234');
    const response = await fetch(`${baseUrl}/api/my/payout-profile`, {
      method: 'PUT',
      headers: {
        cookie: viewer.header,
        'x-csrf-token': viewer.csrf,
        'content-type': 'application/json',
        'idempotency-key': 'payout-identity-tamper',
      },
      body: JSON.stringify({
        employeeId: 999,
        bankCountry: 'SG',
        currency: 'SGD',
        bankCode: 'DBSSG',
        bankName: 'DBS Bank',
        accountHolderName: 'Someone Else',
        accountNumber: '12345678',
      }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('actor_identity_is_session_derived');
  });
});
