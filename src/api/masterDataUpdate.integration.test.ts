import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { auditLog } from '../data/schema';
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
  if (!csrfPair || !pairs.some((pair) => pair.startsWith('erp_session='))) {
    throw new Error('Missing authentication cookies');
  }
  return {
    header: pairs.join('; '),
    csrf: decodeURIComponent(csrfPair.slice('erp_csrf='.length)),
  };
}

describe('canonical master-data update contract', () => {
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
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  async function login(username = 'admin', password = 'demo1234') {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    return responseCookies(response);
  }

  async function first(resource: string, auth: { header: string }) {
    const response = await fetch(`${baseUrl}/api/${resource}?limit=1`, {
      headers: { cookie: auth.header },
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Array<Record<string, unknown>> };
    expect(body.data).toHaveLength(1);
    return body.data[0];
  }

  async function patch(
    resource: string,
    row: Record<string, unknown>,
    payload: Record<string, unknown>,
    auth: { header: string; csrf: string },
    version: string | number,
  ) {
    return fetch(`${baseUrl}/api/${resource}/${row.id}`, {
      method: 'PATCH',
      headers: {
        cookie: auth.header,
        'x-csrf-token': auth.csrf,
        'content-type': 'application/json',
        'if-match': `"${version}"`,
      },
      body: JSON.stringify(payload),
    });
  }

  it('updates customer, supplier and product master data with audit and stale-write protection', async () => {
    const auth = await login();
    const customer = await first('crm/customers', auth);
    const supplier = await first('purchasing/suppliers', auth);
    const product = await first('inventory/products', auth);

    const customerUpdate = await patch('crm/customers', customer, {
      code: `${String(customer.code)}-EDIT`, name: 'Edited customer', industry: 'Services',
    }, auth, String(customer.updatedAt));
    expect(customerUpdate.status).toBe(200);
    expect((await customerUpdate.json()).data).toMatchObject({
      code: `${String(customer.code)}-EDIT`, name: 'Edited customer', industry: 'Services',
    });

    const supplierUpdate = await patch('purchasing/suppliers', supplier, {
      code: `${String(supplier.code)}-EDIT`, name: 'Edited supplier',
    }, auth, String(supplier.updatedAt));
    expect(supplierUpdate.status).toBe(200);
    expect((await supplierUpdate.json()).data).toMatchObject({
      code: `${String(supplier.code)}-EDIT`, name: 'Edited supplier',
    });

    const productUpdate = await patch('inventory/products', product, {
      name: 'Edited product', uom: product.uom, category: product.category,
      standardCost: String(product.standardCost), reorderPoint: String(product.reorderPoint),
      reorderQty: String(product.reorderQty),
    }, auth, Number(product.version));
    expect(productUpdate.status).toBe(200);
    expect((await productUpdate.json()).data).toMatchObject({
      id: product.id, name: 'Edited product', version: Number(product.version) + 1,
    });

    const staleProduct = await patch('inventory/products', product, {
      name: 'Stale product', uom: product.uom, category: product.category,
      standardCost: String(product.standardCost), reorderPoint: String(product.reorderPoint),
      reorderQty: String(product.reorderQty),
    }, auth, Number(product.version));
    expect(staleProduct.status).toBe(409);
    expect((await staleProduct.json()).error.code).toBe('product_stale');

    for (const [entity, id, action] of [
      ['crm/customers', customer.id, 'update'],
      ['purchasing/suppliers', supplier.id, 'update'],
      ['inventory/products', product.id, 'update'],
    ] as const) {
      expect(await db.select().from(auditLog).where(and(
        eq(auditLog.entity, entity), eq(auditLog.entityId, String(id)), eq(auditLog.action, action),
      ))).toHaveLength(1);
    }
  });

  it('returns field errors and denies a read-only user from updating master data', async () => {
    const admin = await login();
    const customer = await first('crm/customers', admin);
    const invalid = await patch('crm/customers', customer, {
      code: '', name: '', industry: '',
    }, admin, String(customer.updatedAt));
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).error).toMatchObject({
      code: 'customer_validation_failed',
      fieldErrors: { code: 'Customer code is required.', name: 'Customer name is required.' },
    });

    const viewer = await login('viewer', 'viewer1234');
    const viewerCustomer = await first('crm/customers', viewer);
    const denied = await patch('crm/customers', viewerCustomer, {
      code: String(viewerCustomer.code), name: 'Denied', industry: viewerCustomer.industry,
    }, viewer, String(viewerCustomer.updatedAt));
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe('permission_denied');
  });
});
