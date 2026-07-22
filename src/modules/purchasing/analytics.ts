import {
  and, asc, count, countDistinct, desc, eq, gt, inArray, isNull, ne, sql, sum,
} from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  goodsReceipt,
  purchaseOrder,
  purchaseOrderApproval,
  purchaseRequisition,
  supplier,
  supplierCreditNote,
  supplierDebitNote,
  supplierInvoice,
  supplierPriceList,
  supplierQuotation,
} from '../../data/schema';

export interface PurchasingAnalyticsPageInput {
  cursor?: number;
  limit?: number;
}

type AnalyticsRow = Record<string, unknown> & { id: number; kind: string };

function decimal(value: unknown) {
  return new Decimal(value == null || value === '' ? 0 : String(value));
}

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function syntheticPage(rows: AnalyticsRow[], input: PurchasingAnalyticsPageInput) {
  const cursor = Number.isSafeInteger(input.cursor) && Number(input.cursor) >= 0
    ? Number(input.cursor) : 0;
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
  const candidates = rows.filter((row) => row.id > cursor).sort((a, b) => a.id - b.id);
  const hasMore = candidates.length > limit;
  const data = hasMore ? candidates.slice(0, limit) : candidates;
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}

/**
 * Bounded, rebuildable purchasing analytics. The rows are grouped database facts,
 * not a second KPI store: rerunning this function after a transaction immediately
 * reflects the new PO, receipt, invoice, return, approval or contract state.
 */
