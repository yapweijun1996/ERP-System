import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../data/schema';
import type { DB } from '../data/db';
import {
  withReportingWorkerTransaction,
  withTenantTransaction,
} from '../data/tenantTransaction';
import { completeProductionSetup } from '../modules/setup/completeSetup';
import { createInvitation, acceptInvitation, requestPasswordReset, confirmPasswordReset } from '../auth/lifecycle';
import { decryptToken, type EncryptedToken } from '../auth/tokenCrypto';
import { processOutboxBatch } from '../worker/outbox';
import {
  createInventoryLotWithin,
  createWarehouseBinWithin,
} from '../modules/inventory/tracking';
import {
  getStockLocationQty,
  getStockQty,
  issueStockWithin,
  receiveStockWithin,
} from '../modules/inventory/stock';
import {
  appendManagedDocumentVersion,
  createDocumentStorageRegistry,
  createManagedDocument,
  readManagedDocument,
} from '../modules/documents/storage';
import {
  enqueueDocumentProcessing,
  processDocumentJobBatch,
} from '../modules/documents/processing';
import { dispatchAction } from './actionDispatcher';
import { actionDefinitionFor } from './actions';

const postgresUrl = process.env.POSTGRES_URL;
const suite = postgresUrl ? describe : describe.skip;

