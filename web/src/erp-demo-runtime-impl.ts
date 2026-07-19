import { PGlite, type Transaction } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from '../../src/data/schema';
import type { DB } from '../../src/data/db';
import type { Scope } from '../../src/data/repo';
import { seedDemo } from '../../src/data/seed';
import {
  convertOpportunityToSalesOrderWithin,
  type ConvertOpportunityInput,
} from '../../src/modules/crm/convertOpportunityToSalesOrder';
import {
  createOpportunity,
  type CreateOpportunityInput,
} from '../../src/modules/crm/createOpportunity';
import {
  createContactWithin,
  type CreateContactInput,
} from '../../src/modules/crm/contact';
import {
  createCustomerActivityWithin,
  type CreateCustomerActivityInput,
} from '../../src/modules/crm/activity';
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
  createProductWithin,
  updateProductWithin,
  type CreateProductInput,
  type UpdateProductInput,
} from '../../src/modules/inventory/product';
import {
  completeWarehousePickWithin,
  createWarehousePickWithin,
  recordWarehousePickWithin,
  type CreateWarehousePickInput,
  type RecordPickInput,
} from '../../src/modules/warehouse/picking';
import {
  completeWorkOrderWithin,
  createWorkOrderWithin,
  issueWorkOrderMaterialsWithin,
  releaseWorkOrderWithin,
  reportWorkOrderOperationWithin,
  type ReportWorkOrderOperationInput,
  type CreateWorkOrderInput,
} from '../../src/modules/manufacturing/workOrder';
import { runMrpWithin, type RunMrpInput } from '../../src/modules/manufacturing/mrp';
import {
  completeInspectionWithin,
  createInspectionWithin,
  createNcrWithin,
  disposeNcrWithin,
  type CompleteInspectionInput,
  type CreateInspectionInput,
  type CreateNcrInput,
} from '../../src/modules/quality/inspection';
import {
  convertEnquiryToQuotationWithin,
  convertQuotationToOrderWithin,
  createSalesEnquiryWithin,
  createSalesQuotationWithin,
  transitionQuotationWithin,
  type ConvertEnquiryInput,
  type CreateSalesEnquiryInput,
  type CreateSalesQuotationInput,
} from '../../src/modules/sales/quotation';
import {
  createSalesReturnWithin,
  receiveAndCreditSalesReturnWithin,
  rejectSalesReturnWithin,
  type CreateSalesReturnInput,
  type CreditSalesReturnInput,
} from '../../src/modules/sales/return';
import {
  createSalesDebitNoteWithin,
  postSalesDebitNoteWithin,
  type CreateSalesDebitNoteInput,
} from '../../src/modules/sales/debitNote';
import {
  activateDiscountRuleWithin,
  activatePriceListWithin,
  createDiscountRuleWithin,
  createPriceListWithin,
  type CreateDiscountRuleInput,
  type CreatePriceListInput,
} from '../../src/modules/sales/pricing';
import {
  createCreditProfileWithin,
  placeCreditHoldWithin,
  releaseCreditHoldWithin,
  type CreateCreditProfileInput,
} from '../../src/modules/sales/creditControl';
import {
  createAssetWithin,
  type CreateAssetInput,
} from '../../src/modules/assets/createAsset';
import {
  createDepreciationRunWithin,
  postDepreciationRunWithin,
  type CreateDepreciationRunInput,
} from '../../src/modules/assets/depreciationRun';

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
    seedDemo(db: DemoOrm) {
      return seedDemo(asDomainDb(db));
    },
    createProductWithin(db: DemoOrm, scope: Scope, input: CreateProductInput) {
      return createProductWithin(asDomainDb(db), scope, input);
    },
    updateProductWithin(db: DemoOrm, scope: Scope, productId: number, input: UpdateProductInput) {
      return updateProductWithin(asDomainDb(db), scope, productId, input);
    },
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
    issueWorkOrderMaterialsWithin(db: DemoOrm, scope: Scope, workOrderId: number) {
      return issueWorkOrderMaterialsWithin(asDomainDb(db), scope, workOrderId);
    },
    reportWorkOrderOperationWithin(
      db: DemoOrm,
      scope: Scope,
      input: ReportWorkOrderOperationInput,
    ) {
      return reportWorkOrderOperationWithin(asDomainDb(db), scope, input);
    },
    completeWorkOrderWithin(db: DemoOrm, scope: Scope, workOrderId: number) {
      return completeWorkOrderWithin(asDomainDb(db), scope, workOrderId);
    },
    runMrpWithin(db: DemoOrm, scope: Scope, input: RunMrpInput) {
      return runMrpWithin(asDomainDb(db), scope, input);
    },
    createInspectionWithin(db: DemoOrm, scope: Scope, input: CreateInspectionInput) {
      return createInspectionWithin(asDomainDb(db), scope, input);
    },
    completeInspectionWithin(db: DemoOrm, scope: Scope, input: CompleteInspectionInput) {
      return completeInspectionWithin(asDomainDb(db), scope, input);
    },
    createNcrWithin(db: DemoOrm, scope: Scope, input: CreateNcrInput) {
      return createNcrWithin(asDomainDb(db), scope, input);
    },
    disposeNcrWithin(
      db: DemoOrm,
      scope: Scope,
      ncrId: number,
      disposition: 'release' | 'scrap',
    ) {
      return disposeNcrWithin(asDomainDb(db), scope, ncrId, disposition);
    },
    createSalesEnquiryWithin(
      db: DemoOrm,
      scope: Scope,
      input: CreateSalesEnquiryInput,
    ) {
      return createSalesEnquiryWithin(asDomainDb(db), scope, input);
    },
    createSalesQuotationWithin(
      db: DemoOrm,
      scope: Scope,
      input: CreateSalesQuotationInput,
    ) {
      return createSalesQuotationWithin(asDomainDb(db), scope, input);
    },
    convertEnquiryToQuotationWithin(
      db: DemoOrm,
      scope: Scope,
      enquiryId: number,
      input: ConvertEnquiryInput,
    ) {
      return convertEnquiryToQuotationWithin(asDomainDb(db), scope, enquiryId, input);
    },
    transitionQuotationWithin(
      db: DemoOrm,
      scope: Scope,
      quotationId: number,
      transition: 'issue' | 'accept',
    ) {
      return transitionQuotationWithin(asDomainDb(db), scope, quotationId, transition);
    },
    convertQuotationToOrderWithin(
      db: DemoOrm,
      scope: Scope,
      quotationId: number,
      input: { docNo: string; orderDate: string },
    ) {
      return convertQuotationToOrderWithin(asDomainDb(db), scope, quotationId, input);
    },
    createSalesReturnWithin(
      db: DemoOrm,
      scope: Scope,
      input: CreateSalesReturnInput,
    ) {
      return createSalesReturnWithin(asDomainDb(db), scope, input);
    },
    receiveAndCreditSalesReturnWithin(
      db: DemoOrm,
      scope: Scope,
      returnId: number,
      input: CreditSalesReturnInput,
    ) {
      return receiveAndCreditSalesReturnWithin(asDomainDb(db), scope, returnId, input);
    },
    rejectSalesReturnWithin(db: DemoOrm, scope: Scope, returnId: number) {
      return rejectSalesReturnWithin(asDomainDb(db), scope, returnId);
    },
    createSalesDebitNoteWithin(
      db: DemoOrm,
      scope: Scope,
      input: CreateSalesDebitNoteInput,
    ) {
      return createSalesDebitNoteWithin(asDomainDb(db), scope, input);
    },
    postSalesDebitNoteWithin(db: DemoOrm, scope: Scope, debitNoteId: number) {
      return postSalesDebitNoteWithin(asDomainDb(db), scope, debitNoteId);
    },
    createPriceListWithin(db: DemoOrm, scope: Scope, input: CreatePriceListInput) {
      return createPriceListWithin(asDomainDb(db), scope, input);
    },
    activatePriceListWithin(db: DemoOrm, scope: Scope, priceListId: number) {
      return activatePriceListWithin(asDomainDb(db), scope, priceListId);
    },
    createDiscountRuleWithin(db: DemoOrm, scope: Scope, input: CreateDiscountRuleInput) {
      return createDiscountRuleWithin(asDomainDb(db), scope, input);
    },
    activateDiscountRuleWithin(db: DemoOrm, scope: Scope, discountRuleId: number) {
      return activateDiscountRuleWithin(asDomainDb(db), scope, discountRuleId);
    },
    createCreditProfileWithin(db: DemoOrm, scope: Scope, input: CreateCreditProfileInput) {
      return createCreditProfileWithin(asDomainDb(db), scope, input);
    },
    placeCreditHoldWithin(db: DemoOrm, scope: Scope, profileId: number, reason: string) {
      return placeCreditHoldWithin(asDomainDb(db), scope, profileId, reason);
    },
    releaseCreditHoldWithin(db: DemoOrm, scope: Scope, profileId: number) {
      return releaseCreditHoldWithin(asDomainDb(db), scope, profileId);
    },
    createAssetWithin(db: DemoOrm, scope: Scope, input: CreateAssetInput) {
      return createAssetWithin(asDomainDb(db), scope, input);
    },
    createDepreciationRunWithin(db: DemoOrm, scope: Scope, input: CreateDepreciationRunInput) {
      return createDepreciationRunWithin(asDomainDb(db), scope, input);
    },
    postDepreciationRunWithin(db: DemoOrm, scope: Scope, runId: number) {
      return postDepreciationRunWithin(asDomainDb(db), scope, runId);
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
    createContactWithin(db: DemoOrm, scope: Scope, input: CreateContactInput) {
      return createContactWithin(asDomainDb(db), scope, input);
    },
    createCustomerActivityWithin(db: DemoOrm, scope: Scope, input: CreateCustomerActivityInput) {
      return createCustomerActivityWithin(asDomainDb(db), scope, input);
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
