import { and, asc, eq, gt } from 'drizzle-orm';
import type { DB } from '../data/db';
import {
  account,
  glEntry,
  goodsReceipt,
  invoice,
  opportunity,
  product,
  inventoryLot,
  inventorySerial,
  inventoryAdjustment,
  purchaseOrder,
  purchaseOrderLine,
  salesOrder,
  stockLevel,
  stockMovement,
  stockLocationBalance,
  stockTransfer,
  warehouse,
  warehouseBin,
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

export interface ResourceDefinition {
  table: any;
  idColumn: any;
  tenantScope: 'company';
  readPermission: string;
  createPermission: string | null;
  updatePermission: string | null;
  allowedFilters: readonly string[];
  allowedSorts: readonly string[];
  allowedActions: readonly string[];
  versionColumn?: any;
  versionPolicy: 'none' | 'integer';
  idempotencyPolicy: 'none' | 'required_for_actions';
  auditPolicy: 'none' | 'writes';
  status?: any;
}

/**
 * Canonical resources exposed by the phase-2 read API. The registry is an
 * allowlist: route parameters can never become SQL identifiers.
 */
const RESOURCE_DEFINITIONS: Record<string, ResourceDefinition> = {
  'inventory/products': resource(product, 'inventory.read'),
  'inventory/warehouses': resource(warehouse, 'inventory.read'),
  'inventory/stock-levels': resource(stockLevel, 'inventory.read'),
  'inventory/stock-movements': resource(stockMovement, 'inventory.read'),
  'inventory/bins': resource(warehouseBin, 'inventory.read', {
    createPermission: 'inventory.track',
  }),
  'inventory/lots': resource(inventoryLot, 'inventory.read', {
    status: inventoryLot.qualityStatus,
    createPermission: 'inventory.track',
  }),
  'inventory/serials': resource(inventorySerial, 'inventory.read', {
    status: inventorySerial.status,
    createPermission: 'inventory.track',
  }),
  'inventory/location-balances': resource(stockLocationBalance, 'inventory.read'),
  'inventory/adjustments': resource(inventoryAdjustment, 'inventory.read', {
    status: inventoryAdjustment.status,
    versionColumn: inventoryAdjustment.version,
    allowedActions: ['post'],
    createPermission: 'inventory.adjust',
  }),
  'inventory/transfers': resource(stockTransfer, 'inventory.read', {
    status: stockTransfer.status,
    versionColumn: stockTransfer.version,
    allowedActions: ['complete'],
    createPermission: 'inventory.transfer',
  }),
  'sales/orders': resource(salesOrder, 'sales.read', {
    status: salesOrder.status,
    versionColumn: salesOrder.version,
    allowedActions: ['confirm'],
  }),
  'sales/invoices': resource(invoice, 'sales.read', {
    status: invoice.status,
    versionColumn: invoice.version,
  }),
  'finance/accounts': resource(account, 'finance.read'),
  'finance/gl-entries': resource(glEntry, 'finance.read'),
  'purchasing/suppliers': resource(supplier, 'purchasing.read'),
  'purchasing/purchase-orders': resource(purchaseOrder, 'purchasing.read', {
    status: purchaseOrder.status,
    versionColumn: purchaseOrder.version,
    allowedActions: ['receive', 'post-invoice'],
    createPermission: 'purchasing.write',
  }),
  'purchasing/purchase-order-lines': resource(purchaseOrderLine, 'purchasing.read'),
  'purchasing/goods-receipts': resource(goodsReceipt, 'purchasing.read'),
  'purchasing/supplier-invoices': resource(supplierInvoice, 'purchasing.read', {
    status: supplierInvoice.status,
    versionColumn: supplierInvoice.version,
  }),
  'crm/opportunities': resource(opportunity, 'crm.read', {
    status: opportunity.stage,
    versionColumn: opportunity.version,
    allowedActions: ['convert'],
    createPermission: 'crm.write',
    updatePermission: 'crm.write',
  }),
};

function resource(
  table: any,
  readPermission: string,
  options: {
    status?: any;
    versionColumn?: any;
    allowedActions?: readonly string[];
    createPermission?: string;
    updatePermission?: string;
  } = {},
): ResourceDefinition {
  return {
    table,
    idColumn: table.id,
    tenantScope: 'company',
    readPermission,
    createPermission: options.createPermission ?? null,
    updatePermission: options.updatePermission ?? null,
    allowedFilters: options.status ? ['status'] : [],
    allowedSorts: ['id'],
    allowedActions: options.allowedActions ?? [],
    versionColumn: options.versionColumn,
    versionPolicy: options.versionColumn ? 'integer' : 'none',
    idempotencyPolicy: options.allowedActions?.length ? 'required_for_actions' : 'none',
    auditPolicy: options.allowedActions?.length ? 'writes' : 'none',
    status: options.status,
  };
}

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

function decodeCursor(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value !== 'string') throw new InvalidResourceQueryError('cursor is invalid');
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      v?: unknown;
      id?: unknown;
    };
    if (parsed.v !== 1 || !Number.isSafeInteger(parsed.id) || Number(parsed.id) < 0) {
      throw new Error('invalid cursor');
    }
    return Number(parsed.id);
  } catch {
    throw new InvalidResourceQueryError('cursor is invalid');
  }
}

function encodeCursor(id: number): string {
  return Buffer.from(JSON.stringify({ v: 1, id }), 'utf8').toString('base64url');
}

export async function listResource(
  db: DB,
  scope: ApiScope,
  resource: string,
  query: ResourceQuery = {},
) {
  const definition = definitionFor(resource);
  const supported = ['cursor', 'limit', 'sort', ...definition.allowedFilters];
  const unsupported = Object.keys(query).filter((key) => !supported.includes(key));
  if (unsupported.length) {
    throw new InvalidResourceQueryError(`unsupported filter(s): ${unsupported.join(', ')}`);
  }
  const cursor = decodeCursor(query.cursor);
  const limit = Math.min(100, Math.max(1, parsePositiveInteger(query.limit, 50, 'limit')));
  if (
    query.sort != null
    && query.sort !== ''
    && !definition.allowedSorts.includes(String(query.sort))
  ) {
    throw new InvalidResourceQueryError(
      `sort must be one of: ${definition.allowedSorts.join(', ')}`,
    );
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
    gt(definition.idColumn, cursor),
  ];
  if (definition.status && typeof query.status === 'string' && query.status) {
    predicates.push(eq(definition.status, query.status));
  }

  const rows = await db
    .select()
    .from(definition.table)
    .where(and(...predicates))
    .orderBy(asc(definition.idColumn))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1] as { id?: number } | undefined;

  return {
    data,
    meta: { nextCursor: hasMore && last?.id != null ? encodeCursor(last.id) : null },
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
      eq(definition.idColumn, resourceId),
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

export function resourceDefinitionFor(resource: string): ResourceDefinition {
  return definitionFor(resource);
}
