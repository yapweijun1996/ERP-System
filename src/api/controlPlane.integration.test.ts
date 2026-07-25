import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { integrationConnector } from '../data/schema';
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
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrf) throw new Error('Missing CSRF cookie');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrf.slice(9)) };
}

describe('canonical control-plane API', () => {
  let db: DB; let server: Server; let baseUrl: string;
  beforeEach(async () => {
    db = await freshDb(); await seedDemo(db);
    server = createApp(db, { tokenEncryptionKey: Buffer.alloc(32, 7).toString('base64') }).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('HTTP server did not bind');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => { if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
  async function login(email = 'admin@acme.co', password = 'demo1234') {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationCode: 'ACME', username: email.split('@')[0], password }) });
    expect(response.status).toBe(200); return responseCookies(response);
  }

  it('serves tenant-scoped canonical reads and encrypts connector credentials', async () => {
    const auth = await login();
    for (const path of [
      '/api/integration/connectors',
      '/api/integration/document-processing-policy',
      '/api/admin/master-control',
      '/api/settings/overview',
    ]) {
      const response = await fetch(baseUrl + path, { headers: { cookie: auth.header } });
      expect(response.status, path).toBe(200);
      const payload = JSON.stringify(await response.json());
      expect(payload).not.toContain('credentialEnvelope');
      if (path !== '/api/admin/master-control') expect(payload).not.toContain('masterFn');
    }
    const connectors = await (await fetch(`${baseUrl}/api/integration/connectors`, { headers: { cookie: auth.header } })).json();
    const target = connectors.data.find((row: { connectorKey: string }) => row.connectorKey === 'warehouse-webhook');
    const secret = 'super-secret-webhook-token';
    const configure = () => fetch(`${baseUrl}/api/integration/connectors/${target.id}/actions/configure`, {
      method: 'POST',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf, 'content-type': 'application/json', 'idempotency-key': 'connector-configure-once' },
      body: JSON.stringify({ secret, label: 'Warehouse primary', endpointHost: 'warehouse.example.test' }),
    });
    const configured = await configure();
    expect(configured.status).toBe(200);
    expect(JSON.stringify(await configured.json())).not.toContain(secret);
    const replay = await configure();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    const [stored] = await db.select().from(integrationConnector).where(and(
      eq(integrationConnector.companyFn, 'C-SG'), eq(integrationConnector.id, target.id),
    ));
    expect(JSON.stringify(stored.credentialEnvelope)).not.toContain(secret);
    expect(stored.credentialEnvelope).toBeTruthy();

    const vision = connectors.data.find(
      (row: { connectorKey: string }) => row.connectorKey === 'document-vision',
    );
    const configureVision = await fetch(
      `${baseUrl}/api/integration/connectors/${vision.id}/actions/configure`,
      {
        method: 'POST',
        headers: {
          cookie: auth.header,
          'x-csrf-token': auth.csrf,
          'content-type': 'application/json',
          'idempotency-key': 'document-vision-secret-once',
        },
        body: JSON.stringify({
          secret: 'document-vision-api-key',
          label: 'Document Vision primary',
          endpointHost: 'vision-gateway.example.test',
        }),
      },
    );
    expect(configureVision.status).toBe(200);
    const saveDocumentPolicy = () => fetch(
      `${baseUrl}/api/integration/document-processing-policy/actions/update`,
      {
        method: 'POST',
        headers: {
          cookie: auth.header,
          'x-csrf-token': auth.csrf,
          'content-type': 'application/json',
          'idempotency-key': 'document-policy-once',
        },
        body: JSON.stringify({
          extractionProvider: 'byok_vision',
          visionProvider: 'openai',
          visionRegion: 'ap-southeast-1',
          visionRetentionDays: 0,
        }),
      },
    );
    const savedDocumentPolicy = await saveDocumentPolicy();
    expect(savedDocumentPolicy.status).toBe(200);
    expect(await savedDocumentPolicy.json()).toMatchObject({
      data: {
        extractionProvider: 'byok_vision',
        visionProvider: 'openai',
        visionRegion: 'ap-southeast-1',
        visionRetentionDays: 0,
      },
    });
    const documentPolicyReplay = await saveDocumentPolicy();
    expect(documentPolicyReplay.status).toBe(200);
    expect(documentPolicyReplay.headers.get('idempotency-replayed')).toBe('true');

    const belowMinimum = await fetch(
      `${baseUrl}/api/integration/receipt-auto-submit-policy/actions/update`,
      {
        method: 'POST',
        headers: {
          cookie: auth.header,
          'x-csrf-token': auth.csrf,
          'content-type': 'application/json',
          'idempotency-key': 'receipt-auto-submit-too-low',
        },
        body: JSON.stringify({ enabled: true, minConfidence: 0.97 }),
      },
    );
    expect(belowMinimum.status).toBe(422);
    expect((await belowMinimum.json()).error.code).toBe('confidence_below_minimum');
    const saveReceiptAutoSubmit = () => fetch(
      `${baseUrl}/api/integration/receipt-auto-submit-policy/actions/update`,
      {
        method: 'POST',
        headers: {
          cookie: auth.header,
          'x-csrf-token': auth.csrf,
          'content-type': 'application/json',
          'idempotency-key': 'receipt-auto-submit-once',
        },
        body: JSON.stringify({ enabled: true, minConfidence: 0.98 }),
      },
    );
    const savedReceiptAutoSubmit = await saveReceiptAutoSubmit();
    expect(savedReceiptAutoSubmit.status).toBe(200);
    expect(await savedReceiptAutoSubmit.json()).toMatchObject({
      data: {
        autoSubmitEnabled: true,
        autoSubmitMinConfidence: '0.9800',
      },
    });
    const receiptAutoSubmitReplay = await saveReceiptAutoSubmit();
    expect(receiptAutoSubmitReplay.status).toBe(200);
    expect(receiptAutoSubmitReplay.headers.get('idempotency-replayed')).toBe('true');

    const savePolicy = () => fetch(`${baseUrl}/api/settings/policy/current/actions/update`, {
      method: 'POST',
      headers: { cookie: auth.header, 'x-csrf-token': auth.csrf, 'content-type': 'application/json', 'idempotency-key': 'settings-policy-once' },
      body: JSON.stringify({ dateFormat: 'DD/MM/YYYY', negativeStockPolicy: 'warn', approvalThreshold: '12000.00', sessionTimeoutMinutes: 60, defaultWarehouseCode: 'SG-MAIN' }),
    });
    expect((await savePolicy()).status).toBe(200);
    const policyReplay = await savePolicy();
    expect(policyReplay.status).toBe(200);
    expect(policyReplay.headers.get('idempotency-replayed')).toBe('true');
  });

  it('enforces CSRF and management/read permissions', async () => {
    const admin = await login();
    const [target] = await db.select().from(integrationConnector).where(eq(integrationConnector.companyFn, 'C-SG'));
    expect((await fetch(`${baseUrl}/api/integration/connectors/${target.id}/actions/check-health`, {
      method: 'POST', headers: { cookie: admin.header, 'content-type': 'application/json' }, body: '{}',
    })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/integration/connectors/${target.id}/actions/check-health`, {
      method: 'POST', headers: { cookie: admin.header, 'x-csrf-token': admin.csrf, 'content-type': 'application/json' }, body: '{}',
    })).status).toBe(428);
    const viewer = await login('viewer@acme.co', 'viewer1234');
    expect((await fetch(`${baseUrl}/api/integration/connectors`, { headers: { cookie: viewer.header } })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/integration/document-processing-policy`, {
      headers: { cookie: viewer.header },
    })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/settings/overview`, { headers: { cookie: viewer.header } })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/admin/master-control`, { headers: { cookie: viewer.header } })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/integration/connectors/${target.id}/actions/check-health`, {
      method: 'POST', headers: { cookie: viewer.header, 'x-csrf-token': viewer.csrf, 'content-type': 'application/json', 'idempotency-key': 'viewer-health-denied' }, body: '{}',
    })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/integration/document-processing-policy/actions/update`, {
      method: 'POST',
      headers: {
        cookie: viewer.header,
        'x-csrf-token': viewer.csrf,
        'content-type': 'application/json',
        'idempotency-key': 'viewer-document-policy-denied',
      },
      body: JSON.stringify({ extractionProvider: 'local_ocr' }),
    })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/integration/receipt-auto-submit-policy/actions/update`, {
      method: 'POST',
      headers: {
        cookie: viewer.header,
        'x-csrf-token': viewer.csrf,
        'content-type': 'application/json',
        'idempotency-key': 'viewer-receipt-policy-denied',
      },
      body: JSON.stringify({ enabled: true, minConfidence: 0.98 }),
    })).status).toBe(403);
  });
});
