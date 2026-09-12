import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { receiptAssistantOptionsFromEnvironment } from './receiptAssistantBootstrap';

describe('Receipt assistant deployment opt-in', () => {
  it.each([undefined, 'false', 'TRUE', '1'])('remains disabled for %s even with credentials', (enabled) => {
    expect(receiptAssistantOptionsFromEnvironment({
      ERP_RECEIPT_ASSISTANT_ENABLED: enabled,
      ERP_TOKEN_ENCRYPTION_KEY: 'fixture-only', OPENAI_API_KEY: 'fixture-only',
    })).toBeUndefined();
  });
  it('wires the server-owned resolver only after exact opt-in', () => {
    const result = receiptAssistantOptionsFromEnvironment({
      ERP_RECEIPT_ASSISTANT_ENABLED: 'true', ERP_RECEIPT_ASSISTANT_AGENT_KEY: 'receipt-assistant',
    });
    expect(result?.providerFactory).toBeTypeOf('function');
    expect(result?.agentPrincipalKey).toBe('receipt-assistant');
    const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
    expect(source).toContain('receiptAssistant: receiptAssistantOptionsFromEnvironment(process.env)');
  });
});
