import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../../data/db';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { appendAudit } from '../../api/audit';
import {
  listPersonalActivityWithin,
  personalActivityActionKind,
  personalActivityCategory,
  personalActivityEntityKey,
} from './activity';

describe('personal activity read model', () => {
  let db: DB;

  beforeEach(async () => {
    db = await freshDb();
    await seedDemo(db);
  });

  it('returns only the current actor and company, newest first, without audit payloads', async () => {
    await appendAudit(db, { masterFn: 'M1', companyFn: 'C-SG', actorUserId: 1, requestId: 'mine-1', entity: 'sales/orders', entityId: 10, action: 'create', after: { password: 'never expose' } });
    await appendAudit(db, { masterFn: 'M1', companyFn: 'C-SG', actorUserId: 2, requestId: 'other-user', entity: 'sales/orders', entityId: 11, action: 'create' });
    await appendAudit(db, { masterFn: 'M1', companyFn: 'C-MY', actorUserId: 1, requestId: 'other-company', entity: 'finance/journals', entityId: 12, action: 'post' });
    await appendAudit(db, { masterFn: 'M1', companyFn: 'C-SG', actorUserId: 1, requestId: 'mine-2', entity: 'finance/journals', entityId: 13, action: 'post', before: { token: 'never expose' } });

    const result = await listPersonalActivityWithin(db, { masterFn: 'M1', companyFn: 'C-SG' }, 1, { limit: 10 });
    expect(result.data.map((row) => row.entityId)).toEqual(['13', '10']);
    expect(result.data[0]).toEqual(expect.objectContaining({ category: 'finance', entityKey: 'journals', actionKind: 'post' }));
    expect(Object.keys(result.data[0])).toEqual(['id', 'category', 'entityKey', 'entityId', 'actionKind', 'occurredAt']);
  });

  it('uses descending keyset pagination', async () => {
    for (let n = 1; n <= 3; n += 1) {
      await appendAudit(db, { masterFn: 'M1', companyFn: 'C-SG', actorUserId: 1, requestId: `page-${n}`, entity: 'inventory/adjustments', entityId: n, action: 'create' });
    }
    const first = await listPersonalActivityWithin(db, { masterFn: 'M1', companyFn: 'C-SG' }, 1, { limit: 2 });
    const second = await listPersonalActivityWithin(db, { masterFn: 'M1', companyFn: 'C-SG' }, 1, { limit: 2, cursor: first.nextCursor ?? undefined });
    expect(first.data.map((row) => row.entityId)).toEqual(['3', '2']);
    expect(second.data.map((row) => row.entityId)).toEqual(['1']);
    expect(second.nextCursor).toBeNull();
  });

  it('maps raw audit vocabulary to a bounded public vocabulary', () => {
    expect(personalActivityCategory('purchasing/purchase-orders')).toBe('purchasing');
    expect(personalActivityCategory('private_internal_table')).toBe('system');
    expect(personalActivityEntityKey('private_internal_table')).toBe('record');
    expect(personalActivityActionKind('set_permission')).toBe('update');
    expect(personalActivityActionKind('unexpected-secret-action')).toBe('other');
  });
});
