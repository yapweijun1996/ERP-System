import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, TEST_SCOPE as SCOPE } from '../../test/helpers';
import { employee, leaveRequest as leaveRequestTable } from '../../data/schema';
import { createEmployee } from './employee';
import {
  createLeaveRequest, decideLeaveRequest, InvalidLeaveRequestStateError,
} from './leaveRequest';

async function seedEmployee(db: Awaited<ReturnType<typeof freshDb>>, employeeNo = 'EMP-L1') {
  return createEmployee(db, SCOPE, {
    employeeNo, fullName: 'Leave Test Employee', email: `${employeeNo.toLowerCase()}@example.test`,
    department: 'Operations', jobTitle: 'Analyst', startDate: '2024-01-01', baseSalary: '4000.00',
  });
}

describe('createLeaveRequest', () => {
  it('success: computes an inclusive day count and starts pending', async () => {
    const db = await freshDb();
    const emp = await seedEmployee(db);
    const res = await createLeaveRequest(db, SCOPE, {
      employeeId: emp.id, leaveType: 'Annual', startDate: '2026-08-10', endDate: '2026-08-14',
      reason: 'Trip',
    });
    expect(res.id).toBeGreaterThan(0);
    const [row] = await db.select().from(leaveRequestTable).where(eq(leaveRequestTable.id, res.id));
    expect(row.days).toBe(5);
    expect(row.status).toBe('pending');
  });

  it('rejects an invalid leaveType', async () => {
    const db = await freshDb();
    const emp = await seedEmployee(db);
    await expect(createLeaveRequest(db, SCOPE, {
      employeeId: emp.id, leaveType: 'Sabbatical', startDate: '2026-08-10', endDate: '2026-08-14',
    })).rejects.toThrow(InvalidLeaveRequestStateError);
  });

  it('rejects endDate before startDate', async () => {
    const db = await freshDb();
    const emp = await seedEmployee(db);
    await expect(createLeaveRequest(db, SCOPE, {
      employeeId: emp.id, leaveType: 'Annual', startDate: '2026-08-14', endDate: '2026-08-10',
    })).rejects.toThrow(InvalidLeaveRequestStateError);
  });

  it('rejects a nonexistent employeeId', async () => {
    const db = await freshDb();
    await expect(createLeaveRequest(db, SCOPE, {
      employeeId: 999999, leaveType: 'Annual', startDate: '2026-08-10', endDate: '2026-08-14',
    })).rejects.toThrow(InvalidLeaveRequestStateError);
  });

  it('rejects a request for an inactive employee', async () => {
    const db = await freshDb();
    const emp = await seedEmployee(db);
    await db.update(employee).set({ isActive: false }).where(eq(employee.id, emp.id));
    await expect(createLeaveRequest(db, SCOPE, {
      employeeId: emp.id, leaveType: 'Annual', startDate: '2026-08-10', endDate: '2026-08-14',
    })).rejects.toThrow(InvalidLeaveRequestStateError);
  });
});

describe('decideLeaveRequest', () => {
  it('approves a pending request', async () => {
    const db = await freshDb();
    const emp = await seedEmployee(db);
    const lv = await createLeaveRequest(db, SCOPE, {
      employeeId: emp.id, leaveType: 'Annual', startDate: '2026-08-10', endDate: '2026-08-14',
    });
    const res = await decideLeaveRequest(db, SCOPE, lv.id, 'approved');
    expect(res).toEqual({ id: lv.id, status: 'approved' });
  });

  it('rejects a pending request with a reason', async () => {
    const db = await freshDb();
    const emp = await seedEmployee(db);
    const lv = await createLeaveRequest(db, SCOPE, {
      employeeId: emp.id, leaveType: 'Unpaid', startDate: '2026-07-01', endDate: '2026-07-05',
    });
    const res = await decideLeaveRequest(db, SCOPE, lv.id, 'rejected', 'Peak week');
    expect(res).toEqual({ id: lv.id, status: 'rejected' });
  });

  it('requires a reason when rejecting', async () => {
    const db = await freshDb();
    const emp = await seedEmployee(db);
    const lv = await createLeaveRequest(db, SCOPE, {
      employeeId: emp.id, leaveType: 'Annual', startDate: '2026-08-10', endDate: '2026-08-14',
    });
    await expect(decideLeaveRequest(db, SCOPE, lv.id, 'rejected', null))
      .rejects.toThrow(InvalidLeaveRequestStateError);
  });

  it('rejects deciding an already-decided request', async () => {
    const db = await freshDb();
    const emp = await seedEmployee(db);
    const lv = await createLeaveRequest(db, SCOPE, {
      employeeId: emp.id, leaveType: 'Annual', startDate: '2026-08-10', endDate: '2026-08-14',
    });
    await decideLeaveRequest(db, SCOPE, lv.id, 'approved');
    await expect(decideLeaveRequest(db, SCOPE, lv.id, 'rejected', 'too late'))
      .rejects.toThrow(InvalidLeaveRequestStateError);
  });

  it('rejects deciding a request outside the caller tenant', async () => {
    const db = await freshDb();
    const emp = await seedEmployee(db);
    const lv = await createLeaveRequest(db, SCOPE, {
      employeeId: emp.id, leaveType: 'Annual', startDate: '2026-08-10', endDate: '2026-08-14',
    });
    await expect(decideLeaveRequest(db, { masterFn: 'OTHER-M', companyFn: 'OTHER-C' }, lv.id, 'approved'))
      .rejects.toThrow(InvalidLeaveRequestStateError);
  });
});
