import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { createAgentGrant, createAgentPrincipal } from '../modules/agent/agentIdentity';
import {
  approveAgentExecutionIntentWithin,
  cancelAgentExecutionIntentWithin,
  prepareAgentExecutionIntentWithin,
  rejectAgentExecutionIntentWithin,
} from '../modules/agent/agentExecutionIntent';
import type { SessionData } from '../auth/session';
import {
  agentExecutionIntent,
  agentGrant,
  auditLog,
  appUser,
  companyModule,
  companyReceiptPack,
  documentScanJob,
  masterModule,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { withTenantTransaction } from '../data/tenantTransaction';
import { uploadReceiptDocument } from '../modules/documents/upload';
import {
  createCompanyReceiptWithin,
  updateCompanyReceiptWithin,
} from '../modules/expenses/companyReceipt';
import { freshDb } from '../test/helpers';
import { createApp } from './app';
import { appendAudit } from './audit';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

describe('Agent Receipt Pack execution boundary', () => {
  let db: DB;
  let preparedAt: Date;
  let server: Server | undefined;
  let baseUrl: string;
  let admin: typeof appUser.$inferSelect;
  let adminSession: SessionData;
  let principalId: number;
  let createGrantId: number;

  beforeEach(async () => {
    // HTTP execution uses the real clock, so each fixture starts within its TTL.
    preparedAt = new Date();
    db = await freshDb();
    await seedDemo(db);
    await db.update(masterModule).set({ enabled: true }).where(and(
      eq(masterModule.masterFn, scope.masterFn),
      eq(masterModule.moduleKey, 'expenses_tax'),
    ));
    await db.update(companyModule).set({ enabled: true }).where(and(
      eq(companyModule.masterFn, scope.masterFn),
      eq(companyModule.companyFn, scope.companyFn),
      eq(companyModule.moduleKey, 'expenses_tax'),
    ));
    [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    adminSession = {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: scope.companyFn,
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    };
    const principal = await createAgentPrincipal(db, adminSession, {
      principalKey: 'execution-boundary-agent',
      displayName: 'Execution Boundary Agent',
      ownerUserId: admin.userId,
    }, 'execution-boundary-principal');
    principalId = principal.id;
    const grant = await createAgentGrant(db, adminSession, {
      agentPrincipalId: principalId,
      actionName: 'receipt_pack.create',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipt_packs',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['*'],
    }, 'execution-boundary-create-grant');
    createGrantId = grant.id;

    const activeServer = createApp(db, {
      agentAuthenticator: {
        authenticate: async ({ bearerToken }) => bearerToken === 'execution-boundary-token'
          ? {
            agentPrincipalId: principalId,
            masterFn: scope.masterFn,
            companyFn: scope.companyFn,
            issuer: 'https://issuer.test',
            audience: 'erp-system',
            subject: 'execution-boundary-agent',
          }
          : null,
      },
    }).listen(0, '127.0.0.1');
    server = activeServer;
    await new Promise<void>((resolve) => activeServer.once('listening', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing Agent execution test server address.');
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

  async function createReceipt(merchant = 'Approved Merchant') {
    const contentByte = merchant.includes('New') ? 0x02 : 0x01;
    const uploaded = await uploadReceiptDocument(db, scope, { userId: admin.userId }, {
      clientDraftId: `execution-boundary-${merchant.toLowerCase().replace(/[^a-z]+/g, '-')}`,
      fileName: 'execution-boundary-receipt.png',
      declaredMimeType: 'image/png',
      content: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, contentByte]),
      retentionUntil: new Date('2030-01-01T00:00:00.000Z'),
    });
    await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'agent-execution-boundary-test',
      resultCode: 'clean',
      completedAt: preparedAt,
    }).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, uploaded.version.id),
    )));
    return withTenantTransaction(db, scope, (tx) => createCompanyReceiptWithin(tx, scope, admin.userId, {
      documentId: uploaded.document.id,
      documentVersionId: uploaded.version.id,
      transactionDate: '2026-09-08',
      merchant,
      receiptNumber: `EXEC-${uploaded.version.id}`,
      amount: '18.2500',
      currency: 'SGD',
      category: 'Travel',
      businessPurpose: 'Agent exact execution test',
    }));
  }

  async function preparedIntent(packKey: string, intentKey: string) {
    return withTenantTransaction(db, scope, (tx) =>
      prepareAgentExecutionIntentWithin(tx, scope, {
        agentPrincipalId: principalId,
        actorUserId: admin.userId,
        intentKey,
        packKey,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        locale: 'en',
        visibility: 'company',
        requestId: `prepare-${packKey}`,
      }, preparedAt));
  }

  async function approvedIntent(packKey: string, intentKey: string) {
    const prepared = await preparedIntent(packKey, intentKey);
    return withTenantTransaction(db, scope, (tx) => approveAgentExecutionIntentWithin(tx, scope, {
      intentId: prepared.intent.id,
      expectedVersion: prepared.intent.version,
      decisionByUserId: admin.userId,
      reason: 'Reviewed exact Receipt Pack evidence before execution',
      requestId: `approve-${packKey}`,
    }, preparedAt));
  }

  function executionInput(intent: Awaited<ReturnType<typeof approvedIntent>>, intentKey: string) {
    return {
      packKey: intent.packKey,
      dateFrom: intent.filters.dateFrom,
      dateTo: intent.filters.dateTo,
      locale: intent.locale,
      executionIntentId: intent.id,
      executionIntentKey: intentKey,
      selectionDigest: intent.selectionDigest,
      payloadDigest: intent.payloadDigest,
    };
  }

  async function agentRequest(input: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api/agent/actions`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer execution-boundary-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'receipt_pack.create', input }),
    });
  }

  it('creates the approved exact Pack and replays it after a source correction', async () => {
    const receipt = await createReceipt();
    const approved = await approvedIntent(
      'agent-execution-pack-0001',
      'agent-execution-intent-key-0001',
    );
    const input = {
      packKey: approved.packKey,
      dateFrom: approved.filters.dateFrom,
      dateTo: approved.filters.dateTo,
      locale: approved.locale,
      executionIntentId: approved.id,
      executionIntentKey: 'agent-execution-intent-key-0001',
      selectionDigest: approved.selectionDigest,
      payloadDigest: approved.payloadDigest,
    };

    const firstResponse = await agentRequest(input);
    const first = await firstResponse.json() as {
      body: { data: { pack: { id: number; rows: unknown[]; sourceSha256: string }; replayed: boolean } };
      error?: { code: string; message: string };
    };
    expect(firstResponse.status, JSON.stringify(first)).toBe(200);
    expect(first.body.data.replayed).toBe(false);
    expect(first.body.data.pack.rows).toEqual(approved.reviewedFacts.rows);
    expect(first.body.data.pack.rows).toEqual([expect.objectContaining({ receiptId: receipt.id })]);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);

    await updateCompanyReceiptWithin(db, scope, admin.userId, receipt.id, 1, {
      merchant: 'Corrected after Pack commit',
    });
    const replayResponse = await agentRequest(input);
    expect(replayResponse.status).toBe(200);
    const replay = await replayResponse.json() as {
      body: { data: { pack: { id: number; rows: unknown[]; sourceSha256: string }; replayed: boolean } };
    };
    expect(replay.body.data).toMatchObject({
      replayed: true,
      pack: {
        id: first.body.data.pack.id,
        sourceSha256: first.body.data.pack.sourceSha256,
        rows: approved.reviewedFacts.rows,
      },
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'company_receipt_pack'),
      eq(auditLog.entityId, String(first.body.data.pack.id)),
    ))).toHaveLength(2);
    const intentAudit = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'agent_execution_intent'),
      eq(auditLog.entityId, String(approved.id)),
    ));
    expect(intentAudit).toHaveLength(4);
    expect(intentAudit.map((row) => row.action).sort()).toEqual([
      'approved', 'executed', 'prepared', 'replayed',
    ]);
  });

  it('rejects an approved intent after a concurrent-source edit without writing a Pack', async () => {
    const receipt = await createReceipt('Stale Approved Merchant');
    const approved = await approvedIntent(
      'agent-execution-pack-0002',
      'agent-execution-intent-key-0002',
    );
    await updateCompanyReceiptWithin(db, scope, admin.userId, receipt.id, 1, {
      merchant: 'Edited before execution boundary',
    });

    const response = await agentRequest({
      packKey: approved.packKey,
      dateFrom: approved.filters.dateFrom,
      dateTo: approved.filters.dateTo,
      locale: approved.locale,
      executionIntentId: approved.id,
      executionIntentKey: 'agent-execution-intent-key-0002',
      selectionDigest: approved.selectionDigest,
      payloadDigest: approved.payloadDigest,
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: 'agent_execution_intent_stale' },
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'company_receipt_pack'),
    ))).toHaveLength(0);
    expect(await db.select().from(agentExecutionIntent).where(eq(
      agentExecutionIntent.id,
      approved.id,
    ))).toHaveLength(1);
  });

  it('serializes duplicate execution retries and never widens the approved row set', async () => {
    const receipt = await createReceipt('Concurrent Execution Merchant');
    const approved = await approvedIntent(
      'agent-execution-pack-0003',
      'agent-execution-intent-key-0003',
    );
    const input = {
      packKey: approved.packKey,
      dateFrom: approved.filters.dateFrom,
      dateTo: approved.filters.dateTo,
      locale: approved.locale,
      executionIntentId: approved.id,
      executionIntentKey: 'agent-execution-intent-key-0003',
      selectionDigest: approved.selectionDigest,
      payloadDigest: approved.payloadDigest,
    };

    const responses = await Promise.all([agentRequest(input), agentRequest(input)]);
    const payloads = await Promise.all(responses.map((response) => response.json() as Promise<{
      body?: { data: { pack: { rows: unknown[] }; replayed: boolean } };
      error?: { code: string };
    }>));
    expect(responses.every((response) => response.status === 200 || response.status === 409)).toBe(true);
    const failed = payloads.find((payload) => payload.error);
    if (failed) expect(failed.error?.code).toMatch(/agent_execution_intent_concurrent_change/);

    const packs = await db.select().from(companyReceiptPack);
    expect(packs.length).toBeLessThanOrEqual(1);
    if (packs.length === 1) {
      expect(packs[0].rows).toEqual(approved.reviewedFacts.rows);
      expect(packs[0].rows).toEqual([expect.objectContaining({ receiptId: receipt.id })]);
    }
    if (packs.length === 0) {
      const retry = await agentRequest(input);
      expect(retry.status).toBe(200);
      const retryPayload = await retry.json() as {
        body: { data: { pack: { rows: unknown[] }; replayed: boolean } };
      };
      expect(retryPayload.body.data.replayed).toBe(false);
      expect(retryPayload.body.data.pack.rows).toEqual(approved.reviewedFacts.rows);
    }
  });

  it('resolves a concurrent source edit as exact Pack commit or no Pack commit', async () => {
    const receipt = await createReceipt('Concurrent Edit Merchant');
    const approved = await approvedIntent(
      'agent-execution-pack-0004',
      'agent-execution-intent-key-0004',
    );
    const input = {
      packKey: approved.packKey,
      dateFrom: approved.filters.dateFrom,
      dateTo: approved.filters.dateTo,
      locale: approved.locale,
      executionIntentId: approved.id,
      executionIntentKey: 'agent-execution-intent-key-0004',
      selectionDigest: approved.selectionDigest,
      payloadDigest: approved.payloadDigest,
    };

    const [execution, edit] = await Promise.allSettled([
      agentRequest(input),
      updateCompanyReceiptWithin(db, scope, admin.userId, receipt.id, 1, {
        merchant: 'Concurrent edit won',
      }),
    ]);
    expect(edit.status).toBe('fulfilled');
    expect(execution.status).toBe('fulfilled');
    if (execution.status !== 'fulfilled') return;
    const payload = await execution.value.json() as {
      body?: { data: { pack: { rows: unknown[] } } };
      error?: { code: string };
    };
    const packs = await db.select().from(companyReceiptPack);
    expect(packs.length).toBeLessThanOrEqual(1);
    if (packs.length === 1) {
      expect(execution.value.status).toBe(200);
      expect(packs[0].rows).toEqual(approved.reviewedFacts.rows);
      expect(payload.body?.data.pack.rows).toEqual(approved.reviewedFacts.rows);
    } else {
      expect(execution.value.status).toBe(409);
      expect(payload.error?.code).toMatch(/agent_execution_intent_stale|agent_execution_intent_concurrent_change/);
    }
  });

  it('resolves a concurrent matching insert as exact Pack commit or no Pack commit', async () => {
    const receipt = await createReceipt('Concurrent Insert Base Merchant');
    const approved = await approvedIntent(
      'agent-execution-pack-0005',
      'agent-execution-intent-key-0005',
    );
    const input = {
      packKey: approved.packKey,
      dateFrom: approved.filters.dateFrom,
      dateTo: approved.filters.dateTo,
      locale: approved.locale,
      executionIntentId: approved.id,
      executionIntentKey: 'agent-execution-intent-key-0005',
      selectionDigest: approved.selectionDigest,
      payloadDigest: approved.payloadDigest,
    };

    const [execution, inserted] = await Promise.allSettled([
      agentRequest(input),
      createReceipt('Concurrent Insert New Merchant'),
    ]);
    expect(inserted.status, inserted.status === 'rejected' ? String(inserted.reason) : '').toBe('fulfilled');
    expect(execution.status).toBe('fulfilled');
    if (execution.status !== 'fulfilled') return;
    const payload = await execution.value.json() as {
      body?: { data: { pack: { rows: unknown[] } } };
      error?: { code: string };
    };
    const packs = await db.select().from(companyReceiptPack);
    expect(packs.length).toBeLessThanOrEqual(1);
    if (packs.length === 1) {
      expect(execution.value.status).toBe(200);
      expect(packs[0].rows).toEqual(approved.reviewedFacts.rows);
      expect(payload.body?.data.pack.rows).toEqual(approved.reviewedFacts.rows);
      expect(packs[0].rows).toEqual([expect.objectContaining({ receiptId: receipt.id })]);
    } else {
      expect(execution.value.status).toBe(409);
      expect(payload.error?.code).toMatch(/agent_execution_intent_stale|agent_execution_intent_concurrent_change/);
    }
  });

  it('rejects pre-commit cancel/reject and replays a committed result after approval changes', async () => {
    await createReceipt('Changed Approval Merchant');

    const cancelled = await approvedIntent(
      'agent-execution-pack-0006',
      'agent-execution-intent-key-0006',
    );
    await withTenantTransaction(db, scope, (tx) => cancelAgentExecutionIntentWithin(tx, scope, {
      intentId: cancelled.id,
      expectedVersion: cancelled.version,
      decisionByUserId: admin.userId,
      reason: 'Human cancelled before Agent execution',
      requestId: 'cancel-before-agent-execution',
    }, preparedAt));
    const cancelledResponse = await agentRequest(executionInput(
      cancelled,
      'agent-execution-intent-key-0006',
    ));
    expect(cancelledResponse.status).toBe(428);
    expect(await cancelledResponse.json()).toMatchObject({
      error: { code: 'agent_execution_intent_not_approved' },
    });

    const rejected = await preparedIntent(
      'agent-execution-pack-0007',
      'agent-execution-intent-key-0007',
    );
    await withTenantTransaction(db, scope, (tx) => rejectAgentExecutionIntentWithin(tx, scope, {
      intentId: rejected.intent.id,
      expectedVersion: rejected.intent.version,
      decisionByUserId: admin.userId,
      reason: 'Human rejected before Agent execution',
      requestId: 'reject-before-agent-execution',
    }, preparedAt));
    const rejectedResponse = await agentRequest(executionInput(
      rejected.intent,
      'agent-execution-intent-key-0007',
    ));
    expect(rejectedResponse.status).toBe(428);
    expect(await rejectedResponse.json()).toMatchObject({
      error: { code: 'agent_execution_intent_not_approved' },
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);

    const committed = await approvedIntent(
      'agent-execution-pack-0008',
      'agent-execution-intent-key-0008',
    );
    const input = executionInput(committed, 'agent-execution-intent-key-0008');
    const firstResponse = await agentRequest(input);
    const first = await firstResponse.json() as {
      body: { data: { pack: { id: number }; replayed: boolean } };
    };
    expect(firstResponse.status).toBe(200);
    expect(first.body.data.replayed).toBe(false);

    const changedApproval = await withTenantTransaction(db, scope, (tx) =>
      cancelAgentExecutionIntentWithin(tx, scope, {
        intentId: committed.id,
        expectedVersion: committed.version,
        decisionByUserId: admin.userId,
        reason: 'Human approval changed after the Pack committed',
        requestId: 'cancel-after-agent-execution',
      }, preparedAt));
    expect(changedApproval.status).toBe('cancelled');

    const replayResponse = await agentRequest(input);
    const replay = await replayResponse.json() as {
      body: { data: { pack: { id: number }; replayed: boolean } };
    };
    expect(replayResponse.status).toBe(200);
    expect(replay.body.data).toMatchObject({
      replayed: true,
      pack: { id: first.body.data.pack.id },
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
    const intentAudit = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'agent_execution_intent'),
      eq(auditLog.entityId, String(committed.id)),
    ));
    expect(intentAudit.map((row) => row.action).sort()).toEqual([
      'approved', 'cancelled', 'executed', 'prepared', 'replayed',
    ]);
  });

  it('denies a committed replay after Agent grant expiry without writing another Pack', async () => {
    await createReceipt('Expired Grant Merchant');
    const approved = await approvedIntent(
      'agent-execution-pack-0009',
      'agent-execution-intent-key-0009',
    );
    const input = executionInput(approved, 'agent-execution-intent-key-0009');
    const firstResponse = await agentRequest(input);
    expect(firstResponse.status).toBe(200);

    await db.update(agentGrant).set({
      validUntil: new Date(Date.now() - 1),
    }).where(and(
      eq(agentGrant.id, createGrantId),
      eq(agentGrant.masterFn, scope.masterFn),
      eq(agentGrant.companyFn, scope.companyFn),
    ));
    const expiredResponse = await agentRequest(input);
    expect(expiredResponse.status).toBe(403);
    expect(await expiredResponse.json()).toMatchObject({
      error: { code: 'agent_grant_inactive' },
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
  });

  it('conflicts on changed payload reuse and preserves a governed correction after replay', async () => {
    const receipt = await createReceipt('Correction Before Merchant');
    const approved = await approvedIntent(
      'agent-execution-pack-0010',
      'agent-execution-intent-key-0010',
    );
    const input = executionInput(approved, 'agent-execution-intent-key-0010');
    const firstResponse = await agentRequest(input);
    const first = await firstResponse.json() as {
      body: { data: { pack: { id: number; rows: unknown[] }; replayed: boolean } };
    };
    expect(firstResponse.status).toBe(200);

    const changedPayloadResponse = await agentRequest({
      ...input,
      payloadDigest: 'f'.repeat(64),
    });
    expect(changedPayloadResponse.status).toBe(409);
    expect(await changedPayloadResponse.json()).toMatchObject({
      error: { code: 'agent_execution_intent_digest_mismatch' },
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);

    const correction = await withTenantTransaction(db, scope, async (tx) => {
      const changed = await updateCompanyReceiptWithin(tx, scope, admin.userId, receipt.id, 1, {
        merchant: 'Correction After Pack Commit',
      });
      await appendAudit(tx, {
        ...scope,
        actorUserId: admin.userId,
        requestId: 'governed-correction-after-pack',
        entity: 'company_receipt',
        entityId: receipt.id,
        action: 'updated',
        before: changed.before,
        after: changed.after,
      });
      return changed;
    });
    expect(correction.before.version).toBe(1);
    expect(correction.after.version).toBe(2);
    expect(correction.after.merchant).toBe('Correction After Pack Commit');

    const replayResponse = await agentRequest(input);
    const replay = await replayResponse.json() as {
      body: { data: { pack: { id: number; rows: unknown[] }; replayed: boolean } };
    };
    expect(replayResponse.status).toBe(200);
    expect(replay.body.data).toMatchObject({
      replayed: true,
      pack: {
        id: first.body.data.pack.id,
        rows: first.body.data.pack.rows,
      },
    });
    const correctionAudit = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'company_receipt'),
      eq(auditLog.entityId, String(receipt.id)),
      eq(auditLog.action, 'updated'),
    ));
    expect(correctionAudit).toHaveLength(1);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
  });
});
