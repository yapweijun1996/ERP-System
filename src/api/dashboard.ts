import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from '../data/db';
import { listCompanies } from '../data/repo';
import {
  account, glEntry, invoice, product, salesOrder, stockLevel,
} from '../data/schema';

export interface DashboardAccess {
  sales: boolean;
  finance: boolean;
  inventory: boolean;
}

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
    inArray(salesOrder.status, ['draft', 'pending_approval']),
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

async function monthRevenueTotal(
  db: DB, masterFn: string, companyFn: string, asOf: Date, timeZone: string,
): Promise<number> {
  const localMonth = sql`date_trunc('month', ${asOf.toISOString()}::timestamptz at time zone ${timeZone})`;
  const [row] = await db.select({
    net: sql<number>`coalesce(sum(${glEntry.credit}) - sum(${glEntry.debit}),0)::float`,
  }).from(glEntry)
    .innerJoin(account, and(
      eq(account.id, glEntry.accountId),
      eq(account.masterFn, glEntry.masterFn),
      eq(account.companyFn, glEntry.companyFn),
    ))
    .where(and(
      eq(glEntry.masterFn, masterFn),
      eq(glEntry.companyFn, companyFn),
      eq(account.code, '4000'),
      sql`${glEntry.postedAt} >= (${localMonth} at time zone ${timeZone})`,
      sql`${glEntry.postedAt} < ((${localMonth} + interval '1 month') at time zone ${timeZone})`,
    ));
  return row?.net ?? 0;
}

async function cashPosition(db: DB, masterFn: string, companyFn: string): Promise<number> {
  const [row] = await db.select({
    balance: sql<number>`coalesce(sum(${glEntry.debit}) - sum(${glEntry.credit}),0)::float`,
  }).from(glEntry)
    .innerJoin(account, and(
      eq(account.id, glEntry.accountId),
      eq(account.masterFn, glEntry.masterFn),
      eq(account.companyFn, glEntry.companyFn),
    ))
    .where(and(
      eq(glEntry.masterFn, masterFn),
      eq(glEntry.companyFn, companyFn),
      eq(account.code, '1000'),
    ));
  return row?.balance ?? 0;
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

export async function buildDashboard(
  db: DB, masterFn: string, companyFn: string, access: DashboardAccess, asOf = new Date(),
) {
  // `/api/dashboard` runs inside withTenantTransaction(). On PostgreSQL that
  // transaction is backed by one pg Client, so its queries must be awaited in
  // order rather than dispatched through Promise.all(). node-postgres currently
  // queues the concurrent calls but warns that this will be rejected in pg@9.
  const companies = await listCompanies(db, masterFn);
  const timeZone = companies.find((item) => item.companyFn === companyFn)?.timeZone ?? 'UTC';
  const productCount = access.inventory ? await countProducts(db, masterFn, companyFn) : null;
  const orders = access.sales ? await openOrders(db, masterFn, companyFn) : null;
  const receivables = access.finance ? await openReceivables(db, masterFn, companyFn) : null;
  const revenue = access.sales
    ? await monthRevenueTotal(db, masterFn, companyFn, asOf, timeZone) : null;
  const cash = access.finance ? await cashPosition(db, masterFn, companyFn) : null;
  const alerts = access.inventory ? await stockAlerts(db, masterFn, companyFn) : [];
  return {
    scope: { masterFn, companyFn },
    companies,
    metrics: {
      productCount,
      openOrders: orders?.count ?? null,
      openOrderValue: orders?.value ?? null,
      openInvoices: receivables?.count ?? null,
      arOpen: receivables?.value ?? null,
      cash,
      mtdRevenue: revenue,
      stockAlertCount: access.inventory ? alerts.length : null,
    },
    stockAlerts: alerts,
    generatedAt: new Date().toISOString(),
  };
}
