import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import {
  inventoryLot,
  product,
  qualityInspection,
  qualityInspectionPlan,
  qualityInspectionPlanItem,
  qualityInspectionResult,
  qualityNcr,
} from '../data/schema';
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

async function login(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@acme.co', password: 'demo1234' }),
  });
  expect(response.status).toBe(200);
  return responseCookies(response);
}

describe('quality API vertical slice', () => {
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

  it('creates a lot inspection, completes it idempotently and disposes the NCR', async () => {
    const [item] = await db.insert(product).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      sku: 'QC-API',
      name: 'Quality API lot item',
      trackingType: 'lot',
    }).returning({ id: product.id });
    const [lot] = await db.insert(inventoryLot).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      productId: item.id,
      lotNo: 'QC-API-LOT',
    }).returning({ id: inventoryLot.id });
    const [plan] = await db.insert(qualityInspectionPlan).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      code: 'QC-API-PLAN',
      name: 'API inspection plan',
      inspectionType: 'incoming',
      productId: item.id,
      sampleSize: '1',
    }).returning({ id: qualityInspectionPlan.id });
    await db.insert(qualityInspectionPlanItem).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      planId: plan.id,
      sequence: 10,
      characteristic: 'Dimension',
      specification: 'Within tolerance',
      method: 'Caliper',
    });

    const cookies = await login(baseUrl);
    const headers = {
      cookie: cookies.header,
      'content-type': 'application/json',
      'x-csrf-token': cookies.csrf,
    };
    const createResponse = await fetch(`${baseUrl}/api/quality/inspections`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docNo: 'QI-API-1',
        planId: plan.id,
        productId: item.id,
        lotId: lot.id,
        sourceType: 'goods_receipt',
        sourceRef: 'GRN-API-1',
        lotQty: '5',
        sampleQty: '1',
        inspectorName: 'Demo QA',
        inspectionDate: '2026-07-19',
      }),
    });
    expect(createResponse.status).toBe(201);
    const inspection = (await createResponse.json()).data;
    const [result] = await db.select({ id: qualityInspectionResult.id })
      .from(qualityInspectionResult);

    async function inspectionAction(key: string) {
      return fetch(`${baseUrl}/api/quality/inspections/${inspection.id}/actions/complete`, {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': key },
        body: JSON.stringify({
          results: [{
            resultId: result.id,
            measuredValue: 'Outside tolerance',
            result: 'fail',
            defectClass: 'major',
          }],
        }),
      });
    }
    const completeResponse = await inspectionAction('quality-api-complete');
    expect(completeResponse.status).toBe(200);
    const completeBody = await completeResponse.json();
    const replayResponse = await inspectionAction('quality-api-complete');
    expect(replayResponse.status).toBe(200);
    expect(replayResponse.headers.get('idempotency-replayed')).toBe('true');
    expect(await replayResponse.json()).toEqual(completeBody);
    expect(await db.select().from(inventoryLot)).toMatchObject([
      expect.objectContaining({ id: lot.id, qualityStatus: 'hold' }),
    ]);

    const ncrResponse = await fetch(`${baseUrl}/api/quality/ncrs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        docNo: 'NCR-API-1',
        inspectionId: inspection.id,
        severity: 'major',
        affectedQty: '5',
        defectDescription: 'API inspection failed.',
      }),
    });
    expect(ncrResponse.status).toBe(201);
    const ncr = (await ncrResponse.json()).data;
    const releaseResponse = await fetch(
      `${baseUrl}/api/quality/ncrs/${ncr.id}/actions/release`,
      {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'quality-api-release' },
        body: JSON.stringify({}),
      },
    );
    expect(releaseResponse.status).toBe(200);
    expect(await db.select().from(inventoryLot)).toMatchObject([
      expect.objectContaining({ id: lot.id, qualityStatus: 'released' }),
    ]);
    expect(await db.select().from(qualityInspection)).toMatchObject([
      expect.objectContaining({ status: 'closed' }),
    ]);
    expect(await db.select().from(qualityNcr)).toMatchObject([
      expect.objectContaining({ status: 'closed', disposition: 'release' }),
    ]);
  });
});