export async function listPurchasingAnalyticsWithin(
  exec: DB,
  scope: Scope,
  input: PurchasingAnalyticsPageInput = {},
) {
  const tenant = and(
    eq(purchaseOrder.masterFn, scope.masterFn),
    eq(purchaseOrder.companyFn, scope.companyFn),
  );
  const invoiceTenant = and(
    eq(supplierInvoice.masterFn, scope.masterFn),
    eq(supplierInvoice.companyFn, scope.companyFn),
  );

  const [
    [supplierTotals], [openOrderTotals], [pendingApprovalTotals], [receiptTotals],
    [uninvoicedReceiptTotals], [grossApTotals], [creditTotals], [debitTotals],
    [activeContractTotals], [openRequisitionTotals], [overdueOrderTotals],
    [mismatchTotals], monthlyRows, buyerRows, orderStatusRows, invoiceStatusRows,
    requisitionStatusRows,
  ] = await Promise.all([
    exec.select({ total: count() }).from(supplier).where(and(
      eq(supplier.masterFn, scope.masterFn), eq(supplier.companyFn, scope.companyFn),
    )),
    exec.select({ total: count(), value: sum(purchaseOrder.totalAmount) })
      .from(purchaseOrder).where(and(
        tenant, inArray(purchaseOrder.status, ['pending_approval', 'open']),
      )),
    exec.select({ total: count(), value: sum(purchaseOrder.totalAmount) })
      .from(purchaseOrder).where(and(tenant, eq(purchaseOrder.status, 'pending_approval'))),
    exec.select({ total: count() }).from(goodsReceipt).where(and(
      eq(goodsReceipt.masterFn, scope.masterFn), eq(goodsReceipt.companyFn, scope.companyFn),
    )),
    exec.select({ total: countDistinct(goodsReceipt.id) }).from(goodsReceipt)
      .leftJoin(supplierInvoice, and(
        eq(supplierInvoice.masterFn, goodsReceipt.masterFn),
        eq(supplierInvoice.companyFn, goodsReceipt.companyFn),
        eq(supplierInvoice.orderId, goodsReceipt.orderId),
        ne(supplierInvoice.status, 'cancelled'),
      )).where(and(
        eq(goodsReceipt.masterFn, scope.masterFn),
        eq(goodsReceipt.companyFn, scope.companyFn),
        isNull(supplierInvoice.id),
      )),
    exec.select({ value: sum(supplierInvoice.totalAmount) }).from(supplierInvoice).where(and(
      invoiceTenant, eq(supplierInvoice.status, 'unpaid'),
    )),
    exec.select({ value: sum(supplierCreditNote.totalAmount) }).from(supplierCreditNote)
      .innerJoin(supplierInvoice, and(
        eq(supplierInvoice.id, supplierCreditNote.supplierInvoiceId),
        eq(supplierInvoice.masterFn, supplierCreditNote.masterFn),
        eq(supplierInvoice.companyFn, supplierCreditNote.companyFn),
      )).where(and(
        eq(supplierCreditNote.masterFn, scope.masterFn),
        eq(supplierCreditNote.companyFn, scope.companyFn),
        eq(supplierCreditNote.status, 'posted'),
        eq(supplierInvoice.status, 'unpaid'),
      )),
    exec.select({ value: sum(supplierDebitNote.totalAmount) }).from(supplierDebitNote)
      .innerJoin(supplierInvoice, and(
        eq(supplierInvoice.id, supplierDebitNote.supplierInvoiceId),
        eq(supplierInvoice.masterFn, supplierDebitNote.masterFn),
        eq(supplierInvoice.companyFn, supplierDebitNote.companyFn),
      )).where(and(
        eq(supplierDebitNote.masterFn, scope.masterFn),
        eq(supplierDebitNote.companyFn, scope.companyFn),
        eq(supplierDebitNote.status, 'posted'),
        eq(supplierInvoice.status, 'unpaid'),
      )),
    exec.select({ total: count() }).from(supplierPriceList).where(and(
      eq(supplierPriceList.masterFn, scope.masterFn),
      eq(supplierPriceList.companyFn, scope.companyFn),
      eq(supplierPriceList.status, 'active'),
      sql`${supplierPriceList.effectiveFrom} <= current_date`,
      sql`(${supplierPriceList.effectiveTo} is null or ${supplierPriceList.effectiveTo} >= current_date)`,
    )),
    exec.select({ total: count() }).from(purchaseRequisition).where(and(
      eq(purchaseRequisition.masterFn, scope.masterFn),
      eq(purchaseRequisition.companyFn, scope.companyFn),
      inArray(purchaseRequisition.status, ['submitted', 'approved']),
    )),
    exec.select({ total: count() }).from(purchaseOrder)
      .innerJoin(supplierQuotation, and(
        eq(supplierQuotation.id, purchaseOrder.supplierQuotationId),
        eq(supplierQuotation.masterFn, purchaseOrder.masterFn),
        eq(supplierQuotation.companyFn, purchaseOrder.companyFn),
      )).where(and(
        tenant, eq(purchaseOrder.status, 'open'),
        sql`${purchaseOrder.orderDate} + ${supplierQuotation.leadTimeDays} < current_date`,
      )),
    exec.select({ total: count() }).from(supplierInvoice)
      .innerJoin(purchaseOrder, and(
        eq(purchaseOrder.id, supplierInvoice.orderId),
        eq(purchaseOrder.masterFn, supplierInvoice.masterFn),
        eq(purchaseOrder.companyFn, supplierInvoice.companyFn),
      )).where(and(
        invoiceTenant, ne(supplierInvoice.status, 'cancelled'),
        sql`${supplierInvoice.totalAmount} <> ${purchaseOrder.totalAmount}`,
      )),
    exec.select({
      period: sql<string>`to_char(${supplierInvoice.invoiceDate}, 'YYYY-MM')`,
      invoiceCount: count(), spend: sum(supplierInvoice.totalAmount),
    }).from(supplierInvoice).where(and(invoiceTenant, ne(supplierInvoice.status, 'cancelled')))
      .groupBy(sql`to_char(${supplierInvoice.invoiceDate}, 'YYYY-MM')`)
      .orderBy(desc(sql`to_char(${supplierInvoice.invoiceDate}, 'YYYY-MM')`)).limit(24),
    exec.select({
      userId: purchaseOrderApproval.decidedByUserId,
      buyer: purchaseOrderApproval.decidedByName,
      orderCount: count(), value: sum(purchaseOrder.totalAmount),
    }).from(purchaseOrderApproval).innerJoin(purchaseOrder, and(
      eq(purchaseOrder.id, purchaseOrderApproval.orderId),
      eq(purchaseOrder.masterFn, purchaseOrderApproval.masterFn),
      eq(purchaseOrder.companyFn, purchaseOrderApproval.companyFn),
    )).where(and(
      eq(purchaseOrderApproval.masterFn, scope.masterFn),
      eq(purchaseOrderApproval.companyFn, scope.companyFn),
      eq(purchaseOrderApproval.status, 'approved'),
    )).groupBy(
      purchaseOrderApproval.decidedByUserId, purchaseOrderApproval.decidedByName,
    ).orderBy(desc(sum(purchaseOrder.totalAmount))).limit(50),
    exec.select({ status: purchaseOrder.status, total: count(), value: sum(purchaseOrder.totalAmount) })
      .from(purchaseOrder).where(tenant).groupBy(purchaseOrder.status)
      .orderBy(asc(purchaseOrder.status)),
    exec.select({ status: supplierInvoice.status, total: count(), value: sum(supplierInvoice.totalAmount) })
      .from(supplierInvoice).where(invoiceTenant).groupBy(supplierInvoice.status)
      .orderBy(asc(supplierInvoice.status)),
    exec.select({ status: purchaseRequisition.status, total: count(), value: sum(purchaseRequisition.estimatedValue) })
      .from(purchaseRequisition).where(and(
        eq(purchaseRequisition.masterFn, scope.masterFn),
        eq(purchaseRequisition.companyFn, scope.companyFn),
      )).groupBy(purchaseRequisition.status).orderBy(asc(purchaseRequisition.status)),
  ]);

  const grossAp = decimal(grossApTotals?.value);
  const credits = decimal(creditTotals?.value);
  const debits = decimal(debitTotals?.value);
  const rows: AnalyticsRow[] = [{
    id: 1, kind: 'summary', supplierCount: integer(supplierTotals?.total),
    openOrderCount: integer(openOrderTotals?.total),
    openOrderValue: decimal(openOrderTotals?.value).toFixed(2),
    pendingApprovalCount: integer(pendingApprovalTotals?.total),
    pendingApprovalValue: decimal(pendingApprovalTotals?.value).toFixed(2),
    pendingReceiptCount: orderStatusRows
      .filter((row) => row.status === 'open').reduce((total, row) => total + integer(row.total), 0),
    overdueOrderCount: integer(overdueOrderTotals?.total),
    receiptCount: integer(receiptTotals?.total),
    uninvoicedReceiptCount: integer(uninvoicedReceiptTotals?.total),
    invoiceMismatchCount: integer(mismatchTotals?.total),
    grossUnpaidAp: grossAp.toFixed(2),
    postedAdjustments: credits.plus(debits).toFixed(2),
    netUnpaidAp: Decimal.max(0, grossAp.minus(credits).minus(debits)).toFixed(2),
    activeContractCount: integer(activeContractTotals?.total),
    openRequisitionCount: integer(openRequisitionTotals?.total),
  }];

  monthlyRows.slice().reverse().forEach((row, index) => rows.push({
    id: 1000 + index, kind: 'monthly-spend', period: row.period,
    invoiceCount: integer(row.invoiceCount), spend: decimal(row.spend).toFixed(2),
  }));
  buyerRows.forEach((row, index) => rows.push({
    id: 2000 + index, kind: 'buyer-spend', userId: row.userId,
    buyer: row.buyer || 'Unassigned', orderCount: integer(row.orderCount),
    approvedOrderValue: decimal(row.value).toFixed(2),
  }));
  orderStatusRows.forEach((row, index) => rows.push({
    id: 3000 + index, kind: 'order-status', status: row.status,
    count: integer(row.total), value: decimal(row.value).toFixed(2),
  }));
  invoiceStatusRows.forEach((row, index) => rows.push({
    id: 4000 + index, kind: 'invoice-status', status: row.status,
    count: integer(row.total), value: decimal(row.value).toFixed(2),
  }));
  requisitionStatusRows.forEach((row, index) => rows.push({
    id: 5000 + index, kind: 'requisition-status', status: row.status,
    count: integer(row.total), value: decimal(row.value).toFixed(2),
  }));
  return syntheticPage(rows, input);
}

