/**
 * Versioned, transport-neutral contracts for the AI Native ERP pilot actions.
 *
 * This module deliberately contains no session, tenant, database, or approval
 * implementation. It describes the boundary that an authenticated adapter may
 * use; authority is always derived from the session by the shared dispatcher.
 */

export const AGENT_ACTION_CONTRACT_VERSION = 1 as const;

const AGENT_ACTION_NAMES = [
  'receipt.search',
  'receipt.get',
  'receipt_pack.prepare',
  'receipt_pack.create',
  'receipt_pack.get',
  'receipt_pack.export',
] as const;

export type AgentActionName = typeof AGENT_ACTION_NAMES[number];
export type AgentActionEffect = 'read' | 'prepare' | 'write' | 'export';
export type AgentActionClass =
  | 'read'
  | 'draft'
  | 'confirmed_execution'
  | 'approval_required_execution';
export type AgentActionConfirmationAuthority =
  | 'none'
  | 'active_human_session'
  | 'existing_business_approval_authority';
export type AgentActionMutationBoundary =
  | 'none'
  | 'receipt_pack_snapshot'
  | 'existing_business_command';
export type AgentActionAuthorization =
  | 'read_only'
  | 'read_only_non_authorizing'
  | 'confirmation_required';
export type AgentActionAvailability = 'current_route' | 'contract_only';

type AgentJsonPrimitive = string | number | boolean | null;

export interface AgentJsonSchema {
  readonly type: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean';
  readonly properties?: Readonly<Record<string, AgentJsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: AgentJsonSchema;
  readonly enum?: readonly AgentJsonPrimitive[];
  readonly format?: 'date' | 'date-time' | 'sha256' | 'decimal' | 'currency';
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly nullable?: boolean;
}

export interface AgentActionPermissionContract {
  readonly anyOf: readonly string[];
  readonly scope: 'authenticated_session_active_company';
}

export interface AgentActionPaginationContract {
  readonly style: 'keyset';
  readonly requestField: 'afterId';
  readonly responseField: 'nextCursor';
  readonly maxPageSize: number;
}

export interface AgentActionIdempotencyContract {
  readonly mode: 'not_applicable' | 'required';
  readonly keyField?: 'packKey';
  readonly scope?: 'active_company_actor';
  readonly replayable?: boolean;
  readonly replayResultField?: 'replayed';
  readonly conflictCode?: string;
}

export interface AgentJsonOutputContract {
  readonly transport: 'json';
  readonly schema: AgentJsonSchema;
}

export interface AgentBinaryOutputContract {
  readonly transport: 'binary';
  readonly contentType: 'application/pdf';
  /** Normalized metadata used by an adapter after it receives the binary body. */
  readonly schema: AgentJsonSchema;
  readonly headers: Readonly<Record<string, string>>;
}

export type AgentActionOutputContract = AgentJsonOutputContract | AgentBinaryOutputContract;

export interface AgentActionContract {
  readonly name: AgentActionName;
  readonly version: typeof AGENT_ACTION_CONTRACT_VERSION;
  readonly availability: AgentActionAvailability;
  readonly description: string;
  readonly permissions: AgentActionPermissionContract;
  readonly prerequisites: readonly string[];
  readonly effect: AgentActionEffect;
  /** Server-owned policy class; adapters cannot promote an action by payload. */
  readonly actionClass: AgentActionClass;
  readonly confirmationAuthority: AgentActionConfirmationAuthority;
  readonly mutationBoundary: AgentActionMutationBoundary;
  readonly authorization: AgentActionAuthorization;
  readonly sideEffects: readonly string[];
  readonly pagination: AgentActionPaginationContract | null;
  readonly idempotency: AgentActionIdempotencyContract;
  readonly input: AgentJsonSchema;
  readonly output: AgentActionOutputContract;
  readonly errorCodes: readonly string[];
}

