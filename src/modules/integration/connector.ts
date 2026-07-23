import { and, eq } from 'drizzle-orm';
import type { DB } from '../../data/db';
import { integrationConnector } from '../../data/schema';
import { appendAudit } from '../../api/audit';

export interface ConnectorScope { masterFn: string; companyFn: string }
export interface ConnectorActor { userId: number; requestId: string }

export class ConnectorError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

const PUBLIC_COLUMNS = {
  id: integrationConnector.id,
  connectorKey: integrationConnector.connectorKey,
  displayName: integrationConnector.displayName,
  category: integrationConnector.category,
  direction: integrationConnector.direction,
  schedule: integrationConnector.schedule,
  status: integrationConnector.status,
  health: integrationConnector.health,
  endpointHost: integrationConnector.endpointHost,
  credentialRequired: integrationConnector.credentialRequired,
  credentialLabel: integrationConnector.credentialLabel,
  recordsProcessed: integrationConnector.recordsProcessed,
  lastCheckedAt: integrationConnector.lastCheckedAt,
  lastSuccessAt: integrationConnector.lastSuccessAt,
  lastErrorCode: integrationConnector.lastErrorCode,
  enabled: integrationConnector.enabled,
  version: integrationConnector.version,
} as const;

export async function listConnectorsWithin(exec: DB, scope: ConnectorScope) {
  return exec.select(PUBLIC_COLUMNS).from(integrationConnector).where(and(
    eq(integrationConnector.masterFn, scope.masterFn),
    eq(integrationConnector.companyFn, scope.companyFn),
  )).orderBy(integrationConnector.id);
}

async function ownedConnector(exec: DB, scope: ConnectorScope, id: number) {
  const [row] = await exec.select().from(integrationConnector).where(and(
    eq(integrationConnector.id, id),
    eq(integrationConnector.masterFn, scope.masterFn),
    eq(integrationConnector.companyFn, scope.companyFn),
  )).limit(1);
  if (!row) throw new ConnectorError('not_found', 'Connector not found in the active company.');
  return row;
}

function publicRow(row: typeof integrationConnector.$inferSelect) {
  const { credentialEnvelope: _secret, masterFn: _master, companyFn: _company, ...safe } = row;
  void _secret; void _master; void _company;
  return safe;
}

async function auditedUpdate(
  exec: DB,
  scope: ConnectorScope,
  actor: ConnectorActor,
  id: number,
  action: string,
  before: typeof integrationConnector.$inferSelect,
  values: Partial<typeof integrationConnector.$inferInsert>,
) {
  const [updated] = await exec.update(integrationConnector).set({
    ...values,
    version: before.version + 1,
    updatedAt: new Date(),
  }).where(and(
    eq(integrationConnector.id, id),
    eq(integrationConnector.masterFn, scope.masterFn),
    eq(integrationConnector.companyFn, scope.companyFn),
  )).returning();
  const result = publicRow(updated);
  await appendAudit(exec, {
    ...scope,
    actorUserId: actor.userId,
    requestId: actor.requestId,
    entity: 'integration_connector',
    entityId: id,
    action,
    before: { status: before.status, health: before.health, enabled: before.enabled, version: before.version },
    after: result,
  });
  return result;
}

export async function setConnectorEnabledWithin(
  exec: DB, scope: ConnectorScope, actor: ConnectorActor, id: number, enabled: boolean,
) {
  const row = await ownedConnector(exec, scope, id);
  if (enabled && row.credentialRequired && !row.credentialEnvelope) {
    throw new ConnectorError('credentials_required', 'Configure encrypted credentials before enabling this connector.');
  }
  return auditedUpdate(exec, scope, actor, id, enabled ? 'resume' : 'pause', row, {
    enabled,
    status: enabled ? 'connected' : 'paused',
    health: enabled ? 'unknown' : row.health,
    lastErrorCode: null,
  });
}

export async function checkConnectorHealthWithin(
  exec: DB, scope: ConnectorScope, actor: ConnectorActor, id: number,
) {
  const row = await ownedConnector(exec, scope, id);
  const configured = !row.credentialRequired || Boolean(row.credentialEnvelope);
  const enabled = row.enabled && configured;
  return auditedUpdate(exec, scope, actor, id, 'check_health', row, {
    health: configured ? 'healthy' : 'warning',
    status: enabled ? 'connected' : configured ? row.status : 'setup',
    lastCheckedAt: new Date(),
    lastSuccessAt: configured ? new Date() : row.lastSuccessAt,
    lastErrorCode: configured ? null : 'credentials_not_configured',
  });
}

export async function configureConnectorWithin(
  exec: DB,
  scope: ConnectorScope,
  actor: ConnectorActor,
  id: number,
  input: { credentialEnvelope: unknown; credentialLabel: string; endpointHost?: string | null },
) {
  const row = await ownedConnector(exec, scope, id);
  const label = input.credentialLabel.trim();
  if (!label || label.length > 80) {
    throw new ConnectorError('invalid_label', 'Credential label is required and must be at most 80 characters.');
  }
  const endpointHost = input.endpointHost?.trim() || null;
  if (endpointHost && (!/^[a-z0-9.-]+$/i.test(endpointHost) || endpointHost.length > 253)) {
    throw new ConnectorError('invalid_endpoint', 'Endpoint must be a hostname without a path or protocol.');
  }
  return auditedUpdate(exec, scope, actor, id, 'configure_credentials', row, {
    credentialEnvelope: input.credentialEnvelope,
    credentialLabel: label,
    endpointHost,
    enabled: true,
    status: 'connected',
    health: 'unknown',
    lastErrorCode: null,
  });
}
