import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { decryptToken } from '../auth/tokenCrypto';
import type { DB } from '../data/db';
import { agentProviderConfig, auditLog } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

const encryptionKey = Buffer.alloc(32, 8);
const encryptionKeyText = encryptionKey.toString('hex');

function responseCookies(response: Response): { header: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrf) throw new Error('Login did not return a CSRF cookie.');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrf.slice('erp_csrf='.length)) };
}

describe('Agent provider configuration API', () => {
  let db: DB;
  let server: Server | undefined;
  let baseUrl: string;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    server = createApp(db, {
      tokenEncryptionKey: encryptionKeyText,
      agentAllowedEgressHosts: ['gateway.example.test'],
    }).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing API address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    const activeServer = server;
    server = undefined;
    await new Promise<void>((resolve, reject) => activeServer.close((error) =>
      error ? reject(error) : resolve()));
  });

  async function login(username: 'admin' | 'viewer', password: string) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    return responseCookies(response);
  }

  function mutationHeaders(auth: { header: string; csrf: string }, key: string) {
    return {
      cookie: auth.header,
      'x-csrf-token': auth.csrf,
      'idempotency-key': key,
      'content-type': 'application/json',
    };
  }

  it('derives tenant scope, enforces permissions, encrypts secrets, and replays safely', async () => {
    const admin = await login('admin', 'demo1234');
    const viewer = await login('viewer', 'viewer1234');
    const empty = await fetch(`${baseUrl}/api/integration/agent-provider`, {
      headers: { cookie: admin.header },
    });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toMatchObject({ data: null, meta: { credentialValuesOmitted: true } });

    const viewerUpdate = await fetch(`${baseUrl}/api/integration/agent-provider/actions/update`, {
      method: 'POST',
      headers: mutationHeaders(viewer, 'agent-provider-viewer-denied'),
      body: JSON.stringify({
        provider: 'deterministic.zero_spend', model: 'erp-test-zero-spend-v1',
      }),
    });
    expect(viewerUpdate.status).toBe(403);
    expect((await viewerUpdate.json()).error.code).toBe('permission_denied');

    const tenantOverride = await fetch(`${baseUrl}/api/integration/agent-provider/actions/update`, {
      method: 'POST',
      headers: mutationHeaders(admin, 'agent-provider-tenant-override'),
      body: JSON.stringify({
        masterFn: 'M1', companyFn: 'C-MY', provider: 'deterministic.zero_spend',
        model: 'erp-test-zero-spend-v1',
      }),
    });
    expect(tenantOverride.status).toBe(400);
    expect((await tenantOverride.json()).error.code).toBe('tenant_override_rejected');

    const secret = 'api-secret-never-returned';
    const payload = {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      secret,
      credentialLabel: 'API test credential',
    };
    const configured = await fetch(`${baseUrl}/api/integration/agent-provider/actions/update`, {
      method: 'POST',
      headers: mutationHeaders(admin, 'agent-provider-configure-1'),
      body: JSON.stringify(payload),
    });
    expect(configured.status).toBe(200);
    const configuredBody = await configured.json();
    expect(configuredBody).toMatchObject({ data: {
      provider: 'openai', credentialConfigured: true, credentialLabel: 'API test credential',
    } });
    expect(JSON.stringify(configuredBody)).not.toContain(secret);
    expect(JSON.stringify(configuredBody)).not.toContain('credentialEnvelope');

    const replay = await fetch(`${baseUrl}/api/integration/agent-provider/actions/update`, {
      method: 'POST',
      headers: mutationHeaders(admin, 'agent-provider-configure-1'),
      body: JSON.stringify(payload),
    });
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(JSON.stringify(await replay.json())).not.toContain(secret);

    const [stored] = await db.select().from(agentProviderConfig).where(and(
      eq(agentProviderConfig.masterFn, 'M1'), eq(agentProviderConfig.companyFn, 'C-SG'),
    ));
    expect(stored).toBeTruthy();
    expect(decryptToken(stored.credentialEnvelope as Parameters<typeof decryptToken>[0], encryptionKey))
      .toBe(secret);
    const auditRows = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'agent_provider_config'), eq(auditLog.entityId, 'C-SG'),
    ));
    expect(JSON.stringify(auditRows)).not.toContain(secret);

    const publicConfig = await fetch(`${baseUrl}/api/integration/agent-provider`, {
      headers: { cookie: admin.header },
    });
    expect(publicConfig.status).toBe(200);
    expect(JSON.stringify(await publicConfig.json())).not.toContain(secret);
  });

  it('rejects unapproved compatible egress endpoints without contacting the network', async () => {
    const admin = await login('admin', 'demo1234');
    const response = await fetch(`${baseUrl}/api/integration/agent-provider/actions/update`, {
      method: 'POST',
      headers: mutationHeaders(admin, 'agent-provider-egress-1'),
      body: JSON.stringify({
        provider: 'openai_compatible',
        model: 'gateway-model',
        endpointUrl: 'https://not-approved.example.test/v1',
        secret: 'compatible-secret-value',
      }),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: 'endpoint_not_allowed' } });
  });
});
