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
import {
  createPurchaseOrderWithin,
  type CreatePurchaseOrderInput,
} from '../modules/purchasing/createPurchaseOrder';

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
  'purchasing/purchase-orders': {
    permission: 'purchasing.write',
    audit: 'required',
    execute(tx, scope, payload) {
      const input = payload as unknown as CreatePurchaseOrderInput;
      if (
        typeof input.docNo !== 'string'
        || !input.docNo.trim()
        || !Number.isSafeInteger(input.supplierId)
        || input.supplierId <= 0
        || typeof input.orderDate !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(input.orderDate)
        || typeof input.currency !== 'string'
        || !/^[A-Z]{3}$/.test(input.currency)
        || !Array.isArray(input.lines)
        || input.lines.length === 0
        || input.lines.some((line) =>
          !line
          || !Number.isSafeInteger(line.productId)
          || line.productId <= 0
          || !Number.isFinite(line.qty)
          || line.qty <= 0
          || !Number.isFinite(line.unitCost)
          || line.unitCost < 0
          || typeof line.taxCode !== 'string'
          || !line.taxCode.trim())
      ) {
        throw new RangeError(
          'docNo, supplierId, orderDate, currency and at least one valid purchase-order line are required.',
        );
      }
      return createPurchaseOrderWithin(tx, scope, input);
    },
  },
};

export function createDefinitionFor(resource: string): CreateDefinition | null {
  return CREATES[resource] ?? null;
}
