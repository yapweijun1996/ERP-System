import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { encryptToken } from '../../auth/tokenCrypto';
import { documentProcessingPolicy, integrationConnector } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  checkConnectorHealthWithin,
  configureConnectorWithin,
  setConnectorEnabledWithin,
} from '../integration/connector';
import {
  configureDocumentProcessingPolicyWithin,
  getDocumentProcessingReadinessWithin,
} from './processingPolicy';

const sgScope = { masterFn: 'M1', companyFn: 'C-SG' };
const myScope = { masterFn: 'M1', companyFn: 'C-MY' };
const foreignMasterScope = { masterFn: 'M2', companyFn: 'C-SG' };
const actor = { userId: 1, requestId: 'document-processing-readiness-test' };

describe('document processing readiness projection', () => {
  it('reports local OCR source capability without external provider readiness', async () => {
    const db = await freshDb();
    await seedDemo(db);

    const readiness = await getDocumentProcessingReadinessWithin(db, sgScope);

    expect(readiness).toMatchObject({
      sourceCapability: { localOcr: true, byokVision: true },
      configured: {
        extractionProvider: 'local_ocr',
        credentialConfigured: false,
        connectorStatus: 'setup',
      },
      evidence: {
        externalProviderReady: false,
        class: 'local-ocr-source-capability',
        reasonCodes: ['local_ocr_selected'],
      },
    });
    const serialized = JSON.stringify(readiness);
    expect(serialized).not.toContain('credentialEnvelope');
    expect(serialized).not.toContain('masterFn');
    expect(serialized).not.toContain('companyFn');
  });

  it('does not promote a credential-only provider configuration to ready', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [vision] = await db.select().from(integrationConnector).where(and(
      eq(integrationConnector.masterFn, sgScope.masterFn),
      eq(integrationConnector.companyFn, sgScope.companyFn),
      eq(integrationConnector.connectorKey, 'document-vision'),
    ));

    await configureConnectorWithin(db, sgScope, actor, vision.id, {
      credentialEnvelope: encryptToken('readiness-fixture-secret', Buffer.alloc(32, 8)),
      credentialLabel: 'Readiness fixture',
      endpointHost: 'vision-gateway.example.test',
    });
    await checkConnectorHealthWithin(db, sgScope, actor, vision.id);
    await configureDocumentProcessingPolicyWithin(db, sgScope, actor, {
      extractionProvider: 'byok_vision',
      visionProvider: 'openai',
      visionRegion: 'ap-southeast-1',
      visionRetentionDays: 0,
    });

    const readiness = await getDocumentProcessingReadinessWithin(db, sgScope);

    expect(readiness).toMatchObject({
      configured: {
        extractionProvider: 'byok_vision',
        credentialConfigured: true,
        connectorStatus: 'connected',
        health: 'warning',
        lastSuccessAt: null,
      },
      evidence: {
        externalProviderReady: false,
        class: 'configured-provider-unverified',
      },
    });
    expect(readiness.evidence.reasonCodes).toContain('provider_health_unverified');
    const serialized = JSON.stringify(readiness);
    expect(serialized).not.toContain('readiness-fixture-secret');
    expect(serialized).not.toContain('credentialEnvelope');
  });

  it('does not retain provider readiness after a previously healthy connector is paused', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [vision] = await db.select().from(integrationConnector).where(and(
      eq(integrationConnector.masterFn, sgScope.masterFn),
      eq(integrationConnector.companyFn, sgScope.companyFn),
      eq(integrationConnector.connectorKey, 'document-vision'),
    ));
    await configureConnectorWithin(db, sgScope, actor, vision.id, {
      credentialEnvelope: encryptToken('stale-health-fixture-secret', Buffer.alloc(32, 8)),
      credentialLabel: 'Stale health fixture',
      endpointHost: 'vision-gateway.example.test',
    });
    const liveSuccessAt = new Date('2026-09-11T10:00:00.000Z');
    await db.update(integrationConnector).set({
      status: 'connected',
      enabled: true,
      health: 'healthy',
      lastCheckedAt: liveSuccessAt,
      lastSuccessAt: liveSuccessAt,
      lastErrorCode: null,
    }).where(eq(integrationConnector.id, vision.id));
    await configureDocumentProcessingPolicyWithin(db, sgScope, actor, {
      extractionProvider: 'byok_vision',
      visionProvider: 'openai',
      visionRegion: 'ap-southeast-1',
      visionRetentionDays: 0,
    });

    const ready = await getDocumentProcessingReadinessWithin(db, sgScope);
    expect(ready).toMatchObject({
      configured: {
        connectorStatus: 'connected',
        connectorEnabled: true,
        health: 'healthy',
        lastSuccessAt: liveSuccessAt,
      },
      evidence: {
        externalProviderReady: true,
        class: 'provider-health-verified',
        reasonCodes: [],
      },
    });

    await setConnectorEnabledWithin(db, sgScope, actor, vision.id, false);
    const paused = await getDocumentProcessingReadinessWithin(db, sgScope);
    expect(paused).toMatchObject({
      configured: {
        connectorStatus: 'paused',
        connectorEnabled: false,
        health: 'healthy',
        lastSuccessAt: liveSuccessAt,
      },
      evidence: {
        externalProviderReady: false,
        class: 'configured-provider-unverified',
      },
    });
    expect(paused.evidence.reasonCodes).toContain('provider_connector_not_connected');
  });

  it('does not promote historical success without a health-check timestamp', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [vision] = await db.select().from(integrationConnector).where(and(
      eq(integrationConnector.masterFn, sgScope.masterFn),
      eq(integrationConnector.companyFn, sgScope.companyFn),
      eq(integrationConnector.connectorKey, 'document-vision'),
    ));
    await configureConnectorWithin(db, sgScope, actor, vision.id, {
      credentialEnvelope: encryptToken('historical-health-fixture-secret', Buffer.alloc(32, 8)),
      credentialLabel: 'Historical health fixture',
      endpointHost: 'vision-gateway.example.test',
    });
    await db.update(integrationConnector).set({
      status: 'connected',
      enabled: true,
      health: 'healthy',
      lastCheckedAt: null,
      lastSuccessAt: new Date('2026-09-11T10:00:00.000Z'),
      lastErrorCode: null,
    }).where(eq(integrationConnector.id, vision.id));
    await configureDocumentProcessingPolicyWithin(db, sgScope, actor, {
      extractionProvider: 'byok_vision',
      visionProvider: 'openai',
      visionRegion: 'ap-southeast-1',
      visionRetentionDays: 0,
    });

    const readiness = await getDocumentProcessingReadinessWithin(db, sgScope);

    expect(readiness).toMatchObject({
      configured: {
        health: 'healthy',
        lastCheckedAt: null,
      },
      evidence: {
        externalProviderReady: false,
        class: 'configured-provider-unverified',
      },
    });
    expect(readiness.evidence.reasonCodes).toContain('provider_health_unverified');
    expect(JSON.stringify(readiness)).not.toContain('historical-health-fixture-secret');
  });

  it('rejects malformed credentials at policy selection and readiness', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [vision] = await db.select().from(integrationConnector).where(and(
      eq(integrationConnector.masterFn, sgScope.masterFn),
      eq(integrationConnector.companyFn, sgScope.companyFn),
      eq(integrationConnector.connectorKey, 'document-vision'),
    ));
    await db.update(integrationConnector).set({
      status: 'connected',
      enabled: true,
      health: 'healthy',
      endpointHost: 'vision-gateway.example.test',
      credentialEnvelope: { secret: 'plaintext' },
      lastCheckedAt: new Date('2026-09-11T10:00:00.000Z'),
      lastSuccessAt: new Date('2026-09-11T10:00:00.000Z'),
      lastErrorCode: null,
    }).where(eq(integrationConnector.id, vision.id));
    await expect(configureDocumentProcessingPolicyWithin(db, sgScope, actor, {
      extractionProvider: 'byok_vision',
      visionProvider: 'openai',
      visionRegion: 'ap-southeast-1',
      visionRetentionDays: 0,
    })).rejects.toMatchObject({ code: 'vision_connector_required' });
    await db.insert(documentProcessingPolicy).values({
      ...sgScope,
      extractionProvider: 'byok_vision',
      visionProvider: 'openai',
      visionRegion: 'ap-southeast-1',
      visionRetentionDays: 0,
      updatedByUserId: actor.userId,
    });

    const readiness = await getDocumentProcessingReadinessWithin(db, sgScope);

    expect(readiness).toMatchObject({
      configured: {
        credentialConfigured: false,
        connectorStatus: 'connected',
        health: 'healthy',
      },
      evidence: {
        externalProviderReady: false,
        class: 'configured-provider-unverified',
      },
    });
    expect(readiness.evidence.reasonCodes).toContain('provider_credentials_invalid');
    expect(JSON.stringify(readiness)).not.toContain('plaintext');
  });

  it('does not promote an optional provider with a malformed stored envelope', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [vision] = await db.select().from(integrationConnector).where(and(
      eq(integrationConnector.masterFn, sgScope.masterFn),
      eq(integrationConnector.companyFn, sgScope.companyFn),
      eq(integrationConnector.connectorKey, 'document-vision'),
    ));
    const checkedAt = new Date('2026-09-11T10:00:00.000Z');
    await db.update(integrationConnector).set({
      credentialRequired: false,
      credentialEnvelope: { secret: 'plaintext' },
      endpointHost: 'vision-gateway.example.test',
      enabled: true,
      status: 'connected',
      health: 'healthy',
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      lastErrorCode: null,
    }).where(eq(integrationConnector.id, vision.id));
    await configureDocumentProcessingPolicyWithin(db, sgScope, actor, {
      extractionProvider: 'byok_vision',
      visionProvider: 'openai_compatible',
      visionRegion: 'local',
      visionRetentionDays: 0,
      visionBaseUrl: 'http://127.0.0.1:1234/v1',
      visionModel: 'receipt-vision-local',
      visionCredentialRequired: false,
    });

    const readiness = await getDocumentProcessingReadinessWithin(db, sgScope);

    expect(readiness).toMatchObject({
      configured: {
        credentialRequired: false,
        credentialConfigured: false,
        connectorStatus: 'connected',
      },
      evidence: {
        externalProviderReady: false,
        class: 'configured-provider-unverified',
      },
    });
    expect(readiness.evidence.reasonCodes).toContain('provider_credentials_invalid');
    expect(JSON.stringify(readiness)).not.toContain('plaintext');
  });

  it('keeps readiness tenant-scoped after another tenant is configured', async () => {
    const db = await freshDb();
    await seedDemo(db);
    const [vision] = await db.select().from(integrationConnector).where(and(
      eq(integrationConnector.masterFn, sgScope.masterFn),
      eq(integrationConnector.companyFn, sgScope.companyFn),
      eq(integrationConnector.connectorKey, 'document-vision'),
    ));
    await configureConnectorWithin(db, sgScope, actor, vision.id, {
      credentialEnvelope: encryptToken('tenant-scoped-secret', Buffer.alloc(32, 9)),
      credentialLabel: 'Tenant scoped fixture',
      endpointHost: 'sg-vision-gateway.example.test',
    });

    const myReadiness = await getDocumentProcessingReadinessWithin(db, myScope);

    expect(myReadiness).toMatchObject({
      configured: {
        extractionProvider: 'local_ocr',
        credentialConfigured: false,
        connectorStatus: 'setup',
        endpointHost: null,
      },
      evidence: {
        externalProviderReady: false,
        class: 'local-ocr-source-capability',
      },
    });
    expect(JSON.stringify(myReadiness)).not.toContain('sg-vision-gateway.example.test');
    expect(JSON.stringify(myReadiness)).not.toContain('tenant-scoped-secret');

    const foreignMasterReadiness = await getDocumentProcessingReadinessWithin(db, foreignMasterScope);

    expect(foreignMasterReadiness).toMatchObject({
      configured: {
        extractionProvider: 'local_ocr',
        credentialConfigured: false,
        connectorStatus: 'missing',
        endpointHost: null,
      },
      evidence: {
        externalProviderReady: false,
        class: 'local-ocr-source-capability',
      },
    });
    expect(JSON.stringify(foreignMasterReadiness)).not.toContain('sg-vision-gateway.example.test');
    expect(JSON.stringify(foreignMasterReadiness)).not.toContain('tenant-scoped-secret');
  });
});
