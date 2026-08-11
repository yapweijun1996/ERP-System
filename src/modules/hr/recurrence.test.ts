import { describe, expect, it } from 'vitest';
import {
  expandAppointmentOccurrences,
  parseRecurrenceRule,
  RecurrenceError,
  zonedLocalToUtc,
} from './recurrence';

describe('staff appointment recurrence', () => {
  it('expands a bounded daily rule in the half-open query range', () => {
    const rows = expandAppointmentOccurrences({
      startAt: new Date('2026-08-01T01:00:00Z'),
      endAt: new Date('2026-08-01T02:00:00Z'),
      timeZone: 'Asia/Singapore',
      recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=3',
      from: new Date('2026-08-01T00:00:00Z'),
      to: new Date('2026-08-04T00:00:00Z'),
    });
    expect(rows.map(row => row.startAt.toISOString())).toEqual([
      '2026-08-01T01:00:00.000Z',
      '2026-08-02T01:00:00.000Z',
      '2026-08-03T01:00:00.000Z',
    ]);
  });

  it('supports weekly BYDAY and preserves the local wall-clock time across DST', () => {
    const rows = expandAppointmentOccurrences({
      startAt: new Date('2026-03-02T14:00:00Z'),
      endAt: new Date('2026-03-02T15:00:00Z'),
      timeZone: 'America/New_York',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=3',
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-24T00:00:00Z'),
    });
    expect(rows.map(row => row.startAt.toISOString())).toEqual([
      '2026-03-02T14:00:00.000Z',
      '2026-03-09T13:00:00.000Z',
      '2026-03-16T13:00:00.000Z',
    ]);
  });

  it('does not lose month-end recurrence instances', () => {
    const rows = expandAppointmentOccurrences({
      startAt: new Date('2026-01-31T01:00:00Z'),
      endAt: new Date('2026-01-31T02:00:00Z'),
      timeZone: 'Asia/Singapore',
      recurrenceRule: 'FREQ=MONTHLY;COUNT=4',
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-08-01T00:00:00Z'),
    });
    expect(rows.map(row => row.startAt.toISOString())).toEqual([
      '2026-01-31T01:00:00.000Z',
      '2026-03-31T01:00:00.000Z',
      '2026-05-31T01:00:00.000Z',
      '2026-07-31T01:00:00.000Z',
    ]);
  });

  it('rejects unsupported rules, DST gaps and DST folds', () => {
    expect(() => parseRecurrenceRule('FREQ=YEARLY;COUNT=2')).toThrow(RecurrenceError);
    expect(() => zonedLocalToUtc({
      year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0, millisecond: 0,
    }, 'America/New_York')).toThrow(/DST gap/);
    expect(() => zonedLocalToUtc({
      year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0, millisecond: 0,
    }, 'America/New_York')).toThrow(/DST fold/);
  });
});
