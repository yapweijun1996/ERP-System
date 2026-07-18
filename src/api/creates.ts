import type { DB } from '../data/db';
import type { Scope } from '../data/repo';
import {
  createInventoryAdjustmentWithin,
  type CreateInventoryAdjustmentInput,
} from '../modules/inventory/adjustment';
import {
  createStockTransferWithin,
  type CreateStockTransferInput,
} from '../modules/inventory/transfer';

export interface CreateDefinition {
  permission: string;
  audit: 'required';
  execute(tx: DB, scope: Scope, payload: Record<string, unknown>): Promise<unknown>;
}

const CREATES: Record<string, CreateDefinition> = {
  'inventory/adjustments': {
    permission: 'inventory.adjust',
    audit: 'required',
    execute(tx, scope, payload) {
      return createInventoryAdjustmentWithin(
        tx,
        scope,
        payload as unknown as CreateInventoryAdjustmentInput,
      );
    },
  },
  'inventory/transfers': {
    permission: 'inventory.transfer',
    audit: 'required',
    execute(tx, scope, payload) {
      return createStockTransferWithin(
        tx,
        scope,
        payload as unknown as CreateStockTransferInput,
      );
    },
  },
};

export function createDefinitionFor(resource: string): CreateDefinition | null {
  return CREATES[resource] ?? null;
}
