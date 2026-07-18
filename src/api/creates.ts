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
import {
  createInventoryLotWithin,
  createWarehouseBinWithin,
  registerInventorySerialWithin,
  type CreateInventoryLotInput,
  type CreateWarehouseBinInput,
  type RegisterInventorySerialInput,
} from '../modules/inventory/tracking';

export interface CreateDefinition {
  permission: string;
  audit: 'required';
  execute(tx: DB, scope: Scope, payload: Record<string, unknown>): Promise<unknown>;
}

const CREATES: Record<string, CreateDefinition> = {
  'inventory/bins': {
    permission: 'inventory.track',
    audit: 'required',
    execute(tx, scope, payload) {
      return createWarehouseBinWithin(
        tx,
        scope,
        payload as unknown as CreateWarehouseBinInput,
      );
    },
  },
  'inventory/lots': {
    permission: 'inventory.track',
    audit: 'required',
    execute(tx, scope, payload) {
      return createInventoryLotWithin(
        tx,
        scope,
        payload as unknown as CreateInventoryLotInput,
      );
    },
  },
  'inventory/serials': {
    permission: 'inventory.track',
    audit: 'required',
    execute(tx, scope, payload) {
      return registerInventorySerialWithin(
        tx,
        scope,
        payload as unknown as RegisterInventorySerialInput,
      );
    },
  },
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
