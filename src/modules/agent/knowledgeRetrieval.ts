import { createHash } from 'node:crypto';
import {
  and,
  asc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lte,
  or,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import type { SessionData } from '../../auth/session';
import { hasPermission, PERMISSIONS } from '../../auth/permissions';
import { getAuthorizationVersionWithin } from '../../auth/authorizationVersion';
import {
  agentKnowledgeDocument,
  documentExtraction,
  documentScanJob,
  documentVersion,
  managedDocument,
} from '../../data/schema';
import {
  AGENT_KNOWLEDGE_FIELDS,
  type AgentKnowledgeField,
} from '../../data/schema/agent';

const SOP_MAX_RESULTS = 20;
const SOP_MAX_CONTENT_CHARS = 4_000;
const SOP_RETRIEVAL_CACHE_TTL_MS = 60_000;
const SOP_RETRIEVAL_CACHE_MAX_ENTRIES = 128;
const SOP_DOCUMENT_RECORD_STATUSES = ['approved', 'posted', 'sealed', 'corrected'] as const;

export type KnowledgeEvidenceStatus = 'grounded' | 'unknown' | 'conflict';

export interface GovernedSopCitation {
  href: string;
  knowledgeId: number;
  sourceType: 'managed_document';
  asOf: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  documentId?: number;
  documentVersionId?: number;
  documentVersionNo?: number;
  sourceSha256?: string;
}

export interface GovernedSopEvidence {
  type: 'policy';
  status: KnowledgeEvidenceStatus;
  inference: false;
  reason?: 'no_current_evidence' | 'requested_fields_not_allowed' | 'conflicting_sources';
  statement: string;
  sources?: GovernedSopCitation[];
}

interface GovernedSopCacheMeta {
  hit: boolean;
  scope: 'actor_company_permission_version';
  invalidation: 'authorization_version_or_source_fingerprint';
}

export interface RegisterGovernedSopInput {
  corpusKey: string;
  title: string;
  documentId: number;
  documentVersionId: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  fieldAllowlist?: readonly string[];
}

export interface GovernedSopSearchInput {
  corpusKey?: string;
  query?: string;
  effectiveOn?: string;
  limit?: number;
  afterId?: number;
  knowledgeId?: number;
  fields?: readonly string[];
}

export interface GovernedSopSearchResult {
  data: Array<{
    id: number;
    corpusKey: string;
    title: string;
    content?: string;
    citation: GovernedSopCitation;
    evidence: {
      type: 'policy';
      status: 'grounded';
      inference: false;
    };
    effectiveFrom?: string;
    effectiveTo?: string | null;
    documentId?: number;
    documentVersionId?: number;
    documentVersionNo?: number;
    sourceSha256?: string;
    contentPolicy: {
      kind: 'untrusted_document_data';
      instructionsExecutable: false;
    };
    access: {
      requiredPermission: string;
      fields: AgentKnowledgeField[];
      recordStatus: string;
    };
  }>;
  meta: {
    asOf: string;
    effectiveOn: string;
    corpusKey: string | null;
    query: string;
    evidence: GovernedSopEvidence;
    cache: GovernedSopCacheMeta;
    fields: AgentKnowledgeField[];
    limit: number;
    nextCursor: number | null;
    bounded: true;
  };
}

export type KnowledgeRetrievalErrorCode =
  | 'agent_knowledge_permission_denied'
  | 'agent_knowledge_input_invalid'
  | 'agent_knowledge_source_unavailable'
  | 'agent_knowledge_field_denied';

export class KnowledgeRetrievalError extends Error {
  constructor(
    public readonly code: KnowledgeRetrievalErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'KnowledgeRetrievalError';
  }
}

function validDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      `${label} must be an ISO date.`,
      422,
    );
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      `${label} must be a real calendar date.`,
      422,
    );
  }
  return value;
}

function corpusKey(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';
  if (!normalized) return null;
  if (!/^[a-z][a-z0-9._-]{2,63}$/.test(normalized)) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      'SOP corpus key is invalid.',
      422,
    );
  }
  return normalized;
}

