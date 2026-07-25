import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import {
  appUser,
  employee,
  leaveBalanceEntry,
  leavePolicyVersion,
  leaveType,
} from '../../data/schema';
import { freshDb } from '../../test/helpers';
import {
  LeaveBalanceError,
  appendLeaveBalanceEntry,
  projectLeaveBalance,
  reservePaidLeave,
  settlePaidLeaveReservation,
} from './leaveBalance';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

describe('immutable leave balance ledger', () => {
  async function fixture() {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const [subject] = await db.select().from(employee).where(eq(employee.employeeNo, 'EMP-1042'));
    const [annualType] = await db.select().from(leaveType).where(and(
      eq(leaveType.masterFn, scope.masterFn),
      eq(leaveType.companyFn, scope.companyFn),
      eq(leaveType.code, 'ANNUAL'),
    ));
    const [policy] = await db.select().from(leavePolicyVersion).where(and(
      eq(leavePolicyVersion.leaveTypeId, annualType.id),
      eq(leavePolicyVersion.status, 'confirmed'),
    ));
    const base = {
      employeeId: subject.id,
      leaveTypeId: annualType.id,
      policyVersionId: policy.id,
      effectiveDate: '2026-01-01',
      sourceType: 'test',
      createdByUserId: admin.userId,
    };
    return { db, admin, subject, annualType, policy, base };
  }

  it('reconciles grant, pending reservation and approved use exactly', async () => {
    const data = await fixture();
    await appendLeaveBalanceEntry(data.db, scope, {
      ...data.base,
      entryType: 'grant',
      entryKey: 'grant:annual:2026',
      balanceDelta: '14.00',
      reservedDelta: '0.00',
      sourceId: 'annual-2026',
    });
    expect(await projectLeaveBalance(
      data.db, scope, data.subject.id, data.annualType.id,
    )).toEqual({ balance: '14.00', reserved: '0.00', available: '14.00', entryCount: 1 });

    const reserved = await reservePaidLeave(data.db, scope, {
      employeeId: data.subject.id,
      leaveTypeId: data.annualType.id,
      policyVersionId: data.policy.id,
      days: '5.00',
      effectiveDate: '2026-08-10',
      requestReference: 'LR-TEST-1',
      actorUserId: data.admin.userId,
    });
    expect(reserved.projection).toEqual({
      balance: '14.00', reserved: '5.00', available: '9.00', entryCount: 2,
    });
    const reserveReplay = await reservePaidLeave(data.db, scope, {
      employeeId: data.subject.id,
      leaveTypeId: data.annualType.id,
      policyVersionId: data.policy.id,
      days: '5.00',
      effectiveDate: '2026-08-10',
      requestReference: 'LR-TEST-1',
      actorUserId: data.admin.userId,
    });
    expect(reserveReplay).toMatchObject({
      replayed: true,
      projection: { balance: '14.00', reserved: '5.00', available: '9.00', entryCount: 2 },
    });
    const used = await settlePaidLeaveReservation(data.db, scope, {
      employeeId: data.subject.id,
      leaveTypeId: data.annualType.id,
      policyVersionId: data.policy.id,
      days: '5.00',
      effectiveDate: '2026-08-10',
      requestReference: 'LR-TEST-1',
      outcome: 'use',
      actorUserId: data.admin.userId,
    });
    expect(used.replayed).toBe(false);
    const useReplay = await settlePaidLeaveReservation(data.db, scope, {
      employeeId: data.subject.id,
      leaveTypeId: data.annualType.id,
      policyVersionId: data.policy.id,
      days: '5.00',
      effectiveDate: '2026-08-10',
      requestReference: 'LR-TEST-1',
      outcome: 'use',
      actorUserId: data.admin.userId,
    });
    expect(useReplay.replayed).toBe(true);
    expect(await projectLeaveBalance(
      data.db, scope, data.subject.id, data.annualType.id,
    )).toEqual({ balance: '9.00', reserved: '0.00', available: '9.00', entryCount: 3 });
  });

  it('releases a rejected Pending reservation without consuming balance', async () => {
    const data = await fixture();
    await appendLeaveBalanceEntry(data.db, scope, {
      ...data.base,
      entryType: 'grant',
      entryKey: 'grant:release',
      balanceDelta: '8.00',
      reservedDelta: '0.00',
      sourceId: 'grant-release',
    });
    await reservePaidLeave(data.db, scope, {
      employeeId: data.subject.id,
      leaveTypeId: data.annualType.id,
      policyVersionId: data.policy.id,
      days: '2.50',
      effectiveDate: '2026-07-01',
      requestReference: 'LR-REJECT',
      actorUserId: data.admin.userId,
    });
    await settlePaidLeaveReservation(data.db, scope, {
      employeeId: data.subject.id,
      leaveTypeId: data.annualType.id,
      policyVersionId: data.policy.id,
      days: '2.50',
      effectiveDate: '2026-07-01',
      requestReference: 'LR-REJECT',
      outcome: 'release',
      actorUserId: data.admin.userId,
    });
    expect(await projectLeaveBalance(
      data.db, scope, data.subject.id, data.annualType.id,
    )).toMatchObject({ balance: '8.00', reserved: '0.00', available: '8.00' });
  });

  it('blocks insufficient paid balance with an explicit paid/unpaid split', async () => {
    const data = await fixture();
    await appendLeaveBalanceEntry(data.db, scope, {
      ...data.base,
      entryType: 'grant',
      entryKey: 'grant:split',
      balanceDelta: '2.50',
      reservedDelta: '0.00',
      sourceId: 'grant-split',
    });
    await expect(reservePaidLeave(data.db, scope, {
      employeeId: data.subject.id,
      leaveTypeId: data.annualType.id,
      policyVersionId: data.policy.id,
      days: '5.00',
      effectiveDate: '2026-08-10',
      requestReference: 'LR-SPLIT',
      actorUserId: data.admin.userId,
    })).rejects.toMatchObject({
      code: 'insufficient_paid_balance',
      details: {
        requestedDays: '5.00',
        availablePaidDays: '2.50',
        suggestedUnpaidDays: '2.50',
      },
    });
  });

  it('is idempotent by entry key and rejects conflicting replay', async () => {
    const data = await fixture();
    const input = {
      ...data.base,
      entryType: 'grant' as const,
      entryKey: 'grant:idempotent',
      balanceDelta: '4.00',
      reservedDelta: '0.00',
      sourceId: 'grant-idempotent',
    };
    expect((await appendLeaveBalanceEntry(data.db, scope, input)).replayed).toBe(false);
    expect((await appendLeaveBalanceEntry(data.db, scope, input)).replayed).toBe(true);
    await expect(appendLeaveBalanceEntry(data.db, scope, {
      ...input,
      balanceDelta: '5.00',
    })).rejects.toMatchObject({ code: 'entry_key_conflict' });
    await expect(appendLeaveBalanceEntry(data.db, scope, {
      ...input,
      effectiveDate: '2026-01-02',
    })).rejects.toMatchObject({ code: 'entry_key_conflict' });
  });

  it('projects accrual, carry-forward, adjustment, expiry, encashment and cancellation events', async () => {
    const data = await fixture();
    const events = [
      ['grant', '10.00'],
      ['accrual', '1.50'],
      ['carry_forward', '2.00'],
      ['adjustment', '-0.50'],
      ['cancellation', '1.00'],
      ['expiry', '-0.50'],
      ['encashment', '-1.00'],
    ] as const;
    for (const [entryType, balanceDelta] of events) {
      await appendLeaveBalanceEntry(data.db, scope, {
        ...data.base,
        entryType,
        entryKey: `event:${entryType}`,
        balanceDelta,
        reservedDelta: '0.00',
        sourceId: entryType,
      });
    }
    expect(await projectLeaveBalance(
      data.db, scope, data.subject.id, data.annualType.id,
    )).toEqual({ balance: '12.50', reserved: '0.00', available: '12.50', entryCount: 7 });
  });

  it('enforces half-day increments and tenant context', async () => {
    const data = await fixture();
    await expect(appendLeaveBalanceEntry(data.db, scope, {
      ...data.base,
      entryType: 'grant',
      entryKey: 'grant:quarter',
      balanceDelta: '0.25',
      reservedDelta: '0.00',
      sourceId: 'quarter',
    })).rejects.toBeInstanceOf(LeaveBalanceError);
    await expect(appendLeaveBalanceEntry(data.db, {
      masterFn: 'OTHER',
      companyFn: 'OTHER',
    }, {
      ...data.base,
      entryType: 'grant',
      entryKey: 'grant:cross-tenant',
      balanceDelta: '1.00',
      reservedDelta: '0.00',
      sourceId: 'cross-tenant',
    })).rejects.toMatchObject({ code: 'ledger_context_mismatch' });
  });

  it('prevents UPDATE and DELETE at the database boundary', async () => {
    const data = await fixture();
    const result = await appendLeaveBalanceEntry(data.db, scope, {
      ...data.base,
      entryType: 'grant',
      entryKey: 'grant:immutable',
      balanceDelta: '3.00',
      reservedDelta: '0.00',
      sourceId: 'immutable',
    });
    await expect(data.db.update(leaveBalanceEntry).set({ note: 'rewrite' })
      .where(eq(leaveBalanceEntry.id, result.id))).rejects.toThrow();
    await expect(data.db.delete(leaveBalanceEntry)
      .where(eq(leaveBalanceEntry.id, result.id))).rejects.toThrow();
    const [stored] = await data.db.select().from(leaveBalanceEntry)
      .where(eq(leaveBalanceEntry.id, result.id));
    expect(stored.note).toBeNull();
  });

  it('serializes competing reservations so paid balance cannot be overspent', async () => {
    const data = await fixture();
    await appendLeaveBalanceEntry(data.db, scope, {
      ...data.base,
      entryType: 'grant',
      entryKey: 'grant:race',
      balanceDelta: '10.00',
      reservedDelta: '0.00',
      sourceId: 'race',
    });
    const reserve = (reference: string) => reservePaidLeave(data.db, scope, {
      employeeId: data.subject.id,
      leaveTypeId: data.annualType.id,
      policyVersionId: data.policy.id,
      days: '8.00',
      effectiveDate: '2026-09-01',
      requestReference: reference,
      actorUserId: data.admin.userId,
    });
    const results = await Promise.allSettled([reserve('LR-RACE-A'), reserve('LR-RACE-B')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await projectLeaveBalance(
      data.db, scope, data.subject.id, data.annualType.id,
    )).toMatchObject({ balance: '10.00', reserved: '8.00', available: '2.00' });
  });
});
