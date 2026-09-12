import type { DB } from '../data/db';
import { withTenantTransaction } from '../data/tenantTransaction';
import { DocumentQuarantineError } from '../modules/documents/processing';
import { DocumentStorageError } from '../modules/documents/storage';
import {
  CompanyReceiptError,
  listCompanyReceiptsWithin,
  readCompanyReceiptWithin,
} from '../modules/expenses/companyReceipt';
import {
  CompanyReceiptPackError,
  normalizeCompanyReceiptPackFilters,
  readCompanyReceiptPackWithin,
  renderCompanyReceiptPackWithin,
  selectCompanyReceiptPackWithin,
} from '../modules/expenses/companyReceiptPack';
import {
  getAgentActionContract,
  parseAgentActionInput,
  validateAgentActionOutput,
  type AgentActionName,
  type AgentActionInputMap,
} from '../modules/agent/actionContracts';
import {
  AgentExecutionIntentError,
  executeAgentReceiptPackWithin,
} from '../modules/agent/agentExecutionIntent';
import { hasPermission, PERMISSIONS } from '../auth/permissions';
import { isModuleEnabled } from '../auth/moduleAccess';
import { AuthLifecycleError } from '../auth/authErrors';
import type { AuthenticatedAgentIdentity } from '../auth/agentAuthentication';
import type { SessionData } from '../auth/session';
import { appendAudit } from './audit';
import { runWithAuditAttribution } from './auditContext';
import { ActionDispatchError } from './actionDispatcher';
import {
  resolveAgentGrantWithin,
  type ResolvedAgentGrant,
} from '../modules/agent/agentIdentity';

export interface AgentActionDispatchRequest {
  /** This value is selected by the authenticated adapter, never by a model payload. */
  action: string;
  input: unknown;
  /** Required when the action can append an audit event, such as PDF export. */
  requestId: string;
}

export interface AuthenticatedAgentActionRequest extends AgentActionDispatchRequest {
  /** Derived by the issuer adapter; never read from the action input. */
  identity: AuthenticatedAgentIdentity;
}

export interface AgentJsonDispatchResult {
  kind: 'json';
  status: 200;
  action: AgentActionName;
  version: 1;
  body: unknown;
}

export interface AgentBinaryDispatchResult {
  kind: 'binary';
  status: 200;
  action: 'receipt_pack.export';
  version: 1;
  content: Uint8Array;
  contentType: 'application/pdf';
  headers: Readonly<Record<string, string>>;
  metadata: {
    contentType: 'application/pdf';
    byteLength: number;
    artifactSha256: string;
    sourceSha256: string;
    accessPurpose: string;
  };
}

export type AgentActionDispatchResult = AgentJsonDispatchResult | AgentBinaryDispatchResult;

type ReceiptSearchInput = AgentActionInputMap['receipt.search'];
type ReceiptGetInput = AgentActionInputMap['receipt.get'];
type ReceiptPackPrepareInput = AgentActionInputMap['receipt_pack.prepare'];
type ReceiptPackCreateInput = AgentActionInputMap['receipt_pack.create'];
type ReceiptPackGetInput = AgentActionInputMap['receipt_pack.get'];
type ReceiptPackExportInput = AgentActionInputMap['receipt_pack.export'];

interface ActionIdentity {
  scope: { masterFn: string; companyFn: string };
  /** Existing domain commands require a numeric business subject. For an Agent
   * this is the accountable owner, never a fabricated human SessionData. */
  actorUserId: number;
  visibility: 'own' | 'company';
  session?: SessionData;
  auditActorUserId: number;
  agentPrincipalId?: number;
  delegatorUserId?: number;
  fields?: string[];
}

async function resolveReceiptVisibility(
  tx: DB,
  session: SessionData,
): Promise<'own' | 'company'> {
  if (await hasPermission(tx, session, PERMISSIONS.expensesCompanyReceiptsReadCompany)) {
    return 'company';
  }
  if (await hasPermission(tx, session, PERMISSIONS.expensesCompanyReceiptsReadOwn)) {
    return 'own';
  }
  throw new ActionDispatchError(
    403,
    'permission_denied',
    'You cannot read Company Receipts.',
  );
}

