import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { account, auditLog, bankStatement, bankStatementLine, glEntry } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) =>
    Array.from(value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
      (match) => `${match[1]}=${match[2]}`));
  const csrfPair = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrfPair) throw new Error('Missing CSRF cookie');
  return { header: pairs.join('; '), csrf: decodeURIComponent(csrfPair.slice(9)) };
}

describe('bank reconciliation API vertical slice', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let bankAccountId: number;
  let bankLegId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const [bank] = await db.select({ id: account.id }).from(account).where(and(
      eq(account.masterFn, 'M1'), eq(account.companyFn, 'C-SG'), eq(account.code, '1000'),
    ));
    bankAccountId = bank.id;
    const [leg] = await db.insert(glEntry).values({
      masterFn: 'M1', companyFn: 'C-SG', postedAt: new Date('2026-07-22T00:00:00.000Z'),
      journalRef: 'BR-BANK-API', accountId: bankAccountId, debit: '88.25', credit: '0',
      memo: 'Fictional API receipt',
    }).returning({ id: glEntry.id });
    bankLegId = leg.id;
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
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username: email.split('@')[0], password }),
    });
    expect(response.status).toBe(200);
    return cookies(response);
  }

  it('creates, matches and reconciles with RBAC, audit and idempotent replay', async () => {
    const auth = await login();
    const headers = {
      cookie: auth.header,
      'content-type': 'application/json',
      'x-csrf-token': auth.csrf,
    };
    const createResponse = await fetch(`${baseUrl}/api/finance/bank-statements`, {
      method: 'POST', headers: { ...headers, 'x-request-id': 'bank-statement-create' },
      body: JSON.stringify({
        statementNo: 'BS-API-1', bankAccountId, currency: 'SGD',
        periodStart: '2026-07-01', periodEnd: '2026-07-31',
        openingBalance: '1000.00', closingBalance: '1088.25',
        lines: [{
          transactionDate: '2026-07-22', reference: 'API-BANK-1',
          description: 'Fictional customer receipt', amount: '88.25',
        }],
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()).data;
    expect(created).toMatchObject({ status: 'draft', version: 1, lineCount: 1 });
    const lineResponse = await fetch(
      `${baseUrl}/api/finance/bank-statement-lines?limit=100&statementId=${created.id}`,
      { headers: { cookie: auth.header } },
    );
    expect(lineResponse.status).toBe(200);
    const [line] = (await lineResponse.json()).data;

    const match = () => fetch(
      `${baseUrl}/api/finance/bank-statement-lines/${line.id}/actions/match`,
      {
        method: 'POST', headers: { ...headers, 'idempotency-key': 'bank-match-api-1' },
        body: JSON.stringify({ glEntryId: bankLegId }),
      },
    );
    const matchedResponse = await match();
    expect(matchedResponse.status).toBe(200);
    expect((await matchedResponse.clone().json()).data)
      .toMatchObject({ matchedGlEntryId: bankLegId, statementVersion: 2 });
    const replay = await match();
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');

    const reconcile = () => fetch(
      `${baseUrl}/api/finance/bank-statements/${created.id}/actions/reconcile`,
      {
        method: 'POST', headers: { ...headers, 'idempotency-key': 'bank-reconcile-api-1' },
        body: '{}',
      },
    );
    const reconciled = await reconcile();
    expect(reconciled.status).toBe(200);
    expect((await reconciled.json()).data).toMatchObject({ status: 'reconciled', version: 3 });
    const reconciledReplay = await reconcile();
    expect(reconciledReplay.status).toBe(200);
    expect(reconciledReplay.headers.get('idempotency-replayed')).toBe('true');

    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.masterFn, 'M1'), eq(auditLog.companyFn, 'C-SG'),
    ))).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'finance/bank-statements', action: 'create' }),
      expect.objectContaining({ entity: 'finance/bank-statement-lines', action: 'match' }),
      expect.objectContaining({ entity: 'finance/bank-statements', action: 'reconcile' }),
    ]));
  });

  it('denies Viewer imports while retaining bounded read access', async () => {
    const auth = await login('viewer@acme.co', 'viewer1234');
    expect((await fetch(`${baseUrl}/api/finance/bank-statements?limit=10`, {
      headers: { cookie: auth.header },
    })).status).toBe(200);
    const denied = await fetch(`${baseUrl}/api/finance/bank-statements`, {
      method: 'POST',
      headers: {
        cookie: auth.header, 'content-type': 'application/json', 'x-csrf-token': auth.csrf,
      },
      body: JSON.stringify({
        statementNo: 'BS-VIEWER', bankAccountId, currency: 'SGD',
        periodStart: '2026-07-01', periodEnd: '2026-07-31',
        openingBalance: '0', closingBalance: '88.25',
        lines: [{ transactionDate: '2026-07-22', description: 'Denied', amount: '88.25' }],
      }),
    });
    expect(denied.status).toBe(403);
    expect(await db.select().from(bankStatement)).toHaveLength(0);
    expect(await db.select().from(bankStatementLine)).toHaveLength(0);
  });
});
