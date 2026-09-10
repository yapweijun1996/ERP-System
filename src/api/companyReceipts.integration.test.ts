import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import {
  appUser,
  auditLog,
  companyModule,
  companyReceipt,
  companyReceiptPack,
  companyReceiptPackPurgeRequest,
  companyReceiptPackTombstone,
  documentScanJob,
  employee,
  masterModule,
  role,
  rolePermission,
  userPermissionOverride,
  userCompanyRole,
} from '../data/schema';
import { withTenantTransaction } from '../data/tenantTransaction';
import { uploadReceiptDocument } from '../modules/documents/upload';
import { createCompanyReceiptWithin } from '../modules/expenses/companyReceipt';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

function cookies(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  return values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  )).join('; ');
}

describe('Company Receipts API', () => {
  let db: DB;
  let server: Server | undefined;
  let baseUrl: string;
  let viewerId: number;
  let adminId: number;

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
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    viewerId = viewer.userId;
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    adminId = admin.userId;
    const [employeeRole] = await db.select().from(role).where(and(
      eq(role.masterFn, 'M1'),
      eq(role.name, 'Employee'),
    ));
    await db.insert(userCompanyRole).values({
      userId: viewerId,
      companyFn: 'C-SG',
      roleId: employeeRole.roleId,
    }).onConflictDoNothing();
    await db.update(employee).set({ userId: null }).where(eq(employee.userId, viewerId));

    const activeServer = createApp(db).listen(0, '127.0.0.1');
    server = activeServer;
    await new Promise<void>((resolve) => activeServer.once('listening', resolve));
    const address = activeServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing API address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    const activeServer = server;
    await new Promise<void>((resolve, reject) => {
      activeServer.close((error) => error ? reject(error) : resolve());
    });
  });

  async function login(username = 'viewer', password = 'viewer1234') {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    const cookie = cookies(response);
    return {
      cookie,
      csrf: decodeURIComponent(cookie.match(/(?:^|;\s*)erp_csrf=([^;]+)/)?.[1] ?? ''),
    };
  }

  async function evidence(
    scope: { masterFn: string; companyFn: string },
    actorUserId: number,
    draftId: string,
    retentionUntil?: Date,
  ) {
    const uploaded = await uploadReceiptDocument(db, scope, { userId: actorUserId }, {
      clientDraftId: draftId,
      fileName: `${draftId}.jpg`,
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
        ...new TextEncoder().encode(draftId),
      ]),
      retentionUntil,
    });
    await withTenantTransaction(db, scope, (tx) => tx.update(documentScanJob).set({
      status: 'clean',
      scanner: 'company-receipt-api-test',
      resultCode: 'clean',
      completedAt: new Date('2026-08-11T08:00:00.000Z'),
    }).where(and(
      eq(documentScanJob.masterFn, scope.masterFn),
      eq(documentScanJob.companyFn, scope.companyFn),
      eq(documentScanJob.versionId, uploaded.version.id),
    )));
    return uploaded;
  }

  function payload(documentId: number, documentVersionId: number) {
    return {
      documentId,
      documentVersionId,
      transactionDate: '2026-08-10',
      merchant: 'API Merchant',
      receiptNumber: 'API-42',
      amount: '42.5000',
      currency: 'SGD',
      category: 'Travel',
      businessPurpose: 'Client-site transport',
      notes: 'Confirmed manually.',
    };
  }

  it('derives tenant/uploader scope and supports bounded list, detail, update and void', async () => {
    const sg = { masterFn: 'M1', companyFn: 'C-SG' };
    const my = { masterFn: 'M1', companyFn: 'C-MY' };
    const uploaded = await evidence(sg, viewerId, 'receipt_api_sg_0001');
    const auth = await login();
    const mutationHeaders = {
      cookie: auth.cookie,
      'x-csrf-token': auth.csrf,
      'content-type': 'application/json',
    };

    const tampered = await fetch(`${baseUrl}/api/company-receipts`, {
      method: 'POST',
      headers: mutationHeaders,
      body: JSON.stringify({
        ...payload(uploaded.document.id, uploaded.version.id),
        context: { companyFn: 'C-MY' },
      }),
    });
    expect(tampered.status).toBe(400);
    expect((await tampered.json()).error.code).toBe('tenant_scope_is_session_derived');

    const confirmation = await fetch(
      `${baseUrl}/api/company-receipts/confirmations/${uploaded.version.id}`,
      { headers: { cookie: auth.cookie } },
    );
    expect(confirmation.status).toBe(200);
    expect(await confirmation.json()).toMatchObject({
      data: {
        evidence: {
          documentId: uploaded.document.id,
          documentVersionId: uploaded.version.id,
          scanStatus: 'clean',
        },
        extraction: { status: 'not_started', candidates: [] },
        manualConfirmationAllowed: true,
        provenanceImmutable: true,
      },
      meta: {
        scope: 'uploader',
        ocrIsSuggestionOnly: true,
        originalPreserved: true,
      },
    });

    const evidenceList = await fetch(
      `${baseUrl}/api/company-receipts/evidence?limit=10&search=receipt_api_sg`,
      { headers: { cookie: auth.cookie } },
    );
    expect(evidenceList.status).toBe(200);
    expect(await evidenceList.json()).toMatchObject({
      data: [expect.objectContaining({
        documentId: uploaded.document.id,
        documentVersionId: uploaded.version.id,
        scanStatus: 'clean',
      })],
      meta: {
        scope: 'uploader',
        employeeIndependent: true,
        eligibleOnly: true,
        limit: 10,
        nextCursor: null,
      },
    });

    const createdResponse = await fetch(`${baseUrl}/api/company-receipts`, {
      method: 'POST',
      headers: { ...mutationHeaders, 'x-request-id': 'company-receipt-create-0001' },
      body: JSON.stringify(payload(uploaded.document.id, uploaded.version.id)),
    });
    expect(createdResponse.status).toBe(201);
    const createdBody = await createdResponse.json() as {
      data: { id: number; version: number; uploaderUserId: number; status: string };
      meta: { scope: string; evidenceImmutable: boolean };
    };
    expect(createdBody).toMatchObject({
      data: { version: 1, uploaderUserId: viewerId, status: 'ready' },
      meta: { scope: 'uploader', evidenceImmutable: true },
    });
    const boundEvidence = await fetch(`${baseUrl}/api/company-receipts/evidence?limit=10`, {
      headers: { cookie: auth.cookie },
    });
    expect(boundEvidence.status).toBe(200);
    expect((await boundEvidence.json()).data).toEqual([]);

    const adminEvidence = await evidence(sg, adminId, 'receipt_api_admin_0001');
    const adminReceipt = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(
        tx,
        sg,
        adminId,
        {
          ...payload(adminEvidence.document.id, adminEvidence.version.id),
          transactionDate: undefined,
          merchant: 'Admin Merchant',
        },
      ));

    const list = await fetch(`${baseUrl}/api/company-receipts?limit=1`, {
      headers: { cookie: auth.cookie },
    });
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({
      data: [{ id: createdBody.data.id, merchant: 'API Merchant' }],
      meta: {
        scope: 'own', limit: 1, nextCursor: null,
        actions: { create: true, edit: true, void: true },
      },
    });
    const adminAuth = await login('admin', 'demo1234');
    const switchResponse = await fetch(`${baseUrl}/api/auth/session/actions/switch-company`, {
      method: 'POST',
      headers: {
        cookie: adminAuth.cookie,
        'x-csrf-token': adminAuth.csrf,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ companyFn: 'C-SG' }),
    });
    expect(switchResponse.status).toBe(200);
    const companyList = await fetch(`${baseUrl}/api/company-receipts?limit=10`, {
      headers: { cookie: adminAuth.cookie },
    });
    expect(companyList.status).toBe(200);
    expect(await companyList.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({ id: createdBody.data.id, uploaderUserId: viewerId }),
        expect.objectContaining({ id: adminReceipt.id, uploaderUserId: adminId }),
      ]),
      meta: { scope: 'company', limit: 10, nextCursor: null },
    });
    const searched = await fetch(`${baseUrl}/api/company-receipts?search=Admin%20Merchant`, {
      headers: { cookie: adminAuth.cookie },
    });
    expect(await searched.json()).toMatchObject({
      data: [expect.objectContaining({ id: adminReceipt.id })],
      meta: { filters: { search: 'Admin Merchant', dateFrom: null, dateTo: null } },
    });
    const sameDay = await fetch(
      `${baseUrl}/api/company-receipts?dateFrom=2026-08-10&dateTo=2026-08-10`,
      { headers: { cookie: adminAuth.cookie } },
    );
    expect(await sameDay.json()).toMatchObject({
      data: [expect.objectContaining({ id: createdBody.data.id })],
      meta: { filters: { dateFrom: '2026-08-10', dateTo: '2026-08-10' } },
    });
    const invalidRange = await fetch(
      `${baseUrl}/api/company-receipts?dateFrom=2026-08-11&dateTo=2026-08-10`,
      { headers: { cookie: adminAuth.cookie } },
    );
    expect(invalidRange.status).toBe(400);
    expect((await invalidRange.json()).error.code).toBe('company_receipt_query_invalid');
    const invalidPack = await fetch(`${baseUrl}/api/company-receipts/packs`, {
      method: 'POST',
      headers: {
        cookie: adminAuth.cookie,
        'x-csrf-token': adminAuth.csrf,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        packKey: 'company-receipt-pack:api-invalid',
        dateFrom: '2026-08-11',
        dateTo: '2026-08-10',
      }),
    });
    expect(invalidPack.status).toBe(422);
    expect((await invalidPack.json()).error.code).toBe('company_receipt_pack_range_invalid');
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
    const preparedPack = await fetch(`${baseUrl}/api/company-receipts/packs/prepare`, {
      method: 'POST',
      headers: {
        cookie: adminAuth.cookie,
        'x-csrf-token': adminAuth.csrf,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        dateFrom: '2026-08-10',
        dateTo: '2026-08-10',
        locale: 'en',
      }),
    });
    expect(preparedPack.status).toBe(200);
    expect(await preparedPack.json()).toMatchObject({
      data: {
        selectionDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
        visibility: 'company',
        rowCount: 1,
        documentCount: 1,
        totals: [{ currency: 'SGD', amount: '42.5000', receiptCount: 1 }],
      },
      meta: { preparationOnly: true, authorizationRequired: true, completeResult: true },
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
    const packResponse = await fetch(`${baseUrl}/api/company-receipts/packs`, {
      method: 'POST',
      headers: {
        cookie: adminAuth.cookie,
        'x-csrf-token': adminAuth.csrf,
        'content-type': 'application/json',
        'x-request-id': 'company-receipt-pack-create-0001',
      },
      body: JSON.stringify({
        packKey: 'company-receipt-pack:api-0001',
        dateFrom: '2026-08-10',
        dateTo: '2026-08-10',
        locale: 'en',
      }),
    });
    expect(packResponse.status).toBe(201);
    const packBody = await packResponse.json() as {
      data: { pack: { id: number; rowCount: number; rows: Array<{ id: number }> } };
    };
    expect(packBody.data.pack).toMatchObject({
      rowCount: 1,
      totals: [{ currency: 'SGD', amount: '42.5000', receiptCount: 1 }],
    });
    const packPdfResponse = await fetch(
      `${baseUrl}/api/company-receipts/packs/${packBody.data.pack.id}/pdf?action=download`,
      { headers: { cookie: adminAuth.cookie, 'x-request-id': 'company-receipt-pack-pdf-0001' } },
    );
    expect(packPdfResponse.status).toBe(200);
    expect(packPdfResponse.headers.get('content-type')).toBe('application/pdf');
    expect(packPdfResponse.headers.get('cache-control')).toBe('private, no-store');
    expect(packPdfResponse.headers.get('x-receipt-pack-access-purpose'))
      .toBe('receipt_pack_original_evidence_export');
    expect(packPdfResponse.headers.get('x-receipt-pack-sha256')).toMatch(/^[0-9a-f]{64}$/);
    expect((await PDFDocument.load(await packPdfResponse.arrayBuffer())).getPageCount())
      .toBeGreaterThanOrEqual(2);
    const companyDetail = await fetch(
      `${baseUrl}/api/company-receipts/${createdBody.data.id}`,
      { headers: { cookie: adminAuth.cookie } },
    );
    expect(companyDetail.status).toBe(200);
    expect(await companyDetail.json()).toMatchObject({
      data: { id: createdBody.data.id, uploaderUserId: viewerId },
      meta: { scope: 'company' },
    });
    const detail = await fetch(
      `${baseUrl}/api/company-receipts/${createdBody.data.id}`,
      { headers: { cookie: auth.cookie } },
    );
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({
      data: {
        id: createdBody.data.id,
        documentId: uploaded.document.id,
        documentVersionId: uploaded.version.id,
      },
    });

    const changed = await fetch(
      `${baseUrl}/api/company-receipts/${createdBody.data.id}`,
      {
        method: 'PATCH',
        headers: { ...mutationHeaders, 'x-request-id': 'company-receipt-update-0001' },
        body: JSON.stringify({ expectedVersion: 1, merchant: 'API Merchant Updated' }),
      },
    );
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({
      data: { merchant: 'API Merchant Updated', version: 2 },
    });
    const stale = await fetch(
      `${baseUrl}/api/company-receipts/${createdBody.data.id}`,
      {
        method: 'PATCH',
        headers: mutationHeaders,
        body: JSON.stringify({ expectedVersion: 1, merchant: 'Stale mutation' }),
      },
    );
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe('company_receipt_version_conflict');

    const crossEvidence = await evidence(my, adminId, 'receipt_api_my_0001');
    const hiddenConfirmation = await fetch(
      `${baseUrl}/api/company-receipts/confirmations/${crossEvidence.version.id}`,
      { headers: { cookie: auth.cookie } },
    );
    expect(hiddenConfirmation.status).toBe(404);
    expect((await hiddenConfirmation.json()).error.code)
      .toBe('company_receipt_evidence_not_found');
    const crossReceipt = await withTenantTransaction(db, my, (tx) =>
      createCompanyReceiptWithin(
        tx,
        my,
        adminId,
        payload(crossEvidence.document.id, crossEvidence.version.id),
      ));
    const hidden = await fetch(
      `${baseUrl}/api/company-receipts/${crossReceipt.id}`,
      { headers: { cookie: auth.cookie } },
    );
    expect(hidden.status).toBe(404);
    expect((await hidden.json()).error.code).toBe('company_receipt_not_found');

    const voided = await fetch(
      `${baseUrl}/api/company-receipts/${createdBody.data.id}/actions/void`,
      {
        method: 'POST',
        headers: { ...mutationHeaders, 'x-request-id': 'company-receipt-void-0001' },
        body: JSON.stringify({ expectedVersion: 2, reason: 'Duplicate receipt record' }),
      },
    );
    expect(voided.status).toBe(200);
    expect(await voided.json()).toMatchObject({
      data: { status: 'voided', version: 3, voidReason: 'Duplicate receipt record' },
      meta: { tombstone: true },
    });

    const audits = await db.select({
      action: auditLog.action,
      requestId: auditLog.requestId,
    }).from(auditLog).where(and(
      eq(auditLog.masterFn, 'M1'),
      eq(auditLog.companyFn, 'C-SG'),
      eq(auditLog.entity, 'company_receipt'),
      eq(auditLog.entityId, String(createdBody.data.id)),
    ));
    expect(audits).toEqual(expect.arrayContaining([
      { action: 'created', requestId: 'company-receipt-create-0001' },
      { action: 'updated', requestId: 'company-receipt-update-0001' },
      { action: 'voided', requestId: 'company-receipt-void-0001' },
    ]));
    expect(await db.select().from(companyReceipt)).toHaveLength(3);
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);
    const packAudits = await db.select({
      action: auditLog.action,
      requestId: auditLog.requestId,
    }).from(auditLog).where(and(
      eq(auditLog.masterFn, 'M1'),
      eq(auditLog.companyFn, 'C-SG'),
      eq(auditLog.entity, 'company_receipt_pack'),
      eq(auditLog.entityId, String(packBody.data.pack.id)),
    ));
    expect(packAudits).toEqual(expect.arrayContaining([
      { action: 'created', requestId: 'company-receipt-pack-create-0001' },
      { action: 'pdf_download', requestId: 'company-receipt-pack-pdf-0001' },
    ]));
    const [pdfAudit] = await db.select({ after: auditLog.after }).from(auditLog).where(and(
      eq(auditLog.masterFn, 'M1'),
      eq(auditLog.companyFn, 'C-SG'),
      eq(auditLog.entity, 'company_receipt_pack'),
      eq(auditLog.entityId, String(packBody.data.pack.id)),
      eq(auditLog.action, 'pdf_download'),
    ));
    expect(pdfAudit?.after).toMatchObject({
      accessPurpose: 'receipt_pack_original_evidence_export',
      snapshotVisibility: 'company',
      currentVisibility: 'company',
    });

    await db.update(companyModule).set({ enabled: true }).where(and(
      eq(companyModule.masterFn, 'M1'),
      eq(companyModule.companyFn, 'C-MY'),
      eq(companyModule.moduleKey, 'expenses_tax'),
    ));
    const activeTenantSwitch = await fetch(`${baseUrl}/api/auth/session/actions/switch-company`, {
      method: 'POST',
      headers: {
        cookie: adminAuth.cookie,
        'x-csrf-token': adminAuth.csrf,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ companyFn: 'C-MY' }),
    });
    expect(activeTenantSwitch.status).toBe(200);
    const activeTenantPack = await fetch(
      `${baseUrl}/api/company-receipts/packs/${packBody.data.pack.id}`,
      { headers: { cookie: adminAuth.cookie } },
    );
    expect(activeTenantPack.status).toBe(404);
    expect((await activeTenantPack.json()).error.code).toBe('company_receipt_pack_not_found');
    const activeTenantPdf = await fetch(
      `${baseUrl}/api/company-receipts/packs/${packBody.data.pack.id}/pdf?action=download`,
      { headers: { cookie: adminAuth.cookie } },
    );
    expect(activeTenantPdf.status).toBe(404);
    expect((await activeTenantPdf.json()).error.code).toBe('company_receipt_pack_not_found');
    const switchBack = await fetch(`${baseUrl}/api/auth/session/actions/switch-company`, {
      method: 'POST',
      headers: {
        cookie: adminAuth.cookie,
        'x-csrf-token': adminAuth.csrf,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ companyFn: 'C-SG' }),
    });
    expect(switchBack.status).toBe(200);

    await db.delete(rolePermission).where(eq(
      rolePermission.permissionKey,
      'expenses.company_receipts.read_company',
    ));
    const downgradedPack = await fetch(
      `${baseUrl}/api/company-receipts/packs/${packBody.data.pack.id}`,
      { headers: { cookie: adminAuth.cookie } },
    );
    expect(downgradedPack.status).toBe(404);
    expect((await downgradedPack.json()).error.code).toBe('company_receipt_pack_not_found');
    const downgradedPdf = await fetch(
      `${baseUrl}/api/company-receipts/packs/${packBody.data.pack.id}/pdf?action=download`,
      { headers: { cookie: adminAuth.cookie } },
    );
    expect(downgradedPdf.status).toBe(404);
    expect((await downgradedPdf.json()).error.code).toBe('company_receipt_pack_not_found');
    await db.delete(rolePermission).where(eq(
      rolePermission.permissionKey,
      'expenses.company_receipts.read_own',
    ));
    const revokedRead = await fetch(
      `${baseUrl}/api/company-receipts/packs/${packBody.data.pack.id}`,
      { headers: { cookie: adminAuth.cookie } },
    );
    expect(revokedRead.status).toBe(403);
    expect((await revokedRead.json()).error.code).toBe('permission_denied');
  });

  it('denies register reads when only the legacy receipt mutation grant remains', async () => {
    const [employeeRole] = await db.select().from(role).where(and(
      eq(role.masterFn, 'M1'),
      eq(role.name, 'Employee'),
    ));
    await db.delete(rolePermission).where(and(
      eq(rolePermission.roleId, employeeRole.roleId),
      eq(rolePermission.permissionKey, 'expenses.company_receipts.read_own'),
    ));
    const auth = await login();
    const response = await fetch(`${baseUrl}/api/company-receipts`, {
      headers: { cookie: auth.cookie },
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('permission_denied');
  });

  it('does not treat the legacy My Receipts grant as a Company Receipt mutation grant', async () => {
    const [employeeRole] = await db.select().from(role).where(and(
      eq(role.masterFn, 'M1'),
      eq(role.name, 'Employee'),
    ));
    await db.delete(rolePermission).where(and(
      eq(rolePermission.roleId, employeeRole.roleId),
      eq(rolePermission.permissionKey, 'expenses.company_receipts.create'),
    ));
    await db.delete(rolePermission).where(and(
      eq(rolePermission.roleId, employeeRole.roleId),
      eq(rolePermission.permissionKey, 'expenses.company_receipts.edit'),
    ));
    await db.delete(rolePermission).where(and(
      eq(rolePermission.roleId, employeeRole.roleId),
      eq(rolePermission.permissionKey, 'expenses.company_receipts.void'),
    ));
    const auth = await login();
    const headers = {
      cookie: auth.cookie,
      'content-type': 'application/json',
      'x-csrf-token': auth.csrf,
    };

    const confirmation = await fetch(`${baseUrl}/api/company-receipts/confirmations/1`, {
      headers: { cookie: auth.cookie },
    });
    expect(confirmation.status).toBe(403);
    const evidenceList = await fetch(`${baseUrl}/api/company-receipts/evidence`, {
      headers: { cookie: auth.cookie },
    });
    expect(evidenceList.status).toBe(403);
    const create = await fetch(`${baseUrl}/api/company-receipts`, {
      method: 'POST', headers, body: JSON.stringify({}),
    });
    expect(create.status).toBe(403);
    const edit = await fetch(`${baseUrl}/api/company-receipts/1`, {
      method: 'PATCH', headers, body: JSON.stringify({}),
    });
    expect(edit.status).toBe(403);
    const voided = await fetch(`${baseUrl}/api/company-receipts/1/actions/void`, {
      method: 'POST', headers, body: JSON.stringify({}),
    });
    expect(voided.status).toBe(403);
  });

  it('exposes retention and two-person Pack purge actions with tenant-derived scope', async () => {
    const sg = { masterFn: 'M1', companyFn: 'C-SG' };
    const expired = new Date('2025-01-01T00:00:00.000Z');
    const uploaded = await evidence(sg, adminId, 'receipt_api_pack_governance_0001', expired);
    const receipt = await withTenantTransaction(db, sg, (tx) =>
      createCompanyReceiptWithin(tx, sg, adminId, {
        documentId: uploaded.document.id,
        documentVersionId: uploaded.version.id,
        transactionDate: '2025-01-01',
        merchant: 'Governed API Merchant',
        amount: '9.0000',
        currency: 'SGD',
        category: 'Office supplies',
        businessPurpose: 'API governance test',
      }));
    const adminAuth = await login('admin', 'demo1234');
    const headers = {
      cookie: adminAuth.cookie,
      'x-csrf-token': adminAuth.csrf,
      'content-type': 'application/json',
    };
    const packResponse = await fetch(`${baseUrl}/api/company-receipts/packs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        packKey: 'company-receipt-pack:api-governance',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-01',
      }),
    });
    expect(packResponse.status).toBe(201);
    const pack = (await packResponse.json()).data.pack as {
      id: number;
      retentionUntil: string;
      recordVersion: number;
    };
    expect(pack).toMatchObject({ recordVersion: 1 });
    expect(new Date(pack.retentionUntil).toISOString()).toBe(expired.toISOString());

    const held = await fetch(
      `${baseUrl}/api/company-receipts/packs/${pack.id}/actions/legal-hold`,
      { method: 'POST', headers, body: JSON.stringify({
        expectedVersion: 1,
        legalHold: true,
        reason: 'API legal review is active.',
      }) },
    );
    expect(held.status).toBe(200);
    expect((await held.json()).data.recordVersion).toBe(2);
    const heldPurge = await fetch(
      `${baseUrl}/api/company-receipts/packs/${pack.id}/actions/initiate-purge`,
      { method: 'POST', headers, body: JSON.stringify({ reason: 'Retention has expired.' }) },
    );
    expect(heldPurge.status).toBe(409);
    expect((await heldPurge.json()).error.code).toBe('company_receipt_pack_legal_hold');
    const released = await fetch(
      `${baseUrl}/api/company-receipts/packs/${pack.id}/actions/legal-hold`,
      { method: 'POST', headers, body: JSON.stringify({
        expectedVersion: 2,
        legalHold: false,
        reason: 'API legal review is complete.',
      }) },
    );
    expect(released.status).toBe(200);
    const requestResponse = await fetch(
      `${baseUrl}/api/company-receipts/packs/${pack.id}/actions/initiate-purge`,
      { method: 'POST', headers, body: JSON.stringify({ reason: 'Retention expired and resolved.' }) },
    );
    expect(requestResponse.status).toBe(201);
    const request = (await requestResponse.json()).data as { id: number; version: number };

    const [employeeRole] = await db.select().from(role).where(and(
      eq(role.masterFn, 'M1'),
      eq(role.name, 'Employee'),
    ));
    await db.insert(rolePermission).values({
      masterFn: 'M1', roleId: employeeRole.roleId, permissionKey: 'documents.finance.review',
    }).onConflictDoNothing();
    const viewerAuth = await login();
    const reviewed = await fetch(
      `${baseUrl}/api/company-receipts/packs/purge-requests/${request.id}/actions/review`,
      {
        method: 'POST',
        headers: {
          cookie: viewerAuth.cookie,
          'x-csrf-token': viewerAuth.csrf,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          expectedVersion: request.version,
          decision: 'approve',
          reason: 'Finance reviewed the API purge evidence.',
        }),
      },
    );
    expect(reviewed.status).toBe(200);
    const approved = (await reviewed.json()).data as { version: number };
    const executed = await fetch(
      `${baseUrl}/api/company-receipts/packs/${pack.id}/actions/execute-purge`,
      { method: 'POST', headers, body: JSON.stringify({
        requestId: request.id,
        expectedVersion: approved.version,
      }) },
    );
    expect(executed.status).toBe(200);
    expect((await executed.json()).meta).toMatchObject({ governed: true, tombstone: true });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(0);
    expect(await db.select().from(companyReceiptPackPurgeRequest)).toMatchObject([
      expect.objectContaining({ packId: pack.id, status: 'executed' }),
    ]);
    expect(await db.select().from(companyReceiptPackTombstone)).toMatchObject([
      expect.objectContaining({ originalPackId: pack.id, sourceSha256: expect.any(String) }),
    ]);
    const reuse = await fetch(`${baseUrl}/api/company-receipts/packs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        packKey: 'company-receipt-pack:api-governance',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-01',
      }),
    });
    expect(reuse.status).toBe(410);
    expect((await reuse.json()).error.code).toBe('company_receipt_pack_key_purged');
    expect(receipt.id).toBeGreaterThan(0);
  });

  it('uses an explicit company-read grant for a custom Receipt Manager role', async () => {
    const [receiptManager] = await db.insert(role).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      name: 'Custom Receipt Reader',
      isSuperadmin: false,
    }).returning();
    await db.insert(rolePermission).values({
      masterFn: 'M1',
      roleId: receiptManager.roleId,
      permissionKey: 'expenses.company_receipts.read_company',
    });
    await db.insert(userCompanyRole).values({
      userId: viewerId,
      companyFn: 'C-SG',
      roleId: receiptManager.roleId,
      assignmentSource: 'manual',
    });
    const uploaded = await evidence(
      { masterFn: 'M1', companyFn: 'C-SG' },
      adminId,
      'receipt_api_custom_reader_0001',
    );
    const created = await withTenantTransaction(db, { masterFn: 'M1', companyFn: 'C-SG' },
      (tx) => createCompanyReceiptWithin(
        tx,
        { masterFn: 'M1', companyFn: 'C-SG' },
        adminId,
        payload(uploaded.document.id, uploaded.version.id),
      ));
    const auth = await login();
    const response = await fetch(`${baseUrl}/api/company-receipts?limit=25`, {
      headers: { cookie: auth.cookie },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [expect.objectContaining({ id: created.id, uploaderUserId: adminId })],
      meta: { scope: 'company', limit: 25, nextCursor: null },
    });
  });

  it('replays the same Pack key and rejects changed selection intent without a duplicate', async () => {
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const uploaded = await evidence(scope, adminId, 'receipt_api_replay_0001');
    const receipt = await withTenantTransaction(db, scope, (tx) =>
      createCompanyReceiptWithin(tx, scope, adminId, payload(
        uploaded.document.id,
        uploaded.version.id,
      )));
    const auth = await login('admin', 'demo1234');
    const headers = {
      cookie: auth.cookie,
      'x-csrf-token': auth.csrf,
      'content-type': 'application/json',
    };
    const body = {
      packKey: 'company-receipt-pack:api-replay-0001',
      dateFrom: '2026-08-10',
      dateTo: '2026-08-10',
      locale: 'en',
    };
    const first = await fetch(`${baseUrl}/api/company-receipts/packs`, {
      method: 'POST',
      headers: { ...headers, 'x-request-id': 'company-receipt-pack-replay-first' },
      body: JSON.stringify(body),
    });
    expect(first.status).toBe(201);
    const firstBody = await first.json() as {
      data: { pack: { id: number; rowCount: number; sourceSha256: string }; replayed: boolean };
    };
    expect(firstBody.data).toMatchObject({
      replayed: false,
      pack: { rowCount: 1, sourceSha256: expect.stringMatching(/^[0-9a-f]{64}$/) },
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);

    const replay = await fetch(`${baseUrl}/api/company-receipts/packs`, {
      method: 'POST',
      headers: { ...headers, 'x-request-id': 'company-receipt-pack-replay-second' },
      body: JSON.stringify(body),
    });
    expect(replay.status).toBe(200);
    const replayBody = await replay.json() as {
      data: { pack: { id: number; sourceSha256: string }; replayed: boolean };
    };
    expect(replayBody).toMatchObject({
      data: {
        replayed: true,
        pack: { id: firstBody.data.pack.id, sourceSha256: firstBody.data.pack.sourceSha256 },
      },
    });
    expect(await db.select().from(companyReceiptPack)).toHaveLength(1);

    const changed = await fetch(`${baseUrl}/api/company-receipts/packs`, {
      method: 'POST',
      headers: { ...headers, 'x-request-id': 'company-receipt-pack-replay-conflict' },
      body: JSON.stringify({ ...body, dateFrom: '2026-08-09' }),
    });
    expect(changed.status).toBe(409);
    expect((await changed.json()).error.code).toBe('company_receipt_pack_key_conflict');
    const [stored] = await db.select().from(companyReceiptPack);
    expect(stored).toMatchObject({
      id: firstBody.data.pack.id,
      sourceSha256: firstBody.data.pack.sourceSha256,
      rowCount: 1,
    });
    expect(receipt.id).toBeGreaterThan(0);
    const packAudits = await db.select({ action: auditLog.action }).from(auditLog).where(and(
      eq(auditLog.masterFn, scope.masterFn),
      eq(auditLog.companyFn, scope.companyFn),
      eq(auditLog.entity, 'company_receipt_pack'),
      eq(auditLog.entityId, String(firstBody.data.pack.id)),
    ));
    expect(packAudits).toEqual(expect.arrayContaining([
      { action: 'created' },
      { action: 'create_replay' },
    ]));
  });

  it('serves bounded semantic totals through the authenticated receipt boundary', async () => {
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const viewerEvidence = await evidence(scope, viewerId, 'receipt_semantic_viewer_0001');
    await withTenantTransaction(db, scope, (tx) => createCompanyReceiptWithin(
      tx,
      scope,
      viewerId,
      {
        ...payload(viewerEvidence.document.id, viewerEvidence.version.id),
        transactionDate: '2026-08-10',
        amount: '10.5000',
      },
    ));
    const adminEvidence = await evidence(scope, adminId, 'receipt_semantic_admin_0001');
    await withTenantTransaction(db, scope, (tx) => createCompanyReceiptWithin(
      tx,
      scope,
      adminId,
      {
        ...payload(adminEvidence.document.id, adminEvidence.version.id),
        transactionDate: '2026-08-11',
        amount: '5.2500',
      },
    ));
    const myrEvidence = await evidence(scope, adminId, 'receipt_semantic_admin_0002');
    await withTenantTransaction(db, scope, (tx) => createCompanyReceiptWithin(
      tx,
      scope,
      adminId,
      {
        ...payload(myrEvidence.document.id, myrEvidence.version.id),
        transactionDate: '2026-08-11',
        amount: '7.7500',
        currency: 'MYR',
      },
    ));

    const auth = await login('admin', 'demo1234');
    const summary = await fetch(
      `${baseUrl}/api/company-receipts/semantic-summary?dateFrom=2026-08-10&dateTo=2026-08-11`,
      { headers: { cookie: auth.cookie } },
    );
    expect(summary.status).toBe(200);
    expect(await summary.json()).toMatchObject({
      data: {
        contractVersion: 1,
        scope: { masterFn: 'M1', companyFn: 'C-SG', visibility: 'company' },
        period: { dateFrom: '2026-08-10', dateTo: '2026-08-11', inclusive: true },
        receiptCount: 3,
        totalsByCurrency: [
          { currency: 'MYR', amount: '7.7500', receiptCount: 1 },
          { currency: 'SGD', amount: '15.7500', receiptCount: 2 },
        ],
        sources: expect.arrayContaining([
          expect.objectContaining({ receiptId: expect.any(Number), documentVersionId: expect.any(Number) }),
        ]),
      },
      meta: { sourceAction: 'receipt.search', pageSize: 100, maxRows: 5000, scope: 'company' },
    });

    const tampered = await fetch(
      `${baseUrl}/api/company-receipts/semantic-summary?masterFn=M1&dateFrom=2026-08-10&dateTo=2026-08-11`,
      { headers: { cookie: auth.cookie } },
    );
    expect(tampered.status).toBe(400);
    expect((await tampered.json()).error.code).toBe('tenant_scope_is_session_derived');

    const invalidRange = await fetch(
      `${baseUrl}/api/company-receipts/semantic-summary?dateFrom=2026-08-12&dateTo=2026-08-10`,
      { headers: { cookie: auth.cookie } },
    );
    expect(invalidRange.status).toBe(400);
    expect((await invalidRange.json()).error.code).toBe('semantic_query_invalid');

    await db.insert(userPermissionOverride).values([
      {
        masterFn: scope.masterFn,
        companyFn: scope.companyFn,
        userId: adminId,
        permissionKey: 'expenses.company_receipts.read_company',
        resourceKey: null,
        effect: 'deny',
        scope: 'company',
        targetType: 'none',
        targetId: '',
        reason: 'Semantic retrieval permission downgrade test',
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        assignedByUserId: adminId,
      },
      {
        masterFn: scope.masterFn,
        companyFn: scope.companyFn,
        userId: adminId,
        permissionKey: 'expenses.company_receipts.read_own',
        resourceKey: null,
        effect: 'deny',
        scope: 'company',
        targetType: 'none',
        targetId: '',
        reason: 'Semantic retrieval permission downgrade test',
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        assignedByUserId: adminId,
      },
    ]);
    const denied = await fetch(
      `${baseUrl}/api/company-receipts/semantic-summary?dateFrom=2026-08-10&dateTo=2026-08-11`,
      { headers: { cookie: auth.cookie } },
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe('permission_denied');
  });
});
