import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { appUser, outboxEvent } from '../data/schema';
import { seedDemo } from '../data/seed';
import { requestPasswordReset } from '../auth/lifecycle';
import { freshDb } from '../test/helpers';
import {
  logWorkerQueueTelemetry,
  readWorkerQueueTelemetry,
} from './telemetry';

describe('worker queue telemetry', () => {
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
    });
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
    } finally {
      write.mockRestore();
    }
  });
});
