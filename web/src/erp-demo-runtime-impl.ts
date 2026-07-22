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
import { markOpportunityLostWithin } from '../../src/modules/crm/opportunityLifecycle';
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
  createPurchaseReturnWithin,
  rejectPurchaseReturnWithin,
  shipAndCreditPurchaseReturnWithin,
  type CreatePurchaseReturnInput,
  type ShipAndCreditPurchaseReturnInput,
} from '../../src/modules/purchasing/purchaseReturn';
import {
  createSupplierDebitNoteWithin,
  postSupplierDebitNoteWithin,
  type CreateSupplierDebitNoteInput,
} from '../../src/modules/purchasing/supplierDebitNote';
import {
  allocateLandedCostWithin,
  createLandedCostWithin,
  type CreateLandedCostInput,
} from '../../src/modules/purchasing/landedCost';
import {
  activateSupplierPriceListWithin,
  createSupplierPriceListWithin,
  type CreateSupplierPriceListInput,
} from '../../src/modules/purchasing/supplierPricing';
import { listVendorPerformanceWithin } from '../../src/modules/purchasing/vendorPerformance';
import {
  listPurchasePriceVarianceWithin,
  listPurchasingAnalyticsWithin,
} from '../../src/modules/purchasing/analytics';
import {
  decidePurchaseOrderWithin,
  type DecidePurchaseOrderInput,
} from '../../src/modules/purchasing/purchaseOrderApproval';
import {
  confirmDraftSalesOrderWithin,
  confirmSalesOrder,
  type ConfirmDraftOrderInput,
  type ConfirmOrderInput,
} from '../../src/modules/sales/confirmOrder';
import {
  createSalesOrderWithin,
  type CreateSalesOrderInput,
} from '../../src/modules/sales/createSalesOrder';
import {
  decideSalesOrderWithin,
  type DecideSalesOrderInput,
} from '../../src/modules/sales/salesOrderApproval';
import { listSalesAnalyticsWithin } from '../../src/modules/sales/analytics';
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
import {
  createEmployeeWithin,
  type CreateEmployeeInput,
} from '../../src/modules/hr/employee';
import {
  createLeaveRequestWithin,
  decideLeaveRequestWithin,
  type CreateLeaveRequestInput,
} from '../../src/modules/hr/leaveRequest';
import {
  createPayrollRunWithin,
  postPayrollRunWithin,
  type CreatePayrollRunInput,
} from '../../src/modules/payroll/payrollRun';
import {
  createProjectWithin,
  type CreateProjectInput,
} from '../../src/modules/project/project';
import {
  createProgressClaimWithin,
  postProgressClaimWithin,
  type CreateProgressClaimInput,
} from '../../src/modules/project/progressClaim';
import {
  createServiceContractWithin,
  type CreateServiceContractInput,
} from '../../src/modules/service/serviceContract';
import {
  assignServiceTicketWithin,
  createServiceTicketWithin,
  resolveServiceTicketWithin,
  type CreateServiceTicketInput,
} from '../../src/modules/service/serviceTicket';
import {
  createPurchaseRequisitionWithin,
  decidePurchaseRequisitionWithin,
  type CreatePurchaseRequisitionInput,
} from '../../src/modules/purchasing/purchaseRequisition';
import {
  convertSupplierQuotationToPurchaseOrderWithin,
  createPurchaseRfqWithin,
  createSupplierQuotationWithin,
  transitionPurchaseRfqWithin,
  type CreatePurchaseRfqInput,
  type CreateSupplierQuotationInput,
} from '../../src/modules/purchasing/rfq';
import {
  createBankReceiptWithin,
  type CreateBankReceiptInput,
} from '../../src/modules/finance/bankReceipt';
import {
  createPaymentVoucherWithin,
  type CreatePaymentVoucherInput,
} from '../../src/modules/finance/paymentVoucher';
import {
  listAuditLog,
  listCompanyUsers,
  listRolePermissions,
  listRoles,
} from '../../src/api/admin';
import { appendAudit } from '../../src/api/audit';
import {
  createInvitationRecordWithin,
  createRoleWithin,
  setRolePermissionWithin,
  setUserActiveWithin,
} from '../../src/auth/adminLifecycle';
import { listMasterModules, setMasterModuleWithin } from '../../src/auth/moduleAccess';
import type { SessionData } from '../../src/auth/session';

type DemoOrm = PgliteDatabase<typeof schema>;

