import type { ReceiptAssistantRouterOptions } from './api/routes/assistant';
import { createReceiptAssistantProviderFactory } from './api/receiptAssistantProvider';

/** Environment values authorize activation only when deployment explicitly opts in. */
export function receiptAssistantOptionsFromEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): ReceiptAssistantRouterOptions | undefined {
  if (env.ERP_RECEIPT_ASSISTANT_ENABLED !== 'true') return undefined;
  const integer = (value: string | undefined) => value && /^\d+$/.test(value) ? Number(value) : NaN;
  const agentPrincipalKey = env.ERP_RECEIPT_ASSISTANT_AGENT_KEY?.trim() ?? '';
  return {
    agentPrincipalKey,
    providerFactory: createReceiptAssistantProviderFactory({
      enabled: true, agentPrincipalKey,
      tokenEncryptionKey: env.ERP_TOKEN_ENCRYPTION_KEY ?? '',
      inputMicrosPerMillionTokens: integer(env.ERP_RECEIPT_ASSISTANT_INPUT_MICROS_PER_MILLION),
      outputMicrosPerMillionTokens: integer(env.ERP_RECEIPT_ASSISTANT_OUTPUT_MICROS_PER_MILLION),
      maxOutputTokens: integer(env.ERP_RECEIPT_ASSISTANT_MAX_OUTPUT_TOKENS),
    }),
  };
}
