import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import {
  bomComponent,
  bomVersion,
  glEntry,
  manufacturingBom,
  manufacturingRouting,
  product,
  routingOperation,
  stockLevel,
  stockMovement,
  warehouse,
  workCenter,
  workOrder,
  workOrderOperation,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { setStockQtyForFixture } from '../modules/inventory/stock';
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

async function login(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@acme.co', password: 'demo1234' }),
  });
  expect(response.status).toBe(200);
  return responseCookies(response);
}

describe('manufacturing API vertical slice', () => {
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

  it('creates, releases, issues, reports and completes through authenticated idempotent actions', async () => {
    const products = await db.select({ id: product.id, sku: product.sku }).from(product)
      .where(and(eq(product.masterFn, 'M1'), eq(product.companyFn, 'C-SG')));
    const finished = products.find((row) => row.sku === 'SG-WIDGET')!;
    const component = products.find((row) => row.sku === 'SG-GADGET')!;
    const [location] = await db.insert(warehouse).values({
      masterFn: 'M1', companyFn: 'C-SG', code: 'MFG-API', name: 'Manufacturing API',
    }).returning({ id: warehouse.id });
    await db.insert(stockLevel).values([
      {
        masterFn: 'M1', companyFn: 'C-SG',
        productId: finished.id, warehouseId: location.id, qty: '0',
      },
      {
        masterFn: 'M1', companyFn: 'C-SG',
        productId: component.id, warehouseId: location.id, qty: '0',
      },
    ]);
    await setStockQtyForFixture(db, { masterFn: 'M1', companyFn: 'C-SG' },
      component.id, location.id, 20);
    const [center] = await db.insert(workCenter).values({
      masterFn: 'M1', companyFn: 'C-SG', code: 'WC-API', name: 'API assembly',
    }).returning({ id: workCenter.id });
    const [bom] = await db.insert(manufacturingBom).values({
      masterFn: 'M1', companyFn: 'C-SG',
      code: 'BOM-API', name: 'API BOM', productId: finished.id,
    }).returning({ id: manufacturingBom.id });
    const [version] = await db.insert(bomVersion).values({
      masterFn: 'M1', companyFn: 'C-SG',
      bomId: bom.id, revision: 'A', status: 'active',
      effectiveFrom: '2026-07-01', outputQty: '1', uom: 'unit',
    }).returning({ id: bomVersion.id });
    await db.insert(bomComponent).values({
      masterFn: 'M1', companyFn: 'C-SG',
      bomVersionId: version.id, lineNo: 1, productId: component.id,
      qtyPer: '2', scrapPct: '0',
    });
    const [routing] = await db.insert(manufacturingRouting).values({
      masterFn: 'M1', companyFn: 'C-SG',
      code: 'RT-API', name: 'API routing', productId: finished.id,
    }).returning({ id: manufacturingRouting.id });
    await db.insert(routingOperation).values({
      masterFn: 'M1', companyFn: 'C-SG',
      routingId: routing.id, sequence: 10, workCenterId: center.id,
      name: 'Assemble', setupHours: '0.5', runHoursPerUnit: '0.25',
    });

    const cookies = await login(baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const createdResponse = await fetch(`${baseUrl}/api/manufacturing/work-orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docNo: 'WO-API-1',
        productId: finished.id,
        bomVersionId: version.id,
        routingId: routing.id,
        warehouseId: location.id,
        plannedQty: '5',
        startDate: '2026-07-19',
        dueDate: '2026-07-22',
        priority: 'high',
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()).data;

    async function action(name: string, payload: Record<string, unknown>, key: string) {
      return fetch(
        `${baseUrl}/api/manufacturing/work-orders/${created.id}/actions/${name}`,
        {
          method: 'POST',
          headers: { ...headers, 'idempotency-key': key },
          body: JSON.stringify(payload),
        },
      );
    }
    expect((await action('release', {}, 'wo-api-release')).status).toBe(200);
    const issueResponse = await action('issue-materials', {}, 'wo-api-issue');
    expect(issueResponse.status).toBe(200);
    const issueBody = await issueResponse.json();
    const issueReplay = await action('issue-materials', {}, 'wo-api-issue');
    expect(issueReplay.status).toBe(200);
    expect(await issueReplay.json()).toEqual(issueBody);

    const [operation] = await db.select({ id: workOrderOperation.id })
      .from(workOrderOperation)
      .where(eq(workOrderOperation.workOrderId, created.id));
    expect((await action('report-operation', {
      operationId: operation.id, hours: '1.75', complete: true,
    }, 'wo-api-operation')).status).toBe(200);
    expect((await action('complete', {}, 'wo-api-complete')).status).toBe(200);

    expect(await db.select().from(workOrder).where(eq(workOrder.id, created.id)))
      .toMatchObject([{ status: 'completed', completedQty: '5.0000' }]);
    expect(await db.select().from(stockMovement)).toMatchObject([
      expect.objectContaining({ direction: 'out', qty: '10.0000' }),
      expect.objectContaining({ direction: 'in', qty: '5.0000' }),
    ]);
    const entries = await db.select().from(glEntry)
      .where(and(eq(glEntry.masterFn, 'M1'), eq(glEntry.companyFn, 'C-SG')));
    const manufacturingEntries = entries.filter((row) => row.journalRef.includes('WO-API-1'));
    expect(manufacturingEntries).toHaveLength(4);
    expect(manufacturingEntries.reduce((sum, row) => sum + Number(row.debit), 0))
      .toBe(manufacturingEntries.reduce((sum, row) => sum + Number(row.credit), 0));
  });
});
