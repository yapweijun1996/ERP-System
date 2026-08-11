import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import { appUser, employee } from '../../data/schema';
import { freshDb } from '../../test/helpers';
import { resolveApprovalPolicyVersionWithin } from '../approval/workflow';
import {
  confirmLeaveApprovalWorkflowWithin,
  createLeaveApprovalWorkflowDraftWithin,
  listLeaveApprovalWorkflowsWithin,
  retireLeaveApprovalWorkflowWithin,
} from './leaveApprovalWorkflow';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

describe('leave approval workflow administration', () => {
  it('rejects a format-valid but unregistered approval permission', async () => {
    const db = await freshDb();
    await seedDemo(db);
    await expect(db.transaction((tx) => createLeaveApprovalWorkflowDraftWithin(tx, scope, {
      code: 'LEAVE-UNKNOWN-PERMISSION',
      name: 'Invalid permission workflow',
      effectiveFrom: '2026-08-01',
      steps: [{
        label: 'Unknown authority',
        authorityType: 'permission',
        authorityPermissionKey: 'finance.unknown.approve',
      }],
    }))).rejects.toMatchObject({ code: 'validation_failed' });
  });

  it('creates, confirms, resolves and retires a company/department rule', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const [subject] = await db.select().from(employee).where(eq(employee.userId, admin.userId));

    const draft = await db.transaction((tx) => createLeaveApprovalWorkflowDraftWithin(tx, scope, {
      code: 'LEAVE-WAREHOUSE',
      name: 'Warehouse annual leave',
      effectiveFrom: '2026-08-01',
      priority: 100,
      department: 'Warehouse',
      typeRef: 'ANNUAL',
      minimumDays: '3',
      maximumDays: '5',
      steps: [{
        label: 'HR review',
        authorityType: 'permission',
        authorityPermissionKey: 'hr.write',
        fallbackPermissionKey: 'hr.write',
      }],
    }));
    expect(draft).toMatchObject({
      code: 'LEAVE-WAREHOUSE',
      status: 'draft',
      department: 'Warehouse',
      typeRef: 'ANNUAL',
      minimumDays: '3.00',
      maximumDays: '5.00',
    });

    const confirmed = await db.transaction((tx) => confirmLeaveApprovalWorkflowWithin(
      tx, scope, draft.id, admin.userId,
    ));
    expect(confirmed).toMatchObject({ id: draft.id, status: 'confirmed', versionNo: 1 });

    const resolved = await resolveApprovalPolicyVersionWithin(db, scope, {
      domain: 'leave',
      effectiveDate: '2026-08-10',
      subjectEmployeeId: subject?.id ?? null,
      department: 'Warehouse',
      typeRef: 'ANNUAL',
      days: '3.00',
      amount: null,
      currency: null,
    });
    expect(resolved.policyCode).toBe('LEAVE-WAREHOUSE');

    const retired = await db.transaction((tx) => retireLeaveApprovalWorkflowWithin(
      tx, scope, confirmed.id,
    ));
    expect(retired.status).toBe('retired');
    expect((await listLeaveApprovalWorkflowsWithin(db, scope)).find(row => row.id === draft.id)?.status)
      .toBe('retired');
  });
});