function translateDomainError(error: unknown): never {
  if (error instanceof ActionDispatchError) throw error;
  if (error instanceof AuthLifecycleError) {
    throw new ActionDispatchError(error.status, error.code, error.message);
  }
  if (error instanceof CompanyReceiptError || error instanceof CompanyReceiptPackError) {
    throw new ActionDispatchError(error.status, error.code, error.message);
  }
  if (error instanceof AgentExecutionIntentError) {
    throw new ActionDispatchError(error.status, error.code, error.message);
  }
  if (error instanceof DocumentQuarantineError) {
    throw new ActionDispatchError(423, error.code, error.message);
  }
  if (error instanceof DocumentStorageError) {
    throw new ActionDispatchError(error.status, error.code, error.message);
  }
  const databaseCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  if (databaseCode === '40001' || databaseCode === '40P01') {
    throw new ActionDispatchError(
      409,
      'agent_execution_intent_concurrent_change',
      'The reviewed Receipt Pack facts changed concurrently; prepare and approve a new intent.',
    );
  }
  throw error;
}

function agentVisibility(grant: ResolvedAgentGrant): 'own' | 'company' {
  if (
    grant.scope === 'company'
    && grant.permissionKey === PERMISSIONS.expensesCompanyReceiptsReadCompany
  ) {
    return 'company';
  }
  if (
    grant.scope === 'self'
    && grant.permissionKey === PERMISSIONS.expensesCompanyReceiptsReadOwn
  ) {
    return 'own';
  }
  throw new ActionDispatchError(
    403,
    'agent_scope_unsupported',
    'This Agent action cannot safely enforce the delegated record scope.',
  );
}

function agentActionIdentity(
  scope: { masterFn: string; companyFn: string },
  grant: ResolvedAgentGrant,
): ActionIdentity {
  return {
    scope,
    actorUserId: grant.ownerUserId,
    visibility: agentVisibility(grant),
    auditActorUserId: grant.actorUserId,
    agentPrincipalId: grant.agentPrincipalId,
    delegatorUserId: grant.ownerUserId,
    fields: grant.fields,
  };
}

function humanActionIdentity(
  scope: { masterFn: string; companyFn: string },
  session: SessionData,
  visibility: 'own' | 'company',
): ActionIdentity {
  return {
    scope,
    actorUserId: session.userId,
    visibility,
    session,
    auditActorUserId: session.userId,
  };
}

function projectRecord(value: unknown, fields: readonly string[]): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  if (fields.includes('*')) return value;
  const allowed = new Set(fields);
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)));
}

function projectAgentJsonBody(
  action: AgentActionName,
  body: unknown,
  fields: readonly string[],
): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const source = body as Record<string, unknown>;
  if (action === 'receipt.search') {
    const data = Array.isArray(source.data)
      ? source.data.map((row) => projectRecord(row, fields))
      : source.data;
    return { ...source, data };
  }
  if (action === 'receipt.get') {
    return { ...source, data: projectRecord(source.data, fields) };
  }
  if (action === 'receipt_pack.prepare') {
    const projected = projectRecord(source.data, fields);
    if (!projected || typeof projected !== 'object' || Array.isArray(projected)) {
      return { ...source, data: projected };
    }
    const projectedData = projected as Record<string, unknown>;
    // These are preparation-boundary metadata, not persisted Pack fields. The
    // digest is required to bind a later human approval to this exact result;
    // preparedAt makes the read-only preparation auditable across adapters.
    return {
      ...source,
      data: {
        ...projectedData,
        selectionDigest: (source.data as Record<string, unknown>).selectionDigest,
        preparedAt: (source.data as Record<string, unknown>).preparedAt,
      },
    };
  }
  if (action === 'receipt_pack.create') {
    const data = source.data && typeof source.data === 'object' && !Array.isArray(source.data)
      ? source.data as Record<string, unknown>
      : source.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return source;
    const record = data as Record<string, unknown>;
    return {
      ...source,
      data: {
        ...record,
        pack: projectRecord(record.pack, fields),
      },
    };
  }
  if (action === 'receipt_pack.get') {
    return { ...source, data: projectRecord(source.data, fields) };
  }
  return body;
}

