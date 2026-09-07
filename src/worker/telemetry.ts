import { sql, type SQL } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  withCalendarWorkerTransaction,
  withDocumentWorkerTransaction,
  withReportingWorkerTransaction,
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
  queues: WorkerQueueTelemetry[];
}

interface QueueSpec {
  queue: WorkerQueueName;
  // These values are fixed source constants, never request or tenant input.
  table: string;
  pending: string;
  ready: (now: Date, expiredLease: Date) => SQL;
  leaseMs: number;
  failed: string;
  deadLettered: string;
}

const OUTBOX_SCOPE = "topic IN ('auth.invitation.created', 'auth.password-reset.requested')";
const OUTBOX_PENDING = `${OUTBOX_SCOPE} AND delivered_at IS NULL AND dead_lettered_at IS NULL`;
const REPORT_PENDING = "status IN ('queued', 'running')";
const TAX_EVIDENCE_PENDING = "status IN ('queued', 'running')";
const DOCUMENT_SCAN_PENDING = "status IN ('queued', 'scanning', 'indeterminate', 'unavailable')";
const DOCUMENT_EXTRACTION_PENDING = "status IN ('queued', 'extracting', 'failed', 'unavailable')";
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
): SQL {
  return sql`${readyWithLease(pending, now, expiredLease)}
    AND EXISTS (
      SELECT 1
      FROM "calendar_outbound_connection" AS connection
      WHERE connection.id = queue.connection_id
        AND connection.master_fn = queue.master_fn
        AND connection.company_fn = queue.company_fn
        AND connection.is_enabled = TRUE
    )`;
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
  ready: (now, expiredLease) => readyWithLease(DOCUMENT_SCAN_PENDING, now, expiredLease),
  leaseMs: 5 * 60 * 1000,
  failed: "status IN ('indeterminate', 'unavailable')",
  deadLettered: "status = 'dead_letter' OR dead_lettered_at IS NOT NULL",
};

const DOCUMENT_EXTRACTION_SPEC: QueueSpec = {
  queue: 'document-extraction',
  table: '"document_extraction"',
  pending: DOCUMENT_EXTRACTION_PENDING,
  ready: (now, expiredLease) => readyWithLease(DOCUMENT_EXTRACTION_PENDING, now, expiredLease),
  leaseMs: 5 * 60 * 1000,
  failed: "status IN ('failed', 'unavailable')",
  deadLettered: "status = 'dead_letter' OR dead_lettered_at IS NOT NULL",
};

const CALENDAR_LEAVE_SPEC: QueueSpec = {
  queue: 'calendar-leave',
  table: '"calendar_outbound_event"',
  pending: CALENDAR_PENDING,
  ready: (now, expiredLease) => readyForCalendar(CALENDAR_PENDING, now, expiredLease),
  leaseMs: 5 * 60 * 1000,
  failed: "status = 'failed'",
  deadLettered: 'FALSE',
};

const CALENDAR_APPOINTMENT_SPEC: QueueSpec = {
  queue: 'calendar-appointment',
  table: '"staff_appointment_outbound_event"',
  pending: CALENDAR_PENDING,
  ready: (now, expiredLease) => readyForCalendar(CALENDAR_PENDING, now, expiredLease),
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
  // Table names and predicates above are fixed source constants. Keeping this
  // read-only query generic prevents eight queue implementations from drifting.
  const result = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE ${pending}) AS pending,
      count(*) FILTER (WHERE ${spec.ready(now, expiredLease)}) AS ready,
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
): Promise<WorkerQueueTelemetry[]> {
  if (workerScope === 'outbox') {
    return Promise.all(specs.map(spec => readQueueAggregate(db, spec, now)));
  }
  if (workerScope === 'reporting') {
    return withReportingWorkerTransaction(db, tx => (
      Promise.all(specs.map(spec => readQueueAggregate(tx, spec, now)))
    ));
  }
  if (workerScope === 'documents') {
    return withDocumentWorkerTransaction(db, tx => (
      Promise.all(specs.map(spec => readQueueAggregate(tx, spec, now)))
    ));
  }
  return withCalendarWorkerTransaction(db, tx => (
    Promise.all(specs.map(spec => readQueueAggregate(tx, spec, now)))
  ));
}

export async function readWorkerQueueTelemetry(
  db: DB,
  options: { now?: Date; scope?: WorkerTelemetryScope } = {},
): Promise<WorkerTelemetrySnapshot> {
  const now = options.now ?? new Date();
  const scope = options.scope ?? 'primary';
  const specs = scope === 'calendar' ? CALENDAR_SPECS : PRIMARY_SPECS;
  const outbox = specs.includes(OUTBOX_SPEC)
    ? readGroup(db, [OUTBOX_SPEC], now, 'outbox')
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
    reportingSpecs.length ? readGroup(db, reportingSpecs, now, 'reporting') : Promise.resolve([]),
    documentSpecs.length ? readGroup(db, documentSpecs, now, 'documents') : Promise.resolve([]),
    calendarSpecs.length ? readGroup(db, calendarSpecs, now, 'calendar') : Promise.resolve([]),
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
    queues: specs.map(spec => byQueue.get(spec.queue)!).filter(Boolean),
  };
}

export async function logWorkerQueueTelemetry(
  db: DB,
  workerId: string,
  options: { now?: Date; scope?: WorkerTelemetryScope } = {},
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
  options: { scope: WorkerTelemetryScope },
) => Promise<WorkerTelemetrySnapshot>;

export function createWorkerTelemetryEmitter(
  db: DB,
  workerId: string,
  scope: WorkerTelemetryScope,
  options: {
    intervalMs: number;
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
      .then(() => log(db, workerId, { scope }))
      .catch(onError)
      .finally(() => {
        inFlight = false;
      });
    return true;
  };
}
