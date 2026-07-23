import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { auditLog, integrationConnector } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
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
    expect(sg).toHaveLength(3); expect(my).toHaveLength(1);
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
    const envelope = { iv: 'opaque-iv', ciphertext: 'opaque-ciphertext', tag: 'opaque-tag' };
    const publicRow = await configureConnectorWithin(db, scope, { userId: 1, requestId: 'configure-test' }, webhook.id, {
      credentialEnvelope: envelope, credentialLabel: 'Primary webhook', endpointHost: 'warehouse.example.test',
    });
    expect(JSON.stringify(publicRow)).not.toContain('opaque-ciphertext');
    const [stored] = await db.select().from(integrationConnector).where(eq(integrationConnector.id, webhook.id));
    expect(stored.credentialEnvelope).toEqual(envelope);
  });
});
