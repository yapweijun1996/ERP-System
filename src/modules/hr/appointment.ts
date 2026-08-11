import {
  and, asc, eq, gt, inArray, isNotNull, lt, or,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  employee,
  staffAppointment,
} from '../../data/schema';
import {
  expandAppointmentOccurrences,
  parseRecurrenceRule,
  RecurrenceError,
  validateTimeZone,
} from './recurrence';

export type StaffAppointmentType = typeof APPOINTMENT_TYPES[number];
export type StaffAppointmentStatus = typeof APPOINTMENT_STATUSES[number];

export interface StaffAppointmentInput {
  employeeId: number;
  appointmentType?: StaffAppointmentType | string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  timeZone?: string | null;
  recurrenceRule?: string | null;
  reminderMinutesBefore?: number | null;
  syncToExternal?: boolean;
  allDay?: boolean;
  location?: string | null;
  status?: StaffAppointmentStatus | string;
}

export class StaffAppointmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'StaffAppointmentError';
  }
}

function positiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new StaffAppointmentError('invalid_appointment_input', `${field} must be a positive integer.`);
  }
}

function recordVersion(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new StaffAppointmentError('invalid_appointment_version', 'A positive record version is required.');
  }
}

function dateTime(value: string, field: string): Date {
  const text = String(value ?? '').trim();
  if (!text || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    throw new StaffAppointmentError(
      'invalid_appointment_datetime',
      `${field} must be an ISO timestamp with a timezone.`,
    );
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new StaffAppointmentError('invalid_appointment_datetime', `${field} is not a valid timestamp.`);
  }
  return date;
}

function optionalReminder(value: unknown): number | null {
  if (value == null || value === '') return null;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080) {
    throw new StaffAppointmentError(
      'invalid_appointment_reminder',
      'reminderMinutesBefore must be between 0 and 10080 minutes.',
    );
  }
  return minutes;
}

function normalizeInput(input: StaffAppointmentInput, allowStatus = false) {
  const employeeId = Number(input.employeeId);
  positiveInteger(employeeId, 'employeeId');
  const appointmentType = String(input.appointmentType ?? 'meeting').trim();
  if (!APPOINTMENT_TYPES.includes(appointmentType as StaffAppointmentType)) {
    throw new StaffAppointmentError(
      'invalid_appointment_type',
      `appointmentType must be one of: ${APPOINTMENT_TYPES.join(', ')}.`,
    );
  }
  const title = String(input.title ?? '').trim();
  if (!title || title.length > 200) {
    throw new StaffAppointmentError(
      'invalid_appointment_title',
      'title is required and must be 200 characters or fewer.',
      422,
      { title: 'Enter an appointment title between 1 and 200 characters.' },
    );
  }
  const description = input.description == null ? null : String(input.description).trim() || null;
  if (description && description.length > 2000) {
    throw new StaffAppointmentError('invalid_appointment_description', 'description must be 2,000 characters or fewer.');
  }
  const location = input.location == null ? null : String(input.location).trim() || null;
  if (location && location.length > 200) {
    throw new StaffAppointmentError('invalid_appointment_location', 'location must be 200 characters or fewer.');
  }
  const startAt = dateTime(input.startAt, 'startAt');
  const endAt = dateTime(input.endAt, 'endAt');
  if (endAt <= startAt) {
    throw new StaffAppointmentError('invalid_appointment_range', 'endAt must be after startAt.');
  }
  const status = String(input.status ?? 'scheduled').trim();
  if (!APPOINTMENT_STATUSES.includes(status as StaffAppointmentStatus)) {
    throw new StaffAppointmentError(
      'invalid_appointment_status',
      `status must be one of: ${APPOINTMENT_STATUSES.join(', ')}.`,
    );
  }
  if (!allowStatus && status !== 'scheduled') {
    throw new StaffAppointmentError('invalid_appointment_status', 'New appointments must start as scheduled.');
  }
  const timeZone = String(input.timeZone ?? 'Asia/Singapore').trim();
  try {
    validateTimeZone(timeZone);
    parseRecurrenceRule(input.recurrenceRule);
  } catch (error) {
    if (error instanceof RecurrenceError) {
      throw new StaffAppointmentError('invalid_appointment_recurrence', error.message);
    }
    throw error;
  }
  const recurrenceRule = input.recurrenceRule == null || String(input.recurrenceRule).trim() === ''
    ? null
    : String(input.recurrenceRule).trim().toUpperCase();
  return {
    employeeId,
    appointmentType: appointmentType as StaffAppointmentType,
    title,
    description,
    startAt,
    endAt,
    timeZone,
    recurrenceRule,
    reminderMinutesBefore: optionalReminder(input.reminderMinutesBefore),
    syncToExternal: input.syncToExternal === true,
    allDay: input.allDay === true,
    location,
    status: status as StaffAppointmentStatus,
  };
}

