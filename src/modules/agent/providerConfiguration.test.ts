import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, type EncryptedToken } from '../../auth/tokenCrypto';
import { auditLog, agentProviderConfig } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  configureAgentProviderWithin,
  getAgentProviderConfigurationWithin,
} from './providerConfiguration';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
const actor = { userId: 1, requestId: 'agent-provider-test' };
const encryptionKey = Buffer.alloc(32, 7);

function encrypted(secret: string): EncryptedToken {
  return encryptToken(secret, encryptionKey);
}

describe('Company Agent provider configuration', () => {
  it('stores deterministic zero-spend configuration without a credential and isolates companies', async () => {
    const db = await freshDb(); await seedDemo(db);
    const configured = await configureAgentProviderWithin(db, scope, actor, {
      provider: 'deterministic.zero_spend',
      model: 'erp-test-zero-spend-v1',
    });

    expect(configured).toMatchObject({
      provider: 'deterministic.zero_spend',
      model: 'erp-test-zero-spend-v1',
      credentialConfigured: false,
      maxProviderCalls: 1,
      maxRetries: 0,
      maxCostMicros: 0,
    });
    expect(JSON.stringify(configured)).not.toContain('credentialEnvelope');
    expect(await getAgentProviderConfigurationWithin(db, { masterFn: 'M1', companyFn: 'C-MY' })).toBeNull();
    const [stored] = await db.select().from(agentProviderConfig).where(and(
      eq(agentProviderConfig.masterFn, scope.masterFn),
      eq(agentProviderConfig.companyFn, scope.companyFn),
    ));
    expect(stored.credentialEnvelope).toBeNull();
  });

  it('encrypts provider credentials, supports rotation, and keeps secrets out of views and audit', async () => {
    const db = await freshDb(); await seedDemo(db);
    const oldSecret = 'old-openai-secret-value';
    const newSecret = 'new-openai-secret-value';
    await configureAgentProviderWithin(db, scope, actor, {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      credentialEnvelope: encrypted(oldSecret),
      credentialLabel: 'Primary OpenAI key',
    });
    const rotated = await configureAgentProviderWithin(db, scope, actor, {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      credentialEnvelope: encrypted(newSecret),
      credentialLabel: 'Rotated OpenAI key',
    });

    expect(rotated).toMatchObject({ provider: 'openai', credentialConfigured: true });
    expect(JSON.stringify(rotated)).not.toContain(oldSecret);
    expect(JSON.stringify(rotated)).not.toContain(newSecret);
    expect(JSON.stringify(rotated)).not.toContain('credentialEnvelope');
    const [stored] = await db.select().from(agentProviderConfig).where(and(
      eq(agentProviderConfig.masterFn, scope.masterFn),
      eq(agentProviderConfig.companyFn, scope.companyFn),
    ));
    expect(decryptToken(stored.credentialEnvelope as EncryptedToken, encryptionKey)).toBe(newSecret);
    const audits = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'agent_provider_config'),
      eq(auditLog.entityId, scope.companyFn),
    ));
    expect(JSON.stringify(audits)).not.toContain(oldSecret);
    expect(JSON.stringify(audits)).not.toContain(newSecret);
    expect(JSON.stringify(audits)).not.toContain('credentialEnvelope');
  });

  it('requires an explicit credential decision when changing provider', async () => {
    const db = await freshDb(); await seedDemo(db);
    await configureAgentProviderWithin(db, scope, actor, {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      credentialEnvelope: encrypted('provider-change-secret'),
    });
    await expect(configureAgentProviderWithin(db, scope, actor, {
      provider: 'google',
      model: 'gemini-2.5-flash',
    })).rejects.toMatchObject({ code: 'provider_change_requires_credential_decision' });

    const cleared = await configureAgentProviderWithin(db, scope, actor, {
      provider: 'deterministic.zero_spend',
      model: 'erp-test-zero-spend-v1',
      clearCredential: true,
    });
    expect(cleared).toMatchObject({ provider: 'deterministic.zero_spend', credentialConfigured: false });
  });

  it('enforces provider models, endpoint egress, and bounded runtime limits', async () => {
    const db = await freshDb(); await seedDemo(db);
    await expect(configureAgentProviderWithin(db, scope, actor, {
      provider: 'openai', model: 'not-allowlisted', credentialEnvelope: encrypted('model-secret'),
    })).rejects.toMatchObject({ code: 'model_not_allowed' });
    await expect(configureAgentProviderWithin(db, scope, actor, {
      provider: 'openai_compatible', model: 'gateway-model', credentialEnvelope: encrypted('gateway-secret'),
      endpointUrl: 'http://gateway.example.test/v1',
    })).rejects.toMatchObject({ code: 'endpoint_not_allowed' });
    await expect(configureAgentProviderWithin(db, scope, actor, {
      provider: 'openai_compatible', model: 'gateway-model', credentialEnvelope: encrypted('gateway-secret'),
      endpointUrl: 'https://not-approved.example.test/v1',
    })).rejects.toMatchObject({ code: 'endpoint_not_allowed' });
    await expect(configureAgentProviderWithin(db, scope, actor, {
      provider: 'openai', model: 'gpt-4.1-mini', credentialEnvelope: encrypted('limit-secret'),
      maxProviderCalls: 1, maxRetries: 1,
    })).rejects.toMatchObject({ code: 'invalid_configuration' });

    const compatible = await configureAgentProviderWithin(db, scope, actor, {
      provider: 'openai_compatible',
      model: 'gateway-model',
      credentialEnvelope: encrypted('gateway-secret'),
      endpointUrl: 'https://gateway.example.test/v1',
      maxProviderCalls: 2,
      maxRetries: 1,
    }, { allowedHosts: ['gateway.example.test'] });
    expect(compatible).toMatchObject({
      provider: 'openai_compatible',
      endpointUrl: 'https://gateway.example.test/v1',
      maxProviderCalls: 2,
      maxRetries: 1,
    });
  });

  it('rejects malformed envelopes and prevents deterministic credentials', async () => {
    const db = await freshDb(); await seedDemo(db);
    await expect(configureAgentProviderWithin(db, scope, actor, {
      provider: 'openai', model: 'gpt-4.1-mini', credentialEnvelope: { secret: 'plaintext' },
    })).rejects.toMatchObject({ code: 'invalid_credential_envelope' });
    await expect(configureAgentProviderWithin(db, scope, actor, {
      provider: 'deterministic.zero_spend', model: 'erp-test-zero-spend-v1',
      credentialEnvelope: encrypted('not-needed-secret'),
    })).rejects.toMatchObject({ code: 'credential_not_allowed' });
  });
});
