import {
  and,
  desc,
  eq,
  gte,
  isNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  EMPLOYMENT_TYPES,
  calendarHoliday,
  leavePolicyVersion,
  leaveType,
  workingCalendar,
  workingCalendarVersion,
} from '../../data/schema';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LEAVE_UNITS = ['full_day', 'half_day_am', 'half_day_pm'] as const;
export type LeaveDurationUnit = typeof LEAVE_UNITS[number] | 'hourly';

export class LeavePolicyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LeavePolicyError';
  }
}

function validDate(value: string | null | undefined): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dateRange(from: string, to?: string | null): void {
  if (!validDate(from) || (to != null && !validDate(to))) {
    throw new LeavePolicyError('invalid_date', 'Effective dates must be real YYYY-MM-DD dates.');
  }
  if (to != null && to < from) {
    throw new LeavePolicyError('invalid_date_range', 'Effective to must not be before effective from.');
  }
}

function uniqueWeekdays(values: number[]): number[] {
  const weekdays = [...new Set(values)].sort((left, right) => left - right);
  if (!weekdays.length || weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new LeavePolicyError(
      'invalid_weekdays',
      'Working weekdays must contain unique ISO weekday numbers from 1 to 7.',
    );
  }
  return weekdays;
}

function halfDayValue(value: string | number, field: string, allowZero = true): string {
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed)
    || parsed < (allowZero ? 0 : 0.5)
    || Math.round(parsed * 2) !== parsed * 2
  ) {
    throw new LeavePolicyError(
      'invalid_half_day_value',
      `${field} must use non-negative full-day or half-day increments.`,
    );
  }
  return parsed.toFixed(2);
}

export interface CreateWorkingCalendarVersionInput {
  code: string;
  name: string;
  timeZone: string;
  isDefault?: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  weekdays: number[];
}

export async function createWorkingCalendarVersion(
  db: DB,
  scope: Scope,
  input: CreateWorkingCalendarVersionInput,
) {
  const code = input.code?.trim().toUpperCase();
  const name = input.name?.trim();
  const timeZone = input.timeZone?.trim();
  if (!code || !name || !timeZone) {
    throw new LeavePolicyError('invalid_calendar', 'Calendar code, name and time zone are required.');
  }
  dateRange(input.effectiveFrom, input.effectiveTo);
  const weekdays = uniqueWeekdays(input.weekdays);

  return db.transaction(async (tx) => {
    let [calendar] = await tx.select({ id: workingCalendar.id })
      .from(workingCalendar)
      .where(and(
        eq(workingCalendar.masterFn, scope.masterFn),
        eq(workingCalendar.companyFn, scope.companyFn),
        eq(workingCalendar.code, code),
      ))
      .limit(1);
    if (!calendar) {
      [calendar] = await tx.insert(workingCalendar).values({
        ...scope,
        code,
        name,
        timeZone,
        isDefault: input.isDefault ?? false,
      }).returning({ id: workingCalendar.id });
    }
    const [latest] = await tx.select({ versionNo: workingCalendarVersion.versionNo })
      .from(workingCalendarVersion)
      .where(and(
        eq(workingCalendarVersion.masterFn, scope.masterFn),
        eq(workingCalendarVersion.companyFn, scope.companyFn),
        eq(workingCalendarVersion.calendarId, calendar.id),
      ))
      .orderBy(desc(workingCalendarVersion.versionNo))
      .limit(1);
    const [version] = await tx.insert(workingCalendarVersion).values({
      ...scope,
      calendarId: calendar.id,
      versionNo: (latest?.versionNo ?? 0) + 1,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
      weekdays,
      status: 'draft',
    }).returning({
      id: workingCalendarVersion.id,
      versionNo: workingCalendarVersion.versionNo,
    });
    return { calendarId: calendar.id, versionId: version.id, versionNo: version.versionNo };
  });
}

