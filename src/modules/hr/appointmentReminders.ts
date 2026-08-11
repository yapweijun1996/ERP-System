import {
  and, asc, eq, gt, inArray, isNull, isNotNull, lte, lt, or, sql,
} from 'drizzle-orm';
import type { DB } from '../../data/db';
import { employee, staffAppointment, staffAppointmentReminder } from '../../data/schema';
import { deliverNotificationWithin } from '../account/notification';
import { expandAppointmentOccurrences } from './recurrence';

const LOOKAHEAD_DAYS = 93;

export interface AppointmentReminderWorkerOptions {
  workerId?: string;
  batchSize?: number;
  leaseMs?: number;
  now?: Date;
  lookaheadDays?: number;
}

async function syncReminderQueue(db: DB, options: AppointmentReminderWorkerOptions = {}) {
  const now = options.now ?? new Date();
  const horizon = new Date(now.getTime() + (options.lookaheadDays ?? LOOKAHEAD_DAYS) * 86_400_000);
  const rows = await db.select({
    id: staffAppointment.id,
    masterFn: staffAppointment.masterFn,
    companyFn: staffAppointment.companyFn,
    title: staffAppointment.title,
    startAt: staffAppointment.startAt,
    endAt: staffAppointment.endAt,
    timeZone: staffAppointment.timeZone,
    recurrenceRule: staffAppointment.recurrenceRule,
    reminderMinutesBefore: staffAppointment.reminderMinutesBefore,
    status: staffAppointment.status,
    employeeUserId: employee.userId,
  }).from(staffAppointment).innerJoin(employee, eq(employee.id, staffAppointment.employeeId))
    .where(and(
      eq(staffAppointment.status, 'scheduled'),
    lt(staffAppointment.startAt, horizon),
    or(
      gt(staffAppointment.endAt, now),
      and(isNotNull(staffAppointment.recurrenceRule), lt(staffAppointment.startAt, horizon)),
    ),
      sql`${staffAppointment.reminderMinutesBefore} is not null`,
    )).limit(1000);
  let queued = 0;
  for (const row of rows) {
    if (!row.employeeUserId || row.reminderMinutesBefore == null) continue;
    const occurrences = expandAppointmentOccurrences({
      startAt: row.startAt,
      endAt: row.endAt,
      timeZone: row.timeZone,
      recurrenceRule: row.recurrenceRule,
      from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      to: horizon,
    });
    for (const occurrence of occurrences) {
      const reminderAt = new Date(
        occurrence.startAt.getTime() - row.reminderMinutesBefore * 60 * 1000,
      );
      const [created] = await db.insert(staffAppointmentReminder).values({
        masterFn: row.masterFn,
        companyFn: row.companyFn,
        appointmentId: row.id,
        occurrenceStartAt: occurrence.startAt,
        reminderAt,
        recipientUserId: row.employeeUserId,
        availableAt: reminderAt,
      }).onConflictDoNothing({
        target: [
          staffAppointmentReminder.masterFn,
          staffAppointmentReminder.companyFn,
          staffAppointmentReminder.appointmentId,
          staffAppointmentReminder.occurrenceStartAt,
        ],
      }).returning({ id: staffAppointmentReminder.id });
      // A pending/failed reminder is a projection of the current master. If
      // the appointment time, employee or lead time changes, refresh it in
      // place; sent history remains immutable.
      const reminderScope = and(
        eq(staffAppointmentReminder.masterFn, row.masterFn),
        eq(staffAppointmentReminder.companyFn, row.companyFn),
        eq(staffAppointmentReminder.appointmentId, row.id),
        eq(staffAppointmentReminder.occurrenceStartAt, occurrence.startAt),
      );
      await db.update(staffAppointmentReminder).set({
        reminderAt,
        recipientUserId: row.employeeUserId,
        updatedAt: now,
      }).where(and(reminderScope, inArray(staffAppointmentReminder.status, ['failed'])));
      await db.update(staffAppointmentReminder).set({
        reminderAt,
        availableAt: reminderAt,
        recipientUserId: row.employeeUserId,
        updatedAt: now,
      }).where(and(reminderScope, eq(staffAppointmentReminder.status, 'pending')));
      if (created) queued += 1;
    }
  }
  return queued;
}

