import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import {
  appUser,
  auditLog,
  documentAccessEvent,
  documentExtraction,
  documentPurgeRequest,
  documentScanJob,
  documentTombstone,
  managedDocument,
  outboxEvent,
  role,
  rolePermission,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { uploadReceiptDocument } from '../modules/documents/upload';
import { createApp } from './app';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);

function responseCookies(response: Response): { cookie: string; csrf: string } {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  const pairs = values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  ));
  const csrf = pairs.find((pair) => pair.startsWith('erp_csrf='));
  if (!csrf) throw new Error('Missing CSRF cookie');
  return { cookie: pairs.join('; '), csrf: decodeURIComponent(csrf.slice(9)) };
}

describe('document governance API', () => {
  let db: DB;
  let server: Server;
  let baseUrl: string;
  let viewerId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    viewerId = viewer.userId;
    const [employeeRole] = await db.select().from(role).where(and(
      eq(role.masterFn, 'M1'),
      eq(role.name, 'Employee'),
    ));
    await db.insert(rolePermission).values([
      {
        masterFn: 'M1',
        roleId: employeeRole.roleId,
        permissionKey: 'documents.finance.review',
      },
    ]).onConflictDoNothing();
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('API did not bind');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
    }
  });

  async function login(username: 'admin' | 'viewer') {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationCode: 'ACME',
        username,
        password: username === 'admin' ? 'demo1234' : 'viewer1234',
      }),
    });
    expect(response.status).toBe(200);
    return responseCookies(response);
  }

  function headers(auth: { cookie: string; csrf: string }, key: string) {
    return {
      cookie: auth.cookie,
      'x-csrf-token': auth.csrf,
      'content-type': 'application/json',
      'idempotency-key': key,
    };
  }

  it('supports owner draft deletion and distinct records-manager/Finance purge', async () => {
    const viewer = await login('viewer');
    const admin = await login('admin');
    const draft = await uploadReceiptDocument(db, scope, { userId: viewerId }, {
      clientDraftId: 'api_governance_delete_001',
      fileName: 'draft.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
    });
    const deleted = await fetch(
      `${baseUrl}/api/documents/${draft.document.id}/actions/delete-draft`,
      {
        method: 'POST',
        headers: headers(viewer, 'delete-draft-owner'),
        body: '{}',
      },
    );
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toMatchObject({
      data: { id: draft.document.id, deleted: true },
    });

    const retained = await uploadReceiptDocument(db, scope, { userId: viewerId }, {
      clientDraftId: 'api_governance_purge_001',
      fileName: 'retained.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
      retentionUntil: new Date('2025-01-01T00:00:00.000Z'),
    });
    const submit = await fetch(
      `${baseUrl}/api/documents/${retained.document.id}/actions/submit`,
      {
        method: 'POST',
        headers: headers(admin, 'document-submit-once'),
        body: JSON.stringify({
          expectedVersion: 1,
          reason: 'Governance submitted the retained record.',
        }),
      },
    );
    expect(submit.status).toBe(200);
    const voided = await fetch(
      `${baseUrl}/api/documents/${retained.document.id}/actions/void`,
      {
        method: 'POST',
        headers: headers(viewer, 'document-void-once'),
        body: JSON.stringify({
          expectedVersion: 2,
          reason: 'Employee voided this retained record.',
        }),
      },
    );
    expect(voided.status).toBe(200);

    const initiated = await fetch(
      `${baseUrl}/api/documents/${retained.document.id}/actions/initiate-purge`,
      {
        method: 'POST',
        headers: headers(admin, 'document-purge-initiate'),
        body: JSON.stringify({
          expectedVersion: 3,
          reason: 'Retention expired and no legal hold applies.',
        }),
      },
    );
    expect(initiated.status).toBe(200);
    const initiatedBody = await initiated.json() as {
      data: { id: number; version: number };
    };
    const selfReview = await fetch(
      `${baseUrl}/api/documents/${retained.document.id}/actions/review-purge`,
      {
        method: 'POST',
        headers: headers(admin, 'document-purge-self-review'),
        body: JSON.stringify({
          requestId: initiatedBody.data.id,
          expectedVersion: initiatedBody.data.version,
          decision: 'approve',
          reason: 'This must be rejected as self review.',
        }),
      },
    );
    expect(selfReview.status).toBe(403);
    expect((await selfReview.json()).error.code)
      .toBe('document_purge_two_person_required');

    const reviewed = await fetch(
      `${baseUrl}/api/documents/${retained.document.id}/actions/review-purge`,
      {
        method: 'POST',
        headers: headers(viewer, 'document-purge-finance-review'),
        body: JSON.stringify({
          requestId: initiatedBody.data.id,
          expectedVersion: initiatedBody.data.version,
          decision: 'approve',
          reason: 'Finance independently verified purge eligibility.',
        }),
      },
    );
    expect(reviewed.status).toBe(200);
    const reviewedBody = await reviewed.json() as {
      data: { version: number };
    };
    const executed = await fetch(
      `${baseUrl}/api/documents/${retained.document.id}/actions/execute-purge`,
      {
        method: 'POST',
        headers: headers(admin, 'document-purge-execute'),
        body: JSON.stringify({
          requestId: initiatedBody.data.id,
          expectedVersion: reviewedBody.data.version,
        }),
      },
    );
    expect(executed.status).toBe(200);
    expect(await db.select().from(managedDocument)).toHaveLength(0);
    expect(await db.select().from(documentPurgeRequest)).toEqual([
      expect.objectContaining({
        status: 'executed',
        reviewedByUserId: viewerId,
      }),
    ]);
    expect(await db.select().from(documentTombstone)).toHaveLength(1);

    const tombstone = await fetch(
      `${baseUrl}/api/documents/purge-requests/${initiatedBody.data.id}/tombstone`,
      { headers: { cookie: admin.cookie } },
    );
    expect(tombstone.status).toBe(200);
    expect(await tombstone.json()).toMatchObject({
      data: {
        originalDocumentId: retained.document.id,
        finalSha256: retained.version.sha256,
      },
    });
  });

  it('fails closed before scan and audits every retry-stable sensitive content access', async () => {
    const viewer = await login('viewer');
    const admin = await login('admin');
    const stored = await uploadReceiptDocument(db, scope, { userId: viewerId }, {
      clientDraftId: 'api_sensitive_access_001',
      fileName: 'sensitive-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
    });
    const contentUrl = `${baseUrl}/api/documents/${stored.document.id}/content?action=download`;
    const accessHeaders = {
      cookie: viewer.cookie,
      'idempotency-key': 'viewer-download-proof-001',
      'x-document-access-purpose': 'Prepare employee expense evidence.',
    };
    const quarantined = await fetch(contentUrl, { headers: accessHeaders });
    expect(quarantined.status).toBe(423);
    expect((await quarantined.json()).error).toMatchObject({
      code: 'document_quarantined',
      fieldErrors: { action: 'preview', scanStatus: 'queued' },
    });
    expect(await db.select().from(documentAccessEvent)).toHaveLength(0);

    await db.update(documentScanJob).set({
      status: 'clean',
      scanner: 'api-proof',
      resultCode: 'clean',
      completedAt: new Date('2026-07-26T02:00:00.000Z'),
    }).where(eq(documentScanJob.versionId, stored.version.id));

    const downloaded = await fetch(contentUrl, { headers: accessHeaders });
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('content-type')).toContain('image/jpeg');
    expect(downloaded.headers.get('content-disposition')).toContain('attachment');
    expect(downloaded.headers.get('x-document-sha256')).toBe(stored.version.sha256);
    expect(downloaded.headers.get('x-document-version')).toBe('1');
    expect(downloaded.headers.get('x-document-access-replayed')).toBe('false');
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(jpeg);

    const replay = await fetch(contentUrl, { headers: accessHeaders });
    expect(replay.status).toBe(200);
    expect(replay.headers.get('x-document-access-replayed')).toBe('true');
    expect(await db.select().from(documentAccessEvent)).toEqual([
      expect.objectContaining({
        masterFn: scope.masterFn,
        companyFn: scope.companyFn,
        documentId: stored.document.id,
        versionId: stored.version.id,
        versionNo: 1,
        versionSha256: stored.version.sha256,
        actorUserId: viewerId,
        accessAction: 'download',
        accessPurpose: 'Prepare employee expense evidence.',
      }),
    ]);

    const managedView = await fetch(
      `${baseUrl}/api/documents/${stored.document.id}/content?action=view`,
      {
        headers: {
          cookie: admin.cookie,
          'idempotency-key': 'manager-view-proof-0001',
          'x-document-access-purpose': 'Finance evidence verification.',
        },
      },
    );
    expect(managedView.status).toBe(200);
    expect(managedView.headers.get('content-disposition')).toContain('inline');
    expect(await db.select().from(documentAccessEvent)).toHaveLength(2);

    const keyConflict = await fetch(
      `${baseUrl}/api/documents/${stored.document.id}/content?action=print`,
      { headers: accessHeaders },
    );
    expect(keyConflict.status).toBe(409);
    expect((await keyConflict.json()).error.code).toBe('document_access_key_conflict');
    expect(await db.select().from(documentAccessEvent)).toHaveLength(2);
  });

  it('exposes tenant-scoped dead-letter retry through an audited idempotent action', async () => {
    const viewer = await login('viewer');
    const admin = await login('admin');
    const stored = await uploadReceiptDocument(db, scope, { userId: viewerId }, {
      clientDraftId: 'api_processing_retry_001',
      fileName: 'retry-receipt.jpg',
      declaredMimeType: 'image/jpeg',
      content: jpeg,
    });
    const deadLetteredAt = new Date('2026-07-26T02:05:00.000Z');
    await db.update(documentScanJob).set({
      status: 'clean',
      scanner: 'api-retry-test',
      resultCode: 'clean',
      completedAt: deadLetteredAt,
    }).where(eq(documentScanJob.versionId, stored.version.id));
    await db.insert(documentExtraction).values({
      ...scope,
      versionId: stored.version.id,
      provider: 'byok_vision',
      model: 'vision-test',
      status: 'dead_letter',
      attempts: 5,
      availableAt: deadLetteredAt,
      deadLetteredAt,
      lastError: 'Document processing failed.',
    });
    await db.insert(outboxEvent).values({
      ...scope,
      topic: 'document.extraction.requested',
      aggregateType: 'document_version',
      aggregateId: String(stored.version.id),
      payload: { versionId: stored.version.id },
      availableAt: deadLetteredAt,
      attempts: 5,
      lastAttemptAt: deadLetteredAt,
      deadLetteredAt,
      lastError: 'Document processing failed.',
    });

    const denied = await fetch(
      `${baseUrl}/api/documents/${stored.document.id}/actions/retry-processing`,
      {
        method: 'POST',
        headers: headers(viewer, 'document-retry-denied'),
        body: JSON.stringify({ versionId: stored.version.id }),
      },
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe('permission_denied');

    const wrongVersion = await fetch(
      `${baseUrl}/api/documents/${stored.document.id}/actions/retry-processing`,
      {
        method: 'POST',
        headers: headers(admin, 'document-retry-wrong-version'),
        body: JSON.stringify({ versionId: stored.version.id + 9999 }),
      },
    );
    expect(wrongVersion.status).toBe(404);
    expect((await wrongVersion.json()).error.code).toBe('document_version_missing');

    const tampered = await fetch(
      `${baseUrl}/api/documents/${stored.document.id}/actions/retry-processing`,
      {
        method: 'POST',
        headers: headers(admin, 'document-retry-tenant-tamper'),
        body: JSON.stringify({ versionId: stored.version.id, companyFn: 'C-MY' }),
      },
    );
    expect(tampered.status).toBe(400);
    expect((await tampered.json()).error.code).toBe('tenant_override_rejected');

    const retried = await fetch(
      `${baseUrl}/api/documents/${stored.document.id}/actions/retry-processing`,
      {
        method: 'POST',
        headers: headers(admin, 'document-retry-once'),
        body: JSON.stringify({ versionId: stored.version.id }),
      },
    );
    expect(retried.status).toBe(200);
    expect(await retried.json()).toMatchObject({
      data: { scanRequeued: false, extractionRequeued: true },
    });
    const [requeued] = await db.select().from(documentExtraction);
    expect(requeued).toMatchObject({
      versionId: stored.version.id,
      status: 'queued',
      attempts: 0,
      deadLetteredAt: null,
    });
    const [signal] = await db.select().from(outboxEvent)
      .where(eq(outboxEvent.topic, 'document.extraction.requested'));
    expect(signal).toMatchObject({ deadLetteredAt: null });
    expect(await db.select().from(auditLog)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entity: 'documents',
        entityId: String(stored.document.id),
        action: 'retry-processing',
        actorUserId: expect.any(Number),
      }),
    ]));

    const replay = await fetch(
      `${baseUrl}/api/documents/${stored.document.id}/actions/retry-processing`,
      {
        method: 'POST',
        headers: headers(admin, 'document-retry-once'),
        body: JSON.stringify({ versionId: stored.version.id }),
      },
    );
    expect(replay.status).toBe(200);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    expect(await replay.json()).toMatchObject({
      data: { scanRequeued: false, extractionRequeued: true },
    });

    const conflict = await fetch(
      `${baseUrl}/api/documents/${stored.document.id}/actions/retry-processing`,
      {
        method: 'POST',
        headers: headers(admin, 'document-retry-once'),
        body: JSON.stringify({ versionId: stored.version.id + 1 }),
      },
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.code).toBe('idempotency_key_reused');
  });
});