async function overlappingConfirmedCalendarVersion(
  exec: DB,
  scope: Scope,
  calendarId: number,
  versionId: number,
  effectiveFrom: string,
  effectiveTo: string | null,
) {
  const [overlap] = await exec.select({ id: workingCalendarVersion.id })
    .from(workingCalendarVersion)
    .where(and(
      eq(workingCalendarVersion.masterFn, scope.masterFn),
      eq(workingCalendarVersion.companyFn, scope.companyFn),
      eq(workingCalendarVersion.calendarId, calendarId),
      eq(workingCalendarVersion.status, 'confirmed'),
      ne(workingCalendarVersion.id, versionId),
      lte(workingCalendarVersion.effectiveFrom, effectiveTo ?? '9999-12-31'),
      or(
        isNull(workingCalendarVersion.effectiveTo),
        gte(workingCalendarVersion.effectiveTo, effectiveFrom),
      ),
    ))
    .limit(1);
  return overlap;
}

export async function confirmWorkingCalendarVersion(
  db: DB,
  scope: Scope,
  versionId: number,
  actorUserId: number,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [version] = await tx.select().from(workingCalendarVersion).where(and(
      eq(workingCalendarVersion.masterFn, scope.masterFn),
      eq(workingCalendarVersion.companyFn, scope.companyFn),
      eq(workingCalendarVersion.id, versionId),
    )).limit(1).for('update');
    if (!version) throw new LeavePolicyError('calendar_version_not_found', 'Calendar version not found.');
    if (version.status !== 'draft') {
      throw new LeavePolicyError('calendar_version_not_draft', 'Only a draft calendar version can be confirmed.');
    }
    if (await overlappingConfirmedCalendarVersion(
      tx,
      scope,
      version.calendarId,
      version.id,
      version.effectiveFrom,
      version.effectiveTo,
    )) {
      throw new LeavePolicyError(
        'calendar_version_overlap',
        'A confirmed calendar version already covers part of this effective period.',
      );
    }
    await tx.update(workingCalendarVersion).set({
      status: 'confirmed',
      confirmedByUserId: actorUserId,
      confirmedAt: now,
      updatedAt: now,
    }).where(eq(workingCalendarVersion.id, version.id));
    return { id: version.id, status: 'confirmed' as const };
  });
}

export async function addCalendarHoliday(
  db: DB,
  scope: Scope,
  input: {
    calendarVersionId: number;
    holidayDate: string;
    name: string;
    source: 'official' | 'company';
    country?: string | null;
    actorUserId: number;
  },
  now = new Date(),
) {
  if (!validDate(input.holidayDate) || !input.name?.trim()) {
    throw new LeavePolicyError('invalid_holiday', 'Holiday date and name are required.');
  }
  return db.transaction(async (tx) => {
    const [version] = await tx.select({
      id: workingCalendarVersion.id,
      effectiveFrom: workingCalendarVersion.effectiveFrom,
      effectiveTo: workingCalendarVersion.effectiveTo,
    }).from(workingCalendarVersion).where(and(
      eq(workingCalendarVersion.masterFn, scope.masterFn),
      eq(workingCalendarVersion.companyFn, scope.companyFn),
      eq(workingCalendarVersion.id, input.calendarVersionId),
    )).limit(1);
    if (!version) throw new LeavePolicyError('calendar_version_not_found', 'Calendar version not found.');
    if (
      input.holidayDate < version.effectiveFrom
      || (version.effectiveTo != null && input.holidayDate > version.effectiveTo)
    ) {
      throw new LeavePolicyError(
        'holiday_outside_version',
        'Holiday date must fall inside the calendar version effective period.',
      );
    }
    const confirmed = input.source === 'company';
    const [holiday] = await tx.insert(calendarHoliday).values({
      ...scope,
      calendarVersionId: version.id,
      holidayDate: input.holidayDate,
      name: input.name.trim(),
      source: input.source,
      country: input.country?.trim().toUpperCase() || null,
      status: confirmed ? 'confirmed' : 'draft',
      confirmedByUserId: confirmed ? input.actorUserId : null,
      confirmedAt: confirmed ? now : null,
    }).returning({ id: calendarHoliday.id, status: calendarHoliday.status });
    return holiday;
  });
}