export interface AgentActionInputMap {
  'receipt.search': {
    readonly limit?: number;
    readonly afterId?: number;
    readonly search?: string;
    readonly dateFrom?: string;
    readonly dateTo?: string;
  };
  'receipt.get': {
    readonly receiptId: number;
  };
  'receipt_pack.prepare': {
    readonly search?: string;
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly locale?: 'en' | 'ms' | 'zh' | 'ja' | 'vi';
  };
  'receipt_pack.create': {
    readonly packKey: string;
    readonly search?: string;
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly locale?: 'en' | 'ms' | 'zh' | 'ja' | 'vi';
    readonly executionIntentId?: number;
    readonly executionIntentKey?: string;
    readonly selectionDigest?: string;
    readonly payloadDigest?: string;
  };
  'receipt_pack.get': {
    readonly packId: number;
  };
  'receipt_pack.export': {
    readonly packId: number;
    readonly action: 'view' | 'download' | 'print';
  };
}

export type AgentActionInput<T extends AgentActionName = AgentActionName> = AgentActionInputMap[T];

export type AgentActionContractErrorCode =
  | 'agent_action_unknown'
  | 'agent_action_input_invalid'
  | 'tenant_scope_is_session_derived'
  | 'agent_action_output_invalid';

export class AgentActionContractError extends Error {
  constructor(
    public readonly code: AgentActionContractErrorCode,
    message: string,
    public readonly path = '$',
  ) {
    super(message);
    this.name = 'AgentActionContractError';
  }
}

const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';
const SHA256_PATTERN = '^[a-f0-9]{64}$';
const DECIMAL_PATTERN = '^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$';

const DATE_SCHEMA: AgentJsonSchema = {
  type: 'string',
  format: 'date',
  pattern: DATE_PATTERN,
};
const DATETIME_SCHEMA: AgentJsonSchema = {
  type: 'string',
  format: 'date-time',
};
const ID_SCHEMA: AgentJsonSchema = {
  type: 'integer',
  minimum: 1,
};
const SHA256_SCHEMA: AgentJsonSchema = {
  type: 'string',
  format: 'sha256',
  pattern: SHA256_PATTERN,
};
const DECIMAL_SCHEMA: AgentJsonSchema = {
  type: 'string',
  format: 'decimal',
  pattern: DECIMAL_PATTERN,
};
const CURRENCY_SCHEMA: AgentJsonSchema = {
  type: 'string',
  format: 'currency',
  pattern: '^[A-Z]{3}$',
};

function nullableSchema(schema: AgentJsonSchema): AgentJsonSchema {
  return { ...schema, nullable: true };
}

