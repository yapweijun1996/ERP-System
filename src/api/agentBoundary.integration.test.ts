import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { createAgentGrant, createAgentPrincipal } from '../modules/agent/agentIdentity';
import type { SessionData } from '../auth/session';
import {
  appUser,
  auditLog,
  companyModule,
  companyReceiptPack,
  documentScanJob,
  masterModule,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { uploadReceiptDocument } from '../modules/documents/upload';
import { createCompanyReceiptWithin } from '../modules/expenses/companyReceipt';
import { createCompanyReceiptPackWithin } from '../modules/expenses/companyReceiptPack';
import { withTenantTransaction } from '../data/tenantTransaction';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

describe('authenticated Agent API boundary', () => {
  let db: DB;
  let server: Server | undefined;
  let baseUrl: string;
  let admin: typeof appUser.$inferSelect;
  let adminSession: SessionData;
  let principalId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    await db.update(masterModule).set({ enabled: true }).where(and(
      eq(masterModule.masterFn, 'M1'),
      eq(masterModule.moduleKey, 'expenses_tax'),
    ));
    await db.update(companyModule).set({ enabled: true }).where(and(
      eq(companyModule.masterFn, 'M1'),
      eq(companyModule.moduleKey, 'expenses_tax'),
    ));
    [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    adminSession = {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: 'C-SG',
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    };
    const principal = await createAgentPrincipal(db, adminSession, {
      principalKey: 'http-boundary-agent',
      displayName: 'HTTP Boundary Agent',
      ownerUserId: admin.userId,
    }, 'agent-http-principal');
    principalId = principal.id;
    await createAgentGrant(db, adminSession, {
      agentPrincipalId: principalId,
      actionName: 'receipt.search',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipts',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['id', 'merchant'],
    }, 'agent-http-search-grant');

    const activeServer = createApp(db, {
      agentAuthenticator: {
        authenticate: async ({ bearerToken }) => {
          if (bearerToken === 'agent-http-token') {
            return {
              agentPrincipalId: principalId,
              masterFn: 'M1',
              companyFn: 'C-SG',
              issuer: 'https://issuer.test',
              audience: 'erp-system',
              subject: 'http-boundary-agent',
            };
          }
          if (bearerToken === 'agent-wrong-company-token') {
            return {
              agentPrincipalId: principalId,
              masterFn: 'M1',
              companyFn: 'C-MY',
              issuer: 'https://issuer.test',
              audience: 'erp-system',
              subject: 'http-boundary-agent',
            };
          }
          return null;
        },
      },
    }).listen(0, '127.0.0.1');
    server = activeServer;
    await new Promise<void>((resolve) => activeServer.once('listening', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing Agent test server address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    const activeServer = server;
    server = undefined;
    await new Promise<void>((resolve, reject) => activeServer.close((error) => {
      if (error) reject(error);
      else resolve();
    }));
  });

  async function createReceipt(): Promise<{ id: number }> {
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const uploaded = await uploadReceiptDocument(db, scope, { userId: admin.userId }, {
      clientDraftId: 'agent-boundary-receipt-0001',
      fileName: 'agent-boundary-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x09, 0x08, 0x07]),
    });
    await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'agent-boundary-test',
      resultCode: 'clean',
      completedAt: new Date('2026-09-08T08:00:00.000Z'),
    }).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, uploaded.version.id),
    )));
    const receipt = await withTenantTransaction(db, scope, (tx) =>
      createCompanyReceiptWithin(tx, scope, admin.userId, {
        documentId: uploaded.document.id,
        documentVersionId: uploaded.version.id,
        transactionDate: '2026-09-08',
        merchant: 'Agent Boundary Merchant',
        receiptNumber: 'AGENT-BOUNDARY-001',
        amount: '18.2500',
        currency: 'SGD',
        category: 'Travel',
        businessPurpose: 'Agent boundary test',
      }));
    return { id: receipt.id };
  }

  async function agentRequest(body: unknown, token = 'agent-http-token'): Promise<Response> {
    return fetch(`${baseUrl}/api/agent/actions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  it('derives actor and Company from the issuer, rejects body authority and projects fields', async () => {
    const receipt = await createReceipt();
    const forged = await agentRequest({
      masterFn: 'M1',
      companyFn: 'C-MY',
      actorUserId: 999999,
      action: 'receipt.search',
      input: { limit: 10 },
    });
    expect(forged.status).toBe(400);
    expect(await forged.json()).toMatchObject({ error: { code: 'agent_identity_in_body' } });

    const valid = await agentRequest({
      action: 'receipt.search',
      input: { limit: 10, dateFrom: '2026-09-01', dateTo: '2026-09-30' },
      requestId: 'client-cannot-set-audit-id',
    });
    expect(valid.status).toBe(200);
    const response = await valid.json() as {
      action: string;
      version: number;
      body: { data: Array<Record<string, unknown>>; meta: { actorUserId: number } };
    };
    expect(response).toMatchObject({ action: 'receipt.search', version: 1 });
    expect(response.body).toMatchObject({
      data: [expect.objectContaining({ id: receipt.id, merchant: 'Agent Boundary Merchant' })],
      meta: { actorUserId: admin.userId },
    });
    expect(response.body.data[0]).not.toHaveProperty('amount');
    expect(response.body.data[0]).not.toHaveProperty('evidenceSha256');

    const wrongCompany = await agentRequest({
      action: 'receipt.search',
      input: { limit: 10 },
    }, 'agent-wrong-company-token');
    expect(wrongCompany.status).toBe(403);
    expect(await wrongCompany.json()).toMatchObject({ error: { code: 'agent_principal_not_found' } });
  });

  it('records the true Agent and accountable owner for an audited export', async () => {
    const receipt = await createReceipt();
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const created = await withTenantTransaction(db, scope, (tx) =>
      createCompanyReceiptPackWithin(tx, scope, admin.userId, 'company', {
        packKey: 'agent-boundary-pack-0001',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
      }));
    expect(created.pack.rows).toEqual([expect.objectContaining({ receiptId: receipt.id })]);
    await createAgentGrant(db, adminSession, {
      agentPrincipalId: principalId,
      actionName: 'receipt_pack.export',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipt_packs',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['*'],
    }, 'agent-http-export-grant');

    const exported = await agentRequest({
      action: 'receipt_pack.export',
      input: { packId: created.pack.id, action: 'view' },
    });
    expect(exported.status).toBe(200);
    expect(exported.headers.get('x-agent-action')).toBe('receipt_pack.export');
    expect(exported.headers.get('x-receipt-pack-sha256')).toMatch(/^[0-9a-f]{64}$/);
    expect((await exported.arrayBuffer()).byteLength).toBeGreaterThan(0);

    const [audit] = await db.select({
      actorUserId: auditLog.actorUserId,
      agentPrincipalId: auditLog.agentPrincipalId,
      delegatorUserId: auditLog.delegatorUserId,
    }).from(auditLog).where(and(
      eq(auditLog.entity, 'company_receipt_pack'),
      eq(auditLog.entityId, String(created.pack.id)),
      eq(auditLog.action, 'pdf_view'),
    ));
    const [agentBridge] = await db.select({ userId: appUser.userId }).from(appUser)
      .where(eq(appUser.identityKind, 'agent'))
      .limit(1);
    expect(audit).toEqual({
      actorUserId: agentBridge.userId,
      agentPrincipalId: principalId,
      delegatorUserId: admin.userId,
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
  });
});
