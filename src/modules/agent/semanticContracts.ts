import Decimal from 'decimal.js';

/**
 * Versioned, transport-neutral semantic definitions for tenant-facing ERP
 * retrieval. Database reads and authorization remain outside this module;
 * this contract only defines what a bounded, already-authorized receipt fact
 * means and how its deterministic aggregate is calculated.
 */
export const ERP_SEMANTIC_CONTRACT_VERSION = 1 as const;

export type SemanticVisibility = 'own' | 'company';
export type CompanyReceiptSemanticStatus =
  | 'draft'
  | 'processing'
  | 'ready'
  | 'needs_attention'
  | 'voided';

export interface SemanticFieldDefinition {
  readonly field: string;
  readonly owner: 'session' | 'company' | 'company_receipt' | 'managed_document';
  readonly meaning: string;
}

export const COMPANY_RECEIPT_SEMANTIC_CONTRACT = {
  version: ERP_SEMANTIC_CONTRACT_VERSION,
  entity: 'company_receipt',
  sourceTable: 'company_receipt',
  sourceResource: 'expenses/company-receipts',
  supportedQuestions: [
    'How many confirmed Company Receipts are in an inclusive date range?',
    'What is the confirmed Company Receipt total by currency in an inclusive date range?',
  ],
  terms: [
    { term: 'Company Receipt', meaning: 'A Company-owned receipt confirmed from one governed document version.' },
    { term: 'confirmed', meaning: 'A Company Receipt whose status is ready; all other statuses are excluded.' },
    { term: 'date range', meaning: 'The inclusive transactionDate interval [dateFrom, dateTo].' },
    { term: 'total', meaning: 'The sum of amount grouped by currency without FX conversion.' },
    { term: 'source', meaning: 'The receipt, document and document-version identifiers supporting each included row.' },
  ],
  fieldOwnership: [
    { field: 'masterFn', owner: 'session', meaning: 'Derived from the authenticated tenant context.' },
    { field: 'companyFn', owner: 'company', meaning: 'Derived from the authenticated active Company context.' },
    { field: 'timeZone', owner: 'company', meaning: 'The Company IANA timezone used to label the date interpretation.' },
    { field: 'uploaderUserId', owner: 'session', meaning: 'Used for own visibility; never selected from model input.' },
    { field: 'transactionDate', owner: 'company_receipt', meaning: 'Date-only business fact; null dates are excluded from a bounded metric.' },
    { field: 'amount', owner: 'company_receipt', meaning: 'Positive stored decimal amount; no model arithmetic or FX conversion.' },
    { field: 'currencyCode', owner: 'company_receipt', meaning: 'Stored transaction currency; each currency remains a separate total.' },
    { field: 'status', owner: 'company_receipt', meaning: 'Only ready rows are included; voided and non-ready rows are excluded.' },
    { field: 'id', owner: 'company_receipt', meaning: 'Authoritative receipt source identifier.' },
    { field: 'version', owner: 'company_receipt', meaning: 'Receipt version supporting as-of/source freshness checks.' },
    { field: 'documentId', owner: 'managed_document', meaning: 'Governed source document identifier.' },
    { field: 'documentVersionId', owner: 'managed_document', meaning: 'Governed source document-version identifier.' },
  ] satisfies readonly SemanticFieldDefinition[],
  calculation: {
    includedStatus: 'ready' as const,
    dateBoundary: 'inclusive' as const,
    nullDate: 'excluded' as const,
    timezone: 'company.timeZone' as const,
    currency: 'group_without_fx_conversion' as const,
    asOf: 'server_observed_iso_timestamp' as const,
  },
} as const;

export interface CompanyReceiptSemanticScope {
  readonly masterFn: string;
  readonly companyFn: string;
}

export interface CompanyReceiptSemanticQuery {
  /** This scope is server-derived and must never be accepted from model JSON. */
  readonly scope: CompanyReceiptSemanticScope;
  readonly actorUserId: number;
  readonly visibility: SemanticVisibility;
  readonly timeZone: string;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly asOf: Date | string;
}

export interface CompanyReceiptSemanticRow {
  readonly id: number;
  readonly masterFn: string;
  readonly companyFn: string;
  readonly uploaderUserId: number;
  readonly transactionDate: string | null;
  readonly amount: string;
  readonly currencyCode: string;
  readonly status: CompanyReceiptSemanticStatus;
  readonly version: number;
  readonly documentId: number;
  readonly documentVersionId: number;
}

export interface CompanyReceiptSemanticSource {
  readonly receiptId: number;
  readonly receiptVersion: number;
  readonly documentId: number;
  readonly documentVersionId: number;
}

export interface CompanyReceiptSemanticCurrencyTotal {
  readonly currency: string;
  readonly amount: string;
  readonly receiptCount: number;
  readonly sources: readonly CompanyReceiptSemanticSource[];
}

export interface CompanyReceiptSemanticResult {
  readonly contractVersion: typeof ERP_SEMANTIC_CONTRACT_VERSION;
  readonly entity: 'company_receipt';
  readonly evidence: {
    readonly type: 'transaction_fact';
    readonly status: 'grounded';
    readonly inference: false;
  };
  readonly scope: CompanyReceiptSemanticScope & { readonly visibility: SemanticVisibility };
  readonly period: {
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly inclusive: true;
    readonly timeZone: string;
  };
  readonly status: {
    readonly included: readonly ['ready'];
    readonly excluded: readonly ['draft', 'processing', 'needs_attention', 'voided'];
    readonly nullDate: 'excluded';
  };
  readonly asOf: string;
  readonly receiptCount: number;
  readonly totalsByCurrency: readonly CompanyReceiptSemanticCurrencyTotal[];
  readonly sources: readonly CompanyReceiptSemanticSource[];
}

