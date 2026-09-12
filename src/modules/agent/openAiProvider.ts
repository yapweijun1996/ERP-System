import { z } from 'zod';
import {
  AiRuntimeError,
  type AiProvider,
  type AiProviderRequest,
  type AiProviderResponse,
} from './aiRuntime';

export const OPENAI_RECEIPT_MODEL = 'gpt-4.1-mini';
export const OPENAI_RECEIPT_SNAPSHOT = 'gpt-4.1-mini-2025-04-14';
const ENDPOINT = 'https://api.openai.com/v1/responses';
const CONTEXT_TOKENS = 1_047_576;
const MAX_BODY_BYTES = 1_048_576;

export interface OpenAiProviderOptions {
  apiKey: string;
  model: string;
  /** Deployment-reviewed micro-USD per million tokens; no implicit price approval. */
  inputMicrosPerMillionTokens: number;
  outputMicrosPerMillionTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
  /** Test seam. Production uses the native, redirect-denying HTTPS fetch. */
  fetch?: typeof fetch;
}

function failure(code: 'provider_failed' | 'provider_unavailable' | 'input_limit_exceeded' | 'output_limit_exceeded', retryable = false): AiRuntimeError {
  return new AiRuntimeError(code, code === 'provider_unavailable'
    ? 'The selected provider configuration is unavailable for this adapter.'
    : 'The provider did not return a valid bounded Receipt assistant response.',
  { retryable, recoveryAction: retryable ? 'retry_run' : 'configure_provider' });
}

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const functionCall = z.object({
  type: z.literal('function_call'),
  call_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
  name: z.string().min(1).max(64),
  arguments: z.string(),
  status: z.literal('completed').optional(),
});
const message = z.object({
  type: z.literal('message'),
  role: z.literal('assistant'),
  status: z.literal('completed'),
  content: z.array(z.object({ type: z.literal('output_text'), text: z.string() })).min(1),
});
const responseSchema = z.object({
  object: z.literal('response'),
  status: z.literal('completed'),
  model: z.literal(OPENAI_RECEIPT_SNAPSHOT),
  error: z.null(),
  incomplete_details: z.null(),
  output: z.array(z.union([functionCall, message])).min(1).max(32),
  usage: z.object({ input_tokens: count, output_tokens: count, total_tokens: count }),
});

