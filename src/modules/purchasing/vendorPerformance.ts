import { and, eq, gt, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  goodsReceipt,
  purchaseOrder,
  purchaseOrderLine,
  purchaseReturn,
  supplier,
  supplierInvoice,
  supplierPriceList,
  supplierPriceListLine,
  supplierQuotation,
} from '../../data/schema';

export interface VendorPerformancePageInput {
  cursor?: number;
  limit?: number;
}

function pct(numerator: Decimal, denominator: Decimal) {
  if (denominator.isZero()) return null;
  return numerator.div(denominator).mul(100).toDecimalPlaces(1).toFixed(1);
}

function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Rebuildable supplier scorecard. Every value is derived from canonical purchase
 * documents; no manually-curated rating or independent KPI table exists. */
export async function listVendorPerformanceWithin(
  exec: DB,
  scope: Scope,
  input: VendorPerformancePageInput = {},
) {
  const cursor = Number.isSafeInteger(input.cursor) && Number(input.cursor) >= 0
    ? Number(input.cursor) : 0;
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
  const vendorRows = await exec.select().from(supplier).where(and(
    eq(supplier.masterFn, scope.masterFn),
    eq(supplier.companyFn, scope.companyFn),
    gt(supplier.id, cursor),
  )).orderBy(supplier.id).limit(limit + 1);
  const hasMore = vendorRows.length > limit;
  const vendors = hasMore ? vendorRows.slice(0, limit) : vendorRows;
  if (!vendors.length) return { data: [], nextCursor: null };
  const vendorIds = vendors.map((vendor) => vendor.id);
  const orders = await exec.select().from(purchaseOrder).where(and(
    eq(purchaseOrder.masterFn, scope.masterFn),
    eq(purchaseOrder.companyFn, scope.companyFn),
    inArray(purchaseOrder.supplierId, vendorIds),
  ));
  const orderIds = orders.map((order) => order.id);
  const quotationIds = orders.flatMap((order) => order.supplierQuotationId == null
    ? [] : [order.supplierQuotationId]);
  const [receipts, invoices, orderLines, quotations, priceLists] = await Promise.all([
    orderIds.length ? exec.select().from(goodsReceipt).where(and(
      eq(goodsReceipt.masterFn, scope.masterFn), eq(goodsReceipt.companyFn, scope.companyFn),
      inArray(goodsReceipt.orderId, orderIds),
    )) : [],
    orderIds.length ? exec.select().from(supplierInvoice).where(and(
      eq(supplierInvoice.masterFn, scope.masterFn), eq(supplierInvoice.companyFn, scope.companyFn),
      inArray(supplierInvoice.orderId, orderIds),
    )) : [],
    orderIds.length ? exec.select().from(purchaseOrderLine).where(and(
      eq(purchaseOrderLine.masterFn, scope.masterFn), eq(purchaseOrderLine.companyFn, scope.companyFn),
      inArray(purchaseOrderLine.orderId, orderIds),
    )) : [],
    quotationIds.length ? exec.select().from(supplierQuotation).where(and(
      eq(supplierQuotation.masterFn, scope.masterFn), eq(supplierQuotation.companyFn, scope.companyFn),
      inArray(supplierQuotation.id, quotationIds),
    )) : [],
    exec.select().from(supplierPriceList).where(and(
      eq(supplierPriceList.masterFn, scope.masterFn),
      eq(supplierPriceList.companyFn, scope.companyFn),
      eq(supplierPriceList.status, 'active'),
      inArray(supplierPriceList.supplierId, vendorIds),
    )),
  ]);
  const receiptIds = receipts.map((receipt) => receipt.id);
  const returns = receiptIds.length ? await exec.select().from(purchaseReturn).where(and(
    eq(purchaseReturn.masterFn, scope.masterFn),
    eq(purchaseReturn.companyFn, scope.companyFn),
    eq(purchaseReturn.status, 'credited'),
    inArray(purchaseReturn.goodsReceiptId, receiptIds),
  )) : [];
  const priceListLines = priceLists.length ? await exec.select().from(supplierPriceListLine).where(and(
    eq(supplierPriceListLine.masterFn, scope.masterFn),
    eq(supplierPriceListLine.companyFn, scope.companyFn),
    inArray(supplierPriceListLine.priceListId, priceLists.map((list) => list.id)),
  )) : [];

  const receiptByOrder = new Map(receipts.map((receipt) => [receipt.orderId, receipt]));
  const quotationById = new Map(quotations.map((quotation) => [quotation.id, quotation]));
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const listLines = new Map<number, typeof priceListLines>();
  priceListLines.forEach((line) => {
    const rows = listLines.get(line.priceListId) ?? [];
    rows.push(line);
    listLines.set(line.priceListId, rows);
  });
  const rows = vendors.map((vendor) => {
    const vendorOrders = orders.filter((order) => order.supplierId === vendor.id);
    const vendorOrderIds = new Set(vendorOrders.map((order) => order.id));
    const vendorReceipts = receipts.filter((receipt) => vendorOrderIds.has(receipt.orderId));
    const vendorInvoices = invoices.filter((invoice) => invoice.supplierId === vendor.id);
    const vendorReceiptIds = new Set(vendorReceipts.map((receipt) => receipt.id));
    const vendorReturns = returns.filter((ret) => vendorReceiptIds.has(ret.goodsReceiptId));
    const spend = vendorInvoices.reduce(
      (sum, invoice) => sum.plus(invoice.totalAmount), new Decimal(0),
    );
    const returnValue = vendorReturns.reduce(
      (sum, ret) => sum.plus(ret.totalAmount), new Decimal(0),
    );
    const leadDays = vendorReceipts.map((receipt) => {
      const order = orderById.get(receipt.orderId)!;
      return daysBetween(order.orderDate, receipt.receivedDate);
    });
    const promised = vendorOrders.flatMap((order) => {
      const receipt = receiptByOrder.get(order.id);
      const quotation = order.supplierQuotationId == null
        ? null : quotationById.get(order.supplierQuotationId);
      if (!receipt || !quotation) return [];
      return [{ onTime: receipt.receivedDate <= addDays(order.orderDate, quotation.leadTimeDays) }];
    });
    const matchedInvoices = vendorInvoices.filter((invoice) => {
      const order = orderById.get(invoice.orderId);
      return order && new Decimal(invoice.totalAmount).eq(order.totalAmount);
    }).length;
    const vendorLists = priceLists.filter((list) => list.supplierId === vendor.id);
    const vendorLines = orderLines.filter((line) => vendorOrderIds.has(line.orderId));
    const coveredLines = vendorLines.filter((line) => {
      const order = orderById.get(line.orderId)!;
      return vendorLists.some((list) => (
        list.currency === order.currency
        && list.effectiveFrom <= order.orderDate
        && (list.effectiveTo == null || list.effectiveTo >= order.orderDate)
        && (listLines.get(list.id) ?? []).some((contractLine) => (
          contractLine.productId === line.productId
          && new Decimal(contractLine.minQty).lte(line.qty)
        ))
      ));
    }).length;
    const receivedPct = pct(new Decimal(vendorReceipts.length), new Decimal(vendorOrders.length));
    const onTimePct = pct(
      new Decimal(promised.filter((row) => row.onTime).length), new Decimal(promised.length),
    );
    const invoiceMatchPct = pct(new Decimal(matchedInvoices), new Decimal(vendorInvoices.length));
    const returnRatePct = pct(returnValue, spend) ?? '0.0';
    const contractCoveragePct = pct(new Decimal(coveredLines), new Decimal(vendorLines.length));
    const scoreInputs = [receivedPct, onTimePct, invoiceMatchPct, contractCoveragePct]
      .filter((value): value is string => value != null)
      .map((value) => new Decimal(value));
    let rating = scoreInputs.length
      ? Decimal.sum(...scoreInputs).div(scoreInputs.length).div(20)
      : new Decimal(0);
    rating = rating.minus(Decimal.min(new Decimal(returnRatePct).div(20), '0.5'));
    rating = Decimal.max(0, Decimal.min(5, rating)).toDecimalPlaces(1);
    return {
      id: vendor.id,
      masterFn: scope.masterFn,
      companyFn: scope.companyFn,
      supplierId: vendor.id,
      supplierCode: vendor.code,
      supplierName: vendor.name,
      orderCount: vendorOrders.length,
      receivedCount: vendorReceipts.length,
      receivedPct,
      invoicedSpend: spend.toFixed(2),
      avgLeadDays: leadDays.length
        ? new Decimal(leadDays.reduce((sum, value) => sum + value, 0)).div(leadDays.length)
          .toDecimalPlaces(1).toFixed(1)
        : null,
      onTimePct,
      returnRatePct,
      invoiceMatchPct,
      contractCoveragePct,
      rating: rating.toFixed(1),
    };
  });
  return { data: rows, nextCursor: hasMore ? rows[rows.length - 1].id : null };
}
