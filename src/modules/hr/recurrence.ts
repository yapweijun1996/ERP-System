/**
 * Small, deliberately bounded recurrence engine for Staff Calendar.
 *
 * It accepts the useful ERP subset of RFC 5545 RRULE syntax rather than
 * pretending to implement every calendar standard:
 *   FREQ=DAILY|WEEKLY|MONTHLY
 *   INTERVAL=1..365
 *   BYDAY=MO,TU,... (weekly only)
 *   COUNT=1..366 or UNTIL=YYYY-MM-DD / RFC-style UTC timestamp
 *
 * The appointment's stored timestamps remain UTC instants. Recurrence is
 * expanded in the appointment's IANA time zone so a 09:00 local appointment
 * stays at 09:00 across daylight-saving transitions.
 */

export const RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type RecurrenceFrequency = typeof RECURRENCE_FREQUENCIES[number];

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  byDay: number[];
  count: number | null;
  untilDate: string | null;
}

export interface RecurrenceOccurrence {
  startAt: Date;
  endAt: Date;
  occurrenceStartAt: string;
}

export class RecurrenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecurrenceError';
  }
}

const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
const DAY_NUMBERS = new Map(DAY_CODES.map((code, index) => [code, index + 1]));

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function dateKeyFromUtcDate(value: Date): string {
  return dateKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function dateKeyToUtc(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || dateKeyFromUtcDate(date) !== value) {
    throw new RecurrenceError('UNTIL must be a valid calendar date.');
  }
  return date;
}

export function validateTimeZone(value: string): string {
  const timeZone = String(value ?? '').trim();
  if (!timeZone || timeZone.length > 64) throw new RecurrenceError('timeZone is required.');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
  } catch {
    throw new RecurrenceError(`timeZone is not a supported IANA time zone: ${timeZone}.`);
  }
  return timeZone;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

function localParts(value: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: get('hour'), minute: get('minute'), second: get('second'),
    millisecond: value.getMilliseconds(),
  };
}

function localEpoch(parts: LocalParts): number {
  return Date.UTC(
    parts.year, parts.month - 1, parts.day,
    parts.hour, parts.minute, parts.second, parts.millisecond,
  );
}

function partsFromLocalEpoch(value: number): LocalParts {
  const date = new Date(value);
  return {
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds(),
  };
}

/** Convert a local wall-clock value into its UTC instant, including DST. */
export function zonedLocalToUtc(parts: LocalParts, timeZone: string): Date {
  const wall = localEpoch(parts);
  const candidates = new Set<number>();
  // Sampling around the wall-clock value finds both offsets at a fall-back
  // fold and also lets us reject a spring-forward gap instead of silently
  // moving the appointment to a different local time.
  for (const hours of [-36, -24, -12, -6, -3, -2, -1, 0, 1, 2, 3, 6, 12, 24, 36]) {
    const sample = wall + hours * 60 * 60 * 1000;
    const offset = localEpoch(localParts(new Date(sample), timeZone)) - sample;
    const candidate = wall - offset;
    const visible = localParts(new Date(candidate), timeZone);
    if (localEpoch(visible) === wall) candidates.add(candidate);
  }
  if (candidates.size === 0) {
    throw new RecurrenceError('The local appointment time does not exist in this time zone (DST gap).');
  }
  if (candidates.size > 1) {
    throw new RecurrenceError('The local appointment time is ambiguous in this time zone (DST fold).');
  }
  return new Date([...candidates][0]);
}