/** Header-level 3-way price proof. Supplier invoice lines are not a domain table,
 * so this deliberately compares immutable invoice and PO header snapshots instead
 * of inventing item-level variance rows. */
export async function listPurchasePriceVarianceWithin(
  exec: DB,
  scope: Scope,
  input: PurchasingAnalyticsPageInput = {},
) {
  const cursor = Number.isSafeInteger(input.cursor) && Number(input.cursor) >= 0
    ? Number(input.cursor) : 0;
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
  const records = await exec.select({
    id: supplierInvoice.id,
    invoiceNo: supplierInvoice.docNo,
    invoiceDate: supplierInvoice.invoiceDate,
    invoiceStatus: supplierInvoice.status,
    currency: supplierInvoice.currency,
    invoiceTotal: supplierInvoice.totalAmount,
    orderId: purchaseOrder.id,
    orderNo: purchaseOrder.docNo,
    orderTotal: purchaseOrder.totalAmount,
    supplierId: supplier.id,
    supplierCode: supplier.code,
    supplierName: supplier.name,
  }).from(supplierInvoice).innerJoin(purchaseOrder, and(
    eq(purchaseOrder.id, supplierInvoice.orderId),
    eq(purchaseOrder.masterFn, supplierInvoice.masterFn),
    eq(purchaseOrder.companyFn, supplierInvoice.companyFn),
  )).innerJoin(supplier, and(
    eq(supplier.id, supplierInvoice.supplierId),
    eq(supplier.masterFn, supplierInvoice.masterFn),
    eq(supplier.companyFn, supplierInvoice.companyFn),
  )).where(and(
    eq(supplierInvoice.masterFn, scope.masterFn),
    eq(supplierInvoice.companyFn, scope.companyFn),
    gt(supplierInvoice.id, cursor),
    ne(supplierInvoice.status, 'cancelled'),
  )).orderBy(asc(supplierInvoice.id)).limit(limit + 1);
  const hasMore = records.length > limit;
  const page = hasMore ? records.slice(0, limit) : records;
  const data = page.map((row) => {
    const variance = decimal(row.invoiceTotal).minus(row.orderTotal);
    return {
      ...row,
      variance: variance.toFixed(2),
      variancePct: decimal(row.orderTotal).isZero()
        ? null : variance.div(row.orderTotal).mul(100).toDecimalPlaces(2).toFixed(2),
      matchStatus: variance.isZero() ? 'matched' : 'variance',
    };
  });
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}