function title(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      'SOP title must contain 1–160 characters.',
      422,
    );
  }
  return normalized;
}

function fields(value: readonly string[] | undefined): AgentKnowledgeField[] {
  const selected = value == null ? [...AGENT_KNOWLEDGE_FIELDS] : [...value];
  if (!selected.length || new Set(selected).size !== selected.length) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      'At least one distinct SOP field is required.',
      422,
    );
  }
  const unknown = selected.find((field) => !AGENT_KNOWLEDGE_FIELDS.includes(
    field as AgentKnowledgeField,
  ));
  if (unknown) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      `SOP field '${unknown}' is not supported.`,
      422,
    );
  }
  return selected as AgentKnowledgeField[];
}

function boundedLimit(value: number | undefined): number {
  const limit = value ?? 10;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > SOP_MAX_RESULTS) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      `SOP result limit must be between 1 and ${SOP_MAX_RESULTS}.`,
      422,
    );
  }
  return limit;
}

function positiveId(value: number | undefined, label: string): number | undefined {
  if (value == null) return undefined;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      `${label} must be a positive integer.`,
      422,
    );
  }
  return value;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function scopeOf(session: SessionData) {
  return { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
}

type GovernedSopRow = {
  knowledge: typeof agentKnowledgeDocument.$inferSelect;
  versionNo: number;
  sourceSha256: string;
  recordStatus: string;
  recordVersion: number;
  rawText: string | null;
  outputSha256: string | null;
  scanStatus: string;
  extractionStatus: string;
};

interface GovernedSopCacheEntry {
  sourceFingerprint: string;
  result: GovernedSopSearchResult;
  expiresAt: number;
}

const governedSopCache = new Map<string, GovernedSopCacheEntry>();

/** Clear only the bounded in-process retrieval cache; intended for test isolation. */
export function clearGovernedSopRetrievalCache(): void {
  governedSopCache.clear();
}

function cloneSearchResult(result: GovernedSopSearchResult): GovernedSopSearchResult {
  return JSON.parse(JSON.stringify(result)) as GovernedSopSearchResult;
}

function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function sourceFingerprint(rows: readonly GovernedSopRow[]): string {
  const state = rows.map((row) => ({
    knowledgeId: row.knowledge.id,
    knowledgeVersion: row.knowledge.version,
    knowledgeStatus: row.knowledge.status,
    fieldAllowlist: row.knowledge.fieldAllowlist,
    effectiveFrom: row.knowledge.effectiveFrom,
    effectiveTo: row.knowledge.effectiveTo,
    documentId: row.knowledge.documentId,
    documentVersionId: row.knowledge.documentVersionId,
    documentVersionNo: row.versionNo,
    sourceSha256: row.sourceSha256,
    extractionSha256: row.outputSha256 ?? (row.rawText == null ? null : contentHash(row.rawText)),
    recordStatus: row.recordStatus,
    recordVersion: row.recordVersion,
    scanStatus: row.scanStatus,
    extractionStatus: row.extractionStatus,
  }));
  return contentHash(JSON.stringify(state));
}

function cacheKey(
  session: SessionData,
  authorizationVersion: number,
  input: {
    corpus: string | null;
    query: string;
    effectiveOn: string;
    limit: number;
    afterId?: number;
    knowledgeId?: number;
    fields: readonly AgentKnowledgeField[];
  },
): string {
  return JSON.stringify({
    actorUserId: session.userId,
    masterFn: session.masterFn,
    companyFn: session.activeCompanyFn,
    authorizationVersion,
    ...input,
  });
}

function pruneGovernedSopCache(nowMs: number): void {
  for (const [key, entry] of governedSopCache) {
    if (entry.expiresAt <= nowMs) governedSopCache.delete(key);
  }
  while (governedSopCache.size > SOP_RETRIEVAL_CACHE_MAX_ENTRIES) {
    const oldest = governedSopCache.keys().next().value;
    if (oldest == null) break;
    governedSopCache.delete(oldest);
  }
}

function cachedSearchResult(
  key: string,
  fingerprint: string,
  nowMs: number,
): GovernedSopSearchResult | null {
  pruneGovernedSopCache(nowMs);
  const entry = governedSopCache.get(key);
  if (!entry) return null;
  if (entry.sourceFingerprint !== fingerprint) {
    governedSopCache.delete(key);
    return null;
  }
  const result = cloneSearchResult(entry.result);
  const asOf = new Date(nowMs).toISOString();
  result.meta.asOf = asOf;
  for (const item of result.data) item.citation.asOf = asOf;
  for (const citation of result.meta.evidence.sources ?? []) citation.asOf = asOf;
  result.meta.cache = {
    hit: true,
    scope: 'actor_company_permission_version',
    invalidation: 'authorization_version_or_source_fingerprint',
  };
  return result;
}

function storeCachedSearchResult(
  key: string,
  fingerprint: string,
  result: GovernedSopSearchResult,
  nowMs: number,
): void {
  pruneGovernedSopCache(nowMs);
  governedSopCache.delete(key);
  governedSopCache.set(key, {
    sourceFingerprint: fingerprint,
    result: cloneSearchResult(result),
    expiresAt: nowMs + SOP_RETRIEVAL_CACHE_TTL_MS,
  });
  pruneGovernedSopCache(nowMs);
}

function assertAllowedFields(
  requested: readonly AgentKnowledgeField[],
  stored: readonly string[],
): AgentKnowledgeField[] | null {
  const allowed = new Set(stored);
  if (!requested.every((field) => allowed.has(field))) return null;
  return [...requested];
}

function assertRegistrationFields(value: readonly string[] | undefined): AgentKnowledgeField[] {
  const selected = fields(value);
  if (!selected.includes('title') || !selected.includes('effectiveFrom')
    || !selected.includes('documentId') || !selected.includes('documentVersionId')) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      'SOP registration must retain title, effective date and source identity fields.',
      422,
    );
  }
  return selected;
}

