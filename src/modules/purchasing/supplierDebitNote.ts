import { and, eq, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import { getEffectiveTaxRate, type Scope } from '../../data/repo';
import {
  account, glEntry, supplierDebitNote, supplierInvoice,
} from '../../data/schema';
import { supplierInvoiceOutstandingWithin } from './supplierPayable';

export class SupplierDebitNoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupplierDebitNoteError';
  }
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new SupplierDebitNoteError(`${label} is required.`);
  return normalized;
}

function positive(value: string | number, label: string) {
  let result: Decimal;
  try { result = new Decimal(value); } catch { throw new SupplierDebitNoteError(`${label} must be a valid decimal.`); }
  if (!result.isFinite() || result.lte(0)) throw new SupplierDebitNoteError(`${label} must be greater than zero.`);
  return result;
}

async function accountId(exec: DB, scope: Scope, code: string) {
  const [row] = await exec.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.code, code),
  ));
  if (!row) throw new SupplierDebitNoteError(`Account ${code} is not configured.`);
  return row.id;
}

export interface CreateSupplierDebitNoteInput {
  docNo: string;
  supplierInvoiceId: number;
  noteDate: string;
  reason: string;
  netAmount: string | number;
  taxCode: string;
}

export async function createSupplierDebitNoteWithin(
  exec: DB,
  scope: Scope,
  input: CreateSupplierDebitNoteInput,
) {
  const docNo = required(input.docNo, 'Debit note number');
  const reason = required(input.reason, 'Reason');
  const taxCode = required(input.taxCode, 'Tax code');
  if (!Number.isSafeInteger(input.supplierInvoiceId) || input.supplierInvoiceId <= 0) {
    throw new SupplierDebitNoteError('supplierInvoiceId must be a positive integer.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.noteDate)) {
    throw new SupplierDebitNoteError('noteDate must use YYYY-MM-DD.');
  }
  const net = positive(input.netAmount, 'netAmount').toDecimalPlaces(2);
  const [invoice] = await exec.select({
    id: supplierInvoice.id,
    supplierId: supplierInvoice.supplierId,
    status: supplierInvoice.status,
    currency: supplierInvoice.currency,
  }).from(supplierInvoice).where(and(
    eq(supplierInvoice.masterFn, scope.masterFn),
    eq(supplierInvoice.companyFn, scope.companyFn),
    eq(supplierInvoice.id, input.supplierInvoiceId),
  ));
  if (!invoice) throw new SupplierDebitNoteError('Supplier invoice is unavailable in this company.');
  if (invoice.status !== 'unpaid') throw new SupplierDebitNoteError('Supplier invoice must still be unpaid.');

  const taxRule = await getEffectiveTaxRate(exec, scope, taxCode, input.noteDate);
  if (!taxRule) throw new SupplierDebitNoteError(`No tax rule for ${taxCode} on ${input.noteDate}.`);
  const rate = new Decimal(taxRule.rate);
  const tax = net.mul(rate).div(100).toDecimalPlaces(2);
  const total = net.plus(tax);
  const [created] = await exec.insert(supplierDebitNote).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    supplierInvoiceId: invoice.id,
    supplierId: invoice.supplierId,
    noteDate: input.noteDate,
    currency: invoice.currency,
    reason,
    netAmount: net.toFixed(2),
    taxCode,
    taxRate: rate.toFixed(3),
    taxAmount: tax.toFixed(2),
    totalAmount: total.toFixed(2),
  }).returning({
    id: supplierDebitNote.id,
    docNo: supplierDebitNote.docNo,
    status: supplierDebitNote.status,
    version: supplierDebitNote.version,
    totalAmount: supplierDebitNote.totalAmount,
  });
  return created;
}

export async function postSupplierDebitNoteWithin(exec: DB, scope: Scope, debitNoteId: number) {
  const [note] = await exec.select().from(supplierDebitNote).where(and(
    eq(supplierDebitNote.masterFn, scope.masterFn),
    eq(supplierDebitNote.companyFn, scope.companyFn),
    eq(supplierDebitNote.id, debitNoteId),
  )).for('update');
  if (!note || note.status !== 'draft') {
    throw new SupplierDebitNoteError('Only a draft supplier debit note can be posted.');
  }
  const [invoice] = await exec.select({
    id: supplierInvoice.id,
    docNo: supplierInvoice.docNo,
    status: supplierInvoice.status,
  }).from(supplierInvoice).where(and(
    eq(supplierInvoice.masterFn, scope.masterFn),
    eq(supplierInvoice.companyFn, scope.companyFn),
    eq(supplierInvoice.id, note.supplierInvoiceId),
  )).for('update');
  if (!invoice || invoice.status !== 'unpaid') {
    throw new SupplierDebitNoteError('The source supplier invoice must still be unpaid.');
  }
  const outstanding = await supplierInvoiceOutstandingWithin(exec, scope, invoice.id);
  if (!outstanding || outstanding.lte(0) || new Decimal(note.totalAmount).gt(outstanding)) {
    throw new SupplierDebitNoteError(`Debit note exceeds the remaining payable for ${invoice.docNo}.`);
  }

  const payableId = await accountId(exec, scope, '2100');
  const varianceId = await accountId(exec, scope, '5800');
  const inputTaxId = await accountId(exec, scope, '1200');
  const legs = [
    { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: note.docNo,
      accountId: payableId, debit: note.totalAmount, credit: '0', memo: 'Supplier claim — AP reduction' },
    { masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: note.docNo,
      accountId: varianceId, debit: '0', credit: note.netAmount, memo: 'Supplier claim recovery' },
  ];
  if (new Decimal(note.taxAmount).gt(0)) legs.push({
    masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: note.docNo,
    accountId: inputTaxId, debit: '0', credit: note.taxAmount, memo: 'Input tax reversal',
  });
  await exec.insert(glEntry).values(legs);
  const [posted] = await exec.update(supplierDebitNote).set({
    status: 'posted',
    version: sql`${supplierDebitNote.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(supplierDebitNote.masterFn, scope.masterFn),
    eq(supplierDebitNote.companyFn, scope.companyFn),
    eq(supplierDebitNote.id, note.id),
  )).returning({
    debitNoteId: supplierDebitNote.id,
    status: supplierDebitNote.status,
    version: supplierDebitNote.version,
    totalAmount: supplierDebitNote.totalAmount,
  });
  return posted;
}

export function createSupplierDebitNote(db: DB, scope: Scope, input: CreateSupplierDebitNoteInput) {
  return db.transaction((tx) => createSupplierDebitNoteWithin(tx, scope, input));
}

export function postSupplierDebitNote(db: DB, scope: Scope, debitNoteId: number) {
  return db.transaction((tx) => postSupplierDebitNoteWithin(tx, scope, debitNoteId));
}
