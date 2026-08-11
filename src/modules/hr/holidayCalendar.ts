import {
  and, asc, desc, eq, gte, inArray, isNull, lte, or,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  calendarHoliday,
  workingCalendar,
  workingCalendarVersion,
} from '../../data/schema';

export class HolidayCalendarError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'HolidayCalendarError';
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string, field: string): Date {
  if (!ISO_DATE.test(value)) {
    throw new HolidayCalendarError(
      'calendar_date_invalid',
      `${field} must use YYYY-MM-DD.`,
    );
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HolidayCalendarError(
      'calendar_date_invalid',
      `${field} is not a valid date.`,
    );
  }
  return date;
}

/**
 * The current schema stores observed/substitute wording in the authoritative
 * holiday name. Keep the derived flag read-only so the page can render a
 * useful badge without changing historical facts or requiring a migration.
 */
function isSubstituteHoliday(name: string): boolean {
  return /\b(substitute|replacement|observed|ganti|pengganti)\b|替代|补假|振替|代休/i.test(name);
}

export interface HolidayCalendarQuery {
  from: string;
  to: string;
}

export async function listCalendarHolidaysWithin(
  exec: DB,
  scope: Scope,
  query: HolidayCalendarQuery,
) {
  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  if (from > to) {
    throw new HolidayCalendarError(
      'calendar_range_invalid',
      'from must not be after to.',
    );
  }
  const rangeDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (rangeDays > 366) {
    throw new HolidayCalendarError(
      'calendar_range_too_large',
      'A holiday calendar request may cover at most 366 days.',
    );
  }

  const [calendar] = await exec.select({
    id: workingCalendar.id,
    code: workingCalendar.code,
    name: workingCalendar.name,
    timeZone: workingCalendar.timeZone,
    isDefault: workingCalendar.isDefault,
  }).from(workingCalendar).where(and(
    eq(workingCalendar.masterFn, scope.masterFn),
    eq(workingCalendar.companyFn, scope.companyFn),
  )).orderBy(desc(workingCalendar.isDefault), asc(workingCalendar.id)).limit(1);

  if (!calendar) {
    return {
      calendar: null,
      versions: [],
      items: [],
      from: query.from,
      to: query.to,
    };
  }

  const versions = await exec.select({
    id: workingCalendarVersion.id,
    versionNo: workingCalendarVersion.versionNo,
    effectiveFrom: workingCalendarVersion.effectiveFrom,
    effectiveTo: workingCalendarVersion.effectiveTo,
    status: workingCalendarVersion.status,
  }).from(workingCalendarVersion).where(and(
    eq(workingCalendarVersion.masterFn, scope.masterFn),
    eq(workingCalendarVersion.companyFn, scope.companyFn),
    eq(workingCalendarVersion.calendarId, calendar.id),
    lte(workingCalendarVersion.effectiveFrom, query.to),
    or(
      isNull(workingCalendarVersion.effectiveTo),
      gte(workingCalendarVersion.effectiveTo, query.from),
    ),
  )).orderBy(asc(workingCalendarVersion.effectiveFrom), asc(workingCalendarVersion.versionNo));

  const versionIds = versions.map((version) => version.id);
  if (!versionIds.length) {
    return {
      calendar,
      versions,
      items: [],
      from: query.from,
      to: query.to,
    };
  }

  const rows = await exec.select({
    id: calendarHoliday.id,
    holidayDate: calendarHoliday.holidayDate,
    name: calendarHoliday.name,
    source: calendarHoliday.source,
    country: calendarHoliday.country,
    status: calendarHoliday.status,
    confirmedAt: calendarHoliday.confirmedAt,
    submittedByUserId: calendarHoliday.submittedByUserId,
    submittedAt: calendarHoliday.submittedAt,
    rejectedByUserId: calendarHoliday.rejectedByUserId,
    rejectedAt: calendarHoliday.rejectedAt,
    rejectionReason: calendarHoliday.rejectionReason,
    recordVersion: calendarHoliday.recordVersion,
    calendarVersionId: calendarHoliday.calendarVersionId,
    versionNo: workingCalendarVersion.versionNo,
    versionStatus: workingCalendarVersion.status,
    effectiveFrom: workingCalendarVersion.effectiveFrom,
    effectiveTo: workingCalendarVersion.effectiveTo,
  }).from(calendarHoliday)
    .innerJoin(
      workingCalendarVersion,
      eq(workingCalendarVersion.id, calendarHoliday.calendarVersionId),
    )
    .where(and(
      eq(calendarHoliday.masterFn, scope.masterFn),
      eq(calendarHoliday.companyFn, scope.companyFn),
      inArray(calendarHoliday.calendarVersionId, versionIds),
      gte(calendarHoliday.holidayDate, query.from),
      lte(calendarHoliday.holidayDate, query.to),
    ))
    .orderBy(asc(calendarHoliday.holidayDate), asc(calendarHoliday.id));

  return {
    calendar,
    versions,
    items: rows.map((row) => ({
      ...row,
      isSubstitute: isSubstituteHoliday(row.name),
    })),
    from: query.from,
    to: query.to,
  };
}
