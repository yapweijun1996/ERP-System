import { sql, type SQL } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  withCalendarWorkerTransaction,
  withDocumentWorkerTransaction,
  withReportingWorkerTransaction,
  MAX_LOCAL_STATEMENT_TIMEOUT_MS,
  setLocalStatementTimeout,
} from '../data/tenantTransaction';

export type WorkerTelemetryScope = 'primary' | 'calendar';

export type WorkerQueueName =
  | 'outbox'
  | 'report'
  | 'tax-evidence'
  | 'document-scan'
  | 'document-extraction'
  | 'calendar-leave'
  | 'calendar-appointment'
  | 'calendar-reminder';

export interface WorkerQueueTelemetry {
  queue: WorkerQueueName;
  pending: number;
  ready: number;
  inFlight: number;
  retrying: number;
  failed: number;
  deadLettered: number;
  oldestPendingAgeSeconds: number | null;
}

export interface WorkerTelemetrySnapshot {
  generatedAt: string;
  scope: WorkerTelemetryScope;
  /** Wall-clock duration of the aggregate snapshot read, in milliseconds. */
  queryDurationMs: number;
  queues: WorkerQueueTelemetry[];
}

export interface WorkerTelemetryReadOptions {
  now?: Date;
  scope?: WorkerTelemetryScope;
  /** Optional per-statement PostgreSQL budget for aggregate telemetry reads. */
  queryTimeoutMs?: number;
}

export const WORKER_TELEMETRY_QUERY_TIMEOUT_MAX_MS = MAX_LOCAL_STATEMENT_TIMEOUT_MS;

/** Parse an optional worker telemetry query budget without allowing an
 * unbounded or malformed value to reach the database session. */
export function parseWorkerTelemetryQueryTimeoutMs(
  value: string | undefined,
): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  const bounded = Math.floor(parsed);
  if (bounded < 1) return undefined;
  return Math.min(bounded, WORKER_TELEMETRY_QUERY_TIMEOUT_MAX_MS);
}

function normalizeQueryTimeoutMs(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  const bounded = Math.floor(value);
  if (bounded < 1) return undefined;
  return Math.min(bounded, WORKER_TELEMETRY_QUERY_TIMEOUT_MAX_MS);
}

interface QueueSpec {
  queue: WorkerQueueName;
  // These values are fixed source constants, never request or tenant input.
  table: string;
  pending: string;
  ready: (now: Date, expiredLease: Date, useJoinedConnection?: boolean) => SQL;
  /** Join the tenant-scoped enabled calendar connection once per aggregate. */
  joinEnabledConnection?: boolean;
  leaseMs: number;
  failed: string;
  deadLettered: string;
}

const OUTBOX_SCOPE = "topic IN ('auth.invitation.created', 'auth.password-reset.requested')";
const OUTBOX_PENDING = `${OUTBOX_SCOPE} AND delivered_at IS NULL AND dead_lettered_at IS NULL`;
const REPORT_PENDING = "status IN ('queued', 'running')";
const TAX_EVIDENCE_PENDING = "status IN ('queued', 'running')";
const DOCUMENT_SCAN_PENDING = "status IN ('queued', 'scanning', 'indeterminate', 'unavailable')";
const DOCUMENT_SCAN_READY = "status IN ('queued', 'indeterminate', 'unavailable')";
const DOCUMENT_EXTRACTION_PENDING = "status IN ('queued', 'extracting', 'failed', 'unavailable')";
const DOCUMENT_EXTRACTION_READY = "status IN ('queued', 'failed', 'unavailable')";
const CALENDAR_PENDING = "status IN ('pending', 'failed')";

function readyWithLease(
  pending: string,
  now: Date,
  expiredLease: Date,
): SQL {
  return sql`${sql.raw(pending)}
    AND available_at <= ${now}
    AND (locked_at IS NULL OR locked_at < ${expiredLease})`;
}

function readyForLeasedJob(
  pending: string,
  maxAttempts: number,
  now: Date,
  expiredLease: Date,
): SQL {
  return sql`${sql.raw(pending)}
    AND available_at <= ${now}
    AND attempts < ${maxAttempts}
    AND (
      status = 'queued'
      OR (
        status = 'running'
        AND (locked_at IS NULL OR locked_at < ${expiredLease})
      )
    )`;
}

