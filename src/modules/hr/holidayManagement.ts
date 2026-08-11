import { and, eq, ne } from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  calendarHoliday,
  workingCalendarVersion,
} from '../../data/schema';
import { HolidayCalendarError } from './holidayCalendar';

export type ManagedHolidaySource = 'official' | 'company';

export interface ManagedHolidayInput {
  calendarVersionId: number;
  holidayDate: string;
  name: string;
  source: ManagedHolidaySource;
  country?: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertVersion(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new HolidayCalendarError('invalid_version', 'A positive calendar version is required.');
  }
}

function normalizeInput(input: ManagedHolidayInput): ManagedHolidayInput {
  const name = String(input.name ?? '').trim();
  const country = input.country == null ? null : String(input.country).trim().toUpperCase();
  if (!Number.isSafeInteger(input.calendarVersionId) || input.calendarVersionId <= 0) {
    throw new HolidayCalendarError('invalid_calendar_version', 'A valid calendar version is required.');
  }
  if (!isValidDate(input.holidayDate)) {
    throw new HolidayCalendarError('invalid_holiday_date', 'Holiday date must be a real YYYY-MM-DD date.');
  }
  if (!name || name.length > 200) {
    throw new HolidayCalendarError('invalid_holiday_name', 'Holiday name is required and must be 200 characters or fewer.');
  }
  if (input.source !== 'official' && input.source !== 'company') {
    throw new HolidayCalendarError('invalid_holiday_source', 'Holiday source must be official or company.');
  }
  if (country && country.length > 10) {
    throw new HolidayCalendarError('invalid_holiday_country', 'Country code must be 10 characters or fewer.');
  }
  return {
    calendarVersionId: input.calendarVersionId,
    holidayDate: input.holidayDate,
    name,
    source: input.source,
    country: country || null,
  };
}

async function calendarVersionWithin(
  db: DB,
  scope: Scope,
  calendarVersionId: number,
) {
  const [version] = await db.select({
    id: workingCalendarVersion.id,
    effectiveFrom: workingCalendarVersion.effectiveFrom,
    effectiveTo: workingCalendarVersion.effectiveTo,
    status: workingCalendarVersion.status,
  }).from(workingCalendarVersion).where(and(
    eq(workingCalendarVersion.masterFn, scope.masterFn),
    eq(workingCalendarVersion.companyFn, scope.companyFn),
    eq(workingCalendarVersion.id, calendarVersionId),
  )).limit(1);
  if (!version) {
    throw new HolidayCalendarError('calendar_version_not_found', 'Calendar version not found.', 404);
  }
  if (version.status === 'retired') {
    throw new HolidayCalendarError('calendar_version_retired', 'Retired calendar versions cannot receive new holiday changes.');
  }
  return version;
}

async function assertDateInsideVersion(
  db: DB,
  scope: Scope,
  input: ManagedHolidayInput,
) {
  const version = await calendarVersionWithin(db, scope, input.calendarVersionId);
  if (input.holidayDate < version.effectiveFrom
    || (version.effectiveTo != null && input.holidayDate > version.effectiveTo)) {
    throw new HolidayCalendarError(
      'holiday_outside_version',
      'Holiday date must fall inside the calendar version effective period.',
    );
  }
  return version;
}

async function assertNoDuplicate(
  db: DB,
  scope: Scope,
  input: ManagedHolidayInput,
  excludeId?: number,
): Promise<void> {
  const conditions = [
    eq(calendarHoliday.masterFn, scope.masterFn),
    eq(calendarHoliday.companyFn, scope.companyFn),
    eq(calendarHoliday.calendarVersionId, input.calendarVersionId),
    eq(calendarHoliday.holidayDate, input.holidayDate),
    eq(calendarHoliday.name, input.name),
  ];
  if (excludeId != null) conditions.push(ne(calendarHoliday.id, excludeId));
  const [duplicate] = await db.select({ id: calendarHoliday.id })
    .from(calendarHoliday).where(and(...conditions)).limit(1);
  if (duplicate) {
    throw new HolidayCalendarError(
      'holiday_duplicate',
      'A holiday with the same date and name already exists in this calendar version.',
      409,
    );
  }
}

async function holidayWithin(db: DB, scope: Scope, holidayId: number, lock = false) {
  const query = db.select().from(calendarHoliday).where(and(
    eq(calendarHoliday.masterFn, scope.masterFn),
    eq(calendarHoliday.companyFn, scope.companyFn),
    eq(calendarHoliday.id, holidayId),
  )).limit(1);
  const [holiday] = lock ? await query.for('update') : await query;
  if (!holiday) throw new HolidayCalendarError('holiday_not_found', 'Holiday not found.', 404);
  return holiday;
}

export async function createCalendarHolidayDraftWithin(
  db: DB,
  scope: Scope,
  input: ManagedHolidayInput,
) {
  const normalized = normalizeInput(input);
  await assertDateInsideVersion(db, scope, normalized);
  await assertNoDuplicate(db, scope, normalized);
  const [holiday] = await db.insert(calendarHoliday).values({
    ...scope,
    ...normalized,
    status: 'draft',
    recordVersion: 1,
  }).returning({
    id: calendarHoliday.id,
    calendarVersionId: calendarHoliday.calendarVersionId,
    holidayDate: calendarHoliday.holidayDate,
    name: calendarHoliday.name,
    source: calendarHoliday.source,
    country: calendarHoliday.country,
    status: calendarHoliday.status,
    recordVersion: calendarHoliday.recordVersion,
  });
  return holiday;
}