/**
 * Register one already governed, scanned and extracted document version in the
 * bounded SOP corpus. Registration is metadata-only; document content remains
 * in the managed-document and extraction ownership boundary.
 */
export async function registerGovernedSopWithin(
  db: DB,
  session: SessionData,
  input: RegisterGovernedSopInput,
) {
  const corpus = corpusKey(input.corpusKey);
  if (!corpus) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      'SOP corpus key is required.',
      422,
    );
  }
  const normalizedTitle = title(input.title);
  const documentId = positiveId(input.documentId, 'Document id');
  const documentVersionId = positiveId(input.documentVersionId, 'Document version id');
  const effectiveFrom = validDate(input.effectiveFrom, 'effectiveFrom');
  const effectiveTo = input.effectiveTo == null
    ? null
    : validDate(input.effectiveTo, 'effectiveTo');
  if (effectiveTo != null && effectiveTo <= effectiveFrom) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      'effectiveTo must be after effectiveFrom.',
      422,
    );
  }
  const fieldAllowlist = assertRegistrationFields(input.fieldAllowlist);
  const scope = scopeOf(session);
  if (!await hasPermission(db, session, PERMISSIONS.documentsGovernanceManage)) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_permission_denied',
      'SOP registration requires document governance permission.',
      403,
    );
  }
  return withTenantTransaction(db, scope, async (tx) => {
    const [document] = await tx.select({
      id: managedDocument.id,
      purpose: managedDocument.purpose,
      recordStatus: managedDocument.recordStatus,
      currentVersionNo: managedDocument.currentVersionNo,
    }).from(managedDocument).where(and(
      eq(managedDocument.masterFn, scope.masterFn),
      eq(managedDocument.companyFn, scope.companyFn),
      eq(managedDocument.id, documentId!),
    )).limit(1);
    const [version] = await tx.select({
      id: documentVersion.id,
      documentId: documentVersion.documentId,
      versionNo: documentVersion.versionNo,
    }).from(documentVersion).where(and(
      eq(documentVersion.masterFn, scope.masterFn),
      eq(documentVersion.companyFn, scope.companyFn),
      eq(documentVersion.id, documentVersionId!),
      eq(documentVersion.documentId, documentId!),
    )).limit(1);
    if (!document || !version || document.purpose !== 'other'
      || document.currentVersionNo !== version.versionNo
      || !SOP_DOCUMENT_RECORD_STATUSES.includes(
        document.recordStatus as typeof SOP_DOCUMENT_RECORD_STATUSES[number],
      )) {
      throw new KnowledgeRetrievalError(
        'agent_knowledge_source_unavailable',
        'The SOP source must be the current version of an approved governed document.',
        409,
      );
    }
    const [scan] = await tx.select({ status: documentScanJob.status })
      .from(documentScanJob).where(and(
        eq(documentScanJob.masterFn, scope.masterFn),
        eq(documentScanJob.companyFn, scope.companyFn),
        eq(documentScanJob.versionId, version.id),
      )).limit(1);
    const [extraction] = await tx.select({
      status: documentExtraction.status,
      rawText: documentExtraction.rawText,
    }).from(documentExtraction).where(and(
      eq(documentExtraction.masterFn, scope.masterFn),
      eq(documentExtraction.companyFn, scope.companyFn),
      eq(documentExtraction.versionId, version.id),
      eq(documentExtraction.extractionVersion, 1),
    )).limit(1);
    if (scan?.status !== 'clean' || extraction?.status !== 'succeeded'
      || !extraction.rawText?.trim()) {
      throw new KnowledgeRetrievalError(
        'agent_knowledge_source_unavailable',
        'The SOP source must have a clean scan and successful extraction.',
        409,
      );
    }
    const [registered] = await tx.insert(agentKnowledgeDocument).values({
      ...scope,
      corpusKey: corpus,
      title: normalizedTitle,
      documentId: document.id,
      documentVersionId: version.id,
      effectiveFrom,
      effectiveTo,
      requiredPermission: PERMISSIONS.documentsKnowledgeRead,
      fieldAllowlist,
      createdByUserId: session.userId,
    }).returning();
    return registered;
  });
}

