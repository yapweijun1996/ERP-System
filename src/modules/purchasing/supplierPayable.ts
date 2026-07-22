import { and, eq } from 'drizzle-orm';
import Decimal from 'decimal.js';
import type { DB } from '../../data/db';
import type { Scope } from '../../data/repo';
import { supplierCreditNote, supplierDebitNote, supplierInvoice } from '../../data/schema';

/** Canonical unpaid amount for one supplier invoice. The caller must lock the
 *  invoice row before using this value in a write transaction. */
export async function supplierInvoiceOutstandingWithin(
  exec: DB,
  scope: Scope,
  invoiceId: number,
) {
  const [invoice] = await exec.select({
    id: supplierInvoice.id,
    totalAmount: supplierInvoice.totalAmount,
  }).from(supplierInvoice).where(and(
    eq(supplierInvoice.masterFn, scope.masterFn),
    eq(supplierInvoice.companyFn, scope.companyFn),
    eq(supplierInvoice.id, invoiceId),
  ));
  if (!invoice) return null;

  const credits = await exec.select({ totalAmount: supplierCreditNote.totalAmount })
    .from(supplierCreditNote).where(and(
      eq(supplierCreditNote.masterFn, scope.masterFn),
      eq(supplierCreditNote.companyFn, scope.companyFn),
      eq(supplierCreditNote.supplierInvoiceId, invoiceId),
      eq(supplierCreditNote.status, 'posted'),
    ));
  const debits = await exec.select({ totalAmount: supplierDebitNote.totalAmount })
    .from(supplierDebitNote).where(and(
      eq(supplierDebitNote.masterFn, scope.masterFn),
      eq(supplierDebitNote.companyFn, scope.companyFn),
      eq(supplierDebitNote.supplierInvoiceId, invoiceId),
      eq(supplierDebitNote.status, 'posted'),
    ));
  const adjustments = [...credits, ...debits].reduce(
    (sum, row) => sum.plus(row.totalAmount),
    new Decimal(0),
  );
  return new Decimal(invoice.totalAmount).minus(adjustments).toDecimalPlaces(2);
}