export async function updateCalendarHolidayDraftWithin(
  db: DB,
  scope: Scope,
  holidayId: number,
  expectedVersion: number,
  input: ManagedHolidayInput,
) {
  assertVersion(expectedVersion);
  const normalized = normalizeInput(input);
  const holiday = await holidayWithin(db, scope, holidayId, true);
  if (holiday.recordVersion !== expectedVersion) {
    throw new HolidayCalendarError('holiday_version_conflict', 'The holiday was changed by another user. Reload and try again.', 409);
  }
  if (holiday.status !== 'draft' && holiday.status !== 'rejected') {
    throw new HolidayCalendarError('holiday_not_editable', 'Only draft or rejected holidays can be edited.');
  }
  await assertDateInsideVersion(db, scope, normalized);
  await assertNoDuplicate(db, scope, normalized, holidayId);
  const [updated] = await db.update(calendarHoliday).set({
    ...normalized,
    status: 'draft',
    confirmedByUserId: null,
    confirmedAt: null,
    submittedByUserId: null,
    submittedAt: null,
    rejectedByUserId: null,
    rejectedAt: null,
    rejectionReason: null,
    recordVersion: holiday.recordVersion + 1,
    updatedAt: new Date(),
  }).where(and(
    eq(calendarHoliday.id, holidayId),
    eq(calendarHoliday.masterFn, scope.masterFn),
    eq(calendarHoliday.companyFn, scope.companyFn),
    eq(calendarHoliday.recordVersion, expectedVersion),
  )).returning({
    id: calendarHoliday.id,
    calendarVersionId: calendarHoliday.calendarVersionId,
    holidayDate: calendarHoliday.holidayDate,
    name: calendarHoliday.name,
    source: calendarHoliday.source,
    country: calendarHoliday.country,
    status: calendarHoliday.status,
    recordVersion: calendarHoliday.recordVersion,
  });
  if (!updated) throw new HolidayCalendarError('holiday_version_conflict', 'The holiday was changed by another user. Reload and try again.', 409);
  return updated;
}

export async function submitCalendarHolidayWithin(
  db: DB,
  scope: Scope,
  holidayId: number,
  expectedVersion: number,
  actorUserId: number,
) {
  assertVersion(expectedVersion);
  const holiday = await holidayWithin(db, scope, holidayId, true);
  if (holiday.recordVersion !== expectedVersion) {
    throw new HolidayCalendarError('holiday_version_conflict', 'The holiday was changed by another user. Reload and try again.', 409);
  }
  if (holiday.status !== 'draft') {
    throw new HolidayCalendarError('holiday_not_submittable', 'Only a draft holiday can be submitted for approval.');
  }
  await calendarVersionWithin(db, scope, holiday.calendarVersionId);
  const now = new Date();
  const [updated] = await db.update(calendarHoliday).set({
    status: 'pending_approval',
    submittedByUserId: actorUserId,
    submittedAt: now,
    recordVersion: holiday.recordVersion + 1,
    updatedAt: now,
  }).where(and(
    eq(calendarHoliday.id, holidayId),
    eq(calendarHoliday.masterFn, scope.masterFn),
    eq(calendarHoliday.companyFn, scope.companyFn),
    eq(calendarHoliday.recordVersion, expectedVersion),
  )).returning({ id: calendarHoliday.id, status: calendarHoliday.status, recordVersion: calendarHoliday.recordVersion });
  if (!updated) throw new HolidayCalendarError('holiday_version_conflict', 'The holiday was changed by another user. Reload and try again.', 409);
  return updated;
}

export async function decideCalendarHolidayWithin(
  db: DB,
  scope: Scope,
  holidayId: number,
  expectedVersion: number,
  decision: 'approve' | 'reject',
  actorUserId: number,
  reason = '',
) {
  assertVersion(expectedVersion);
  const holiday = await holidayWithin(db, scope, holidayId, true);
  if (holiday.recordVersion !== expectedVersion) {
    throw new HolidayCalendarError('holiday_version_conflict', 'The holiday was changed by another user. Reload and try again.', 409);
  }
  if (holiday.status !== 'pending_approval') {
    throw new HolidayCalendarError('holiday_not_pending', 'Only a holiday pending approval can be decided.');
  }
  const trimmedReason = String(reason ?? '').trim();
  if (decision === 'reject' && trimmedReason.length < 3) {
    throw new HolidayCalendarError('rejection_reason_required', 'A rejection reason of at least 3 characters is required.');
  }
  const now = new Date();
  const approved = decision === 'approve';
  const [updated] = await db.update(calendarHoliday).set({
    status: approved ? 'confirmed' : 'rejected',
    confirmedByUserId: approved ? actorUserId : null,
    confirmedAt: approved ? now : null,
    rejectedByUserId: approved ? null : actorUserId,
    rejectedAt: approved ? null : now,
    rejectionReason: approved ? null : trimmedReason,
    recordVersion: holiday.recordVersion + 1,
    updatedAt: now,
  }).where(and(
    eq(calendarHoliday.id, holidayId),
    eq(calendarHoliday.masterFn, scope.masterFn),
    eq(calendarHoliday.companyFn, scope.companyFn),
    eq(calendarHoliday.recordVersion, expectedVersion),
  )).returning({ id: calendarHoliday.id, status: calendarHoliday.status, recordVersion: calendarHoliday.recordVersion });
  if (!updated) throw new HolidayCalendarError('holiday_version_conflict', 'The holiday was changed by another user. Reload and try again.', 409);
  return { ...updated, decision, reason: approved ? null : trimmedReason };
}
