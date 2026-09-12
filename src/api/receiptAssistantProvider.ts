import { and, eq } from 'drizzle-orm';
import { agentProviderConfig } from '../data/schema';
import { withTenantTransaction } from '../data/tenantTransaction';
import { decryptToken, isEncryptedToken, parseTokenEncryptionKey } from '../auth/tokenCrypto';
import { AuthLifecycleError } from '../auth/authErrors';
import { isModuleEnabled } from '../auth/moduleAccess';
import { resolveAgentGrantWithin } from '../modules/agent/agentIdentity';
import { listAgentActionContracts } from '../modules/agent/actionContracts';
import { AiRuntimeError, type AiRuntimeLimits } from '../modules/agent/aiRuntime';
import { createOpenAiProvider, type OpenAiProviderOptions } from '../modules/agent/openAiProvider';
import {
  ReceiptAssistantError, resolveReceiptAssistantIdentity,
  type ReceiptAssistantProviderContext, type ReceiptAssistantProviderFactory,
} from './receiptAssistant';

export interface ReceiptAssistantDeployment {
  enabled: boolean;
  agentPrincipalKey: string;
  tokenEncryptionKey: string;
  inputMicrosPerMillionTokens: number;
  outputMicrosPerMillionTokens: number;
  maxOutputTokens: number;
  fetch?: typeof fetch;
}

function unavailable(): never {
  throw new ReceiptAssistantError(503, 'assistant_provider_unavailable',
    'Enable an approved Company provider, compatible data policy, budget and assistant Agent before retrying.');
}

async function snapshot(context: ReceiptAssistantProviderContext, agentPrincipalKey: string) {
  context.signal?.throwIfAborted();
  const identity = await resolveReceiptAssistantIdentity(context.db, context.session, agentPrincipalKey);
  if (!identity) unavailable();
  const scope = { masterFn: context.session.masterFn, companyFn: context.session.activeCompanyFn };
  return withTenantTransaction(context.db, scope, async (tx) => {
    if (!await isModuleEnabled(tx, scope.masterFn, scope.companyFn, 'expenses_tax')) unavailable();
    const [config] = await tx.select().from(agentProviderConfig).where(and(
      eq(agentProviderConfig.masterFn, scope.masterFn), eq(agentProviderConfig.companyFn, scope.companyFn),
    )).limit(1);
    if (!config?.enabled || config.provider !== 'openai' || config.model !== 'gpt-4.1-mini'
      || config.endpointUrl !== null || config.dataRegion !== 'global'
      || config.dataPolicy !== 'tenant_no_training' || !isEncryptedToken(config.credentialEnvelope)) unavailable();
    const grants: Record<string, unknown> = {};
    for (const action of listAgentActionContracts()) {
      try {
        grants[action.name] = await resolveAgentGrantWithin(tx, scope, {
          agentPrincipalId: identity.agentPrincipalId, actionName: action.name,
        });
      } catch (error) {
        if (!(error instanceof AuthLifecycleError)) throw error;
        grants[action.name] = null;
      }
    }
    if (!grants['receipt.search']) unavailable();
    return { config, grants };
  });
}

/** Resolve live Company configuration without holding a transaction across egress. */
export function createReceiptAssistantProviderFactory(deployment: ReceiptAssistantDeployment): ReceiptAssistantProviderFactory {
  const policy = { ...deployment };
  return async (context) => {
    if (!policy.enabled || !policy.agentPrincipalKey || !policy.tokenEncryptionKey) unavailable();
    try {
      const initial = await snapshot(context, policy.agentPrincipalKey);
      const { config } = initial;
      const limits: AiRuntimeLimits = {
        maxProviderCalls: config.maxProviderCalls, maxRetries: config.maxRetries,
        maxDurationMs: config.maxDurationMs, maxInputChars: config.maxInputChars,
        maxOutputChars: config.maxOutputChars, maxCostMicros: config.maxCostMicros,
        costReservationPolicy: 'reserve_before_call_release_on_preflight_failure',
      };
      if (!isEncryptedToken(config.credentialEnvelope)) unavailable();
      const adapterOptions: OpenAiProviderOptions = {
        apiKey: decryptToken(config.credentialEnvelope, parseTokenEncryptionKey(policy.tokenEncryptionKey)),
        model: config.model, timeoutMs: config.maxDurationMs,
        inputMicrosPerMillionTokens: policy.inputMicrosPerMillionTokens,
        outputMicrosPerMillionTokens: policy.outputMicrosPerMillionTokens,
        maxOutputTokens: policy.maxOutputTokens, fetch: policy.fetch,
      };
      const adapter = createOpenAiProvider(adapterOptions);
      if (limits.maxCostMicros < adapter.costPerCallMicros) unavailable();
      const fingerprint = JSON.stringify(initial);
      return {
        limits,
        provider: {
          provider: adapter.provider, model: adapter.model, costPerCallMicros: adapter.costPerCallMicros,
          async complete(request) {
            try {
              request.signal.throwIfAborted();
              const current = await snapshot({ ...context, signal: request.signal }, policy.agentPrincipalKey);
              if (JSON.stringify(current) !== fingerprint) unavailable();
              request.signal.throwIfAborted();
            } catch {
              throw new AiRuntimeError('provider_unavailable',
                'Company provider configuration or Agent authority changed; start a new run.',
                { recoveryAction: 'configure_provider' });
            }
            return adapter.complete({ ...request,
              tools: request.tools.filter((tool) => initial.grants[tool.name] != null),
            });
          },
        },
      };
    } catch {
      // Configuration, crypto and database exception details must not reach the browser.
      unavailable();
    }
  };
}
