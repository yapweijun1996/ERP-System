import { readFileSync } from 'node:fs';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { company, role, rolePermission } from '../data/schema';
import { seedDemo } from '../data/seed';
import { freshDb } from '../test/helpers';

const COMPANY_RECEIPT_MUTATION_PERMISSIONS = [
  'expenses.company_receipts.create',
  'expenses.company_receipts.edit',
  'expenses.company_receipts.void',
];

describe('Company Receipt canonical permission migration', () => {
  it('backfills explicit receipt mutation grants from the legacy upload grant', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [employeeRole] = await db.select().from(role).where(and(
      eq(role.masterFn, 'M1'),
      eq(role.name, 'Employee'),
    ));
    await db.delete(rolePermission).where(and(
      eq(rolePermission.roleId, employeeRole.roleId),
      inArray(rolePermission.permissionKey, COMPANY_RECEIPT_MUTATION_PERMISSIONS),
    ));
    const [before] = await db.select({ version: company.authorizationVersion })
      .from(company).where(eq(company.companyFn, 'C-SG'));

    const migration = readFileSync(
      new URL('../../drizzle/0097_company_receipt_canonical_permissions.sql', import.meta.url),
      'utf8',
    );
    for (const statement of migration.split('--> statement-breakpoint')
      .map((value) => value.trim()).filter(Boolean)) {
      await db.execute(sql.raw(statement));
    }

    const grants = await db.select({ permissionKey: rolePermission.permissionKey })
      .from(rolePermission).where(and(
        eq(rolePermission.roleId, employeeRole.roleId),
        inArray(rolePermission.permissionKey, COMPANY_RECEIPT_MUTATION_PERMISSIONS),
        eq(rolePermission.allowed, true),
      ));
    expect(grants.map((grant) => grant.permissionKey).sort())
      .toEqual([...COMPANY_RECEIPT_MUTATION_PERMISSIONS].sort());
    const [after] = await db.select({ version: company.authorizationVersion })
      .from(company).where(eq(company.companyFn, 'C-SG'));
    expect(after.version).toBe(before.version + 1);
  });
});
