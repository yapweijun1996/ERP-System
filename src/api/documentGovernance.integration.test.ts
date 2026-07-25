import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../data/db';
import {
  appUser,
  documentPurgeRequest,
  documentTombstone,
  managedDocument,
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
});
