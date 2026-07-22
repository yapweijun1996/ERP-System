// Purchasing — create a purchase order: header + lines, effective-dated tax snapshot
// per line, in ONE transaction. No stock or GL impact yet — a PO is a commitment
// document; those happen later at receiveGoods.ts (stock) and
// postSupplierInvoice.ts (GL). Mirrors confirmOrder.ts's line-processing discipline
// minus the stock-issue step. See docs/DATA_MODEL.md §4.
import { and, eq, inArray, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { getEffectiveTaxRate } from '../../data/repo';
import {
  product,
  project,
  purchaseOrder,
  purchaseOrderApproval,
  purchaseOrderLine,
  purchaseRequisition,
  purchaseRfq,
  supplier,
  supplierQuotation,
} from '../../data/schema';
import { PostingError } from './errors';

export interface PurchaseOrderLineInput {
  productId: number;
  qty: number | string;
  unitCost: number | string;
  taxCode: string;
}
export interface CreatePurchaseOrderInput {
  docNo: string;
  supplierId: number;
  orderDate: string; // YYYY-MM-DD
  currency: string;
  lines: PurchaseOrderLineInput[];
  /** Optional: link this PO back to the approved requisition it fulfils. Must be
   *  'approved' and not already linked to another purchase order. */
  requisitionId?: number | null;
  /** Optional: trace the PO to the selected supplier quotation. The quotation must
   *  still be received, belong to this supplier and not already back another PO. */
  supplierQuotationId?: number | null;
  /** Optional: tag this PO to a project, so its eventual supplier invoice carries a
   *  real project cost trail (see postSupplierInvoice.ts, which copies this onto the
   *  invoice automatically). */
  projectId?: number | null;
}

function positiveDecimal(value: number | string, label: string, allowZero = false): Decimal {
  let result: Decimal;
  try {
    result = new Decimal(value);
  } catch {
    throw new PostingError(`${label} must be a valid decimal`);
  }
  if (!result.isFinite() || (allowZero ? result.isNegative() : result.lte(0))) {
    throw new PostingError(`${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'}`);
  }
  return result;
}

/** Create a purchase order. Returns a summary. Throws (and rolls back everything) if
 *  no tax rule covers a line's date. */
export async function createPurchaseOrderWithin(exec: DB, scope: Scope, input: CreatePurchaseOrderInput) {
  if (!input.lines.length) throw new PostingError('A purchase order requires at least one line');
  const [supplierRow] = await exec.select({ id: supplier.id }).from(supplier).where(and(
    eq(supplier.masterFn, scope.masterFn),
    eq(supplier.companyFn, scope.companyFn),
    eq(supplier.id, input.supplierId),
  ));
  if (!supplierRow) throw new PostingError(`Supplier ${input.supplierId} is not available in this company`);
  const productIds = [...new Set(input.lines.map((line) => line.productId))];
  const companyProducts = await exec.select({ id: product.id }).from(product).where(and(
    eq(product.masterFn, scope.masterFn),
    eq(product.companyFn, scope.companyFn),
    inArray(product.id, productIds),
  ));
  if (companyProducts.length !== productIds.length) {
    throw new PostingError('One or more products are not available in this company');
  }

  let requisitionId: number | null = null;
  let requisitionRfqId: number | null = null;
  if (input.requisitionId != null) {
    const [reqRow] = await exec.select({ id: purchaseRequisition.id, status: purchaseRequisition.status })
      .from(purchaseRequisition).where(and(
        eq(purchaseRequisition.masterFn, scope.masterFn),
        eq(purchaseRequisition.companyFn, scope.companyFn),
        eq(purchaseRequisition.id, input.requisitionId),
      ));
    if (!reqRow) throw new PostingError(`Purchase requisition ${input.requisitionId} is not available in this company`);
    if (reqRow.status !== 'approved') {
      throw new PostingError(`Purchase requisition ${input.requisitionId} must be approved before it can be converted to a purchase order`);
    }
    const [existingLink] = await exec.select({ id: purchaseOrder.id }).from(purchaseOrder).where(and(
      eq(purchaseOrder.masterFn, scope.masterFn),
      eq(purchaseOrder.companyFn, scope.companyFn),
      eq(purchaseOrder.requisitionId, input.requisitionId),
    ));
    if (existingLink) {
      throw new PostingError(`Purchase requisition ${input.requisitionId} has already been converted to a purchase order`);
    }
    const [rfqLink] = await exec.select({ id: purchaseRfq.id }).from(purchaseRfq).where(and(
      eq(purchaseRfq.masterFn, scope.masterFn),
      eq(purchaseRfq.companyFn, scope.companyFn),
      eq(purchaseRfq.requisitionId, input.requisitionId),
    ));
    if (rfqLink && input.supplierQuotationId == null) {
      throw new PostingError(`Purchase requisition ${input.requisitionId} is under RFQ sourcing and must be converted from its winning quotation`);
    }
    requisitionRfqId = rfqLink?.id ?? null;
    requisitionId = reqRow.id;
  }

  let projectId: number | null = null;
  if (input.projectId != null) {
    const [projectRow] = await exec.select({ id: project.id }).from(project).where(and(
      eq(project.masterFn, scope.masterFn),
      eq(project.companyFn, scope.companyFn),
      eq(project.id, input.projectId),
    ));
    if (!projectRow) throw new PostingError(`Project ${input.projectId} is not available in this company`);
    projectId = projectRow.id;
  }

  let supplierQuotationId: number | null = null;
  if (input.supplierQuotationId != null) {
    const [quoteRow] = await exec.select({
      id: supplierQuotation.id,
      rfqId: supplierQuotation.rfqId,
      supplierId: supplierQuotation.supplierId,
      status: supplierQuotation.status,
    }).from(supplierQuotation).where(and(
      eq(supplierQuotation.masterFn, scope.masterFn),
      eq(supplierQuotation.companyFn, scope.companyFn),
      eq(supplierQuotation.id, input.supplierQuotationId),
    ));
    if (!quoteRow) {
      throw new PostingError(`Supplier quotation ${input.supplierQuotationId} is not available in this company`);
    }
    if (quoteRow.supplierId !== input.supplierId || quoteRow.status !== 'received') {
      throw new PostingError('Only a received quotation from the selected supplier can create this purchase order');
    }
    const [existingLink] = await exec.select({ id: purchaseOrder.id }).from(purchaseOrder).where(and(
      eq(purchaseOrder.masterFn, scope.masterFn),
      eq(purchaseOrder.companyFn, scope.companyFn),
      eq(purchaseOrder.supplierQuotationId, quoteRow.id),
    ));
    if (existingLink) {
      throw new PostingError(`Supplier quotation ${input.supplierQuotationId} has already been converted to a purchase order`);
    }
    if (requisitionRfqId != null && quoteRow.rfqId !== requisitionRfqId) {
      throw new PostingError('The supplier quotation does not belong to this requisition RFQ');
    }
    supplierQuotationId = quoteRow.id;
  }

  const [order] = await exec.insert(purchaseOrder).values({
    masterFn: scope.masterFn, companyFn: scope.companyFn,
    docNo: input.docNo, supplierId: input.supplierId, requisitionId, supplierQuotationId, projectId,
    status: 'pending_approval', orderDate: input.orderDate, currency: input.currency,
  }).returning({ id: purchaseOrder.id });

  const [approval] = await exec.insert(purchaseOrderApproval).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    orderId: order.id,
    status: 'pending',
  }).returning({ id: purchaseOrderApproval.id });

  let netTotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  let lineNo = 0;
  for (const ln of input.lines) {
    lineNo += 1;
    const taxRow = await getEffectiveTaxRate(exec, scope, ln.taxCode, input.orderDate);
    if (!taxRow) throw new PostingError(`No tax rule for ${ln.taxCode} on ${input.orderDate}`);
    const qty = positiveDecimal(ln.qty, `Line ${lineNo} quantity`);
    const unitCost = positiveDecimal(ln.unitCost, `Line ${lineNo} unit cost`, true);
    const rate = new Decimal(taxRow.rate);
    const net = qty.mul(unitCost).toDecimalPlaces(2);
    const tax = net.mul(rate).div(100).toDecimalPlaces(2);

    await exec.insert(purchaseOrderLine).values({
      masterFn: scope.masterFn, companyFn: scope.companyFn,
      orderId: order.id, lineNo,
      productId: ln.productId, qty: qty.toFixed(4), unitCost: unitCost.toFixed(4),
      netAmount: net.toFixed(2), taxCode: ln.taxCode, taxRate: rate.toFixed(3), taxAmount: tax.toFixed(2),
    });

    netTotal = netTotal.plus(net);
    taxTotal = taxTotal.plus(tax);
  }
  const grandTotal = netTotal.plus(taxTotal);

  await exec.update(purchaseOrder).set({
    netAmount: netTotal.toFixed(2), taxAmount: taxTotal.toFixed(2), totalAmount: grandTotal.toFixed(2),
    updatedAt: sql`now()`,
  }).where(eq(purchaseOrder.id, order.id));

  return {
    id: order.id,
    orderId: order.id,
    approvalId: approval.id,
    status: 'pending_approval' as const,
    net: netTotal.toNumber(),
    tax: taxTotal.toNumber(),
    total: grandTotal.toNumber(),
    lines: input.lines.length,
  };
}

export async function createPurchaseOrder(db: DB, scope: Scope, input: CreatePurchaseOrderInput) {
  return db.transaction((tx) => createPurchaseOrderWithin(tx, scope, input));
}
