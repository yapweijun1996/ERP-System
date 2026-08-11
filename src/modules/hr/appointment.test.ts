import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  appNotification,
  appUser,
  employee,
  staffAppointmentOutboundEvent,
  staffAppointmentReminder,
} from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  cancelStaffAppointmentWithin,
  createStaffAppointmentWithin,
  listStaffAppointmentsWithin,
  updateStaffAppointmentWithin,
} from './appointment';
import {
  enqueueStaffAppointmentCalendarSyncWithin,
  processStaffAppointmentOutboundBatch,
} from './calendarSync';
import { processStaffAppointmentReminderBatch } from './appointmentReminders';
import { listStaffCalendarWithin } from './staffCalendar';

const singapore = { masterFn: 'M1', companyFn: 'C-SG' };
const malaysia = { masterFn: 'M1', companyFn: 'C-MY' };

async function employeeId(db: Awaited<ReturnType<typeof freshDb>>, scope: typeof singapore, employeeNo: string) {
  const [row] = await db.select({ id: employee.id }).from(employee).where(and(
    eq(employee.masterFn, scope.masterFn),
    eq(employee.companyFn, scope.companyFn),
    eq(employee.employeeNo, employeeNo),
  )).limit(1);
  if (!row) throw new Error(`Missing fixture employee ${employeeNo}`);
  return row.id;
}

