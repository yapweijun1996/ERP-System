import { and, desc, eq, lt } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { outboxEvent } from '../../data/schema';

export type IntegrationEventStatus = 'delivered' | 'processing' | 'retry' | 'pending';

export interface IntegrationEventLogRow {
  id: number;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  channel: 'email' | 'outbox';
  direction: 'outbound';
  status: IntegrationEventStatus;
  attempts: number;
  errorCode: 'transport_unavailable' | 'unsupported_topic' | 'delivery_failed' | null;
  availableAt: Date;
  lastAttemptAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
}

function deliveryStatus(row: {
  deliveredAt: Date | null;
  lockedAt: Date | null;
  lastError: string | null;
}): IntegrationEventStatus {
  if (row.deliveredAt) return 'delivered';
  if (row.lockedAt) return 'processing';
  if (row.lastError) return 'retry';
  return 'pending';
}

/**
 * Convert worker failures to a deliberately small, non-sensitive vocabulary.
 * SMTP/library errors can contain addresses, endpoints or credential-adjacent
 * diagnostics, so the canonical browser/API read model never returns the raw
 * `last_error` text (and never selects `payload`, `locked_by` or encrypted tokens).
 */
function safeErrorCode(error: string | null): IntegrationEventLogRow['errorCode'] {
  if (!error) return null;
  const normalized = error.toLowerCase();
  if (normalized.includes('smtp') || normalized.includes('transport')) {
    return 'transport_unavailable';
  }
  if (normalized.includes('unsupported outbox topic')) return 'unsupported_topic';
  return 'delivery_failed';
}

export async function listIntegrationEventsWithin(
  exec: DB,
  scope: Scope,
  input: { cursor?: number; limit?: number } = {},
): Promise<{ data: IntegrationEventLogRow[]; nextCursor: number | null }> {
  const cursor = Number.isSafeInteger(input.cursor) && Number(input.cursor) > 0
    ? Number(input.cursor)
    : null;
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 100);
  const predicates = [
    eq(outboxEvent.masterFn, scope.masterFn),
    eq(outboxEvent.companyFn, scope.companyFn),
  ];
  if (cursor != null) predicates.push(lt(outboxEvent.id, cursor));

  const rows = await exec.select({
    id: outboxEvent.id,
    topic: outboxEvent.topic,
    aggregateType: outboxEvent.aggregateType,
    aggregateId: outboxEvent.aggregateId,
    attempts: outboxEvent.attempts,
    availableAt: outboxEvent.availableAt,
    lockedAt: outboxEvent.lockedAt,
    lastAttemptAt: outboxEvent.lastAttemptAt,
    deliveredAt: outboxEvent.deliveredAt,
    lastError: outboxEvent.lastError,
    createdAt: outboxEvent.createdAt,
  }).from(outboxEvent)
    .where(and(...predicates))
    .orderBy(desc(outboxEvent.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const data = page.map((row): IntegrationEventLogRow => ({
    id: row.id,
    topic: row.topic,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    channel: row.topic.startsWith('auth.') ? 'email' : 'outbox',
    direction: 'outbound',
    status: deliveryStatus(row),
    attempts: row.attempts,
    errorCode: safeErrorCode(row.lastError),
    availableAt: row.availableAt,
    lastAttemptAt: row.lastAttemptAt,
    deliveredAt: row.deliveredAt,
    createdAt: row.createdAt,
  }));
  return {
    data,
    nextCursor: hasMore && data.length ? data[data.length - 1].id : null,
  };
}
