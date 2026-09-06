import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { auditLog, integrationConnector } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import { decryptToken, encryptToken, type EncryptedToken } from '../../auth/tokenCrypto';
import {
  checkConnectorHealthWithin,
  configureConnectorWithin,
  ConnectorError,
  listConnectorsWithin,
  setConnectorEnabledWithin,
} from './connector';

describe('integration connector registry', () => {
  it('isolates the active company and never exposes credential envelopes', async () => {
    const db = await freshDb(); await seedDemo(db);
    const sg = await listConnectorsWithin(db, { masterFn: 'M1', companyFn: 'C-SG' });
    const my = await listConnectorsWithin(db, { masterFn: 'M1', companyFn: 'C-MY' });
    expect(sg).toHaveLength(4); expect(my).toHaveLength(2);
    expect(sg).toContainEqual(expect.objectContaining({
      connectorKey: 'document-vision',
      status: 'setup',
      enabled: false,
      credentialRequired: true,
    }));
    expect(JSON.stringify(sg)).not.toContain('credentialEnvelope');
    expect(JSON.stringify(sg)).not.toContain('masterFn');
    expect(JSON.stringify(sg)).not.toContain('companyFn');
  });

  it('audits health and state changes and refuses an unconfigured protected connector', async () => {
    const db = await freshDb(); await seedDemo(db);
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const actor = { userId: 1, requestId: 'connector-test' };
    const rows = await listConnectorsWithin(db, scope);
    const webhook = rows.find((row) => row.connectorKey === 'warehouse-webhook')!;
    await expect(setConnectorEnabledWithin(db, scope, actor, webhook.id, true))
      .rejects.toMatchObject({ code: 'credentials_required' } satisfies Partial<ConnectorError>);
    const csv = rows.find((row) => row.connectorKey === 'customer-csv')!;
    await setConnectorEnabledWithin(db, scope, actor, csv.id, false);
    await setConnectorEnabledWithin(db, scope, actor, csv.id, true);
    const checked = await checkConnectorHealthWithin(db, scope, actor, csv.id);
    expect(checked).toMatchObject({ status: 'connected', health: 'healthy', enabled: true });
    expect(await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'integration_connector'), eq(auditLog.entityId, String(csv.id)),
    ))).toHaveLength(3);
  });

  it('stores an opaque credential envelope while returning only safe metadata', async () => {
    const db = await freshDb(); await seedDemo(db);
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const [webhook] = await db.select().from(integrationConnector).where(and(
      eq(integrationConnector.companyFn, 'C-SG'),
      eq(integrationConnector.connectorKey, 'warehouse-webhook'),
    ));
    const key = Buffer.alloc(32, 4);
    const envelope = encryptToken('opaque-secret', key);
    const publicRow = await configureConnectorWithin(db, scope, { userId: 1, requestId: 'configure-test' }, webhook.id, {
      credentialEnvelope: envelope, credentialLabel: 'Primary webhook', endpointHost: 'warehouse.example.test',
    });
    expect(JSON.stringify(publicRow)).not.toContain('opaque-secret');
    const [stored] = await db.select().from(integrationConnector).where(eq(integrationConnector.id, webhook.id));
    expect(stored.credentialEnvelope).toEqual(envelope);
    expect(decryptToken(stored.credentialEnvelope as EncryptedToken, key)).toBe('opaque-secret');
  });

  it('rotates encrypted credentials without exposing either value and pauses the connector for revocation', async () => {
    const db = await freshDb(); await seedDemo(db);
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const actor = { userId: 1, requestId: 'connector-rotation-test' };
    const key = Buffer.alloc(32, 5);
    const [webhook] = await db.select().from(integrationConnector).where(and(
      eq(integrationConnector.companyFn, 'C-SG'),
      eq(integrationConnector.connectorKey, 'warehouse-webhook'),
    ));
    const oldSecret = 'old-connector-secret';
    const newSecret = 'new-connector-secret';
    await configureConnectorWithin(db, scope, actor, webhook.id, {
      credentialEnvelope: encryptToken(oldSecret, key),
      credentialLabel: 'Primary webhook',
      endpointHost: 'warehouse.example.test',
    });
    const rotated = await configureConnectorWithin(db, scope, actor, webhook.id, {
      credentialEnvelope: encryptToken(newSecret, key),
      credentialLabel: 'Rotated webhook',
      endpointHost: 'warehouse.example.test',
    });
    expect(JSON.stringify(rotated)).not.toContain(oldSecret);
    expect(JSON.stringify(rotated)).not.toContain(newSecret);
    const [stored] = await db.select().from(integrationConnector).where(eq(integrationConnector.id, webhook.id));
    expect(decryptToken(stored.credentialEnvelope as EncryptedToken, key)).toBe(newSecret);
    const auditRows = await db.select().from(auditLog).where(and(
      eq(auditLog.entity, 'integration_connector'),
      eq(auditLog.entityId, String(webhook.id)),
    ));
    expect(JSON.stringify(auditRows)).not.toContain(oldSecret);
    expect(JSON.stringify(auditRows)).not.toContain(newSecret);

    const paused = await setConnectorEnabledWithin(db, scope, actor, webhook.id, false);
    expect(paused).toMatchObject({ enabled: false, status: 'paused' });
  });

  it('rejects a plaintext or malformed credential envelope at the domain boundary', async () => {
    const db = await freshDb(); await seedDemo(db);
    const scope = { masterFn: 'M1', companyFn: 'C-SG' };
    const [webhook] = await db.select().from(integrationConnector).where(and(
      eq(integrationConnector.companyFn, 'C-SG'),
      eq(integrationConnector.connectorKey, 'warehouse-webhook'),
    ));
    await expect(configureConnectorWithin(db, scope, { userId: 1, requestId: 'connector-invalid-envelope' }, webhook.id, {
      credentialEnvelope: { secret: 'plaintext' } as never,
      credentialLabel: 'Invalid',
    })).rejects.toMatchObject({ code: 'invalid_credential_envelope' } satisfies Partial<ConnectorError>);
  });
});