export async function confirmOfficialHoliday(
  db: DB,
  scope: Scope,
  holidayId: number,
  actorUserId: number,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [holiday] = await tx.select().from(calendarHoliday).where(and(
      eq(calendarHoliday.masterFn, scope.masterFn),
      eq(calendarHoliday.companyFn, scope.companyFn),
      eq(calendarHoliday.id, holidayId),
    )).limit(1).for('update');
    if (!holiday) throw new LeavePolicyError('holiday_not_found', 'Holiday not found.');
    if (holiday.source !== 'official' || holiday.status !== 'draft') {
      throw new LeavePolicyError(
        'holiday_not_confirmable',
        'Only a draft official holiday can be confirmed.',
      );
    }
    await tx.update(calendarHoliday).set({
      status: 'confirmed',
      confirmedByUserId: actorUserId,
      confirmedAt: now,
      recordVersion: sql`${calendarHoliday.recordVersion} + 1`,
      updatedAt: now,
    }).where(eq(calendarHoliday.id, holiday.id));
    return { id: holiday.id, status: 'confirmed' as const };
  });
}

export interface CreateLeavePolicyVersionInput {
  leaveTypeCode: string;
  leaveTypeName: string;
  paid: boolean;
  calendarId: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  annualEntitlementDays: string | number;
  accrualMethod: 'none' | 'upfront' | 'monthly';
  carryForwardDays?: string | number;
  carryExpiryMonths?: number | null;
  evidenceAfterDays?: string | number | null;
  staffingAction?: 'warn' | 'extra_approval' | 'block';
  minimumStaff?: number;
  encashmentAllowed?: boolean;
  encashmentMaxDays?: string | number;
  eligibleEmploymentTypes?: string[];
  unitMode?: 'full_and_half_day' | 'hourly';
}

export async function createLeavePolicyVersion(
  db: DB,
  scope: Scope,
  input: CreateLeavePolicyVersionInput,
) {
  if (input.unitMode === 'hourly') {
    throw new LeavePolicyError('hourly_leave_unsupported', 'Hourly leave is not supported.');
  }
  const code = input.leaveTypeCode?.trim().toUpperCase();
  const name = input.leaveTypeName?.trim();
  if (!code || !name) throw new LeavePolicyError('invalid_leave_type', 'Leave type code and name are required.');
  dateRange(input.effectiveFrom, input.effectiveTo);
  const entitlement = halfDayValue(input.annualEntitlementDays, 'Annual entitlement');
  const carry = halfDayValue(input.carryForwardDays ?? 0, 'Carry forward');
  const evidence = input.evidenceAfterDays == null
    ? null
    : halfDayValue(input.evidenceAfterDays, 'Evidence threshold', false);
  const encashment = halfDayValue(input.encashmentMaxDays ?? 0, 'Encashment maximum');
  const eligible = [...new Set(input.eligibleEmploymentTypes ?? [...EMPLOYMENT_TYPES])];
  if (!eligible.length || eligible.some((value) =>
    !EMPLOYMENT_TYPES.includes(value as typeof EMPLOYMENT_TYPES[number]))) {
    throw new LeavePolicyError('invalid_eligibility', 'Eligibility contains an unknown employment type.');
  }
  if (
    !Number.isInteger(input.minimumStaff ?? 0)
    || (input.minimumStaff ?? 0) < 0
    || (input.carryExpiryMonths != null
      && (!Number.isInteger(input.carryExpiryMonths) || input.carryExpiryMonths <= 0))
  ) {
    throw new LeavePolicyError('invalid_policy_value', 'Policy counts must be non-negative integers.');
  }
  if (!input.encashmentAllowed && Number(encashment) !== 0) {
    throw new LeavePolicyError(
      'invalid_encashment',
      'Encashment maximum must be zero when encashment is disabled.',
    );
  }

  return db.transaction(async (tx) => {
    const [calendar] = await tx.select({ id: workingCalendar.id }).from(workingCalendar).where(and(
      eq(workingCalendar.masterFn, scope.masterFn),
      eq(workingCalendar.companyFn, scope.companyFn),
      eq(workingCalendar.id, input.calendarId),
    )).limit(1);
    if (!calendar) throw new LeavePolicyError('calendar_not_found', 'Working calendar not found.');
    let [type] = await tx.select({ id: leaveType.id }).from(leaveType).where(and(
      eq(leaveType.masterFn, scope.masterFn),
      eq(leaveType.companyFn, scope.companyFn),
      eq(leaveType.code, code),
    )).limit(1);
    if (!type) {
      [type] = await tx.insert(leaveType).values({
        ...scope,
        code,
        name,
        paid: input.paid,
      }).returning({ id: leaveType.id });
    }
    const [latest] = await tx.select({ versionNo: leavePolicyVersion.versionNo })
      .from(leavePolicyVersion)
      .where(and(
        eq(leavePolicyVersion.masterFn, scope.masterFn),
        eq(leavePolicyVersion.companyFn, scope.companyFn),
        eq(leavePolicyVersion.leaveTypeId, type.id),
      ))
      .orderBy(desc(leavePolicyVersion.versionNo))
      .limit(1);
    const [version] = await tx.insert(leavePolicyVersion).values({
      ...scope,
      leaveTypeId: type.id,
      calendarId: calendar.id,
      versionNo: (latest?.versionNo ?? 0) + 1,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
      annualEntitlementDays: entitlement,
      accrualMethod: input.accrualMethod,
      carryForwardDays: carry,
      carryExpiryMonths: input.carryExpiryMonths ?? null,
      evidenceAfterDays: evidence,
      staffingAction: input.staffingAction ?? 'warn',
      minimumStaff: input.minimumStaff ?? 0,
      encashmentAllowed: input.encashmentAllowed ?? false,
      encashmentMaxDays: encashment,
      eligibleEmploymentTypes: eligible,
      unitMode: 'full_and_half_day',
      status: 'draft',
    }).returning({
      id: leavePolicyVersion.id,
      versionNo: leavePolicyVersion.versionNo,
    });
    return { leaveTypeId: type.id, policyVersionId: version.id, versionNo: version.versionNo };
  });
}

