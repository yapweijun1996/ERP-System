import { PGlite, type Transaction } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from '../../src/data/schema';
import type { DB } from '../../src/data/db';
import type { Scope } from '../../src/data/repo';
import {
  convertOpportunityToSalesOrderWithin,
  type ConvertOpportunityInput,
} from '../../src/modules/crm/convertOpportunityToSalesOrder';
import {
  createOpportunity,
  type CreateOpportunityInput,
} from '../../src/modules/crm/createOpportunity';
import {
  createPurchaseOrder,
  createPurchaseOrderWithin,
  type CreatePurchaseOrderInput,
} from '../../src/modules/purchasing/createPurchaseOrder';
import {
  postSupplierInvoice,
  postSupplierInvoiceWithin,
  type PostSupplierInvoiceInput,
} from '../../src/modules/purchasing/postSupplierInvoice';
import {
  receiveGoods,
  receiveGoodsWithin,
  type ReceiveGoodsInput,
} from '../../src/modules/purchasing/receiveGoods';
import {
  confirmDraftSalesOrderWithin,
  confirmSalesOrder,
  type ConfirmDraftOrderInput,
  type ConfirmOrderInput,
} from '../../src/modules/sales/confirmOrder';
import {
  completeDemoSetupWithin,
  type CompleteDemoSetupInput,
} from '../../src/modules/setup/completeDemoSetup';
import {
  createInventoryAdjustmentWithin,
  postInventoryAdjustmentWithin,
  type CreateInventoryAdjustmentInput,
} from '../../src/modules/inventory/adjustment';
import {
  completeStockTransferWithin,
  createStockTransferWithin,
  type CreateStockTransferInput,
} from '../../src/modules/inventory/transfer';
import {
  createInventoryLotWithin,
  createWarehouseBinWithin,
  registerInventorySerialWithin,
  type CreateInventoryLotInput,
  type CreateWarehouseBinInput,
  type RegisterInventorySerialInput,
} from '../../src/modules/inventory/tracking';
import {
  completeWarehousePickWithin,
  createWarehousePickWithin,
  recordWarehousePickWithin,
  type CreateWarehousePickInput,
  type RecordPickInput,
} from '../../src/modules/warehouse/picking';
import {
  createWorkOrderWithin,
  releaseWorkOrderWithin,
  type CreateWorkOrderInput,
} from '../../src/modules/manufacturing/workOrder';

type DemoOrm = PgliteDatabase<typeof schema>;

function createOrm(client: PGlite | Transaction): DemoOrm {
  return drizzle(client as PGlite, { schema });
}

function asDomainDb(db: DemoOrm): DB {
  return db as unknown as DB;
}

export const erpDemoRuntime = Object.freeze({
  openDatabase(dataDir: string) {
    const client = new PGlite(dataDir);
    return { client, orm: createOrm(client) };
  },
  createOrm,
  commands: Object.freeze({
    createWarehouseBinWithin(db: DemoOrm, scope: Scope, input: CreateWarehouseBinInput) {
      return createWarehouseBinWithin(asDomainDb(db), scope, input);
    },
    createInventoryLotWithin(db: DemoOrm, scope: Scope, input: CreateInventoryLotInput) {
      return createInventoryLotWithin(asDomainDb(db), scope, input);
    },
    registerInventorySerialWithin(
      db: DemoOrm,
      scope: Scope,
      input: RegisterInventorySerialInput,
    ) {
      return registerInventorySerialWithin(asDomainDb(db), scope, input);
    },
    createInventoryAdjustmentWithin(
      db: DemoOrm,
      scope: Scope,
      input: CreateInventoryAdjustmentInput,
    ) {
      return createInventoryAdjustmentWithin(asDomainDb(db), scope, input);
    },
    postInventoryAdjustmentWithin(db: DemoOrm, scope: Scope, adjustmentId: number) {
      return postInventoryAdjustmentWithin(asDomainDb(db), scope, adjustmentId);
    },
    createStockTransferWithin(db: DemoOrm, scope: Scope, input: CreateStockTransferInput) {
      return createStockTransferWithin(asDomainDb(db), scope, input);
    },
    completeStockTransferWithin(db: DemoOrm, scope: Scope, transferId: number) {
      return completeStockTransferWithin(asDomainDb(db), scope, transferId);
    },
    createWarehousePickWithin(db: DemoOrm, scope: Scope, input: CreateWarehousePickInput) {
      return createWarehousePickWithin(asDomainDb(db), scope, input);
    },
    recordWarehousePickWithin(db: DemoOrm, scope: Scope, input: RecordPickInput) {
      return recordWarehousePickWithin(asDomainDb(db), scope, input);
    },
    completeWarehousePickWithin(db: DemoOrm, scope: Scope, pickId: number) {
      return completeWarehousePickWithin(asDomainDb(db), scope, pickId);
    },
    createWorkOrderWithin(db: DemoOrm, scope: Scope, input: CreateWorkOrderInput) {
      return createWorkOrderWithin(asDomainDb(db), scope, input);
    },
    releaseWorkOrderWithin(db: DemoOrm, scope: Scope, workOrderId: number) {
      return releaseWorkOrderWithin(asDomainDb(db), scope, workOrderId);
    },
    confirmSalesOrder(db: DemoOrm, scope: Scope, input: ConfirmOrderInput) {
      return confirmSalesOrder(asDomainDb(db), scope, input);
    },
    confirmDraftSalesOrderWithin(db: DemoOrm, scope: Scope, input: ConfirmDraftOrderInput) {
      return confirmDraftSalesOrderWithin(asDomainDb(db), scope, input);
    },
    completeDemoSetupWithin(db: DemoOrm, input: CompleteDemoSetupInput) {
      return completeDemoSetupWithin(asDomainDb(db), input);
    },
    createPurchaseOrder(db: DemoOrm, scope: Scope, input: CreatePurchaseOrderInput) {
      return createPurchaseOrder(asDomainDb(db), scope, input);
    },
    createPurchaseOrderWithin(db: DemoOrm, scope: Scope, input: CreatePurchaseOrderInput) {
      return createPurchaseOrderWithin(asDomainDb(db), scope, input);
    },
    receiveGoods(db: DemoOrm, scope: Scope, input: ReceiveGoodsInput) {
      return receiveGoods(asDomainDb(db), scope, input);
    },
    receiveGoodsWithin(db: DemoOrm, scope: Scope, input: ReceiveGoodsInput) {
      return receiveGoodsWithin(asDomainDb(db), scope, input);
    },
    postSupplierInvoice(db: DemoOrm, scope: Scope, input: PostSupplierInvoiceInput) {
      return postSupplierInvoice(asDomainDb(db), scope, input);
    },
    postSupplierInvoiceWithin(db: DemoOrm, scope: Scope, input: PostSupplierInvoiceInput) {
      return postSupplierInvoiceWithin(asDomainDb(db), scope, input);
    },
    createOpportunity(db: DemoOrm, scope: Scope, input: CreateOpportunityInput) {
      return createOpportunity(asDomainDb(db), scope, input);
    },
    convertOpportunityToSalesOrderWithin(
      db: DemoOrm,
      scope: Scope,
      input: ConvertOpportunityInput,
    ) {
      return convertOpportunityToSalesOrderWithin(asDomainDb(db), scope, input);
    },
  }),
});

export type ErpDemoRuntime = typeof erpDemoRuntime;
