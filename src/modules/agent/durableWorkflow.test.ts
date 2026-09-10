import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  agentGrant,
  agentWorkflowRun,
  agentWorkflowStep,
  companyModule,
  companyReceiptPack,
  documentScanJob,
  masterModule,
  appUser,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import type { SessionData } from '../../auth/session';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { uploadReceiptDocument } from '../documents/upload';
import { createCompanyReceiptWithin } from '../expenses/companyReceipt';
import {
  approveAgentExecutionIntentWithin,
  prepareAgentExecutionIntentWithin,
} from './agentExecutionIntent';
import { createAgentGrant, createAgentPrincipal } from './agentIdentity';
import {
  cancelReceiptPackWorkflow,
  pauseReceiptPackWorkflow,
  processAgentWorkflowBatch,
  queueReceiptPackWorkflow,
  readReceiptPackWorkflow,
  resumeReceiptPackWorkflow,
} from './durableWorkflow';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const at = new Date('2026-09-09T08:00:00.000Z');

describe('durable Receipt Pack Agent workflow', () => {
  let db: DB;
  let admin: typeof appUser.$inferSelect;
  let session: SessionData;
  let principalId: number;

  beforeEach(async () => {
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
    session = {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: scope.companyFn,
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    };
    const principal = await createAgentPrincipal(db, session, {
      principalKey: 'durable-receipt-agent',
      displayName: 'Durable Receipt Agent',
      ownerUserId: admin.userId,
    }, 'durable-agent-principal');
    principalId = principal.id;
    await createAgentGrant(db, session, {
      agentPrincipalId: principalId,
      actionName: 'receipt_pack.create',
      permissionKey: 'expenses.company_receipts.read_company',
      resourceKey: 'expenses/company_receipt_packs',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      fieldAllowlist: ['*'],
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
    }, 'durable-agent-grant');
  });

  async function createReceipt(): Promise<number> {
    const uploaded = await uploadReceiptDocument(db, scope, { userId: admin.userId }, {
      clientDraftId: 'durable-workflow-receipt',
      fileName: 'durable-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03]),
    });
    await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'durable-workflow-test',
      resultCode: 'clean',
      completedAt: at,
    }).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, uploaded.version.id),
    )));
    const receipt = await withTenantTransaction(db, scope, (tx) => createCompanyReceiptWithin(tx, scope, admin.userId, {
      documentId: uploaded.document.id,
      documentVersionId: uploaded.version.id,
      transactionDate: '2026-09-09',
      merchant: 'Durable Coffee',
      receiptNumber: `DURABLE-${uploaded.version.id}`,
      amount: '18.2500',
      currency: 'SGD',
      category: 'Travel',
      businessPurpose: 'Durable workflow test',
    }));
    return receipt.id;
  }

  async function prepareAndApprove() {
    const prepared = await withTenantTransaction(db, scope, (tx) => prepareAgentExecutionIntentWithin(tx, scope, {
      agentPrincipalId: principalId,
      actorUserId: admin.userId,
      intentKey: 'durable-intent-key-0001',
      packKey: 'durable-pack-key-0001',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      locale: 'en',
      visibility: 'company',
      requestId: 'durable-intent-prepare',
    }, at));
    const approved = await withTenantTransaction(db, scope, (tx) => approveAgentExecutionIntentWithin(tx, scope, {
      intentId: prepared.intent.id,
      expectedVersion: prepared.intent.version,
      decisionByUserId: admin.userId,
      reason: 'Reviewed durable Receipt Pack facts.',
      requestId: 'durable-intent-approve',
    }, at));
    return { intentId: approved.id, version: approved.version };
  }

  async function queueApproved(triggerKey = 'durable-trigger-key-0001') {
    await createReceipt();
    const intent = await prepareAndApprove();
    const queued = await queueReceiptPackWorkflow(db, scope, {
      intentId: intent.intentId,
      agentPrincipalId: principalId,
      actorUserId: admin.userId,
      triggerKey,
      requestId: 'durable-workflow-queue',
    }, at);
    return { queued, intent };
  }

  it('waits for approval, resumes after approval, and persists one verified result', async () => {
    await createReceipt();
    const prepared = await withTenantTransaction(db, scope, (tx) => prepareAgentExecutionIntentWithin(tx, scope, {
      agentPrincipalId: principalId,
      actorUserId: admin.userId,
      intentKey: 'durable-intent-key-0002',
      packKey: 'durable-pack-key-0002',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      locale: 'en',
      visibility: 'company',
      requestId: 'durable-intent-prepare-2',
    }, at));
    const waiting = await queueReceiptPackWorkflow(db, scope, {
      intentId: prepared.intent.id,
      agentPrincipalId: principalId,
      actorUserId: admin.userId,
      triggerKey: 'durable-trigger-key-0002',
      requestId: 'durable-workflow-queue-2',
    }, at);
    expect(waiting.workflow.state).toBe('waiting_approval');
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
    await processAgentWorkflowBatch(db, { workerId: 'workflow-waiter', now: at });
    const approved = await withTenantTransaction(db, scope, (tx) => approveAgentExecutionIntentWithin(tx, scope, {
      intentId: prepared.intent.id,
      expectedVersion: prepared.intent.version,
      decisionByUserId: admin.userId,
      reason: 'Human reviewed the exact receipt selection.',
      requestId: 'durable-intent-approve-2',
    }, at));
    expect(approved.status).toBe('approved');
    const completed = await processAgentWorkflowBatch(db, {
      workerId: 'workflow-runner',
      now: new Date(at.getTime() + 6_000),
    });
    expect(completed.succeeded).toBe(1);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
    const result = await readReceiptPackWorkflow(db, scope, waiting.workflow.id, admin.userId);
    expect(result.state).toBe('succeeded');
    expect(result.resultRef).toMatchObject({
      packId: expect.any(Number),
      artifactSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      artifactByteLength: expect.any(Number),
    });
    expect(result.steps.map((step) => step.state)).toEqual(['succeeded', 'succeeded', 'succeeded']);
    const replay = await processAgentWorkflowBatch(db, {
      workerId: 'workflow-replay',
      now: new Date(at.getTime() + 12_000),
    });
    expect(replay.runsClaimed).toBe(0);
  });

  it('deduplicates the trigger and cancellation before execution is terminal', async () => {
    const { queued } = await queueApproved();
    const duplicate = await queueReceiptPackWorkflow(db, scope, {
      intentId: queued.workflow.intentId,
      agentPrincipalId: principalId,
      actorUserId: admin.userId,
      triggerKey: 'durable-trigger-key-0001',
      requestId: 'durable-workflow-queue-replay',
    }, at);
    expect(duplicate.replayed).toBe(true);
    expect(duplicate.workflow.id).toBe(queued.workflow.id);
    const cancelled = await cancelReceiptPackWorkflow(db, scope, {
      runId: queued.workflow.id,
      expectedVersion: queued.workflow.version,
      actorUserId: admin.userId,
      reason: 'Stop before the worker starts.',
      requestId: 'durable-workflow-cancel',
    }, at);
    expect(cancelled.state).toBe('cancelled');
    await processAgentWorkflowBatch(db, { workerId: 'workflow-after-cancel', now: at });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it('pause and resume preserve the approval boundary and revoke authority before effect', async () => {
    const { queued } = await queueApproved('durable-trigger-key-0003');
    const paused = await pauseReceiptPackWorkflow(db, scope, {
      runId: queued.workflow.id,
      expectedVersion: queued.workflow.version,
      actorUserId: admin.userId,
      reason: 'Temporarily pause the run.',
      requestId: 'durable-workflow-pause',
    }, at);
    expect(paused.state).toBe('paused');
    const resumed = await resumeReceiptPackWorkflow(db, scope, {
      runId: queued.workflow.id,
      expectedVersion: paused.version,
      actorUserId: admin.userId,
      reason: 'Resume after review.',
      requestId: 'durable-workflow-resume',
    }, at);
    expect(resumed.state).toBe('queued');
    await db.update(agentGrant).set({ revokedAt: at, revokedByUserId: admin.userId, revocationReason: 'test revocation' }).where(eq(agentGrant.agentPrincipalId, principalId));
    const failed = await processAgentWorkflowBatch(db, { workerId: 'workflow-revoked', now: at });
    expect(failed.failed).toBe(1);
    expect((await readReceiptPackWorkflow(db, scope, queued.workflow.id, admin.userId)).state).toBe('failed');
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });

  it('late cancellation reports the committed Pack rather than a false rollback', async () => {
    const { queued } = await queueApproved('durable-trigger-key-0004');
    const completed = await processAgentWorkflowBatch(db, { workerId: 'workflow-commit', now: at });
    expect(completed.succeeded).toBe(1);
    const after = await readReceiptPackWorkflow(db, scope, queued.workflow.id, admin.userId);
    const cancelled = await cancelReceiptPackWorkflow(db, scope, {
      runId: queued.workflow.id,
      expectedVersion: after.version,
      actorUserId: admin.userId,
      reason: 'Cancel request arrived after commit.',
      requestId: 'durable-workflow-late-cancel',
    }, at);
    expect(cancelled.state).toBe('succeeded');
    expect(cancelled.resultRef).toMatchObject({ packId: expect.any(Number) });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
  });

  it('repairs step checkpoints when a worker stops after the Pack commit', async () => {
    const { queued } = await queueApproved('durable-trigger-key-0007');
    const completed = await processAgentWorkflowBatch(db, { workerId: 'workflow-partial-commit', now: at });
    expect(completed.succeeded).toBe(1);
    await withTenantTransaction(db, scope, async (tx) => {
      await tx.update(agentWorkflowRun).set({
        state: 'running',
        resultRef: null,
        completedAt: null,
        lockedAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        availableAt: at,
      }).where(eq(agentWorkflowRun.id, queued.workflow.id));
      for (const stepKey of ['execute', 'verify'] as const) {
        await tx.update(agentWorkflowStep).set({
          state: 'running',
          resultRef: null,
          completedAt: null,
          lockedAt: null,
          lockedBy: null,
          leaseExpiresAt: null,
          heartbeatAt: null,
        }).where(and(
          eq(agentWorkflowStep.runId, queued.workflow.id),
          eq(agentWorkflowStep.stepKey, stepKey),
        ));
      }
    });
    const recovered = await processAgentWorkflowBatch(db, { workerId: 'workflow-partial-recovery', now: at });
    expect(recovered.succeeded).toBe(1);
    const final = await readReceiptPackWorkflow(db, scope, queued.workflow.id, admin.userId);
    expect(final.state).toBe('succeeded');
    const steps = await db.select().from(agentWorkflowStep).where(eq(agentWorkflowStep.runId, queued.workflow.id));
    expect(steps.filter((step) => step.state === 'succeeded')).toHaveLength(3);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
  });

  it('reclaims an expired lease without changing the workflow identity', async () => {
    const { queued } = await queueApproved('durable-trigger-key-0005');
    await db.update(agentWorkflowRun).set({
      lockedAt: at,
      lockedBy: 'crashed-worker',
      leaseExpiresAt: new Date(at.getTime() + 1_000),
      heartbeatAt: at,
    }).where(eq(agentWorkflowRun.id, queued.workflow.id));
    const blocked = await processAgentWorkflowBatch(db, { workerId: 'second-worker', now: at });
    expect(blocked.runsClaimed).toBe(0);
    const recovered = await processAgentWorkflowBatch(db, {
      workerId: 'recovery-worker',
      now: new Date(at.getTime() + AGENT_LEASE_WAIT),
    });
    expect(recovered.succeeded).toBe(1);
    const final = await readReceiptPackWorkflow(db, scope, queued.workflow.id, admin.userId);
    expect(final.id).toBe(queued.workflow.id);
    expect(final.state).toBe('succeeded');
  });

  it('dead-letters a bounded effect after the configured attempt budget', async () => {
    const { queued } = await queueApproved('durable-trigger-key-0006');
    await db.update(agentWorkflowRun).set({ maxAttempts: 1 }).where(eq(agentWorkflowRun.id, queued.workflow.id));
    await withTenantTransaction(db, scope, (tx) => tx.delete(agentWorkflowStep).where(and(
      eq(agentWorkflowStep.runId, queued.workflow.id),
      eq(agentWorkflowStep.stepKey, 'execute'),
    )));
    const result = await processAgentWorkflowBatch(db, { workerId: 'workflow-budget', now: at });
    expect(result.failed).toBe(1);
    const final = await readReceiptPackWorkflow(db, scope, queued.workflow.id, admin.userId);
    expect(final.state).toBe('failed');
    expect(final.lastError).toBe('agent_workflow_step_missing');
    expect(final.attempts).toBe(1);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
  });
});

const AGENT_LEASE_WAIT = 5 * 60 * 1000 + 1;