function readyForCalendar(
  pending: string,
  now: Date,
  expiredLease: Date,
  useJoinedConnection = false,
): SQL {
  const enabledConnection = useJoinedConnection
    ? sql`connection.id IS NOT NULL`
    : sql`EXISTS (
      SELECT 1
      FROM "calendar_outbound_connection" AS connection
      WHERE connection.id = queue.connection_id
        AND connection.master_fn = queue.master_fn
        AND connection.company_fn = queue.company_fn
        AND connection.is_enabled = TRUE
    )`;
  return sql`${readyWithLease(pending, now, expiredLease)}
    AND ${enabledConnection}`;
}

function readyForReminder(
  pending: string,
  now: Date,
  expiredLease: Date,
): SQL {
  return sql`${readyWithLease(pending, now, expiredLease)}
    AND reminder_at <= ${now}`;
}

const OUTBOX_SPEC: QueueSpec = {
  queue: 'outbox',
  table: '"outbox_event"',
  pending: OUTBOX_PENDING,
  ready: (now, expiredLease) => readyWithLease(OUTBOX_PENDING, now, expiredLease),
  leaseMs: 5 * 60 * 1000,
  failed: `${OUTBOX_SCOPE} AND last_error IS NOT NULL AND delivered_at IS NULL AND dead_lettered_at IS NULL`,
  deadLettered: `${OUTBOX_SCOPE} AND dead_lettered_at IS NOT NULL`,
};

const REPORT_SPEC: QueueSpec = {
  queue: 'report',
  table: '"report_job"',
  pending: REPORT_PENDING,
  ready: (now, expiredLease) => readyForLeasedJob(REPORT_PENDING, 3, now, expiredLease),
  leaseMs: 10 * 60 * 1000,
  failed: "status = 'failed'",
  deadLettered: 'FALSE',
};

const TAX_EVIDENCE_SPEC: QueueSpec = {
  queue: 'tax-evidence',
  table: '"tax_evidence_report_job"',
  pending: TAX_EVIDENCE_PENDING,
  ready: (now, expiredLease) => readyForLeasedJob(TAX_EVIDENCE_PENDING, 3, now, expiredLease),
  leaseMs: 10 * 60 * 1000,
  failed: "status = 'failed'",
  deadLettered: 'FALSE',
};

const DOCUMENT_SCAN_SPEC: QueueSpec = {
  queue: 'document-scan',
  table: '"document_scan_job"',
  pending: DOCUMENT_SCAN_PENDING,
  ready: (now, expiredLease) => readyWithLease(DOCUMENT_SCAN_READY, now, expiredLease),
  leaseMs: 5 * 60 * 1000,
  failed: "status IN ('indeterminate', 'unavailable')",
  deadLettered: "status = 'dead_letter' OR dead_lettered_at IS NOT NULL",
};

const DOCUMENT_EXTRACTION_SPEC: QueueSpec = {
  queue: 'document-extraction',
  table: '"document_extraction"',
  pending: DOCUMENT_EXTRACTION_PENDING,
  ready: (now, expiredLease) => readyWithLease(DOCUMENT_EXTRACTION_READY, now, expiredLease),
  leaseMs: 5 * 60 * 1000,
  failed: "status IN ('failed', 'unavailable')",
  deadLettered: "status = 'dead_letter' OR dead_lettered_at IS NOT NULL",
};

const CALENDAR_LEAVE_SPEC: QueueSpec = {
  queue: 'calendar-leave',
  table: '"calendar_outbound_event"',
  pending: CALENDAR_PENDING,
  ready: (now, expiredLease, useJoinedConnection) => (
    readyForCalendar(CALENDAR_PENDING, now, expiredLease, useJoinedConnection)
  ),
  joinEnabledConnection: true,
  leaseMs: 5 * 60 * 1000,
  failed: "status = 'failed'",
  deadLettered: 'FALSE',
};

const CALENDAR_APPOINTMENT_SPEC: QueueSpec = {
  queue: 'calendar-appointment',
  table: '"staff_appointment_outbound_event"',
  pending: CALENDAR_PENDING,
  ready: (now, expiredLease, useJoinedConnection) => (
    readyForCalendar(CALENDAR_PENDING, now, expiredLease, useJoinedConnection)
  ),
  joinEnabledConnection: true,
  leaseMs: 5 * 60 * 1000,
  failed: "status = 'failed'",
  deadLettered: 'FALSE',
};

