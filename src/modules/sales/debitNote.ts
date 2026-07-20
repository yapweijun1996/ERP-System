import { and, eq, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { getEffectiveTaxRate } from '../../data/repo';
import { account, glEntry, invoice, salesDebitNote } from '../../data/schema';

export class SalesDebitNoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalesDebitNoteError';
  }
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new SalesDebitNoteError(`${label} is required.`);
  return normalized;
}

async function accountId(exec: DB, scope: Scope, code: string) {
  const [row] = await exec.select({ id: account.id }).from(account).where(and(
    eq(account.masterFn, scope.masterFn),
    eq(account.companyFn, scope.companyFn),
    eq(account.code, code),
  ));
  if (!row) throw new SalesDebitNoteError(`Account ${code} is not configured.`);
  return row.id;
}

export interface CreateSalesDebitNoteInput {
  docNo: string;
  invoiceId: number;
  noteDate: string;
  reason: string;
  netAmount: string | number;
  taxCode: string;
}

export async function createSalesDebitNoteWithin(
  exec: DB,
  scope: Scope,
  input: CreateSalesDebitNoteInput,
) {
  const docNo = required(input.docNo, 'Debit note number');
  const reason = required(input.reason, 'Reason');
  const taxCode = required(input.taxCode, 'Tax code');
  if (!Number.isSafeInteger(input.invoiceId) || input.invoiceId <= 0) {
    throw new SalesDebitNoteError('invoiceId must be a positive integer.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.noteDate)) {
    throw new SalesDebitNoteError('noteDate must use YYYY-MM-DD.');
  }
  let net: Decimal;
  try {
    net = new Decimal(input.netAmount);
  } catch {
    throw new SalesDebitNoteError('netAmount must be a valid decimal.');
  }
  if (!net.isFinite() || net.lte(0)) {
    throw new SalesDebitNoteError('netAmount must be greater than zero.');
  }
  const [original] = await exec.select({
    id: invoice.id,
    currency: invoice.currency,
    status: invoice.status,
  }).from(invoice).where(and(
    eq(invoice.masterFn, scope.masterFn),
    eq(invoice.companyFn, scope.companyFn),
    eq(invoice.id, input.invoiceId),
  ));
  if (!original) throw new SalesDebitNoteError('Invoice is unavailable in this company.');
  if (original.status === 'cancelled') {
    throw new SalesDebitNoteError('A cancelled invoice cannot receive a debit note.');
  }
  const taxRule = await getEffectiveTaxRate(exec, scope, taxCode, input.noteDate);
  if (!taxRule) throw new SalesDebitNoteError(`No tax rule for ${taxCode} on ${input.noteDate}.`);
  const rate = new Decimal(taxRule.rate);
  const roundedNet = net.toDecimalPlaces(2);
  const tax = roundedNet.mul(rate).div(100).toDecimalPlaces(2);
  const total = roundedNet.plus(tax);
  const [note] = await exec.insert(salesDebitNote).values({
    masterFn: scope.masterFn,
    companyFn: scope.companyFn,
    docNo,
    invoiceId: original.id,
    noteDate: input.noteDate,
    currency: original.currency,
    reason,
    netAmount: roundedNet.toFixed(2),
    taxCode,
    taxRate: rate.toFixed(3),
    taxAmount: tax.toFixed(2),
    totalAmount: total.toFixed(2),
  }).returning({
    id: salesDebitNote.id,
    docNo: salesDebitNote.docNo,
    status: salesDebitNote.status,
    version: salesDebitNote.version,
    totalAmount: salesDebitNote.totalAmount,
  });
  return note;
}

export async function postSalesDebitNoteWithin(exec: DB, scope: Scope, debitNoteId: number) {
  const [note] = await exec.select().from(salesDebitNote).where(and(
    eq(salesDebitNote.masterFn, scope.masterFn),
    eq(salesDebitNote.companyFn, scope.companyFn),
    eq(salesDebitNote.id, debitNoteId),
  )).for('update');
  if (!note || note.status !== 'draft') {
    throw new SalesDebitNoteError('Only a draft debit note can be posted.');
  }
  const arId = await accountId(exec, scope, '1100');
  const revenueId = await accountId(exec, scope, '4000');
  const taxId = await accountId(exec, scope, '2200');
  await exec.insert(glEntry).values([
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: note.docNo,
      accountId: arId, debit: note.totalAmount, credit: '0', memo: 'AR debit',
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: note.docNo,
      accountId: revenueId, debit: '0', credit: note.netAmount, memo: 'Debit note revenue',
    },
    {
      masterFn: scope.masterFn, companyFn: scope.companyFn, journalRef: note.docNo,
      accountId: taxId, debit: '0', credit: note.taxAmount, memo: 'Output tax',
    },
  ]);
  const [posted] = await exec.update(salesDebitNote).set({
    status: 'posted',
    version: sql`${salesDebitNote.version} + 1`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(salesDebitNote.masterFn, scope.masterFn),
    eq(salesDebitNote.companyFn, scope.companyFn),
    eq(salesDebitNote.id, note.id),
  )).returning({
    debitNoteId: salesDebitNote.id,
    status: salesDebitNote.status,
    version: salesDebitNote.version,
    totalAmount: salesDebitNote.totalAmount,
  });
  return posted;
}

export function createSalesDebitNote(db: DB, scope: Scope, input: CreateSalesDebitNoteInput) {
  return db.transaction((tx) => createSalesDebitNoteWithin(tx, scope, input));
}

export function postSalesDebitNote(db: DB, scope: Scope, debitNoteId: number) {
  return db.transaction((tx) => postSalesDebitNoteWithin(tx, scope, debitNoteId));
}
