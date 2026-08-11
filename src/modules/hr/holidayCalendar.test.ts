import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../../data/seed';
import {
  appUser,
  workingCalendar,
  workingCalendarVersion,
} from '../../data/schema';
import { freshDb } from '../../test/helpers';
import {
  addCalendarHoliday,
  confirmOfficialHoliday,
} from './leavePolicy';
import { listCalendarHolidaysWithin } from './holidayCalendar';
import {
  createCalendarHolidayDraftWithin,
  decideCalendarHolidayWithin,
  submitCalendarHolidayWithin,
  updateCalendarHolidayDraftWithin,
} from './holidayManagement';

const singapore = { masterFn: 'M1', companyFn: 'C-SG' };
const malaysia = { masterFn: 'M1', companyFn: 'C-MY' };

describe('HR holiday calendar read model', () => {
  it('returns tenant-scoped official, company and substitute holiday facts', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select({ userId: appUser.userId })
      .from(appUser).where(eq(appUser.username, 'admin')).limit(1);
    const [calendar] = await db.select({ id: workingCalendar.id })
      .from(workingCalendar).where(and(
        eq(workingCalendar.masterFn, singapore.masterFn),
        eq(workingCalendar.companyFn, singapore.companyFn),
        eq(workingCalendar.isDefault, true),
      )).limit(1);
    const [version] = await db.select({ id: workingCalendarVersion.id })
      .from(workingCalendarVersion).where(and(
        eq(workingCalendarVersion.masterFn, singapore.masterFn),
        eq(workingCalendarVersion.companyFn, singapore.companyFn),
        eq(workingCalendarVersion.calendarId, calendar.id),
      )).limit(1);

    const substitute = await addCalendarHoliday(db, singapore, {
      calendarVersionId: version.id,
      holidayDate: '2026-08-10',
      name: 'National Day observed substitute day',
      source: 'official',
      country: 'SG',
      actorUserId: admin.userId,
    });
    await confirmOfficialHoliday(db, singapore, substitute.id, admin.userId);

    const result = await listCalendarHolidaysWithin(db, singapore, {
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(result.calendar).toMatchObject({ code: 'SG-STANDARD' });
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'National Day import', source: 'official', status: 'draft', isSubstitute: false,
      }),
      expect.objectContaining({
        name: 'Company year-end holiday', source: 'company', status: 'confirmed', isSubstitute: false,
      }),
      expect.objectContaining({
        name: 'National Day observed substitute day',
        source: 'official', status: 'confirmed', isSubstitute: true,
      }),
    ]));

    const otherTenant = await listCalendarHolidaysWithin(db, malaysia, {
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(otherTenant.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Company year-end holiday' }),
    ]));
  });

  it('rejects invalid and oversized ranges before querying holiday facts', async () => {
    const db = await freshDb();
    await seedDemo(db);
    await expect(listCalendarHolidaysWithin(db, singapore, {
      from: '2026-01-01', to: '2027-01-02',
    })).rejects.toMatchObject({
      code: 'calendar_range_too_large',
    });
    await expect(listCalendarHolidaysWithin(db, singapore, {
      from: '2026-02-01', to: '2026-01-01',
    })).rejects.toMatchObject({
      code: 'calendar_range_invalid',
    });
  });

  it('governs managed holiday changes with optimistic versioning', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select({ userId: appUser.userId })
      .from(appUser).where(eq(appUser.username, 'admin')).limit(1);
    const [version] = await db.select({ id: workingCalendarVersion.id })
      .from(workingCalendarVersion).where(and(
        eq(workingCalendarVersion.masterFn, singapore.masterFn),
        eq(workingCalendarVersion.companyFn, singapore.companyFn),
      )).limit(1);
    const run = <T>(command: (tx: typeof db) => Promise<T>) => db.transaction(command);

    const created = await run((tx) => createCalendarHolidayDraftWithin(tx, singapore, {
      calendarVersionId: version.id,
      holidayDate: '2026-09-01',
      name: 'Company wellness day',
      source: 'company',
      country: 'SG',
    }));
    expect(created).toMatchObject({ status: 'draft', recordVersion: 1 });

    const edited = await run((tx) => updateCalendarHolidayDraftWithin(tx, singapore, created.id, 1, {
      calendarVersionId: version.id,
      holidayDate: '2026-09-01',
      name: 'Company wellness day (revised)',
      source: 'company',
      country: 'SG',
    }));
    expect(edited).toMatchObject({ status: 'draft', recordVersion: 2 });

    const submitted = await run((tx) => submitCalendarHolidayWithin(
      tx, singapore, created.id, 2, admin.userId,
    ));
    expect(submitted).toMatchObject({ status: 'pending_approval', recordVersion: 3 });

    const approved = await run((tx) => decideCalendarHolidayWithin(
      tx, singapore, created.id, 3, 'approve', admin.userId,
    ));
    expect(approved).toMatchObject({ status: 'confirmed', recordVersion: 4, decision: 'approve' });

    await expect(run((tx) => submitCalendarHolidayWithin(
      tx, singapore, created.id, 3, admin.userId,
    ))).rejects.toMatchObject({ code: 'holiday_version_conflict' });
    await expect(run((tx) => updateCalendarHolidayDraftWithin(tx, malaysia, created.id, 4, {
      calendarVersionId: version.id,
      holidayDate: '2026-09-01',
      name: 'Cross tenant attempt',
      source: 'company',
      country: 'MY',
    }))).rejects.toMatchObject({ code: 'holiday_not_found' });
  });

  it('persists a rejection reason and permits correction after rejection', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select({ userId: appUser.userId })
      .from(appUser).where(eq(appUser.username, 'admin')).limit(1);
    const [version] = await db.select({ id: workingCalendarVersion.id })
      .from(workingCalendarVersion).where(and(
        eq(workingCalendarVersion.masterFn, singapore.masterFn),
        eq(workingCalendarVersion.companyFn, singapore.companyFn),
      )).limit(1);
    const run = <T>(command: (tx: typeof db) => Promise<T>) => db.transaction(command);
    const created = await run((tx) => createCalendarHolidayDraftWithin(tx, singapore, {
      calendarVersionId: version.id,
      holidayDate: '2026-10-01',
      name: 'Draft holiday',
      source: 'official',
      country: 'SG',
    }));
    await run((tx) => submitCalendarHolidayWithin(tx, singapore, created.id, 1, admin.userId));
    const rejected = await run((tx) => decideCalendarHolidayWithin(
      tx, singapore, created.id, 2, 'reject', admin.userId, 'Use the gazetted date.',
    ));
    expect(rejected).toMatchObject({ status: 'rejected', decision: 'reject', recordVersion: 3 });
    const corrected = await run((tx) => updateCalendarHolidayDraftWithin(tx, singapore, created.id, 3, {
      calendarVersionId: version.id,
      holidayDate: '2026-10-02',
      name: 'Corrected official holiday',
      source: 'official',
      country: 'SG',
    }));
    expect(corrected).toMatchObject({ status: 'draft', recordVersion: 4 });
  });
});
