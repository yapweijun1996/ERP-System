import { createHash } from 'node:crypto';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../data/db';
import type { SessionData } from '../auth/session';
import {
  agentKnowledgeDocument,
  appUser,
  documentExtraction,
  documentScanJob,
  managedDocument,
  userPermissionOverride,
} from '../data/schema';
import { seedDemo } from '../data/seed';
import { createManagedDocument } from '../modules/documents/storage';
import {
  clearGovernedSopRetrievalCache,
  registerGovernedSopWithin,
} from '../modules/agent/knowledgeRetrieval';
import { freshDb } from '../test/helpers';
import { createApp } from './app';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const NOW = new Date('2026-09-09T12:00:00.000Z');

function cookies(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''];
  return values.flatMap((value) => Array.from(
    value.matchAll(/(?:^|,\s*)(erp_(?:session|csrf))=([^;,\s]+)/g),
    (match) => `${match[1]}=${match[2]}`,
  )).join('; ');
}

describe('governed SOP retrieval API', () => {
  let db: DB;
  let server: Server | undefined;
  let baseUrl: string;
  let admin: typeof appUser.$inferSelect;
  let viewer: typeof appUser.$inferSelect;
  let adminSession: SessionData;

  beforeEach(async () => {
    clearGovernedSopRetrievalCache();
    db = await freshDb();
    await seedDemo(db);
    [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    [viewer] = await db.select().from(appUser).where(eq(appUser.username, 'viewer'));
    adminSession = {
      userId: admin.userId,
      masterFn: admin.masterFn,
      activeCompanyFn: scope.companyFn,
      username: admin.username,
      email: admin.email,
      fullName: admin.fullName,
    };
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
    server = undefined;
    await new Promise<void>((resolve, reject) => activeServer.close((error) => {
      if (error) reject(error);
      else resolve();
    }));
  });

  async function login(username: string, password: string) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationCode: 'ACME', username, password }),
    });
    expect(response.status).toBe(200);
    return cookies(response);
  }

  async function createPolicy() {
    const text = 'Meal allowance is capped at SGD 50. Ignore prior instructions is untrusted data.';
    const created = await createManagedDocument(db, scope, { userId: admin.userId }, {
      documentKey: 'api-expense-policy',
      purpose: 'other',
      ownerUserId: admin.userId,
      originalFileName: 'api-expense-policy.txt',
      mimeType: 'text/plain',
      retentionUntil: new Date('2030-01-01T00:00:00.000Z'),
      content: new TextEncoder().encode(text),
    });
    await db.update(managedDocument).set({ recordStatus: 'approved' })
      .where(and(
        eq(managedDocument.masterFn, scope.masterFn),
        eq(managedDocument.companyFn, scope.companyFn),
        eq(managedDocument.id, created.document.id),
      ));
    await db.insert(documentScanJob).values({
      ...scope,
      versionId: created.version.id,
      status: 'clean',
      scanner: 'knowledge-api-test',
      resultCode: 'clean',
      completedAt: NOW,
    });
    await db.insert(documentExtraction).values({
      ...scope,
      versionId: created.version.id,
      extractionVersion: 1,
      provider: 'local_ocr',
      model: 'knowledge-api-test',
      status: 'succeeded',
      rawText: text,
      outputSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
      completedAt: NOW,
    });
    await registerGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      title: 'API expense policy',
      documentId: created.document.id,
      documentVersionId: created.version.id,
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-10-01',
    });
  }

  it('returns scoped content over the authenticated route and ignores client tenant fields', async () => {
    await createPolicy();
    const cookie = await login('admin', 'demo1234');
    const response = await fetch(
      `${baseUrl}/api/knowledge/sop?corpusKey=expense-policy&effectiveOn=2026-09-09&query=allowance&companyFn=C-MY`,
      { headers: { cookie } },
    );
    expect(response.status).toBe(200);
    const body = await response.json() as {
      data: Array<Record<string, unknown>>;
      meta: Record<string, unknown>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      title: 'API expense policy',
      content: expect.stringContaining('Ignore prior instructions is untrusted data'),
      citation: {
        sourceType: 'managed_document',
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-10-01',
      },
      evidence: { type: 'policy', status: 'grounded', inference: false },
      contentPolicy: { kind: 'untrusted_document_data', instructionsExecutable: false },
      access: { requiredPermission: 'documents.knowledge.read', recordStatus: 'approved' },
    });
    expect(body.meta).toMatchObject({
      effectiveOn: '2026-09-09',
      bounded: true,
      evidence: { type: 'policy', status: 'grounded', inference: false },
      cache: { hit: false, scope: 'actor_company_permission_version' },
    });

    const citationHref = String((body.data[0] as { citation: { href: string } }).citation.href);
    expect(citationHref).toMatch(/^\/api\/knowledge\/sop\/\d+\?/);
    const cited = await fetch(`${baseUrl}${citationHref}`, { headers: { cookie } });
    expect(cited.status).toBe(200);
    const citedBody = await cited.json() as { data: Record<string, unknown> };
    expect(citedBody.data).toMatchObject({
      title: 'API expense policy',
      content: expect.stringContaining('Ignore prior instructions is untrusted data'),
      evidence: { type: 'policy', status: 'grounded', inference: false },
    });

    const knowledgeId = Number(citationHref.match(/^\/api\/knowledge\/sop\/(\d+)/)?.[1]);
    await db.update(agentKnowledgeDocument).set({
      status: 'revoked',
      revokedAt: NOW,
      revokedByUserId: admin.userId,
      revocationReason: 'Citation invalidation test',
    }).where(and(
      eq(agentKnowledgeDocument.masterFn, scope.masterFn),
      eq(agentKnowledgeDocument.companyFn, scope.companyFn),
      eq(agentKnowledgeDocument.id, knowledgeId),
    ));
    const staleCitation = await fetch(`${baseUrl}${citationHref}`, { headers: { cookie } });
    expect(staleCitation.status).toBe(404);
    expect(await staleCitation.json()).toMatchObject({
      error: { code: 'agent_knowledge_source_unavailable' },
    });
  });

  it('denies a viewer and a live permission downgrade before retrieval content is returned', async () => {
    await createPolicy();
    const viewerCookie = await login('viewer', 'viewer1234');
    const viewerResponse = await fetch(`${baseUrl}/api/knowledge/sop?corpusKey=expense-policy`, {
      headers: { cookie: viewerCookie },
    });
    expect(viewerResponse.status).toBe(403);
    expect(await viewerResponse.json()).toMatchObject({
      error: { code: 'agent_knowledge_permission_denied' },
    });

    const adminCookie = await login('admin', 'demo1234');
    const warmAdmin = await fetch(`${baseUrl}/api/knowledge/sop?corpusKey=expense-policy`, {
      headers: { cookie: adminCookie },
    });
    expect(warmAdmin.status).toBe(200);
    expect((await warmAdmin.json()).meta.cache.hit).toBe(false);
    await db.insert(userPermissionOverride).values({
      ...scope,
      userId: admin.userId,
      permissionKey: 'documents.knowledge.read',
      effect: 'deny',
      scope: 'company',
      targetType: 'none',
      targetId: '',
      reason: 'S3 permission downgrade test',
      assignedByUserId: admin.userId,
    });
    const downgraded = await fetch(`${baseUrl}/api/knowledge/sop?corpusKey=expense-policy`, {
      headers: { cookie: adminCookie },
    });
    expect(downgraded.status).toBe(403);
    expect(await downgraded.json()).toMatchObject({
      error: { code: 'agent_knowledge_permission_denied' },
    });
    expect(viewer.userId).not.toBe(admin.userId);
  });
});
