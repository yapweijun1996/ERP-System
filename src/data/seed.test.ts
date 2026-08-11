import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { employee } from './schema';
import { seedDemo } from './seed';
import { freshDb } from '../test/helpers';

describe('compact Demo HR starter roster', () => {
  it('seeds 18 fictional employees with company roots and reporting lines', async () => {
    const db = await freshDb();
    await seedDemo(db);

    const rows = await db.select({
      companyFn: employee.companyFn,
      employeeNo: employee.employeeNo,
      email: employee.email,
      managerId: employee.managerId,
    }).from(employee);

    expect(rows).toHaveLength(18);
    expect(rows.filter((row) => row.companyFn === 'C-SG')).toHaveLength(12);
    expect(rows.filter((row) => row.companyFn === 'C-MY')).toHaveLength(6);
    expect(rows.filter((row) => row.email.endsWith('@demo.example.test'))).toHaveLength(11);
    expect(rows.filter((row) => row.managerId === null)).toHaveLength(2);
    expect(rows).toContainEqual(expect.objectContaining({
      companyFn: 'C-SG', employeeNo: 'EMP-1095', email: 'jason.tan@demo.example.test',
    }));
    expect(rows).toContainEqual(expect.objectContaining({
      companyFn: 'C-MY', employeeNo: 'EMP-2000', email: 'amirul.rashid@demo.example.test',
    }));

    const sgEmployeeNumbers = await db.select({ employeeNo: employee.employeeNo })
      .from(employee)
      .where(and(eq(employee.masterFn, 'M1'), eq(employee.companyFn, 'C-SG')));
    expect(new Set(sgEmployeeNumbers.map((row) => row.employeeNo)).size)
      .toBe(sgEmployeeNumbers.length);
  });
});