function boundedInteger(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function cost(input: number, output: number, options: OpenAiProviderOptions): number {
  // Integer arithmetic with BigInt avoids under-reserving fractional micro-USD.
  const numerator = BigInt(input) * BigInt(options.inputMicrosPerMillionTokens)
    + BigInt(output) * BigInt(options.outputMicrosPerMillionTokens);
  return Number((numerator + 999_999n) / 1_000_000n);
}

function wireRequest(request: AiProviderRequest, maxOutputTokens: number) {
  const tools = [...request.tools].sort((a, b) => a.name.localeCompare(b.name));
  if (tools.length > 32 || new Set(tools.map((tool) => tool.name)).size !== tools.length) throw failure('provider_failed');
  const byName = new Map(tools.map((tool, index) => [tool.name, `erp_${index}`]));
  const byWireName = new Map([...byName].map(([name, wire]) => [wire, name]));
  const input: Record<string, unknown>[] = [];
  const pending = new Map<string, string>();
  const seen = new Set<string>();
  for (const item of request.messages) {
    if (item.role === 'tool') {
      if (!item.toolCallId || pending.get(item.toolCallId) !== item.name || item.toolCalls) throw failure('provider_failed');
      pending.delete(item.toolCallId);
      input.push({ type: 'function_call_output', call_id: item.toolCallId, output: item.content });
      continue;
    }
    if (pending.size || item.toolCallId || !['system', 'user', 'assistant'].includes(item.role)) throw failure('provider_failed');
    if (item.content) input.push({ role: item.role, content: item.content });
    if (item.toolCalls) {
      if (item.role !== 'assistant') throw failure('provider_failed');
      for (const call of item.toolCalls) {
        const name = byName.get(call.name);
        if (!name || !/^[A-Za-z0-9_-]{1,200}$/.test(call.callId) || seen.has(call.callId)) throw failure('provider_failed');
        seen.add(call.callId);
        pending.set(call.callId, call.name);
        input.push({ type: 'function_call', call_id: call.callId, name, arguments: JSON.stringify(call.arguments) });
      }
    }
  }
  if (pending.size) throw failure('provider_failed');
  const body = JSON.stringify({
    model: OPENAI_RECEIPT_SNAPSHOT,
    input,
    tools: tools.map((tool) => ({
      type: 'function', name: byName.get(tool.name),
      description: `${tool.name}: ${tool.description}`, parameters: tool.inputSchema,
      strict: false,
    })),
    store: false,
    stream: false,
    background: false,
    parallel_tool_calls: false,
    truncation: 'disabled',
    service_tier: 'default',
    max_output_tokens: maxOutputTokens,
  });
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw failure('input_limit_exceeded');
  return { body, byWireName, seen };
}

async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body) throw failure('provider_failed');
  const reader = response.body.getReader();
  const onAbort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', onAbort, { once: true });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_BODY_BYTES) throw failure('output_limit_exceeded');
      chunks.push(part.value);
    }
    signal.throwIfAborted();
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } finally {
    signal.removeEventListener('abort', onAbort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Text/custom-function protocol adapter only; it never executes a business tool. */
export function createOpenAiProvider(options: OpenAiProviderOptions): AiProvider {
  if (options.model !== OPENAI_RECEIPT_MODEL || typeof options.apiKey !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(options.apiKey)
    || !boundedInteger(options.inputMicrosPerMillionTokens, 1, 1_000_000_000)
    || !boundedInteger(options.outputMicrosPerMillionTokens, 1, 1_000_000_000)
    || !boundedInteger(options.maxOutputTokens, 16, 32_768)
    || !boundedInteger(options.timeoutMs, 1, 120_000)) throw failure('provider_unavailable');
  // Freeze policy by value; later caller mutations cannot lower a captured reservation.
  const policy = { ...options };
  const send = policy.fetch ?? globalThis.fetch;
  return {
    provider: 'openai', model: OPENAI_RECEIPT_MODEL,
    costPerCallMicros: cost(CONTEXT_TOKENS, policy.maxOutputTokens, policy),
    async complete(request): Promise<AiProviderResponse> {
      const controller = new AbortController();
      const signal = AbortSignal.any([request.signal, controller.signal]);
      const timer = setTimeout(() => controller.abort(), policy.timeoutMs);
      try {
        signal.throwIfAborted();
        if (request.provider !== 'openai' || request.model !== policy.model || request.contractVersion !== 1) throw failure('provider_unavailable');
        if (!boundedInteger(request.maxOutputChars, 1, 100_000)) throw failure('provider_unavailable');
        const wire = wireRequest(request, policy.maxOutputTokens);
        const response = await send(ENDPOINT, {
          method: 'POST', redirect: 'error', signal,
          headers: { Authorization: `Bearer ${policy.apiKey}`, 'Content-Type': 'application/json' },
          body: wire.body,
        });
        signal.throwIfAborted();
        if (response.redirected || (response.url && response.url !== ENDPOINT) || !response.ok) {
          await response.body?.cancel().catch(() => undefined);
          throw failure('provider_failed', !response.redirected && response.url === ENDPOINT && (response.status === 429 || response.status >= 500));
        }
        const parsed = responseSchema.safeParse(await boundedJson(response, signal));
        if (!parsed.success) throw failure('provider_failed');
        const data = parsed.data;
        if (JSON.stringify(data).includes(policy.apiKey)) throw failure('provider_failed');
        if (data.usage.total_tokens !== data.usage.input_tokens + data.usage.output_tokens
          || data.usage.input_tokens > CONTEXT_TOKENS || data.usage.output_tokens > policy.maxOutputTokens) throw failure('provider_failed');
        const text: string[] = [];
        const toolCalls: AiProviderResponse['toolCalls'][number][] = [];
        for (const item of data.output) {
          if (item.type === 'message') text.push(...item.content.map((part) => part.text));
          else {
            const name = wire.byWireName.get(item.name);
            if (!name || wire.seen.has(item.call_id)) throw failure('provider_failed');
            wire.seen.add(item.call_id);
            const args: unknown = JSON.parse(item.arguments);
            if (!args || typeof args !== 'object' || Array.isArray(args)) throw failure('provider_failed');
            toolCalls.push({ callId: item.call_id, name, arguments: args as Record<string, unknown> });
          }
        }
        const outputText = text.join('\n');
        if (JSON.stringify({ outputText, toolCalls }).includes(JSON.stringify(policy.apiKey).slice(1, -1))) throw failure('provider_failed');
        if (!outputText.trim() && !toolCalls.length) throw failure('provider_failed');
        if (outputText.length + (toolCalls.length ? JSON.stringify(toolCalls).length : 0) > request.maxOutputChars) throw failure('output_limit_exceeded');
        return {
          provider: 'openai', model: OPENAI_RECEIPT_MODEL, text: outputText, toolCalls,
          usage: { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens, totalTokens: data.usage.total_tokens },
          costMicros: cost(data.usage.input_tokens, data.usage.output_tokens, policy),
          finishReason: toolCalls.length ? 'tool_call' : 'stop',
        };
      } catch (error) {
        if (error instanceof AiRuntimeError) throw error;
        // Never return raw provider bodies, URLs, fetch errors or credentials.
        throw failure('provider_failed');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
