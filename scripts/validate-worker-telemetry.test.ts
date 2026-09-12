import { describe, expect, it } from 'vitest';
import { runCli, validateTelemetryLines, validateTelemetrySnapshot } from './validate-worker-telemetry.mjs';

const primaryQueues = [
  'outbox', 'report', 'tax-evidence', 'document-scan', 'document-extraction',
  'calendar-leave', 'calendar-appointment', 'calendar-reminder',
];

function record(overrides: Record<string, unknown> = {}) {
  return {
    type: 'erp.worker.telemetry',
    workerId: 'test-worker',
    generatedAt: '2026-09-11T00:00:00.000Z',
    scope: 'primary',
    queryDurationMs: 8,
    queues: primaryQueues.map(queue => ({
      queue,
      pending: 0,
      ready: 0,
      inFlight: 0,
      retrying: 0,
      failed: 0,
      deadLettered: 0,
      oldestPendingAgeSeconds: null,
    })),
    ...overrides,
  };
}

describe('worker telemetry validator', () => {
  it('accepts aggregate-only primary and calendar snapshots without a configured budget', () => {
    const primary = validateTelemetrySnapshot(record());
    expect(primary).toMatchObject({ scope: 'primary', queueCount: 8, queryDurationMs: 8, budgetExceeded: false });

    const calendar = validateTelemetrySnapshot({
      ...record({ scope: 'calendar', queues: primaryQueues.slice(-3).map(queue => ({
        queue,
        pending: 1,
        ready: 1,
        inFlight: 0,
        retrying: 0,
        failed: 0,
        deadLettered: 0,
        oldestPendingAgeSeconds: 3,
      })) }),
    });
    expect(calendar).toMatchObject({ scope: 'calendar', queueCount: 3, budgetExceeded: false });
  });

  it('classifies an explicit query budget without inventing a default threshold', () => {
    const within = validateTelemetryLines(`${JSON.stringify(record({ queryDurationMs: 8 }))}\n`, { maxQueryMs: 10 });
    expect(within).toMatchObject({ maxQueryDurationMs: 8, budgetExceeded: false });

    const exceeded = validateTelemetryLines(`${JSON.stringify(record({ queryDurationMs: 11 }))}\n`, { maxQueryMs: 10 });
    expect(exceeded).toMatchObject({ maxQueryDurationMs: 11, budgetExceeded: true });
    expect(validateTelemetryLines(JSON.stringify(record()))).toMatchObject({ budgetExceeded: false });
  });

  it('rejects payload-bearing, malformed or reordered telemetry', () => {
    expect(() => validateTelemetrySnapshot(record({ payload: { tenant: 'must-not-appear' } }))).toThrow(/forbidden telemetry field/);
    expect(() => validateTelemetrySnapshot(record({ queryDurationMs: -1 }))).toThrow(/non-negative integer/);
    expect(() => validateTelemetrySnapshot(record({ queues: [...record().queues].reverse() }))).toThrow(/out of order/);
    expect(() => validateTelemetryLines('not json\n')).toThrow(/valid JSON/);
  });

  it('returns CLI status without echoing worker or queue payload data', () => {
    const input = `${JSON.stringify(record({ workerId: 'secret-token-worker' }))}\n`;
    const output: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (value?: unknown) => output.push(String(value));
    console.error = () => undefined;
    try {
      expect(runCli(['--max-query-ms', '10'], () => input)).toBe(0);
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
    expect(output.join('\n')).not.toContain('secret-token-worker');
    expect(output.join('\n')).toContain('"budget":"within"');
  });

  it('accepts an explicit stdin marker for pipeline use', () => {
    const input = `${JSON.stringify(record())}\n`;
    const output: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (value?: unknown) => output.push(String(value));
    console.error = () => undefined;
    try {
      expect(runCli(['--max-query-ms', '10', '-'], () => input)).toBe(0);
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
    expect(output.join('\n')).toContain('"status":"valid"');
  });
});
