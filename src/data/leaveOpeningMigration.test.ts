import { readFileSync } from 'node:fs';
import { and, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import { createPgliteDb } from './db';
import { seedDemo } from './seed';
import { employee, leaveBalanceEntry, leaveType } from './schema';

const BACKFILL = readFileSync(
  new URL('../../drizzle/0074_employee_leave_opening.sql', import.meta.url),
  'utf8',
);

describe('employee annual-leave opening migration', () => {
  it('backfills a legacy employee once without changing existing ledgers', async () => {
    const db = await createPgliteDb();
    await migrate(db, { migrationsFolder: 'drizzle' });
    await seedDemo(db);
    const [legacy] = await db.insert(employee).values({
      masterFn: 'M1', companyFn: 'C-SG', employeeNo: 'EMP-LEGACY-OPENING',
      fullName: 'Legacy Opening', email: 'legacy.opening@example.test',
      department: 'Finance', jobTitle: 'Analyst', employmentType: 'Full-time',
      startDate: '2020-01-01', annualLeaveDays: 14, baseSalary: '4000.00',
    }).returning({ id: employee.id });
    const [annual] = await db.select({ id: leaveType.id }).from(leaveType).where(and(
      eq(leaveType.masterFn, 'M1'),
      eq(leaveType.companyFn, 'C-SG'),
      eq(leaveType.code, 'ANNUAL'),
    ));

    await db.execute(sql.raw(BACKFILL));
    await db.execute(sql.raw(BACKFILL));

    const entries = await db.select().from(leaveBalanceEntry).where(and(
      eq(leaveBalanceEntry.employeeId, legacy.id),
      eq(leaveBalanceEntry.leaveTypeId, annual.id),
    ));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      entryType: 'grant',
      entryKey: `employee:${legacy.id}:annual-opening`,
      balanceDelta: '14.00',
      reservedDelta: '0.00',
      effectiveDate: '2026-01-01',
      sourceType: 'employee_opening',
    });
  });
});
