import { createHash } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import type { DB } from '../data/db';
import { apiIdempotency } from '../data/schema';

export interface IdempotencyScope {
  masterFn: string;
  companyFn: string;
  actorUserId: number;
}

export type IdempotencyBeginResult =
  | { kind: 'started'; recordId: number }
  | { kind: 'replay'; status: number; body: unknown }
  | { kind: 'conflict'; reason: 'different_request' | 'in_progress' };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}

export function requestHash(operation: string, payload: unknown): string {
  return createHash('sha256')
    .update(operation)
    .update('\0')
    .update(JSON.stringify(canonicalize(payload)))
    .digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string; cause?: { code?: string } };
  return candidate.code === '23505'
    || candidate.cause?.code === '23505'
    || Boolean(candidate.message?.toLowerCase().includes('unique'));
}

export async function beginIdempotentRequest(
  db: DB,
  scope: IdempotencyScope,
  key: string,
  operation: string,
  payload: unknown,
  ttlMs = 24 * 60 * 60 * 1000,
): Promise<IdempotencyBeginResult> {
  const hash = requestHash(operation, payload);
  try {
    const [created] = await db.insert(apiIdempotency).values({
      ...scope,
      idempotencyKey: key,
      operation,
      requestHash: hash,
      expiresAt: new Date(Date.now() + ttlMs),
    }).returning({ id: apiIdempotency.id });
    return { kind: 'started', recordId: created.id };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }

  const [existing] = await db.select({
    requestHash: apiIdempotency.requestHash,
    responseStatus: apiIdempotency.responseStatus,
    responseBody: apiIdempotency.responseBody,
    completedAt: apiIdempotency.completedAt,
  }).from(apiIdempotency).where(and(
    eq(apiIdempotency.masterFn, scope.masterFn),
    eq(apiIdempotency.companyFn, scope.companyFn),
    eq(apiIdempotency.actorUserId, scope.actorUserId),
    eq(apiIdempotency.idempotencyKey, key),
  )).limit(1);
  if (!existing) throw new Error('Idempotency claim disappeared after unique conflict');
  if (existing.requestHash !== hash) {
    return { kind: 'conflict', reason: 'different_request' };
  }
  if (existing.completedAt && existing.responseStatus != null) {
    return { kind: 'replay', status: existing.responseStatus, body: existing.responseBody };
  }
  return { kind: 'conflict', reason: 'in_progress' };
}

export async function completeIdempotentRequest(
  db: DB,
  recordId: number,
  status: number,
  body: unknown,
): Promise<void> {
  await db.update(apiIdempotency).set({
    responseStatus: status,
    responseBody: body,
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(apiIdempotency.id, recordId));
}

export async function cleanupExpiredIdempotency(db: DB, now = new Date()): Promise<number> {
  const rows = await db.delete(apiIdempotency)
    .where(lt(apiIdempotency.expiresAt, now))
    .returning({ id: apiIdempotency.id });
  return rows.length;
}
