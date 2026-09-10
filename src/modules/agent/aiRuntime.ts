/**
 * Server-owned runtime contracts for the contextual ERP assistant.
 *
 * S1 intentionally contains no HTTP, database or browser code. A later provider
 * adapter may implement the interface, but the runtime owns state transitions,
 * bounded calls, cancellation and the no-false-success result contract.
 */

export const AI_RUNTIME_CONTRACT_VERSION = 1 as const;

export const AI_RUN_STATES = [
  'draft',
  'waiting',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type AiRunState = typeof AI_RUN_STATES[number];

export const AI_PROVIDER_IDS = [
  'deterministic.zero_spend',
  'openai',
  'google',
  'openai_compatible',
] as const;
export type AiProviderId = typeof AI_PROVIDER_IDS[number];

export const DETERMINISTIC_ZERO_SPEND_PROVIDER = 'deterministic.zero_spend' as const;
export const DETERMINISTIC_ZERO_SPEND_MODEL = 'erp-test-zero-spend-v1' as const;

export type AiMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiMessage {
  readonly role: AiMessageRole;
  readonly content: string;
  readonly name?: string;
  readonly toolCalls?: readonly AiToolCall[];
  readonly toolCallId?: string;
}

export interface AiToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

export interface AiToolCall {
  readonly callId: string;
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

export interface AiProviderRequest {
  readonly contractVersion: typeof AI_RUNTIME_CONTRACT_VERSION;
  readonly runId: string;
  readonly provider: AiProviderId;
  readonly model: string;
  readonly messages: readonly AiMessage[];
  readonly tools: readonly AiToolDefinition[];
  readonly maxOutputChars: number;
  readonly signal: AbortSignal;
}

export interface AiProviderUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface AiProviderResponse {
  readonly provider: AiProviderId;
  readonly model: string;
  readonly text: string;
  readonly toolCalls: readonly AiToolCall[];
  readonly usage: AiProviderUsage;
  /** Integer micro-USD. A zero-spend test double must return 0. */
  readonly costMicros: number;
  readonly finishReason: 'stop' | 'tool_call';
}

export interface AiProvider {
  readonly provider: AiProviderId;
  readonly model: string;
  /** The maximum reservation for one physical provider call. */
  readonly costPerCallMicros: number;
  complete(request: AiProviderRequest): Promise<AiProviderResponse>;
}

export type AiCostReservationPolicy =
  'reserve_before_call_release_on_preflight_failure';

export interface AiRuntimeLimits {
  /** Physical provider calls, including retries. */
  readonly maxProviderCalls: number;
  /** Retry attempts, included in maxProviderCalls. */
  readonly maxRetries: number;
  /** One whole-run deadline, not a per-retry timeout. */
  readonly maxDurationMs: number;
  readonly maxInputChars: number;
  readonly maxOutputChars: number;
  /** Integer micro-USD. */
  readonly maxCostMicros: number;
  readonly costReservationPolicy: AiCostReservationPolicy;
}

export const DEFAULT_DETERMINISTIC_RUNTIME_LIMITS: AiRuntimeLimits = Object.freeze({
  maxProviderCalls: 1,
  maxRetries: 0,
  maxDurationMs: 10_000,
  maxInputChars: 16_000,
  maxOutputChars: 4_000,
  maxCostMicros: 0,
  costReservationPolicy: 'reserve_before_call_release_on_preflight_failure',
});

export type AiRuntimeErrorCode =
  | 'invalid_runtime_limits'
  | 'invalid_run_request'
  | 'input_limit_exceeded'
  | 'provider_unavailable'
  | 'provider_failed'
  | 'budget_exhausted'
  | 'output_limit_exceeded'
  | 'run_timeout'
  | 'cancelled';

export type AiRuntimeRecoveryAction =
  | 'configure_provider'
  | 'reduce_request_or_increase_budget'
  | 'reduce_output_limit'
  | 'retry_run'
  | 'resume_run'
  | 'none';

export interface AiRuntimeErrorDetails {
  readonly code: AiRuntimeErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly recoveryAction: AiRuntimeRecoveryAction;
}

export class AiRuntimeError extends Error {
  readonly code: AiRuntimeErrorCode;
  readonly retryable: boolean;
  readonly recoveryAction: AiRuntimeRecoveryAction;

  constructor(
    code: AiRuntimeErrorCode,
    message: string,
    options: {
      retryable?: boolean;
      recoveryAction?: AiRuntimeRecoveryAction;
    } = {},
  ) {
    super(message);
    this.name = 'AiRuntimeError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.recoveryAction = options.recoveryAction ?? 'none';
  }

  details(): AiRuntimeErrorDetails {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      recoveryAction: this.recoveryAction,
    };
  }
}

export interface AiRunStateTransition {
  readonly from: AiRunState;
  readonly to: AiRunState;
  readonly at: number;
}

export interface AiRunSnapshot {
  readonly runId: string;
  readonly state: AiRunState;
  readonly stateHistory: readonly AiRunState[];
  readonly provider: AiProviderId;
  readonly model: string;
  readonly providerCalls: number;
  readonly retries: number;
  /** Known spend plus conservative reservations for dispatched calls with unknown cost. */
  readonly reservedCostMicros: number;
  readonly spentCostMicros: number;
  readonly startedAt: number | null;
  readonly completedAt: number | null;
  readonly deadlineAt: number | null;
}

export interface AiRunSuccess {
  readonly ok: true;
  readonly snapshot: AiRunSnapshot;
  readonly response: AiProviderResponse;
  readonly error?: never;
}

export interface AiRunFailure {
  readonly ok: false;
  readonly snapshot: AiRunSnapshot;
  readonly response?: never;
  readonly error: AiRuntimeErrorDetails;
}

export type AiRunResult = AiRunSuccess | AiRunFailure;

export interface RunAiRuntimeInput {
  readonly runId: string;
  readonly provider: AiProvider;
  readonly messages: readonly AiMessage[];
  readonly tools?: readonly AiToolDefinition[];
  readonly limits: AiRuntimeLimits;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
  readonly onStateChange?: (transition: AiRunStateTransition) => void;
}

export interface DeterministicProviderOptions {
  readonly available?: boolean;
  readonly responseText?: string;
  readonly costPerCallMicros?: number;
  readonly delayMs?: number;
  readonly failure?: {
    readonly retryable: boolean;
  };
  readonly onCall?: (request: AiProviderRequest) => void;
}

function isSafeNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function inputCharacterCount(messages: readonly AiMessage[]): number {
  return messages.reduce((total, message) => total + message.content.length
    + (message.toolCalls ? JSON.stringify(message.toolCalls).length : 0)
    + (message.toolCallId?.length ?? 0), 0);
}

function createAbortError(): Error {
  const error = new Error('The AI run was cancelled.');
  error.name = 'AbortError';
  return error;
}

function waitForDelay(delayMs: number, signal: AbortSignal): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    function onAbort() {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(createAbortError());
    }
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

/**
 * A deterministic provider for local tests. It never contacts a network and
 * its default response has zero cost. `available: false` is deliberately a
 * hard provider failure, not a successful placeholder response.
 */
export function createDeterministicZeroSpendProvider(
  options: DeterministicProviderOptions = {},
): AiProvider {
  const costPerCallMicros = options.costPerCallMicros ?? 0;
  if (!isSafeNonNegativeInteger(costPerCallMicros)) {
    throw new AiRuntimeError(
      'invalid_runtime_limits',
      'Deterministic provider cost must be a non-negative safe integer.',
    );
  }
  const responseText = options.responseText ?? 'Deterministic zero-spend response.';
  return {
    provider: DETERMINISTIC_ZERO_SPEND_PROVIDER,
    model: DETERMINISTIC_ZERO_SPEND_MODEL,
    costPerCallMicros,
    async complete(request) {
      options.onCall?.(request);
      if (options.available === false) {
        throw new AiRuntimeError(
          'provider_unavailable',
          'The configured AI provider is unavailable. Configure an approved provider before retrying.',
          { recoveryAction: 'configure_provider' },
        );
      }
      if (options.failure) {
        throw new AiRuntimeError(
          'provider_failed',
          'The deterministic provider test double failed without producing a result.',
          {
            retryable: options.failure.retryable,
            recoveryAction: options.failure.retryable ? 'retry_run' : 'configure_provider',
          },
        );
      }
      await waitForDelay(options.delayMs ?? 0, request.signal);
      return {
        provider: request.provider,
        model: request.model,
        text: responseText,
        toolCalls: [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costMicros: 0,
        finishReason: 'stop',
      };
    },
  };
}

function validateLimits(limits: AiRuntimeLimits): void {
  if (
    !isSafeNonNegativeInteger(limits.maxProviderCalls)
    || limits.maxProviderCalls < 1
    || !isSafeNonNegativeInteger(limits.maxRetries)
    || limits.maxRetries >= limits.maxProviderCalls
    || !Number.isSafeInteger(limits.maxDurationMs)
    || limits.maxDurationMs < 1
    || !isSafeNonNegativeInteger(limits.maxInputChars)
    || limits.maxInputChars < 1
    || !isSafeNonNegativeInteger(limits.maxOutputChars)
    || limits.maxOutputChars < 1
    || !isSafeNonNegativeInteger(limits.maxCostMicros)
    || limits.costReservationPolicy !== 'reserve_before_call_release_on_preflight_failure'
  ) {
    throw new AiRuntimeError(
      'invalid_runtime_limits',
      'AI runtime limits are invalid; calls, retries, duration, output and cost bounds must be explicit.',
    );
  }
}

function errorDetails(error: unknown): AiRuntimeErrorDetails {
  if (error instanceof AiRuntimeError) return error.details();
  return new AiRuntimeError(
    'provider_failed',
    'The AI provider failed without returning a usable result.',
    { recoveryAction: 'retry_run', retryable: true },
  ).details();
}

function validateResponse(response: AiProviderResponse, provider: AiProvider): void {
  if (
    !response
    || response.provider !== provider.provider
    || response.model !== provider.model
    || typeof response.text !== 'string'
    || !Array.isArray(response.toolCalls)
    || !response.usage
    || !isSafeNonNegativeInteger(response.usage.inputTokens)
    || !isSafeNonNegativeInteger(response.usage.outputTokens)
    || !isSafeNonNegativeInteger(response.usage.totalTokens)
    || !isSafeNonNegativeInteger(response.costMicros)
    || (response.finishReason !== 'stop' && response.finishReason !== 'tool_call')
  ) {
    throw new AiRuntimeError(
      'provider_failed',
      'The AI provider returned an invalid response.',
      { recoveryAction: 'retry_run' },
    );
  }
}

export async function runAiRuntime(input: RunAiRuntimeInput): Promise<AiRunResult> {
  const now = input.now ?? Date.now;
  const stateHistory: AiRunState[] = ['draft'];
  let state: AiRunState = 'draft';
  let providerCalls = 0;
  let retries = 0;
  let reservedCostMicros = 0;
  let spentCostMicros = 0;
  let startedAt: number | null = null;
  let completedAt: number | null = null;
  let deadlineAt: number | null = null;
  let timedOut = false;

  const transition = (to: AiRunState) => {
    const from = state;
    if (from === to) return;
    state = to;
    stateHistory.push(to);
    input.onStateChange?.({ from, to, at: now() });
  };
  const snapshot = (): AiRunSnapshot => ({
    runId: input.runId,
    state,
    stateHistory: [...stateHistory],
    provider: input.provider.provider,
    model: input.provider.model,
    providerCalls,
    retries,
    reservedCostMicros,
    spentCostMicros,
    startedAt,
    completedAt,
    deadlineAt,
  });
  const failure = (details: AiRuntimeErrorDetails, failureState: 'failed' | 'cancelled' = 'failed'): AiRunFailure => {
    transition(failureState);
    completedAt = now();
    return { ok: false, snapshot: snapshot(), error: details };
  };

  try {
    validateLimits(input.limits);
    if (!input.runId.trim() || input.provider.provider !== DETERMINISTIC_ZERO_SPEND_PROVIDER
      && input.provider.provider !== 'openai'
      && input.provider.provider !== 'google'
      && input.provider.provider !== 'openai_compatible') {
      throw new AiRuntimeError('invalid_run_request', 'AI run identity or provider is invalid.');
    }
    if (!Array.isArray(input.messages) || input.messages.some((message) => (
      !message || typeof message.content !== 'string' || !message.role
    ))) {
      throw new AiRuntimeError('invalid_run_request', 'AI messages are invalid.');
    }
    const inputChars = inputCharacterCount(input.messages);
    if (inputChars > input.limits.maxInputChars) {
      return failure(new AiRuntimeError(
        'input_limit_exceeded',
        'The AI request is too large. Reduce the conversation before retrying.',
        { recoveryAction: 'reduce_request_or_increase_budget' },
      ).details());
    }

    startedAt = now();
    deadlineAt = startedAt + input.limits.maxDurationMs;
    transition('waiting');

    const controller = new AbortController();
    const externalAbort = () => controller.abort();
    if (input.signal?.aborted) controller.abort();
    else input.signal?.addEventListener('abort', externalAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, input.limits.maxDurationMs);

    try {
      transition('running');
      while (true) {
        if (controller.signal.aborted) {
          if (timedOut) {
            return failure(new AiRuntimeError(
              'run_timeout',
              'The AI run exceeded its whole-run time limit before producing a result.',
              { retryable: true, recoveryAction: 'reduce_request_or_increase_budget' },
            ).details());
          }
          return failure(new AiRuntimeError(
            'cancelled',
            'The AI run was cancelled before producing a result.',
            { retryable: true, recoveryAction: 'resume_run' },
          ).details(), 'cancelled');
        }
        if (providerCalls >= input.limits.maxProviderCalls) {
          return failure(new AiRuntimeError(
            'budget_exhausted',
            'The AI run reached its provider-call budget without a result.',
            { recoveryAction: 'reduce_request_or_increase_budget' },
          ).details());
        }
        const reservation = input.provider.costPerCallMicros;
        if (!isSafeNonNegativeInteger(reservation)
          || reservedCostMicros + reservation > input.limits.maxCostMicros) {
          return failure(new AiRuntimeError(
            'budget_exhausted',
            'The AI run reached its cost budget before the provider call.',
            { recoveryAction: 'reduce_request_or_increase_budget' },
          ).details());
        }
        reservedCostMicros += reservation;
        if (providerCalls > 0) retries += 1;
        providerCalls += 1;
        try {
          const response = await input.provider.complete({
            contractVersion: AI_RUNTIME_CONTRACT_VERSION,
            runId: input.runId,
            provider: input.provider.provider,
            model: input.provider.model,
            messages: input.messages,
            tools: input.tools ?? [],
            maxOutputChars: input.limits.maxOutputChars,
            signal: controller.signal,
          });
          validateResponse(response, input.provider);
          // A valid report reconciles only this call. Earlier transport failures
          // may still have been billed and retain their full reservations.
          reservedCostMicros += response.costMicros - reservation;
          spentCostMicros += response.costMicros;
          if (response.costMicros > reservation || reservedCostMicros > input.limits.maxCostMicros) {
            return failure(new AiRuntimeError(
              'budget_exhausted',
              'The provider reported a cost beyond its reserved maximum.',
              { recoveryAction: 'configure_provider' },
            ).details());
          }
          if (response.text.length > input.limits.maxOutputChars) {
            return failure(new AiRuntimeError(
              'output_limit_exceeded',
              'The AI provider response exceeded the output limit.',
              { recoveryAction: 'reduce_output_limit' },
            ).details());
          }
          transition('succeeded');
          completedAt = now();
          return { ok: true, snapshot: snapshot(), response };
        } catch (error) {
          // Dispatch has occurred. An exception cannot prove that no cost was
          // incurred, so never release this reservation merely to permit a retry.
          if (controller.signal.aborted) {
            if (timedOut) {
              return failure(new AiRuntimeError(
                'run_timeout',
                'The AI run exceeded its whole-run time limit before producing a result.',
                { retryable: true, recoveryAction: 'reduce_request_or_increase_budget' },
              ).details());
            }
            return failure(new AiRuntimeError(
              'cancelled',
              'The AI run was cancelled before producing a result.',
              { retryable: true, recoveryAction: 'resume_run' },
            ).details(), 'cancelled');
          }
          const details = errorDetails(error);
          if (details.retryable && retries < input.limits.maxRetries) {
            continue;
          }
          return failure(details);
        }
      }
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener('abort', externalAbort);
    }
  } catch (error) {
    return failure(errorDetails(error));
  }
}