function citationForRow(
  row: GovernedSopRow,
  asOf: string,
  effectiveOn: string,
  allowedFields: readonly AgentKnowledgeField[],
): GovernedSopCitation {
  const params = new URLSearchParams({
    effectiveOn,
    sourceSha256: row.sourceSha256,
  });
  const allowed = new Set(allowedFields);
  const citation: GovernedSopCitation = {
    href: `/api/knowledge/sop/${row.knowledge.id}?${params.toString()}`,
    knowledgeId: row.knowledge.id,
    sourceType: 'managed_document',
    asOf,
  };
  if (allowed.has('effectiveFrom')) citation.effectiveFrom = row.knowledge.effectiveFrom;
  if (allowed.has('effectiveTo')) citation.effectiveTo = row.knowledge.effectiveTo;
  if (allowed.has('documentId')) citation.documentId = row.knowledge.documentId;
  if (allowed.has('documentVersionId')) citation.documentVersionId = row.knowledge.documentVersionId;
  if (allowed.has('documentVersionNo')) citation.documentVersionNo = row.versionNo;
  if (allowed.has('sourceSha256')) citation.sourceSha256 = row.sourceSha256;
  return citation;
}

function policyContentHash(row: GovernedSopRow): string {
  return row.outputSha256 ?? (row.rawText == null ? row.sourceSha256 : contentHash(row.rawText));
}

function conflictingRows(rows: readonly GovernedSopRow[], query: string): GovernedSopRow[] {
  if (!query || rows.length < 2) return [];
  const conflicts = new Map<number, GovernedSopRow>();
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    const left = rows[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const right = rows[rightIndex];
      if (!right || policyContentHash(left) === policyContentHash(right)) continue;
      const leftEndsAfterRightStarts = left.knowledge.effectiveTo == null
        || right.knowledge.effectiveFrom < left.knowledge.effectiveTo;
      const rightEndsAfterLeftStarts = right.knowledge.effectiveTo == null
        || left.knowledge.effectiveFrom < right.knowledge.effectiveTo;
      if (leftEndsAfterRightStarts && rightEndsAfterLeftStarts) {
        conflicts.set(left.knowledge.id, left);
        conflicts.set(right.knowledge.id, right);
      }
    }
  }
  return [...conflicts.values()].sort((left, right) => left.knowledge.id - right.knowledge.id);
}

