import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { auditLog, product, stockLevel, stockMovement } from '../data/schema';
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

describe('inventory product API vertical slice', () => {
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
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(response.status).toBe(200);
    return responseCookies(response);
  }

  function createHeaders(auth: { header: string; csrf: string }) {
    return {
      cookie: auth.header,
      'content-type': 'application/json',
      'x-csrf-token': auth.csrf,
    };
  }

  const payload = {
    sku: 'API-HOSE-12',
    name: 'Fictional Hydraulic Hose 12mm',
    uom: 'ea',
    category: 'Components',
    standardCost: '8.7500',
    reorderPoint: '12',
    reorderQty: '48',
  };

  it('creates one audited tenant-scoped master record with zero stock', async () => {
    const auth = await login();
    const response = await fetch(`${baseUrl}/api/inventory/products`, {
      method: 'POST',
      headers: { ...createHeaders(auth), 'x-request-id': 'inventory-product-create' },
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(201);
    const created = (await response.json()).data as { id: number };

    expect(await db.select().from(product).where(eq(product.id, created.id))).toEqual([
      expect.objectContaining({
        masterFn: 'M1', companyFn: 'C-SG', sku: payload.sku,
        name: payload.name, category: payload.category, standardCost: '8.7500',
        reorderPoint: '12.0000', reorderQty: '48.0000', trackingType: 'none', version: 1,
      }),
    ]);
    expect(await db.select().from(stockLevel).where(eq(stockLevel.productId, created.id))).toHaveLength(0);
    expect(await db.select().from(stockMovement).where(eq(stockMovement.productId, created.id))).toHaveLength(0);
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'inventory/products'),
      eq(auditLog.entityId, String(created.id)),
    ))).toEqual([
      expect.objectContaining({ action: 'create', requestId: 'inventory-product-create' }),
    ]);

    const listed = await fetch(`${baseUrl}/api/inventory/products?limit=100`, {
      headers: { cookie: auth.header },
    });
    expect(listed.status).toBe(200);
    expect((await listed.json()).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.id, sku: payload.sku }),
    ]));
  });

  it('returns useful contract errors for invalid, duplicate and tenant-override writes', async () => {
    const auth = await login();
    const headers = createHeaders(auth);
    const first = await fetch(`${baseUrl}/api/inventory/products`, {
      method: 'POST', headers, body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);

    const duplicate = await fetch(`${baseUrl}/api/inventory/products`, {
      method: 'POST', headers, body: JSON.stringify({ ...payload, name: 'Duplicate' }),
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({
      error: { code: 'product_conflict', message: expect.stringContaining(payload.sku) },
    });

    const invalid = await fetch(`${baseUrl}/api/inventory/products`, {
      method: 'POST', headers, body: JSON.stringify({ ...payload, sku: 'BAD-CAT', category: 'Imaginary' }),
    });
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({ error: { code: 'validation_failed' } });

    const override = await fetch(`${baseUrl}/api/inventory/products`, {
      method: 'POST', headers,
      body: JSON.stringify({ ...payload, sku: 'BAD-SCOPE', masterFn: 'OTHER', companyFn: 'OTHER-C' }),
    });
    expect(override.status).toBe(400);
    expect(await override.json()).toMatchObject({ error: { code: 'tenant_override_rejected' } });
  });

  it('allows Viewer reads but denies product creation', async () => {
    const auth = await login('viewer@acme.co', 'viewer1234');
    expect((await fetch(`${baseUrl}/api/inventory/products`, {
      headers: { cookie: auth.header },
    })).status).toBe(200);
    const denied = await fetch(`${baseUrl}/api/inventory/products`, {
      method: 'POST',
      headers: createHeaders(auth),
      body: JSON.stringify({ ...payload, sku: 'VIEWER-DENIED' }),
    });
    expect(denied.status).toBe(403);
    expect(await db.select().from(product).where(eq(product.sku, 'VIEWER-DENIED'))).toHaveLength(0);
  });
});
