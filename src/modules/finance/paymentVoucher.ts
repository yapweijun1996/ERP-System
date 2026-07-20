// Payment Voucher — settles one or more of one supplier's unpaid invoices in full per
// line (no partial-payment tracking — a materially separate feature). Posts
// Dr 2100 AP / Cr 1000 Cash for the summed total and flips every referenced invoice to
// 'paid' — the first code in this repo to ever make that transition.
import { and, eq, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import {
  account, glEntry, paymentVoucher, paymentVoucherLine, supplier, supplierInvoice,
} from '../../data/schema';

export class PaymentVoucherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentVoucherError';
  }
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new PaymentVoucherError(`${label} is required.`);
  return normalized;
}

async function accountId(exec: DB, scope: Scope, code: string) {
  const [row] = await exec.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.code, code),
  ));
  if (!row) throw new PaymentVoucherError(`Account ${code} is not configured.`);
  return row.id;
}

export interface CreatePaymentVoucherInput {
  docNo: string;
  supplierId: number;
  paymentDate: string;
  bankRef?: string | null;
  supplierInvoiceIds: number[];
}

export async function createPaymentVoucherWithin(exec: DB, scope: Scope, input: CreatePaymentVoucherInput) {
  const docNo = required(input.docNo, 'Voucher number');
  if (!Number.isSafeInteger(input.supplierId) || input.supplierId <= 0) {
    throw new PaymentVoucherError('supplierId must be a positive integer.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)) {
    throw new PaymentVoucherError('paymentDate must use YYYY-MM-DD.');
  }
  const ids = Array.from(new Set(input.supplierInvoiceIds || []));
  if (!ids.length) throw new PaymentVoucherError('At least one supplier invoice is required.');
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new PaymentVoucherError('supplierInvoiceIds must be positive integers.');
  }

  const [sup] = await exec.select({ id: supplier.id, name: supplier.name }).from(supplier).where(and(
    eq(supplier.masterFn, scope.masterFn),
    eq(supplier.companyFn, scope.companyFn),
    eq(supplier.id, input.supplierId),
  ));
  if (!sup) throw new PaymentVoucherError('Supplier is unavailable in this company.');

  const invoices = await exec.select({
    id: supplierInvoice.id,
    docNo: supplierInvoice.docNo,
    supplierId: supplierInvoice.supplierId,
    status: supplierInvoice.status,
    totalAmount: supplierInvoice.totalAmount,
  }).from(supplierInvoice).where(and(
    eq(supplierInvoice.masterFn, scope.masterFn),
    eq(supplierInvoice.companyFn, scope.companyFn),
    inArray(supplierInvoice.id, ids),
  )).for('update');
  if (invoices.length !== ids.length) {
    throw new PaymentVoucherError('One or more supplier invoices are unavailable in this company.');
  }
  for (const invoice of invoices) {
    if (invoice.supplierId !== sup.id) {
      throw new PaymentVoucherError(`Supplier invoice ${invoice.docNo} does not belong to ${sup.name}.`);
    }
    if (invoice.status !== 'unpaid') {
      throw new PaymentVoucherError(`Supplier invoice ${invoice.docNo} is '${invoice.status}', not unpaid.`);
    }
  }

  const total = invoices.reduce((sum, invoice) => sum.plus(new Decimal(invoice.totalAmount)), new Decimal(0));

  const [created] = await exec.insert(paymentVoucher).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    supplierId: sup.id,
    paymentDate: input.paymentDate,
    bankRef: input.bankRef?.trim() || null,
    totalAmount: total.toFixed(2),
  }).returning({
    id: paymentVoucher.id,
    docNo: paymentVoucher.docNo,
    supplierId: paymentVoucher.supplierId,
    totalAmount: paymentVoucher.totalAmount,
  });

  await exec.insert(paymentVoucherLine).values(invoices.map((invoice, index) => ({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    paymentVoucherId: created.id,
    lineNo: index + 1,
    supplierInvoiceId: invoice.id,
    amount: invoice.totalAmount,
  })));

  await exec.update(supplierInvoice).set({ status: 'paid' }).where(and(
    eq(supplierInvoice.masterFn, scope.masterFn),
    eq(supplierInvoice.companyFn, scope.companyFn),
    inArray(supplierInvoice.id, ids),
  ));

  const apId = await accountId(exec, scope, '2100');
  const cashId = await accountId(exec, scope, '1000');
  await exec.insert(glEntry).values([
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: docNo,
      accountId: apId, debit: total.toFixed(2), credit: '0', memo: `Payment voucher — ${sup.name}`,
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: docNo,
      accountId: cashId, debit: '0', credit: total.toFixed(2), memo: `Payment voucher — ${sup.name}`,
    },
  ]);

  return { ...created, lines: invoices.length };
}

export function createPaymentVoucher(db: DB, scope: Scope, input: CreatePaymentVoucherInput) {
  return db.transaction((tx) => createPaymentVoucherWithin(tx, scope, input));
}