suite('PostgreSQL 16 security lifecycle proof', () => {
  const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
  const databaseName = `erp_security_${suffix}`;
  const roleName = `erp_api_${suffix}`;
  const rolePassword = randomBytes(18).toString('base64url');
  let clusterPool: Pool;
  let ownerPool: Pool;
  let apiPool: Pool;
  let db: DB;

  beforeAll(async () => {
    const base = new URL(postgresUrl!);
    const clusterUrl = new URL(base);
    clusterUrl.pathname = '/postgres';
    clusterPool = new Pool({ connectionString: clusterUrl.toString() });
    await clusterPool.query(`create database "${databaseName}"`);

    const ownerUrl = new URL(base);
    ownerUrl.pathname = `/${databaseName}`;
    ownerPool = new Pool({ connectionString: ownerUrl.toString() });
    const ownerDb = drizzle(ownerPool, { schema });
    await migrate(ownerDb, { migrationsFolder: 'drizzle' });
    await ownerPool.query(
      `create role "${roleName}" login password '${rolePassword}' nosuperuser nobypassrls`,
    );
    await ownerPool.query(`grant connect on database "${databaseName}" to "${roleName}"`);
    await ownerPool.query(`grant usage on schema public to "${roleName}"`);
    await ownerPool.query(
      `grant select, insert, update, delete on all tables in schema public to "${roleName}"`,
    );
    await ownerPool.query(
      `grant usage, select on all sequences in schema public to "${roleName}"`,
    );
    await ownerPool.query(await readFile('deploy/sql/production-rls.sql', 'utf8'));

    const apiUrl = new URL(base);
    apiUrl.pathname = `/${databaseName}`;
    apiUrl.username = roleName;
    apiUrl.password = rolePassword;
    apiPool = new Pool({ connectionString: apiUrl.toString() });
    db = drizzle(apiPool, { schema }) as DB;
  }, 60_000);

  afterAll(async () => {
    await apiPool?.end();
    await ownerPool?.end();
    if (clusterPool) {
      await clusterPool.query(
        `select pg_terminate_backend(pid) from pg_stat_activity
         where datname = '${databaseName}' and pid <> pg_backend_pid()`,
      );
      await clusterPool.query(`drop database if exists "${databaseName}"`);
      await clusterPool.query(`drop role if exists "${roleName}"`);
      await clusterPool.end();
    }
  }, 30_000);

  it('runs setup, RLS, invitations, outbox and password reset as a non-superuser', async () => {
    const setup = await completeProductionSetup(db, {
      organizationName: 'PostgreSQL Security Proof',
      organizationCode: 'PG-SECURITY',
      companyName: 'Security Proof Singapore',
      country: 'SG',
      adminName: 'System Administrator',
      adminUsername: 'security.admin',
      adminEmail: 'admin@security-proof.example',
      adminPassword: 'initial-password',
      language: 'en',
    }, 'pg-setup-proof');

    expect(await db.select().from(schema.account)).toHaveLength(0);
    const visibleAccounts = await withTenantTransaction(db, {
      masterFn: setup.masterFn,
      companyFn: setup.companyFn,
    }, (tx) => tx.select().from(schema.account));
    // completeProductionSetup provisions the 10 core posting accounts plus
    // 2300 Landed Cost Accrual (added with the canonical landed-cost flow).
    expect(visibleAccounts).toHaveLength(11);

    const [admin] = await db.select().from(schema.appUser)
      .where(eq(schema.appUser.userId, setup.userId));
    const [adminRole] = await db.select().from(schema.role)
      .where(eq(schema.role.masterFn, setup.masterFn));
    const [queuedReport] = await withTenantTransaction(db, {
      masterFn: setup.masterFn,
      companyFn: setup.companyFn,
    }, (tx) => tx.insert(schema.reportJob).values({
      masterFn: setup.masterFn,
      companyFn: setup.companyFn,
      actorUserId: admin.userId,
      reportKey: 'profit_loss',
      format: 'xlsx',
      locale: 'en',
      presentationCurrency: 'SGD',
      filters: {
        companyFns: [setup.companyFn],
        presentationCurrency: 'SGD',
        comparison: 'budget',
      },
      expiresAt: new Date(Date.now() + 60_000),
    }).returning());
    expect(await db.select().from(schema.reportJob)).toHaveLength(0);
    expect(await withReportingWorkerTransaction(
      db,
      (tx) => tx.select().from(schema.reportJob)
        .where(eq(schema.reportJob.id, queuedReport.id)),
    )).toHaveLength(1);
    const key = Buffer.alloc(32, 11);
    const lifecycle = {
      tokenEncryptionKey: key,
      publicUrl: 'https://erp.example.test',
    };
    const invitation = await createInvitation(db, {
      userId: admin.userId,
      masterFn: setup.masterFn,
      activeCompanyFn: setup.companyFn,
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    }, {
      email: 'invitee@security-proof.example',
      roleId: adminRole.roleId,
    }, 'pg-invite-proof', lifecycle);
    const [inviteEvent] = await db.select().from(schema.outboxEvent)
      .where(eq(schema.outboxEvent.aggregateId, String(invitation.id)));
    const inviteToken = decryptToken(
      (inviteEvent.payload as { token: EncryptedToken }).token,
      key,
    );
    const delivered = await processOutboxBatch(db, {
      async send(message) {
        expect(message.to).toBe('invitee@security-proof.example');
        expect(message.text).toContain('token=');
      },
    }, { tokenEncryptionKey: key, workerId: 'pg-ci-worker' });
    expect(delivered).toEqual({ claimed: 1, delivered: 1, failed: 0 });
    const accepted = await acceptInvitation(db, {
      token: inviteToken,
      fullName: 'Invited User',
      password: 'invited-password',
      language: 'vi',
    }, 'pg-accept-proof');
    await expect(acceptInvitation(db, {
      token: inviteToken,
      fullName: 'Replay',
      password: 'invited-password',
    }, 'pg-accept-replay')).rejects.toMatchObject({ code: 'invitation_invalid' });

    const documentScope = {
      masterFn: setup.masterFn,
      companyFn: setup.companyFn,
    };
    const documentRegistry = createDocumentStorageRegistry({});
    const documentV1 = new TextEncoder().encode('postgres-document-v1');
    const documentV2 = new TextEncoder().encode('postgres-document-v2');
    const createdDocument = await createManagedDocument(
      db,
      documentScope,
      { userId: accepted.userId },
      {
        documentKey: 'postgres:receipt:1',
        purpose: 'receipt',
        ownerUserId: accepted.userId,
        originalFileName: 'receipt.txt',
        mimeType: 'text/plain',
        retentionUntil: new Date('2033-12-31T00:00:00.000Z'),
        content: documentV1,
      },
      documentRegistry,
    );
    expect(createdDocument.version).toMatchObject({
      versionNo: 1,
      storageBackend: 'database',
      sizeBytes: documentV1.byteLength,
    });
    expect((await readManagedDocument(
      db,
      documentScope,
      { userId: accepted.userId },
      createdDocument.document.id,
      documentRegistry,
    )).content).toEqual(documentV1);
    expect((await readManagedDocument(
      db,
      documentScope,
      { userId: admin.userId, canManage: true },
      createdDocument.document.id,
      documentRegistry,
    )).content).toEqual(documentV1);
    await expect(readManagedDocument(
      db,
      documentScope,
      { userId: admin.userId },
      createdDocument.document.id,
      documentRegistry,
    )).rejects.toMatchObject({ code: 'document_access_denied', status: 403 });
    await expect(readManagedDocument(
      db,
      { masterFn: setup.masterFn, companyFn: 'CROSS-TENANT' },
      { userId: accepted.userId, canManage: true },
      createdDocument.document.id,
      documentRegistry,
    )).rejects.toMatchObject({ code: 'document_missing', status: 404 });
    const appendedDocument = await appendManagedDocumentVersion(
      db,
      documentScope,
      { userId: accepted.userId },
      createdDocument.document.id,
      {
        expectedVersionNo: 1,
        mimeType: 'text/plain',
        content: documentV2,
      },
      documentRegistry,
    );
    expect(appendedDocument).toMatchObject({
      replayed: false,
      document: { currentVersionNo: 2 },
      version: { versionNo: 2, storageBackend: 'database' },
    });
    expect((await readManagedDocument(
      db,
      documentScope,
      { userId: accepted.userId },
      createdDocument.document.id,
      documentRegistry,
    )).content).toEqual(documentV2);
    expect(await db.select().from(schema.documentBlob)).toHaveLength(0);
    expect(await withTenantTransaction(
      db,
      documentScope,
      (tx) => tx.select().from(schema.documentBlob),
    )).toHaveLength(2);
    await withTenantTransaction(
      db,
      documentScope,
      async (tx) => {
        await tx.insert(schema.receiptUploadAuthorization).values({
          ...documentScope,
          versionId: appendedDocument.version.id,
          uploaderUserId: accepted.userId,
          autoSubmitAuthorized: false,
        });
        await enqueueDocumentProcessing(tx, documentScope, appendedDocument.version.id);
      },
    );
    expect(await db.select().from(schema.documentScanJob)).toHaveLength(0);
    expect(await db.select().from(schema.documentExtraction)).toHaveLength(0);
    expect(await db.select().from(schema.receiptUploadAuthorization)).toHaveLength(0);
    const processedDocument = await processDocumentJobBatch(db, {
      scanner: {
        scan: async () => ({
          status: 'clean',
          scanner: 'postgres-security-proof',
          resultCode: 'clean',
        }),
      },
      localOcr: {
        extract: async () => ({
          rawText: 'postgres ocr proof',
          model: 'local-ocr-security-proof',
          safetyClear: true,
          fields: [
            { fieldKey: 'merchant_name', value: 'Proof Merchant', sourceRef: 'page:1:block:1', confidence: 0.99 },
            { fieldKey: 'transaction_date', value: '2026-07-26', sourceRef: 'page:1:block:2', confidence: 0.99 },
            { fieldKey: 'currency', value: 'SGD', sourceRef: 'page:1:block:3', confidence: 0.99 },
            { fieldKey: 'total_amount', value: '10.00', sourceRef: 'page:1:block:4', confidence: 0.99 },
          ],
        }),
      },
      workerId: 'postgres-document-worker',
    });
    expect(processedDocument).toMatchObject({
      scansClaimed: 1,
      clean: 1,
      extractionsClaimed: 1,
      extracted: 1,
      failed: 0,
    });
    expect(await withTenantTransaction(
      db,
      documentScope,
      (tx) => tx.select().from(schema.documentExtraction),
    )).toEqual([
      expect.objectContaining({
        versionId: appendedDocument.version.id,
        provider: 'local_ocr',
        status: 'succeeded',
        rawText: 'postgres ocr proof',
      }),
    ]);
    expect(await db.select().from(schema.documentExtractionField)).toHaveLength(0);
    expect(await db.select().from(schema.receiptInboxItem)).toHaveLength(0);
    expect(await withTenantTransaction(
      db,
      documentScope,
      (tx) => tx.select().from(schema.documentExtractionField),
    )).toHaveLength(4);
    expect(await withTenantTransaction(
      db,
      documentScope,
      (tx) => tx.select().from(schema.receiptUploadAuthorization),
    )).toEqual([expect.objectContaining({
      uploaderUserId: accepted.userId,
      autoSubmitAuthorized: false,
    })]);
    expect(await withTenantTransaction(
      db,
      documentScope,
      (tx) => tx.select().from(schema.receiptInboxItem),
    )).toEqual([expect.objectContaining({
      status: 'ready',
      submissionKind: 'none',
    })]);

    await requestPasswordReset(
      db,
      accepted.email,
      'pg-reset-request',
      lifecycle,
    );
    const [resetEvent] = await db.select().from(schema.outboxEvent)
      .where(eq(schema.outboxEvent.topic, 'auth.password-reset.requested'));
    const resetToken = decryptToken(
      (resetEvent.payload as { token: EncryptedToken }).token,
      key,
    );
    await confirmPasswordReset(db, resetToken, 'changed-password', 'pg-reset-confirm');
    await expect(confirmPasswordReset(
      db,
      resetToken,
      'changed-password',
      'pg-reset-replay',
    )).rejects.toMatchObject({ code: 'reset_invalid' });

    const fixture = await withTenantTransaction(db, {
      masterFn: setup.masterFn,
      companyFn: setup.companyFn,
    }, async (tx) => {
      const [item] = await tx.insert(schema.product).values({
        masterFn: setup.masterFn,
        companyFn: setup.companyFn,
        sku: 'PG-WIDGET',
        name: 'PostgreSQL Widget',
      }).returning({ id: schema.product.id });
      const [location] = await tx.insert(schema.warehouse).values({
        masterFn: setup.masterFn,
        companyFn: setup.companyFn,
        code: 'MAIN',
        name: 'Main Warehouse',
      }).returning({ id: schema.warehouse.id });
      await tx.insert(schema.stockLevel).values({
        masterFn: setup.masterFn,
        companyFn: setup.companyFn,
        productId: item.id,
        warehouseId: location.id,
        qty: '20',
      });
      const [buyer] = await tx.insert(schema.customer).values({
        masterFn: setup.masterFn,
        companyFn: setup.companyFn,
        code: 'PG-CUSTOMER',
        name: 'PostgreSQL Customer',
      }).returning({ id: schema.customer.id });
      const [deal] = await tx.insert(schema.opportunity).values({
        masterFn: setup.masterFn,
        companyFn: setup.companyFn,
        docNo: 'PG-OPP-1',
        customerId: buyer.id,
        title: 'PostgreSQL action proof',
        value: '100.00',
        currency: 'SGD',
        closeDate: '2026-07-31',
      }).returning({ id: schema.opportunity.id });
      const [trackedItem] = await tx.insert(schema.product).values({
        masterFn: setup.masterFn,
        companyFn: setup.companyFn,
        sku: 'PG-LOT-WIDGET',
        name: 'PostgreSQL Lot Widget',
        trackingType: 'lot',
      }).returning({ id: schema.product.id });
      return {
        itemId: item.id,
        trackedItemId: trackedItem.id,
        warehouseId: location.id,
        opportunityId: deal.id,
      };
    });
    const action = actionDefinitionFor('crm/opportunities', 'convert');
    expect(action).not.toBeNull();
    const actionContext = {
      db,
      session: {
        userId: admin.userId,
        masterFn: setup.masterFn,
        activeCompanyFn: setup.companyFn,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
      },
      resource: 'crm/opportunities',
      resourceId: fixture.opportunityId,
      action: 'convert',
      payload: {
        docNo: 'PG-SO-1',
        orderDate: '2026-07-18',
        lines: [{
          productId: fixture.itemId,
          warehouseId: fixture.warehouseId,
          qty: 2,
          unitPrice: 10,
          taxCode: 'SR',
        }],
      },
      idempotencyKey: 'pg-action-proof',
      requestId: 'pg-action-proof',
    };
    const dispatched = await dispatchAction(actionContext, action!);
    const replayed = await dispatchAction(actionContext, action!);
    expect(dispatched.replayed).toBe(false);
    expect(replayed).toEqual({ ...dispatched, replayed: true });

    const trackingProof = await withTenantTransaction(db, {
      masterFn: setup.masterFn,
      companyFn: setup.companyFn,
    }, async (tx) => {
      const scope = {
        masterFn: setup.masterFn,
        companyFn: setup.companyFn,
      };
      const bin = await createWarehouseBinWithin(tx, scope, {
        warehouseId: fixture.warehouseId,
        code: 'LOT-A',
        name: 'Lot Storage A',
      });
      const lot = await createInventoryLotWithin(tx, scope, {
        productId: fixture.trackedItemId,
        lotNo: 'PG-LOT-001',
        qualityStatus: 'released',
      });
      await receiveStockWithin(tx, scope, {
        productId: fixture.trackedItemId,
        warehouseId: fixture.warehouseId,
        binId: bin.id,
        lotId: lot.id,
        qty: 8,
        refType: 'postgres_tracking_proof',
      });
      await issueStockWithin(tx, scope, {
        productId: fixture.trackedItemId,
        warehouseId: fixture.warehouseId,
        binId: bin.id,
        lotId: lot.id,
        qty: 3,
        refType: 'postgres_tracking_proof',
      });
      return {
        binId: bin.id,
        lotId: lot.id,
        aggregateQty: await getStockQty(tx, scope, fixture.trackedItemId, fixture.warehouseId),
        locationQty: await getStockLocationQty(
          tx,
          scope,
          fixture.trackedItemId,
          fixture.warehouseId,
          bin.id,
          `lot:${lot.id}`,
        ),
      };
    });
    expect(trackingProof).toMatchObject({ aggregateQty: 5, locationQty: 5 });
    expect(await db.select().from(schema.stockLocationBalance)).toHaveLength(0);
  }, 60_000);
});