describe('staff appointment SSOT', () => {
  it('projects appointments and leave together without copying either fact source', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const ids = await db.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, singapore.masterFn),
      eq(employee.companyFn, singapore.companyFn),
      eq(employee.isActive, true),
    ));

    const result = await listStaffCalendarWithin(db, singapore, ids.map(row => row.id), {
      from: '2026-08-01', to: '2026-08-31',
    });
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventKind: 'leave', id: expect.stringMatching(/^leave:/) }),
      expect.objectContaining({
        eventKind: 'appointment',
        id: expect.stringMatching(/^appointment:/),
        title: 'Client site inspection',
        employeeName: 'Marcus Silva',
        startDate: '2026-08-06',
      }),
    ]));
    expect(result.items.filter(item => item.eventKind === 'appointment')).toHaveLength(2);

    const myIds = await db.select({ id: employee.id }).from(employee).where(and(
      eq(employee.masterFn, malaysia.masterFn),
      eq(employee.companyFn, malaysia.companyFn),
      eq(employee.isActive, true),
    ));
    const malaysiaResult = await listStaffCalendarWithin(db, malaysia, myIds.map(row => row.id), {
      from: '2026-08-01', to: '2026-08-31',
    });
    expect(malaysiaResult.items.some(item => item.eventKind === 'appointment')).toBe(false);
  });

  it('creates, updates and cancels with tenant scope and optimistic versions', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select({ userId: appUser.userId })
      .from(appUser).where(eq(appUser.username, 'admin')).limit(1);
    const marcusId = await employeeId(db, singapore, 'EMP-1042');
    const created = await db.transaction(tx => createStaffAppointmentWithin(tx, singapore, {
      employeeId: marcusId,
      appointmentType: 'training',
      title: 'Safety refresher',
      startAt: '2026-09-02T01:00:00Z',
      endAt: '2026-09-02T02:00:00Z',
      location: 'Training room',
    }, admin.userId));
    expect(created).toMatchObject({ status: 'scheduled', recordVersion: 1, employeeId: marcusId });

    const updated = await db.transaction(tx => updateStaffAppointmentWithin(tx, singapore, created.id, 1, {
      employeeId: marcusId,
      appointmentType: 'training',
      title: 'Safety refresher — revised',
      startAt: created.startAt,
      endAt: created.endAt,
      location: 'Training room 2',
    }, admin.userId));
    expect(updated.after).toMatchObject({ title: 'Safety refresher — revised', recordVersion: 2 });
    await expect(db.transaction(tx => updateStaffAppointmentWithin(tx, singapore, created.id, 1, {
      employeeId: marcusId,
      appointmentType: 'training',
      title: 'Stale update',
      startAt: created.startAt,
      endAt: created.endAt,
    }, admin.userId))).rejects.toMatchObject({ code: 'appointment_version_conflict' });

    const cancelled = await db.transaction(tx => cancelStaffAppointmentWithin(
      tx, singapore, created.id, 2, admin.userId,
    ));
    expect(cancelled).toMatchObject({ status: 'cancelled', recordVersion: 3 });
    const rows = await listStaffAppointmentsWithin(db, singapore, [marcusId], {
      from: new Date('2026-09-01T00:00:00Z'), to: new Date('2026-09-03T00:00:00Z'),
    });
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.id, status: 'cancelled', title: 'Safety refresher — revised' }),
    ]));
    await expect(db.transaction(tx => cancelStaffAppointmentWithin(
      tx, malaysia, created.id, 3, admin.userId,
    ))).rejects.toMatchObject({ code: 'appointment_not_found' });
  });

  it('rejects unsafe time inputs before writing', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select({ userId: appUser.userId })
      .from(appUser).where(eq(appUser.username, 'admin')).limit(1);
    const marcusId = await employeeId(db, singapore, 'EMP-1042');
    await expect(db.transaction(tx => createStaffAppointmentWithin(tx, singapore, {
      employeeId: marcusId,
      title: 'Missing timezone',
      startAt: '2026-09-02T01:00:00',
      endAt: '2026-09-02T02:00:00Z',
    }, admin.userId))).rejects.toMatchObject({ code: 'invalid_appointment_datetime' });
    await expect(db.transaction(tx => createStaffAppointmentWithin(tx, singapore, {
      employeeId: marcusId,
      title: 'Backwards range',
      startAt: '2026-09-02T02:00:00Z',
      endAt: '2026-09-02T01:00:00Z',
    }, admin.userId))).rejects.toMatchObject({ code: 'invalid_appointment_range' });
  });

  it('expands recurrence, queues external occurrences and delivers a reminder once', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [admin] = await db.select({ userId: appUser.userId })
      .from(appUser).where(eq(appUser.username, 'admin')).limit(1);
    const marcusId = await employeeId(db, singapore, 'EMP-1042');
    const created = await db.transaction(tx => createStaffAppointmentWithin(tx, singapore, {
      employeeId: marcusId,
      appointmentType: 'meeting',
      title: 'Recurring service review',
      startAt: '2026-08-03T01:00:00Z',
      endAt: '2026-08-03T02:00:00Z',
      timeZone: 'Asia/Singapore',
      recurrenceRule: 'FREQ=WEEKLY;COUNT=3',
      reminderMinutesBefore: 15,
      syncToExternal: true,
    }, admin.userId));
    const rows = await listStaffAppointmentsWithin(db, singapore, [marcusId], {
      from: new Date('2026-08-01T00:00:00Z'), to: new Date('2026-09-01T00:00:00Z'),
    });
    const recurringRows = rows.filter(row => row.title === 'Recurring service review');
    expect(recurringRows).toHaveLength(3);
    expect(recurringRows[1]).toMatchObject({ timeZone: 'Asia/Singapore', reminderMinutesBefore: 15 });

    const queued = await db.transaction(tx => enqueueStaffAppointmentCalendarSyncWithin(
      tx, singapore, { appointmentId: created.id, eventType: 'created' }, new Date('2026-08-01T00:00:00Z'),
    ));
    expect(queued.queued).toBe(3);
    const driverEvents: string[] = [];
    const delivered = await processStaffAppointmentOutboundBatch(db, {
      generic: {
        async upsert(input) {
          driverEvents.push(input.idempotencyKey);
          return { externalEventId: `ext-${driverEvents.length}` };
        },
        async cancel() {},
      },
    }, { workerId: 'appointment-calendar-test', now: new Date('2026-08-01T00:00:00Z') });
    expect(delivered).toMatchObject({ claimed: 3, delivered: 3, failed: 0 });
    expect(driverEvents).toHaveLength(3);
    expect((await db.select().from(staffAppointmentOutboundEvent)).filter(row => row.status === 'delivered')).toHaveLength(3);

    const reminder = await processStaffAppointmentReminderBatch(db, {
      workerId: 'appointment-reminder-test',
      now: new Date('2026-08-03T00:50:00Z'),
    });
    expect(reminder.queued).toBe(3);
    expect(reminder.delivered).toBe(1);
    expect((await db.select().from(staffAppointmentReminder)).filter(row => row.status === 'sent')).toHaveLength(1);
    expect((await db.select().from(appNotification)).some(row => row.entityRef?.startsWith(`appointment:${created.id}:`))).toBe(true);

    const optedOut = await db.transaction(tx => updateStaffAppointmentWithin(tx, singapore, created.id, 1, {
      employeeId: marcusId,
      appointmentType: 'meeting',
      title: 'Recurring service review',
      startAt: created.startAt,
      endAt: created.endAt,
      timeZone: 'Asia/Singapore',
      recurrenceRule: 'FREQ=WEEKLY;COUNT=3',
      reminderMinutesBefore: 15,
      syncToExternal: false,
    }, admin.userId));
    const cancellationQueue = await db.transaction(tx => enqueueStaffAppointmentCalendarSyncWithin(
      tx, singapore, { appointmentId: created.id, eventType: 'cancelled' }, new Date('2026-08-04T00:00:00Z'),
    ));
    expect(optedOut.after).toMatchObject({ syncToExternal: false, recordVersion: 2 });
    expect(cancellationQueue.queued).toBe(3);
    const cancelEvents: Array<string | null> = [];
    const cancellationResult = await processStaffAppointmentOutboundBatch(db, {
      generic: {
        async upsert(input) { return { externalEventId: input.externalEventId ?? 'unexpected' }; },
        async cancel(input) { cancelEvents.push(input.externalEventId); },
      },
    }, { workerId: 'appointment-calendar-cancel-test', now: new Date('2026-08-04T00:00:00Z') });
    expect(cancellationResult).toMatchObject({ claimed: 3, delivered: 3, failed: 0 });
    expect(cancelEvents).toEqual(['ext-1', 'ext-2', 'ext-3']);
  });
});