function localDateFromParts(parts: LocalParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function addLocalDays(parts: LocalParts, days: number): LocalParts {
  const date = localDateFromParts(parts);
  date.setUTCDate(date.getUTCDate() + days);
  return { ...parts, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function weekday(parts: LocalParts): number {
  const day = localDateFromParts(parts).getUTCDay();
  return day === 0 ? 7 : day;
}

function parseUntil(value: string): string {
  const text = value.trim();
  if (/^\d{8}T\d{6}Z$/i.test(text)) {
    const date = new Date(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T${text.slice(9, 11)}:${text.slice(11, 13)}:${text.slice(13, 15)}Z`);
    if (Number.isNaN(date.getTime())) throw new RecurrenceError('UNTIL must be valid.');
    return dateKeyFromUtcDate(date);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    dateKeyToUtc(text);
    return text;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new RecurrenceError('UNTIL must be a valid date or UTC timestamp.');
  return dateKeyFromUtcDate(date);
}

export function parseRecurrenceRule(value: string | null | undefined): RecurrenceRule | null {
  const text = value == null ? '' : String(value).trim().toUpperCase();
  if (!text) return null;
  const entries = new Map<string, string>();
  for (const part of text.split(';')) {
    const [key, raw] = part.split('=', 2);
    if (!key || !raw || entries.has(key)) throw new RecurrenceError('recurrenceRule contains an invalid component.');
    entries.set(key.trim(), raw.trim());
  }
  for (const key of entries.keys()) {
    if (!['FREQ', 'INTERVAL', 'BYDAY', 'COUNT', 'UNTIL'].includes(key)) {
      throw new RecurrenceError(`recurrenceRule component is unsupported: ${key}.`);
    }
  }
  const frequency = entries.get('FREQ') as RecurrenceFrequency | undefined;
  if (!frequency || !RECURRENCE_FREQUENCIES.includes(frequency)) {
    throw new RecurrenceError('recurrenceRule must include FREQ=DAILY, WEEKLY or MONTHLY.');
  }
  const interval = Number(entries.get('INTERVAL') ?? '1');
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
    throw new RecurrenceError('recurrenceRule INTERVAL must be between 1 and 365.');
  }
  const byDay = entries.get('BYDAY')?.split(',').map(code => {
    const number = DAY_NUMBERS.get(code.trim() as typeof DAY_CODES[number]);
    if (!number) throw new RecurrenceError('recurrenceRule BYDAY contains an invalid weekday.');
    return number;
  }) ?? [];
  if (byDay.length > 7 || new Set(byDay).size !== byDay.length) {
    throw new RecurrenceError('recurrenceRule BYDAY contains duplicate or too many weekdays.');
  }
  if (byDay.length && frequency !== 'WEEKLY') {
    throw new RecurrenceError('recurrenceRule BYDAY is supported only for weekly rules.');
  }
  const countValue = entries.get('COUNT');
  const count = countValue == null ? null : Number(countValue);
  if (count != null && (!Number.isInteger(count) || count < 1 || count > 366)) {
    throw new RecurrenceError('recurrenceRule COUNT must be between 1 and 366.');
  }
  if (count != null && entries.has('UNTIL')) {
    throw new RecurrenceError('recurrenceRule must use COUNT or UNTIL, not both.');
  }
  return {
    frequency,
    interval,
    byDay,
    count,
    untilDate: entries.has('UNTIL') ? parseUntil(entries.get('UNTIL')!) : null,
  };
}

function inRange(date: Date, from: Date, to: Date): boolean {
  return date < to && date.getTime() >= from.getTime();
}

/** Expand a master appointment within a bounded UTC range. */
export function expandAppointmentOccurrences(input: {
  startAt: Date;
  endAt: Date;
  timeZone: string;
  recurrenceRule?: string | null;
  from: Date;
  to: Date;
}): RecurrenceOccurrence[] {
  const timeZone = validateTimeZone(input.timeZone);
  const rule = parseRecurrenceRule(input.recurrenceRule);
  const baseStartLocal = localParts(input.startAt, timeZone);
  const baseEndLocal = localParts(input.endAt, timeZone);
  const wallDuration = localEpoch(baseEndLocal) - localEpoch(baseStartLocal);
  const baseOccurrence: RecurrenceOccurrence = {
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
    occurrenceStartAt: input.startAt.toISOString(),
  };
  if (!rule) return inRange(baseOccurrence.startAt, input.from, input.to) ? [baseOccurrence] : [];

  const results: RecurrenceOccurrence[] = [];
  const toLocal = localParts(input.to, timeZone);
  const untilDate = rule.untilDate;
  let occurrenceIndex = 0;

  const emit = (cursor: LocalParts) => {
    const candidateDate = dateKey(cursor.year, cursor.month, cursor.day);
    if (untilDate && candidateDate > untilDate) return false;
    const startAt = zonedLocalToUtc(cursor, timeZone);
    const endAt = zonedLocalToUtc(partsFromLocalEpoch(localEpoch(cursor) + wallDuration), timeZone);
    if (inRange(startAt, input.from, input.to)) {
      results.push({ startAt, endAt, occurrenceStartAt: startAt.toISOString() });
    }
    occurrenceIndex += 1;
    return true;
  };
  const maxGuard = 12000;
  if (rule.frequency === 'DAILY') {
    const dayDiff = Math.floor((localDateFromParts(toLocal).getTime() - localDateFromParts(baseStartLocal).getTime()) / 86_400_000);
    let index = rule.count == null
      ? Math.max(0, Math.floor(Math.max(0, dayDiff - 1) / rule.interval))
      : 0;
    let guard = 0;
    while (guard++ < maxGuard) {
      if (rule.count != null && occurrenceIndex >= rule.count) break;
      const cursor = addLocalDays(baseStartLocal, index * rule.interval);
      if (dateKey(cursor.year, cursor.month, cursor.day) > dateKey(toLocal.year, toLocal.month, toLocal.day)) break;
      if (!emit(cursor)) break;
      index += 1;
    }
  } else if (rule.frequency === 'WEEKLY') {
    const dayDiff = Math.floor((localDateFromParts(toLocal).getTime() - localDateFromParts(baseStartLocal).getTime()) / 86_400_000);
    let dayOffset = rule.count == null ? Math.max(0, dayDiff - 7) : 0;
    let guard = 0;
    while (guard++ < maxGuard) {
      if (rule.count != null && occurrenceIndex >= rule.count) break;
      const cursor = addLocalDays(baseStartLocal, dayOffset);
      if (dateKey(cursor.year, cursor.month, cursor.day) > dateKey(toLocal.year, toLocal.month, toLocal.day)) break;
      const weekIndex = Math.floor(dayOffset / 7);
      const matchesDay = rule.byDay.length
        ? rule.byDay.includes(weekday(cursor))
        : weekday(cursor) === weekday(baseStartLocal);
      if (weekIndex % rule.interval === 0 && matchesDay && !emit(cursor)) break;
      dayOffset += 1;
    }
  } else {
    const baseMonth = baseStartLocal.year * 12 + baseStartLocal.month - 1;
    const targetMonth = toLocal.year * 12 + toLocal.month - 1;
    let monthIndex = rule.count == null
      ? Math.max(0, Math.floor((targetMonth - baseMonth - 1) / rule.interval))
      : 0;
    let guard = 0;
    while (guard++ < maxGuard) {
      if (rule.count != null && occurrenceIndex >= rule.count) break;
      const month = baseMonth + monthIndex * rule.interval;
      const year = Math.floor(month / 12);
      const monthNumber = (month % 12) + 1;
      const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
      if (year > toLocal.year || (year === toLocal.year && monthNumber > toLocal.month)) break;
      if (baseStartLocal.day <= lastDay) {
        if (!emit({ ...baseStartLocal, year, month: monthNumber })) break;
      }
      monthIndex += 1;
    }
  }
  return results;
}

export function dateInTimeZone(value: Date, timeZone: string): string {
  const parts = localParts(value, validateTimeZone(timeZone));
  return dateKey(parts.year, parts.month, parts.day);
}
