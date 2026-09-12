import { describe, expect, it, vi } from 'vitest';
import { createOpenAiProvider, OPENAI_RECEIPT_SNAPSHOT } from './openAiProvider';
import { runAiRuntime, type AiProviderRequest } from './aiRuntime';

const options = {
  apiKey: 'synthetic-test-key', model: 'gpt-4.1-mini',
  inputMicrosPerMillionTokens: 400_000, outputMicrosPerMillionTokens: 1_600_000,
  maxOutputTokens: 1024, timeoutMs: 1000,
};
const request: AiProviderRequest = {
  contractVersion: 1, runId: 'protocol-test', provider: 'openai', model: 'gpt-4.1-mini',
  messages: [{ role: 'user', content: 'Find receipts.' }],
  tools: [{ name: 'receipt.search', description: 'Find governed receipts.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }],
  maxOutputChars: 4000, signal: new AbortController().signal,
};
function result(output: unknown[] = [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'Evidence found.' }] }]) {
  return { object: 'response', status: 'completed', model: OPENAI_RECEIPT_SNAPSHOT, error: null, incomplete_details: null, output,
    usage: { input_tokens: 100, output_tokens: 10, total_tokens: 110 } };
}
function http(body: unknown, status = 200): Response {
  const response = new Response(JSON.stringify(body), { status });
  Object.defineProperty(response, 'url', { value: 'https://api.openai.com/v1/responses' });
  return response;
}
const call = { type: 'function_call', name: 'erp_0', call_id: 'call_1', arguments: '{}' };

