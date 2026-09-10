import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../data/schema';
import type { DB } from '../data/db';
import { withTenantTransaction } from '../data/tenantTransaction';
import { completeProductionSetup } from '../modules/setup/completeSetup';
import { uploadReceiptDocument } from '../modules/documents/upload';
import { createCompanyReceiptWithin } from '../modules/expenses/companyReceipt';
import { createCompanyReceiptPackWithin } from '../modules/expenses/companyReceiptPack';
import { hashOpaqueToken } from '../auth/tokenCrypto';
import { createApp } from './app';

const postgresUrl = process.env.POSTGRES_URL;
const suite = postgresUrl ? describe : describe.skip;

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrf) throw new Error('Missing ERP CSRF cookie.');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrf.slice('erp_csrf='.length)) };
}

async function startApi(db: DB): Promise<{ server: Server; baseUrl: string }> {
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No API address.');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopApi(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

suite('Agent lifecycle PostgreSQL FORCE RLS proof', () => {
  const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
  const databaseName = `erp_agent_${suffix}`;
  const roleName = `erp_agent_api_${suffix}`;
  const rolePassword = randomBytes(18).toString('hex');
  let clusterPool: Pool;
  let ownerPool: Pool;
  let apiPool: Pool;
  let ownerDb: DB;
  let apiDb: DB;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const base = new URL(postgresUrl!);
    const clusterUrl = new URL(base);
    clusterUrl.pathname = '/postgres';
    clusterPool = new Pool({ connectionString: clusterUrl.toString() });
    await clusterPool.query(`create database "${databaseName}"`);

    const ownerUrl = new URL(base);
    ownerUrl.pathname = `/${databaseName}`;
    ownerPool = new Pool({ connectionString: ownerUrl.toString() });
    const migratedOwnerDb = drizzle(ownerPool, { schema });
    await migrate(migratedOwnerDb, { migrationsFolder: 'drizzle' });
    ownerDb = migratedOwnerDb as DB;
    await ownerPool.query(
      `create role "${roleName}" login password '${rolePassword}' nosuperuser nobypassrls nocreatedb nocreaterole noinherit`,
    );
    await ownerPool.query(`grant connect on database "${databaseName}" to "${roleName}"`);
    await ownerPool.query(`grant usage on schema public to "${roleName}"`);
    await ownerPool.query(
      `grant select, insert, update, delete on all tables in schema public to "${roleName}"`,
    );
    await ownerPool.query(
      `grant usage, select on all sequences in schema public to "${roleName}"`,
    );
    await ownerPool.query(await readFile('deploy/sql/production-rls.sql', 'utf8'));

    const apiUrl = new URL(base);
    apiUrl.pathname = `/${databaseName}`;
    apiUrl.username = roleName;
    apiUrl.password = rolePassword;
    apiPool = new Pool({ connectionString: apiUrl.toString() });
    apiDb = drizzle(apiPool, { schema }) as DB;
    const running = await startApi(apiDb);
    server = running.server;
    baseUrl = running.baseUrl;
  }, 60_000);

  afterAll(async () => {
    if (server) await stopApi(server);
    await apiPool?.end();
    await ownerPool?.end();
    if (clusterPool) {
      await clusterPool.query(
        `select pg_terminate_backend(pid) from pg_stat_activity
         where datname = '${databaseName}' and pid <> pg_backend_pid()`,
      );
      await clusterPool.query(`drop database if exists "${databaseName}"`);
      await clusterPool.query(`drop role if exists "${roleName}"`);
      await clusterPool.end();
    }
  }, 30_000);

  it('proves issuer lookup, expiry, downgrade, isolation and Agent audit attribution', async () => {
    const setup = await completeProductionSetup(ownerDb, {
      organizationName: 'PostgreSQL Agent Proof',
      organizationCode: 'PG-AGENT',
      companyName: 'Agent Proof Singapore',
      country: 'SG',
      adminName: 'Agent Administrator',
      adminUsername: 'agent.admin',
      adminEmail: 'agent.admin@postgres.example',
      adminPassword: 'agent-admin-password',
      language: 'en',
      moduleKeys: ['expenses_tax'],
    }, 'pg-agent-setup');
    const scope = { masterFn: setup.masterFn, companyFn: setup.companyFn };

    const uploaded = await uploadReceiptDocument(ownerDb, scope, { userId: setup.userId }, {
      clientDraftId: 'agent-pg-receipt-0001',
      fileName: 'agent-pg-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03]),
    });
    await withTenantTransaction(ownerDb, scope, (tx) => tx.update(schema.documentScanJob).set({
      status: 'clean',
      scanner: 'agent-postgres-test',
      resultCode: 'clean',
      completedAt: new Date('2026-09-09T08:00:00.000Z'),
    }).where(and(
      eq(schema.documentScanJob.masterFn, scope.masterFn),
      eq(schema.documentScanJob.companyFn, scope.companyFn),
      eq(schema.documentScanJob.versionId, uploaded.version.id),
    )));
    const receipt = await withTenantTransaction(ownerDb, scope, (tx) =>
      createCompanyReceiptWithin(tx, scope, setup.userId, {
        documentId: uploaded.document.id,
        documentVersionId: uploaded.version.id,
        transactionDate: '2026-09-09',
        merchant: 'Agent PostgreSQL Merchant',
        receiptNumber: 'AGENT-PG-001',
        amount: '42.5000',
        currency: 'SGD',
        category: 'Travel',
        businessPurpose: 'Agent PostgreSQL isolation proof',
      }));
    const pack = await withTenantTransaction(ownerDb, scope, (tx) =>
      createCompanyReceiptPackWithin(tx, scope, setup.userId, 'company', {
        packKey: 'agent-pg-pack-0001',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
      }));
    expect(pack.pack.rows).toEqual([expect.objectContaining({ receiptId: receipt.id })]);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationCode: 'PG-AGENT',
        username: 'agent.admin',
        password: 'agent-admin-password',
      }),
    });
    expect(login.status).toBe(200);
    const adminAuth = responseCookies(login);

    async function adminRequest(path: string, body?: unknown): Promise<Response> {
      return fetch(`${baseUrl}${path}`, {
        method: body == null ? 'GET' : 'POST',
        headers: {
          cookie: adminAuth.header,
          ...(body == null ? {} : {
            'content-type': 'application/json',
            'x-csrf-token': adminAuth.csrf,
          }),
        },
        body: body == null ? undefined : JSON.stringify(body),
      });
    }

    async function agentRequest(token: string, body: unknown): Promise<Response> {
      return fetch(`${baseUrl}/api/agent/actions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }

    const principalResponse = await adminRequest('/api/admin/agents', {
      principalKey: 'pg-agent',
      displayName: 'PostgreSQL Agent',
      ownerUserId: setup.userId,
    });
    expect(principalResponse.status).toBe(201);
    const principal = (await principalResponse.json()).data as {
      id: number;
      version: number;
      actorUserId: number;
    };

    async function createGrant(input: Record<string, unknown>): Promise<{
      id: number;
      version: number;
    }> {
      const response = await adminRequest(`/api/admin/agents/${principal.id}/grants`, {
        ...input,
        agentPrincipalId: principal.id,
      });
      expect(response.status).toBe(201);
      return (await response.json()).data;
    }

    const searchGrant = await createGrant({
      actionName: 'receipt.search',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipts',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['id', 'merchant'],
    });
    await createGrant({
      actionName: 'receipt_pack.export',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipt_packs',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['*'],
    });
    await createGrant({
      actionName: 'receipt.get',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipts',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['id', 'merchant'],
      validFrom: '2026-09-01T00:00:00.000Z',
      validUntil: '2026-09-02T00:00:00.000Z',
    });

    const rotate = await adminRequest(`/api/admin/agents/${principal.id}/actions/rotate-credential`, {
      expectedVersion: principal.version,
    });
    expect(rotate.status).toBe(201);
    const rotated = await rotate.json() as {
      data: { token: string };
      meta: { credentialDelivery: string };
    };
    expect(rotated.meta).toMatchObject({ credentialDelivery: 'show_once' });
    const token = rotated.data.token;
    expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/);

    const credentialRows = await ownerDb.select({
      tokenHash: schema.agentCredential.tokenHash,
      tokenHint: schema.agentCredential.tokenHint,
    }).from(schema.agentCredential).where(eq(
      schema.agentCredential.agentPrincipalId,
      principal.id,
    ));
    expect(credentialRows).toHaveLength(1);
    expect(credentialRows[0]).toMatchObject({ tokenHash: hashOpaqueToken(token) });
    expect(credentialRows[0].tokenHash).not.toBe(token);
    expect(credentialRows[0].tokenHint).not.toBe(token);

    const search = await agentRequest(token, {
      action: 'receipt.search',
      input: { limit: 10 },
    });
    expect(search.status).toBe(200);
    const searchBody = await search.json() as {
      body: { data: Array<Record<string, unknown>> };
    };
    expect(searchBody.body.data).toEqual([
      expect.objectContaining({ id: receipt.id, merchant: 'Agent PostgreSQL Merchant' }),
    ]);
    expect(searchBody.body.data[0]).not.toHaveProperty('amount');

    const reviewResponse = await adminRequest('/api/admin/agents');
    expect(reviewResponse.status).toBe(200);
    const review = await reviewResponse.json() as { data: Array<Record<string, unknown>> };
    const reviewed = review.data.find((row) => row.id === principal.id);
    expect(reviewed).toBeTruthy();
    expect(JSON.stringify(reviewed)).not.toContain(token);
    expect(JSON.stringify(reviewed)).not.toContain(hashOpaqueToken(token));

    const visibleToTenant = await withTenantTransaction(apiDb, scope, (tx) =>
      tx.select({ id: schema.agentPrincipal.id }).from(schema.agentPrincipal));
    expect(visibleToTenant).toEqual([{ id: principal.id }]);
    const visibleToOtherCompany = await withTenantTransaction(apiDb, {
      masterFn: scope.masterFn,
      companyFn: 'C-NO-AGENT',
    }, (tx) => tx.select({ id: schema.agentPrincipal.id }).from(schema.agentPrincipal));
    expect(visibleToOtherCompany).toHaveLength(0);
    const crossTenantUpdate = await withTenantTransaction(apiDb, {
      masterFn: scope.masterFn,
      companyFn: 'C-NO-AGENT',
    }, (tx) => tx.update(schema.agentPrincipal).set({ displayName: 'cross-tenant' })
      .where(eq(schema.agentPrincipal.id, principal.id))
      .returning({ id: schema.agentPrincipal.id }));
    expect(crossTenantUpdate).toHaveLength(0);

    const expired = await agentRequest(token, {
      action: 'receipt.get',
      input: { receiptId: receipt.id },
    });
    expect(expired.status).toBe(403);
    expect(await expired.json()).toMatchObject({ error: { code: 'agent_grant_inactive' } });

    const paused = await adminRequest(`/api/admin/agents/${principal.id}/actions/pause`, {
      expectedVersion: principal.version + 1,
      reason: 'PostgreSQL controlled pause',
    });
    expect(paused.status).toBe(200);
    const pausedCall = await agentRequest(token, { action: 'receipt.search', input: { limit: 1 } });
    expect(pausedCall.status).toBe(403);
    expect(await pausedCall.json()).toMatchObject({ error: { code: 'agent_principal_inactive' } });

    const afterPauseReviewResponse = await adminRequest('/api/admin/agents');
    const afterPauseReview = await afterPauseReviewResponse.json() as {
      data: Array<{ id: number; version: number }>;
    };
    const pausedPrincipal = afterPauseReview.data.find((row) => row.id === principal.id);
    if (!pausedPrincipal) throw new Error('Paused Agent is missing from review.');
    const resumed = await adminRequest(`/api/admin/agents/${principal.id}/actions/resume`, {
      expectedVersion: pausedPrincipal.version,
      reason: 'PostgreSQL controlled resume',
    });
    expect(resumed.status).toBe(200);
    expect((await agentRequest(token, { action: 'receipt.search', input: { limit: 1 } })).status)
      .toBe(200);

    const revoked = await adminRequest(
      `/api/admin/agents/${principal.id}/grants/${searchGrant.id}/actions/revoke`,
      { expectedVersion: searchGrant.version, reason: 'PostgreSQL controlled grant revoke' },
    );
    expect(revoked.status).toBe(200);
    const revokedCall = await agentRequest(token, { action: 'receipt.search', input: { limit: 1 } });
    expect(revokedCall.status).toBe(403);
    expect(await revokedCall.json()).toMatchObject({ error: { code: 'agent_grant_inactive' } });

    const exported = await agentRequest(token, {
      action: 'receipt_pack.export',
      input: { packId: pack.pack.id, action: 'view' },
    });
    expect(exported.status).toBe(200);
    expect(exported.headers.get('x-agent-action')).toBe('receipt_pack.export');
    expect(exported.headers.get('x-receipt-pack-sha256')).toMatch(/^[0-9a-f]{64}$/);
    expect((await exported.arrayBuffer()).byteLength).toBeGreaterThan(0);
    const [audit] = await ownerDb.select({
      actorUserId: schema.auditLog.actorUserId,
      agentPrincipalId: schema.auditLog.agentPrincipalId,
      delegatorUserId: schema.auditLog.delegatorUserId,
    }).from(schema.auditLog).where(and(
      eq(schema.auditLog.entity, 'company_receipt_pack'),
      eq(schema.auditLog.entityId, String(pack.pack.id)),
      eq(schema.auditLog.action, 'pdf_view'),
    ));
    expect(audit).toEqual({
      actorUserId: principal.actorUserId,
      agentPrincipalId: principal.id,
      delegatorUserId: setup.userId,
    });

    const [ownerAssignment] = await ownerDb.select({
      roleId: schema.userCompanyRole.roleId,
    }).from(schema.userCompanyRole).where(and(
      eq(schema.userCompanyRole.userId, setup.userId),
      eq(schema.userCompanyRole.companyFn, setup.companyFn),
    ));
    if (!ownerAssignment) throw new Error('Company Owner role assignment is missing.');
    await ownerDb.delete(schema.rolePermission).where(and(
      eq(schema.rolePermission.masterFn, setup.masterFn),
      eq(schema.rolePermission.roleId, ownerAssignment.roleId),
      eq(schema.rolePermission.permissionKey, 'expenses.company_receipts.read_company'),
    ));
    const downgraded = await agentRequest(token, {
      action: 'receipt_pack.export',
      input: { packId: pack.pack.id, action: 'view' },
    });
    expect(downgraded.status).toBe(403);
    expect(await downgraded.json()).toMatchObject({ error: { code: 'agent_owner_authority_denied' } });
  }, 120_000);
});