function projectAgentResult(
  action: AgentActionName,
  result: AgentActionDispatchResult,
  grant: ResolvedAgentGrant,
): AgentActionDispatchResult {
  if (result.kind !== 'json') return result;
  const projected = projectAgentJsonBody(action, result.body, grant.fields);
  // The transport is JSON even when domain projections contain Date objects.
  // Validate and return the exact JSON-safe body that the adapter will receive.
  const body = JSON.parse(JSON.stringify(projected)) as unknown;
  validateAgentActionOutput(action, body);
  return { ...result, body };
}

function jsonResult(
  action: AgentActionName,
  body: unknown,
): AgentJsonDispatchResult {
  return {
    kind: 'json',
    status: 200,
    action,
    version: 1,
    body,
  };
}

async function dispatchReceiptSearch(
  tx: DB,
  identity: ActionIdentity,
  input: ReceiptSearchInput,
): Promise<AgentJsonDispatchResult> {
  const limit = input.limit ?? 50;
  const afterId = input.afterId ?? null;
  const search = input.search?.trim() ?? '';
  const dateFrom = input.dateFrom ?? null;
  const dateTo = input.dateTo ?? null;
  const [canCreate, canEdit, canVoid, rows] = await Promise.all([
    identity.session
      ? hasPermission(tx, identity.session, PERMISSIONS.expensesCompanyReceiptsCreate)
      : false,
    identity.session
      ? hasPermission(tx, identity.session, PERMISSIONS.expensesCompanyReceiptsEdit)
      : false,
    identity.session
      ? hasPermission(tx, identity.session, PERMISSIONS.expensesCompanyReceiptsVoid)
      : false,
    listCompanyReceiptsWithin(tx, {
      ...identity.scope,
    }, identity.actorUserId, {
      limit,
      afterId,
      visibility: identity.visibility,
      search,
      dateFrom,
      dateTo,
    }),
  ]);
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);
  return jsonResult('receipt.search', {
      data,
      meta: {
      scope: identity.visibility,
      actorUserId: identity.actorUserId,
      limit,
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
      filters: { search, dateFrom, dateTo },
      actions: { create: canCreate, edit: canEdit, void: canVoid },
    },
  });
}

async function dispatchReceiptGet(
  tx: DB,
  identity: ActionIdentity,
  input: ReceiptGetInput,
): Promise<AgentJsonDispatchResult> {
  const data = await readCompanyReceiptWithin(
    tx,
    identity.scope,
    identity.actorUserId,
    input.receiptId,
    identity.visibility,
  );
  return jsonResult('receipt.get', { data, meta: { scope: identity.visibility } });
}

async function dispatchReceiptPackPrepare(
  tx: DB,
  identity: ActionIdentity,
  input: ReceiptPackPrepareInput,
): Promise<AgentJsonDispatchResult> {
  const filters = normalizeCompanyReceiptPackFilters(input);
  const selection = await selectCompanyReceiptPackWithin(
    tx,
    identity.scope,
    identity.actorUserId,
    identity.visibility,
    filters,
  );
  const body = {
    data: {
      selectionDigest: selection.sourceSha256,
      visibility: identity.visibility,
      filters: selection.filters,
      rows: selection.rows,
      totals: selection.totals,
      rowCount: selection.rowCount,
      documentCount: selection.documentCount,
      preparedAt: new Date().toISOString(),
    },
    meta: {
      preparationOnly: true,
      authorizationRequired: true,
      completeResult: true,
    },
  };
  validateAgentActionOutput('receipt_pack.prepare', body);
  return jsonResult('receipt_pack.prepare', body);
}

