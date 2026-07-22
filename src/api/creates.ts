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
  createProductWithin,
  type CreateProductInput,
} from '../modules/inventory/product';
import {
  createPurchaseOrderWithin,
  type CreatePurchaseOrderInput,
} from '../modules/purchasing/createPurchaseOrder';
import {
  createPurchaseRequisitionWithin,
  type CreatePurchaseRequisitionInput,
} from '../modules/purchasing/purchaseRequisition';
import {
  createPurchaseRfqWithin,
  createSupplierQuotationWithin,
  type CreatePurchaseRfqInput,
  type CreateSupplierQuotationInput,
} from '../modules/purchasing/rfq';
import {
  createOpportunity,
  type CreateOpportunityInput,
} from '../modules/crm/createOpportunity';
import {
  createContactWithin,
  type CreateContactInput,
} from '../modules/crm/contact';
import {
  createCustomerActivityWithin,
  type CreateCustomerActivityInput,
} from '../modules/crm/activity';
import {
  createWarehousePickWithin,
  type CreateWarehousePickInput,
} from '../modules/warehouse/picking';
import {
  createWorkOrderWithin,
  type CreateWorkOrderInput,
} from '../modules/manufacturing/workOrder';
import { runMrpWithin, type RunMrpInput } from '../modules/manufacturing/mrp';
import {
  createInspectionWithin,
  createNcrWithin,
  type CreateInspectionInput,
  type CreateNcrInput,
} from '../modules/quality/inspection';
import {
  createSalesEnquiryWithin,
  createSalesQuotationWithin,
  type CreateSalesEnquiryInput,
  type CreateSalesQuotationInput,
} from '../modules/sales/quotation';
import {
  createSalesReturnWithin,
  type CreateSalesReturnInput,
} from '../modules/sales/return';
import {
  createSalesDebitNoteWithin,
  type CreateSalesDebitNoteInput,
} from '../modules/sales/debitNote';
import {
  createDiscountRuleWithin,
  createPriceListWithin,
  type CreateDiscountRuleInput,
  type CreatePriceListInput,
} from '../modules/sales/pricing';
import {
  createCreditProfileWithin,
  type CreateCreditProfileInput,
} from '../modules/sales/creditControl';
import {
  createAssetWithin,
  type CreateAssetInput,
} from '../modules/assets/createAsset';
import {
  createDepreciationRunWithin,
  type CreateDepreciationRunInput,
} from '../modules/assets/depreciationRun';
import {
  createEmployeeWithin,
  type CreateEmployeeInput,
} from '../modules/hr/employee';
import {
  createLeaveRequestWithin,
  type CreateLeaveRequestInput,
} from '../modules/hr/leaveRequest';
import {
  createPayrollRunWithin,
  type CreatePayrollRunInput,
} from '../modules/payroll/payrollRun';
import {
  createProjectWithin,
  type CreateProjectInput,
} from '../modules/project/project';
import {
  createProgressClaimWithin,
  type CreateProgressClaimInput,
} from '../modules/project/progressClaim';
import {
  createServiceContractWithin,
  type CreateServiceContractInput,
} from '../modules/service/serviceContract';
import {
  createServiceTicketWithin,
  type CreateServiceTicketInput,
} from '../modules/service/serviceTicket';
import {
  createBankReceiptWithin,
  type CreateBankReceiptInput,
} from '../modules/finance/bankReceipt';
import {
  createPaymentVoucherWithin,
  type CreatePaymentVoucherInput,
} from '../modules/finance/paymentVoucher';

export interface CreateDefinition {
  permission: string;
  audit: 'required';
  execute(tx: DB, scope: Scope, payload: Record<string, unknown>): Promise<unknown>;
}

