import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { appUser } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  deliverNotificationWithin,
  dismissNotificationWithin,
  listNotificationsWithin,
  markNotificationReadWithin,
} from './notification';

const SG = { masterFn: 'M1', companyFn: 'C-SG' };
const MY = { masterFn: 'M1', companyFn: 'C-MY' };

describe('notification delivery and recipient state', () => {
  let db: DB;
  let adminId: number;
  let viewerId: number;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
    const users = await db.select({ id: appUser.userId, email: appUser.email }).from(appUser)
      .where(eq(appUser.masterFn, 'M1'));
    adminId = users.find((row) => row.email === 'admin@acme.co')!.id;
    viewerId = users.find((row) => row.email === 'viewer@acme.co')!.id;
  });

  it('delivers and lists only the addressed actor/company with descending keyset pages', async () => {
    const first = await deliverNotificationWithin(db, SG, viewerId, {
      kind: 'sales_attention', severity: 'warning', subject: 'Quote needs review',
      detail: 'Quotation Q-100 is awaiting review.', route: 'quotations', entityRef: 'Q-100',
    });
    const second = await deliverNotificationWithin(db, SG, viewerId, {
      kind: 'integration_completed', severity: 'success', subject: 'Import complete',
      detail: 'Customer import completed successfully.', route: 'data-import', entityRef: 'IMP-1',
    });

    const page = await listNotificationsWithin(db, SG, viewerId, { limit: 2 });
    expect(page.data.map((row) => row.id)).toEqual([second.id, first.id]);
    expect(page.nextCursor).toBe(first.id);
    const tail = await listNotificationsWithin(db, SG, viewerId, {
      limit: 2, cursor: page.nextCursor ?? undefined,
    });
    expect(tail.data).toEqual([expect.objectContaining({ subject: 'Viewer workspace is ready' })]);

    expect((await listNotificationsWithin(db, SG, adminId, { limit: 100 })).data)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: first.id })]));
    expect((await listNotificationsWithin(db, MY, adminId, { limit: 100 })).data)
      .toEqual([expect.objectContaining({ subject: 'Malaysia workspace is ready' })]);
    await expect(deliverNotificationWithin(db, MY, viewerId, {
      kind: 'system_notice', subject: 'Invalid recipient', detail: 'Must not cross company.',
    })).rejects.toThrow('recipient is unavailable');
  });

  it('returns a bounded public shape and persists idempotent read/dismiss state', async () => {
    const created = await deliverNotificationWithin(db, SG, viewerId, {
      kind: 'quality_attention', severity: 'critical', subject: 'Inspection blocked',
      detail: 'Lot LOT-1 remains on quality hold.', route: 'qc-inspection', entityRef: 'LOT-1',
    }, new Date('2026-07-23T01:00:00Z'));
    expect(Object.keys(created)).toEqual([
      'id', 'kind', 'category', 'severity', 'subject', 'detail', 'route', 'entityRef',
      'deliveredAt', 'readAt', 'dismissedAt', 'version',
    ]);
    expect(JSON.stringify(created)).not.toContain('recipientUserId');
    expect(JSON.stringify(created)).not.toContain('masterFn');
    expect(JSON.stringify(created)).not.toContain('companyFn');

    const read = await markNotificationReadWithin(
      db, SG, viewerId, created.id, new Date('2026-07-23T02:00:00Z'),
    );
    expect(read).toMatchObject({ id: created.id, version: 2 });
    expect(read.readAt).toEqual(new Date('2026-07-23T02:00:00Z'));
    expect((await markNotificationReadWithin(db, SG, viewerId, created.id)).version).toBe(2);

    const dismissed = await dismissNotificationWithin(
      db, SG, viewerId, created.id, new Date('2026-07-23T03:00:00Z'),
    );
    expect(dismissed).toMatchObject({ id: created.id, version: 3 });
    expect(dismissed.dismissedAt).toEqual(new Date('2026-07-23T03:00:00Z'));
    expect((await dismissNotificationWithin(db, SG, viewerId, created.id)).version).toBe(3);
    expect((await listNotificationsWithin(db, SG, viewerId, { limit: 100 })).data)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id })]));
    await expect(markNotificationReadWithin(db, SG, adminId, created.id))
      .rejects.toThrow('unavailable for this user');
  });

  it('rejects invalid delivery vocabulary before writing', async () => {
    await expect(deliverNotificationWithin(db, SG, adminId, {
      kind: 'system_notice', subject: 'Bad route', detail: 'Invalid route test.', route: '../secret',
    })).rejects.toThrow('registered-style route key');
    expect(await db.select().from(appUser).where(and(
      eq(appUser.masterFn, 'M1'), eq(appUser.userId, adminId),
    ))).toHaveLength(1);
  });
});