async function dispatchReceiptPackCreate(
  tx: DB,
  identity: ActionIdentity,
  request: AgentActionDispatchRequest,
  input: ReceiptPackCreateInput,
): Promise<AgentJsonDispatchResult> {
  if (identity.agentPrincipalId == null) {
    throw new ActionDispatchError(
      428,
      'agent_execution_intent_required',
      'A reviewed, identity-bound approval is required before Receipt Pack creation.',
    );
  }
  if (input.executionIntentId == null || input.executionIntentKey == null) {
    throw new ActionDispatchError(
      428,
      'agent_execution_intent_required',
      'A reviewed, identity-bound execution intent is required before Receipt Pack creation.',
    );
  }
  const result = await executeAgentReceiptPackWithin(tx, identity.scope, {
    intentId: input.executionIntentId,
    intentKey: input.executionIntentKey,
    agentPrincipalId: identity.agentPrincipalId,
    actorUserId: identity.actorUserId,
    packKey: input.packKey,
    search: input.search,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    locale: input.locale,
    visibility: identity.visibility,
    selectionDigest: input.selectionDigest,
    payloadDigest: input.payloadDigest,
    requestId: request.requestId,
  });
  await appendAudit(tx, {
    ...identity.scope,
    actorUserId: identity.auditActorUserId,
    agentPrincipalId: identity.agentPrincipalId,
    delegatorUserId: identity.delegatorUserId,
    requestId: request.requestId,
    entity: 'company_receipt_pack',
    entityId: result.pack.id,
    action: result.replayed ? 'create_replay' : 'created',
    after: {
      intentId: result.intent.id,
      intentPayloadDigest: result.intent.payloadDigest,
      intentSelectionDigest: result.intent.selectionDigest,
      visibility: result.pack.visibility,
      sourceSha256: result.pack.sourceSha256,
      rowCount: result.pack.rowCount,
      documentCount: result.pack.documentCount,
      totals: result.pack.totals,
    },
  });
  await appendAudit(tx, {
    ...identity.scope,
    actorUserId: identity.auditActorUserId,
    agentPrincipalId: identity.agentPrincipalId,
    delegatorUserId: identity.delegatorUserId,
    requestId: request.requestId,
    entity: 'agent_execution_intent',
    entityId: result.intent.id,
    action: result.replayed ? 'replayed' : 'executed',
    after: {
      packId: result.pack.id,
      packSourceSha256: result.pack.sourceSha256,
      packReplayed: result.replayed,
      intentPayloadDigest: result.intent.payloadDigest,
      intentSelectionDigest: result.intent.selectionDigest,
    },
  });
  const body = JSON.parse(JSON.stringify({
    data: {
      pack: result.pack,
      replayed: result.replayed,
    },
    meta: {
      immutableSnapshot: true,
      completeResult: true,
      missingDatesExcluded: true,
      currencyTotalsSeparated: true,
    },
  })) as unknown;
  validateAgentActionOutput('receipt_pack.create', body);
  return jsonResult('receipt_pack.create', body);
}

async function dispatchReceiptPackGet(
  tx: DB,
  identity: ActionIdentity,
  input: ReceiptPackGetInput,
): Promise<AgentJsonDispatchResult> {
  const data = await readCompanyReceiptPackWithin(
    tx,
    identity.scope,
    identity.actorUserId,
    identity.visibility,
    input.packId,
  );
  return jsonResult('receipt_pack.get', {
    data,
    meta: {
      immutableSnapshot: true,
      completeResult: true,
      accessVisibility: identity.visibility,
    },
  });
}

