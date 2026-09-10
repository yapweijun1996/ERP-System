import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import {
  appUser,
  auditLog,
  companyModule,
  companyReceiptPack,
  documentScanJob,
  masterModule,
} from '../data/schema';
import { withTenantTransaction } from '../data/tenantTransaction';
import { type SessionData } from '../auth/session';
import { uploadReceiptDocument } from '../modules/documents/upload';
import { createCompanyReceiptWithin } from '../modules/expenses/companyReceipt';
import { createCompanyReceiptPackWithin } from '../modules/expenses/companyReceiptPack';
import { freshDb } from '../test/helpers';
import {
  dispatchAgentAction,
  type AgentActionDispatchResult,
} from './agentActions';
import {
  AgentActionContractError,
  validateAgentActionOutput,
} from '../modules/agent/actionContracts';

describe('authenticated Agent action dispatch', () => {
  let db: DB;
  let admin: SessionData;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    await db.update(masterModule).set({ enabled: true }).where(and(
      eq(masterModule.masterFn, 'M1'),
      eq(masterModule.moduleKey, 'expenses_tax'),
    ));
    await db.update(companyModule).set({ enabled: true }).where(and(
      eq(companyModule.masterFn, 'M1'),
      eq(companyModule.companyFn, 'C-SG'),
      eq(companyModule.moduleKey, 'expenses_tax'),
    ));
    const [user] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    if (!user) throw new Error('Admin fixture is missing.');
    admin = {
      userId: user.userId,
      masterFn: user.masterFn,
      activeCompanyFn: 'C-SG',
      username: user.username,
      email: user.email,
      fullName: user.fullName,
    };
  });

  async function createReceipt(): Promise<{ id: number; documentVersionId: number }> {
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const uploaded = await uploadReceiptDocument(db, scope, { userId: admin.userId }, {
      clientDraftId: 'agent-dispatch-receipt-0001',
      fileName: 'agent-dispatch-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03]),
    });
    await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'agent-dispatch-test',
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
        merchant: 'Agent Dispatch Merchant',
        receiptNumber: 'AGENT-001',
        amount: '42.5000',
        currency: 'SGD',
        category: 'Travel',
        businessPurpose: 'Agent dispatch test',
      }));
    return { id: receipt.id, documentVersionId: uploaded.version.id };
  }

  function expectJson(result: AgentActionDispatchResult): Extract<AgentActionDispatchResult, { kind: 'json' }> {
    expect(result.kind).toBe('json');
    if (result.kind !== 'json') throw new Error('Expected a JSON Agent result.');
    return result;
  }

  async function invokeThinJsonAdapter(action: string, input: unknown) {
    const result = await dispatchAgentAction(db, admin, {
      action,
      input,
      requestId: `thin-adapter-${action}`,
    });
    const json = expectJson(result);
    return { action: json.action, version: json.version, body: json.body };
  }

  it('runs receipt search and read-only Pack preparation from authenticated session scope', async () => {
    const receipt = await createReceipt();
    const searched = expectJson(await dispatchAgentAction(db, admin, {
      action: 'receipt.search',
      input: { limit: 10, dateFrom: '2026-09-01', dateTo: '2026-09-30' },
      requestId: 'agent-search-0001',
    }));
    expect(searched).toMatchObject({ action: 'receipt.search', version: 1, status: 200 });
    expect(searched.body).toMatchObject({
      data: [expect.objectContaining({ id: receipt.id, merchant: 'Agent Dispatch Merchant' })],
      meta: { scope: 'company', actorUserId: admin.userId, nextCursor: null },
    });

    const adapted = await invokeThinJsonAdapter('receipt.get', { receiptId: receipt.id });
    expect(adapted).toMatchObject({
      action: 'receipt.get',
      version: 1,
      body: { data: { id: receipt.id }, meta: { scope: 'company' } },
    });
    const serializedBody: unknown = JSON.parse(JSON.stringify(adapted.body));
    validateAgentActionOutput('receipt.get', serializedBody);

    const prepared = expectJson(await dispatchAgentAction(db, admin, {
      action: 'receipt_pack.prepare',
      input: {
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
      },
      requestId: 'agent-prepare-0001',
    }));
    expect(prepared).toMatchObject({ action: 'receipt_pack.prepare', version: 1, status: 200 });
    expect(prepared.body).toMatchObject({
      data: {
        visibility: 'company',
        rows: [expect.objectContaining({
          receiptId: receipt.id,
          receiptVersion: 1,
          documentVersionId: receipt.documentVersionId,
          amount: '42.5000',
          currency: 'SGD',
        })],
        totals: [{ currency: 'SGD', amount: '42.5000', receiptCount: 1 }],
        rowCount: 1,
        documentCount: 1,
        selectionDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      meta: { preparationOnly: true, authorizationRequired: true, completeResult: true },
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it('rejects nested client authority before any transaction work', async () => {
    await expect(dispatchAgentAction(db, admin, {
      action: 'receipt_pack.prepare',
      input: {
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        filters: { nested: [{ companyFn: 'C-MY' }] },
      },
      requestId: 'agent-prepare-tampered-0001',
    })).rejects.toMatchObject({ code: 'tenant_scope_is_session_derived' });
  });

  it('keeps Pack creation behind the later approval-bound execution gate', async () => {
    await createReceipt();
    await expect(dispatchAgentAction(db, admin, {
      action: 'receipt_pack.create',
      input: {
        packKey: 'agent-dispatch-pack-0001',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
      },
      requestId: 'agent-create-blocked-0001',
    })).rejects.toMatchObject({
      code: 'agent_action_confirmation_required',
      status: 428,
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it('uses the shared Pack read/export boundary and preserves export audit', async () => {
    const receipt = await createReceipt();
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const created = await withTenantTransaction(db, scope, (tx) =>
      createCompanyReceiptPackWithin(tx, scope, admin.userId, 'company', {
        packKey: 'agent-dispatch-pack-0002',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
      }));
    const read = expectJson(await dispatchAgentAction(db, admin, {
      action: 'receipt_pack.get',
      input: { packId: created.pack.id },
      requestId: 'agent-pack-read-0001',
    }));
    expect(read.body).toMatchObject({
      data: { id: created.pack.id, rows: [expect.objectContaining({ receiptId: receipt.id })] },
      meta: { immutableSnapshot: true, completeResult: true, accessVisibility: 'company' },
    });

    const exported = await dispatchAgentAction(db, admin, {
      action: 'receipt_pack.export',
      input: { packId: created.pack.id, action: 'view' },
      requestId: 'agent-pack-export-0001',
    });
    expect(exported.kind).toBe('binary');
    if (exported.kind !== 'binary') throw new Error('Expected a binary Agent result.');
    expect(exported.content.byteLength).toBeGreaterThan(0);
    expect(exported.headers['X-Receipt-Pack-Access-Purpose']).toBe('receipt_pack_preview');
    expect(exported.metadata).toMatchObject({
      contentType: 'application/pdf',
      accessPurpose: 'receipt_pack_preview',
      artifactSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      sourceSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'company_receipt_pack'),
      eq(auditLog.entityId, String(created.pack.id)),
      eq(auditLog.action, 'pdf_view'),
    ))).toHaveLength(1);
  });

  it('rejects invalid contract input before creating a Pack', async () => {
    await expect(dispatchAgentAction(db, admin, {
      action: 'receipt_pack.prepare',
      input: { dateFrom: '2026-02-30', dateTo: '2026-09-30' },
      requestId: 'agent-prepare-invalid-0001',
    })).rejects.toBeInstanceOf(AgentActionContractError);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });
});