async function claimReminderBatch(
  db: DB,
  workerId: string,
  batchSize: number,
  now: Date,
  leaseMs: number,
) {
  const expiredLease = new Date(now.getTime() - leaseMs);
  return db.transaction(async tx => {
    const rows = await tx.select({
      id: staffAppointmentReminder.id,
      masterFn: staffAppointmentReminder.masterFn,
      companyFn: staffAppointmentReminder.companyFn,
      appointmentId: staffAppointmentReminder.appointmentId,
      occurrenceStartAt: staffAppointmentReminder.occurrenceStartAt,
      reminderAt: staffAppointmentReminder.reminderAt,
      recipientUserId: staffAppointmentReminder.recipientUserId,
      attempts: staffAppointmentReminder.attempts,
    }).from(staffAppointmentReminder)
      .where(and(
        inArray(staffAppointmentReminder.status, ['pending', 'failed']),
        lte(staffAppointmentReminder.availableAt, now),
        lte(staffAppointmentReminder.reminderAt, now),
        or(
          isNull(staffAppointmentReminder.lockedAt),
          lt(staffAppointmentReminder.lockedAt, expiredLease),
        ),
      ))
      .orderBy(asc(staffAppointmentReminder.reminderAt), asc(staffAppointmentReminder.id))
      .limit(batchSize)
      .for('update', { skipLocked: true });
    if (!rows.length) return rows;
    await tx.update(staffAppointmentReminder).set({
      lockedAt: now,
      lockedBy: workerId,
      lastAttemptAt: now,
      attempts: sql`${staffAppointmentReminder.attempts} + 1`,
      updatedAt: now,
    }).where(inArray(staffAppointmentReminder.id, rows.map(row => row.id)));
    return rows;
  });
}

async function currentAppointment(db: DB, appointmentId: number, masterFn: string, companyFn: string) {
  const [row] = await db.select({
    id: staffAppointment.id,
    title: staffAppointment.title,
    description: staffAppointment.description,
    startAt: staffAppointment.startAt,
    endAt: staffAppointment.endAt,
    timeZone: staffAppointment.timeZone,
    recurrenceRule: staffAppointment.recurrenceRule,
    reminderMinutesBefore: staffAppointment.reminderMinutesBefore,
    status: staffAppointment.status,
    employeeUserId: employee.userId,
    employeeName: employee.fullName,
  }).from(staffAppointment).innerJoin(employee, eq(employee.id, staffAppointment.employeeId))
    .where(and(
      eq(staffAppointment.id, appointmentId),
      eq(staffAppointment.masterFn, masterFn),
      eq(staffAppointment.companyFn, companyFn),
    )).limit(1);
  return row;
}

export async function processStaffAppointmentReminderBatch(
  db: DB,
  options: AppointmentReminderWorkerOptions = {},
) {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `appointment-reminder-${Date.now()}`;
  const queued = await syncReminderQueue(db, options);
  const rows = await claimReminderBatch(
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
    const current = await currentAppointment(db, row.appointmentId, row.masterFn, row.companyFn);
    const validRecipient = row.recipientUserId != null
      && current?.employeeUserId === row.recipientUserId;
    let stillExists = false;
    if (current && current.status === 'scheduled' && current.reminderMinutesBefore != null) {
      const occurrences = expandAppointmentOccurrences({
        startAt: current.startAt,
        endAt: current.endAt,
        timeZone: current.timeZone,
        recurrenceRule: current.recurrenceRule,
        from: new Date(row.occurrenceStartAt.getTime() - 1000),
        to: new Date(row.occurrenceStartAt.getTime() + 1000),
      });
      stillExists = occurrences.some(item => (
        item.occurrenceStartAt === row.occurrenceStartAt.toISOString()
        && item.startAt.getTime() - current.reminderMinutesBefore! * 60 * 1000
          === row.reminderAt.getTime()
      ));
    }
    if (!current || !validRecipient || !stillExists) {
      await db.update(staffAppointmentReminder).set({
        status: 'superseded', supersededAt: now, lockedAt: null, lockedBy: null, updatedAt: now,
      }).where(and(
        eq(staffAppointmentReminder.id, row.id),
        eq(staffAppointmentReminder.lockedBy, workerId),
      ));
      superseded += 1;
      continue;
    }
    try {
      const scope = { masterFn: row.masterFn, companyFn: row.companyFn };
      await deliverNotificationWithin(db, scope, row.recipientUserId!, {
        kind: 'system_notice',
        severity: 'info',
        subject: `Upcoming appointment: ${current.title}`,
        detail: `${current.employeeName}, your appointment starts at ${row.occurrenceStartAt.toISOString()} (${current.timeZone}).`,
        route: 'staff-calendar',
        entityRef: `appointment:${row.appointmentId}:${row.occurrenceStartAt.toISOString()}`,
      }, now);
      await db.update(staffAppointmentReminder).set({
        status: 'sent', sentAt: now, lockedAt: null, lockedBy: null, lastError: null, updatedAt: now,
      }).where(and(
        eq(staffAppointmentReminder.id, row.id),
        eq(staffAppointmentReminder.lockedBy, workerId),
      ));
      delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempt = row.attempts + 1;
      const delayMs = Math.min(60 * 60 * 1000, 2 ** Math.min(attempt, 10) * 1000);
      await db.update(staffAppointmentReminder).set({
        status: 'failed', lockedAt: null, lockedBy: null,
        availableAt: new Date(now.getTime() + delayMs),
        lastError: message.slice(0, 1000), updatedAt: now,
      }).where(and(
        eq(staffAppointmentReminder.id, row.id),
        eq(staffAppointmentReminder.lockedBy, workerId),
      ));
      failed += 1;
    }
  }
  return { queued, claimed: rows.length, delivered, failed, superseded };
}
