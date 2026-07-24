import { and, asc, eq, lte } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import { withTenantTransaction } from '../../data/tenantTransaction';
import { company, customer, invoice } from '../../data/schema';

const DUE_DAYS = 30;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface ArAgingRequest {
  masterFn: string;
  activeCompanyFn: string;
  actorUserId: number;
  customerId?: number;
  cursor?: string;
  limit?: number;
}

export interface ArAgingRow {
  customerId: number;
  customerCode: string;
  customerName: string;
  notDue: string;
  days1To30: string;
  days31To60: string;
  days61To90: string;
  days90Plus: string;
  overdue: string;
  total: string;
}

export interface ArAgingReport {
  data: {
    asOf: string;
    currency: string;
    bucketPolicy: {
      dueDays: 30;
      buckets: readonly ['not_due', '1_30', '31_60', '61_90', '90_plus'];
    };
    metrics: {
      totalReceivables: string;
      overdue: string;
      overduePercent: string | null;
      customerCount: number;
    };
    rows: ArAgingRow[];
    totals: Omit<ArAgingRow, 'customerId' | 'customerCode' | 'customerName'>;
  };
  meta: {
    nextCursor: string | null;
    totalCount: number;
    generatedAt: string;
    source: 'unpaid_sales_invoices';
    balanceBasis: 'unpaid_invoice_total';
  };
}

export class ArAgingError extends Error {
  constructor(
    public readonly code:
      | 'invalid_report_query'
      | 'customer_not_found'
      | 'company_not_found'
      | 'UNSUPPORTED_RECEIVABLE_CURRENCY',
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'ArAgingError';
  }
}

type Cursor = { v: 1; overdue: string; total: string; customerId: number };

