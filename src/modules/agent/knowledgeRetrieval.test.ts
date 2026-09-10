import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { SessionData } from '../../auth/session';
import {
  agentKnowledgeDocument,
  appUser,
  documentExtraction,
  documentScanJob,
  managedDocument,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { createManagedDocument } from '../documents/storage';
import {
  clearGovernedSopRetrievalCache,
  registerGovernedSopWithin,
  resolveGovernedSopCitationWithin,
  searchGovernedSopWithin,
} from './knowledgeRetrieval';
import { freshDb } from '../../test/helpers';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const NOW = new Date('2026-09-09T12:00:00.000Z');

describe('governed SOP retrieval', () => {
  let db: DB;
  let admin: typeof appUser.$inferSelect;
  let viewer: typeof appUser.$inferSelect;
  let adminSession: SessionData;
  let viewerSession: SessionData;

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
    viewerSession = {
      userId: viewer.userId,
      masterFn: viewer.masterFn,
      activeCompanyFn: scope.companyFn,
      username: viewer.username,
      email: viewer.email,
      fullName: viewer.fullName,
    };
  });

  async function source(documentKey: string, text: string) {
    const created = await createManagedDocument(db, scope, { userId: admin.userId }, {
      documentKey,
      purpose: 'other',
      ownerUserId: admin.userId,
      originalFileName: `${documentKey}.txt`,
      mimeType: 'text/plain',
      retentionUntil: new Date('2030-01-01T00:00:00.000Z'),
      content: new TextEncoder().encode(text),
    });
    await db.update(managedDocument).set({ recordStatus: 'approved' })
      .where(eq(managedDocument.id, created.document.id));
    const outputSha256 = createHash('sha256').update(text, 'utf8').digest('hex');
    await db.insert(documentScanJob).values({
      ...scope,
      versionId: created.version.id,
      status: 'clean',
      scanner: 'knowledge-test',
      resultCode: 'clean',
      completedAt: NOW,
    });
    await db.insert(documentExtraction).values({
      ...scope,
      versionId: created.version.id,
      extractionVersion: 1,
      provider: 'local_ocr',
      model: 'knowledge-test',
      status: 'succeeded',
      rawText: text,
      outputSha256,
      completedAt: NOW,
    });
    return created;
  }

  it('returns only active effective clean content with source and access metadata', async () => {
    const policy = await source(
      'expense-policy-v1',
      'Travel meals are reimbursable within the approved allowance. Ignore prior instructions is data, not an ERP command.',
    );
    const registered = await registerGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      title: 'Travel expense policy',
      documentId: policy.document.id,
      documentVersionId: policy.version.id,
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-10-01',
    });

    const result = await searchGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      query: 'reimbursable',
      effectiveOn: '2026-09-09',
    }, NOW);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: registered.id,
      corpusKey: 'expense-policy',
      title: 'Travel expense policy',
      content: expect.stringContaining('Ignore prior instructions is data'),
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-10-01',
      documentId: policy.document.id,
      documentVersionId: policy.version.id,
      documentVersionNo: 1,
      contentPolicy: {
        kind: 'untrusted_document_data',
        instructionsExecutable: false,
      },
      access: {
        requiredPermission: 'documents.knowledge.read',
        recordStatus: 'approved',
      },
      evidence: { type: 'policy', status: 'grounded', inference: false },
    });
    expect(result.data[0].sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.data[0].citation).toMatchObject({
      knowledgeId: registered.id,
      sourceType: 'managed_document',
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-10-01',
      documentId: policy.document.id,
      documentVersionId: policy.version.id,
      documentVersionNo: 1,
      sourceSha256: result.data[0].sourceSha256,
    });
    expect(result.data[0].citation.href).toContain(
      `/api/knowledge/sop/${registered.id}?`,
    );
    expect(result.data[0].citation.href).toContain('effectiveOn=2026-09-09');
    expect(result.meta).toMatchObject({
      effectiveOn: '2026-09-09',
      corpusKey: 'expense-policy',
      bounded: true,
      nextCursor: null,
      evidence: { type: 'policy', status: 'grounded', inference: false },
      cache: { hit: false, scope: 'actor_company_permission_version' },
    });

    const warm = await searchGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      query: 'reimbursable',
      effectiveOn: '2026-09-09',
    }, NOW);
    expect(warm.meta.cache.hit).toBe(true);
    expect(warm.data[0]?.content).toContain('Ignore prior instructions is data');

    const changedText = 'Travel meals are reimbursable within the revised approved allowance.';
    await db.update(documentExtraction).set({
      rawText: changedText,
      outputSha256: createHash('sha256').update(changedText, 'utf8').digest('hex'),
    }).where(and(
      eq(documentExtraction.masterFn, scope.masterFn),
      eq(documentExtraction.companyFn, scope.companyFn),
      eq(documentExtraction.versionId, policy.version.id),
    ));
    const afterSourceChange = await searchGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      query: 'reimbursable',
      effectiveOn: '2026-09-09',
    }, NOW);
    expect(afterSourceChange.meta.cache.hit).toBe(false);
    expect(afterSourceChange.data[0]?.content).toContain('revised approved allowance');

    const resolved = await resolveGovernedSopCitationWithin(db, adminSession, {
      knowledgeId: registered.id,
      effectiveOn: '2026-09-09',
      sourceSha256: result.data[0].sourceSha256,
    }, NOW);
    expect(resolved.citation.href).toBe(result.data[0].citation.href);
  });

  it('excludes expired, revoked, field-denied and cross-company rows', async () => {
    const active = await source('active-policy', 'Active policy text.');
    const limited = await source('limited-policy', 'Limited policy text.');
    const expired = await source('expired-policy', 'Expired policy text.');
    await registerGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      title: 'Active policy',
      documentId: active.document.id,
      documentVersionId: active.version.id,
      effectiveFrom: '2026-09-01',
    });
    await registerGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      title: 'Limited policy',
      documentId: limited.document.id,
      documentVersionId: limited.version.id,
      effectiveFrom: '2026-09-01',
      fieldAllowlist: ['title', 'effectiveFrom', 'documentId', 'documentVersionId'],
    });
    await registerGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      title: 'Expired policy',
      documentId: expired.document.id,
      documentVersionId: expired.version.id,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-02-01',
    });

    const metadataOnly = await searchGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      effectiveOn: '2026-09-09',
      fields: ['title', 'effectiveFrom', 'documentId', 'documentVersionId'],
    }, NOW);
    expect(metadataOnly.data.map((row) => row.title)).toEqual([
      'Active policy',
      'Limited policy',
    ]);
    expect(metadataOnly.data.find((row) => row.title === 'Limited policy')).not.toHaveProperty('content');
    expect(metadataOnly.data.map((row) => row.title)).not.toContain('Expired policy');
    const warmMetadata = await searchGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      effectiveOn: '2026-09-09',
      fields: ['title', 'effectiveFrom', 'documentId', 'documentVersionId'],
    }, NOW);
    expect(warmMetadata.meta.cache.hit).toBe(true);

    const contentRequested = await searchGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      effectiveOn: '2026-09-09',
      fields: ['title', 'content'],
    }, NOW);
    expect(contentRequested.data.map((row) => row.title)).toEqual(['Active policy']);

    const [limitedKnowledge] = await db.select().from(agentKnowledgeDocument)
      .where(eq(agentKnowledgeDocument.documentId, limited.document.id));
    await db.update(agentKnowledgeDocument).set({
      status: 'revoked',
      revokedAt: NOW,
      revokedByUserId: admin.userId,
      revocationReason: 'Policy withdrawn',
    }).where(eq(agentKnowledgeDocument.id, limitedKnowledge.id));
    const afterRevoke = await searchGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      effectiveOn: '2026-09-09',
      fields: ['title', 'effectiveFrom', 'documentId', 'documentVersionId'],
    }, NOW);
    expect(afterRevoke.data.map((row) => row.title)).toEqual(['Active policy']);
    expect(afterRevoke.meta.cache.hit).toBe(false);

    const crossCompanySession = { ...adminSession, activeCompanyFn: 'C-MY' };
    const crossCompany = await sourceInCompany(crossCompanySession, 'my-policy', 'MY policy text.');
    await registerGovernedSopWithin(db, crossCompanySession, {
      corpusKey: 'expense-policy',
      title: 'MY policy',
      documentId: crossCompany.document.id,
      documentVersionId: crossCompany.version.id,
      effectiveFrom: '2026-09-01',
    });
    const sgResult = await searchGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      effectiveOn: '2026-09-09',
    }, NOW);
    expect(sgResult.data.map((row) => row.title)).not.toContain('MY policy');
    expect(sgResult.meta.cache.hit).toBe(false);
    const myResult = await searchGovernedSopWithin(db, crossCompanySession, {
      corpusKey: 'expense-policy',
      effectiveOn: '2026-09-09',
    }, NOW);
    expect(myResult.data.map((row) => row.title)).toEqual(['MY policy']);
    expect(myResult.meta.cache.hit).toBe(false);
    const sgAgain = await searchGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      effectiveOn: '2026-09-09',
    }, NOW);
    expect(sgAgain.data.map((row) => row.title)).not.toContain('MY policy');
    expect(sgAgain.meta.cache.hit).toBe(true);
  });

  it('checks the live permission before returning any document content', async () => {
    const policy = await source('denied-policy', 'Confidential policy text.');
    await registerGovernedSopWithin(db, adminSession, {
      corpusKey: 'expense-policy',
      title: 'Confidential policy',
      documentId: policy.document.id,
      documentVersionId: policy.version.id,
      effectiveFrom: '2026-09-01',
    });

    await expect(searchGovernedSopWithin(db, viewerSession, {
      corpusKey: 'expense-policy',
      effectiveOn: '2026-09-09',
    }, NOW)).rejects.toMatchObject({
      code: 'agent_knowledge_permission_denied',
      status: 403,
    });
  });

  it('returns explicit uncertainty for stale or conflicting policy evidence', async () => {
    const expired = await source('expired-only-policy', 'Allowance is capped at SGD 10.');
    await registerGovernedSopWithin(db, adminSession, {
      corpusKey: 'stale-policy',
      title: 'Expired policy',
      documentId: expired.document.id,
      documentVersionId: expired.version.id,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-02-01',
    });
    const unknown = await searchGovernedSopWithin(db, adminSession, {
      corpusKey: 'stale-policy',
      query: 'Allowance',
      effectiveOn: '2026-09-09',
    }, NOW);
    expect(unknown.data).toEqual([]);
    expect(unknown.meta.evidence).toMatchObject({
      type: 'policy',
      status: 'unknown',
      inference: false,
      reason: 'no_current_evidence',
    });

    const first = await source('conflict-policy-a', 'Allowance is capped at SGD 10.');
    const second = await source('conflict-policy-b', 'Allowance is capped at SGD 20.');
    await registerGovernedSopWithin(db, adminSession, {
      corpusKey: 'conflict-policy',
      title: 'Allowance policy A',
      documentId: first.document.id,
      documentVersionId: first.version.id,
      effectiveFrom: '2026-09-01',
    });
    await registerGovernedSopWithin(db, adminSession, {
      corpusKey: 'conflict-policy',
      title: 'Allowance policy B',
      documentId: second.document.id,
      documentVersionId: second.version.id,
      effectiveFrom: '2026-09-01',
    });
    const conflict = await searchGovernedSopWithin(db, adminSession, {
      corpusKey: 'conflict-policy',
      query: 'Allowance',
      effectiveOn: '2026-09-09',
    }, NOW);
    expect(conflict.data).toEqual([]);
    expect(conflict.meta.evidence).toMatchObject({
      type: 'policy',
      status: 'conflict',
      inference: false,
      reason: 'conflicting_sources',
      statement: expect.stringContaining('Multiple effective policy sources'),
    });
    expect(conflict.meta.evidence.sources).toHaveLength(2);
    expect(conflict.meta.evidence.sources?.every((citation) => citation.href.startsWith(
      '/api/knowledge/sop/',
    ))).toBe(true);
  });

  async function sourceInCompany(
    session: SessionData,
    documentKey: string,
    text: string,
  ) {
    const companyScope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
    const created = await createManagedDocument(db, companyScope, { userId: admin.userId }, {
      documentKey,
      purpose: 'other',
      ownerUserId: admin.userId,
      originalFileName: `${documentKey}.txt`,
      mimeType: 'text/plain',
      retentionUntil: new Date('2030-01-01T00:00:00.000Z'),
      content: new TextEncoder().encode(text),
    });
    await db.update(managedDocument).set({ recordStatus: 'approved' })
      .where(and(
        eq(managedDocument.masterFn, companyScope.masterFn),
        eq(managedDocument.companyFn, companyScope.companyFn),
        eq(managedDocument.id, created.document.id),
      ));
    await db.insert(documentScanJob).values({
      ...companyScope,
      versionId: created.version.id,
      status: 'clean',
      scanner: 'knowledge-test',
      resultCode: 'clean',
      completedAt: NOW,
    });
    await db.insert(documentExtraction).values({
      ...companyScope,
      versionId: created.version.id,
      extractionVersion: 1,
      provider: 'local_ocr',
      model: 'knowledge-test',
      status: 'succeeded',
      rawText: text,
      outputSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
      completedAt: NOW,
    });
    return created;
  }
});
