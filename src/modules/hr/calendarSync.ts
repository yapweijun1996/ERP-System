import {
  and, asc, desc, eq, inArray, isNull, lt, lte, or, sql,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  calendarOutboundConnection,
  calendarOutboundEvent,
  employee,
  leaveRequest,
  staffAppointment,
  staffAppointmentOutboundEvent,
} from '../../data/schema';
import { expandAppointmentOccurrences } from './recurrence';

export interface LeaveCalendarOutboundPayload {
  summary: string;
  startDate: string;
  endDateExclusive: string;
  allDay: true;
  employeeNo: string;
  status: 'approved' | 'cancelled';
  source: 'erp';
}

export interface StaffAppointmentCalendarOutboundPayload {
  summary: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  allDay: boolean;
  employeeNo: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  source: 'erp';
  eventKind: 'appointment';
}

export type CalendarOutboundPayload =
  | LeaveCalendarOutboundPayload
  | StaffAppointmentCalendarOutboundPayload;

export interface CalendarOutboundDriver {
  upsert(input: {
    calendarRef: string;
    provider?: 'generic' | 'google' | 'microsoft';
    externalEventId: string | null;
    idempotencyKey: string;
    event: CalendarOutboundPayload;
  }): Promise<{ externalEventId: string }>;
  cancel(input: {
    calendarRef: string;
    provider?: 'generic' | 'google' | 'microsoft';
    externalEventId: string | null;
    idempotencyKey: string;
  }): Promise<void>;
}

export interface CalendarWorkerOptions {
  workerId?: string;
  batchSize?: number;
  leaseMs?: number;
  now?: Date;
}

