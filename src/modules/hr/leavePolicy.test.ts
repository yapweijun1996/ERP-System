import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import {
  appUser,
  calendarHoliday,
  leavePolicyVersion,
  workingCalendarVersion,
} from '../../data/schema';
import { freshDb } from '../../test/helpers';
import {
  LeavePolicyError,
  addCalendarHoliday,
  calculateLeaveDuration,
  confirmLeavePolicyVersion,
  confirmOfficialHoliday,
  confirmWorkingCalendarVersion,
  createLeavePolicyVersion,
  createWorkingCalendarVersion,
  resolveLeavePolicyVersion,
  resolveWorkingCalendarVersion,
} from './leavePolicy';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };

describe('versioned leave policy calendar', () => {
  async function fixture() {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select().from(appUser).where(eq(appUser.username, 'admin'));
    const calendar = await createWorkingCalendarVersion(db, scope, {
      code: 'SG-POLICY-TEST',
      name: 'Singapore policy test calendar',
      timeZone: 'Asia/Singapore',
      isDefault: false,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      weekdays: [1, 2, 3, 4, 5],
    });
    await confirmWorkingCalendarVersion(db, scope, calendar.versionId, admin.userId);
    return { db, admin, calendar };
  }

  it('ignores official holiday drafts until HR confirms them', async () => {
    const data = await fixture();
    const official = await addCalendarHoliday(data.db, scope, {
      calendarVersionId: data.calendar.versionId,
      holidayDate: '2026-08-12',
      name: 'Official draft holiday',
      source: 'official',
      country: 'SG',
      actorUserId: data.admin.userId,
    });
    expect(official.status).toBe('draft');
    await expect(calculateLeaveDuration(data.db, scope, {
      calendarId: data.calendar.calendarId,
      startDate: '2026-08-10',
      endDate: '2026-08-14',
      unit: 'full_day',
    })).resolves.toMatchObject({ days: '5.00' });

    await confirmOfficialHoliday(data.db, scope, official.id, data.admin.userId);
    await expect(calculateLeaveDuration(data.db, scope, {
      calendarId: data.calendar.calendarId,
      startDate: '2026-08-10',
      endDate: '2026-08-14',
      unit: 'full_day',
    })).resolves.toMatchObject({
      days: '4.00',
      excludedDates: ['2026-08-12'],
    });
    const [stored] = await data.db.select().from(calendarHoliday)
      .where(eq(calendarHoliday.id, official.id));
    expect(stored).toMatchObject({
      source: 'official',
      status: 'confirmed',
      confirmedByUserId: data.admin.userId,
    });
  });

  it('treats company holidays as confirmed HR facts', async () => {
    const data = await fixture();
    const holiday = await addCalendarHoliday(data.db, scope, {
      calendarVersionId: data.calendar.versionId,
      holidayDate: '2026-08-13',
      name: 'Company anniversary',
      source: 'company',
      actorUserId: data.admin.userId,
    });
    expect(holiday.status).toBe('confirmed');
    await expect(calculateLeaveDuration(data.db, scope, {
      calendarId: data.calendar.calendarId,
      startDate: '2026-08-10',
      endDate: '2026-08-14',
      unit: 'full_day',
    })).resolves.toMatchObject({ days: '4.00' });
  });

  it('calculates full and half days deterministically and rejects hourly leave', async () => {
    const data = await fixture();
    await expect(calculateLeaveDuration(data.db, scope, {
      calendarId: data.calendar.calendarId,
      startDate: '2026-08-08',
      endDate: '2026-08-10',
      unit: 'full_day',
    })).resolves.toEqual({
      days: '1.00',
      unit: 'full_day',
      includedDates: ['2026-08-10'],
      excludedDates: ['2026-08-08', '2026-08-09'],
    });
    await expect(calculateLeaveDuration(data.db, scope, {
      calendarId: data.calendar.calendarId,
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      unit: 'half_day_am',
    })).resolves.toMatchObject({ days: '0.50', unit: 'half_day_am' });
    await expect(calculateLeaveDuration(data.db, scope, {
      calendarId: data.calendar.calendarId,
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      unit: 'hourly',
    })).rejects.toMatchObject({ code: 'hourly_leave_unsupported' });
    await expect(calculateLeaveDuration(data.db, scope, {
      calendarId: data.calendar.calendarId,
      startDate: '2026-08-08',
      endDate: '2026-08-08',
      unit: 'half_day_pm',
    })).rejects.toMatchObject({ code: 'half_day_not_working_day' });
  });

  it('retains non-overlapping effective calendar versions for historical resolution', async () => {
    const data = await fixture();
    const next = await createWorkingCalendarVersion(data.db, scope, {
      code: 'SG-POLICY-TEST',
      name: 'Singapore policy test calendar',
      timeZone: 'Asia/Singapore',
      effectiveFrom: '2027-01-01',
      weekdays: [1, 2, 3, 4],
    });
    await confirmWorkingCalendarVersion(data.db, scope, next.versionId, data.admin.userId);
    expect((await resolveWorkingCalendarVersion(
      data.db, scope, data.calendar.calendarId, '2026-12-31',
    )).versionNo).toBe(1);
    expect((await resolveWorkingCalendarVersion(
      data.db, scope, data.calendar.calendarId, '2027-01-01',
    )).versionNo).toBe(2);

    const overlap = await createWorkingCalendarVersion(data.db, scope, {
      code: 'SG-POLICY-TEST',
      name: 'Overlapping calendar',
      timeZone: 'Asia/Singapore',
      effectiveFrom: '2026-12-01',
      effectiveTo: '2027-02-01',
      weekdays: [1, 2, 3, 4, 5],
    });
    await expect(confirmWorkingCalendarVersion(
      data.db, scope, overlap.versionId, data.admin.userId,
    )).rejects.toMatchObject({ code: 'calendar_version_overlap' });
  });

  it('versions complete leave policy facts and resolves only confirmed periods', async () => {
    const data = await fixture();
    const current = await createLeavePolicyVersion(data.db, scope, {
      leaveTypeCode: 'ANNUAL-TEST',
      leaveTypeName: 'Annual leave test',
      paid: true,
      calendarId: data.calendar.calendarId,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      annualEntitlementDays: 14,
      accrualMethod: 'monthly',
      carryForwardDays: 5,
      carryExpiryMonths: 3,
      evidenceAfterDays: 2,
      staffingAction: 'extra_approval',
      minimumStaff: 2,
      encashmentAllowed: true,
      encashmentMaxDays: 3,
      eligibleEmploymentTypes: ['Full-time', 'Part-time'],
    });
    await expect(resolveLeavePolicyVersion(
      data.db, scope, current.leaveTypeId, '2026-07-01',
    )).rejects.toMatchObject({ code: 'leave_policy_not_effective' });
    await confirmLeavePolicyVersion(
      data.db, scope, current.policyVersionId, data.admin.userId,
    );
    const resolved = await resolveLeavePolicyVersion(
      data.db, scope, current.leaveTypeId, '2026-07-01',
    );
    expect(resolved).toMatchObject({
      versionNo: 1,
      annualEntitlementDays: '14.00',
      accrualMethod: 'monthly',
      carryForwardDays: '5.00',
      evidenceAfterDays: '2.00',
      staffingAction: 'extra_approval',
      minimumStaff: 2,
      encashmentAllowed: true,
      encashmentMaxDays: '3.00',
      eligibleEmploymentTypes: ['Full-time', 'Part-time'],
    });
    const next = await createLeavePolicyVersion(data.db, scope, {
      leaveTypeCode: 'ANNUAL-TEST',
      leaveTypeName: 'Annual leave test',
      paid: true,
      calendarId: data.calendar.calendarId,
      effectiveFrom: '2027-01-01',
      annualEntitlementDays: 16,
      accrualMethod: 'upfront',
    });
    await confirmLeavePolicyVersion(data.db, scope, next.policyVersionId, data.admin.userId);
    expect((await resolveLeavePolicyVersion(
      data.db, scope, current.leaveTypeId, '2027-01-01',
    )).versionNo).toBe(2);
    expect(await data.db.select().from(leavePolicyVersion).where(and(
      eq(leavePolicyVersion.masterFn, scope.masterFn),
      eq(leavePolicyVersion.companyFn, scope.companyFn),
      eq(leavePolicyVersion.leaveTypeId, current.leaveTypeId),
    ))).toHaveLength(2);
  });

  it('rejects hourly policy units and tenant-crossing confirmation', async () => {
    const data = await fixture();
    await expect(createLeavePolicyVersion(data.db, scope, {
      leaveTypeCode: 'HOURLY',
      leaveTypeName: 'Hourly leave',
      paid: true,
      calendarId: data.calendar.calendarId,
      effectiveFrom: '2026-01-01',
      annualEntitlementDays: 1,
      accrualMethod: 'upfront',
      unitMode: 'hourly',
    })).rejects.toBeInstanceOf(LeavePolicyError);
    const [version] = await data.db.select().from(workingCalendarVersion)
      .where(eq(workingCalendarVersion.id, data.calendar.versionId));
    expect(version.status).toBe('confirmed');
    await expect(confirmOfficialHoliday(
      data.db,
      { masterFn: 'OTHER', companyFn: 'OTHER' },
      999999,
      data.admin.userId,
    )).rejects.toMatchObject({ code: 'holiday_not_found' });
  });
});