function objectSchema(
  properties: Record<string, AgentJsonSchema>,
  required: readonly string[],
): AgentJsonSchema {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

const LOCALE_SCHEMA: AgentJsonSchema = {
  type: 'string',
  enum: ['en', 'ms', 'zh', 'ja', 'vi'],
};

const RECEIPT_SEARCH_INPUT_SCHEMA = objectSchema({
  limit: { type: 'integer', minimum: 1, maximum: 100 },
  afterId: ID_SCHEMA,
  search: { type: 'string', maxLength: 200 },
  dateFrom: DATE_SCHEMA,
  dateTo: DATE_SCHEMA,
}, []);

const RECEIPT_GET_INPUT_SCHEMA = objectSchema({
  receiptId: ID_SCHEMA,
}, ['receiptId']);

const RECEIPT_PACK_PREPARE_INPUT_SCHEMA = objectSchema({
  search: { type: 'string', maxLength: 200 },
  dateFrom: DATE_SCHEMA,
  dateTo: DATE_SCHEMA,
  locale: LOCALE_SCHEMA,
}, ['dateFrom', 'dateTo']);

const RECEIPT_PACK_CREATE_INPUT_SCHEMA = objectSchema({
  packKey: {
    type: 'string',
    minLength: 8,
    maxLength: 128,
    pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$',
  },
  search: { type: 'string', maxLength: 200 },
  dateFrom: DATE_SCHEMA,
  dateTo: DATE_SCHEMA,
  locale: LOCALE_SCHEMA,
  executionIntentId: ID_SCHEMA,
  executionIntentKey: {
    type: 'string',
    minLength: 16,
    maxLength: 200,
  },
  selectionDigest: SHA256_SCHEMA,
  payloadDigest: SHA256_SCHEMA,
}, ['packKey', 'dateFrom', 'dateTo']);

const RECEIPT_PACK_GET_INPUT_SCHEMA = objectSchema({
  packId: ID_SCHEMA,
}, ['packId']);

const RECEIPT_PACK_EXPORT_INPUT_SCHEMA = objectSchema({
  packId: ID_SCHEMA,
  action: { type: 'string', enum: ['view', 'download', 'print'] },
}, ['packId', 'action']);

const RECEIPT_SCHEMA = objectSchema({
  id: ID_SCHEMA,
  receiptKey: { type: 'string', minLength: 1 },
  documentId: ID_SCHEMA,
  documentVersionId: ID_SCHEMA,
  documentVersionNo: ID_SCHEMA,
  documentSha256: SHA256_SCHEMA,
  evidenceSha256: SHA256_SCHEMA,
  originalFileName: { type: 'string', minLength: 1 },
  uploaderUserId: ID_SCHEMA,
  uploaderName: { type: 'string', minLength: 1 },
  transactionDate: nullableSchema(DATE_SCHEMA),
  merchant: { type: 'string', minLength: 1 },
  receiptNumber: nullableSchema({ type: 'string' }),
  amount: DECIMAL_SCHEMA,
  currency: CURRENCY_SCHEMA,
  category: { type: 'string', minLength: 1 },
  businessPurpose: { type: 'string', minLength: 1 },
  notes: nullableSchema({ type: 'string' }),
  status: { type: 'string', minLength: 1 },
  version: ID_SCHEMA,
  voidReason: nullableSchema({ type: 'string' }),
  voidedAt: nullableSchema(DATETIME_SCHEMA),
  voidedByUserId: nullableSchema(ID_SCHEMA),
  createdAt: DATETIME_SCHEMA,
  updatedAt: DATETIME_SCHEMA,
}, []);

const RECEIPT_FILTERS_SCHEMA = objectSchema({
  search: { type: 'string' },
  dateFrom: nullableSchema(DATE_SCHEMA),
  dateTo: nullableSchema(DATE_SCHEMA),
}, ['search', 'dateFrom', 'dateTo']);

const RECEIPT_ACTIONS_SCHEMA = objectSchema({
  create: { type: 'boolean' },
  edit: { type: 'boolean' },
  void: { type: 'boolean' },
}, ['create', 'edit', 'void']);

const RECEIPT_SEARCH_OUTPUT_SCHEMA = objectSchema({
  data: { type: 'array', items: RECEIPT_SCHEMA },
  meta: objectSchema({
    scope: { type: 'string', enum: ['own', 'company'] },
    actorUserId: ID_SCHEMA,
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    nextCursor: nullableSchema(ID_SCHEMA),
    filters: RECEIPT_FILTERS_SCHEMA,
    actions: RECEIPT_ACTIONS_SCHEMA,
  }, ['scope', 'actorUserId', 'limit', 'nextCursor', 'filters', 'actions']),
}, ['data', 'meta']);

const RECEIPT_GET_OUTPUT_SCHEMA = objectSchema({
  data: RECEIPT_SCHEMA,
  meta: objectSchema({
    scope: { type: 'string', enum: ['own', 'company'] },
  }, ['scope']),
}, ['data', 'meta']);

const PACK_FILTERS_SCHEMA = objectSchema({
  search: { type: 'string' },
  dateFrom: DATE_SCHEMA,
  dateTo: DATE_SCHEMA,
}, ['search', 'dateFrom', 'dateTo']);

const PACK_ROW_SCHEMA = objectSchema({
  receiptId: ID_SCHEMA,
  receiptVersion: ID_SCHEMA,
  transactionDate: DATE_SCHEMA,
  merchant: { type: 'string', minLength: 1 },
  receiptNumber: nullableSchema({ type: 'string' }),
  category: { type: 'string', minLength: 1 },
  businessPurpose: { type: 'string', minLength: 1 },
  notes: nullableSchema({ type: 'string' }),
  amount: DECIMAL_SCHEMA,
  currency: CURRENCY_SCHEMA,
  uploaderUserId: ID_SCHEMA,
  uploaderName: { type: 'string', minLength: 1 },
  documentId: ID_SCHEMA,
  documentVersionId: ID_SCHEMA,
  documentSha256: SHA256_SCHEMA,
  originalFileName: { type: 'string', minLength: 1 },
}, []);

const PACK_TOTAL_SCHEMA = objectSchema({
  currency: CURRENCY_SCHEMA,
  amount: DECIMAL_SCHEMA,
  receiptCount: { type: 'integer', minimum: 1 },
}, ['currency', 'amount', 'receiptCount']);

const PACK_SCHEMA = objectSchema({
  id: ID_SCHEMA,
  packKey: { type: 'string', minLength: 8 },
  visibility: { type: 'string', enum: ['own', 'company'] },
  locale: LOCALE_SCHEMA,
  filters: PACK_FILTERS_SCHEMA,
  rows: { type: 'array', items: PACK_ROW_SCHEMA, maxItems: 5000 },
  totals: { type: 'array', items: PACK_TOTAL_SCHEMA },
  sourceSha256: SHA256_SCHEMA,
  rowCount: { type: 'integer', minimum: 1, maximum: 5000 },
  documentCount: { type: 'integer', minimum: 1, maximum: 5000 },
  retentionUntil: DATETIME_SCHEMA,
  legalHold: { type: 'boolean' },
  recordVersion: ID_SCHEMA,
  createdByUserId: ID_SCHEMA,
  createdAt: DATETIME_SCHEMA,
}, []);

const PACK_CREATE_OUTPUT_SCHEMA = objectSchema({
  data: objectSchema({
    pack: PACK_SCHEMA,
    replayed: { type: 'boolean' },
  }, ['pack', 'replayed']),
  meta: objectSchema({
    immutableSnapshot: { type: 'boolean' },
    completeResult: { type: 'boolean' },
    missingDatesExcluded: { type: 'boolean' },
    currencyTotalsSeparated: { type: 'boolean' },
  }, ['immutableSnapshot', 'completeResult', 'missingDatesExcluded', 'currencyTotalsSeparated']),
}, ['data', 'meta']);

const PACK_GET_OUTPUT_SCHEMA = objectSchema({
  data: PACK_SCHEMA,
  meta: objectSchema({
    immutableSnapshot: { type: 'boolean' },
    completeResult: { type: 'boolean' },
    accessVisibility: { type: 'string', enum: ['own', 'company'] },
  }, ['immutableSnapshot', 'completeResult', 'accessVisibility']),
}, ['data', 'meta']);

const PACK_PREPARE_OUTPUT_SCHEMA = objectSchema({
  data: objectSchema({
    selectionDigest: SHA256_SCHEMA,
    visibility: { type: 'string', enum: ['own', 'company'] },
    filters: PACK_FILTERS_SCHEMA,
    rows: { type: 'array', items: PACK_ROW_SCHEMA, maxItems: 5000 },
    totals: { type: 'array', items: PACK_TOTAL_SCHEMA },
    rowCount: { type: 'integer', minimum: 1, maximum: 5000 },
    documentCount: { type: 'integer', minimum: 1, maximum: 5000 },
    preparedAt: DATETIME_SCHEMA,
  }, []),
  meta: objectSchema({
    preparationOnly: { type: 'boolean', enum: [true] },
    authorizationRequired: { type: 'boolean', enum: [true] },
    completeResult: { type: 'boolean', enum: [true] },
  }, ['preparationOnly', 'authorizationRequired', 'completeResult']),
}, ['data', 'meta']);

const PACK_EXPORT_OUTPUT_SCHEMA = objectSchema({
  contentType: { type: 'string', enum: ['application/pdf'] },
  byteLength: { type: 'integer', minimum: 1 },
  artifactSha256: SHA256_SCHEMA,
  sourceSha256: SHA256_SCHEMA,
  accessPurpose: {
    type: 'string',
    enum: ['receipt_pack_preview', 'receipt_pack_original_evidence_export'],
  },
}, ['contentType', 'byteLength', 'artifactSha256', 'sourceSha256', 'accessPurpose']);

const READ_PERMISSIONS = [
  'expenses.company_receipts.read_company',
  'expenses.company_receipts.read_own',
] as const;

const PACK_SIDE_EFFECTS = [
  'immutable_snapshot_read',
  'source_identity_rechecked',
  'currency_totals_remain_separate',
] as const;

const COMMON_AGENT_ERROR_CODES = [
  'not_authenticated',
  'activation_required',
  'authorization_state_stale',
  'agent_action_input_invalid',
  'tenant_scope_is_session_derived',
  'permission_denied',
] as const;

export const AGENT_ACTION_CONTRACTS: Readonly<Record<AgentActionName, AgentActionContract>> = {
  'receipt.search': {
    name: 'receipt.search',
    version: AGENT_ACTION_CONTRACT_VERSION,
    availability: 'current_route',
    description: 'Search Company Receipts within the authenticated active Company scope.',
    permissions: { anyOf: READ_PERMISSIONS, scope: 'authenticated_session_active_company' },
    prerequisites: ['authenticated_session', 'active_company', 'receipt_read_permission'],
    effect: 'read',
    actionClass: 'read',
    confirmationAuthority: 'none',
    mutationBoundary: 'none',
    authorization: 'read_only',
    sideEffects: ['read_only_transaction', 'no_business_write'],
    pagination: {
      style: 'keyset',
      requestField: 'afterId',
      responseField: 'nextCursor',
      maxPageSize: 100,
    },
    idempotency: { mode: 'not_applicable' },
    input: RECEIPT_SEARCH_INPUT_SCHEMA,
    output: { transport: 'json', schema: RECEIPT_SEARCH_OUTPUT_SCHEMA },
    errorCodes: [
      ...COMMON_AGENT_ERROR_CODES,
      'company_receipt_query_invalid',
    ],
  },
  'receipt.get': {
    name: 'receipt.get',
    version: AGENT_ACTION_CONTRACT_VERSION,
    availability: 'current_route',
    description: 'Read one authorized Company Receipt projection.',
    permissions: { anyOf: READ_PERMISSIONS, scope: 'authenticated_session_active_company' },
    prerequisites: ['authenticated_session', 'active_company', 'receipt_read_permission'],
    effect: 'read',
    actionClass: 'read',
    confirmationAuthority: 'none',
    mutationBoundary: 'none',
    authorization: 'read_only',
    sideEffects: ['read_only_transaction', 'no_business_write'],
    pagination: null,
    idempotency: { mode: 'not_applicable' },
    input: RECEIPT_GET_INPUT_SCHEMA,
    output: { transport: 'json', schema: RECEIPT_GET_OUTPUT_SCHEMA },
    errorCodes: [
      ...COMMON_AGENT_ERROR_CODES,
      'company_receipt_id_invalid',
      'company_receipt_not_found',
    ],
  },
  'receipt_pack.prepare': {
    name: 'receipt_pack.prepare',
    version: AGENT_ACTION_CONTRACT_VERSION,
    availability: 'contract_only',
    description: 'Prepare a bounded, read-only Receipt Pack selection and digest.',
    permissions: { anyOf: READ_PERMISSIONS, scope: 'authenticated_session_active_company' },
    prerequisites: [
      'authenticated_session',
      'active_company',
      'receipt_read_permission',
      'ready_dated_clean_evidence',
    ],
    effect: 'prepare',
    actionClass: 'draft',
    confirmationAuthority: 'none',
    mutationBoundary: 'none',
    authorization: 'read_only_non_authorizing',
    sideEffects: ['read_only_transaction', 'no_pack_write', 'no_approval_grant'],
    pagination: null,
    idempotency: { mode: 'not_applicable' },
    input: RECEIPT_PACK_PREPARE_INPUT_SCHEMA,
    output: { transport: 'json', schema: PACK_PREPARE_OUTPUT_SCHEMA },
    errorCodes: [
      ...COMMON_AGENT_ERROR_CODES,
      'company_receipt_pack_date_invalid',
      'company_receipt_pack_range_invalid',
      'company_receipt_pack_empty',
      'company_receipt_pack_limit_exceeded',
    ],
  },
  'receipt_pack.create': {
    name: 'receipt_pack.create',
    version: AGENT_ACTION_CONTRACT_VERSION,
    availability: 'current_route',
    description: 'Create or replay an immutable Company Receipt Pack snapshot.',
    permissions: { anyOf: READ_PERMISSIONS, scope: 'authenticated_session_active_company' },
    prerequisites: [
      'authenticated_session',
      'active_company',
      'receipt_read_permission',
      'reviewed_prepare_result',
      'approval_required_by_confirmation_dispatch',
    ],
    effect: 'write',
    actionClass: 'confirmed_execution',
    confirmationAuthority: 'active_human_session',
    mutationBoundary: 'receipt_pack_snapshot',
    authorization: 'confirmation_required',
    sideEffects: [
      'immutable_pack_snapshot_write',
      'append_only_audit',
      'source_rows_frozen_in_transaction',
      'currency_totals_remain_separate',
    ],
    pagination: null,
    idempotency: {
      mode: 'required',
      keyField: 'packKey',
      scope: 'active_company_actor',
      replayable: true,
      replayResultField: 'replayed',
      conflictCode: 'company_receipt_pack_key_conflict',
    },
    input: RECEIPT_PACK_CREATE_INPUT_SCHEMA,
    output: { transport: 'json', schema: PACK_CREATE_OUTPUT_SCHEMA },
    errorCodes: [
      ...COMMON_AGENT_ERROR_CODES,
      'company_receipt_pack_key_invalid',
      'company_receipt_pack_date_invalid',
      'company_receipt_pack_range_invalid',
      'company_receipt_pack_empty',
      'company_receipt_pack_limit_exceeded',
      'company_receipt_pack_key_conflict',
      'company_receipt_pack_conflict_unresolved',
      'company_receipt_pack_key_purged',
      'agent_action_confirmation_required',
      'agent_execution_intent_required',
      'agent_execution_intent_not_approved',
      'agent_execution_intent_stale',
      'agent_execution_intent_expired',
      'agent_execution_intent_digest_mismatch',
    ],
  },
  'receipt_pack.get': {
    name: 'receipt_pack.get',
    version: AGENT_ACTION_CONTRACT_VERSION,
    availability: 'current_route',
    description: 'Read an authorized immutable Company Receipt Pack snapshot.',
    permissions: { anyOf: READ_PERMISSIONS, scope: 'authenticated_session_active_company' },
    prerequisites: [
      'authenticated_session',
      'active_company',
      'receipt_read_permission',
      'pack_snapshot_exists',
      'snapshot_visibility_still_authorized',
    ],
    effect: 'read',
    actionClass: 'read',
    confirmationAuthority: 'none',
    mutationBoundary: 'none',
    authorization: 'read_only',
    sideEffects: PACK_SIDE_EFFECTS,
    pagination: null,
    idempotency: { mode: 'not_applicable' },
    input: RECEIPT_PACK_GET_INPUT_SCHEMA,
    output: { transport: 'json', schema: PACK_GET_OUTPUT_SCHEMA },
    errorCodes: [
      ...COMMON_AGENT_ERROR_CODES,
      'company_receipt_pack_id_invalid',
      'company_receipt_pack_not_found',
    ],
  },
  'receipt_pack.export': {
    name: 'receipt_pack.export',
    version: AGENT_ACTION_CONTRACT_VERSION,
    availability: 'current_route',
    description: 'Render an authorized immutable Company Receipt Pack as PDF.',
    permissions: { anyOf: READ_PERMISSIONS, scope: 'authenticated_session_active_company' },
    prerequisites: [
      'authenticated_session',
      'active_company',
      'receipt_read_permission',
      'pack_snapshot_exists',
      'snapshot_visibility_still_authorized',
      'source_identity_unchanged',
      'clean_document_scan',
      'storage_integrity_verified',
    ],
    effect: 'export',
    actionClass: 'read',
    confirmationAuthority: 'none',
    mutationBoundary: 'none',
    authorization: 'read_only',
    sideEffects: [
      'append_only_export_audit',
      'source_identity_rechecked',
      'artifact_and_source_digests_returned_separately',
    ],
    pagination: null,
    idempotency: { mode: 'not_applicable' },
    input: RECEIPT_PACK_EXPORT_INPUT_SCHEMA,
    output: {
      transport: 'binary',
      contentType: 'application/pdf',
      schema: PACK_EXPORT_OUTPUT_SCHEMA,
      headers: {
        artifactSha256: 'X-Receipt-Pack-SHA256',
        sourceSha256: 'X-Receipt-Pack-Source-SHA256',
        accessPurpose: 'X-Receipt-Pack-Access-Purpose',
      },
    },
    errorCodes: [
      ...COMMON_AGENT_ERROR_CODES,
      'company_receipt_pack_id_invalid',
      'company_receipt_pack_not_found',
      'company_receipt_pack_source_changed',
      'company_receipt_pack_source_unavailable',
      'document_quarantined',
      'document_content_missing',
      'document_content_unavailable',
      'document_integrity_failed',
      'document_storage_backend_unavailable',
    ],
  },
};

const FORBIDDEN_AUTHORITY_KEYS = new Set([
  'masterfn',
  'companyfn',
  'masterid',
  'companyid',
  'tenantid',
  'tenant',
  'company',
  'actor',
  'actoruserid',
  'userid',
  'owneruserid',
  'sessionid',
  'principalid',
  'permission',
  'permissions',
  'role',
  'roles',
  'scope',
  'visibility',
  'authorization',
  'auth',
  'delegation',
  'delegatedby',
]);

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function forbiddenAuthorityPath(value: unknown): string | null {
  const visited = new WeakSet<object>();

  function visit(current: unknown, path: string): string | null {
    if (typeof current !== 'object' || current === null) return null;
    if (visited.has(current)) return null;
    visited.add(current);
    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) {
        const found = visit(current[index], `${path}[${index}]`);
        if (found) return found;
      }
      return null;
    }
    if (!isPlainObject(current)) return null;
    for (const [key, nested] of Object.entries(current)) {
      const keyPath = `${path}.${key}`;
      if (FORBIDDEN_AUTHORITY_KEYS.has(normalizedKey(key))) return keyPath;
      const found = visit(nested, keyPath);
      if (found) return found;
    }
    return null;
  }

  return visit(value, '$');
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function failValidation(
  mode: 'input' | 'output',
  path: string,
  message: string,
): never {
  throw new AgentActionContractError(
    mode === 'input' ? 'agent_action_input_invalid' : 'agent_action_output_invalid',
    `${path}: ${message}`,
    path,
  );
}