async function employeeWithin(db: DB, scope: Scope, employeeId: number, activeOnly = false) {
  const predicates = [
    eq(employee.id, employeeId),
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
  ];
  if (activeOnly) predicates.push(eq(employee.isActive, true));
  const [row] = await db.select({ id: employee.id }).from(employee)
    .where(and(...predicates)).limit(1);
  if (!row) {
    throw new StaffAppointmentError(
      'appointment_employee_not_found',
      activeOnly ? 'Only active employees can receive a new appointment.' : 'Employee not found in the active company.',
      404,
    );
  }
}

function result(row: typeof staffAppointment.$inferSelect) {
  return {
    id: row.id,
    masterFn: row.masterFn,
    companyFn: row.companyFn,
    employeeId: row.employeeId,
    appointmentType: row.appointmentType,
    title: row.title,
    description: row.description,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timeZone: row.timeZone,
    recurrenceRule: row.recurrenceRule,
    reminderMinutesBefore: row.reminderMinutesBefore,
    syncToExternal: row.syncToExternal,
    allDay: row.allDay,
    location: row.location,
    status: row.status,
    recordVersion: row.recordVersion,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createStaffAppointmentWithin(
  db: DB,
  scope: Scope,
  input: StaffAppointmentInput,
  actorUserId: number,
) {
  positiveInteger(actorUserId, 'actorUserId');
  const normalized = normalizeInput(input);
  await employeeWithin(db, scope, normalized.employeeId, true);
  const [row] = await db.insert(staffAppointment).values({
    ...scope,
    ...normalized,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId,
    recordVersion: 1,
  }).returning();
  return result(row);
}

async function appointmentWithin(db: DB, scope: Scope, appointmentId: number, lock = false) {
  positiveInteger(appointmentId, 'appointmentId');
  const query = db.select().from(staffAppointment).where(and(
    eq(staffAppointment.id, appointmentId),
    eq(staffAppointment.masterFn, scope.masterFn),
    eq(staffAppointment.companyFn, scope.companyFn),
  )).limit(1);
  const [row] = lock ? await query.for('update') : await query;
  if (!row) throw new StaffAppointmentError('appointment_not_found', 'Appointment not found.', 404);
  return row;
}

export async function updateStaffAppointmentWithin(
  db: DB,
  scope: Scope,
  appointmentId: number,
  expectedVersion: number,
  input: StaffAppointmentInput,
  actorUserId: number,
) {
  recordVersion(expectedVersion);
  positiveInteger(actorUserId, 'actorUserId');
  const normalized = normalizeInput(input, true);
  const current = await appointmentWithin(db, scope, appointmentId, true);
  if (current.recordVersion !== expectedVersion) {
    throw new StaffAppointmentError('appointment_version_conflict', 'The appointment changed. Reload and try again.', 409);
  }
  if (current.status === 'cancelled') {
    throw new StaffAppointmentError('appointment_not_editable', 'Cancelled appointments cannot be edited.');
  }
  await employeeWithin(db, scope, normalized.employeeId);
  const [updated] = await db.update(staffAppointment).set({
    ...normalized,
    updatedByUserId: actorUserId,
    recordVersion: current.recordVersion + 1,
    updatedAt: new Date(),
  }).where(and(
    eq(staffAppointment.id, appointmentId),
    eq(staffAppointment.masterFn, scope.masterFn),
    eq(staffAppointment.companyFn, scope.companyFn),
    eq(staffAppointment.recordVersion, expectedVersion),
  )).returning();
  if (!updated) throw new StaffAppointmentError('appointment_version_conflict', 'The appointment changed. Reload and try again.', 409);
  return { before: result(current), after: result(updated) };
}

export async function cancelStaffAppointmentWithin(
  db: DB,
  scope: Scope,
  appointmentId: number,
  expectedVersion: number,
  actorUserId: number,
) {
  recordVersion(expectedVersion);
  positiveInteger(actorUserId, 'actorUserId');
  const current = await appointmentWithin(db, scope, appointmentId, true);
  if (current.recordVersion !== expectedVersion) {
    throw new StaffAppointmentError('appointment_version_conflict', 'The appointment changed. Reload and try again.', 409);
  }
  if (current.status === 'cancelled') return result(current);
  const [updated] = await db.update(staffAppointment).set({
    status: 'cancelled',
    updatedByUserId: actorUserId,
    recordVersion: current.recordVersion + 1,
    updatedAt: new Date(),
  }).where(and(
    eq(staffAppointment.id, appointmentId),
    eq(staffAppointment.masterFn, scope.masterFn),
    eq(staffAppointment.companyFn, scope.companyFn),
    eq(staffAppointment.recordVersion, expectedVersion),
  )).returning();
  if (!updated) throw new StaffAppointmentError('appointment_version_conflict', 'The appointment changed. Reload and try again.', 409);
  return result(updated);
}

export interface StaffAppointmentQuery {
  from: Date;
  to: Date;
  employeeId?: number | null;
  department?: string | null;
  status?: StaffAppointmentStatus | 'all' | null;
}

export async function listStaffAppointmentsWithin(
  db: DB,
  scope: Scope,
  employeeIds: number[],
  query: StaffAppointmentQuery,
) {
  if (!employeeIds.length) return [];
  const predicates = [
    eq(staffAppointment.masterFn, scope.masterFn),
    eq(staffAppointment.companyFn, scope.companyFn),
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    inArray(employee.id, employeeIds),
  ];
  const department = query.department?.trim();
  if (department && department !== 'all') predicates.push(eq(employee.department, department));
  if (query.status && query.status !== 'all') {
    if (!APPOINTMENT_STATUSES.includes(query.status as StaffAppointmentStatus)) return [];
    predicates.push(eq(staffAppointment.status, query.status));
  }
  const rows = await db.select({
    id: staffAppointment.id,
    employeeId: staffAppointment.employeeId,
    employeeNo: employee.employeeNo,
    employeeName: employee.fullName,
    department: employee.department,
    jobTitle: employee.jobTitle,
    appointmentType: staffAppointment.appointmentType,
    title: staffAppointment.title,
    description: staffAppointment.description,
    startAt: staffAppointment.startAt,
    endAt: staffAppointment.endAt,
    timeZone: staffAppointment.timeZone,
    recurrenceRule: staffAppointment.recurrenceRule,
    reminderMinutesBefore: staffAppointment.reminderMinutesBefore,
    syncToExternal: staffAppointment.syncToExternal,
    allDay: staffAppointment.allDay,
    location: staffAppointment.location,
    status: staffAppointment.status,
    recordVersion: staffAppointment.recordVersion,
  }).from(staffAppointment).innerJoin(employee, eq(employee.id, staffAppointment.employeeId))
    .where(and(
      ...predicates,
      or(
        and(lt(staffAppointment.startAt, query.to), gt(staffAppointment.endAt, query.from)),
        and(isNotNull(staffAppointment.recurrenceRule), lt(staffAppointment.startAt, query.to)),
      ),
    ))
    .orderBy(asc(staffAppointment.startAt), asc(employee.fullName), asc(staffAppointment.id))
    .limit(300);
  return rows.flatMap(row => expandAppointmentOccurrences({
    startAt: row.startAt,
    endAt: row.endAt,
    timeZone: row.timeZone,
    recurrenceRule: row.recurrenceRule,
    from: query.from,
    to: query.to,
  }).map(occurrence => ({
    ...row,
    startAt: occurrence.startAt.toISOString(),
    endAt: occurrence.endAt.toISOString(),
    occurrenceStartAt: occurrence.occurrenceStartAt,
  })));
}