const CALENDAR_REMINDER_SPEC: QueueSpec = {
  queue: 'calendar-reminder',
  table: '"staff_appointment_reminder"',
  pending: CALENDAR_PENDING,
  ready: (now, expiredLease) => readyForReminder(CALENDAR_PENDING, now, expiredLease),
  leaseMs: 5 * 60 * 1000,
  failed: "status = 'failed'",
  deadLettered: 'FALSE',
};

const PRIMARY_SPECS = [
  OUTBOX_SPEC,
  REPORT_SPEC,
  TAX_EVIDENCE_SPEC,
  DOCUMENT_SCAN_SPEC,
  DOCUMENT_EXTRACTION_SPEC,
  CALENDAR_LEAVE_SPEC,
  CALENDAR_APPOINTMENT_SPEC,
  CALENDAR_REMINDER_SPEC,
] as const;

const CALENDAR_SPECS = [
  CALENDAR_LEAVE_SPEC,
  CALENDAR_APPOINTMENT_SPEC,
  CALENDAR_REMINDER_SPEC,
] as const;

interface QueueAggregateRow {
  pending?: unknown;
  ready?: unknown;
  in_flight?: unknown;
  retrying?: unknown;
  failed?: unknown;
  dead_lettered?: unknown;
  oldest_pending_at?: unknown;
}

function countValue(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function ageSeconds(value: unknown, now: Date): number | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
}