function assertJsonSchema(
  schema: AgentJsonSchema,
  value: unknown,
  path: string,
  mode: 'input' | 'output',
): void {
  if (value === null) {
    if (schema.nullable) return;
    failValidation(mode, path, 'null is not allowed');
  }

  if (schema.enum && !schema.enum.some((candidate) => candidate === value)) {
    failValidation(mode, path, 'value is outside the allowed enum');
  }

  switch (schema.type) {
    case 'object': {
      if (!isPlainObject(value)) failValidation(mode, path, 'expected an object');
      const properties = schema.properties ?? {};
      for (const required of schema.required ?? []) {
        if (!(required in value)) failValidation(mode, `${path}.${required}`, 'field is required');
      }
      for (const [key, nested] of Object.entries(value)) {
        const propertySchema = properties[key];
        if (!propertySchema) {
          if (schema.additionalProperties === false) {
            failValidation(mode, `${path}.${key}`, 'unknown field is not allowed');
          }
          continue;
        }
        assertJsonSchema(propertySchema, nested, `${path}.${key}`, mode);
      }
      return;
    }
    case 'array': {
      if (!Array.isArray(value)) failValidation(mode, path, 'expected an array');
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        failValidation(mode, path, `must contain at least ${schema.minItems} item(s)`);
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        failValidation(mode, path, `must contain at most ${schema.maxItems} item(s)`);
      }
      if (schema.items) {
        for (let index = 0; index < value.length; index += 1) {
          assertJsonSchema(schema.items, value[index], `${path}[${index}]`, mode);
        }
      }
      return;
    }
    case 'string': {
      if (typeof value !== 'string') failValidation(mode, path, 'expected a string');
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        failValidation(mode, path, `must contain at least ${schema.minLength} character(s)`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        failValidation(mode, path, `must contain at most ${schema.maxLength} character(s)`);
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        failValidation(mode, path, 'does not match the required format');
      }
      if (schema.format === 'date' && !isValidDateOnly(value)) {
        failValidation(mode, path, 'must be a valid calendar date');
      }
      if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) {
        failValidation(mode, path, 'must be a valid date-time');
      }
      return;
    }
    case 'integer': {
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
        failValidation(mode, path, 'expected a safe integer');
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        failValidation(mode, path, `must be at least ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        failValidation(mode, path, `must be at most ${schema.maximum}`);
      }
      return;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        failValidation(mode, path, 'expected a finite number');
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        failValidation(mode, path, `must be at least ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        failValidation(mode, path, `must be at most ${schema.maximum}`);
      }
      return;
    }
    case 'boolean':
      if (typeof value !== 'boolean') failValidation(mode, path, 'expected a boolean');
      return;
    default:
      failValidation(mode, path, 'schema type is not supported');
  }
}