export async function confirmLeavePolicyVersion(
  db: DB,
  scope: Scope,
  policyVersionId: number,
  actorUserId: number,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [policy] = await tx.select().from(leavePolicyVersion).where(and(
      eq(leavePolicyVersion.masterFn, scope.masterFn),
      eq(leavePolicyVersion.companyFn, scope.companyFn),
      eq(leavePolicyVersion.id, policyVersionId),
    )).limit(1).for('update');
    if (!policy) throw new LeavePolicyError('leave_policy_not_found', 'Leave policy version not found.');
    if (policy.status !== 'draft') {
      throw new LeavePolicyError('leave_policy_not_draft', 'Only a draft leave policy can be confirmed.');
    }
    const [overlap] = await tx.select({ id: leavePolicyVersion.id })
      .from(leavePolicyVersion)
      .where(and(
        eq(leavePolicyVersion.masterFn, scope.masterFn),
        eq(leavePolicyVersion.companyFn, scope.companyFn),
        eq(leavePolicyVersion.leaveTypeId, policy.leaveTypeId),
        eq(leavePolicyVersion.status, 'confirmed'),
        ne(leavePolicyVersion.id, policy.id),
        lte(leavePolicyVersion.effectiveFrom, policy.effectiveTo ?? '9999-12-31'),
        or(
          isNull(leavePolicyVersion.effectiveTo),
          gte(leavePolicyVersion.effectiveTo, policy.effectiveFrom),
        ),
      ))
      .limit(1);
    if (overlap) {
      throw new LeavePolicyError(
        'leave_policy_overlap',
        'A confirmed leave policy already covers part of this effective period.',
      );
    }
    await tx.update(leavePolicyVersion).set({
      status: 'confirmed',
      confirmedByUserId: actorUserId,
      confirmedAt: now,
      updatedAt: now,
    }).where(eq(leavePolicyVersion.id, policy.id));
    return { id: policy.id, status: 'confirmed' as const };
  });
}