async function dispatchReceiptPackExport(
  tx: DB,
  identity: ActionIdentity,
  request: AgentActionDispatchRequest,
  input: ReceiptPackExportInput,
): Promise<AgentBinaryDispatchResult> {
  const scope = identity.scope;
  const rendered = await renderCompanyReceiptPackWithin(
    tx,
    scope,
    identity.actorUserId,
    identity.visibility,
    input.packId,
    input.action,
  );
  await appendAudit(tx, {
    ...scope,
    actorUserId: identity.auditActorUserId,
    agentPrincipalId: identity.agentPrincipalId,
    delegatorUserId: identity.delegatorUserId,
    requestId: request.requestId,
    entity: 'company_receipt_pack',
    entityId: input.packId,
    action: `pdf_${input.action}`,
    after: {
      accessPurpose: rendered.accessPurpose,
      snapshotVisibility: rendered.pack.visibility,
      currentVisibility: identity.visibility,
      sourceSha256: rendered.pack.sourceSha256,
      artifactSha256: rendered.sha256,
      rowCount: rendered.pack.rowCount,
      documentCount: rendered.pack.documentCount,
    },
  });
  const metadata = {
    contentType: rendered.mimeType,
    byteLength: rendered.content.byteLength,
    artifactSha256: rendered.sha256,
    sourceSha256: rendered.pack.sourceSha256,
    accessPurpose: rendered.accessPurpose,
  } as const;
  validateAgentActionOutput('receipt_pack.export', metadata);
  return {
    kind: 'binary',
    status: 200,
    action: 'receipt_pack.export',
    version: 1,
    content: rendered.content,
    contentType: rendered.mimeType,
    headers: {
      'Content-Type': rendered.mimeType,
      'Content-Length': String(rendered.content.byteLength),
      'X-Receipt-Pack-SHA256': rendered.sha256,
      'X-Receipt-Pack-Source-SHA256': rendered.pack.sourceSha256,
      'X-Receipt-Pack-Access-Purpose': rendered.accessPurpose,
    },
    metadata,
  };
}

/** Dispatch a pilot action from an existing human session. */
export async function dispatchAgentAction(
  db: DB,
  session: SessionData,
  request: AgentActionDispatchRequest,
): Promise<AgentActionDispatchResult> {
  const contract = getAgentActionContract(request.action);
  switch (contract.name) {
    case 'receipt.search':
      parseAgentActionInput('receipt.search', request.input);
      break;
    case 'receipt.get':
      parseAgentActionInput('receipt.get', request.input);
      break;
    case 'receipt_pack.prepare':
      parseAgentActionInput('receipt_pack.prepare', request.input);
      break;
    case 'receipt_pack.create':
      parseAgentActionInput('receipt_pack.create', request.input);
      break;
    case 'receipt_pack.get':
      parseAgentActionInput('receipt_pack.get', request.input);
      break;
    case 'receipt_pack.export':
      parseAgentActionInput('receipt_pack.export', request.input);
      break;
    default:
      throw new ActionDispatchError(501, 'agent_action_not_ready', 'Agent action is not ready.');
  }

  const scope = { masterFn: session.masterFn, companyFn: session.activeCompanyFn };
  try {
    return await withTenantTransaction(db, scope, async (tx) => {
      const visibility = await resolveReceiptVisibility(tx, session);
      const identity = humanActionIdentity(scope, session, visibility);
      switch (contract.name) {
        case 'receipt.search':
          return dispatchReceiptSearch(
            tx,
            identity,
            parseAgentActionInput('receipt.search', request.input),
          );
        case 'receipt.get':
          return dispatchReceiptGet(
            tx,
            identity,
            parseAgentActionInput('receipt.get', request.input),
          );
        case 'receipt_pack.prepare':
          return dispatchReceiptPackPrepare(
            tx,
            identity,
            parseAgentActionInput('receipt_pack.prepare', request.input),
          );
        case 'receipt_pack.create':
          parseAgentActionInput('receipt_pack.create', request.input);
          throw new ActionDispatchError(
            428,
            'agent_action_confirmation_required',
            'A reviewed, identity-bound approval is required before Receipt Pack creation.',
          );
        case 'receipt_pack.get':
          return dispatchReceiptPackGet(
            tx,
            identity,
            parseAgentActionInput('receipt_pack.get', request.input),
          );
        case 'receipt_pack.export':
          return dispatchReceiptPackExport(
            tx,
            identity,
            request,
            parseAgentActionInput('receipt_pack.export', request.input),
          );
        default:
          throw new ActionDispatchError(501, 'agent_action_not_ready', 'Agent action is not ready.');
      }
    });
  } catch (error) {
    return translateDomainError(error);
  }
}

