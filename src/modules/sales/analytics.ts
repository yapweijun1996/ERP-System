import {
  and, asc, count, desc, eq, inArray, ne, sql, sum,
} from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  appUser,
  customer,
  invoice,
  salesCreditNote,
  salesDebitNote,
  salesDelivery,
  salesEnquiry,
  salesOrder,
  salesOrderApproval,
  salesQuotation,
  salesReturn,
} from '../../data/schema';

export interface SalesAnalyticsPageInput {
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

function syntheticPage(rows: AnalyticsRow[], input: SalesAnalyticsPageInput) {
  const cursor = Number.isSafeInteger(input.cursor) && Number(input.cursor) >= 0
    ? Number(input.cursor) : 0;
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
  const candidates = rows.filter((row) => row.id > cursor).sort((a, b) => a.id - b.id);
  const hasMore = candidates.length > limit;
  const data = hasMore ? candidates.slice(0, limit) : candidates;
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}

type AdjustmentRow = {
  customerId?: number | null;
  period?: string | null;
  net: unknown;
  total: unknown;
};

function adjustmentMap(rows: AdjustmentRow[], key: 'customerId' | 'period') {
  const result = new Map<string, { net: Decimal; total: Decimal }>();
  for (const row of rows) {
    const value = row[key];
    if (value == null) continue;
    const mapKey = String(value);
    const current = result.get(mapKey) || { net: new Decimal(0), total: new Decimal(0) };
    current.net = current.net.plus(decimal(row.net));
    current.total = current.total.plus(decimal(row.total));
    result.set(mapKey, current);
  }
  return result;
}

/**
 * Bounded, rebuildable sales analytics. No KPI row is persisted: every result
 * is regrouped from immutable commercial documents, so a new invoice, credit,
 * debit, quotation decision or delivery is reflected on the next request.
 */
export async function listSalesAnalyticsWithin(
  exec: DB,
  scope: Scope,
  input: SalesAnalyticsPageInput = {},
) {
  const invoiceTenant = and(
    eq(invoice.masterFn, scope.masterFn),
    eq(invoice.companyFn, scope.companyFn),
  );
  const orderTenant = and(
    eq(salesOrder.masterFn, scope.masterFn),
    eq(salesOrder.companyFn, scope.companyFn),
  );
  const creditTenant = and(
    eq(salesCreditNote.masterFn, scope.masterFn),
    eq(salesCreditNote.companyFn, scope.companyFn),
  );
  const debitTenant = and(
    eq(salesDebitNote.masterFn, scope.masterFn),
    eq(salesDebitNote.companyFn, scope.companyFn),
  );
  const effectiveOrderStatus = sql<string>`case
    when ${salesOrder.status} = 'draft' and ${salesOrderApproval.status} = 'approved' then 'approved'
    when ${salesOrder.status} = 'draft' and ${salesOrderApproval.status} = 'pending' then 'pending_approval'
    when ${salesOrder.status} = 'draft' and ${salesOrderApproval.status} = 'rejected' then 'rejected'
    else ${salesOrder.status}
  end`;

  const [
    [invoiceTotals], [unpaidInvoiceTotals], [creditTotals], [debitTotals],
    [unpaidCreditTotals], [unpaidDebitTotals], [pendingApprovalTotals],
    [openOrderTotals], [openEnquiryTotals], [openReturnTotals],
    invoiceMonths, creditMonths, debitMonths,
    customerInvoices, customerCredits, customerDebits,
    quoteStatuses, orderStatuses, invoiceStatuses, deliveryStatuses,
  ] = await Promise.all([
    exec.select({ count: count(), net: sum(invoice.netAmount), total: sum(invoice.totalAmount) })
      .from(invoice).where(and(invoiceTenant, ne(invoice.status, 'cancelled'))),
    exec.select({ count: count(), total: sum(invoice.totalAmount) })
      .from(invoice).where(and(invoiceTenant, eq(invoice.status, 'unpaid'))),
    exec.select({ count: count(), net: sum(salesCreditNote.netAmount), total: sum(salesCreditNote.totalAmount) })
      .from(salesCreditNote).where(and(creditTenant, eq(salesCreditNote.status, 'posted'))),
    exec.select({ count: count(), net: sum(salesDebitNote.netAmount), total: sum(salesDebitNote.totalAmount) })
      .from(salesDebitNote).where(and(debitTenant, eq(salesDebitNote.status, 'posted'))),
    exec.select({ total: sum(salesCreditNote.totalAmount) }).from(salesCreditNote)
      .innerJoin(invoice, and(
        eq(invoice.id, salesCreditNote.invoiceId),
        eq(invoice.masterFn, salesCreditNote.masterFn),
        eq(invoice.companyFn, salesCreditNote.companyFn),
      )).where(and(creditTenant, eq(salesCreditNote.status, 'posted'), eq(invoice.status, 'unpaid'))),
    exec.select({ total: sum(salesDebitNote.totalAmount) }).from(salesDebitNote)
      .innerJoin(invoice, and(
        eq(invoice.id, salesDebitNote.invoiceId),
        eq(invoice.masterFn, salesDebitNote.masterFn),
        eq(invoice.companyFn, salesDebitNote.companyFn),
      )).where(and(debitTenant, eq(salesDebitNote.status, 'posted'), eq(invoice.status, 'unpaid'))),
    exec.select({ count: count(), value: sum(salesOrder.totalAmount) }).from(salesOrder)
      .where(and(orderTenant, eq(salesOrder.status, 'pending_approval'))),
    exec.select({ count: count(), value: sum(salesOrder.totalAmount) }).from(salesOrder)
      .where(and(orderTenant, inArray(salesOrder.status, ['pending_approval', 'draft']))),
    exec.select({ count: count(), value: sum(salesEnquiry.estimatedValue) }).from(salesEnquiry)
      .where(and(
        eq(salesEnquiry.masterFn, scope.masterFn),
        eq(salesEnquiry.companyFn, scope.companyFn),
        inArray(salesEnquiry.status, ['new', 'quoted']),
      )),
    exec.select({ count: count() }).from(salesReturn).where(and(
      eq(salesReturn.masterFn, scope.masterFn),
      eq(salesReturn.companyFn, scope.companyFn),
      eq(salesReturn.status, 'requested'),
    )),
    exec.select({
      period: sql<string>`to_char(${invoice.invoiceDate}, 'YYYY-MM')`,
      count: count(), net: sum(invoice.netAmount), total: sum(invoice.totalAmount),
    }).from(invoice).where(and(invoiceTenant, ne(invoice.status, 'cancelled')))
      .groupBy(sql`to_char(${invoice.invoiceDate}, 'YYYY-MM')`)
      .orderBy(desc(sql`to_char(${invoice.invoiceDate}, 'YYYY-MM')`)).limit(24),
    exec.select({
      period: sql<string>`to_char(${salesCreditNote.noteDate}, 'YYYY-MM')`,
      net: sum(salesCreditNote.netAmount), total: sum(salesCreditNote.totalAmount),
    }).from(salesCreditNote).where(and(creditTenant, eq(salesCreditNote.status, 'posted')))
      .groupBy(sql`to_char(${salesCreditNote.noteDate}, 'YYYY-MM')`).limit(24),
    exec.select({
      period: sql<string>`to_char(${salesDebitNote.noteDate}, 'YYYY-MM')`,
      net: sum(salesDebitNote.netAmount), total: sum(salesDebitNote.totalAmount),
    }).from(salesDebitNote).where(and(debitTenant, eq(salesDebitNote.status, 'posted')))
      .groupBy(sql`to_char(${salesDebitNote.noteDate}, 'YYYY-MM')`).limit(24),
    exec.select({
      customerId: customer.id,
      customerCode: customer.code,
      customerName: customer.name,
      ownerUserId: customer.ownerUserId,
      ownerName: appUser.fullName,
      invoiceCount: count(invoice.id),
      net: sum(invoice.netAmount),
      total: sum(invoice.totalAmount),
    }).from(invoice).innerJoin(customer, and(
      eq(customer.id, invoice.customerId),
      eq(customer.masterFn, invoice.masterFn),
      eq(customer.companyFn, invoice.companyFn),
    )).leftJoin(appUser, and(
      eq(appUser.userId, customer.ownerUserId),
      eq(appUser.masterFn, customer.masterFn),
    )).where(and(invoiceTenant, ne(invoice.status, 'cancelled')))
      .groupBy(customer.id, customer.code, customer.name, customer.ownerUserId, appUser.fullName)
      .orderBy(desc(sum(invoice.netAmount))).limit(50),
    exec.select({
      customerId: invoice.customerId,
      net: sum(salesCreditNote.netAmount), total: sum(salesCreditNote.totalAmount),
    }).from(salesCreditNote).innerJoin(invoice, and(
      eq(invoice.id, salesCreditNote.invoiceId),
      eq(invoice.masterFn, salesCreditNote.masterFn),
      eq(invoice.companyFn, salesCreditNote.companyFn),
    )).where(and(creditTenant, eq(salesCreditNote.status, 'posted')))
      .groupBy(invoice.customerId).limit(50),
    exec.select({
      customerId: invoice.customerId,
      net: sum(salesDebitNote.netAmount), total: sum(salesDebitNote.totalAmount),
    }).from(salesDebitNote).innerJoin(invoice, and(
      eq(invoice.id, salesDebitNote.invoiceId),
      eq(invoice.masterFn, salesDebitNote.masterFn),
      eq(invoice.companyFn, salesDebitNote.companyFn),
    )).where(and(debitTenant, eq(salesDebitNote.status, 'posted')))
      .groupBy(invoice.customerId).limit(50),
    exec.select({ status: salesQuotation.status, count: count(), value: sum(salesQuotation.totalAmount) })
      .from(salesQuotation).where(and(
        eq(salesQuotation.masterFn, scope.masterFn),
        eq(salesQuotation.companyFn, scope.companyFn),
      )).groupBy(salesQuotation.status).orderBy(asc(salesQuotation.status)),
    exec.select({ status: effectiveOrderStatus, count: count(), value: sum(salesOrder.totalAmount) })
      .from(salesOrder).leftJoin(salesOrderApproval, and(
        eq(salesOrderApproval.masterFn, salesOrder.masterFn),
        eq(salesOrderApproval.companyFn, salesOrder.companyFn),
        eq(salesOrderApproval.orderId, salesOrder.id),
      )).where(orderTenant).groupBy(effectiveOrderStatus).orderBy(asc(effectiveOrderStatus)),
    exec.select({ status: invoice.status, count: count(), value: sum(invoice.totalAmount) })
      .from(invoice).where(invoiceTenant).groupBy(invoice.status).orderBy(asc(invoice.status)),
    exec.select({ status: salesDelivery.status, count: count() }).from(salesDelivery).where(and(
      eq(salesDelivery.masterFn, scope.masterFn),
      eq(salesDelivery.companyFn, scope.companyFn),
    )).groupBy(salesDelivery.status).orderBy(asc(salesDelivery.status)),
  ]);

  const creditsByCustomer = adjustmentMap(customerCredits, 'customerId');
  const debitsByCustomer = adjustmentMap(customerDebits, 'customerId');
  const customerRows = customerInvoices.map((row) => {
    const credits = creditsByCustomer.get(String(row.customerId)) || { net: new Decimal(0), total: new Decimal(0) };
    const debits = debitsByCustomer.get(String(row.customerId)) || { net: new Decimal(0), total: new Decimal(0) };
    return {
      ...row,
      ownerName: row.ownerName || 'Unassigned',
      invoicedNet: decimal(row.net).toFixed(2),
      creditNet: credits.net.toFixed(2),
      debitNet: debits.net.toFixed(2),
      recognizedRevenue: decimal(row.net).minus(credits.net).plus(debits.net).toFixed(2),
      billedTotal: decimal(row.total).minus(credits.total).plus(debits.total).toFixed(2),
    };
  }).sort((a, b) => decimal(b.recognizedRevenue).cmp(decimal(a.recognizedRevenue)));

  const reps = new Map<string, {
    userId: number | null; name: string; customerCount: number;
    invoiceCount: number; recognizedRevenue: Decimal;
  }>();
  for (const row of customerRows) {
    const key = row.ownerUserId == null ? `name:${row.ownerName}` : `id:${row.ownerUserId}`;
    const current = reps.get(key) || {
      userId: row.ownerUserId, name: row.ownerName, customerCount: 0,
      invoiceCount: 0, recognizedRevenue: new Decimal(0),
    };
    current.customerCount += 1;
    current.invoiceCount += integer(row.invoiceCount);
    current.recognizedRevenue = current.recognizedRevenue.plus(row.recognizedRevenue);
    reps.set(key, current);
  }

  const creditByMonth = adjustmentMap(creditMonths, 'period');
  const debitByMonth = adjustmentMap(debitMonths, 'period');
  const months = new Map(invoiceMonths.map((row) => [String(row.period), {
    period: String(row.period), invoiceCount: integer(row.count),
    invoicedNet: decimal(row.net), recognizedRevenue: decimal(row.net),
  }]));
  for (const period of new Set([...creditByMonth.keys(), ...debitByMonth.keys()])) {
    const current = months.get(period) || {
      period, invoiceCount: 0, invoicedNet: new Decimal(0), recognizedRevenue: new Decimal(0),
    };
    current.recognizedRevenue = current.recognizedRevenue
      .minus(creditByMonth.get(period)?.net || 0)
      .plus(debitByMonth.get(period)?.net || 0);
    months.set(period, current);
  }

  const grossRevenue = decimal(invoiceTotals?.net);
  const creditRevenue = decimal(creditTotals?.net);
  const debitRevenue = decimal(debitTotals?.net);
  const grossAr = decimal(unpaidInvoiceTotals?.total);
  const rows: AnalyticsRow[] = [{
    id: 1,
    kind: 'summary',
    recognizedRevenue: grossRevenue.minus(creditRevenue).plus(debitRevenue).toFixed(2),
    grossInvoiceRevenue: grossRevenue.toFixed(2),
    postedCreditRevenue: creditRevenue.toFixed(2),
    postedDebitRevenue: debitRevenue.toFixed(2),
    invoiceCount: integer(invoiceTotals?.count),
    openReceivables: Decimal.max(
      0,
      grossAr.minus(decimal(unpaidCreditTotals?.total)).plus(decimal(unpaidDebitTotals?.total)),
    ).toFixed(2),
    unpaidInvoiceCount: integer(unpaidInvoiceTotals?.count),
    openOrderCount: integer(openOrderTotals?.count),
    openOrderValue: decimal(openOrderTotals?.value).toFixed(2),
    pendingApprovalCount: integer(pendingApprovalTotals?.count),
    pendingApprovalValue: decimal(pendingApprovalTotals?.value).toFixed(2),
    openEnquiryCount: integer(openEnquiryTotals?.count),
    openEnquiryValue: decimal(openEnquiryTotals?.value).toFixed(2),
    openReturnCount: integer(openReturnTotals?.count),
    postedCreditCount: integer(creditTotals?.count),
    postedDebitCount: integer(debitTotals?.count),
  }];

  [...months.values()].sort((a, b) => a.period.localeCompare(b.period)).forEach((row, index) => rows.push({
    id: 1000 + index, kind: 'monthly-revenue', period: row.period,
    invoiceCount: row.invoiceCount, invoicedNet: row.invoicedNet.toFixed(2),
    recognizedRevenue: row.recognizedRevenue.toFixed(2),
  }));
  customerRows.forEach((row, index) => rows.push({
    id: 2000 + index, kind: 'customer-revenue', ...row,
  }));
  [...reps.values()].sort((a, b) => b.recognizedRevenue.cmp(a.recognizedRevenue))
    .forEach((row, index) => rows.push({
      id: 3000 + index, kind: 'salesperson-revenue', userId: row.userId,
      salesperson: row.name, customerCount: row.customerCount,
      invoiceCount: row.invoiceCount, recognizedRevenue: row.recognizedRevenue.toFixed(2),
    }));
  quoteStatuses.forEach((row, index) => rows.push({
    id: 4000 + index, kind: 'quotation-status', status: row.status,
    count: integer(row.count), value: decimal(row.value).toFixed(2),
  }));
  orderStatuses.forEach((row, index) => rows.push({
    id: 5000 + index, kind: 'order-status', status: row.status,
    count: integer(row.count), value: decimal(row.value).toFixed(2),
  }));
  invoiceStatuses.forEach((row, index) => rows.push({
    id: 6000 + index, kind: 'invoice-status', status: row.status,
    count: integer(row.count), value: decimal(row.value).toFixed(2),
  }));
  deliveryStatuses.forEach((row, index) => rows.push({
    id: 7000 + index, kind: 'delivery-status', status: row.status,
    count: integer(row.count), value: '0.00',
  }));
  return syntheticPage(rows, input);
}