export type SemanticContractErrorCode = 'semantic_query_invalid' | 'semantic_source_invalid';

export class SemanticContractError extends Error {
  constructor(
    public readonly code: SemanticContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SemanticContractError';
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const STATUS_VALUES = new Set<CompanyReceiptSemanticStatus>([
  'draft', 'processing', 'ready', 'needs_attention', 'voided',
]);

function invalidQuery(message: string): never {
  throw new SemanticContractError('semantic_query_invalid', message);
}

function invalidSource(message: string): never {
  throw new SemanticContractError('semantic_source_invalid', message);
}

function assertDate(value: string, field: string): void {
  if (!DATE_PATTERN.test(value)) invalidQuery(`${field} must use YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    invalidQuery(`${field} is not a valid calendar date.`);
  }
}

function normalizeQuery(query: CompanyReceiptSemanticQuery): {
  readonly asOf: string;
} {
  if (!query.scope.masterFn.trim() || !query.scope.companyFn.trim()) {
    invalidQuery('A server-derived Master and Company scope is required.');
  }
  if (!Number.isSafeInteger(query.actorUserId) || query.actorUserId <= 0) {
    invalidQuery('A positive authenticated actor user ID is required.');
  }
  if (!['own', 'company'].includes(query.visibility)) {
    invalidQuery('Visibility must be own or company.');
  }
  if (!query.timeZone.trim()) invalidQuery('The Company timezone is required.');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: query.timeZone }).format();
  } catch {
    invalidQuery('The Company timezone must be a valid IANA timezone.');
  }
  assertDate(query.dateFrom, 'dateFrom');
  assertDate(query.dateTo, 'dateTo');
  if (query.dateFrom > query.dateTo) invalidQuery('dateFrom cannot be after dateTo.');
  const asOf = query.asOf instanceof Date ? query.asOf : new Date(query.asOf);
  if (Number.isNaN(asOf.getTime())) invalidQuery('asOf must be a valid timestamp.');
  return { asOf: asOf.toISOString() };
}

export function validateCompanyReceiptSemanticQuery(
  query: CompanyReceiptSemanticQuery,
): string {
  return normalizeQuery(query).asOf;
}

function assertSourceId(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) invalidSource(`${field} must be a positive integer.`);
}

function normalizeSource(row: CompanyReceiptSemanticRow): CompanyReceiptSemanticSource {
  assertSourceId(row.id, 'receipt id');
  assertSourceId(row.version, 'receipt version');
  assertSourceId(row.documentId, 'document id');
  assertSourceId(row.documentVersionId, 'document version id');
  return {
    receiptId: row.id,
    receiptVersion: row.version,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
  };
}

/**
 * Deterministically aggregates rows that have already been selected from the
 * tenant boundary. The repeated scope/visibility check is intentional defense
 * in depth and gives S1 a testable contract before S2 owns the SQL read.
 */
export function summarizeCompanyReceipts(
  rows: readonly CompanyReceiptSemanticRow[],
  query: CompanyReceiptSemanticQuery,
): CompanyReceiptSemanticResult {
  const asOf = validateCompanyReceiptSemanticQuery(query);
  const included: Array<{ row: CompanyReceiptSemanticRow; source: CompanyReceiptSemanticSource; amount: Decimal }> = [];
  for (const row of rows) {
    if (row.masterFn !== query.scope.masterFn || row.companyFn !== query.scope.companyFn) continue;
    if (query.visibility === 'own' && row.uploaderUserId !== query.actorUserId) continue;
    if (!STATUS_VALUES.has(row.status)) invalidSource(`Unknown Company Receipt status: ${row.status}.`);
    if (row.status !== COMPANY_RECEIPT_SEMANTIC_CONTRACT.calculation.includedStatus) continue;
    if (row.transactionDate == null) continue;
    assertDate(row.transactionDate, 'transactionDate');
    if (row.transactionDate < query.dateFrom || row.transactionDate > query.dateTo) continue;
    const amount = new Decimal(row.amount);
    if (!amount.isFinite() || amount.lte(0) || amount.decimalPlaces() > 4) {
      invalidSource(`Receipt ${row.id} has an invalid stored amount.`);
    }
    if (!CURRENCY_PATTERN.test(row.currencyCode)) {
      invalidSource(`Receipt ${row.id} has an invalid stored currency.`);
    }
    included.push({ row, source: normalizeSource(row), amount });
  }

  included.sort((left, right) => left.row.id - right.row.id);
  const totals = new Map<string, {
    amount: Decimal;
    receiptCount: number;
    sources: CompanyReceiptSemanticSource[];
  }>();
  for (const item of included) {
    const total = totals.get(item.row.currencyCode) ?? {
      amount: new Decimal(0), receiptCount: 0, sources: [],
    };
    total.amount = total.amount.plus(item.amount);
    total.receiptCount += 1;
    total.sources.push(item.source);
    totals.set(item.row.currencyCode, total);
  }

  return {
    contractVersion: ERP_SEMANTIC_CONTRACT_VERSION,
    entity: 'company_receipt',
    evidence: {
      type: 'transaction_fact',
      status: 'grounded',
      inference: false,
    },
    scope: { ...query.scope, visibility: query.visibility },
    period: {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      inclusive: true,
      timeZone: query.timeZone,
    },
    status: {
      included: ['ready'],
      excluded: ['draft', 'processing', 'needs_attention', 'voided'],
      nullDate: 'excluded',
    },
    asOf,
    receiptCount: included.length,
    totalsByCurrency: [...totals.entries()].sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, total]) => ({
        currency,
        amount: total.amount.toFixed(4),
        receiptCount: total.receiptCount,
        sources: total.sources,
      })),
    sources: included.map((item) => item.source),
  };
}