const CREATES: Record<string, CreateDefinition> = {
  'inventory/products': {
    permission: 'inventory.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createProductWithin(tx, scope, payload as unknown as CreateProductInput);
    },
  },
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
          || !Number.isFinite(Number(line.qty))
          || Number(line.qty) <= 0
          || !Number.isFinite(Number(line.unitCost))
          || Number(line.unitCost) < 0
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
  'purchasing/purchase-requisitions': {
    permission: 'purchasing.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createPurchaseRequisitionWithin(tx, scope, payload as unknown as CreatePurchaseRequisitionInput);
    },
  },
  'purchasing/rfqs': {
    permission: 'purchasing.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createPurchaseRfqWithin(tx, scope, payload as unknown as CreatePurchaseRfqInput);
    },
  },
  'purchasing/supplier-quotations': {
    permission: 'purchasing.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createSupplierQuotationWithin(
        tx,
        scope,
        payload as unknown as CreateSupplierQuotationInput,
      );
    },
  },
  'crm/contacts': {
    permission: 'crm.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createContactWithin(tx, scope, payload as unknown as CreateContactInput);
    },
  },
  'crm/activities': {
    permission: 'crm.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createCustomerActivityWithin(
        tx,
        scope,
        payload as unknown as CreateCustomerActivityInput,
      );
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
  'manufacturing/work-orders': {
    permission: 'manufacturing.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createWorkOrderWithin(
        tx,
        scope,
        payload as unknown as CreateWorkOrderInput,
      );
    },
  },
  'manufacturing/mrp-runs': {
    permission: 'manufacturing.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return runMrpWithin(tx, scope, payload as unknown as RunMrpInput);
    },
  },
  'quality/inspections': {
    permission: 'quality.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createInspectionWithin(tx, scope, payload as unknown as CreateInspectionInput);
    },
  },
  'quality/ncrs': {
    permission: 'quality.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createNcrWithin(tx, scope, payload as unknown as CreateNcrInput);
    },
  },
  'sales/enquiries': {
    permission: 'sales.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createSalesEnquiryWithin(
        tx,
        scope,
        payload as unknown as CreateSalesEnquiryInput,
      );
    },
  },
  'sales/quotations': {
    permission: 'sales.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createSalesQuotationWithin(
        tx,
        scope,
        payload as unknown as CreateSalesQuotationInput,
      );
    },
  },
  'sales/returns': {
    permission: 'sales.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createSalesReturnWithin(
        tx,
        scope,
        payload as unknown as CreateSalesReturnInput,
      );
    },
  },
  'sales/debit-notes': {
    permission: 'sales.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createSalesDebitNoteWithin(
        tx,
        scope,
        payload as unknown as CreateSalesDebitNoteInput,
      );
    },
  },
  'sales/price-lists': {
    permission: 'sales.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createPriceListWithin(tx, scope, payload as unknown as CreatePriceListInput);
    },
  },
  'sales/discount-rules': {
    permission: 'sales.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createDiscountRuleWithin(tx, scope, payload as unknown as CreateDiscountRuleInput);
    },
  },
  'sales/credit-profiles': {
    permission: 'sales.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createCreditProfileWithin(tx, scope, payload as unknown as CreateCreditProfileInput);
    },
  },
  'assets/assets': {
    permission: 'asset.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createAssetWithin(tx, scope, payload as unknown as CreateAssetInput);
    },
  },
  'assets/depreciation-runs': {
    permission: 'asset.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createDepreciationRunWithin(tx, scope, payload as unknown as CreateDepreciationRunInput);
    },
  },
  'hr/employees': {
    permission: 'hr.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createEmployeeWithin(tx, scope, payload as unknown as CreateEmployeeInput);
    },
  },
  'hr/leave-requests': {
    permission: 'hr.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createLeaveRequestWithin(tx, scope, payload as unknown as CreateLeaveRequestInput);
    },
  },
  'payroll/runs': {
    permission: 'payroll.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createPayrollRunWithin(tx, scope, payload as unknown as CreatePayrollRunInput);
    },
  },
  'project/projects': {
    permission: 'project.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createProjectWithin(tx, scope, payload as unknown as CreateProjectInput);
    },
  },
  'project/progress-claims': {
    permission: 'project.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createProgressClaimWithin(tx, scope, payload as unknown as CreateProgressClaimInput);
    },
  },
  'finance/bank-receipts': {
    permission: 'finance.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createBankReceiptWithin(tx, scope, payload as unknown as CreateBankReceiptInput);
    },
  },
  'finance/payment-vouchers': {
    permission: 'finance.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createPaymentVoucherWithin(tx, scope, payload as unknown as CreatePaymentVoucherInput);
    },
  },
  'service/contracts': {
    permission: 'service.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createServiceContractWithin(tx, scope, payload as unknown as CreateServiceContractInput);
    },
  },
  'service/tickets': {
    permission: 'service.write',
    audit: 'required',
    execute(tx, scope, payload) {
      return createServiceTicketWithin(tx, scope, payload as unknown as CreateServiceTicketInput);
    },
  },
};

export function createDefinitionFor(resource: string): CreateDefinition | null {
  return CREATES[resource] ?? null;
}
