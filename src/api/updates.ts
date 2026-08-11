import type { DB } from '../data/db';
import type { Scope } from '../data/repo';
import {
  updateCustomerWithin,
  type CustomerUpdateError,
  type UpdateCustomerInput,
} from '../modules/crm/customer';
import {
  updateProductWithin,
  type InventoryProductUpdateError,
  type UpdateProductInput,
} from '../modules/inventory/product';
import {
  updateSupplierWithin,
  type SupplierUpdateError,
  type UpdateSupplierInput,
} from '../modules/purchasing/supplier';

export type UpdateConcurrency = 'integer' | 'updated_at';

export interface ResourceUpdateResult {
  before: unknown;
  after: unknown;
}

export interface ResourceUpdateDefinition {
  permission: string;
  concurrency: UpdateConcurrency;
  execute(
    tx: DB,
    scope: Scope,
    id: number,
    payload: Record<string, unknown>,
    expectedVersion: string | number,
  ): Promise<ResourceUpdateResult>;
}

function integerVersion(value: string | number): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('If-Match must contain a positive integer version.');
  }
  return version;
}

function updatedAt(value: string | number): string {
  const token = String(value).trim();
  if (!token || Number.isNaN(new Date(token).getTime())) {
    throw new Error('If-Match must contain a valid updatedAt timestamp.');
  }
  return token;
}

export const RESOURCE_UPDATES: Record<string, ResourceUpdateDefinition> = {
  'inventory/products': {
    permission: 'inventory.write',
    concurrency: 'integer',
    async execute(tx, scope, id, payload, expectedVersion) {
      const result = await updateProductWithin(tx, scope, id, {
        name: payload.name,
        uom: payload.uom,
        category: payload.category,
        standardCost: payload.standardCost as string | number,
        reorderPoint: payload.reorderPoint as string | number,
        reorderQty: payload.reorderQty as string | number,
        expectedVersion: integerVersion(expectedVersion),
      } as UpdateProductInput);
      return { before: result.before, after: result.after };
    },
  },
  'sales/customers': {
    permission: 'sales.write',
    concurrency: 'updated_at',
    async execute(tx, scope, id, payload, expectedVersion) {
      const result = await updateCustomerWithin(tx, scope, id, {
        code: payload.code,
        name: payload.name,
        industry: payload.industry,
        expectedUpdatedAt: updatedAt(expectedVersion),
      } as UpdateCustomerInput);
      return result;
    },
  },
  'crm/customers': {
    permission: 'crm.write',
    concurrency: 'updated_at',
    async execute(tx, scope, id, payload, expectedVersion) {
      const result = await updateCustomerWithin(tx, scope, id, {
        code: payload.code,
        name: payload.name,
        industry: payload.industry,
        expectedUpdatedAt: updatedAt(expectedVersion),
      } as UpdateCustomerInput);
      return result;
    },
  },
  'purchasing/suppliers': {
    permission: 'purchasing.write',
    concurrency: 'updated_at',
    async execute(tx, scope, id, payload, expectedVersion) {
      const result = await updateSupplierWithin(tx, scope, id, {
        code: payload.code,
        name: payload.name,
        expectedUpdatedAt: updatedAt(expectedVersion),
      } as UpdateSupplierInput);
      return result;
    },
  },
};

export function updateDefinitionFor(resource: string): ResourceUpdateDefinition | null {
  return RESOURCE_UPDATES[resource] ?? null;
}

export function isResourceUpdateError(error: unknown): error is (
  CustomerUpdateError | InventoryProductUpdateError | SupplierUpdateError
) {
  return error instanceof Error && (
    error.name === 'CustomerUpdateError'
    || error.name === 'InventoryProductUpdateError'
    || error.name === 'SupplierUpdateError'
  );
}
