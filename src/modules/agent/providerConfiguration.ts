import { isIP } from 'node:net';
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../../data/db';
import {
  AGENT_DATA_POLICIES,
  AGENT_PROVIDER_IDS,
  agentProviderConfig,
  type AgentDataPolicy,
  type AgentProviderId,
} from '../../data/schema';
import { appendAudit } from '../../api/audit';
import { isEncryptedToken, type EncryptedToken } from '../../auth/tokenEnvelope';

export const AGENT_PROVIDER_MODELS: Readonly<Record<AgentProviderId, readonly string[] | null>> = {
  'deterministic.zero_spend': ['erp-test-zero-spend-v1'],
  openai: ['gpt-4.1-mini', 'gpt-5-mini'],
  google: ['gemini-2.5-flash'],
  // Compatible endpoints own their model namespace but still require a
  // bounded, explicit model identifier; no arbitrary model is inferred.
  openai_compatible: null,
};

export const DEFAULT_AGENT_PROVIDER_LIMITS = {
  maxProviderCalls: 1,
  maxRetries: 0,
  maxDurationMs: 30_000,
  maxInputChars: 16_000,
  maxOutputChars: 4_000,
  maxCostMicros: 0,
} as const;

export const DEFAULT_AGENT_EGRESS_HOSTS = [
  'api.openai.com',
  'generativelanguage.googleapis.com',
] as const;

export interface AgentProviderConfigurationScope {
  masterFn: string;
  companyFn: string;
}

export interface AgentProviderConfigurationActor {
  userId: number;
  requestId: string;
}

export interface AgentProviderConfigurationInput {
  provider: unknown;
  model: unknown;
  endpointUrl?: unknown;
  dataRegion?: unknown;
  dataPolicy?: unknown;
  credentialEnvelope?: unknown;
  credentialLabel?: unknown;
  clearCredential?: unknown;
  maxProviderCalls?: unknown;
  maxRetries?: unknown;
  maxDurationMs?: unknown;
  maxInputChars?: unknown;
  maxOutputChars?: unknown;
  maxCostMicros?: unknown;
  enabled?: unknown;
}

export interface AgentProviderEgressPolicy {
  readonly allowedHosts?: readonly string[];
}

export interface AgentProviderConfigurationView {
  id: number;
  provider: AgentProviderId;
  model: string;
  endpointUrl: string | null;
  dataRegion: string;
  dataPolicy: AgentDataPolicy;
  credentialConfigured: boolean;
  credentialLabel: string | null;
  maxProviderCalls: number;
  maxRetries: number;
  maxDurationMs: number;
  maxInputChars: number;
  maxOutputChars: number;
  maxCostMicros: number;
  enabled: boolean;
  version: number;
  updatedByUserId: number;
  createdAt: Date;
  updatedAt: Date;
}

export class AgentProviderConfigurationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AgentProviderConfigurationError';
  }
}

type AgentProviderConfigRow = typeof agentProviderConfig.$inferSelect;

function fail(code: string, message: string): never {
  throw new AgentProviderConfigurationError(code, message);
}

function textValue(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    fail('invalid_configuration', `${field} must contain 1–${maxLength} characters.`);
  }
  return value.trim();
}

function boundedInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  const number = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    fail('invalid_configuration', `${field} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return number;
}

function providerId(value: unknown): AgentProviderId {
  const valueText = textValue(value, 'provider', 40);
  if (!(AGENT_PROVIDER_IDS as readonly string[]).includes(valueText)) {
    fail('provider_not_allowed', 'The requested AI provider is not approved by the server.');
  }
  return valueText as AgentProviderId;
}

function modelName(provider: AgentProviderId, value: unknown): string {
  const model = textValue(value, 'model', 160);
  if (/\r|\n/.test(model) || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(model)) {
    fail('model_not_allowed', 'The model identifier contains unsupported characters.');
  }
  const allowlist = AGENT_PROVIDER_MODELS[provider];
  if (allowlist && !allowlist.includes(model)) {
    fail('model_not_allowed', 'The requested model is not allowlisted for this provider.');
  }
  return model;
}

function dataPolicy(value: unknown): AgentDataPolicy {
  const policy = textValue(value ?? 'tenant_no_training', 'dataPolicy', 40);
  if (!(AGENT_DATA_POLICIES as readonly string[]).includes(policy)) {
    fail('data_policy_not_allowed', 'The requested AI data policy is not approved.');
  }
  return policy as AgentDataPolicy;
}

function dataRegion(value: unknown): string {
  const region = textValue(value ?? 'tenant-local', 'dataRegion', 80);
  if (!/^[a-z0-9][a-z0-9._ -]*$/i.test(region)) {
    fail('invalid_configuration', 'The data region contains unsupported characters.');
  }
  return region;
}

function normalizedAllowedHosts(policy: AgentProviderEgressPolicy): Set<string> {
  return new Set((policy.allowedHosts ?? DEFAULT_AGENT_EGRESS_HOSTS).map((host) => host.trim().toLowerCase()).filter(Boolean));
}

function endpointUrl(
  provider: AgentProviderId,
  value: unknown,
  egressPolicy: AgentProviderEgressPolicy,
): string | null {
  if (provider !== 'openai_compatible') {
    if (value != null && value !== '') {
      fail('endpoint_not_allowed', 'Only an approved OpenAI-compatible egress endpoint may be configured.');
    }
    return null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    fail('endpoint_required', 'An HTTPS OpenAI-compatible endpoint is required.');
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    fail('endpoint_invalid', 'The provider endpoint must be a valid HTTPS URL.');
  }
  const hostname = parsed.hostname.toLowerCase();
  const allowedHosts = normalizedAllowedHosts(egressPolicy);
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || !hostname
    || isIP(hostname)
    || hostname === 'localhost'
    || hostname.endsWith('.local')
    || !allowedHosts.has(hostname)
  ) {
    fail('endpoint_not_allowed', 'The provider endpoint is not in the server egress allowlist.');
  }
  return parsed.toString().replace(/\/$/, '');
}

function publicRow(row: AgentProviderConfigRow): AgentProviderConfigurationView {
  const {
    id,
    provider,
    model,
    endpointUrl: endpoint,
    dataRegion: region,
    dataPolicy: policy,
    credentialEnvelope,
    credentialLabel,
    maxProviderCalls,
    maxRetries,
    maxDurationMs,
    maxInputChars,
    maxOutputChars,
    maxCostMicros,
    enabled,
    version,
    updatedByUserId,
    createdAt,
    updatedAt,
  } = row;
  void credentialEnvelope;
  return {
    id,
    provider: provider as AgentProviderId,
    model,
    endpointUrl: endpoint,
    dataRegion: region,
    dataPolicy: policy as AgentDataPolicy,
    credentialConfigured: Boolean(credentialEnvelope),
    credentialLabel,
    maxProviderCalls,
    maxRetries,
    maxDurationMs,
    maxInputChars,
    maxOutputChars,
    maxCostMicros,
    enabled,
    version,
    updatedByUserId,
    createdAt,
    updatedAt,
  };
}

async function rawConfiguration(
  exec: DB,
  scope: AgentProviderConfigurationScope,
): Promise<AgentProviderConfigRow | null> {
  const [row] = await exec.select().from(agentProviderConfig).where(and(
    eq(agentProviderConfig.masterFn, scope.masterFn),
    eq(agentProviderConfig.companyFn, scope.companyFn),
  )).limit(1);
  return row ?? null;
}

export async function getAgentProviderConfigurationWithin(
  exec: DB,
  scope: AgentProviderConfigurationScope,
): Promise<AgentProviderConfigurationView | null> {
  const row = await rawConfiguration(exec, scope);
  return row ? publicRow(row) : null;
}

function encryptedCredential(value: unknown): EncryptedToken | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isEncryptedToken(value)) {
    fail('invalid_credential_envelope', 'Provider credentials must use the server encrypted token envelope.');
  }
  return value;
}

function credentialLabel(value: unknown, current: string | null, configured: boolean): string | null {
  if (!configured) return null;
  const label = value === undefined ? current ?? 'Configured provider credential' : textValue(value, 'credentialLabel', 80);
  return label;
}

export async function configureAgentProviderWithin(
  exec: DB,
  scope: AgentProviderConfigurationScope,
  actor: AgentProviderConfigurationActor,
  input: AgentProviderConfigurationInput,
  egressPolicy: AgentProviderEgressPolicy = {},
): Promise<AgentProviderConfigurationView> {
  const current = await rawConfiguration(exec, scope);
  const provider = providerId(input.provider);
  const model = modelName(provider, input.model);
  const endpoint = endpointUrl(provider, input.endpointUrl, egressPolicy);
  const region = dataRegion(input.dataRegion);
  const policy = dataPolicy(input.dataPolicy);
  const suppliedCredential = encryptedCredential(input.credentialEnvelope);
  const clearCredential = input.clearCredential === undefined ? false : input.clearCredential;
  if (typeof clearCredential !== 'boolean') {
    fail('invalid_configuration', 'clearCredential must be a boolean.');
  }
  if (suppliedCredential !== undefined && clearCredential) {
    fail('invalid_configuration', 'Choose a new credential or clear the existing credential, not both.');
  }
  const providerChanged = current != null && current.provider !== provider;
  if (providerChanged && current?.credentialEnvelope && suppliedCredential === undefined && !clearCredential) {
    fail('provider_change_requires_credential_decision', 'Changing provider requires a new credential or an explicit credential clear.');
  }
  let credentialEnvelope: unknown = current?.credentialEnvelope ?? null;
  if (suppliedCredential !== undefined) credentialEnvelope = suppliedCredential;
  if (clearCredential) credentialEnvelope = null;
  if (provider === 'deterministic.zero_spend' && credentialEnvelope) {
    fail('credential_not_allowed', 'The deterministic zero-spend provider cannot store credentials.');
  }
  if (provider !== 'deterministic.zero_spend' && !credentialEnvelope) {
    fail('credentials_required', 'An encrypted credential is required for the selected provider.');
  }
  const configuredLabel = credentialLabel(
    input.credentialLabel,
    current?.credentialLabel ?? null,
    Boolean(credentialEnvelope),
  );
  const maxProviderCalls = boundedInteger(
    input.maxProviderCalls ?? current?.maxProviderCalls ?? DEFAULT_AGENT_PROVIDER_LIMITS.maxProviderCalls,
    'maxProviderCalls',
    1,
    32,
  );
  const maxRetries = boundedInteger(
    input.maxRetries ?? current?.maxRetries ?? DEFAULT_AGENT_PROVIDER_LIMITS.maxRetries,
    'maxRetries',
    0,
    maxProviderCalls - 1,
  );
  const maxDurationMs = boundedInteger(
    input.maxDurationMs ?? current?.maxDurationMs ?? DEFAULT_AGENT_PROVIDER_LIMITS.maxDurationMs,
    'maxDurationMs',
    1_000,
    120_000,
  );
  const maxInputChars = boundedInteger(
    input.maxInputChars ?? current?.maxInputChars ?? DEFAULT_AGENT_PROVIDER_LIMITS.maxInputChars,
    'maxInputChars',
    1,
    100_000,
  );
  const maxOutputChars = boundedInteger(
    input.maxOutputChars ?? current?.maxOutputChars ?? DEFAULT_AGENT_PROVIDER_LIMITS.maxOutputChars,
    'maxOutputChars',
    1,
    100_000,
  );
  const maxCostMicros = boundedInteger(
    input.maxCostMicros ?? current?.maxCostMicros ?? DEFAULT_AGENT_PROVIDER_LIMITS.maxCostMicros,
    'maxCostMicros',
    0,
    2_000_000_000,
  );
  const enabled = input.enabled === undefined
    ? current?.enabled ?? true
    : input.enabled;
  if (typeof enabled !== 'boolean') fail('invalid_configuration', 'enabled must be a boolean.');
  const values = {
    ...scope,
    provider,
    model,
    endpointUrl: endpoint,
    dataRegion: region,
    dataPolicy: policy,
    credentialEnvelope,
    credentialLabel: configuredLabel,
    maxProviderCalls,
    maxRetries,
    maxDurationMs,
    maxInputChars,
    maxOutputChars,
    maxCostMicros,
    enabled,
    updatedByUserId: actor.userId,
  };
  const before = current ? publicRow(current) : null;
  const [updated] = await exec.insert(agentProviderConfig).values(values).onConflictDoUpdate({
    target: [agentProviderConfig.masterFn, agentProviderConfig.companyFn],
    set: {
      provider,
      model,
      endpointUrl: endpoint,
      dataRegion: region,
      dataPolicy: policy,
      credentialEnvelope,
      credentialLabel: configuredLabel,
      maxProviderCalls,
      maxRetries,
      maxDurationMs,
      maxInputChars,
      maxOutputChars,
      maxCostMicros,
      enabled,
      updatedByUserId: actor.userId,
      version: sql`${agentProviderConfig.version} + 1`,
      updatedAt: new Date(),
    },
  }).returning();
  const after = publicRow(updated);
  await appendAudit(exec, {
    ...scope,
    actorUserId: actor.userId,
    requestId: actor.requestId,
    entity: 'agent_provider_config',
    entityId: scope.companyFn,
    action: providerChanged ? 'change_provider' : 'configure',
    before,
    after,
  });
  return after;
}
