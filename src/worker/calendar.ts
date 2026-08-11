import { createPostgresDb } from '../data/db';
import { withCalendarWorkerTransaction } from '../data/tenantTransaction';
import {
  createGenericCalendarDriverFromEnv,
  processCalendarOutboundBatch,
  processStaffAppointmentOutboundBatch,
} from '../modules/hr/calendarSync';
import { processStaffAppointmentReminderBatch } from '../modules/hr/appointmentReminders';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[erp-calendar-worker] DATABASE_URL is required');
  process.exit(1);
}

const db = await createPostgresDb(databaseUrl);
const calendarEnabled = Boolean(process.env.CALENDAR_OUTBOUND_URL);
const calendarDriver = calendarEnabled ? createGenericCalendarDriverFromEnv() : null;
const calendarDrivers = calendarDriver
  ? { generic: calendarDriver, google: calendarDriver, microsoft: calendarDriver }
  : null;
const workerId = process.env.CALENDAR_WORKER_ID ?? `erp-calendar-${process.pid}`;
const pollMs = Math.max(1000, Number(process.env.CALENDAR_POLL_MS) || 15000);

async function tick(): Promise<void> {
  const reminders = await withCalendarWorkerTransaction(db, tx => (
    processStaffAppointmentReminderBatch(tx, { workerId })
  ));
  if (reminders.queued > 0 || reminders.claimed > 0) {
    console.log(
      `[erp-calendar-worker] reminders queued=${reminders.queued}`
      + ` claimed=${reminders.claimed} delivered=${reminders.delivered}`
      + ` failed=${reminders.failed} superseded=${reminders.superseded}`,
    );
  }
  if (!calendarDriver) return;
  const [leave, appointments] = await Promise.all([
    withCalendarWorkerTransaction(db, tx => processCalendarOutboundBatch(
      tx, calendarDrivers!, { workerId },
    )),
    withCalendarWorkerTransaction(db, tx => processStaffAppointmentOutboundBatch(
      tx, calendarDrivers!, { workerId },
    )),
  ]);
  if (leave.claimed > 0 || appointments.claimed > 0) {
    console.log(
      `[erp-calendar-worker] leave claimed=${leave.claimed} delivered=${leave.delivered}`
      + ` failed=${leave.failed}; appointments claimed=${appointments.claimed}`
      + ` delivered=${appointments.delivered} failed=${appointments.failed}`
      + ` superseded=${appointments.superseded}`,
    );
  }
}

console.log(
  `[erp-calendar-worker] started as ${workerId}; reminders=enabled; `
  + `external-calendar=${calendarEnabled ? 'enabled' : 'disabled'}`,
);
for (;;) {
  try {
    await tick();
  } catch (error) {
    console.error('[erp-calendar-worker] tick failed', error);
  }
  await new Promise(resolve => setTimeout(resolve, pollMs));
}