describe('OpenAI Receipt protocol adapter (injected transport only)', () => {
  it('serializes custom tools and preserves exact call/result identity over two turns', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValueOnce(http(result([call]))).mockResolvedValueOnce(http(result()));
    const provider = createOpenAiProvider({ ...options, fetch: send });
    const first = await provider.complete(request);
    expect(first.toolCalls).toEqual([{ callId: 'call_1', name: 'receipt.search', arguments: {} }]);
    const second = await provider.complete({ ...request, messages: [...request.messages,
      { role: 'assistant', content: first.text, toolCalls: first.toolCalls },
      { role: 'tool', name: 'receipt.search', toolCallId: 'call_1', content: '{"data":[]}' },
    ] });
    expect(second).toMatchObject({ text: 'Evidence found.', costMicros: 56, usage: { totalTokens: 110 } });
    expect(provider.costPerCallMicros).toBe(420669);
    const [url, init] = send.mock.calls[1];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init).toMatchObject({ redirect: 'error', method: 'POST' });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ store: false, stream: false, background: false, parallel_tool_calls: false, truncation: 'disabled', model: OPENAI_RECEIPT_SNAPSHOT, max_output_tokens: 1024 });
    expect(body.input.slice(-2)).toEqual([
      { type: 'function_call', call_id: 'call_1', name: 'erp_0', arguments: '{}' },
      { type: 'function_call_output', call_id: 'call_1', output: '{"data":[]}' },
    ]);
    expect(body.tools).toEqual([expect.objectContaining({ name: 'erp_0', strict: false, type: 'function' })]);
    expect(String(init?.body)).not.toContain(options.apiKey);
  });

  it.each([
    ['unknown tool', result([{ ...call, name: 'unapproved' }])],
    ['duplicate call', result([call, call])],
    ['array arguments', result([{ ...call, arguments: '[]' }])],
    ['malformed arguments', result([{ ...call, arguments: '{' }])],
    ['incomplete response', { ...result(), status: 'incomplete' }],
    ['wrong model', { ...result(), model: 'another-model' }],
    ['usage mismatch', { ...result(), usage: { input_tokens: 100, output_tokens: 10, total_tokens: 111 } }],
    ['output token breach', { ...result(), usage: { input_tokens: 0, output_tokens: 1025, total_tokens: 1025 } }],
    ['builtin tool', result([{ type: 'web_search_call' }])],
    ['credential echo', result([{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: options.apiKey }] }])],
    ['escaped credential arguments', result([{ ...call, arguments: '{"search":"\\u0073ynthetic-test-key"}' }])],
    ['empty output', result([])],
  ])('rejects %s without exposing raw output', async (_name, body) => {
    const provider = createOpenAiProvider({ ...options, fetch: vi.fn<typeof fetch>().mockResolvedValue(http(body)) });
    await expect(provider.complete(request)).rejects.toMatchObject({ code: 'provider_failed' });
  });

  it('rejects missing/unmatched tool results before dispatch', async () => {
    const send = vi.fn<typeof fetch>();
    const provider = createOpenAiProvider({ ...options, fetch: send });
    await expect(provider.complete({ ...request, messages: [{ role: 'tool', toolCallId: 'missing', name: 'receipt.search', content: '{}' }] })).rejects.toMatchObject({ code: 'provider_failed' });
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects redirects and changed final origins', async () => {
    for (const changed of ['redirected', 'url']) {
      const response = new Response('{}');
      Object.defineProperty(response, changed, { value: changed === 'redirected' ? true : 'https://unapproved.example/' });
      const provider = createOpenAiProvider({ ...options, fetch: vi.fn<typeof fetch>().mockResolvedValue(response) });
      await expect(provider.complete(request)).rejects.toMatchObject({ code: 'provider_failed', retryable: false });
    }
  });

  it('bounds streamed bytes and tool argument output, cancelling the body', async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1_048_577)); }, cancel }));
    const provider = createOpenAiProvider({ ...options, fetch: vi.fn<typeof fetch>().mockResolvedValue(response) });
    await expect(provider.complete(request)).rejects.toMatchObject({ code: 'output_limit_exceeded' });
    expect(cancel).toHaveBeenCalled();
    const other = createOpenAiProvider({ ...options, fetch: vi.fn<typeof fetch>().mockResolvedValue(http(result([{ ...call, arguments: JSON.stringify({ text: 'x'.repeat(5000) }) }]))) });
    await expect(other.complete(request)).rejects.toMatchObject({ code: 'output_limit_exceeded' });
  });

  it('retains cancellation through fetch and a stalled response body', async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const send = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(new ReadableStream({ cancel }));
    });
    const provider = createOpenAiProvider({ ...options, fetch: send });
    const pending = runAiRuntime({ runId: 'cancel-transport', provider,
      messages: request.messages, tools: request.tools, signal: controller.signal,
      limits: { maxProviderCalls: 1, maxRetries: 0, maxDurationMs: 1000, maxInputChars: 1000, maxOutputChars: 4000, maxCostMicros: 500000, costReservationPolicy: 'reserve_before_call_release_on_preflight_failure' } });
    setTimeout(() => controller.abort(), 5);
    expect(await pending).toMatchObject({ ok: false, snapshot: { state: 'cancelled' }, error: { code: 'cancelled' } });
    expect(cancel).toHaveBeenCalled();
  });

  it('times out and sanitizes network errors and HTTP failure bodies', async () => {
    const send = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error(options.apiKey)), { once: true });
    }));
    const provider = createOpenAiProvider({ ...options, timeoutMs: 5, fetch: send });
    await expect(provider.complete(request)).rejects.toMatchObject({ code: 'provider_failed', message: expect.not.stringContaining(options.apiKey) });
    const failed = createOpenAiProvider({ ...options, fetch: vi.fn<typeof fetch>().mockResolvedValue(http({ error: options.apiKey }, 429)) });
    await expect(failed.complete(request)).rejects.toMatchObject({ code: 'provider_failed', retryable: true, message: expect.not.stringContaining(options.apiKey) });
  });

  it('rejects unsupported model, missing price and pre-aborted requests without egress', async () => {
    expect(() => createOpenAiProvider({ ...options, model: 'gpt-5-mini' })).toThrow();
    expect(() => createOpenAiProvider({ ...options, inputMicrosPerMillionTokens: 0 })).toThrow();
    const send = vi.fn<typeof fetch>();
    const provider = createOpenAiProvider({ ...options, fetch: send });
    await expect(provider.complete({ ...request, signal: AbortSignal.abort() })).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
