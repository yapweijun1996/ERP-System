import { eq, sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import {
  appUser,
  calendarOutboundConnection,
  calendarOutboundEvent,
  documentExtraction,
  documentScanJob,
  leaveRequest,
  outboxEvent,
} from '../data/schema';
import type { DB } from '../data/db';
import { setLocalStatementTimeout } from '../data/tenantTransaction';
import { seedDemo } from '../data/seed';
import { requestPasswordReset } from '../auth/lifecycle';
import { freshDb } from '../test/helpers';
import { createDocumentStorageRegistry, createManagedDocument } from '../modules/documents/storage';
import {
  createWorkerTelemetryEmitter,
  logWorkerQueueTelemetry,
  parseWorkerTelemetryQueryTimeoutMs,
  readWorkerQueueTelemetry,
  WORKER_TELEMETRY_QUERY_TIMEOUT_MAX_MS,
  type WorkerTelemetrySnapshot,
} from './telemetry';

describe('worker queue telemetry', () => {
  it('normalizes an optional bounded query timeout without inventing a default', () => {
    expect(parseWorkerTelemetryQueryTimeoutMs(undefined)).toBeUndefined();
    expect(parseWorkerTelemetryQueryTimeoutMs('')).toBeUndefined();
    expect(parseWorkerTelemetryQueryTimeoutMs('invalid')).toBeUndefined();
    expect(parseWorkerTelemetryQueryTimeoutMs('0')).toBeUndefined();
    expect(parseWorkerTelemetryQueryTimeoutMs('0.5')).toBeUndefined();
    expect(parseWorkerTelemetryQueryTimeoutMs('73.9')).toBe(73);
    expect(parseWorkerTelemetryQueryTimeoutMs('999999')).toBe(
      WORKER_TELEMETRY_QUERY_TIMEOUT_MAX_MS,
    );
  });

  it('applies a configured timeout only inside the telemetry transaction', async () => {
    const db = await freshDb();
    await seedDemo(db);
    let insideTimeout = '';
    await db.transaction(async (tx) => {
      await setLocalStatementTimeout(tx, 73);
      const result = await (tx.execute(
        sql`select current_setting('statement_timeout', true) as timeout`,
      ) as unknown as Promise<{ rows: Array<{ timeout?: unknown }> }>);
      insideTimeout = String(result.rows[0]?.timeout ?? '');
    });
    expect(insideTimeout).toBe('73ms');
    const outside = await (db.execute(
      sql`select current_setting('statement_timeout', true) as timeout`,
    ) as unknown as Promise<{ rows: Array<{ timeout?: unknown }> }>);
    expect(String(outside.rows[0]?.timeout ?? '')).toBe('0');

    const snapshot = await readWorkerQueueTelemetry(db, {
      queryTimeoutMs: 73,
      now: new Date('2026-09-07T00:00:00.000Z'),
    });
    expect(snapshot.queues).toHaveLength(8);
  });

  it('returns bounded, payload-free queue aggregates for the primary worker', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    const key = Buffer.alloc(32, 7);
    await requestPasswordReset(db, admin.email!, 'telemetry-test', {
      tokenEncryptionKey: key,
      publicUrl: 'https://erp.example.test',
    });
    const now = new Date(Date.now() + 1_000);
    const snapshot = await readWorkerQueueTelemetry(db, { now });
    const outbox = snapshot.queues.find(row => row.queue === 'outbox');
    expect(snapshot).toMatchObject({
      generatedAt: now.toISOString(),
      scope: 'primary',
      queryDurationMs: expect.any(Number),
    });
    expect(snapshot.queryDurationMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.queues.map(row => row.queue)).toEqual([
      'outbox',
      'report',
      'tax-evidence',
      'document-scan',
      'document-extraction',
      'calendar-leave',
      'calendar-appointment',
      'calendar-reminder',
    ]);
    expect(outbox).toMatchObject({
      pending: 1,
      ready: 1,
      inFlight: 0,
      retrying: 0,
      failed: 0,
      deadLettered: 0,
      oldestPendingAgeSeconds: expect.any(Number),
    });
    expect(JSON.stringify(snapshot)).not.toContain('ciphertext');
    expect(JSON.stringify(snapshot)).not.toContain('token');
  });

  it('reports terminal outbox failure without exposing the error payload', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    const key = Buffer.alloc(32, 8);
    await requestPasswordReset(db, admin.email!, 'telemetry-dead-letter', {
      tokenEncryptionKey: key,
      publicUrl: 'https://erp.example.test',
    });
    const [event] = await db.select().from(outboxEvent);
    const now = new Date(Date.now() + 1_000);
    await db.update(outboxEvent).set({
      attempts: 5,
      deadLetteredAt: now,
      lastError: 'SMTP token=must-not-appear',
    }).where(eq(outboxEvent.id, event.id));
    const snapshot = await readWorkerQueueTelemetry(db, { now });
    expect(snapshot.queues.find(row => row.queue === 'outbox')).toMatchObject({
      pending: 0,
      failed: 0,
      deadLettered: 1,
    });
    expect(JSON.stringify(snapshot)).not.toContain('must-not-appear');
  });

  it('matches outbox readiness to its active-lease claim predicate', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    const key = Buffer.alloc(32, 9);
    await requestPasswordReset(db, admin.email!, 'telemetry-lease', {
      tokenEncryptionKey: key,
      publicUrl: 'https://erp.example.test',
    });
    const [event] = await db.select().from(outboxEvent);
    const now = new Date('2026-09-07T00:00:00.000Z');
    await db.update(outboxEvent).set({
      availableAt: now,
      lockedAt: new Date(now.getTime() - 1_000),
      lockedBy: 'active-worker',
    }).where(eq(outboxEvent.id, event.id));
    let snapshot = await readWorkerQueueTelemetry(db, { now });
    expect(snapshot.queues.find(row => row.queue === 'outbox')).toMatchObject({
      pending: 1,
      ready: 0,
      inFlight: 1,
    });

    await db.update(outboxEvent).set({
      lockedAt: new Date(now.getTime() - 5 * 60 * 1_000 - 1),
    }).where(eq(outboxEvent.id, event.id));
    snapshot = await readWorkerQueueTelemetry(db, { now });
    expect(snapshot.queues.find(row => row.queue === 'outbox')).toMatchObject({
      pending: 1,
      ready: 1,
      inFlight: 0,
    });
  });

  it('does not report active document processing states as ready after lease expiry', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const stored = await createManagedDocument(db, scope, { userId: admin.userId }, {
      documentKey: 'telemetry:document-processing-lease',
      purpose: 'receipt',
      ownerUserId: admin.userId,
      originalFileName: 'receipt.txt',
      mimeType: 'text/plain',
      retentionUntil: new Date('2033-12-31T00:00:00.000Z'),
      content: new TextEncoder().encode('telemetry receipt'),
    }, createDocumentStorageRegistry({}));
    const now = new Date('2026-09-07T00:00:00.000Z');
    const expiredLease = new Date(now.getTime() - 5 * 60 * 1_000 - 1);
    await db.insert(documentScanJob).values({
      ...scope,
      versionId: stored.version.id,
      status: 'scanning',
      availableAt: now,
      lockedAt: expiredLease,
      lockedBy: 'stale-scan-worker',
    });
    await db.insert(documentExtraction).values({
      ...scope,
      versionId: stored.version.id,
      provider: 'local_ocr',
      model: 'local-ocr',
      status: 'extracting',
      availableAt: now,
      lockedAt: expiredLease,
      lockedBy: 'stale-extraction-worker',
    });

    const snapshot = await readWorkerQueueTelemetry(db, { now });
    expect(snapshot.queues.find(row => row.queue === 'document-scan')).toMatchObject({
      pending: 1,
      ready: 0,
      inFlight: 0,
    });
    expect(snapshot.queues.find(row => row.queue === 'document-extraction')).toMatchObject({
      pending: 1,
      ready: 0,
      inFlight: 0,
    });
  });

  it('matches calendar readiness to enabled-connection claim predicates', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [connection] = await db.select().from(calendarOutboundConnection);
    const [leave] = await db.select().from(leaveRequest);
    const now = new Date('2026-09-07T00:00:00.000Z');
    await db.insert(calendarOutboundEvent).values({
      masterFn: 'M1',
      companyFn: 'C-SG',
      connectionId: connection.id,
      leaveRequestId: leave.id,
      leaveRevisionNo: 1,
      eventType: 'approved',
      eventKey: 'telemetry-calendar-enabled',
      payload: { event: 'approved' },
      availableAt: now,
    });
    let snapshot = await readWorkerQueueTelemetry(db, { now, scope: 'calendar' });
    expect(snapshot.queues.find(row => row.queue === 'calendar-leave')).toMatchObject({
      pending: 1,
      ready: 1,
    });

    await db.update(calendarOutboundConnection).set({ isEnabled: false })
      .where(eq(calendarOutboundConnection.id, connection.id));
    snapshot = await readWorkerQueueTelemetry(db, { now, scope: 'calendar' });
    expect(snapshot.queues.find(row => row.queue === 'calendar-leave')).toMatchObject({
      pending: 1,
      ready: 0,
    });
  });

  it('logs a structured record for the selected worker scope', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const write = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const snapshot = await logWorkerQueueTelemetry(db, 'telemetry-worker', {
        scope: 'calendar',
        now: new Date('2026-09-07T00:00:00.000Z'),
      });
      expect(snapshot.queues.map(row => row.queue)).toEqual([
        'calendar-leave',
        'calendar-appointment',
        'calendar-reminder',
      ]);
      expect(write).toHaveBeenCalledWith(expect.stringContaining(
        '"type":"erp.worker.telemetry"',
      ));
      expect(write).toHaveBeenCalledWith(expect.stringContaining(
        '"workerId":"telemetry-worker"',
      ));
      expect(write).toHaveBeenCalledWith(expect.stringContaining(
        '"queryDurationMs":',
      ));
    } finally {
      write.mockRestore();
    }
  });

  it('does not overlap or await a slow telemetry emission', async () => {
    let clock = 0;
    let release!: () => void;
    const pending = new Promise<WorkerTelemetrySnapshot>((resolve) => {
      release = () => resolve({
        generatedAt: '2026-09-07T00:00:00.000Z',
        scope: 'primary',
        queryDurationMs: 0,
        queues: [],
      });
    });
    let calls = 0;
    const emit = createWorkerTelemetryEmitter({} as DB, 'slow-worker', 'primary', {
      intervalMs: 1_000,
      now: () => clock,
      log: async () => {
        calls += 1;
        return pending;
      },
    });

    expect(emit()).toBe(true);
    expect(calls).toBe(0);
    await Promise.resolve();
    expect(calls).toBe(1);
    clock = 2_000;
    expect(emit()).toBe(false);
    release();
    await pending;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(emit()).toBe(true);
    await Promise.resolve();
    expect(calls).toBe(2);
  });
});
