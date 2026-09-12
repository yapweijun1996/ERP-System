import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DETERMINISTIC_RUNTIME_LIMITS,
  createDeterministicZeroSpendProvider,
  runAiRuntime,
  AiRuntimeError,
  type AiProvider,
} from './aiRuntime';

const requestMessages = [{ role: 'user' as const, content: 'Summarize the approved receipt evidence.' }];

describe('AI runtime contract', () => {
  it('returns a deterministic zero-spend success with explicit state transitions', async () => {
    const transitions: string[] = [];
    const result = await runAiRuntime({
      runId: 'run-zero-spend-1',
      provider: createDeterministicZeroSpendProvider(),
      messages: requestMessages,
      limits: DEFAULT_DETERMINISTIC_RUNTIME_LIMITS,
      onStateChange: ({ from, to }) => transitions.push(`${from}->${to}`),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected deterministic success');
    expect(result.response.text).toBe('Deterministic zero-spend response.');
    expect(result.response.costMicros).toBe(0);
    expect(result.snapshot).toMatchObject({
      state: 'succeeded',
      providerCalls: 1,
      retries: 0,
      reservedCostMicros: 0,
      spentCostMicros: 0,
      stateHistory: ['draft', 'waiting', 'running', 'succeeded'],
    });
    expect(transitions).toEqual(['draft->waiting', 'waiting->running', 'running->succeeded']);
  });

  it('fails closed when the provider is unavailable instead of simulating success', async () => {
    const result = await runAiRuntime({
      runId: 'run-provider-unavailable',
      provider: createDeterministicZeroSpendProvider({ available: false }),
      messages: requestMessages,
      limits: DEFAULT_DETERMINISTIC_RUNTIME_LIMITS,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unavailable provider must not succeed');
    expect(result.response).toBeUndefined();
    expect(result.error).toEqual({
      code: 'provider_unavailable',
      message: 'The configured AI provider is unavailable. Configure an approved provider before retrying.',
      retryable: false,
      recoveryAction: 'configure_provider',
    });
    expect(result.snapshot.state).toBe('failed');
    expect(result.snapshot.stateHistory).not.toContain('succeeded');
  });

  it('rejects a call before dispatch when the cost reservation exceeds the budget', async () => {
    let calls = 0;
    const result = await runAiRuntime({
      runId: 'run-cost-budget',
      provider: createDeterministicZeroSpendProvider({
        costPerCallMicros: 1,
        onCall: () => { calls += 1; },
      }),
      messages: requestMessages,
      limits: {
        ...DEFAULT_DETERMINISTIC_RUNTIME_LIMITS,
        maxCostMicros: 0,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('cost budget must fail before dispatch');
    expect(calls).toBe(0);
    expect(result.error.code).toBe('budget_exhausted');
    expect(result.error.recoveryAction).toBe('reduce_request_or_increase_budget');
    expect(result.snapshot.stateHistory).toEqual(['draft', 'waiting', 'running', 'failed']);
  });

  it('counts retry attempts against the provider-call budget', async () => {
    let calls = 0;
    const result = await runAiRuntime({
      runId: 'run-retry-budget',
      provider: createDeterministicZeroSpendProvider({
        failure: { retryable: true },
        onCall: () => { calls += 1; },
      }),
      messages: requestMessages,
      limits: {
        ...DEFAULT_DETERMINISTIC_RUNTIME_LIMITS,
        maxProviderCalls: 2,
        maxRetries: 1,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('repeated provider failure must not succeed');
    expect(calls).toBe(2);
    expect(result.snapshot.providerCalls).toBe(2);
    expect(result.snapshot.retries).toBe(1);
    expect(result.error.code).toBe('provider_failed');
  });

  it('retains unknown dispatched costs so retries cannot reuse the same budget', async () => {
    let calls = 0;
    const result = await runAiRuntime({
      runId: 'retry-unknown-cost',
      provider: createDeterministicZeroSpendProvider({
        costPerCallMicros: 10,
        failure: { retryable: true },
        onCall: () => { calls += 1; },
      }),
      messages: requestMessages,
      limits: { ...DEFAULT_DETERMINISTIC_RUNTIME_LIMITS, maxProviderCalls: 3, maxRetries: 2, maxCostMicros: 10 },
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'budget_exhausted' },
      snapshot: { reservedCostMicros: 10, spentCostMicros: 0, providerCalls: 1, retries: 0 },
    });
  });

  it('reconciles a successful retry without losing the first unknown charge', async () => {
    let calls = 0;
    const base = createDeterministicZeroSpendProvider();
    const provider: AiProvider = {
      ...base,
      costPerCallMicros: 10,
      async complete(request) {
        calls += 1;
        if (calls === 1) throw new AiRuntimeError('provider_failed', 'Injected transport failure.', { retryable: true });
        return { ...await base.complete(request), costMicros: 3 };
      },
    };
    const result = await runAiRuntime({
      runId: 'retry-known-cost', provider, messages: requestMessages,
      limits: { ...DEFAULT_DETERMINISTIC_RUNTIME_LIMITS, maxProviderCalls: 2, maxRetries: 1, maxCostMicros: 20 },
    });
    expect(result).toMatchObject({ ok: true, snapshot: { reservedCostMicros: 13, spentCostMicros: 3, retries: 1 } });
  });

  it('rejects a provider cost above its promised per-call maximum', async () => {
    const base = createDeterministicZeroSpendProvider();
    const result = await runAiRuntime({
      runId: 'provider-under-reserved',
      provider: { ...base, costPerCallMicros: 10, complete: async (request) => ({ ...await base.complete(request), costMicros: 11 }) },
      messages: requestMessages,
      limits: { ...DEFAULT_DETERMINISTIC_RUNTIME_LIMITS, maxCostMicros: 30 },
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'budget_exhausted' }, snapshot: { spentCostMicros: 11, reservedCostMicros: 11 } });
    expect(result.response).toBeUndefined();
  });

  it('records known cost even when the response fails the output bound', async () => {
    const base = createDeterministicZeroSpendProvider({ responseText: 'too long' });
    const result = await runAiRuntime({
      runId: 'oversized-known-cost',
      provider: { ...base, costPerCallMicros: 10, complete: async (request) => ({ ...await base.complete(request), costMicros: 3 }) },
      messages: requestMessages,
      limits: { ...DEFAULT_DETERMINISTIC_RUNTIME_LIMITS, maxOutputChars: 2, maxCostMicros: 10 },
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'output_limit_exceeded' }, snapshot: { reservedCostMicros: 3, spentCostMicros: 3 } });
  });

  it('counts tool-call metadata against the next request input bound', async () => {
    let calls = 0;
    const result = await runAiRuntime({
      runId: 'tool-history-bound',
      provider: createDeterministicZeroSpendProvider({ onCall: () => { calls += 1; } }),
      messages: [{ role: 'assistant', content: '', toolCalls: [{ callId: 'large', name: 'receipt.search', arguments: { search: 'x'.repeat(100) } }] }],
      limits: { ...DEFAULT_DETERMINISTIC_RUNTIME_LIMITS, maxInputChars: 50 },
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'input_limit_exceeded' } });
    expect(calls).toBe(0);
  });

  it('returns an output-limit error without exposing an oversized result', async () => {
    const result = await runAiRuntime({
      runId: 'run-output-bound',
      provider: createDeterministicZeroSpendProvider({ responseText: '12345' }),
      messages: requestMessages,
      limits: {
        ...DEFAULT_DETERMINISTIC_RUNTIME_LIMITS,
        maxOutputChars: 4,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('oversized output must fail');
    expect(result.response).toBeUndefined();
    expect(result.error.code).toBe('output_limit_exceeded');
    expect(result.error.recoveryAction).toBe('reduce_output_limit');
  });

  it('preserves cancellation and whole-run timeout as distinct failures', async () => {
    const controller = new AbortController();
    const cancelledPromise = runAiRuntime({
      runId: 'run-cancelled',
      provider: createDeterministicZeroSpendProvider({ delayMs: 40 }),
      messages: requestMessages,
      limits: { ...DEFAULT_DETERMINISTIC_RUNTIME_LIMITS, maxDurationMs: 100 },
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 5);
    const cancelled = await cancelledPromise;
    expect(cancelled.ok).toBe(false);
    if (cancelled.ok) throw new Error('cancelled run must not succeed');
    expect(cancelled.snapshot.state).toBe('cancelled');
    expect(cancelled.error.code).toBe('cancelled');

    const timedOut = await runAiRuntime({
      runId: 'run-timeout',
      provider: createDeterministicZeroSpendProvider({ delayMs: 40 }),
      messages: requestMessages,
      limits: { ...DEFAULT_DETERMINISTIC_RUNTIME_LIMITS, maxDurationMs: 5 },
    });
    expect(timedOut.ok).toBe(false);
    if (timedOut.ok) throw new Error('timed-out run must not succeed');
    expect(timedOut.snapshot.state).toBe('failed');
    expect(timedOut.error.code).toBe('run_timeout');
  });
});
