import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../data/db';
import { listCompanies } from '../data/repo';
import {
  account, glEntry, invoice, product, salesOrder, stockLevel,
} from '../data/schema';

async function countProducts(db: DB, masterFn: string, companyFn: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(product)
    .where(and(eq(product.masterFn, masterFn), eq(product.companyFn, companyFn)));
  return row?.n ?? 0;
}

async function openOrders(db: DB, masterFn: string, companyFn: string) {
  const [row] = await db.select({
    count: sql<number>`count(*)::int`,
    value: sql<number>`coalesce(sum(${salesOrder.totalAmount}),0)::float`,
  }).from(salesOrder).where(and(
    eq(salesOrder.masterFn, masterFn),
    eq(salesOrder.companyFn, companyFn),
    eq(salesOrder.status, 'draft'),
  ));
  return { count: row?.count ?? 0, value: row?.value ?? 0 };
}

async function openReceivables(db: DB, masterFn: string, companyFn: string) {
  const [row] = await db.select({
    count: sql<number>`count(*)::int`,
    value: sql<number>`coalesce(sum(${invoice.totalAmount}),0)::float`,
  }).from(invoice).where(and(
    eq(invoice.masterFn, masterFn),
    eq(invoice.companyFn, companyFn),
    eq(invoice.status, 'unpaid'),
  ));
  return { count: row?.count ?? 0, value: row?.value ?? 0 };
}

async function revenueTotal(db: DB, masterFn: string, companyFn: string): Promise<number> {
  const [row] = await db.select({
    net: sql<number>`coalesce(sum(${glEntry.credit}) - sum(${glEntry.debit}),0)::float`,
  }).from(glEntry)
    .innerJoin(account, eq(account.id, glEntry.accountId))
    .where(and(
      eq(glEntry.masterFn, masterFn),
      eq(glEntry.companyFn, companyFn),
      eq(account.code, '4000'),
    ));
  return row?.net ?? 0;
}

async function stockAlerts(db: DB, masterFn: string, companyFn: string, threshold = 20) {
  return db.select({
    productId: product.id,
    sku: product.sku,
    name: product.name,
    onHand: sql<number>`coalesce(sum(${stockLevel.qty}),0)::float`,
  }).from(product)
    .leftJoin(stockLevel, and(
      eq(stockLevel.productId, product.id),
      eq(stockLevel.masterFn, masterFn),
      eq(stockLevel.companyFn, companyFn),
    ))
    .where(and(eq(product.masterFn, masterFn), eq(product.companyFn, companyFn)))
    .groupBy(product.id, product.sku, product.name)
    .having(sql`coalesce(sum(${stockLevel.qty}),0) <= ${threshold}`);
}

export async function buildDashboard(db: DB, masterFn: string, companyFn: string) {
  const [companies, productCount, orders, receivables, revenue, alerts] = await Promise.all([
    listCompanies(db, masterFn),
    countProducts(db, masterFn, companyFn),
    openOrders(db, masterFn, companyFn),
    openReceivables(db, masterFn, companyFn),
    revenueTotal(db, masterFn, companyFn),
    stockAlerts(db, masterFn, companyFn),
  ]);
  return {
    scope: { masterFn, companyFn },
    companies,
    metrics: {
      productCount,
      openOrders: orders.count,
      openOrderValue: orders.value,
      openInvoices: receivables.count,
      arOpen: receivables.value,
      mtdRevenue: revenue,
      stockAlertCount: alerts.length,
    },
    stockAlerts: alerts,
    generatedAt: new Date().toISOString(),
  };
}
