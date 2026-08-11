import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import { seedDemo } from '../data/seed';
import {
  appUser,
  auditLog,
  companyReceipt,
  documentScanJob,
  employee,
  role,
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

  async function login() {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username: 'viewer', password: 'viewer1234' }),
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
  ) {
    const uploaded = await uploadReceiptDocument(db, scope, { userId: actorUserId }, {
      clientDraftId: draftId,
      fileName: `${draftId}.jpg`,
      declaredMimeType: 'image/jpeg',
      content: Uint8Array.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
      ]),
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

    const list = await fetch(`${baseUrl}/api/company-receipts?limit=1`, {
      headers: { cookie: auth.cookie },
    });
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({
      data: [{ id: createdBody.data.id, merchant: 'API Merchant' }],
      meta: { scope: 'uploader', limit: 1, nextCursor: null },
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
    expect(await db.select().from(companyReceipt)).toHaveLength(2);
  });
});