export async function resolveWorkingCalendarVersion(
  db: DB,
  scope: Scope,
  calendarId: number,
  onDate: string,
) {
  if (!validDate(onDate)) throw new LeavePolicyError('invalid_date', 'Date must be a real YYYY-MM-DD date.');
  const [version] = await db.select().from(workingCalendarVersion).where(and(
    eq(workingCalendarVersion.masterFn, scope.masterFn),
    eq(workingCalendarVersion.companyFn, scope.companyFn),
    eq(workingCalendarVersion.calendarId, calendarId),
    eq(workingCalendarVersion.status, 'confirmed'),
    lte(workingCalendarVersion.effectiveFrom, onDate),
    or(isNull(workingCalendarVersion.effectiveTo), gte(workingCalendarVersion.effectiveTo, onDate)),
  )).orderBy(desc(workingCalendarVersion.versionNo)).limit(1);
  if (!version) {
    throw new LeavePolicyError('calendar_not_effective', 'No confirmed calendar version covers this date.');
  }
  return version;
}

export async function resolveLeavePolicyVersion(
  db: DB,
  scope: Scope,
  leaveTypeId: number,
  onDate: string,
) {
  if (!validDate(onDate)) throw new LeavePolicyError('invalid_date', 'Date must be a real YYYY-MM-DD date.');
  const [policy] = await db.select().from(leavePolicyVersion).where(and(
    eq(leavePolicyVersion.masterFn, scope.masterFn),
    eq(leavePolicyVersion.companyFn, scope.companyFn),
    eq(leavePolicyVersion.leaveTypeId, leaveTypeId),
    eq(leavePolicyVersion.status, 'confirmed'),
    lte(leavePolicyVersion.effectiveFrom, onDate),
    or(isNull(leavePolicyVersion.effectiveTo), gte(leavePolicyVersion.effectiveTo, onDate)),
  )).orderBy(desc(leavePolicyVersion.versionNo)).limit(1);
  if (!policy) {
    throw new LeavePolicyError('leave_policy_not_effective', 'No confirmed leave policy covers this date.');
  }
  return policy;
}

function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export async function calculateLeaveDuration(
  db: DB,
  scope: Scope,
  input: {
    calendarId: number;
    startDate: string;
    endDate: string;
    unit: LeaveDurationUnit;
  },
) {
  dateRange(input.startDate, input.endDate);
  if (input.unit === 'hourly') {
    throw new LeavePolicyError('hourly_leave_unsupported', 'Hourly leave is not supported.');
  }
  if (!LEAVE_UNITS.includes(input.unit)) {
    throw new LeavePolicyError('invalid_leave_unit', 'Leave unit must be full day or half day.');
  }
  if (input.unit !== 'full_day' && input.startDate !== input.endDate) {
    throw new LeavePolicyError(
      'half_day_single_date',
      'A half-day request must start and end on the same date.',
    );
  }

  const includedDates: string[] = [];
  const excludedDates: string[] = [];
  const start = new Date(`${input.startDate}T00:00:00Z`);
  const end = new Date(`${input.endDate}T00:00:00Z`);
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const onDate = cursor.toISOString().slice(0, 10);
    const version = await resolveWorkingCalendarVersion(db, scope, input.calendarId, onDate);
    const weekdays = uniqueWeekdays(version.weekdays as number[]);
    const [holiday] = await db.select({ id: calendarHoliday.id }).from(calendarHoliday).where(and(
      eq(calendarHoliday.masterFn, scope.masterFn),
      eq(calendarHoliday.companyFn, scope.companyFn),
      eq(calendarHoliday.calendarVersionId, version.id),
      eq(calendarHoliday.holidayDate, onDate),
      eq(calendarHoliday.status, 'confirmed'),
    )).limit(1);
    if (!weekdays.includes(isoWeekday(cursor)) || holiday) excludedDates.push(onDate);
    else includedDates.push(onDate);
  }
  if (input.unit !== 'full_day' && includedDates.length !== 1) {
    throw new LeavePolicyError(
      'half_day_not_working_day',
      'A half-day request must fall on a confirmed working day.',
    );
  }
  const halfDays = input.unit === 'full_day' ? includedDates.length * 2 : 1;
  return {
    days: (halfDays / 2).toFixed(2),
    unit: input.unit,
    includedDates,
    excludedDates,
  };
}
