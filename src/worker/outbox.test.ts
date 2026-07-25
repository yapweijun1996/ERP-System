import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { seedDemo } from '../data/seed';
import { appUser, outboxEvent } from '../data/schema';
import { freshDb } from '../test/helpers';
import { requestPasswordReset } from '../auth/lifecycle';
import { processOutboxBatch, type MailMessage } from './outbox';

describe('outbox worker', () => {
  it('claims, sends and redacts sensitive token payloads', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    const key = Buffer.alloc(32, 4);
    await requestPasswordReset(db, admin.email!, 'worker-test', {
      tokenEncryptionKey: key,
      publicUrl: 'https://erp.example.test',
    });
    const sent: MailMessage[] = [];
    const result = await processOutboxBatch(db, {
      async send(message) {
        sent.push(message);
      },
    }, {
      tokenEncryptionKey: key,
      workerId: 'test-worker',
    });
    expect(result).toEqual({ claimed: 1, delivered: 1, failed: 0 });
    expect(sent[0]).toMatchObject({
      to: admin.email,
      subject: 'Reset your Aria ERP password',
    });
    expect(sent[0].text).toContain('token=');
    const [event] = await db.select().from(outboxEvent);
    expect(event.deliveredAt).toBeInstanceOf(Date);
    expect(event.lockedBy).toBeNull();
    expect(event.payload).toMatchObject({ redacted: true, to: admin.email });
    expect(JSON.stringify(event.payload)).not.toContain('ciphertext');
  });

  it('releases failed messages with exponential backoff', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.email, 'admin@acme.co'));
    const key = Buffer.alloc(32, 5);
    await requestPasswordReset(db, admin.email!, 'worker-failure', {
      tokenEncryptionKey: key,
      publicUrl: 'https://erp.example.test',
    });
    const now = new Date(Date.now() + 1000);
    const result = await processOutboxBatch(db, {
      async send() {
        throw new Error('SMTP unavailable');
      },
    }, { tokenEncryptionKey: key, workerId: 'failed-worker', now });
    expect(result).toEqual({ claimed: 1, delivered: 0, failed: 1 });
    const [event] = await db.select().from(outboxEvent);
    expect(event.deliveredAt).toBeNull();
    expect(event.lockedAt).toBeNull();
    expect(event.lastError).toBe('SMTP unavailable');
    expect(event.availableAt.getTime()).toBeGreaterThan(now.getTime());
  });
});