function createOrm(client: PGlite | Transaction): DemoOrm {
  return drizzle(client as PGlite, { schema });
}

function asDomainDb(db: DemoOrm): DB {
  return db as unknown as DB;
}

/* Synthetic session for the 3 lifecycle.ts admin functions, which take a real
   SessionData (masterFn/activeCompanyFn/userId) rather than a bare Scope. email/
   fullName are never read by these three functions -- confirmed by reading their
   bodies -- so empty placeholders are safe here. */
function demoSession(scope: Scope, actorUserId: number): SessionData {
  return {
    userId: actorUserId,
    masterFn: scope.masterFn,
    activeCompanyFn: scope.companyFn,
    email: '',
    fullName: null,
  };
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* Demo-only invitation creation. The real src/auth/lifecycle.ts createInvitation()
   hard-depends on node:crypto (AES-256-GCM token encryption + an email outbox event)
   which cannot run in a browser bundle. The browser demo has no email worker to
   deliver an invitation link anyway, so this computes the token via the Web Crypto
   API (available natively in the browser) and delegates the actual validation and
   userInvitation insert to createInvitationRecordWithin -- identical logic to
   createInvitation(), just fed a pre-computed hash instead of calling
   encryptToken()/newOpaqueToken() and skipping the outbox event entirely (nothing
   would ever consume it in-browser). */
async function createDemoInvitation(
  db: DemoOrm,
  scope: Scope,
  actorUserId: number,
  input: { email: string; roleId: number },
) {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return createInvitationRecordWithin(
    asDomainDb(db),
    demoSession(scope, actorUserId),
    { email: input.email, roleId: input.roleId, tokenHash, expiresAt },
    'demo',
  );
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
    createEmployeeWithin(db: DemoOrm, scope: Scope, input: CreateEmployeeInput) {
      return createEmployeeWithin(asDomainDb(db), scope, input);
    },
    createLeaveRequestWithin(db: DemoOrm, scope: Scope, input: CreateLeaveRequestInput) {
      return createLeaveRequestWithin(asDomainDb(db), scope, input);
    },
    decideLeaveRequestWithin(
      db: DemoOrm, scope: Scope, leaveRequestId: number,
      decision: 'approved' | 'rejected', rejectionReason?: string | null,
    ) {
      return decideLeaveRequestWithin(asDomainDb(db), scope, leaveRequestId, decision, rejectionReason);
    },
    createPayrollRunWithin(db: DemoOrm, scope: Scope, input: CreatePayrollRunInput) {
      return createPayrollRunWithin(asDomainDb(db), scope, input);
    },
    postPayrollRunWithin(db: DemoOrm, scope: Scope, runId: number) {
      return postPayrollRunWithin(asDomainDb(db), scope, runId);
    },
    createProjectWithin(db: DemoOrm, scope: Scope, input: CreateProjectInput) {
      return createProjectWithin(asDomainDb(db), scope, input);
    },
    createProgressClaimWithin(db: DemoOrm, scope: Scope, input: CreateProgressClaimInput) {
      return createProgressClaimWithin(asDomainDb(db), scope, input);
    },
    postProgressClaimWithin(db: DemoOrm, scope: Scope, claimId: number) {
      return postProgressClaimWithin(asDomainDb(db), scope, claimId);
    },
    createServiceContractWithin(db: DemoOrm, scope: Scope, input: CreateServiceContractInput) {
      return createServiceContractWithin(asDomainDb(db), scope, input);
    },
    createServiceTicketWithin(db: DemoOrm, scope: Scope, input: CreateServiceTicketInput) {
      return createServiceTicketWithin(asDomainDb(db), scope, input);
    },
    assignServiceTicketWithin(db: DemoOrm, scope: Scope, ticketId: number, technicianName: string) {
      return assignServiceTicketWithin(asDomainDb(db), scope, ticketId, technicianName);
    },
    resolveServiceTicketWithin(db: DemoOrm, scope: Scope, ticketId: number, diagnosis: string) {
      return resolveServiceTicketWithin(asDomainDb(db), scope, ticketId, diagnosis);
    },
    createPurchaseRequisitionWithin(db: DemoOrm, scope: Scope, input: CreatePurchaseRequisitionInput) {
      return createPurchaseRequisitionWithin(asDomainDb(db), scope, input);
    },
    decidePurchaseRequisitionWithin(
      db: DemoOrm, scope: Scope, requisitionId: number,
      decision: 'approved' | 'rejected', rejectionReason?: string | null,
    ) {
      return decidePurchaseRequisitionWithin(asDomainDb(db), scope, requisitionId, decision, rejectionReason);
    },
    createBankReceiptWithin(db: DemoOrm, scope: Scope, input: CreateBankReceiptInput) {
      return createBankReceiptWithin(asDomainDb(db), scope, input);
    },
    createPaymentVoucherWithin(db: DemoOrm, scope: Scope, input: CreatePaymentVoucherInput) {
      return createPaymentVoucherWithin(asDomainDb(db), scope, input);
    },
    listCompanyUsers(db: DemoOrm, scope: Scope) {
      return listCompanyUsers(asDomainDb(db), scope.masterFn, scope.companyFn);
    },
    listRoles(db: DemoOrm, scope: Scope) {
      return listRoles(asDomainDb(db), scope.masterFn);
    },
    listRolePermissions(db: DemoOrm, scope: Scope) {
      return listRolePermissions(asDomainDb(db), scope.masterFn);
    },
    listAuditLog(db: DemoOrm, scope: Scope, query: { limit?: number; cursor?: number } = {}) {
      return listAuditLog(asDomainDb(db), scope.masterFn, scope.companyFn, query);
    },
    listMasterModules(db: DemoOrm, scope: Scope) {
      return listMasterModules(asDomainDb(db), scope.masterFn);
    },
    setMasterModuleWithin(
      db: DemoOrm,
      scope: Scope,
      actorUserId: number,
      moduleKey: string,
      enabled: boolean,
    ) {
      return setMasterModuleWithin(
        asDomainDb(db), demoSession(scope, actorUserId), moduleKey, enabled, 'demo',
      );
    },
    setUserActiveWithin(
      db: DemoOrm,
      scope: Scope,
      actorUserId: number,
      targetUserId: number,
      isActive: boolean,
    ) {
      return setUserActiveWithin(
        asDomainDb(db), demoSession(scope, actorUserId), targetUserId, isActive, 'demo',
      );
    },
    createRoleWithin(db: DemoOrm, scope: Scope, actorUserId: number, name: string) {
      return createRoleWithin(asDomainDb(db), demoSession(scope, actorUserId), name, 'demo');
    },
    setRolePermissionWithin(
      db: DemoOrm,
      scope: Scope,
      actorUserId: number,
      roleId: number,
      permissionKey: string,
      allowed: boolean,
    ) {
      return setRolePermissionWithin(
        asDomainDb(db), demoSession(scope, actorUserId), roleId, permissionKey, allowed, 'demo',
      );
    },
    createInvitation(
      db: DemoOrm,
      scope: Scope,
      actorUserId: number,
      input: { email: string; roleId: number },
    ) {
      return createDemoInvitation(db, scope, actorUserId, input);
    },
    /* Generic audit sink for the demo adapter's own create()/action() dispatch --
       see the header comment on this file's admin-lifecycle imports. Production
       writes audit through routes/resources.ts / actionDispatcher.ts; the demo
       adapter calls *Within commands directly and never went through that layer,
       so audit_log was permanently empty in browser demo mode until this call
       site existed. Best-effort by design (see erp-system-data-adapter.js's
       caller) -- an audit-write failure must never block the user-visible action
       that already succeeded. */
    appendDemoAudit(
      db: DemoOrm,
      scope: Scope,
      actorUserId: number | null,
      entity: string,
      entityId: number | string | null,
      action: string,
    ) {
      return appendAudit(asDomainDb(db), {
        masterFn: scope.masterFn,
        companyFn: scope.companyFn,
        actorUserId,
        requestId: 'demo',
        entity,
        entityId,
        action,
      });
    },
    confirmSalesOrder(db: DemoOrm, scope: Scope, input: ConfirmOrderInput) {
      return confirmSalesOrder(asDomainDb(db), scope, input);
    },
    confirmDraftSalesOrderWithin(db: DemoOrm, scope: Scope, input: ConfirmDraftOrderInput) {
      return confirmDraftSalesOrderWithin(asDomainDb(db), scope, input);
    },
    createSalesOrderWithin(db: DemoOrm, scope: Scope, input: CreateSalesOrderInput) {
      return createSalesOrderWithin(asDomainDb(db), scope, input);
    },
    decideSalesOrderWithin(
      db: DemoOrm,
      scope: Scope,
      orderId: number,
      input: DecideSalesOrderInput,
    ) {
      return decideSalesOrderWithin(asDomainDb(db), scope, orderId, input);
    },
    listSalesAnalyticsWithin(
      db: DemoOrm,
      scope: Scope,
      input: { cursor?: number; limit?: number },
    ) {
      return listSalesAnalyticsWithin(asDomainDb(db), scope, input);
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
    decidePurchaseOrderWithin(
      db: DemoOrm,
      scope: Scope,
      orderId: number,
      input: DecidePurchaseOrderInput,
    ) {
      return decidePurchaseOrderWithin(asDomainDb(db), scope, orderId, input);
    },
    createPurchaseRfqWithin(db: DemoOrm, scope: Scope, input: CreatePurchaseRfqInput) {
      return createPurchaseRfqWithin(asDomainDb(db), scope, input);
    },
    transitionPurchaseRfqWithin(
      db: DemoOrm,
      scope: Scope,
      rfqId: number,
      transition: 'issue' | 'close',
    ) {
      return transitionPurchaseRfqWithin(asDomainDb(db), scope, rfqId, transition);
    },
    createSupplierQuotationWithin(
      db: DemoOrm,
      scope: Scope,
      input: CreateSupplierQuotationInput,
    ) {
      return createSupplierQuotationWithin(asDomainDb(db), scope, input);
    },
    convertSupplierQuotationToPurchaseOrderWithin(
      db: DemoOrm,
      scope: Scope,
      quotationId: number,
      input: { docNo: string; orderDate: string },
    ) {
      return convertSupplierQuotationToPurchaseOrderWithin(
        asDomainDb(db), scope, quotationId, input,
      );
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
    createPurchaseReturnWithin(db: DemoOrm, scope: Scope, input: CreatePurchaseReturnInput) {
      return createPurchaseReturnWithin(asDomainDb(db), scope, input);
    },
    shipAndCreditPurchaseReturnWithin(
      db: DemoOrm,
      scope: Scope,
      returnId: number,
      input: ShipAndCreditPurchaseReturnInput,
    ) {
      return shipAndCreditPurchaseReturnWithin(asDomainDb(db), scope, returnId, input);
    },
    rejectPurchaseReturnWithin(db: DemoOrm, scope: Scope, returnId: number) {
      return rejectPurchaseReturnWithin(asDomainDb(db), scope, returnId);
    },
    createSupplierDebitNoteWithin(db: DemoOrm, scope: Scope, input: CreateSupplierDebitNoteInput) {
      return createSupplierDebitNoteWithin(asDomainDb(db), scope, input);
    },
    postSupplierDebitNoteWithin(db: DemoOrm, scope: Scope, debitNoteId: number) {
      return postSupplierDebitNoteWithin(asDomainDb(db), scope, debitNoteId);
    },
    createLandedCostWithin(db: DemoOrm, scope: Scope, input: CreateLandedCostInput) {
      return createLandedCostWithin(asDomainDb(db), scope, input);
    },
    allocateLandedCostWithin(db: DemoOrm, scope: Scope, landedCostId: number) {
      return allocateLandedCostWithin(asDomainDb(db), scope, landedCostId);
    },
    createSupplierPriceListWithin(
      db: DemoOrm,
      scope: Scope,
      input: CreateSupplierPriceListInput,
    ) {
      return createSupplierPriceListWithin(asDomainDb(db), scope, input);
    },
    activateSupplierPriceListWithin(db: DemoOrm, scope: Scope, priceListId: number) {
      return activateSupplierPriceListWithin(asDomainDb(db), scope, priceListId);
    },
    listVendorPerformanceWithin(
      db: DemoOrm,
      scope: Scope,
      input: { cursor?: number; limit?: number },
    ) {
      return listVendorPerformanceWithin(asDomainDb(db), scope, input);
    },
    listPurchasingAnalyticsWithin(
      db: DemoOrm,
      scope: Scope,
      input: { cursor?: number; limit?: number },
    ) {
      return listPurchasingAnalyticsWithin(asDomainDb(db), scope, input);
    },
    listPurchasePriceVarianceWithin(
      db: DemoOrm,
      scope: Scope,
      input: { cursor?: number; limit?: number },
    ) {
      return listPurchasePriceVarianceWithin(asDomainDb(db), scope, input);
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
    markOpportunityLostWithin(
      db: DemoOrm,
      scope: Scope,
      opportunityId: number,
      reason: string,
    ) {
      return markOpportunityLostWithin(asDomainDb(db), scope, opportunityId, reason);
    },
  }),
});

export type ErpDemoRuntime = typeof erpDemoRuntime;
