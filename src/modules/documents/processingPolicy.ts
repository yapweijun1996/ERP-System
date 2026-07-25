import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { appendAudit } from '../../api/audit';
import {
  documentProcessingPolicy,
  integrationConnector,
} from '../../data/schema';

export interface DocumentProcessingPolicyScope {
  masterFn: string;
  companyFn: string;
}

export interface DocumentProcessingPolicyActor {
  userId: number;
  requestId: string;
}

export type DocumentProcessingPolicyInput =
  | { extractionProvider: 'local_ocr' }
  | {
    extractionProvider: 'byok_vision';
    visionProvider: 'openai' | 'google';
    visionRegion: string;
    visionRetentionDays: number;
  };

export class DocumentProcessingPolicyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

const PUBLIC_COLUMNS = {
  extractionProvider: documentProcessingPolicy.extractionProvider,
  visionProvider: documentProcessingPolicy.visionProvider,
  visionRegion: documentProcessingPolicy.visionRegion,
  visionRetentionDays: documentProcessingPolicy.visionRetentionDays,
  autoSubmitEnabled: documentProcessingPolicy.autoSubmitEnabled,
  autoSubmitMinConfidence: documentProcessingPolicy.autoSubmitMinConfidence,
  version: documentProcessingPolicy.version,
  updatedAt: documentProcessingPolicy.updatedAt,
} as const;

export async function getDocumentProcessingPolicyWithin(
  exec: DB,
  scope: DocumentProcessingPolicyScope,
) {
  const [row] = await exec.select(PUBLIC_COLUMNS).from(documentProcessingPolicy).where(and(
    eq(documentProcessingPolicy.masterFn, scope.masterFn),
    eq(documentProcessingPolicy.companyFn, scope.companyFn),
  )).limit(1);
  return row ?? {
    extractionProvider: 'local_ocr' as const,
    visionProvider: null,
    visionRegion: null,
    visionRetentionDays: null,
    autoSubmitEnabled: false,
    autoSubmitMinConfidence: '0.9800',
    version: 0,
    updatedAt: null,
  };
}

function normalizePolicy(input: DocumentProcessingPolicyInput) {
  if (input.extractionProvider === 'local_ocr') {
    return {
      extractionProvider: 'local_ocr' as const,
      visionProvider: null,
      visionRegion: null,
      visionRetentionDays: null,
    };
  }
  const region = input.visionRegion.trim();
  if (region.length < 2 || region.length > 80 || !/^[a-z0-9][a-z0-9._ -]*$/i.test(region)) {
    throw new DocumentProcessingPolicyError(
      'invalid_region',
      'Vision region must contain 2–80 safe characters.',
    );
  }
  if (!Number.isSafeInteger(input.visionRetentionDays)
    || input.visionRetentionDays < 0 || input.visionRetentionDays > 365) {
    throw new DocumentProcessingPolicyError(
      'invalid_retention',
      'Vision retention must be a whole number from 0 to 365 days.',
    );
  }
  return {
    extractionProvider: 'byok_vision' as const,
    visionProvider: input.visionProvider,
    visionRegion: region,
    visionRetentionDays: input.visionRetentionDays,
  };
}

export async function configureDocumentProcessingPolicyWithin(
  exec: DB,
  scope: DocumentProcessingPolicyScope,
  actor: DocumentProcessingPolicyActor,
  input: DocumentProcessingPolicyInput,
) {
  const values = normalizePolicy(input);
  if (values.extractionProvider === 'byok_vision') {
    const [connector] = await exec.select({
      status: integrationConnector.status,
      enabled: integrationConnector.enabled,
      credentialEnvelope: integrationConnector.credentialEnvelope,
    }).from(integrationConnector).where(and(
      eq(integrationConnector.masterFn, scope.masterFn),
      eq(integrationConnector.companyFn, scope.companyFn),
      eq(integrationConnector.connectorKey, 'document-vision'),
    )).limit(1);
    if (!connector?.enabled || connector.status !== 'connected' || !connector.credentialEnvelope) {
      throw new DocumentProcessingPolicyError(
        'vision_connector_required',
        'Configure and enable the encrypted Document Vision connector before selecting BYOK Vision.',
      );
    }
  }

  const before = await getDocumentProcessingPolicyWithin(exec, scope);
  const [updated] = await exec.insert(documentProcessingPolicy).values({
    ...scope,
    ...values,
    updatedByUserId: actor.userId,
  }).onConflictDoUpdate({
    target: [documentProcessingPolicy.masterFn, documentProcessingPolicy.companyFn],
    set: {
      ...values,
      updatedByUserId: actor.userId,
      version: sql`${documentProcessingPolicy.version} + 1`,
      updatedAt: new Date(),
    },
  }).returning(PUBLIC_COLUMNS);
  await appendAudit(exec, {
    ...scope,
    actorUserId: actor.userId,
    requestId: actor.requestId,
    entity: 'document_processing_policy',
    entityId: scope.companyFn,
    action: 'configure',
    before,
    after: updated,
  });
  return updated;
}

export async function configureReceiptAutoSubmitPolicyWithin(
  exec: DB,
  scope: DocumentProcessingPolicyScope,
  actor: DocumentProcessingPolicyActor,
  input: { enabled: boolean; minConfidence: number },
) {
  if (!Number.isFinite(input.minConfidence)
    || input.minConfidence < 0.98 || input.minConfidence > 1) {
    throw new DocumentProcessingPolicyError(
      'confidence_below_minimum',
      'Receipt auto-submit confidence must be between 98% and 100%.',
    );
  }
  const minConfidence = input.minConfidence.toFixed(4);
  const before = await getDocumentProcessingPolicyWithin(exec, scope);
  const [updated] = await exec.insert(documentProcessingPolicy).values({
    ...scope,
    autoSubmitEnabled: input.enabled,
    autoSubmitMinConfidence: minConfidence,
    updatedByUserId: actor.userId,
  }).onConflictDoUpdate({
    target: [documentProcessingPolicy.masterFn, documentProcessingPolicy.companyFn],
    set: {
      autoSubmitEnabled: input.enabled,
      autoSubmitMinConfidence: minConfidence,
      updatedByUserId: actor.userId,
      version: sql`${documentProcessingPolicy.version} + 1`,
      updatedAt: new Date(),
    },
  }).returning(PUBLIC_COLUMNS);
  await appendAudit(exec, {
    ...scope,
    actorUserId: actor.userId,
    requestId: actor.requestId,
    entity: 'document_processing_policy',
    entityId: scope.companyFn,
    action: 'configure_auto_submit',
    before,
    after: updated,
  });
  return updated;
}