async function readQueueAggregate(
  db: DB,
  spec: QueueSpec,
  now: Date,
): Promise<WorkerQueueTelemetry> {
  const expiredLease = new Date(now.getTime() - spec.leaseMs);
  const pending = sql.raw(spec.pending);
  const enabledConnectionJoin = spec.joinEnabledConnection
    ? sql`LEFT JOIN (
        SELECT id, master_fn, company_fn
        FROM "calendar_outbound_connection"
        WHERE is_enabled = TRUE
      ) AS connection
        ON connection.id = queue.connection_id
        AND connection.master_fn = queue.master_fn
        AND connection.company_fn = queue.company_fn`
    : sql``;
  // Table names and predicates above are fixed source constants. Keeping this
  // read-only query generic prevents eight queue implementations from drifting.
  const result = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE ${pending}) AS pending,
      count(*) FILTER (
        WHERE ${spec.ready(now, expiredLease, spec.joinEnabledConnection)}
      ) AS ready,
      count(*) FILTER (
        WHERE ${pending}
          AND locked_at IS NOT NULL
          AND locked_at >= ${expiredLease}
      ) AS in_flight,
      count(*) FILTER (WHERE ${pending} AND attempts > 0) AS retrying,
      count(*) FILTER (WHERE ${sql.raw(spec.failed)}) AS failed,
      count(*) FILTER (WHERE ${sql.raw(spec.deadLettered)}) AS dead_lettered,
      min(created_at) FILTER (WHERE ${pending}) AS oldest_pending_at
    FROM ${sql.raw(spec.table)} AS queue
    ${enabledConnectionJoin}
  `) as { rows: QueueAggregateRow[] };
  const row = result.rows[0] ?? {};
  return {
    queue: spec.queue,
    pending: countValue(row.pending),
    ready: countValue(row.ready),
    inFlight: countValue(row.in_flight),
    retrying: countValue(row.retrying),
    failed: countValue(row.failed),
    deadLettered: countValue(row.dead_lettered),
    oldestPendingAgeSeconds: ageSeconds(row.oldest_pending_at, now),
  };
}

async function readGroup(
  db: DB,
  specs: readonly QueueSpec[],
  now: Date,
  workerScope: 'outbox' | 'reporting' | 'documents' | 'calendar',
  queryTimeoutMs: number | undefined,
): Promise<WorkerQueueTelemetry[]> {
  if (workerScope === 'outbox') {
    if (queryTimeoutMs == null) {
      return Promise.all(specs.map(spec => readQueueAggregate(db, spec, now)));
    }
    return db.transaction(async (tx) => {
      await setLocalStatementTimeout(tx, queryTimeoutMs);
      return Promise.all(specs.map(spec => readQueueAggregate(tx, spec, now)));
    });
  }
  if (workerScope === 'reporting') {
    return withReportingWorkerTransaction(db, async (tx) => {
      await setLocalStatementTimeout(tx, queryTimeoutMs);
      return Promise.all(specs.map(spec => readQueueAggregate(tx, spec, now)));
    });
  }
  if (workerScope === 'documents') {
    return withDocumentWorkerTransaction(db, async (tx) => {
      await setLocalStatementTimeout(tx, queryTimeoutMs);
      return Promise.all(specs.map(spec => readQueueAggregate(tx, spec, now)));
    });
  }
  return withCalendarWorkerTransaction(db, async (tx) => {
    await setLocalStatementTimeout(tx, queryTimeoutMs);
    return Promise.all(specs.map(spec => readQueueAggregate(tx, spec, now)));
  });
}

export async function readWorkerQueueTelemetry(
  db: DB,
  options: WorkerTelemetryReadOptions = {},
): Promise<WorkerTelemetrySnapshot> {
  const startedAt = Date.now();
  const now = options.now ?? new Date();
  const scope = options.scope ?? 'primary';
  const queryTimeoutMs = normalizeQueryTimeoutMs(options.queryTimeoutMs);
  const specs = scope === 'calendar' ? CALENDAR_SPECS : PRIMARY_SPECS;
  const outbox = specs.includes(OUTBOX_SPEC)
    ? readGroup(db, [OUTBOX_SPEC], now, 'outbox', queryTimeoutMs)
    : Promise.resolve([]);
  const reportingSpecs = specs.filter(spec => (
    spec === REPORT_SPEC || spec === TAX_EVIDENCE_SPEC
  ));
  const documentSpecs = specs.filter(spec => (
    spec === DOCUMENT_SCAN_SPEC || spec === DOCUMENT_EXTRACTION_SPEC
  ));
  const calendarSpecs = specs.filter(spec => (
    spec === CALENDAR_LEAVE_SPEC
      || spec === CALENDAR_APPOINTMENT_SPEC
      || spec === CALENDAR_REMINDER_SPEC
  ));
  const [outboxRows, reportingRows, documentRows, calendarRows] = await Promise.all([
    outbox,
    reportingSpecs.length
      ? readGroup(db, reportingSpecs, now, 'reporting', queryTimeoutMs)
      : Promise.resolve([]),
    documentSpecs.length
      ? readGroup(db, documentSpecs, now, 'documents', queryTimeoutMs)
      : Promise.resolve([]),
    calendarSpecs.length
      ? readGroup(db, calendarSpecs, now, 'calendar', queryTimeoutMs)
      : Promise.resolve([]),
  ]);
  const byQueue = new Map([
    ...outboxRows,
    ...reportingRows,
    ...documentRows,
    ...calendarRows,
  ].map(row => [row.queue, row] as const));
  return {
    generatedAt: now.toISOString(),
    scope,
    queryDurationMs: Math.max(0, Date.now() - startedAt),
    queues: specs.map(spec => byQueue.get(spec.queue)!).filter(Boolean),
  };
}

export async function logWorkerQueueTelemetry(
  db: DB,
  workerId: string,
  options: WorkerTelemetryReadOptions = {},
): Promise<WorkerTelemetrySnapshot> {
  const snapshot = await readWorkerQueueTelemetry(db, options);
  console.log(JSON.stringify({
    type: 'erp.worker.telemetry',
    workerId,
    ...snapshot,
  }));
  return snapshot;
}

type WorkerTelemetryLogger = (
  db: DB,
  workerId: string,
  options: WorkerTelemetryReadOptions,
) => Promise<WorkerTelemetrySnapshot>;

export function createWorkerTelemetryEmitter(
  db: DB,
  workerId: string,
  scope: WorkerTelemetryScope,
  options: {
    intervalMs: number;
    queryTimeoutMs?: number;
    now?: () => number;
    log?: WorkerTelemetryLogger;
    onError?: (error: unknown) => void;
  },
): () => boolean {
  const now = options.now ?? Date.now;
  const log = options.log ?? logWorkerQueueTelemetry;
  const onError = options.onError ?? ((error: unknown) => console.error(error));
  let lastStartedAt = Number.NEGATIVE_INFINITY;
  let inFlight = false;

  return () => {
    const startedAt = now();
    if (inFlight || startedAt - lastStartedAt < options.intervalMs) return false;
    lastStartedAt = startedAt;
    inFlight = true;
    void Promise.resolve()
      .then(() => log(db, workerId, {
        scope,
        queryTimeoutMs: options.queryTimeoutMs,
      }))
      .catch(onError)
      .finally(() => {
        inFlight = false;
      });
    return true;
  };
}
