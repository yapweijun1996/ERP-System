import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { listTeamCalendarWithin } from './teamCalendar';
import { APPOINTMENT_STATUSES } from '../../data/schema';
import {
  listStaffAppointmentsWithin,
  type StaffAppointmentStatus,
} from './appointment';
import { dateInTimeZone } from './recurrence';

const LEAVE_STATUSES = ['pending', 'approved', 'cancelled'] as const;
type LeaveStatus = typeof LEAVE_STATUSES[number];

export interface StaffCalendarQuery {
  from: string;
  to: string;
  employeeId?: number | null;
  department?: string | null;
  status?: LeaveStatus | StaffAppointmentStatus | 'all' | null;
}

export class StaffCalendarError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = 'StaffCalendarError';
  }
}

function isoDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new StaffCalendarError('calendar_date_invalid', `${field} must use YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new StaffCalendarError('calendar_date_invalid', `${field} is not a real date.`);
  }
  return date;
}

function dateEndExclusive(value: string): Date {
  const date = isoDate(value, 'to');
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function activeStatus(value: string): boolean {
  return value !== 'cancelled';
}

function overlaps(left: { startDate: string; endDate: string }, right: { startDate: string; endDate: string }) {
  return left.startDate <= right.endDate && left.endDate >= right.startDate;
}

export async function listStaffCalendarWithin(
  db: DB,
  scope: Scope,
  employeeIds: number[],
  query: StaffCalendarQuery,
) {
  const fromDate = isoDate(query.from, 'from');
  const toDate = isoDate(query.to, 'to');
  if (fromDate > toDate) {
    throw new StaffCalendarError('calendar_range_invalid', 'from must not be after to.');
  }
  const rangeDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  if (rangeDays > 93) {
    throw new StaffCalendarError('calendar_range_too_large', 'A staff calendar request may cover at most 93 days.');
  }
  const filteredEmployeeIds = query.employeeId == null
    ? employeeIds
    : employeeIds.filter(id => id === Number(query.employeeId));
  if (!filteredEmployeeIds.length) return { items: [], departments: [], from: query.from, to: query.to };

  const status = query.status ?? 'all';
  const leaveStatus = LEAVE_STATUSES.includes(status as LeaveStatus)
    ? status as LeaveStatus : 'all';
  const appointmentStatus = APPOINTMENT_STATUSES.includes(status as StaffAppointmentStatus)
    ? status as StaffAppointmentStatus : 'all';
  const [leaveData, appointmentRows] = await Promise.all([
    listTeamCalendarWithin(db, scope, filteredEmployeeIds, {
      from: query.from,
      to: query.to,
      department: query.department,
      status: leaveStatus,
    }),
    listStaffAppointmentsWithin(db, scope, filteredEmployeeIds, {
      from: fromDate,
      to: dateEndExclusive(query.to),
      department: query.department,
      status: appointmentStatus,
    }),
  ]);

  const leaveItems = leaveData.items.map(item => ({
    ...item,
    id: `leave:${item.id}`,
    sourceId: item.id,
    eventKind: 'leave' as const,
    eventTitle: item.leaveType,
    startAt: `${item.startDate}T00:00:00.000Z`,
    endAt: `${item.endDate}T23:59:59.999Z`,
  }));
  const appointmentItems = appointmentRows.map(item => ({
    ...item,
    id: `appointment:${item.id}:${item.occurrenceStartAt}`,
    sourceId: item.id,
    eventKind: 'appointment' as const,
    eventTitle: item.title,
    leaveType: item.appointmentType,
    startDate: dateInTimeZone(new Date(item.startAt), item.timeZone),
    endDate: dateInTimeZone(new Date(item.endAt), item.timeZone),
    days: null,
    conflict: false,
    conflictCount: 0,
    privacy: 'hr_private' as const,
    sync: null,
    occurrenceStartAt: item.occurrenceStartAt,
  }));
  const items = [...leaveItems, ...appointmentItems]
    .filter(item => status === 'all' || item.status === status)
    .sort((left, right) => left.startAt.localeCompare(right.startAt)
      || left.employeeName.localeCompare(right.employeeName)
      || String(left.id).localeCompare(String(right.id)));
  const activeItems = items.filter(item => activeStatus(item.status));
  for (const item of items) {
    const conflicts = activeItems.filter(candidate => candidate.id !== item.id
      && candidate.employeeId === item.employeeId
      && overlaps(item, candidate)).length;
    item.conflictCount = conflicts;
    item.conflict = conflicts > 0;
  }
  const departments = Array.from(new Set([
    ...leaveData.departments,
    ...appointmentRows.map(item => item.department),
  ])).sort();
  return { items, departments, from: query.from, to: query.to };
}
