import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('web/public/assets/receipt-demo-gateway.js', 'utf8');
function setup(fetch: typeof globalThis.fetch) {
  const context = vm.createContext({ fetch, AbortController, TextDecoder, setTimeout, clearTimeout });
  vm.runInContext(source, context);
  return context.ReceiptDemoGateway as {
    propose(payload: { message: string }, options?: { signal: AbortSignal }): Promise<{ search: string; providerCalls: number }>;
  };
}
const reply = (value: unknown) => new Response(JSON.stringify(value));
const result = (text: string) => reply({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
describe('browser Demo gateway', () => {
  it('makes no startup request and uses the public session protocol only on submission', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(reply({ token: 'dmo_test-token' })).mockResolvedValueOnce(result('{"search":"Cafe"}'));
    const gateway = setup(fetch);
    expect(fetch).not.toHaveBeenCalled();
    expect(await gateway.propose({ message: 'Find Cafe receipts' })).toMatchObject({ search: 'Cafe', providerCalls: 1 });
    expect(fetch.mock.calls[0][0]).toBe('https://gpt.yapweijun1996.com/demo/session');
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ project_id: 'github-pages' });
    expect(fetch.mock.calls[1][0]).toBe('https://gpt.yapweijun1996.com/demo/v1/responses');
    const body = JSON.parse(String(fetch.mock.calls[1][1]?.body));
    expect(body.model).toBe('demo-auto');
    expect(body.tools).toBeUndefined();
    expect(fetch.mock.calls[1][1]).toMatchObject({ credentials: 'omit', redirect: 'error' });
  });
  it.each(['{"search":4}', '{"search":"Cafe","approve":true}', 'not JSON', '{"search":"dmo_test-token"}'])('rejects invalid proposals without fallback: %s', async (text) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(reply({ token: 'dmo_test-token' })).mockResolvedValueOnce(result(text));
    await expect(setup(fetch).propose({ message: 'Receipts' })).rejects.toMatchObject({ code: expect.stringMatching(/^demo_gateway_/) });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('redacts session and transport errors and never dispatches inference after denied session', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('private error', { status: 403 }));
    await expect(setup(fetch).propose({ message: 'Receipts' })).rejects.toMatchObject({ code: 'demo_gateway_session_denied', message: 'The Demo gateway rejected this website or project. Check the registered Demo project and allowed website origin.' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('propagates cancellation to the physical request', async () => {
    const controller = new AbortController();
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('cancelled transport')));
    }));
    const pending = setup(fetch).propose({ message: 'Receipts' }, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'assistant_cancelled' });
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it('rejects oversized responses', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(reply({ token: 'dmo_test-token' })).mockResolvedValueOnce(result('x'.repeat(70000)));
    await expect(setup(fetch).propose({ message: 'Receipts' })).rejects.toMatchObject({ code: 'demo_gateway_output_limit' });
  });
});
