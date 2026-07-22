import { describe, expect, it } from 'vitest';
import { outboxEvent } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { listIntegrationEventsWithin } from './eventLog';

const SG = { masterFn: 'M1', companyFn: 'C-SG' };
const MY = { masterFn: 'M1', companyFn: 'C-MY' };

describe('canonical integration event log', () => {
  it('returns only sanitized tenant facts with honest delivery states', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const base = new Date('2026-07-23T01:00:00.000Z');
    await db.insert(outboxEvent).values([
      {
        ...SG,
        topic: 'auth.invitation.created',
        aggregateType: 'user_invitation',
        aggregateId: '101',
        payload: { token: { ciphertext: 'DO-NOT-LEAK' }, to: 'private@example.test' },
        deliveredAt: base,
        attempts: 1,
      },
      {
        ...SG,
        topic: 'auth.password-reset.requested',
        aggregateType: 'password_reset_token',
        aggregateId: '102',
        payload: { token: { ciphertext: 'ALSO-SECRET' }, to: 'reset@example.test' },
        attempts: 2,
        lastError: 'SMTP transport failed with password super-secret',
        availableAt: new Date('2026-07-23T01:05:00.000Z'),
      },
      {
        ...SG,
        topic: 'inventory.stock-moved',
        aggregateType: 'stock_movement',
        aggregateId: '103',
        payload: { bearer: 'never-return-this' },
        lockedAt: base,
        lockedBy: 'private-hostname',
      },
      {
        ...MY,
        topic: 'auth.invitation.created',
        aggregateType: 'user_invitation',
        aggregateId: '999',
        payload: { tenantSecret: 'wrong-company' },
        deliveredAt: base,
      },
    ]);

    const page = await listIntegrationEventsWithin(db, SG, { limit: 100 });
    expect(page.nextCursor).toBeNull();
    expect(page.data).toHaveLength(3);
    expect(page.data.map((row) => row.aggregateId)).toEqual(['103', '102', '101']);
    expect(page.data.map((row) => row.status)).toEqual(['processing', 'retry', 'delivered']);
    expect(page.data[1]).toMatchObject({
      channel: 'email', direction: 'outbound', errorCode: 'transport_unavailable', attempts: 2,
    });
    const serialized = JSON.stringify(page.data);
    expect(serialized).not.toContain('DO-NOT-LEAK');
    expect(serialized).not.toContain('ALSO-SECRET');
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('private-hostname');
    expect(serialized).not.toContain('wrong-company');
    expect(serialized).not.toContain('private@example.test');
  });

  it('uses descending id keyset pagination without offsets', async () => {
    const db = await freshDb();
    await seedDemo(db);
    await db.insert(outboxEvent).values(Array.from({ length: 5 }, (_, index) => ({
      ...SG,
      topic: 'test.delivery',
      aggregateType: 'test',
      aggregateId: String(index + 1),
      payload: { index },
    })));
    const first = await listIntegrationEventsWithin(db, SG, { limit: 2 });
    expect(first.data).toHaveLength(2);
    expect(first.data[0].id).toBeGreaterThan(first.data[1].id);
    expect(first.nextCursor).toBe(first.data[1].id);

    const second = await listIntegrationEventsWithin(db, SG, {
      cursor: first.nextCursor ?? undefined,
      limit: 2,
    });
    expect(second.data).toHaveLength(2);
    expect(second.data.every((row) => row.id < (first.nextCursor ?? 0))).toBe(true);
    expect(new Set([...first.data, ...second.data].map((row) => row.id)).size).toBe(4);
  });
});