function encodeCursor(row: ArAgingRow): string {
  const json = JSON.stringify({
    v: 1,
    overdue: row.overdue,
    total: row.total,
    customerId: row.customerId,
  } satisfies Cursor);
  return `v1.${Array.from(new TextEncoder().encode(json))
    .map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const [prefix, hex] = value.split('.');
    if (prefix !== 'v1' || !hex || hex.length % 2) throw new Error('invalid cursor');
    const bytes = new Uint8Array(hex.match(/../g)!.map((pair) => Number.parseInt(pair, 16)));
    const cursor = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Cursor>;
    if (
      cursor.v !== 1
      || !Number.isSafeInteger(cursor.customerId)
      || Number(cursor.customerId) <= 0
      || !new Decimal(String(cursor.overdue)).isFinite()
      || !new Decimal(String(cursor.total)).isFinite()
    ) throw new Error('invalid cursor');
    return cursor as Cursor;
  } catch {
    throw new ArAgingError('invalid_report_query', 'cursor is invalid.');
  }
}

function isoDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function addUtcDays(value: string, days: number): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function decimal(value: unknown): Decimal {
  return new Decimal(value == null || value === '' ? 0 : String(value));
}

function emptyAmounts() {
  return {
    notDue: new Decimal(0),
    days1To30: new Decimal(0),
    days31To60: new Decimal(0),
    days61To90: new Decimal(0),
    days90Plus: new Decimal(0),
  };
}

function asRow(
  identity: Pick<ArAgingRow, 'customerId' | 'customerCode' | 'customerName'>,
  amounts: ReturnType<typeof emptyAmounts>,
): ArAgingRow {
  const overdue = amounts.days1To30
    .plus(amounts.days31To60).plus(amounts.days61To90).plus(amounts.days90Plus);
  const total = amounts.notDue.plus(overdue);
  return {
    ...identity,
    notDue: amounts.notDue.toFixed(2),
    days1To30: amounts.days1To30.toFixed(2),
    days31To60: amounts.days31To60.toFixed(2),
    days61To90: amounts.days61To90.toFixed(2),
    days90Plus: amounts.days90Plus.toFixed(2),
    overdue: overdue.toFixed(2),
    total: total.toFixed(2),
  };
}

function rowAfterCursor(row: ArAgingRow, cursor: Cursor): boolean {
  const overdue = decimal(row.overdue).comparedTo(cursor.overdue);
  if (overdue !== 0) return overdue < 0;
  const total = decimal(row.total).comparedTo(cursor.total);
  if (total !== 0) return total < 0;
  return row.customerId > cursor.customerId;
}

export async function getArAgingOptions(
  db: DB,
  input: Pick<ArAgingRequest, 'masterFn' | 'activeCompanyFn' | 'actorUserId'>,
  now = new Date(),
) {
  const scope = { masterFn: input.masterFn, companyFn: input.activeCompanyFn };
  return withTenantTransaction(db, scope, async (tx) => {
    const [companyRow] = await tx.select({
      companyFn: company.companyFn,
      name: company.name,
      currency: company.currency,
    }).from(company).where(and(
      eq(company.masterFn, scope.masterFn),
      eq(company.companyFn, scope.companyFn),
    )).limit(1);
    if (!companyRow) throw new ArAgingError('company_not_found', 'Active company was not found.');
    const customers = await tx.select({
      id: customer.id,
      code: customer.code,
      name: customer.name,
    }).from(customer).where(and(
      eq(customer.masterFn, scope.masterFn),
      eq(customer.companyFn, scope.companyFn),
    )).orderBy(asc(customer.name), asc(customer.id));
    return {
      asOf: isoDate(now),
      currency: companyRow.currency,
      company: companyRow,
      customers,
      bucketPolicy: {
        dueDays: DUE_DAYS as 30,
        buckets: ['not_due', '1_30', '31_60', '61_90', '90_plus'] as const,
      },
    };
  });
}

export async function buildArAgingReport(
  db: DB,
  input: ArAgingRequest,
  now = new Date(),
): Promise<ArAgingReport> {
  const limit = input.limit == null ? DEFAULT_LIMIT : Number(input.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new ArAgingError('invalid_report_query', `limit must be between 1 and ${MAX_LIMIT}.`);
  }
  if (input.customerId != null && (!Number.isSafeInteger(input.customerId) || input.customerId <= 0)) {
    throw new ArAgingError('invalid_report_query', 'customerId must be a positive integer.');
  }
  const cursor = decodeCursor(input.cursor);
  const asOf = isoDate(now);
  const scope = { masterFn: input.masterFn, companyFn: input.activeCompanyFn };
  return withTenantTransaction(db, scope, async (tx) => {
    const [companyRow] = await tx.select({ currency: company.currency }).from(company).where(and(
      eq(company.masterFn, scope.masterFn),
      eq(company.companyFn, scope.companyFn),
    )).limit(1);
    if (!companyRow) throw new ArAgingError('company_not_found', 'Active company was not found.');

    const customers = await tx.select({
      id: customer.id,
      code: customer.code,
      name: customer.name,
    }).from(customer).where(and(
      eq(customer.masterFn, scope.masterFn),
      eq(customer.companyFn, scope.companyFn),
      ...(input.customerId ? [eq(customer.id, input.customerId)] : []),
    ));
    if (input.customerId && !customers.length) {
      throw new ArAgingError('customer_not_found', 'Customer was not found in the active company.');
    }
    const customerById = new Map(customers.map((row) => [row.id, row]));
    const invoices = await tx.select({
      customerId: invoice.customerId,
      invoiceDate: invoice.invoiceDate,
      currency: invoice.currency,
      totalAmount: invoice.totalAmount,
    }).from(invoice).where(and(
      eq(invoice.masterFn, scope.masterFn),
      eq(invoice.companyFn, scope.companyFn),
      eq(invoice.status, 'unpaid'),
      lte(invoice.invoiceDate, asOf),
      ...(input.customerId ? [eq(invoice.customerId, input.customerId)] : []),
    ));
    const unsupportedCurrencies = [...new Set(invoices
      .map((row) => row.currency.toUpperCase())
      .filter((currencyCode) => currencyCode !== companyRow.currency.toUpperCase()))].sort();
    if (unsupportedCurrencies.length) {
      throw new ArAgingError(
        'UNSUPPORTED_RECEIVABLE_CURRENCY',
        'Unpaid receivables include currencies other than the company functional currency.',
        { currencies: unsupportedCurrencies, functionalCurrency: companyRow.currency },
      );
    }

    const amountsByCustomer = new Map<number, ReturnType<typeof emptyAmounts>>();
    const asOfDate = new Date(`${asOf}T00:00:00.000Z`);
    for (const invoiceRow of invoices) {
      if (!customerById.has(invoiceRow.customerId)) continue;
      const amounts = amountsByCustomer.get(invoiceRow.customerId) ?? emptyAmounts();
      const dueDate = addUtcDays(invoiceRow.invoiceDate, DUE_DAYS);
      const age = Math.floor((asOfDate.getTime() - dueDate.getTime()) / 86_400_000);
      const amount = decimal(invoiceRow.totalAmount);
      if (age <= 0) amounts.notDue = amounts.notDue.plus(amount);
      else if (age <= 30) amounts.days1To30 = amounts.days1To30.plus(amount);
      else if (age <= 60) amounts.days31To60 = amounts.days31To60.plus(amount);
      else if (age <= 90) amounts.days61To90 = amounts.days61To90.plus(amount);
      else amounts.days90Plus = amounts.days90Plus.plus(amount);
      amountsByCustomer.set(invoiceRow.customerId, amounts);
    }

    const allRows = [...amountsByCustomer.entries()].map(([customerId, amounts]) => {
      const customerRow = customerById.get(customerId)!;
      return asRow({
        customerId,
        customerCode: customerRow.code,
        customerName: customerRow.name,
      }, amounts);
    }).sort((left, right) =>
      decimal(right.overdue).comparedTo(left.overdue)
      || decimal(right.total).comparedTo(left.total)
      || left.customerId - right.customerId);

    const totalsDecimal = allRows.reduce((totals, row) => {
      totals.notDue = totals.notDue.plus(row.notDue);
      totals.days1To30 = totals.days1To30.plus(row.days1To30);
      totals.days31To60 = totals.days31To60.plus(row.days31To60);
      totals.days61To90 = totals.days61To90.plus(row.days61To90);
      totals.days90Plus = totals.days90Plus.plus(row.days90Plus);
      return totals;
    }, emptyAmounts());
    const totalsRow = asRow({ customerId: 0, customerCode: '', customerName: '' }, totalsDecimal);
    const candidates = cursor ? allRows.filter((row) => rowAfterCursor(row, cursor)) : allRows;
    const page = candidates.slice(0, limit);
    const hasMore = candidates.length > limit;
    const totalReceivables = decimal(totalsRow.total);
    const overdue = decimal(totalsRow.overdue);

    return {
      data: {
        asOf,
        currency: companyRow.currency,
        bucketPolicy: {
          dueDays: DUE_DAYS,
          buckets: ['not_due', '1_30', '31_60', '61_90', '90_plus'],
        },
        metrics: {
          totalReceivables: totalReceivables.toFixed(2),
          overdue: overdue.toFixed(2),
          overduePercent: totalReceivables.isZero()
            ? null : overdue.div(totalReceivables).mul(100).toFixed(1),
          customerCount: allRows.length,
        },
        rows: page,
        totals: {
          notDue: totalsRow.notDue,
          days1To30: totalsRow.days1To30,
          days31To60: totalsRow.days31To60,
          days61To90: totalsRow.days61To90,
          days90Plus: totalsRow.days90Plus,
          overdue: totalsRow.overdue,
          total: totalsRow.total,
        },
      },
      meta: {
        nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : null,
        totalCount: allRows.length,
        generatedAt: now.toISOString(),
        source: 'unpaid_sales_invoices',
        balanceBasis: 'unpaid_invoice_total',
      },
    };
  });
}
