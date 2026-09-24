import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { appUser, auditLog, productCase, productCaseEvent } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import type { SessionData } from '../auth/session';
import {
  createAgentGrant,
  createAgentPrincipal,
  rotateAgentCredential,
  setAgentPrincipalStatus,
} from '../modules/agent/agentIdentity';
import { listProductCases, readProductCase, transitionProductCase } from '../modules/product/productCase';
import { createApp } from './app';

describe('product feedback and ticket intake', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let token: string;
  let principalId: number;
  let session: SessionData;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    session = {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: 'C-SG',
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    };
    const principal = await createAgentPrincipal(db, session, {
      principalKey: 'product-intake-agent',
      displayName: 'Product Intake Agent',
      ownerUserId: admin.userId,
    }, 'product-intake-principal');
    principalId = principal.id;
    for (const [actionName, permissionKey, fieldAllowlist] of [
      ['product_case.submit', 'product.cases.submit', [
        'id', 'caseType', 'title', 'description', 'routeKey', 'referenceId', 'status', 'version', 'createdAt',
      ]],
      ['product_case.read_own', 'product.cases.read_own', [
        'id', 'caseType', 'title', 'description', 'routeKey', 'referenceId', 'status', 'resolution',
        'version', 'createdAt', 'updatedAt', 'events',
      ]],
    ] as const) {
      await createAgentGrant(db, session, {
        agentPrincipalId: principalId,
        actionName,
        permissionKey,
        resourceKey: 'product/cases',
        scope: actionName === 'product_case.read_own' ? 'self' : 'company',
        targetType: actionName === 'product_case.read_own' ? 'employee' : 'none',
        targetId: actionName === 'product_case.read_own' ? String(admin.userId) : '',
        fieldAllowlist: [...fieldAllowlist],
      }, `grant-${actionName}`);
    }
    const rotated = await rotateAgentCredential(db, session, {
      agentPrincipalId: principalId,
      expectedVersion: principal.version,
    }, 'product-intake-credential');
    token = rotated.token;
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  function submit(body: unknown, key: string, bearer = token) {
    return fetch(`${baseUrl}/api/agent/cases`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearer}`,
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      body: JSON.stringify(body),
    });
  }

  const feedback = {
    caseType: 'feedback',
    title: 'Directory filter is difficult to find',
    description: 'The filter is below the fold at narrow widths.',
    routeKey: 'hr-directory',
    referenceId: 'observation-01',
  };

  it('accepts an ERP-issued bearer, persists one case and safely replays the same key', async () => {
    const first = await submit(feedback, 'feedback-intent-0001');
    expect(first.status).toBe(201);
    const firstBody = await first.json() as { data: { id: number; status: string }; replayed: boolean };
    expect(firstBody).toMatchObject({ replayed: false, data: { status: 'submitted' } });
    const second = await submit(feedback, 'feedback-intent-0001');
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ replayed: true, data: { id: firstBody.data.id } });
    const changed = await submit({ ...feedback, title: 'Different issue' }, 'feedback-intent-0001');
    expect(changed.status).toBe(409);
    const [rows, events, audits] = await Promise.all([
      db.select().from(productCase),
      db.select().from(productCaseEvent),
      db.select().from(auditLog).where(and(
        eq(auditLog.entity, 'product_case'),
        eq(auditLog.entityId, String(firstBody.data.id)),
      )),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].idempotencyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].idempotencyHash).not.toContain('feedback-intent-0001');
    expect(events).toHaveLength(1);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ agentPrincipalId: principalId, delegatorUserId: session.userId });
    const read = await fetch(`${baseUrl}/api/agent/cases/${firstBody.data.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ data: { id: firstBody.data.id, events: [{ toStatus: 'submitted' }] } });
  });

  it('converges concurrent retries on one persisted case and audit event', async () => {
    const responses = await Promise.all(Array.from({ length: 3 }, () => submit(feedback, 'concurrent-product-intent-0001')));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 201]);
    const bodies = await Promise.all(responses.map((response) => response.json())) as Array<{ data: { id: number } }>;
    expect(new Set(bodies.map((body) => body.data.id)).size).toBe(1);
    const [rows, events, audits] = await Promise.all([
      db.select().from(productCase),
      db.select().from(productCaseEvent),
      db.select().from(auditLog).where(eq(auditLog.entity, 'product_case')),
    ]);
    expect(rows).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(audits).toHaveLength(1);
  });

  it.each([
    { boundary: 'Agent', perAgent: 2, perCompany: 3 },
    { boundary: 'Company', perAgent: 3, perCompany: 2 },
  ])('limits pilot intake by $boundary without creating a rejected case', async ({ perAgent, perCompany }) => {
    const limitedServer = createApp(db, {
      productCaseRateLimit: {
        perAgent: { maxRequests: perAgent, windowMs: 60_000 },
        perCompany: { maxRequests: perCompany, windowMs: 60_000 },
      },
    }).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => limitedServer.once('listening', resolve));
    const address = limitedServer.address();
    if (!address || typeof address === 'string') throw new Error('No limited server address.');
    try {
      const submitLimited = (key: string) => fetch(`http://127.0.0.1:${address.port}/api/agent/cases`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'idempotency-key': key,
        },
        body: JSON.stringify(feedback),
      });
      expect((await submitLimited('limited-intent-0001')).status).toBe(201);
      expect((await submitLimited('limited-intent-0002')).status).toBe(201);
      const blocked = await submitLimited('limited-intent-0003');
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(await blocked.json()).toMatchObject({ error: { code: 'product_case_rate_limited' } });
      expect(await db.select().from(productCase)).toHaveLength(2);
    } finally {
      await new Promise<void>((resolve, reject) => limitedServer.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('rejects oversized and malformed JSON without logging their raw contents', async () => {
    const marker = 'private-value-must-not-appear-in-logs';
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const oversized = await submit({ ...feedback, description: marker.repeat(400) }, 'oversized-intent-0001');
      expect(oversized.status).toBe(413);
      expect(await oversized.json()).toMatchObject({ error: { code: 'request_too_large' } });
      const malformed = await fetch(`${baseUrl}/api/agent/cases`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: `{ "description": "${marker}"`,
      });
      expect(malformed.status).toBe(400);
      expect(await malformed.json()).toMatchObject({ error: { code: 'invalid_json' } });
      expect(log.mock.calls.flat().join(' ')).not.toContain(marker);
      expect(await db.select().from(productCase)).toHaveLength(0);
    } finally {
      log.mockRestore();
    }
  });

  it('tracks a ticket through human transitions and returns the outcome to the Agent', async () => {
    const response = await submit({
      caseType: 'ticket',
      title: 'Quotation save fails',
      description: 'The save request returns an error on the quotation page.',
      routeKey: 'quotation',
    }, 'product-ticket-0001');
    expect(response.status).toBe(201);
    const { data } = await response.json() as { data: { id: number } };
    const listed = await listProductCases(db, session, { caseType: 'ticket' });
    expect(listed.data).toHaveLength(1);
    const triaged = await transitionProductCase(db, session, data.id, {
      status: 'triaged', expectedVersion: 1,
    }, 'triage-ticket');
    expect(triaged.version).toBe(2);
    await expect(transitionProductCase(db, session, data.id, {
      status: 'closed', expectedVersion: 1, resolution: 'Stale change',
    }, 'stale-ticket')).rejects.toMatchObject({ code: 'product_case_version_stale' });
    const working = await transitionProductCase(db, session, data.id, {
      status: 'in_progress', expectedVersion: 2,
    }, 'work-ticket');
    const resolved = await transitionProductCase(db, session, data.id, {
      status: 'resolved', expectedVersion: working.version, resolution: 'Fixed in candidate revision.',
    }, 'resolve-ticket');
    await transitionProductCase(db, session, data.id, {
      status: 'closed', expectedVersion: resolved.version, resolution: 'Verified in deployed revision.',
    }, 'close-ticket');
    const human = await readProductCase(db, session, data.id);
    expect(human.events).toHaveLength(5);
    const read = await fetch(`${baseUrl}/api/agent/cases/${data.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await read.json()).toMatchObject({ data: {
      status: 'closed', resolution: 'Verified in deployed revision.',
    } });
  });

  it('rejects body identity overrides and a revoked Agent without creating another case', async () => {
    const forged = await submit({ ...feedback, companyFn: 'C-MY' }, 'forged-product-0001');
    expect(forged.status).toBe(400);
    const sensitive = await submit({ ...feedback, description: 'password=verySecretCredential123' }, 'sensitive-product-0001');
    expect(sensitive.status).toBe(400);
    const invalid = await submit(feedback, 'invalid-product-0001', 'not-the-token');
    expect(invalid.status).toBe(401);
    await setAgentPrincipalStatus(db, session, {
      agentPrincipalId: principalId,
      status: 'revoked',
      expectedVersion: 2,
      reason: 'Test revocation',
    }, 'revoke-product-agent');
    const revoked = await submit(feedback, 'revoked-product-0001');
    expect([401, 403]).toContain(revoked.status);
    expect(await db.select().from(productCase)).toHaveLength(0);
  });

  it('does not allow another Agent or an ordinary user to read a case', async () => {
    const response = await submit(feedback, 'private-product-0001');
    const { data } = await response.json() as { data: { id: number } };
    const other = await createAgentPrincipal(db, session, {
      principalKey: 'other-product-agent',
      displayName: 'Other Product Agent',
      ownerUserId: session.userId,
    }, 'other-product-principal');
    await createAgentGrant(db, session, {
      agentPrincipalId: other.id,
      actionName: 'product_case.read_own',
      permissionKey: 'product.cases.read_own',
      resourceKey: 'product/cases',
      scope: 'self',
      targetType: 'employee',
      targetId: String(session.userId),
      fieldAllowlist: ['id', 'caseType', 'title', 'description', 'routeKey', 'referenceId', 'status', 'resolution', 'version', 'createdAt', 'updatedAt', 'events'],
    }, 'other-product-read-grant');
    const otherToken = await rotateAgentCredential(db, session, {
      agentPrincipalId: other.id,
      expectedVersion: other.version,
    }, 'other-product-credential');
    const otherRead = await fetch(`${baseUrl}/api/agent/cases/${data.id}`, {
      headers: { authorization: `Bearer ${otherToken.token}` },
    });
    expect(otherRead.status).toBe(404);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    const viewerSession: SessionData = {
      userId: viewer.userId,
      masterFn: viewer.masterFn,
      activeCompanyFn: 'C-SG',
      username: viewer.username,
      email: viewer.email,
      fullName: viewer.fullName,
    };
    await expect(listProductCases(db, viewerSession)).rejects.toMatchObject({ status: 403 });
  });
});
