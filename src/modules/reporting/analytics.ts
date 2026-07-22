import {
  and, asc, countDistinct, desc, eq, max, ne, sql, sum,
} from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  account,
  glEntry,
  invoice,
  product,
  salesCreditNote,
  salesCreditNoteLine,
  salesOrderLine,
  stockLevel,
  stockMovement,
  warehouse,
} from '../../data/schema';
import { listPurchasingAnalyticsWithin } from '../purchasing/analytics';
import { listSalesAnalyticsWithin } from '../sales/analytics';

export interface ReportingAnalyticsPageInput {
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

function syntheticPage(rows: AnalyticsRow[], input: ReportingAnalyticsPageInput) {
  const cursor = Number.isSafeInteger(input.cursor) && Number(input.cursor) >= 0
    ? Number(input.cursor) : 0;
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
  const candidates = rows.filter((row) => row.id > cursor).sort((a, b) => a.id - b.id);
  const hasMore = candidates.length > limit;
  const data = hasMore ? candidates.slice(0, limit) : candidates;
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}

function ageBucket(days: number | null) {
  if (days == null) return 'no-history';
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

/**
 * Cross-module management reporting rebuilt from canonical facts. This is a bounded
 * interactive read model, not a KPI store or an export engine. Stock age deliberately
 * means days since the latest inbound movement for the current product/warehouse
 * balance: the present schema has no FIFO cost layers, so claiming layer age would be
 * false. Category revenue is invoice-line revenue less product-attributed credit lines;
 * header-only debit notes remain in the company recognized-revenue total but cannot be
 * honestly allocated to a product category.
 */
export async function listReportingAnalyticsWithin(
  exec: DB,
  scope: Scope,
  input: ReportingAnalyticsPageInput = {},
  asOf = new Date(),
) {
  const [salesPage, purchasingPage] = await Promise.all([
    listSalesAnalyticsWithin(exec, scope, { limit: 100 }),
    listPurchasingAnalyticsWithin(exec, scope, { limit: 100 }),
  ]);
  const salesSummary = (salesPage.data.find((row) => row.kind === 'summary') || {}) as Record<string, unknown>;
  const purchasingSummary = (purchasingPage.data.find((row) => row.kind === 'summary') || {}) as Record<string, unknown>;

  const [
    [inventoryTotals], [cashTotals], invoiceCategories, creditCategories, stockRows,
  ] = await Promise.all([
    exec.select({
      productCount: countDistinct(stockLevel.productId),
      positionCount: countDistinct(stockLevel.id),
      value: sum(sql`${stockLevel.qty} * coalesce(${product.averageCost}, ${product.standardCost})`),
    }).from(stockLevel).innerJoin(product, and(
      eq(product.id, stockLevel.productId),
      eq(product.masterFn, stockLevel.masterFn),
      eq(product.companyFn, stockLevel.companyFn),
    )).where(and(
      eq(stockLevel.masterFn, scope.masterFn),
      eq(stockLevel.companyFn, scope.companyFn),
      sql`${stockLevel.qty} > 0`,
    )),
    exec.select({
      debit: sum(glEntry.debit), credit: sum(glEntry.credit),
    }).from(glEntry).innerJoin(account, and(
      eq(account.id, glEntry.accountId),
      eq(account.masterFn, glEntry.masterFn),
      eq(account.companyFn, glEntry.companyFn),
    )).where(and(
      eq(glEntry.masterFn, scope.masterFn),
      eq(glEntry.companyFn, scope.companyFn),
      eq(account.code, '1000'),
    )),
    exec.select({
      category: product.category,
      invoiceCount: countDistinct(invoice.id),
      units: sum(salesOrderLine.qty),
      net: sum(salesOrderLine.netAmount),
    }).from(invoice).innerJoin(salesOrderLine, and(
      eq(salesOrderLine.orderId, invoice.orderId),
      eq(salesOrderLine.masterFn, invoice.masterFn),
      eq(salesOrderLine.companyFn, invoice.companyFn),
    )).innerJoin(product, and(
      eq(product.id, salesOrderLine.productId),
      eq(product.masterFn, salesOrderLine.masterFn),
      eq(product.companyFn, salesOrderLine.companyFn),
    )).where(and(
      eq(invoice.masterFn, scope.masterFn),
      eq(invoice.companyFn, scope.companyFn),
      ne(invoice.status, 'cancelled'),
    )).groupBy(product.category).orderBy(asc(product.category)).limit(50),
    exec.select({
      category: product.category,
      units: sum(salesCreditNoteLine.qty),
      net: sum(salesCreditNoteLine.netAmount),
    }).from(salesCreditNoteLine).innerJoin(salesCreditNote, and(
      eq(salesCreditNote.id, salesCreditNoteLine.creditNoteId),
      eq(salesCreditNote.masterFn, salesCreditNoteLine.masterFn),
      eq(salesCreditNote.companyFn, salesCreditNoteLine.companyFn),
    )).innerJoin(product, and(
      eq(product.id, salesCreditNoteLine.productId),
      eq(product.masterFn, salesCreditNoteLine.masterFn),
      eq(product.companyFn, salesCreditNoteLine.companyFn),
    )).where(and(
      eq(salesCreditNoteLine.masterFn, scope.masterFn),
      eq(salesCreditNoteLine.companyFn, scope.companyFn),
      eq(salesCreditNote.status, 'posted'),
    )).groupBy(product.category).orderBy(asc(product.category)).limit(50),
    exec.select({
      stockLevelId: stockLevel.id,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      category: product.category,
      warehouseId: warehouse.id,
      warehouseCode: warehouse.code,
      warehouseName: warehouse.name,
      qty: stockLevel.qty,
      cost: sql<string>`coalesce(${product.averageCost}, ${product.standardCost})`,
      lastInboundAt: max(stockMovement.movedAt),
    }).from(stockLevel).innerJoin(product, and(
      eq(product.id, stockLevel.productId),
      eq(product.masterFn, stockLevel.masterFn),
      eq(product.companyFn, stockLevel.companyFn),
    )).innerJoin(warehouse, and(
      eq(warehouse.id, stockLevel.warehouseId),
      eq(warehouse.masterFn, stockLevel.masterFn),
      eq(warehouse.companyFn, stockLevel.companyFn),
    )).leftJoin(stockMovement, and(
      eq(stockMovement.masterFn, stockLevel.masterFn),
      eq(stockMovement.companyFn, stockLevel.companyFn),
      eq(stockMovement.productId, stockLevel.productId),
      eq(stockMovement.warehouseId, stockLevel.warehouseId),
      eq(stockMovement.direction, 'in'),
    )).where(and(
      eq(stockLevel.masterFn, scope.masterFn),
      eq(stockLevel.companyFn, scope.companyFn),
      sql`${stockLevel.qty} > 0`,
    )).groupBy(
      stockLevel.id, product.id, product.sku, product.name, product.category,
      warehouse.id, warehouse.code, warehouse.name, stockLevel.qty,
      product.averageCost, product.standardCost,
    ).orderBy(
      desc(sql`${stockLevel.qty} * coalesce(${product.averageCost}, ${product.standardCost})`),
      asc(stockLevel.id),
    ).limit(100),
  ]);

  const credits = new Map(creditCategories.map((row) => [row.category, {
    units: decimal(row.units), net: decimal(row.net),
  }]));
  const cashBalance = decimal(cashTotals?.debit).minus(decimal(cashTotals?.credit));
  const rows: AnalyticsRow[] = [{
    id: 1,
    kind: 'summary',
    recognizedRevenue: String(salesSummary.recognizedRevenue || '0.00'),
    openReceivables: String(salesSummary.openReceivables || '0.00'),
    openSalesOrderValue: String(salesSummary.openOrderValue || '0.00'),
    openPurchaseOrderValue: String(purchasingSummary.openOrderValue || '0.00'),
    netUnpaidPayables: String(purchasingSummary.netUnpaidAp || '0.00'),
    inventoryValue: decimal(inventoryTotals?.value).toFixed(2),
    inventoryProductCount: integer(inventoryTotals?.productCount),
    inventoryPositionCount: integer(inventoryTotals?.positionCount),
    cashBalance: cashBalance.toFixed(2),
    asOf: asOf.toISOString(),
    stockRowsBounded: stockRows.length >= 100,
  }];

  salesPage.data.filter((row) => row.kind === 'monthly-revenue').forEach((row, index) => {
    rows.push({ ...row, id: 1000 + index, kind: 'monthly-revenue' });
  });
  salesPage.data.filter((row) => row.kind === 'customer-revenue').forEach((row, index) => {
    rows.push({ ...row, id: 2000 + index, kind: 'customer-revenue' });
  });
  invoiceCategories.forEach((row, index) => {
    const credit = credits.get(row.category) || { units: new Decimal(0), net: new Decimal(0) };
    rows.push({
      id: 3000 + index,
      kind: 'sales-category',
      category: row.category,
      invoiceCount: integer(row.invoiceCount),
      invoicedUnits: decimal(row.units).toFixed(4),
      creditedUnits: credit.units.toFixed(4),
      netUnits: decimal(row.units).minus(credit.units).toFixed(4),
      invoicedRevenue: decimal(row.net).toFixed(2),
      creditedRevenue: credit.net.toFixed(2),
      productRevenue: decimal(row.net).minus(credit.net).toFixed(2),
    });
  });
  stockRows.forEach((row, index) => {
    const lastInbound = row.lastInboundAt == null ? null : new Date(row.lastInboundAt);
    const ageDays = lastInbound == null
      ? null
      : Math.max(0, Math.floor((asOf.getTime() - lastInbound.getTime()) / 86_400_000));
    rows.push({
      id: 4000 + index,
      kind: 'stock-aging',
      productId: row.productId,
      sku: row.sku,
      productName: row.productName,
      category: row.category,
      warehouseId: row.warehouseId,
      warehouseCode: row.warehouseCode,
      warehouseName: row.warehouseName,
      qty: decimal(row.qty).toFixed(4),
      unitCost: decimal(row.cost).toFixed(4),
      inventoryValue: decimal(row.qty).mul(decimal(row.cost)).toFixed(2),
      lastInboundAt: lastInbound?.toISOString() || null,
      ageDays,
      bucket: ageBucket(ageDays),
    });
  });
  return syntheticPage(rows, input);
}
