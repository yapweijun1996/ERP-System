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
import {
  createOpportunity,
  type CreateOpportunityInput,
} from '../modules/crm/createOpportunity';
import {
  createWarehousePickWithin,
  type CreateWarehousePickInput,
} from '../modules/warehouse/picking';

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
  'warehouse/picks': {
    permission: 'inventory.transfer',
    audit: 'required',
    execute(tx, scope, payload) {
      return createWarehousePickWithin(
        tx,
        scope,
        payload as unknown as CreateWarehousePickInput,
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
  'crm/opportunities': {
    permission: 'crm.write',
    audit: 'required',
    execute(tx, scope, payload) {
      const input = payload as unknown as CreateOpportunityInput;
      if (
        typeof input.docNo !== 'string'
        || !input.docNo.trim()
        || !Number.isSafeInteger(input.customerId)
        || input.customerId <= 0
        || typeof input.title !== 'string'
        || !input.title.trim()
        || !Number.isFinite(input.value)
        || input.value <= 0
        || typeof input.currency !== 'string'
        || !/^[A-Z]{3}$/.test(input.currency)
        || typeof input.closeDate !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(input.closeDate)
        || (input.stage != null
          && !['lead', 'qualified', 'proposal', 'negotiation'].includes(input.stage))
        || (input.probability != null
          && (!Number.isFinite(input.probability)
            || input.probability < 0
            || input.probability > 100))
      ) {
        throw new RangeError(
          'docNo, customerId, title, positive value, currency and closeDate are required for an opportunity.',
        );
      }
      return createOpportunity(tx, scope, input);
    },
  },
};

export function createDefinitionFor(resource: string): CreateDefinition | null {
  return CREATES[resource] ?? null;
}
