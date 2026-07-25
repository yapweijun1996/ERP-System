import {
  and, asc, eq, gte, inArray, lte,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  calendarOutboundEvent,
  employee,
  leaveRequest,
} from '../../data/schema';

export class TeamCalendarError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'TeamCalendarError';
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CALENDAR_STATUSES = ['pending', 'approved', 'cancelled'] as const;
export type TeamCalendarStatus = typeof CALENDAR_STATUSES[number];

function parseDate(value: string, field: string): Date {
  if (!ISO_DATE.test(value)) {
    throw new TeamCalendarError('calendar_date_invalid', `${field} must use YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TeamCalendarError('calendar_date_invalid', `${field} is not a valid date.`);
  }
  return date;
}

function overlaps(
  left: { startDate: string; endDate: string },
  right: { startDate: string; endDate: string },
) {
  return left.startDate <= right.endDate && left.endDate >= right.startDate;
}

export interface TeamCalendarQuery {
  from: string;
  to: string;
  department?: string | null;
  status?: TeamCalendarStatus | 'all' | null;
}

export async function listTeamCalendarWithin(
  exec: DB,
  scope: Scope,
  employeeIds: number[],
  query: TeamCalendarQuery,
) {
  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  if (from > to) {
    throw new TeamCalendarError('calendar_range_invalid', 'from must not be after to.');
  }
  const rangeDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (rangeDays > 93) {
    throw new TeamCalendarError(
      'calendar_range_too_large',
      'A team calendar request may cover at most 93 days.',
    );
  }
  if (!employeeIds.length) {
    return { items: [], departments: [], from: query.from, to: query.to };
  }
  if (query.status && query.status !== 'all'
      && !CALENDAR_STATUSES.includes(query.status)) {
    throw new TeamCalendarError('calendar_status_invalid', 'Unsupported calendar status.');
  }
  const predicates = [
    eq(leaveRequest.masterFn, scope.masterFn),
    eq(leaveRequest.companyFn, scope.companyFn),
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    inArray(leaveRequest.employeeId, employeeIds),
    inArray(leaveRequest.status, [...CALENDAR_STATUSES]),
    lte(leaveRequest.startDate, query.to),
    gte(leaveRequest.endDate, query.from),
  ];
  const department = query.department?.trim();
  if (department && department !== 'all') predicates.push(eq(employee.department, department));
  if (query.status && query.status !== 'all') {
    predicates.push(eq(leaveRequest.status, query.status));
  }
  const rows = await exec.select({
    id: leaveRequest.id,
    employeeId: leaveRequest.employeeId,
    employeeNo: employee.employeeNo,
    employeeName: employee.fullName,
    department: employee.department,
    jobTitle: employee.jobTitle,
    leaveType: leaveRequest.leaveType,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    days: leaveRequest.days,
    status: leaveRequest.status,
    version: leaveRequest.version,
    revisionNo: leaveRequest.currentRevisionNo,
    legacyPolicy: leaveRequest.legacyPolicy,
  }).from(leaveRequest)
    .innerJoin(employee, eq(employee.id, leaveRequest.employeeId))
    .where(and(...predicates))
    .orderBy(asc(leaveRequest.startDate), asc(employee.fullName), asc(leaveRequest.id))
    .limit(300);

  const requestIds = rows.map((row) => row.id);
  const syncRows = requestIds.length ? await exec.select({
    id: calendarOutboundEvent.id,
    requestId: calendarOutboundEvent.leaveRequestId,
    eventType: calendarOutboundEvent.eventType,
    status: calendarOutboundEvent.status,
    externalEventId: calendarOutboundEvent.externalEventId,
  }).from(calendarOutboundEvent).where(and(
    eq(calendarOutboundEvent.masterFn, scope.masterFn),
    eq(calendarOutboundEvent.companyFn, scope.companyFn),
    inArray(calendarOutboundEvent.leaveRequestId, requestIds),
  )).orderBy(asc(calendarOutboundEvent.id)) : [];
  const latestSync = new Map<number, typeof syncRows[number]>();
  for (const row of syncRows) latestSync.set(row.requestId, row);

  const activeRows = rows.filter((row) => ['pending', 'approved'].includes(row.status));
  const items = rows.map((row) => {
    const conflictCount = ['pending', 'approved'].includes(row.status)
      ? activeRows.filter((candidate) =>
        candidate.id !== row.id && overlaps(row, candidate)).length
      : 0;
    const sync = latestSync.get(row.id);
    return {
      ...row,
      days: Number(row.days),
      conflictCount,
      conflict: conflictCount > 0,
      privacy: 'reason_and_evidence_redacted' as const,
      sync: sync ? {
        eventType: sync.eventType,
        status: sync.status,
        externalEventId: sync.externalEventId,
      } : null,
    };
  });
  return {
    items,
    departments: Array.from(new Set(rows.map((row) => row.department))).sort(),
    from: query.from,
    to: query.to,
  };
}
