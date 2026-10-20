import { resolveOrganizationEmployeeIdsWithin } from '../../auth/organizationScope';
import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq, isNotNull } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { appUser, auditLog, employee } from '../../data/schema';
import { freshDb } from '../../test/helpers';
import { seedDemo } from '../../data/seed';
import { assignEmployeeOrganizationWithin, listOrganizationWithin, saveOrganizationWithin } from './organization';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
let db: DB;
let actor: { userId: number; requestId: string };
beforeAll(async () => {
  db = await freshDb(); await seedDemo(db);
  const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
  actor = { userId: admin.userId, requestId: 'organization-synthetic-regression' };
});
describe('company-owned organization masters', () => {
  it('normalizes codes, rejects duplicates/stale versions, audits and hides other companies', async () => {
    const created = await db.transaction(tx => saveOrganizationWithin(tx, scope, actor, 'business_unit', {
      code: 'ops', name: 'Fictional Operations', isActive: true, expectedVersion: 0,
    }));
    expect(created).toMatchObject({ code: 'OPS', version: 1 });
    await expect(db.transaction(tx => saveOrganizationWithin(tx, scope, actor, 'business_unit', {
      code: 'OPS', name: 'Duplicate', isActive: true, expectedVersion: 0,
    }))).rejects.toMatchObject({ code: 'organization_code_conflict' });
    await expect(db.transaction(tx => saveOrganizationWithin(tx, scope, actor, 'business_unit', {
      id: created.id, code: 'OPS', name: 'Stale', isActive: true, expectedVersion: 0,
    }))).rejects.toMatchObject({ code: 'organization_version_conflict' });
    expect(await listOrganizationWithin(db, { masterFn: 'M1', companyFn: 'C-MY' }, 'business_unit')).toEqual([]);
    expect(await listOrganizationWithin(db, { masterFn: 'OTHER-MASTER', companyFn: 'C-SG' }, 'business_unit')).toEqual([]);
    const audits = await db.select().from(auditLog).where(and(eq(auditLog.entity, 'hr_business_unit'), eq(auditLog.entityId, String(created.id))));
    expect(audits).toHaveLength(1);
  });
  it('validates bounded fields and same-company master identity', async () => {
    await expect(db.transaction(tx => saveOrganizationWithin(tx, scope, actor, 'position', {
      code: 'bad code', name: '', isActive: true, expectedVersion: 0,
    }))).rejects.toMatchObject({ code: 'organization_validation_failed' });
    const foreign = await db.transaction(tx => saveOrganizationWithin(tx, { masterFn: 'M1', companyFn: 'C-MY' }, actor, 'position', {
      code: 'ANALYST', name: 'Fictional Analyst', isActive: true, expectedVersion: 0,
    }));
    const [staff] = await db.select().from(employee).where(and(eq(employee.masterFn, 'M1'), eq(employee.companyFn, 'C-SG'), isNotNull(employee.userId))).limit(1);
    await expect(db.transaction(tx => assignEmployeeOrganizationWithin(tx, scope, actor, {
      employeeId: staff.id, businessUnitId: null, positionId: foreign.id, expectedVersion: 0, reason: 'Synthetic cross-company denial',
    }))).rejects.toMatchObject({ code: 'organization_target_unavailable' });
    await expect(db.update(employee).set({ positionId: foreign.id }).where(eq(employee.id, staff.id))).rejects.toThrow();
  });
  it('assigns explicitly, preserves legacy labels, rejects stale and inactive targets, and permits reasoned unassignment', async () => {
    const [staff] = await db.select().from(employee).where(and(eq(employee.masterFn, 'M1'), eq(employee.companyFn, 'C-SG'), isNotNull(employee.userId))).limit(1);
    expect(staff.businessUnitId).toBeNull(); expect(staff.positionId).toBeNull();
    const unit = await db.transaction(tx => saveOrganizationWithin(tx, scope, actor, 'business_unit', {
      code: 'FIN', name: 'Fictional Finance', isActive: true, expectedVersion: 0,
    }));
    expect(await resolveOrganizationEmployeeIdsWithin(db, scope, staff.userId!, 'business_unit')).toEqual([]);
    const saved = await db.transaction(tx => assignEmployeeOrganizationWithin(tx, scope, actor, {
      employeeId: staff.id, businessUnitId: unit.id, positionId: null, expectedVersion: 0, reason: 'Explicit synthetic assignment',
    }));
    expect(saved).toMatchObject({ businessUnitId: unit.id, organizationVersion: 1, department: staff.department, jobTitle: staff.jobTitle });
    expect(staff.userId).toBeGreaterThan(0);
    {
      expect(await resolveOrganizationEmployeeIdsWithin(db, scope, staff.userId!, 'business_unit')).toContain(staff.id);
      expect(await resolveOrganizationEmployeeIdsWithin(db, { masterFn: 'OTHER', companyFn: scope.companyFn }, staff.userId!, 'business_unit')).toEqual([]);
      expect(await resolveOrganizationEmployeeIdsWithin(db, scope, staff.userId!, 'position')).toEqual([]);
    }
    await expect(db.transaction(tx => assignEmployeeOrganizationWithin(tx, scope, actor, {
      employeeId: staff.id, businessUnitId: null, positionId: null, expectedVersion: 0, reason: 'Stale request',
    }))).rejects.toMatchObject({ code: 'organization_version_conflict' });
    await db.transaction(tx => saveOrganizationWithin(tx, scope, actor, 'business_unit', {
      id: unit.id, code: unit.code, name: unit.name, isActive: false, expectedVersion: 1,
    }));
    if (staff.userId) expect(await resolveOrganizationEmployeeIdsWithin(db, scope, staff.userId!, 'business_unit')).toEqual([]);
    await expect(db.transaction(tx => assignEmployeeOrganizationWithin(tx, scope, actor, {
      employeeId: staff.id, businessUnitId: unit.id, positionId: null, expectedVersion: 1, reason: 'Inactive target request',
    }))).rejects.toMatchObject({ code: 'organization_target_unavailable' });
    expect(await db.transaction(tx => assignEmployeeOrganizationWithin(tx, scope, actor, {
      employeeId: staff.id, businessUnitId: null, positionId: null, expectedVersion: 1, reason: 'Reasoned unassignment',
    }))).toMatchObject({ businessUnitId: null, positionId: null, organizationVersion: 2 });
  });
});
