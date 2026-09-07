import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const commonSource = readFileSync('web/public/assets/screens-common.js', 'utf8');
const salesHubSource = readFileSync('web/public/assets/screens-sales-hub.js', 'utf8');

interface BrowserDateApi {
  addCalendarDays(value: string, days: number): string | null;
  salesDueDate(value: string): string;
  salesInvoiceViewFacts(
    invoice: Record<string, unknown>,
    asOf: string,
    periodStart: string,
    periodEnd: string,
  ): {
    status: string;
    rawStatus: string;
    balance: number;
    isOutstanding: boolean;
    isOverdue: boolean;
    postedInPeriod: boolean;
  };
}

function browserDateApi(): BrowserDateApi {
  const context = vm.createContext({
    window: {},
    document: {},
    console,
    Date,
    Intl,
    Map,
    Set,
    Promise,
    Number,
    String,
    Array,
    Object,
    RegExp,
    JSON,
    Math,
    SCREENS: {},
    registerSalesTransactionList: () => undefined,
    moduleNav: () => '',
    listPage: () => undefined,
    esc: (value: unknown) => String(value),
    money: () => '',
    money0: () => '',
    t: () => '',
    INVOICE_STATUS_UI: {},
    TONES: {},
  });
  vm.runInContext(commonSource, context);
  vm.runInContext(salesHubSource, context);
  return context as unknown as BrowserDateApi;
}

describe('browser date-only contract', () => {
  it('adds invoice terms across SG/MY month, year and leap-day boundaries', () => {
    const api = browserDateApi();

    expect(api.salesDueDate('2026-06-28')).toBe('2026-07-28');
    expect(api.addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(api.addCalendarDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(api.addCalendarDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(api.addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('does not convert invalid date-only input into a different calendar date', () => {
    const api = browserDateApi();

    expect(api.addCalendarDays('2026-02-31', 1)).toBeNull();
    expect(api.salesDueDate('not-a-date')).toBe('not-a-date');
  });

  it('separates stored invoice status from aging and selected-period facts', () => {
    const api = browserDateApi();
    const context = {
      asOf: '2026-07-27',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
    };

    const overdue = api.salesInvoiceViewFacts({
      date: '2024-06-01', due: '2024-07-01', total: 100, paid: 0, rawStatus: 'unpaid',
    }, context.asOf, context.periodStart, context.periodEnd);
    expect(overdue).toMatchObject({
      status: 'Overdue', rawStatus: 'unpaid', balance: 100,
      isOutstanding: true, isOverdue: true, postedInPeriod: false,
    });

    const currentUnpaid = api.salesInvoiceViewFacts({
      date: '2026-06-28', due: '2026-07-28', total: 200, paid: 0, rawStatus: 'unpaid',
    }, context.asOf, context.periodStart, context.periodEnd);
    expect(currentUnpaid).toMatchObject({
      status: 'Posted', rawStatus: 'unpaid', balance: 200,
      isOutstanding: true, isOverdue: false, postedInPeriod: true,
    });

    const paid = api.salesInvoiceViewFacts({
      date: '2026-06-29', due: '2026-07-29', total: 300, paid: 300, rawStatus: 'paid',
    }, context.asOf, context.periodStart, context.periodEnd);
    expect(paid).toMatchObject({
      status: 'Paid', rawStatus: 'paid', balance: 0,
      isOutstanding: false, isOverdue: false, postedInPeriod: true,
    });

    const future = api.salesInvoiceViewFacts({
      date: '2026-07-01', due: '2026-07-31', total: 400, paid: 0, rawStatus: 'unpaid',
    }, context.asOf, context.periodStart, context.periodEnd);
    expect(future).toMatchObject({
      status: 'Posted', rawStatus: 'unpaid', balance: 400,
      isOutstanding: true, isOverdue: false, postedInPeriod: false,
    });
  });
});
