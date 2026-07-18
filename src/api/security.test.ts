import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { auditLog, appUser } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';
import { appendAudit } from './audit';
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
  requestHash,
} from './idempotency';

describe('idempotency and audit services', () => {
  it('replays an identical completed request and rejects a changed payload', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [actor] = await db.select({ userId: appUser.userId }).from(appUser)
      .where(eq(appUser.email, 'admin@acme.co'));
    const scope = { masterFn: 'M1', companyFn: 'C-SG', actorUserId: actor.userId };
    const first = await beginIdempotentRequest(db, scope, 'key-1', 'inventory.adjust', { qty: 2 });
    expect(first.kind).toBe('started');
    if (first.kind !== 'started') throw new Error('expected claim');
    await completeIdempotentRequest(db, first.recordId, 200, { movementId: 9 });
    expect(await beginIdempotentRequest(
      db, scope, 'key-1', 'inventory.adjust', { qty: 2 },
    )).toEqual({ kind: 'replay', status: 200, body: { movementId: 9 } });
    expect(await beginIdempotentRequest(
      db, scope, 'key-1', 'inventory.adjust', { qty: 3 },
    )).toEqual({ kind: 'conflict', reason: 'different_request' });
  });

  it('hashes object payloads independently of key insertion order', () => {
    expect(requestHash('op', { a: 1, b: 2 })).toBe(requestHash('op', { b: 2, a: 1 }));
  });

  it('appends auditable before/after state with the request correlation id', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const id = await appendAudit(db, {
      masterFn: 'M1',
      companyFn: 'C-SG',
      requestId: 'req-1',
      entity: 'app_session',
      action: 'switch_company',
      before: { companyFn: 'C-SG' },
      after: { companyFn: 'C-MY' },
    });
    const [row] = await db.select().from(auditLog).where(and(
      eq(auditLog.id, id),
      eq(auditLog.requestId, 'req-1'),
    ));
    expect(row).toMatchObject({
      entity: 'app_session',
      action: 'switch_company',
      before: { companyFn: 'C-SG' },
      after: { companyFn: 'C-MY' },
    });
  });
});
