import { and, asc, eq, gt } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  account,
  glEntry,
  goodsReceipt,
  invoice,
  opportunity,
  product,
  purchaseOrder,
  salesOrder,
  stockLevel,
  stockMovement,
  supplier,
  supplierInvoice,
} from '../data/schema';

export interface ApiScope {
  masterFn: string;
  companyFn: string;
}

export interface ResourceQuery {
  cursor?: unknown;
  limit?: unknown;
  sort?: unknown;
  status?: unknown;
  companyFn?: unknown;
  [key: string]: unknown;
}

interface ResourceDefinition {
  table: any;
  readPermission: string;
  status?: any;
}

/**
 * Canonical resources exposed by the phase-2 read API. The registry is an
 * allowlist: route parameters can never become SQL identifiers.
 */
const RESOURCE_DEFINITIONS: Record<string, ResourceDefinition> = {
  'inventory/products': { table: product, readPermission: 'inventory.read' },
  'inventory/stock-levels': { table: stockLevel, readPermission: 'inventory.read' },
  'inventory/stock-movements': { table: stockMovement, readPermission: 'inventory.read' },
  'sales/orders': { table: salesOrder, readPermission: 'sales.read', status: salesOrder.status },
  'sales/invoices': { table: invoice, readPermission: 'sales.read', status: invoice.status },
  'finance/accounts': { table: account, readPermission: 'finance.read' },
  'finance/gl-entries': { table: glEntry, readPermission: 'finance.read' },
  'purchasing/suppliers': { table: supplier, readPermission: 'purchasing.read' },
  'purchasing/purchase-orders': { table: purchaseOrder, readPermission: 'purchasing.read', status: purchaseOrder.status },
  'purchasing/goods-receipts': { table: goodsReceipt, readPermission: 'purchasing.read' },
  'purchasing/supplier-invoices': { table: supplierInvoice, readPermission: 'purchasing.read', status: supplierInvoice.status },
  'crm/opportunities': { table: opportunity, readPermission: 'crm.read', status: opportunity.stage },
};

export class UnknownResourceError extends Error {
  constructor(resource: string) {
    super(`Unknown ERP resource '${resource}'`);
    this.name = 'UnknownResourceError';
  }
}

export class InvalidResourceQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResourceQueryError';
  }
}

function definitionFor(resource: string): ResourceDefinition {
  const definition = RESOURCE_DEFINITIONS[resource];
  if (!definition) throw new UnknownResourceError(resource);
  return definition;
}

function parsePositiveInteger(value: unknown, fallback: number, label: string): number {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new InvalidResourceQueryError(`${label} must be a non-negative integer`);
  }
  return parsed;
}

export async function listResource(
  db: DB,
  scope: ApiScope,
  resource: string,
  query: ResourceQuery = {},
) {
  const definition = definitionFor(resource);
  const unsupported = Object.keys(query).filter(
    (key) => !['cursor', 'limit', 'sort', 'status'].includes(key),
  );
  if (unsupported.length) {
    throw new InvalidResourceQueryError(`unsupported filter(s): ${unsupported.join(', ')}`);
  }
  const cursor = parsePositiveInteger(query.cursor, 0, 'cursor');
  const limit = Math.min(100, Math.max(1, parsePositiveInteger(query.limit, 50, 'limit')));
  if (query.sort != null && query.sort !== '' && query.sort !== 'id') {
    throw new InvalidResourceQueryError("sort must be the whitelisted value 'id'");
  }
  if (query.status != null && !definition.status) {
    throw new InvalidResourceQueryError(`status is not a supported filter for '${resource}'`);
  }
  if (query.status != null && query.status !== '' && typeof query.status !== 'string') {
    throw new InvalidResourceQueryError('status must be a string');
  }

  const predicates = [
    eq(definition.table.masterFn, scope.masterFn),
    eq(definition.table.companyFn, scope.companyFn),
    gt(definition.table.id, cursor),
  ];
  if (definition.status && typeof query.status === 'string' && query.status) {
    predicates.push(eq(definition.status, query.status));
  }

  const rows = await db
    .select()
    .from(definition.table)
    .where(and(...predicates))
    .orderBy(asc(definition.table.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1] as { id?: number } | undefined;

  return {
    data,
    meta: { nextCursor: hasMore && last?.id != null ? String(last.id) : null },
  };
}

export async function getResource(db: DB, scope: ApiScope, resource: string, id: unknown) {
  const definition = definitionFor(resource);
  const resourceId = parsePositiveInteger(id, 0, 'id');
  if (resourceId < 1) throw new InvalidResourceQueryError('id must be a positive integer');

  const [row] = await db
    .select()
    .from(definition.table)
    .where(and(
      eq(definition.table.masterFn, scope.masterFn),
      eq(definition.table.companyFn, scope.companyFn),
      eq(definition.table.id, resourceId),
    ))
    .limit(1);

  return row ? { data: row, meta: {} } : null;
}

export function isKnownResource(resource: string): boolean {
  return Object.prototype.hasOwnProperty.call(RESOURCE_DEFINITIONS, resource);
}

export function readPermissionForResource(resource: string): string {
  return definitionFor(resource).readPermission;
}