const EXPORT_PACK_FIELDS = [
  'id', 'packKey', 'visibility', 'locale', 'filters', 'rows', 'totals',
  'sourceSha256', 'rowCount', 'documentCount', 'retentionUntil', 'legalHold',
  'recordVersion', 'createdByUserId', 'createdAt',
] as const;

function requireExportFields(grant: ResolvedAgentGrant): void {
  if (grant.fields.includes('*')) return;
  if (EXPORT_PACK_FIELDS.some((field) => !grant.fields.includes(field))) {
    throw new ActionDispatchError(
      403,
      'agent_field_denied',
      'Receipt Pack export requires an Agent grant for every exported Pack field.',
    );
  }
}

/**
 * Dispatch an action after a separate issuer has authenticated the Agent
 * credential. The issuer-derived tenant is the only transaction scope; the
 * body cannot replace it. ERP rechecks the registered principal, current owner
 * membership, module entitlement, grant window/scope/fields and owner role
 * authority before invoking a domain command.
 */
export async function dispatchAuthenticatedAgentAction(
  db: DB,
  request: AuthenticatedAgentActionRequest,
): Promise<AgentActionDispatchResult> {
  const contract = getAgentActionContract(request.action);
  const parsedInput = parseAgentActionInput(contract.name, request.input);
  const scope = {
    masterFn: request.identity.masterFn,
    companyFn: request.identity.companyFn,
  };
  try {
    const result = await withTenantTransaction(db, scope, async (tx) => {
      if (!await isModuleEnabled(tx, scope.masterFn, scope.companyFn, 'expenses_tax')) {
        throw new ActionDispatchError(
          403,
          'module_not_enabled',
          'The expenses_tax module is not enabled for this Company.',
        );
      }
      const grant = await resolveAgentGrantWithin(tx, scope, {
        agentPrincipalId: request.identity.agentPrincipalId,
        actionName: contract.name,
      });
      if (contract.name === 'receipt_pack.export') requireExportFields(grant);
      const identity = agentActionIdentity(scope, grant);
      return runWithAuditAttribution({
        agentPrincipalId: grant.agentPrincipalId,
        delegatorUserId: grant.ownerUserId,
      }, async () => {
        switch (contract.name) {
          case 'receipt.search':
            return projectAgentResult(
              contract.name,
              await dispatchReceiptSearch(tx, identity, parsedInput as ReceiptSearchInput),
              grant,
            );
          case 'receipt.get':
            return projectAgentResult(
              contract.name,
              await dispatchReceiptGet(tx, identity, parsedInput as ReceiptGetInput),
              grant,
            );
          case 'receipt_pack.prepare':
            return projectAgentResult(
              contract.name,
              await dispatchReceiptPackPrepare(
                tx,
                identity,
                parsedInput as ReceiptPackPrepareInput,
              ),
              grant,
            );
          case 'receipt_pack.create':
            return projectAgentResult(
              contract.name,
              await dispatchReceiptPackCreate(
                tx,
                identity,
                request,
                parsedInput as ReceiptPackCreateInput,
              ),
              grant,
            );
          case 'receipt_pack.get':
            return projectAgentResult(
              contract.name,
              await dispatchReceiptPackGet(tx, identity, parsedInput as ReceiptPackGetInput),
              grant,
            );
          case 'receipt_pack.export':
            return dispatchReceiptPackExport(
              tx,
              identity,
              request,
              parsedInput as ReceiptPackExportInput,
            );
          default:
            throw new ActionDispatchError(501, 'agent_action_not_ready', 'Agent action is not ready.');
        }
      });
    }, contract.name === 'receipt_pack.create'
      ? { isolationLevel: 'serializable' }
      : undefined);
    return result;
  } catch (error) {
    return translateDomainError(error);
  }
}