export function createGenericCalendarDriverFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CalendarOutboundDriver {
  const endpoint = env.CALENDAR_OUTBOUND_URL?.trim();
  if (!endpoint) throw new Error('CALENDAR_OUTBOUND_URL is required.');
  const token = env.CALENDAR_OUTBOUND_TOKEN?.trim();
  const timeoutMs = Math.min(
    Math.max(Number(env.CALENDAR_OUTBOUND_TIMEOUT_MS) || 15000, 1000),
    120000,
  );
  async function deliver(
    action: 'upsert' | 'cancel',
    body: Record<string, unknown>,
  ) {
    const response = await fetch(endpoint!, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action, ...body }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Calendar outbound endpoint returned HTTP ${response.status}.`);
    }
    return response.status === 204
      ? {}
      : await response.json() as Record<string, unknown>;
  }
  return {
    async upsert(input) {
      const result = await deliver('upsert', input);
      const externalEventId = typeof result.externalEventId === 'string'
        ? result.externalEventId
        : input.externalEventId;
      if (!externalEventId) {
        throw new Error('Calendar outbound upsert did not return externalEventId.');
      }
      return { externalEventId };
    },
    async cancel(input) {
      await deliver('cancel', input);
    },
  };
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function createCalendarOutboundConnectionWithin(
  exec: DB,
  scope: Scope,
  input: {
    name: string;
    provider: 'generic' | 'google' | 'microsoft';
    calendarRef: string;
    createdByUserId: number;
    isEnabled?: boolean;
  },
) {
  const name = input.name.trim();
  const calendarRef = input.calendarRef.trim();
  if (!['generic', 'google', 'microsoft'].includes(input.provider)) {
    throw new Error('Calendar provider must be generic, google or microsoft.');
  }
  if (name.length < 2 || calendarRef.length < 2) {
    throw new Error('Calendar connection name and reference are required.');
  }
  const [connection] = await exec.insert(calendarOutboundConnection).values({
    ...scope,
    name,
    provider: input.provider,
    calendarRef,
    isEnabled: input.isEnabled ?? true,
    createdByUserId: input.createdByUserId,
  }).returning();
  return connection;
}

export async function enqueueLeaveCalendarSyncWithin(
  exec: DB,
  scope: Scope,
  input: {
    leaveRequestId: number;
    eventType: 'approved' | 'cancelled';
  },
  now = new Date(),
) {
  const [source] = await exec.select({
    requestId: leaveRequest.id,
    revisionNo: leaveRequest.currentRevisionNo,
    status: leaveRequest.status,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    employeeNo: employee.employeeNo,
    employeeName: employee.fullName,
  }).from(leaveRequest)
    .innerJoin(employee, eq(employee.id, leaveRequest.employeeId))
    .where(and(
      eq(leaveRequest.masterFn, scope.masterFn),
      eq(leaveRequest.companyFn, scope.companyFn),
      eq(leaveRequest.id, input.leaveRequestId),
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
    )).limit(1);
  if (!source) throw new Error('Leave request is unavailable for calendar sync.');
  const expectedStatus = input.eventType === 'cancelled' ? 'cancelled' : 'approved';
  if (source.status !== expectedStatus) {
    throw new Error(`Calendar ${input.eventType} requires ${expectedStatus} leave.`);
  }
  const connections = await exec.select().from(calendarOutboundConnection).where(and(
    eq(calendarOutboundConnection.masterFn, scope.masterFn),
    eq(calendarOutboundConnection.companyFn, scope.companyFn),
    eq(calendarOutboundConnection.isEnabled, true),
  )).orderBy(asc(calendarOutboundConnection.id));
  if (!connections.length) return { queued: 0, eventIds: [] as number[] };
  const [priorUpsert] = input.eventType === 'approved'
    ? await exec.select({
      eventType: calendarOutboundEvent.eventType,
      revisionNo: calendarOutboundEvent.leaveRevisionNo,
    }).from(calendarOutboundEvent)
      .where(and(
        eq(calendarOutboundEvent.masterFn, scope.masterFn),
        eq(calendarOutboundEvent.companyFn, scope.companyFn),
        eq(calendarOutboundEvent.leaveRequestId, source.requestId),
        inArray(calendarOutboundEvent.eventType, ['approved', 'changed']),
      )).orderBy(desc(calendarOutboundEvent.id)).limit(1)
    : [];
  const sourceEventType = input.eventType === 'approved'
    ? priorUpsert?.revisionNo === source.revisionNo
      ? priorUpsert.eventType
      : priorUpsert
        ? 'changed'
        : 'approved'
    : input.eventType;
  const payload: LeaveCalendarOutboundPayload = {
    summary: `${source.employeeName} · Unavailable`,
    startDate: source.startDate,
    endDateExclusive: addDays(source.endDate, 1),
    allDay: true,
    employeeNo: source.employeeNo,
    status: expectedStatus,
    source: 'erp',
  };
  const eventIds: number[] = [];
  for (const connection of connections) {
    const eventKey = [
      'calendar',
      connection.id,
      'leave',
      source.requestId,
      'revision',
      source.revisionNo,
      sourceEventType,
    ].join(':');
    const [created] = await exec.insert(calendarOutboundEvent).values({
      ...scope,
      connectionId: connection.id,
      leaveRequestId: source.requestId,
      leaveRevisionNo: source.revisionNo,
      eventType: sourceEventType,
      eventKey,
      payload,
      availableAt: now,
    }).onConflictDoNothing({
      target: [
        calendarOutboundEvent.masterFn,
        calendarOutboundEvent.companyFn,
        calendarOutboundEvent.eventKey,
      ],
    }).returning({ id: calendarOutboundEvent.id });
    if (created) eventIds.push(created.id);
  }
  return { queued: eventIds.length, eventIds };
}

async function claimCalendarBatch(
  db: DB,
  workerId: string,
  batchSize: number,
  now: Date,
  leaseMs: number,
) {
  const expiredLease = new Date(now.getTime() - leaseMs);
  return db.transaction(async (tx) => {
    const rows = await tx.select({
      id: calendarOutboundEvent.id,
      connectionId: calendarOutboundEvent.connectionId,
      requestId: calendarOutboundEvent.leaveRequestId,
      revisionNo: calendarOutboundEvent.leaveRevisionNo,
      eventType: calendarOutboundEvent.eventType,
      eventKey: calendarOutboundEvent.eventKey,
      payload: calendarOutboundEvent.payload,
      attempts: calendarOutboundEvent.attempts,
      provider: calendarOutboundConnection.provider,
      calendarRef: calendarOutboundConnection.calendarRef,
    }).from(calendarOutboundEvent)
      .innerJoin(calendarOutboundConnection, and(
        eq(calendarOutboundConnection.id, calendarOutboundEvent.connectionId),
        eq(calendarOutboundConnection.masterFn, calendarOutboundEvent.masterFn),
        eq(calendarOutboundConnection.companyFn, calendarOutboundEvent.companyFn),
      ))
      .where(and(
        inArray(calendarOutboundEvent.status, ['pending', 'failed']),
        eq(calendarOutboundConnection.isEnabled, true),
        lte(calendarOutboundEvent.availableAt, now),
        or(
          isNull(calendarOutboundEvent.lockedAt),
          lt(calendarOutboundEvent.lockedAt, expiredLease),
        ),
      ))
      .orderBy(asc(calendarOutboundEvent.id))
      .limit(batchSize)
      .for('update', { skipLocked: true });
    if (!rows.length) return rows;
    await tx.update(calendarOutboundEvent).set({
      lockedAt: now,
      lockedBy: workerId,
      lastAttemptAt: now,
      attempts: sql`${calendarOutboundEvent.attempts} + 1`,
      updatedAt: now,
    }).where(inArray(calendarOutboundEvent.id, rows.map((row) => row.id)));
    return rows;
  });
}

async function currentLeaveSource(db: DB, requestId: number) {
  const [row] = await db.select({
    status: leaveRequest.status,
    revisionNo: leaveRequest.currentRevisionNo,
  }).from(leaveRequest).where(eq(leaveRequest.id, requestId)).limit(1);
  return row;
}

async function priorExternalEventId(
  db: DB,
  connectionId: number,
  requestId: number,
) {
  const [row] = await db.select({
    externalEventId: calendarOutboundEvent.externalEventId,
  }).from(calendarOutboundEvent).where(and(
    eq(calendarOutboundEvent.connectionId, connectionId),
    eq(calendarOutboundEvent.leaveRequestId, requestId),
    inArray(calendarOutboundEvent.eventType, ['approved', 'changed']),
    eq(calendarOutboundEvent.status, 'delivered'),
  )).orderBy(desc(calendarOutboundEvent.id)).limit(1);
  return row?.externalEventId ?? null;
}

export async function processCalendarOutboundBatch(
  db: DB,
  drivers: Partial<Record<'generic' | 'google' | 'microsoft', CalendarOutboundDriver>>,
  options: CalendarWorkerOptions = {},
) {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `calendar-${Date.now()}`;
  const rows = await claimCalendarBatch(
    db,
    workerId,
    Math.min(Math.max(options.batchSize ?? 25, 1), 100),
    now,
    options.leaseMs ?? 5 * 60 * 1000,
  );
  let delivered = 0;
  let failed = 0;
  let superseded = 0;
  for (const row of rows) {
    const current = await currentLeaveSource(db, row.requestId);
    const isCurrent = row.eventType === 'cancelled'
      ? current?.status === 'cancelled' && current.revisionNo === row.revisionNo
      : current?.status === 'approved' && current.revisionNo === row.revisionNo;
    if (!isCurrent) {
      await db.update(calendarOutboundEvent).set({
        status: 'superseded',
        supersededAt: now,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        updatedAt: now,
      }).where(and(
        eq(calendarOutboundEvent.id, row.id),
        eq(calendarOutboundEvent.lockedBy, workerId),
      ));
      superseded += 1;
      continue;
    }
    try {
      const driver = drivers[row.provider as keyof typeof drivers];
      if (!driver) throw new Error(`Calendar provider is not configured: ${row.provider}`);
      const externalEventId = await priorExternalEventId(
        db,
        row.connectionId,
        row.requestId,
      );
      let deliveredExternalId = externalEventId;
      if (row.eventType !== 'cancelled') {
        const result = await driver.upsert({
          calendarRef: row.calendarRef,
          provider: row.provider as 'generic' | 'google' | 'microsoft',
          externalEventId,
          idempotencyKey: row.eventKey,
          event: row.payload as CalendarOutboundPayload,
        });
        deliveredExternalId = result.externalEventId;
      } else {
        await driver.cancel({
          calendarRef: row.calendarRef,
          provider: row.provider as 'generic' | 'google' | 'microsoft',
          externalEventId,
          idempotencyKey: row.eventKey,
        });
      }
      await db.update(calendarOutboundEvent).set({
        status: 'delivered',
        externalEventId: deliveredExternalId,
        deliveredAt: now,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        updatedAt: now,
      }).where(and(
        eq(calendarOutboundEvent.id, row.id),
        eq(calendarOutboundEvent.lockedBy, workerId),
      ));
      delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempt = row.attempts + 1;
      const delayMs = Math.min(60 * 60 * 1000, 2 ** Math.min(attempt, 10) * 1000);
      await db.update(calendarOutboundEvent).set({
        status: 'failed',
        lockedAt: null,
        lockedBy: null,
        availableAt: new Date(now.getTime() + delayMs),
        lastError: message.slice(0, 1000),
        updatedAt: now,
      }).where(and(
        eq(calendarOutboundEvent.id, row.id),
        eq(calendarOutboundEvent.lockedBy, workerId),
      ));
      failed += 1;
    }
  }
  return { claimed: rows.length, delivered, failed, superseded };
}

type StaffAppointmentEventType = 'created' | 'changed' | 'cancelled';

function appointmentEventTypeForSource(
  source: { status: string; syncToExternal: boolean },
  requested: StaffAppointmentEventType,
): boolean {
  // Opting an appointment out of external sync must also remove the external
  // event. The worker later validates the exact revision before cancelling.
  if (requested === 'cancelled') return source.status === 'cancelled' || !source.syncToExternal;
  return source.status !== 'cancelled' && source.syncToExternal;
}

/** Queue the current appointment projection for every enabled connection. The
 * worker will re-read the appointment and only deliver the current revision. */
export async function enqueueStaffAppointmentCalendarSyncWithin(
  exec: DB,
  scope: Scope,
  input: { appointmentId: number; eventType: StaffAppointmentEventType },
  now = new Date(),
) {
  const [source] = await exec.select({
    id: staffAppointment.id,
    employeeId: staffAppointment.employeeId,
    revisionNo: staffAppointment.recordVersion,
    status: staffAppointment.status,
    syncToExternal: staffAppointment.syncToExternal,
    title: staffAppointment.title,
    startAt: staffAppointment.startAt,
    endAt: staffAppointment.endAt,
    timeZone: staffAppointment.timeZone,
    recurrenceRule: staffAppointment.recurrenceRule,
    allDay: staffAppointment.allDay,
    employeeNo: employee.employeeNo,
    employeeName: employee.fullName,
  }).from(staffAppointment).innerJoin(employee, eq(employee.id, staffAppointment.employeeId))
    .where(and(
      eq(staffAppointment.id, input.appointmentId),
      eq(staffAppointment.masterFn, scope.masterFn),
      eq(staffAppointment.companyFn, scope.companyFn),
      eq(employee.masterFn, scope.masterFn),
      eq(employee.companyFn, scope.companyFn),
    )).limit(1);
  if (!source) throw new Error('Appointment is unavailable for calendar sync.');
  if (!appointmentEventTypeForSource(source, input.eventType)) {
    return { queued: 0, eventIds: [] as number[] };
  }
  const connections = await exec.select().from(calendarOutboundConnection).where(and(
    eq(calendarOutboundConnection.masterFn, scope.masterFn),
    eq(calendarOutboundConnection.companyFn, scope.companyFn),
    eq(calendarOutboundConnection.isEnabled, true),
  )).orderBy(asc(calendarOutboundConnection.id));
  if (!connections.length) return { queued: 0, eventIds: [] as number[] };

  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 93 * 24 * 60 * 60 * 1000);
  const occurrences = expandAppointmentOccurrences({
    startAt: source.startAt,
    endAt: source.endAt,
    timeZone: source.timeZone,
    recurrenceRule: source.recurrenceRule,
    from,
    to,
  });
  const eventIds: number[] = [];
  for (const connection of connections) {
    for (const occurrence of occurrences) {
      const eventKey = [
        'calendar', connection.id, 'appointment', source.id,
        'occurrence', occurrence.occurrenceStartAt,
        'revision', source.revisionNo, input.eventType,
      ].join(':');
      const payload: StaffAppointmentCalendarOutboundPayload = {
        summary: `${source.employeeName} · ${source.title}`,
        startAt: occurrence.startAt.toISOString(),
        endAt: occurrence.endAt.toISOString(),
        timeZone: source.timeZone,
        allDay: source.allDay,
        employeeNo: source.employeeNo,
        status: source.status as StaffAppointmentCalendarOutboundPayload['status'],
        source: 'erp',
        eventKind: 'appointment',
      };
      const [created] = await exec.insert(staffAppointmentOutboundEvent).values({
        ...scope,
        connectionId: connection.id,
        appointmentId: source.id,
        appointmentRevisionNo: source.revisionNo,
        occurrenceStartAt: occurrence.startAt,
        eventType: input.eventType,
        eventKey,
        payload,
        availableAt: now,
      }).onConflictDoNothing({
        target: [
          staffAppointmentOutboundEvent.masterFn,
          staffAppointmentOutboundEvent.companyFn,
          staffAppointmentOutboundEvent.eventKey,
        ],
      }).returning({ id: staffAppointmentOutboundEvent.id });
      if (created) eventIds.push(created.id);
    }
  }
  return { queued: eventIds.length, eventIds };
}

async function claimStaffAppointmentCalendarBatch(
  db: DB,
  workerId: string,
  batchSize: number,
  now: Date,
  leaseMs: number,
) {
  const expiredLease = new Date(now.getTime() - leaseMs);
  return db.transaction(async (tx) => {
    const rows = await tx.select({
      id: staffAppointmentOutboundEvent.id,
      masterFn: staffAppointmentOutboundEvent.masterFn,
      companyFn: staffAppointmentOutboundEvent.companyFn,
      connectionId: staffAppointmentOutboundEvent.connectionId,
      appointmentId: staffAppointmentOutboundEvent.appointmentId,
      revisionNo: staffAppointmentOutboundEvent.appointmentRevisionNo,
      occurrenceStartAt: staffAppointmentOutboundEvent.occurrenceStartAt,
      eventType: staffAppointmentOutboundEvent.eventType,
      eventKey: staffAppointmentOutboundEvent.eventKey,
      payload: staffAppointmentOutboundEvent.payload,
      attempts: staffAppointmentOutboundEvent.attempts,
      provider: calendarOutboundConnection.provider,
      calendarRef: calendarOutboundConnection.calendarRef,
    }).from(staffAppointmentOutboundEvent)
      .innerJoin(calendarOutboundConnection, and(
        eq(calendarOutboundConnection.id, staffAppointmentOutboundEvent.connectionId),
        eq(calendarOutboundConnection.masterFn, staffAppointmentOutboundEvent.masterFn),
        eq(calendarOutboundConnection.companyFn, staffAppointmentOutboundEvent.companyFn),
      ))
      .where(and(
        inArray(staffAppointmentOutboundEvent.status, ['pending', 'failed']),
        eq(calendarOutboundConnection.isEnabled, true),
        lte(staffAppointmentOutboundEvent.availableAt, now),
        or(
          isNull(staffAppointmentOutboundEvent.lockedAt),
          lt(staffAppointmentOutboundEvent.lockedAt, expiredLease),
        ),
      ))
      .orderBy(asc(staffAppointmentOutboundEvent.id))
      .limit(batchSize)
      .for('update', { skipLocked: true });
    if (!rows.length) return rows;
    await tx.update(staffAppointmentOutboundEvent).set({
      lockedAt: now,
      lockedBy: workerId,
      lastAttemptAt: now,
      attempts: sql`${staffAppointmentOutboundEvent.attempts} + 1`,
      updatedAt: now,
    }).where(inArray(staffAppointmentOutboundEvent.id, rows.map(row => row.id)));
    return rows;
  });
}

async function currentStaffAppointmentSource(db: DB, appointmentId: number, scope: Scope) {
  const [row] = await db.select({
    status: staffAppointment.status,
    recordVersion: staffAppointment.recordVersion,
    syncToExternal: staffAppointment.syncToExternal,
  }).from(staffAppointment).where(and(
    eq(staffAppointment.id, appointmentId),
    eq(staffAppointment.masterFn, scope.masterFn),
    eq(staffAppointment.companyFn, scope.companyFn),
  )).limit(1);
  return row;
}

async function priorStaffAppointmentExternalEventId(
  db: DB,
  connectionId: number,
  appointmentId: number,
  occurrenceStartAt: Date,
  scope: Scope,
) {
  const [row] = await db.select({
    externalEventId: staffAppointmentOutboundEvent.externalEventId,
  }).from(staffAppointmentOutboundEvent).where(and(
    eq(staffAppointmentOutboundEvent.masterFn, scope.masterFn),
    eq(staffAppointmentOutboundEvent.companyFn, scope.companyFn),
    eq(staffAppointmentOutboundEvent.connectionId, connectionId),
    eq(staffAppointmentOutboundEvent.appointmentId, appointmentId),
    eq(staffAppointmentOutboundEvent.occurrenceStartAt, occurrenceStartAt),
    inArray(staffAppointmentOutboundEvent.eventType, ['created', 'changed']),
    eq(staffAppointmentOutboundEvent.status, 'delivered'),
  )).orderBy(desc(staffAppointmentOutboundEvent.id)).limit(1);
  return row?.externalEventId ?? null;
}

export async function processStaffAppointmentOutboundBatch(
  db: DB,
  drivers: Partial<Record<'generic' | 'google' | 'microsoft', CalendarOutboundDriver>>,
  options: CalendarWorkerOptions = {},
) {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `appointment-calendar-${Date.now()}`;
  const rows = await claimStaffAppointmentCalendarBatch(
    db,
    workerId,
    Math.min(Math.max(options.batchSize ?? 25, 1), 100),
    now,
    options.leaseMs ?? 5 * 60 * 1000,
  );
  let delivered = 0;
  let failed = 0;
  let superseded = 0;
  for (const row of rows) {
    const scope = { masterFn: row.masterFn, companyFn: row.companyFn };
    const current = await currentStaffAppointmentSource(db, row.appointmentId, scope);
    const isCurrent = row.eventType === 'cancelled'
      ? current?.recordVersion === row.revisionNo
        && (current.status === 'cancelled' || current.syncToExternal === false)
      : current?.status !== 'cancelled'
        && current?.syncToExternal === true
        && current.recordVersion === row.revisionNo;
    if (!isCurrent) {
      await db.update(staffAppointmentOutboundEvent).set({
        status: 'superseded', supersededAt: now, lockedAt: null, lockedBy: null,
        lastError: null, updatedAt: now,
      }).where(and(
        eq(staffAppointmentOutboundEvent.id, row.id),
        eq(staffAppointmentOutboundEvent.lockedBy, workerId),
      ));
      superseded += 1;
      continue;
    }
    try {
      const driver = drivers[row.provider as keyof typeof drivers];
      if (!driver) throw new Error(`Calendar provider is not configured: ${row.provider}`);
      const externalEventId = await priorStaffAppointmentExternalEventId(
        db, row.connectionId, row.appointmentId, row.occurrenceStartAt, scope,
      );
      let deliveredExternalId = externalEventId;
      if (row.eventType !== 'cancelled') {
        const result = await driver.upsert({
          calendarRef: row.calendarRef,
          provider: row.provider as 'generic' | 'google' | 'microsoft',
          externalEventId,
          idempotencyKey: row.eventKey,
          event: row.payload as CalendarOutboundPayload,
        });
        deliveredExternalId = result.externalEventId;
      } else {
        await driver.cancel({
          calendarRef: row.calendarRef,
          provider: row.provider as 'generic' | 'google' | 'microsoft',
          externalEventId,
          idempotencyKey: row.eventKey,
        });
      }
      await db.update(staffAppointmentOutboundEvent).set({
        status: 'delivered', externalEventId: deliveredExternalId, deliveredAt: now,
        lockedAt: null, lockedBy: null, lastError: null, updatedAt: now,
      }).where(and(
        eq(staffAppointmentOutboundEvent.id, row.id),
        eq(staffAppointmentOutboundEvent.lockedBy, workerId),
      ));
      delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempt = row.attempts + 1;
      const delayMs = Math.min(60 * 60 * 1000, 2 ** Math.min(attempt, 10) * 1000);
      await db.update(staffAppointmentOutboundEvent).set({
        status: 'failed', lockedAt: null, lockedBy: null,
        availableAt: new Date(now.getTime() + delayMs),
        lastError: message.slice(0, 1000), updatedAt: now,
      }).where(and(
        eq(staffAppointmentOutboundEvent.id, row.id),
        eq(staffAppointmentOutboundEvent.lockedBy, workerId),
      ));
      failed += 1;
    }
  }
  return { claimed: rows.length, delivered, failed, superseded };
}
