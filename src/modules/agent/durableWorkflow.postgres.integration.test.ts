import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../../data/schema';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { completeProductionSetup } from '../setup/completeSetup';
import { uploadReceiptDocument } from '../documents/upload';
import { createCompanyReceiptWithin } from '../expenses/companyReceipt';
import { agentWorkflowRun, agentWorkflowStep, appUser, documentScanJob, outboxEvent } from '../../data/schema';
import { createAgentGrant, createAgentPrincipal } from './agentIdentity';
import { approveAgentExecutionIntentWithin, prepareAgentExecutionIntentWithin } from './agentExecutionIntent';
import { processAgentWorkflowBatch, queueReceiptPackWorkflow } from './durableWorkflow';

const postgresUrl = process.env.POSTGRES_URL;
const suite = postgresUrl ? describe : describe.skip;
let at: Date;

suite('durable Receipt Pack workflow PostgreSQL concurrency proof', () => {
  const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
  const databaseName = `erp_workflow_${suffix}`;
  const roleName = `erp_workflow_worker_${suffix}`;
  const rolePassword = randomBytes(18).toString('hex');
  let clusterPool: Pool;
  let pool: Pool;
  let workerPool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let workerDb: NodePgDatabase<typeof schema>;
  let scope: { masterFn: string; companyFn: string };
  let admin: typeof appUser.$inferSelect;
  let principalId: number;
  let runId: number;

  beforeAll(async () => {
    const base = new URL(postgresUrl!);
    const clusterUrl = new URL(base);
    clusterUrl.pathname = '/postgres';
    clusterPool = new Pool({ connectionString: clusterUrl.toString() });
    await clusterPool.query(`create database "${databaseName}"`);

    const databaseUrl = new URL(base);
    databaseUrl.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: databaseUrl.toString(), max: 8 });
    db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: 'drizzle' });

    const setup = await completeProductionSetup(db, {
      organizationName: 'Durable Workflow PostgreSQL Proof',
      organizationCode: `WF-${suffix.slice(-8)}`,
      companyName: 'Durable Workflow Singapore',
      country: 'SG',
      adminName: 'Workflow Administrator',
      adminUsername: `workflow.admin.${suffix.slice(-6).toLowerCase()}`,
      adminEmail: `workflow.${suffix.slice(-8).toLowerCase()}@postgres.example`,
      adminPassword: 'workflow-admin-password',
      language: 'en',
      moduleKeys: ['expenses_tax'],
    }, `workflow-pg-setup-${suffix}`);
    scope = { masterFn: setup.masterFn, companyFn: setup.companyFn };
    at = new Date(Date.now() + 1_000);
    [admin] = await db.select().from(appUser).where(eq(appUser.userId, setup.userId));
    const session = {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: scope.companyFn,
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    };
    const principal = await createAgentPrincipal(db, session, {
      principalKey: `durable-workflow-${suffix.toLowerCase()}`,
      displayName: 'Durable Workflow Agent',
      ownerUserId: admin.userId,
    }, `workflow-principal-${suffix}`);
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
    }, `workflow-grant-${suffix}`);

    const uploaded = await uploadReceiptDocument(db, scope, { userId: admin.userId }, {
      clientDraftId: `workflow-pg-receipt-${suffix}`,
      fileName: 'workflow-proof.jpg',
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03]),
    });
    await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'workflow-postgres-proof',
      resultCode: 'clean',
      completedAt: at,
    }).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, uploaded.version.id),
    )));
    await withTenantTransaction(db, scope, (tx) => createCompanyReceiptWithin(tx, scope, admin.userId, {
      documentId: uploaded.document.id,
      documentVersionId: uploaded.version.id,
      transactionDate: '2026-09-09',
      merchant: 'Durable Workflow PostgreSQL Merchant',
      receiptNumber: `WF-PG-${suffix}`,
      amount: '31.2500',
      currency: 'SGD',
      category: 'Travel',
      businessPurpose: 'Durable workflow PostgreSQL concurrency proof',
    }));
    const prepared = await withTenantTransaction(db, scope, (tx) => prepareAgentExecutionIntentWithin(tx, scope, {
      agentPrincipalId: principalId,
      actorUserId: admin.userId,
      intentKey: `workflow-pg-intent-${suffix}`,
      packKey: `workflow-pg-pack-${suffix}`,
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      locale: 'en',
      visibility: 'company',
      requestId: `workflow-pg-prepare-${suffix}`,
    }, at));
    const approved = await withTenantTransaction(db, scope, (tx) => approveAgentExecutionIntentWithin(tx, scope, {
      intentId: prepared.intent.id,
      expectedVersion: prepared.intent.version,
      decisionByUserId: admin.userId,
      reason: 'PostgreSQL concurrency proof reviewed the exact selection.',
      requestId: `workflow-pg-approve-${suffix}`,
    }, at));
    const queued = await queueReceiptPackWorkflow(db, scope, {
      intentId: approved.id,
      agentPrincipalId: principalId,
      actorUserId: admin.userId,
      triggerKey: `workflow-pg-trigger-${suffix}`,
      requestId: `workflow-pg-queue-${suffix}`,
    }, at);
    runId = queued.workflow.id;

    await pool.query(`create role "${roleName}" login password '${rolePassword}' nosuperuser nobypassrls nocreatedb nocreaterole noinherit`);
    await pool.query(`grant connect on database "${databaseName}" to "${roleName}"`);
    await pool.query(`grant usage on schema public to "${roleName}"`);
    await pool.query(`grant select, insert, update, delete on all tables in schema public to "${roleName}"`);
    await pool.query(`grant usage, select on all sequences in schema public to "${roleName}"`);
    await pool.query(await readFile('deploy/sql/production-rls.sql', 'utf8'));
    const workerUrl = new URL(databaseUrl);
    workerUrl.username = roleName;
    workerUrl.password = rolePassword;
    workerPool = new Pool({ connectionString: workerUrl.toString(), max: 8 });
    workerDb = drizzle(workerPool, { schema });
  }, 60_000);

  afterAll(async () => {
    await workerPool?.end();
    await pool?.end();
    if (clusterPool) {
      await clusterPool.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = '${databaseName}' and pid <> pg_backend_pid()`);
      await clusterPool.query(`drop database if exists "${databaseName}"`);
      await clusterPool.query(`drop role if exists "${roleName}"`);
      await clusterPool.end();
    }
  }, 30_000);

  it('lets only one of two concurrent workers commit the Pack', async () => {
    const results = await Promise.all([
      processAgentWorkflowBatch(workerDb, { workerId: `workflow-pg-worker-a-${suffix}`, now: at }),
      processAgentWorkflowBatch(workerDb, { workerId: `workflow-pg-worker-b-${suffix}`, now: at }),
    ]);
    expect(results.filter((result) => result.succeeded === 1)).toHaveLength(1);
    const [run] = await db.select().from(agentWorkflowRun).where(eq(agentWorkflowRun.id, runId));
    expect(run?.state).toBe('succeeded');
    const steps = await db.select().from(agentWorkflowStep).where(eq(agentWorkflowStep.runId, runId));
    expect(steps.filter((step) => step.state === 'succeeded')).toHaveLength(3);
    const packs = await db.select().from(schema.companyReceiptPack).where(and(
      eq(schema.companyReceiptPack.masterFn, scope.masterFn),
      eq(schema.companyReceiptPack.companyFn, scope.companyFn),
    ));
    expect(packs).toHaveLength(1);
    const signals = await db.select().from(outboxEvent).where(and(
      eq(outboxEvent.topic, 'agent.workflow.receipt_pack.requested'),
      eq(outboxEvent.aggregateId, String(runId)),
    ));
    expect(signals).toHaveLength(1);
    expect(signals[0]?.deliveredAt).not.toBeNull();
  }, 60_000);
});