async function loadGovernedSopRows(
  tx: DB,
  scope: ReturnType<typeof scopeOf>,
  input: {
    corpus: string | null;
    query: string;
    effectiveOn: string;
    limit: number;
    now: Date;
    afterId?: number;
    knowledgeId?: number;
  },
): Promise<GovernedSopRow[]> {
  const conditions = [
    eq(agentKnowledgeDocument.masterFn, scope.masterFn),
    eq(agentKnowledgeDocument.companyFn, scope.companyFn),
    eq(agentKnowledgeDocument.status, 'active'),
    eq(agentKnowledgeDocument.requiredPermission, PERMISSIONS.documentsKnowledgeRead),
    input.corpus ? eq(agentKnowledgeDocument.corpusKey, input.corpus) : undefined,
    input.knowledgeId == null ? undefined : eq(agentKnowledgeDocument.id, input.knowledgeId),
    input.afterId == null ? undefined : gt(agentKnowledgeDocument.id, input.afterId),
    lte(agentKnowledgeDocument.effectiveFrom, input.effectiveOn),
    or(isNull(agentKnowledgeDocument.effectiveTo), gt(agentKnowledgeDocument.effectiveTo, input.effectiveOn)),
    eq(managedDocument.masterFn, scope.masterFn),
    eq(managedDocument.companyFn, scope.companyFn),
    eq(managedDocument.id, agentKnowledgeDocument.documentId),
    eq(managedDocument.purpose, 'other'),
    inArray(managedDocument.recordStatus, [...SOP_DOCUMENT_RECORD_STATUSES]),
    gt(managedDocument.retentionUntil, input.now),
    eq(managedDocument.currentVersionNo, documentVersion.versionNo),
    eq(documentVersion.masterFn, scope.masterFn),
    eq(documentVersion.companyFn, scope.companyFn),
    eq(documentVersion.id, agentKnowledgeDocument.documentVersionId),
    eq(documentVersion.documentId, managedDocument.id),
    eq(documentScanJob.masterFn, scope.masterFn),
    eq(documentScanJob.companyFn, scope.companyFn),
    eq(documentScanJob.versionId, documentVersion.id),
    eq(documentScanJob.status, 'clean'),
    eq(documentExtraction.masterFn, scope.masterFn),
    eq(documentExtraction.companyFn, scope.companyFn),
    eq(documentExtraction.versionId, documentVersion.id),
    eq(documentExtraction.extractionVersion, 1),
    eq(documentExtraction.status, 'succeeded'),
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
  const escapedQuery = escapeLike(input.query);
  if (escapedQuery) {
    const textCondition = or(
      ilike(agentKnowledgeDocument.title, `%${escapedQuery}%`),
      ilike(managedDocument.originalFileName, `%${escapedQuery}%`),
      ilike(documentExtraction.rawText, `%${escapedQuery}%`),
    );
    if (textCondition) conditions.push(textCondition);
  }
  return tx.select({
    knowledge: agentKnowledgeDocument,
    versionNo: documentVersion.versionNo,
    sourceSha256: documentVersion.sha256,
    recordStatus: managedDocument.recordStatus,
    recordVersion: managedDocument.recordVersion,
    rawText: documentExtraction.rawText,
    outputSha256: documentExtraction.outputSha256,
    scanStatus: documentScanJob.status,
    extractionStatus: documentExtraction.status,
  }).from(agentKnowledgeDocument)
    .innerJoin(managedDocument, and(
      eq(managedDocument.masterFn, agentKnowledgeDocument.masterFn),
      eq(managedDocument.companyFn, agentKnowledgeDocument.companyFn),
      eq(managedDocument.id, agentKnowledgeDocument.documentId),
    ))
    .innerJoin(documentVersion, and(
      eq(documentVersion.masterFn, agentKnowledgeDocument.masterFn),
      eq(documentVersion.companyFn, agentKnowledgeDocument.companyFn),
      eq(documentVersion.id, agentKnowledgeDocument.documentVersionId),
      eq(documentVersion.documentId, managedDocument.id),
    ))
    .innerJoin(documentScanJob, and(
      eq(documentScanJob.masterFn, agentKnowledgeDocument.masterFn),
      eq(documentScanJob.companyFn, agentKnowledgeDocument.companyFn),
      eq(documentScanJob.versionId, documentVersion.id),
    ))
    .innerJoin(documentExtraction, and(
      eq(documentExtraction.masterFn, agentKnowledgeDocument.masterFn),
      eq(documentExtraction.companyFn, agentKnowledgeDocument.companyFn),
      eq(documentExtraction.versionId, documentVersion.id),
      eq(documentExtraction.extractionVersion, 1),
    ))
    .where(and(...conditions))
    .orderBy(asc(agentKnowledgeDocument.id))
    .limit(input.limit + 1) as unknown as Promise<GovernedSopRow[]>;
}

/**
 * Retrieve only active, effective, clean and successfully extracted SOP rows.
 * The permission check runs inside the tenant transaction before the query that
 * selects extraction text; the result projection never evaluates document text
 * as instructions and labels it as untrusted document data.
 */
export async function searchGovernedSopWithin(
  db: DB,
  session: SessionData,
  input: GovernedSopSearchInput = {},
  now = new Date(),
): Promise<GovernedSopSearchResult> {
  const corpus = corpusKey(input.corpusKey);
  const query = input.query?.trim() ?? '';
  if (query.length > 200) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      'SOP search text must be at most 200 characters.',
      422,
    );
  }
  const effectiveOn = validDate(
    input.effectiveOn ?? now.toISOString().slice(0, 10),
    'effectiveOn',
  );
  const limit = boundedLimit(input.limit);
  const afterId = positiveId(input.afterId, 'SOP cursor');
  const knowledgeId = positiveId(input.knowledgeId, 'Knowledge document id');
  const requestedFields = fields(input.fields);
  const scope = scopeOf(session);
  const asOf = now.toISOString();

  return withTenantTransaction(db, scope, async (tx) => {
    if (!await hasPermission(tx, session, PERMISSIONS.documentsKnowledgeRead, now)) {
      throw new KnowledgeRetrievalError(
        'agent_knowledge_permission_denied',
        'SOP retrieval permission is required.',
        403,
      );
    }
    const authorizationVersion = await getAuthorizationVersionWithin(tx, scope);
    const rows = await loadGovernedSopRows(tx, scope, {
      corpus,
      query,
      effectiveOn,
      limit,
      now,
      afterId,
      knowledgeId,
    });
    const fingerprint = sourceFingerprint(rows);
    const key = cacheKey(session, authorizationVersion, {
      corpus,
      query,
      effectiveOn,
      limit,
      afterId,
      knowledgeId,
      fields: requestedFields,
    });
    const cached = cachedSearchResult(key, fingerprint, now.getTime());
    if (cached) return cached;

    const page = rows.slice(0, limit);
    const conflictRows = conflictingRows(rows, query);
    const cache: GovernedSopCacheMeta = {
      hit: false,
      scope: 'actor_company_permission_version',
      invalidation: 'authorization_version_or_source_fingerprint',
    };
    const baseMeta = {
      asOf,
      effectiveOn,
      corpusKey: corpus,
      query,
      fields: requestedFields,
      limit,
      nextCursor: rows.length > limit ? page.at(-1)?.knowledge.id ?? null : null,
      bounded: true as const,
      cache,
    };
    if (conflictRows.length > 0) {
      const evidence: GovernedSopEvidence = {
        type: 'policy',
        status: 'conflict',
        inference: false,
        reason: 'conflicting_sources',
        statement: 'Multiple effective policy sources match this query; no policy content was selected.',
        sources: conflictRows.map((row) => citationForRow(
          row,
          asOf,
          effectiveOn,
          assertAllowedFields(requestedFields, row.knowledge.fieldAllowlist) ?? [],
        )),
      };
      const result: GovernedSopSearchResult = {
        data: [],
        meta: { ...baseMeta, nextCursor: null, evidence },
      };
      storeCachedSearchResult(key, fingerprint, result, now.getTime());
      return cloneSearchResult(result);
    }
    const data = page.flatMap((row) => {
      const returnedFields = assertAllowedFields(requestedFields, row.knowledge.fieldAllowlist);
      if (!returnedFields) return [];
      const allowed = new Set(returnedFields);
      const item: GovernedSopSearchResult['data'][number] = {
        id: row.knowledge.id,
        corpusKey: row.knowledge.corpusKey,
        title: row.knowledge.title,
        citation: citationForRow(row, asOf, effectiveOn, returnedFields),
        evidence: {
          type: 'policy',
          status: 'grounded',
          inference: false,
        },
        contentPolicy: {
          kind: 'untrusted_document_data',
          instructionsExecutable: false,
        },
        access: {
          requiredPermission: row.knowledge.requiredPermission,
          fields: returnedFields,
          recordStatus: row.recordStatus,
        },
      };
      if (allowed.has('content')) item.content = row.rawText?.slice(0, SOP_MAX_CONTENT_CHARS) ?? '';
      if (allowed.has('effectiveFrom')) item.effectiveFrom = row.knowledge.effectiveFrom;
      if (allowed.has('effectiveTo')) item.effectiveTo = row.knowledge.effectiveTo;
      if (allowed.has('documentId')) item.documentId = row.knowledge.documentId;
      if (allowed.has('documentVersionId')) item.documentVersionId = row.knowledge.documentVersionId;
      if (allowed.has('documentVersionNo')) item.documentVersionNo = row.versionNo;
      if (allowed.has('sourceSha256')) item.sourceSha256 = row.sourceSha256;
      return [item];
    });
    const evidence: GovernedSopEvidence = data.length > 0
      ? {
        type: 'policy',
        status: 'grounded',
        inference: false,
        statement: 'The returned policy content is grounded in the effective governed source versions listed in the citations.',
      }
      : {
        type: 'policy',
        status: 'unknown',
        inference: false,
        reason: page.length > 0 && data.length === 0
          ? 'requested_fields_not_allowed'
          : 'no_current_evidence',
        statement: page.length > 0 && data.length === 0
          ? 'No requested policy fields are available for the selected sources.'
          : 'No current effective governed policy source supports this query.',
      };
    const result: GovernedSopSearchResult = {
      data,
      meta: { ...baseMeta, evidence },
    };
    storeCachedSearchResult(key, fingerprint, result, now.getTime());
    return cloneSearchResult(result);
  });
}