function assertDateRange(value: unknown, mode: 'input' | 'output'): void {
  if (!isPlainObject(value)) return;
  const dateFrom = value.dateFrom;
  const dateTo = value.dateTo;
  if (typeof dateFrom === 'string' && typeof dateTo === 'string' && dateFrom > dateTo) {
    failValidation(mode, '$.dateFrom', 'must be on or before dateTo');
  }
}

export function listAgentActionContracts(): readonly AgentActionContract[] {
  return AGENT_ACTION_NAMES.map((name) => AGENT_ACTION_CONTRACTS[name]);
}

export function getAgentActionContract(action: string): AgentActionContract {
  if (!Object.prototype.hasOwnProperty.call(AGENT_ACTION_CONTRACTS, action)) {
    throw new AgentActionContractError(
      'agent_action_unknown',
      `Unknown AI Native ERP action: ${action}`,
    );
  }
  return AGENT_ACTION_CONTRACTS[action as AgentActionName];
}

export function parseAgentActionInput<T extends AgentActionName>(
  action: T,
  input: unknown,
): AgentActionInputMap[T];
export function parseAgentActionInput(action: string, input: unknown): unknown;
export function parseAgentActionInput(action: string, input: unknown): unknown {
  const contract = getAgentActionContract(action);
  const forbiddenPath = forbiddenAuthorityPath(input);
  if (forbiddenPath) {
    throw new AgentActionContractError(
      'tenant_scope_is_session_derived',
      `${forbiddenPath}: tenant and actor authority must come from the authenticated session`,
      forbiddenPath,
    );
  }
  assertJsonSchema(contract.input, input, '$', 'input');
  assertDateRange(input, 'input');
  return input;
}

export function validateAgentActionOutput(action: string, output: unknown): void {
  const contract = getAgentActionContract(action);
  assertJsonSchema(contract.output.schema, output, '$', 'output');
}