/** Resolve one citation through the same live permission, effective-date and
 * source-version boundary used by list retrieval. A stale citation never
 * falls back to another document or returns the old extraction. */
export async function resolveGovernedSopCitationWithin(
  db: DB,
  session: SessionData,
  input: {
    knowledgeId: number;
    effectiveOn?: string;
    sourceSha256?: string;
  },
  now = new Date(),
): Promise<GovernedSopSearchResult['data'][number]> {
  const knowledgeId = positiveId(input.knowledgeId, 'Knowledge document id');
  if (input.sourceSha256 != null && !/^[0-9a-f]{64}$/.test(input.sourceSha256)) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_input_invalid',
      'The citation source hash is invalid.',
      422,
    );
  }
  const result = await searchGovernedSopWithin(db, session, {
    knowledgeId,
    effectiveOn: input.effectiveOn,
    fields: [...AGENT_KNOWLEDGE_FIELDS],
  }, now);
  if (result.meta.evidence.status !== 'grounded' || result.data.length !== 1) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_source_unavailable',
      'The cited policy source is no longer current or effective.',
      404,
    );
  }
  const [source] = result.data;
  if (input.sourceSha256 != null && source.sourceSha256 !== input.sourceSha256) {
    throw new KnowledgeRetrievalError(
      'agent_knowledge_source_unavailable',
      'The cited policy source version has changed.',
      409,
    );
  }
  return source;
}
